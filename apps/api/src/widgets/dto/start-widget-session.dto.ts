import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength
} from "class-validator";

export class StartWidgetSessionDto {
  @ApiPropertyOptional({ maxLength: 191 })
  @IsString()
  @IsOptional()
  @MaxLength(191)
  visitorExternalId?: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsUrl({ require_tld: false })
  @IsOptional()
  pageUrl?: string;

  @ApiPropertyOptional({ maxLength: 220 })
  @IsString()
  @IsOptional()
  @MaxLength(220)
  pageTitle?: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  referrer?: string;

  @ApiPropertyOptional({ type: Object })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}
