import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { BadRequestException, Injectable, UnauthorizedException } from "@nestjs/common";
import { User } from "@prisma/client";
import bcrypt from "bcryptjs";
import { EncryptionService } from "../common/crypto/encryption.service";
import { PrismaService } from "../prisma/prisma.service";

export interface TwoFactorSetup {
  /** Paste into an authenticator app, or scan the otpauth URL as a QR code. */
  secret: string;
  otpauthUrl: string;
}

export interface TwoFactorEnabled {
  enabled: true;
  /** Shown once. Each one signs in exactly one more time if the phone is lost. */
  recoveryCodes: string[];
}

/** Sign-in is blocked for this long once someone keeps guessing. */
const LOCK_MINUTES = 15;
const MAX_FAILED_ATTEMPTS = 8;
const RECOVERY_CODE_COUNT = 10;
/** A 30-second step, and one step of slack for clocks that drift. */
const TOTP_STEP_SECONDS = 30;
const TOTP_WINDOW = 1;
const TOTP_DIGITS = 6;

/** Passwords people actually use. Short list; the length rule does the rest. */
const COMMON_PASSWORDS = new Set([
  "password", "password1", "password123", "12345678", "123456789", "1234567890",
  "qwerty123", "qwertyuiop", "letmein1", "welcome1", "admin123", "iloveyou",
  "abc12345", "changeme", "passw0rd", "football", "baseball", "sunshine",
  "princess", "monkey123", "livechat", "whatever"
]);

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/**
 * The parts of signing in that keep an account safe: a password worth having, a pause after
 * repeated guesses, and an optional second step from an authenticator app.
 */
