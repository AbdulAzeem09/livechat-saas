import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested
} from "class-validator";

export class FormFieldDto {
  @ApiProperty({ description: "Stable field id (used as the metadata key)" })
  @IsString()
  @MaxLength(40)
  id!: string;

  @ApiProperty({ description: "Field label shown to the visitor" })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  label!: string;

  @ApiProperty({ enum: ["text", "email", "phone", "textarea"] })
  @IsIn(["text", "email", "phone", "textarea"])
  type!: "text" | "email" | "phone" | "textarea";

  @ApiProperty({ description: "Whether the field is required" })
  @IsBoolean()
  required!: boolean;
}

export class MenuOptionDto {
  @ApiProperty({ description: "Stable option id" })
  @IsString()
  @MaxLength(40)
  id!: string;

  @ApiProperty({ description: "Button label the visitor taps" })
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  label!: string;

  @ApiProperty({ description: "Bot reply sent when the option is tapped" })
  @IsString()
  @MinLength(1)
  @MaxLength(600)
  reply!: string;
}

export class UpdateWidgetDto {
  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ maxLength: 300 })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  welcomeMessage?: string;

  @ApiPropertyOptional({ maxLength: 300 })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  offlineMessage?: string;

  @ApiPropertyOptional({ example: "#ff5a00", description: "Hex accent color" })
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9a-fA-F]{6}$/, { message: "accentColor must be a hex color like #ff5a00" })
  accentColor?: string;

  @ApiPropertyOptional({ enum: ["left", "right"] })
  @IsOptional()
  @IsIn(["left", "right"])
  position?: "left" | "right";

  @ApiPropertyOptional({ description: "Ask the visitor for name & email before starting a chat" })
  @IsOptional()
  @IsBoolean()
  preChatEnabled?: boolean;

  @ApiPropertyOptional({ example: "GTM-XXXXXXX", description: "Google Tag Manager container ID (empty to disconnect)" })
  @IsOptional()
  @IsString()
  @Matches(/^(GTM-[A-Z0-9]{4,}|)$/, { message: "gtmContainerId must look like GTM-XXXXXXX" })
  @MaxLength(20)
  gtmContainerId?: string;

  @ApiPropertyOptional({
    type: [String],
    description: "Domains where the widget may load. Empty array = allow everywhere."
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(50)
  allowedDomains?: string[];

  @ApiPropertyOptional({ enum: ["en", "ur", "es", "fr", "de", "ar", "hi", "pt"], description: "Widget UI language" })
  @IsOptional()
  @IsIn(["en", "ur", "es", "fr", "de", "ar", "hi", "pt"])
  language?: string;

  @ApiPropertyOptional({ description: "High-contrast widget colors" })
  @IsOptional()
  @IsBoolean()
  highContrast?: boolean;

  @ApiPropertyOptional({ description: "Larger widget text for readability" })
  @IsOptional()
  @IsBoolean()
  largeText?: boolean;

  @ApiPropertyOptional({ description: "Show a cookie-consent notice before chat starts" })
  @IsOptional()
  @IsBoolean()
  cookieConsent?: boolean;

  @ApiPropertyOptional({ description: "Email new chats to this address (empty to disable)" })
  @IsOptional()
  @IsString()
  @MaxLength(320)
  emailForwardTo?: string;

  @ApiPropertyOptional({ description: "Enable emailing new chats to the forwarding address" })
  @IsOptional()
  @IsBoolean()
  emailForwardEnabled?: boolean;

  @ApiPropertyOptional({ description: "Enable a weekly working-hours schedule (away mode outside it)" })
  @IsOptional()
  @IsBoolean()
  workingHoursEnabled?: boolean;

  @ApiPropertyOptional({ description: "Weekly schedule: { timezone, days:[{on,from,to} x7 Sun..Sat] }" })
  @IsOptional()
  @IsObject()
  workingHours?: Record<string, unknown>;

  @ApiPropertyOptional({ description: "Teaser bubble text shown before the widget opens" })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  eyeCatcher?: string;

  @ApiPropertyOptional({ description: "Show the eye-catcher teaser" })
  @IsOptional()
  @IsBoolean()
  eyeCatcherEnabled?: boolean;

  @ApiPropertyOptional({ description: "Slack Incoming Webhook URL to notify on new chats" })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  slackWebhookUrl?: string;

  @ApiPropertyOptional({ type: [FormFieldDto], description: "Pre-chat form fields (shown before a chat starts)" })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @ValidateNested({ each: true })
  @Type(() => FormFieldDto)
  preChatFields?: FormFieldDto[];

  @ApiPropertyOptional({ description: "Show a post-chat form after the conversation ends" })
  @IsOptional()
  @IsBoolean()
  postChatEnabled?: boolean;

  @ApiPropertyOptional({ description: "Message shown at the top of the post-chat form" })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  postChatMessage?: string;

  @ApiPropertyOptional({
    type: [String],
    description: "Visitor IPs to block from chatting. Trailing '*' matches a prefix."
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(200)
  bannedIps?: string[];

  @ApiPropertyOptional({ description: "Auto-send a nudge when the visitor goes quiet" })
  @IsOptional()
  @IsBoolean()
  inactivityEnabled?: boolean;

  @ApiPropertyOptional({ description: "Message shown after the visitor is inactive" })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  inactivityMessage?: string;

  @ApiPropertyOptional({ description: "Seconds of inactivity before the nudge (10-600)" })
  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(600)
  inactivitySeconds?: number;

  @ApiPropertyOptional({ type: [MenuOptionDto], description: "Chatbot quick-reply menu options" })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => MenuOptionDto)
  menuOptions?: MenuOptionDto[];
}
