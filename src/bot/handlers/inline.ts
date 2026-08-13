import { MediaKind, TelegramRole, type TelegramChat } from "@prisma/client";
import { Composer, InlineKeyboard } from "grammy";
import type { InlineQueryResultArticle } from "grammy/types";
import { prisma } from "../../lib/prisma";
import {
  createDraft,
  getSearchInstance,
  searchMedia,
  setDraftSelection,
} from "../../lib/requests";
import { lookupByExternalId } from "../../lib/servarr";
import type { LookupResult } from "../../lib/servarr/types";
import { decodeCallback, encodeCallback } from "../keyboards/callback";
import { kindNoun, mediaCard, posterPreview, titleWithYear, truncate } from "../render";
import type { AskarrContext } from "./context";
import { editCard, handleDraftAction } from "./flow";

/**
 * Inline mode: typing `@askarr dune` anywhere instead of `/movie dune`.
 *
 * This composer runs ahead of the guard, because neither an inline query nor a
 * callback on an inline-posted message carries a chat. The guard's whole job is
 * to check the chat against TelegramChat, and it correctly drops anything
 * without one — so inline has to bring its own gate.
 *
 * That gate is identity, not chat: only someone already known to Askarr, from
 * having spoken in an allowed group, gets results. Telegram offers inline
 * results in *every* conversation the person is in, including ones Askarr
 * knows nothing about, so a stranger who guesses the bot's name must get the
 * same silence they would get from an unknown group.
 */

const MAX_INLINE_RESULTS = 10;
const MIN_QUERY_LENGTH = 2;
/** Short: results depend on who is asking and on library state. */
const CACHE_SECONDS = 10;

/** Only ever shown on a button press, never to an inline query. */
const NOT_KNOWN =
  "Askarr does not know you yet. Say something in the group first.";
const NO_HOME_CHAT =
  "I do not know which group to answer in. Start this one with /movie in the group.";
const GONE = "I could not find that one anymore. Try the search again.";

export const inline = new Composer<AskarrContext>();

// ------------------------------------------------------------------- query

inline.on("inline_query", async (ctx) => {
  const term = ctx.inlineQuery.query.trim();
  const from = ctx.from;

  // Never created here: creating a TelegramUser on an inline query would let
  // anyone who knows the bot's name enrol themselves without ever being in the
  // group. Membership starts in the group, not in a search box.
  const user = await prisma.telegramUser.findUnique({
    where: { telegramId: BigInt(from.id) },
  });

  // Silence, not an explanation. Inline results are offered in every chat the
  // person is in, so this is the same situation as a stranger adding the bot
  // to a random group: an empty list tells them nothing, while a hint would
  // name the product to anyone who guessed the username.
  if (!user || user.role === TelegramRole.BLOCKED) {
    await answerEmpty(ctx);
    return;
  }

  if (term.length < MIN_QUERY_LENGTH) {
    await answerEmpty(ctx);
    return;
  }

  // Both kinds at once: the requester knows the title, not which *arr holds it.
  const [movies, series] = await Promise.all([
    searchKind(MediaKind.MOVIE, term),
    searchKind(MediaKind.SERIES, term),
  ]);

  const results = interleave(movies, series)
    .slice(0, MAX_INLINE_RESULTS)
    .map(({ kind, result }) => toArticle(kind, result));

  await ctx.answerInlineQuery(results, {
    cache_time: CACHE_SECONDS,
    is_personal: true,
  });
});

async function searchKind(
  kind: MediaKind,
  term: string,
): Promise<{ kind: MediaKind; result: LookupResult }[]> {
  const outcome = await searchMedia(kind, term);
  if (!outcome.ok) return [];
  return outcome.results.map((result) => ({ kind, result }));
}

/** Alternates the two kinds so neither is pushed off the end of the list. */
function interleave<T>(a: T[], b: T[]): T[] {
  const out: T[] = [];
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    if (a[i]) out.push(a[i]);
    if (b[i]) out.push(b[i]);
  }
  return out;
}

function toArticle(
  kind: MediaKind,
  result: LookupResult,
): InlineQueryResultArticle {
  const description = result.overview
    ? `${kindNoun(kind)} · ${truncate(result.overview, 90)}`
    : kindNoun(kind);

  return {
    type: "article",
    // Telegram caps result ids at 64 bytes; kind letter plus the id is tiny.
    id: `${kindCode(kind)}${result.externalId}`,
    title: titleWithYear(result.title, result.year),
    description,
    ...(result.posterUrl ? { thumbnail_url: result.posterUrl } : {}),
    input_message_content: {
      message_text: mediaCard(result),
      parse_mode: "HTML",
      link_preview_options: posterPreview(result.posterUrl),
    },
    reply_markup: new InlineKeyboard().text(
      "Request",
      encodeCallback({
        action: "i",
        id: `${kindCode(kind)}${result.externalId}`,
        arg: "",
      }),
    ),
  };
}

