const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? "http://localhost:4000";

export type HealthResponse = {
  status: string;
  service: string;
  now: string;
};

export type PingResponse = {
  ok: boolean;
  error?: string;
  bucketCount?: number;
  buckets?: Array<{ id: string; name: string }>;
};

export type AnalyzePayload = {
  fileName: string;
  rowCount: number;
};

export type AnalyzeResponse = {
  received: AnalyzePayload;
  supabase: {
    saved: boolean;
    error?: string;
    info?: string;
    row?: unknown;
  };
  requestedBy: {
    id: string;
    email: string | null;
  };
  analyzedAt: string;
};

export type UploadExcelResponse = {
  uploaded: boolean;
  error?: string;
  filesCount?: number;
  uploadedFiles?: Array<{
    sourceFileName: string;
    bucket?: string;
    file?: {
      path: string;
      originalName: string;
      mimeType: string;
      bytes: number;
    };
    signedUrl?: string | null;
    signedUrlError?: string | null;
  }>;
  analysisDraft?: {
    uploadId: string;
    apartments: string[];
    addresses: string[];
    availableMetrics: string[];
    periodRange: {
      min: string | null;
      max: string | null;
    };
    recordsCount: number;
    generatedAt: string;
    sourceFiles: string[];
    filesCount: number;
  } | null;
  analysisDraftError?: string | null;
};

export type BuildExcelSummaryPayload = {
  uploadId: string;
  apartment?: string;
  dateFrom?: string;
  dateTo?: string;
  metrics?: string[];
  includeValidation?: boolean;
  includeOnlyMismatches?: boolean;
  exportColumns?: string[];
  includeYearlySummary?: boolean;
  comparisonMonth?: number;
};

export type BuildExcelSummaryResponse = {
  uploadId: string;
  selected: {
    apartment: string | null;
    dateFrom: string | null;
    dateTo: string | null;
    metrics: string[];
    includeValidation: boolean;
    includeOnlyMismatches: boolean;
  };
  stats: {
    rowsCount: number;
    validRows: number;
    invalidRows: number;
  };
  totalsByMetric: Array<{
    metric: string;
    rowCount: number;
    totalConsumption: number;
    reportedTotal: number;
    computedTotal: number | null;
    difference: number | null;
  }>;
  rows: Array<{
    apartment: string;
    dateFrom: string;
    dateTo: string;
    metric: string;
    consumption: number | null;
    rate: number | null;
    reportedTotal: number | null;
    computedTotal: number | null;
    difference: number | null;
    isValid: boolean | null;
  }>;
};

export type ExportExcelSummaryResponse = {
  blob: Blob;
  fileName: string;
};

export type KsefBuyerIdentifierType = "NIP" | "EU_VAT" | "OTHER" | "NONE";
export type KsefPaymentMethodValue = "1" | "2" | "3" | "4" | "5" | "6" | "7";
export type KsefMyCompanyRole = "SELLER" | "BUYER";
export type KsefTaxRateValue =
  | "23"
  | "22"
  | "8"
  | "7"
  | "5"
  | "4"
  | "3"
  | "0 KR"
  | "0 WDT"
  | "0 EX"
  | "zw"
  | "oo"
  | "np I"
  | "np II";

export type KsefAddressPayload = {
  countryCode: string;
  line1: string;
  line2?: string;
};

export type KsefSellerPayload = {
  nip: string;
  name: string;
  address: KsefAddressPayload;
  email?: string;
  phone?: string;
};

export type KsefBuyerPayload = {
  identifierType: KsefBuyerIdentifierType;
  nip?: string;
  euCode?: string;
  euVatNumber?: string;
  taxCountryCode?: string;
  taxId?: string;
  name: string;
  address?: KsefAddressPayload;
  email?: string;
  phone?: string;
};

export type KsefPaymentPayload = {
  dueDate?: string;
  method?: KsefPaymentMethodValue;
  bankAccount?: string;
};

export type KsefInvoiceItemPayload = {
  name: string;
  description?: string;
  productCode?: string;
  unit: string;
  quantity: number;
  unitNetPrice: number;
  taxRate: KsefTaxRateValue;
  annex15?: boolean;
};

export type GenerateKsefXmlPayload = {
  seller: KsefSellerPayload;
  buyer: KsefBuyerPayload;
  issueDate: string;
  saleDate?: string;
  invoiceNumber: string;
  placeOfIssue?: string;
  currency?: string;
  cashAccounting?: boolean;
  selfBilling?: boolean;
  splitPayment?: boolean;
  simplifiedProcedure?: boolean;
  relatedEntities?: boolean;
  exemptionReason?: string;
  systemName?: string;
  payment?: KsefPaymentPayload;
  items: KsefInvoiceItemPayload[];
};

