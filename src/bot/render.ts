import { AudioVersion, MediaKind, type MediaStatus } from "@prisma/client";
import type { LookupResult } from "../lib/servarr/types";
import { statusLabel, statusSentence } from "../lib/status";
import { escapeHtml, mention } from "../lib/telegram/notify";
import type { SubmitOutcome } from "../lib/requests";

/**
 * Every string the bot shows a human is built here, in HTML parse mode.
 * Markdown is never an option: titles are full of underscores, brackets and
 * asterisks that would silently break the message or swallow characters.
 */

export const OVERVIEW_LIMIT = 300;

/** Telegram truncates long button labels itself; keeping them short is kinder. */
const BUTTON_LABEL_LIMIT = 60;

/** Collapses whitespace and cuts on a word boundary rather than mid-word. */
export function truncate(text: string, limit = OVERVIEW_LIMIT): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= limit) return clean;

  const cut = clean.slice(0, limit);
  const lastSpace = cut.lastIndexOf(" ");
  // Scripts without spaces (and single very long tokens) get a hard cut.
  const body = lastSpace > limit * 0.6 ? cut.slice(0, lastSpace) : cut;
  return `${body.replace(/[\s.,;:!?—-]+$/, "")}…`;
}

/** `Title (2021)`, or just the title when the year is unknown. */
export function titleWithYear(
  title: string,
  year: number | null | undefined,
): string {
  return year ? `${title} (${year})` : title;
}

export function titleWithYearHtml(
  title: string,
  year: number | null | undefined,
): string {
  return `<b>${escapeHtml(titleWithYear(title, year))}</b>`;
}

export function buttonLabel(result: Pick<LookupResult, "title" | "year">): string {
  const label = titleWithYear(result.title, result.year);
  return label.length > BUTTON_LABEL_LIMIT
    ? `${label.slice(0, BUTTON_LABEL_LIMIT - 1)}…`
    : label;
}

const KIND_NOUN: Record<MediaKind, string> = {
  [MediaKind.MOVIE]: "movie",
  [MediaKind.SERIES]: "show",
};

export function kindNoun(kind: MediaKind): string {
  return KIND_NOUN[kind];
}

// ------------------------------------------------------------------ search

export function resultsList(
  kind: MediaKind,
  term: string,
  results: LookupResult[],
): string {
  const lines = results.map(
    (result, index) =>
      `${index + 1}. ${titleWithYearHtml(result.title, result.year)}`,
  );
  return [
    `Found these for <b>${escapeHtml(term)}</b>:`,
    "",
    ...lines,
    "",
    `Tap the ${kindNoun(kind)} you meant.`,
  ].join("\n");
}

export function noResults(kind: MediaKind, term: string): string {
  return [
    `Nothing matched <b>${escapeHtml(term)}</b>.`,
    `Try the original ${kindNoun(kind)} title, or add the year.`,
  ].join(" ");
}

// -------------------------------------------------------------- media card

export interface CardSource {
  title: string;
  year: number | null;
  overview: string | null;
}

/** The detail card the result list is edited into, plus any step question. */
export function mediaCard(source: CardSource, question?: string): string {
  const parts = [titleWithYearHtml(source.title, source.year)];
  if (source.overview?.trim()) {
    parts.push("", escapeHtml(truncate(source.overview)));
  }
  if (question) parts.push("", question);
  return parts.join("\n");
}

/**
 * A text message cannot be edited into a photo message, so the poster rides
 * along as an explicit link preview pinned above the text.
 */
export function posterPreview(posterUrl: string | null) {
  return posterUrl
    ? { url: posterUrl, prefer_large_media: true, show_above_text: true }
    : { is_disabled: true };
}

export function versionQuestion(): string {
  return "Which audio version do you want?";
}

export function monitorQuestion(latestSeason: number | null): string {
  return latestSeason
    ? `The whole run, or just season ${latestSeason}?`
    : "The whole run, or just the current season?";
}

export function confirmQuestion(
  version: AudioVersion | null,
  monitor: string | null,
): string {
  const bits: string[] = [];
  if (version) bits.push(version === AudioVersion.VO ? "original audio" : "multi audio");
  if (monitor) bits.push(monitor === "all" ? "full series" : "current season");
  return bits.length
    ? `Sending as <b>${escapeHtml(bits.join(", "))}</b>. Ready?`
    : "Ready?";
}

