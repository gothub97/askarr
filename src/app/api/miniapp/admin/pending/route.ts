import { NextResponse } from "next/server";
import type { PendingListDto, PendingRequestDto } from "@/app/miniapp/types";
import { listPendingRequests } from "@/lib/requests";
import { requireMiniAppAdmin } from "@/lib/telegram/miniapp-auth";

export const dynamic = "force-dynamic";

/** The approval queue, oldest first: the longest wait is the one to clear. */
export async function GET(request: Request): Promise<Response> {
  return requireMiniAppAdmin(request, async () => {
    const items = await listPendingRequests();

    const pending: PendingRequestDto[] = items.map((item) => ({
      mediaItemId: item.id,
      kind: item.kind,
      externalId: item.externalId,
      title: item.title,
      year: item.year,
      overview: item.overview,
      posterUrl: item.posterUrl,
      instanceLabel: item.instance.label,
      monitorMode: item.monitorMode,
      statusReason: item.statusReason,
      requestedAt: item.createdAt.toISOString(),
      requesters: item.subscriptions.map((sub) => ({
        id: sub.telegramUser.id,
        displayName: sub.telegramUser.displayName,
        username: sub.telegramUser.username,
      })),
    }));

    const body: PendingListDto = { pending };
    return NextResponse.json(body);
  });
}
