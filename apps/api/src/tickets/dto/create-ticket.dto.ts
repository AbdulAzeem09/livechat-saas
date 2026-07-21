import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEmail, IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from "class-validator";

export class CreateTicketDto {
  @ApiProperty({ maxLength: 220 })
  @IsString()
  @MinLength(1)
  @MaxLength(220)
  subject!: string;

  @ApiPropertyOptional({ maxLength: 160 })
  @IsString()
  @MaxLength(160)
  @IsOptional()
  requesterName?: string;

  @ApiPropertyOptional({ maxLength: 320 })
  @IsEmail()
  @IsOptional()
  requesterEmail?: string;

  @ApiPropertyOptional({ maxLength: 5000 })
  @IsString()
  @MaxLength(5000)
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: "LOW | NORMAL | HIGH | URGENT" })
  @IsIn(["LOW", "NORMAL", "HIGH", "URGENT"])
  @IsOptional()
  priority?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  conversationId?: string;
}
