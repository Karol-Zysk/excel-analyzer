import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Logger,
  Post,
  Req,
  Res,
  UploadedFiles,
  UseGuards,
  UseInterceptors
} from "@nestjs/common";
import { FilesInterceptor } from "@nestjs/platform-express";
import { Request, Response } from "express";
import type { User } from "@supabase/supabase-js";
import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SupabaseAuthGuard } from "../auth/supabase-auth.guard";
import { AnalyzeDemoDto } from "./dto/analyze-demo.dto";
import { BuildExcelSummaryDto } from "./dto/build-excel-summary.dto";
import { ExcelService } from "./excel.service";

type RequestWithUser = Request & {
  user: User;
};

type UploadedExcelFile = {
  buffer?: Buffer;
  path?: string;
  mimetype: string;
  size: number;
  originalname: string;
};

const EXCEL_UPLOAD_TMP_DIR = join(tmpdir(), "excel-api-upload");
mkdirSync(EXCEL_UPLOAD_TMP_DIR, { recursive: true });

@Controller("excel")
export class ExcelController {
  private readonly logger = new Logger(ExcelController.name);

  constructor(private readonly excelService: ExcelService) {}

  @Get("ping")
  async pingSupabase() {
    return this.excelService.pingStorage();
  }

  @Post("analyze-demo")
  @UseGuards(SupabaseAuthGuard)
  async analyzeDemo(@Body() payload: AnalyzeDemoDto, @Req() req: RequestWithUser) {
    return this.excelService.analyzeDemo(payload, req.user);
  }

  @Post("upload")
  @UseGuards(SupabaseAuthGuard)
  @UseInterceptors(
    FilesInterceptor("file", 20, {
      dest: EXCEL_UPLOAD_TMP_DIR,
      limits: {
        fileSize: 50 * 1024 * 1024,
        files: 20
      }
    })
  )
  async uploadExcel(@UploadedFiles() files: UploadedExcelFile[] | undefined, @Req() req: RequestWithUser) {
    if (!files || files.length === 0) {
      throw new BadRequestException("Missing file field in multipart/form-data");
    }

    return this.excelService.uploadExcelFiles(files, req.user);
  }

  @Post("summary")
  @UseGuards(SupabaseAuthGuard)
  async buildSummary(@Body() payload: BuildExcelSummaryDto) {
    return this.excelService.buildSummary(payload);
  }

  @Post("summary/export")
  @UseGuards(SupabaseAuthGuard)
  async exportSummary(
    @Body() payload: BuildExcelSummaryDto,
    @Req() req: RequestWithUser,
    @Res() res: Response
  ) {
    const startedAt = Date.now();
    const exportLabel = payload.uploadId.slice(0, 8);
    this.logger.log(
      `[export:${exportLabel}] request received user=${req.user.id} includeYearly=${String(payload.includeYearlySummary ?? true)}`
    );

    const exported = await this.excelService.buildSummaryExcelFile(payload);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${exported.fileName}"`
    );
    res.status(200).send(exported.buffer);
    this.logger.log(
      `[export:${exportLabel}] response sent in ${Date.now() - startedAt}ms bytes=${exported.buffer.byteLength}`
    );
  }

  @Post("yoy/export")
  @UseGuards(SupabaseAuthGuard)
  async exportYearOverYear(
    @Body() payload: BuildExcelSummaryDto,
    @Req() req: RequestWithUser,
    @Res() res: Response
  ) {
    const startedAt = Date.now();
    const exportLabel = payload.uploadId.slice(0, 8);
    this.logger.log(
      `[yoy:${exportLabel}] request received user=${req.user.id} month=${String(payload.comparisonMonth ?? 12)}`
    );

    const exported = await this.excelService.buildYearOverYearExcelFile(payload);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${exported.fileName}"`
    );
    res.status(200).send(exported.buffer);
    this.logger.log(
      `[yoy:${exportLabel}] response sent in ${Date.now() - startedAt}ms bytes=${exported.buffer.byteLength}`
    );
  }
}
