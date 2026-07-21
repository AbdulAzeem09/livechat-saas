import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsOptional, IsString, MaxLength, Min } from "class-validator";

export class RecordSaleDto {
  @ApiProperty({ description: "Session token identifying the visitor" })
  @IsString()
  sessionToken!: string;

  @ApiProperty({ description: "Sale amount in the smallest currency unit (cents)" })
  @IsInt()
  @Min(0)
  amountCents!: number;

  @ApiPropertyOptional({ description: "ISO currency code", default: "usd" })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @ApiPropertyOptional({ description: "Order / cart reference" })
  @IsOptional()
  @IsString()
  @MaxLength(191)
  reference?: string;

  @ApiPropertyOptional({ description: "Conversation this sale is attributed to" })
  @IsOptional()
  @IsString()
  conversationId?: string;
}
