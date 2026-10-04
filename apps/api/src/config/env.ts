import { KINGSCHAT_ENVIRONMENTS } from '@qub/shared';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

const here = path.dirname(fileURLToPath(import.meta.url));
// Load the nearest .env files walking up from this module (apps/api, then the repository root), for both the
// source tree and the bundled dist. Real environment variables always win; closer files take precedence.
for (let dir = here, i = 0; i < 5; i++, dir = path.dirname(dir)) {
  const candidate = path.join(dir, '.env');
  if (existsSync(candidate)) loadDotenv({ path: candidate, quiet: true });
}

const bool = z
  .enum(['true', 'false', '1', '0'])
  .transform((v) => v === 'true' || v === '1');

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
    HOST: z.string().default('0.0.0.0'),
    PORT: z.coerce.number().int().min(1).max(65535).default(4100),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
    TRUST_PROXY: bool.default(false),

    DATABASE_URL: z.string().url(),
    DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),

    JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
    JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
    ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(30),
    COOKIE_SECURE: bool.optional(),
    COOKIE_DOMAIN: z.string().optional(),
    REQUIRE_EMAIL_VERIFICATION: bool.default(false),

    CORS_ORIGIN: z.string().default('http://localhost:5180'),
    APP_URL: z.string().url().default('http://localhost:5180'),

    STORAGE_PROVIDER: z.enum(['local', 's3']).default('local'),
    STORAGE_LOCAL_DIR: z.string().default('./storage'),
    STORAGE_BUCKET: z.string().optional(),
    STORAGE_REGION: z.string().default('us-east-1'),
    STORAGE_ENDPOINT: z.string().url().optional(),
    STORAGE_ACCESS_KEY: z.string().optional(),
    STORAGE_SECRET_KEY: z.string().optional(),
    STORAGE_FORCE_PATH_STYLE: bool.default(false),
    MAX_UPLOAD_MB: z.coerce.number().int().min(1).max(5120).default(100),

    TRASH_RETENTION_DAYS: z.coerce.number().int().min(1).max(3650).default(30),
    TRASH_PURGE_INTERVAL_MINUTES: z.coerce.number().int().min(0).max(1440).default(60),

    MAIL_TRANSPORT: z.enum(['console', 'smtp']).default('console'),
    MAIL_FROM: z.string().default('Qub <no-reply@qub.local>'),
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().int().default(587),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    /**
     * Encrypts credentials admins enter in the console (email provider passwords and API keys). When unset, a key is
     * derived from JWT_SECRET, so rotating JWT_SECRET means re-entering those credentials.
     */
    SETTINGS_ENCRYPTION_KEY: z.string().min(32, 'SETTINGS_ENCRYPTION_KEY must be at least 32 characters').optional(),

    RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(600),
    AUTH_RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(20),

        KINGSCHAT_CLIENT_ID: z.string().min(1).optional(),
    KINGSCHAT_ENV: z.enum(KINGSCHAT_ENVIRONMENTS).default('prod'),
    SERVE_WEB_DIST: z.string().optional(),

    CLOUDFLARE_ACCOUNT_ID: z.string().optional(),
    CLOUDFLARE_API_TOKEN: z.string().optional(),
  })
  .superRefine((env, ctx) => {
    if (env.STORAGE_PROVIDER === 's3' && !env.STORAGE_BUCKET) {
      ctx.addIssue({ code: 'custom', path: ['STORAGE_BUCKET'], message: 'STORAGE_BUCKET is required for s3 storage' });
    }
    if (env.JWT_SECRET === env.JWT_REFRESH_SECRET) {
      ctx.addIssue({ code: 'custom', path: ['JWT_REFRESH_SECRET'], message: 'Must differ from JWT_SECRET' });
    }
    const deployed = env.NODE_ENV === 'production' || env.NODE_ENV === 'staging';
    if (deployed && env.MAIL_TRANSPORT !== 'smtp') {
      ctx.addIssue({ code: 'custom', path: ['MAIL_TRANSPORT'], message: 'smtp is required outside development' });
    }
    if (deployed && env.MAIL_TRANSPORT === 'smtp' && !env.SMTP_HOST) {
      ctx.addIssue({ code: 'custom', path: ['SMTP_HOST'], message: 'SMTP_HOST is required' });
    }
  });

export type Env = z.infer<typeof envSchema> & { corsOrigins: string[]; cookieSecure: boolean; isProduction: boolean };

function load(): Env {
  // Blank values in .env files mean "not set".
  const raw = Object.fromEntries(Object.entries(process.env).filter(([, v]) => v !== undefined && v.trim() !== ''));
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    // Startup must fail loudly on misconfiguration.
    console.error(`Invalid environment configuration:\n${issues}`);
    process.exit(1);
  }
  const env = parsed.data;
  const deployed = env.NODE_ENV === 'production' || env.NODE_ENV === 'staging';
  return {
    ...env,
    corsOrigins: env.CORS_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean),
    cookieSecure: env.COOKIE_SECURE ?? deployed,
    isProduction: deployed,
  };
}

export const env = load();
