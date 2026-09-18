import { Injectable, Logger } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

export interface AuditLogEntryDto {
  id: string;
  action: string;
  actorName: string | null;
  actorEmail: string | null;
  entityType: string | null;
  entityId: string | null;
  ipAddress: string | null;
  payload: Record<string, unknown>;
  createdAt: Date;
}

export interface AuditEntry {
  organizationId?: string | undefined;
  actorUserId?: string | undefined;
  actorMemberId?: string | undefined;
  /** Dotted action name, e.g. "member.removed", "billing.subscribed". */
  action: string;
  entityType?: string | undefined;
  entityId?: string | undefined;
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
  payload?: Record<string, unknown> | undefined;
}

/**
 * Writes the security/compliance trail (who did what, when). Recording never blocks or fails
 * the action being audited — a lost log line must not break a customer request.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  record(entry: AuditEntry): void {
    void this.prisma.auditLog
      .create({
        data: {
          action: entry.action,
          ...(entry.organizationId ? { organizationId: entry.organizationId } : {}),
          ...(entry.actorUserId ? { actorUserId: entry.actorUserId } : {}),
          ...(entry.actorMemberId ? { actorMemberId: entry.actorMemberId } : {}),
          ...(entry.entityType ? { entityType: entry.entityType } : {}),
          ...(entry.entityId ? { entityId: entry.entityId } : {}),
          ...(entry.ipAddress ? { ipAddress: entry.ipAddress.slice(0, 64) } : {}),
          ...(entry.userAgent ? { userAgent: entry.userAgent } : {}),
          payload: (entry.payload ?? {}) as Prisma.InputJsonValue
        }
      })
      .catch((error: unknown) => {
        this.logger.warn(
          `Could not write audit log "${entry.action}": ${error instanceof Error ? error.message : String(error)}`
        );
      });
  }

  async list(
    organizationId: string,
    query: { action?: string | undefined; limit?: number | undefined; offset?: number | undefined }
  ): Promise<{ items: AuditLogEntryDto[]; total: number }> {
    const where = {
      organizationId,
      ...(query.action ? { action: { startsWith: query.action } } : {})
    };
    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: query.limit ?? 50,
        skip: query.offset ?? 0
      }),
      this.prisma.auditLog.count({ where })
    ]);

    const actorIds = [...new Set(logs.map((log) => log.actorUserId).filter((id): id is string => Boolean(id)))];
    const actors = actorIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: actorIds } },
          select: { id: true, name: true, email: true }
        })
      : [];
    const actorById = new Map(actors.map((actor) => [actor.id, actor]));

    return {
      total,
      items: logs.map((log) => {
        const actor = log.actorUserId ? actorById.get(log.actorUserId) : undefined;

        return {
          id: log.id,
          action: log.action,
          actorName: actor?.name ?? null,
          actorEmail: actor?.email ?? null,
          entityType: log.entityType,
          entityId: log.entityId,
          ipAddress: log.ipAddress,
          payload:
            log.payload && typeof log.payload === "object" && !Array.isArray(log.payload)
              ? log.payload
              : {},
          createdAt: log.createdAt
        };
      })
    };
  }
}
