import { Prisma, type MediaItem } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import type { AdminActionDto } from "@/app/miniapp/types";
import { prisma } from "@/lib/prisma";
import { rejectRequest } from "@/lib/requests";
import { escapeHtml, sendReplyOrMention } from "@/lib/telegram/notify";
import {
  miniAppBadRequest,
  requireMiniAppAdmin,
} from "@/lib/telegram/miniapp-auth";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  mediaItemId: z.string().min(1).max(64),
  /** Optional: one-gesture reject sends none, the sheet can add one. */
  reason: z.string().trim().max(280).nullish(),
});

export async function POST(request: Request): Promise<Response> {
  return requireMiniAppAdmin(request, async () => {
    const raw: unknown = await request.json().catch(() => null);
    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) {
      return miniAppBadRequest("That request could not be identified.");
    }

    const reason = parsed.data.reason?.length ? parsed.data.reason : null;

    // Two admins clearing the same queue is normal. rejectRequest updates by
    // id and Prisma throws P2025 when the row has gone, which must read as
    // "already handled", not as a crash.
    let mediaItem: MediaItem;
    try {
      mediaItem = await rejectRequest(parsed.data.mediaItemId, reason);
    } catch (caught) {
      if (
        caught instanceof Prisma.PrismaClientKnownRequestError &&
        caught.code === "P2025"
      ) {
        const gone: AdminActionDto = {
          ok: false,
          message: "That request no longer exists.",
        };
        return NextResponse.json(gone, { status: 409 });
      }
      throw caught;
    }

    const subscriptions = await prisma.subscription.findMany({
      where: { mediaItemId: mediaItem.id },
      include: { telegramUser: true },
    });

    // Best-effort, like approve: a blocked bot must not fail the rejection.
    await Promise.allSettled(
      subscriptions.map((sub) =>
        sendReplyOrMention({
          chatId: sub.chatId,
          threadId: sub.threadId,
          replyToMessageId: sub.messageId,
          // notify.ts sends HTML, so anything an admin typed must be escaped.
          text: reason
            ? `${escapeHtml(mediaItem.title)} was rejected: ${escapeHtml(reason)}`
            : `${escapeHtml(mediaItem.title)} was rejected.`,
          telegramId: sub.telegramUser.telegramId,
          displayName: sub.telegramUser.displayName,
        }),
      ),
    );

    const body: AdminActionDto = {
      ok: true,
      status: mediaItem.status,
      message: `${mediaItem.title} rejected.`,
    };
    return NextResponse.json(body);
  });
}
