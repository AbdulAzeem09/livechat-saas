import { Controller, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import { Permissions } from "../auth/decorators/permissions.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { OrganizationAccessGuard } from "../organizations/guards/organization-access.guard";
import { AiService, AiSuggestion } from "./ai.service";

@ApiTags("AI")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, OrganizationAccessGuard, PermissionsGuard)
@Controller("organizations/:organizationId/conversations/:conversationId/ai")
export class AiController {
  constructor(private readonly aiService: AiService) {}

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
}
