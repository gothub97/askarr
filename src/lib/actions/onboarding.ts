"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type {
  PublicTelegramChat,
  SetupSummary,
} from "@/app/(public)/onboarding/types";
import { auth } from "../auth";
import { getActiveBotToken } from "../bot-token";
import { prisma } from "../prisma";
import { getSession } from "../session";
import { isSetupCompleted, markSetupCompleted } from "../settings";
import { callTelegram } from "../telegram/notify";

/**
 * Server actions for the first-run wizard.
 *
 * Every one of them refuses once `setup_completed` is true. That is the second
 * half of the "410 Gone" contract: the page can be made unreachable, but a
 * server action is addressable by id and can be replayed straight at the
 * server, so the door has to be shut here too — otherwise a replayed step 1
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
 * hooks server-action responses — no second sign-in round trip.
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

export type ResolveBotResult =
  | { ok: true; username: string; displayName: string }
  | { ok: false; gone?: true; message: string };

/** Resolves the bot behind the active token so step 3 can name it. */
export async function resolveTelegramBotAction(): Promise<ResolveBotResult> {
  if (await isSetupCompleted()) return gone();

  if (!(await getActiveBotToken())) {
    return {
      ok: false,
      message:
        "No bot token yet. Set TELEGRAM_BOT_TOKEN, or add one from the back office once setup is done.",
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

// ---------------------------------------------------------------- step 4

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
 * account. Returns only a failure shape — success redirects and never returns.
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
