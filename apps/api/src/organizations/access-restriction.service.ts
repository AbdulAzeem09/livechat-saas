import { BadRequestException, Injectable } from "@nestjs/common";
import { isIP } from "node:net";
import { PrismaService } from "../prisma/prisma.service";

/** Cached briefly: this is read on every dashboard request. */
const CACHE_TTL_MS = 30_000;

/**
 * Access restriction: a workspace can limit the dashboard to its own office network.
 *
 * Only ever applies to signed-in dashboard traffic. Visitors on the website widget are never
 * checked — a shop restricting its staff to the office must still be able to take chats from
 * the whole internet.
 */
@Injectable()
export class AccessRestrictionService {
  private readonly cache = new Map<string, { rules: string[]; expiresAt: number }>();

  constructor(private readonly prisma: PrismaService) {}

  async list(organizationId: string): Promise<string[]> {
    const cached = this.cache.get(organizationId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.rules;
    }

    const organization = await this.prisma.organization
      .findUnique({ where: { id: organizationId }, select: { metadata: true } })
      .catch(() => null);

    const metadata =
      organization?.metadata && typeof organization.metadata === "object" && !Array.isArray(organization.metadata)
        ? (organization.metadata as Record<string, unknown>)
        : {};

    const rules = Array.isArray(metadata.ipAllowlist)
      ? metadata.ipAllowlist.filter((rule): rule is string => typeof rule === "string")
      : [];

    this.cache.set(organizationId, { rules, expiresAt: Date.now() + CACHE_TTL_MS });

    return rules;
  }

  /**
   * Save the list. Refuses anything that would not let the caller back in — locking yourself
   * out of your own workspace from a settings screen is not a recoverable mistake.
   */
  async replace(organizationId: string, rules: string[], callerIp: string | undefined): Promise<string[]> {
    const cleaned = Array.from(
      new Set(rules.map((rule) => rule.trim()).filter((rule) => rule.length > 0))
    ).slice(0, 50);

    for (const rule of cleaned) {
      if (!this.isValidRule(rule)) {
        throw new BadRequestException(
          `"${rule}" is not an IP address or range. Use 203.0.113.4 or 203.0.113.0/24.`
        );
      }
    }

    if (cleaned.length > 0) {
      if (!callerIp || !this.matches(cleaned, callerIp)) {
        throw new BadRequestException(
          `That list does not include your own address (${callerIp ?? "unknown"}), so it would lock you out. Add it first.`
        );
      }
    }

    await this.writeList(organizationId, cleaned);
    this.cache.delete(organizationId);

    return cleaned;
  }

  /** No list means no restriction — the common case, and it must never lock anyone out. */
  async isAllowed(organizationId: string, ip: string | undefined): Promise<boolean> {
    const rules = await this.list(organizationId);

    if (!rules.length) {
      return true;
    }

    return Boolean(ip) && this.matches(rules, ip as string);
  }

  private matches(rules: string[], ip: string): boolean {
    return rules.some((rule) => (rule.includes("/") ? this.inRange(ip, rule) : rule === ip));
  }

  /** IPv4 CIDR only. An IPv6 address is matched exactly, never by range. */
  private inRange(ip: string, cidr: string): boolean {
    const network = cidr.split("/")[0] ?? "";
    const bits = Number.parseInt(cidr.split("/")[1] ?? "", 10);

    if (isIP(ip) !== 4 || isIP(network) !== 4 || !Number.isInteger(bits) || bits < 0 || bits > 32) {
      return false;
    }

    if (bits === 0) {
      return true;
    }

    const mask = (0xffffffff << (32 - bits)) >>> 0;

    return (this.toLong(ip) & mask) === (this.toLong(network) & mask);
  }

  private toLong(ip: string): number {
    return ip.split(".").reduce((total, part) => (total << 8) + Number.parseInt(part, 10), 0) >>> 0;
  }

  private isValidRule(rule: string): boolean {
    if (!rule.includes("/")) {
      return isIP(rule) !== 0;
    }

    const network = rule.split("/")[0] ?? "";
    const bits = Number.parseInt(rule.split("/")[1] ?? "", 10);

    return isIP(network) === 4 && Number.isInteger(bits) && bits >= 0 && bits <= 32;
  }

  private async writeList(organizationId: string, rules: string[]): Promise<void> {
    // Merge inside the database: other settings live in the same metadata column and a
    // read-modify-write here would drop whatever was saved in between.
    await this.prisma.$executeRaw`UPDATE organizations
      SET metadata = jsonb_set(coalesce(metadata, '{}'::jsonb), '{ipAllowlist}', ${JSON.stringify(rules)}::jsonb, true)
      WHERE id = ${organizationId}::uuid`;
  }
}