function kindCode(kind: MediaKind): string {
  return kind === MediaKind.MOVIE ? "M" : "S";
}

async function answerEmpty(ctx: AskarrContext) {
  await ctx.answerInlineQuery([], {
    cache_time: CACHE_SECONDS,
    is_personal: true,
  });
}

// ---------------------------------------------------------------- callbacks

/**
 * Buttons on an inline-posted message.
 *
 * These updates carry `inline_message_id` and no chat at all, so the guard
 * drops them and they never reach the normal callback router. Every step of
 * the flow that follows the first tap is in the same position, which is why
 * this handles the whole set rather than just the opening "Request".
 */
inline.on("callback_query:data", async (ctx, next) => {
  if (!ctx.callbackQuery.inline_message_id) {
    // A button in a real chat: let the guard vet it as usual.
    await next();
    return;
  }

  try {
    const payload = decodeCallback(ctx.callbackQuery.data);
    if (!payload) return;

    if (payload.action === "i") {
      await startFromInline(ctx, payload.id);
      return;
    }

    // Later steps run the ordinary flow; it checks draft ownership itself.
    await handleDraftAction(ctx, payload);
  } finally {
    await ctx.answerCallbackQuery().catch(() => undefined);
  }
});

/** Turns the tapped result into a draft, then joins the normal flow. */
async function startFromInline(ctx: AskarrContext, id: string) {
  const kind = id.startsWith("M") ? MediaKind.MOVIE : MediaKind.SERIES;
  const externalId = Number(id.slice(1));
  const from = ctx.from;
  if (!from) return;

  if (!Number.isInteger(externalId) || externalId <= 0) {
    await ctx.answerCallbackQuery({ text: GONE, show_alert: true });
    return;
  }

  const user = await prisma.telegramUser.findUnique({
    where: { telegramId: BigInt(from.id) },
  });
  if (!user || user.role === TelegramRole.BLOCKED) {
    await ctx.answerCallbackQuery({ text: NOT_KNOWN, show_alert: true });
    return;
  }

  /*
   * An inline message has no chat, so there is nowhere to reply to. The
   * request is filed against the group the person belongs to, which is where
   * the "it landed" notification will go.
   */
  const home = await resolveHomeChat(user.id);
  if (!home) {
    await ctx.answerCallbackQuery({ text: NO_HOME_CHAT, show_alert: true });
    return;
  }

  const instance = await getSearchInstance(kind);
  if (!instance) {
    await editCard(ctx, noInstanceText(kind), null, null);
    return;
  }

  const selection = await lookupByExternalId(instance, externalId).catch(
    () => null,
  );
  if (!selection) {
    await ctx.answerCallbackQuery({ text: GONE, show_alert: true });
    return;
  }

  const draft = await createDraft({
    telegramUserId: user.id,
    chatId: home.chatId,
    threadId: home.threadId,
    // No reply target: the inline message is not addressable as one.
    messageId: null,
    kind,
    results: [selection],
  });
  await setDraftSelection(draft.id, 0);

  // "p" with index 0 is exactly "the requester picked this result".
  await handleDraftAction(ctx, { action: "p", id: draft.id, arg: "0" });
}

/**
 * Where an inline request belongs: the group this person last requested in,
 * or the only allowed group if they have never requested before.
 */
async function resolveHomeChat(
  telegramUserId: string,
): Promise<TelegramChat | null> {
  const last = await prisma.subscription.findFirst({
    where: { telegramUserId },
    orderBy: { createdAt: "desc" },
    select: { chatId: true },
  });

  if (last) {
    const chat = await prisma.telegramChat.findUnique({
      where: { chatId: last.chatId },
    });
    if (chat?.enabled) return chat;
  }

  const enabled = await prisma.telegramChat.findMany({
    where: { enabled: true },
    orderBy: { createdAt: "asc" },
    take: 2,
  });
  // With several groups and no history there is no defensible guess.
  return enabled.length === 1 ? enabled[0] : null;
}

function noInstanceText(kind: MediaKind): string {
  return kind === MediaKind.MOVIE
    ? "No Radarr instance is set up yet. Ask an admin to add one."
    : "No Sonarr instance is set up yet. Ask an admin to add one.";
}
