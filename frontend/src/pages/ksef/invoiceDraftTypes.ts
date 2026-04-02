import type {
  KsefPaymentMethodValue,
  KsefTaxRateValue,
} from "../../api/backend";

export type InvoiceOverrideItemState = {
  rowNumber: number;
  name: string;
  description: string;
  productCode: string;
  unit: string;
  quantity: string;
  unitNetPrice: string;
  taxRate: "" | KsefTaxRateValue;
};

export type InvoiceOverrideState = {
  rowNumbers: number[];
  ignoredRowNumbers: number[];
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

export type InvoiceOverridesState = Record<string, InvoiceOverrideState>;

export type CopiedInvoiceItemsState = {
  sourceInvoiceKey: string;
  sourceInvoiceNumber: string;
  items: Array<Omit<InvoiceOverrideItemState, "rowNumber">>;
};
