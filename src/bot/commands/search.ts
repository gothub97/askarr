import { MediaKind } from "@prisma/client";
import { Composer } from "grammy";
import { escapeHtml } from "../../lib/telegram/notify";
import { canRequest } from "../../lib/rbac";
import { createDraft, searchMedia } from "../../lib/requests";
import { resultsKeyboard } from "../keyboards/request";
import { noResults, resultsList } from "../render";
import { type AskarrContext, replyHtml } from "../handlers/context";

/** Long enough for any real title, short enough to keep the lookup sane. */
const MAX_TERM_LENGTH = 100;

/**
 * Asking beats printing a usage line. The prompts double as the marker that
 * tells the reply listener which kind of search the answer belongs to, so
 * these two strings must stay in sync with nothing else.
 */
const PROMPTS: Record<MediaKind, string> = {
  [MediaKind.MOVIE]: "Which movie? Reply to this message with the title.",
  [MediaKind.SERIES]: "Which show? Reply to this message with the title.",
};

export const searchCommands = new Composer<AskarrContext>();

searchCommands.command("movie", async (ctx) => {
  await handleSearchCommand(ctx, MediaKind.MOVIE);
});

searchCommands.command("series", async (ctx) => {
  await handleSearchCommand(ctx, MediaKind.SERIES);
});

/**
 * Privacy mode hides plain group chatter from the bot but still delivers
 * replies to its own messages, which is exactly what the prompt relies on.
 */
searchCommands.on("message:text", async (ctx, next) => {
  const repliedTo = ctx.message.reply_to_message;
  if (!repliedTo || repliedTo.from?.id !== ctx.me.id) return next();

  const kind = kindForPrompt(repliedTo.text);
  if (!kind) return next();

  const term = ctx.message.text.trim();
  // A command in the reply box means they changed their mind; let it route.
  if (!term || term.startsWith("/")) return next();

  await runSearch(ctx, kind, term);
});

async function handleSearchCommand(ctx: AskarrContext, kind: MediaKind) {
  const term = typeof ctx.match === "string" ? ctx.match.trim() : "";

  if (!term) {
    await replyHtml(ctx, PROMPTS[kind], {
      reply_markup: {
        force_reply: true,
        selective: true,
        input_field_placeholder: `${kind === MediaKind.MOVIE ? "Movie" : "Show"} title`,
      },
      ...(ctx.message
        ? { reply_parameters: { message_id: ctx.message.message_id } }
        : {}),
    });
    return;
  }

  await runSearch(ctx, kind, term);
}

async function runSearch(ctx: AskarrContext, kind: MediaKind, rawTerm: string) {
  const { user, threadId } = ctx.askarr;

  // A blocked member gets no signal that the bot is even listening.
  if (!canRequest(user)) {
    console.log(`[askarr] blocked user ${user.telegramId} tried to search`);
    return;
  }

  const term = rawTerm.slice(0, MAX_TERM_LENGTH);
  const outcome = await searchMedia(kind, term);

  if (!outcome.ok) {
    await replyHtml(ctx, escapeHtml(outcome.error ?? "The search failed. Try again in a moment."));
    return;
  }

  if (outcome.results.length === 0) {
    await replyHtml(ctx, noResults(kind, term));
    return;
  }

  const chat = ctx.chat;
  if (!chat) return;

  const draft = await createDraft({
    telegramUserId: user.id,
    chatId: BigInt(chat.id),
    threadId,
    // The asker's own message, so later pings can reply to it.
    messageId: ctx.message?.message_id ?? null,
    kind,
    results: outcome.results,
  });

  await replyHtml(ctx, resultsList(kind, term, outcome.results), {
    reply_markup: resultsKeyboard(draft.id, outcome.results),
  });
}

function kindForPrompt(text: string | undefined): MediaKind | null {
  if (!text) return null;
  if (text === PROMPTS[MediaKind.MOVIE]) return MediaKind.MOVIE;
  if (text === PROMPTS[MediaKind.SERIES]) return MediaKind.SERIES;
  return null;
}
