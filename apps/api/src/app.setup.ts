import { randomUUID } from "node:crypto";
import { ValidationPipe } from "@nestjs/common";
import type { INestApplication } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import compression from "compression";
import cookieParser from "cookie-parser";
import type { NextFunction, Request, Response } from "express";
import helmet from "helmet";
import { GlobalExceptionFilter } from "./common/filters/global-exception.filter";

export function configureApp(app: INestApplication, config: ConfigService): void {
  const globalPrefix = config.getOrThrow<string>("API_GLOBAL_PREFIX");
  const corsOrigins = parseCorsOrigins(config.getOrThrow<string>("API_CORS_ORIGINS"));

  // Trust the reverse proxy (host/CDN) so request.ip reflects the real visitor IP
  // (from X-Forwarded-For) — needed for accurate geolocation once deployed.
  const expressInstance = app.getHttpAdapter().getInstance() as {
    set?: (key: string, value: unknown) => void;
  };
  if (typeof expressInstance.set === "function") {
    expressInstance.set("trust proxy", 1);
  }

  app.use((request: Request, response: Response, next: NextFunction) => {
    const existingRequestId = request.headers["x-request-id"];
    const requestId =
      (Array.isArray(existingRequestId) ? existingRequestId[0] : existingRequestId) ??
      randomUUID();

    request.headers["x-request-id"] = requestId;
    response.setHeader("x-request-id", requestId);
    next();
  });

  app.use(helmet());
  app.use(compression());
  app.use(cookieParser());
  app.use((request: Request, response: Response, next: NextFunction) => {
    if (isPublicWidgetPath(request.path, globalPrefix)) {
      response.setHeader("access-control-allow-origin", "*");
      response.setHeader("access-control-allow-methods", "GET,POST,OPTIONS");
      response.setHeader("access-control-allow-headers", "content-type,authorization");
      // Widget is embedded cross-origin by design; relax Helmet's default
      // Cross-Origin-Resource-Policy so other sites can load widget.js and call the public API.
      response.setHeader("cross-origin-resource-policy", "cross-origin");

      if (request.method === "OPTIONS") {
        response.status(204).send();
        return;
      }
    }

    next();
  });
  app.enableCors({
    credentials: true,
    origin: corsOrigins
  });
  app.setGlobalPrefix(globalPrefix);
  app.useGlobalPipes(
    new ValidationPipe({
      forbidNonWhitelisted: true,
      transform: true,
      whitelist: true
    })
  );
  app.useGlobalFilters(new GlobalExceptionFilter());
}

function isPublicWidgetPath(path: string, globalPrefix: string): boolean {
  const normalizedPrefix = globalPrefix.replace(/^\/|\/$/g, "");

  return (
    path === `/${normalizedPrefix}/widget.js` ||
    path.startsWith(`/${normalizedPrefix}/widgets/public/`)
  );
}

function parseCorsOrigins(value: string): string[] | boolean {
  const origins = value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (origins.includes("*")) {
    return true;
  }

  return origins;
}
