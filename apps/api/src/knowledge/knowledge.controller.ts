import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import { Permissions } from "../auth/decorators/permissions.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { OrganizationAccessGuard } from "../organizations/guards/organization-access.guard";
import { CreateKnowledgeDto } from "./dto/create-knowledge.dto";
import { KnowledgeArticleDto } from "./dto/knowledge-response.dto";
import { UpdateKnowledgeDto } from "./dto/update-knowledge.dto";
import { KnowledgeService } from "./knowledge.service";

@ApiTags("Knowledge")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, OrganizationAccessGuard, PermissionsGuard)
@Controller("organizations/:organizationId/knowledge")
export class KnowledgeController {
  constructor(private readonly knowledgeService: KnowledgeService) {}

  @Get()
  @Permissions("chat:read")
  @ApiOperation({ summary: "List knowledge base articles" })
  @ApiParam({ name: "organizationId" })
  list(@Param("organizationId") organizationId: string): Promise<KnowledgeArticleDto[]> {
    return this.knowledgeService.list(organizationId);
  }

  @Post()
  @Permissions("settings:manage")
  @ApiOperation({ summary: "Create a knowledge article" })
  @ApiParam({ name: "organizationId" })
  create(
    @Param("organizationId") organizationId: string,
    @Body() dto: CreateKnowledgeDto
  ): Promise<KnowledgeArticleDto> {
    return this.knowledgeService.create(organizationId, dto);
  }

  @Patch(":articleId")
  @Permissions("settings:manage")
  @ApiOperation({ summary: "Update a knowledge article" })
  @ApiParam({ name: "organizationId" })
  @ApiParam({ name: "articleId" })
  update(
    @Param("organizationId") organizationId: string,
    @Param("articleId") articleId: string,
    @Body() dto: UpdateKnowledgeDto
  ): Promise<KnowledgeArticleDto> {
    return this.knowledgeService.update(organizationId, articleId, dto);
  }

  @Delete(":articleId")
  @Permissions("settings:manage")
  @ApiOperation({ summary: "Delete a knowledge article" })
  @ApiParam({ name: "organizationId" })
  @ApiParam({ name: "articleId" })
  remove(
    @Param("organizationId") organizationId: string,
    @Param("articleId") articleId: string
  ): Promise<{ success: true }> {
    return this.knowledgeService.remove(organizationId, articleId);
  }
}
