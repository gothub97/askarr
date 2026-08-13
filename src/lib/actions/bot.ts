"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  type BotStatus,
  readBotStatus,
  requestBotRestart,
} from "../bot-control";
import {
  type BotTokenState,
  clearBotToken,
  getBotTokenState,
  setBotToken,
} from "../bot-token";
import { prisma } from "../prisma";
import { assertSession } from "./guard";

/**
 * Back-office control of the bot: which token it runs on, whether the process
 * is alive, and asking it to reconnect.
 *
 * The token never travels back to the browser. Only its source, its last four
 * characters and when it changed do — enough to tell two tokens apart, not
 * enough to use one.
 */

export interface BotActionResult {
  ok: boolean;
  message?: string;
}

export interface BotOverview {
  token: BotTokenState;
  status: BotStatus;
  /** Present when the environment holds a token that the database overrides. */
  envSeedPresent: boolean;
}

const tokenSchema = z.object({
  // BotFather tokens look like 123456789:AA... — checked loosely, since the
  // real verification is Telegram accepting it a moment later.
  token: z
    .string()
    .trim()
    .min(20, "That is too short to be a bot token.")
    .regex(/^\d+:[A-Za-z0-9_-]+$/, "A bot token looks like 123456789:AA…"),
});

export async function getBotOverviewAction(): Promise<BotOverview> {
  await assertSession();
  const [token, status] = await Promise.all([
    getBotTokenState(),
    readBotStatus(),
  ]);
  return {
    token,
    status,
    envSeedPresent: Boolean(process.env.TELEGRAM_BOT_TOKEN),
  };
}

/** getMe against a specific token, to check one before it is saved. */
async function resolveBot(
  token: string,
): Promise<
  | { ok: true; username: string; displayName: string }
  | { ok: false; message: string }
> {
  let response: Response;
  try {
    response = await fetch(`https://api.telegram.org/bot${token}/getMe`, {
      signal: AbortSignal.timeout(10_000),
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
 * Saves a new token, but only one Telegram already accepted.
 *
 * Checking first matters: saving is what bumps the version the bot watches, so
 * an unchecked bad token would knock the running bot off Telegram and leave it
 * idling on a credential that was never going to work.
 */
export async function saveBotTokenAction(
  input: unknown,
): Promise<BotActionResult & { username?: string }> {
  await assertSession();

  const parsed = tokenSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "That is not a bot token.",
    };
  }

  const resolved = await resolveBot(parsed.data.token);
  if (!resolved.ok) return { ok: false, message: resolved.message };

  await setBotToken(parsed.data.token);
  revalidatePath("/bot");
  return { ok: true, username: resolved.username };
}

/** Drops the saved token so the environment seed takes over again. */
export async function revertBotTokenAction(): Promise<BotActionResult> {
  await assertSession();

  if (!process.env.TELEGRAM_BOT_TOKEN) {
    return {
      ok: false,
      message:
        "There is no TELEGRAM_BOT_TOKEN to fall back to, so removing this would leave Askarr with no bot.",
    };
  }

  await clearBotToken();
  // The version goes back to 0, which the bot reads as a change and reloads on.
  await requestBotRestart();
  revalidatePath("/bot");
  return { ok: true };
}

export async function restartBotAction(): Promise<BotActionResult> {
  await assertSession();
  await requestBotRestart();
  return { ok: true };
}

export interface DiscoveredChat {
  id: string;
  chatId: string;
  title: string | null;
  enabled: boolean;
}

/** Groups as they are discovered, for the live panel on the Bot page. */
export async function listDiscoveredChatsAction(): Promise<DiscoveredChat[]> {
  await assertSession();
  const chats = await prisma.telegramChat.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  return chats.map((chat) => ({
    id: chat.id,
    // BigInt has no JSON form; serialise before it crosses to the client.
    chatId: chat.chatId.toString(),
    title: chat.title,
    enabled: chat.enabled,
  }));
}

const manualChatSchema = z.object({
  chatId: z
    .string()
    .trim()
    .regex(/^-?\d+$/, "A chat id is digits, usually starting with -100."),
  title: z.string().trim().max(120).optional(),
});

/**
 * The escape hatch for an install where the bot cannot be restarted to pick up
 * my_chat_member — the admin reads the id off the group and types it in.
 */
export async function addChatManuallyAction(
  input: unknown,
): Promise<BotActionResult> {
  await assertSession();

  const parsed = manualChatSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "That is not a chat id.",
    };
  }

  let chatId: bigint;
  try {
    chatId = BigInt(parsed.data.chatId);
  } catch {
    return { ok: false, message: "That is not a chat id." };
  }

  await prisma.telegramChat.upsert({
    where: { chatId },
    create: { chatId, title: parsed.data.title ?? null, enabled: true },
    // A hand-typed title must not overwrite the one the bot reported.
    update: {
      enabled: true,
      ...(parsed.data.title ? { title: parsed.data.title } : {}),
    },
  });

  revalidatePath("/bot");
  revalidatePath("/chats");
  return { ok: true };
}
