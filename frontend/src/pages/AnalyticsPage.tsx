import { ChangeEvent, FormEvent, useMemo, useRef, useState } from "react";
import type {
  BuildExcelSummaryResponse,
  UploadExcelResponse,
} from "../api/backend";
import { useAuth } from "../auth/AuthProvider";
import {
  useExcelYearOverYearExportMutation,
  useExcelSummaryExportMutation,
  useExcelSummaryMutation,
  useExcelUploadMutation,
} from "../hooks/useExcelQueries";

const ACCEPTED_FILE_TYPES = ".xlsx,.xls,.csv";
const MAX_FILE_SIZE_MB = 50;
const EXPORT_COLUMN_OPTIONS = [
  { key: "previousReading", label: "Odczyt poprzedni" },
  { key: "currentReading", label: "Odczyt końcowy" },
  { key: "consumptionReported", label: "Zużycie" },
  { key: "consumptionComputed", label: "Zużycie wyliczone" },
  { key: "consumptionStatus", label: "Status zużycia" },
  { key: "rate", label: "Stawka" },
  { key: "reportedTotal", label: "Suma raportowana" },
  { key: "computedTotal", label: "Suma wyliczona" },
  { key: "totalStatus", label: "Status sumy" },
] as const;

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Nieznany błąd";
}

