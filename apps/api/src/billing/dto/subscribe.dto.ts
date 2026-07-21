import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEmail, IsOptional, IsString, MaxLength } from "class-validator";

export class SubscribeDto {
  @ApiProperty({ description: "Plan code, e.g. starter / team / business" })
  @IsString()
  @MaxLength(64)
  planCode!: string;

  @ApiPropertyOptional({ description: "Billing email for invoices" })
  @IsEmail()
  @IsOptional()
  billingEmail?: string;

  @ApiPropertyOptional({ description: "Accept.js opaque data descriptor (from card tokenization)" })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  opaqueDataDescriptor?: string;

  @ApiPropertyOptional({ description: "Accept.js opaque data value (payment nonce)" })
  @IsOptional()
  @IsString()
  @MaxLength(8192)
  opaqueDataValue?: string;

  @ApiPropertyOptional({ description: "Cardholder name for the billing record" })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  cardholderName?: string;
}
