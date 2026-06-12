import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor(private readonly config: ConfigService) {
    super({
      datasources: {
        db: {
          url: config.getOrThrow<string>("DATABASE_URL")
        }
      },
      log:
        config.get<string>("NODE_ENV") === "development"
          ? ["query", "warn", "error"]
          : ["warn", "error"]
    });
  }

  async onModuleInit(): Promise<void> {
    if (this.config.get<boolean>("DATABASE_CONNECT_ON_STARTUP")) {
      await this.$connect();
      this.logger.log("Connected to PostgreSQL");
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
