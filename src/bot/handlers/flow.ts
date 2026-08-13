import { AudioVersion, MediaKind } from "@prisma/client";
import { GrammyError, type InlineKeyboard } from "grammy";
import { z } from "zod";
import type { LookupResult } from "../../lib/servarr/types";
import {
  MAX_RESULTS,
  draftResults,
  getDraft,
  getInstanceForVersion,
  listInstancesForKind,
  setDraftSelection,
  submitRequest,
} from "../../lib/requests";
import {
  type CallbackPayload,
  type Choice,
  EMPTY_CHOICE,
  decodeChoice,
} from "../keyboards/callback";
import {
  approvalKeyboard,
  confirmKeyboard,
  monitorKeyboard,
  versionKeyboard,
} from "../keyboards/request";
import {
  approvalPrompt,
  confirmQuestion,
  mediaCard,
  monitorQuestion,
  posterPreview,
  renderOutcome,
  titleWithYear,
  versionQuestion,
} from "../render";
import type { AskarrContext } from "./context";

const NOT_YOURS = "This search is not yours, start your own with /movie.";
const EXPIRED = "That search expired. Start a fresh one with /movie or /series.";
const LOST_SELECTION = "I lost track of that one. Start again with /movie or /series.";

const indexSchema = z.coerce.number().int().min(0).max(MAX_RESULTS - 1);

type Draft = NonNullable<Awaited<ReturnType<typeof getDraft>>>;

/** Search-flow buttons: pick a result, answer a step, confirm, or cancel. */
export async function handleDraftAction(
  ctx: AskarrContext,
  payload: CallbackPayload,
) {
  const draft = await getDraft(payload.id);
  if (!draft) {
    await ctx.answerCallbackQuery({ text: EXPIRED, show_alert: true });
    // Strip the dead buttons so nobody keeps poking them.
    await stripKeyboard(ctx);
    return;
  }

  // In a group every button is clickable by everyone, so ownership is checked
  // against the draft rather than against who happens to see the message.
  const clickerId = ctx.from?.id;
  if (clickerId === undefined || draft.telegramUser.telegramId !== BigInt(clickerId)) {
    await ctx.answerCallbackQuery({ text: NOT_YOURS, show_alert: true });
    return;
  }

  const results = draftResults(draft);

  switch (payload.action) {
    case "x":
      await editCard(ctx, "Dropped it.", null, null);
      return;

    case "p": {
      const parsed = indexSchema.safeParse(payload.arg);
      const selection = parsed.success ? results[parsed.data] : undefined;
      if (!parsed.success || !selection) {
        await ctx.answerCallbackQuery({ text: LOST_SELECTION, show_alert: true });
        return;
      }
      await setDraftSelection(draft.id, parsed.data);
      await advance(ctx, draft, selection, EMPTY_CHOICE);
      return;
    }

    case "s":
    case "c": {
      const choice = decodeChoice(payload.arg);
      const selection =
        draft.selectedIndex === null ? undefined : results[draft.selectedIndex];
      if (!choice || !selection) {
        await ctx.answerCallbackQuery({ text: LOST_SELECTION, show_alert: true });
        return;
      }
      if (payload.action === "s") {
        await advance(ctx, draft, selection, choice);
        return;
      }
      await submit(ctx, draft, selection, choice);
      return;
    }

    default:
      return;
  }
}

/**
 * Walks the card forward one question at a time. Every step re-renders the
 * same card so the chat keeps one message per search instead of a trail.
 */
async function advance(
  ctx: AskarrContext,
  draft: Draft,
  selection: LookupResult,
  choice: Choice,
) {
  const instances = await listInstancesForKind(draft.kind);
  if (instances.length === 0) {
    await editCard(ctx, noInstanceText(draft.kind), null, null);
    return;
  }

  const versions = [...new Set(instances.map((instance) => instance.version))];

  // Only ask when there is genuinely something to choose between.
  if (choice.version === null) {
    if (versions.length > 1) {
      await editCard(
        ctx,
        mediaCard(selection, versionQuestion()),
        versionKeyboard(draft.id, choice, versions),
        selection.posterUrl,
      );
      return;
    }
    choice = { ...choice, version: versions[0] ?? AudioVersion.VO };
  }

  if (draft.kind === MediaKind.SERIES && choice.monitor === null) {
    await editCard(
      ctx,
      mediaCard(selection, monitorQuestion(selection.latestSeason)),
      monitorKeyboard(draft.id, choice),
      selection.posterUrl,
    );
    return;
  }

  await editCard(
    ctx,
    mediaCard(selection, confirmQuestion(choice.version, choice.monitor)),
    confirmKeyboard(draft.id, choice),
    selection.posterUrl,
  );
}

