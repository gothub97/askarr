"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "../prisma";
import {
  connectionProbeSchema,
  createInstance,
  deleteInstance,
  instanceInputSchema,
  testConnection,
  toPublicInstance,
  updateInstance,
  webhookUrlFor,
  type PublicInstance,
  type TestConnectionResult,
} from "../instances";
import {
  ArrError,
  configureWebhook,
  type WebhookSetupOutcome,
} from "../servarr";
import { assertConfigurator } from "./guard";

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

export async function testInstanceConnectionAction(
  input: unknown,
): Promise<TestConnectionResult> {
  await assertConfigurator();
  const parsed = connectionProbeSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message:
        parsed.error.issues[0]?.message ??
        "Fill in the address and the API key first.",
    };
  }
  return testConnection(parsed.data);
}

export type SaveInstanceResult =
  | { ok: true; instance: PublicInstance }
  | { ok: false; message: string };

export async function createInstanceAction(
  input: unknown,
): Promise<SaveInstanceResult> {
  await assertConfigurator();
  const parsed = instanceInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: firstIssue(parsed.error) };
  }

  try {
    const instance = await createInstance(parsed.data);
    revalidatePath("/instances");
    revalidatePath("/dashboard");
    return { ok: true, instance: toPublicInstance(instance, appUrl()) };
  } catch (error) {
    return { ok: false, message: describeWriteError(error) };
  }
}

export async function updateInstanceAction(
  id: string,
  input: unknown,
): Promise<SaveInstanceResult> {
  await assertConfigurator();
  const parsed = instanceInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: firstIssue(parsed.error) };
  }

  try {
    const instance = await updateInstance(id, parsed.data);
    revalidatePath("/instances");
    revalidatePath("/dashboard");
    return { ok: true, instance: toPublicInstance(instance, appUrl()) };
  } catch (error) {
    return { ok: false, message: describeWriteError(error) };
  }
}

export async function deleteInstanceAction(
  id: string,
): Promise<{ ok: boolean; message?: string }> {
  await assertConfigurator();
  try {
    await deleteInstance(id);
    revalidatePath("/instances");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch {
    return { ok: false, message: "Could not remove that instance." };
  }
}

/** Re-reads an instance's real API key so an edit form can prefill it. */
export async function getInstanceSecretAction(
  id: string,
): Promise<{ ok: true; apiKey: string } | { ok: false }> {
  await assertConfigurator();
  const instance = await prisma.arrInstance.findUnique({
    where: { id },
    select: { apiKey: true },
  });
  return instance ? { ok: true, apiKey: instance.apiKey } : { ok: false };
}

function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Check the form and try again.";
}

function describeWriteError(error: unknown): string {
  const code = (error as { code?: string })?.code;
  if (code === "P2002") {
    return "An instance with that name already exists for this kind and version. Pick another name.";
  }
  return "Could not save that instance. Try again.";
}

// --------------------------------------------------------- webhook wiring

export interface ConfigureWebhookResult {
  ok: boolean;
  message?: string;
  outcome?: WebhookSetupOutcome;
}

const configureWebhookSchema = z.object({
  id: z.string().min(1, "Pick an instance first."),
});

/**
 * Registers Askarr's webhook on the instance over its API.
 *
 * The webhook is the only way Askarr ever learns that something was grabbed
 * or imported, so an install where nobody pasted the URL looks identical to a
 * broken one — requests stay "queued" while the file is already on disk.
 * Doing it here removes the step most likely to be skipped.
 */
export async function configureWebhookAction(
  input: unknown,
): Promise<ConfigureWebhookResult> {
  await assertConfigurator();

  const parsed = configureWebhookSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Bad input." };
  }

  const instance = await prisma.arrInstance.findUnique({
    where: { id: parsed.data.id },
  });
  if (!instance) {
    return { ok: false, message: "That instance no longer exists. Reload the page." };
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  if (!appUrl) {
    return {
      ok: false,
      message: "NEXT_PUBLIC_APP_URL is not set, so there is no address to give the instance.",
    };
  }
  if (/localhost|127\.0\.0\.1/.test(appUrl)) {
    return {
      ok: false,
      message:
        "NEXT_PUBLIC_APP_URL points at localhost, which means the instance itself — it could never reach Askarr there. Use a public address or a tunnel.",
    };
  }

  try {
    const outcome = await configureWebhook(
      instance,
      webhookUrlFor(instance, appUrl),
    );
    revalidatePath("/instances");
    return { ok: true, outcome };
  } catch (error) {
    return { ok: false, message: describeWebhookFailure(error, instance.label) };
  }
}

/**
 * Radarr and Sonarr validate a webhook by calling it before they will save it,
 * so an unreachable Askarr comes back as a 400 carrying a nested validation
 * blob. Left alone it surfaces as a wall of JSON that buries the one fact that
 * matters: the instance could not reach us.
 */
function describeWebhookFailure(error: unknown, label: string): string {
  const raw = error instanceof ArrError ? error.hint : "";

  if (/unable to (post to webhook|send test message)/i.test(raw)) {
    return `${label} could not reach Askarr at that address. It has to be reachable from the instance itself — check the tunnel or NEXT_PUBLIC_APP_URL.`;
  }
  if (error instanceof ArrError) return error.hint;

  return `Could not set the webhook up on ${label}. ${
    error instanceof Error ? error.message : ""
  }`.trim();
}
