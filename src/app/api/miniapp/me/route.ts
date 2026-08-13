import { MediaKind } from "@prisma/client";
import { NextResponse } from "next/server";
import type { MeDto } from "@/app/miniapp/types";
import { getQuotaState } from "@/lib/quota";
import { canRequest, isTelegramAdmin } from "@/lib/rbac";
import { listInstancesForKind } from "@/lib/requests";
import { withTelegramUser } from "@/lib/telegram/miniapp-auth";

/** Authenticated per request through initData; nothing here is cacheable. */
export const dynamic = "force-dynamic";

/**
 * The first call the Mini App makes. It carries everything the shell needs to
 * draw itself: who you are, what you may do, and which version pickers are
 * worth showing at all.
 */
export async function GET(request: Request): Promise<Response> {
  return withTelegramUser(request, async (user) => {
    const [quota, movieInstances, seriesInstances] = await Promise.all([
      getQuotaState(user),
      listInstancesForKind(MediaKind.MOVIE),
      listInstancesForKind(MediaKind.SERIES),
    ]);

    const body: MeDto = {
      id: user.id,
      // BigInt does not survive JSON; Telegram ids are always strings on the wire.
      telegramId: user.telegramId.toString(),
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      isAdmin: isTelegramAdmin(user),
      canRequest: canRequest(user),
      quota: {
        limit: quota.limit,
        used: quota.used,
        // getQuotaState returns Infinity for "unlimited", which JSON turns into
        // null anyway. Being explicit keeps the client's type honest.
        remaining: Number.isFinite(quota.remaining) ? quota.remaining : null,
        exceeded: quota.exceeded,
      },
      instances: {
        [MediaKind.MOVIE]: movieInstances.map((i) => ({ id: i.id, label: i.label })),
        [MediaKind.SERIES]: seriesInstances.map((i) => ({ id: i.id, label: i.label })),
      },
    };

    return NextResponse.json(body);
  });
}
