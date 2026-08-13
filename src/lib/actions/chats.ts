"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "../prisma";
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

const topicSchema = z.object({
  id: z.string().min(1, "Pick a group first."),
  // null pins the bot to the group's main thread.
  threadId: z
    .number()
    .int("A topic id is a whole number.")
    .positive("A topic id is a positive number.")
    .nullable(),
});

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
      data: { threadId: parsed.data.threadId },
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
