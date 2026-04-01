import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
  Upload,
} from "lucide-react";
import { useState } from "react";
import type { FormEvent } from "react";
import {
  generateKsefXml,
  getAccounts,
  importKsefExcel,
  type GenerateKsefXmlPayload,
  type KsefExcelImportResponse,
  type KsefBuyerIdentifierType,
  type KsefPaymentMethodValue,
  type KsefTaxRateValue,
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
  { value: "np II", label: "np II" },
];

const BUYER_IDENTIFIER_OPTIONS: Array<{
  value: KsefBuyerIdentifierType;
  label: string;
}> = [
  { value: "NIP", label: "NIP" },
  { value: "EU_VAT", label: "VAT UE" },
  { value: "OTHER", label: "Inny ID" },
  { value: "NONE", label: "Brak ID" },
];

const PAYMENT_METHOD_OPTIONS: Array<{
  value: KsefPaymentMethodValue;
  label: string;
}> = [
  { value: "1", label: "Gotowka" },
  { value: "2", label: "Karta" },
  { value: "3", label: "Bon" },
  { value: "4", label: "Czek" },
  { value: "5", label: "Kredyt" },
  { value: "6", label: "Przelew" },
  { value: "7", label: "Mobilna" },
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
  "item_annex15",
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
        line1: "",
      },
      email: "",
    },
    buyer: {
      identifierType: "NIP",
      nip: "",
      name: "",
      address: {
        countryCode: "PL",
        line1: "",
      },
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
      bankAccount: "",
    },
    items: [
      {
        name: "",
        description: "",
        unit: "szt",
        quantity: 1,
        unitNetPrice: 0,
        taxRate: "23",
        annex15: false,
      },
    ],
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
      "0",
    ].join(","),
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

function medalClassName(rank: number) {
  if (rank === 0) {
    return "bg-amber-400 text-amber-950";
  }
  if (rank === 1) {
    return "bg-slate-300 text-slate-900";
  }
  return "bg-orange-300 text-orange-950";
}

function optionalText(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function optionalDate(value: string | undefined) {
  return value ? value : undefined;
}

function buildSubmitPayload(
  form: GenerateKsefXmlPayload
): GenerateKsefXmlPayload {
  const payment = {
    dueDate: optionalDate(form.payment?.dueDate),
    method: form.payment?.method || undefined,
    bankAccount: optionalText(form.payment?.bankAccount),
  };

  return {
    seller: {
      nip: form.seller.nip,
      name: form.seller.name,
      address: {
        countryCode: form.seller.address.countryCode,
        line1: form.seller.address.line1,
        line2: optionalText(form.seller.address.line2),
      },
      email: optionalText(form.seller.email),
      phone: optionalText(form.seller.phone),
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
            line2: optionalText(form.buyer.address.line2),
          }
        : undefined,
      email: optionalText(form.buyer.email),
      phone: optionalText(form.buyer.phone),
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
      annex15: item.annex15,
    })),
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

  if (
    form.items.some((item) => item.taxRate === "zw") &&
    !form.exemptionReason?.trim()
  ) {
    return false;
  }

  return true;
}

