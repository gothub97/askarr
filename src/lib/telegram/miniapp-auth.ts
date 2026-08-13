import type { TelegramUser } from "@prisma/client";
import { NextResponse } from "next/server";
import { ensureTelegramUser } from "@/lib/requests";
import { isTelegramAdmin } from "@/lib/rbac";
import { displayNameOf, validateInitData } from "./initdata";

/**
 * The server-side gate for every /api/miniapp route.
 *
 * A Mini App carries no session cookie: the only credential the WebView can
 * present is the initData string Telegram signed for it. So everything here
 * hangs off validateInitData(), which already does the HMAC-SHA256 check, the
 * freshness window and the constant-time compare. The `user.id` inside initData
 * is attacker-controlled until that function has said otherwise, which is why
 * no other module in the Mini App ever reads it directly.
 */

/** Header the Mini App client puts its initData in. Lookup is case-insensitive. */
export const INIT_DATA_HEADER = "x-telegram-init-data";

export type MiniAppRejectionCode =
  | "unauthenticated"
  | "forbidden"
  | "misconfigured";

export interface MiniAppRejection {
  ok: false;
  status: 401 | 403 | 500;
  code: MiniAppRejectionCode;
  message: string;
}

export interface MiniAppIdentity {
  ok: true;
  user: TelegramUser;
}

export type MiniAppAuthResult = MiniAppIdentity | MiniAppRejection;

/**
 * One answer for missing, malformed, forged and stale signatures alike.
 * Telling a caller which check failed would hand them a probing oracle, and
 * the only useful remedy is the same in every case: reopen from Telegram.
 */
const NEUTRAL_401: MiniAppRejection = {
  ok: false,
  status: 401,
  code: "unauthenticated",
  message: "Open Askarr from Telegram to continue.",
};

const FORBIDDEN_403: MiniAppRejection = {
  ok: false,
  status: 403,
  code: "forbidden",
  message: "This area is for admins.",
};

/**
 * Verifies the caller and resolves them to their TelegramUser row.
 *
 * The returned row is the source of truth for the role: it comes from the
 * database, never from anything the client sent.
 */
export async function authenticateMiniApp(
  request: Request,
): Promise<MiniAppAuthResult> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    // Refusing loudly beats validating against an empty secret, which would
    // accept a signature anyone could compute.
    return {
      ok: false,
      status: 500,
      code: "misconfigured",
      message: "Askarr is not connected to a bot yet. Ask an admin to finish setup.",
    };
  }

  const result = validateInitData(
    request.headers.get(INIT_DATA_HEADER),
    botToken,
  );
  if (!result.ok) return NEUTRAL_401;

  // Telegram will not sign a bot into a Mini App, but a bot identity must never
  // own requests or a quota, so treat it as no identity at all.
  if (result.user.is_bot) return NEUTRAL_401;

  const user = await ensureTelegramUser({
    telegramId: BigInt(result.user.id),
    username: result.user.username ?? null,
    displayName: displayNameOf(result.user),
  });

  return { ok: true, user };
}

/** Turns a rejection into the JSON body the Mini App client expects. */
export function miniAppRejectionResponse(
  rejection: MiniAppRejection,
): NextResponse {
  return NextResponse.json(
    { error: rejection.message, code: rejection.code },
    { status: rejection.status },
  );
}

export type MiniAppHandler = (
  user: TelegramUser,
) => Response | Promise<Response>;

/**
 * Wraps a route body so it only ever runs for a verified caller.
 * Keeps every route down to its own logic and nothing else.
 */
export async function withTelegramUser(
  request: Request,
  handler: MiniAppHandler,
): Promise<Response> {
  const auth = await authenticateMiniApp(request);
  if (!auth.ok) return miniAppRejectionResponse(auth);
  return handler(auth.user);
}

/**
 * Same, plus an admin check read from the database row.
 *
 * The client is free to claim any role it likes; this is the only place that
 * decides, and it decides again on every single admin call.
 */
export async function requireMiniAppAdmin(
  request: Request,
  handler: MiniAppHandler,
): Promise<Response> {
  const auth = await authenticateMiniApp(request);
  if (!auth.ok) return miniAppRejectionResponse(auth);
  if (!isTelegramAdmin(auth.user)) {
    return miniAppRejectionResponse(FORBIDDEN_403);
  }
  return handler(auth.user);
}

/** A 400 with the same body shape as the rejections above. */
export function miniAppBadRequest(message: string): NextResponse {
  return NextResponse.json(
    { error: message, code: "bad_request" },
    { status: 400 },
  );
}
