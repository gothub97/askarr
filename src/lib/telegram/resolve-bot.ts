/**
 * `getMe` against a token that is not in force yet.
 *
 * This is deliberately not the `callTelegram` in ./notify: that one resolves
 * the *active* token and is the right call for asking "who am I". This one
 * takes a candidate, which is what both places that accept a token from a human
 * need before saving it. Saving is what bumps the version the bot process
 * watches, so an unchecked bad token would knock the running bot off Telegram
 * and leave it idling on a credential that was never going to work.
 *
 * It lives here rather than in an action module because both callers are
 * `"use server"` files, where every export has to be an async server action.
 */

export type ResolveBotResult =
  | { ok: true; username: string; displayName: string }
  | { ok: false; message: string };

const TIMEOUT_MS = 10_000;

export async function resolveBot(token: string): Promise<ResolveBotResult> {
  let response: Response;
  try {
    response = await fetch(`https://api.telegram.org/bot${token}/getMe`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    return {
      ok: false,
      message: `Could not reach Telegram: ${error instanceof Error ? error.message : "network error"}`,
    };
  }

  const body = (await response.json().catch(() => null)) as {
    ok?: boolean;
    description?: string;
    result?: { username?: string; first_name?: string };
  } | null;

  if (!body?.ok || !body.result) {
    return {
      ok: false,
      message:
        response.status === 401
          ? "Telegram rejected that token. Check it against the one BotFather gave you."
          : `Telegram refused the token: ${body?.description ?? `HTTP ${response.status}`}`,
    };
  }

  const username = body.result.username;
  if (!username) {
    return {
      ok: false,
      message: "Telegram returned a bot with no username. Check BotFather.",
    };
  }

  return {
    ok: true,
    username,
    displayName: body.result.first_name ?? username,
  };
}

/**
 * The loose shape of a BotFather token. The real verification is Telegram
 * accepting it a moment later; this only catches a pasted sentence.
 */
export const BOT_TOKEN_PATTERN = /^\d+:[A-Za-z0-9_-]+$/;
