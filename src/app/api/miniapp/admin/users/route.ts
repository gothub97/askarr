import { TelegramRole, type TelegramUser } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import type { AdminUserDto, AdminUserListDto } from "@/app/miniapp/types";
import { prisma } from "@/lib/prisma";
import { quotaWindowStart } from "@/lib/quota";
import {
  miniAppBadRequest,
  requireMiniAppAdmin,
} from "@/lib/telegram/miniapp-auth";

export const dynamic = "force-dynamic";

/** Enough for a private group; the Mini App is not a directory browser. */
const USER_LIMIT = 200;

const patchSchema = z
  .object({
    telegramUserId: z.string().min(1).max(64),
    role: z
      .enum([
        TelegramRole.BLOCKED,
        TelegramRole.GUEST,
        TelegramRole.TRUSTED,
        TelegramRole.ADMIN,
      ])
      .optional(),
    /** 0 means unlimited. */
    quotaPerMonth: z.number().int().min(0).max(1000).optional(),
  })
  .refine((body) => body.role !== undefined || body.quotaPerMonth !== undefined, {
    message: "Nothing to change.",
  });

// -------------------------------------------------------------------- list

export async function GET(request: Request): Promise<Response> {
  return requireMiniAppAdmin(request, async (admin) => {
    const users = await prisma.telegramUser.findMany({
      orderBy: [{ role: "asc" }, { displayName: "asc" }],
      take: USER_LIMIT,
    });

    // One grouped count instead of N queries; the quota window is the same for
    // everyone, so a single aggregate covers the whole list.
    const counts = await prisma.subscription.groupBy({
      by: ["telegramUserId"],
      where: { createdAt: { gte: quotaWindowStart() } },
      _count: { _all: true },
    });
    const usedBy = new Map(
      counts.map((row) => [row.telegramUserId, row._count._all]),
    );

    const body: AdminUserListDto = {
      users: users.map((user) => toDto(user, usedBy.get(user.id) ?? 0, admin.id)),
    };
    return NextResponse.json(body);
  });
}

// ------------------------------------------------------------------- patch

/** POST rather than PATCH: Telegram WebViews are happier with the simple verbs. */
export async function POST(request: Request): Promise<Response> {
  return requireMiniAppAdmin(request, async (admin) => {
    const raw: unknown = await request.json().catch(() => null);
    const parsed = patchSchema.safeParse(raw);
    if (!parsed.success) {
      return miniAppBadRequest("That change is not one Askarr can apply.");
    }
    const { telegramUserId, role, quotaPerMonth } = parsed.data;

    // Demoting yourself would lock you out of this very screen, and the last
    // admin leaving would lock out the whole group. Refuse both here.
    if (telegramUserId === admin.id && role !== undefined && role !== TelegramRole.ADMIN) {
      return miniAppBadRequest("You cannot change your own role.");
    }

    const target = await prisma.telegramUser.findUnique({
      where: { id: telegramUserId },
    });
    if (!target) {
      return miniAppBadRequest("That person is no longer in Askarr.");
    }

    const updated = await prisma.telegramUser.update({
      where: { id: telegramUserId },
      data: {
        ...(role !== undefined ? { role } : {}),
        ...(quotaPerMonth !== undefined ? { quotaPerMonth } : {}),
      },
    });

    const used = await prisma.subscription.count({
      where: {
        telegramUserId: updated.id,
        createdAt: { gte: quotaWindowStart() },
      },
    });

    return NextResponse.json({ user: toDto(updated, used, admin.id) });
  });
}

function toDto(
  user: TelegramUser,
  usedThisWindow: number,
  callerId: string,
): AdminUserDto {
  return {
    id: user.id,
    // Telegram ids overflow a JSON number; always a string on the wire.
    telegramId: user.telegramId.toString(),
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    quotaPerMonth: user.quotaPerMonth,
    usedThisWindow,
    createdAt: user.createdAt.toISOString(),
    isSelf: user.id === callerId,
  };
}
