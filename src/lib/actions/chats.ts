"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "../prisma";
import { callTelegram } from "../telegram/notify";
import { assertSession } from "./guard";

/**
 * Group access. The row id (a cuid) is what crosses to the browser, never the
 * Telegram chat_id: that one is a BigInt and does not survive serialization.
 */

export interface ChatActionResult {
  ok: boolean;
  message?: string;
}

const toggleChatSchema = z.object({
  id: z.string().min(1, "Pick a group first."),
  enabled: z.boolean(),
});

/** null pins that purpose to the group's main thread. */
const threadIdSchema = z
  .number()
  .int("A topic id is a whole number.")
  .positive("A topic id is a positive number.")
  .nullable();

const topicSchema = z.object({
  id: z.string().min(1, "Pick a group first."),
  purpose: z.enum(["request", "admin", "general"]),
  threadId: threadIdSchema,
});

const PURPOSE_COLUMN = {
  request: "requestThreadId",
  admin: "adminThreadId",
  general: "generalThreadId",
} as const;

function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Check the form and try again.";
}

export async function setChatEnabledAction(
  input: unknown,
): Promise<ChatActionResult> {
  await assertSession();
  const parsed = toggleChatSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: firstIssue(parsed.error) };

  try {
    await prisma.telegramChat.update({
      where: { id: parsed.data.id },
      data: { enabled: parsed.data.enabled },
    });
    revalidatePath("/chats");
    return { ok: true };
  } catch {
    return { ok: false, message: "That group no longer exists. Reload the page." };
  }
}

export async function setChatTopicAction(
  input: unknown,
): Promise<ChatActionResult> {
  await assertSession();
  const parsed = topicSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: firstIssue(parsed.error) };

  try {
    await prisma.telegramChat.update({
      where: { id: parsed.data.id },
      data: { [PURPOSE_COLUMN[parsed.data.purpose]]: parsed.data.threadId },
    });
    revalidatePath("/chats");
    return { ok: true };
  } catch {
    return { ok: false, message: "That group no longer exists. Reload the page." };
  }
}

export async function deleteChatAction(
  input: unknown,
): Promise<ChatActionResult> {
  await assertSession();
  const parsed = z.object({ id: z.string().min(1) }).safeParse(input);
  if (!parsed.success) return { ok: false, message: firstIssue(parsed.error) };

  try {
    await prisma.telegramChat.delete({ where: { id: parsed.data.id } });
    revalidatePath("/chats");
    return { ok: true };
  } catch {
    return { ok: false, message: "That group no longer exists. Reload the page." };
  }
}

// ------------------------------------------------------------ forum topics

/**
 * Creates the three topics in the group and stores their ids.
 *
 * The Bot API has no way to *list* a forum's topics — createForumTopic and
 * friends exist, getForumTopics does not — so there is no select to fill from
 * what already exists. Creating them is the one path that ends with the right
 * ids and no copying of topic links by hand.
 *
 * Only fills the purposes that are still unset, so pressing it twice does not
 * litter the group with duplicates.
 */
const TOPIC_PLAN = [
  { purpose: "request", column: "requestThreadId", name: "Request", iconColor: 7322096 },
  { purpose: "admin", column: "adminThreadId", name: "Approval", iconColor: 16478047 },
  { purpose: "general", column: "generalThreadId", name: "General", iconColor: 9367192 },
] as const;

const createTopicsSchema = z.object({
  id: z.string().min(1, "Pick a group first."),
});

export async function createForumTopicsAction(
  input: unknown,
): Promise<ChatActionResult> {
  await assertSession();
  const parsed = createTopicsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: firstIssue(parsed.error) };

  const chat = await prisma.telegramChat.findUnique({
    where: { id: parsed.data.id },
  });
  if (!chat) {
    return { ok: false, message: "That group no longer exists. Reload the page." };
  }

  const chatId = chat.chatId.toString();

  const info = await callTelegram<{ is_forum?: boolean }>("getChat", {
    chat_id: chatId,
  });
  if (!info.ok) {
    return { ok: false, message: `Telegram refused: ${info.description}` };
  }
  if (!info.result.is_forum) {
    return {
      ok: false,
      message:
        "This group is not a forum. Turn Topics on in the group settings, then try again.",
    };
  }

  const missing = TOPIC_PLAN.filter((plan) => chat[plan.column] === null);
  if (missing.length === 0) {
    return { ok: false, message: "All three topics are already set." };
  }

  const data: Record<string, number> = {};
  for (const plan of missing) {
    const created = await callTelegram<{ message_thread_id: number }>(
      "createForumTopic",
      { chat_id: chatId, name: plan.name, icon_color: plan.iconColor },
    );

    if (!created.ok) {
      // Save whatever did get made, so a retry does not duplicate them.
      if (Object.keys(data).length > 0) {
        await prisma.telegramChat.update({ where: { id: chat.id }, data });
        revalidatePath("/chats");
      }
      return {
        ok: false,
        message: /rights/i.test(created.description)
          ? "The bot cannot manage topics. Give it the “Manage topics” admin right in the group."
          : `Telegram refused: ${created.description}`,
      };
    }

    data[plan.column] = created.result.message_thread_id;
  }

  await prisma.telegramChat.update({ where: { id: chat.id }, data });
  revalidatePath("/chats");
  return { ok: true };
}
