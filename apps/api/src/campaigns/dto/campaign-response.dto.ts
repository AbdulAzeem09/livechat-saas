import { ApiProperty } from "@nestjs/swagger";

export class CampaignDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  organizationId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ description: "recurring | one-time" })
  type!: string;

  @ApiProperty({ description: "page_visit | exit_intent | time_on_page | welcome" })
  triggerType!: string;

  @ApiProperty()
  triggerValue!: string;

  @ApiProperty()
  message!: string;

  @ApiProperty()
  enabled!: boolean;

  @ApiProperty()
  displayedCount!: number;

  @ApiProperty()
  chatsCount!: number;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class GoalDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  organizationId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ description: "url | event" })
  type!: string;

  @ApiProperty()
  target!: string;

  @ApiProperty()
  valueCents!: number;

  @ApiProperty()
  enabled!: boolean;

  @ApiProperty()
  completedCount!: number;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
