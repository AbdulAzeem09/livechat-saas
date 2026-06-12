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
