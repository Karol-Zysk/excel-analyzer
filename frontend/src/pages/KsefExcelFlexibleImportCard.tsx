import { useMutation, useQuery } from "@tanstack/react-query";
import {
  CircleCheckBig,
  Database,
  Download,
  FileSpreadsheet,
  Plus,
  Save,
  Sparkles,
  TriangleAlert,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
  analyzeKsefExcel,
  deleteKsefCompanyProfile,
  generateKsefXml,
  getKsefCompanyProfiles,
  importKsefExcelMapped,
  saveKsefCompanyProfile,
  type AnalyzeKsefExcelResponse,
  type GenerateKsefXmlPayload,
  type KsefBuyerIdentifierType,
  type KsefCompanyProfile,
  type KsefExcelFlexibleFieldKey,
  type KsefExcelSupplementFieldKey,
  type KsefMappedImportConfig,
  type KsefMappedImportInvoiceResponse,
  type KsefMappedImportResponse,
  type KsefMyCompanyRole,
  type KsefPaymentMethodValue,
  type KsefTaxRateValue,
} from "../api/backend";
import { useAuth } from "../auth/AuthProvider";

type FlexibleDefaultsState = {
  sellerNip: string;
  sellerName: string;
  sellerCountryCode: string;
  sellerAddressLine1: string;
  sellerAddressLine2: string;
  sellerEmail: string;
  sellerPhone: string;
  buyerIdentifierType: KsefBuyerIdentifierType;
  defaultBuyerName: string;
  defaultBuyerNip: string;
  defaultBuyerAddressLine1: string;
  defaultBuyerAddressLine2: string;
  defaultBuyerCountryCode: string;
  defaultIssueDate: string;
  defaultSaleDate: string;
  currency: string;
  placeOfIssue: string;
  systemName: string;
  paymentMethod: "" | KsefPaymentMethodValue;
  paymentBankAccount: string;
  defaultItemName: string;
  defaultItemDescription: string;
  defaultItemUnit: string;
  defaultItemQuantity: string;
  defaultTaxRate: "" | KsefTaxRateValue;
  splitPayment: boolean;
  cashAccounting: boolean;
  selfBilling: boolean;
  simplifiedProcedure: boolean;
  relatedEntities: boolean;
  annex15: boolean;
};

type KsefExcelFlexibleImportCardProps = {
  onGenerationSuccess?: () => void;
};

type InvoiceOverrideItemState = {
  rowNumber: number;
  name: string;
  description: string;
  productCode: string;
  unit: string;
  quantity: string;
  unitNetPrice: string;
  taxRate: "" | KsefTaxRateValue;
};

type InvoiceOverrideState = {
  rowNumbers: number[];
  invoiceNumber: string;
  issueDate: string;
  saleDate: string;
  buyerName: string;
  buyerNip: string;
  buyerAddressLine1: string;
  buyerAddressLine2: string;
  buyerCountryCode: string;
  currency: string;
  exemptionReason: string;
  paymentDueDate: string;
  paymentMethod: "" | KsefPaymentMethodValue;
  paymentBankAccount: string;
  items: InvoiceOverrideItemState[];
};

type InvoiceOverridesState = Record<string, InvoiceOverrideState>;
type CompletionFieldKey =
  | KsefExcelFlexibleFieldKey
  | KsefExcelSupplementFieldKey;

const ALL_TAX_RATE_VALUES: KsefTaxRateValue[] = [
  "23",
  "22",
  "8",
  "7",
  "5",
  "4",
  "3",
  "0 KR",
  "0 WDT",
  "0 EX",
  "zw",
  "oo",
  "np I",
  "np II",
];

const REQUIRED_MAPPING_FIELDS: Array<{
  key: KsefExcelFlexibleFieldKey;
  label: string;
  helper: string;
  required: boolean;
}> = [
  {
    key: "invoiceNumber",
    label: "Numer faktury",
    helper: "Bez tego kazdy wiersz bedzie osobnym draftem.",
    required: true,
  },
  {
    key: "issueDate",
    label: "Data wystawienia",
    helper: "Jesli nie ma tej kolumny, uzupelnisz ja pozniej na karcie faktury.",
    required: false,
  },
  {
    key: "saleDate",
    label: "Data sprzedazy",
    helper: "Opcjonalna, ale zwykle warto ja zmapowac.",
    required: false,
  },
  {
    key: "buyerName",
    label: "Kontrahent",
    helper: "Jesli brak kolumny albo danych, uzupelnisz je pozniej dla konkretnej faktury.",
    required: false,
  },
  {
    key: "buyerNip",
    label: "NIP kontrahenta",
    helper: "Potrzebny przy identyfikatorze NIP.",
    required: false,
  },
  {
    key: "itemName",
    label: "Nazwa pozycji",
    helper:
      "Jesli eksport nie ma tej kolumny, uzupelnisz nazwe pozniej dla konkretnej pozycji.",
    required: false,
  },
  {
    key: "netTotal",
    label: "Netto",
    helper:
      "Przy eksporcie rejestrowym to najwygodniejsze zrodlo kwoty pozycji.",
    required: false,
  },
  {
    key: "vatTotal",
    label: "VAT",
    helper: "Pomaga wyliczyc stawke VAT, jesli nie ma osobnej kolumny.",
    required: false,
  },
  {
    key: "grossTotal",
    label: "Brutto",
    helper: "Opcjonalne, ale pomaga w kontroli danych.",
    required: false,
  },
];

const OPTIONAL_MAPPING_FIELDS: Array<{
  key: KsefExcelFlexibleFieldKey;
  label: string;
}> = [
  { key: "buyerAddressLine1", label: "Adres kontrahenta" },
  { key: "buyerAddressLine2", label: "Adres kontrahenta linia 2" },
  { key: "buyerCountryCode", label: "Kod kraju kontrahenta" },
  { key: "currency", label: "Waluta" },
  { key: "exemptionReason", label: "Podstawa zwolnienia z VAT" },
  { key: "itemDescription", label: "Opis pozycji" },
  { key: "itemProductCode", label: "Kod pozycji" },
  { key: "itemUnit", label: "Jednostka" },
  { key: "itemQuantity", label: "Ilosc" },
  { key: "itemUnitNetPrice", label: "Cena netto pozycji" },
  { key: "itemTaxRate", label: "Stawka VAT" },
  { key: "paymentDueDate", label: "Termin platnosci" },
  { key: "paymentMethod", label: "Forma platnosci" },
  { key: "paymentBankAccount", label: "Rachunek bankowy" },
];

const MAPPING_FIELD_OPTIONS: Array<{
  key: KsefExcelFlexibleFieldKey;
  label: string;
  helper?: string;
  required: boolean;
}> = [
  ...REQUIRED_MAPPING_FIELDS.map((field) => ({
    key: field.key,
    label: field.label,
    helper: field.helper,
    required: field.required,
  })),
  ...OPTIONAL_MAPPING_FIELDS.map((field) => ({
    key: field.key,
    label: field.label,
    required: false,
  })),
];

const BUYER_IDENTIFIER_OPTIONS: Array<{
  value: KsefBuyerIdentifierType;
  label: string;
}> = [
  { value: "NIP", label: "NIP" },
  { value: "NONE", label: "Brak ID" },
];

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

const WIZARD_STEPS = [
  { id: 1, label: "Start" },
  { id: 2, label: "Mapowanie" },
  { id: 3, label: "Wymagane" },
  { id: 4, label: "Faktury" },
  { id: 5, label: "Wynik" },
] as const;

const MY_COMPANY_ROLE_OPTIONS: Array<{
  value: KsefMyCompanyRole;
  label: string;
  helper: string;
}> = [
  {
    value: "SELLER",
    label: "Sprzedawca",
    helper: "Moja firma wystawia fakture, a z pliku czytamy dane nabywcy.",
  },
  {
    value: "BUYER",
    label: "Nabywca",
    helper: "Moja firma jest kupujacym, a z pliku czytamy dane sprzedawcy.",
  },
];

type WizardStep = (typeof WIZARD_STEPS)[number]["id"];

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

function sanitizePossibleNip(value: string) {
  const compact = value.replace(/[\s-]+/g, "").trim();
  if (/^PL\d{10}$/i.test(compact)) {
    return compact.slice(2);
  }

  return compact;
}

