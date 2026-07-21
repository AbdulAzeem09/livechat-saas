import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class WebhookDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  url!: string;

  @ApiProperty({ type: [String] })
  events!: string[];

  @ApiProperty()
  isActive!: boolean;

  @ApiPropertyOptional({ nullable: true })
  lastSuccessAt!: Date | null;

  @ApiPropertyOptional({ nullable: true })
  lastFailureAt!: Date | null;

  @ApiProperty()
  createdAt!: Date;
}

export class CreatedWebhookDto extends WebhookDto {
  @ApiProperty({ description: "Signing secret — shown only once at creation" })
  secret!: string;
}