export type GenerateKsefXmlResponse = {
  valid: boolean;
  xml: string | null;
  fileName: string | null;
  schema: {
    code: "FA(3)";
    version: "1-0E";
  };
  businessErrors: string[];
  schemaErrors: Array<{
    message: string;
    lineNumber: number | null;
  }>;
  warnings: string[];
  summary: {
    issueDate: string;
    currency: string;
    lineCount: number;
    netTotal: number;
    taxTotal: number;
    grossTotal: number;
    taxBreakdown: Array<{
      taxRate: KsefTaxRateValue;
      net: number;
      tax: number;
      gross: number;
    }>;
  } | null;
};

export type KsefExcelImportInvoiceResponse = GenerateKsefXmlResponse & {
  invoiceNumber: string;
  rowNumbers: number[];
};

export type KsefExcelImportResponse = {
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
  invoices: KsefExcelImportInvoiceResponse[];
};

export type KsefExcelFlexibleFieldKey =
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

export type KsefExcelSupplementFieldKey =
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

export type AnalyzeKsefExcelResponse = {
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

export type KsefMappedImportConfig = {
  context?: {
    myCompanyRole?: KsefMyCompanyRole;
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
    buyerIdentifierType?: KsefBuyerIdentifierType;
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
    paymentMethod?: KsefPaymentMethodValue;
    paymentBankAccount?: string;
    defaultItemName?: string;
    defaultItemDescription?: string;
    defaultItemUnit?: string;
    defaultItemQuantity?: number;
    defaultTaxRate?: KsefTaxRateValue;
    splitPayment?: boolean;
    cashAccounting?: boolean;
    selfBilling?: boolean;
    simplifiedProcedure?: boolean;
    relatedEntities?: boolean;
    annex15?: boolean;
  };
  options: {
    deriveTaxRateFromAmounts?: boolean;
  };
  overrides?: {
    invoices?: Array<{
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
      paymentMethod?: KsefPaymentMethodValue;
      paymentBankAccount?: string;
      currency?: string;
      items?: Array<{
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

export type KsefMappedImportInvoiceResponse = GenerateKsefXmlResponse & {
  invoiceNumber: string;
  rowNumbers: number[];
  status: "generated" | "needs_completion" | "invalid";
  resolvedFields: Array<{
    key: KsefExcelFlexibleFieldKey | KsefExcelSupplementFieldKey;
    label: string;
    value: string;
    source: "excel" | "default" | "derived" | "manual";
  }>;
  missingFields: Array<{
    key: KsefExcelFlexibleFieldKey | KsefExcelSupplementFieldKey;
    label: string;
  }>;
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

export type KsefMappedImportResponse = {
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
  invoices: KsefMappedImportInvoiceResponse[];
};

export type KsefCompanyProfile = {
  id: string;
  companyName: string;
  nip: string;
  countryCode: string;
  addressLine1: string;
  addressLine2: string | null;
  email: string | null;
  phone: string | null;
  currency: string | null;
  paymentMethod: string | null;
  bankAccount: string | null;
  createdAt: string;
  updatedAt: string;
};

export type KsefCompanyProfilesResponse = {
  count: number;
  profiles: KsefCompanyProfile[];
};

export type SaveKsefCompanyProfilePayload = {
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
};

export type MeResponse = {
  id: string;
  email: string | null;
  userMetadata: Record<string, unknown>;
  appMetadata: Record<string, unknown>;
};

export type UploadAvatarResponse = {
  uploaded: boolean;
  file: {
    originalName: string;
    mimeType: string;
    bytes: number;
  };
  avatar: {
    publicId: string;
    secureUrl: string;
    bytes: number;
    width: number | null;
    height: number | null;
    format: string | null;
  };
  user: {
    id: string;
    email: string | null;
  };
  metadataUpdate: {
    updated: boolean;
    error?: string;
    user?: {
      id: string;
      email: string | null;
      userMetadata: Record<string, unknown>;
    } | null;
  };
};

export type AccountListItem = {
  id: string;
  email: string | null;
  name: string;
  position: string | null;
  avatarUrl: string | null;
  role: "ADMIN" | "USER";
  ksefGeneratedCount: number;
  createdAt: string;
  lastSignInAt: string | null;
  emailConfirmedAt: string | null;
};

export type AccountsResponse = {
  count: number;
  accounts: AccountListItem[];
};

export type UpdateProfilePayload = {
  name?: string;
  position?: string;
};

export type UpdateProfileResponse = {
  updated: boolean;
  error?: string;
  user?: {
    id: string;
    email: string | null;
    userMetadata: Record<string, unknown>;
  } | null;
};

async function parseJsonOrThrow<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `HTTP ${response.status}`);
  }

  return (await response.json()) as T;
}

export async function getHealth() {
  const response = await fetch(`${BACKEND_URL}/api/health`);
  return parseJsonOrThrow<HealthResponse>(response);
}

export async function pingSupabase() {
  const response = await fetch(`${BACKEND_URL}/api/excel/ping`);
  return parseJsonOrThrow<PingResponse>(response);
}

export async function getMe(accessToken: string) {
  const response = await fetch(`${BACKEND_URL}/api/auth/me`, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });
  return parseJsonOrThrow<MeResponse>(response);
}

export async function analyzeDemo(payload: AnalyzePayload, accessToken: string) {
  const response = await fetch(`${BACKEND_URL}/api/excel/analyze-demo`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`
    },
    body: JSON.stringify(payload)
  });

  return parseJsonOrThrow<AnalyzeResponse>(response);
}

export async function uploadExcel(files: File[], accessToken: string) {
  const startedAt = Date.now();
  const timeoutMs = 300_000;
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);
  const formData = new FormData();
  files.forEach((file) => {
    formData.append("file", file);
  });
  console.info("[excel-upload] request started", {
    files: files.length,
    totalBytes: files.reduce((sum, file) => sum + file.size, 0)
  });

  try {
    const response = await fetch(`${BACKEND_URL}/api/excel/upload`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`
      },
      body: formData,
      signal: controller.signal
    });
    const parsed = await parseJsonOrThrow<UploadExcelResponse>(response);
    console.info("[excel-upload] request completed", {
      elapsedMs: Date.now() - startedAt,
      uploaded: parsed.uploaded,
      filesCount: parsed.filesCount ?? files.length
    });
    return parsed;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Przekroczono limit czasu uploadu (300s).");
    }
    throw error;
  } finally {
    clearTimeout(timeoutHandle);
  }
}

