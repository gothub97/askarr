import type { TelegramUser } from "@prisma/client";
import { prisma } from "./prisma";

/** Quota counts requests made over a rolling 30-day window, not calendar months. */
export const QUOTA_WINDOW_DAYS = 30;

export function quotaWindowStart(now: Date = new Date()): Date {
  return new Date(now.getTime() - QUOTA_WINDOW_DAYS * 24 * 60 * 60 * 1000);
}

export interface QuotaState {
  /** 0 means unlimited. */
  limit: number;
  used: number;
  remaining: number;
  exceeded: boolean;
}

/** Counts Subscription rows created by this user inside the rolling window. */
export async function getQuotaState(
  user: Pick<TelegramUser, "id" | "quotaPerMonth">,
): Promise<QuotaState> {
  const limit = user.quotaPerMonth;
  if (limit <= 0) {
    return { limit: 0, used: 0, remaining: Number.POSITIVE_INFINITY, exceeded: false };
  }

  const used = await prisma.subscription.count({
    where: {
      telegramUserId: user.id,
      createdAt: { gte: quotaWindowStart() },
    },
  });

  return {
    limit,
    used,
    remaining: Math.max(0, limit - used),
    exceeded: used >= limit,
  };
}
