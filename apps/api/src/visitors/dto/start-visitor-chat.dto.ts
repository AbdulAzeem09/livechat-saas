import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, MaxLength } from "class-validator";

export class StartVisitorChatDto {
  @ApiPropertyOptional({
    description: "What the agent opens with. Defaults to a plain greeting.",
    maxLength: 4000
  })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  message?: string;
}
