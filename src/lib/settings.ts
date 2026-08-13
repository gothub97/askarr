import { z } from "zod";
import { prisma } from "./prisma";

export const SETUP_COMPLETED_KEY = "setup_completed";

export const appSettingsSchema = z.object({
  defaultQuotaPerMonth: z.number().int().min(0).default(5),
  /** Minutes to hold season notifications before sending one grouped message. */
  aggregationWindowMinutes: z.number().int().min(1).max(120).default(10),
  language: z.string().default("en"),
});

export type AppSettings = z.infer<typeof appSettingsSchema>;

export const APP_SETTINGS_KEY = "app_settings";

export async function isSetupCompleted(): Promise<boolean> {
  const row = await prisma.setting.findUnique({
    where: { key: SETUP_COMPLETED_KEY },
  });
  return row?.value === true;
}

export async function markSetupCompleted(): Promise<void> {
  await prisma.setting.upsert({
    where: { key: SETUP_COMPLETED_KEY },
    create: { key: SETUP_COMPLETED_KEY, value: true },
    update: { value: true },
  });
}

export async function getAppSettings(): Promise<AppSettings> {
  const row = await prisma.setting.findUnique({
    where: { key: APP_SETTINGS_KEY },
  });
  const parsed = appSettingsSchema.safeParse(row?.value ?? {});
  return parsed.success ? parsed.data : appSettingsSchema.parse({});
}

export async function setAppSettings(settings: AppSettings): Promise<void> {
  await prisma.setting.upsert({
    where: { key: APP_SETTINGS_KEY },
    create: { key: APP_SETTINGS_KEY, value: settings },
    update: { value: settings },
  });
}
