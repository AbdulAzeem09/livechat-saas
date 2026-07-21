import { ApiProperty } from "@nestjs/swagger";

export class AutomationRuleDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  organizationId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  enabled!: boolean;

  @ApiProperty({ description: "Fires on the visitor's first message" })
  isGreeting!: boolean;

  @ApiProperty({ type: [String] })
  keywords!: string[];

  @ApiProperty()
  replyMessage!: string;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
