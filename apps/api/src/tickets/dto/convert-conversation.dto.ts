import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsIn, IsOptional, IsString, MaxLength } from "class-validator";

export class ConvertConversationDto {
  @ApiPropertyOptional({ description: "Ticket subject (defaults to the conversation subject)" })
  @IsOptional()
  @IsString()
  @MaxLength(220)
  subject?: string;

  @ApiPropertyOptional({ enum: ["LOW", "NORMAL", "HIGH", "URGENT"] })
  @IsOptional()
  @IsIn(["LOW", "NORMAL", "HIGH", "URGENT"])
  priority?: "LOW" | "NORMAL" | "HIGH" | "URGENT";

  @ApiPropertyOptional({ description: "Custom auto-reply posted in the chat" })
  @IsOptional()
  @IsString()
  @MaxLength(400)
  autoReplyMessage?: string;

  @ApiPropertyOptional({ description: "Mark the live chat as resolved after converting" })
  @IsOptional()
  @IsBoolean()
  resolveConversation?: boolean;
}
