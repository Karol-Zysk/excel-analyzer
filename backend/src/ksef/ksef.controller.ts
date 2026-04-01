import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Request } from "express";
import type { User } from "@supabase/supabase-js";
import { SupabaseAuthGuard } from "../auth/supabase-auth.guard";
import { SupabaseService } from "../supabase/supabase.service";
import { GenerateKsefXmlDto } from "./dto/generate-ksef-xml.dto";
import { SaveKsefCompanyProfileDto } from "./dto/save-ksef-company-profile.dto";
import { KsefService } from "./ksef.service";

type UploadedSpreadsheetFile = {
  buffer?: Buffer;
  path?: string;
  mimetype: string;
  size: number;
  originalname: string;
};

type RequestWithUser = Request & {
  user: User;
};

@Controller("ksef")
export class KsefController {
  constructor(
    private readonly ksefService: KsefService,
    private readonly supabaseService: SupabaseService
  ) {}

  @Get("company-profiles")
  @UseGuards(SupabaseAuthGuard)
  async getCompanyProfiles(@Req() req: RequestWithUser) {
    const profiles = await this.supabaseService.listKsefCompanyProfiles(req.user.id);

    return {
      count: profiles.length,
      profiles
    };
  }

  @Post("company-profiles")
  @UseGuards(SupabaseAuthGuard)
  async saveCompanyProfile(
    @Body() payload: SaveKsefCompanyProfileDto,
    @Req() req: RequestWithUser
  ) {
    const result = await this.supabaseService.saveKsefCompanyProfile(req.user.id, {
      id: payload.id,
      companyName: payload.companyName,
      nip: payload.nip,
      countryCode: payload.countryCode,
      addressLine1: payload.addressLine1,
      addressLine2: payload.addressLine2,
      email: payload.email,
      phone: payload.phone,
      currency: payload.currency,
      paymentMethod: payload.paymentMethod,
      bankAccount: payload.bankAccount
    });

    if (!result.updated) {
      throw new BadRequestException(result.error ?? "Nie udalo sie zapisac podmiotu.");
    }

    return {
      saved: true,
      profile: result.profile,
      profiles: result.profiles
    };
  }

  @Delete("company-profiles/:id")
  @UseGuards(SupabaseAuthGuard)
  async deleteCompanyProfile(@Param("id") id: string, @Req() req: RequestWithUser) {
    const result = await this.supabaseService.deleteKsefCompanyProfile(req.user.id, id);

    if (!result.deleted) {
      throw new BadRequestException(result.error ?? "Nie udalo sie usunac podmiotu.");
    }

    return result;
  }

  @Post("generate-xml")
  @UseGuards(SupabaseAuthGuard)
  async generateXml(@Body() payload: GenerateKsefXmlDto, @Req() req: RequestWithUser) {
    const result = await this.ksefService.generateXml(payload);

    if (result.valid) {
      void this.supabaseService.incrementKsefGeneratedCount(req.user.id, 1);
    }

    return result;
  }

  @Post("import-excel")
  @UseGuards(SupabaseAuthGuard)
  @UseInterceptors(
    FileInterceptor("file", {
      limits: {
        fileSize: 20 * 1024 * 1024
      }
    })
  )
  async importExcel(
    @UploadedFile() file: UploadedSpreadsheetFile | undefined,
    @Req() req: RequestWithUser
  ) {
    if (!file) {
      throw new BadRequestException("Missing file field in multipart/form-data");
    }

    const result = await this.ksefService.importExcel(file);
    if (result.summary.validInvoices > 0) {
      void this.supabaseService.incrementKsefGeneratedCount(req.user.id, result.summary.validInvoices);
    }

    return result;
  }

  @Post("analyze-excel")
  @UseGuards(SupabaseAuthGuard)
  @UseInterceptors(
    FileInterceptor("file", {
      limits: {
        fileSize: 20 * 1024 * 1024
      }
    })
  )
  async analyzeExcel(@UploadedFile() file: UploadedSpreadsheetFile | undefined) {
    if (!file) {
      throw new BadRequestException("Missing file field in multipart/form-data");
    }

    return this.ksefService.analyzeExcel(file);
  }

  @Post("import-excel-mapped")
  @UseGuards(SupabaseAuthGuard)
  @UseInterceptors(
    FileInterceptor("file", {
      limits: {
        fileSize: 20 * 1024 * 1024
      }
    })
  )
  async importExcelMapped(
    @UploadedFile() file: UploadedSpreadsheetFile | undefined,
    @Body("config") configJson: string | undefined,
    @Req() req: RequestWithUser
  ) {
    if (!file) {
      throw new BadRequestException("Missing file field in multipart/form-data");
    }

    if (!configJson) {
      throw new BadRequestException("Missing config field in multipart/form-data");
    }

    let config: unknown;
    try {
      config = JSON.parse(configJson);
    } catch {
      throw new BadRequestException("Config field must contain valid JSON.");
    }

    const result = await this.ksefService.importExcelMapped(file, config);
    if (result.summary.generatedValid > 0) {
      void this.supabaseService.incrementKsefGeneratedCount(req.user.id, result.summary.generatedValid);
    }

    return result;
  }
}
