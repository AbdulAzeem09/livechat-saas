import { ApiProperty } from "@nestjs/swagger";
import { IsString, IsUrl, MaxLength } from "class-validator";

export class ImportWebsiteDto {
  @ApiProperty({ description: "Public URL of the page to import into the knowledge base" })
  @IsString()
  @IsUrl({ require_protocol: true, protocols: ["http", "https"] })
  @MaxLength(2000)
  url!: string;
}
