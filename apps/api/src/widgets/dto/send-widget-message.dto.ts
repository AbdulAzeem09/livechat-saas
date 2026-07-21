import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength
} from "class-validator";

export class SendWidgetMessageDto {
  @ApiProperty()
  @IsString()
  @MinLength(8)
  sessionToken!: string;

  @ApiProperty({ minLength: 1, maxLength: 4000 })
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  body!: string;

  @ApiPropertyOptional({ maxLength: 120 })
  @IsString()
  @IsOptional()
  @MaxLength(120)
  idempotencyKey?: string;

  @ApiPropertyOptional({ type: Object })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}
