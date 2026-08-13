import { MediaKind, MediaStatus, type MediaItem } from "@prisma/client";
import { prisma } from "./prisma";
import { getAppSettings } from "./settings";
import { statusSentence } from "./status";
import { escapeHtml, sendReplyOrMention } from "./telegram/notify";
import { seasonNumbersFromRaw } from "./webhooks/schemas";

/**
 * Telling people their request landed.
 *
 * Two rules shape everything here.
 *
 * 1. One message per Subscription, in the chat that person asked from, as a
 *    reply to their own message. A MediaItem with four subscribers produces
 *    four messages, not one broadcast: the request was personal, so the answer
 *    is too.
 *
 * 2. Nobody is ever notified twice. Subscription.notifiedAt is the guard, and
 *    it is claimed before the message goes out, never after — see fanOut.
 *
 * ---------------------------------------------------------------- aggregation
 *
 * A season import fires one Download webhook per episode. Ten episodes must
 * produce one message, not ten, so a series notification waits for the burst
 * to go quiet: aggregationWindowMinutes with no further Download event for
 * that title.
 *
 * That pending state is DERIVED, not stored. The schema is owned elsewhere and
 * carries no "pending notification" table, and a Setting row holding a queue
 * would be a second source of truth to keep consistent with the events that
 * feed it. Instead the drain asks two questions the database already answers:
 *
 *   - when did the last Download event for this title arrive?  (ArrEvent)
 *   - is anyone still waiting to hear about it?                (notifiedAt)
 *
 * A title whose last event is older than the window and still has unnotified
 * subscribers is due. Nothing to write when an episode lands, nothing to clean
 * up, and a restart mid-window loses nothing because the events outlive the
 * process. The season numbers in the message are read back off the same rows.
 *
 * Because notifiedAt is one column and not one row per season, a subscriber
 * hears once about a given title — the first completed batch. That is the
 * "never twice" rule the spec asks for, and it is enforced by the schema.
 */

const DEFAULT_DRAIN_INTERVAL_MS = 60_000;

/** A drain is a tick, not a backfill; keep one pass bounded. */
const DRAIN_BATCH_SIZE = 100;
const MAX_EVENTS_PER_ITEM = 500;

export interface DrainResult {
  /** Candidates examined. */
  scanned: number;
  /** Titles whose window had elapsed. */
  flushed: number;
  /** Messages actually delivered. */
  notified: number;
}

// ------------------------------------------------------------------ messages

/** Titles are user data and go through escapeHtml before touching the markup. */
function titleHtml(item: Pick<MediaItem, "title" | "year">): string {
  const year = item.year ? ` (${item.year})` : "";
  return `<b>${escapeHtml(item.title)}${year}</b>`;
}

function listJoin(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/** "Season 2 is", "Seasons 1, 2 and 3 are", "Season 1 and Specials are". */
function seasonPhrase(seasons: number[]): string {
  // Season 0 is Sonarr's specials bucket and reads badly as "Season 0".
  const hasSpecials = seasons.includes(0);
  const numbered = seasons.filter((season) => season > 0);

  const parts: string[] = [];
  if (numbered.length === 1) parts.push(`Season ${numbered[0]}`);
  else if (numbered.length > 1) {
    parts.push(`Seasons ${listJoin(numbered.map(String))}`);
  }
  if (hasSpecials) parts.push("Specials");

  const plural = numbered.length + (hasSpecials ? 1 : 0) > 1;
  return `${listJoin(parts)} ${plural ? "are" : "is"}`;
}

export function availableMessage(
  item: Pick<MediaItem, "kind" | "title" | "year">,
  seasons: number[] = [],
): string {
  const subject = titleHtml(item);

  if (item.kind === MediaKind.SERIES && seasons.length > 0) {
    return `${subject} — ${seasonPhrase(seasons)} ready to watch.`;
  }
  // Falls back to the shared copy so the wording cannot drift from the UI.
  return statusSentence(MediaStatus.AVAILABLE, subject);
}

// ------------------------------------------------------------------- fan-out

/**
 * Sends one message per unnotified subscriber and returns how many went out.
 *
 * The claim happens before the send, in a single conditional UPDATE. Two drains
 * racing on the same title both read the row as unnotified, but only one
 * updateMany matches — the loser sees count 0 and sends nothing. Doing it the
 * other way round (send, then mark) would double-notify on a crash between the
 * two, which is the failure people actually notice.
 */
async function fanOut(mediaItemId: string, text: string): Promise<number> {
  const subscriptions = await prisma.subscription.findMany({
    where: { mediaItemId, notifiedAt: null },
    include: { telegramUser: true },
  });

  let sent = 0;
  for (const subscription of subscriptions) {
    const claim = await prisma.subscription.updateMany({
      where: { id: subscription.id, notifiedAt: null },
      data: { notifiedAt: new Date() },
    });
    if (claim.count === 0) continue; // someone else got there first

    // sendReplyOrMention falls back to a tg://user link when the message being
    // replied to was deleted. Never an @handle: not every member has one.
    const result = await sendReplyOrMention({
      chatId: subscription.chatId,
      threadId: subscription.threadId,
      replyToMessageId: subscription.messageId,
      text,
      telegramId: subscription.telegramUser.telegramId,
      displayName: subscription.telegramUser.displayName,
    });

    if (result.ok) {
      sent += 1;
      continue;
    }

    if (result.reason === "other") {
      // Transient (network, 5xx, rate limit): release the claim so the next
      // drain retries. "blocked" keeps it — that chat is gone for good and
      // retrying every minute forever only burns Bot API calls.
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: { notifiedAt: null },
      });
    }
  }

  return sent;
}

