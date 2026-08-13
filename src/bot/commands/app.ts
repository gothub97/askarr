import { Composer } from "grammy";
import { miniAppKeyboard } from "../keyboards/request";
import { type AskarrContext, replyHtml } from "../handlers/context";

export const appCommand = new Composer<AskarrContext>();

appCommand.command("app", async (ctx) => {
  const url = process.env.TELEGRAM_MINIAPP_URL;
  if (!url) {
    await replyHtml(
      ctx,
      "The app is not wired up yet. Ask an admin to set TELEGRAM_MINIAPP_URL.",
    );
    return;
  }

  await replyHtml(ctx, "Browse and track everything you asked for here.", {
    reply_markup: miniAppKeyboard(url),
  });
});
