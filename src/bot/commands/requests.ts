import { Composer } from "grammy";
import { listUserRequests } from "../../lib/requests";
import { requestLine } from "../render";
import { type AskarrContext, replyHtml } from "../handlers/context";

const HISTORY_SIZE = 10;

export const requestsCommand = new Composer<AskarrContext>();

requestsCommand.command("requests", async (ctx) => {
  const subscriptions = await listUserRequests(ctx.askarr.user.id, HISTORY_SIZE);

  if (subscriptions.length === 0) {
    await replyHtml(
      ctx,
      "Nothing on your list yet. Start one with /movie or /series.",
    );
    return;
  }

  await replyHtml(
    ctx,
    ["<b>Your latest requests</b>", "", ...subscriptions.map(requestLine)].join("\n"),
  );
});
