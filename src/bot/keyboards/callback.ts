import { z } from "zod";
import type { SonarrMonitorMode } from "../../lib/servarr/types";

/**
 * Callback payloads are `a:<action>:<id>:<arg>` and must stay under 64 bytes,
 * which Telegram enforces by rejecting the whole message. Nothing variable
 * length ever goes in here: titles and URLs live in the RequestDraft row, and
 * the id is the only thing that travels.
 */

export const CALLBACK_PREFIX = "a";
export const MAX_CALLBACK_BYTES = 64;

export const CALLBACK_ACTIONS = [
  /** Pick a search result; arg is its index. */
  "p",
  /** Answer a step question; arg is the choice code. */
  "s",
  /** Confirm and submit; arg is the choice code. */
  "c",
  /** Drop the search. */
  "x",
  /** Request a title chosen through inline mode; id is <kind><externalId>. */
  "i",
  /** Admin approves a media item; id is the MediaItem id. */
  "ap",
  /** Admin rejects a media item; id is the MediaItem id. */
  "rj",
] as const;

export type CallbackAction = (typeof CALLBACK_ACTIONS)[number];

// cuid ids only, so anything else is a malformed or hand-crafted payload.
const payloadSchema = z.object({
  action: z.enum(CALLBACK_ACTIONS),
  id: z.string().regex(/^[a-z0-9]{1,32}$/i),
  arg: z.string().regex(/^[A-Za-z0-9._-]{0,12}$/),
});

export type CallbackPayload = z.infer<typeof payloadSchema>;

export function encodeCallback(payload: CallbackPayload): string {
  const data = `${CALLBACK_PREFIX}:${payload.action}:${payload.id}:${payload.arg}`;
  const bytes = Buffer.byteLength(data, "utf8");
  // Fail here rather than letting Telegram reject the whole keyboard at send.
  if (bytes > MAX_CALLBACK_BYTES) {
    throw new Error(
      `callback_data is ${bytes} bytes, over the ${MAX_CALLBACK_BYTES} byte limit: ${data}`,
    );
  }
  return data;
}

/** `null` for anything that is not ours or no longer matches the format. */
export function decodeCallback(data: string): CallbackPayload | null {
  const parts = data.split(":");
  if (parts.length !== 4 || parts[0] !== CALLBACK_PREFIX) return null;

  const parsed = payloadSchema.safeParse({
    action: parts[1],
    id: parts[2],
    arg: parts[3],
  });
  return parsed.success ? parsed.data : null;
}

// ------------------------------------------------------------------ choices

/**
 * The two answers gathered before submitting. They ride in `arg` as two
 * characters so the whole payload stays well under the byte limit even with a
 * cuid in the middle.
 *
 * The instance travels as its position in listInstancesForKind() rather than
 * its id: a cuid is 25 characters and would not fit beside the draft id in
 * Telegram's 64-byte callback_data. That caps the picker at 10 instances of a
 * kind, which is far past what a private group needs.
 */
export interface Choice {
  /** Index into listInstancesForKind(), not an instance id. */
  instanceIndex: number | null;
  monitor: Extract<SonarrMonitorMode, "all" | "lastSeason"> | null;
}

export const MAX_SELECTABLE_INSTANCES = 10;

export const EMPTY_CHOICE: Choice = { instanceIndex: null, monitor: null };

const CODE_TO_MONITOR: Record<string, Choice["monitor"]> = {
  a: "all",
  l: "lastSeason",
};

export function encodeChoice(choice: Choice): string {
  const instance =
    choice.instanceIndex === null ? "-" : String(choice.instanceIndex);
  const monitor = choice.monitor === "all" ? "a" : choice.monitor ? "l" : "-";
  return `${instance}${monitor}`;
}

export function decodeChoice(code: string): Choice | null {
  if (!/^[0-9-][al-]$/.test(code)) return null;
  return {
    instanceIndex: code[0] === "-" ? null : Number(code[0]),
    monitor: CODE_TO_MONITOR[code[1]] ?? null,
  };
}
