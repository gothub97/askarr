import { AudioVersion } from "@prisma/client";
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
 */
export interface Choice {
  version: AudioVersion | null;
  monitor: Extract<SonarrMonitorMode, "all" | "lastSeason"> | null;
}

export const EMPTY_CHOICE: Choice = { version: null, monitor: null };

const VERSION_TO_CODE: Record<AudioVersion, string> = {
  [AudioVersion.VO]: "V",
  [AudioVersion.MULTI]: "M",
};

const CODE_TO_VERSION: Record<string, AudioVersion> = {
  V: AudioVersion.VO,
  M: AudioVersion.MULTI,
};

const CODE_TO_MONITOR: Record<string, Choice["monitor"]> = {
  a: "all",
  l: "lastSeason",
};

export function encodeChoice(choice: Choice): string {
  const version = choice.version ? VERSION_TO_CODE[choice.version] : "-";
  const monitor = choice.monitor === "all" ? "a" : choice.monitor ? "l" : "-";
  return `${version}${monitor}`;
}

export function decodeChoice(code: string): Choice | null {
  if (!/^[VM-][al-]$/.test(code)) return null;
  return {
    version: CODE_TO_VERSION[code[0]] ?? null,
    monitor: CODE_TO_MONITOR[code[1]] ?? null,
  };
}
