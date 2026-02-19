import {
  analyzeDemo,
  buildExcelSummary,
  exportExcelYearOverYear,
  exportExcelSummary,
  pingSupabase,
  uploadExcel,
  type AnalyzePayload,
  type AnalyzeResponse,
  type BuildExcelSummaryPayload,
  type BuildExcelSummaryResponse,
  type ExportExcelSummaryResponse,
  type PingResponse,
  type UploadExcelResponse
} from "../api/backend";

export const excelQueryKeys = {
  all: ["excel"] as const,
  backendStatus: () => [...excelQueryKeys.all, "backend-status"] as const
};

export type UploadExcelInput = {
  files: File[];
  accessToken: string;
};

export type AnalyzeExcelInput = {
  payload: AnalyzePayload;
  accessToken: string;
};

export type BuildExcelSummaryInput = {
  payload: BuildExcelSummaryPayload;
  accessToken: string;
};

export type BuildExcelSummaryExportInput = {
  payload: BuildExcelSummaryPayload;
  accessToken: string;
};

export type BuildExcelYearOverYearExportInput = {
  payload: BuildExcelSummaryPayload;
  accessToken: string;
};

export async function getExcelBackendStatus(): Promise<PingResponse> {
  return pingSupabase();
}

export async function uploadExcelFile(input: UploadExcelInput): Promise<UploadExcelResponse> {
  return uploadExcel(input.files, input.accessToken);
}

export async function analyzeExcelDemo(input: AnalyzeExcelInput): Promise<AnalyzeResponse> {
  return analyzeDemo(input.payload, input.accessToken);
}

export async function buildExcelSummaryReport(
  input: BuildExcelSummaryInput
): Promise<BuildExcelSummaryResponse> {
  return buildExcelSummary(input.payload, input.accessToken);
}

export async function exportExcelSummaryReport(
  input: BuildExcelSummaryExportInput
): Promise<ExportExcelSummaryResponse> {
  return exportExcelSummary(input.payload, input.accessToken);
}

export async function exportExcelYearOverYearReport(
  input: BuildExcelYearOverYearExportInput
): Promise<ExportExcelSummaryResponse> {
  return exportExcelYearOverYear(input.payload, input.accessToken);
}
