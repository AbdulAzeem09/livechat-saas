import { ApiProperty } from "@nestjs/swagger";
import { IsString, MaxLength } from "class-validator";

export class MenuReplyDto {
  @ApiProperty({ description: "Session token identifying the visitor" })
  @IsString()
  sessionToken!: string;

  @ApiProperty({ description: "The tapped menu option id" })
  @IsString()
  @MaxLength(40)
  optionId!: string;
}
