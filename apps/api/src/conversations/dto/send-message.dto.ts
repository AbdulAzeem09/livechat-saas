import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { MessageType, MessageVisibility } from "@prisma/client";
import {
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength
} from "class-validator";

export class SendMessageDto {
  @ApiProperty({ minLength: 1 })
  @IsString()
  @MinLength(1)
  body!: string;

  @ApiPropertyOptional({ enum: MessageType, default: MessageType.TEXT })
  @IsEnum(MessageType)
  @IsOptional()
  type?: MessageType;

  @ApiPropertyOptional({ enum: MessageVisibility, default: MessageVisibility.PUBLIC })
  @IsEnum(MessageVisibility)
  @IsOptional()
  visibility?: MessageVisibility;

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
