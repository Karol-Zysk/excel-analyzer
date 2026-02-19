import { useState } from "react";
import type { ChangeEvent } from "react";
import { FileSpreadsheet, TrendingUp, X, Upload, Download, ChevronRight, ChevronLeft, Check } from "lucide-react";
import type { UploadExcelResponse } from "../api/backend";
import { useAuth } from "../auth/AuthProvider";
import {
  useExcelUploadMutation,
  useExcelSummaryExportMutation,
  useExcelYearOverYearExportMutation,
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

type ReportType = "standard" | "yoy";
type WizardStep = "upload" | "configure" | "processing" | "download";

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "Nieznany błąd";
}

const WIZARD_STEPS: { key: WizardStep; label: string }[] = [
  { key: "upload", label: "Wgraj pliki" },
  { key: "configure", label: "Konfiguracja" },
  { key: "processing", label: "Przetwarzanie" },
  { key: "download", label: "Pobierz wyniki" },
];

function StepIndicator({ current }: { current: WizardStep }) {
  const currentIdx = WIZARD_STEPS.findIndex((s) => s.key === current);
  return (
    <div className="flex items-center">
      {WIZARD_STEPS.map((step, idx) => {
        const done = idx < currentIdx;
        const active = idx === currentIdx;
        return (
          <div key={step.key} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-colors ${
                  done ? "bg-emerald-500 text-white" : active ? "bg-sky-500 text-white" : "bg-slate-200 text-slate-400"
                }`}
              >
                {done ? <Check className="h-4 w-4" /> : idx + 1}
              </div>
              <span className={`whitespace-nowrap text-[11px] font-medium ${active ? "text-sky-600" : done ? "text-emerald-600" : "text-slate-400"}`}>
                {step.label}
              </span>
            </div>
            {idx < WIZARD_STEPS.length - 1 && (
              <div className={`mx-2 mb-4 h-px w-10 ${idx < currentIdx ? "bg-emerald-400" : "bg-slate-200"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

type WizardProps = {
  reportType: ReportType;
  onClose: () => void;
};

function Wizard({ reportType, onClose }: WizardProps) {
  const { session } = useAuth();
  const [step, setStep] = useState<WizardStep>("upload");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [analysisDraft, setAnalysisDraft] = useState<UploadExcelResponse["analysisDraft"]>(null);
  const [selectedApartment, setSelectedApartment] = useState("all");
  const [rangeFrom, setRangeFrom] = useState("");
  const [rangeTo, setRangeTo] = useState("");
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>([]);
  const [selectedExportColumns, setSelectedExportColumns] = useState<string[]>(
    EXPORT_COLUMN_OPTIONS.map((o) => o.key)
  );
  const [includeYearlySummary, setIncludeYearlySummary] = useState(true);
  const [includeValidation, setIncludeValidation] = useState(true);
  const [includeOnlyMismatches, setIncludeOnlyMismatches] = useState(false);
  const [comparisonMonth, setComparisonMonth] = useState(12);
  const [downloadReady, setDownloadReady] = useState<{ blob: Blob; fileName: string } | null>(null);
  const [processError, setProcessError] = useState<string | null>(null);

  const uploadMutation = useExcelUploadMutation({
    onSuccess: (result) => {
      if (!result.uploaded) {
        setFileError(`Upload nieudany: ${result.error ?? "Nieznany błąd"}`);
        return;
      }
      if (result.analysisDraft) {
        setAnalysisDraft(result.analysisDraft);
        setRangeFrom(result.analysisDraft.periodRange.min ?? "");
        setRangeTo(result.analysisDraft.periodRange.max ?? "");
        setSelectedMetrics(result.analysisDraft.availableMetrics ?? []);
      }
      setStep("configure");
    },
  });

  const exportMutation = useExcelSummaryExportMutation({
    onSuccess: (result) => {
      setDownloadReady(result);
      setStep("download");
    },
    onError: (error) => {
      setProcessError(getErrorMessage(error));
      setStep("configure");
    },
  });

  const yoyExportMutation = useExcelYearOverYearExportMutation({
    onSuccess: (result) => {
      setDownloadReady(result);
      setStep("download");
    },
    onError: (error) => {
      setProcessError(getErrorMessage(error));
      setStep("configure");
    },
  });

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    setFileError(null);
    const files = Array.from(e.target.files ?? []);
    const oversized = files.filter((f) => f.size > MAX_FILE_SIZE_MB * 1024 * 1024);
    if (oversized.length > 0) {
      setFileError(`Plik zbyt duży (max ${MAX_FILE_SIZE_MB} MB): ${oversized.map((f) => f.name).join(", ")}`);
      return;
    }
    setSelectedFiles(files);
  }

  function handleUpload() {
    if (!selectedFiles.length || !session?.access_token) return;
    setFileError(null);
    uploadMutation.mutate({ files: selectedFiles, accessToken: session.access_token });
  }

  function handleProcess() {
    if (!analysisDraft?.uploadId || !session?.access_token) return;
    setProcessError(null);
    setStep("processing");
    const payload = {
      uploadId: analysisDraft.uploadId,
      apartment: selectedApartment === "all" ? undefined : selectedApartment,
      dateFrom: rangeFrom || undefined,
      dateTo: rangeTo || undefined,
      metrics: selectedMetrics.length > 0 ? selectedMetrics : undefined,
      exportColumns: selectedExportColumns,
      includeValidation,
      includeOnlyMismatches,
      includeYearlySummary,
      comparisonMonth,
    };
    if (reportType === "yoy") {
      yoyExportMutation.mutate({ payload, accessToken: session.access_token });
    } else {
      exportMutation.mutate({ payload, accessToken: session.access_token });
    }
  }

  function handleDownload() {
    if (!downloadReady) return;
    const url = URL.createObjectURL(downloadReady.blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = downloadReady.fileName;
    a.click();
    URL.revokeObjectURL(url);
  }

  function toggleMetric(metric: string) {
    setSelectedMetrics((prev) =>
      prev.includes(metric) ? prev.filter((m) => m !== metric) : [...prev, metric]
    );
  }

  function toggleExportColumn(key: string) {
    setSelectedExportColumns((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  const isUploading = uploadMutation.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              {reportType === "standard" ? "Raport standardowy" : "Analiza rok do roku"}
            </h2>
            <p className="text-sm text-slate-500">
              {reportType === "standard"
                ? "Podsumowanie zużycia mediów z wybranego okresu"
                : "Porównanie zużycia między latami"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="border-b border-slate-100 px-6 py-4">
          <StepIndicator current={step} />
        </div>

        <div className="min-h-[280px] px-6 py-5">
          {step === "upload" && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">Wgraj jeden lub więcej plików Excel (.xlsx, .xls, .csv) do analizy.</p>
              <label className="flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-8 transition hover:border-sky-400 hover:bg-sky-50">
                <Upload className="h-8 w-8 text-slate-400" />
                <div className="text-center">
                  <p className="text-sm font-medium text-slate-700">Kliknij lub przeciągnij pliki tutaj</p>
                  <p className="mt-1 text-xs text-slate-400">Maksymalny rozmiar: {MAX_FILE_SIZE_MB} MB</p>
                </div>
                <input type="file" accept={ACCEPTED_FILE_TYPES} multiple onChange={handleFileChange} className="sr-only" />
              </label>
              {selectedFiles.length > 0 && (
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="mb-2 text-xs font-medium text-slate-500">Wybrane pliki ({selectedFiles.length}):</p>
                  <ul className="space-y-1">
                    {selectedFiles.map((f) => (
                      <li key={f.name} className="flex items-center gap-2 text-sm text-slate-700">
                        <FileSpreadsheet className="h-4 w-4 text-emerald-500" />
                        {f.name}
                        <span className="text-xs text-slate-400">({(f.size / 1024 / 1024).toFixed(2)} MB)</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {fileError && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{fileError}</p>
              )}
            </div>
          )}

          {step === "configure" && analysisDraft && (
            <div className="max-h-[420px] space-y-4 overflow-y-auto pr-1">
              <p className="text-sm text-slate-500">
                Znaleziono{" "}
                <span className="font-medium text-slate-800">{analysisDraft.recordsCount}</span> rekordów w{" "}
                <span className="font-medium text-slate-800">{analysisDraft.filesCount}</span> pliku(ach).
              </p>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Lokal</label>
                <select
                  value={selectedApartment}
                  onChange={(e) => setSelectedApartment(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-sky-300 focus:outline-none focus:ring-1 focus:ring-sky-200"
                >
                  <option value="all">Wszystkie lokale</option>
                  {analysisDraft.apartments.map((apt) => (
                    <option key={apt} value={apt}>{apt}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Data od</label>
                  <input
                    type="date"
                    value={rangeFrom}
                    onChange={(e) => setRangeFrom(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-sky-300 focus:outline-none focus:ring-1 focus:ring-sky-200"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Data do</label>
                  <input
                    type="date"
                    value={rangeTo}
                    onChange={(e) => setRangeTo(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-sky-300 focus:outline-none focus:ring-1 focus:ring-sky-200"
                  />
                </div>
              </div>
              {analysisDraft.availableMetrics.length > 0 && (
                <div>
                  <label className="mb-2 block text-xs font-medium text-slate-600">Metryki</label>
                  <div className="flex flex-wrap gap-2">
                    {analysisDraft.availableMetrics.map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => toggleMetric(m)}
                        className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                          selectedMetrics.includes(m)
                            ? "border-sky-400 bg-sky-50 text-sky-700"
                            : "border-slate-200 bg-white text-slate-500 hover:border-sky-300"
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {reportType === "standard" && (
                <div className="space-y-2">
                  <label className="mb-1 block text-xs font-medium text-slate-600">Opcje</label>
                  <label className="flex cursor-pointer items-center gap-2">
                    <input type="checkbox" checked={includeYearlySummary} onChange={(e) => setIncludeYearlySummary(e.target.checked)} className="rounded" />
                    <span className="text-sm text-slate-700">Dołącz podsumowanie roczne</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-2">
                    <input type="checkbox" checked={includeValidation} onChange={(e) => setIncludeValidation(e.target.checked)} className="rounded" />
                    <span className="text-sm text-slate-700">Walidacja danych</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-2">
                    <input type="checkbox" checked={includeOnlyMismatches} onChange={(e) => setIncludeOnlyMismatches(e.target.checked)} className="rounded" />
                    <span className="text-sm text-slate-700">Tylko rozbieżności</span>
                  </label>
                </div>
              )}
              {reportType === "yoy" && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Miesiąc porównawczy</label>
                  <select
                    value={comparisonMonth}
                    onChange={(e) => setComparisonMonth(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-sky-300 focus:outline-none focus:ring-1 focus:ring-sky-200"
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                      <option key={m} value={m}>Miesiąc {m}</option>
                    ))}
                  </select>
                </div>
              )}
              {reportType === "standard" && (
                <div>
                  <label className="mb-2 block text-xs font-medium text-slate-600">Kolumny w raporcie</label>
                  <div className="flex flex-wrap gap-2">
                    {EXPORT_COLUMN_OPTIONS.map((opt) => (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => toggleExportColumn(opt.key)}
                        className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                          selectedExportColumns.includes(opt.key)
                            ? "border-emerald-400 bg-emerald-50 text-emerald-700"
                            : "border-slate-200 bg-white text-slate-400 hover:border-slate-300"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {processError && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{processError}</p>
              )}
            </div>
          )}

          {step === "processing" && (
            <div className="flex flex-col items-center justify-center gap-4 py-10">
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-sky-200 border-t-sky-500" />
              <p className="text-sm font-medium text-slate-700">Przetwarzanie danych...</p>
              <p className="text-xs text-slate-400">To może potrwać kilka sekund.</p>
            </div>
          )}

          {step === "download" && (
            <div className="flex flex-col items-center justify-center gap-4 py-10">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
                <Check className="h-8 w-8 text-emerald-600" />
              </div>
              <p className="text-base font-semibold text-slate-800">Raport gotowy!</p>
              {downloadReady && (
                <p className="text-sm text-slate-500">{downloadReady.fileName}</p>
              )}
              <button
                type="button"
                onClick={handleDownload}
                className="flex items-center gap-2 rounded-xl bg-emerald-500 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-600"
              >
                <Download className="h-4 w-4" />
                Pobierz plik Excel
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-100"
          >
            Zamknij
          </button>
          <div className="flex gap-2">
            {(step === "configure" || step === "download") && (
              <button
                type="button"
                onClick={() => setStep(step === "configure" ? "upload" : "configure")}
                className="flex items-center gap-1 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
              >
                <ChevronLeft className="h-4 w-4" />
                Wstecz
              </button>
            )}
            {step === "upload" && (
              <button
                type="button"
                onClick={handleUpload}
                disabled={selectedFiles.length === 0 || isUploading}
                className="flex items-center gap-2 rounded-xl bg-sky-500 px-5 py-2 text-sm font-semibold text-white transition hover:bg-sky-600 disabled:opacity-50"
              >
                {isUploading ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    Wgrywanie...
                  </>
                ) : (
                  <>
                    Dalej
                    <ChevronRight className="h-4 w-4" />
                  </>
                )}
              </button>
            )}
            {step === "configure" && (
              <button
                type="button"
                onClick={handleProcess}
                className="flex items-center gap-2 rounded-xl bg-sky-500 px-5 py-2 text-sm font-semibold text-white transition hover:bg-sky-600"
              >
                Generuj raport
                <ChevronRight className="h-4 w-4" />
              </button>
            )}
            {step === "download" && (
              <button
                type="button"
                onClick={() => {
                  setStep("upload");
                  setSelectedFiles([]);
                  setAnalysisDraft(null);
                  setDownloadReady(null);
                }}
                className="flex items-center gap-2 rounded-xl bg-slate-800 px-5 py-2 text-sm font-semibold text-white transition hover:bg-slate-900"
              >
                Nowa analiza
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function AccountingPage() {
  const [activeWizard, setActiveWizard] = useState<ReportType | null>(null);

  return (
    <div className="mx-auto max-w-4xl py-2">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Księgowość</h1>
        <p className="mt-1 text-sm text-slate-500">Wybierz typ raportu, aby rozpocząć analizę danych Excel</p>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setActiveWizard("standard")}
          className="group flex flex-col items-start gap-4 rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-sm transition-all hover:border-sky-400 hover:shadow-md"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-sky-50 text-sky-500 transition group-hover:bg-sky-500 group-hover:text-white">
            <FileSpreadsheet className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-semibold text-slate-900">Raport standardowy</h3>
            <p className="mt-1 text-sm leading-relaxed text-slate-500">
              Podsumowanie zużycia mediów (woda, ogrzewanie) dla wybranych lokali i okresu. Eksport do pliku Excel z walidacją stawek.
            </p>
          </div>
          <div className="flex w-full items-center justify-between">
            <div className="flex flex-wrap gap-1.5">
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">Wielookresowy</span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">Walidacja stawek</span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">Eksport XLSX</span>
            </div>
            <ChevronRight className="h-4 w-4 flex-shrink-0 text-slate-300 transition group-hover:text-sky-500" />
          </div>
        </button>

        <button
          type="button"
          onClick={() => setActiveWizard("yoy")}
          className="group flex flex-col items-start gap-4 rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-sm transition-all hover:border-violet-400 hover:shadow-md"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-50 text-violet-500 transition group-hover:bg-violet-500 group-hover:text-white">
            <TrendingUp className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-semibold text-slate-900">Analiza rok do roku</h3>
            <p className="mt-1 text-sm leading-relaxed text-slate-500">
              Porównanie zużycia mediów między kolejnymi latami. Identyfikacja trendów i odchyleń dla każdego lokalu.
            </p>
          </div>
          <div className="flex w-full items-center justify-between">
            <div className="flex flex-wrap gap-1.5">
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">Porównanie lat</span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">Trendy</span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">Eksport XLSX</span>
            </div>
            <ChevronRight className="h-4 w-4 flex-shrink-0 text-slate-300 transition group-hover:text-violet-500" />
          </div>
        </button>
      </div>

      {activeWizard !== null && (
        <Wizard reportType={activeWizard} onClose={() => setActiveWizard(null)} />
      )}
    </div>
  );
}
