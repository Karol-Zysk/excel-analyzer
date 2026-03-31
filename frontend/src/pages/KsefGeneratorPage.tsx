import { useMutation } from "@tanstack/react-query";
import {
  CircleCheckBig,
  Copy,
  Download,
  FileCode2,
  FileSpreadsheet,
  Plus,
  ShieldCheck,
  Trash2,
  TriangleAlert,
  Upload
} from "lucide-react";
import { useState } from "react";
import type { FormEvent } from "react";
import {
  generateKsefXml,
  importKsefExcel,
  type GenerateKsefXmlPayload,
  type KsefExcelImportResponse,
  type KsefBuyerIdentifierType,
  type KsefPaymentMethodValue,
  type KsefTaxRateValue
} from "../api/backend";
import { useAuth } from "../auth/AuthProvider";
import { KsefExcelFlexibleImportCard } from "./KsefExcelFlexibleImportCard";

const TAX_RATE_OPTIONS: Array<{ value: KsefTaxRateValue; label: string }> = [
  { value: "23", label: "23%" },
  { value: "8", label: "8%" },
  { value: "5", label: "5%" },
  { value: "0 KR", label: "0% kraj" },
  { value: "0 WDT", label: "0% WDT" },
  { value: "0 EX", label: "0% eksport" },
  { value: "zw", label: "zw" },
  { value: "oo", label: "odwrotne obciazenie" },
  { value: "np I", label: "np I" },
  { value: "np II", label: "np II" }
];

const BUYER_IDENTIFIER_OPTIONS: Array<{ value: KsefBuyerIdentifierType; label: string }> = [
  { value: "NIP", label: "NIP" },
  { value: "EU_VAT", label: "VAT UE" },
  { value: "OTHER", label: "Inny ID" },
  { value: "NONE", label: "Brak ID" }
];

const PAYMENT_METHOD_OPTIONS: Array<{ value: KsefPaymentMethodValue; label: string }> = [
  { value: "1", label: "Gotowka" },
  { value: "2", label: "Karta" },
  { value: "3", label: "Bon" },
  { value: "4", label: "Czek" },
  { value: "5", label: "Kredyt" },
  { value: "6", label: "Przelew" },
  { value: "7", label: "Mobilna" }
];

const KSEF_IMPORT_TEMPLATE_COLUMNS = [
  "invoice_number",
  "issue_date",
  "sale_date",
  "place_of_issue",
  "currency",
  "system_name",
  "cash_accounting",
  "self_billing",
  "split_payment",
  "simplified_procedure",
  "related_entities",
  "exemption_reason",
  "seller_nip",
  "seller_name",
  "seller_country_code",
  "seller_address_line1",
  "seller_address_line2",
  "seller_email",
  "seller_phone",
  "buyer_identifier_type",
  "buyer_nip",
  "buyer_eu_code",
  "buyer_eu_vat_number",
  "buyer_tax_country_code",
  "buyer_tax_id",
  "buyer_name",
  "buyer_country_code",
  "buyer_address_line1",
  "buyer_address_line2",
  "buyer_email",
  "buyer_phone",
  "payment_due_date",
  "payment_method",
  "payment_bank_account",
  "item_name",
  "item_description",
  "item_product_code",
  "item_unit",
  "item_quantity",
  "item_unit_net_price",
  "item_tax_rate",
  "item_annex15"
] as const;

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

function createDefaultForm(): GenerateKsefXmlPayload {
  return {
    seller: {
      nip: "",
      name: "",
      address: {
        countryCode: "PL",
        line1: ""
      },
      email: ""
    },
    buyer: {
      identifierType: "NIP",
      nip: "",
      name: "",
      address: {
        countryCode: "PL",
        line1: ""
      }
    },
    issueDate: getToday(),
    saleDate: getToday(),
    invoiceNumber: "",
    placeOfIssue: "",
    currency: "PLN",
    cashAccounting: false,
    selfBilling: false,
    splitPayment: false,
    simplifiedProcedure: false,
    relatedEntities: false,
    exemptionReason: "",
    systemName: "Kasia KSeF XML Generator",
    payment: {
      dueDate: "",
      method: "6",
      bankAccount: ""
    },
    items: [
      {
        name: "",
        description: "",
        unit: "szt",
        quantity: 1,
        unitNetPrice: 0,
        taxRate: "23",
        annex15: false
      }
    ]
  };
}

function fieldClassName() {
  return "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-100";
}

function fieldLabel(label: string, required = false) {
  return (
    <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
      {label}
      {required ? " *" : ""}
    </span>
  );
}

function sectionCardClassName() {
  return "rounded-3xl border border-slate-200 bg-white p-5 shadow-sm";
}

