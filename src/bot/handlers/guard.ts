import type { NextFunction } from "grammy";
import { prisma } from "../../lib/prisma";
import { ensureTelegramUser } from "../../lib/requests";
import { type AskarrContext, displayNameOf } from "./context";

const PRIVATE_REPLY = "Askarr only works from the group.";

/**
 * The gate every update passes through.
 *
 * A chat that is not in TelegramChat, or is disabled, gets absolute silence:
 * no reply, no error, nothing. Anyone who adds the bot to a random group must
 * not be able to tell whether it is alive, so there is nothing to probe.
 */
export async function guard(ctx: AskarrContext, next: NextFunction) {
  const chat = ctx.chat;
  if (!chat) return;

  if (chat.type === "private") {
    await answerPrivate(ctx);
    return;
  }

  const allowed = await prisma.telegramChat.findUnique({
    where: { chatId: BigInt(chat.id) },
  });
  if (!allowed || !allowed.enabled) {
    console.log(
      `[askarr] ignoring update from chat ${chat.id} (${allowed ? "disabled" : "unknown"})`,
    );
    return;
  }

  const from = ctx.from;
  if (!from || from.is_bot) return;

  const user = await ensureTelegramUser({
    telegramId: BigInt(from.id),
    username: from.username ?? null,
    displayName: displayNameOf(from),
  });

  ctx.askarr = { chat: allowed, user, threadId: topicIdOf(ctx) };
  await next();
}

/** Exactly one line, then the chain stops. Askarr has nothing to do in a DM. */
async function answerPrivate(ctx: AskarrContext) {
  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery({ text: PRIVATE_REPLY, show_alert: true });
    return;
  }
  if (ctx.message) await ctx.reply(PRIVATE_REPLY);
}

/**
 * Only forum topics count. A plain group also carries message_thread_id on
 * replies, and echoing that back makes Telegram answer "message thread not
 * found".
 */
function topicIdOf(ctx: AskarrContext): number | null {
  const msg = ctx.msg;
  if (!msg?.is_topic_message) return null;
  return msg.message_thread_id ?? null;
}
