import type { Server } from "node:http";
import { INestApplication } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { configureApp } from "../src/app.setup";

describe("Health endpoints", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app, app.get(ConfigService));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /api/v1/health/live", async () => {
    const server = app.getHttpServer() as unknown as Server;
    const response = await request(server)
      .get("/api/v1/health/live")
      .expect(200);

    expect(response.body).toMatchObject({
      status: "ok",
      service: "livechat-api"
    });
  });
});
