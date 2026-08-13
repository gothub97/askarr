import { Bot, GrammyError, HttpError } from "grammy";
import { startNotificationDrain } from "../lib/notifications";
import { prisma } from "../lib/prisma";
import { deleteExpiredDrafts } from "../lib/requests";
import { COMMAND_MENU, commands } from "./commands";
import { callbacks } from "./handlers/callbacks";
import { chatMember } from "./handlers/chat-member";
import type { AskarrContext } from "./handlers/context";
import { guard } from "./handlers/guard";

/**
 * The bot process: long polling, no webhook, no business rules. Everything it
 * knows how to do is ask src/lib/requests.ts and render the answer.
 */

const DRAFT_SWEEP_MS = 5 * 60 * 1000;

/**
 * my_chat_member is not in Telegram's default set, and without it the bot
 * never learns it was added to a group, which breaks onboarding step 3.
 */
const ALLOWED_UPDATES = ["message", "callback_query", "my_chat_member"] as const;

async function main() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.error("[askarr] TELEGRAM_BOT_TOKEN is not set. Copy .env.example to .env and fill it in.");
    process.exit(1);
  }

  const bot = new Bot<AskarrContext>(token);

  // A throwing handler must never take the process down with it.
  bot.catch((error) => {
    const update = error.ctx.update.update_id;
    if (error.error instanceof GrammyError) {
      console.error(`[askarr] telegram rejected update ${update}: ${error.error.description}`);
      return;
    }
    if (error.error instanceof HttpError) {
      console.error(`[askarr] could not reach telegram on update ${update}:`, error.error);
      return;
    }
    console.error(`[askarr] handler failed on update ${update}:`, error.error);
  });

  // Ahead of the guard on purpose: see handlers/chat-member.ts.
  bot.use(chatMember);
  bot.use(guard);
  bot.use(commands);
  bot.use(callbacks);

  await bot.api.setMyCommands([...COMMAND_MENU]);

  await sweepDrafts();
  const sweeper = setInterval(() => void sweepDrafts(), DRAFT_SWEEP_MS);
  const stopDrain = startNotificationDrain();

  const shutdown = async (signal: string) => {
    console.log(`[askarr] ${signal} received, stopping`);
    clearInterval(sweeper);
    stopDrain();
    await bot.stop();
    await prisma.$disconnect();
  };
  process.once("SIGINT", () => void shutdown("SIGINT"));
  process.once("SIGTERM", () => void shutdown("SIGTERM"));

  await bot.start({
    allowed_updates: [...ALLOWED_UPDATES],
    onStart: (me) => console.log(`[askarr] @${me.username} is polling`),
  });
}

async function sweepDrafts() {
  try {
    const removed = await deleteExpiredDrafts();
    if (removed > 0) console.log(`[askarr] swept ${removed} expired draft(s)`);
  } catch (error) {
    // A failed sweep is housekeeping, not a reason to stop serving people.
    console.error("[askarr] draft sweep failed:", error);
  }
}

main().catch((error) => {
  console.error("[askarr] failed to start:", error);
  process.exit(1);
});
