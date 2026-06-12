import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AUTH_PUBLIC_KEY } from "../auth.constants";
import { AuthService } from "../auth.service";
import type { RequestWithUser } from "../../common/types/request-with-user";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly authService: AuthService,
    private readonly reflector: Reflector
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(AUTH_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass()
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const token = this.extractBearerToken(request);

    if (!token) {
      throw new UnauthorizedException("Missing bearer token");
    }

    request.user = await this.authService.validateAccessToken(token);
    return true;
  }

  private extractBearerToken(request: RequestWithUser): string | null {
    const authorization = request.headers.authorization;

    if (!authorization) {
      return null;
    }

    const [scheme, token] = authorization.split(" ");
    return scheme?.toLowerCase() === "bearer" && token ? token : null;
  }
}
