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
      // Default interactive-transaction timeout is 5s, which a remote
      // (e.g. Supabase Seoul) database can exceed for multi-query transactions.
      // Give transactions more headroom so chat/widget writes do not fail.
      transactionOptions: {
        maxWait: 10000,
        timeout: 20000
      },
      log:
        config.get<string>("NODE_ENV") === "development"
          ? ["query", "warn", "error"]
          : ["warn", "error"]
    });
  }

  async onModuleInit(): Promise<void> {
    if (this.config.get<boolean>("DATABASE_CONNECT_ON_STARTUP")) {
      try {
        await this.$connect();
        this.logger.log("Connected to PostgreSQL");
      } catch (error) {
        // A transient pooler blip on boot must not crash the whole API;
        // Prisma will connect lazily on the first query.
        const message = error instanceof Error ? error.message.split("\n")[0] : String(error);
        this.logger.warn(`PostgreSQL not reachable on startup, will connect lazily: ${message}`);
      }
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
