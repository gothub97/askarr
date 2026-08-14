"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type {
  PublicBotRuntime,
  PublicTelegramChat,
  SetupProgress,
  SetupSummary,
} from "@/app/(public)/onboarding/types";
import { auth } from "../auth";
import { readBotStatus } from "../bot-control";
import { getActiveBotToken, getBotTokenState, setBotToken } from "../bot-token";
import { prisma } from "../prisma";
import { getSession } from "../session";
import { isSetupCompleted, markSetupCompleted } from "../settings";
import { callTelegram } from "../telegram/notify";
import { BOT_TOKEN_PATTERN, resolveBot } from "../telegram/resolve-bot";

/**
 * Server actions for the first-run wizard.
 *
 * Every one of them refuses once `setup_completed` is true. That is the second
 * half of the "410 Gone" contract: the page can be made unreachable, but a
 * server action is addressable by id and can be replayed straight at the
 * server, so the door has to be shut here too, because otherwise a replayed step 1
 * would mint a second administrator.
 */

const GONE_MESSAGE = "Setup is already done. Sign in instead.";

export type GoneResult = { ok: false; gone: true; message: string };

function gone(): GoneResult {
  return { ok: false, gone: true, message: GONE_MESSAGE };
}

// ---------------------------------------------------------------- step 1

const administratorSchema = z
  .object({
    name: z.string().trim().min(1, "Enter a name.").max(80),
    email: z
      .string()
      .trim()
      .min(1, "Enter an email address.")
      .email("That is not a valid email address."),
    // Kept in step with better-auth's minPasswordLength in src/lib/auth.ts.
    password: z.string().min(10, "Use at least 10 characters."),
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "The two passwords do not match. Retype the confirmation.",
    path: ["confirmPassword"],
  });

export type AdministratorField =
  | "name"
  | "email"
  | "password"
  | "confirmPassword";

export type CreateAdministratorResult =
  | { ok: true; name: string; email: string }
  | { ok: false; gone?: true; message: string; field?: AdministratorField };

/**
 * Creates the one administrator and opens their session in the same request.
 * The session cookie is written by better-auth's nextCookies plugin, which
 * hooks server-action responses, so there is no second sign-in round trip.
 */
export async function createAdministratorAction(
  input: unknown,
): Promise<CreateAdministratorResult> {
  if (await isSetupCompleted()) return gone();

  const parsed = administratorSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      ok: false,
      message: issue?.message ?? "Check the form and try again.",
      field: issue?.path[0] as AdministratorField | undefined,
    };
  }

  const { name, email, password } = parsed.data;

  /*
   * A refresh mid-wizard must not create a second account. If an account is
   * already there and it is ours (we hold its session), step 1 is simply
   * already done; if it is not ours, this is someone else's install.
   */
  const existing = await prisma.user.count();
  if (existing > 0) {
    const session = await getSession();
    if (session) {
      return { ok: true, name: session.user.name, email: session.user.email };
    }
    return {
      ok: false,
      message: "An administrator already exists. Sign in instead.",
    };
  }

  let userId: string;
  try {
    const created = await auth.api.signUpEmail({
      body: { name, email, password },
      headers: await headers(),
    });
    userId = created.user.id;
  } catch (error) {
    return { ok: false, message: describeSignUpError(error) };
  }

  /*
   * `role` is `input: false` in the better-auth config, so it cannot be passed
   * through sign-up. The column defaults to "admin"; this makes it explicit
   * rather than dependent on a default that may later change. Keyed on the id
   * returned by better-auth, not on the email we sent, because better-auth is
   * free to normalise the address before storing it.
   */
  await prisma.user.update({ where: { id: userId }, data: { role: "admin" } });

  return { ok: true, name, email };
}

function describeSignUpError(error: unknown): string {
  const message =
    error instanceof Error ? error.message : "Could not create the account.";
  if (/exists/i.test(message)) {
    return "An account already uses that email address. Sign in instead.";
  }
  if (/password/i.test(message)) {
    return "That password was rejected. Use at least 10 characters.";
  }
  return "Could not create the account. Check the database connection and try again.";
}

// ---------------------------------------------------------------- step 3

const saveTokenSchema = z.object({
  token: z
    .string()
    .trim()
    .min(20, "That is too short to be a bot token.")
    .regex(BOT_TOKEN_PATTERN, "A bot token looks like 123456789:AA…"),
});

export type SaveTokenResult =
  | { ok: true; username: string; displayName: string }
  | { ok: false; gone?: true; message: string };

