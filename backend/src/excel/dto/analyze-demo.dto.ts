import { IsInt, IsString, Max, Min } from "class-validator";

export class AnalyzeDemoDto {
  @IsString()
  fileName!: string;

  @IsInt()
  @Min(1)
  @Max(1_000_000)
  rowCount!: number;
}

