import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import { resolveClientIp } from "../../common/http/client-ip";
import type { RequestWithUser } from "../../common/types/request-with-user";
import { AccessRestrictionService } from "../access-restriction.service";
import { OrganizationAccessService } from "../organization-access.service";

@Injectable()
export class OrganizationAccessGuard implements CanActivate {
  constructor(
    private readonly accessService: OrganizationAccessService,
    private readonly accessRestriction: AccessRestrictionService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const organizationId = this.getOrganizationId(request.params.organizationId);

    if (!request.user) {
      throw new UnauthorizedException("Missing authenticated user");
    }

    if (!organizationId) {
      throw new UnauthorizedException("Missing organization context");
    }

    await this.accessService.ensureOrganizationExists(organizationId);
    request.organizationContext = await this.accessService.getContextOrThrow(
      request.user.userId,
      organizationId
    );

    // A workspace may limit the dashboard to its own network. No list means no restriction.
    const clientIp = resolveClientIp(request);
    if (!(await this.accessRestriction.isAllowed(organizationId, clientIp))) {
      throw new ForbiddenException(
        "This workspace only allows sign-in from its own network. Ask an owner to add your address."
      );
    }

    return true;
  }

  private getOrganizationId(value: string | string[] | undefined): string | undefined {
    return Array.isArray(value) ? value[0] : value;
  }
}
