import "reflect-metadata";
import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { configureApp } from "./app.setup";
import { setupSwagger } from "./docs/swagger";

// Keep the API alive if a stray background promise (e.g. a transient DB pooler
// hiccup or a webhook dispatch) rejects — log it instead of crashing the process.
const processLogger = new Logger("Process");

process.on("unhandledRejection", (reason) => {
  processLogger.error(
    `Unhandled promise rejection: ${reason instanceof Error ? (reason.stack ?? reason.message) : String(reason)}`
  );
});

process.on("uncaughtException", (error) => {
  processLogger.error(`Uncaught exception: ${error.stack ?? error.message}`);
});

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true
  });
  const config = app.get(ConfigService);
  const logger = new Logger("Bootstrap");

  configureApp(app, config);
  setupSwagger(app, config);

  const port = config.getOrThrow<number>("PORT");
  const apiUrl = config.getOrThrow<string>("API_URL");
  const globalPrefix = config.getOrThrow<string>("API_GLOBAL_PREFIX");

  await app.listen(port);

  logger.log(`API listening on ${apiUrl}/${globalPrefix}`);
  logger.log(`Swagger docs available at ${apiUrl}/docs`);
}

void bootstrap();
