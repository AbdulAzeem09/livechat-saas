import { Injectable, NotFoundException } from "@nestjs/common";
import { KnowledgeArticle } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateKnowledgeDto } from "./dto/create-knowledge.dto";
import { KnowledgeArticleDto } from "./dto/knowledge-response.dto";
import { UpdateKnowledgeDto } from "./dto/update-knowledge.dto";

@Injectable()
export class KnowledgeService {
  constructor(private readonly prisma: PrismaService) {}

  async list(organizationId: string): Promise<KnowledgeArticleDto[]> {
    const articles = await this.prisma.knowledgeArticle.findMany({
      where: { organizationId },
      orderBy: { updatedAt: "desc" }
    });
    return articles.map((article) => this.map(article));
  }

  /** Public search over PUBLISHED articles (used by the widget + chatbot). */
  async search(organizationId: string, query: string): Promise<KnowledgeArticleDto[]> {
    const q = query.trim();
    const articles = await this.prisma.knowledgeArticle.findMany({
      where: {
        organizationId,
        published: true,
        ...(q
          ? {
              OR: [
                { title: { contains: q, mode: "insensitive" } },
                { content: { contains: q, mode: "insensitive" } }
              ]
            }
          : {})
      },
      orderBy: { views: "desc" },
      take: 6
    });
    return articles.map((article) => this.map(article));
  }

  async create(organizationId: string, dto: CreateKnowledgeDto): Promise<KnowledgeArticleDto> {
    const article = await this.prisma.knowledgeArticle.create({
      data: {
        organizationId,
        title: dto.title.trim(),
        ...(dto.content !== undefined ? { content: dto.content } : {}),
        ...(dto.category !== undefined ? { category: dto.category.trim() || "General" } : {}),
        ...(dto.published !== undefined ? { published: dto.published } : {})
      }
    });
    return this.map(article);
  }

  async update(
    organizationId: string,
    articleId: string,
    dto: UpdateKnowledgeDto
  ): Promise<KnowledgeArticleDto> {
    await this.getOrThrow(organizationId, articleId);
    const article = await this.prisma.knowledgeArticle.update({
      where: { id: articleId },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.content !== undefined ? { content: dto.content } : {}),
        ...(dto.category !== undefined ? { category: dto.category.trim() || "General" } : {}),
        ...(dto.published !== undefined ? { published: dto.published } : {})
      }
    });
    return this.map(article);
  }

  async remove(organizationId: string, articleId: string): Promise<{ success: true }> {
    await this.getOrThrow(organizationId, articleId);
    await this.prisma.knowledgeArticle.delete({ where: { id: articleId } });
    return { success: true };
  }

  private async getOrThrow(organizationId: string, articleId: string): Promise<KnowledgeArticle> {
    const article = await this.prisma.knowledgeArticle.findFirst({
      where: { id: articleId, organizationId }
    });
    if (!article) {
      throw new NotFoundException("Article not found");
    }
    return article;
  }

  private map(article: KnowledgeArticle): KnowledgeArticleDto {
    return {
      id: article.id,
      organizationId: article.organizationId,
      title: article.title,
      content: article.content,
      category: article.category,
      published: article.published,
      views: article.views,
      createdAt: article.createdAt,
      updatedAt: article.updatedAt
    };
  }
}
