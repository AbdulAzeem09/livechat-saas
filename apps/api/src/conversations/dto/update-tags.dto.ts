import { ApiProperty } from "@nestjs/swagger";
import { ArrayMaxSize, IsArray, IsString, MaxLength } from "class-validator";

export class UpdateTagsDto {
  @ApiProperty({ type: [String], description: "Full set of tags for the conversation." })
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  tags!: string[];
}
