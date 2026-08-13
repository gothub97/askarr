import { Composer } from "grammy";
import { decodeCallback } from "../keyboards/callback";
import { handleApproval } from "./approval";
import type { AskarrContext } from "./context";
import { handleDraftAction } from "./flow";

const STALE_BUTTON =
  "That button is from an older message. Start again with /movie or /series.";

export const callbacks = new Composer<AskarrContext>();

callbacks.on("callback_query:data", async (ctx) => {
  try {
    const payload = decodeCallback(ctx.callbackQuery.data);
    if (!payload) {
      await ctx.answerCallbackQuery({ text: STALE_BUTTON, show_alert: true });
      return;
    }

    if (payload.action === "ap" || payload.action === "rj") {
      await handleApproval(ctx, payload);
      return;
    }

    await handleDraftAction(ctx, payload);
  } finally {
    // Telegram keeps the client spinner running until the query is answered,
    // so this has to happen even when the handler above threw. A second
    // answer for an already-answered query is rejected and safely ignored.
    await ctx.answerCallbackQuery().catch(() => undefined);
  }
});
