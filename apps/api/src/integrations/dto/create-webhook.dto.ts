import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { ArrayMaxSize, IsArray, IsOptional, IsString, IsUrl } from "class-validator";

export class CreateWebhookDto {
  @ApiProperty({ description: "HTTPS endpoint that will receive event POSTs" })
  @IsUrl({ require_tld: false, protocols: ["http", "https"] })
  url!: string;

  @ApiPropertyOptional({ type: [String], description: "Events to subscribe to (empty = all)" })
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(20)
  @IsOptional()
  events?: string[];
}
