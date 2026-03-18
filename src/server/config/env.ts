import * as dotenv from 'dotenv';
import { z } from 'zod';

// Ensure .env is loaded even if this module is imported before index.ts
// (e.g., in tests or alternative entry points). Idempotent — safe to call multiple times.
dotenv.config();

/**
 * Server environment validation — fail-fast on missing/invalid config.
 * Called at startup before any routes or workers initialize.
 * Subsumes S1 (JWT_SECRET crash) into comprehensive env validation.
 */

const envSchema = z.object({
  // Required — server will not start without these
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters (use a strong random value)'),
  VITE_SUPABASE_URL: z.string().url('VITE_SUPABASE_URL must be a valid URL'),
  VITE_SUPABASE_ANON_KEY: z.string().min(1, 'VITE_SUPABASE_ANON_KEY is required'),

  // Optional with sensible defaults
  PORT: z
    .string()
    .default('3000')
    .transform(Number)
    .pipe(z.number().int().positive()),
  VITE_APP_URL: z.string().url().default('http://localhost:5173'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Optional — SMTP (email features degrade gracefully without these)
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().optional().transform((v) => v ? Number(v) : undefined),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),

  // Optional — LLM keys (grading features degrade gracefully)
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error('\n❌ Environment validation failed:\n');
    for (const issue of result.error.issues) {
      const path = issue.path.join('.');
      console.error(`  • ${path}: ${issue.message}`);
    }
    console.error('\nCheck your .env file or environment variables and try again.\n');
    process.exit(1);
  }

  return result.data;
}

/** Validated environment — import this instead of reading process.env directly */
export const env = validateEnv();