// ----------------------------------------------------------------- outcomes

/** `null` means say nothing at all — the only correct answer for a block. */
export function renderOutcome(
  outcome: SubmitOutcome,
  fallbackTitle: string,
): string | null {
  switch (outcome.kind) {
    case "queued":
      return [
        `${titleWithYearHtml(outcome.mediaItem.title, outcome.mediaItem.year)} is on the list.`,
        "Hunting for a release now — you will hear from me when it lands.",
      ].join("\n");

    case "pending":
      return [
        `${titleWithYearHtml(outcome.mediaItem.title, outcome.mediaItem.year)} needs an admin to wave it through.`,
        pendingReason(outcome.reason),
      ].join("\n");

    case "already_have":
      return [
        `${titleWithYearHtml(outcome.mediaItem.title, outcome.mediaItem.year)} is already in the library.`,
        "Go watch it.",
      ].join("\n");

    case "already_requested":
      return [
        `Someone got there first — ${titleWithYearHtml(outcome.mediaItem.title, outcome.mediaItem.year)} is already on the list.`,
        `You are on it too now, so you will get the ping. ${escapeHtml(
          statusLabel(outcome.status),
        )}.`,
      ].join("\n");

    case "duplicate":
      return [
        `You already asked for ${titleWithYearHtml(outcome.mediaItem.title, outcome.mediaItem.year)}.`,
        escapeHtml(statusSentence(outcome.status, outcome.mediaItem.title)),
      ].join("\n");

    // A blocked member gets no signal that anything happened.
    case "blocked":
      return null;

    case "error":
      return [
        `${escapeHtml(fallbackTitle)} did not go through.`,
        escapeHtml(outcome.message),
      ].join("\n");
  }
}

export function pendingReason(reason: "role" | "quota" | "full_series"): string {
  switch (reason) {
    case "quota":
      return "This month's quota is used up, so it goes to review.";
    case "full_series":
      return "Full series always go through review.";
    case "role":
      return "New members need a nod from an admin.";
  }
}

/** The ping dropped in the chat so admins can act without leaving Telegram. */
export function approvalPrompt(params: {
  requesterTelegramId: bigint;
  requesterName: string;
  title: string;
  year: number | null;
  reason: "role" | "quota" | "full_series";
}): string {
  return [
    `${mention(params.requesterTelegramId, params.requesterName)} wants ${titleWithYearHtml(
      params.title,
      params.year,
    )}.`,
    pendingReason(params.reason),
    "",
    "Admins: let it through, or turn it down.",
  ].join("\n");
}

export function approvedNotice(params: {
  title: string;
  year: number | null;
  adminTelegramId: bigint;
  adminName: string;
}): string {
  return [
    `${titleWithYearHtml(params.title, params.year)} approved by ${mention(
      params.adminTelegramId,
      params.adminName,
    )}.`,
    "Looking for a release now.",
  ].join("\n");
}

export function rejectedNotice(params: {
  title: string;
  year: number | null;
  adminTelegramId: bigint;
  adminName: string;
}): string {
  return `${titleWithYearHtml(params.title, params.year)} turned down by ${mention(
    params.adminTelegramId,
    params.adminName,
  )}.`;
}

// ------------------------------------------------------------------- lists

export interface RequestLineSource {
  mediaItem: {
    title: string;
    year: number | null;
    status: MediaStatus;
  };
}

export function requestLine(subscription: RequestLineSource): string {
  const { title, year, status } = subscription.mediaItem;
  return `• ${titleWithYearHtml(title, year)} — ${escapeHtml(statusLabel(status))}`;
}

export interface PendingLineSource {
  title: string;
  year: number | null;
  subscriptions: { telegramUser: { displayName: string } }[];
}

export function pendingLine(item: PendingLineSource): string {
  const asker = item.subscriptions[0]?.telegramUser.displayName;
  const who = asker ? ` — asked by ${escapeHtml(asker)}` : "";
  return `• ${titleWithYearHtml(item.title, item.year)}${who}`;
}
