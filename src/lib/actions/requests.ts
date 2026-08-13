"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "../prisma";
import {
  approveRequest,
  rejectRequest,
  retryRequest,
  webApprover,
} from "../requests";
import { assertSession } from "./guard";

/**
 * Back-office wrappers around the request rules.
 *
 * The rules themselves live in src/lib/requests.ts so the bot and the back
 * office cannot drift apart; these only add the session check, input
 * validation and cache invalidation that a browser call needs.
 */

export interface RequestActionResult {
  ok: boolean;
  message?: string;
}

const targetSchema = z.object({
  mediaItemId: z.string().min(1, "Pick a request first."),
});

const rejectSchema = targetSchema.extend({
  // Free text shown back to the requester in Telegram, so keep it short.
  reason: z.string().trim().max(280).optional(),
});

function revalidateRequestViews(): void {
  revalidatePath("/requests");
  revalidatePath("/dashboard");
}

function firstIssue(error: z.ZodError, fallback: string): string {
  return error.issues[0]?.message ?? fallback;
}

export async function approveRequestAction(
  input: unknown,
): Promise<RequestActionResult> {
  const session = await assertSession();
  const parsed = targetSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: firstIssue(parsed.error, "Pick a request first.") };
  }

  // Tagged, because the bot writes TelegramUser ids into the same column and
  // approvedById has no relation to catch the two being confused.
  const outcome = await approveRequest(
    parsed.data.mediaItemId,
    webApprover(session.user.id),
  );
  revalidateRequestViews();
  return outcome.ok ? { ok: true } : { ok: false, message: outcome.message };
}

export async function rejectRequestAction(
  input: unknown,
): Promise<RequestActionResult> {
  await assertSession();
  const parsed = rejectSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: firstIssue(parsed.error, "Keep the reason under 280 characters."),
    };
  }

  try {
    await rejectRequest(parsed.data.mediaItemId, parsed.data.reason || null);
    revalidateRequestViews();
    return { ok: true };
  } catch {
    return { ok: false, message: "That request no longer exists. Reload the page." };
  }
}

export async function retryRequestAction(
  input: unknown,
): Promise<RequestActionResult> {
  await assertSession();
  const parsed = targetSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: firstIssue(parsed.error, "Pick a request first.") };
  }

  const outcome = await retryRequest(parsed.data.mediaItemId);
  revalidateRequestViews();
  return outcome.ok ? { ok: true } : { ok: false, message: outcome.message };
}

/**
 * Drops the request and every subscription hanging off it. Nothing is removed
 * from Radarr or Sonarr: deleting here only forgets that Askarr asked for it.
 */
export async function deleteRequestAction(
  input: unknown,
): Promise<RequestActionResult> {
  await assertSession();
  const parsed = targetSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: firstIssue(parsed.error, "Pick a request first.") };
  }

  try {
    await prisma.mediaItem.delete({ where: { id: parsed.data.mediaItemId } });
    revalidateRequestViews();
    return { ok: true };
  } catch {
    return { ok: false, message: "That request no longer exists. Reload the page." };
  }
}
