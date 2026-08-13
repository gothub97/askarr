import { z } from "zod";

/**
 * Server-side environment. Parsed lazily so that `next build` (which imports
 * modules without a real environment) does not explode, while any runtime read
 * of a missing variable fails loudly and immediately.
 */
const serverSchema = z.object({
  DATABASE_URL: z.string().min(1),
  BETTER_AUTH_SECRET: z.string().min(1),
  BETTER_AUTH_URL: z.string().url(),
  NEXT_PUBLIC_APP_URL: z.string().url(),
  TELEGRAM_BOT_TOKEN: z.string().min(1),
  TELEGRAM_MINIAPP_URL: z.string().url().optional(),
  TZ: z.string().optional(),
});

export type ServerEnv = z.infer<typeof serverSchema>;

let cached: ServerEnv | null = null;

export function env(): ServerEnv {
  if (cached) return cached;
  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    const missing = parsed.error.issues
      .map((issue) => issue.path.join("."))
      .join(", ");
    throw new Error(
      `Invalid environment. Check these variables against .env.example: ${missing}`,
    );
  }
  cached = parsed.data;
  return cached;
}

/** Reads one variable without validating the whole environment. */
export function envVar(key: keyof ServerEnv): string | undefined {
  return process.env[key];
}
