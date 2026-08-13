import { MediaKind, type MediaItem } from "@prisma/client";
import { prisma } from "../prisma";
import type { ArrWebhookPayload } from "./schemas";

/**
 * Tying an inbound event back to a MediaItem.
 *
 * The webhook carries no Askarr identifier, so the only handle is the external
 * id the instance knows the title by: tmdbId on Radarr, tvdbId on Sonarr. Both
 * live in MediaItem.externalId, unique per instance — which is why instanceId
 * is always part of the lookup: the same movie requested on two instances is
 * two MediaItems, and only the instance that fired the webhook owns this event.
 */

export interface ExternalRef {
  kind: MediaKind;
  externalId: number;
}

export function externalRef(payload: ArrWebhookPayload): ExternalRef | null {
  // Radarr sends 0 rather than omitting the field when it has no match.
  const tmdbId = payload.movie?.tmdbId;
  if (typeof tmdbId === "number" && tmdbId > 0) {
    return { kind: MediaKind.MOVIE, externalId: tmdbId };
  }

  const tvdbId = payload.series?.tvdbId;
  if (typeof tvdbId === "number" && tvdbId > 0) {
    return { kind: MediaKind.SERIES, externalId: tvdbId };
  }

  return null;
}

/**
 * The title the instance called it, straight out of the stored payload.
 *
 * Most events are for titles nobody requested through Askarr — someone added
 * them in Radarr directly — so there is no MediaItem to read a name from. The
 * payload has one anyway, and showing "Untracked title" instead of it throws
 * away the one thing that makes the activity list readable.
 */
export function payloadTitle(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const { movie, series } = payload as {
    movie?: { title?: unknown };
    series?: { title?: unknown };
  };
  const title = movie?.title ?? series?.title;
  return typeof title === "string" && title.trim() ? title.trim() : null;
}

/** Null when nothing matches: an admin may add titles the bot never requested. */
export async function correlateMediaItem(
  instanceId: string,
  payload: ArrWebhookPayload,
): Promise<MediaItem | null> {
  const ref = externalRef(payload);
  if (!ref) return null;

  return prisma.mediaItem.findUnique({
    where: {
      externalId_instanceId: { externalId: ref.externalId, instanceId },
    },
  });
}
