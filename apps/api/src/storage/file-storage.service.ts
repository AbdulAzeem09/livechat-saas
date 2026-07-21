import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Injectable } from "@nestjs/common";
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

@Injectable()
export class FileStorageService {
  private readonly baseDir = join(process.cwd(), "uploads");

  constructor(private readonly config: ConfigService) {}

  async save(organizationId: string, file: UploadedFileLike): Promise<StoredFile> {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120) || "file";
    const key = `${randomUUID()}-${safeName}`;
    const storageKey = `${organizationId}/${key}`;

    await mkdir(join(this.baseDir, organizationId), { recursive: true });
    await writeFile(join(this.baseDir, organizationId, key), file.buffer);

    const apiUrl = (this.config.get<string>("API_URL") ?? "http://localhost:4000").replace(/\/$/, "");
    const globalPrefix = (this.config.get<string>("API_GLOBAL_PREFIX") ?? "api/v1").replace(/^\/|\/$/g, "");

    return {
      storageKey,
      publicUrl: `${apiUrl}/${globalPrefix}/files/${storageKey}`
    };
  }

  /** Resolve a storage key to an absolute disk path, rejecting path traversal. */
  resolvePath(organizationId: string, key: string): string | null {
    if (!/^[0-9a-fA-F-]{36}$/.test(organizationId) || !/^[a-zA-Z0-9._-]+$/.test(key)) {
      return null;
    }

    return join(this.baseDir, organizationId, key);
  }
}
