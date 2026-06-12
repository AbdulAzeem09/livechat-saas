import type { INestApplication } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

export function setupSwagger(app: INestApplication, config: ConfigService): void {
  const version = config.getOrThrow<string>("APP_VERSION");

  const swaggerConfig = new DocumentBuilder()
    .setTitle("LiveChat SaaS API")
    .setDescription("REST API for the LiveChat SaaS platform.")
    .setVersion(version)
    .addBearerAuth()
    .addCookieAuth("refreshToken")
    .addTag("Health")
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("docs", app, document, {
    jsonDocumentUrl: "docs/openapi.json",
    swaggerOptions: {
      persistAuthorization: true
    }
  });
}
