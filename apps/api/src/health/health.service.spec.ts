import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { PrismaService } from "../prisma/prisma.service";
import { HealthService } from "./health.service";

describe(HealthService.name, () => {
  it("returns liveness metadata", async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        HealthService,
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: (key: string) => {
              const values: Record<string, string> = {
                APP_VERSION: "0.1.0",
                NODE_ENV: "test"
              };

              return values[key];
            }
          }
        },
        {
          provide: PrismaService,
          useValue: {
            $queryRaw: jest.fn()
          }
        }
      ]
    }).compile();

    const service = moduleRef.get(HealthService);
    const result = service.getLiveness();

    expect(result).toMatchObject({
      status: "ok",
      service: "livechat-api",
      version: "0.1.0",
      environment: "test"
    });
  });
});
