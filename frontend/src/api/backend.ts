const BACKEND_URL = "http://localhost:4000";

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
