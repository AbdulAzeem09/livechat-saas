import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsIn, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class CreateCampaignDto {
  @ApiProperty({ maxLength: 160 })
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  name!: string;

  @ApiPropertyOptional({ description: "recurring | one-time" })
  @IsIn(["recurring", "one-time"])
  @IsOptional()
  type?: string;

  @ApiPropertyOptional({ description: "page_visit | exit_intent | time_on_page | welcome" })
  @IsIn(["page_visit", "exit_intent", "time_on_page", "welcome"])
  @IsOptional()
  triggerType?: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsString()
  @MaxLength(500)
  @IsOptional()
  triggerValue?: string;

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsString()
  @MaxLength(2000)
  @IsOptional()
  message?: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  enabled?: boolean;
}
