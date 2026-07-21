import { ApiPropertyOptional } from "@nestjs/swagger";
import { ConversationPriority, ConversationSource } from "@prisma/client";
import {
  IsBoolean,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength
} from "class-validator";

export class CreateConversationDto {
  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  visitorId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  contactId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  widgetId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  departmentId?: string;

  @ApiPropertyOptional({
    description: "Organization membership id for the assigned agent. Defaults to the caller."
  })
  @IsUUID()
  @IsOptional()
  assignedAgentId?: string;

  @ApiPropertyOptional({ enum: ConversationSource, default: ConversationSource.MANUAL })
  @IsEnum(ConversationSource)
  @IsOptional()
  source?: ConversationSource;

  @ApiPropertyOptional({ enum: ConversationPriority, default: ConversationPriority.NORMAL })
  @IsEnum(ConversationPriority)
  @IsOptional()
  priority?: ConversationPriority;

  @ApiPropertyOptional({ maxLength: 200 })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  subject?: string;

  @ApiPropertyOptional({ maxLength: 20 })
  @IsString()
  @IsOptional()
  @MaxLength(20)
  locale?: string;

  @ApiPropertyOptional({ type: Object })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: "Optional first public message sent by the current agent.",
    minLength: 1
  })
  @IsString()
  @IsOptional()
  @MinLength(1)
  initialMessage?: string;

  @ApiPropertyOptional({
    description: "If true, the initial message is attributed to a simulated VISITOR (test chat)."
  })
  @IsBoolean()
  @IsOptional()
  simulateVisitor?: boolean;
}
