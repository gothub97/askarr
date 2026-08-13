import crypto from "node:crypto";
import { z } from "zod";

/**
 * Validation of Telegram Mini App initData.
 *
 * The client controls every byte of this string, so the HMAC check below is
 * the only thing standing between a forged `user.id` and a session. Never read
 * `user` out of initData without going through validate().
 */

const MAX_AGE_SECONDS = 5 * 60;

export const telegramInitUserSchema = z.object({
  id: z.number(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  username: z.string().optional(),
  language_code: z.string().optional(),
  is_bot: z.boolean().optional(),
});

export type TelegramInitUser = z.infer<typeof telegramInitUserSchema>;

export type InitDataResult =
  | { ok: true; user: TelegramInitUser; authDate: Date }
  | { ok: false; reason: "missing" | "malformed" | "bad_hash" | "expired" };

export function validateInitData(
  initData: string | null | undefined,
  botToken: string,
): InitDataResult {
  if (!initData) return { ok: false, reason: "missing" };

  let params: URLSearchParams;
  try {
    params = new URLSearchParams(initData);
  } catch {
    return { ok: false, reason: "malformed" };
  }

  const hash = params.get("hash");
  if (!hash) return { ok: false, reason: "malformed" };

  // The data-check string is every field except `hash`, as `key=value`,
  // sorted by key, joined with newlines.
  const dataCheckString = [...params.entries()]
    .filter(([key]) => key !== "hash")
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secret = crypto
    .createHmac("sha256", "WebAppData")
    .update(botToken)
    .digest();
  const computed = crypto
    .createHmac("sha256", secret)
    .update(dataCheckString)
    .digest("hex");

  if (!timingSafeEqualHex(computed, hash)) {
    return { ok: false, reason: "bad_hash" };
  }

  // A valid signature is replayable forever without a freshness check.
  const authDateRaw = params.get("auth_date");
  const authDateSeconds = authDateRaw ? Number(authDateRaw) : NaN;
  if (!Number.isFinite(authDateSeconds)) {
    return { ok: false, reason: "malformed" };
  }
  const ageSeconds = Date.now() / 1000 - authDateSeconds;
  if (ageSeconds > MAX_AGE_SECONDS || ageSeconds < -MAX_AGE_SECONDS) {
    return { ok: false, reason: "expired" };
  }

  const userRaw = params.get("user");
  if (!userRaw) return { ok: false, reason: "malformed" };

  let parsedUser: unknown;
  try {
    parsedUser = JSON.parse(userRaw);
  } catch {
    return { ok: false, reason: "malformed" };
  }

  const user = telegramInitUserSchema.safeParse(parsedUser);
  if (!user.success) return { ok: false, reason: "malformed" };

  return {
    ok: true,
    user: user.data,
    authDate: new Date(authDateSeconds * 1000),
  };
}

/** Constant-time comparison of two hex digests of equal expected length. */
function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false;
  }
}

export function displayNameOf(user: TelegramInitUser): string {
  const name = [user.first_name, user.last_name].filter(Boolean).join(" ").trim();
  return name || user.username || `Telegram ${user.id}`;
}
