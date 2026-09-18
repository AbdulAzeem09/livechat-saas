import { ApiProperty } from "@nestjs/swagger";
import { IsString, MaxLength } from "class-validator";

export class WidgetReadDto {
  @ApiProperty({ description: "Widget session token" })
  @IsString()
  @MaxLength(200)
  sessionToken!: string;
}