function downloadXml(xml: string, fileName: string) {
  const blob = new Blob([xml], { type: "application/xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function downloadTemplateCsv() {
  const rows = [
    KSEF_IMPORT_TEMPLATE_COLUMNS.join(","),
    [
      "FV/03/2026/001",
      "2026-03-31",
      "2026-03-31",
      "Warszawa",
      "PLN",
      "Kasia KSeF XML Generator",
      "0",
      "0",
      "0",
      "0",
      "0",
      "",
      "5261040828",
      "DEMBUD Sp. z o.o.",
      "PL",
      "Slominskiego 17 Warszawa",
      "",
      "biuro@example.com",
      "",
      "NIP",
      "5261040828",
      "",
      "",
      "",
      "",
      "Klient Testowy Sp. z o.o.",
      "PL",
      "Prosta 1 Warszawa",
      "",
      "",
      "",
      "2026-04-07",
      "6",
      "11111111111111111111111111",
      "Usluga ksiegowa",
      "Opis pozycji",
      "",
      "szt",
      "1",
      "1000",
      "23",
      "0"
    ].join(",")
  ];

  const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "ksef-import-template.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function getErrorMessage(error: unknown) {
  if (!(error instanceof Error)) {
    return "Nie udalo sie wygenerowac XML.";
  }

  try {
    const parsed = JSON.parse(error.message) as { message?: string | string[] };
    if (Array.isArray(parsed.message)) {
      return parsed.message.join(" ");
    }
    if (typeof parsed.message === "string") {
      return parsed.message;
    }
  } catch {
    return error.message;
  }

  return error.message;
}

function optionalText(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function optionalDate(value: string | undefined) {
  return value ? value : undefined;
}

function buildSubmitPayload(form: GenerateKsefXmlPayload): GenerateKsefXmlPayload {
  const payment = {
    dueDate: optionalDate(form.payment?.dueDate),
    method: form.payment?.method || undefined,
    bankAccount: optionalText(form.payment?.bankAccount)
  };

  return {
    seller: {
      nip: form.seller.nip,
      name: form.seller.name,
      address: {
        countryCode: form.seller.address.countryCode,
        line1: form.seller.address.line1,
        line2: optionalText(form.seller.address.line2)
      },
      email: optionalText(form.seller.email),
      phone: optionalText(form.seller.phone)
    },
    buyer: {
      identifierType: form.buyer.identifierType,
      nip: optionalText(form.buyer.nip),
      euCode: optionalText(form.buyer.euCode),
      euVatNumber: optionalText(form.buyer.euVatNumber),
      taxCountryCode: optionalText(form.buyer.taxCountryCode),
      taxId: optionalText(form.buyer.taxId),
      name: form.buyer.name,
      address: form.buyer.address
        ? {
            countryCode: form.buyer.address.countryCode,
            line1: form.buyer.address.line1,
            line2: optionalText(form.buyer.address.line2)
          }
        : undefined,
      email: optionalText(form.buyer.email),
      phone: optionalText(form.buyer.phone)
    },
    issueDate: form.issueDate,
    saleDate: optionalDate(form.saleDate),
    invoiceNumber: form.invoiceNumber,
    placeOfIssue: optionalText(form.placeOfIssue),
    currency: optionalText(form.currency),
    cashAccounting: form.cashAccounting,
    selfBilling: form.selfBilling,
    splitPayment: form.splitPayment,
    simplifiedProcedure: form.simplifiedProcedure,
    relatedEntities: form.relatedEntities,
    exemptionReason: optionalText(form.exemptionReason),
    systemName: optionalText(form.systemName),
    payment:
      payment.dueDate || payment.method || payment.bankAccount
        ? payment
        : undefined,
    items: form.items.map((item) => ({
      name: item.name,
      description: optionalText(item.description),
      productCode: optionalText(item.productCode),
      unit: item.unit,
      quantity: item.quantity,
      unitNetPrice: item.unitNetPrice,
      taxRate: item.taxRate,
      annex15: item.annex15
    }))
  };
}

function isManualFormReady(form: GenerateKsefXmlPayload) {
  if (
    !form.invoiceNumber.trim() ||
    !form.issueDate ||
    !form.seller.nip.trim() ||
    !form.seller.name.trim() ||
    !form.seller.address.countryCode.trim() ||
    !form.seller.address.line1.trim() ||
    !form.buyer.name.trim()
  ) {
    return false;
  }

  if (form.buyer.identifierType === "NIP" && !form.buyer.nip?.trim()) {
    return false;
  }

  if (
    form.buyer.identifierType === "EU_VAT" &&
    (!form.buyer.euCode?.trim() || !form.buyer.euVatNumber?.trim())
  ) {
    return false;
  }

  if (form.buyer.identifierType === "OTHER" && !form.buyer.taxId?.trim()) {
    return false;
  }

  if (
    form.items.some(
      (item) =>
        !item.name.trim() ||
        !item.unit.trim() ||
        !(item.quantity > 0) ||
        item.unitNetPrice < 0
    )
  ) {
    return false;
  }

  if (form.items.some((item) => item.taxRate === "zw") && !form.exemptionReason?.trim()) {
    return false;
  }

  return true;
}

export function KsefGeneratorPage() {
  const { session } = useAuth();
  const [form, setForm] = useState<GenerateKsefXmlPayload>(() => createDefaultForm());
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");
  const [importFile, setImportFile] = useState<File | null>(null);

  const mutation = useMutation({
    mutationFn: async (payload: GenerateKsefXmlPayload) => {
      if (!session?.access_token) {
        throw new Error("Brak aktywnej sesji.");
      }

      return generateKsefXml(payload, session.access_token);
    }
  });
  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!session?.access_token) {
        throw new Error("Brak aktywnej sesji.");
      }

      return importKsefExcel(file, session.access_token);
    }
  });

  const response = mutation.data;
  const importResponse = importMutation.data;
  const hasExemptItems = form.items.some((item) => item.taxRate === "zw");
  const manualFormReady = isManualFormReady(form);

  function updateForm<K extends keyof GenerateKsefXmlPayload>(key: K, value: GenerateKsefXmlPayload[K]) {
    setForm((prev) => ({
      ...prev,
      [key]: value
    }));
  }

  function updateSellerField<K extends keyof GenerateKsefXmlPayload["seller"]>(
    key: K,
    value: GenerateKsefXmlPayload["seller"][K]
  ) {
    setForm((prev) => ({
      ...prev,
      seller: {
        ...prev.seller,
        [key]: value
      }
    }));
  }

  function updateSellerAddressField(key: "countryCode" | "line1" | "line2", value: string) {
    setForm((prev) => ({
      ...prev,
      seller: {
        ...prev.seller,
        address: {
          ...prev.seller.address,
          [key]: value
        }
      }
    }));
  }

  function updateBuyerField<K extends keyof GenerateKsefXmlPayload["buyer"]>(
    key: K,
    value: GenerateKsefXmlPayload["buyer"][K]
  ) {
    setForm((prev) => ({
      ...prev,
      buyer: {
        ...prev.buyer,
        [key]: value
      }
    }));
  }

  function updateBuyerAddressField(key: "countryCode" | "line1" | "line2", value: string) {
    setForm((prev) => ({
      ...prev,
      buyer: {
        ...prev.buyer,
        address: prev.buyer.address
          ? {
              ...prev.buyer.address,
              [key]: value
            }
          : {
              countryCode: "PL",
              line1: "",
              [key]: value
            }
      }
    }));
  }

  function toggleBuyerAddress(enabled: boolean) {
    setForm((prev) => ({
      ...prev,
      buyer: {
        ...prev.buyer,
        address: enabled ? prev.buyer.address ?? { countryCode: "PL", line1: "" } : undefined
      }
    }));
  }

  function updatePaymentField<K extends keyof NonNullable<GenerateKsefXmlPayload["payment"]>>(
    key: K,
    value: NonNullable<GenerateKsefXmlPayload["payment"]>[K]
  ) {
    setForm((prev) => ({
      ...prev,
      payment: {
        ...(prev.payment ?? {}),
        [key]: value
      }
    }));
  }

  function updateItemField(
    index: number,
    key: keyof GenerateKsefXmlPayload["items"][number],
    value: string | number | boolean
  ) {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              [key]: value
            }
          : item
      )
    }));
  }

  function addItem() {
    setForm((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          name: "",
          unit: "szt",
          quantity: 1,
          unitNetPrice: 0,
          taxRate: "23",
          annex15: false
        }
      ]
    }));
  }

  function removeItem(index: number) {
    setForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, itemIndex) => itemIndex !== index)
    }));
  }

  function resetForm() {
    setForm(createDefaultForm());
    mutation.reset();
    setCopyState("idle");
  }

  async function copyXml() {
    if (!response?.xml) {
      return;
    }

    await navigator.clipboard.writeText(response.xml);
    setCopyState("copied");
    window.setTimeout(() => setCopyState("idle"), 1500);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    mutation.mutate(buildSubmitPayload(form));
  }

  function handleImportSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!importFile) {
      return;
    }

    importMutation.mutate(importFile);
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">
            <ShieldCheck className="h-3.5 w-3.5" />
            FA(3) / KSeF
          </div>
          <h1 className="mt-3 text-2xl font-bold text-slate-900">KSeF XML Generator</h1>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
            Generator tworzy XML zgodny ze struktura FA(3), waliduje dane wejsciowe oraz sprawdza gotowy dokument
            lokalnie przeciw oficjalnej schemie XSD. Ten ekran obsluguje fakture podstawowa VAT.
          </p>
        </div>
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Korekty, zaliczki i zalaczniki nie sa jeszcze obsluzone w tym MVP.
        </div>
      </div>

      <KsefExcelFlexibleImportCard />

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
              <FileSpreadsheet className="h-3.5 w-3.5" />
              Template import
            </div>
            <h2 className="mt-3 text-xl font-semibold text-slate-900">Szybki import ze stalego template</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Wgraj plik `xlsx`, `xls` albo `csv`. Każdy wiersz oznacza jedną pozycję faktury, a system grupuje dane po
              `invoice_number` i generuje osobny XML dla każdej faktury.
            </p>
          </div>
          <button type="button" onClick={downloadTemplateCsv} className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
            <Download className="h-4 w-4" />
            Pobierz template CSV
          </button>
        </div>

        <div className="mt-5 grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <form className="space-y-4" onSubmit={handleImportSubmit}>
            <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center transition hover:border-sky-300 hover:bg-sky-50">
              <Upload className="h-8 w-8 text-slate-400" />
              <div>
                <p className="text-sm font-semibold text-slate-800">Wgraj arkusz faktur</p>
                <p className="mt-1 text-sm text-slate-500">Obsługiwane formaty: `xlsx`, `xls`, `csv`</p>
                {importFile && <p className="mt-3 text-sm font-medium text-sky-700">{importFile.name}</p>}
              </div>
              <input type="file" accept=".xlsx,.xls,.csv" className="sr-only" onChange={(e) => setImportFile(e.target.files?.[0] ?? null)} />
            </label>

            <div className="flex flex-wrap gap-3">
              <button type="submit" disabled={!importFile || importMutation.isPending} className="inline-flex items-center gap-2 rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60">
                {importMutation.isPending ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Importowanie...
                  </>
                ) : (
                  <>
                    <FileSpreadsheet className="h-4 w-4" />
                    Generuj XML z arkusza
                  </>
                )}
              </button>
              <button type="button" onClick={() => { setImportFile(null); importMutation.reset(); }} className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                Reset importu
              </button>
            </div>

            {importMutation.isError && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                <div className="flex items-center gap-2 font-semibold">
                  <TriangleAlert className="h-4 w-4" />
                  Blad importu
                </div>
                <p className="mt-2 leading-6">{getErrorMessage(importMutation.error)}</p>
              </div>
            )}
          </form>

          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-900">Kolumny template</p>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              Minimalny zestaw to numer faktury, data, dane stron i pozycja. Pozostałe pola są opcjonalne.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {KSEF_IMPORT_TEMPLATE_COLUMNS.map((column) => (
                <span key={column} className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700 shadow-sm">
                  {column}
                </span>
              ))}
            </div>
          </div>
        </div>

        {importResponse && (
          <div className="mt-6 space-y-4">
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Wynik importu: {importResponse.fileName}</p>
                  <p className="mt-1 text-sm text-slate-500">Arkusz: {importResponse.sheetName}</p>
                </div>
                <div className="grid gap-2 sm:grid-cols-4">
                  <div className="rounded-2xl bg-white px-4 py-3 text-sm">
                    <p className="text-slate-500">Wiersze</p>
                    <p className="mt-1 font-semibold text-slate-900">{importResponse.summary.rowsCount}</p>
                  </div>
                  <div className="rounded-2xl bg-white px-4 py-3 text-sm">
                    <p className="text-slate-500">Faktury</p>
                    <p className="mt-1 font-semibold text-slate-900">{importResponse.summary.invoicesCount}</p>
                  </div>
                  <div className="rounded-2xl bg-white px-4 py-3 text-sm">
                    <p className="text-slate-500">Poprawne</p>
                    <p className="mt-1 font-semibold text-emerald-700">{importResponse.summary.validInvoices}</p>
                  </div>
                  <div className="rounded-2xl bg-white px-4 py-3 text-sm">
                    <p className="text-slate-500">Bledne</p>
                    <p className="mt-1 font-semibold text-amber-700">{importResponse.summary.invalidInvoices}</p>
                  </div>
                </div>
              </div>

              {importResponse.globalErrors.length > 0 && (
                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                  {importResponse.globalErrors.map((error) => (
                    <p key={error}>• {error}</p>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-3">
              {importResponse.invoices.map((invoice) => (
                <div key={`${invoice.invoiceNumber}-${invoice.rowNumbers.join("-")}`} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        {invoice.valid ? <CircleCheckBig className="h-4 w-4 text-emerald-600" /> : <TriangleAlert className="h-4 w-4 text-amber-600" />}
                        <p className="text-base font-semibold text-slate-900">{invoice.invoiceNumber}</p>
                      </div>
                      <p className="mt-1 text-sm text-slate-500">Wiersze źródłowe: {invoice.rowNumbers.join(", ")}</p>
                    </div>
                    {invoice.xml && invoice.fileName && (
                      <button type="button" onClick={() => downloadXml(invoice.xml!, invoice.fileName!)} className="inline-flex items-center gap-2 rounded-2xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-600">
                        <Download className="h-4 w-4" />
                        Pobierz XML
                      </button>
                    )}
                  </div>

                  {invoice.summary && (
                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm">
                        <p className="text-slate-500">Netto</p>
                        <p className="mt-1 font-semibold text-slate-900">{invoice.summary.netTotal.toFixed(2)} {invoice.summary.currency}</p>
                      </div>
                      <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm">
                        <p className="text-slate-500">VAT</p>
                        <p className="mt-1 font-semibold text-slate-900">{invoice.summary.taxTotal.toFixed(2)} {invoice.summary.currency}</p>
                      </div>
                      <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm">
                        <p className="text-slate-500">Brutto</p>
                        <p className="mt-1 font-semibold text-slate-900">{invoice.summary.grossTotal.toFixed(2)} {invoice.summary.currency}</p>
                      </div>
                    </div>
                  )}

                  {invoice.businessErrors.length > 0 && (
                    <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                      {invoice.businessErrors.map((error) => (
                        <p key={error}>• {error}</p>
                      ))}
                    </div>
                  )}

                  {invoice.schemaErrors.length > 0 && (
                    <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                      {invoice.schemaErrors.map((error, index) => (
                        <p key={`${error.message}-${index}`}>• {error.lineNumber ? `Linia ${error.lineNumber}: ` : ""}{error.message}</p>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <form className="grid gap-6 xl:grid-cols-[1.45fr_0.95fr]" onSubmit={handleSubmit}>
        <div className="space-y-6">
          <section className={sectionCardClassName()}>
            <div className="mb-4">
              <h2 className="text-base font-semibold text-slate-900">Dane faktury</h2>
              <p className="mt-1 text-sm text-slate-500">Podstawowe dane naglowka i ustawienia generowanego dokumentu.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1.5">
                {fieldLabel("Numer faktury", true)}
                <input className={fieldClassName()} value={form.invoiceNumber} onChange={(e) => updateForm("invoiceNumber", e.target.value)} required />
              </label>
              <label className="space-y-1.5">
                {fieldLabel("Miejsce wystawienia")}
                <input className={fieldClassName()} value={form.placeOfIssue ?? ""} onChange={(e) => updateForm("placeOfIssue", e.target.value)} />
              </label>
              <label className="space-y-1.5">
                {fieldLabel("Data wystawienia", true)}
                <input type="date" className={fieldClassName()} value={form.issueDate} onChange={(e) => updateForm("issueDate", e.target.value)} required />
              </label>
              <label className="space-y-1.5">
                {fieldLabel("Data sprzedazy")}
                <input type="date" className={fieldClassName()} value={form.saleDate ?? ""} onChange={(e) => updateForm("saleDate", e.target.value)} />
              </label>
              <label className="space-y-1.5">
                {fieldLabel("Waluta")}
                <input className={fieldClassName()} value={form.currency ?? "PLN"} onChange={(e) => updateForm("currency", e.target.value.toUpperCase())} maxLength={3} />
              </label>
              <label className="space-y-1.5">
                {fieldLabel("SystemInfo")}
                <input className={fieldClassName()} value={form.systemName ?? ""} onChange={(e) => updateForm("systemName", e.target.value)} />
              </label>
            </div>
          </section>

          <section className={sectionCardClassName()}>
            <div className="mb-4">
              <h2 className="text-base font-semibold text-slate-900">Sprzedawca</h2>
              <p className="mt-1 text-sm text-slate-500">Dane trafia do sekcji Podmiot1.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1.5">
                {fieldLabel("NIP", true)}
                <input className={fieldClassName()} value={form.seller.nip} onChange={(e) => updateSellerField("nip", e.target.value.replace(/\D/g, ""))} maxLength={10} required />
              </label>
              <label className="space-y-1.5 md:col-span-2">
                {fieldLabel("Nazwa", true)}
                <input className={fieldClassName()} value={form.seller.name} onChange={(e) => updateSellerField("name", e.target.value)} required />
              </label>
              <label className="space-y-1.5">
                {fieldLabel("Kod kraju", true)}
                <input className={fieldClassName()} value={form.seller.address.countryCode} onChange={(e) => updateSellerAddressField("countryCode", e.target.value.toUpperCase())} maxLength={2} required />
              </label>
              <label className="space-y-1.5 md:col-span-2">
                {fieldLabel("Adres linia 1", true)}
                <input className={fieldClassName()} value={form.seller.address.line1} onChange={(e) => updateSellerAddressField("line1", e.target.value)} required />
              </label>
              <label className="space-y-1.5 md:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Adres linia 2</span>
                <input className={fieldClassName()} value={form.seller.address.line2 ?? ""} onChange={(e) => updateSellerAddressField("line2", e.target.value)} />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Email</span>
                <input type="email" className={fieldClassName()} value={form.seller.email ?? ""} onChange={(e) => updateSellerField("email", e.target.value)} />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Telefon</span>
                <input className={fieldClassName()} value={form.seller.phone ?? ""} onChange={(e) => updateSellerField("phone", e.target.value)} />
              </label>
            </div>
          </section>

          <section className={sectionCardClassName()}>
            <div className="mb-4">
              <h2 className="text-base font-semibold text-slate-900">Nabywca</h2>
              <p className="mt-1 text-sm text-slate-500">Dane trafia do sekcji Podmiot2, z domyslnymi znacznikami JST=2 i GV=2.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1.5">
                {fieldLabel("Typ identyfikatora", true)}
                <select className={fieldClassName()} value={form.buyer.identifierType} onChange={(e) => updateBuyerField("identifierType", e.target.value as KsefBuyerIdentifierType)}>
                  {BUYER_IDENTIFIER_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              {form.buyer.identifierType === "NIP" && (
                <label className="space-y-1.5">
                  {fieldLabel("NIP", true)}
                  <input className={fieldClassName()} value={form.buyer.nip ?? ""} onChange={(e) => updateBuyerField("nip", e.target.value.replace(/\D/g, ""))} maxLength={10} required />
                </label>
              )}
              {form.buyer.identifierType === "EU_VAT" && (
                <>
                  <label className="space-y-1.5">
                    {fieldLabel("Kod UE", true)}
                    <input className={fieldClassName()} value={form.buyer.euCode ?? ""} onChange={(e) => updateBuyerField("euCode", e.target.value.toUpperCase())} maxLength={2} required />
                  </label>
                  <label className="space-y-1.5">
                    {fieldLabel("Numer VAT UE", true)}
                    <input className={fieldClassName()} value={form.buyer.euVatNumber ?? ""} onChange={(e) => updateBuyerField("euVatNumber", e.target.value.toUpperCase())} required />
                  </label>
                </>
              )}
              {form.buyer.identifierType === "OTHER" && (
                <>
                  <label className="space-y-1.5">
                    {fieldLabel("Kod kraju ID")}
                    <input className={fieldClassName()} value={form.buyer.taxCountryCode ?? ""} onChange={(e) => updateBuyerField("taxCountryCode", e.target.value.toUpperCase())} maxLength={2} />
                  </label>
                  <label className="space-y-1.5">
                    {fieldLabel("Numer ID", true)}
                    <input className={fieldClassName()} value={form.buyer.taxId ?? ""} onChange={(e) => updateBuyerField("taxId", e.target.value)} required />
                  </label>
                </>
              )}
              <label className="space-y-1.5 md:col-span-2">
                {fieldLabel("Nazwa", true)}
                <input className={fieldClassName()} value={form.buyer.name} onChange={(e) => updateBuyerField("name", e.target.value)} required />
              </label>
              <div className="md:col-span-2">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <input type="checkbox" className="rounded" checked={Boolean(form.buyer.address)} onChange={(e) => toggleBuyerAddress(e.target.checked)} />
                  Dodaj adres nabywcy
                </label>
              </div>
              {form.buyer.address && (
                <>
                  <label className="space-y-1.5">
                    <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Kod kraju</span>
                    <input className={fieldClassName()} value={form.buyer.address.countryCode} onChange={(e) => updateBuyerAddressField("countryCode", e.target.value.toUpperCase())} maxLength={2} />
                  </label>
                  <label className="space-y-1.5 md:col-span-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Adres linia 1</span>
                    <input className={fieldClassName()} value={form.buyer.address.line1} onChange={(e) => updateBuyerAddressField("line1", e.target.value)} />
                  </label>
                  <label className="space-y-1.5 md:col-span-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Adres linia 2</span>
                    <input className={fieldClassName()} value={form.buyer.address.line2 ?? ""} onChange={(e) => updateBuyerAddressField("line2", e.target.value)} />
                  </label>
                </>
              )}
              <label className="space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Email</span>
                <input type="email" className={fieldClassName()} value={form.buyer.email ?? ""} onChange={(e) => updateBuyerField("email", e.target.value)} />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Telefon</span>
                <input className={fieldClassName()} value={form.buyer.phone ?? ""} onChange={(e) => updateBuyerField("phone", e.target.value)} />
              </label>
            </div>
          </section>

          <section className={sectionCardClassName()}>
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Pozycje faktury</h2>
                <p className="mt-1 text-sm text-slate-500">Kazda pozycja zostanie przeliczona i wpisana do sekcji FaWiersz.</p>
              </div>
              <button type="button" onClick={addItem} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800">
                <Plus className="h-4 w-4" />
                Dodaj pozycje
              </button>
            </div>
            <div className="space-y-4">
              {form.items.map((item, index) => (
                <div key={index} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-800">Pozycja {index + 1}</p>
                    {form.items.length > 1 && (
                      <button type="button" onClick={() => removeItem(index)} className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-rose-600 transition hover:bg-rose-50">
                        <Trash2 className="h-4 w-4" />
                        Usun
                      </button>
                    )}
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="space-y-1.5 md:col-span-2">
                      {fieldLabel("Nazwa towaru lub uslugi", true)}
                      <input className={fieldClassName()} value={item.name} onChange={(e) => updateItemField(index, "name", e.target.value)} required />
                    </label>
                    <label className="space-y-1.5 md:col-span-2">
                      {fieldLabel("Opis pozycji")}
                      <textarea className={fieldClassName()} value={item.description ?? ""} onChange={(e) => updateItemField(index, "description", e.target.value)} rows={3} />
                    </label>
                    <label className="space-y-1.5">
                      {fieldLabel("Kod wewnetrzny")}
                      <input className={fieldClassName()} value={item.productCode ?? ""} onChange={(e) => updateItemField(index, "productCode", e.target.value)} />
                    </label>
                    <label className="space-y-1.5">
                      {fieldLabel("Jednostka", true)}
                      <input className={fieldClassName()} value={item.unit} onChange={(e) => updateItemField(index, "unit", e.target.value)} required />
                    </label>
                    <label className="space-y-1.5">
                      {fieldLabel("Ilosc", true)}
                      <input type="number" min="0.0001" step="0.0001" className={fieldClassName()} value={item.quantity} onChange={(e) => updateItemField(index, "quantity", Number(e.target.value))} required />
                    </label>
                    <label className="space-y-1.5">
                      {fieldLabel("Cena netto", true)}
                      <input type="number" min="0" step="0.000001" className={fieldClassName()} value={item.unitNetPrice} onChange={(e) => updateItemField(index, "unitNetPrice", Number(e.target.value))} required />
                    </label>
                    <label className="space-y-1.5">
                      {fieldLabel("Stawka VAT", true)}
                      <select className={fieldClassName()} value={item.taxRate} onChange={(e) => updateItemField(index, "taxRate", e.target.value as KsefTaxRateValue)}>
                        {TAX_RATE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700">
                      <input type="checkbox" className="rounded" checked={Boolean(item.annex15)} onChange={(e) => updateItemField(index, "annex15", e.target.checked)} />
                      Pozycja z zalacznika nr 15
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className={sectionCardClassName()}>
            <div className="mb-4">
              <h2 className="text-base font-semibold text-slate-900">Platnosc i znaczniki</h2>
              <p className="mt-1 text-sm text-slate-500">Pole platnosci jest opcjonalne, ale zwykle warto je wypelnic.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Termin platnosci</span>
                <input type="date" className={fieldClassName()} value={form.payment?.dueDate ?? ""} onChange={(e) => updatePaymentField("dueDate", e.target.value)} />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Forma platnosci</span>
                <select className={fieldClassName()} value={form.payment?.method ?? ""} onChange={(e) => updatePaymentField("method", e.target.value as KsefPaymentMethodValue)}>
                  <option value="">Brak</option>
                  {PAYMENT_METHOD_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1.5 md:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Rachunek bankowy</span>
                <input className={fieldClassName()} value={form.payment?.bankAccount ?? ""} onChange={(e) => updatePaymentField("bankAccount", e.target.value)} />
              </label>
              {hasExemptItems && (
                <label className="space-y-1.5 md:col-span-2">
                  {fieldLabel("Podstawa zwolnienia", true)}
                  <input className={fieldClassName()} value={form.exemptionReason ?? ""} onChange={(e) => updateForm("exemptionReason", e.target.value)} placeholder="np. art. 43 ust. 1 ustawy o VAT" required />
                </label>
              )}
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
                <input type="checkbox" className="rounded" checked={Boolean(form.cashAccounting)} onChange={(e) => updateForm("cashAccounting", e.target.checked)} />
                Metoda kasowa
              </label>
              <label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
                <input type="checkbox" className="rounded" checked={Boolean(form.selfBilling)} onChange={(e) => updateForm("selfBilling", e.target.checked)} />
                Samofakturowanie
              </label>
              <label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
                <input type="checkbox" className="rounded" checked={Boolean(form.splitPayment)} onChange={(e) => updateForm("splitPayment", e.target.checked)} />
                Mechanizm podzielonej platnosci
              </label>
              <label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
                <input type="checkbox" className="rounded" checked={Boolean(form.simplifiedProcedure)} onChange={(e) => updateForm("simplifiedProcedure", e.target.checked)} />
                Procedura uproszczona
              </label>
              <label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700 md:col-span-2">
                <input type="checkbox" className="rounded" checked={Boolean(form.relatedEntities)} onChange={(e) => updateForm("relatedEntities", e.target.checked)} />
                Powiazania miedzy stronami (TP)
              </label>
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className={`${sectionCardClassName()} sticky top-24`}>
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-50 text-sky-600">
                <FileCode2 className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-900">Akcje i wynik</h2>
                <p className="text-sm text-slate-500">Walidacja biznesowa + XSD FA(3).</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button type="submit" disabled={mutation.isPending || !manualFormReady} className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-sky-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-60">
                {mutation.isPending ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Generowanie...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="h-4 w-4" />
                    Waliduj i generuj XML
                  </>
                )}
              </button>
              <button type="button" onClick={resetForm} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                Reset
              </button>
            </div>

            {!manualFormReady && (
              <p className="mt-3 text-xs leading-5 text-slate-500">
                Pola oznaczone `*` sa wymagane. Bez nich generator nie pozwoli utworzyc XML.
              </p>
            )}

            {mutation.isError && (
              <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                <div className="flex items-center gap-2 font-semibold">
                  <TriangleAlert className="h-4 w-4" />
                  Blad requestu
                </div>
                <p className="mt-2 leading-6">{getErrorMessage(mutation.error)}</p>
              </div>
            )}

            {response && (
              <div className="mt-4 space-y-4">
                <div className={`rounded-2xl border p-4 ${response.valid ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    {response.valid ? <CircleCheckBig className="h-4 w-4 text-emerald-600" /> : <TriangleAlert className="h-4 w-4 text-amber-600" />}
                    {response.valid ? "XML przeszedl walidacje XSD" : "XML wymaga poprawek"}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-700">
                    Schemat: {response.schema.code} / {response.schema.version}
                  </p>
                  {response.summary && (
                    <div className="mt-3 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-xl bg-white/80 p-3">
                        <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Netto</p>
                        <p className="mt-1 text-lg font-semibold text-slate-900">{response.summary.netTotal.toFixed(2)} {response.summary.currency}</p>
                      </div>
                      <div className="rounded-xl bg-white/80 p-3">
                        <p className="text-xs uppercase tracking-[0.12em] text-slate-500">VAT</p>
                        <p className="mt-1 text-lg font-semibold text-slate-900">{response.summary.taxTotal.toFixed(2)} {response.summary.currency}</p>
                      </div>
                      <div className="rounded-xl bg-white/80 p-3">
                        <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Brutto</p>
                        <p className="mt-1 text-lg font-semibold text-slate-900">{response.summary.grossTotal.toFixed(2)} {response.summary.currency}</p>
                      </div>
                    </div>
                  )}
                </div>

                {response.businessErrors.length > 0 && (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
                    <p className="text-sm font-semibold text-rose-700">Bledy walidacji biznesowej</p>
                    <ul className="mt-2 space-y-2 text-sm leading-6 text-rose-700">
                      {response.businessErrors.map((error) => (
                        <li key={error}>• {error}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {response.schemaErrors.length > 0 && (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                    <p className="text-sm font-semibold text-amber-800">Bledy schemy XSD</p>
                    <ul className="mt-2 space-y-2 text-sm leading-6 text-amber-800">
                      {response.schemaErrors.map((error, index) => (
                        <li key={`${error.message}-${index}`}>
                          • {error.lineNumber ? `Linia ${error.lineNumber}: ` : ""}{error.message}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {response.warnings.length > 0 && (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-semibold text-slate-800">Uwagi</p>
                    <ul className="mt-2 space-y-2 text-sm leading-6 text-slate-700">
                      {response.warnings.map((warning) => (
                        <li key={warning}>• {warning}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {response.summary && (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-semibold text-slate-800">Rozbicie stawek</p>
                    <div className="mt-3 space-y-2">
                      {response.summary.taxBreakdown.map((row) => (
                        <div key={row.taxRate} className="flex items-center justify-between rounded-xl bg-white px-3 py-2 text-sm text-slate-700">
                          <span>Stawka {row.taxRate}</span>
                          <span>{row.net.toFixed(2)} / VAT {row.tax.toFixed(2)} / {row.gross.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {response.xml && response.fileName && (
                  <div className="rounded-2xl border border-slate-200 bg-slate-950 p-4 text-white">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">Podglad XML</p>
                        <p className="text-xs text-slate-400">{response.fileName}</p>
                      </div>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => void copyXml()} className="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-3 py-2 text-sm font-medium text-slate-100 transition hover:bg-slate-800">
                          <Copy className="h-4 w-4" />
                          {copyState === "copied" ? "Skopiowano" : "Kopiuj"}
                        </button>
                        <button type="button" onClick={() => downloadXml(response.xml!, response.fileName!)} className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600">
                          <Download className="h-4 w-4" />
                          Pobierz XML
                        </button>
                      </div>
                    </div>
                    <textarea readOnly value={response.xml} className="h-[420px] w-full rounded-2xl border border-slate-800 bg-slate-900 p-4 font-mono text-xs leading-6 text-slate-100 outline-none" />
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      </form>
    </div>
  );
}
