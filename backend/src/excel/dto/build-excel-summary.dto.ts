import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from "class-validator";

export class BuildExcelSummaryDto {
  @IsUUID()
  uploadId!: string;

  @IsOptional()
  @IsString()
  apartment?: string;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  metrics?: string[];

  @IsOptional()
  @IsBoolean()
  includeValidation?: boolean;

  @IsOptional()
  @IsBoolean()
  includeOnlyMismatches?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  exportColumns?: string[];

  @IsOptional()
  @IsBoolean()
  includeYearlySummary?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  comparisonMonth?: number;
}
