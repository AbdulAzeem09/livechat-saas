import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

/** Marks a value this service wrote, so older plain values are still readable. */
const PREFIX = "enc:v1:";
const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;

/**
 * Encrypts the third-party secrets we have to keep: WhatsApp and Messenger tokens, SSO client
 * secrets, app keys. They are stored so the server can call those services on the workspace's
 * behalf, which means they cannot be hashed — but a stolen database dump should not hand
 * anyone the customer's WhatsApp account.
 *
 * Reading tolerates values written before this existed, so nothing breaks on the way in; they
 * are re-encrypted the next time they are saved.
 */
@Injectable()
export class EncryptionService {
  private readonly logger = new Logger(EncryptionService.name);
  private readonly key: Buffer | null;

  constructor(config: ConfigService) {
    const secret = config.get<string>("ENCRYPTION_KEY")?.trim();

    if (secret) {
      // Any passphrase works; the hash turns it into the 32 bytes AES needs.
      this.key = createHash("sha256").update(secret).digest();
    } else {
      this.key = null;
      this.logger.warn(
        "ENCRYPTION_KEY is not set — integration secrets are stored as plain text. Set it in production."
      );
    }
  }

  get isConfigured(): boolean {
    return this.key !== null;
  }

  /** Returns the value ready to store. Without a key, stores it unchanged. */
  encrypt(value: string | null | undefined): string | null {
    if (value === null || value === undefined || value === "") {
      return value === "" ? "" : null;
    }

    if (!this.key || value.startsWith(PREFIX)) {
      return value;
    }

    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();

    return `${PREFIX}${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
  }

  /** Returns the usable value. Anything not written by us is returned as-is. */
  decrypt(value: string | null | undefined): string | null {
    if (!value) {
      return value ?? null;
    }

    if (!value.startsWith(PREFIX)) {
      return value; // written before encryption was switched on
    }

    if (!this.key) {
      this.logger.error("Found an encrypted value but ENCRYPTION_KEY is not set");
      return null;
    }

    try {
      const [ivPart, tagPart, dataPart] = value.slice(PREFIX.length).split(".");

      if (!ivPart || !tagPart || !dataPart) {
        return null;
      }

      const decipher = createDecipheriv(ALGORITHM, this.key, Buffer.from(ivPart, "base64url"));
      decipher.setAuthTag(Buffer.from(tagPart, "base64url"));

      return Buffer.concat([
        decipher.update(Buffer.from(dataPart, "base64url")),
        decipher.final()
      ]).toString("utf8");
    } catch (error) {
      // A wrong or rotated key must not crash a request; the integration simply stops working.
      this.logger.error(
        `Could not decrypt a stored secret: ${error instanceof Error ? error.message : String(error)}`
      );
      return null;
    }
  }

  /** Encrypt the named fields of a settings object (app installs keep keys in JSON). */
  encryptFields<T extends Record<string, unknown>>(settings: T, fields: string[]): T {
    const copy: Record<string, unknown> = { ...settings };

    for (const field of fields) {
      if (typeof copy[field] === "string" && copy[field]) {
        copy[field] = this.encrypt(copy[field]);
      }
    }

    return copy as T;
  }

  decryptFields<T extends Record<string, unknown>>(settings: T, fields: string[]): T {
    const copy: Record<string, unknown> = { ...settings };

    for (const field of fields) {
      if (typeof copy[field] === "string" && copy[field]) {
        copy[field] = this.decrypt(copy[field]) ?? "";
      }
    }

    return copy as T;
  }
}
