import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class RateWidgetDto {
  @ApiProperty()
  @IsString()
  @MinLength(8)
  sessionToken!: string;

  @ApiProperty({ enum: ["good", "bad"], description: "Visitor's rating of the chat" })
  @IsIn(["good", "bad"])
  rating!: string;

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsString()
  @MaxLength(1000)
  @IsOptional()
  comment?: string;
}
