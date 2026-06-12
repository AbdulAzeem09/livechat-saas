import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import type { RequestWithUser } from "../../common/types/request-with-user";
import { OrganizationAccessService } from "../organization-access.service";

@Injectable()
export class OrganizationAccessGuard implements CanActivate {
  constructor(private readonly accessService: OrganizationAccessService) {}

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

    return true;
  }

  private getOrganizationId(value: string | string[] | undefined): string | undefined {
    return Array.isArray(value) ? value[0] : value;
  }
}