export async function buildExcelSummary(payload: BuildExcelSummaryPayload, accessToken: string) {
  const response = await fetch(`${BACKEND_URL}/api/excel/summary`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`
    },
    body: JSON.stringify(payload)
  });

  return parseJsonOrThrow<BuildExcelSummaryResponse>(response);
}

export async function exportExcelSummary(payload: BuildExcelSummaryPayload, accessToken: string) {
  const startedAt = Date.now();
  const timeoutMs = 300_000;
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);
  console.info("[excel-export] request started", {
    uploadId: payload.uploadId,
    metrics: payload.metrics?.length ?? 0,
    exportColumns: payload.exportColumns?.length ?? 0,
    includeYearlySummary: payload.includeYearlySummary ?? true
  });

  try {
    const response = await fetch(`${BACKEND_URL}/api/excel/summary/export`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || `HTTP ${response.status}`);
    }

    const contentDisposition = response.headers.get("content-disposition");
    let fileName = "podsumowanie.xlsx";
    if (contentDisposition) {
      const match = contentDisposition.match(/filename="?([^"]+)"?/i);
      if (match?.[1]) {
        fileName = match[1];
      }
    }

    const blob = await response.blob();
    console.info("[excel-export] request completed", {
      elapsedMs: Date.now() - startedAt,
      bytes: blob.size,
      fileName
    });

    const result: ExportExcelSummaryResponse = {
      blob,
      fileName
    };
    return result;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Przekroczono limit czasu eksportu (300s). Sprawdz logi backendu.");
    }

    throw error;
  } finally {
    clearTimeout(timeoutHandle);
  }
}

export async function exportExcelYearOverYear(payload: BuildExcelSummaryPayload, accessToken: string) {
  const startedAt = Date.now();
  const timeoutMs = 300_000;
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);
  console.info("[excel-yoy] request started", {
    uploadId: payload.uploadId,
    metrics: payload.metrics?.length ?? 0,
    comparisonMonth: payload.comparisonMonth ?? 12
  });

  try {
    const response = await fetch(`${BACKEND_URL}/api/excel/yoy/export`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || `HTTP ${response.status}`);
    }

    const contentDisposition = response.headers.get("content-disposition");
    let fileName = "rok-do-roku.xlsx";
    if (contentDisposition) {
      const match = contentDisposition.match(/filename=\"?([^\"]+)\"?/i);
      if (match?.[1]) {
        fileName = match[1];
      }
    }

    const blob = await response.blob();
    console.info("[excel-yoy] request completed", {
      elapsedMs: Date.now() - startedAt,
      bytes: blob.size,
      fileName
    });

    return {
      blob,
      fileName
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Przekroczono limit czasu eksportu rok-do-roku (300s).");
    }

    throw error;
  } finally {
    clearTimeout(timeoutHandle);
  }
}

export async function generateKsefXml(payload: GenerateKsefXmlPayload, accessToken: string) {
  const response = await fetch(`${BACKEND_URL}/api/ksef/generate-xml`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`
    },
    body: JSON.stringify(payload)
  });

  return parseJsonOrThrow<GenerateKsefXmlResponse>(response);
}

