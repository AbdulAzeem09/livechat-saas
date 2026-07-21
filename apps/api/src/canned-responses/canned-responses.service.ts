import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { CannedResponse, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type { CreateCannedResponseDto } from "./dto/create-canned-response.dto";
import type { UpdateCannedResponseDto } from "./dto/update-canned-response.dto";

@Injectable()
export class CannedResponsesService {
  constructor(private readonly prisma: PrismaService) {}

  list(organizationId: string): Promise<CannedResponse[]> {
    return this.prisma.cannedResponse.findMany({
      where: { organizationId },
      orderBy: [{ usageCount: "desc" }, { createdAt: "asc" }]
    });
  }

  async create(
    organizationId: string,
    createdById: string | null,
    dto: CreateCannedResponseDto
  ): Promise<CannedResponse> {
    try {
      return await this.prisma.cannedResponse.create({
        data: {
          organizationId,
          title: dto.title,
          shortcut: normalizeShortcut(dto.shortcut),
          body: dto.body,
          tags: dto.tags ?? [],
          isShared: dto.isShared ?? true,
          ...(createdById ? { createdById } : {}),
          ...(dto.categoryId ? { categoryId: dto.categoryId } : {})
        }
      });
    } catch (error) {
      throw mapDuplicateError(error);
    }
  }

  async update(
    organizationId: string,
    id: string,
    dto: UpdateCannedResponseDto
  ): Promise<CannedResponse> {
    await this.getOrThrow(organizationId, id);

    try {
      return await this.prisma.cannedResponse.update({
        where: { id },
        data: {
          ...(dto.title !== undefined ? { title: dto.title } : {}),
          ...(dto.shortcut !== undefined ? { shortcut: normalizeShortcut(dto.shortcut) } : {}),
          ...(dto.body !== undefined ? { body: dto.body } : {}),
          ...(dto.categoryId !== undefined ? { categoryId: dto.categoryId } : {}),
          ...(dto.tags !== undefined ? { tags: dto.tags } : {}),
          ...(dto.isShared !== undefined ? { isShared: dto.isShared } : {})
        }
      });
    } catch (error) {
      throw mapDuplicateError(error);
    }
  }

  async remove(organizationId: string, id: string): Promise<{ success: true }> {
    await this.getOrThrow(organizationId, id);
    await this.prisma.cannedResponse.delete({ where: { id } });
    return { success: true };
  }

  private async getOrThrow(organizationId: string, id: string): Promise<CannedResponse> {
    const found = await this.prisma.cannedResponse.findFirst({
      where: { id, organizationId }
    });

    if (!found) {
      throw new NotFoundException("Canned response not found");
    }

    return found;
  }
}

function normalizeShortcut(shortcut: string): string {
  const trimmed = shortcut.trim();
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function mapDuplicateError(error: unknown): unknown {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return new ConflictException("A canned response with this shortcut already exists");
  }

  return error;
}
