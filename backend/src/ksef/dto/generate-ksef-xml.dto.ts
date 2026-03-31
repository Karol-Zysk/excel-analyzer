import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateNested
} from "class-validator";
import { Type } from "class-transformer";

export const KSEF_BUYER_IDENTIFIER_TYPES = ["NIP", "EU_VAT", "OTHER", "NONE"] as const;
export const KSEF_PAYMENT_METHOD_VALUES = ["1", "2", "3", "4", "5", "6", "7"] as const;
export const KSEF_TAX_RATE_VALUES = [
  "23",
  "22",
  "8",
  "7",
  "5",
  "4",
  "3",
  "0 KR",
  "0 WDT",
  "0 EX",
  "zw",
  "oo",
  "np I",
  "np II"
] as const;

export type KsefBuyerIdentifierType = (typeof KSEF_BUYER_IDENTIFIER_TYPES)[number];
export type KsefPaymentMethodValue = (typeof KSEF_PAYMENT_METHOD_VALUES)[number];
export type KsefTaxRateValue = (typeof KSEF_TAX_RATE_VALUES)[number];

export class KsefAddressDto {
  @Matches(/^[A-Z]{2}$/)
  countryCode!: string;

  @IsString()
  @MaxLength(512)
  line1!: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  line2?: string;
}

export class KsefSellerDto {
  @Matches(/^\d{10}$/)
  nip!: string;

  @IsString()
  @MaxLength(512)
  name!: string;

  @ValidateNested()
  @Type(() => KsefAddressDto)
  address!: KsefAddressDto;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @Matches(/^[0-9+\-\s()]{6,30}$/)
  phone?: string;
}

export class KsefBuyerDto {
  @IsIn(KSEF_BUYER_IDENTIFIER_TYPES)
  identifierType!: KsefBuyerIdentifierType;

  @IsOptional()
  @Matches(/^\d{10}$/)
  nip?: string;

  @IsOptional()
  @Matches(/^[A-Z]{2}$/)
  euCode?: string;

  @IsOptional()
  @Matches(/^[A-Z0-9]{2,20}$/)
  euVatNumber?: string;

  @IsOptional()
  @Matches(/^[A-Z]{2}$/)
  taxCountryCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  taxId?: string;

  @IsString()
  @MaxLength(512)
  name!: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => KsefAddressDto)
  address?: KsefAddressDto;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @Matches(/^[0-9+\-\s()]{6,30}$/)
  phone?: string;
}

export class KsefPaymentDto {
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsIn(KSEF_PAYMENT_METHOD_VALUES)
  method?: KsefPaymentMethodValue;

  @IsOptional()
  @IsString()
  @MaxLength(34)
  bankAccount?: string;
}

export class KsefInvoiceItemDto {
  @IsString()
  @MaxLength(512)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1024)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  productCode?: string;

  @IsString()
  @MaxLength(50)
  unit!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.0001)
  quantity!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(0)
  unitNetPrice!: number;

  @IsIn(KSEF_TAX_RATE_VALUES)
  taxRate!: KsefTaxRateValue;

  @IsOptional()
  @IsBoolean()
  annex15?: boolean;
}

export class GenerateKsefXmlDto {
  @ValidateNested()
  @Type(() => KsefSellerDto)
  seller!: KsefSellerDto;

  @ValidateNested()
  @Type(() => KsefBuyerDto)
  buyer!: KsefBuyerDto;

  @IsDateString()
  issueDate!: string;

  @IsOptional()
  @IsDateString()
  saleDate?: string;

  @IsString()
  @MaxLength(256)
  invoiceNumber!: string;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  placeOfIssue?: string;

  @IsOptional()
  @Matches(/^[A-Z]{3}$/)
  currency?: string;

  @IsOptional()
  @IsBoolean()
  cashAccounting?: boolean;

  @IsOptional()
  @IsBoolean()
  selfBilling?: boolean;

  @IsOptional()
  @IsBoolean()
  splitPayment?: boolean;

  @IsOptional()
  @IsBoolean()
  simplifiedProcedure?: boolean;

  @IsOptional()
  @IsBoolean()
  relatedEntities?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  exemptionReason?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  systemName?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => KsefPaymentDto)
  payment?: KsefPaymentDto;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => KsefInvoiceItemDto)
  items!: KsefInvoiceItemDto[];
}