export function KsefGeneratorPage() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<GenerateKsefXmlPayload>(() =>
    createDefaultForm()
  );
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");
  const [importFile, setImportFile] = useState<File | null>(null);

  const mutation = useMutation({
    mutationFn: async (payload: GenerateKsefXmlPayload) => {
      if (!session?.access_token) {
        throw new Error("Brak aktywnej sesji.");
      }

      return generateKsefXml(payload, session.access_token);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["accounts-list"] });
    },
  });
  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!session?.access_token) {
        throw new Error("Brak aktywnej sesji.");
      }

      return importKsefExcel(file, session.access_token);
    },
    onSuccess: (result) => {
      if (result.summary.validInvoices > 0) {
        void queryClient.invalidateQueries({ queryKey: ["accounts-list"] });
      }
    },
  });
  const accountsQuery = useQuery({
    queryKey: ["accounts-list", session?.access_token],
    queryFn: () => getAccounts(session!.access_token),
    enabled: Boolean(session?.access_token),
    refetchInterval: 30000,
  });

  const response = mutation.data;
  const importResponse = importMutation.data;
  const hasExemptItems = form.items.some((item) => item.taxRate === "zw");
  const manualFormReady = isManualFormReady(form);
  const ranking = [...(accountsQuery.data?.accounts ?? [])]
    .sort(
      (left, right) =>
        right.ksefGeneratedCount - left.ksefGeneratedCount ||
        left.name.localeCompare(right.name, "pl")
    )
    .slice(0, 3);
  const myScore =
    (accountsQuery.data?.accounts ?? []).find(
      (account) => account.id === session?.user.id
    )?.ksefGeneratedCount ?? 0;

  function updateForm<K extends keyof GenerateKsefXmlPayload>(
    key: K,
    value: GenerateKsefXmlPayload[K]
  ) {
    setForm((prev) => ({
      ...prev,
      [key]: value,
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
        [key]: value,
      },
    }));
  }

  function updateSellerAddressField(
    key: "countryCode" | "line1" | "line2",
    value: string
  ) {
    setForm((prev) => ({
      ...prev,
      seller: {
        ...prev.seller,
        address: {
          ...prev.seller.address,
          [key]: value,
        },
      },
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
        [key]: value,
      },
    }));
  }

  function updateBuyerAddressField(
    key: "countryCode" | "line1" | "line2",
    value: string
  ) {
    setForm((prev) => ({
      ...prev,
      buyer: {
        ...prev.buyer,
        address: prev.buyer.address
          ? {
              ...prev.buyer.address,
              [key]: value,
            }
          : {
              countryCode: "PL",
              line1: "",
              [key]: value,
            },
      },
    }));
  }

  function toggleBuyerAddress(enabled: boolean) {
    setForm((prev) => ({
      ...prev,
      buyer: {
        ...prev.buyer,
        address: enabled
          ? prev.buyer.address ?? { countryCode: "PL", line1: "" }
          : undefined,
      },
    }));
  }

  function updatePaymentField<
    K extends keyof NonNullable<GenerateKsefXmlPayload["payment"]>
  >(key: K, value: NonNullable<GenerateKsefXmlPayload["payment"]>[K]) {
    setForm((prev) => ({
      ...prev,
      payment: {
        ...(prev.payment ?? {}),
        [key]: value,
      },
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
              [key]: value,
            }
          : item
      ),
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
          annex15: false,
        },
      ],
    }));
  }

  function removeItem(index: number) {
    setForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, itemIndex) => itemIndex !== index),
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
          <h1 className="mt-3 text-2xl font-bold text-slate-900">
            KSeF XML Generator
          </h1>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
            Generator tworzy XML zgodny ze struktura FA(3), waliduje dane
            wejsciowe oraz sprawdza gotowy dokument lokalnie przeciw oficjalnej
            schemie XSD. Ten ekran obsluguje fakture podstawowa VAT.
          </p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Umiesz liczyć ? Licz na siebiezenie n
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <KsefExcelFlexibleImportCard
          onGenerationSuccess={() => {
            void queryClient.invalidateQueries({ queryKey: ["accounts-list"] });
          }}
        />

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-700">
                Ranking KSeF
              </p>
              <h2 className="mt-2 text-lg font-semibold text-slate-900">
                Zloty, srebrny i brazowy medal
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Ranking pokazuje, kto wygenerowal najwiecej XML w zespole.
              </p>
            </div>
            <div className="rounded-2xl bg-slate-100 px-4 py-3 text-right">
              <p className="text-xs uppercase tracking-[0.12em] text-slate-500">
                Twoj wynik
              </p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{myScore}</p>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {ranking.length > 0 ? (
              ranking.map((account, index) => (
                <div
                  key={account.id}
                  className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4"
                >
                  <div
                    className={`grid h-11 w-11 place-items-center rounded-full text-sm font-bold ${medalClassName(
                      index
                    )}`}
                  >
                    {index === 0 ? "1" : index === 1 ? "2" : "3"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {account.name}
                      {account.id === session?.user.id ? " (Ty)" : ""}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {index === 0
                        ? "Zloty medal"
                        : index === 1
                        ? "Srebrny medal"
                        : "Brazowy medal"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs uppercase tracking-[0.12em] text-slate-500">
                      XML
                    </p>
                    <p className="mt-1 text-xl font-bold text-slate-900">
                      {account.ksefGeneratedCount}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                Jeszcze nikt nie wygenerowal XML do rankingu.
              </div>
            )}
          </div>

          <p className="mt-4 text-xs leading-5 text-slate-500">
            Po kazdym poprawnie wygenerowanym XML licznik osoby zwieksza sie
            automatycznie. Import wsadowy dolicza tyle punktow, ile poprawnych
            XML udalo sie wygenerowac.
          </p>
        </section>
      </div>
    </div>
  );
}
