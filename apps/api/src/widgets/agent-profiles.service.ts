import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

/** What a visitor is allowed to know about the person answering them. */
export interface AgentProfile {
  name: string;
  title: string | null;
  avatarUrl: string | null;
}

/** Profiles rarely change, and a busy chat asks for the same one on every message. */
const CACHE_TTL_MS = 60_000;
const MAX_CACHED = 500;

/**
 * The name and face the visitor sees on an agent's reply.
 *
 * Deliberately narrow: a workspace's display name, job title and picture, and nothing else.
 * The agent's real email and user id stay on the dashboard side — a visitor should not be
 * able to read the staff list off the chat window.
 */
@Injectable()
export class AgentProfilesService {
  private readonly cache = new Map<string, { profile: AgentProfile; expiresAt: number }>();

  constructor(private readonly prisma: PrismaService) {}

  /** Look up several at once — a page of chat history usually has only one or two agents in it. */
  async forMemberships(membershipIds: string[]): Promise<Map<string, AgentProfile>> {
    const wanted = Array.from(new Set(membershipIds.filter(Boolean)));
    const found = new Map<string, AgentProfile>();
    const missing: string[] = [];
    const now = Date.now();

    for (const id of wanted) {
      const cached = this.cache.get(id);
      if (cached && cached.expiresAt > now) {
        found.set(id, cached.profile);
      } else {
        missing.push(id);
      }
    }

    if (!missing.length) {
      return found;
    }

    // Memberships and users are joined by id in code: the schema keeps user_id as a plain
    // column, with no Prisma relation to traverse.
    const memberships = await this.prisma.userOrganization
      .findMany({
        where: { id: { in: missing } },
        select: { id: true, userId: true, displayName: true, title: true }
      })
      .catch(() => []);

    if (!memberships.length) {
      return found;
    }

    const users = await this.prisma.user
      .findMany({
        where: { id: { in: memberships.map((membership) => membership.userId) } },
        select: { id: true, name: true, avatarUrl: true }
      })
      .catch(() => []);

    const usersById = new Map(users.map((user) => [user.id, user]));

    for (const membership of memberships) {
      const user = usersById.get(membership.userId);
      const profile: AgentProfile = {
        name: membership.displayName?.trim() || user?.name?.trim() || "Support",
        title: membership.title?.trim() || null,
        avatarUrl: user?.avatarUrl ?? null
      };

      found.set(membership.id, profile);
      this.remember(membership.id, profile, now);
    }

    return found;
  }

  async forMembership(membershipId: string | null): Promise<AgentProfile | null> {
    if (!membershipId) {
      return null;
    }

    const profiles = await this.forMemberships([membershipId]);

    return profiles.get(membershipId) ?? null;
  }

  /** A profile edit should reach open chats quickly, so drop it rather than wait out the TTL. */
  forget(membershipId: string): void {
    this.cache.delete(membershipId);
  }

  private remember(id: string, profile: AgentProfile, now: number): void {
    if (this.cache.size >= MAX_CACHED) {
      const oldest = this.cache.keys().next();
      if (!oldest.done) {
        this.cache.delete(oldest.value);
      }
    }

    this.cache.set(id, { profile, expiresAt: now + CACHE_TTL_MS });
  }
}
