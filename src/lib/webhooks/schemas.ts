import { z } from "zod";

/**
 * Shapes of the outbound webhooks Radarr and Sonarr send.
 *
 * Deliberately permissive. Both apps add fields between releases and send a
 * lot Askarr does not care about; rejecting an unknown field would turn a
 * cosmetic upstream change into a stream of failed deliveries, and Radarr
 * disables a webhook that keeps erroring. Every field is therefore optional
 * and unknown keys are dropped rather than refused.
 */

const movieSchema = z.object({
  /** The only correlation key on the Radarr side. */
  tmdbId: z.number().int().optional(),
  title: z.string().optional(),
  year: z.number().int().optional(),
});

const seriesSchema = z.object({
  /** The only correlation key on the Sonarr side. */
  tvdbId: z.number().int().optional(),
  title: z.string().optional(),
  year: z.number().int().optional(),
});

const episodeSchema = z.object({
  seasonNumber: z.number().int().optional(),
  episodeNumber: z.number().int().optional(),
  title: z.string().optional(),
});

export const arrWebhookSchema = z.object({
  eventType: z.string().optional(),
  instanceName: z.string().optional(),
  applicationUrl: z.string().optional(),
  movie: movieSchema.optional(),
  series: seriesSchema.optional(),
  /** Sonarr batches the episodes covered by one import into a single event. */
  episodes: z.array(episodeSchema).optional(),
  /**
   * True when the file replaces one already on disk. Both apps send it on
   * Download; it is what separates "it arrived" from "it got better".
   */
  isUpgrade: z.boolean().optional(),
});

export type ArrWebhookPayload = z.infer<typeof arrWebhookSchema>;

/** The events Askarr acts on. Everything else is recorded and ignored. */
export const HANDLED_EVENT_TYPES = [
  "Test",
  "Grab",
  "Download",
  "MovieAdded",
  "SeriesAdd",
] as const;

export type HandledEventType = (typeof HANDLED_EVENT_TYPES)[number];

export function isHandledEventType(value: string): value is HandledEventType {
  return (HANDLED_EVENT_TYPES as readonly string[]).includes(value);
}

/**
 * Pulls the event type out of a body that may not have survived validation.
 * A malformed payload still deserves a correctly labelled ArrEvent row.
 */
export function readEventType(raw: unknown): string {
  if (raw && typeof raw === "object") {
    const value = (raw as { eventType?: unknown }).eventType;
    if (typeof value === "string" && value.length > 0) return value;
  }
  return "Unknown";
}

/**
 * Season numbers touched by a stored payload, read defensively straight off
 * the Json column: the drain reads rows written by older versions of this
 * file and must not assume they parse.
 */
export function seasonNumbersFromRaw(raw: unknown): number[] {
  if (!raw || typeof raw !== "object") return [];
  const episodes = (raw as { episodes?: unknown }).episodes;
  if (!Array.isArray(episodes)) return [];

  const seasons = new Set<number>();
  for (const episode of episodes) {
    if (!episode || typeof episode !== "object") continue;
    const seasonNumber = (episode as { seasonNumber?: unknown }).seasonNumber;
    if (typeof seasonNumber === "number" && Number.isInteger(seasonNumber)) {
      seasons.add(seasonNumber);
    }
  }
  return [...seasons].sort((a, b) => a - b);
}
