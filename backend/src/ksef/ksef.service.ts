import { BadRequestException, Injectable } from "@nestjs/common";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { validateXML } from "xmllint-wasm";
import * as XLSX from "xlsx";
import {
  GenerateKsefXmlDto,
  KSEF_BUYER_IDENTIFIER_TYPES,
  KSEF_PAYMENT_METHOD_VALUES,
  KSEF_TAX_RATE_VALUES,
  type KsefAddressDto,
  type KsefInvoiceItemDto,
  type KsefTaxRateValue
} from "./dto/generate-ksef-xml.dto";
import { createNode, renderXmlDocument, type XmlNode } from "./xml-builder";

type SchemaValidationError = {
  message: string;
  lineNumber: number | null;
};

type TaxSummary = {
  taxRate: KsefTaxRateValue;
  net: number;
  tax: number;
  gross: number;
};

type GeneratedItem = KsefInvoiceItemDto & {
  lineNumber: number;
  quantityFormatted: string;
  unitNetPriceFormatted: string;
  netValue: number;
  taxValue: number;
  grossValue: number;
  netValueFormatted: string;
};

type GenerateKsefXmlResponse = {
  valid: boolean;
  xml: string | null;
  fileName: string | null;
  schema: {
    code: "FA(3)";
    version: "1-0E";
  };
  businessErrors: string[];
  schemaErrors: SchemaValidationError[];
  warnings: string[];
  summary: {
    issueDate: string;
    currency: string;
    lineCount: number;
    netTotal: number;
    taxTotal: number;
    grossTotal: number;
    taxBreakdown: TaxSummary[];
  } | null;
};

type KsefImportedSpreadsheetFile = {
  buffer?: Buffer;
  path?: string;
  mimetype: string;
  size: number;
  originalname: string;
};

type KsefExcelImportInvoiceResult = GenerateKsefXmlResponse & {
  invoiceNumber: string;
  rowNumbers: number[];
};

type KsefExcelImportResponse = {
  imported: boolean;
  fileName: string;
  sheetName: string;
  templateColumns: string[];
  summary: {
    rowsCount: number;
    invoicesCount: number;
    validInvoices: number;
    invalidInvoices: number;
  };
  globalErrors: string[];
  invoices: KsefExcelImportInvoiceResult[];
};

type KsefNormalizedExcelRow = {
  rowNumber: number;
  values: Record<string, string>;
};

type KsefParsedSpreadsheetColumn = {
  id: string;
  label: string;
  index: number;
  sampleValues: string[];
};

type KsefParsedSpreadsheet = {
  sheetName: string;
  columns: KsefParsedSpreadsheetColumn[];
  rows: KsefNormalizedExcelRow[];
};

type KsefExcelFlexibleFieldKey =
  | "invoiceNumber"
  | "issueDate"
  | "saleDate"
  | "buyerName"
  | "buyerNip"
  | "buyerAddressLine1"
  | "buyerAddressLine2"
  | "buyerCountryCode"
  | "currency"
  | "exemptionReason"
  | "itemName"
  | "itemDescription"
  | "itemProductCode"
  | "itemUnit"
  | "itemQuantity"
  | "itemUnitNetPrice"
  | "itemTaxRate"
  | "netTotal"
  | "vatTotal"
  | "grossTotal"
  | "paymentDueDate"
  | "paymentMethod"
  | "paymentBankAccount";

type KsefMyCompanyRole = "SELLER" | "BUYER";

type KsefExcelSupplementFieldKey =
  | "sellerNip"
  | "sellerName"
  | "sellerCountryCode"
  | "sellerAddressLine1"
  | "sellerAddressLine2"
  | "sellerEmail"
  | "sellerPhone"
  | "buyerIdentifierType"
  | "defaultBuyerName"
  | "defaultBuyerNip"
  | "defaultBuyerAddressLine1"
  | "defaultBuyerAddressLine2"
  | "defaultBuyerCountryCode"
  | "defaultIssueDate"
  | "defaultSaleDate"
  | "currency"
  | "placeOfIssue"
  | "systemName"
  | "paymentMethod"
  | "paymentBankAccount"
  | "defaultItemName"
  | "defaultItemDescription"
  | "defaultItemUnit"
  | "defaultItemQuantity"
  | "defaultTaxRate";

type KsefExcelFieldSource = "excel" | "default" | "derived" | "manual";

type KsefExcelFieldDescriptor = {
  key: KsefExcelFlexibleFieldKey;
  label: string;
  requiredForDraft?: boolean;
};

type KsefExcelAnalyzeResponse = {
  analyzed: boolean;
  fileName: string;
  sheetName: string;
  rowsCount: number;
  inferredInvoicesCount: number;
  columns: Array<{
    id: string;
    label: string;
    sampleValues: string[];
  }>;
  previewRows: Array<{
    rowNumber: number;
    values: Record<string, string>;
  }>;
  suggestedMapping: Partial<Record<KsefExcelFlexibleFieldKey, string>>;
  suggestedSupplementFields: Array<{
    key: KsefExcelSupplementFieldKey;
    label: string;
    reason: string;
  }>;
};

type KsefExcelMappedImportConfig = {
  mapping?: Partial<Record<KsefExcelFlexibleFieldKey, string>>;
  context?: {
    myCompanyRole?: unknown;
  };
  defaults?: {
    sellerNip?: unknown;
    sellerName?: unknown;
    sellerCountryCode?: unknown;
    sellerAddressLine1?: unknown;
    sellerAddressLine2?: unknown;
    sellerEmail?: unknown;
    sellerPhone?: unknown;
    buyerIdentifierType?: unknown;
    defaultBuyerName?: unknown;
    defaultBuyerNip?: unknown;
    defaultBuyerAddressLine1?: unknown;
    defaultBuyerAddressLine2?: unknown;
    defaultBuyerCountryCode?: unknown;
    defaultIssueDate?: unknown;
    defaultSaleDate?: unknown;
    currency?: unknown;
    placeOfIssue?: unknown;
    systemName?: unknown;
    paymentMethod?: unknown;
    paymentBankAccount?: unknown;
    defaultItemName?: unknown;
    defaultItemDescription?: unknown;
    defaultItemUnit?: unknown;
    defaultItemQuantity?: unknown;
    defaultTaxRate?: unknown;
    splitPayment?: unknown;
    cashAccounting?: unknown;
    selfBilling?: unknown;
    simplifiedProcedure?: unknown;
    relatedEntities?: unknown;
    annex15?: unknown;
  };
  options?: {
    deriveTaxRateFromAmounts?: unknown;
  };
  overrides?: {
    invoices?: unknown;
  };
};

type KsefExcelMappedInvoiceItemOverrideInput = {
  rowNumber?: unknown;
  name?: unknown;
  description?: unknown;
  productCode?: unknown;
  unit?: unknown;
  quantity?: unknown;
  unitNetPrice?: unknown;
  taxRate?: unknown;
};

type KsefExcelMappedInvoiceOverrideInput = {
  rowNumbers?: unknown;
  invoiceNumber?: unknown;
  issueDate?: unknown;
  saleDate?: unknown;
  buyerName?: unknown;
  buyerNip?: unknown;
  buyerAddressLine1?: unknown;
  buyerAddressLine2?: unknown;
  buyerCountryCode?: unknown;
  exemptionReason?: unknown;
  paymentDueDate?: unknown;
  paymentMethod?: unknown;
  paymentBankAccount?: unknown;
  currency?: unknown;
  items?: unknown;
};

type KsefNormalizedMappedImportConfig = {
  context: {
    myCompanyRole: KsefMyCompanyRole;
  };
  mapping: Partial<Record<KsefExcelFlexibleFieldKey, string>>;
  defaults: {
    sellerNip?: string;
    sellerName?: string;
    sellerCountryCode?: string;
    sellerAddressLine1?: string;
    sellerAddressLine2?: string;
    sellerEmail?: string;
    sellerPhone?: string;
    buyerIdentifierType?: GenerateKsefXmlDto["buyer"]["identifierType"];
    defaultBuyerName?: string;
    defaultBuyerNip?: string;
    defaultBuyerAddressLine1?: string;
    defaultBuyerAddressLine2?: string;
    defaultBuyerCountryCode?: string;
    defaultIssueDate?: string;
    defaultSaleDate?: string;
    currency?: string;
    placeOfIssue?: string;
    systemName?: string;
    paymentMethod?: NonNullable<GenerateKsefXmlDto["payment"]>["method"];
    paymentBankAccount?: string;
    defaultItemName?: string;
    defaultItemDescription?: string;
    defaultItemUnit?: string;
    defaultItemQuantity?: number;
    defaultTaxRate?: KsefTaxRateValue;
    splitPayment: boolean;
    cashAccounting: boolean;
    selfBilling: boolean;
    simplifiedProcedure: boolean;
    relatedEntities: boolean;
    annex15: boolean;
  };
  options: {
    deriveTaxRateFromAmounts: boolean;
  };
  overrides: {
    invoices: Array<{
      rowNumbers: number[];
      invoiceNumber?: string;
      issueDate?: string;
      saleDate?: string;
      buyerName?: string;
      buyerNip?: string;
      buyerAddressLine1?: string;
      buyerAddressLine2?: string;
      buyerCountryCode?: string;
      exemptionReason?: string;
      paymentDueDate?: string;
      paymentMethod?: NonNullable<GenerateKsefXmlDto["payment"]>["method"];
      paymentBankAccount?: string;
      currency?: string;
      items: Array<{
        rowNumber: number;
        name?: string;
        description?: string;
        productCode?: string;
        unit?: string;
        quantity?: number;
        unitNetPrice?: number;
        taxRate?: KsefTaxRateValue;
      }>;
    }>;
  };
};

type KsefExcelMappedImportResolvedField = {
  key: KsefExcelFlexibleFieldKey | KsefExcelSupplementFieldKey;
  label: string;
  value: string;
  source: KsefExcelFieldSource;
};

type KsefExcelMappedImportMissingField = {
  key: KsefExcelFlexibleFieldKey | KsefExcelSupplementFieldKey;
  label: string;
};

type KsefExcelMappedImportInvoiceResult = GenerateKsefXmlResponse & {
  invoiceNumber: string;
  rowNumbers: number[];
  status: "generated" | "needs_completion" | "invalid";
  resolvedFields: KsefExcelMappedImportResolvedField[];
  missingFields: KsefExcelMappedImportMissingField[];
  preview: {
    buyerName?: string;
    buyerNip?: string;
    buyerAddressLine1?: string;
    buyerAddressLine2?: string;
    buyerCountryCode?: string;
    issueDate?: string;
    saleDate?: string;
    currency?: string;
    exemptionReason?: string;
    paymentDueDate?: string;
    paymentMethod?: string;
    paymentBankAccount?: string;
    items: Array<{
      rowNumber: number;
      name?: string;
      description?: string;
      productCode?: string;
      quantity?: number;
      unit?: string;
      unitNetPrice?: number;
      taxRate?: string;
    }>;
    netTotal?: number;
    vatTotal?: number;
    grossTotal?: number;
  };
};

type KsefExcelMappedImportResponse = {
  imported: boolean;
  fileName: string;
  sheetName: string;
  appliedMapping: Partial<Record<KsefExcelFlexibleFieldKey, string>>;
  summary: {
    rowsCount: number;
    invoicesCount: number;
    generatedValid: number;
    needsCompletion: number;
    invalidInvoices: number;
  };
  globalErrors: string[];
  completionSummary: Array<{
    key: KsefExcelFlexibleFieldKey | KsefExcelSupplementFieldKey;
    label: string;
    count: number;
  }>;
  invoices: KsefExcelMappedImportInvoiceResult[];
};

const MAIN_SCHEMA_FILE = "FA-3.xsd";
const PRELOADED_SCHEMA_FILES = [
  "StrukturyDanych_v10-0E.xsd",
  "ElementarneTypyDanych_v10-0E.xsd",
  "KodyKrajow_v10-0E.xsd"
] as const;

const SCHEMA_FILE_NAMES = {
  [MAIN_SCHEMA_FILE]: "FA-3.xsd",
  [PRELOADED_SCHEMA_FILES[0]]: "StrukturyDanych_v10-0E.xsd",
  [PRELOADED_SCHEMA_FILES[1]]: "ElementarneTypyDanych_v10-0E.xsd",
  [PRELOADED_SCHEMA_FILES[2]]: "KodyKrajow_v10-0E.xsd"
} as const;

const TAX_FIELD_MAPPING: Record<
  KsefTaxRateValue,
  { netField: string; taxField?: string }
> = {
  "23": { netField: "P_13_1", taxField: "P_14_1" },
  "22": { netField: "P_13_1", taxField: "P_14_1" },
  "8": { netField: "P_13_2", taxField: "P_14_2" },
  "7": { netField: "P_13_2", taxField: "P_14_2" },
  "5": { netField: "P_13_3", taxField: "P_14_3" },
  "4": { netField: "P_13_4", taxField: "P_14_4" },
  "3": { netField: "P_13_4", taxField: "P_14_4" },
  "0 KR": { netField: "P_13_6_1" },
  "0 WDT": { netField: "P_13_6_2" },
  "0 EX": { netField: "P_13_6_3" },
  zw: { netField: "P_13_7" },
  "np I": { netField: "P_13_8" },
  "np II": { netField: "P_13_9" },
  oo: { netField: "P_13_10" }
};

