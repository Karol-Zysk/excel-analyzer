import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import type { User } from "@supabase/supabase-js";
import * as ExcelJS from "exceljs";
import { randomUUID } from "node:crypto";
import { readFile, rm } from "node:fs/promises";
import * as XLSX from "xlsx";
import { SupabaseService } from "../supabase/supabase.service";
import type { AnalyzeDemoDto } from "./dto/analyze-demo.dto";
import type { BuildExcelSummaryDto } from "./dto/build-excel-summary.dto";

type UploadedExcelFile = {
  buffer?: Buffer;
  path?: string;
  mimetype: string;
  size: number;
  originalname: string;
};

type ParsedExcelMetric = {
  metric: string;
  startValue: string;
  endValue: string;
  consumption: string;
  rate: string;
  total: string;
};

type ParsedExcelRecord = {
  apartment: string;
  dateFrom: string;
  dateTo: string;
  metrics: ParsedExcelMetric[];
};

type ParsedExcelWorkbook = {
  headers: string[];
  recordCount: number;
  records: ParsedExcelRecord[];
};

type ExcelSummaryResult = {
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

type UploadAnalysisSession = {
  workbook: ParsedExcelWorkbook;
  sourceFiles: string[];
  requestedByUserId: string;
  createdAt: string;
};

type ExportColumnKey =
  | "previousReading"
  | "currentReading"
  | "consumptionReported"
  | "consumptionComputed"
  | "consumptionStatus"
  | "rate"
  | "reportedTotal"
  | "computedTotal"
  | "totalStatus";

type ExportCellStyle = "ok" | "error" | "zero" | "negative" | "warning";

type ExportCell = {
  value: string | number | null;
  style: ExportCellStyle | null;
};

type ExportTableRow = {
  address: string;
  apartment: string;
  metric: string;
  cells: ExportCell[];
};

type ExportYearlyRow = {
  values: Array<string | number | null>;
  styles: Array<ExportCellStyle | null>;
};

type YearOverYearExportRow = {
  address: string;
  apartment: string;
  metric: string;
  baseYear: number;
  compareYear: number;
  baseConsumption: number;
  compareConsumption: number;
  difference: number;
  changePercent: number | null;
  trend: "Wzrost" | "Spadek" | "Bez zmian";
  note: string | null;
};

type RateOutlierKey = `${number}:${number}`; // rowIndex:cellIndex within cells[]

type ExcelExportPayload = {
  headers: string[];
  periods: Array<{ label: string; columnCount: number }>;
  columnLabels: string[];
  rows: ExportTableRow[];
  rateOutliers: Set<RateOutlierKey>;
  yearlyHeaders: string[];
  yearlyRows: ExportYearlyRow[];
  /** periodKey -> total sum of "Opłata stała" reportedTotal across all apartments */
  fixedFeeSummary: Map<string, number>;
  generatedAt: string;
};

type DetailedSummaryRow = {
  address: string;
  apartment: string;
  apartmentFull: string;
  dateFrom: string;
  dateTo: string;
  periodKey: string;
  metric: string;
  startValue: number | null;
  endValue: number | null;
  consumptionReported: number | null;
  consumptionComputed: number | null;
  consumptionDifference: number | null;
  consumptionIsValid: boolean | null;
  rate: number | null;
  reportedTotal: number | null;
  computedTotal: number | null;
  totalDifference: number | null;
  totalIsValid: boolean | null;
};

const VALIDATION_TOLERANCE = 0.05;
const DAY_MS = 24 * 60 * 60 * 1000;
const ACCEPTED_EXCEL_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/csv",
  "application/csv",
]);

const EXPORT_COLUMN_LABELS: Record<ExportColumnKey, string> = {
  previousReading: "Odczyt poprzedni",
  currentReading: "Odczyt końcowy",
  consumptionReported: "Zużycie",
  consumptionComputed: "Zużycie wyliczone",
  consumptionStatus: "Status zużycia",
  rate: "Stawka",
  reportedTotal: "Suma raportowana",
  computedTotal: "Suma wyliczona",
  totalStatus: "Status sumy",
};

const DEFAULT_EXPORT_COLUMNS: ExportColumnKey[] = [
  "previousReading",
  "currentReading",
  "consumptionReported",
  "consumptionComputed",
  "consumptionStatus",
  "rate",
  "reportedTotal",
  "computedTotal",
  "totalStatus",
];

