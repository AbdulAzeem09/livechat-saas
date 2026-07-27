import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import { Permissions } from "../auth/decorators/permissions.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { OrganizationAccessGuard } from "../organizations/guards/organization-access.guard";
import type { UploadedFileLike } from "../storage/file-storage.service";
import { CreateKnowledgeDto } from "./dto/create-knowledge.dto";
import { ImportWebsiteDto } from "./dto/import-website.dto";
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

  @Post("import/website")
  @Permissions("settings:manage")
  @ApiOperation({ summary: "Import a public web page into the knowledge base" })
  @ApiParam({ name: "organizationId" })
  importWebsite(
    @Param("organizationId") organizationId: string,
    @Body() dto: ImportWebsiteDto
  ): Promise<KnowledgeArticleDto> {
    return this.knowledgeService.importWebsite(organizationId, dto.url);
  }

  @Post("import/pdf")
  @Permissions("settings:manage")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 15 * 1024 * 1024 } }))
  @ApiOperation({ summary: "Import a PDF file into the knowledge base" })
  @ApiConsumes("multipart/form-data")
  @ApiParam({ name: "organizationId" })
  importPdf(
    @Param("organizationId") organizationId: string,
    @UploadedFile() file: UploadedFileLike | undefined
  ): Promise<KnowledgeArticleDto> {
    if (!file) {
      throw new BadRequestException("No file uploaded");
    }
    return this.knowledgeService.importPdf(organizationId, file);
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
