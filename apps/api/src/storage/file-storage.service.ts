import { randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Readable } from "node:stream";
import type { ReadableStream as WebReadableStream } from "node:stream/web";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export interface StoredFile {
  storageKey: string;
  publicUrl: string;
}

/** Minimal shape of a multer-uploaded file (avoids needing @types/multer). */
export interface UploadedFileLike {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

const ORGANIZATION_ID_PATTERN = /^[0-9a-fA-F-]{36}$/;
// Keys are always "<uuid>-<sanitized name>", which also rules out "." and "..".
const FILE_KEY_PATTERN = /^[0-9a-fA-F-]{36}-[a-zA-Z0-9._-]{1,120}$/;

/**
 * Stores chat attachments. `local` writes to ./uploads (development only: a Render
 * instance loses its disk on every restart or deploy); `supabase` keeps them in a
 * private Supabase Storage bucket. Files are always served through the API at
 * /files/:organizationId/:key, so stored URLs stay the same whichever driver is used.
 */
@Injectable()
export class FileStorageService {
  private readonly logger = new Logger(FileStorageService.name);
  private readonly baseDir = join(process.cwd(), "uploads");

  constructor(private readonly config: ConfigService) {
    if (this.driver === "local" && this.config.get<string>("NODE_ENV") === "production") {
      this.logger.warn(
        "FILE_STORAGE_DRIVER=local: uploaded files are lost whenever the server restarts. Use supabase in production."
      );
    }
  }

  async save(organizationId: string, file: UploadedFileLike): Promise<StoredFile> {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120) || "file";
    const key = `${randomUUID()}-${safeName}`;
    const storageKey = `${organizationId}/${key}`;

    if (this.driver === "supabase") {
      const response = await this.supabaseObjectRequest(storageKey, {
        method: "POST",
        headers: {
          "content-type": file.mimetype || "application/octet-stream",
          "x-upsert": "false"
        },
        body: new Uint8Array(file.buffer)
      });
      if (!response.ok) {
        throw new Error(`Supabase Storage upload failed with status ${response.status}`);
      }
    } else {
      await mkdir(join(this.baseDir, organizationId), { recursive: true });
      await writeFile(join(this.baseDir, organizationId, key), file.buffer);
    }

    const apiUrl = (this.config.get<string>("API_URL") ?? "http://localhost:4000").replace(/\/$/, "");
    const globalPrefix = (this.config.get<string>("API_GLOBAL_PREFIX") ?? "api/v1").replace(/^\/|\/$/g, "");

    return {
      storageKey,
      publicUrl: `${apiUrl}/${globalPrefix}/files/${storageKey}`
    };
  }

  /** Open a stored file for streaming, or null when the key is invalid or the file is missing. */
  async open(organizationId: string, key: string): Promise<Readable | null> {
    if (!ORGANIZATION_ID_PATTERN.test(organizationId) || !FILE_KEY_PATTERN.test(key)) {
      return null;
    }

    if (this.driver === "supabase") {
      const response = await this.supabaseObjectRequest(`${organizationId}/${key}`, { method: "GET" });
      // Supabase answers a missing object with 400 "Object not found".
      if (response.status === 400 || response.status === 404) {
        return null;
      }
      if (!response.ok || !response.body) {
        throw new Error(`Supabase Storage download failed with status ${response.status}`);
      }
      return Readable.fromWeb(response.body as WebReadableStream<Uint8Array>);
    }

    const path = join(this.baseDir, organizationId, key);
    const info = await stat(path).catch(() => null);
    return info?.isFile() ? createReadStream(path) : null;
  }

  private get driver(): string {
    return this.config.get<string>("FILE_STORAGE_DRIVER") ?? "local";
  }

  private supabaseObjectRequest(storageKey: string, init: RequestInit): Promise<Response> {
    const baseUrl = (this.config.get<string>("SUPABASE_URL") ?? "").replace(/\/$/, "");
    const serviceKey = this.config.get<string>("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const bucket = this.config.get<string>("SUPABASE_STORAGE_BUCKET") ?? "attachments";
    const objectPath = storageKey.split("/").map(encodeURIComponent).join("/");

    return fetch(`${baseUrl}/storage/v1/object/${encodeURIComponent(bucket)}/${objectPath}`, {
      ...init,
      headers: {
        ...(init.headers as Record<string, string> | undefined),
        authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey
      },
      signal: AbortSignal.timeout(30_000)
    });
  }
}
