import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { KnowledgeArticle } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateKnowledgeDto } from "./dto/create-knowledge.dto";
import { KnowledgeArticleDto } from "./dto/knowledge-response.dto";
import { UpdateKnowledgeDto } from "./dto/update-knowledge.dto";

/** Max characters of extracted text we keep per imported source. */
const MAX_SOURCE_CHARS = 18000;

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

  /**
   * Fetch a public web page, extract its readable text, and store it as a
   * published knowledge article the AI receptionist can answer from.
   */
  async importWebsite(organizationId: string, url: string): Promise<KnowledgeArticleDto> {
    const target = this.assertSafeUrl(url);

    let html: string;
    try {
      const response = await fetch(target.toString(), {
        signal: AbortSignal.timeout(10000),
        headers: { "user-agent": "LiveChatBot/1.0 (+knowledge-import)" },
        redirect: "follow"
      });
      if (!response.ok) {
        throw new Error(`status ${response.status}`);
      }
      const contentType = response.headers.get("content-type") ?? "";
      if (!/text\/html|text\/plain|application\/xhtml/i.test(contentType)) {
        throw new BadRequestException("That URL is not an HTML page.");
      }
      html = await response.text();
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException("Could not fetch that URL. Check it is public and reachable.");
    }

    const title = this.extractTitle(html) || target.hostname;
    const content = this.htmlToText(html);
    if (!content) {
      throw new BadRequestException("No readable text found on that page.");
    }

    const article = await this.prisma.knowledgeArticle.create({
      data: {
        organizationId,
        title: `${title}`.slice(0, 240),
        content: `Source: ${target.toString()}\n\n${content}`.slice(0, MAX_SOURCE_CHARS),
        category: "Website",
        published: true
      }
    });
    return this.map(article);
  }

  /**
   * Extract the text from an uploaded PDF and store it as a published knowledge
   * article. Uses pdf-parse via a lazy import so a load/parse failure only ever
   * breaks this one endpoint, never the whole module.
   */
  async importPdf(
    organizationId: string,
    file: { originalname: string; mimetype: string; buffer: Buffer }
  ): Promise<KnowledgeArticleDto> {
    if (!/pdf/i.test(file.mimetype) && !/\.pdf$/i.test(file.originalname)) {
      throw new BadRequestException("Please upload a PDF file.");
    }

    let text: string;
    try {
      const mod = (await import("pdf-parse")) as unknown as {
        default: (buffer: Buffer) => Promise<{ text: string }>;
      };
      const parsed = await mod.default(file.buffer);
      text = (parsed.text ?? "").replace(/\n{3,}/g, "\n\n").trim();
    } catch {
      throw new BadRequestException("Could not read that PDF. It may be scanned images or corrupted.");
    }

    if (!text) {
      throw new BadRequestException("No selectable text found in that PDF (scanned image PDFs are not supported).");
    }

    const title = file.originalname.replace(/\.pdf$/i, "").trim().slice(0, 240) || "PDF document";
    const article = await this.prisma.knowledgeArticle.create({
      data: {
        organizationId,
        title,
        content: text.slice(0, MAX_SOURCE_CHARS),
        category: "PDF",
        published: true
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

  /** Reject non-http(s) URLs and obvious internal/loopback targets (basic SSRF guard). */
  private assertSafeUrl(url: string): URL {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new BadRequestException("That is not a valid URL.");
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new BadRequestException("Only http and https URLs are supported.");
    }
    const host = parsed.hostname.toLowerCase();
    const blocked =
      host === "localhost" ||
      host === "0.0.0.0" ||
      host === "::1" ||
      host.endsWith(".localhost") ||
      host.endsWith(".internal") ||
      /^127\./.test(host) ||
      /^10\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^169\.254\./.test(host) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host);
    if (blocked) {
      throw new BadRequestException("That URL points to a private/internal address.");
    }
    return parsed;
  }

  /** Pull the <title> from raw HTML. */
  private extractTitle(html: string): string {
    const match = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
    return match ? this.decodeEntities(match[1]!).trim().replace(/\s+/g, " ") : "";
  }

  /** Strip HTML down to readable plain text. */
  private htmlToText(html: string): string {
    const withoutNoise = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<head[\s\S]*?<\/head>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ");
    const text = withoutNoise
      .replace(/<(?:br|\/p|\/div|\/li|\/h[1-6]|\/tr)[^>]*>/gi, "\n")
      .replace(/<[^>]+>/g, " ");
    return this.decodeEntities(text)
      .replace(/[ \t\f\v]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .join("\n")
      .trim();
  }

  /** Decode the handful of HTML entities that matter for readable text. */
  private decodeEntities(text: string): string {
    return text
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;|&apos;/gi, "'")
      .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)));
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
