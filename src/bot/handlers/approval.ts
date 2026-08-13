import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { isTelegramAdmin } from "../../lib/rbac";
import {
  approveRequest,
  rejectRequest,
  telegramApprover,
} from "../../lib/requests";
import { escapeHtml } from "../../lib/telegram/notify";
import type { CallbackPayload } from "../keyboards/callback";
import { approvedNotice, rejectedNotice, titleWithYearHtml } from "../render";
import type { AskarrContext } from "./context";
import { editCard } from "./flow";

const NOT_ADMIN = "Only an admin can settle this one.";
const GONE = "That request is gone. Nothing left to decide.";

/**
 * Approve / reject.
 *
 * The role comes from the TelegramUser the guard just loaded out of the
 * database for this very update, never from the button: anyone in the group
 * can tap it, and a message can outlive the role that put it there.
 */
export async function handleApproval(
  ctx: AskarrContext,
  payload: CallbackPayload,
) {
  const admin = ctx.askarr.user;
  if (!isTelegramAdmin(admin)) {
    await ctx.answerCallbackQuery({ text: NOT_ADMIN, show_alert: true });
    return;
  }

  const item = await prisma.mediaItem.findUnique({
    where: { id: payload.id },
    select: { id: true, title: true, year: true },
  });
  if (!item) {
    await ctx.answerCallbackQuery({ text: GONE, show_alert: true });
    return;
  }

  if (payload.action === "ap") {
    // Tagged, because approvedById also receives web User ids from the back
    // office and the column has no relation to catch a mix-up.
    const outcome = await approveRequest(item.id, telegramApprover(admin.id));
    if (!outcome.ok) {
      await editCard(
        ctx,
        [
          `${titleWithYearHtml(item.title, item.year)} could not be sent through.`,
          escapeHtml(outcome.message),
        ].join("\n"),
        null,
        null,
      );
      return;
    }
    await editCard(
      ctx,
      approvedNotice({
        title: outcome.mediaItem.title,
        year: outcome.mediaItem.year,
        adminTelegramId: admin.telegramId,
        adminName: admin.displayName,
      }),
      null,
      null,
    );
    return;
  }

  try {
    const rejected = await rejectRequest(item.id, `Rejected by ${admin.displayName}`);
    await editCard(
      ctx,
      rejectedNotice({
        title: rejected.title,
        year: rejected.year,
        adminTelegramId: admin.telegramId,
        adminName: admin.displayName,
      }),
      null,
      null,
    );
  } catch (error) {
    // Deleted between the read above and the write; nothing to reflect.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      await ctx.answerCallbackQuery({ text: GONE, show_alert: true });
      return;
    }
    throw error;
  }
}
