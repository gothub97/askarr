import { prisma } from "./prisma";

/**
 * The channel between the web process and the bot process.
 *
 * They are separate containers in the Compose setup, and the bot deliberately
 * has no HTTP surface — it only makes outbound calls to Telegram. So the
 * database carries both directions: the bot writes a heartbeat, the back
 * office writes a restart request, and each polls for the other.
 *
 * Slower than a socket by a few seconds, which is irrelevant for "reconnect
 * the bot", and it costs no new port, no auth, and nothing to wire in Compose.
 * It also survives either side restarting, which a socket would not.
 */

const RUNTIME_KEY = "bot_runtime";
const RESTART_KEY = "bot_restart_request";

/** A heartbeat older than this means nobody is home. */
export const HEARTBEAT_STALE_MS = 20_000;

export type BotRuntimeState =
  | "polling"
  | "starting"
  | "token_rejected"
  | "no_token"
  | "unreachable"
  | "stopped";

export interface BotRuntime {
  state: BotRuntimeState;
  /** ISO timestamp of the last heartbeat. */
  at: string;
  username: string | null;
  displayName: string | null;
  botId: string | null;
  /** Token version the process is running, so the UI can spot a pending reload. */
  tokenVersion: number;
  /** Operator-facing explanation for the unhappy states. */
  detail: string | null;
}

export interface BotStatus {
  runtime: BotRuntime | null;
  /** False when the heartbeat is stale or absent: the process is not running. */
  alive: boolean;
  /** Milliseconds since the last heartbeat, or null if there has never been one. */
  ageMs: number | null;
}

function parseRuntime(value: unknown): BotRuntime | null {
  if (typeof value !== "object" || value === null) return null;
  const candidate = value as Partial<BotRuntime>;
  if (typeof candidate.state !== "string" || typeof candidate.at !== "string") {
    return null;
  }
  return {
    state: candidate.state as BotRuntimeState,
    at: candidate.at,
    username: candidate.username ?? null,
    displayName: candidate.displayName ?? null,
    botId: candidate.botId ?? null,
    tokenVersion: candidate.tokenVersion ?? 0,
    detail: candidate.detail ?? null,
  };
}

/** Called by the bot process. Never throws: a lost heartbeat must not stop it. */
export async function writeHeartbeat(
  runtime: Omit<BotRuntime, "at">,
): Promise<void> {
  const value = { ...runtime, at: new Date().toISOString() };
  try {
    await prisma.setting.upsert({
      where: { key: RUNTIME_KEY },
      create: { key: RUNTIME_KEY, value },
      update: { value },
    });
  } catch {
    // The database being briefly unreachable is not a reason to stop serving
    // Telegram. The back office will show the heartbeat as stale, which is
    // exactly what is true.
  }
}

export async function readBotStatus(): Promise<BotStatus> {
  const row = await prisma.setting.findUnique({ where: { key: RUNTIME_KEY } });
  const runtime = row ? parseRuntime(row.value) : null;
  if (!runtime) return { runtime: null, alive: false, ageMs: null };

  const ageMs = Date.now() - new Date(runtime.at).getTime();
  return {
    runtime,
    // "stopped" is written deliberately on shutdown, so trust it over the age.
    alive: runtime.state !== "stopped" && ageMs < HEARTBEAT_STALE_MS,
    ageMs,
  };
}

/**
 * Asks the bot to drop its connection and reconnect. Returns the stamp written,
 * which the caller can compare against later heartbeats to see it land.
 */
export async function requestBotRestart(): Promise<number> {
  const at = Date.now();
  await prisma.setting.upsert({
    where: { key: RESTART_KEY },
    create: { key: RESTART_KEY, value: { at } },
    update: { value: { at } },
  });
  return at;
}

/** Read by the bot process each tick. Returns the stamp of the latest request. */
export async function readRestartRequest(): Promise<number> {
  const row = await prisma.setting.findUnique({ where: { key: RESTART_KEY } });
  if (typeof row?.value !== "object" || row.value === null) return 0;
  const at = (row.value as { at?: unknown }).at;
  return typeof at === "number" ? at : 0;
}