function optionalText(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function invoiceOverrideKey(rowNumbers: number[]) {
  return [...rowNumbers].sort((left, right) => left - right).join("-");
}

function formatOptionalNumber(value?: number) {
  return value === undefined ? "" : String(value);
}

function buildInvoiceOverridesState(
  mappedImport?: KsefMappedImportResponse
): InvoiceOverridesState {
  if (!mappedImport) {
    return {};
  }

  return Object.fromEntries(
    mappedImport.invoices.map((invoice) => [
      invoiceOverrideKey(invoice.rowNumbers),
      {
        rowNumbers: invoice.rowNumbers,
        invoiceNumber: invoice.invoiceNumber ?? "",
        issueDate: invoice.preview.issueDate ?? "",
        saleDate: invoice.preview.saleDate ?? "",
        buyerName: invoice.preview.buyerName ?? "",
        buyerNip: invoice.preview.buyerNip ?? "",
        buyerAddressLine1: invoice.preview.buyerAddressLine1 ?? "",
        buyerAddressLine2: invoice.preview.buyerAddressLine2 ?? "",
        buyerCountryCode: invoice.preview.buyerCountryCode ?? "PL",
        currency: invoice.preview.currency ?? "PLN",
        exemptionReason: invoice.preview.exemptionReason ?? "",
        paymentDueDate: invoice.preview.paymentDueDate ?? "",
        paymentMethod:
          (invoice.preview.paymentMethod as KsefPaymentMethodValue | undefined) ??
          "",
        paymentBankAccount: invoice.preview.paymentBankAccount ?? "",
        items: invoice.preview.items.map((item) => {
          const derivedUnitNetPrice =
            item.unitNetPrice ??
            (invoice.preview.items.length === 1
              ? invoice.preview.netTotal
              : undefined);

          return {
            rowNumber: item.rowNumber,
            name: item.name ?? "",
            description: item.description ?? "",
            productCode: item.productCode ?? "",
            unit: item.unit ?? "",
            quantity: formatOptionalNumber(item.quantity),
            unitNetPrice: formatOptionalNumber(derivedUnitNetPrice),
            taxRate: (item.taxRate as KsefTaxRateValue | undefined) ?? "",
          };
        }),
      } satisfies InvoiceOverrideState,
    ])
  );
}

function buildInvoiceOverridePayload(invoiceOverrides: InvoiceOverridesState) {
  const invoices = Object.values(invoiceOverrides)
    .map((invoice) => {
      const items = invoice.items
        .map((item) => {
          const quantityText = item.quantity.trim();
          const unitNetPriceText = item.unitNetPrice.trim();
          const quantity =
            quantityText.length > 0 ? Number(quantityText) : Number.NaN;
          const unitNetPrice =
            unitNetPriceText.length > 0
              ? Number(unitNetPriceText)
              : Number.NaN;

          const payload = {
            rowNumber: item.rowNumber,
            name: optionalText(item.name),
            description: optionalText(item.description),
            productCode: optionalText(item.productCode),
            unit: optionalText(item.unit),
            quantity:
              Number.isFinite(quantity) && quantity > 0 ? quantity : undefined,
            unitNetPrice:
              Number.isFinite(unitNetPrice) && unitNetPrice >= 0
                ? unitNetPrice
                : undefined,
            taxRate: item.taxRate || undefined,
          };

          const hasAnyValue = Object.entries(payload).some(
            ([key, value]) => key !== "rowNumber" && value !== undefined
          );

          return hasAnyValue ? payload : null;
        })
        .filter((item): item is NonNullable<typeof item> => item !== null);

      const payload = {
        rowNumbers: invoice.rowNumbers,
        invoiceNumber: optionalText(invoice.invoiceNumber),
        issueDate: optionalText(invoice.issueDate),
        saleDate: optionalText(invoice.saleDate),
        buyerName: optionalText(invoice.buyerName),
        buyerNip: optionalText(invoice.buyerNip),
        buyerAddressLine1: optionalText(invoice.buyerAddressLine1),
        buyerAddressLine2: optionalText(invoice.buyerAddressLine2),
        buyerCountryCode: optionalText(invoice.buyerCountryCode),
        currency: optionalText(invoice.currency),
        exemptionReason: optionalText(invoice.exemptionReason),
        paymentDueDate: optionalText(invoice.paymentDueDate),
        paymentMethod: invoice.paymentMethod || undefined,
        paymentBankAccount: optionalText(invoice.paymentBankAccount),
        items,
      };

      const hasInvoiceValues =
        items.length > 0 ||
        Object.entries(payload).some(
          ([key, value]) =>
            !["rowNumbers", "items"].includes(key) && value !== undefined
        );

      return hasInvoiceValues ? payload : null;
    })
    .filter((invoice): invoice is NonNullable<typeof invoice> => invoice !== null);

  return invoices.length > 0 ? { invoices } : undefined;
}

function getInvoiceDraftValidation(
  invoice: KsefMappedImportInvoiceResponse,
  invoiceDraft: InvoiceOverrideState | undefined,
  myCompanyRole: KsefMyCompanyRole,
  buyerIdentifierType: KsefBuyerIdentifierType
) {
  if (!invoiceDraft) {
    return {
      invoiceNumber: true,
      issueDate: true,
      buyerName: true,
      buyerNip: buyerIdentifierType === "NIP",
      buyerAddressLine1: myCompanyRole === "BUYER",
      exemptionReason: false,
      items: [] as Array<{
        rowNumber: number;
        name: boolean;
        unit: boolean;
        quantity: boolean;
        unitNetPrice: boolean;
        taxRate: boolean;
      }>,
      hasRequiredMissing: true,
    };
  }

  const canDeriveTaxRate =
    invoice.preview.netTotal !== undefined && invoice.preview.vatTotal !== undefined;
  const hasExemptItems = invoiceDraft.items.some(
    (item) =>
      item.taxRate === "zw" ||
      invoice.preview.items.find((preview) => preview.rowNumber === item.rowNumber)
        ?.taxRate === "zw"
  );
  const itemMissing = invoiceDraft.items.map((item) => {
    const quantityMissing = !hasPositiveNumberValue(item.quantity);
    const unitNetPriceMissing =
      !hasNonNegativeNumberValue(item.unitNetPrice) &&
      !(hasPositiveNumberValue(item.quantity) && invoice.preview.netTotal !== undefined);
    const taxRateMissing = !hasTextValue(item.taxRate) && !canDeriveTaxRate;

    return {
      rowNumber: item.rowNumber,
      name: !hasTextValue(item.name),
      unit: !hasTextValue(item.unit),
      quantity: quantityMissing,
      unitNetPrice: unitNetPriceMissing,
      taxRate: taxRateMissing,
    };
  });

  const hasRequiredMissing =
    !hasTextValue(invoiceDraft.invoiceNumber) ||
    !hasTextValue(invoiceDraft.issueDate) ||
    !hasTextValue(invoiceDraft.buyerName) ||
    (buyerIdentifierType === "NIP" && !hasTextValue(invoiceDraft.buyerNip)) ||
    (myCompanyRole === "BUYER" && !hasTextValue(invoiceDraft.buyerAddressLine1)) ||
    (hasExemptItems && !hasTextValue(invoiceDraft.exemptionReason)) ||
    itemMissing.some(
      (item) =>
        item.name ||
        item.unit ||
        item.quantity ||
        item.unitNetPrice ||
        item.taxRate
    );

  return {
    invoiceNumber: !hasTextValue(invoiceDraft.invoiceNumber),
    issueDate: !hasTextValue(invoiceDraft.issueDate),
    buyerName: !hasTextValue(invoiceDraft.buyerName),
    buyerNip: buyerIdentifierType === "NIP" && !hasTextValue(invoiceDraft.buyerNip),
    buyerAddressLine1:
      myCompanyRole === "BUYER" && !hasTextValue(invoiceDraft.buyerAddressLine1),
    exemptionReason: hasExemptItems && !hasTextValue(invoiceDraft.exemptionReason),
    items: itemMissing,
    hasRequiredMissing,
  };
}

function getLiveMissingFieldLabels(
  validation: ReturnType<typeof getInvoiceDraftValidation>,
  myCompanyRole: KsefMyCompanyRole,
  buyerIdentifierType: KsefBuyerIdentifierType
) {
  const labels = new Set<string>();

  if (validation.invoiceNumber) {
    labels.add("Numer faktury");
  }
  if (validation.issueDate) {
    labels.add("Data wystawienia");
  }
  if (validation.buyerName) {
    labels.add(
      myCompanyRole === "SELLER" ? "Nazwa nabywcy" : "Nazwa sprzedawcy"
    );
  }
  if (buyerIdentifierType === "NIP" && validation.buyerNip) {
    labels.add(myCompanyRole === "SELLER" ? "NIP nabywcy" : "NIP sprzedawcy");
  }
  if (validation.buyerAddressLine1) {
    labels.add(myCompanyRole === "SELLER" ? "Adres nabywcy" : "Adres sprzedawcy");
  }
  if (validation.exemptionReason) {
    labels.add("Podstawa zwolnienia z VAT");
  }

  validation.items.forEach((item) => {
    if (item.name) {
      labels.add("Nazwa pozycji");
    }
    if (item.unit) {
      labels.add("Jednostka");
    }
    if (item.quantity) {
      labels.add("Ilosc");
    }
    if (item.unitNetPrice) {
      labels.add("Cena netto pozycji");
    }
    if (item.taxRate) {
      labels.add("Stawka VAT");
    }
  });

  return Array.from(labels);
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

function downloadAllXml(invoices: KsefMappedImportInvoiceResponse[]) {
  const readyInvoices = invoices.filter(
    (invoice) => invoice.xml && invoice.fileName
  );

  readyInvoices.forEach((invoice, index) => {
    window.setTimeout(() => {
      downloadXml(invoice.xml!, invoice.fileName!);
    }, index * 150);
  });
}

function hasTextValue(value: string) {
  return value.trim().length > 0;
}

function hasPositiveNumberValue(value: string) {
  if (!value.trim()) {
    return false;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0;
}

function hasNonNegativeNumberValue(value: string) {
  if (!value.trim()) {
    return false;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0;
}

function roundTo(value: number, decimals: number) {
  return Number(value.toFixed(decimals));
}

function deriveTaxRateFromAmounts(
  netTotal?: number,
  vatTotal?: number
): KsefTaxRateValue | undefined {
  if (netTotal === undefined || vatTotal === undefined || netTotal <= 0) {
    return undefined;
  }

  if (Math.abs(vatTotal) < 0.005) {
    return "0 KR";
  }

  const ratio = (vatTotal / netTotal) * 100;
  const numericRates: KsefTaxRateValue[] = ["23", "22", "8", "7", "5", "4", "3"];

  for (const rate of numericRates) {
    if (Math.abs(ratio - Number(rate)) < 0.3) {
      return rate;
    }
  }

  return undefined;
}

function toKsefTaxRateValue(value?: string) {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim() as KsefTaxRateValue;
  return ALL_TAX_RATE_VALUES.includes(normalized) ? normalized : undefined;
}

function buildSingleInvoicePayload(
  invoice: KsefMappedImportInvoiceResponse,
  invoiceDraft: InvoiceOverrideState,
  defaults: FlexibleDefaultsState,
  myCompanyRole: KsefMyCompanyRole
): GenerateKsefXmlPayload {
  const myCompanyAddress = {
    countryCode: defaults.sellerCountryCode.trim(),
    line1: defaults.sellerAddressLine1.trim(),
    line2: optionalText(defaults.sellerAddressLine2),
  };

  const counterpartyAddress = hasTextValue(invoiceDraft.buyerAddressLine1)
    ? {
        countryCode: invoiceDraft.buyerCountryCode.trim() || "PL",
        line1: invoiceDraft.buyerAddressLine1.trim(),
        line2: optionalText(invoiceDraft.buyerAddressLine2),
      }
    : undefined;

  const resolvedTaxRate =
    (deriveTaxRateFromAmounts(invoice.preview.netTotal, invoice.preview.vatTotal) ??
      (defaults.defaultTaxRate || undefined)) ||
    "23";

  const items = invoiceDraft.items.map((item) => {
    const quantity =
      Number.isFinite(Number(item.quantity)) && Number(item.quantity) > 0
        ? Number(item.quantity)
        : 1;
    const previewItem = invoice.preview.items.find(
      (preview) => preview.rowNumber === item.rowNumber
    );
    const fallbackUnitNetPrice =
      previewItem?.unitNetPrice ??
      (invoice.preview.items.length === 1 && invoice.preview.netTotal !== undefined
        ? roundTo(invoice.preview.netTotal / quantity, 6)
        : 0);
    const unitNetPrice =
      Number.isFinite(Number(item.unitNetPrice)) &&
      Number(item.unitNetPrice) >= 0
        ? Number(item.unitNetPrice)
        : fallbackUnitNetPrice;

    const itemTaxRate =
      item.taxRate ||
      toKsefTaxRateValue(previewItem?.taxRate) ||
      resolvedTaxRate;

    return {
      name: item.name.trim(),
      description: optionalText(item.description),
      productCode: optionalText(item.productCode),
      unit: item.unit.trim(),
      quantity,
      unitNetPrice,
      taxRate: itemTaxRate,
      annex15: defaults.annex15,
    } satisfies GenerateKsefXmlPayload["items"][number];
  });

  const exemptionReason = items.some((item) => item.taxRate === "zw")
    ? optionalText(invoiceDraft.exemptionReason)
    : undefined;

  const payment =
    optionalText(invoiceDraft.paymentDueDate) ||
    invoiceDraft.paymentMethod ||
    optionalText(invoiceDraft.paymentBankAccount)
      ? {
          dueDate: invoiceDraft.paymentDueDate || undefined,
          method: invoiceDraft.paymentMethod || undefined,
          bankAccount: optionalText(invoiceDraft.paymentBankAccount),
        }
      : undefined;

  if (myCompanyRole === "BUYER") {
    return {
      seller: {
        nip: invoiceDraft.buyerNip.trim(),
        name: invoiceDraft.buyerName.trim(),
        address: counterpartyAddress ?? {
          countryCode: invoiceDraft.buyerCountryCode.trim() || "PL",
          line1: invoiceDraft.buyerAddressLine1.trim(),
        },
      },
      buyer: {
        identifierType: defaults.buyerIdentifierType,
        nip: optionalText(defaults.sellerNip),
        name: defaults.sellerName.trim(),
        address: myCompanyAddress,
        email: optionalText(defaults.sellerEmail),
        phone: optionalText(defaults.sellerPhone),
      },
      issueDate: invoiceDraft.issueDate,
      saleDate: invoiceDraft.saleDate || undefined,
      invoiceNumber: invoiceDraft.invoiceNumber.trim(),
      placeOfIssue: optionalText(defaults.placeOfIssue),
      currency: optionalText(invoiceDraft.currency) ?? optionalText(defaults.currency),
      cashAccounting: defaults.cashAccounting,
      selfBilling: defaults.selfBilling,
      splitPayment: defaults.splitPayment,
      simplifiedProcedure: defaults.simplifiedProcedure,
      relatedEntities: defaults.relatedEntities,
      exemptionReason,
      systemName: optionalText(defaults.systemName),
      payment,
      items,
    };
  }

  return {
    seller: {
      nip: defaults.sellerNip.trim(),
      name: defaults.sellerName.trim(),
      address: myCompanyAddress,
      email: optionalText(defaults.sellerEmail),
      phone: optionalText(defaults.sellerPhone),
    },
    buyer: {
      identifierType: defaults.buyerIdentifierType,
      nip: optionalText(invoiceDraft.buyerNip),
      name: invoiceDraft.buyerName.trim(),
      address: counterpartyAddress,
    },
    issueDate: invoiceDraft.issueDate,
    saleDate: invoiceDraft.saleDate || undefined,
    invoiceNumber: invoiceDraft.invoiceNumber.trim(),
    placeOfIssue: optionalText(defaults.placeOfIssue),
    currency: optionalText(invoiceDraft.currency) ?? optionalText(defaults.currency),
    cashAccounting: defaults.cashAccounting,
    selfBilling: defaults.selfBilling,
    splitPayment: defaults.splitPayment,
    simplifiedProcedure: defaults.simplifiedProcedure,
    relatedEntities: defaults.relatedEntities,
    exemptionReason,
    systemName: optionalText(defaults.systemName),
    payment,
    items,
  };
}

function buildInvoicePreviewFromDraft(
  invoice: KsefMappedImportInvoiceResponse,
  invoiceDraft: InvoiceOverrideState
) {
  const items = invoiceDraft.items.map((item) => ({
    rowNumber: item.rowNumber,
    name: optionalText(item.name),
    description: optionalText(item.description),
    productCode: optionalText(item.productCode),
    quantity: hasPositiveNumberValue(item.quantity) ? Number(item.quantity) : undefined,
    unit: optionalText(item.unit),
    unitNetPrice: hasNonNegativeNumberValue(item.unitNetPrice)
      ? Number(item.unitNetPrice)
      : invoice.preview.items.find((preview) => preview.rowNumber === item.rowNumber)
          ?.unitNetPrice,
    taxRate:
      item.taxRate ||
      invoice.preview.items.find((preview) => preview.rowNumber === item.rowNumber)
        ?.taxRate,
  }));

  return {
    ...invoice.preview,
    buyerName: optionalText(invoiceDraft.buyerName),
    buyerNip: optionalText(invoiceDraft.buyerNip),
    buyerAddressLine1: optionalText(invoiceDraft.buyerAddressLine1),
    buyerAddressLine2: optionalText(invoiceDraft.buyerAddressLine2),
    buyerCountryCode: optionalText(invoiceDraft.buyerCountryCode),
    issueDate: optionalText(invoiceDraft.issueDate),
    saleDate: optionalText(invoiceDraft.saleDate),
    currency: optionalText(invoiceDraft.currency),
    exemptionReason: optionalText(invoiceDraft.exemptionReason),
    paymentDueDate: optionalText(invoiceDraft.paymentDueDate),
    paymentMethod: invoiceDraft.paymentMethod || undefined,
    paymentBankAccount: optionalText(invoiceDraft.paymentBankAccount),
    items,
  };
}

function recalculateMappedImportSummary(
  invoices: KsefMappedImportResponse["invoices"]
) {
  const completionCounts = new Map<
    CompletionFieldKey,
    { key: CompletionFieldKey; label: string; count: number }
  >();

  invoices.forEach((invoice) => {
    invoice.missingFields.forEach((field) => {
      const current = completionCounts.get(field.key);
      if (current) {
        current.count += 1;
      } else {
        completionCounts.set(field.key, {
          key: field.key,
          label: field.label,
          count: 1,
        });
      }
    });
  });

  return {
    summary: {
      generatedValid: invoices.filter((invoice) => invoice.status === "generated").length,
      needsCompletion: invoices.filter((invoice) => invoice.status === "needs_completion")
        .length,
      invalidInvoices: invoices.filter((invoice) => invoice.status === "invalid").length,
    },
    completionSummary: Array.from(completionCounts.values()).sort(
      (left, right) => right.count - left.count
    ),
  };
}

function getErrorMessage(error: unknown) {
  if (!(error instanceof Error)) {
    return "Nie udalo sie przetworzyc pliku.";
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

function createDefaultSupplementState(): FlexibleDefaultsState {
  return {
    sellerNip: "",
    sellerName: "",
    sellerCountryCode: "PL",
    sellerAddressLine1: "",
    sellerAddressLine2: "",
    sellerEmail: "",
    sellerPhone: "",
    buyerIdentifierType: "NIP",
    defaultBuyerName: "",
    defaultBuyerNip: "",
    defaultBuyerAddressLine1: "",
    defaultBuyerAddressLine2: "",
    defaultBuyerCountryCode: "PL",
    defaultIssueDate: "",
    defaultSaleDate: "",
    currency: "PLN",
    placeOfIssue: "",
    systemName: "Kasia KSeF XML Generator",
    paymentMethod: "6",
    paymentBankAccount: "",
    defaultItemName: "",
    defaultItemDescription: "",
    defaultItemUnit: "",
    defaultItemQuantity: "",
    defaultTaxRate: "",
    splitPayment: false,
    cashAccounting: false,
    selfBilling: false,
    simplifiedProcedure: false,
    relatedEntities: false,
    annex15: false,
  };
}

function buildMappedConfig(
  mapping: Partial<Record<KsefExcelFlexibleFieldKey, string>>,
  defaults: FlexibleDefaultsState,
  deriveTaxRateFromAmounts: boolean,
  myCompanyRole: KsefMyCompanyRole,
  invoiceOverrides: InvoiceOverridesState
): KsefMappedImportConfig {
  return {
    context: {
      myCompanyRole,
    },
    mapping,
    defaults: {
      sellerNip: optionalText(defaults.sellerNip),
      sellerName: optionalText(defaults.sellerName),
      sellerCountryCode: optionalText(defaults.sellerCountryCode),
      sellerAddressLine1: optionalText(defaults.sellerAddressLine1),
      sellerAddressLine2: optionalText(defaults.sellerAddressLine2),
      sellerEmail: optionalText(defaults.sellerEmail),
      sellerPhone: optionalText(defaults.sellerPhone),
      buyerIdentifierType: defaults.buyerIdentifierType,
      currency: optionalText(defaults.currency),
      placeOfIssue: optionalText(defaults.placeOfIssue),
      systemName: optionalText(defaults.systemName),
      paymentMethod: defaults.paymentMethod || undefined,
      paymentBankAccount: optionalText(defaults.paymentBankAccount),
      splitPayment: defaults.splitPayment,
      cashAccounting: defaults.cashAccounting,
      selfBilling: defaults.selfBilling,
      simplifiedProcedure: defaults.simplifiedProcedure,
      relatedEntities: defaults.relatedEntities,
      annex15: defaults.annex15,
    },
    options: {
      deriveTaxRateFromAmounts,
    },
    overrides: buildInvoiceOverridePayload(invoiceOverrides),
  };
}

function isFlexibleConfigReady(
  defaults: FlexibleDefaultsState,
  _myCompanyRole: KsefMyCompanyRole
) {
  const hasSeller =
    Boolean(optionalText(defaults.sellerNip)) &&
    Boolean(optionalText(defaults.sellerName)) &&
    Boolean(optionalText(defaults.sellerCountryCode)) &&
    Boolean(optionalText(defaults.sellerAddressLine1));

  return hasSeller;
}

function StatusBadge({
  status,
}: {
  status: KsefMappedImportResponse["invoices"][number]["status"];
}) {
  if (status === "generated") {
    return (
      <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
        XML gotowy
      </span>
    );
  }

  if (status === "needs_completion") {
    return (
      <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
        Braki do uzupelnienia
      </span>
    );
  }

  return (
    <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700">
      Bledy danych
    </span>
  );
}

export function KsefExcelFlexibleImportCard({
  onGenerationSuccess,
}: KsefExcelFlexibleImportCardProps) {
  const { session } = useAuth();
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState<WizardStep>(1);
  const [myCompanyRole, setMyCompanyRole] =
    useState<KsefMyCompanyRole>("SELLER");
  const [selectedCompanyProfileId, setSelectedCompanyProfileId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [mapping, setMapping] = useState<
    Partial<Record<KsefExcelFlexibleFieldKey, string>>
  >({});
  const [defaults, setDefaults] = useState<FlexibleDefaultsState>(() =>
    createDefaultSupplementState()
  );
  const [invoiceOverrides, setInvoiceOverrides] = useState<InvoiceOverridesState>(
    {}
  );
  const [mappedImportResult, setMappedImportResult] = useState<
    KsefMappedImportResponse | undefined
  >(undefined);
  const [singleInvoiceErrorByKey, setSingleInvoiceErrorByKey] = useState<
    Record<string, string>
  >({});
  const [deriveTaxRateFromAmounts, setDeriveTaxRateFromAmounts] =
    useState(true);

  const companyProfilesQuery = useQuery({
    queryKey: ["ksef-company-profiles", session?.user.id],
    enabled: Boolean(session?.access_token),
    queryFn: async () => {
      if (!session?.access_token) {
        throw new Error("Brak aktywnej sesji.");
      }

      return getKsefCompanyProfiles(session.access_token);
    },
  });

  const saveCompanyProfileMutation = useMutation({
    mutationFn: async (payload: {
      id?: string;
      companyName: string;
      nip: string;
      countryCode: string;
      addressLine1: string;
      addressLine2?: string;
      email?: string;
      phone?: string;
      currency?: string;
      paymentMethod?: string;
      bankAccount?: string;
    }) => {
      if (!session?.access_token) {
        throw new Error("Brak aktywnej sesji.");
      }

      return saveKsefCompanyProfile(payload, session.access_token);
    },
    onSuccess: async (result) => {
      setSelectedCompanyProfileId(result.profile.id);
      await companyProfilesQuery.refetch();
    },
  });

  const deleteCompanyProfileMutation = useMutation({
    mutationFn: async (profileId: string) => {
      if (!session?.access_token) {
        throw new Error("Brak aktywnej sesji.");
      }

      return deleteKsefCompanyProfile(profileId, session.access_token);
    },
    onSuccess: async () => {
      setSelectedCompanyProfileId("");
      await companyProfilesQuery.refetch();
    },
  });

  const analyzeMutation = useMutation({
    mutationFn: async (selectedFile: File) => {
      if (!session?.access_token) {
        throw new Error("Brak aktywnej sesji.");
      }

      return analyzeKsefExcel(selectedFile, session.access_token);
    },
  });

  const mappedImportMutation = useMutation({
    mutationFn: async (payload: {
      selectedFile: File;
      config: KsefMappedImportConfig;
    }) => {
      if (!session?.access_token) {
        throw new Error("Brak aktywnej sesji.");
      }

      return importKsefExcelMapped(
        payload.selectedFile,
        payload.config,
        session.access_token
      );
    },
    onSuccess: (result) => {
      setMappedImportResult(result);
      setSingleInvoiceErrorByKey({});
      if (result.summary.generatedValid > 0) {
        onGenerationSuccess?.();
      }
    },
  });

  const singleInvoiceMutation = useMutation({
    mutationFn: async (payload: {
      invoice: KsefMappedImportInvoiceResponse;
      invoiceDraft: InvoiceOverrideState;
      invoiceKey: string;
    }) => {
      if (!session?.access_token) {
        throw new Error("Brak aktywnej sesji.");
      }

      return {
        invoiceKey: payload.invoiceKey,
        rowNumbers: payload.invoice.rowNumbers,
        invoiceDraft: payload.invoiceDraft,
        result: await generateKsefXml(
          buildSingleInvoicePayload(
            payload.invoice,
            payload.invoiceDraft,
            defaults,
            myCompanyRole
          ),
          session.access_token
        ),
      };
    },
    onSuccess: ({ invoiceKey, invoiceDraft, result }) => {
      setSingleInvoiceErrorByKey((current) => {
        const next = { ...current };
        delete next[invoiceKey];
        return next;
      });

      setMappedImportResult((current) => {
        if (!current) {
          return current;
        }

        const nextInvoices: KsefMappedImportResponse["invoices"] = current.invoices.map((invoice) => {
          if (invoiceOverrideKey(invoice.rowNumbers) !== invoiceKey) {
            return invoice;
          }

          return {
            ...invoice,
            ...result,
            invoiceNumber: invoiceDraft.invoiceNumber.trim() || invoice.invoiceNumber,
            status: (result.valid ? "generated" : "invalid") as
              | "generated"
              | "invalid",
            missingFields: [],
            preview: buildInvoicePreviewFromDraft(invoice, invoiceDraft),
          };
        });

        const recalculated = recalculateMappedImportSummary(nextInvoices);

        return {
          ...current,
          invoices: nextInvoices,
          summary: {
            ...current.summary,
            generatedValid: recalculated.summary.generatedValid,
            needsCompletion: recalculated.summary.needsCompletion,
            invalidInvoices: recalculated.summary.invalidInvoices,
          },
          completionSummary: recalculated.completionSummary,
        };
      });

      setIsWizardOpen(true);
      if (result.valid) {
        onGenerationSuccess?.();
      }
    },
    onError: (error, variables) => {
      setSingleInvoiceErrorByKey((current) => ({
        ...current,
        [variables.invoiceKey]: getErrorMessage(error),
      }));
    },
  });

  useEffect(() => {
    if (!analyzeMutation.data) {
      return;
    }

    setMapping(analyzeMutation.data.suggestedMapping);
    setWizardStep(2);
    setIsWizardOpen(true);
  }, [analyzeMutation.data]);

  useEffect(() => {
    if (!mappedImportMutation.data) {
      return;
    }

    setInvoiceOverrides(buildInvoiceOverridesState(mappedImportMutation.data));
    const hasBlockingIssues =
      mappedImportMutation.data.summary.needsCompletion > 0 ||
      mappedImportMutation.data.summary.invalidInvoices > 0;
    setWizardStep(hasBlockingIssues ? 4 : 5);
    setIsWizardOpen(true);
  }, [mappedImportMutation.data]);

  useEffect(() => {
    if (!isWizardOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isWizardOpen]);

  function handleAnalyzeSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      return;
    }

    setMappedImportResult(undefined);
    setSingleInvoiceErrorByKey({});
    mappedImportMutation.reset();
    singleInvoiceMutation.reset();
    analyzeMutation.mutate(file);
  }

  function handleMappedImportSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submitMappedImport();
  }

  function submitMappedImport() {
    if (!file) {
      return;
    }

    mappedImportMutation.mutate({
      selectedFile: file,
      config: buildMappedConfig(
        mapping,
        defaults,
        deriveTaxRateFromAmounts,
        myCompanyRole,
        invoiceOverrides
      ),
    });
  }

  function submitSingleInvoice(
    invoice: KsefMappedImportInvoiceResponse,
    invoiceDraft: InvoiceOverrideState
  ) {
    const invoiceKey = invoiceOverrideKey(invoice.rowNumbers);

    setSingleInvoiceErrorByKey((current) => {
      const next = { ...current };
      delete next[invoiceKey];
      return next;
    });

    singleInvoiceMutation.mutate({
      invoice,
      invoiceDraft,
      invoiceKey,
    });
  }

  function handleFileChange(nextFile: File | null) {
    setFile(nextFile);
    setMapping({});
    setInvoiceOverrides({});
    setMappedImportResult(undefined);
    setSingleInvoiceErrorByKey({});
    analyzeMutation.reset();
    mappedImportMutation.reset();
    singleInvoiceMutation.reset();
    setWizardStep(1);
  }

  function resetWizard() {
    setFile(null);
    setMapping({});
    setDefaults(createDefaultSupplementState());
    setInvoiceOverrides({});
    setMappedImportResult(undefined);
    setSingleInvoiceErrorByKey({});
    setDeriveTaxRateFromAmounts(true);
    setMyCompanyRole("SELLER");
    setSelectedCompanyProfileId("");
    analyzeMutation.reset();
    mappedImportMutation.reset();
    singleInvoiceMutation.reset();
    setWizardStep(1);
  }

  function getMappedFieldForColumn(columnId: string) {
    const matchedEntry = Object.entries(mapping).find(
      ([, mappedColumnId]) => mappedColumnId === columnId
    );

    return (matchedEntry?.[0] as KsefExcelFlexibleFieldKey | undefined) ?? "";
  }

  function updateColumnMapping(
    columnId: string,
    fieldKey: "" | KsefExcelFlexibleFieldKey
  ) {
    setMapping((current) => {
      const next = { ...current };

      for (const [mappedFieldKey, mappedColumnId] of Object.entries(next)) {
        if (mappedColumnId === columnId) {
          delete next[mappedFieldKey as KsefExcelFlexibleFieldKey];
        }
      }

      if (!fieldKey) {
        return next;
      }

      next[fieldKey] = columnId;
      return next;
    });
  }

  function updateDefaultField<K extends keyof FlexibleDefaultsState>(
    key: K,
    value: FlexibleDefaultsState[K]
  ) {
    setDefaults((current) => ({
      ...current,
      [key]:
        key === "sellerNip" && typeof value === "string"
          ? (sanitizePossibleNip(value) as FlexibleDefaultsState[K])
          : value,
    }));
  }

  function updateInvoiceOverrideField<K extends keyof InvoiceOverrideState>(
    invoiceKey: string,
    field: K,
    value: InvoiceOverrideState[K]
  ) {
    setInvoiceOverrides((current) => {
      const invoice = current[invoiceKey];
      if (!invoice) {
        return current;
      }

      return {
        ...current,
        [invoiceKey]: {
          ...invoice,
          [field]:
            field === "buyerNip" && typeof value === "string"
              ? (sanitizePossibleNip(value) as InvoiceOverrideState[K])
              : value,
        },
      };
    });
  }

  function updateInvoiceOverrideItemField<
    K extends keyof InvoiceOverrideItemState
  >(invoiceKey: string, rowNumber: number, field: K, value: InvoiceOverrideItemState[K]) {
    setInvoiceOverrides((current) => {
      const invoice = current[invoiceKey];
      if (!invoice) {
        return current;
      }

      return {
        ...current,
        [invoiceKey]: {
          ...invoice,
          items: invoice.items.map((item) =>
            item.rowNumber === rowNumber
              ? {
                  ...item,
                  [field]: value,
                }
              : item
          ),
        },
      };
    });
  }

  function addInvoiceOverrideItem(invoiceKey: string) {
    setInvoiceOverrides((current) => {
      const invoice = current[invoiceKey];
      if (!invoice) {
        return current;
      }

      const nextRowNumber =
        invoice.items.reduce(
          (maxRowNumber, item) => Math.max(maxRowNumber, item.rowNumber),
          0
        ) + 1;

      return {
        ...current,
        [invoiceKey]: {
          ...invoice,
          items: [
            ...invoice.items,
            {
              rowNumber: nextRowNumber,
              name: "",
              description: "",
              productCode: "",
              unit: "",
              quantity: "",
              unitNetPrice: "",
              taxRate: "",
            },
          ],
        },
      };
    });
  }

  function applyCompanyProfile(profile: KsefCompanyProfile) {
    const normalizedPaymentMethod = PAYMENT_METHOD_OPTIONS.some(
      (option) => option.value === profile.paymentMethod
    )
      ? (profile.paymentMethod as KsefPaymentMethodValue)
      : "";

    setSelectedCompanyProfileId(profile.id);
    setDefaults((current) => ({
      ...current,
      sellerName: profile.companyName,
      sellerNip: profile.nip,
      sellerCountryCode: profile.countryCode,
      sellerAddressLine1: profile.addressLine1,
      sellerAddressLine2: profile.addressLine2 ?? "",
      sellerEmail: profile.email ?? "",
      sellerPhone: profile.phone ?? "",
      currency: profile.currency ?? current.currency,
      paymentMethod: normalizedPaymentMethod,
      paymentBankAccount: profile.bankAccount ?? "",
    }));
  }

  function clearMyCompanyDraft() {
    setSelectedCompanyProfileId("");
    setDefaults((current) => ({
      ...current,
      sellerName: "",
      sellerNip: "",
      sellerCountryCode: "PL",
      sellerAddressLine1: "",
      sellerAddressLine2: "",
      sellerEmail: "",
      sellerPhone: "",
      currency: "PLN",
      paymentMethod: "6",
      paymentBankAccount: "",
    }));
  }

  function handleCompanyProfileSelect(profileId: string) {
    setSelectedCompanyProfileId(profileId);

    if (!profileId) {
      return;
    }

    const selectedProfile = companyProfilesQuery.data?.profiles.find(
      (profile) => profile.id === profileId
    );
    if (!selectedProfile) {
      return;
    }

    applyCompanyProfile(selectedProfile);
  }

  function handleSaveMyCompanyProfile() {
    saveCompanyProfileMutation.mutate({
      id: selectedCompanyProfileId || undefined,
      companyName: defaults.sellerName,
      nip: defaults.sellerNip,
      countryCode: defaults.sellerCountryCode,
      addressLine1: defaults.sellerAddressLine1,
      addressLine2: optionalText(defaults.sellerAddressLine2),
      email: optionalText(defaults.sellerEmail),
      phone: optionalText(defaults.sellerPhone),
      currency: optionalText(defaults.currency),
      paymentMethod: defaults.paymentMethod || undefined,
      bankAccount: optionalText(defaults.paymentBankAccount),
    });
  }

  function handleDeleteMyCompanyProfile() {
    if (!selectedCompanyProfileId) {
      return;
    }

    deleteCompanyProfileMutation.mutate(selectedCompanyProfileId);
  }

  const analysis = analyzeMutation.data as AnalyzeKsefExcelResponse | undefined;
  const mappedImport = mappedImportResult as
    | KsefMappedImportResponse
    | undefined;
  const companyProfiles = companyProfilesQuery.data?.profiles ?? [];
  const importNeedsCompletion = Boolean(
    mappedImport &&
      (mappedImport.summary.needsCompletion > 0 ||
        mappedImport.summary.invalidInvoices > 0)
  );
  const importIsComplete = Boolean(
    mappedImport &&
      mappedImport.summary.generatedValid === mappedImport.summary.invoicesCount &&
      mappedImport.summary.needsCompletion === 0 &&
      mappedImport.summary.invalidInvoices === 0
  );
  const allInvoiceDraftsComplete = mappedImport
    ? mappedImport.invoices.every((invoice) => {
        const invoiceKey = invoiceOverrideKey(invoice.rowNumbers);
        return !getInvoiceDraftValidation(
          invoice,
          invoiceOverrides[invoiceKey],
          myCompanyRole,
          defaults.buyerIdentifierType
        ).hasRequiredMissing;
      })
    : false;
  const showInvoiceCompletionPanel = Boolean(
    mappedImport && wizardStep >= 4
  );
  const flexibleConfigReady = isFlexibleConfigReady(defaults, myCompanyRole);
  const canSubmitMappedImport =
    flexibleConfigReady && (!importNeedsCompletion || allInvoiceDraftsComplete);
  const mappedRequiredCount = REQUIRED_MAPPING_FIELDS.filter((field) =>
    Boolean(mapping[field.key])
  ).length;
  const mappedOptionalCount = OPTIONAL_MAPPING_FIELDS.filter((field) =>
    Boolean(mapping[field.key])
  ).length;
  const unmappedRequiredFields = REQUIRED_MAPPING_FIELDS.filter(
    (field) => field.required && !mapping[field.key]
  );
  const setupChecklist: string[] = [];

  if (analysis) {
    if (!mapping.invoiceNumber) {
      setupChecklist.push("Zmapuj kolumne z numerem faktury.");
    }
    if (!optionalText(defaults.sellerNip)) {
      setupChecklist.push("Uzupelnij NIP swojej firmy.");
    }
    if (!optionalText(defaults.sellerName)) {
      setupChecklist.push("Uzupelnij nazwe swojej firmy.");
    }
    if (!optionalText(defaults.sellerCountryCode)) {
      setupChecklist.push("Uzupelnij kod kraju swojej firmy.");
    }
    if (!optionalText(defaults.sellerAddressLine1)) {
      setupChecklist.push("Uzupelnij adres swojej firmy.");
    }
    if (!mapping.buyerName) {
      setupChecklist.push(
        "Kontrahenta i pozostale braki uzupelnisz pozniej osobno dla kazdej faktury."
      );
    }
    if (!mapping.itemName) {
      setupChecklist.push(
        "Nazwe lub opis pozycji uzupelnisz pozniej osobno dla kazdej pozycji."
      );
    }
  }

  function isStepAvailable(step: WizardStep) {
    if (step === 1) {
      return true;
    }

    if (step === 5) {
      return importIsComplete;
    }

    return Boolean(analysis);
  }

  function openWizard(targetStep?: WizardStep) {
    if (targetStep) {
      setWizardStep(targetStep === 5 && !importIsComplete ? 4 : targetStep);
    } else if (mappedImport) {
      setWizardStep(importIsComplete ? 5 : 4);
    } else if (analysis) {
      setWizardStep(Math.min(wizardStep, 4) as WizardStep);
    } else {
      setWizardStep(1);
    }

    setIsWizardOpen(true);
  }

  return (
    <section className="flex h-full flex-col rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">
            <Sparkles className="h-3.5 w-3.5" />
            Kreator importu Excel
          </div>
          <h2 className="mt-2.5 text-lg font-semibold text-slate-900">
            Import pliku do KSeF krok po kroku
          </h2>
          <p className="mt-1.5 text-[13px] leading-5 text-slate-500">
            Ten tryb prowadzi przez plik, mapowanie, pola wymagane i pola
            opcjonalne w duzym dialogu. Celem jest prostszy import bez
            przytlaczania iloscia danych.
          </p>
        </div>
        <div className="rounded-2xl border border-sky-200 bg-sky-50 px-3.5 py-2.5 text-[13px] text-sky-800">
          Najlepiej dziala dla eksportow z Optimy i podobnych arkuszy z sumami
          netto / VAT / brutto.
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-[13px] font-semibold text-slate-900">Stan kreatora</p>
          <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
            <div className="rounded-2xl bg-white px-3 py-2.5 text-[13px]">
              <p className="text-slate-500">Plik</p>
              <p className="mt-1 font-semibold text-slate-900">
                {file ? file.name : "Brak"}
              </p>
            </div>
            <div className="rounded-2xl bg-white px-3 py-2.5 text-[13px]">
              <p className="text-slate-500">Analiza</p>
              <p className="mt-1 font-semibold text-slate-900">
                {analysis ? `${analysis.columns.length} kolumn` : "Jeszcze nie"}
              </p>
            </div>
            <div className="rounded-2xl bg-white px-3 py-2.5 text-[13px]">
              <p className="text-slate-500">Wynik</p>
              <p className="mt-1 font-semibold text-slate-900">
                {mappedImport
                  ? `${mappedImport.summary.generatedValid} XML gotowych`
                  : "Brak"}
              </p>
            </div>
          </div>

          {setupChecklist.length > 0 && (
            <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3">
              <p className="text-[13px] font-semibold text-amber-900">
                Do domkniecia
              </p>
              <div className="mt-2 space-y-1.5 text-[13px] text-amber-800">
                {setupChecklist.slice(0, 4).map((item) => (
                  <p key={item}>{item}</p>
                ))}
                {setupChecklist.length > 4 && (
                  <p>+ {setupChecklist.length - 4} kolejne pola</p>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-4">
          <p className="text-[13px] font-semibold text-slate-900">Start</p>
          <p className="mt-1.5 text-[13px] leading-5 text-slate-500">
            Otworz duzy dialog i przejdz przez proces krok po kroku: plik,
            mapowanie, wymagane dane, opcjonalne dane i wynik.
          </p>

          <div className="mt-3 flex flex-wrap gap-2.5">
            <button
              type="button"
              onClick={() => openWizard()}
              className="inline-flex items-center gap-2 rounded-xl bg-sky-500 px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-sky-600"
            >
              <Sparkles className="h-4 w-4" />
              {analysis || mappedImport ? "Wroc do kreatora" : "Otworz kreator"}
            </button>
            <button
              type="button"
              onClick={resetWizard}
              disabled={!file && !analysis && !mappedImport}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-[13px] font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      {isWizardOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-0 sm:p-4">
          <div className="flex h-[100dvh] w-full max-w-6xl flex-col overflow-hidden rounded-none bg-white shadow-2xl sm:h-[96vh] sm:rounded-[2rem]">
            <div className="flex items-center gap-3 border-b border-slate-200 px-5 py-3">
              <div className="shrink-0">
                <p className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">
                  <Sparkles className="h-3.5 w-3.5" />
                  Kreator KSeF
                </p>
              </div>

              <div className="min-w-0 flex-1 overflow-x-auto">
                <div className="flex min-w-max items-center gap-1.5">
                  {WIZARD_STEPS.map((step) => {
                    const available = isStepAvailable(step.id);
                    const active = wizardStep === step.id;

                    return (
                      <button
                        key={step.id}
                        type="button"
                        disabled={!available}
                        onClick={() => setWizardStep(step.id)}
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold transition ${
                          active
                            ? "bg-sky-500 text-white"
                            : available
                            ? "bg-slate-100 text-slate-700 hover:bg-slate-200"
                            : "cursor-not-allowed bg-slate-100 text-slate-400"
                        }`}
                      >
                        <span
                          className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${
                            active
                              ? "bg-white/20 text-white"
                              : "bg-white text-slate-600"
                          }`}
                        >
                          {step.id}
                        </span>
                        {step.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsWizardOpen(false)}
                className="shrink-0 rounded-xl border border-slate-200 p-2.5 text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5">
              <div className={wizardStep === 1 ? "" : "hidden"}>
                <div className="grid gap-6 ">
                  <form className="space-y-3" onSubmit={handleAnalyzeSubmit}>
                    <div className="rounded-3xl border border-slate-200 bg-white p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-700">
                        Krok 0
                      </p>
                      <h4 className="mt-1.5 text-base font-semibold text-slate-900">
                        Ustal role i dane mojej firmy
                      </h4>
                      <p className="mt-1.5 text-[13px] leading-5 text-slate-500">
                        Najpierw wybierasz, czy Twoja firma jest na tej fakturze
                        sprzedawca czy nabywca. Dane firmy mozesz potem pobierac
                        z bazy podmiotow jednym kliknieciem.
                      </p>

                      <div className="mt-4 grid gap-2.5 lg:grid-cols-2">
                        {MY_COMPANY_ROLE_OPTIONS.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setMyCompanyRole(option.value)}
                            className={`rounded-3xl border p-3.5 text-left transition ${
                              myCompanyRole === option.value
                                ? "border-sky-300 bg-sky-50"
                                : "border-slate-200 bg-slate-50 hover:bg-slate-100"
                            }`}
                          >
                            <p className="text-[13px] font-semibold text-slate-900">
                              {option.label}
                            </p>
                            <p className="mt-1 text-[13px] leading-5 text-slate-500">
                              {option.helper}
                            </p>
                          </button>
                        ))}
                      </div>

                      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3.5">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
                          <label className="flex-1 space-y-1.5">
                            {fieldLabel("Uzyj danych z bazy")}
                            <select
                              className={fieldClassName()}
                              value={selectedCompanyProfileId}
                              onChange={(event) =>
                                handleCompanyProfileSelect(event.target.value)
                              }
                            >
                              <option value="">Wybierz zapisany podmiot</option>
                              {companyProfiles.map((profile) => (
                                <option key={profile.id} value={profile.id}>
                                  {profile.companyName} ({profile.nip})
                                </option>
                              ))}
                            </select>
                          </label>

                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={clearMyCompanyDraft}
                              className="rounded-xl border border-slate-200 px-3.5 py-2 text-[13px] font-semibold text-slate-700 transition hover:bg-white"
                            >
                              Nowy podmiot
                            </button>
                            <button
                              type="button"
                              onClick={handleSaveMyCompanyProfile}
                              disabled={saveCompanyProfileMutation.isPending}
                              className="inline-flex items-center gap-2 rounded-xl bg-sky-500 px-3.5 py-2 text-[13px] font-semibold text-white transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              <Save className="h-4 w-4" />
                              {saveCompanyProfileMutation.isPending
                                ? "Zapisywanie..."
                                : selectedCompanyProfileId
                                ? "Zapisz zmiany"
                                : "Zapisz do bazy"}
                            </button>
                            <button
                              type="button"
                              onClick={handleDeleteMyCompanyProfile}
                              disabled={
                                !selectedCompanyProfileId ||
                                deleteCompanyProfileMutation.isPending
                              }
                              className="rounded-xl border border-rose-200 px-3.5 py-2 text-[13px] font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              Usun
                            </button>
                          </div>
                        </div>

                        <div className="mt-3 grid gap-3 lg:grid-cols-2">
                          <label className="space-y-1.5">
                            {fieldLabel("Nazwa mojej firmy", true)}
                            <input
                              className={fieldClassName()}
                              value={defaults.sellerName}
                              onChange={(event) =>
                                updateDefaultField(
                                  "sellerName",
                                  event.target.value
                                )
                              }
                            />
                          </label>
                          <label className="space-y-1.5">
                            {fieldLabel("NIP mojej firmy", true)}
                            <input
                              className={fieldClassName()}
                              value={defaults.sellerNip}
                              onChange={(event) =>
                                updateDefaultField(
                                  "sellerNip",
                                  event.target.value
                                )
                              }
                            />
                          </label>
                          <label className="space-y-1.5">
                            {fieldLabel("Kod kraju mojej firmy", true)}
                            <input
                              className={fieldClassName()}
                              value={defaults.sellerCountryCode}
                              onChange={(event) =>
                                updateDefaultField(
                                  "sellerCountryCode",
                                  event.target.value.toUpperCase()
                                )
                              }
                              maxLength={2}
                            />
                          </label>
                          <label className="space-y-1.5 lg:col-span-2">
                            {fieldLabel("Adres mojej firmy", true)}
                            <input
                              className={fieldClassName()}
                              value={defaults.sellerAddressLine1}
                              onChange={(event) =>
                                updateDefaultField(
                                  "sellerAddressLine1",
                                  event.target.value
                                )
                              }
                            />
                          </label>
                          <label className="space-y-1.5 lg:col-span-2">
                            {fieldLabel("Adres mojej firmy linia 2")}
                            <input
                              className={fieldClassName()}
                              value={defaults.sellerAddressLine2}
                              onChange={(event) =>
                                updateDefaultField(
                                  "sellerAddressLine2",
                                  event.target.value
                                )
                              }
                            />
                          </label>
                          <label className="space-y-1.5">
                            {fieldLabel("Email mojej firmy")}
                            <input
                              className={fieldClassName()}
                              value={defaults.sellerEmail}
                              onChange={(event) =>
                                updateDefaultField(
                                  "sellerEmail",
                                  event.target.value
                                )
                              }
                            />
                          </label>
                          <label className="space-y-1.5">
                            {fieldLabel("Telefon mojej firmy")}
                            <input
                              className={fieldClassName()}
                              value={defaults.sellerPhone}
                              onChange={(event) =>
                                updateDefaultField(
                                  "sellerPhone",
                                  event.target.value
                                )
                              }
                            />
                          </label>
                          <label className="space-y-1.5">
                            {fieldLabel("Waluta")}
                            <input
                              className={fieldClassName()}
                              value={defaults.currency}
                              onChange={(event) =>
                                updateDefaultField(
                                  "currency",
                                  event.target.value.toUpperCase()
                                )
                              }
                              maxLength={3}
                            />
                          </label>
                          <label className="space-y-1.5">
                            {fieldLabel("Forma platnosci")}
                            <select
                              className={fieldClassName()}
                              value={defaults.paymentMethod}
                              onChange={(event) =>
                                updateDefaultField(
                                  "paymentMethod",
                                  event.target.value as
                                    | ""
                                    | KsefPaymentMethodValue
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
                          <label className="space-y-1.5 lg:col-span-2">
                            {fieldLabel("Rachunek bankowy")}
                            <input
                              className={fieldClassName()}
                              value={defaults.paymentBankAccount}
                              onChange={(event) =>
                                updateDefaultField(
                                  "paymentBankAccount",
                                  event.target.value
                                )
                              }
                            />
                          </label>
                        </div>

                        {(companyProfilesQuery.isError ||
                          saveCompanyProfileMutation.isError ||
                          deleteCompanyProfileMutation.isError) && (
                          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                            {companyProfilesQuery.isError && (
                              <p>
                                {getErrorMessage(companyProfilesQuery.error)}
                              </p>
                            )}
                            {saveCompanyProfileMutation.isError && (
                              <p>
                                {getErrorMessage(
                                  saveCompanyProfileMutation.error
                                )}
                              </p>
                            )}
                            {deleteCompanyProfileMutation.isError && (
                              <p>
                                {getErrorMessage(
                                  deleteCompanyProfileMutation.error
                                )}
                              </p>
                            )}
                          </div>
                        )}

                        {companyProfiles.length > 0 && (
                          <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600 shadow-sm">
                            <Database className="h-3.5 w-3.5" />
                            Zapisane podmioty: {companyProfiles.length}
                          </div>
                        )}
                      </div>
                    </div>

                    <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center transition hover:border-sky-300 hover:bg-sky-50">
                      <Upload className="h-8 w-8 text-slate-400" />
                      <div>
                        <p className="text-sm font-semibold text-slate-800">
                          Wgraj prawdziwy eksport Excel
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          Obslugiwane formaty: `xlsx`, `xls`, `csv`
                        </p>
                        {file && (
                          <p className="mt-3 text-sm font-medium text-sky-700">
                            {file.name}
                          </p>
                        )}
                      </div>
                      <input
                        type="file"
                        accept=".xlsx,.xls,.csv"
                        className="sr-only"
                        onChange={(event) =>
                          handleFileChange(event.target.files?.[0] ?? null)
                        }
                      />
                    </label>

                    <div className="flex flex-wrap gap-3">
                      <button
                        type="submit"
                        disabled={!file || analyzeMutation.isPending}
                        className="inline-flex items-center gap-2 rounded-2xl bg-sky-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {analyzeMutation.isPending ? (
                          <>
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                            Analiza...
                          </>
                        ) : (
                          <>
                            <FileSpreadsheet className="h-4 w-4" />
                            Przeanalizuj arkusz
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={resetWizard}
                        className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        Reset analizy
                      </button>
                    </div>

                    {analyzeMutation.isError && (
                      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                        <div className="flex items-center gap-2 font-semibold">
                          <TriangleAlert className="h-4 w-4" />
                          Blad analizy
                        </div>
                        <p className="mt-2 leading-6">
                          {getErrorMessage(analyzeMutation.error)}
                        </p>
                      </div>
                    )}
                  </form>
                </div>
              </div>

              <div
                className={
                  wizardStep >= 2 && wizardStep <= 4 ? "mt-8" : "hidden"
                }
              >
                {analysis && (
                  <form
                    id="ksef-flexible-wizard-form"
                    className="space-y-6"
                    onSubmit={handleMappedImportSubmit}
                  >
                    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            Analiza pliku: {analysis.fileName}
                          </p>
                          <p className="mt-1 text-sm text-slate-500">
                            Arkusz: {analysis.sheetName}
                          </p>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-3">
                          <div className="rounded-2xl bg-white px-4 py-3 text-sm">
                            <p className="text-slate-500">Wiersze</p>
                            <p className="mt-1 font-semibold text-slate-900">
                              {analysis.rowsCount}
                            </p>
                          </div>
                          <div className="rounded-2xl bg-white px-4 py-3 text-sm">
                            <p className="text-slate-500">Szacowane faktury</p>
                            <p className="mt-1 font-semibold text-slate-900">
                              {analysis.inferredInvoicesCount}
                            </p>
                          </div>
                          <div className="rounded-2xl bg-white px-4 py-3 text-sm">
                            <p className="text-slate-500">Kolumny</p>
                            <p className="mt-1 font-semibold text-slate-900">
                              {analysis.columns.length}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className={wizardStep === 2 ? "space-y-4" : "hidden"}>
                      <div className="rounded-3xl border border-slate-200 bg-white p-5">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div>
                            <h3 className="text-base font-semibold text-slate-900">
                              Mapowanie po kolumnach z Excela
                            </h3>
                            <p className="mt-1 text-sm text-slate-500">
                              Nad kazda kolumna wybierasz, do czego ma byc
                              przypisana. Sugestie sa juz podstawione i mozna je
                              zmienic.
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2 text-xs font-medium">
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
                              Wymagane: {mappedRequiredCount}/
                              {REQUIRED_MAPPING_FIELDS.filter(
                                (field) => field.required
                              ).length}
                            </span>
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
                              Opcjonalne: {mappedOptionalCount}
                            </span>
                          </div>
                        </div>

                        {unmappedRequiredFields.length > 0 && (
                          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                            <p className="text-sm font-semibold text-amber-900">
                              Jeszcze nie przypisano
                            </p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {unmappedRequiredFields.map((field) => (
                                <span
                                  key={field.key}
                                  className="rounded-full bg-white px-3 py-1 text-xs font-medium text-amber-800"
                                >
                                  {field.label}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                          {analysis.columns.map((column) => {
                            const selectedFieldKey =
                              getMappedFieldForColumn(column.id);
                            const selectedField = MAPPING_FIELD_OPTIONS.find(
                              (field) => field.key === selectedFieldKey
                            );

                            return (
                              <div
                                key={column.id}
                                className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                              >
                                <label className="space-y-1.5">
                                  {fieldLabel("Mapowanie")}
                                  <select
                                    className={fieldClassName()}
                                    value={selectedFieldKey}
                                    onChange={(event) =>
                                      updateColumnMapping(
                                        column.id,
                                        event.target.value as
                                          | ""
                                          | KsefExcelFlexibleFieldKey
                                      )
                                    }
                                  >
                                    <option value="">Nie mapuj</option>
                                    <optgroup label="Wymagane / najczestsze">
                                      {REQUIRED_MAPPING_FIELDS.map((field) => (
                                        <option key={field.key} value={field.key}>
                                          {field.label}
                                          {field.required ? " *" : ""}
                                        </option>
                                      ))}
                                    </optgroup>
                                    <optgroup label="Dodatkowe opcjonalne">
                                      {OPTIONAL_MAPPING_FIELDS.map((field) => (
                                        <option key={field.key} value={field.key}>
                                          {field.label}
                                        </option>
                                      ))}
                                    </optgroup>
                                  </select>
                                </label>

                                <div className="mt-4">
                                  <p className="text-sm font-semibold text-slate-900">
                                    {column.label}
                                  </p>
                                  <p className="mt-1 text-xs text-slate-400">
                                    {column.id}
                                  </p>
                                  {selectedField?.helper && (
                                    <p className="mt-3 text-xs leading-5 text-slate-500">
                                      {selectedField.helper}
                                    </p>
                                  )}
                                </div>

                                <div className="mt-4 space-y-2">
                                  {column.sampleValues.length > 0 ? (
                                    column.sampleValues.map(
                                      (sampleValue, index) => (
                                        <div
                                          key={`${column.id}-${index}`}
                                          className="rounded-xl bg-white px-3 py-2 text-xs text-slate-600"
                                        >
                                          {sampleValue}
                                        </div>
                                      )
                                    )
                                  ) : (
                                    <div className="rounded-xl bg-white px-3 py-2 text-xs text-slate-400">
                                      Brak probek
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    <div className={wizardStep === 3 ? "space-y-6" : "hidden"}>

                      <section
                        className={
                          wizardStep === 3
                            ? "rounded-3xl border border-slate-200 bg-white p-5"
                            : "hidden"
                        }
                      >
                        <div className="mb-5">
                          <h3 className="text-base font-semibold text-slate-900">
                            Dane wymagane
                          </h3>
                          <p className="mt-1 text-sm text-slate-500">
                            Tu ustawiasz dane swojej firmy i wspolne parametry.
                            Brakujace dane kontrahenta oraz pozycji uzupelnisz
                            pozniej osobno dla kazdej faktury.
                          </p>
                        </div>

                        <div className="space-y-4">
                          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <p className="text-sm font-semibold text-slate-800">
                              Typowe stale dane
                            </p>
                            <div className="mt-3 space-y-3">
                              {analysis.suggestedSupplementFields
                                .filter((field) =>
                                  [
                                    "sellerNip",
                                    "sellerName",
                                    "sellerAddressLine1",
                                    "sellerCountryCode",
                                    "buyerIdentifierType",
                                  ].includes(field.key)
                                )
                                .map((field) => (
                                  <div
                                    key={field.key}
                                    className="rounded-xl bg-white px-3 py-3 text-sm"
                                  >
                                    <p className="font-medium text-slate-900">
                                      {field.label}
                                    </p>
                                    <p className="mt-1 text-slate-500">
                                      {field.reason}
                                    </p>
                                  </div>
                                ))}
                            </div>
                          </div>

                          <div className="grid gap-4 lg:grid-cols-2">
                            <label className="space-y-1.5">
                              {fieldLabel("NIP mojej firmy", true)}
                              <input
                                className={fieldClassName()}
                                value={defaults.sellerNip}
                                onChange={(event) =>
                                  updateDefaultField(
                                    "sellerNip",
                                    event.target.value
                                  )
                                }
                              />
                            </label>
                            <label className="space-y-1.5">
                              {fieldLabel("Nazwa mojej firmy", true)}
                              <input
                                className={fieldClassName()}
                                value={defaults.sellerName}
                                onChange={(event) =>
                                  updateDefaultField(
                                    "sellerName",
                                    event.target.value
                                  )
                                }
                              />
                            </label>
                            <label className="space-y-1.5">
                              {fieldLabel("Kod kraju mojej firmy", true)}
                              <input
                                className={fieldClassName()}
                                value={defaults.sellerCountryCode}
                                onChange={(event) =>
                                  updateDefaultField(
                                    "sellerCountryCode",
                                    event.target.value.toUpperCase()
                                  )
                                }
                                maxLength={2}
                              />
                            </label>
                            <label className="space-y-1.5 lg:col-span-2">
                              {fieldLabel("Adres mojej firmy", true)}
                              <input
                                className={fieldClassName()}
                                value={defaults.sellerAddressLine1}
                                onChange={(event) =>
                                  updateDefaultField(
                                    "sellerAddressLine1",
                                    event.target.value
                                  )
                                }
                              />
                            </label>
                            <label
                              className={
                                wizardStep === 3
                                  ? "space-y-1.5 lg:col-span-2"
                                  : "hidden"
                              }
                            >
                              {fieldLabel("Adres mojej firmy linia 2")}
                              <input
                                className={fieldClassName()}
                                value={defaults.sellerAddressLine2}
                                onChange={(event) =>
                                  updateDefaultField(
                                    "sellerAddressLine2",
                                    event.target.value
                                  )
                                }
                              />
                            </label>
                            <label
                              className={
                                wizardStep === 3 ? "space-y-1.5" : "hidden"
                              }
                            >
                              {fieldLabel("Email mojej firmy")}
                              <input
                                className={fieldClassName()}
                                value={defaults.sellerEmail}
                                onChange={(event) =>
                                  updateDefaultField(
                                    "sellerEmail",
                                    event.target.value
                                  )
                                }
                              />
                            </label>
                            <label
                              className={
                                wizardStep === 3 ? "space-y-1.5" : "hidden"
                              }
                            >
                              {fieldLabel("Telefon mojej firmy")}
                              <input
                                className={fieldClassName()}
                                value={defaults.sellerPhone}
                                onChange={(event) =>
                                  updateDefaultField(
                                    "sellerPhone",
                                    event.target.value
                                  )
                                }
                              />
                            </label>
                            <label className="space-y-1.5">
                              {fieldLabel(
                                myCompanyRole === "SELLER"
                                  ? "Typ identyfikatora nabywcy"
                                  : "Typ identyfikatora mojej firmy"
                              )}
                              <select
                                className={fieldClassName()}
                                value={defaults.buyerIdentifierType}
                                onChange={(event) =>
                                  updateDefaultField(
                                    "buyerIdentifierType",
                                    event.target
                                      .value as KsefBuyerIdentifierType
                                  )
                                }
                              >
                                {BUYER_IDENTIFIER_OPTIONS.map((option) => (
                                  <option
                                    key={option.value}
                                    value={option.value}
                                  >
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label
                              className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-4 text-sm leading-6 text-sky-900 lg:col-span-2"
                            >
                              Po mapowaniu brakujace dane kontrahenta, dat i
                              pozycji uzupelnisz osobno dla kazdej faktury w
                              kroku `Wynik`.
                            </label>
                            <label
                              className={
                                wizardStep === 3 ? "space-y-1.5" : "hidden"
                              }
                            >
                              {fieldLabel("Waluta")}
                              <input
                                className={fieldClassName()}
                                value={defaults.currency}
                                onChange={(event) =>
                                  updateDefaultField(
                                    "currency",
                                    event.target.value.toUpperCase()
                                  )
                                }
                                maxLength={3}
                              />
                            </label>
                            <label
                              className={
                                wizardStep === 3 ? "space-y-1.5" : "hidden"
                              }
                            >
                              {fieldLabel("Miejsce wystawienia")}
                              <input
                                className={fieldClassName()}
                                value={defaults.placeOfIssue}
                                onChange={(event) =>
                                  updateDefaultField(
                                    "placeOfIssue",
                                    event.target.value
                                  )
                                }
                              />
                            </label>
                            <label
                              className={
                                wizardStep === 4 ? "space-y-1.5" : "hidden"
                              }
                            >
                              {fieldLabel("Forma platnosci")}
                              <select
                                className={fieldClassName()}
                                value={defaults.paymentMethod}
                                onChange={(event) =>
                                  updateDefaultField(
                                    "paymentMethod",
                                    event.target.value as
                                      | ""
                                      | KsefPaymentMethodValue
                                  )
                                }
                              >
                                <option value="">Brak</option>
                                {PAYMENT_METHOD_OPTIONS.map((option) => (
                                  <option
                                    key={option.value}
                                    value={option.value}
                                  >
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label
                              className={
                                wizardStep === 4 ? "space-y-1.5" : "hidden"
                              }
                            >
                              {fieldLabel("Rachunek bankowy")}
                              <input
                                className={fieldClassName()}
                                value={defaults.paymentBankAccount}
                                onChange={(event) =>
                                  updateDefaultField(
                                    "paymentBankAccount",
                                    event.target.value
                                  )
                                }
                              />
                            </label>
                            <label
                              className={
                                wizardStep === 3
                                  ? "space-y-1.5 lg:col-span-2"
                                  : "hidden"
                              }
                            >
                              {fieldLabel("SystemInfo")}
                              <input
                                className={fieldClassName()}
                                value={defaults.systemName}
                                onChange={(event) =>
                                  updateDefaultField(
                                    "systemName",
                                    event.target.value
                                  )
                                }
                              />
                            </label>
                          </div>

                        </div>
                      </section>
                    </div>

                    <div className="hidden">
                      <button
                        type="submit"
                        disabled={
                          mappedImportMutation.isPending || !canSubmitMappedImport
                        }
                        className="inline-flex items-center gap-2 rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {mappedImportMutation.isPending ? (
                          <>
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                            Budowanie draftow...
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-4 w-4" />
                            Generuj drafty KSeF z mapowaniem
                          </>
                        )}
                      </button>
                    </div>

                    {!canSubmitMappedImport && wizardStep >= 3 && (
                      <p className="text-xs leading-5 text-slate-500">
                        {flexibleConfigReady
                          ? "Uzupelnij wszystkie wymagane pola zaznaczone na czerwono. Dopiero wtedy generator odblokuje XML."
                          : "Uzupelnij pola oznaczone `*` albo zmapuj odpowiadajace im kolumny. Bez tego generator nie utworzy XML."}
                      </p>
                    )}

                    {mappedImportMutation.isError && wizardStep === 4 && (
                      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                        <div className="flex items-center gap-2 font-semibold">
                          <TriangleAlert className="h-4 w-4" />
                          Blad generowania draftow
                        </div>
                        <p className="mt-2 leading-6">
                          {getErrorMessage(mappedImportMutation.error)}
                        </p>
                      </div>
                    )}
                  </form>
                )}

                <div className={showInvoiceCompletionPanel ? "mt-8" : "hidden"}>
                  {mappedImport && (
                    <div className="space-y-5">
                      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">
                              Wynik mapowanego importu: {mappedImport.fileName}
                            </p>
                            <p className="mt-1 text-sm text-slate-500">
                              Arkusz: {mappedImport.sheetName}
                            </p>
                          </div>
                          <div className="grid gap-2 sm:grid-cols-4">
                            <div className="rounded-2xl bg-white px-4 py-3 text-sm">
                              <p className="text-slate-500">Wiersze</p>
                              <p className="mt-1 font-semibold text-slate-900">
                                {mappedImport.summary.rowsCount}
                              </p>
                            </div>
                            <div className="rounded-2xl bg-white px-4 py-3 text-sm">
                              <p className="text-slate-500">Drafty</p>
                              <p className="mt-1 font-semibold text-slate-900">
                                {mappedImport.summary.invoicesCount}
                              </p>
                            </div>
                            <div className="rounded-2xl bg-white px-4 py-3 text-sm">
                              <p className="text-slate-500">XML gotowe</p>
                              <p className="mt-1 font-semibold text-emerald-700">
                                {mappedImport.summary.generatedValid}
                              </p>
                            </div>
                            <div className="rounded-2xl bg-white px-4 py-3 text-sm">
                              <p className="text-slate-500">Braki / bledy</p>
                              <p className="mt-1 font-semibold text-amber-700">
                                {mappedImport.summary.needsCompletion +
                                  mappedImport.summary.invalidInvoices}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div
                          className={`mt-4 rounded-2xl border p-4 text-sm ${
                            mappedImport.summary.generatedValid > 0
                              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                              : "border-amber-200 bg-amber-50 text-amber-800"
                          }`}
                        >
                          <p className="font-semibold">
                            {mappedImport.summary.generatedValid > 0
                              ? "XML sa juz wygenerowane."
                              : "Import jest jeszcze niekompletny."}
                          </p>
                          <p className="mt-1">
                            {mappedImport.summary.generatedValid > 0
                              ? "Kliknij \"Pobierz wszystkie XML\" albo pobieraj pojedyncze pliki z listy nizej. Jesli zmienisz ustawienia, mozesz wygenerowac XML ponownie."
                              : "Nie przejdziesz do kroku Wynik, dopoki wszystkie faktury nie beda kompletne. Uzupelnij braki nizej i kliknij \"Generuj XML\"."}
                          </p>
                        </div>

                        {mappedImport.globalErrors.length > 0 && (
                          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                            {mappedImport.globalErrors.map((error) => (
                              <p key={error}>{error}</p>
                            ))}
                          </div>
                        )}

                        <div className="mt-4 flex flex-wrap gap-3">
                          <button
                            type="button"
                            onClick={() => downloadAllXml(mappedImport.invoices)}
                            disabled={mappedImport.summary.generatedValid === 0}
                            className="inline-flex items-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <Download className="h-4 w-4" />
                            Pobierz wszystkie XML
                          </button>
                          <p className="self-center text-sm text-slate-500">
                            {mappedImport.summary.generatedValid > 0
                              ? "XML sa juz gotowe. Pobieranie nie startuje automatycznie po generacji."
                              : "Przycisk pobierania odblokuje sie, gdy wygenerujesz co najmniej jeden XML."}
                          </p>
                        </div>

                        {mappedImport.completionSummary.length > 0 && (
                          <div className="mt-4">
                            <p className="text-sm font-semibold text-slate-900">
                              Najczestsze braki do uzupelnienia
                            </p>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {mappedImport.completionSummary.map((item) => (
                                <span
                                  key={`${item.key}-${item.count}`}
                                  className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700 shadow-sm"
                                >
                                  {item.label}: {item.count}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="space-y-4">
                        {mappedImport.invoices.map((invoice) => {
                          const invoiceKey = invoiceOverrideKey(
                            invoice.rowNumbers
                          );
                          const invoiceDraft = invoiceOverrides[invoiceKey];
                          const validation = getInvoiceDraftValidation(
                            invoice,
                            invoiceDraft,
                            myCompanyRole,
                            defaults.buyerIdentifierType
                          );
                          const liveMissingLabels = getLiveMissingFieldLabels(
                            validation,
                            myCompanyRole,
                            defaults.buyerIdentifierType
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
                                !error.startsWith(
                                  "Brakuje danych potrzebnych do wygenerowania XML:"
                                )
                            ),
                          ];
                          const counterpartyNameLabel =
                            myCompanyRole === "SELLER"
                              ? "Nazwa nabywcy"
                              : "Nazwa sprzedawcy";
                          const counterpartyNipLabel =
                            myCompanyRole === "SELLER"
                              ? "NIP nabywcy"
                              : "NIP sprzedawcy";
                          const counterpartyAddressLabel =
                            myCompanyRole === "SELLER"
                              ? "Adres nabywcy"
                              : "Adres sprzedawcy";
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

                          return (
                          <div
                            key={`${
                              invoice.invoiceNumber
                            }-${invoice.rowNumbers.join("-")}`}
                            className={`rounded-3xl border bg-white p-4 shadow-sm ${
                              validation.hasRequiredMissing
                                ? "border-rose-200"
                                : "border-slate-200"
                            }`}
                          >
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                              <div>
                                <div className="flex flex-wrap items-center gap-3">
                                  <p className="text-sm font-semibold text-slate-900">
                                    {invoice.invoiceNumber}
                                  </p>
                                  <StatusBadge status={invoice.status} />
                                </div>
                                <p className="mt-1 text-xs text-slate-500">
                                  Wiersze arkusza:{" "}
                                  {invoice.rowNumbers.join(", ")}
                                </p>
                              </div>
                              <div className="flex flex-wrap gap-3">
                                {invoiceDraft && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      submitSingleInvoice(invoice, invoiceDraft)
                                    }
                                    disabled={
                                      validation.hasRequiredMissing ||
                                      (singleInvoiceMutation.isPending &&
                                        singleInvoiceMutation.variables
                                          ?.invoiceKey === invoiceKey)
                                    }
                                    className="inline-flex items-center gap-2 whitespace-nowrap rounded-xl bg-sky-500 px-3.5 py-2 text-[13px] font-semibold text-white transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    {singleInvoiceMutation.isPending &&
                                    singleInvoiceMutation.variables?.invoiceKey ===
                                      invoiceKey ? (
                                      <>
                                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                                        Generowanie...
                                      </>
                                    ) : (
                                      <>
                                        <Sparkles className="h-4 w-4" />
                                        {invoice.xml
                                          ? "Wygeneruj te fakture ponownie"
                                          : "Generuj te fakture"}
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
                              </div>
                            </div>

                            <div className="mt-4 grid gap-3 md:grid-cols-3">
                              <div className="rounded-2xl bg-slate-50 px-3 py-2.5 text-[13px]">
                                <p className="text-slate-500">Wiersz arkusza</p>
                                <p className="mt-1 font-semibold text-slate-900">
                                  {invoice.rowNumbers.join(", ")}
                                </p>
                              </div>
                              <div className="rounded-2xl bg-slate-50 px-3 py-2.5 text-[13px]">
                                <p className="text-slate-500">
                                  Netto / VAT / Brutto
                                </p>
                                <p className="mt-1 font-semibold text-slate-900">
                                  {(invoice.summary?.netTotal ??
                                    invoice.preview.netTotal ??
                                    0
                                  ).toFixed(2)} /{" "}
                                  {(invoice.summary?.taxTotal ??
                                    invoice.preview.vatTotal ??
                                    0
                                  ).toFixed(2)} /{" "}
                                  {(invoice.summary?.grossTotal ??
                                    invoice.preview.grossTotal ??
                                    0
                                  ).toFixed(2)}
                                </p>
                              </div>
                              <div className="rounded-2xl bg-slate-50 px-3 py-2.5 text-[13px]">
                                <p className="text-slate-500">Status formularza</p>
                                <p className="mt-1 font-semibold text-slate-900">
                                  {validation.hasRequiredMissing
                                    ? "Brakuja pola wymagane"
                                    : "Gotowe do XML"}
                                </p>
                              </div>
                            </div>

                            {invoiceDraft && (
                              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3.5">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                  <div>
                                    <p className="text-[13px] font-semibold text-slate-900">
                                      Uzupelnij dane tej faktury
                                    </p>
                                    <p className="mt-1 text-xs text-slate-500">
                                      Wszystkie pola mozesz od razu poprawic.
                                      Czerwone sa wymagane i puste, zolte sa
                                      opcjonalne i jeszcze niewypelnione.
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
                                      className={editorFieldClassName(
                                        validation.invoiceNumber
                                      )}
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
                                      className={editorFieldClassName(
                                        validation.issueDate
                                      )}
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
                                      className={editorFieldClassName(
                                        validation.buyerName
                                      )}
                                      value={invoiceDraft.buyerName}
                                      onChange={(event) =>
                                        updateInvoiceOverrideField(
                                          invoiceKey,
                                          "buyerName",
                                          event.target.value
                                        )
                                      }
                                    />
                                  </label>
                                  <label className="space-y-1.5">
                                    {fieldLabel(
                                      counterpartyNipLabel,
                                      defaults.buyerIdentifierType === "NIP"
                                    )}
                                    <input
                                      className={editorFieldClassName(
                                        validation.buyerNip
                                      )}
                                      value={invoiceDraft.buyerNip}
                                      onChange={(event) =>
                                        updateInvoiceOverrideField(
                                          invoiceKey,
                                          "buyerNip",
                                          event.target.value
                                        )
                                      }
                                    />
                                  </label>
                                  <label className="space-y-1.5 md:col-span-2">
                                    {fieldLabel(
                                      counterpartyAddressLabel,
                                      myCompanyRole === "BUYER"
                                    )}
                                    <input
                                      className={editorFieldClassName(
                                        validation.buyerAddressLine1,
                                        !hasTextValue(
                                          invoiceDraft.buyerAddressLine1
                                        ) && !validation.buyerAddressLine1
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
                                        !hasTextValue(
                                          invoiceDraft.buyerAddressLine2
                                        )
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
                                        !hasTextValue(
                                          invoiceDraft.buyerCountryCode
                                        )
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
                                      className={editorFieldClassName(
                                        false,
                                        !hasTextValue(invoiceDraft.currency)
                                      )}
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
                                    {fieldLabel(
                                      "Podstawa zwolnienia z VAT",
                                      requiresExemptionReason
                                    )}
                                    <textarea
                                      className={editorFieldClassName(
                                        validation.exemptionReason
                                      )}
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
                                        !hasTextValue(
                                          invoiceDraft.paymentDueDate
                                        )
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
                                        !hasTextValue(
                                          invoiceDraft.paymentMethod
                                        )
                                      )}
                                      value={invoiceDraft.paymentMethod}
                                      onChange={(event) =>
                                        updateInvoiceOverrideField(
                                          invoiceKey,
                                          "paymentMethod",
                                          event.target.value as
                                            | ""
                                            | KsefPaymentMethodValue
                                        )
                                      }
                                    >
                                      <option value="">Brak</option>
                                      {PAYMENT_METHOD_OPTIONS.map((option) => (
                                        <option
                                          key={option.value}
                                          value={option.value}
                                        >
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
                                        !hasTextValue(
                                          invoiceDraft.paymentBankAccount
                                        )
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

                                <div className="mt-4 space-y-3">
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                      <p className="text-[13px] font-semibold text-slate-900">
                                        Pozycje tej faktury
                                      </p>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          addInvoiceOverrideItem(invoiceKey)
                                        }
                                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] font-semibold text-slate-700 transition hover:bg-slate-50"
                                      >
                                        <Plus className="h-3.5 w-3.5" />
                                        Dodaj pozycje
                                      </button>
                                    </div>
                                    {invoiceDraft.items.map((item, index) => (
                                      (() => {
                                        const itemValidation =
                                          validation.items.find(
                                            (entry) =>
                                              entry.rowNumber === item.rowNumber
                                          );
                                        const isManualItem = !invoice.rowNumbers.includes(
                                          item.rowNumber
                                        );

                                        return (
                                          <div
                                            key={`${invoiceKey}-editor-${item.rowNumber}`}
                                            className={`rounded-2xl border bg-white p-3.5 ${
                                              itemValidation &&
                                              (itemValidation.name ||
                                                itemValidation.unit ||
                                                itemValidation.quantity ||
                                                itemValidation.unitNetPrice ||
                                                itemValidation.taxRate)
                                                ? "border-rose-200"
                                                : "border-slate-200"
                                            }`}
                                          >
                                            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                                              <p className="text-[13px] font-semibold text-slate-900">
                                                Pozycja {index + 1}
                                              </p>
                                              <div className="flex flex-wrap gap-2">
                                                <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                                                  {isManualItem
                                                    ? `Recznie ${item.rowNumber}`
                                                    : `Wiersz ${item.rowNumber}`}
                                                </span>
                                              </div>
                                            </div>
                                            <div className="grid gap-3 md:grid-cols-2">
                                              <label className="space-y-1.5 md:col-span-2">
                                                {fieldLabel(
                                                  "Nazwa pozycji",
                                                  true
                                                )}
                                                <input
                                                  className={editorFieldClassName(
                                                    itemValidation?.name ??
                                                      false
                                                  )}
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
                                                  className={editorFieldClassName(
                                                    false,
                                                    !hasTextValue(
                                                      item.description
                                                    )
                                                  )}
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
                                                {fieldLabel(
                                                  "Jednostka",
                                                  true
                                                )}
                                                <input
                                                  className={editorFieldClassName(
                                                    itemValidation?.unit ??
                                                      false
                                                  )}
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
                                                  className={editorFieldClassName(
                                                    itemValidation?.quantity ??
                                                      false
                                                  )}
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
                                                {fieldLabel(
                                                  "Cena netto",
                                                  true
                                                )}
                                                <input
                                                  type="number"
                                                  min="0"
                                                  step="0.0001"
                                                  className={editorFieldClassName(
                                                    itemValidation?.unitNetPrice ??
                                                      false
                                                  )}
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
                                                {fieldLabel(
                                                  "Stawka VAT",
                                                  !canDeriveTaxRate
                                                )}
                                                <select
                                                  className={editorFieldClassName(
                                                    itemValidation?.taxRate ??
                                                      false
                                                  )}
                                                  value={item.taxRate}
                                                  onChange={(event) =>
                                                    updateInvoiceOverrideItemField(
                                                      invoiceKey,
                                                      item.rowNumber,
                                                      "taxRate",
                                                      event.target.value as
                                                        | ""
                                                        | KsefTaxRateValue
                                                    )
                                                  }
                                                >
                                                  <option value="">Brak</option>
                                                  {TAX_RATE_OPTIONS.map(
                                                    (option) => (
                                                      <option
                                                        key={option.value}
                                                        value={option.value}
                                                      >
                                                        {option.label}
                                                      </option>
                                                    )
                                                  )}
                                                </select>
                                              </label>
                                              <label className="space-y-1.5 md:col-span-2">
                                                {fieldLabel("Kod pozycji")}
                                                <input
                                                  className={editorFieldClassName(
                                                    false,
                                                    !hasTextValue(
                                                      item.productCode
                                                    )
                                                  )}
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
                                      })()
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
                                    <p
                                      key={`${invoice.invoiceNumber}-${error}`}
                                    >
                                      {error}
                                    </p>
                                  ))}
                                </div>
                              </div>
                            )}

                            {singleInvoiceErrorByKey[invoiceKey] && (
                              <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                                <div className="flex items-center gap-2 font-semibold">
                                  <TriangleAlert className="h-4 w-4" />
                                  Nie udalo sie wygenerowac tej faktury
                                </div>
                                <p className="mt-2 leading-6">
                                  {singleInvoiceErrorByKey[invoiceKey]}
                                </p>
                              </div>
                            )}

                            {invoice.valid && invoice.summary && (
                              <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                                <div className="flex items-center gap-2 font-semibold">
                                  <CircleCheckBig className="h-4 w-4" />
                                  XML przeszedl walidacje XSD
                                </div>
                                <p className="mt-2">
                                  {invoice.summary.netTotal.toFixed(2)}{" "}
                                  {invoice.summary.currency} netto, VAT{" "}
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
                                <p className="mt-2 text-xs text-slate-400">
                                  {invoice.fileName}
                                </p>
                                <textarea
                                  readOnly
                                  value={invoice.xml}
                                  className="mt-3 h-[280px] w-full rounded-2xl border border-slate-800 bg-slate-900 p-4 font-mono text-xs leading-6 text-slate-100 outline-none"
                                />
                              </details>
                            )}
                          </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="border-t border-slate-200 px-6 py-3">
              <div className="flex items-center justify-between gap-3">
                <p className="min-w-0 flex-1 text-xs leading-5 text-slate-500">
                  {wizardStep === 1 &&
                    "Najpierw wybierz plik i uruchom analize."}
                  {wizardStep === 2 &&
                    "Sprawdz wykryte kolumny i popraw mapowanie."}
                  {wizardStep === 3 &&
                    "Uzupelnij dane swojej firmy i ustawienia wspolne."}
                  {wizardStep === 4 &&
                    (importNeedsCompletion
                      ? "Uzupelnij brakujace dane w konkretnych fakturach. Wszystko edytujesz bezposrednio w inputach, a krok Wynik odblokuje sie dopiero po kompletnym imporcie."
                      : "Sprawdz i popraw dane w konkretnych fakturach albo od razu generuj XML.")}
                  {wizardStep === 5 &&
                    "Tutaj masz juz gotowe XML i mozesz je pobrac."}
                </p>

                <div className="flex flex-nowrap items-center justify-end gap-2 overflow-x-auto">
                  {wizardStep > 1 && wizardStep < 5 && (
                    <button
                      type="button"
                      onClick={() =>
                        setWizardStep((wizardStep - 1) as WizardStep)
                      }
                      className="whitespace-nowrap rounded-xl border border-slate-200 px-3.5 py-2 text-[13px] font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      Wstecz
                    </button>
                  )}

                  {wizardStep === 1 && analysis && (
                    <button
                      type="button"
                      onClick={() => setWizardStep(2)}
                      className="whitespace-nowrap rounded-xl bg-sky-500 px-3.5 py-2 text-[13px] font-semibold text-white transition hover:bg-sky-600"
                    >
                      Dalej
                    </button>
                  )}

                  {wizardStep === 2 && (
                    <button
                      type="button"
                      onClick={() => setWizardStep(3)}
                      className="whitespace-nowrap rounded-xl bg-sky-500 px-3.5 py-2 text-[13px] font-semibold text-white transition hover:bg-sky-600"
                    >
                      Dalej
                    </button>
                  )}

                  {wizardStep === 3 && (
                    <button
                      type="button"
                      onClick={() => setWizardStep(4)}
                      className="whitespace-nowrap rounded-xl bg-sky-500 px-3.5 py-2 text-[13px] font-semibold text-white transition hover:bg-sky-600"
                    >
                      Dalej
                    </button>
                  )}

                  {wizardStep === 4 && (
                    <button
                      type="submit"
                      disabled={
                        mappedImportMutation.isPending || !canSubmitMappedImport
                      }
                      form="ksef-flexible-wizard-form"
                      className="inline-flex items-center gap-2 whitespace-nowrap rounded-xl bg-emerald-500 px-3.5 py-2 text-[13px] font-semibold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {mappedImportMutation.isPending ? (
                        <>
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                          Generowanie...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4" />
                          {importNeedsCompletion
                            ? "Generuj XML"
                            : "Zbuduj drafty i XML"}
                        </>
                      )}
                    </button>
                  )}

                  {wizardStep === 5 && (
                    <button
                      type="button"
                      onClick={submitMappedImport}
                      disabled={
                        mappedImportMutation.isPending || !canSubmitMappedImport
                      }
                      className="inline-flex items-center gap-2 whitespace-nowrap rounded-xl bg-emerald-500 px-3.5 py-2 text-[13px] font-semibold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {mappedImportMutation.isPending ? (
                        <>
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                          Generowanie...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4" />
                          {(mappedImport?.summary.generatedValid ?? 0) > 0
                            ? "Wygeneruj ponownie XML"
                            : "Generuj XML"}
                        </>
                      )}
                    </button>
                  )}

                  {wizardStep === 5 && (
                    <button
                      type="button"
                      onClick={() => setWizardStep(4)}
                      className="whitespace-nowrap rounded-xl border border-slate-200 px-3.5 py-2 text-[13px] font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      Wroc do ustawien
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setIsWizardOpen(false)}
                    className="whitespace-nowrap rounded-xl border border-slate-200 px-3.5 py-2 text-[13px] font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Zamknij
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
