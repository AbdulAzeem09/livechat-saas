import { INestApplicationContext, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { IoAdapter } from "@nestjs/platform-socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import Redis from "ioredis";
import type { ServerOptions, Server } from "socket.io";

/**
 * Lets several API instances share one chat.
 *
 * Socket.IO keeps its rooms in the memory of whichever process holds the connection, so with
 * two instances an agent on instance A would never see a visitor connected to instance B.
 * Redis carries the events between them.
 *
 * With no REDIS_URL set the server behaves exactly as before — one instance, no extra moving
 * parts — so local development and small deployments need no Redis at all.
 */
export class RedisIoAdapter extends IoAdapter {
  private readonly logger = new Logger(RedisIoAdapter.name);
  private adapterConstructor: ReturnType<typeof createAdapter> | null = null;
  private clients: Redis[] = [];

  constructor(
    app: INestApplicationContext,
    private readonly config: ConfigService
  ) {
    super(app);
  }

  /** Returns true when the instances are wired together through Redis. */
  async connect(): Promise<boolean> {
    const url = this.config.get<string>("REDIS_URL")?.trim();

    if (!url) {
      this.logger.log("REDIS_URL is not set — running as a single instance");
      return false;
    }

    try {
      // One connection publishes, the other subscribes; a subscriber cannot do anything else.
      const publisher = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 3 });
      const subscriber = publisher.duplicate();

      await Promise.all([publisher.connect(), subscriber.connect()]);

      publisher.on("error", (error) => this.logger.error(`Redis publisher: ${error.message}`));
      subscriber.on("error", (error) => this.logger.error(`Redis subscriber: ${error.message}`));

      this.clients = [publisher, subscriber];
      this.adapterConstructor = createAdapter(publisher, subscriber);
      this.logger.log("Chat events are shared between instances through Redis");

      return true;
    } catch (error) {
      // A missing Redis must not stop the API from serving chats on this instance.
      this.logger.error(
        `Could not reach Redis, staying single-instance: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return false;
    }
  }

  override createIOServer(port: number, options?: ServerOptions): Server {
    const server = super.createIOServer(port, options) as Server;

    if (this.adapterConstructor) {
      server.adapter(this.adapterConstructor);
    }

    return server;
  }

  async close(): Promise<void> {
    await Promise.all(this.clients.map((client) => client.quit().catch(() => undefined)));
    this.clients = [];
  }
}
