import { createHash } from "node:crypto";
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { RoleKey, UserStatus } from "@prisma/client";
import { AGENT_PERMISSIONS } from "../auth/auth.constants";
import { AuthService, type RequestMetadata } from "../auth/auth.service";
import type { AuthResponseDto } from "../auth/dto/auth-response.dto";
import { BillingService } from "../billing/billing.service";
import { AuditService } from "../common/audit/audit.service";
import { OrganizationAccessService } from "../organizations/organization-access.service";
import type { OrganizationRequestContext } from "../organizations/types/organization-context";
import { PrismaService } from "../prisma/prisma.service";

export interface InvitationPreview {
  valid: boolean;
  email: string | null;
  organizationName: string | null;
  reason?: string;
}

@Injectable()
export class MembersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly billing: BillingService,
    private readonly accessService: OrganizationAccessService,
    private readonly authService: AuthService,
    private readonly audit: AuditService
  ) {}

  private hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  async previewInvitation(token: string): Promise<InvitationPreview> {
    const invitation = await this.prisma.invitation.findUnique({
      where: { tokenHash: this.hashToken(token) }
    });

    if (!invitation) {
      return { valid: false, email: null, organizationName: null, reason: "Invitation not found" };
    }
    if (invitation.acceptedAt) {
      return { valid: false, email: invitation.email, organizationName: null, reason: "Already accepted" };
    }
    if (invitation.revokedAt) {
      return { valid: false, email: invitation.email, organizationName: null, reason: "Invitation revoked" };
    }
    if (invitation.expiresAt.getTime() < Date.now()) {
      return { valid: false, email: invitation.email, organizationName: null, reason: "Invitation expired" };
    }

    const organization = await this.prisma.organization.findUnique({
      where: { id: invitation.organizationId }
    });

    return {
      valid: true,
      email: invitation.email,
      organizationName: organization?.name ?? null
    };
  }

  /** A new person creates their account from the invite link and joins the workspace in one step. */
  async signUpWithInvitation(
    token: string,
    input: { name: string; password: string },
    metadata: RequestMetadata
  ): Promise<AuthResponseDto> {
    const preview = await this.previewInvitation(token);
    if (!preview.valid || !preview.email) {
      throw new BadRequestException(preview.reason ?? "Invitation is no longer valid");
    }

    const user = await this.authService.createPasswordUser({
      email: preview.email,
      name: input.name,
      password: input.password
    });
    const { organizationId } = await this.acceptInvitation(token, user);

    return this.authService.issueSession(user.id, metadata, organizationId);
  }

  /** The logged-in user accepts an invite and becomes an active agent (seat). */
  async acceptInvitation(token: string, user: { id: string; email: string }): Promise<{ organizationId: string }> {
    const invitation = await this.prisma.invitation.findUnique({
      where: { tokenHash: this.hashToken(token) }
    });

    if (!invitation || invitation.revokedAt || invitation.acceptedAt) {
      throw new NotFoundException("Invitation is no longer valid");
    }
    if (invitation.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException("Invitation has expired");
    }
    if (invitation.email.toLowerCase() !== user.email.toLowerCase()) {
      throw new ForbiddenException(
        `This invite is for ${invitation.email}. Sign in with that email to accept.`
      );
    }

    const existing = await this.prisma.userOrganization.findFirst({
      where: { organizationId: invitation.organizationId, userId: user.id }
    });
    if (existing) {
      await this.prisma.invitation.update({
        where: { id: invitation.id },
        data: { acceptedAt: new Date(), status: UserStatus.ACTIVE }
      });
      return { organizationId: invitation.organizationId };
    }

    const roleId = invitation.roleId ?? (await this.ensureAgentRole(invitation.organizationId));

    await this.prisma.$transaction(async (tx) => {
      const membership = await tx.userOrganization.create({
        data: {
          organizationId: invitation.organizationId,
          userId: user.id,
          status: UserStatus.ACTIVE
        }
      });
      await tx.userRole.create({
        data: {
          organizationId: invitation.organizationId,
          membershipId: membership.id,
          roleId
        }
      });
      await tx.invitation.update({
        where: { id: invitation.id },
        data: { acceptedAt: new Date(), status: UserStatus.ACTIVE }
      });
    });

    // New seat → recompute the per-seat charge.
    await this.billing.syncSeats(invitation.organizationId).catch(() => {});
    this.audit.record({
      organizationId: invitation.organizationId,
      actorUserId: user.id,
      action: "member.joined",
      entityType: "invitation",
      entityId: invitation.id,
      payload: { email: invitation.email }
    });

    return { organizationId: invitation.organizationId };
  }

  async removeMember(
    organizationId: string,
    membershipId: string,
    context: OrganizationRequestContext
  ): Promise<{ success: true }> {
    const membership = await this.prisma.userOrganization.findFirst({
      where: { id: membershipId, organizationId }
    });
    if (!membership) {
      throw new NotFoundException("Member not found");
    }

    await this.accessService.assertCanManageMember(context, membershipId, true);

    // Never remove the last remaining member/owner.
    const total = await this.prisma.userOrganization.count({
      where: { organizationId, status: UserStatus.ACTIVE }
    });
    if (total <= 1) {
      throw new BadRequestException("You can't remove the only member of the workspace");
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.userRole.deleteMany({ where: { membershipId, organizationId } });
      await tx.userOrganization.delete({ where: { id: membershipId } });
    });

    // Seat freed → recompute the per-seat charge.
    await this.billing.syncSeats(organizationId).catch(() => {});
    this.audit.record({
      organizationId,
      actorMemberId: context.membershipId,
      action: "member.removed",
      entityType: "membership",
      entityId: membershipId
    });

    return { success: true };
  }

  /** Find the org's Agent role, creating a sensible default if none exists. */
  private async ensureAgentRole(organizationId: string): Promise<string> {
    const existing = await this.prisma.role.findFirst({
      where: { organizationId, key: RoleKey.AGENT }
    });
    if (existing) {
      return existing.id;
    }
    const role = await this.prisma.role.create({
      data: {
        organizationId,
        key: RoleKey.AGENT,
        name: "Agent",
        description: "Handles chats and tickets",
        permissions: [...AGENT_PERMISSIONS],
        isSystem: true
      }
    });
    return role.id;
  }
}