const KSEF_EXCEL_TEMPLATE_COLUMNS = [
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

const REQUIRED_KSEF_EXCEL_COLUMNS = [
  "invoice_number",
  "issue_date",
  "seller_nip",
  "seller_name",
  "seller_country_code",
  "seller_address_line1",
  "buyer_identifier_type",
  "buyer_name",
  "item_name",
  "item_unit",
  "item_quantity",
  "item_unit_net_price",
  "item_tax_rate"
] as const;

const KSEF_EXCEL_FLEXIBLE_FIELDS: readonly KsefExcelFieldDescriptor[] = [
  { key: "invoiceNumber", label: "Numer faktury", requiredForDraft: true },
  { key: "issueDate", label: "Data wystawienia", requiredForDraft: true },
  { key: "saleDate", label: "Data sprzedazy" },
  { key: "buyerName", label: "Kontrahent", requiredForDraft: true },
  { key: "buyerNip", label: "NIP kontrahenta" },
  { key: "buyerAddressLine1", label: "Adres kontrahenta" },
  { key: "buyerAddressLine2", label: "Adres kontrahenta linia 2" },
  { key: "buyerCountryCode", label: "Kod kraju kontrahenta" },
  { key: "currency", label: "Waluta" },
  { key: "exemptionReason", label: "Podstawa zwolnienia z VAT" },
  { key: "itemName", label: "Nazwa pozycji" },
  { key: "itemDescription", label: "Opis pozycji" },
  { key: "itemProductCode", label: "Kod pozycji" },
  { key: "itemUnit", label: "Jednostka" },
  { key: "itemQuantity", label: "Ilosc" },
  { key: "itemUnitNetPrice", label: "Cena netto pozycji" },
  { key: "itemTaxRate", label: "Stawka VAT" },
  { key: "netTotal", label: "Netto" },
  { key: "vatTotal", label: "VAT" },
  { key: "grossTotal", label: "Brutto" },
  { key: "paymentDueDate", label: "Termin platnosci" },
  { key: "paymentMethod", label: "Forma platnosci" },
  { key: "paymentBankAccount", label: "Rachunek bankowy" }
] as const;

const KSEF_EXCEL_FIELD_LABELS = Object.fromEntries(
  KSEF_EXCEL_FLEXIBLE_FIELDS.map((field) => [field.key, field.label])
) as Record<KsefExcelFlexibleFieldKey, string>;

const KSEF_EXCEL_SUPPLEMENT_LABELS: Record<KsefExcelSupplementFieldKey, string> = {
  sellerNip: "NIP mojej firmy",
  sellerName: "Nazwa mojej firmy",
  sellerCountryCode: "Kod kraju mojej firmy",
  sellerAddressLine1: "Adres mojej firmy",
  sellerAddressLine2: "Adres mojej firmy linia 2",
  sellerEmail: "Email mojej firmy",
  sellerPhone: "Telefon mojej firmy",
  buyerIdentifierType: "Typ identyfikatora nabywcy",
  defaultBuyerName: "Nazwa kontrahenta",
  defaultBuyerNip: "NIP kontrahenta",
  defaultBuyerAddressLine1: "Adres kontrahenta",
  defaultBuyerAddressLine2: "Adres kontrahenta linia 2",
  defaultBuyerCountryCode: "Kod kraju kontrahenta",
  defaultIssueDate: "Data wystawienia",
  defaultSaleDate: "Data sprzedazy",
  currency: "Waluta",
  placeOfIssue: "Miejsce wystawienia",
  systemName: "SystemInfo",
  paymentMethod: "Forma platnosci",
  paymentBankAccount: "Rachunek bankowy",
  defaultItemName: "Nazwa pozycji",
  defaultItemDescription: "Opis pozycji",
  defaultItemUnit: "Jednostka",
  defaultItemQuantity: "Ilosc",
  defaultTaxRate: "Stawka VAT"
};

const KSEF_EXCEL_SUGGESTION_ALIASES: Record<KsefExcelFlexibleFieldKey, string[]> = {
  invoiceNumber: ["invoice_number", "numer_dokumentu", "numer_faktury", "nr_dokumentu", "nr_faktury"],
  issueDate: ["issue_date", "data_wystawienia", "data_dokumentu"],
  saleDate: ["sale_date", "data_sprzedazy"],
  buyerName: ["buyer_name", "kontrahent", "nabywca", "customer"],
  buyerNip: ["buyer_nip", "nip", "nip_nabywcy", "nip_kontrahenta"],
  buyerAddressLine1: ["buyer_address_line1", "adres_nabywcy", "adres", "ulica"],
  buyerAddressLine2: ["buyer_address_line2", "adres2", "adres_l2"],
  buyerCountryCode: ["buyer_country_code", "kod_kraju_nabywcy", "kraj"],
  currency: ["currency", "waluta"],
  exemptionReason: [
    "exemption_reason",
    "podstawa_zwolnienia",
    "podstawa_zwolnienia_vat",
    "podstawa_prawna_zwolnienia"
  ],
  itemName: ["item_name", "nazwa_pozycji", "nazwa", "towar", "usluga"],
  itemDescription: ["item_description", "opis", "description", "szczegoly"],
  itemProductCode: ["item_product_code", "kod_pozycji", "kod_towaru", "pkwiu", "indeks"],
  itemUnit: ["item_unit", "jednostka", "j_m", "jm"],
  itemQuantity: ["item_quantity", "ilosc", "qty", "quantity"],
  itemUnitNetPrice: ["item_unit_net_price", "cena_netto", "wartosc_netto_pozycji"],
  itemTaxRate: ["item_tax_rate", "stawka_vat", "tax_rate", "vat_rate", "stawka"],
  netTotal: ["netto", "wartosc_netto", "kwota_netto", "net_total"],
  vatTotal: ["vat", "kwota_vat", "podatek_vat", "vat_total"],
  grossTotal: ["brutto", "wartosc_brutto", "kwota_brutto", "gross_total"],
  paymentDueDate: ["payment_due_date", "termin_platnosci"],
  paymentMethod: ["payment_method", "forma_platnosci", "platnosc"],
  paymentBankAccount: ["payment_bank_account", "rachunek_bankowy", "nr_rachunku", "konto_bankowe"]
};

const KSEF_EXCEL_SUGGESTED_SUPPLEMENTS: Array<{
  key: KsefExcelSupplementFieldKey;
  reason: string;
}> = [
  {
    key: "sellerNip",
    reason: "Dane Twojej firmy warto uzupelnic raz i potem wybierac je z bazy podmiotow."
  },
  {
    key: "sellerName",
    reason: "Nazwa Twojej firmy zwykle jest stala dla calego pliku."
  },
  {
    key: "sellerAddressLine1",
    reason: "Adres Twojej firmy zwykle nie wystepuje w eksporcie, a jest potrzebny w XML."
  },
  {
    key: "sellerCountryCode",
    reason: "Kod kraju Twojej firmy jest wymagany. Dla Polski najczesciej bedzie to PL."
  },
  {
    key: "buyerIdentifierType",
    reason: "Trzeba zdecydowac, czy nabywce identyfikujemy po NIP, VAT UE, innym ID czy bez identyfikatora."
  },
  {
    key: "defaultItemName",
    reason: "Eksport rejestru VAT czesto nie ma pelnej nazwy pozycji. Mozna uzupelnic domyslna nazwe."
  },
  {
    key: "defaultItemUnit",
    reason: "KSeF wymaga jednostki dla kazdej pozycji. Przy fakturach zagregowanych mozna ustawic wartosc domyslna."
  },
  {
    key: "defaultItemQuantity",
    reason: "Przy imporcie z sum faktury zwykle przyjmujemy jedna pozycje o ilosci 1."
  }
] as const;

@Injectable()
export class KsefService {
  private readonly schemaFilesPromise = this.loadSchemaFiles();

  async generateXml(payload: GenerateKsefXmlDto): Promise<GenerateKsefXmlResponse> {
    const sanitizedPayload = this.sanitizePayloadNips(payload);
    const businessErrors = this.validateBusinessRules(sanitizedPayload);
    if (businessErrors.length > 0) {
      return {
        valid: false,
        xml: null,
        fileName: null,
        schema: {
          code: "FA(3)",
          version: "1-0E"
        },
        businessErrors,
        schemaErrors: [],
        warnings: [],
        summary: null
      };
    }

    const normalized = this.normalizePayload(sanitizedPayload);
    const xml = this.buildXml(normalized);
    const schemaErrors = await this.validateXmlAgainstSchema(xml);
    const warnings = this.buildWarnings(sanitizedPayload);

    return {
      valid: schemaErrors.length === 0,
      xml,
      fileName: this.buildFileName(payload.invoiceNumber),
      schema: {
        code: "FA(3)",
        version: "1-0E"
      },
      businessErrors: [],
      schemaErrors,
      warnings,
      summary: {
        issueDate: normalized.issueDate,
        currency: normalized.currency,
        lineCount: normalized.items.length,
        netTotal: normalized.netTotal,
        taxTotal: normalized.taxTotal,
        grossTotal: normalized.grossTotal,
        taxBreakdown: normalized.taxBreakdown
      }
    };
  }

  async importExcel(file: KsefImportedSpreadsheetFile): Promise<KsefExcelImportResponse> {
    if (!file.originalname) {
      throw new BadRequestException("Spreadsheet file name is missing.");
    }

    const buffer = await this.readSpreadsheetBuffer(file);
    const workbook = XLSX.read(buffer, { type: "buffer", raw: false });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      throw new BadRequestException("Spreadsheet does not contain any sheets.");
    }

    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: "",
      raw: false
    });
    const headerRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      blankrows: false,
      raw: false
    });
    const headerValues = (headerRows[0] ?? []).map((value) => String(value ?? ""));
    const normalizedHeaders = headerValues.map((value) => this.normalizeExcelHeader(value));

    const missingColumns = REQUIRED_KSEF_EXCEL_COLUMNS.filter(
      (column) => !normalizedHeaders.includes(column)
    );
    if (missingColumns.length > 0) {
      throw new BadRequestException(
        `Missing required columns in spreadsheet: ${missingColumns.join(", ")}.`
      );
    }

    const normalizedRows = rows.map<KsefNormalizedExcelRow>((row, index) => {
      const normalizedValues: Record<string, string> = {};
      Object.entries(row).forEach(([key, value]) => {
        normalizedValues[this.normalizeExcelHeader(key)] = String(value ?? "").trim();
      });

      return {
        rowNumber: index + 2,
        values: normalizedValues
      };
    });

    const rowsWithInvoiceNumber = normalizedRows.filter(
      (row) => row.values.invoice_number?.trim().length > 0
    );
    if (rowsWithInvoiceNumber.length === 0) {
      throw new BadRequestException("Spreadsheet does not contain any invoice rows.");
    }

    const groups = new Map<string, KsefNormalizedExcelRow[]>();
    for (const row of rowsWithInvoiceNumber) {
      const invoiceNumber = row.values.invoice_number.trim();
      const group = groups.get(invoiceNumber);
      if (group) {
        group.push(row);
      } else {
        groups.set(invoiceNumber, [row]);
      }
    }

    const invoices: KsefExcelImportInvoiceResult[] = [];
    const globalErrors: string[] = [];

    for (const [invoiceNumber, invoiceRows] of groups.entries()) {
      try {
        const payload = this.buildPayloadFromExcelRows(invoiceRows);
        const result = await this.generateXml(payload);
        invoices.push({
          ...result,
          invoiceNumber,
          rowNumbers: invoiceRows.map((row) => row.rowNumber)
        });
      } catch (error) {
        invoices.push({
          valid: false,
          xml: null,
          fileName: null,
          schema: {
            code: "FA(3)",
            version: "1-0E"
          },
          businessErrors: [
            error instanceof Error
              ? error.message
              : "Unknown error during invoice import."
          ],
          schemaErrors: [],
          warnings: [],
          summary: null,
          invoiceNumber,
          rowNumbers: invoiceRows.map((row) => row.rowNumber)
        });
      }
    }

    const validInvoices = invoices.filter((invoice) => invoice.valid).length;
    const invalidInvoices = invoices.length - validInvoices;

    if (normalizedRows.length !== rowsWithInvoiceNumber.length) {
      globalErrors.push(
        `Skipped ${normalizedRows.length - rowsWithInvoiceNumber.length} row(s) without invoice_number.`
      );
    }

    return {
      imported: true,
      fileName: file.originalname,
      sheetName,
      templateColumns: [...KSEF_EXCEL_TEMPLATE_COLUMNS],
      summary: {
        rowsCount: rowsWithInvoiceNumber.length,
        invoicesCount: invoices.length,
        validInvoices,
        invalidInvoices
      },
      globalErrors,
      invoices
    };
  }

  async analyzeExcel(file: KsefImportedSpreadsheetFile): Promise<KsefExcelAnalyzeResponse> {
    if (!file.originalname) {
      throw new BadRequestException("Spreadsheet file name is missing.");
    }

    const buffer = await this.readSpreadsheetBuffer(file);
    const parsedSpreadsheet = this.parseSpreadsheet(buffer);
    const suggestedMapping = this.buildSuggestedFlexibleMapping(parsedSpreadsheet.columns);
    const invoiceColumnId = suggestedMapping.invoiceNumber;
    const inferredInvoicesCount = invoiceColumnId
      ? new Set(
          parsedSpreadsheet.rows
            .map((row) => row.values[invoiceColumnId]?.trim())
            .filter((value): value is string => Boolean(value))
        ).size
      : parsedSpreadsheet.rows.length;

    return {
      analyzed: true,
      fileName: file.originalname,
      sheetName: parsedSpreadsheet.sheetName,
      rowsCount: parsedSpreadsheet.rows.length,
      inferredInvoicesCount,
      columns: parsedSpreadsheet.columns.map((column) => ({
        id: column.id,
        label: column.label,
        sampleValues: column.sampleValues
      })),
      previewRows: parsedSpreadsheet.rows.slice(0, 5).map((row) => ({
        rowNumber: row.rowNumber,
        values: row.values
      })),
      suggestedMapping,
      suggestedSupplementFields: KSEF_EXCEL_SUGGESTED_SUPPLEMENTS.map((field) => ({
        key: field.key,
        label: KSEF_EXCEL_SUPPLEMENT_LABELS[field.key],
        reason: field.reason
      }))
    };
  }

  async importExcelMapped(
    file: KsefImportedSpreadsheetFile,
    config: unknown
  ): Promise<KsefExcelMappedImportResponse> {
    if (!file.originalname) {
      throw new BadRequestException("Spreadsheet file name is missing.");
    }

    const buffer = await this.readSpreadsheetBuffer(file);
    const parsedSpreadsheet = this.parseSpreadsheet(buffer);
    const normalizedConfig = this.normalizeMappedImportConfig(config);
    const skippedSummaryRows = parsedSpreadsheet.rows.filter((row) =>
      this.isLikelySummaryRow(row, normalizedConfig.mapping)
    );
    const importRows = parsedSpreadsheet.rows.filter(
      (row) => !this.isLikelySummaryRow(row, normalizedConfig.mapping)
    );
    const groups = this.groupSpreadsheetRows(
      importRows,
      normalizedConfig.mapping.invoiceNumber
    );

    const invoices: KsefExcelMappedImportInvoiceResult[] = [];
    for (const rows of groups.values()) {
      invoices.push(
        await this.buildMappedInvoiceResult(rows, parsedSpreadsheet.columns, normalizedConfig)
      );
    }

    const generatedValid = invoices.filter((invoice) => invoice.status === "generated").length;
    const needsCompletion = invoices.filter(
      (invoice) => invoice.status === "needs_completion"
    ).length;
    const invalidInvoices = invoices.length - generatedValid - needsCompletion;
    const completionCounts = new Map<
      KsefExcelFlexibleFieldKey | KsefExcelSupplementFieldKey,
      { key: KsefExcelFlexibleFieldKey | KsefExcelSupplementFieldKey; label: string; count: number }
    >();

    invoices.forEach((invoice) => {
      invoice.missingFields.forEach((field) => {
        const existing = completionCounts.get(field.key);
        if (existing) {
          existing.count += 1;
        } else {
          completionCounts.set(field.key, {
            key: field.key,
            label: field.label,
            count: 1
          });
        }
      });
    });

    const globalErrors: string[] = [];
    if (!normalizedConfig.mapping.invoiceNumber) {
      globalErrors.push(
        "Nie zmapowano pola numeru faktury. Kazdy wiersz zostal potraktowany jako osobny draft."
      );
    }

    return {
      imported: true,
      fileName: file.originalname,
      sheetName: parsedSpreadsheet.sheetName,
      appliedMapping: normalizedConfig.mapping,
      summary: {
        rowsCount: importRows.length,
        invoicesCount: invoices.length,
        generatedValid,
        needsCompletion,
        invalidInvoices
      },
      globalErrors: [
        ...globalErrors,
        ...(skippedSummaryRows.length > 0
          ? [
              `Pominieto ${skippedSummaryRows.length} wiersz(y) podsumowania bez danych faktury: ${skippedSummaryRows
                .map((row) => row.rowNumber)
                .join(", ")}.`
            ]
          : [])
      ],
      completionSummary: Array.from(completionCounts.values()).sort((left, right) =>
        right.count - left.count || left.label.localeCompare(right.label)
      ),
      invoices
    };
  }

  private async readSpreadsheetBuffer(file: KsefImportedSpreadsheetFile) {
    if (file.buffer) {
      return file.buffer;
    }

    if (file.path) {
      return readFile(file.path);
    }

    throw new BadRequestException("Spreadsheet file buffer is missing.");
  }

  private parseSpreadsheet(buffer: Buffer): KsefParsedSpreadsheet {
    const workbook = XLSX.read(buffer, { type: "buffer", raw: false });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      throw new BadRequestException("Spreadsheet does not contain any sheets.");
    }

    const sheet = workbook.Sheets[sheetName];
    const rowsMatrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      blankrows: false,
      raw: false,
      defval: ""
    });

    if (rowsMatrix.length === 0) {
      throw new BadRequestException("Spreadsheet is empty.");
    }

    const headerValues = (rowsMatrix[0] ?? []).map((value) => String(value ?? "").trim());
    const columns = this.buildSpreadsheetColumns(headerValues);
    const rows = rowsMatrix
      .slice(1)
      .map<KsefNormalizedExcelRow | null>((row, index) => {
        const values: Record<string, string> = {};
        let hasAnyValue = false;

        columns.forEach((column) => {
          const cellValue = String(row[column.index] ?? "").trim();
          values[column.id] = cellValue;
          if (cellValue) {
            hasAnyValue = true;
          }
        });

        if (!hasAnyValue) {
          return null;
        }

        return {
          rowNumber: index + 2,
          values
        };
      })
      .filter((row): row is KsefNormalizedExcelRow => row !== null);

    const columnsWithSamples = columns.map((column) => ({
      ...column,
      sampleValues: rows
        .map((row) => row.values[column.id])
        .filter((value) => value.length > 0)
        .slice(0, 3)
    }));

    return {
      sheetName,
      columns: columnsWithSamples,
      rows
    };
  }

  private buildSpreadsheetColumns(headerValues: string[]): KsefParsedSpreadsheetColumn[] {
    const usedIds = new Map<string, number>();

    return headerValues.map((headerValue, index) => {
      const baseId = this.normalizeExcelHeader(headerValue) || `column_${index + 1}`;
      const currentCount = (usedIds.get(baseId) ?? 0) + 1;
      usedIds.set(baseId, currentCount);

      return {
        id: currentCount === 1 ? baseId : `${baseId}_${currentCount}`,
        label: headerValue || `Kolumna ${index + 1}`,
        index,
        sampleValues: []
      };
    });
  }

  private buildSuggestedFlexibleMapping(columns: KsefParsedSpreadsheetColumn[]) {
    const suggestions: Partial<Record<KsefExcelFlexibleFieldKey, string>> = {};
    const takenColumns = new Set<string>();

    for (const field of KSEF_EXCEL_FLEXIBLE_FIELDS) {
      const bestMatch = columns
        .map((column) => ({
          column,
          score: this.scoreSuggestedColumn(field.key, column)
        }))
        .filter((entry) => entry.score > 0 && !takenColumns.has(entry.column.id))
        .sort((left, right) => right.score - left.score)[0];

      if (!bestMatch) {
        continue;
      }

      suggestions[field.key] = bestMatch.column.id;
      takenColumns.add(bestMatch.column.id);
    }

    return suggestions;
  }

  private scoreSuggestedColumn(
    fieldKey: KsefExcelFlexibleFieldKey,
    column: KsefParsedSpreadsheetColumn
  ) {
    const aliases = KSEF_EXCEL_SUGGESTION_ALIASES[fieldKey];
    const normalizedLabel = this.normalizeExcelHeader(column.label);
    const candidates = [column.id, normalizedLabel];

    for (let index = 0; index < aliases.length; index += 1) {
      const alias = aliases[index];
      if (candidates.some((candidate) => candidate === alias)) {
        return 120 - index;
      }

      if (candidates.some((candidate) => candidate.startsWith(alias))) {
        return 90 - index;
      }

      if (candidates.some((candidate) => candidate.includes(alias))) {
        return 70 - index;
      }
    }

    return 0;
  }

  private groupSpreadsheetRows(
    rows: KsefNormalizedExcelRow[],
    invoiceColumnId?: string
  ): Map<string, KsefNormalizedExcelRow[]> {
    const groups = new Map<string, KsefNormalizedExcelRow[]>();

    rows.forEach((row) => {
      const invoiceNumber = invoiceColumnId ? row.values[invoiceColumnId]?.trim() : "";
      const groupKey = invoiceNumber || `__row_${row.rowNumber}`;
      const currentGroup = groups.get(groupKey);
      if (currentGroup) {
        currentGroup.push(row);
      } else {
        groups.set(groupKey, [row]);
      }
    });

    return groups;
  }

  private isLikelySummaryRow(
    row: KsefNormalizedExcelRow,
    mapping: Partial<Record<KsefExcelFlexibleFieldKey, string>>
  ) {
    const invoiceNumber = mapping.invoiceNumber ? row.values[mapping.invoiceNumber]?.trim() : "";
    const issueDate = mapping.issueDate ? row.values[mapping.issueDate]?.trim() : "";
    const saleDate = mapping.saleDate ? row.values[mapping.saleDate]?.trim() : "";
    const buyerName = mapping.buyerName ? row.values[mapping.buyerName]?.trim() : "";
    const buyerNip = mapping.buyerNip ? row.values[mapping.buyerNip]?.trim() : "";

    const hasIdentityData = Boolean(
      invoiceNumber || issueDate || saleDate || buyerName || buyerNip
    );
    if (hasIdentityData) {
      return false;
    }

    const hasTotals = ["netTotal", "vatTotal", "grossTotal"].some((fieldKey) => {
      const columnId = mapping[fieldKey as KsefExcelFlexibleFieldKey];
      if (!columnId) {
        return false;
      }

      return Boolean(row.values[columnId]?.trim());
    });

    return hasTotals;
  }

  private normalizeMappedImportConfig(config: unknown) {
    const safeConfig =
      typeof config === "object" && config !== null
        ? (config as KsefExcelMappedImportConfig)
        : ({} as KsefExcelMappedImportConfig);
    const mapping = Object.fromEntries(
      Object.entries(safeConfig.mapping ?? {})
        .map(([key, value]) => [key, this.normalizeOptionalTextInput(value)])
        .filter(([, value]) => Boolean(value))
    ) as Partial<Record<KsefExcelFlexibleFieldKey, string>>;

    const buyerIdentifierType = this.normalizeOptionalTextInput(
      safeConfig.defaults?.buyerIdentifierType
    )?.toUpperCase();
    const paymentMethod = this.normalizeFlexiblePaymentMethodInput(
      safeConfig.defaults?.paymentMethod
    );
    const defaultTaxRate = this.normalizeFlexibleTaxRateInput(safeConfig.defaults?.defaultTaxRate);
    const myCompanyRole =
      this.normalizeOptionalTextInput(safeConfig.context?.myCompanyRole)?.toUpperCase() === "BUYER"
        ? "BUYER"
        : "SELLER";
    const rawOverrides = Array.isArray(safeConfig.overrides?.invoices)
      ? (safeConfig.overrides?.invoices as KsefExcelMappedInvoiceOverrideInput[])
      : [];
    const normalizedOverrides: KsefNormalizedMappedImportConfig["overrides"]["invoices"] = [];

    rawOverrides.forEach((invoiceOverride) => {
      const rowNumbers = Array.isArray(invoiceOverride.rowNumbers)
        ? invoiceOverride.rowNumbers
            .map((value) => this.normalizeOptionalInteger(value))
            .filter((value): value is number => value !== undefined)
        : [];

      if (rowNumbers.length === 0) {
        return;
      }

      const itemOverrides: KsefNormalizedMappedImportConfig["overrides"]["invoices"][number]["items"] =
        [];
      if (Array.isArray(invoiceOverride.items)) {
        (invoiceOverride.items as KsefExcelMappedInvoiceItemOverrideInput[]).forEach((itemOverride) => {
          const rowNumber = this.normalizeOptionalInteger(itemOverride.rowNumber);
          if (!rowNumber) {
            return;
          }

          itemOverrides.push({
            rowNumber,
            name: this.normalizeOptionalTextInput(itemOverride.name),
            description: this.normalizeOptionalTextInput(itemOverride.description),
            productCode: this.normalizeOptionalTextInput(itemOverride.productCode),
            unit: this.normalizeOptionalTextInput(itemOverride.unit),
            quantity: this.normalizeOptionalPositiveNumber(itemOverride.quantity),
            unitNetPrice: this.normalizeOptionalNonNegativeNumber(itemOverride.unitNetPrice),
            taxRate: this.normalizeFlexibleTaxRateInput(itemOverride.taxRate)
          });
        });
      }

      normalizedOverrides.push({
        rowNumbers: Array.from(new Set(rowNumbers)).sort((left, right) => left - right),
        invoiceNumber: this.normalizeOptionalTextInput(invoiceOverride.invoiceNumber),
        issueDate: this.normalizeOptionalTextInput(invoiceOverride.issueDate),
        saleDate: this.normalizeOptionalTextInput(invoiceOverride.saleDate),
        buyerName: this.normalizeOptionalTextInput(invoiceOverride.buyerName),
        buyerNip: this.normalizeOptionalNipInput(invoiceOverride.buyerNip),
        buyerAddressLine1: this.normalizeOptionalTextInput(invoiceOverride.buyerAddressLine1),
        buyerAddressLine2: this.normalizeOptionalTextInput(invoiceOverride.buyerAddressLine2),
        buyerCountryCode: this.normalizeOptionalTextInput(
          invoiceOverride.buyerCountryCode
        )?.toUpperCase(),
        exemptionReason: this.normalizeOptionalTextInput(invoiceOverride.exemptionReason),
        paymentDueDate: this.normalizeOptionalTextInput(invoiceOverride.paymentDueDate),
        paymentMethod: this.normalizeFlexiblePaymentMethodInput(invoiceOverride.paymentMethod),
        paymentBankAccount: this.normalizeOptionalTextInput(invoiceOverride.paymentBankAccount),
        currency: this.normalizeOptionalTextInput(invoiceOverride.currency)?.toUpperCase(),
        items: itemOverrides
      });
    });

    return {
      context: {
        myCompanyRole
      },
      mapping,
      defaults: {
        sellerNip: this.normalizeOptionalNipInput(safeConfig.defaults?.sellerNip),
        sellerName: this.normalizeOptionalTextInput(safeConfig.defaults?.sellerName),
        sellerCountryCode: this.normalizeOptionalTextInput(safeConfig.defaults?.sellerCountryCode)?.toUpperCase(),
        sellerAddressLine1: this.normalizeOptionalTextInput(safeConfig.defaults?.sellerAddressLine1),
        sellerAddressLine2: this.normalizeOptionalTextInput(safeConfig.defaults?.sellerAddressLine2),
        sellerEmail: this.normalizeOptionalTextInput(safeConfig.defaults?.sellerEmail),
        sellerPhone: this.normalizeOptionalTextInput(safeConfig.defaults?.sellerPhone),
        buyerIdentifierType:
          buyerIdentifierType &&
          KSEF_BUYER_IDENTIFIER_TYPES.includes(
            buyerIdentifierType as GenerateKsefXmlDto["buyer"]["identifierType"]
          )
            ? (buyerIdentifierType as GenerateKsefXmlDto["buyer"]["identifierType"])
            : undefined,
        defaultBuyerName: this.normalizeOptionalTextInput(safeConfig.defaults?.defaultBuyerName),
        defaultBuyerNip: this.normalizeOptionalNipInput(safeConfig.defaults?.defaultBuyerNip),
        defaultBuyerAddressLine1: this.normalizeOptionalTextInput(
          safeConfig.defaults?.defaultBuyerAddressLine1
        ),
        defaultBuyerAddressLine2: this.normalizeOptionalTextInput(
          safeConfig.defaults?.defaultBuyerAddressLine2
        ),
        defaultBuyerCountryCode: this.normalizeOptionalTextInput(
          safeConfig.defaults?.defaultBuyerCountryCode
        )?.toUpperCase(),
        defaultIssueDate: this.normalizeOptionalTextInput(safeConfig.defaults?.defaultIssueDate),
        defaultSaleDate: this.normalizeOptionalTextInput(safeConfig.defaults?.defaultSaleDate),
        currency: this.normalizeOptionalTextInput(safeConfig.defaults?.currency)?.toUpperCase(),
        placeOfIssue: this.normalizeOptionalTextInput(safeConfig.defaults?.placeOfIssue),
        systemName: this.normalizeOptionalTextInput(safeConfig.defaults?.systemName),
        paymentMethod,
        paymentBankAccount: this.normalizeOptionalTextInput(safeConfig.defaults?.paymentBankAccount),
        defaultItemName: this.normalizeOptionalTextInput(safeConfig.defaults?.defaultItemName),
        defaultItemDescription: this.normalizeOptionalTextInput(
          safeConfig.defaults?.defaultItemDescription
        ),
        defaultItemUnit: this.normalizeOptionalTextInput(safeConfig.defaults?.defaultItemUnit),
        defaultItemQuantity: this.normalizeOptionalPositiveNumber(
          safeConfig.defaults?.defaultItemQuantity
        ),
        defaultTaxRate,
        splitPayment: this.normalizeOptionalBooleanInput(safeConfig.defaults?.splitPayment) ?? false,
        cashAccounting: this.normalizeOptionalBooleanInput(safeConfig.defaults?.cashAccounting) ?? false,
        selfBilling: this.normalizeOptionalBooleanInput(safeConfig.defaults?.selfBilling) ?? false,
        simplifiedProcedure:
          this.normalizeOptionalBooleanInput(safeConfig.defaults?.simplifiedProcedure) ?? false,
        relatedEntities:
          this.normalizeOptionalBooleanInput(safeConfig.defaults?.relatedEntities) ?? false,
        annex15: this.normalizeOptionalBooleanInput(safeConfig.defaults?.annex15) ?? false
      },
      options: {
        deriveTaxRateFromAmounts:
          this.normalizeOptionalBooleanInput(safeConfig.options?.deriveTaxRateFromAmounts) ?? true
      },
      overrides: {
        invoices: normalizedOverrides
      }
    } satisfies KsefNormalizedMappedImportConfig;
  }

  private normalizeOptionalTextInput(value: unknown) {
    if (typeof value !== "string") {
      return undefined;
    }

    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
  }

  private normalizeOptionalNipInput(value: unknown) {
    const normalized = this.normalizeOptionalTextInput(value);
    if (!normalized) {
      return undefined;
    }

    const compact = normalized.replace(/[\s-]+/g, "");
    if (/^PL\d{10}$/i.test(compact)) {
      return compact.slice(2);
    }

    return compact;
  }

  private sanitizePayloadNips(payload: GenerateKsefXmlDto): GenerateKsefXmlDto {
    const sellerNip = this.normalizeOptionalNipInput(payload.seller.nip) ?? payload.seller.nip;
    const buyerNip =
      payload.buyer.identifierType === "NIP"
        ? this.normalizeOptionalNipInput(payload.buyer.nip) ?? payload.buyer.nip
        : payload.buyer.nip;

    return {
      ...payload,
      seller: {
        ...payload.seller,
        nip: sellerNip
      },
      buyer: {
        ...payload.buyer,
        nip: buyerNip
      }
    };
  }

  private normalizeOptionalBooleanInput(value: unknown) {
    if (typeof value === "boolean") {
      return value;
    }

    if (typeof value !== "string") {
      return undefined;
    }

    const normalized = value.trim().toLowerCase();
    if (!normalized) {
      return undefined;
    }

    if (["1", "true", "tak", "yes", "y"].includes(normalized)) {
      return true;
    }

    if (["0", "false", "nie", "no", "n"].includes(normalized)) {
      return false;
    }

    return undefined;
  }

  private normalizeOptionalPositiveNumber(value: unknown) {
    if (typeof value === "number") {
      return Number.isFinite(value) && value > 0 ? value : undefined;
    }

    if (typeof value !== "string") {
      return undefined;
    }

    const normalized = this.normalizeSpreadsheetNumber(value);
    if (!normalized) {
      return undefined;
    }

    const parsed = Number(normalized);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
  }

  private normalizeOptionalNonNegativeNumber(value: unknown) {
    if (typeof value === "number") {
      return Number.isFinite(value) && value >= 0 ? value : undefined;
    }

    if (typeof value !== "string") {
      return undefined;
    }

    const normalized = this.normalizeSpreadsheetNumber(value);
    if (!normalized) {
      return undefined;
    }

    const parsed = Number(normalized);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
  }

  private normalizeOptionalInteger(value: unknown) {
    if (typeof value === "number") {
      return Number.isInteger(value) && value > 0 ? value : undefined;
    }

    if (typeof value !== "string") {
      return undefined;
    }

    const trimmed = value.trim();
    if (!trimmed) {
      return undefined;
    }

    const parsed = Number(trimmed);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
  }

  private normalizeFlexiblePaymentMethodInput(
    value: unknown
  ): NonNullable<GenerateKsefXmlDto["payment"]>["method"] | undefined {
    const normalized = this.normalizeOptionalTextInput(value);
    if (!normalized) {
      return undefined;
    }

    const lowered = normalized.toLowerCase();
    const aliases: Record<string, NonNullable<GenerateKsefXmlDto["payment"]>["method"]> = {
      gotowka: "1",
      karta: "2",
      bon: "3",
      czek: "4",
      kredyt: "5",
      przelew: "6",
      mobilna: "7",
      blik: "7"
    };

    if (KSEF_PAYMENT_METHOD_VALUES.includes(normalized as (typeof KSEF_PAYMENT_METHOD_VALUES)[number])) {
      return normalized as NonNullable<GenerateKsefXmlDto["payment"]>["method"];
    }

    return aliases[lowered];
  }

  private normalizeFlexibleTaxRateInput(value: unknown): KsefTaxRateValue | undefined {
    const normalized = this.normalizeOptionalTextInput(value);
    if (!normalized) {
      return undefined;
    }

    const compact = normalized.toUpperCase().replace(/\s+/g, " ").replace("%", "").trim();
    const aliases: Record<string, KsefTaxRateValue> = {
      "0": "0 KR",
      "0 KR": "0 KR",
      "0 KRAJ": "0 KR",
      "0 WDT": "0 WDT",
      "0 EX": "0 EX",
      ZW: "zw",
      OO: "oo",
      "NP I": "np I",
      "NP II": "np II"
    };

    if (KSEF_TAX_RATE_VALUES.includes(compact as KsefTaxRateValue)) {
      return compact as KsefTaxRateValue;
    }

    if (aliases[compact]) {
      return aliases[compact];
    }

    return undefined;
  }

  private getInvoiceOverride(
    rows: KsefNormalizedExcelRow[],
    config: KsefNormalizedMappedImportConfig
  ) {
    const invoiceKey = rows
      .map((row) => row.rowNumber)
      .sort((left, right) => left - right)
      .join(",");

    return config.overrides.invoices.find(
      (invoiceOverride) => invoiceOverride.rowNumbers.join(",") === invoiceKey
    );
  }

  private getItemOverride(
    invoiceOverride: KsefNormalizedMappedImportConfig["overrides"]["invoices"][number] | undefined,
    rowNumber: number
  ) {
    return invoiceOverride?.items.find((itemOverride) => itemOverride.rowNumber === rowNumber);
  }

  private splitEmbeddedCounterpartyAddress(value: string | undefined) {
    if (!value) {
      return undefined;
    }

    const trimmed = value.trim();
    if (!trimmed) {
      return undefined;
    }

    const marker = /\b(UL\.?|ULICA|AL\.?|ALEJA|PLAC|PL\.?|OS\.?|RYNEK)\b/i.exec(trimmed);
    if (!marker?.index) {
      return {
        name: trimmed
      };
    }

    const name = trimmed.slice(0, marker.index).trim().replace(/[,\-]+$/, "").trim();
    const addressLine1 = trimmed.slice(marker.index).trim();
    return {
      name: name || trimmed,
      addressLine1: addressLine1 || undefined
    };
  }

  private async buildMappedInvoiceResult(
    rows: KsefNormalizedExcelRow[],
    columns: KsefParsedSpreadsheetColumn[],
    config: KsefNormalizedMappedImportConfig
  ): Promise<KsefExcelMappedImportInvoiceResult> {
    const firstRow = rows[0];
    const columnLabels = new Map(columns.map((column) => [column.id, column.label]));
    const resolvedFields = new Map<
      KsefExcelFlexibleFieldKey | KsefExcelSupplementFieldKey,
      KsefExcelMappedImportResolvedField
    >();
    const missingFields = new Map<
      KsefExcelFlexibleFieldKey | KsefExcelSupplementFieldKey,
      KsefExcelMappedImportMissingField
    >();
    const buildErrors: string[] = [];
    const invalidMappingKeys = new Set<KsefExcelFlexibleFieldKey>();
    const invoiceOverride = this.getInvoiceOverride(rows, config);

    const addResolvedField = (
      key: KsefExcelFlexibleFieldKey | KsefExcelSupplementFieldKey,
      value: string | number | undefined,
      source: KsefExcelFieldSource
    ) => {
      if (value === undefined) {
        return;
      }

      const textValue = typeof value === "number" ? this.formatMoney(value) : value.trim();
      if (!textValue) {
        return;
      }

      const label = key in KSEF_EXCEL_FIELD_LABELS
        ? KSEF_EXCEL_FIELD_LABELS[key as KsefExcelFlexibleFieldKey]
        : KSEF_EXCEL_SUPPLEMENT_LABELS[key as KsefExcelSupplementFieldKey];

      resolvedFields.set(key, {
        key,
        label,
        value: textValue,
        source
      });
    };

    const addMissingField = (key: KsefExcelFlexibleFieldKey | KsefExcelSupplementFieldKey) => {
      if (missingFields.has(key)) {
        return;
      }

      const label = key in KSEF_EXCEL_FIELD_LABELS
        ? KSEF_EXCEL_FIELD_LABELS[key as KsefExcelFlexibleFieldKey]
        : KSEF_EXCEL_SUPPLEMENT_LABELS[key as KsefExcelSupplementFieldKey];

      missingFields.set(key, {
        key,
        label
      });
    };

    const ensureMappedColumnExists = (fieldKey: KsefExcelFlexibleFieldKey) => {
      const columnId = config.mapping[fieldKey];
      if (!columnId) {
        return undefined;
      }

      if (columnLabels.has(columnId)) {
        return columnId;
      }

      if (!invalidMappingKeys.has(fieldKey)) {
        buildErrors.push(
          `Zmapowana kolumna '${columnId}' dla pola '${KSEF_EXCEL_FIELD_LABELS[fieldKey]}' nie istnieje w pliku.`
        );
        invalidMappingKeys.add(fieldKey);
      }

      return undefined;
    };

    const getUniqueMappedValues = (fieldKey: KsefExcelFlexibleFieldKey) => {
      const columnId = ensureMappedColumnExists(fieldKey);
      if (!columnId) {
        return [];
      }

      return Array.from(
        new Set(
          rows
            .map((row) => row.values[columnId]?.trim())
            .filter((value): value is string => Boolean(value))
        )
      );
    };

    const resolveMappedText = (fieldKey: KsefExcelFlexibleFieldKey) => {
      const values = getUniqueMappedValues(fieldKey);
      if (values.length === 0) {
        return undefined;
      }

      if (values.length > 1) {
        buildErrors.push(
          `Pole '${KSEF_EXCEL_FIELD_LABELS[fieldKey]}' ma rozne wartosci w ramach jednej faktury (wiersze ${rows.map((row) => row.rowNumber).join(", ")}).`
        );
      }

      addResolvedField(fieldKey, values[0], "excel");
      return values[0];
    };

    const resolveTextWithFallback = (
      fieldKey: KsefExcelFlexibleFieldKey,
      defaultKey: KsefExcelSupplementFieldKey,
      manualValue: string | undefined,
      defaultValue: string | undefined,
      required: boolean
    ) => {
      if (manualValue) {
        addResolvedField(fieldKey, manualValue, "manual");
        return manualValue;
      }

      const excelValue = resolveMappedText(fieldKey);
      if (excelValue) {
        return excelValue;
      }

      if (defaultValue) {
        addResolvedField(defaultKey, defaultValue, "default");
        return defaultValue;
      }

      if (required) {
        addMissingField(config.mapping[fieldKey] ? fieldKey : defaultKey);
      }

      return undefined;
    };

    const resolveSummedNumber = (fieldKey: KsefExcelFlexibleFieldKey) => {
      const columnId = config.mapping[fieldKey];
      if (!columnId) {
        return undefined;
      }

      const values = rows
        .map((row) => row.values[columnId]?.trim())
        .filter((value): value is string => Boolean(value));
      if (values.length === 0) {
        return undefined;
      }

      let sum = 0;
      for (const value of values) {
        const normalized = this.normalizeSpreadsheetNumber(value);
        const parsed = Number(normalized);
        if (!normalized || !Number.isFinite(parsed)) {
          buildErrors.push(`Pole '${KSEF_EXCEL_FIELD_LABELS[fieldKey]}' zawiera niepoprawna liczbe: '${value}'.`);
          return undefined;
        }

        sum += parsed;
      }

      const rounded = this.roundMoney(sum);
      addResolvedField(fieldKey, rounded, "excel");
      return rounded;
    };

    const resolveSingleNumber = (fieldKey: KsefExcelFlexibleFieldKey) => {
      const values = getUniqueMappedValues(fieldKey);
      if (values.length === 0) {
        return undefined;
      }

      if (values.length > 1) {
        buildErrors.push(
          `Pole '${KSEF_EXCEL_FIELD_LABELS[fieldKey]}' ma rozne wartosci w ramach jednej faktury (wiersze ${rows.map((row) => row.rowNumber).join(", ")}).`
        );
      }

      const normalized = this.normalizeSpreadsheetNumber(values[0]);
      const parsed = Number(normalized);
      if (!normalized || !Number.isFinite(parsed)) {
        buildErrors.push(`Pole '${KSEF_EXCEL_FIELD_LABELS[fieldKey]}' zawiera niepoprawna liczbe: '${values[0]}'.`);
        return undefined;
      }

      addResolvedField(fieldKey, parsed, "excel");
      return parsed;
    };

    let invoiceNumber = invoiceOverride?.invoiceNumber;
    if (invoiceNumber) {
      addResolvedField("invoiceNumber", invoiceNumber, "manual");
    } else {
      invoiceNumber = resolveMappedText("invoiceNumber");
    }
    if (!invoiceNumber) {
      addMissingField("invoiceNumber");
    }

    const issueDateRaw = resolveTextWithFallback(
      "issueDate",
      "defaultIssueDate",
      invoiceOverride?.issueDate,
      config.defaults.defaultIssueDate,
      true
    );
    let issueDate: string | undefined;
    if (issueDateRaw) {
      try {
        issueDate = this.parseDateString(issueDateRaw, firstRow.rowNumber, "issue_date", true);
        addResolvedField(
          config.mapping.issueDate ? "issueDate" : "defaultIssueDate",
          issueDate,
          invoiceOverride?.issueDate
            ? "manual"
            : config.mapping.issueDate
              ? "excel"
              : "default"
        );
      } catch (error) {
        buildErrors.push(error instanceof Error ? error.message : "Niepoprawna data wystawienia.");
      }
    }

    const saleDateRaw = resolveTextWithFallback(
      "saleDate",
      "defaultSaleDate",
      invoiceOverride?.saleDate,
      config.defaults.defaultSaleDate,
      false
    );
    let saleDate: string | undefined;
    if (saleDateRaw) {
      try {
        saleDate = this.parseDateString(saleDateRaw, firstRow.rowNumber, "sale_date", false);
        addResolvedField(
          config.mapping.saleDate ? "saleDate" : "defaultSaleDate",
          saleDate,
          invoiceOverride?.saleDate
            ? "manual"
            : config.mapping.saleDate
              ? "excel"
              : "default"
        );
      } catch (error) {
        buildErrors.push(error instanceof Error ? error.message : "Niepoprawna data sprzedazy.");
      }
    }

    const myCompanyRole = config.context.myCompanyRole;

    const rawCounterpartyName = resolveTextWithFallback(
      "buyerName",
      "defaultBuyerName",
      invoiceOverride?.buyerName,
      config.defaults.defaultBuyerName,
      true
    );
    const counterpartyNip = this.normalizeOptionalNipInput(
      resolveTextWithFallback(
        "buyerNip",
        "defaultBuyerNip",
        invoiceOverride?.buyerNip,
        config.defaults.defaultBuyerNip,
        false
      )
    );
    let counterpartyAddressLine1 = resolveTextWithFallback(
      "buyerAddressLine1",
      "defaultBuyerAddressLine1",
      invoiceOverride?.buyerAddressLine1,
      config.defaults.defaultBuyerAddressLine1,
      false
    );
    const counterpartyAddressLine2 = resolveTextWithFallback(
      "buyerAddressLine2",
      "defaultBuyerAddressLine2",
      invoiceOverride?.buyerAddressLine2,
      config.defaults.defaultBuyerAddressLine2,
      false
    );
    const counterpartyNameParts = this.splitEmbeddedCounterpartyAddress(rawCounterpartyName);
    const counterpartyName = counterpartyNameParts?.name;
    if (
      counterpartyNameParts?.addressLine1 &&
      !counterpartyAddressLine1 &&
      !invoiceOverride?.buyerAddressLine1
    ) {
      counterpartyAddressLine1 = counterpartyNameParts.addressLine1;
      addResolvedField("buyerAddressLine1", counterpartyAddressLine1, "derived");
    }
    const counterpartyCountryCode =
      resolveTextWithFallback(
        "buyerCountryCode",
        "defaultBuyerCountryCode",
        invoiceOverride?.buyerCountryCode,
        config.defaults.defaultBuyerCountryCode,
        false
      ) ?? "PL";
    if (!resolvedFields.has("buyerCountryCode") && !resolvedFields.has("defaultBuyerCountryCode")) {
      addResolvedField("defaultBuyerCountryCode", counterpartyCountryCode, "derived");
    }

    const myCompanyNip = config.defaults.sellerNip;
    if (myCompanyNip) {
      addResolvedField("sellerNip", myCompanyNip, "default");
    } else {
      addMissingField("sellerNip");
    }

    const myCompanyName = config.defaults.sellerName;
    if (myCompanyName) {
      addResolvedField("sellerName", myCompanyName, "default");
    } else {
      addMissingField("sellerName");
    }

    const myCompanyCountryCode = config.defaults.sellerCountryCode;
    if (myCompanyCountryCode) {
      addResolvedField("sellerCountryCode", myCompanyCountryCode, "default");
    } else {
      addMissingField("sellerCountryCode");
    }

    const myCompanyAddressLine1 = config.defaults.sellerAddressLine1;
    if (myCompanyAddressLine1) {
      addResolvedField("sellerAddressLine1", myCompanyAddressLine1, "default");
    } else {
      addMissingField("sellerAddressLine1");
    }

    if (config.defaults.sellerAddressLine2) {
      addResolvedField("sellerAddressLine2", config.defaults.sellerAddressLine2, "default");
    }
    if (config.defaults.sellerEmail) {
      addResolvedField("sellerEmail", config.defaults.sellerEmail, "default");
    }
    if (config.defaults.sellerPhone) {
      addResolvedField("sellerPhone", config.defaults.sellerPhone, "default");
    }

    const buyerIdentifierType =
      myCompanyRole === "BUYER"
        ? config.defaults.buyerIdentifierType ?? (myCompanyNip ? "NIP" : "NONE")
        : config.defaults.buyerIdentifierType ?? (counterpartyNip ? "NIP" : "NONE");
    addResolvedField(
      "buyerIdentifierType",
      buyerIdentifierType,
      config.defaults.buyerIdentifierType ? "default" : "derived"
    );

    if (myCompanyRole === "SELLER" && buyerIdentifierType === "NIP" && !counterpartyNip) {
      addMissingField(config.mapping.buyerNip ? "buyerNip" : "defaultBuyerNip");
    }

    if (myCompanyRole === "BUYER" && !counterpartyNip) {
      addMissingField(config.mapping.buyerNip ? "buyerNip" : "defaultBuyerNip");
    }

    if (myCompanyRole === "BUYER" && !counterpartyAddressLine1) {
      addMissingField(config.mapping.buyerAddressLine1 ? "buyerAddressLine1" : "defaultBuyerAddressLine1");
    }

    const currency =
      resolveTextWithFallback(
        "currency",
        "currency",
        invoiceOverride?.currency,
        config.defaults.currency,
        false
      ) ?? "PLN";
    if (!resolvedFields.has("currency")) {
      addResolvedField("currency", currency, "derived");
    }

    if (config.defaults.placeOfIssue) {
      addResolvedField("placeOfIssue", config.defaults.placeOfIssue, "default");
    }
    addResolvedField(
      "systemName",
      config.defaults.systemName ?? "Kasia KSeF XML Generator",
      config.defaults.systemName ? "default" : "derived"
    );

    let netTotal = resolveSummedNumber("netTotal");
    let vatTotal = resolveSummedNumber("vatTotal");
    let grossTotal = resolveSummedNumber("grossTotal");
    const mappedUnitNetPrice = resolveSingleNumber("itemUnitNetPrice");

    if (grossTotal === undefined && netTotal !== undefined && vatTotal !== undefined) {
      grossTotal = this.roundMoney(netTotal + vatTotal);
      addResolvedField("grossTotal", grossTotal, "derived");
    }

    if (vatTotal === undefined && grossTotal !== undefined && netTotal !== undefined) {
      vatTotal = this.roundMoney(grossTotal - netTotal);
      addResolvedField("vatTotal", vatTotal, "derived");
    }

    if (netTotal === undefined && grossTotal !== undefined && vatTotal !== undefined) {
      netTotal = this.roundMoney(grossTotal - vatTotal);
      addResolvedField("netTotal", netTotal, "derived");
    }

    const getRowMappedText = (
      row: KsefNormalizedExcelRow,
      fieldKey: KsefExcelFlexibleFieldKey
    ) => {
      const columnId = ensureMappedColumnExists(fieldKey);
      if (!columnId) {
        return undefined;
      }

      const value = row.values[columnId]?.trim();
      return value ? value : undefined;
    };

    const parseRowNumberValue = (
      row: KsefNormalizedExcelRow,
      fieldKey: KsefExcelFlexibleFieldKey
    ) => {
      const rawValue = getRowMappedText(row, fieldKey);
      if (!rawValue) {
        return undefined;
      }

      const normalized = this.normalizeSpreadsheetNumber(rawValue);
      const parsed = Number(normalized);
      if (!normalized || !Number.isFinite(parsed)) {
        buildErrors.push(
          `Wiersz ${row.rowNumber}: pole '${KSEF_EXCEL_FIELD_LABELS[fieldKey]}' zawiera niepoprawna liczbe '${rawValue}'.`
        );
        return undefined;
      }

      return parsed;
    };

    const builtItems: GenerateKsefXmlDto["items"] = [];
    const previewItems: KsefExcelMappedImportInvoiceResult["preview"]["items"] = [];

    rows.forEach((row, index) => {
      const itemOverride = this.getItemOverride(invoiceOverride, row.rowNumber);

      const rowItemName =
        itemOverride?.name ?? getRowMappedText(row, "itemName") ?? config.defaults.defaultItemName;
      if (rowItemName) {
        addResolvedField(
          itemOverride?.name
            ? "itemName"
            : getRowMappedText(row, "itemName")
              ? "itemName"
              : "defaultItemName",
          rowItemName,
          itemOverride?.name ? "manual" : getRowMappedText(row, "itemName") ? "excel" : "default"
        );
      } else {
        addMissingField(config.mapping.itemName ? "itemName" : "defaultItemName");
      }

      const rowItemDescription =
        itemOverride?.description ??
        getRowMappedText(row, "itemDescription") ??
        config.defaults.defaultItemDescription;
      if (rowItemDescription) {
        addResolvedField(
          itemOverride?.description
            ? "itemDescription"
            : getRowMappedText(row, "itemDescription")
              ? "itemDescription"
              : "defaultItemDescription",
          rowItemDescription,
          itemOverride?.description
            ? "manual"
            : getRowMappedText(row, "itemDescription")
              ? "excel"
              : "default"
        );
      }

      const rowProductCode = itemOverride?.productCode ?? getRowMappedText(row, "itemProductCode");
      if (rowProductCode) {
        addResolvedField("itemProductCode", rowProductCode, itemOverride?.productCode ? "manual" : "excel");
      }

      const rowItemUnit =
        itemOverride?.unit ?? getRowMappedText(row, "itemUnit") ?? config.defaults.defaultItemUnit;
      if (rowItemUnit) {
        addResolvedField(
          itemOverride?.unit
            ? "itemUnit"
            : getRowMappedText(row, "itemUnit")
              ? "itemUnit"
              : "defaultItemUnit",
          rowItemUnit,
          itemOverride?.unit ? "manual" : getRowMappedText(row, "itemUnit") ? "excel" : "default"
        );
      } else {
        addMissingField(config.mapping.itemUnit ? "itemUnit" : "defaultItemUnit");
      }

      const rowQuantity =
        itemOverride?.quantity ??
        parseRowNumberValue(row, "itemQuantity") ??
        config.defaults.defaultItemQuantity;
      if (rowQuantity !== undefined) {
        addResolvedField(
          itemOverride?.quantity !== undefined
            ? "itemQuantity"
            : getRowMappedText(row, "itemQuantity")
              ? "itemQuantity"
              : "defaultItemQuantity",
          rowQuantity,
          itemOverride?.quantity !== undefined
            ? "manual"
            : getRowMappedText(row, "itemQuantity")
              ? "excel"
              : "default"
        );
      } else {
        addMissingField(config.mapping.itemQuantity ? "itemQuantity" : "defaultItemQuantity");
      }

      const rowNet = parseRowNumberValue(row, "netTotal");
      const rowVat = parseRowNumberValue(row, "vatTotal");
      const rowUnitNetPrice = itemOverride?.unitNetPrice ?? parseRowNumberValue(row, "itemUnitNetPrice");

      let effectiveUnitNetPrice: number | undefined;
      if (rowUnitNetPrice !== undefined) {
        effectiveUnitNetPrice = rowUnitNetPrice;
        addResolvedField(
          "itemUnitNetPrice",
          effectiveUnitNetPrice,
          itemOverride?.unitNetPrice !== undefined ? "manual" : "excel"
        );
      } else if (rowNet !== undefined && rowQuantity !== undefined && rowQuantity > 0) {
        effectiveUnitNetPrice = this.roundMoney(rowNet / rowQuantity);
        addResolvedField("itemUnitNetPrice", effectiveUnitNetPrice, "derived");
      } else if (
        rows.length === 1 &&
        mappedUnitNetPrice !== undefined &&
        rowQuantity !== undefined &&
        rowQuantity > 0
      ) {
        effectiveUnitNetPrice = mappedUnitNetPrice;
        addResolvedField("itemUnitNetPrice", effectiveUnitNetPrice, "excel");
      }

      if (effectiveUnitNetPrice === undefined) {
        addMissingField("itemUnitNetPrice");
      }

      let rowTaxRate: KsefTaxRateValue | undefined = itemOverride?.taxRate;
      if (rowTaxRate) {
        addResolvedField("itemTaxRate", rowTaxRate, "manual");
      } else {
        const mappedTaxRate = getRowMappedText(row, "itemTaxRate");
        if (mappedTaxRate) {
          const normalizedTaxRate = this.normalizeFlexibleTaxRateInput(mappedTaxRate);
          if (!normalizedTaxRate) {
            buildErrors.push(
              `Wiersz ${row.rowNumber}: nieobslugiwana stawka VAT '${mappedTaxRate}'.`
            );
          } else {
            rowTaxRate = normalizedTaxRate;
            addResolvedField("itemTaxRate", rowTaxRate, "excel");
          }
        } else if (config.defaults.defaultTaxRate) {
          rowTaxRate = config.defaults.defaultTaxRate;
          addResolvedField("defaultTaxRate", rowTaxRate, "default");
        } else if (
          config.options.deriveTaxRateFromAmounts &&
          rowNet !== undefined &&
          rowVat !== undefined
        ) {
          rowTaxRate = this.deriveTaxRateFromAmounts(rowNet, rowVat);
          if (rowTaxRate) {
            addResolvedField("itemTaxRate", rowTaxRate, "derived");
          }
        }
      }

      if (!rowTaxRate) {
        addMissingField(config.mapping.itemTaxRate ? "itemTaxRate" : "defaultTaxRate");
      }

      previewItems.push({
        rowNumber: row.rowNumber,
        name: rowItemName,
        description: rowItemDescription,
        productCode: rowProductCode,
        quantity: rowQuantity,
        unit: rowItemUnit,
        unitNetPrice: effectiveUnitNetPrice,
        taxRate: rowTaxRate
      });

      if (
        !rowItemName ||
        !rowItemUnit ||
        rowQuantity === undefined ||
        effectiveUnitNetPrice === undefined ||
        !rowTaxRate
      ) {
        return;
      }

      builtItems.push({
        name: rowItemName,
        description: rowItemDescription,
        productCode: rowProductCode,
        unit: rowItemUnit,
        quantity: rowQuantity,
        unitNetPrice: effectiveUnitNetPrice,
        taxRate: rowTaxRate as KsefTaxRateValue,
        annex15: config.defaults.annex15
      });

      if (index === 0 && netTotal === undefined && rowNet !== undefined) {
        netTotal = rowNet;
      }
    });

    const sourceRowNumbers = new Set(rows.map((row) => row.rowNumber));
    const extraItemOverrides =
      invoiceOverride?.items.filter((itemOverride) => !sourceRowNumbers.has(itemOverride.rowNumber)) ??
      [];

    extraItemOverrides.forEach((itemOverride) => {
      const extraItemName = itemOverride.name ?? config.defaults.defaultItemName;
      if (extraItemName) {
        addResolvedField(
          itemOverride.name ? "itemName" : "defaultItemName",
          extraItemName,
          itemOverride.name ? "manual" : "default"
        );
      } else {
        addMissingField(config.mapping.itemName ? "itemName" : "defaultItemName");
      }

      const extraItemDescription =
        itemOverride.description ?? config.defaults.defaultItemDescription;
      if (extraItemDescription) {
        addResolvedField(
          itemOverride.description ? "itemDescription" : "defaultItemDescription",
          extraItemDescription,
          itemOverride.description ? "manual" : "default"
        );
      }

      const extraProductCode = itemOverride.productCode;
      if (extraProductCode) {
        addResolvedField("itemProductCode", extraProductCode, "manual");
      }

      const extraItemUnit = itemOverride.unit ?? config.defaults.defaultItemUnit;
      if (extraItemUnit) {
        addResolvedField(
          itemOverride.unit ? "itemUnit" : "defaultItemUnit",
          extraItemUnit,
          itemOverride.unit ? "manual" : "default"
        );
      } else {
        addMissingField(config.mapping.itemUnit ? "itemUnit" : "defaultItemUnit");
      }

      const extraQuantity = itemOverride.quantity ?? config.defaults.defaultItemQuantity;
      if (extraQuantity !== undefined) {
        addResolvedField(
          itemOverride.quantity !== undefined ? "itemQuantity" : "defaultItemQuantity",
          extraQuantity,
          itemOverride.quantity !== undefined ? "manual" : "default"
        );
      } else {
        addMissingField(config.mapping.itemQuantity ? "itemQuantity" : "defaultItemQuantity");
      }

      const extraUnitNetPrice = itemOverride.unitNetPrice;
      if (extraUnitNetPrice !== undefined) {
        addResolvedField("itemUnitNetPrice", extraUnitNetPrice, "manual");
      } else {
        addMissingField("itemUnitNetPrice");
      }

      let extraTaxRate = itemOverride.taxRate;
      if (extraTaxRate) {
        addResolvedField("itemTaxRate", extraTaxRate, "manual");
      } else if (config.defaults.defaultTaxRate) {
        extraTaxRate = config.defaults.defaultTaxRate;
        addResolvedField("defaultTaxRate", extraTaxRate, "default");
      }

      if (!extraTaxRate) {
        addMissingField(config.mapping.itemTaxRate ? "itemTaxRate" : "defaultTaxRate");
      }

      previewItems.push({
        rowNumber: itemOverride.rowNumber,
        name: extraItemName,
        description: extraItemDescription,
        productCode: extraProductCode,
        quantity: extraQuantity,
        unit: extraItemUnit,
        unitNetPrice: extraUnitNetPrice,
        taxRate: extraTaxRate
      });

      if (
        !extraItemName ||
        !extraItemUnit ||
        extraQuantity === undefined ||
        extraUnitNetPrice === undefined ||
        !extraTaxRate
      ) {
        return;
      }

      builtItems.push({
        name: extraItemName,
        description: extraItemDescription,
        productCode: extraProductCode,
        unit: extraItemUnit,
        quantity: extraQuantity,
        unitNetPrice: extraUnitNetPrice,
        taxRate: extraTaxRate as KsefTaxRateValue,
        annex15: config.defaults.annex15
      });
    });

    const paymentDueDateRaw = invoiceOverride?.paymentDueDate ?? resolveMappedText("paymentDueDate");
    let paymentDueDate: string | undefined;
    if (paymentDueDateRaw) {
      try {
        paymentDueDate = this.parseDateString(
          paymentDueDateRaw,
          firstRow.rowNumber,
          "payment_due_date",
          false
        );
        addResolvedField(
          "paymentDueDate",
          paymentDueDate,
          invoiceOverride?.paymentDueDate ? "manual" : "excel"
        );
      } catch (error) {
        buildErrors.push(error instanceof Error ? error.message : "Niepoprawny termin platnosci.");
      }
    }

    const exemptionReason =
      invoiceOverride?.exemptionReason ?? resolveMappedText("exemptionReason");
    if (exemptionReason) {
      addResolvedField(
        "exemptionReason",
        exemptionReason,
        invoiceOverride?.exemptionReason ? "manual" : "excel"
      );
    }

    const paymentMethodRaw = invoiceOverride?.paymentMethod ?? resolveMappedText("paymentMethod");
    const paymentMethod =
      this.normalizeFlexiblePaymentMethodInput(paymentMethodRaw) ?? config.defaults.paymentMethod;
    if (paymentMethodRaw && !paymentMethod) {
      buildErrors.push(`Nieobslugiwana forma platnosci: '${paymentMethodRaw}'.`);
    } else if (paymentMethod) {
      addResolvedField(
        "paymentMethod",
        paymentMethod,
        invoiceOverride?.paymentMethod ? "manual" : paymentMethodRaw ? "excel" : "default"
      );
    }

    const paymentBankAccount =
      invoiceOverride?.paymentBankAccount ??
      resolveMappedText("paymentBankAccount") ??
      config.defaults.paymentBankAccount;
    if (paymentBankAccount) {
      addResolvedField(
        "paymentBankAccount",
        paymentBankAccount,
        invoiceOverride?.paymentBankAccount
          ? "manual"
          : config.mapping.paymentBankAccount
            ? "excel"
            : "default"
      );
    }

    const preview = {
      buyerName: counterpartyName,
      buyerNip: counterpartyNip,
      buyerAddressLine1: counterpartyAddressLine1,
      buyerAddressLine2: counterpartyAddressLine2,
      buyerCountryCode: counterpartyCountryCode,
      issueDate,
      saleDate,
      currency,
      exemptionReason,
      paymentDueDate,
      paymentMethod,
      paymentBankAccount,
      items: previewItems,
      netTotal,
      vatTotal,
      grossTotal
    };

    const displayInvoiceNumber =
      invoiceNumber?.trim() || `Draft z wierszy ${rows.map((row) => row.rowNumber).join(", ")}`;

    if (buildErrors.length > 0) {
      return {
        valid: false,
        xml: null,
        fileName: null,
        schema: {
          code: "FA(3)",
          version: "1-0E"
        },
        businessErrors: buildErrors,
        schemaErrors: [],
        warnings: [],
        summary: null,
        invoiceNumber: displayInvoiceNumber,
        rowNumbers: rows.map((row) => row.rowNumber),
        status: "invalid",
        resolvedFields: Array.from(resolvedFields.values()),
        missingFields: Array.from(missingFields.values()),
        preview
      };
    }

    if (
      missingFields.size > 0 ||
      !issueDate ||
      !myCompanyNip ||
      !myCompanyName ||
      !myCompanyCountryCode ||
      !myCompanyAddressLine1 ||
      !counterpartyName ||
      (myCompanyRole === "BUYER" && !counterpartyNip) ||
      (myCompanyRole === "BUYER" && !counterpartyAddressLine1) ||
      builtItems.length === 0 ||
      !invoiceNumber
    ) {
      return {
        valid: false,
        xml: null,
        fileName: null,
        schema: {
          code: "FA(3)",
          version: "1-0E"
        },
        businessErrors: [
          `Brakuje danych potrzebnych do wygenerowania XML: ${Array.from(missingFields.values())
            .map((field) => field.label)
            .join(", ")}.`
        ],
        schemaErrors: [],
        warnings: [],
        summary: null,
        invoiceNumber: displayInvoiceNumber,
        rowNumbers: rows.map((row) => row.rowNumber),
        status: "needs_completion",
        resolvedFields: Array.from(resolvedFields.values()),
        missingFields: Array.from(missingFields.values()),
        preview
      };
    }

    if (builtItems.some((item) => item.taxRate === "zw") && !exemptionReason) {
      addMissingField("exemptionReason");

      return {
        valid: false,
        xml: null,
        fileName: null,
        schema: {
          code: "FA(3)",
          version: "1-0E"
        },
        businessErrors: [
          "Brakuje danych potrzebnych do wygenerowania XML: Podstawa zwolnienia z VAT."
        ],
        schemaErrors: [],
        warnings: [],
        summary: null,
        invoiceNumber: displayInvoiceNumber,
        rowNumbers: rows.map((row) => row.rowNumber),
        status: "needs_completion",
        resolvedFields: Array.from(resolvedFields.values()),
        missingFields: Array.from(missingFields.values()),
        preview
      };
    }

    const payload: GenerateKsefXmlDto = {
      seller:
        myCompanyRole === "SELLER"
          ? {
              nip: myCompanyNip,
              name: myCompanyName,
              address: {
                countryCode: myCompanyCountryCode,
                line1: myCompanyAddressLine1,
                line2: config.defaults.sellerAddressLine2
              },
              email: config.defaults.sellerEmail,
              phone: config.defaults.sellerPhone
            }
          : {
              nip: counterpartyNip!,
              name: counterpartyName!,
              address: {
                countryCode: counterpartyCountryCode,
                line1: counterpartyAddressLine1!,
                line2: counterpartyAddressLine2
              }
            },
      buyer:
        myCompanyRole === "SELLER"
          ? {
              identifierType: buyerIdentifierType,
              nip: buyerIdentifierType === "NIP" ? counterpartyNip : undefined,
              name: counterpartyName,
              address: counterpartyAddressLine1
                ? {
                    countryCode: counterpartyCountryCode,
                    line1: counterpartyAddressLine1,
                    line2: counterpartyAddressLine2
                  }
                : undefined
            }
          : {
              identifierType: buyerIdentifierType,
              nip: buyerIdentifierType === "NIP" ? myCompanyNip : undefined,
              name: myCompanyName,
              address: {
                countryCode: myCompanyCountryCode,
                line1: myCompanyAddressLine1,
                line2: config.defaults.sellerAddressLine2
              },
              email: config.defaults.sellerEmail,
              phone: config.defaults.sellerPhone
            },
      issueDate,
      saleDate,
      invoiceNumber,
      placeOfIssue: config.defaults.placeOfIssue,
      currency,
      cashAccounting: config.defaults.cashAccounting,
      selfBilling: config.defaults.selfBilling,
      splitPayment: config.defaults.splitPayment,
      simplifiedProcedure: config.defaults.simplifiedProcedure,
      relatedEntities: config.defaults.relatedEntities,
      exemptionReason,
      systemName: config.defaults.systemName ?? "Kasia KSeF XML Generator",
      payment:
        paymentDueDate || paymentMethod || paymentBankAccount
          ? {
              dueDate: paymentDueDate,
              method: paymentMethod,
              bankAccount: paymentBankAccount
            }
          : undefined,
      items: builtItems
    };

    const generated = await this.generateXml(payload);

    return {
      ...generated,
      invoiceNumber,
      rowNumbers: rows.map((row) => row.rowNumber),
      status: generated.valid ? "generated" : "invalid",
      resolvedFields: Array.from(resolvedFields.values()),
      missingFields: Array.from(missingFields.values()),
      preview
    };
  }

  private deriveTaxRateFromAmounts(netTotal: number, vatTotal: number): KsefTaxRateValue | undefined {
    if (netTotal <= 0) {
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

  private buildPayloadFromExcelRows(rows: KsefNormalizedExcelRow[]): GenerateKsefXmlDto {
    const firstRow = rows[0];
    const invoiceLevelColumns = [
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
      "payment_bank_account"
    ] as const;

    const consistencyErrors = this.checkInvoiceLevelConsistency(rows, invoiceLevelColumns);
    if (consistencyErrors.length > 0) {
      throw new BadRequestException(consistencyErrors.join(" "));
    }

    const buyerIdentifierType = this.parseBuyerIdentifierType(
      firstRow.values.buyer_identifier_type,
      firstRow.rowNumber
    );
    const paymentMethod = this.parsePaymentMethod(
      firstRow.values.payment_method,
      firstRow.rowNumber
    );

    return {
      seller: {
        nip: firstRow.values.seller_nip,
        name: firstRow.values.seller_name,
        address: {
          countryCode: firstRow.values.seller_country_code,
          line1: firstRow.values.seller_address_line1,
          line2: this.optionalExcelText(firstRow.values.seller_address_line2)
        },
        email: this.optionalExcelText(firstRow.values.seller_email),
        phone: this.optionalExcelText(firstRow.values.seller_phone)
      },
      buyer: {
        identifierType: buyerIdentifierType,
        nip: this.optionalExcelText(firstRow.values.buyer_nip),
        euCode: this.optionalExcelText(firstRow.values.buyer_eu_code),
        euVatNumber: this.optionalExcelText(firstRow.values.buyer_eu_vat_number),
        taxCountryCode: this.optionalExcelText(firstRow.values.buyer_tax_country_code),
        taxId: this.optionalExcelText(firstRow.values.buyer_tax_id),
        name: firstRow.values.buyer_name,
        address: this.optionalExcelText(firstRow.values.buyer_address_line1)
          ? {
              countryCode: this.optionalExcelText(firstRow.values.buyer_country_code) ?? "PL",
              line1: firstRow.values.buyer_address_line1,
              line2: this.optionalExcelText(firstRow.values.buyer_address_line2)
            }
          : undefined,
        email: this.optionalExcelText(firstRow.values.buyer_email),
        phone: this.optionalExcelText(firstRow.values.buyer_phone)
      },
      issueDate: this.parseDateString(firstRow.values.issue_date, firstRow.rowNumber, "issue_date", true)!,
      saleDate: this.parseDateString(firstRow.values.sale_date, firstRow.rowNumber, "sale_date", false),
      invoiceNumber: firstRow.values.invoice_number,
      placeOfIssue: this.optionalExcelText(firstRow.values.place_of_issue),
      currency: this.optionalExcelText(firstRow.values.currency) ?? "PLN",
      cashAccounting: this.parseBoolean(firstRow.values.cash_accounting),
      selfBilling: this.parseBoolean(firstRow.values.self_billing),
      splitPayment: this.parseBoolean(firstRow.values.split_payment),
      simplifiedProcedure: this.parseBoolean(firstRow.values.simplified_procedure),
      relatedEntities: this.parseBoolean(firstRow.values.related_entities),
      exemptionReason: this.optionalExcelText(firstRow.values.exemption_reason),
      systemName:
        this.optionalExcelText(firstRow.values.system_name) ?? "Kasia KSeF XML Generator",
      payment:
        this.optionalExcelText(firstRow.values.payment_due_date) ||
        paymentMethod ||
        this.optionalExcelText(firstRow.values.payment_bank_account)
          ? {
              dueDate: this.parseDateString(
                firstRow.values.payment_due_date,
                firstRow.rowNumber,
                "payment_due_date",
                false
              ),
              method: paymentMethod,
              bankAccount: this.optionalExcelText(firstRow.values.payment_bank_account)
            }
          : undefined,
      items: rows.map((row) => this.buildInvoiceItemFromExcelRow(row))
    };
  }

  private buildInvoiceItemFromExcelRow(row: KsefNormalizedExcelRow): KsefInvoiceItemDto {
    const taxRate = this.parseTaxRate(row.values.item_tax_rate, row.rowNumber);
    const quantity = this.parseNumber(row.values.item_quantity, row.rowNumber, "item_quantity");
    const unitNetPrice = this.parseNumber(
      row.values.item_unit_net_price,
      row.rowNumber,
      "item_unit_net_price"
    );

    return {
      name: row.values.item_name,
      description: this.optionalExcelText(row.values.item_description),
      productCode: this.optionalExcelText(row.values.item_product_code),
      unit: row.values.item_unit,
      quantity,
      unitNetPrice,
      taxRate,
      annex15: this.parseBoolean(row.values.item_annex15)
    };
  }

  private checkInvoiceLevelConsistency(
    rows: KsefNormalizedExcelRow[],
    columns: readonly string[]
  ) {
    const errors: string[] = [];
    const firstRow = rows[0];

    for (const column of columns) {
      const expectedValue = (firstRow.values[column] ?? "").trim();
      for (const row of rows.slice(1)) {
        const currentValue = (row.values[column] ?? "").trim();
        if (currentValue !== expectedValue) {
          errors.push(
            `Invoice ${firstRow.values.invoice_number} has inconsistent value for ${column} between rows ${firstRow.rowNumber} and ${row.rowNumber}.`
          );
          break;
        }
      }
    }

    return errors;
  }

  private normalizeExcelHeader(value: string) {
    const polishNormalized = value.replace(
      /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g,
      (char) =>
        ({
          ą: "a",
          ć: "c",
          ę: "e",
          ł: "l",
          ń: "n",
          ó: "o",
          ś: "s",
          ź: "z",
          ż: "z",
          Ą: "A",
          Ć: "C",
          Ę: "E",
          Ł: "L",
          Ń: "N",
          Ó: "O",
          Ś: "S",
          Ź: "Z",
          Ż: "Z"
        })[char] ?? char
    );

    return polishNormalized
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  private optionalExcelText(value: string | undefined) {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
  }

  private parseBoolean(value: string | undefined) {
    const normalized = value?.trim().toLowerCase();
    if (!normalized) {
      return false;
    }

    return ["1", "true", "tak", "yes", "y"].includes(normalized);
  }

  private parseBuyerIdentifierType(
    value: string | undefined,
    rowNumber: number
  ): GenerateKsefXmlDto["buyer"]["identifierType"] {
    const normalized = value?.trim().toUpperCase();
    if (!normalized) {
      throw new BadRequestException(`Row ${rowNumber}: buyer_identifier_type is required.`);
    }

    if (KSEF_BUYER_IDENTIFIER_TYPES.includes(normalized as GenerateKsefXmlDto["buyer"]["identifierType"])) {
      return normalized as GenerateKsefXmlDto["buyer"]["identifierType"];
    }

    throw new BadRequestException(
      `Row ${rowNumber}: unsupported buyer_identifier_type '${value}'.`
    );
  }

  private parsePaymentMethod(
    value: string | undefined,
    rowNumber: number
  ): NonNullable<GenerateKsefXmlDto["payment"]>["method"] | undefined {
    const normalized = value?.trim();
    if (!normalized) {
      return undefined;
    }

    if (KSEF_PAYMENT_METHOD_VALUES.includes(normalized as (typeof KSEF_PAYMENT_METHOD_VALUES)[number])) {
      return normalized as (typeof KSEF_PAYMENT_METHOD_VALUES)[number];
    }

    throw new BadRequestException(`Row ${rowNumber}: unsupported payment_method '${value}'.`);
  }

  private parseTaxRate(value: string | undefined, rowNumber: number) {
    const normalized = value?.trim();
    if (!normalized) {
      throw new BadRequestException(`Row ${rowNumber}: item_tax_rate is required.`);
    }

    if (KSEF_TAX_RATE_VALUES.includes(normalized as KsefTaxRateValue)) {
      return normalized as KsefTaxRateValue;
    }

    throw new BadRequestException(`Row ${rowNumber}: unsupported item_tax_rate '${value}'.`);
  }

  private parseNumber(value: string | undefined, rowNumber: number, fieldName: string) {
    const normalized = this.normalizeSpreadsheetNumber(value);
    if (!normalized) {
      throw new BadRequestException(`Row ${rowNumber}: ${fieldName} is required.`);
    }

    const parsed = Number(normalized);
    if (!Number.isFinite(parsed)) {
      throw new BadRequestException(
        `Row ${rowNumber}: ${fieldName} must be a valid number.`
      );
    }

    return parsed;
  }

  private normalizeSpreadsheetNumber(value: string | undefined) {
    const raw = value?.trim().replace(/\s+/g, "");
    if (!raw) {
      return "";
    }

    const hasComma = raw.includes(",");
    const hasDot = raw.includes(".");
    if (hasComma && hasDot) {
      const lastComma = raw.lastIndexOf(",");
      const lastDot = raw.lastIndexOf(".");
      if (lastComma > lastDot) {
        return raw.replace(/\./g, "").replace(",", ".");
      }

      return raw.replace(/,/g, "");
    }

    if (hasComma) {
      const decimalLike = /,\d{1,8}$/.test(raw);
      return decimalLike ? raw.replace(",", ".") : raw.replace(/,/g, "");
    }

    return raw;
  }

  private parseDateString(
    value: string | undefined,
    rowNumber: number,
    fieldName: string,
    required: boolean
  ) {
    const normalized = value?.trim();
    if (!normalized) {
      if (required) {
        throw new BadRequestException(`Row ${rowNumber}: ${fieldName} is required.`);
      }

      return undefined;
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
      return normalized;
    }

    const dotOrSlashDayFirst = normalized.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
    if (dotOrSlashDayFirst) {
      const [, day, month, year] = dotOrSlashDayFirst;
      return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    }

    const slashMonthFirst = normalized.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (slashMonthFirst) {
      const [, month, day, yearRaw] = slashMonthFirst;
      const year =
        yearRaw.length === 2
          ? String(Number(yearRaw) >= 70 ? 1900 + Number(yearRaw) : 2000 + Number(yearRaw))
          : yearRaw;

      return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    }

    throw new BadRequestException(
      `Row ${rowNumber}: ${fieldName} must be in YYYY-MM-DD, DD.MM.YYYY or MM/DD/YY format.`
    );
  }

  private async validateXmlAgainstSchema(xml: string): Promise<SchemaValidationError[]> {
    try {
      const schemaFiles = await this.schemaFilesPromise;
      const validation = await validateXML({
        xml: [{ fileName: "invoice.xml", contents: xml }],
        schema: [
          {
            fileName: MAIN_SCHEMA_FILE,
            contents: schemaFiles[MAIN_SCHEMA_FILE]
          }
        ],
        preload: PRELOADED_SCHEMA_FILES.map((fileName) => ({
          fileName,
          contents: schemaFiles[fileName]
        }))
      });

      if (validation.valid) {
        return [];
      }

      return validation.errors.map((error) => ({
        message: error.message,
        lineNumber: error.loc?.lineNumber ?? null
      }));
    } catch (error) {
      return [
        {
          message:
            error instanceof Error
              ? `Schema validation failed unexpectedly: ${error.message}`
              : "Schema validation failed unexpectedly.",
          lineNumber: null
        }
      ];
    }
  }

  private async loadSchemaFiles() {
    const schemaDir = this.resolveSchemaDirectory();
    const entries = await Promise.all(
      Object.entries(SCHEMA_FILE_NAMES).map(async ([location, fileName]) => {
        const contents = await readFile(join(schemaDir, fileName), "utf8");
        return [location, contents] as const;
      })
    );

    return Object.fromEntries(entries) as Record<string, string>;
  }

  private resolveSchemaDirectory() {
    const candidateDirs = [
      join(process.cwd(), "src", "ksef", "schemas"),
      join(__dirname, "schemas")
    ];

    const foundDir = candidateDirs.find((candidate) => existsSync(candidate));
    if (!foundDir) {
      throw new Error("KSeF schema directory was not found.");
    }

    return foundDir;
  }

  private normalizePayload(payload: GenerateKsefXmlDto) {
    const currency = (payload.currency ?? "PLN").toUpperCase();
    const generatedAt = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
    const items = payload.items.map<GeneratedItem>((item, index) => {
      const netValue = this.roundMoney(item.quantity * item.unitNetPrice);
      const taxValue = this.roundMoney((netValue * this.getNumericTaxRate(item.taxRate)) / 100);
      const grossValue = this.roundMoney(netValue + taxValue);

      return {
        ...item,
        lineNumber: index + 1,
        quantityFormatted: this.formatQuantity(item.quantity),
        unitNetPriceFormatted: this.formatQuantity(item.unitNetPrice),
        netValue,
        taxValue,
        grossValue,
        netValueFormatted: this.formatMoney(netValue)
      };
    });

    const taxBreakdownMap = new Map<KsefTaxRateValue, TaxSummary>();
    for (const item of items) {
      const existing = taxBreakdownMap.get(item.taxRate);
      if (existing) {
        existing.net = this.roundMoney(existing.net + item.netValue);
        existing.tax = this.roundMoney(existing.tax + item.taxValue);
        existing.gross = this.roundMoney(existing.gross + item.grossValue);
      } else {
        taxBreakdownMap.set(item.taxRate, {
          taxRate: item.taxRate,
          net: item.netValue,
          tax: item.taxValue,
          gross: item.grossValue
        });
      }
    }

    const netTotal = this.roundMoney(items.reduce((sum, item) => sum + item.netValue, 0));
    const taxTotal = this.roundMoney(items.reduce((sum, item) => sum + item.taxValue, 0));
    const grossTotal = this.roundMoney(netTotal + taxTotal);

    return {
      ...payload,
      currency,
      generatedAt,
      items,
      netTotal,
      taxTotal,
      grossTotal,
      hasExemptItems: items.some((item) => item.taxRate === "zw"),
      hasReverseChargeItems: items.some((item) => item.taxRate === "oo"),
      taxBreakdown: Array.from(taxBreakdownMap.values())
    };
  }

  private buildXml(payload: ReturnType<KsefService["normalizePayload"]>) {
    const summaryFields = this.buildSummaryFields(payload.items);
    const root = createNode(
      "Faktura",
      [
        this.buildHeader(payload.generatedAt, payload.systemName),
        this.buildSellerNode(payload.seller),
        this.buildBuyerNode(payload.buyer),
        this.buildInvoiceNode(payload, summaryFields)
      ],
      {
        xmlns: "http://crd.gov.pl/wzor/2025/06/25/13775/",
        "xmlns:etd":
          "http://crd.gov.pl/xml/schematy/dziedzinowe/mf/2022/01/05/eD/DefinicjeTypy/"
      }
    );

    return renderXmlDocument(root);
  }

  private buildHeader(generatedAt: string, systemName?: string) {
    return createNode("Naglowek", [
      createNode("KodFormularza", ["FA"], {
        kodSystemowy: "FA (3)",
        wersjaSchemy: "1-0E"
      }),
      createNode("WariantFormularza", ["3"]),
      createNode("DataWytworzeniaFa", [generatedAt]),
      createNode("SystemInfo", [systemName?.trim() || "Kasia KSeF XML Generator"])
    ]);
  }

  private buildSellerNode(seller: GenerateKsefXmlDto["seller"]) {
    return createNode("Podmiot1", [
      createNode("DaneIdentyfikacyjne", [
        createNode("NIP", [seller.nip]),
        createNode("Nazwa", [seller.name.trim()])
      ]),
      this.buildAddressNode("Adres", seller.address),
      seller.email || seller.phone
        ? createNode("DaneKontaktowe", [
            seller.email ? createNode("Email", [seller.email.trim()]) : null,
            seller.phone ? createNode("Telefon", [this.normalizePhone(seller.phone)]) : null
          ])
        : null
    ]);
  }

  private buildBuyerNode(buyer: GenerateKsefXmlDto["buyer"]) {
    const identifierChildren: XmlNode[] = [];
    if (buyer.identifierType === "NIP") {
      identifierChildren.push(createNode("NIP", [buyer.nip!.trim()]));
    } else if (buyer.identifierType === "EU_VAT") {
      identifierChildren.push(
        createNode("KodUE", [buyer.euCode!.trim().toUpperCase()]),
        createNode("NrVatUE", [buyer.euVatNumber!.trim().toUpperCase()])
      );
    } else if (buyer.identifierType === "OTHER") {
      if (buyer.taxCountryCode) {
        identifierChildren.push(createNode("KodKraju", [buyer.taxCountryCode.trim().toUpperCase()]));
      }
      identifierChildren.push(createNode("NrID", [buyer.taxId!.trim()]));
    } else {
      identifierChildren.push(createNode("BrakID", ["1"]));
    }

    return createNode("Podmiot2", [
      createNode("DaneIdentyfikacyjne", [...identifierChildren, createNode("Nazwa", [buyer.name.trim()])]),
      buyer.address ? this.buildAddressNode("Adres", buyer.address) : null,
      buyer.email || buyer.phone
        ? createNode("DaneKontaktowe", [
            buyer.email ? createNode("Email", [buyer.email.trim()]) : null,
            buyer.phone ? createNode("Telefon", [this.normalizePhone(buyer.phone)]) : null
          ])
        : null,
      createNode("JST", ["2"]),
      createNode("GV", ["2"])
    ]);
  }

  private buildInvoiceNode(
    payload: ReturnType<KsefService["normalizePayload"]>,
    summaryFields: XmlNode[]
  ) {
    return createNode("Fa", [
      createNode("KodWaluty", [payload.currency]),
      createNode("P_1", [payload.issueDate]),
      payload.placeOfIssue ? createNode("P_1M", [payload.placeOfIssue.trim()]) : null,
      createNode("P_2", [payload.invoiceNumber.trim()]),
      payload.saleDate ? createNode("P_6", [payload.saleDate]) : null,
      ...summaryFields,
      createNode("P_15", [this.formatMoney(payload.grossTotal)]),
      createNode("Adnotacje", [
        createNode("P_16", [payload.cashAccounting ? "1" : "2"]),
        createNode("P_17", [payload.selfBilling ? "1" : "2"]),
        createNode("P_18", [payload.hasReverseChargeItems ? "1" : "2"]),
        createNode("P_18A", [payload.splitPayment ? "1" : "2"]),
        payload.hasExemptItems
          ? createNode("Zwolnienie", [
              createNode("P_19", ["1"]),
              createNode("P_19A", [payload.exemptionReason!.trim()])
            ])
          : createNode("Zwolnienie", [createNode("P_19N", ["1"])]),
        createNode("NoweSrodkiTransportu", [createNode("P_22N", ["1"])]),
        createNode("P_23", [payload.simplifiedProcedure ? "1" : "2"]),
        createNode("PMarzy", [createNode("P_PMarzyN", ["1"])])
      ]),
      createNode("RodzajFaktury", ["VAT"]),
      payload.relatedEntities ? createNode("TP", ["1"]) : null,
      ...payload.items.flatMap((item) => this.buildItemDescriptionNodes(item)),
      ...payload.items.map((item) => this.buildItemNode(item)),
      payload.payment ? this.buildPaymentNode(payload.payment) : null
    ]);
  }

  private buildItemNode(item: GeneratedItem) {
    return createNode("FaWiersz", [
      createNode("NrWierszaFa", [item.lineNumber]),
      createNode("P_7", [item.name.trim()]),
      item.productCode ? createNode("Indeks", [item.productCode.trim()]) : null,
      createNode("P_8A", [item.unit.trim()]),
      createNode("P_8B", [item.quantityFormatted]),
      createNode("P_9A", [item.unitNetPriceFormatted]),
      createNode("P_11", [item.netValueFormatted]),
      createNode("P_12", [item.taxRate]),
      item.annex15 ? createNode("P_12_Zal_15", ["1"]) : null
    ]);
  }

  private buildItemDescriptionNodes(item: GeneratedItem) {
    if (!item.description?.trim()) {
      return [];
    }

    return [
      createNode("DodatkowyOpis", [
        createNode("NrWiersza", [item.lineNumber]),
        createNode("Klucz", ["Opis"]),
        createNode("Wartosc", [item.description.trim()])
      ])
    ];
  }

  private buildPaymentNode(payment: NonNullable<GenerateKsefXmlDto["payment"]>) {
    return createNode("Platnosc", [
      payment.dueDate
        ? createNode("TerminPlatnosci", [createNode("Termin", [payment.dueDate])])
        : null,
      payment.method ? createNode("FormaPlatnosci", [payment.method]) : null,
      payment.bankAccount
        ? createNode("RachunekBankowy", [createNode("NrRB", [this.normalizeBankAccount(payment.bankAccount)])])
        : null
    ]);
  }

  private buildAddressNode(tagName: "Adres", address: KsefAddressDto) {
    return createNode(tagName, [
      createNode("KodKraju", [address.countryCode.trim().toUpperCase()]),
      createNode("AdresL1", [address.line1.trim()]),
      address.line2 ? createNode("AdresL2", [address.line2.trim()]) : null
    ]);
  }

  private buildSummaryFields(items: GeneratedItem[]) {
    const summaryValues = new Map<string, number>();
    for (const item of items) {
      const mapping = TAX_FIELD_MAPPING[item.taxRate];
      summaryValues.set(mapping.netField, this.roundMoney((summaryValues.get(mapping.netField) ?? 0) + item.netValue));
      if (mapping.taxField) {
        summaryValues.set(mapping.taxField, this.roundMoney((summaryValues.get(mapping.taxField) ?? 0) + item.taxValue));
      }
    }

    return [
      "P_13_1",
      "P_14_1",
      "P_13_2",
      "P_14_2",
      "P_13_3",
      "P_14_3",
      "P_13_4",
      "P_14_4",
      "P_13_6_1",
      "P_13_6_2",
      "P_13_6_3",
      "P_13_7",
      "P_13_8",
      "P_13_9",
      "P_13_10"
    ]
      .filter((field) => (summaryValues.get(field) ?? 0) > 0)
      .map((field) => createNode(field, [this.formatMoney(summaryValues.get(field) ?? 0)]));
  }

  private validateBusinessRules(payload: GenerateKsefXmlDto) {
    const errors: string[] = [];
    const warsawToday = this.getTodayInWarsaw();

    if (payload.issueDate > warsawToday) {
      errors.push(
        `Issue date ${payload.issueDate} cannot be later than today's date ${warsawToday}. KSeF rejects invoices dated in the future.`
      );
    }

    if (payload.saleDate && payload.saleDate > payload.issueDate) {
      errors.push("Sale date cannot be later than issue date in this generator.");
    }

    if (!this.isValidNip(payload.seller.nip)) {
      errors.push(`Seller NIP is invalid: ${payload.seller.nip}.`);
    }

    if (payload.buyer.identifierType === "NIP" && (!payload.buyer.nip || !this.isValidNip(payload.buyer.nip))) {
      errors.push(`Buyer NIP is invalid: ${payload.buyer.nip ?? "brak"}.`);
    }

    if (payload.buyer.identifierType === "EU_VAT" && (!payload.buyer.euCode || !payload.buyer.euVatNumber)) {
      errors.push("Buyer EU VAT identifier requires country code and VAT number.");
    }

    if (payload.buyer.identifierType === "OTHER" && !payload.buyer.taxId) {
      errors.push("Buyer identifier type OTHER requires taxId.");
    }

    if (payload.items.some((item) => item.taxRate === "zw") && !payload.exemptionReason?.trim()) {
      errors.push("Exempt items require an exemption legal basis.");
    }

    payload.items.forEach((item, index) => {
      if (!item.name.trim()) {
        errors.push(`Line ${index + 1}: item name is required.`);
      }
      if (!item.unit.trim()) {
        errors.push(`Line ${index + 1}: unit is required.`);
      }
      if (!Number.isFinite(item.quantity)) {
        errors.push(`Line ${index + 1}: quantity must be a valid number.`);
      }
      if (item.quantity <= 0) {
        errors.push(`Line ${index + 1}: quantity must be greater than zero.`);
      }
      if (!Number.isFinite(item.unitNetPrice)) {
        errors.push(`Line ${index + 1}: unit net price must be a valid number.`);
      }
      if (item.unitNetPrice < 0) {
        errors.push(`Line ${index + 1}: unit net price cannot be negative.`);
      }
    });

    if (payload.payment?.dueDate && payload.payment.dueDate < payload.issueDate) {
      errors.push("Payment due date cannot be earlier than issue date.");
    }

    return errors;
  }

  private buildWarnings(payload: GenerateKsefXmlDto) {
    const warnings: string[] = [];

    if (!payload.buyer.address) {
      warnings.push("Buyer address is optional in the schema, but some accounting workflows may still require it.");
    }

    if (!payload.payment?.method) {
      warnings.push("Payment section was omitted because no payment method was provided.");
    }

    if (payload.items.every((item) => !item.annex15) && payload.splitPayment) {
      warnings.push("Split payment was enabled manually while no line is marked as annex 15.");
    }

    return warnings;
  }

  private getNumericTaxRate(rate: KsefTaxRateValue) {
    const parsed = Number.parseInt(rate, 10);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private roundMoney(value: number) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  private formatMoney(value: number) {
    return this.roundMoney(value).toFixed(2);
  }

  private formatQuantity(value: number) {
    return value.toFixed(6).replace(/\.?0+$/, "");
  }

  private normalizePhone(value: string) {
    return value.replace(/\s+/g, " ").trim();
  }

  private normalizeBankAccount(value: string) {
    return value.replace(/\s+/g, "").trim();
  }

  private buildFileName(invoiceNumber: string) {
    const safeInvoiceNumber = invoiceNumber
      .trim()
      .replace(/[\\/:*?"<>|]+/g, "-")
      .replace(/\s+/g, "_");

    return `${safeInvoiceNumber || "faktura"}-FA3.xml`;
  }

  private getTodayInWarsaw() {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Warsaw",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    });

    return formatter.format(new Date());
  }

  private isValidNip(value: string) {
    const digits = value.replace(/\D/g, "");
    if (!/^\d{10}$/.test(digits)) {
      return false;
    }

    const weights = [6, 5, 7, 2, 3, 4, 5, 6, 7];
    const checksum =
      weights.reduce((sum, weight, index) => sum + weight * Number(digits[index]), 0) % 11;

    return checksum === Number(digits[9]);
  }
}
