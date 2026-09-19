import { Body, Controller, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import { Permissions } from "../auth/decorators/permissions.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { OrganizationAccessGuard } from "../organizations/guards/organization-access.guard";
import { AiService, AiSuggestion, IntakeAnalysis } from "./ai.service";
import {
  ConversationInsightsService,
  type ConversationSummary,
  type TagSuggestion
} from "./conversation-insights.service";
import { EnhanceTextDto } from "./dto/enhance-text.dto";
import { TextEnhancementService, type EnhancedText } from "./text-enhancement.service";

@ApiTags("AI")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, OrganizationAccessGuard, PermissionsGuard)
@Controller("organizations/:organizationId/conversations/:conversationId/ai")
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly insights: ConversationInsightsService,
    private readonly enhancement: TextEnhancementService
  ) {}

  @Post("suggest")
  @Permissions("chat:write")
  @ApiOperation({ summary: "Draft an AI-suggested reply for the conversation" })
  @ApiParam({ name: "organizationId" })
  @ApiParam({ name: "conversationId" })
  suggest(
    @Param("organizationId") organizationId: string,
    @Param("conversationId") conversationId: string
  ): Promise<AiSuggestion> {
    return this.aiService.suggestReply(organizationId, conversationId);
  }

  @Post("summary")
  @Permissions("chat:read")
  @ApiOperation({ summary: "Summarise the chat so an agent can pick it up in seconds" })
  @ApiParam({ name: "organizationId" })
  @ApiParam({ name: "conversationId" })
  summary(
    @Param("organizationId") organizationId: string,
    @Param("conversationId") conversationId: string
  ): Promise<ConversationSummary> {
    return this.insights.summarize(organizationId, conversationId);
  }

  @Post("enhance")
  @Permissions("chat:write")
  @ApiOperation({ summary: "Tidy up the agent's draft before the customer sees it" })
  @ApiParam({ name: "organizationId" })
  @ApiParam({ name: "conversationId" })
  enhance(@Body() dto: EnhanceTextDto): Promise<EnhancedText> {
    return this.enhancement.enhance(dto.text, dto.tone ?? "professional");
  }

  @Post("tags")
  @Permissions("chat:write")
  @ApiOperation({ summary: "Work out the chat's topics and tag it" })
  @ApiParam({ name: "organizationId" })
  @ApiParam({ name: "conversationId" })
  tags(
    @Param("organizationId") organizationId: string,
    @Param("conversationId") conversationId: string
  ): Promise<TagSuggestion> {
    return this.insights.tag(organizationId, conversationId, { apply: true });
  }

  @Post("analyze-intake")
  @Permissions("chat:write")
  @ApiOperation({ summary: "Run legal intake analysis (conflict / jurisdiction / SOL) for the conversation" })
  @ApiParam({ name: "organizationId" })
  @ApiParam({ name: "conversationId" })
  analyzeIntake(
    @Param("organizationId") organizationId: string,
    @Param("conversationId") conversationId: string
  ): Promise<IntakeAnalysis | null> {
    return this.aiService.analyzeIntake(organizationId, conversationId);
  }
}
