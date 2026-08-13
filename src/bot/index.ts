import { Bot, GrammyError, HttpError } from "grammy";
import {
  type BotRuntimeState,
  readRestartRequest,
  writeHeartbeat,
} from "../lib/bot-control";
import { getActiveBotToken, getBotTokenVersion } from "../lib/bot-token";
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
 *
 * It is a supervisor rather than a single connection. The token is editable
 * from the back office, so this loop connects, watches for the token to change
 * or for a restart to be asked for, and reconnects — a token change must not
 * need someone with shell access to the container.
 *
 * A bad token is a configuration mistake, not a crash: the process stays up,
 * reports "rejected" through the heartbeat so the back office can say so, and
 * waits for a better one. Exiting would only hide the problem behind a restart
 * loop.
 */

const DRAFT_SWEEP_MS = 5 * 60 * 1000;
/** How often the heartbeat is written and the control keys are checked. */
const WATCH_INTERVAL_MS = 5_000;
/** Backoff when there is nothing to run with — a missing or rejected token. */
const IDLE_RETRY_MS = 10_000;

/**
 * my_chat_member is not in Telegram's default set, and without it the bot
 * never learns it was added to a group, which breaks onboarding step 3.
 */
const ALLOWED_UPDATES = ["message", "callback_query", "my_chat_member"] as const;

let shuttingDown = false;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Reports a state the bot cannot serve from, then waits before retrying. */
async function idle(
  state: BotRuntimeState,
  detail: string,
  tokenVersion: number,
): Promise<void> {
  console.error(`[askarr] ${detail}`);
  await writeHeartbeat({
    state,
    detail,
    tokenVersion,
    username: null,
    displayName: null,
    botId: null,
  });
  // Woken early by a token change, so fixing it in the UI takes effect at once.
  const deadline = Date.now() + IDLE_RETRY_MS;
  while (!shuttingDown && Date.now() < deadline) {
    await sleep(500);
    if ((await getBotTokenVersion().catch(() => tokenVersion)) !== tokenVersion) {
      return;
    }
  }
}

function buildBot(token: string): Bot<AskarrContext> {
  const bot = new Bot<AskarrContext>(token);

  // A throwing handler must never take the process down with it.
  bot.catch((error) => {
    const update = error.ctx.update.update_id;
    if (error.error instanceof GrammyError) {
      console.error(
        `[askarr] telegram rejected update ${update}: ${error.error.description}`,
      );
      return;
    }
    if (error.error instanceof HttpError) {
      console.error(
        `[askarr] could not reach telegram on update ${update}:`,
        error.error,
      );
      return;
    }
    console.error(`[askarr] handler failed on update ${update}:`, error.error);
  });

  // Ahead of the guard on purpose: see handlers/chat-member.ts.
  bot.use(chatMember);
  bot.use(guard);
  bot.use(commands);
  bot.use(callbacks);

  return bot;
}

/**
 * Heartbeats until something asks for a reconnect. Resolves when the caller
 * should tear the current connection down and build a new one.
 */
async function watchUntilReload(
  bot: Bot<AskarrContext>,
  tokenVersion: number,
  restartBaseline: number,
): Promise<void> {
  while (!shuttingDown) {
    await writeHeartbeat({
      state: "polling",
      detail: null,
      tokenVersion,
      username: bot.botInfo.username,
      displayName: bot.botInfo.first_name,
      botId: String(bot.botInfo.id),
    });

    await sleep(WATCH_INTERVAL_MS);
    if (shuttingDown) return;

    try {
      if ((await getBotTokenVersion()) !== tokenVersion) {
        console.log("[askarr] token changed, reconnecting");
        return;
      }
      if ((await readRestartRequest()) > restartBaseline) {
        console.log("[askarr] restart requested, reconnecting");
        return;
      }
    } catch (error) {
      // A database blip must not knock the bot off Telegram; the next tick
      // will pick the change up.
      console.error("[askarr] could not read bot control keys:", error);
    }
  }
}

async function main() {
  await sweepDrafts();
  const sweeper = setInterval(() => void sweepDrafts(), DRAFT_SWEEP_MS);
  const stopDrain = startNotificationDrain();

  let current: Bot<AskarrContext> | null = null;

  const shutdown = async (signal: string) => {
    console.log(`[askarr] ${signal} received, stopping`);
    shuttingDown = true;
    clearInterval(sweeper);
    stopDrain();
    if (current) await current.stop().catch(() => {});
    await writeHeartbeat({
      state: "stopped",
      detail: null,
      tokenVersion: await getBotTokenVersion().catch(() => 0),
      username: null,
      displayName: null,
      botId: null,
    });
    await prisma.$disconnect();
    process.exit(0);
  };
  process.once("SIGINT", () => void shutdown("SIGINT"));
  process.once("SIGTERM", () => void shutdown("SIGTERM"));

  while (!shuttingDown) {
    const tokenVersion = await getBotTokenVersion().catch(() => 0);
    const token = await getActiveBotToken().catch(() => null);

    if (!token) {
      await idle(
        "no_token",
        "No bot token yet. Add one in the back office under Bot, or set TELEGRAM_BOT_TOKEN.",
        tokenVersion,
      );
      continue;
    }

    const restartBaseline = await readRestartRequest().catch(() => 0);
    const bot = buildBot(token);

    try {
      // init() is the getMe call, so this is where a bad token surfaces.
      await bot.init();
      await bot.api.setMyCommands([...COMMAND_MENU]);
    } catch (error) {
      if (error instanceof GrammyError && error.error_code === 401) {
        await idle(
          "token_rejected",
          "Telegram rejected the bot token. Replace it in the back office under Bot.",
          tokenVersion,
        );
        continue;
      }
      await idle(
        "unreachable",
        `Could not reach Telegram: ${error instanceof Error ? error.message : String(error)}`,
        tokenVersion,
      );
      continue;
    }

    current = bot;
    // Not awaited: start() only resolves once the bot stops, and the watcher
    // has to run alongside it.
    void bot
      .start({
        allowed_updates: [...ALLOWED_UPDATES],
        onStart: (me) => console.log(`[askarr] @${me.username} is polling`),
      })
      .catch((error) => console.error("[askarr] polling stopped:", error));

    await watchUntilReload(bot, tokenVersion, restartBaseline);

    await bot.stop().catch(() => {});
    current = null;
  }
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
