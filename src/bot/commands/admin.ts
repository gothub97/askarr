import { Composer } from "grammy";
import { isTelegramAdmin } from "../../lib/rbac";
import { countPendingRequests, listPendingRequests } from "../../lib/requests";
import { backOfficeKeyboard } from "../keyboards/request";
import { pendingLine } from "../render";
import { type AskarrContext, replyHtml } from "../handlers/context";

/** Enough to act on in a chat message; the rest belongs in the back office. */
const QUEUE_PREVIEW = 10;

export const adminCommand = new Composer<AskarrContext>();

adminCommand.command("admin", async (ctx) => {
  if (!isTelegramAdmin(ctx.askarr.user)) {
    await replyHtml(ctx, "That one is for admins.");
    return;
  }

  const [pending, total] = await Promise.all([
    listPendingRequests(QUEUE_PREVIEW),
    countPendingRequests(),
  ]);

  const lines =
    pending.length === 0
      ? ["<b>Approval queue</b>", "", "No requests waiting."]
      : [
          `<b>Approval queue</b> — ${total} waiting`,
          "",
          ...pending.map(pendingLine),
          ...(total > pending.length
            ? ["", `And ${total - pending.length} more in the back office.`]
            : []),
        ];

  const backOffice = process.env.NEXT_PUBLIC_APP_URL;
  await replyHtml(ctx, lines.join("\n"), {
    ...(backOffice ? { reply_markup: backOfficeKeyboard(backOffice) } : {}),
  });
});