/**
 * Step 3: the token from BotFather.
 *
 * Checked with Telegram before it is saved, because saving is what bumps the
 * version the bot process watches. An unchecked bad token would knock a running
 * bot off Telegram and leave it idling on a credential that was never going to
 * work, and the operator would be told nothing until the next step found no
 * groups.
 *
 * No session is required, which is deliberate and narrow: this whole module is
 * unreachable once `setup_completed` is true, so the window in which an
 * anonymous caller could set a token is the same window in which they could
 * create the administrator. The account is the thing worth guarding, and step 1
 * already does.
 */
export async function saveTelegramTokenAction(
  input: unknown,
): Promise<SaveTokenResult> {
  if (await isSetupCompleted()) return gone();

  const parsed = saveTokenSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "That is not a bot token.",
    };
  }

  const resolved = await resolveBot(parsed.data.token);
  if (!resolved.ok) return { ok: false, message: resolved.message };

  await setBotToken(parsed.data.token);

  return {
    ok: true,
    username: resolved.username,
    displayName: resolved.displayName,
  };
}

/**
 * What the bot process last said about itself.
 *
 * Step 3 polls this after saving, and watching it go from no_token to polling
 * is the only honest confirmation the wizard can offer: the web process cannot
 * connect to Telegram on the bot's behalf, and a token that Telegram accepted
 * still has to reach a process that is actually running.
 */
export async function getBotRuntimeAction(): Promise<PublicBotRuntime | null> {
  if (await isSetupCompleted()) return null;

  const status = await readBotStatus();
  if (!status.runtime) return null;

  return {
    state: status.runtime.state,
    detail: status.runtime.detail,
    username: status.runtime.username,
    fresh: status.alive,
  };
}

export type ResolveBotResult =
  | { ok: true; username: string; displayName: string }
  | { ok: false; gone?: true; message: string };

/** Resolves the bot behind the active token so step 4 can name it. */
export async function resolveTelegramBotAction(): Promise<ResolveBotResult> {
  if (await isSetupCompleted()) return gone();

  if (!(await getActiveBotToken())) {
    return {
      ok: false,
      message: "No bot token yet. Go back a step and paste the one BotFather gave you.",
    };
  }

  const response = await callTelegram<{
    username?: string;
    first_name?: string;
  }>("getMe", {});

  if (!response.ok) {
    return {
      ok: false,
      message: `Telegram refused the token: ${response.description}`,
    };
  }

  const username = response.result.username;
  if (!username) {
    return {
      ok: false,
      message: "Telegram returned a bot with no username. Check BotFather.",
    };
  }

  return {
    ok: true,
    username,
    displayName: response.result.first_name ?? username,
  };
}

const chatIdSchema = z
  .string()
  .trim()
  .regex(/^-?\d+$/, "A chat id is a whole number, like -1001234567890.")
  .refine((value) => {
    try {
      BigInt(value);
      return true;
    } catch {
      return false;
    }
  }, "That number is out of range for a chat id.");

const manualChatSchema = z.object({
  chatId: chatIdSchema.refine(
    (value) => BigInt(value) < 0n,
    "Group chat ids are negative, like -1001234567890. Positive ids are private chats.",
  ),
  title: z.string().trim().max(120).optional(),
});

export type AllowChatResult =
  | { ok: true; chat: PublicTelegramChat }
  | { ok: false; gone?: true; message: string };

/**
 * Turns a discovered group on. Upsert rather than update: the bot may not have
 * written the row yet when the id was typed in by hand.
 */
export async function allowTelegramChatAction(
  input: unknown,
): Promise<AllowChatResult> {
  if (await isSetupCompleted()) return gone();

  const parsed = chatIdSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Bad id." };
  }

  return upsertAllowedChat(BigInt(parsed.data), null);
}

/** Fallback for step 3 when the bot cannot report the group itself. */
export async function addTelegramChatManuallyAction(
  input: unknown,
): Promise<AllowChatResult> {
  if (await isSetupCompleted()) return gone();

  const parsed = manualChatSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Check the chat id.",
    };
  }

  return upsertAllowedChat(BigInt(parsed.data.chatId), parsed.data.title ?? null);
}

async function upsertAllowedChat(
  chatId: bigint,
  title: string | null,
): Promise<AllowChatResult> {
  try {
    const chat = await prisma.telegramChat.upsert({
      where: { chatId },
      create: { chatId, title, enabled: true },
      // A title typed by hand must not overwrite the one the bot reported.
      update: { enabled: true, ...(title ? { title } : {}) },
    });
    return { ok: true, chat: toPublicChat(chat) };
  } catch {
    return { ok: false, message: "Could not save that group. Try again." };
  }
}