export function AnalyticsPage() {
  const { session } = useAuth();
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [summaryNotice, setSummaryNotice] = useState<string | null>(null);
  const [analysisDraft, setAnalysisDraft] =
    useState<UploadExcelResponse["analysisDraft"]>(null);
  const [selectedApartment, setSelectedApartment] = useState<string>("all");
  const [rangeFrom, setRangeFrom] = useState("");
  const [rangeTo, setRangeTo] = useState("");
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>([]);
  const [selectedExportColumns, setSelectedExportColumns] = useState<string[]>(
    EXPORT_COLUMN_OPTIONS.map((option) => option.key)
  );
  const [activeReportTab, setActiveReportTab] = useState<"standard" | "yoy">(
    "standard"
  );
  const [includeYearlySummary, setIncludeYearlySummary] = useState(true);
  const [comparisonMonth, setComparisonMonth] = useState(12);
  const [includeValidation, setIncludeValidation] = useState(true);
  const [includeOnlyMismatches, setIncludeOnlyMismatches] = useState(false);
  const [summaryResult, setSummaryResult] =
    useState<BuildExcelSummaryResponse | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const uploadMutation = useExcelUploadMutation({
    onSuccess: (result) => {
      if (!result.uploaded) {
        setNotice(`Upload nieudany: ${result.error ?? "Nieznany błąd"}`);
        setAnalysisDraft(null);
        setSummaryResult(null);
        return;
      }

      const uploadedCount =
        result.filesCount ?? result.uploadedFiles?.length ?? 0;
      setNotice(`Pliki Excel zostały poprawnie przesłane (${uploadedCount}).`);
      setSummaryNotice(null);
      setSummaryResult(null);

      if (result.analysisDraft) {
        setAnalysisDraft(result.analysisDraft);
        setSelectedApartment("all");
        setRangeFrom(result.analysisDraft.periodRange.min ?? "");
        setRangeTo(result.analysisDraft.periodRange.max ?? "");
        setSelectedMetrics(result.analysisDraft.availableMetrics);
        setSelectedExportColumns(
          EXPORT_COLUMN_OPTIONS.map((option) => option.key)
        );
        setIncludeYearlySummary(true);
        setComparisonMonth(12);
      } else {
        setAnalysisDraft(null);
      }

      if (result.analysisDraftError) {
        setSummaryNotice(
          `Upload zakończony, ale parser analityczny nie przygotował draftu: ${result.analysisDraftError}`
        );
      }
    },
    onError: (error) => {
      setNotice(`Błąd uploadu: ${getErrorMessage(error)}`);
    },
  });

  const summaryMutation = useExcelSummaryMutation({
    onSuccess: (result) => {
      setSummaryResult(result);
      setSummaryNotice("Podsumowanie zostało wygenerowane.");
    },
    onError: (error) => {
      setSummaryNotice(`Błąd podsumowania: ${getErrorMessage(error)}`);
    },
  });

  const exportMutation = useExcelSummaryExportMutation({
    onSuccess: (result) => {
      console.info("[excel-export] file download ready", {
        fileName: result.fileName,
        bytes: result.blob.size,
      });
      const objectUrl = URL.createObjectURL(result.blob);
      const downloadLink = document.createElement("a");
      downloadLink.href = objectUrl;
      downloadLink.download = result.fileName;
      document.body.append(downloadLink);
      downloadLink.click();
      downloadLink.remove();
      URL.revokeObjectURL(objectUrl);
      setSummaryNotice(`Pobrano plik: ${result.fileName}`);
    },
    onError: (error) => {
      console.error("[excel-export] failed", error);
      setSummaryNotice(`Błąd eksportu: ${getErrorMessage(error)}`);
    },
  });

  const yearOverYearExportMutation = useExcelYearOverYearExportMutation({
    onSuccess: (result) => {
      const objectUrl = URL.createObjectURL(result.blob);
      const downloadLink = document.createElement("a");
      downloadLink.href = objectUrl;
      downloadLink.download = result.fileName;
      document.body.append(downloadLink);
      downloadLink.click();
      downloadLink.remove();
      URL.revokeObjectURL(objectUrl);
      setSummaryNotice(`Pobrano raport rok-do-roku: ${result.fileName}`);
    },
    onError: (error) => {
      setSummaryNotice(`Blad raportu rok-do-roku: ${getErrorMessage(error)}`);
    },
  });

  const selectedFilesSummary = useMemo(
    () =>
      selectedFiles.map(
        (file) => `${file.name} (${Math.round(file.size / 1024)} KB)`
      ),
    [selectedFiles]
  );

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextFiles = Array.from(event.target.files ?? []);
    setNotice(null);

    if (nextFiles.length === 0) {
      setSelectedFiles([]);
      return;
    }

    const invalidExtensionFile = nextFiles.find((file) => {
      const lowerName = file.name.toLowerCase();
      return !(
        lowerName.endsWith(".xlsx") ||
        lowerName.endsWith(".xls") ||
        lowerName.endsWith(".csv")
      );
    });
    if (invalidExtensionFile) {
      setSelectedFiles([]);
      setNotice(
        `Plik "${invalidExtensionFile.name}" ma niedozwolone rozszerzenie. Dozwolone: .xlsx, .xls, .csv`
      );
      return;
    }

    const tooLargeFile = nextFiles.find(
      (file) => file.size > MAX_FILE_SIZE_MB * 1024 * 1024
    );
    if (tooLargeFile) {
      setSelectedFiles([]);
      setNotice(
        `Plik "${tooLargeFile.name}" przekracza limit ${MAX_FILE_SIZE_MB} MB.`
      );
      return;
    }

    setSelectedFiles(nextFiles);
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!session?.access_token) {
      setNotice("Zaloguj się, aby przesyłać pliki Excel.");
      return;
    }

    if (selectedFiles.length === 0) {
      setNotice("Najpierw wybierz przynajmniej jeden plik Excel.");
      return;
    }

    setNotice(null);
    setSummaryNotice(null);
    setSummaryResult(null);
    setAnalysisDraft(null);
    uploadMutation.mutate({
      files: selectedFiles,
      accessToken: session.access_token,
    });
  };

  const toggleMetric = (metric: string) => {
    setSelectedMetrics((previous) =>
      previous.includes(metric)
        ? previous.filter((item) => item !== metric)
        : [...previous, metric]
    );
  };

  const toggleExportColumn = (columnKey: string) => {
    setSelectedExportColumns((previous) =>
      previous.includes(columnKey)
        ? previous.filter((item) => item !== columnKey)
        : [...previous, columnKey]
    );
  };

  const getSummaryPayload = () => {
    if (!analysisDraft?.uploadId) {
      return null;
    }

    return {
      uploadId: analysisDraft.uploadId,
      apartment: selectedApartment === "all" ? undefined : selectedApartment,
      dateFrom: rangeFrom || undefined,
      dateTo: rangeTo || undefined,
      metrics: selectedMetrics,
      includeValidation,
      includeOnlyMismatches,
      exportColumns: selectedExportColumns,
      includeYearlySummary,
    };
  };

  const onBuildSummary = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (activeReportTab !== "standard") {
      onExportYearOverYear();
      return;
    }

    if (!session?.access_token) {
      setSummaryNotice("Zaloguj się, aby generować podsumowanie.");
      return;
    }

    if (!analysisDraft?.uploadId) {
      setSummaryNotice(
        "Najpierw prześlij pliki i poczekaj na przygotowanie draftu analizy."
      );
      return;
    }

    if (selectedMetrics.length === 0) {
      setSummaryNotice("Wybierz przynajmniej jedną metrykę do porównania.");
      return;
    }

    const payload = getSummaryPayload();
    if (!payload) {
      setSummaryNotice("Brak payloadu podsumowania. Wgraj pliki ponownie.");
      return;
    }

    setSummaryNotice(null);
    summaryMutation.mutate({
      accessToken: session.access_token,
      payload,
    });
  };

  const onExportSummary = () => {
    if (!session?.access_token) {
      setSummaryNotice("Zaloguj się, aby pobrać wynikowy plik Excel.");
      return;
    }

    if (!analysisDraft?.uploadId) {
      setSummaryNotice("Najpierw prześlij pliki i wygeneruj sesję analizy.");
      return;
    }

    if (selectedMetrics.length === 0) {
      setSummaryNotice("Wybierz przynajmniej jedną metrykę przed eksportem.");
      return;
    }
    if (selectedExportColumns.length === 0) {
      setSummaryNotice(
        "Wybierz przynajmniej jedną kolumnę do pliku wynikowego."
      );
      return;
    }

    const payload = getSummaryPayload();
    if (!payload) {
      setSummaryNotice("Brak payloadu eksportu. Wgraj pliki ponownie.");
      return;
    }

    console.info("[excel-export] export triggered", {
      uploadId: payload.uploadId,
      metrics: payload.metrics?.length ?? 0,
      exportColumns: payload.exportColumns?.length ?? 0,
      includeYearlySummary: payload.includeYearlySummary ?? true,
    });
    setSummaryNotice("Trwa generowanie wynikowego pliku Excel...");
    exportMutation.mutate({
      accessToken: session.access_token,
      payload,
    });
  };

  const onExportYearOverYear = () => {
    if (!session?.access_token) {
      setSummaryNotice("Zaloguj sie, aby pobrac raport rok-do-roku.");
      return;
    }

    if (!analysisDraft?.uploadId) {
      setSummaryNotice("Najpierw przeslij pliki i wygeneruj sesje analizy.");
      return;
    }

    if (selectedMetrics.length === 0) {
      setSummaryNotice("Wybierz przynajmniej jedna metryke przed eksportem.");
      return;
    }

    const payload = getSummaryPayload();
    if (!payload) {
      setSummaryNotice("Brak payloadu raportu rok-do-roku. Wgraj pliki ponownie.");
      return;
    }

    setSummaryNotice("Trwa generowanie raportu rok-do-roku...");
    yearOverYearExportMutation.mutate({
      accessToken: session.access_token,
      payload: {
        ...payload,
        comparisonMonth,
      },
    });
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-slate-900">Wgrywanie Excela</h2>

      <div className="mt-4">
        <p className="text-sm font-medium text-slate-800">Typ raportu</p>
        <div className="mt-2 inline-flex rounded-lg border border-slate-300 bg-white p-1">
          <button
            type="button"
            onClick={() => setActiveReportTab("standard")}
            className={`rounded-md px-3 py-1.5 text-sm ${
              activeReportTab === "standard"
                ? "bg-slate-800 text-white"
                : "text-slate-700 hover:bg-slate-100"
            }`}
          >
            Standard
          </button>
          <button
            type="button"
            onClick={() => setActiveReportTab("yoy")}
            className={`rounded-md px-3 py-1.5 text-sm ${
              activeReportTab === "yoy"
                ? "bg-slate-800 text-white"
                : "text-slate-700 hover:bg-slate-100"
            }`}
          >
            Rok do roku
          </button>
        </div>
      </div>

      <form onSubmit={onSubmit} className="mt-4 grid gap-4">
        <div>
          <label
            htmlFor="excel-file"
            className="mb-2 block text-sm font-medium text-slate-800"
          >
            Pliki Excel
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={fileInputRef}
              id="excel-file"
              type="file"
              accept={ACCEPTED_FILE_TYPES}
              multiple
              onChange={onFileChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 transition hover:bg-slate-100"
            >
              Wybierz pliki
            </button>
            <span className="text-sm text-slate-600">
              {selectedFiles.length > 0
                ? `Wybrano plikow: ${selectedFiles.length}`
                : "Nie wybrano plikow"}
            </span>
          </div>
        </div>

        {selectedFilesSummary.length > 0 && (
          <div className="text-sm text-slate-600">
            <p className="font-medium text-slate-700">
              Wybrane pliki ({selectedFilesSummary.length}):
            </p>
            <ul className="mt-1 list-disc pl-5">
              {selectedFilesSummary.map((fileSummary) => (
                <li key={fileSummary}>{fileSummary}</li>
              ))}
            </ul>
          </div>
        )}

        <button
          type="submit"
          disabled={
            uploadMutation.isPending || selectedFiles.length === 0 || !session
          }
          className="inline-flex w-fit items-center rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {uploadMutation.isPending ? "Wgrywanie..." : "Wgraj pliki"}
        </button>
      </form>

      {notice && <p className="mt-4 text-sm text-slate-700">{notice}</p>}


      {analysisDraft && (
        <form
          onSubmit={onBuildSummary}
          className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4"
        >
          <h3 className="text-base font-semibold text-slate-900">
            Podsumowanie po uploadzie
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            Wybierz lokal, zakres dat i metryki. Backend sprawdzi czy zużycie ×
            stawka zgadza się z sumą.
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Pliki w sesji: {analysisDraft.filesCount}. Rekordy:{" "}
            {analysisDraft.recordsCount}.
          </p>

          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <div className="grid gap-1">
              <label
                htmlFor="summary-apartment"
                className="text-sm font-medium text-slate-800"
              >
                Lokal
              </label>
              <select
                id="summary-apartment"
                value={selectedApartment}
                onChange={(event) => setSelectedApartment(event.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              >
                <option value="all">Wszystkie lokale</option>
                {analysisDraft.apartments.map((apartment) => (
                  <option key={apartment} value={apartment}>
                    {apartment}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-1">
              <label
                htmlFor="summary-from"
                className="text-sm font-medium text-slate-800"
              >
                Zakres od
              </label>
              <input
                id="summary-from"
                type="date"
                value={rangeFrom}
                onChange={(event) => setRangeFrom(event.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              />
            </div>

            <div className="grid gap-1">
              <label
                htmlFor="summary-to"
                className="text-sm font-medium text-slate-800"
              >
                Zakres do
              </label>
              <input
                id="summary-to"
                type="date"
                value={rangeTo}
                onChange={(event) => setRangeTo(event.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              />
            </div>
          </div>

          <div className="mt-4">
            <p className="text-sm font-medium text-slate-800">Co porównać</p>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              {analysisDraft.availableMetrics.map((metric) => (
                <label
                  key={metric}
                  className="inline-flex items-center gap-2 text-sm text-slate-700"
                >
                  <input
                    type="checkbox"
                    checked={selectedMetrics.includes(metric)}
                    onChange={() => toggleMetric(metric)}
                    className="h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-200"
                  />
                  {metric}
                </label>
              ))}
            </div>
          </div>

          <div className="mt-4 grid gap-2">
            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={includeValidation}
                onChange={(event) => setIncludeValidation(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-200"
              />
              Sprawdź poprawności wyliczeń (zużycie × stawka vs suma)
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={includeOnlyMismatches}
                onChange={(event) =>
                  setIncludeOnlyMismatches(event.target.checked)
                }
                className="h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-200"
              />
              Pokaż tylko rozbieżności
            </label>
          </div>

          {activeReportTab === "standard" ? (
          <div className="mt-4">
            <p className="text-sm font-medium text-slate-800">
              Kolumny w wynikowym Excelu
            </p>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              {EXPORT_COLUMN_OPTIONS.map((option) => (
                <label
                  key={option.key}
                  className="inline-flex items-center gap-2 text-sm text-slate-700"
                >
                  <input
                    type="checkbox"
                    checked={selectedExportColumns.includes(option.key)}
                    onChange={() => toggleExportColumn(option.key)}
                    className="h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-200"
                  />
                  {option.label}
                </label>
              ))}
            </div>
            <label className="mt-3 inline-flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={includeYearlySummary}
                onChange={(event) =>
                  setIncludeYearlySummary(event.target.checked)
                }
                className="h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-200"
              />
              Dodaj sekcję roczną, jeśli okresy pokrywają pełny rok
            </label>
          </div>
          ) : (
            <div className="mt-4 rounded-lg border border-slate-200 bg-white p-3">
              <p className="text-sm font-medium text-slate-800">
                Raport rok do roku (na odczytach koncowych)
              </p>
              <p className="mt-1 text-xs text-slate-600">
                Zuzycie roczne liczone jest jako roznica odczytow konca wybranego
                miesiaca miedzy kolejnymi latami.
              </p>
              <div className="mt-3 max-w-xs">
                <label
                  htmlFor="comparison-month"
                  className="mb-1 block text-sm font-medium text-slate-700"
                >
                  Miesiac porownania
                </label>
                <select
                  id="comparison-month"
                  value={comparisonMonth}
                  onChange={(event) =>
                    setComparisonMonth(Number(event.target.value))
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                >
                  {Array.from({ length: 12 }, (_, index) => index + 1).map(
                    (month) => (
                      <option key={month} value={month}>
                        {month}
                      </option>
                    )
                  )}
                </select>
              </div>
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            {activeReportTab === "standard" && (
              <button
                type="submit"
                disabled={summaryMutation.isPending || !analysisDraft.uploadId}
                className="inline-flex items-center rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {summaryMutation.isPending
                  ? "Generowanie..."
                  : "Generuj podsumowanie"}
              </button>
            )}
            <button
              type="button"
              onClick={
                activeReportTab === "standard"
                  ? onExportSummary
                  : onExportYearOverYear
              }
              disabled={
                (activeReportTab === "standard"
                  ? exportMutation.isPending
                  : yearOverYearExportMutation.isPending) ||
                !analysisDraft.uploadId
              }
              className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {activeReportTab === "standard"
                ? exportMutation.isPending
                  ? "Eksport..."
                  : "Pobierz wynikowy Excel"
                : yearOverYearExportMutation.isPending
                ? "Eksport rok-do-roku..."
                : "Pobierz raport rok-do-roku"}
            </button>
          </div>
        </form>
      )}

      {summaryNotice && (
        <p className="mt-4 text-sm text-slate-700">{summaryNotice}</p>
      )}

      {summaryResult && (
        <div className="mt-4 space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h4 className="text-sm font-semibold text-slate-900">
              Statystyki walidacji
            </h4>
            <div className="mt-2 grid gap-2 text-sm text-slate-700 md:grid-cols-3">
              <p>Wiersze: {summaryResult.stats.rowsCount}</p>
              <p>Poprawne: {summaryResult.stats.validRows}</p>
              <p>Rozbieznosci: {summaryResult.stats.invalidRows}</p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h4 className="text-sm font-semibold text-slate-900">
              Suma według metryk
            </h4>
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-2 py-2 font-medium">Metryka</th>
                    <th className="px-2 py-2 font-medium">Zużycie</th>
                    <th className="px-2 py-2 font-medium">Suma raportowana</th>
                    <th className="px-2 py-2 font-medium">Suma wyliczona</th>
                    <th className="px-2 py-2 font-medium">Roznica</th>
                  </tr>
                </thead>
                <tbody>
                  {summaryResult.totalsByMetric.map((metricRow) => (
                    <tr
                      key={metricRow.metric}
                      className="border-b border-slate-100"
                    >
                      <td className="px-2 py-2 font-medium text-slate-900">
                        {metricRow.metric}
                      </td>
                      <td className="px-2 py-2 text-slate-700">
                        {metricRow.totalConsumption}
                      </td>
                      <td className="px-2 py-2 text-slate-700">
                        {metricRow.reportedTotal}
                      </td>
                      <td className="px-2 py-2 text-slate-700">
                        {metricRow.computedTotal === null
                          ? "-"
                          : metricRow.computedTotal}
                      </td>
                      <td className="px-2 py-2 text-slate-700">
                        {metricRow.difference === null
                          ? "-"
                          : metricRow.difference}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h4 className="text-sm font-semibold text-slate-900">
              Szczegoly porownania
            </h4>
            <div className="mt-3 max-h-96 overflow-auto">
              <table className="min-w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 uppercase tracking-wide text-slate-500">
                    <th className="px-2 py-2 font-medium">Lokal</th>
                    <th className="px-2 py-2 font-medium">Od</th>
                    <th className="px-2 py-2 font-medium">Do</th>
                    <th className="px-2 py-2 font-medium">Metryka</th>
                    <th className="px-2 py-2 font-medium">Zużycie</th>
                    <th className="px-2 py-2 font-medium">Stawka</th>
                    <th className="px-2 py-2 font-medium">Suma</th>
                    <th className="px-2 py-2 font-medium">Wyliczona</th>
                    <th className="px-2 py-2 font-medium">Roznica</th>
                    <th className="px-2 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {summaryResult.rows.map((row, index) => (
                    <tr
                      key={`${row.apartment}-${row.metric}-${index}`}
                      className="border-b border-slate-100"
                    >
                      <td className="px-2 py-2 text-slate-700">
                        {row.apartment}
                      </td>
                      <td className="px-2 py-2 text-slate-700">
                        {row.dateFrom}
                      </td>
                      <td className="px-2 py-2 text-slate-700">{row.dateTo}</td>
                      <td className="px-2 py-2 text-slate-700">{row.metric}</td>
                      <td className="px-2 py-2 text-slate-700">
                        {row.consumption ?? "-"}
                      </td>
                      <td className="px-2 py-2 text-slate-700">
                        {row.rate ?? "-"}
                      </td>
                      <td className="px-2 py-2 text-slate-700">
                        {row.reportedTotal ?? "-"}
                      </td>
                      <td className="px-2 py-2 text-slate-700">
                        {row.computedTotal ?? "-"}
                      </td>
                      <td className="px-2 py-2 text-slate-700">
                        {row.difference ?? "-"}
                      </td>
                      <td className="px-2 py-2">
                        {row.isValid === null && (
                          <span className="text-slate-500">N/D</span>
                        )}
                        {row.isValid === true && (
                          <span className="text-emerald-700">OK</span>
                        )}
                        {row.isValid === false && (
                          <span className="text-red-700">Rozbieznosc</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
