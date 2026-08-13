import { Composer } from "grammy";
import { isTelegramAdmin } from "../../lib/rbac";
import { type AskarrContext, replyHtml } from "../handlers/context";

export const helpCommand = new Composer<AskarrContext>();

helpCommand.command("help", async (ctx) => {
  const lines = [
    "<b>Askarr</b> — ask for a film or a show, right here.",
    "",
    "/movie <i>title</i> — find a film to add",
    "/series <i>title</i> — find a show to add",
    "/requests — what you asked for, and where it stands",
    "/app — open Askarr",
    "/help — this list",
  ];

  if (isTelegramAdmin(ctx.askarr.user)) {
    lines.push("/admin — the approval queue");
  }

  lines.push("", "Leave the title off and I will ask for it.");

  await replyHtml(ctx, lines.join("\n"));
});
