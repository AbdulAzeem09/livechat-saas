import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

export class UpdateTicketDto {
  @ApiPropertyOptional({ maxLength: 220 })
  @IsString()
  @MaxLength(220)
  @IsOptional()
  subject?: string;

  @ApiPropertyOptional({ description: "NEW | OPEN | PENDING | RESOLVED | CLOSED" })
  @IsIn(["NEW", "OPEN", "PENDING", "RESOLVED", "CLOSED"])
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({ description: "LOW | NORMAL | HIGH | URGENT" })
  @IsIn(["LOW", "NORMAL", "HIGH", "URGENT"])
  @IsOptional()
  priority?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsUUID()
  @IsOptional()
  assigneeId?: string;
}
