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
  type PublicInstance,
  type TestConnectionResult,
} from "../instances";
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
