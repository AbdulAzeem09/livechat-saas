import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from "class-validator";
import type { EnhancementTone } from "../text-enhancement.service";

export class EnhanceTextDto {
  @ApiProperty({ example: "ok i'll send it tmrw", description: "The agent's draft reply" })
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  text!: string;

  @ApiPropertyOptional({ enum: ["professional", "friendly", "shorter"], default: "professional" })
  @IsOptional()
  @IsIn(["professional", "friendly", "shorter"])
  tone?: EnhancementTone;
}
