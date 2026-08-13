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
  // Read only on the server, so deliberately NOT prefixed NEXT_PUBLIC_: that
  // prefix inlines a value at build time, which would bake one install's URL
  // into the published image. See appUrl() below.
  APP_URL: z.string().url(),
  // Optional: the live token is whatever the admin saved in the database.
  // This one only seeds a fresh install, so Askarr can boot with no UI visit.
  // See src/lib/bot-token.ts.
  TELEGRAM_BOT_TOKEN: z.string().min(1).optional(),
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

/**
 * Where Askarr is reachable from outside.
 *
 * Server-only, and deliberately not `NEXT_PUBLIC_*`: that prefix inlines the
 * value at build time, which would tie the published Docker image to whichever
 * URL it was built against. `NEXT_PUBLIC_APP_URL` is still read as a fallback
 * so existing installs keep working.
 */
export function appUrl(): string | undefined {
  return process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL;
}

/** Reads one variable without validating the whole environment. */
export function envVar(key: keyof ServerEnv): string | undefined {
  return process.env[key];
}
