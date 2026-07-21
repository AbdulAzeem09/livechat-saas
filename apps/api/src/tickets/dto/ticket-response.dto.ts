import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class TicketDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  organizationId!: string;

  @ApiProperty()
  subject!: string;

  @ApiProperty()
  requesterName!: string;

  @ApiProperty()
  requesterEmail!: string;

  @ApiProperty()
  description!: string;

  @ApiProperty({ description: "NEW | OPEN | PENDING | RESOLVED | CLOSED" })
  status!: string;

  @ApiProperty({ description: "LOW | NORMAL | HIGH | URGENT" })
  priority!: string;

  @ApiPropertyOptional({ nullable: true })
  conversationId!: string | null;

  @ApiPropertyOptional({ nullable: true })
  assigneeId!: string | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
