import { ApiProperty } from "@nestjs/swagger";
import { IsString, MaxLength, MinLength } from "class-validator";

export class CreateWidgetDto {
  @ApiProperty({ example: "Acme Store", description: "Usually the website or brand this widget sits on" })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;
}
