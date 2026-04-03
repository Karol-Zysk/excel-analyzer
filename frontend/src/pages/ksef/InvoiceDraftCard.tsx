import { memo, useEffect, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  CircleCheckBig,
  Download,
  Plus,
  Sparkles,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import type {
  KsefBuyerIdentifierType,
  KsefMappedImportInvoiceResponse,
  KsefMyCompanyRole,
  KsefPaymentMethodValue,
  KsefTaxRateValue,
} from "../../api/backend";
import {
  getInvoiceDraftValidation,
  getLiveMissingFieldLabels,
  hasTextValue,
} from "./invoiceDraftValidation";
import type {
  CopiedInvoiceItemsState,
  InvoiceOverrideItemState,
  InvoiceOverrideState,
} from "./invoiceDraftTypes";

function fieldClassName() {
  return "w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[12px] leading-5 text-slate-700 outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-100";
}

function editorFieldClassName(requiredMissing: boolean, optionalMissing = false) {
  const base = fieldClassName();

  if (requiredMissing) {
    return base.replace(
      "border border-slate-200 bg-white",
      "border border-rose-300 bg-rose-50"
    );
  }

  if (optionalMissing) {
    return base.replace(
      "border border-slate-200 bg-white",
      "border border-amber-300 bg-amber-50"
    );
  }

  return base;
}

function fieldLabel(label: string, required = false) {
  return (
    <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
      {label}
      {required ? " *" : ""}
    </span>
  );
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

function CompanyBadge({
  companyName,
}: {
  companyName: string;
}) {
  return (
    <span className="inline-flex max-w-full items-center rounded-full bg-slate-200 px-3.5 py-1.5 text-[13px] font-semibold text-slate-700">
      <span className="truncate">{companyName || "Bez nazwy firmy"}</span>
    </span>
  );
}

const TAX_RATE_OPTIONS: Array<{ value: KsefTaxRateValue; label: string }> = [
  { value: "23", label: "23%" },
  { value: "8", label: "8%" },
  { value: "5", label: "5%" },
  { value: "0 KR", label: "0% kraj" },
  { value: "zw", label: "zw" },
];

const PAYMENT_METHOD_OPTIONS: Array<{
  value: KsefPaymentMethodValue;
  label: string;
}> = [
  { value: "6", label: "Przelew" },
  { value: "1", label: "Gotowka" },
  { value: "2", label: "Karta" },
];

type InvoiceDraftItemEditorProps = {
  invoiceKey: string;
  invoiceRowNumbers: number[];
  item: InvoiceOverrideItemState;
  itemIndex: number;
  itemCount: number;
  selectedForCopy: boolean;
  itemValidation:
    | {
        rowNumber: number;
        name: boolean;
        unit: boolean;
        quantity: boolean;
        unitNetPrice: boolean;
        taxRate: boolean;
      }
    | undefined;
  canDeriveTaxRate: boolean;
  toggleSelectedForCopy: (rowNumber: number) => void;
  updateInvoiceOverrideItemField: <K extends keyof InvoiceOverrideItemState>(
    invoiceKey: string,
    rowNumber: number,
    field: K,
    value: InvoiceOverrideItemState[K]
  ) => void;
  removeInvoiceOverrideItem: (invoiceKey: string, rowNumber: number) => void;
};

const InvoiceDraftItemEditor = memo(
  function InvoiceDraftItemEditor({
    invoiceKey,
    invoiceRowNumbers,
    item,
    itemIndex,
    itemCount,
    selectedForCopy,
    itemValidation,
    canDeriveTaxRate,
    toggleSelectedForCopy,
    updateInvoiceOverrideItemField,
    removeInvoiceOverrideItem,
  }: InvoiceDraftItemEditorProps) {
    const isManualItem = !invoiceRowNumbers.includes(item.rowNumber);

    return (
      <div
        className={`rounded-2xl border-2 bg-slate-100/95 p-3.5 shadow-[0_4px_14px_rgba(15,23,42,0.05)] ${
          itemValidation &&
          (itemValidation.name ||
            itemValidation.unit ||
            itemValidation.quantity ||
            itemValidation.unitNetPrice ||
            itemValidation.taxRate)
            ? "border-slate-600"
            : "border-slate-400"
        }`}
      >
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[13px] font-semibold text-slate-900">
            Pozycja {itemIndex + 1}
          </p>
          <div className="flex flex-wrap gap-2">
            <label className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 shadow-sm">
              <input
                type="checkbox"
                checked={selectedForCopy}
                onChange={() => toggleSelectedForCopy(item.rowNumber)}
                className="h-3.5 w-3.5 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
              />
              Kopiuj
            </label>
            <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              {isManualItem ? `Recznie ${item.rowNumber}` : `Wiersz ${item.rowNumber}`}
            </span>
            <button
              type="button"
              onClick={() => removeInvoiceOverrideItem(invoiceKey, item.rowNumber)}
              disabled={itemCount <= 1}
              className="inline-flex items-center gap-1 rounded-full border border-rose-200 px-2.5 py-1 text-[11px] font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Trash2 className="h-3 w-3" />
              Usun pozycje
            </button>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1.5 md:col-span-2">
            {fieldLabel("Nazwa pozycji", true)}
            <input
              className={editorFieldClassName(itemValidation?.name ?? false)}
              value={item.name}
              onChange={(event) =>
                updateInvoiceOverrideItemField(
                  invoiceKey,
                  item.rowNumber,
                  "name",
                  event.target.value
                )
              }
            />
          </label>
          <label className="space-y-1.5 md:col-span-2">
            {fieldLabel("Opis pozycji")}
            <textarea
              className={editorFieldClassName(false, !hasTextValue(item.description))}
              rows={2}
              value={item.description}
              onChange={(event) =>
                updateInvoiceOverrideItemField(
                  invoiceKey,
                  item.rowNumber,
                  "description",
                  event.target.value
                )
              }
            />
          </label>
          <label className="space-y-1.5">
            {fieldLabel("Jednostka", true)}
            <input
              className={editorFieldClassName(itemValidation?.unit ?? false)}
              value={item.unit}
              onChange={(event) =>
                updateInvoiceOverrideItemField(
                  invoiceKey,
                  item.rowNumber,
                  "unit",
                  event.target.value
                )
              }
            />
          </label>
          <label className="space-y-1.5">
            {fieldLabel("Ilosc", true)}
            <input
              type="number"
              min="0.0001"
              step="0.0001"
              className={editorFieldClassName(itemValidation?.quantity ?? false)}
              value={item.quantity}
              onChange={(event) =>
                updateInvoiceOverrideItemField(
                  invoiceKey,
                  item.rowNumber,
                  "quantity",
                  event.target.value
                )
              }
            />
          </label>
          <label className="space-y-1.5">
            {fieldLabel("Cena netto", true)}
            <input
              type="number"
              min="0"
              step="0.0001"
              className={editorFieldClassName(itemValidation?.unitNetPrice ?? false)}
              value={item.unitNetPrice}
              onChange={(event) =>
                updateInvoiceOverrideItemField(
                  invoiceKey,
                  item.rowNumber,
                  "unitNetPrice",
                  event.target.value
                )
              }
            />
          </label>
          <label className="space-y-1.5">
            {fieldLabel("Stawka VAT", !canDeriveTaxRate)}
            <select
              className={editorFieldClassName(itemValidation?.taxRate ?? false)}
              value={item.taxRate}
              onChange={(event) =>
                updateInvoiceOverrideItemField(
                  invoiceKey,
                  item.rowNumber,
                  "taxRate",
                  event.target.value as "" | KsefTaxRateValue
                )
              }
            >
              <option value="">Brak</option>
              {TAX_RATE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1.5 md:col-span-2">
            {fieldLabel("Kod pozycji")}
            <input
              className={editorFieldClassName(false, !hasTextValue(item.productCode))}
              value={item.productCode}
              onChange={(event) =>
                updateInvoiceOverrideItemField(
                  invoiceKey,
                  item.rowNumber,
                  "productCode",
                  event.target.value
                )
              }
            />
          </label>
        </div>
      </div>
    );
  },
  (previousProps, nextProps) =>
    previousProps.invoiceKey === nextProps.invoiceKey &&
    previousProps.item === nextProps.item &&
    previousProps.itemIndex === nextProps.itemIndex &&
    previousProps.itemCount === nextProps.itemCount &&
    previousProps.selectedForCopy === nextProps.selectedForCopy &&
    previousProps.itemValidation === nextProps.itemValidation &&
    previousProps.canDeriveTaxRate === nextProps.canDeriveTaxRate &&
    previousProps.invoiceRowNumbers === nextProps.invoiceRowNumbers
);

export type InvoiceDraftCardProps = {
  invoice: KsefMappedImportInvoiceResponse;
  invoiceKey: string;
  invoiceDraft?: InvoiceOverrideState;
  myCompanyRole: KsefMyCompanyRole;
  buyerIdentifierType: KsefBuyerIdentifierType;
  copiedInvoiceItems: CopiedInvoiceItemsState | null;
  singleInvoiceError?: string;
  isSingleInvoicePending: boolean;
  submitSingleInvoice: (
    invoice: KsefMappedImportInvoiceResponse,
    invoiceDraft: InvoiceOverrideState
  ) => void;
  updateInvoiceOverrideField: <K extends keyof InvoiceOverrideState>(
    invoiceKey: string,
    field: K,
    value: InvoiceOverrideState[K]
  ) => void;
  updateInvoiceOverrideItemField: <K extends keyof InvoiceOverrideItemState>(
    invoiceKey: string,
    rowNumber: number,
    field: K,
    value: InvoiceOverrideItemState[K]
  ) => void;
  addInvoiceOverrideItem: (invoiceKey: string) => void;
  removeInvoiceOverrideItem: (invoiceKey: string, rowNumber: number) => void;
  copyInvoiceItems: (
    invoiceKey: string,
    invoiceNumber: string,
    items: InvoiceOverrideItemState[]
  ) => void;
  applyCopiedItemsToInvoice: (
    invoiceKey: string,
    mode: "add" | "replace"
  ) => void;
};

export const InvoiceDraftCard = memo(
  function InvoiceDraftCard({
    invoice,
    invoiceKey,
    invoiceDraft,
    myCompanyRole,
    buyerIdentifierType,
    copiedInvoiceItems,
    singleInvoiceError,
    isSingleInvoicePending,
    submitSingleInvoice,
    updateInvoiceOverrideField,
    updateInvoiceOverrideItemField,
    addInvoiceOverrideItem,
    removeInvoiceOverrideItem,
    copyInvoiceItems,
    applyCopiedItemsToInvoice,
  }: InvoiceDraftCardProps) {
    const [selectedRowNumbers, setSelectedRowNumbers] = useState<number[]>([]);
    const [isCollapsed, setIsCollapsed] = useState(true);

    useEffect(() => {
      if (!invoiceDraft) {
        setSelectedRowNumbers([]);
        return;
      }

      const availableRowNumbers = invoiceDraft.items.map((item) => item.rowNumber);

      setSelectedRowNumbers((current) => {
        return current.filter((rowNumber) => availableRowNumbers.includes(rowNumber));
      });
    }, [invoiceDraft]);

    const validation = getInvoiceDraftValidation(
      invoice,
      invoiceDraft,
      myCompanyRole,
      buyerIdentifierType
    );
    const liveMissingLabels = getLiveMissingFieldLabels(
      validation,
      myCompanyRole,
      buyerIdentifierType
    );
    const validationMessages = [
      ...(liveMissingLabels.length > 0
        ? [
            `Brakuje danych potrzebnych do wygenerowania XML: ${liveMissingLabels.join(
              ", "
            )}.`,
          ]
        : []),
      ...invoice.businessErrors.filter(
        (error) =>
          !error.startsWith("Brakuje danych potrzebnych do wygenerowania XML:")
      ),
    ];
    const counterpartyNameLabel =
      myCompanyRole === "SELLER" ? "Nazwa nabywcy" : "Nazwa sprzedawcy";
    const counterpartyNipLabel =
      myCompanyRole === "SELLER" ? "NIP nabywcy" : "NIP sprzedawcy";
    const counterpartyAddressLabel =
      myCompanyRole === "SELLER" ? "Adres nabywcy" : "Adres sprzedawcy";
    const counterpartyAddressLine2Label =
      myCompanyRole === "SELLER"
        ? "Adres nabywcy linia 2"
        : "Adres sprzedawcy linia 2";
    const canDeriveTaxRate =
      invoice.preview.netTotal !== undefined &&
      invoice.preview.vatTotal !== undefined;
    const requiresExemptionReason = invoiceDraft
      ? invoiceDraft.items.some(
          (item) =>
            item.taxRate === "zw" ||
            invoice.preview.items.find(
              (preview) => preview.rowNumber === item.rowNumber
            )?.taxRate === "zw"
        )
      : false;
    const selectedItemsForCopy =
      invoiceDraft?.items.filter((item) => selectedRowNumbers.includes(item.rowNumber)) ??
      [];
    const companyBadgeLabel =
      invoiceDraft?.buyerName.trim() || invoice.preview.buyerName || "Bez nazwy firmy";

    function toggleSelectedForCopy(rowNumber: number) {
      setSelectedRowNumbers((current) =>
        current.includes(rowNumber)
          ? current.filter((selectedRowNumber) => selectedRowNumber !== rowNumber)
          : [...current, rowNumber]
      );
    }

    return (
      <div
        className={`rounded-3xl border-2 bg-slate-100/90 p-4 shadow-[0_8px_24px_rgba(15,23,42,0.08)] ${
          validation.hasRequiredMissing ? "border-slate-700" : "border-slate-500"
        }`}
      >
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm font-semibold text-slate-900">
                {invoice.invoiceNumber}
              </p>
              <CompanyBadge companyName={companyBadgeLabel} />
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Wiersze arkusza: {invoice.rowNumbers.join(", ")}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {invoiceDraft && (
              <button
                type="button"
                onClick={() => submitSingleInvoice(invoice, invoiceDraft)}
                disabled={validation.hasRequiredMissing || isSingleInvoicePending}
                className="inline-flex items-center gap-2 whitespace-nowrap rounded-xl bg-sky-500 px-3.5 py-2 text-[13px] font-semibold text-white transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSingleInvoicePending ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Generowanie...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    {invoice.xml
                      ? "Wygeneruj t\u0119 faktur\u0119 ponownie"
                      : "Generuj t\u0119 faktur\u0119"}
                  </>
                )}
              </button>
            )}
            <button
              type="button"
              onClick={() =>
                invoice.xml &&
                invoice.fileName &&
                downloadXml(invoice.xml, invoice.fileName)
              }
              disabled={!invoice.xml || !invoice.fileName}
              className="inline-flex items-center gap-2 whitespace-nowrap rounded-xl bg-emerald-500 px-3.5 py-2 text-[13px] font-semibold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Download className="h-4 w-4" />
              Pobierz XML
            </button>
            <button
              type="button"
              onClick={() => setIsCollapsed((current) => !current)}
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-[12px] font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              {isCollapsed ? (
                <>
                  <ChevronDown className="h-3.5 w-3.5" />
                  Rozwin
                </>
              ) : (
                <>
                  <ChevronUp className="h-3.5 w-3.5" />
                  Zwin
                </>
              )}
            </button>
          </div>
        </div>

        {!isCollapsed && (
          <>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-[13px] shadow-sm">
            <p className="text-slate-500">Wiersz arkusza</p>
            <p className="mt-1 font-semibold text-slate-900">
              {invoice.rowNumbers.join(", ")}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-[13px] shadow-sm">
            <p className="text-slate-500">Netto / VAT / Brutto</p>
            <p className="mt-1 font-semibold text-slate-900">
              {(invoice.summary?.netTotal ?? invoice.preview.netTotal ?? 0).toFixed(2)} /{" "}
              {(invoice.summary?.taxTotal ?? invoice.preview.vatTotal ?? 0).toFixed(
                2
              )} /{" "}
              {(invoice.summary?.grossTotal ?? invoice.preview.grossTotal ?? 0).toFixed(
                2
              )}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-[13px] shadow-sm">
            <p className="text-slate-500">Status formularza</p>
            <p className="mt-1 font-semibold text-slate-900">
              {validation.hasRequiredMissing ? "Brakuja pola wymagane" : "Gotowe do XML"}
            </p>
          </div>
        </div>

        {invoiceDraft && (
          <div className="mt-4 rounded-2xl border-2 border-slate-400 bg-slate-200/80 p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[13px] font-semibold text-slate-900">
                  Uzupelnij dane tej faktury
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Wszystkie pola mozesz od razu poprawic. Czerwone sa wymagane i
                  puste, zolte sa opcjonalne i jeszcze niewypelnione.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-[11px] font-medium">
                <span className="rounded-full bg-white px-2.5 py-1 text-slate-600 shadow-sm">
                  Faktura: {invoice.rowNumbers.join(", ")}
                </span>
                <span className="rounded-full bg-rose-100 px-2.5 py-1 text-rose-700">
                  Wymagane
                </span>
                <span className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-700">
                  Opcjonalne
                </span>
              </div>
            </div>

            <div className="mt-4 grid gap-2.5 md:grid-cols-2">
              <label className="space-y-1.5">
                {fieldLabel("Numer faktury", true)}
                <input
                  className={editorFieldClassName(validation.invoiceNumber)}
                  value={invoiceDraft.invoiceNumber}
                  onChange={(event) =>
                    updateInvoiceOverrideField(
                      invoiceKey,
                      "invoiceNumber",
                      event.target.value
                    )
                  }
                />
              </label>
              <label className="space-y-1.5">
                {fieldLabel("Data wystawienia", true)}
                <input
                  type="date"
                  className={editorFieldClassName(validation.issueDate)}
                  value={invoiceDraft.issueDate}
                  onChange={(event) =>
                    updateInvoiceOverrideField(
                      invoiceKey,
                      "issueDate",
                      event.target.value
                    )
                  }
                />
              </label>
              <label className="space-y-1.5">
                {fieldLabel(counterpartyNameLabel, true)}
                <input
                  className={editorFieldClassName(validation.buyerName)}
                  value={invoiceDraft.buyerName}
                  onChange={(event) =>
                    updateInvoiceOverrideField(invoiceKey, "buyerName", event.target.value)
                  }
                />
              </label>
              <label className="space-y-1.5">
                {fieldLabel(counterpartyNipLabel, buyerIdentifierType === "NIP")}
                <input
                  className={editorFieldClassName(validation.buyerNip)}
                  value={invoiceDraft.buyerNip}
                  onChange={(event) =>
                    updateInvoiceOverrideField(invoiceKey, "buyerNip", event.target.value)
                  }
                />
              </label>
              <label className="space-y-1.5 md:col-span-2">
                {fieldLabel(counterpartyAddressLabel, myCompanyRole === "BUYER")}
                <input
                  className={editorFieldClassName(
                    validation.buyerAddressLine1,
                    !hasTextValue(invoiceDraft.buyerAddressLine1) &&
                      !validation.buyerAddressLine1
                  )}
                  value={invoiceDraft.buyerAddressLine1}
                  onChange={(event) =>
                    updateInvoiceOverrideField(
                      invoiceKey,
                      "buyerAddressLine1",
                      event.target.value
                    )
                  }
                />
              </label>
              <label className="space-y-1.5 md:col-span-2">
                {fieldLabel(counterpartyAddressLine2Label)}
                <input
                  className={editorFieldClassName(
                    false,
                    !hasTextValue(invoiceDraft.buyerAddressLine2)
                  )}
                  value={invoiceDraft.buyerAddressLine2}
                  onChange={(event) =>
                    updateInvoiceOverrideField(
                      invoiceKey,
                      "buyerAddressLine2",
                      event.target.value
                    )
                  }
                />
              </label>
              <label className="space-y-1.5">
                {fieldLabel("Kod kraju")}
                <input
                  className={editorFieldClassName(
                    false,
                    !hasTextValue(invoiceDraft.buyerCountryCode)
                  )}
                  value={invoiceDraft.buyerCountryCode}
                  maxLength={2}
                  onChange={(event) =>
                    updateInvoiceOverrideField(
                      invoiceKey,
                      "buyerCountryCode",
                      event.target.value.toUpperCase()
                    )
                  }
                />
              </label>
              <label className="space-y-1.5">
                {fieldLabel("Waluta")}
                <input
                  className={editorFieldClassName(false, !hasTextValue(invoiceDraft.currency))}
                  value={invoiceDraft.currency}
                  maxLength={3}
                  onChange={(event) =>
                    updateInvoiceOverrideField(
                      invoiceKey,
                      "currency",
                      event.target.value.toUpperCase()
                    )
                  }
                />
              </label>
              <label className="space-y-1.5 md:col-span-2">
                {fieldLabel("Podstawa zwolnienia z VAT", requiresExemptionReason)}
                <textarea
                  className={editorFieldClassName(validation.exemptionReason)}
                  rows={2}
                  value={invoiceDraft.exemptionReason}
                  onChange={(event) =>
                    updateInvoiceOverrideField(
                      invoiceKey,
                      "exemptionReason",
                      event.target.value
                    )
                  }
                />
              </label>
              <label className="space-y-1.5">
                {fieldLabel("Termin platnosci")}
                <input
                  type="date"
                  className={editorFieldClassName(
                    false,
                    !hasTextValue(invoiceDraft.paymentDueDate)
                  )}
                  value={invoiceDraft.paymentDueDate}
                  onChange={(event) =>
                    updateInvoiceOverrideField(
                      invoiceKey,
                      "paymentDueDate",
                      event.target.value
                    )
                  }
                />
              </label>
              <label className="space-y-1.5">
                {fieldLabel("Forma platnosci")}
                <select
                  className={editorFieldClassName(
                    false,
                    !hasTextValue(invoiceDraft.paymentMethod)
                  )}
                  value={invoiceDraft.paymentMethod}
                  onChange={(event) =>
                    updateInvoiceOverrideField(
                      invoiceKey,
                      "paymentMethod",
                      event.target.value as "" | KsefPaymentMethodValue
                    )
                  }
                >
                  <option value="">Brak</option>
                  {PAYMENT_METHOD_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1.5 md:col-span-2">
                {fieldLabel("Rachunek bankowy")}
                <input
                  className={editorFieldClassName(
                    false,
                    !hasTextValue(invoiceDraft.paymentBankAccount)
                  )}
                  value={invoiceDraft.paymentBankAccount}
                  onChange={(event) =>
                    updateInvoiceOverrideField(
                      invoiceKey,
                      "paymentBankAccount",
                      event.target.value
                    )
                  }
                />
              </label>
            </div>

            <div className="mt-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-[13px] font-semibold text-slate-900">
                  Pozycje tej faktury
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      copyInvoiceItems(
                        invoiceKey,
                        invoice.invoiceNumber,
                        selectedItemsForCopy
                      )
                    }
                    disabled={selectedItemsForCopy.length === 0}
                    className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Kopiuj zaznaczone ({selectedItemsForCopy.length})
                  </button>
                  {copiedInvoiceItems &&
                    copiedInvoiceItems.sourceInvoiceKey !== invoiceKey && (
                      <>
                        <button
                          type="button"
                          onClick={() => applyCopiedItemsToInvoice(invoiceKey, "add")}
                          className="rounded-xl border border-sky-200 bg-sky-50 px-2.5 py-1.5 text-[12px] font-semibold text-sky-700 transition hover:bg-sky-100"
                        >
                          Dodaj
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            applyCopiedItemsToInvoice(invoiceKey, "replace")
                          }
                          className="rounded-xl border border-sky-200 bg-sky-50 px-2.5 py-1.5 text-[12px] font-semibold text-sky-700 transition hover:bg-sky-100"
                        >
                          Zastap
                        </button>
                      </>
                    )}
                  <button
                    type="button"
                    onClick={() => addInvoiceOverrideItem(invoiceKey)}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Dodaj pozycje
                  </button>
                </div>
              </div>
              {invoiceDraft.items.map((item, index) => (
                <InvoiceDraftItemEditor
                  key={`${invoiceKey}-editor-${item.rowNumber}`}
                  invoiceKey={invoiceKey}
                  invoiceRowNumbers={invoice.rowNumbers}
                  item={item}
                  itemIndex={index}
                  itemCount={invoiceDraft.items.length}
                  selectedForCopy={selectedRowNumbers.includes(item.rowNumber)}
                  itemValidation={validation.items.find(
                    (entry) => entry.rowNumber === item.rowNumber
                  )}
                  canDeriveTaxRate={canDeriveTaxRate}
                  toggleSelectedForCopy={toggleSelectedForCopy}
                  updateInvoiceOverrideItemField={updateInvoiceOverrideItemField}
                  removeInvoiceOverrideItem={removeInvoiceOverrideItem}
                />
              ))}
            </div>
          </div>
        )}

        {validationMessages.length > 0 && (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-rose-700">
              <TriangleAlert className="h-4 w-4" />
              Komunikaty walidacji
            </div>
            <div className="mt-3 space-y-2 text-sm leading-6 text-rose-700">
              {validationMessages.map((error) => (
                <p key={`${invoice.invoiceNumber}-${error}`}>{error}</p>
              ))}
            </div>
          </div>
        )}

        {singleInvoiceError && (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            <div className="flex items-center gap-2 font-semibold">
              <TriangleAlert className="h-4 w-4" />
              Nie udalo sie wygenerowac tej faktury
            </div>
            <p className="mt-2 leading-6">{singleInvoiceError}</p>
          </div>
        )}

        {invoice.valid && invoice.summary && (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            <div className="flex items-center gap-2 font-semibold">
              <CircleCheckBig className="h-4 w-4" />
              XML przeszedl walidacje XSD
            </div>
            <p className="mt-2">
              {invoice.summary.netTotal.toFixed(2)} {invoice.summary.currency} netto, VAT{" "}
              {invoice.summary.taxTotal.toFixed(2)}, brutto{" "}
              {invoice.summary.grossTotal.toFixed(2)}.
            </p>
          </div>
        )}

        {invoice.xml && invoice.fileName && (
          <details className="mt-4 rounded-2xl border border-slate-200 bg-slate-950 p-4 text-white">
            <summary className="cursor-pointer text-sm font-semibold">
              Podglad XML
            </summary>
            <p className="mt-2 text-xs text-slate-400">{invoice.fileName}</p>
            <textarea
              readOnly
              value={invoice.xml}
              className="mt-3 h-[280px] w-full rounded-2xl border border-slate-800 bg-slate-900 p-4 font-mono text-xs leading-6 text-slate-100 outline-none"
            />
          </details>
        )}
          </>
        )}
      </div>
    );
  },
  (previousProps, nextProps) =>
    previousProps.invoice === nextProps.invoice &&
    previousProps.invoiceKey === nextProps.invoiceKey &&
    previousProps.invoiceDraft === nextProps.invoiceDraft &&
    previousProps.myCompanyRole === nextProps.myCompanyRole &&
    previousProps.buyerIdentifierType === nextProps.buyerIdentifierType &&
    previousProps.copiedInvoiceItems === nextProps.copiedInvoiceItems &&
    previousProps.singleInvoiceError === nextProps.singleInvoiceError &&
    previousProps.isSingleInvoicePending === nextProps.isSingleInvoicePending
);

