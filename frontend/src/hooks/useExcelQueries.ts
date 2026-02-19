import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  analyzeExcelDemo,
  buildExcelSummaryReport,
  exportExcelYearOverYearReport,
  exportExcelSummaryReport,
  excelQueryKeys,
  getExcelBackendStatus,
  uploadExcelFile,
  type AnalyzeExcelInput,
  type BuildExcelYearOverYearExportInput,
  type BuildExcelSummaryExportInput,
  type BuildExcelSummaryInput,
  type UploadExcelInput
} from "../services/excelService";

type UploadMutationOptions = {
  onSuccess?: (result: Awaited<ReturnType<typeof uploadExcelFile>>) => void;
  onError?: (error: unknown) => void;
};

type AnalyzeMutationOptions = {
  onSuccess?: (result: Awaited<ReturnType<typeof analyzeExcelDemo>>) => void;
  onError?: (error: unknown) => void;
};

type SummaryMutationOptions = {
  onSuccess?: (result: Awaited<ReturnType<typeof buildExcelSummaryReport>>) => void;
  onError?: (error: unknown) => void;
};

type SummaryExportMutationOptions = {
  onSuccess?: (result: Awaited<ReturnType<typeof exportExcelSummaryReport>>) => void;
  onError?: (error: unknown) => void;
};

type YearOverYearExportMutationOptions = {
  onSuccess?: (result: Awaited<ReturnType<typeof exportExcelYearOverYearReport>>) => void;
  onError?: (error: unknown) => void;
};

export function useExcelBackendStatusQuery() {
  return useQuery({
    queryKey: excelQueryKeys.backendStatus(),
    queryFn: getExcelBackendStatus,
    staleTime: 30_000,
    refetchInterval: 60_000
  });
}

export function useExcelUploadMutation(options?: UploadMutationOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UploadExcelInput) => uploadExcelFile(input),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: excelQueryKeys.backendStatus() });
      options?.onSuccess?.(result);
    },
    onError: (error) => {
      options?.onError?.(error);
    }
  });
}

export function useExcelAnalyzeDemoMutation(options?: AnalyzeMutationOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: AnalyzeExcelInput) => analyzeExcelDemo(input),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: excelQueryKeys.backendStatus() });
      options?.onSuccess?.(result);
    },
    onError: (error) => {
      options?.onError?.(error);
    }
  });
}

export function useExcelSummaryMutation(options?: SummaryMutationOptions) {
  return useMutation({
    mutationFn: (input: BuildExcelSummaryInput) => buildExcelSummaryReport(input),
    onSuccess: (result) => {
      options?.onSuccess?.(result);
    },
    onError: (error) => {
      options?.onError?.(error);
    }
  });
}

export function useExcelSummaryExportMutation(options?: SummaryExportMutationOptions) {
  return useMutation({
    mutationFn: (input: BuildExcelSummaryExportInput) => exportExcelSummaryReport(input),
    onSuccess: (result) => {
      options?.onSuccess?.(result);
    },
    onError: (error) => {
      options?.onError?.(error);
    }
  });
}

export function useExcelYearOverYearExportMutation(
  options?: YearOverYearExportMutationOptions
) {
  return useMutation({
    mutationFn: (input: BuildExcelYearOverYearExportInput) =>
      exportExcelYearOverYearReport(input),
    onSuccess: (result) => {
      options?.onSuccess?.(result);
    },
    onError: (error) => {
      options?.onError?.(error);
    }
  });
}
