import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import type { HealthResponseDto, ReadinessResponseDto } from "./dto/health-response.dto";

@Injectable()
export class HealthService {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService
  ) {}

  getLiveness(): HealthResponseDto {
    return {
      status: "ok",
      service: "livechat-api",
      version: this.config.getOrThrow<string>("APP_VERSION"),
      environment: this.config.getOrThrow<string>("NODE_ENV"),
      timestamp: new Date().toISOString(),
      uptimeSeconds: Number(process.uptime().toFixed(2))
    };
  }

  async getReadiness(): Promise<ReadinessResponseDto> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;

      return {
        ...this.getLiveness(),
        dependencies: {
          database: "up"
        }
      };
    } catch {
      throw new ServiceUnavailableException({
        message: "API is running, but PostgreSQL is not reachable",
        dependencies: {
          database: "down"
        }
      });
    }
  }
}
