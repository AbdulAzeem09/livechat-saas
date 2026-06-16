import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  ConversationPriority,
  ConversationSource,
  ConversationStatus,
  MessageStatus,
  MessageType,
  MessageVisibility,
  ParticipantType
} from "@prisma/client";

export class MessageDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  organizationId!: string;

  @ApiProperty()
  conversationId!: string;

  @ApiProperty({ enum: ParticipantType })
  senderType!: ParticipantType;

  @ApiProperty({ nullable: true })
  senderVisitorId!: string | null;

  @ApiProperty({ nullable: true })
  senderMembershipId!: string | null;

  @ApiProperty({ enum: MessageType })
  type!: MessageType;

  @ApiProperty({ enum: MessageVisibility })
  visibility!: MessageVisibility;

  @ApiProperty({ enum: MessageStatus })
  status!: MessageStatus;

  @ApiProperty({ nullable: true })
  body!: string | null;

  @ApiProperty({ nullable: true })
  idempotencyKey!: string | null;

  @ApiProperty({ type: Object })
  metadata!: Record<string, unknown>;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty({ nullable: true })
  editedAt!: Date | null;

  @ApiProperty({ nullable: true })
  deletedAt!: Date | null;
}

export class ConversationDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  organizationId!: string;

  @ApiProperty({ nullable: true })
  visitorId!: string | null;

  @ApiProperty({ nullable: true })
  contactId!: string | null;

  @ApiProperty({ nullable: true })
  widgetId!: string | null;

  @ApiProperty({ nullable: true })
  departmentId!: string | null;

  @ApiProperty({ nullable: true })
  assignedAgentId!: string | null;

  @ApiProperty({ enum: ConversationSource })
  source!: ConversationSource;

  @ApiProperty({ enum: ConversationStatus })
  status!: ConversationStatus;

  @ApiProperty({ enum: ConversationPriority })
  priority!: ConversationPriority;

  @ApiProperty({ nullable: true })
  subject!: string | null;

  @ApiProperty({ nullable: true })
  locale!: string | null;

  @ApiProperty({ type: Object })
  metadata!: Record<string, unknown>;

  @ApiProperty({ nullable: true })
  firstResponseAt!: Date | null;

  @ApiProperty({ nullable: true })
  lastMessageAt!: Date | null;

  @ApiProperty({ nullable: true })
  resolvedAt!: Date | null;

  @ApiProperty({ nullable: true })
  closedAt!: Date | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  @ApiPropertyOptional({ type: MessageDto, nullable: true })
  latestMessage?: MessageDto | null;
}
