import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

export class AssignConversationDto {
  @ApiProperty({
    description: "Organization membership id of the agent receiving the conversation."
  })
  @IsUUID()
  assignedAgentId!: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  reason?: string;
}
