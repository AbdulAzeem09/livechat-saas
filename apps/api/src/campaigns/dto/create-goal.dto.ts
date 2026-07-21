import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from "class-validator";

export class CreateGoalDto {
  @ApiProperty({ maxLength: 160 })
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  name!: string;

  @ApiPropertyOptional({ description: "url | event" })
  @IsIn(["url", "event"])
  @IsOptional()
  type?: string;

  @ApiPropertyOptional({ maxLength: 500, description: "URL fragment or event name to match" })
  @IsString()
  @MaxLength(500)
  @IsOptional()
  target?: string;

  @ApiPropertyOptional({ description: "Monetary value of a completion, in cents" })
  @IsInt()
  @Min(0)
  @IsOptional()
  valueCents?: number;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  enabled?: boolean;
}
