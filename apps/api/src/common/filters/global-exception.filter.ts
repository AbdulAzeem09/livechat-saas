import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger
} from "@nestjs/common";
import type { Request, Response } from "express";

interface ErrorResponseBody {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  requestId?: string | undefined;
  timestamp: string;
  path: string;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : undefined;

    const body: ErrorResponseBody = {
      success: false,
      error: this.normalizeError(exceptionResponse, status),
      requestId: this.getRequestId(request),
      timestamp: new Date().toISOString(),
      path: request.url
    };

    if (status >= Number(HttpStatus.INTERNAL_SERVER_ERROR)) {
      this.logger.error(
        body.error.message,
        exception instanceof Error ? exception.stack : undefined
      );
    }

    response.status(status).json(body);
  }

  private normalizeError(
    exceptionResponse: string | object | undefined,
    status: number
  ): ErrorResponseBody["error"] {
    if (typeof exceptionResponse === "string") {
      return {
        code: HttpStatus[status] ?? "HTTP_ERROR",
        message: exceptionResponse
      };
    }

    if (exceptionResponse && "message" in exceptionResponse) {
      const payload = exceptionResponse as {
        error?: string;
        message?: string | string[];
      };

      return {
        code: payload.error ?? HttpStatus[status] ?? "HTTP_ERROR",
        message: Array.isArray(payload.message)
          ? payload.message.join(", ")
          : payload.message ?? "Request failed",
        details: exceptionResponse
      };
    }

    return {
      code: HttpStatus[status] ?? "INTERNAL_SERVER_ERROR",
      message:
        status === Number(HttpStatus.INTERNAL_SERVER_ERROR)
          ? "Internal server error"
          : "Request failed"
    };
  }

  private getRequestId(request: Request): string | undefined {
    const requestId = request.headers["x-request-id"];
    return Array.isArray(requestId) ? requestId[0] : requestId;
  }
}
