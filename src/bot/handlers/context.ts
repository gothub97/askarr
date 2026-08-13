import type { TelegramChat, TelegramUser } from "@prisma/client";
import type { Context } from "grammy";

/** What the guard resolves once per update, before any handler runs. */
export interface AskarrState {
  chat: TelegramChat;
  user: TelegramUser;
  /** Forum topic to answer in; null in a plain group. */
  threadId: number | null;
}

export type AskarrContext = Context & { askarr: AskarrState };

type ReplyOptions = NonNullable<Parameters<Context["reply"]>[1]>;

/**
 * Every outgoing message goes through here so the forum topic and the parse
 * mode are never forgotten. Replying into the wrong topic is the fastest way
 * to make the bot feel broken in a forum group.
 */
export async function replyHtml(
  ctx: AskarrContext,
  text: string,
  options: ReplyOptions = {},
) {
  return ctx.reply(text, {
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
    ...(ctx.askarr.threadId !== null
      ? { message_thread_id: ctx.askarr.threadId }
      : {}),
    ...options,
  });
}

/** A person's best available name; Telegram only guarantees `first_name`. */
export function displayNameOf(from: {
  first_name: string;
  last_name?: string;
  username?: string;
}): string {
  const full = [from.first_name, from.last_name].filter(Boolean).join(" ").trim();
  return full || from.username || "Someone";
}
