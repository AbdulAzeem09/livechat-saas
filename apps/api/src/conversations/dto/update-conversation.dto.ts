import { ApiPropertyOptional } from "@nestjs/swagger";
import { ConversationPriority, ConversationStatus } from "@prisma/client";
import { IsEnum, IsObject, IsOptional, IsString, MaxLength } from "class-validator";

export class UpdateConversationDto {
  @ApiPropertyOptional({ enum: ConversationStatus })
  @IsEnum(ConversationStatus)
  @IsOptional()
  status?: ConversationStatus;

  @ApiPropertyOptional({ enum: ConversationPriority })
  @IsEnum(ConversationPriority)
  @IsOptional()
  priority?: ConversationPriority;

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
