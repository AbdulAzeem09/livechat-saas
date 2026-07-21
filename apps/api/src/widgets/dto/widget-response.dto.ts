import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { ConversationDto, MessageDto } from "../../conversations/dto/conversation-response.dto";
import { FormFieldDto, MenuOptionDto } from "./update-widget.dto";

export class PublicMenuOptionDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  label!: string;
}

export class WidgetThemeDto {
  @ApiProperty()
  accentColor!: string;

  @ApiProperty()
  position!: "left" | "right";
}

export class PublicWidgetConfigDto {
  @ApiProperty()
  publicKey!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  welcomeMessage!: string;

  @ApiProperty()
  offlineMessage!: string;

  @ApiProperty({ type: WidgetThemeDto })
  theme!: WidgetThemeDto;

  @ApiProperty({ description: "Whether the visitor must enter name & email before chatting" })
  preChatEnabled!: boolean;

  @ApiProperty({ type: [FormFieldDto], description: "Pre-chat form fields to render" })
  preChatFields!: FormFieldDto[];

  @ApiProperty({ description: "Whether to show a post-chat form after the conversation ends" })
  postChatEnabled!: boolean;

  @ApiProperty({ description: "Message shown at the top of the post-chat form" })
  postChatMessage!: string;

  @ApiProperty({ description: "Google Tag Manager container ID (empty if not connected)" })
  gtmContainerId!: string;

  @ApiProperty({ description: "Widget UI language code" })
  language!: string;

  @ApiProperty({ description: "High-contrast colors" })
  highContrast!: boolean;

  @ApiProperty({ description: "Larger text" })
  largeText!: boolean;

  @ApiProperty({ description: "Show cookie-consent notice before chat" })
  cookieConsent!: boolean;

  @ApiProperty({ description: "Whether working-hours mode is enabled" })
  workingHoursEnabled!: boolean;

  @ApiProperty({ description: "Whether the team is currently online (within working hours)" })
  online!: boolean;

  @ApiProperty({ description: "Eye-catcher teaser text" })
  eyeCatcher!: string;

  @ApiProperty({ description: "Whether to show the eye-catcher teaser" })
  eyeCatcherEnabled!: boolean;

  @ApiProperty({ description: "Whether to auto-nudge inactive visitors" })
  inactivityEnabled!: boolean;

  @ApiProperty({ description: "Inactivity nudge message" })
  inactivityMessage!: string;

  @ApiProperty({ description: "Seconds of inactivity before the nudge" })
  inactivitySeconds!: number;

  @ApiProperty({ type: [PublicMenuOptionDto], description: "Chatbot quick-reply menu buttons" })
  menuOptions!: PublicMenuOptionDto[];
}

export class WidgetSessionDto {
  @ApiProperty()
  sessionToken!: string;

  @ApiProperty()
  visitorId!: string;

  @ApiProperty({ type: PublicWidgetConfigDto })
  widget!: PublicWidgetConfigDto;
}

export class WidgetConversationResponseDto {
  @ApiProperty({ type: ConversationDto })
  conversation!: ConversationDto;

  @ApiProperty({ type: MessageDto })
  message!: MessageDto;
}

export class WidgetInstallDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  publicKey!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  scriptUrl!: string;

  @ApiProperty()
  installCode!: string;

  @ApiProperty()
  demoUrl!: string;

  @ApiProperty({ type: [String], description: "Domains where the widget may load (empty = anywhere)" })
  allowedDomains!: string[];

  @ApiProperty({ description: "Email address new chats are forwarded to (empty = off)" })
  emailForwardTo!: string;

  @ApiProperty({ description: "Whether new-chat email forwarding is enabled" })
  emailForwardEnabled!: boolean;

  @ApiProperty({ description: "Whether working-hours mode is enabled" })
  workingHoursEnabled!: boolean;

  @ApiPropertyOptional({ nullable: true, description: "Weekly schedule object" })
  workingHours!: Record<string, unknown> | null;

  @ApiProperty({ description: "Eye-catcher teaser text" })
  eyeCatcher!: string;

  @ApiProperty({ description: "Whether the eye-catcher teaser is on" })
  eyeCatcherEnabled!: boolean;

  @ApiProperty({ description: "Slack Incoming Webhook URL (empty = off)" })
  slackWebhookUrl!: string;

  @ApiProperty({ description: "Whether the pre-chat form is enabled" })
  preChatEnabled!: boolean;

  @ApiProperty({ type: [FormFieldDto], description: "Configured pre-chat form fields" })
  preChatFields!: FormFieldDto[];

  @ApiProperty({ description: "Whether the post-chat form is enabled" })
  postChatEnabled!: boolean;

  @ApiProperty({ description: "Post-chat form heading message" })
  postChatMessage!: string;

  @ApiProperty({ type: [String], description: "Banned visitor IPs" })
  bannedIps!: string[];

  @ApiProperty({ description: "Whether inactivity auto-messages are enabled" })
  inactivityEnabled!: boolean;

  @ApiProperty({ description: "Inactivity nudge message" })
  inactivityMessage!: string;

  @ApiProperty({ description: "Seconds of inactivity before the nudge" })
  inactivitySeconds!: number;

  @ApiProperty({ type: [MenuOptionDto], description: "Chatbot quick-reply menu options (with replies)" })
  menuOptions!: MenuOptionDto[];

  @ApiPropertyOptional({ type: PublicWidgetConfigDto })
  publicConfig?: PublicWidgetConfigDto;
}
