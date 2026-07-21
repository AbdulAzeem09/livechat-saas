import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsEmail,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength
} from "class-validator";

export class CreateWidgetConversationDto {
  @ApiProperty()
  @IsString()
  @MinLength(8)
  sessionToken!: string;

  @ApiProperty({ minLength: 1, maxLength: 4000 })
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  body!: string;

  @ApiPropertyOptional({ maxLength: 160 })
  @IsString()
  @IsOptional()
  @MaxLength(160)
  name?: string;

  @ApiPropertyOptional({ maxLength: 320 })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ maxLength: 200 })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  subject?: string;

  @ApiPropertyOptional({ type: Object })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}