@Injectable()
export class ExcelService {
  private readonly uploadAnalysisStore = new Map<
    string,
    UploadAnalysisSession
  >();
  private readonly logger = new Logger(ExcelService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  async pingStorage() {
    return this.supabaseService.pingStorage();
  }

  async analyzeDemo(payload: AnalyzeDemoDto, requestedBy: User) {
    const saveResult = await this.supabaseService.saveDemoAnalysis(payload);

    return {
      received: payload,
      supabase: saveResult,
      requestedBy: {
        id: requestedBy.id,
        email: requestedBy.email ?? null,
      },
      analyzedAt: new Date().toISOString(),
    };
  }

  async uploadExcel(file: UploadedExcelFile, requestedBy: User) {
    return this.uploadExcelFiles([file], requestedBy);
  }

  async uploadExcelFiles(files: UploadedExcelFile[], requestedBy: User) {
    if (files.length === 0) {
      throw new BadRequestException("At least one file is required");
    }

    const parsedWorkbooks: ParsedExcelWorkbook[] = [];
    const sourceFileNames: string[] = [];
    const uploadedFiles: Array<{
      sourceFileName: string;
      bucket: string | undefined;
      file:
        | {
            path: string;
            originalName: string;
            mimeType: string;
            bytes: number;
          }
        | undefined;
      signedUrl: string | null | undefined;
      signedUrlError: string | null | undefined;
    }> = [];
    let analysisDraftError: string | null = null;

    for (const file of files) {
      this.validateExcelFile(file);

      try {
        const fileBuffer = await this.readUploadedFileBuffer(file);
        const uploaded = await this.supabaseService.uploadExcelFile(
          {
            buffer: fileBuffer,
            originalName: file.originalname,
            mimeType: file.mimetype,
            bytes: file.size,
          },
          requestedBy.id
        );

        if (!uploaded.uploaded) {
          throw new BadRequestException(
            `Upload failed for file '${file.originalname}': ${
              uploaded.error ?? "Unknown error"
            }`
          );
        }

        uploadedFiles.push({
          sourceFileName: file.originalname,
          bucket: uploaded.bucket,
          file: uploaded.file,
          signedUrl: uploaded.signedUrl,
          signedUrlError: uploaded.signedUrlError,
        });

        sourceFileNames.push(file.originalname);

        try {
          const parsedWorkbook = await this.parseWorkbookFromBuffer(
            fileBuffer
          );
          parsedWorkbooks.push(parsedWorkbook);
        } catch (error) {
          analysisDraftError =
            error instanceof Error
              ? error.message
              : "Excel analysis parser failed";
        }
      } finally {
        await this.cleanupUploadedTempFile(file);
      }
    }

    let analysisDraft: {
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
    } | null = null;

    if (parsedWorkbooks.length > 0) {
      const mergedWorkbook = this.mergeParsedWorkbooks(parsedWorkbooks);
      const uploadId = randomUUID();
      this.uploadAnalysisStore.set(uploadId, {
        workbook: mergedWorkbook,
        sourceFiles: sourceFileNames,
        requestedByUserId: requestedBy.id,
        createdAt: new Date().toISOString(),
      });
      analysisDraft = this.buildAnalysisDraft(
        uploadId,
        mergedWorkbook,
        sourceFileNames
      );
    }

    return {
      uploaded: true,
      filesCount: files.length,
      uploadedFiles,
      analysisDraft,
      analysisDraftError,
    };
  }

  private validateExcelFile(file: UploadedExcelFile) {
    const originalName = file.originalname.toLowerCase();
    const hasSupportedExtension =
      originalName.endsWith(".xlsx") ||
      originalName.endsWith(".xls") ||
      originalName.endsWith(".csv");
    const hasSupportedMimeType = ACCEPTED_EXCEL_MIME_TYPES.has(file.mimetype);

    if (!hasSupportedExtension && !hasSupportedMimeType) {
      throw new BadRequestException(
        "Only .xlsx, .xls or .csv files are allowed"
      );
    }
  }

  private async readUploadedFileBuffer(file: UploadedExcelFile) {
    if (file.buffer) {
      return file.buffer;
    }

    if (file.path) {
      return readFile(file.path);
    }

    throw new BadRequestException(
      `Upload failed for file '${file.originalname}': missing file content`
    );
  }

  private async cleanupUploadedTempFile(file: UploadedExcelFile) {
    if (!file.path) {
      return;
    }

    await rm(file.path, { force: true }).catch(() => undefined);
  }

  buildSummary(request: BuildExcelSummaryDto) {
    return this.buildSummaryData(request);
  }

  async buildSummaryExcelFile(request: BuildExcelSummaryDto) {
    const exportStartedAt = Date.now();
    const exportLabel = request.uploadId.slice(0, 8);
    this.logger.log(`[export:${exportLabel}] started (ExcelJS)`);

    const session = this.uploadAnalysisStore.get(request.uploadId);
    if (!session) {
      this.logger.warn(`[export:${exportLabel}] session not found`);
      throw new BadRequestException(
        "Upload session not found. Upload file again before summary."
      );
    }

    const prepareStartedAt = Date.now();
    const selectedMetrics = this.resolveSelectedMetrics(
      request.metrics,
      session.workbook.headers
    );
    this.logger.log(
      `[export:${exportLabel}] preparing data selectedMetrics=${selectedMetrics.length} totalRecords=${session.workbook.recordCount}`
    );
    const detailedRows = this.buildDetailedRows(
      request,
      session.workbook,
      selectedMetrics,
      exportLabel
    );
    const exportColumns = this.resolveExportColumns(request.exportColumns);
    const includeYearlySummary = request.includeYearlySummary ?? true;
    const exportPayload = this.buildExportPayload(
      detailedRows,
      exportColumns,
      includeYearlySummary,
      exportLabel
    );
    this.logger.log(
      `[export:${exportLabel}] prepared payload rows=${
        exportPayload.rows.length
      }, yearlyRows=${exportPayload.yearlyRows.length}, prepareMs=${
        Date.now() - prepareStartedAt
      }`
    );

    try {
      const buffer = await this.renderExcelWithExcelJS(
        exportPayload,
        exportLabel
      );
      this.logger.log(
        `[export:${exportLabel}] finished in ${
          Date.now() - exportStartedAt
        }ms, bytes=${buffer.byteLength}`
      );
      return {
        fileName: `podsumowanie-${request.uploadId.slice(0, 8)}.xlsx`,
        buffer,
      };
    } catch (error) {
      this.logger.error(
        `[export:${exportLabel}] failed after ${
          Date.now() - exportStartedAt
        }ms (${error instanceof Error ? error.message : "Unknown error"})`
      );
      throw error;
    }
  }

  async buildYearOverYearExcelFile(request: BuildExcelSummaryDto) {
    const exportStartedAt = Date.now();
    const exportLabel = request.uploadId.slice(0, 8);
    const comparisonMonth = request.comparisonMonth ?? 12;
    this.logger.log(
      `[yoy:${exportLabel}] started month=${comparisonMonth}`
    );

    const session = this.uploadAnalysisStore.get(request.uploadId);
    if (!session) {
      this.logger.warn(`[yoy:${exportLabel}] session not found`);
      throw new BadRequestException(
        "Upload session not found. Upload file again before report."
      );
    }

    const selectedMetrics = this.resolveSelectedMetrics(
      request.metrics,
      session.workbook.headers
    );
    const detailedRows = this.buildDetailedRows(
      request,
      session.workbook,
      selectedMetrics,
      `yoy-${exportLabel}`
    );
    const yearOverYearRows = this.buildYearOverYearExportRows(
      detailedRows,
      comparisonMonth
    );

    const buffer = await this.renderYearOverYearExcelWithExcelJS(
      yearOverYearRows,
      comparisonMonth,
      exportLabel
    );

    this.logger.log(
      `[yoy:${exportLabel}] finished in ${
        Date.now() - exportStartedAt
      }ms rows=${yearOverYearRows.length} bytes=${buffer.byteLength}`
    );
    return {
      fileName: `rok-do-roku-${request.uploadId.slice(0, 8)}.xlsx`,
      buffer,
    };
  }

  private async renderYearOverYearExcelWithExcelJS(
    rows: YearOverYearExportRow[],
    comparisonMonth: number,
    exportLabel: string
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Dem-Bud";
    workbook.created = new Date();

    const ws = workbook.addWorksheet("Rok do roku");
    this.logger.debug(
      `[yoy:${exportLabel}] exceljs: writing rows=${rows.length} month=${comparisonMonth}`
    );

    const titleRow = ws.addRow([
      `Raport rok do roku (odczyty konca miesiaca ${comparisonMonth})`,
    ]);
    titleRow.font = { bold: true, size: 12 };
    ws.addRow([]);

    const headers = [
      "Adres",
      "Lokal",
      "Metryka",
      "Rok bazowy",
      "Zuzycie bazowe",
      "Rok porownawczy",
      "Zuzycie porownawcze",
      "Roznica",
      "Zmiana %",
      "Trend",
      "Uwagi",
    ];
    const headerRow = ws.addRow(headers);
    headerRow.font = { bold: true };
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE2EFDA" },
      };
    });

    if (rows.length === 0) {
      ws.addRow([
        "Brak danych do porownania rok do roku. Potrzebne sa dane dla co najmniej 2 kolejnych lat.",
      ]);
      ws.getColumn(1).width = 110;
      const arrayBuffer = await workbook.xlsx.writeBuffer();
      return Buffer.from(arrayBuffer);
    }

    let prevApartment: string | null = null;
    for (const row of rows) {
      const isNewApartment = prevApartment === null || prevApartment !== row.apartment;

      const dataRow = ws.addRow([
        row.address,
        row.apartment,
        row.metric,
        row.baseYear,
        row.baseConsumption,
        row.compareYear,
        row.compareConsumption,
        row.difference,
        row.changePercent,
        row.trend,
        row.note,
      ]);

      // Thick left border to visually separate apartments vertically
      if (isNewApartment) {
        const separatorBorder: ExcelJS.Border = { style: "medium", color: { argb: "FF000000" } };
        dataRow.getCell(1).border = { ...dataRow.getCell(1).border, left: separatorBorder };
      }

      const baseCell = dataRow.getCell(5);
      const compareCell = dataRow.getCell(7);
      const differenceCell = dataRow.getCell(8);
      const trendCell = dataRow.getCell(10);
      const noteCell = dataRow.getCell(11);

      const baseStyle = this.resolveConsumptionValueStyle(row.baseConsumption);
      if (baseStyle) {
        this.applyExcelJSCellStyle(baseCell, baseStyle);
      }
      const compareStyle = this.resolveConsumptionValueStyle(row.compareConsumption);
      if (compareStyle) {
        this.applyExcelJSCellStyle(compareCell, compareStyle);
      }

      const differenceStyle = this.resolveYearOverYearDifferenceStyle(row.difference);
      if (differenceStyle) {
        this.applyExcelJSCellStyle(differenceCell, differenceStyle);
        this.applyExcelJSCellStyle(trendCell, differenceStyle);
      }
      if (row.note) {
        this.applyExcelJSCellStyle(noteCell, "warning");
      }

      this.applyExactZeroRedFont(baseCell, row.baseConsumption);
      this.applyExactZeroRedFont(compareCell, row.compareConsumption);
      this.applyExactZeroRedFont(differenceCell, row.difference);
      this.applyExactZeroRedFont(dataRow.getCell(9), row.changePercent);

      prevApartment = row.apartment;
    }

    ws.getColumn(1).width = 26;
    ws.getColumn(2).width = 14;
    ws.getColumn(3).width = 20;
    ws.getColumn(4).width = 12;
    ws.getColumn(5).width = 16;
    ws.getColumn(6).width = 15;
    ws.getColumn(7).width = 20;
    ws.getColumn(8).width = 14;
    ws.getColumn(9).width = 12;
    ws.getColumn(10).width = 12;
    ws.getColumn(11).width = 36;

    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer);
  }

  private async renderExcelWithExcelJS(
    payload: ExcelExportPayload,
    exportLabel: string
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Dem-Bud";
    workbook.created = new Date();

    const ws = workbook.addWorksheet("Raport");

    // --- Main table ---
    this.logger.debug(
      `[export:${exportLabel}] exceljs: writing main table headers=${payload.headers.length} rows=${payload.rows.length} periods=${payload.periods.length}`
    );

    const fixedCols = 3; // Adres, Lokal, Metryka
    const headerFill: ExcelJS.FillPattern = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFD9E1F2" },
    };

    // Row 1: period labels merged across their columns
    const periodRow = ws.addRow([]);
    periodRow.font = { bold: true };
    periodRow.getCell(1).value = "Adres";
    periodRow.getCell(2).value = "Lokal";
    periodRow.getCell(3).value = "Metryka";
    for (let c = 1; c <= fixedCols; c++) {
      periodRow.getCell(c).fill = headerFill;
    }

    let colCursor = fixedCols + 1;
    for (const period of payload.periods) {
      const startCol = colCursor;
      const endCol = colCursor + period.columnCount - 1;
      periodRow.getCell(startCol).value = period.label;
      periodRow.getCell(startCol).fill = headerFill;
      if (endCol > startCol) {
        ws.mergeCells(1, startCol, 1, endCol);
      }
      periodRow.getCell(startCol).alignment = { horizontal: "center" };
      colCursor = endCol + 1;
    }

    // Row 2: column labels repeated per period
    const subHeaderValues: string[] = ["", "", ""];
    for (let i = 0; i < payload.periods.length; i++) {
      subHeaderValues.push(...payload.columnLabels);
    }
    const subHeaderRow = ws.addRow(subHeaderValues);
    subHeaderRow.font = { bold: true };
    subHeaderRow.eachCell((cell) => {
      cell.fill = headerFill;
    });

    // Merge fixed column headers across rows 1-2
    for (let c = 1; c <= fixedCols; c++) {
      ws.mergeCells(1, c, 2, c);
      periodRow.getCell(c).alignment = {
        vertical: "middle",
        horizontal: "center",
      };
    }

    // Data rows
    for (let rowIdx = 0; rowIdx < payload.rows.length; rowIdx++) {
      const exportRow = payload.rows[rowIdx];
      const prevRow = rowIdx > 0 ? payload.rows[rowIdx - 1] : null;
      const isNewApartment =
        prevRow === null ||
        prevRow.apartment !== exportRow.apartment ||
        prevRow.address !== exportRow.address;

      const values: Array<string | number | null> = [
        exportRow.address,
        exportRow.apartment,
        exportRow.metric,
      ];
      for (const cell of exportRow.cells) {
        values.push(cell.value);
      }

      const dataRow = ws.addRow(values);

      // Apply styles to cells (offset by 3 for address/apartment/metric)
      for (let cellIdx = 0; cellIdx < exportRow.cells.length; cellIdx++) {
        const sourceValue = exportRow.cells[cellIdx].value;
        const styleKey = exportRow.cells[cellIdx].style;
        const cell = dataRow.getCell(cellIdx + 4);
        if (styleKey) {
          this.applyExcelJSCellStyle(cell, styleKey);
        }

        // Red border for rate outliers
        const outlierKey = `${rowIdx}:${cellIdx}` as RateOutlierKey;
        if (payload.rateOutliers.has(outlierKey)) {
          const redBorder: ExcelJS.Border = {
            style: "medium",
            color: { argb: "FFFF0000" },
          };
          cell.border = {
            top: redBorder,
            bottom: redBorder,
            left: redBorder,
            right: redBorder,
          };
        }

        this.applyExactZeroRedFont(cell, sourceValue);
      }

      // Thick top border to visually separate apartments — applied AFTER cell styles
      // so it is not overwritten by applyExcelJSCellStyle or outlier handler
      if (isNewApartment) {
        const separatorBorder: ExcelJS.Border = { style: "medium", color: { argb: "FF000000" } };
        const totalCols = 3 + exportRow.cells.length;
        for (let c = 1; c <= totalCols; c++) {
          const cell = dataRow.getCell(c);
          cell.border = { ...cell.border, top: separatorBorder };
        }
      }
    }

    // Fixed-fee summary row — uses pre-computed sums from payload.fixedFeeSummary
    if (payload.fixedFeeSummary.size > 0) {
      ws.addRow([]);
      const colCount = payload.columnLabels.length;
      const reportedTotalIndex = payload.columnLabels.indexOf("Suma raportowana");
      const totalCellCount = payload.rows[0]?.cells.length ?? 0;
      const summaryValues: Array<string | number | null> = [
        "",
        "SUMA opłat stałych",
        "",
        ...Array<null>(totalCellCount).fill(null),
      ];

      // Place each period's sum in the correct cell column
      const periodKeys = Array.from(payload.fixedFeeSummary.keys());
      for (const periodKey of periodKeys) {
        const sum = payload.fixedFeeSummary.get(periodKey)!;
        // find period index by matching periodKey to periods order
        const periodIdx = payload.periods.findIndex((p) => p.label === periodKey ||
          // periodKey may be stored as "dateFrom|dateTo", periods have label "dateFrom - dateTo"
          p.label.replace(" - ", "|") === periodKey
        );
        if (periodIdx < 0 || reportedTotalIndex < 0) continue;
        const cellIdx = periodIdx * colCount + reportedTotalIndex;
        summaryValues[3 + cellIdx] = Math.round(sum * 100) / 100;
      }

      const summaryRow = ws.addRow(summaryValues);
      summaryRow.font = { bold: true };
      const yellowFill: ExcelJS.FillPattern = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFFF2CC" },
      };
      const summaryBorder: ExcelJS.Border = { style: "medium", color: { argb: "FF000000" } };
      const totalCols = 3 + totalCellCount;
      for (let c = 1; c <= totalCols; c++) {
        const cell = summaryRow.getCell(c);
        cell.border = { top: summaryBorder, bottom: summaryBorder };
        if (c <= 3 || (summaryValues[c - 1] !== null && typeof summaryValues[c - 1] === "number")) {
          cell.fill = yellowFill;
        }
      }
    }

    // Column widths
    ws.getColumn(1).width = 28;
    ws.getColumn(2).width = 14;
    ws.getColumn(3).width = 18;
    for (let col = 4; col <= payload.headers.length; col++) {
      ws.getColumn(col).width = 18;
    }

    // --- Yearly summary section ---
    if (payload.yearlyRows.length > 0) {
      this.logger.debug(
        `[export:${exportLabel}] exceljs: writing yearly section rows=${payload.yearlyRows.length}`
      );

      // Empty separator row
      ws.addRow([]);
      ws.addRow([]);

      // Title row
      const titleRow = ws.addRow([
        "Podsumowanie roczne (automatyczne przy pełnym pokryciu roku)",
      ]);
      titleRow.font = { bold: true, size: 12 };

      // Yearly headers
      const yearlyHeaderRow = ws.addRow(payload.yearlyHeaders);
      yearlyHeaderRow.font = { bold: true };
      yearlyHeaderRow.eachCell((cell) => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFE2EFDA" },
        };
      });

      // Yearly data rows
      for (const yearlyRow of payload.yearlyRows) {
        const dataRow = ws.addRow(yearlyRow.values);
        for (let col = 0; col < yearlyRow.styles.length; col++) {
          const styleKey = yearlyRow.styles[col];
          const cell = dataRow.getCell(col + 1);
          if (styleKey) {
            this.applyExcelJSCellStyle(cell, styleKey);
          }
          this.applyExactZeroRedFont(cell, yearlyRow.values[col] ?? null);
        }
      }
    }

    this.logger.debug(`[export:${exportLabel}] exceljs: writing buffer`);
    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer);
  }

  private applyExcelJSCellStyle(cell: ExcelJS.Cell, styleKey: ExportCellStyle) {
    switch (styleKey) {
      case "ok":
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFC6EFCE" },
        };
        cell.font = { bold: true, color: { argb: "FF006100" } };
        break;
      case "error":
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFFFC7CE" },
        };
        cell.font = { bold: true, color: { argb: "FF9C0006" } };
        break;
      case "zero":
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFFFEB9C" },
        };
        cell.font = { bold: true, color: { argb: "FF9C6500" } };
        break;
      case "negative":
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF4CCCC" },
        };
        cell.font = { bold: true, color: { argb: "FF660066" } };
        break;
      case "warning":
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFDDEBF7" },
        };
        cell.font = { bold: true, color: { argb: "FF1F4E79" } };
        break;
    }
  }

  private applyExactZeroRedFont(
    cell: ExcelJS.Cell,
    value: string | number | null
  ) {
    if (!this.isExactZeroValue(value)) {
      return;
    }

    cell.font = {
      ...(cell.font ?? {}),
      color: { argb: "FFFF0000" },
    };
  }

  private isExactZeroValue(value: string | number | null) {
    if (typeof value === "number") {
      return value === 0;
    }

    if (typeof value === "string") {
      return value.trim() === "0";
    }

    return false;
  }

  private buildSummaryData(request: BuildExcelSummaryDto): ExcelSummaryResult {
    const session = this.uploadAnalysisStore.get(request.uploadId);
    if (!session) {
      throw new BadRequestException(
        "Upload session not found. Upload file again before summary."
      );
    }
    const parsedWorkbook = session.workbook;
    const selectedMetrics = this.resolveSelectedMetrics(
      request.metrics,
      parsedWorkbook.headers
    );
    const includeValidation = request.includeValidation ?? true;
    const includeOnlyMismatches = request.includeOnlyMismatches ?? false;

    const detailedRows = this.buildDetailedRows(
      request,
      parsedWorkbook,
      selectedMetrics
    );
    const rows = detailedRows.map((row) => {
      const totalValidationState =
        row.totalIsValid === false || row.consumptionIsValid === false
          ? false
          : row.totalIsValid === true
          ? true
          : null;

      return {
        apartment: row.apartmentFull,
        dateFrom: row.dateFrom,
        dateTo: row.dateTo,
        metric: row.metric,
        consumption: row.consumptionReported,
        rate: row.rate,
        reportedTotal: row.reportedTotal,
        computedTotal: includeValidation ? row.computedTotal : null,
        difference: includeValidation ? row.totalDifference : null,
        isValid: includeValidation ? totalValidationState : null,
      };
    });

    const totalsByMetric = selectedMetrics.map((metricName) => {
      const metricRows = rows.filter((row) => row.metric === metricName);
      const reportedTotal = this.roundTo2(
        metricRows.reduce((sum, row) => sum + (row.reportedTotal ?? 0), 0)
      );
      const computedTotal = this.roundTo2(
        metricRows.reduce((sum, row) => sum + (row.computedTotal ?? 0), 0)
      );
      const difference = includeValidation
        ? this.roundTo2(reportedTotal - computedTotal)
        : null;

      return {
        metric: metricName,
        rowCount: metricRows.length,
        totalConsumption: this.roundTo2(
          metricRows.reduce((sum, row) => sum + (row.consumption ?? 0), 0)
        ),
        reportedTotal,
        computedTotal: includeValidation ? computedTotal : null,
        difference,
      };
    });

    return {
      uploadId: request.uploadId,
      selected: {
        apartment: request.apartment?.trim() || null,
        dateFrom: this.normalizeDate(request.dateFrom),
        dateTo: this.normalizeDate(request.dateTo),
        metrics: selectedMetrics,
        includeValidation,
        includeOnlyMismatches,
      },
      stats: {
        rowsCount: rows.length,
        validRows: rows.filter((row) => row.isValid === true).length,
        invalidRows: rows.filter((row) => row.isValid === false).length,
      },
      totalsByMetric,
      rows,
    };
  }

  private buildDetailedRows(
    request: BuildExcelSummaryDto,
    parsedWorkbook: ParsedExcelWorkbook,
    selectedMetrics: string[],
    traceLabel?: string
  ) {
    const metricSet = new Set(selectedMetrics);
    const normalizedApartment = request.apartment?.trim() || null;
    const rangeFrom = this.normalizeDate(request.dateFrom);
    const rangeTo = this.normalizeDate(request.dateTo);
    const includeOnlyMismatches = request.includeOnlyMismatches ?? false;

    const rows: DetailedSummaryRow[] = [];
    const totalRecords = parsedWorkbook.records.length;
    let processedRecords = 0;
    let filteredByApartment = 0;
    let filteredByRange = 0;
    let filteredByMismatchFlag = 0;

    if (traceLabel) {
      this.logger.debug(
        `[export:${traceLabel}] buildDetailedRows started totalRecords=${totalRecords}`
      );
    }

    for (const record of parsedWorkbook.records) {
      processedRecords += 1;

      if (normalizedApartment && record.apartment !== normalizedApartment) {
        filteredByApartment += 1;
        continue;
      }

      if (!this.isRecordInsideRange(record, rangeFrom, rangeTo)) {
        filteredByRange += 1;
        continue;
      }

      const normalizedDateFrom =
        this.normalizeDate(record.dateFrom) ?? record.dateFrom.trim();
      const normalizedDateTo =
        this.normalizeDate(record.dateTo) ?? record.dateTo.trim();
      const periodKey = `${normalizedDateFrom}|${normalizedDateTo}`;
      const { address, apartment } = this.splitApartment(record.apartment);

      for (const metricRow of record.metrics) {
        if (!metricSet.has(metricRow.metric)) {
          continue;
        }

        const startValue = this.parsePolishNumber(metricRow.startValue);
        const endValue = this.parsePolishNumber(metricRow.endValue);
        const consumptionReported = this.parsePolishNumber(
          metricRow.consumption
        );
        const consumptionComputed =
          startValue !== null && endValue !== null
            ? this.roundTo2(endValue - startValue)
            : null;
        const consumptionDifference =
          consumptionReported !== null && consumptionComputed !== null
            ? this.roundTo2(consumptionReported - consumptionComputed)
            : null;
        const consumptionIsValid =
          consumptionDifference === null
            ? null
            : Math.abs(consumptionDifference) <= VALIDATION_TOLERANCE;

        const rate = this.parsePolishNumber(metricRow.rate);
        const reportedTotal = this.parsePolishNumber(metricRow.total);
        const computedTotal =
          consumptionReported !== null && rate !== null
            ? this.roundTo2(consumptionReported * rate)
            : null;
        const totalDifference =
          reportedTotal !== null && computedTotal !== null
            ? this.roundTo2(reportedTotal - computedTotal)
            : null;
        const totalIsValid =
          totalDifference === null
            ? null
            : Math.abs(totalDifference) <= VALIDATION_TOLERANCE;

        const hasValidationIssue =
          consumptionIsValid === false || totalIsValid === false;
        const hasValueIssue =
          consumptionReported !== null && consumptionReported <= 0;
        if (includeOnlyMismatches && !hasValidationIssue && !hasValueIssue) {
          filteredByMismatchFlag += 1;
          continue;
        }

        rows.push({
          address,
          apartment,
          apartmentFull: record.apartment,
          dateFrom: normalizedDateFrom,
          dateTo: normalizedDateTo,
          periodKey,
          metric: metricRow.metric,
          startValue,
          endValue,
          consumptionReported,
          consumptionComputed,
          consumptionDifference,
          consumptionIsValid,
          rate,
          reportedTotal,
          computedTotal,
          totalDifference,
          totalIsValid,
        });
      }

      if (traceLabel && processedRecords % 25 === 0) {
        this.logger.debug(
          `[export:${traceLabel}] buildDetailedRows progress processedRecords=${processedRecords}/${totalRecords} emittedRows=${rows.length}`
        );
      }
    }

    if (traceLabel) {
      this.logger.debug(
        `[export:${traceLabel}] buildDetailedRows finished emittedRows=${rows.length} filteredByApartment=${filteredByApartment} filteredByRange=${filteredByRange} filteredByMismatchFlag=${filteredByMismatchFlag}`
      );
    }

    return rows;
  }

  private buildExportPayload(
    detailedRows: DetailedSummaryRow[],
    exportColumns: ExportColumnKey[],
    includeYearlySummary: boolean,
    traceLabel?: string
  ): ExcelExportPayload {
    if (traceLabel) {
      this.logger.debug(
        `[export:${traceLabel}] buildExportPayload started detailedRows=${detailedRows.length} includeYearly=${includeYearlySummary}`
      );
    }

    const periodMap = new Map<
      string,
      { key: string; from: string; to: string; label: string }
    >();
    for (const row of detailedRows) {
      if (!periodMap.has(row.periodKey)) {
        periodMap.set(row.periodKey, {
          key: row.periodKey,
          from: row.dateFrom,
          to: row.dateTo,
          label: `${row.dateFrom} - ${row.dateTo}`,
        });
      }
    }

    const periods = Array.from(periodMap.values()).sort((left, right) => {
      const fromCompare = left.from.localeCompare(right.from);
      if (fromCompare !== 0) {
        return fromCompare;
      }

      return left.to.localeCompare(right.to);
    });

    const headers = [
      "Adres",
      "Lokal",
      "Metryka",
      ...periods.flatMap((period) =>
        exportColumns.map(
          (columnKey) => `${period.label} | ${EXPORT_COLUMN_LABELS[columnKey]}`
        )
      ),
    ];

    const groupedRows = new Map<
      string,
      {
        address: string;
        apartment: string;
        metric: string;
        byPeriod: Map<string, DetailedSummaryRow>;
      }
    >();

    for (const row of detailedRows) {
      const key = `${row.address}|${row.apartment}|${row.metric}`;
      const existing = groupedRows.get(key);
      if (existing) {
        existing.byPeriod.set(row.periodKey, row);
        continue;
      }

      groupedRows.set(key, {
        address: row.address,
        apartment: row.apartment,
        metric: row.metric,
        byPeriod: new Map([[row.periodKey, row]]),
      });
    }

    const rows: ExportTableRow[] = Array.from(groupedRows.values())
      .sort((left, right) => {
        const addressCompare = left.address.localeCompare(right.address);
        if (addressCompare !== 0) {
          return addressCompare;
        }

        const apartmentCompare = this.compareApartments(left.apartment, right.apartment);
        if (apartmentCompare !== 0) {
          return apartmentCompare;
        }

        return left.metric.localeCompare(right.metric);
      })
      .map((group) => ({
        address: group.address,
        apartment: group.apartment,
        metric: group.metric,
        cells: periods.flatMap((period) =>
          exportColumns.map((columnKey) =>
            this.resolveDetailedExportCell(
              group.byPeriod.get(period.key),
              columnKey
            )
          )
        ),
      }));

    const yearlyHeaders = [
      "Adres",
      "Lokal",
      "Metryka",
      "Rok",
      "Zużycie",
      "Zużycie wyliczone",
      "Suma raportowana",
      "Suma wyliczona",
      "Różnica sumy",
      "Liczba okresów",
      "Status roczny",
    ];

    // Build rate outlier set: for each metric+period find the dominant rate,
    // then flag rows whose rate differs from it.
    const rateColumnIndex = exportColumns.indexOf("rate");
    const rateOutliers = new Set<RateOutlierKey>();

    if (rateColumnIndex >= 0) {
      const dominantRateMap = this.buildDominantRateMap(detailedRows);

      for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
        const exportRow = rows[rowIdx];
        for (let periodIdx = 0; periodIdx < periods.length; periodIdx++) {
          const cellOffset = periodIdx * exportColumns.length + rateColumnIndex;
          const rateCell = exportRow.cells[cellOffset];
          if (rateCell.value === null || typeof rateCell.value !== "number") {
            continue;
          }

          const dominantKey = `${exportRow.metric}|${periods[periodIdx].key}`;
          const dominant = dominantRateMap.get(dominantKey);
          if (
            dominant !== undefined &&
            Math.abs(rateCell.value - dominant) > VALIDATION_TOLERANCE
          ) {
            rateOutliers.add(`${rowIdx}:${cellOffset}` as RateOutlierKey);
          }
        }
      }
    }

    // Fixed-fee summary: sum reportedTotal for "Opłata stała" per period
    const fixedFeeSummary = new Map<string, number>();
    for (const row of detailedRows) {
      if (row.metric.toLowerCase() === "opłata stała" && row.reportedTotal !== null) {
        const prev = fixedFeeSummary.get(row.periodKey) ?? 0;
        fixedFeeSummary.set(row.periodKey, prev + row.reportedTotal);
      }
    }

    const result = {
      headers,
      periods: periods.map((period) => ({
        label: period.label,
        columnCount: exportColumns.length,
      })),
      columnLabels: exportColumns.map(
        (columnKey) => EXPORT_COLUMN_LABELS[columnKey]
      ),
      rows,
      rateOutliers,
      fixedFeeSummary,
      yearlyHeaders,
      yearlyRows: includeYearlySummary
        ? this.buildYearlyExportRows(detailedRows)
        : [],
      generatedAt: new Date().toISOString(),
    };

    if (traceLabel) {
      this.logger.debug(
        `[export:${traceLabel}] buildExportPayload finished periods=${periods.length} rows=${result.rows.length} yearlyRows=${result.yearlyRows.length} headers=${result.headers.length}`
      );
    }

    return result;
  }

  private buildYearlyExportRows(
    detailedRows: DetailedSummaryRow[]
  ): ExportYearlyRow[] {
    const groupMap = new Map<
      string,
      {
        address: string;
        apartment: string;
        metric: string;
        year: number;
        rows: DetailedSummaryRow[];
        intervals: Array<{ start: number; end: number }>;
      }
    >();

    for (const row of detailedRows) {
      const start = this.toUtcTimestamp(row.dateFrom);
      const end = this.toUtcTimestamp(row.dateTo);
      const yearFrom = this.getYearFromIsoDate(row.dateFrom);
      const yearTo = this.getYearFromIsoDate(row.dateTo);

      if (
        start === null ||
        end === null ||
        yearFrom === null ||
        yearTo === null ||
        yearFrom !== yearTo
      ) {
        continue;
      }

      const key = `${row.address}|${row.apartment}|${row.metric}|${yearFrom}`;
      const existing = groupMap.get(key);
      if (existing) {
        existing.rows.push(row);
        existing.intervals.push({ start, end });
        continue;
      }

      groupMap.set(key, {
        address: row.address,
        apartment: row.apartment,
        metric: row.metric,
        year: yearFrom,
        rows: [row],
        intervals: [{ start, end }],
      });
    }

    return Array.from(groupMap.values())
      .sort((left, right) => {
        const addressCompare = left.address.localeCompare(right.address);
        if (addressCompare !== 0) {
          return addressCompare;
        }

        const apartmentCompare = this.compareApartments(left.apartment, right.apartment);
        if (apartmentCompare !== 0) {
          return apartmentCompare;
        }

        const metricCompare = left.metric.localeCompare(right.metric);
        if (metricCompare !== 0) {
          return metricCompare;
        }

        return left.year - right.year;
      })
      .filter((group) => this.isFullYearCoverage(group.intervals, group.year))
      .map((group) => {
        const totalConsumptionReported = this.roundTo2(
          group.rows.reduce(
            (sum, row) => sum + (row.consumptionReported ?? 0),
            0
          )
        );
        const totalConsumptionComputed = this.roundTo2(
          group.rows.reduce(
            (sum, row) => sum + (row.consumptionComputed ?? 0),
            0
          )
        );
        const totalReported = this.roundTo2(
          group.rows.reduce((sum, row) => sum + (row.reportedTotal ?? 0), 0)
        );
        const totalComputed = this.roundTo2(
          group.rows.reduce((sum, row) => sum + (row.computedTotal ?? 0), 0)
        );
        const difference = this.roundTo2(totalReported - totalComputed);

        const hasIssues =
          group.rows.some(
            (row) =>
              row.consumptionIsValid === false ||
              row.totalIsValid === false ||
              (row.consumptionReported !== null && row.consumptionReported <= 0)
          ) || Math.abs(difference) > VALIDATION_TOLERANCE;

        const yearlyStatus = hasIssues ? "Wymaga sprawdzenia" : "OK";

        return {
          values: [
            group.address,
            group.apartment,
            group.metric,
            group.year,
            totalConsumptionReported,
            totalConsumptionComputed,
            totalReported,
            totalComputed,
            difference,
            group.rows.length,
            yearlyStatus,
          ],
          styles: [
            null,
            null,
            null,
            null,
            this.resolveConsumptionValueStyle(totalConsumptionReported),
            this.resolveConsumptionValueStyle(totalConsumptionComputed),
            null,
            null,
            Math.abs(difference) <= VALIDATION_TOLERANCE ? "ok" : "error",
            null,
            hasIssues ? "error" : "ok",
          ],
        };
      });
  }

  private buildYearOverYearExportRows(
    detailedRows: DetailedSummaryRow[],
    comparisonMonth: number
  ): YearOverYearExportRow[] {
    const groups = new Map<
      string,
      {
        address: string;
        apartment: string;
        metric: string;
        periodsByYear: Map<
          number,
          Array<{
            start: number;
            end: number;
            fromTimestamp: number;
            toTimestamp: number;
            toMonth: number;
          }>
        >;
      }
    >();

    for (const row of detailedRows) {
      if (row.startValue === null || row.endValue === null) {
        continue;
      }

      const normalizedDateFrom = this.normalizeDate(row.dateFrom);
      const normalizedDateTo = this.normalizeDate(row.dateTo);
      if (!normalizedDateFrom || !normalizedDateTo) {
        continue;
      }

      const fromTimestamp = this.toUtcTimestamp(normalizedDateFrom);
      const toTimestamp = this.toUtcTimestamp(normalizedDateTo);
      if (fromTimestamp === null || toTimestamp === null) {
        continue;
      }

      const year = Number(normalizedDateTo.slice(0, 4));
      const toMonth = Number(normalizedDateTo.slice(5, 7));
      if (!Number.isFinite(year)) {
        continue;
      }

      const key = `${row.address}|${row.apartment}|${row.metric}`;
      const existing = groups.get(key);
      if (existing) {
        const yearPeriods = existing.periodsByYear.get(year) ?? [];
        yearPeriods.push({
          start: row.startValue,
          end: row.endValue,
          fromTimestamp,
          toTimestamp,
          toMonth,
        });
        existing.periodsByYear.set(year, yearPeriods);
        continue;
      }

      groups.set(key, {
        address: row.address,
        apartment: row.apartment,
        metric: row.metric,
        periodsByYear: new Map([
          [
            year,
            [
              {
                start: row.startValue,
                end: row.endValue,
                fromTimestamp,
                toTimestamp,
                toMonth,
              },
            ],
          ],
        ]),
      });
    }

    const result: YearOverYearExportRow[] = [];
    for (const group of groups.values()) {
      const annualConsumptionByYear = new Map<
        number,
        { consumption: number; note: string | null }
      >();

      for (const [year, periods] of group.periodsByYear) {
        if (periods.length === 0) {
          continue;
        }

        periods.sort((left, right) => {
          const fromCompare = left.fromTimestamp - right.fromTimestamp;
          if (fromCompare !== 0) {
            return fromCompare;
          }

          return left.toTimestamp - right.toTimestamp;
        });

        const first = periods[0];
        const last = periods[periods.length - 1];
        const annualConsumption = this.roundTo2(last.end - first.start);
        const summedPeriods = this.roundTo2(
          periods.reduce((sum, period) => sum + (period.end - period.start), 0)
        );

        let hasContinuityIssue = false;
        for (let index = 1; index < periods.length; index += 1) {
          if (
            Math.abs(periods[index - 1].end - periods[index].start) >
            VALIDATION_TOLERANCE
          ) {
            hasContinuityIssue = true;
            break;
          }
        }

        const noteParts: string[] = [];
        if (last.toMonth !== comparisonMonth) {
          noteParts.push(
            `Rok ${year}: brak zamkniecia w miesiacu ${comparisonMonth}.`
          );
        }
        if (hasContinuityIssue) {
          noteParts.push(`Rok ${year}: niespojna ciaglosc odczytow.`);
        }
        if (
          Math.abs(summedPeriods - annualConsumption) > VALIDATION_TOLERANCE
        ) {
          noteParts.push(
            `Rok ${year}: suma okresow rozni sie od rocznej roznicy odczytow.`
          );
        }

        annualConsumptionByYear.set(year, {
          consumption: annualConsumption,
          note: noteParts.length > 0 ? noteParts.join(" ") : null,
        });
      }

      const years = Array.from(annualConsumptionByYear.keys()).sort(
        (left, right) => left - right
      );
      if (years.length < 2) {
        continue;
      }

      for (const compareYear of years) {
        const baseYear = compareYear - 1;
        const baseYearData = annualConsumptionByYear.get(baseYear);
        const compareYearData = annualConsumptionByYear.get(compareYear);
        if (
          baseYearData === undefined ||
          compareYearData === undefined
        ) {
          continue;
        }

        const baseConsumption = baseYearData.consumption;
        const compareConsumption = compareYearData.consumption;
        const difference = this.roundTo2(compareConsumption - baseConsumption);
        const changePercent =
          Math.abs(baseConsumption) <= VALIDATION_TOLERANCE
            ? null
            : this.roundTo2((difference / baseConsumption) * 100);
        const trend =
          Math.abs(difference) <= VALIDATION_TOLERANCE
            ? "Bez zmian"
            : difference > 0
            ? "Wzrost"
            : "Spadek";

        const noteParts: string[] = [];
        if (baseConsumption < 0 || compareConsumption < 0) {
          noteParts.push("Sprawdz odczyty: ujemne zuzycie roczne.");
        }
        if (changePercent === null) {
          noteParts.push("Brak procentu: zuzycie bazowe bliskie zera.");
        }
        if (baseYearData.note) {
          noteParts.push(baseYearData.note);
        }
        if (compareYearData.note) {
          noteParts.push(compareYearData.note);
        }

        result.push({
          address: group.address,
          apartment: group.apartment,
          metric: group.metric,
          baseYear,
          compareYear,
          baseConsumption,
          compareConsumption,
          difference,
          changePercent,
          trend,
          note: noteParts.length > 0 ? noteParts.join(" ") : null,
        });
      }
    }

    return result.sort((left, right) => {
      const addressCompare = left.address.localeCompare(right.address);
      if (addressCompare !== 0) {
        return addressCompare;
      }

      const apartmentCompare = this.compareApartments(left.apartment, right.apartment);
      if (apartmentCompare !== 0) {
        return apartmentCompare;
      }

      const metricCompare = left.metric.localeCompare(right.metric);
      if (metricCompare !== 0) {
        return metricCompare;
      }

      return left.compareYear - right.compareYear;
    });
  }

  private resolveDetailedExportCell(
    row: DetailedSummaryRow | undefined,
    columnKey: ExportColumnKey
  ): ExportCell {
    if (!row) {
      return { value: null, style: null };
    }

    switch (columnKey) {
      case "previousReading":
        return { value: row.startValue, style: null };
      case "currentReading":
        return { value: row.endValue, style: null };
      case "consumptionReported":
        return {
          value: row.consumptionReported,
          style: this.resolveConsumptionValueStyle(row.consumptionReported),
        };
      case "consumptionComputed":
        return {
          value: row.consumptionComputed,
          style: this.resolveConsumptionValueStyle(row.consumptionComputed),
        };
      case "consumptionStatus":
        return this.resolveConsumptionStatusCell(row);
      case "rate":
        return { value: row.rate, style: null };
      case "reportedTotal":
        return { value: row.reportedTotal, style: null };
      case "computedTotal":
        return { value: row.computedTotal, style: null };
      case "totalStatus":
        return this.resolveTotalStatusCell(row);
      default:
        return { value: null, style: null };
    }
  }

  private resolveConsumptionStatusCell(row: DetailedSummaryRow): ExportCell {
    const consumptionStyle = this.resolveConsumptionValueStyle(
      row.consumptionReported
    );
    if (consumptionStyle === "negative") {
      return { value: "Ujemne", style: "negative" };
    }

    if (consumptionStyle === "zero") {
      return { value: "Zero", style: "zero" };
    }

    if (row.consumptionIsValid === true) {
      return { value: "OK", style: "ok" };
    }

    if (row.consumptionIsValid === false) {
      return { value: "Błąd", style: "error" };
    }

    return { value: "N/D", style: "warning" };
  }

  private resolveTotalStatusCell(row: DetailedSummaryRow): ExportCell {
    if (row.totalIsValid === true) {
      return { value: "OK", style: "ok" };
    }

    if (row.totalIsValid === false) {
      return { value: "Błąd", style: "error" };
    }

    return { value: "N/D", style: "warning" };
  }

  private buildDominantRateMap(detailedRows: DetailedSummaryRow[]) {
    // Group rates by metric+period, then pick the most frequent rate as dominant.
    const ratesByKey = new Map<string, number[]>();

    for (const row of detailedRows) {
      if (row.rate === null) {
        continue;
      }

      const key = `${row.metric}|${row.periodKey}`;
      const existing = ratesByKey.get(key);
      if (existing) {
        existing.push(row.rate);
      } else {
        ratesByKey.set(key, [row.rate]);
      }
    }

    const dominantMap = new Map<string, number>();
    for (const [key, rates] of ratesByKey) {
      const frequency = new Map<number, number>();
      for (const rate of rates) {
        frequency.set(rate, (frequency.get(rate) ?? 0) + 1);
      }

      let dominantRate = rates[0];
      let maxCount = 0;
      for (const [rate, count] of frequency) {
        if (count > maxCount) {
          maxCount = count;
          dominantRate = rate;
        }
      }

      dominantMap.set(key, dominantRate);
    }

    return dominantMap;
  }

  private resolveConsumptionValueStyle(
    value: number | null
  ): ExportCellStyle | null {
    if (value === null) {
      return null;
    }

    if (value < 0) {
      return "negative";
    }

    if (value === 0) {
      return "zero";
    }

    return null;
  }

  private resolveYearOverYearDifferenceStyle(
    difference: number
  ): ExportCellStyle | null {
    if (Math.abs(difference) <= VALIDATION_TOLERANCE) {
      return "zero";
    }

    if (difference < 0) {
      return "ok";
    }

    return "warning";
  }

  private resolveExportColumns(requestedColumns?: string[]) {
    const pickedColumns = (requestedColumns ?? [])
      .map((value) => value.trim())
      .filter((value): value is ExportColumnKey =>
        this.isExportColumnKey(value)
      );
    const uniquePickedColumns = Array.from(new Set(pickedColumns));

    return uniquePickedColumns.length > 0
      ? uniquePickedColumns
      : DEFAULT_EXPORT_COLUMNS;
  }

  private isExportColumnKey(value: string): value is ExportColumnKey {
    return Object.prototype.hasOwnProperty.call(EXPORT_COLUMN_LABELS, value);
  }

  private resolveSelectedMetrics(
    requestedMetrics: string[] | undefined,
    workbookHeaders: string[]
  ) {
    const selected = (requestedMetrics ?? [])
      .map((metric) => metric.trim())
      .filter((metric) => metric.length > 0);

    return selected.length > 0 ? selected : workbookHeaders;
  }

  private mergeParsedWorkbooks(
    workbooks: ParsedExcelWorkbook[]
  ): ParsedExcelWorkbook {
    if (workbooks.length === 0) {
      throw new BadRequestException("No parsed workbook data available");
    }

    const headers = Array.from(
      new Set(workbooks.flatMap((workbook) => workbook.headers))
    );

    const recordMap = new Map<string, ParsedExcelRecord>();
    for (let workbookIdx = 0; workbookIdx < workbooks.length; workbookIdx++) {
      const workbook = workbooks[workbookIdx];
      for (const record of workbook.records) {
        const metricByName = new Map(
          record.metrics.map((metric) => [metric.metric, metric] as const)
        );
        const alignedMetrics = headers.map((header) => {
          const matched = metricByName.get(header);
          return (
            matched ?? {
              metric: header,
              startValue: "",
              endValue: "",
              consumption: "",
              rate: "",
              total: "",
            }
          );
        });
        const key = `${workbookIdx}|${record.apartment}|${record.dateFrom}|${record.dateTo}`;
        recordMap.set(key, {
          apartment: record.apartment,
          dateFrom: record.dateFrom,
          dateTo: record.dateTo,
          metrics: alignedMetrics,
        });
      }
    }

    const records = Array.from(recordMap.values()).sort((left, right) => {
      const apartmentCompare = left.apartment.localeCompare(right.apartment);
      if (apartmentCompare !== 0) {
        return apartmentCompare;
      }

      const leftFrom = this.normalizeDate(left.dateFrom) ?? "";
      const rightFrom = this.normalizeDate(right.dateFrom) ?? "";
      const dateCompare = leftFrom.localeCompare(rightFrom);
      if (dateCompare !== 0) {
        return dateCompare;
      }

      const leftTo = this.normalizeDate(left.dateTo) ?? "";
      const rightTo = this.normalizeDate(right.dateTo) ?? "";
      return leftTo.localeCompare(rightTo);
    });

    return {
      headers,
      recordCount: records.length,
      records,
    };
  }

  private roundTo2(value: number) {
    return Math.round(value * 100) / 100;
  }

  private parsePolishNumber(
    rawValue: string | null | undefined
  ): number | null {
    if (!rawValue) {
      return null;
    }

    const trimmed = rawValue.trim();
    if (!trimmed) {
      return null;
    }

    let normalized = trimmed.replace(/\s+/g, "");
    if (normalized.includes(",") && normalized.includes(".")) {
      normalized = normalized.replace(/\./g, "").replace(",", ".");
    } else if (normalized.includes(",")) {
      normalized = normalized.replace(",", ".");
    }

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private normalizeDate(rawValue?: string) {
    if (!rawValue) {
      return null;
    }

    const trimmed = rawValue.trim();
    if (!trimmed) {
      return null;
    }

    const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) {
      return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
    }

    const polishMatch = trimmed.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
    if (polishMatch) {
      const day = Number(polishMatch[1]);
      const month = Number(polishMatch[2]);
      const year = Number(polishMatch[3]);
      const date = new Date(Date.UTC(year, month - 1, day));
      if (
        date.getUTCFullYear() === year &&
        date.getUTCMonth() === month - 1 &&
        date.getUTCDate() === day
      ) {
        return date.toISOString().slice(0, 10);
      }
    }

    const date = new Date(trimmed);
    if (Number.isNaN(date.getTime())) {
      return null;
    }

    return date.toISOString().slice(0, 10);
  }

  private isRecordInsideRange(
    record: ParsedExcelRecord,
    rangeFrom: string | null,
    rangeTo: string | null
  ) {
    const recordFrom = this.normalizeDate(record.dateFrom);
    const recordTo = this.normalizeDate(record.dateTo);

    if (!recordFrom || !recordTo) {
      return true;
    }

    if (rangeFrom && recordTo < rangeFrom) {
      return false;
    }

    if (rangeTo && recordFrom > rangeTo) {
      return false;
    }

    return true;
  }

  private extractAddress(apartmentValue: string) {
    const trimmed = apartmentValue.trim();
    if (!trimmed) {
      return null;
    }

    const addressPart = trimmed.split("/")[0]?.trim();
    return addressPart && addressPart.length > 0 ? addressPart : trimmed;
  }

  private compareApartments(a: string, b: string): number {
    const parseApartment = (s: string) => {
      const match = s.match(/^(\d+)(.*)/);
      if (match) {
        return { num: parseInt(match[1], 10), rest: match[2] };
      }
      return { num: NaN, rest: s };
    };
    const pa = parseApartment(a);
    const pb = parseApartment(b);
    if (!isNaN(pa.num) && !isNaN(pb.num)) {
      if (pa.num !== pb.num) return pa.num - pb.num;
      return pa.rest.localeCompare(pb.rest);
    }
    return a.localeCompare(b);
  }

  private splitApartment(apartmentValue: string) {
    const trimmed = apartmentValue.trim();
    if (!trimmed) {
      return {
        address: "Brak adresu",
        apartment: "Brak lokalu",
      };
    }

    const splitIndex = trimmed.indexOf("/");
    if (splitIndex < 0) {
      return {
        address: trimmed,
        apartment: trimmed,
      };
    }

    const address = trimmed.slice(0, splitIndex).trim() || trimmed;
    const apartment = trimmed.slice(splitIndex + 1).trim() || trimmed;

    return {
      address,
      apartment,
    };
  }

  private buildAnalysisDraft(
    uploadId: string,
    parsedWorkbook: ParsedExcelWorkbook,
    sourceFiles: string[]
  ) {
    const apartments = Array.from(
      new Set(
        parsedWorkbook.records
          .map((record) => record.apartment)
          .filter((value) => value.length > 0)
      )
    ).sort((left, right) => this.compareApartments(left, right));
    const addresses = Array.from(
      new Set(
        apartments
          .map((apartment) => this.extractAddress(apartment))
          .filter(Boolean) as string[]
      )
    ).sort((left, right) => left.localeCompare(right));

    const allDates = parsedWorkbook.records
      .flatMap((record) => [
        this.normalizeDate(record.dateFrom),
        this.normalizeDate(record.dateTo),
      ])
      .filter(Boolean) as string[];
    allDates.sort((left, right) => left.localeCompare(right));

    return {
      uploadId,
      apartments,
      addresses,
      availableMetrics: parsedWorkbook.headers,
      periodRange: {
        min: allDates[0] ?? null,
        max: allDates[allDates.length - 1] ?? null,
      },
      recordsCount: parsedWorkbook.records.length,
      generatedAt: new Date().toISOString(),
      sourceFiles,
      filesCount: sourceFiles.length,
    };
  }

  private async parseWorkbookFromBuffer(
    buffer: Buffer
  ): Promise<ParsedExcelWorkbook> {
    try {
      const workbook = XLSX.read(buffer, {
        type: "buffer",
        raw: false,
        cellText: true,
        cellFormula: false,
      });
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) {
        throw new Error("Workbook has no worksheets");
      }

      const worksheet = workbook.Sheets[firstSheetName];
      if (!worksheet) {
        throw new Error("Workbook has no readable worksheets");
      }

      return this.parseWorksheetBlocks(worksheet);
    } catch (error) {
      const reason =
        error instanceof Error ? error.message : "Unknown parse error";
      throw new Error(
        `Unsupported Excel shape. Expected worksheet with apartment settlement blocks. (${reason})`
      );
    }
  }

  private parseWorksheetBlocks(worksheet: XLSX.WorkSheet): ParsedExcelWorkbook {
    const rangeRef = worksheet["!ref"];
    if (!rangeRef) {
      throw new Error("Worksheet is empty");
    }

    const range = XLSX.utils.decode_range(rangeRef);
    const headerColumns: Array<{ name: string; col: number }> = [];
    for (let col = 2; col <= range.e.c; col += 1) {
      const header = this.getWorksheetCellText(worksheet, 0, col);
      if (header.length > 0) {
        headerColumns.push({ name: header, col });
      }
    }
    if (headerColumns.length === 0) {
      throw new Error("Header row is missing metric columns");
    }

    const headers = headerColumns.map((entry) => entry.name);
    const records: ParsedExcelRecord[] = [];

    let row = 1;
    while (row <= range.e.r) {
      const apartment = this.getWorksheetCellText(worksheet, row, 0);
      const dateFrom = this.getWorksheetCellText(worksheet, row, 1);
      if (!apartment || !dateFrom) {
        row += 1;
        continue;
      }

      if (row + 4 > range.e.r) {
        break;
      }

      const dateTo = this.getWorksheetCellText(worksheet, row + 1, 1);
      const metrics = headerColumns.map((entry) => ({
        metric: entry.name,
        startValue: this.getWorksheetCellText(worksheet, row, entry.col),
        endValue: this.getWorksheetCellText(worksheet, row + 1, entry.col),
        consumption: this.getWorksheetCellText(worksheet, row + 2, entry.col),
        rate: this.getWorksheetCellText(worksheet, row + 3, entry.col),
        total: this.getWorksheetCellText(worksheet, row + 4, entry.col),
      }));

      records.push({
        apartment,
        dateFrom,
        dateTo,
        metrics,
      });
      row += 5;
    }

    return {
      headers,
      recordCount: records.length,
      records,
    };
  }

  private getWorksheetCellText(
    worksheet: XLSX.WorkSheet,
    row: number,
    col: number
  ) {
    const address = XLSX.utils.encode_cell({ r: row, c: col });
    const cell = worksheet[address] as XLSX.CellObject | undefined;
    if (!cell) {
      return "";
    }

    if (typeof cell.w === "string") {
      const formattedText = cell.w.trim();
      if (formattedText.length > 0) {
        return formattedText;
      }
    }

    if (cell.v === null || cell.v === undefined) {
      return "";
    }

    if (cell.v instanceof Date) {
      return cell.v.toISOString().slice(0, 10);
    }

    return String(cell.v).trim();
  }

  private toUtcTimestamp(rawDate: string) {
    const normalized = this.normalizeDate(rawDate);
    if (!normalized) {
      return null;
    }

    const timestamp = Date.parse(`${normalized}T00:00:00Z`);
    return Number.isFinite(timestamp) ? timestamp : null;
  }

  private getYearFromIsoDate(rawDate: string) {
    const normalized = this.normalizeDate(rawDate);
    if (!normalized) {
      return null;
    }

    const year = Number(normalized.slice(0, 4));
    return Number.isFinite(year) ? year : null;
  }

  private isFullYearCoverage(
    intervals: Array<{ start: number; end: number }>,
    year: number
  ) {
    if (intervals.length === 0) {
      return false;
    }

    const yearStart = Date.UTC(year, 0, 1);
    const yearEnd = Date.UTC(year, 11, 31);

    const normalizedIntervals = intervals
      .map((interval) => ({
        start: Math.max(interval.start, yearStart),
        end: Math.min(interval.end, yearEnd),
      }))
      .filter((interval) => interval.start <= interval.end)
      .sort((left, right) => left.start - right.start);

    if (normalizedIntervals.length === 0) {
      return false;
    }

    const merged: Array<{ start: number; end: number }> = [
      { start: normalizedIntervals[0].start, end: normalizedIntervals[0].end },
    ];

    for (let index = 1; index < normalizedIntervals.length; index += 1) {
      const current = normalizedIntervals[index];
      const last = merged[merged.length - 1];

      if (current.start <= last.end + DAY_MS) {
        last.end = Math.max(last.end, current.end);
      } else {
        merged.push({ start: current.start, end: current.end });
      }
    }

    return (
      merged.length === 1 &&
      merged[0].start <= yearStart &&
      merged[0].end >= yearEnd
    );
  }
}
