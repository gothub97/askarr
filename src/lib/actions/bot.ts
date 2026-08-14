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
  getBotTokenState,
  setBotToken,
} from "../bot-token";
import { prisma } from "../prisma";
import { BOT_TOKEN_PATTERN, resolveBot } from "../telegram/resolve-bot";
import { assertSession } from "./guard";

/**
 * Back-office control of the bot: which token it runs on, whether the process
 * is alive, and asking it to reconnect.
 *
 * The token never travels back to the browser. Only its source, its last four
 * characters and when it changed do, which is enough to tell two tokens apart and not
 * enough to use one.
 */

export interface BotActionResult {
  ok: boolean;
  message?: string;
}

export interface BotOverview {
  token: BotTokenState;
  status: BotStatus;
}

const tokenSchema = z.object({
  token: z
    .string()
    .trim()
    .min(20, "That is too short to be a bot token.")
    .regex(BOT_TOKEN_PATTERN, "A bot token looks like 123456789:AA…"),
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

/** Groups as they are discovered, for the live panel on the Groups page. */
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
 * my_chat_member: the admin reads the id off the group and types it in.
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
