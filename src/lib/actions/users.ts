"use server";

import { TelegramRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "../prisma";
import { assertSession } from "./guard";

/** Role and quota edits for the people who talk to the bot. */

export interface UserActionResult {
  ok: boolean;
  message?: string;
}

const updateUserSchema = z.object({
  telegramUserId: z.string().min(1, "Pick a person first."),
  role: z.nativeEnum(TelegramRole),
  // 0 means unlimited; the upper bound only guards against a typo.
  quotaPerMonth: z.coerce
    .number()
    .int("Use a whole number of requests.")
    .min(0, "A quota cannot be negative.")
    .max(1000, "That quota is too high. Use 0 for unlimited."),
});

export async function updateTelegramUserAction(
  input: unknown,
): Promise<UserActionResult> {
  await assertSession();
  const parsed = updateUserSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Check the form and try again.",
    };
  }

  const { telegramUserId, role, quotaPerMonth } = parsed.data;
  try {
    await prisma.telegramUser.update({
      where: { id: telegramUserId },
      data: { role, quotaPerMonth },
    });
    revalidatePath("/users");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch {
    return { ok: false, message: "That person no longer exists. Reload the page." };
  }
}
