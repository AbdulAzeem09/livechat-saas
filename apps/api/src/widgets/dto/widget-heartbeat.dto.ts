import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class WidgetHeartbeatDto {
  @ApiProperty()
  @IsString()
  @MinLength(8)
  sessionToken!: string;

  @ApiPropertyOptional({ maxLength: 1000, description: "URL of the page the visitor is currently on" })
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  pageUrl?: string;

  @ApiPropertyOptional({ maxLength: 220 })
  @IsString()
  @IsOptional()
  @MaxLength(220)
  pageTitle?: string;
}
