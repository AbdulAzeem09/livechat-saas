import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength
} from "class-validator";

export class CreateAutomationRuleDto {
  @ApiProperty({ maxLength: 120 })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @ApiProperty({ maxLength: 2000, description: "The auto-reply the bot sends" })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  replyMessage!: string;

  @ApiPropertyOptional({ description: "Fire on the visitor's first message (welcome greeting)" })
  @IsBoolean()
  @IsOptional()
  isGreeting?: boolean;

  @ApiPropertyOptional({ type: [String], description: "Trigger when any keyword appears in a message" })
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(30)
  @IsOptional()
  keywords?: string[];

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  enabled?: boolean;
}