export async function getKsefCompanyProfiles(accessToken: string) {
  const response = await fetch(`${BACKEND_URL}/api/ksef/company-profiles`, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  return parseJsonOrThrow<KsefCompanyProfilesResponse>(response);
}

export async function saveKsefCompanyProfile(
  payload: SaveKsefCompanyProfilePayload,
  accessToken: string
) {
  const response = await fetch(`${BACKEND_URL}/api/ksef/company-profiles`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`
    },
    body: JSON.stringify(payload)
  });

  return parseJsonOrThrow<{
    saved: boolean;
    profile: KsefCompanyProfile;
    profiles: KsefCompanyProfile[];
  }>(response);
}

export async function deleteKsefCompanyProfile(profileId: string, accessToken: string) {
  const response = await fetch(`${BACKEND_URL}/api/ksef/company-profiles/${profileId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  return parseJsonOrThrow<{
    deleted: boolean;
    error?: string;
    profiles: KsefCompanyProfile[];
  }>(response);
}

export async function importKsefExcel(file: File, accessToken: string) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${BACKEND_URL}/api/ksef/import-excel`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`
    },
    body: formData
  });

  return parseJsonOrThrow<KsefExcelImportResponse>(response);
}

export async function analyzeKsefExcel(file: File, accessToken: string) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${BACKEND_URL}/api/ksef/analyze-excel`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`
    },
    body: formData
  });

  return parseJsonOrThrow<AnalyzeKsefExcelResponse>(response);
}

export async function importKsefExcelMapped(
  file: File,
  config: KsefMappedImportConfig,
  accessToken: string
) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("config", JSON.stringify(config));

  const response = await fetch(`${BACKEND_URL}/api/ksef/import-excel-mapped`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`
    },
    body: formData
  });

  return parseJsonOrThrow<KsefMappedImportResponse>(response);
}

export async function uploadUserAvatar(file: File, accessToken: string) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${BACKEND_URL}/api/users/avatar`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`
    },
    body: formData
  });

  return parseJsonOrThrow<UploadAvatarResponse>(response);
}

export async function getAccounts(accessToken: string) {
  const response = await fetch(`${BACKEND_URL}/api/users/accounts`, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  return parseJsonOrThrow<AccountsResponse>(response);
}

export async function updateMyProfile(payload: UpdateProfilePayload, accessToken: string) {
  const response = await fetch(`${BACKEND_URL}/api/users/profile`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`
    },
    body: JSON.stringify(payload)
  });

  return parseJsonOrThrow<UpdateProfileResponse>(response);
}

export async function bootstrapAdmin(bootstrapKey: string, accessToken: string) {
  const response = await fetch(`${BACKEND_URL}/api/users/bootstrap-admin`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`
    },
    body: JSON.stringify({ bootstrapKey })
  });

  return parseJsonOrThrow<{ updated: boolean; error?: string }>(response);
}

export async function updateUserRole(userId: string, role: "ADMIN" | "USER", accessToken: string) {
  const response = await fetch(`${BACKEND_URL}/api/users/${userId}/role`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`
    },
    body: JSON.stringify({ role })
  });

  return parseJsonOrThrow<{ updated: boolean; error?: string }>(response);
}

export async function setUserAvatarUrl(userId: string, avatarUrl: string, accessToken: string) {
  const response = await fetch(`${BACKEND_URL}/api/users/${userId}/avatar-url`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`
    },
    body: JSON.stringify({ avatarUrl })
  });

  return parseJsonOrThrow<{ updated: boolean; error?: string }>(response);
}

export async function deleteUser(userId: string, accessToken: string) {
  const response = await fetch(`${BACKEND_URL}/api/users/${userId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  return parseJsonOrThrow<{ deleted: boolean; error?: string }>(response);
}
