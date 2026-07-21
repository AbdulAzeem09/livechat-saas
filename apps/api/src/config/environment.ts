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
  SMTP_FROM: z.string().default("LiveChat SaaS <no-reply@example.com>"),
  FILE_STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
  SOCKET_IO_CORS_ORIGIN: z.string().default("*"),
  // AI (optional - leave empty to run AI suggestions in fallback mode)
  ANTHROPIC_API_KEY: z.string().optional().default(""),
  // Authorize.net (optional - leave empty to run billing in mock mode)
  AUTHORIZENET_ENV: z.enum(["sandbox", "production"]).optional().default("sandbox"),
  AUTHORIZENET_API_LOGIN_ID: z.string().optional().default(""),
  AUTHORIZENET_TRANSACTION_KEY: z.string().optional().default(""),
  AUTHORIZENET_SIGNATURE_KEY: z.string().optional().default(""),
  AUTHORIZENET_PUBLIC_CLIENT_KEY: z.string().optional().default(""),
  // Platform super-admins (comma-separated emails) who can see the admin panel
  SUPER_ADMIN_EMAILS: z.string().optional().default("azeem.test@example.com")
});

export type Environment = z.infer<typeof environmentSchema>;

export function validateEnvironment(config: Record<string, unknown>): Environment {
  const parsed = environmentSchema.safeParse(config);

  if (!parsed.success) {
    const errors = parsed.error.errors
      .map((error) => `${error.path.join(".")}: ${error.message}`)
      .join("; ");

    throw new Error(`Invalid environment configuration: ${errors}`);
  }

  return parsed.data;
}
