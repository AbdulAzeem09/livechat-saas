import { ApiPropertyOptional } from "@nestjs/swagger";
import { ConversationPriority, ConversationStatus } from "@prisma/client";
import { Transform, Type } from "class-transformer";
import { IsBoolean, IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from "class-validator";

export class ListConversationsQuery {
  @ApiPropertyOptional({ enum: ConversationStatus })
  @IsEnum(ConversationStatus)
  @IsOptional()
  status?: ConversationStatus;

  @ApiPropertyOptional({ enum: ConversationPriority })
  @IsEnum(ConversationPriority)
  @IsOptional()
  priority?: ConversationPriority;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  assignedAgentId?: string;

  @ApiPropertyOptional({
    description: "When true, only return conversations assigned to the current member."
  })
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === true || value === "true")
  assignedToMe?: boolean;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 25 })
  @IsInt()
  @IsOptional()
  @Max(100)
  @Min(1)
  @Type(() => Number)
  limit?: number;
}