function toPublicChat(chat: {
  id: string;
  chatId: bigint;
  requestThreadId: number | null;
  title: string | null;
  enabled: boolean;
}): PublicTelegramChat {
  return {
    id: chat.id,
    chatId: chat.chatId.toString(),
    threadId: chat.requestThreadId,
    title: chat.title,
    enabled: chat.enabled,
  };
}

// ------------------------------------------------------------ resume state

/** What a finished install reports: nothing. */
const EMPTY_PROGRESS: SetupProgress = {
  administrator: null,
  hasToken: false,
  tokenHint: null,
  bot: null,
  allowedChats: [],
  hasInstance: false,
  hasTopics: false,
};

/**
 * How far setup got, read back from the database.
 *
 * Steps 3 and 4 are gates, and both of them send the operator out of the
 * browser: one to BotFather, one to a Telegram group. Some of them will close
 * the tab. Until `setup_completed` is true the middleware redirects every route
 * to /onboarding, so coming back has to land on the step they left, not on step
 * one. Nothing here is remembered by the client; every answer is a fact already
 * written down.
 *
 * No session is required, because during onboarding there may not be one yet.
 * The refusal below is what makes that safe: this returns the administrator's
 * name and email and the ids of every allowed group, and a server action is
 * addressable by id and replayable, so without it a stranger could replay this
 * against a finished install and read all of it. The token is only ever
 * reported as a boolean and four characters, never as itself.
 */
export async function getSetupProgressAction(): Promise<SetupProgress> {
  if (await isSetupCompleted()) return EMPTY_PROGRESS;

  const session = await getSession();

  const [tokenState, chats, instanceCount] = await Promise.all([
    getBotTokenState(),
    prisma.telegramChat.findMany({ where: { enabled: true } }),
    prisma.arrInstance.count(),
  ]);

  const hasToken = tokenState.source !== "missing";

  /*
   * Naming the bot costs a getMe, so it is only worth doing when there is a
   * token to name. A failure here is not an error state: the next step will
   * report it properly, and the wizard should still open.
   */
  let bot: SetupProgress["bot"] = null;
  if (hasToken) {
    const response = await callTelegram<{
      username?: string;
      first_name?: string;
    }>("getMe", {}).catch(() => null);
    if (response?.ok && response.result.username) {
      bot = {
        username: response.result.username,
        displayName: response.result.first_name ?? response.result.username,
      };
    }
  }

  return {
    administrator: session
      ? { name: session.user.name, email: session.user.email }
      : null,
    hasToken,
    tokenHint: tokenState.hint,
    bot,
    allowedChats: chats.map(toPublicChat),
    hasInstance: instanceCount > 0,
    hasTopics:
      chats.length > 0 &&
      chats.every(
        (chat) =>
          chat.requestThreadId !== null &&
          chat.adminThreadId !== null &&
          chat.generalThreadId !== null,
      ),
  };
}

// ---------------------------------------------------------------- step 7

export type SummaryResult =
  | { ok: true; summary: SetupSummary }
  | { ok: false; gone?: true; message: string };

export async function getSetupSummaryAction(): Promise<SummaryResult> {
  if (await isSetupCompleted()) return gone();

  const session = await getSession();

  const [instances, chats] = await Promise.all([
    prisma.arrInstance.findMany({ orderBy: { label: "asc" } }),
    prisma.telegramChat.findMany({ orderBy: { createdAt: "asc" } }),
  ]);

  return {
    ok: true,
    summary: {
      administrator: session
        ? { name: session.user.name, email: session.user.email }
        : null,
      instances: instances.map((instance) => ({
        id: instance.id,
        label: instance.label,
        kind: instance.kind,
        baseUrl: instance.baseUrl,
        qualityProfileId: instance.qualityProfileId,
        rootFolderPath: instance.rootFolderPath,
      })),
      chats: chats.map(toPublicChat),
    },
  };
}

export type CompleteSetupResult = { ok: false; gone?: true; message: string };

/**
 * Closes setup for good and drops the operator on the dashboard.
 *
 * Requires a session: an anonymous caller must never be able to flip the flag,
 * because that would lock the real owner out of the wizard before they have an
 * account. Returns only a failure shape, because success redirects and never returns.
 */
export async function completeSetupAction(): Promise<CompleteSetupResult> {
  if (await isSetupCompleted()) return gone();

  const session = await getSession();
  if (!session) {
    return {
      ok: false,
      message: "Create the administrator account before finishing setup.",
    };
  }

  await markSetupCompleted();
  revalidatePath("/", "layout");
  redirect("/dashboard");
}