async function submit(
  ctx: AskarrContext,
  draft: Draft,
  selection: LookupResult,
  choice: Choice,
) {
  if (!choice.version) {
    await ctx.answerCallbackQuery({ text: LOST_SELECTION, show_alert: true });
    return;
  }

  const instance = await getInstanceForVersion(draft.kind, choice.version);
  if (!instance) {
    await editCard(
      ctx,
      "That version is not set up anymore. Ask an admin to check the instances.",
      null,
      null,
    );
    return;
  }

  const outcome = await submitRequest({
    telegramUser: draft.telegramUser,
    instance,
    kind: draft.kind,
    selection: {
      externalId: selection.externalId,
      title: selection.title,
      year: selection.year,
      overview: selection.overview,
      posterUrl: selection.posterUrl,
    },
    monitorMode: draft.kind === MediaKind.SERIES ? (choice.monitor ?? "all") : null,
    chatId: draft.chatId,
    threadId: draft.threadId,
    messageId: draft.messageId,
  });

  const text = renderOutcome(outcome, titleWithYear(selection.title, selection.year));
  // `blocked` renders to null: no edit, no ping, nothing at all.
  if (text === null) return;

  await editCard(ctx, text, null, selection.posterUrl);

  if (outcome.kind === "pending") {
    await pingAdmins(ctx, draft, outcome.mediaItem.id, {
      title: outcome.mediaItem.title,
      year: outcome.mediaItem.year,
      reason: outcome.reason,
    });
  }
}

/** Drops the approve/reject pair in the same chat and topic as the request. */
async function pingAdmins(
  ctx: AskarrContext,
  draft: Draft,
  mediaItemId: string,
  item: { title: string; year: number | null; reason: "role" | "quota" | "full_series" },
) {
  await ctx.api.sendMessage(
    draft.chatId.toString(),
    approvalPrompt({
      requesterTelegramId: draft.telegramUser.telegramId,
      requesterName: draft.telegramUser.displayName,
      title: item.title,
      year: item.year,
      reason: item.reason,
    }),
    {
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true },
      ...(draft.threadId !== null ? { message_thread_id: draft.threadId } : {}),
      reply_markup: approvalKeyboard(mediaItemId),
    },
  );
}

function noInstanceText(kind: MediaKind): string {
  return kind === MediaKind.MOVIE
    ? "No Radarr instance is set up yet. Ask an admin to add one."
    : "No Sonarr instance is set up yet. Ask an admin to add one.";
}

/**
 * Editing is best effort: the message may have been deleted, or the new
 * content may be byte-identical, and neither is worth surfacing to a person.
 */
export async function editCard(
  ctx: AskarrContext,
  text: string,
  keyboard: InlineKeyboard | null,
  posterUrl: string | null,
) {
  try {
    await ctx.editMessageText(text, {
      parse_mode: "HTML",
      link_preview_options: posterPreview(posterUrl),
      ...(keyboard ? { reply_markup: keyboard } : { reply_markup: undefined }),
    });
  } catch (error) {
    if (isIgnorableEditError(error)) return;
    throw error;
  }
}

async function stripKeyboard(ctx: AskarrContext) {
  try {
    await ctx.editMessageReplyMarkup({ reply_markup: undefined });
  } catch (error) {
    if (isIgnorableEditError(error)) return;
    throw error;
  }
}

function isIgnorableEditError(error: unknown): boolean {
  if (!(error instanceof GrammyError)) return false;
  const description = error.description.toLowerCase();
  return (
    description.includes("message is not modified") ||
    description.includes("message to edit not found") ||
    description.includes("message can't be edited")
  );
}
