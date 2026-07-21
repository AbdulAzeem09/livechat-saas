import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class ApiKeyDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ description: "First characters of the key for identification" })
  keyPrefix!: string;

  @ApiProperty({ type: [String] })
  scopes!: string[];

  @ApiPropertyOptional({ nullable: true })
  lastUsedAt!: Date | null;

  @ApiPropertyOptional({ nullable: true })
  revokedAt!: Date | null;

  @ApiProperty()
  createdAt!: Date;
}

export class CreatedApiKeyDto extends ApiKeyDto {
  @ApiProperty({ description: "The full secret key — shown only once at creation" })
  secret!: string;
}