// ----------------------------------------------------------------- immediate

/**
 * Immediate fan-out, for a title that needs no grouping — a movie import.
 * Series go through the drain instead so their episodes can group.
 *
 * Never throws: callers are webhook handlers that must answer 200 regardless.
 */
export async function notifyMediaAvailable(mediaItemId: string): Promise<number> {
  try {
    const item = await prisma.mediaItem.findUnique({
      where: { id: mediaItemId },
      select: { id: true, kind: true, title: true, year: true },
    });
    if (!item) return 0;

    return await fanOut(item.id, availableMessage(item));
  } catch (error) {
    console.error("[notifications] immediate fan-out failed", error);
    return 0;
  }
}

// --------------------------------------------------------------------- drain

let inFlight: Promise<DrainResult> | null = null;

/**
 * Flushes every title whose aggregation window has elapsed.
 *
 * Idempotent and cheap enough to call opportunistically on each webhook hit:
 * a pass with nothing due is two indexed queries. Concurrent calls share the
 * one run rather than racing each other through the same rows.
 */
export function drainPendingNotifications(): Promise<DrainResult> {
  if (!inFlight) {
    inFlight = runDrain().finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

async function runDrain(): Promise<DrainResult> {
  const result: DrainResult = { scanned: 0, flushed: 0, notified: 0 };

  try {
    const { aggregationWindowMinutes } = await getAppSettings();
    const cutoff = new Date(Date.now() - aggregationWindowMinutes * 60_000);

    // Everything watchable that somebody is still waiting to hear about. This
    // also catches movies whose immediate send failed and subscribers who
    // joined an already-available title.
    const items = await prisma.mediaItem.findMany({
      where: {
        status: MediaStatus.AVAILABLE,
        subscriptions: { some: { notifiedAt: null } },
      },
      orderBy: { updatedAt: "asc" },
      take: DRAIN_BATCH_SIZE,
      select: { id: true, kind: true, title: true, year: true, updatedAt: true },
    });

    for (const item of items) {
      result.scanned += 1;

      const events = await prisma.arrEvent.findMany({
        where: { mediaItemId: item.id, eventType: "Download" },
        orderBy: { receivedAt: "asc" },
        take: MAX_EVENTS_PER_ITEM,
        select: { payload: true, receivedAt: true },
      });

      // No import event means the status came from somewhere else (an admin,
      // a backfill); the row's own timestamp is then the settle point.
      const lastEventAt = events.at(-1)?.receivedAt ?? item.updatedAt;
      if (lastEventAt > cutoff) continue; // still inside the window

      result.flushed += 1;

      const seasons = collectSeasons(events.map((event) => event.payload));
      result.notified += await fanOut(item.id, availableMessage(item, seasons));
    }
  } catch (error) {
    // A drain that throws must not take the interval or a webhook down with it.
    console.error("[notifications] drain failed", error);
  }

  return result;
}

function collectSeasons(payloads: unknown[]): number[] {
  const seasons = new Set<number>();
  for (const payload of payloads) {
    for (const season of seasonNumbersFromRaw(payload)) seasons.add(season);
  }
  return [...seasons].sort((a, b) => a - b);
}

// -------------------------------------------------------------------- driver

let timer: ReturnType<typeof setInterval> | null = null;

/**
 * Interval driver, for a long-lived process to call once at boot (the bot is
 * the natural host). Askarr ships no scheduler service, and the window has to
 * elapse even when no further webhook arrives to trigger an opportunistic
 * drain — the last episode of a season is exactly that case.
 *
 * Calling it twice is a no-op. Returns the stopper.
 */
export function startNotificationDrain(
  intervalMs: number = DEFAULT_DRAIN_INTERVAL_MS,
): () => void {
  if (timer) return stopNotificationDrain;

  timer = setInterval(() => {
    void drainPendingNotifications();
  }, intervalMs);

  return stopNotificationDrain;
}

export function stopNotificationDrain(): void {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
}
