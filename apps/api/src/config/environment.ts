import { z } from "zod";

const environmentSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  API_URL: z.string().url().default("http://localhost:4000"),
  APP_VERSION: z.string().default("0.1.0"),
  PORT: z.coerce.number().int().positive().default(4000),
  API_GLOBAL_PREFIX: z.string().min(1).default("api/v1"),
  API_CORS_ORIGINS: z.string().min(1).default("http://localhost:3000"),
  DATABASE_URL: z
    .string()
    .url()
    .default("postgresql://livechat:livechat@localhost:5432/livechat?schema=public"),
  DATABASE_CONNECT_ON_STARTUP: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  JWT_ACCESS_SECRET: z.string().min(16).default("dev-access-secret-change-me"),
  JWT_REFRESH_SECRET: z.string().min(16).default("dev-refresh-secret-change-me"),
  JWT_ACCESS_TTL: z.string().default("15m"),
  JWT_REFRESH_TTL: z.string().default("30d"),
  JWT_ISSUER: z.string().default("livechat-saas-api"),
  JWT_AUDIENCE: z.string().default("livechat-saas"),
  AUTH_REFRESH_COOKIE_NAME: z.string().min(1).default("lc_refresh_token"),
  AUTH_COOKIE_SECURE: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  GOOGLE_CLIENT_ID: z.string().optional().default(""),
  GOOGLE_CLIENT_SECRET: z.string().optional().default(""),
  GOOGLE_CALLBACK_URL: z
    .string()
    .url()
    .default("http://localhost:4000/api/v1/auth/google/callback"),
  STRIPE_SECRET_KEY: z.string().optional().default(""),
  STRIPE_WEBHOOK_SECRET: z.string().optional().default(""),
  STRIPE_PUBLISHABLE_KEY: z.string().optional().default(""),
  SMTP_HOST: z.string().optional().default(""),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().optional().default(""),
  SMTP_PASSWORD: z.string().optional().default(""),
  SMTP_FROM: z.string().default("TalkZen <no-reply@example.com>"),
  FILE_STORAGE_DRIVER: z.enum(["local", "supabase"]).default("local"),
  SUPABASE_URL: z.string().optional().default(""),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional().default(""),
  SUPABASE_STORAGE_BUCKET: z.string().min(1).default("attachments"),
  SOCKET_IO_CORS_ORIGIN: z.string().default("*"),
  /** Set this to run more than one API instance; chat events travel between them through Redis. */
  REDIS_URL: z.string().optional(),
  /** Encrypts integration secrets (channel tokens, SSO client secrets, app keys) at rest. */
  ENCRYPTION_KEY: z.string().optional(),
  // AI (optional - leave empty to run AI suggestions in fallback mode)
  ANTHROPIC_API_KEY: z.string().optional().default(""),
  // Authorize.net (optional - leave empty to run billing in mock mode)
  AUTHORIZENET_ENV: z.enum(["sandbox", "production"]).optional().default("sandbox"),
  AUTHORIZENET_API_LOGIN_ID: z.string().optional().default(""),
  AUTHORIZENET_TRANSACTION_KEY: z.string().optional().default(""),
  AUTHORIZENET_SIGNATURE_KEY: z.string().optional().default(""),
  AUTHORIZENET_PUBLIC_CLIENT_KEY: z.string().optional().default(""),
  // Platform super-admins (comma-separated emails) who can see the admin panel
  SUPER_ADMIN_EMAILS: z.string().optional().default("")
});

const DEV_JWT_SECRETS = new Set(["dev-access-secret-change-me", "dev-refresh-secret-change-me"]);

export type Environment = z.infer<typeof environmentSchema>;

export function validateEnvironment(config: Record<string, unknown>): Environment {
  const parsed = environmentSchema.safeParse(config);

  if (!parsed.success) {
    const errors = parsed.error.errors
      .map((error) => `${error.path.join(".")}: ${error.message}`)
      .join("; ");

    throw new Error(`Invalid environment configuration: ${errors}`);
  }

  if (
    parsed.data.FILE_STORAGE_DRIVER === "supabase" &&
    (!parsed.data.SUPABASE_URL || !parsed.data.SUPABASE_SERVICE_ROLE_KEY)
  ) {
    throw new Error(
      "Invalid environment configuration: FILE_STORAGE_DRIVER=supabase needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
    );
  }

  // The dev fallbacks are public in this repo; anyone could forge tokens with them.
  if (
    parsed.data.NODE_ENV === "production" &&
    (DEV_JWT_SECRETS.has(parsed.data.JWT_ACCESS_SECRET) ||
      DEV_JWT_SECRETS.has(parsed.data.JWT_REFRESH_SECRET) ||
      parsed.data.JWT_ACCESS_SECRET === parsed.data.JWT_REFRESH_SECRET)
  ) {
    throw new Error(
      "Invalid environment configuration: set unique JWT_ACCESS_SECRET and JWT_REFRESH_SECRET in production"
    );
  }

  return parsed.data;
}
