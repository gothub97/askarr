import crypto from "node:crypto";
import { prisma } from "./prisma";

/**
 * The bot token, and the one place anything is allowed to read it.
 *
 * The token used to live only in TELEGRAM_BOT_TOKEN. It now lives in the
 * database so an admin can change it from the back office without editing a
 * file or rebuilding a container; the environment variable is kept as a seed
 * so a fresh install still boots with no UI visit.
 *
 * Everything that touches Telegram must come through here. Sending, and
 * validating Mini App initData, are both keyed on the token, so a reader stuck
 * on the old value does not fail loudly — it silently rejects every signature
 * the real bot produces.
 *
 * At rest the token is encrypted. It is the one credential that grants control
 * of the identity people talk to: with it, someone can read the group's
 * messages and speak as Askarr. (Radarr and Sonarr API keys sit in plaintext in
 * ArrInstance, which is the schema the brief specifies — worth revisiting, but
 * not something to change quietly here.)
 */

const TOKEN_KEY = "bot_token";

/** Shape stored in Setting.value. Versioned so the format can move later. */
interface StoredToken {
  format: 1;
  iv: string;
  ciphertext: string;
  tag: string;
  /** Bumped on every write. The bot process watches this to know to reload. */
  version: number;
  updatedAt: string;
}

export type BotTokenSource = "database" | "environment" | "missing";

export interface BotTokenState {
  source: BotTokenSource;
  /** Non-null only when the token came from the database. */
  version: number | null;
  updatedAt: string | null;
  /** Last 4 characters, so an admin can tell two tokens apart. Never the rest. */
  hint: string | null;
}

function encryptionKey(): Buffer {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) {
    throw new Error(
      "BETTER_AUTH_SECRET is not set, so the bot token cannot be encrypted.",
    );
  }
  // Derived rather than used raw, so this key is useless for anything else
  // BETTER_AUTH_SECRET protects.
  return crypto.scryptSync(secret, "askarr:bot-token:v1", 32);
}

function encrypt(raw: string): Omit<StoredToken, "version" | "updatedAt" | "format"> {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(raw, "utf8"), cipher.final()]);
  return {
    iv: iv.toString("base64"),
    ciphertext: ciphertext.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
  };
}

function decrypt(stored: StoredToken): string | null {
  try {
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      encryptionKey(),
      Buffer.from(stored.iv, "base64"),
    );
    decipher.setAuthTag(Buffer.from(stored.tag, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(stored.ciphertext, "base64")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    // Wrong key, or a tampered row. Either way the value is unusable, and
    // falling back to the environment beats taking the process down.
    return null;
  }
}

function parseStored(value: unknown): StoredToken | null {
  if (typeof value !== "object" || value === null) return null;
  const candidate = value as Partial<StoredToken>;
  if (
    candidate.format !== 1 ||
    typeof candidate.iv !== "string" ||
    typeof candidate.ciphertext !== "string" ||
    typeof candidate.tag !== "string" ||
    typeof candidate.version !== "number"
  ) {
    return null;
  }
  return candidate as StoredToken;
}

async function readStored(): Promise<StoredToken | null> {
  const row = await prisma.setting.findUnique({ where: { key: TOKEN_KEY } });
  return row ? parseStored(row.value) : null;
}

/**
 * The token in force right now: the saved one, or the environment seed.
 *
 * Uncached on purpose. A stale token does not throw, it silently rejects every
 * real signature, and that is a far worse failure than one extra query.
 */
export async function getActiveBotToken(): Promise<string | null> {
  const stored = await readStored();
  if (stored) {
    const raw = decrypt(stored);
    if (raw) return raw;
  }
  return process.env.TELEGRAM_BOT_TOKEN ?? null;
}

/** What the back office shows. Never includes the token itself. */
export async function getBotTokenState(): Promise<BotTokenState> {
  const stored = await readStored();
  if (stored) {
    const raw = decrypt(stored);
    if (raw) {
      return {
        source: "database",
        version: stored.version,
        updatedAt: stored.updatedAt,
        hint: raw.slice(-4),
      };
    }
  }

  const fromEnv = process.env.TELEGRAM_BOT_TOKEN;
  if (fromEnv) {
    return {
      source: "environment",
      version: null,
      updatedAt: null,
      hint: fromEnv.slice(-4),
    };
  }

  return { source: "missing", version: null, updatedAt: null, hint: null };
}

/**
 * The number the bot process watches. It changes on every save, which is the
 * signal to drop the current connection and reconnect with the new token.
 * Environment-only installs sit at 0 and never reload.
 */
export async function getBotTokenVersion(): Promise<number> {
  const stored = await readStored();
  return stored?.version ?? 0;
}

export async function setBotToken(raw: string): Promise<number> {
  const previous = await readStored();
  const version = (previous?.version ?? 0) + 1;
  const value: StoredToken = {
    format: 1,
    ...encrypt(raw.trim()),
    version,
    updatedAt: new Date().toISOString(),
  };

  await prisma.setting.upsert({
    where: { key: TOKEN_KEY },
    create: { key: TOKEN_KEY, value: { ...value } },
    update: { value: { ...value } },
  });

  return version;
}

/** Drops the saved token, falling back to the environment seed. */
export async function clearBotToken(): Promise<void> {
  await prisma.setting.deleteMany({ where: { key: TOKEN_KEY } });
}
