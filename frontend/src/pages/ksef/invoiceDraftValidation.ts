import type {
  KsefBuyerIdentifierType,
  KsefMappedImportInvoiceResponse,
  KsefMyCompanyRole,
} from "../../api/backend";
import type { InvoiceOverrideState } from "./invoiceDraftTypes";

export function hasTextValue(value: string) {
  return value.trim().length > 0;
}

export function hasPositiveNumberValue(value: string) {
  if (!value.trim()) {
    return false;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0;
}

export function hasNonNegativeNumberValue(value: string) {
  if (!value.trim()) {
    return false;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0;
}

export function getInvoiceDraftValidation(
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

export function getLiveMissingFieldLabels(
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