@Injectable()
export class AccountSecurityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService
  ) {}

  // ------------------------------------------------------------- password rules

  /**
   * Rejects the passwords that actually get broken: too short, all one kind of character,
   * the person's own email, or one from the common list.
   */
  assertPasswordIsStrong(password: string, email?: string): void {
    const value = password.trim();

    if (value.length < 10) {
      throw new BadRequestException("Use at least 10 characters — a short phrase works well");
    }

    if (!/[a-zA-Z]/.test(value) || !/[0-9]/.test(value)) {
      throw new BadRequestException("Include both letters and numbers");
    }

    if (COMMON_PASSWORDS.has(value.toLowerCase())) {
      throw new BadRequestException("That password is too common — pick something else");
    }

    const localPart = email?.split("@")[0]?.toLowerCase();

    if (localPart && localPart.length > 2 && value.toLowerCase().includes(localPart)) {
      throw new BadRequestException("Don't use your email address in your password");
    }
  }

  // ------------------------------------------------------------------- lockout

  /** Throws when this account is in its cool-off period. */
  assertNotLocked(user: Pick<User, "lockedUntil">): void {
    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      const minutes = Math.max(
        1,
        Math.ceil((user.lockedUntil.getTime() - Date.now()) / (60 * 1000))
      );

      throw new UnauthorizedException(
        `Too many failed attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`
      );
    }
  }

  /** Count a wrong password, and lock the account once there have been too many. */
  async recordFailedLogin(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { failedLoginAttempts: true }
    });
    const attempts = (user?.failedLoginAttempts ?? 0) + 1;

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        failedLoginAttempts: attempts,
        ...(attempts >= MAX_FAILED_ATTEMPTS
          ? { lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60 * 1000), failedLoginAttempts: 0 }
          : {})
      }
    });
  }

  async clearFailedLogins(userId: string): Promise<void> {
    await this.prisma.user
      .update({ where: { id: userId }, data: { failedLoginAttempts: 0, lockedUntil: null } })
      .catch(() => undefined);
  }

  // ---------------------------------------------------------------- two-factor

  isTwoFactorEnabled(user: Pick<User, "twoFactorEnabledAt" | "twoFactorSecret">): boolean {
    return Boolean(user.twoFactorEnabledAt && user.twoFactorSecret);
  }

  /** Step 1: hand out a secret to put into the authenticator app. Not active yet. */
  async startTwoFactorSetup(userId: string, email: string): Promise<TwoFactorSetup> {
    const secret = this.randomBase32(20);

    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorSecret: this.encryption.encrypt(secret), twoFactorEnabledAt: null }
    });

    const label = encodeURIComponent(email);
    const issuer = encodeURIComponent("TalkZen");

    return {
      secret,
      otpauthUrl: `otpauth://totp/${issuer}:${label}?secret=${secret}&issuer=${issuer}&digits=${TOTP_DIGITS}&period=${TOTP_STEP_SECONDS}`
    };
  }

  /** Step 2: prove the app works, then switch it on and hand over the recovery codes. */
  async enableTwoFactor(userId: string, code: string): Promise<TwoFactorEnabled> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const secret = this.encryption.decrypt(user?.twoFactorSecret);

    if (!user || !secret) {
      throw new BadRequestException("Start the setup first");
    }

    if (!this.verifyTotp(secret, code)) {
      throw new BadRequestException("That code didn't match — check the time on your phone");
    }

    const recoveryCodes = Array.from({ length: RECOVERY_CODE_COUNT }, () =>
      randomBytes(5).toString("hex").toUpperCase().match(/.{1,5}/g)!.join("-")
    );

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabledAt: new Date(),
        twoFactorRecoveryCodes: recoveryCodes.map((code) => this.hashRecoveryCode(code))
      }
    });

    return { enabled: true, recoveryCodes };
  }

  async disableTwoFactor(userId: string, password: string): Promise<{ disabled: true }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user?.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException("That password is not right");
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorSecret: null, twoFactorEnabledAt: null, twoFactorRecoveryCodes: [] }
    });

    return { disabled: true };
  }

  /** Check a code at sign-in: either from the app, or one of the recovery codes. */
  async verifySecondFactor(userId: string, code: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      return false;
    }

    const secret = this.encryption.decrypt(user.twoFactorSecret);

    if (secret && this.verifyTotp(secret, code)) {
      return true;
    }

    // Recovery codes are single use: the one that matched is removed.
    const hashed = this.hashRecoveryCode(code);
    const remaining = user.twoFactorRecoveryCodes.filter((stored) => stored !== hashed);

    if (remaining.length !== user.twoFactorRecoveryCodes.length) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { twoFactorRecoveryCodes: remaining }
      });

      return true;
    }

    return false;
  }

  // ------------------------------------------------------------------ TOTP bits

  /** RFC 6238, the same maths every authenticator app uses. */
  private verifyTotp(secret: string, code: string): boolean {
    const clean = code.replace(/\D/g, "");

    if (clean.length !== TOTP_DIGITS) {
      return false;
    }

    const counter = Math.floor(Date.now() / 1000 / TOTP_STEP_SECONDS);

    for (let drift = -TOTP_WINDOW; drift <= TOTP_WINDOW; drift += 1) {
      if (this.timingSafeEquals(this.totpAt(secret, counter + drift), clean)) {
        return true;
      }
    }

    return false;
  }

  private totpAt(secret: string, counter: number): string {
    const buffer = Buffer.alloc(8);
    buffer.writeBigUInt64BE(BigInt(counter));

    const digest = createHmac("sha1", this.base32Decode(secret)).update(buffer).digest();
    const offset = digest[digest.length - 1]! & 0x0f;
    const binary =
      ((digest[offset]! & 0x7f) << 24) |
      ((digest[offset + 1]! & 0xff) << 16) |
      ((digest[offset + 2]! & 0xff) << 8) |
      (digest[offset + 3]! & 0xff);

    return (binary % 10 ** TOTP_DIGITS).toString().padStart(TOTP_DIGITS, "0");
  }

  private randomBase32(bytes: number): string {
    const buffer = randomBytes(bytes);
    let bits = 0;
    let value = 0;
    let output = "";

    for (const byte of buffer) {
      value = (value << 8) | byte;
      bits += 8;

      while (bits >= 5) {
        output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
        bits -= 5;
      }
    }

    return output;
  }

  private base32Decode(input: string): Buffer {
    let bits = 0;
    let value = 0;
    const output: number[] = [];

    for (const character of input.toUpperCase().replace(/=+$/, "")) {
      const index = BASE32_ALPHABET.indexOf(character);

      if (index === -1) {
        continue;
      }

      value = (value << 5) | index;
      bits += 5;

      if (bits >= 8) {
        output.push((value >>> (bits - 8)) & 255);
        bits -= 8;
      }
    }

    return Buffer.from(output);
  }

  private hashRecoveryCode(code: string): string {
    return createHash("sha256").update(code.trim().toUpperCase()).digest("hex");
  }

  private timingSafeEquals(a: string, b: string): boolean {
    const left = Buffer.from(a);
    const right = Buffer.from(b);

    return left.length === right.length && timingSafeEqual(left, right);
  }
}
