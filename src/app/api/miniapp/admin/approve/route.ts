import { NextResponse } from "next/server";
import { z } from "zod";
import type { AdminActionDto } from "@/app/miniapp/types";
import { prisma } from "@/lib/prisma";
import { approveRequest, telegramApprover } from "@/lib/requests";
import { statusSentence } from "@/lib/status";
import {
  miniAppBadRequest,
  requireMiniAppAdmin,
} from "@/lib/telegram/miniapp-auth";
import { escapeHtml, sendReplyOrMention } from "@/lib/telegram/notify";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  mediaItemId: z.string().min(1).max(64),
});

/**
 * Approve one queued title. The role is re-read from the database inside
 * requireMiniAppAdmin on every call — a client claiming ADMIN gets nowhere.
 */
export async function POST(request: Request): Promise<Response> {
  return requireMiniAppAdmin(request, async (admin) => {
    const raw: unknown = await request.json().catch(() => null);
    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) {
      return miniAppBadRequest("That request could not be identified.");
    }

    // The approver comes from Telegram, not the back office; the tag keeps the
    // two identity spaces out of each other's way in Subscription.approvedById.
    const outcome = await approveRequest(
      parsed.data.mediaItemId,
      telegramApprover(admin.id),
    );
    if (!outcome.ok) {
      const body: AdminActionDto = { ok: false, message: outcome.message };
      return NextResponse.json(body, { status: 409 });
    }

    await notifyRequesters(
      parsed.data.mediaItemId,
      // notify.ts sends HTML; a title carrying & or < would break the message.
      statusSentence(outcome.mediaItem.status, escapeHtml(outcome.mediaItem.title)),
    );

    const body: AdminActionDto = {
      ok: true,
      status: outcome.mediaItem.status,
      message: `${outcome.mediaItem.title} approved.`,
    };
    return NextResponse.json(body);
  });
}

/**
 * Tells everyone who asked for the title. A delivery failure — someone blocked
 * the bot, a group was deleted — must never undo an approval that already
 * reached Radarr/Sonarr, so every send is best-effort.
 */
async function notifyRequesters(
  mediaItemId: string,
  text: string,
): Promise<void> {
  const subscriptions = await prisma.subscription.findMany({
    where: { mediaItemId },
    include: { telegramUser: true },
  });

  await Promise.allSettled(
    subscriptions.map((sub) =>
      sendReplyOrMention({
        chatId: sub.chatId,
        threadId: sub.threadId,
        replyToMessageId: sub.messageId,
        text,
        telegramId: sub.telegramUser.telegramId,
        displayName: sub.telegramUser.displayName,
      }),
    ),
  );
}
