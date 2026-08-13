/**
 * Sending Telegram messages from the web process.
 *
 * The bot process owns long polling; the web process only ever needs to push
 * a message out. Rather than sharing a grammY instance across processes, this
 * talks to the Bot API directly.
 */

const API_ROOT = "https://api.telegram.org";
const TIMEOUT_MS = 10_000;

export interface SendMessageParams {
  chatId: bigint | number | string;
  text: string;
  threadId?: number | null;
  replyToMessageId?: number | null;
  /** Buttons, already shaped as an inline keyboard. */
  replyMarkup?: unknown;
  disableNotification?: boolean;
}

export type SendResult =
  | { ok: true; messageId: number }
  | { ok: false; reason: "reply_target_missing" | "blocked" | "other"; description: string };

function botToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not set");
  return token;
}

export async function callTelegram<T>(
  method: string,
  payload: Record<string, unknown>,
): Promise<{ ok: true; result: T } | { ok: false; description: string; errorCode?: number }> {
  let response: Response;
  try {
    response = await fetch(`${API_ROOT}/bot${botToken()}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    return {
      ok: false,
      description: error instanceof Error ? error.message : "network error",
    };
  }

  const body = (await response.json().catch(() => null)) as {
    ok?: boolean;
    result?: T;
    description?: string;
    error_code?: number;
  } | null;

  if (!body?.ok) {
    return {
      ok: false,
      description: body?.description ?? `HTTP ${response.status}`,
      errorCode: body?.error_code,
    };
  }
  return { ok: true, result: body.result as T };
}

/**
 * Sends a message, transparently falling back when the message being replied
 * to has been deleted. Telegram answers 400 "message to reply not found" in
 * that case; the caller usually wants the message delivered anyway.
 */
export async function sendMessage(
  params: SendMessageParams,
): Promise<SendResult> {
  const payload: Record<string, unknown> = {
    chat_id: params.chatId.toString(),
    text: params.text,
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
  };
  if (params.threadId != null) payload.message_thread_id = params.threadId;
  if (params.replyToMessageId != null) {
    payload.reply_parameters = { message_id: params.replyToMessageId };
  }
  if (params.replyMarkup) payload.reply_markup = params.replyMarkup;
  if (params.disableNotification) payload.disable_notification = true;

  const result = await callTelegram<{ message_id: number }>(
    "sendMessage",
    payload,
  );

  if (result.ok) return { ok: true, messageId: result.result.message_id };

  const description = result.description.toLowerCase();
  if (
    description.includes("message to reply not found") ||
    description.includes("message to be replied not found") ||
    description.includes("reply message not found")
  ) {
    return {
      ok: false,
      reason: "reply_target_missing",
      description: result.description,
    };
  }
  if (
    description.includes("bot was blocked") ||
    description.includes("chat not found") ||
    description.includes("kicked")
  ) {
    return { ok: false, reason: "blocked", description: result.description };
  }
  return { ok: false, reason: "other", description: result.description };
}

/**
 * Sends a reply, and on a missing reply target re-sends as a plain message
 * carrying an inline mention instead.
 *
 * Not every member has a @username, so the mention is always built as an
 * HTML tg://user link rather than an @handle.
 */
export async function sendReplyOrMention(params: {
  chatId: bigint | number | string;
  threadId?: number | null;
  replyToMessageId?: number | null;
  text: string;
  telegramId: bigint | number;
  displayName: string;
}): Promise<SendResult> {
  if (params.replyToMessageId != null) {
    const attempt = await sendMessage({
      chatId: params.chatId,
      threadId: params.threadId,
      replyToMessageId: params.replyToMessageId,
      text: params.text,
    });
    if (attempt.ok || attempt.reason !== "reply_target_missing") return attempt;
  }

  return sendMessage({
    chatId: params.chatId,
    threadId: params.threadId,
    text: `${mention(params.telegramId, params.displayName)} ${params.text}`,
  });
}

export function mention(
  telegramId: bigint | number,
  displayName: string,
): string {
  return `<a href="tg://user?id=${telegramId}">${escapeHtml(displayName)}</a>`;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
