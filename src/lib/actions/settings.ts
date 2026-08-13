"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { appSettingsSchema, setAppSettings, type AppSettings } from "../settings";
import { assertSession } from "./guard";

/** The handful of knobs on the Settings page. */

export type SettingsActionResult =
  | { ok: true; settings: AppSettings }
  | { ok: false; message: string };

export async function updateAppSettingsAction(
  input: unknown,
): Promise<SettingsActionResult> {
  await assertSession();

  const parsed = appSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: firstIssue(parsed.error) };
  }

  try {
    await setAppSettings(parsed.data);
    // Quotas and the aggregation window are read on every request and every
    // notification, so every surface has to see the new values.
    revalidatePath("/settings");
    revalidatePath("/users");
    revalidatePath("/dashboard");
    return { ok: true, settings: parsed.data };
  } catch {
    return { ok: false, message: "Could not save the settings. Try again." };
  }
}

function firstIssue(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return "Check the form and try again.";
  // Zod's own messages for numbers are terse; name the field so the message
  // says what happened and how to fix it.
  const field = issue.path.join(".");
  switch (field) {
    case "defaultQuotaPerMonth":
      return "The default quota must be a whole number. Use 0 for unlimited.";
    case "aggregationWindowMinutes":
      return "The aggregation window must be between 1 and 120 minutes.";
    default:
      return issue.message;
  }
}
