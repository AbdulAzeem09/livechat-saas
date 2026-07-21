import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class CreateKnowledgeDto {
  @ApiProperty({ maxLength: 240 })
  @IsString()
  @MinLength(1)
  @MaxLength(240)
  title!: string;

  @ApiPropertyOptional({ maxLength: 20000 })
  @IsString()
  @MaxLength(20000)
  @IsOptional()
  content?: string;

  @ApiPropertyOptional({ maxLength: 120 })
  @IsString()
  @MaxLength(120)
  @IsOptional()
  category?: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  published?: boolean;
}
