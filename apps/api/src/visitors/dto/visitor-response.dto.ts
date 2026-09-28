import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { ConversationDto, MessageDto } from "../../conversations/dto/conversation-response.dto";

export class LiveVisitorDto {
  @ApiProperty()
  id!: string;

  @ApiPropertyOptional({ nullable: true })
  name!: string | null;

  @ApiPropertyOptional({ nullable: true })
  email!: string | null;

  @ApiProperty()
  firstSeenAt!: Date;

  @ApiPropertyOptional({ nullable: true })
  lastSeenAt!: Date | null;

  @ApiPropertyOptional({ nullable: true })
  sessionStartedAt!: Date | null;

  @ApiPropertyOptional({ nullable: true, description: "URL of the page the visitor is currently viewing" })
  currentPage!: string | null;

  @ApiPropertyOptional({ nullable: true })
  currentPageTitle!: string | null;

  @ApiPropertyOptional({ nullable: true, description: "First page the visitor landed on" })
  landingPage!: string | null;

  @ApiPropertyOptional({ nullable: true })
  referrer!: string | null;

  @ApiPropertyOptional({ nullable: true })
  country!: string | null;

  @ApiPropertyOptional({ nullable: true, description: "State / region" })
  state!: string | null;

  @ApiPropertyOptional({ nullable: true })
  city!: string | null;

  @ApiPropertyOptional({ nullable: true, description: "Internet provider (ISP) name" })
  isp!: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: "Network type of the visitor's IP: vpn | hosting | mobile | residential"
  })
  network!: string | null;

  @ApiPropertyOptional({ nullable: true, description: "Visitor IP address" })
  ip!: string | null;

  @ApiProperty({ description: "Chatting | Browsing | Left website" })
  activity!: string;

  @ApiPropertyOptional({ nullable: true, description: "Membership id of the agent chatting with this visitor" })
  chattingWithAgentId!: string | null;

  @ApiProperty({ description: "Number of pages viewed in the current session" })
  pageViewCount!: number;

  @ApiPropertyOptional({
    nullable: true,
    description: "Id of an active conversation with this visitor, if any"
  })
  activeConversationId!: string | null;
}

export class StartChatResponseDto {
  @ApiProperty({ type: ConversationDto })
  conversation!: ConversationDto;

  @ApiProperty({ type: MessageDto })
  message!: MessageDto;
}

/** The panel beside a chat: who they are, where they are, and whether they've been here before. */
export class VisitorDetailDto {
  @ApiProperty()
  id!: string;

  @ApiPropertyOptional({ nullable: true })
  name!: string | null;

  @ApiPropertyOptional({ nullable: true })
  email!: string | null;

  @ApiPropertyOptional({ nullable: true })
  phone!: string | null;

  @ApiProperty()
  firstSeenAt!: Date;

  @ApiPropertyOptional({ nullable: true })
  lastSeenAt!: Date | null;

  @ApiPropertyOptional({ nullable: true })
  country!: string | null;

  @ApiPropertyOptional({ nullable: true })
  region!: string | null;

  @ApiPropertyOptional({ nullable: true })
  city!: string | null;

  @ApiPropertyOptional({ nullable: true, description: "The visitor's browser timezone, if the widget reported one" })
  timezone!: string | null;

  @ApiPropertyOptional({ nullable: true, description: "Where they came from — the referring page" })
  referrer!: string | null;

  @ApiPropertyOptional({ nullable: true, description: "The first page they landed on" })
  landingPage!: string | null;

  @ApiProperty({ description: "How many separate visits this browser/device has made" })
  visitCount!: number;

  @ApiProperty({ description: "How many chats they've started, ever" })
  chatCount!: number;
}
