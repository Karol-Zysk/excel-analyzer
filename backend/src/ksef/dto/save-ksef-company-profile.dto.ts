import { IsOptional, IsString, Matches, MaxLength } from "class-validator";

export class SaveKsefCompanyProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  id?: string;

  @IsString()
  @MaxLength(240)
  companyName!: string;

  @IsString()
  @Matches(/^\d{10}$/, { message: "NIP musi miec 10 cyfr." })
  nip!: string;

  @IsString()
  @Matches(/^[A-Z]{2}$/i, { message: "Kod kraju musi miec 2 litery." })
  countryCode!: string;

  @IsString()
  @MaxLength(240)
  addressLine1!: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  addressLine2?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  paymentMethod?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  bankAccount?: string;
}
