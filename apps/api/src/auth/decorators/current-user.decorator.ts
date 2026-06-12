import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { RequestWithUser } from "../../common/types/request-with-user";

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    return request.user;
  }
);
