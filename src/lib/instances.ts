import { ArrKind, type ArrInstance } from "@prisma/client";
import { z } from "zod";
import { prisma } from "./prisma";
import {
  ArrError,
  getQualityProfiles,
  getRootFolders,
  getStatus,
  joinArrUrl,
} from "./servarr";

/** Shared instance logic, used by both the onboarding wizard and the back office. */

export const instanceInputSchema = z.object({
  label: z.string().min(1, "Give this instance a name.").max(60),
  kind: z.nativeEnum(ArrKind),
  baseUrl: z
    .string()
    .min(1, "Enter the address of the instance.")
    .url("That is not a valid address. Expected something like https://10.0.0.5:7878.")
    // A trailing slash would double up when a path prefix is joined on.
    .transform((value) => value.replace(/\/+$/, "")),
  apiKey: z.string().min(1, "Paste the API key from the instance."),
  qualityProfileId: z.coerce.number().int().positive("Pick a quality profile."),
  rootFolderPath: z.string().min(1, "Pick a root folder."),
  tagIds: z.array(z.coerce.number().int()).default([]),
  allowSelfSigned: z.boolean().default(false),
  enabled: z.boolean().default(true),
  isDefault: z.boolean().default(false),
});

export type InstanceInput = z.infer<typeof instanceInputSchema>;

/** Just enough to talk to an instance that has not been saved yet. */
export const connectionProbeSchema = z.object({
  label: z.string().default("this instance"),
  baseUrl: z.string().url().transform((value) => value.replace(/\/+$/, "")),
  apiKey: z.string().min(1),
  allowSelfSigned: z.boolean().default(false),
});

export type ConnectionProbe = z.infer<typeof connectionProbeSchema>;

export type TestConnectionResult =
  | {
      ok: true;
      version: string;
      appName: string | null;
      qualityProfiles: { id: number; name: string }[];
      rootFolders: { id: number; path: string; freeSpace: number | null }[];
    }
  | { ok: false; message: string };

/**
 * Tests a connection and, on success, loads the quality profiles and root
 * folders so they can be offered as selects instead of typed by hand.
 */
export async function testConnection(
  probe: ConnectionProbe,
): Promise<TestConnectionResult> {
  const connection = {
    label: probe.label,
    baseUrl: probe.baseUrl,
    apiKey: probe.apiKey,
    allowSelfSigned: probe.allowSelfSigned,
  };

  try {
    const status = await getStatus(connection);
    const [qualityProfiles, rootFolders] = await Promise.all([
      getQualityProfiles(connection),
      getRootFolders(connection),
    ]);

    return {
      ok: true,
      version: status.version,
      appName: status.appName ?? null,
      qualityProfiles: qualityProfiles.map((p) => ({ id: p.id, name: p.name })),
      rootFolders: rootFolders.map((f) => ({
        id: f.id,
        path: f.path,
        freeSpace: f.freeSpace ?? null,
      })),
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof ArrError
          ? error.hint
          : "Could not reach that instance. Check the address and try again.",
    };
  }
}

/**
 * Only one instance can be the default for a kind, so promoting one demotes
 * the others in the same transaction.
 */
export async function createInstance(input: InstanceInput): Promise<ArrInstance> {
  return prisma.$transaction(async (tx) => {
    const siblings = await tx.arrInstance.count({
      where: { kind: input.kind },
    });
    // The first instance of a kind is the default whether asked for or not.
    const isDefault = input.isDefault || siblings === 0;

    if (isDefault) {
      await tx.arrInstance.updateMany({
        where: { kind: input.kind },
        data: { isDefault: false },
      });
    }

    return tx.arrInstance.create({ data: { ...input, isDefault } });
  });
}

export async function updateInstance(
  id: string,
  input: InstanceInput,
): Promise<ArrInstance> {
  return prisma.$transaction(async (tx) => {
    if (input.isDefault) {
      await tx.arrInstance.updateMany({
        where: { kind: input.kind, id: { not: id } },
        data: { isDefault: false },
      });
    }
    return tx.arrInstance.update({ where: { id }, data: input });
  });
}

export async function deleteInstance(id: string): Promise<void> {
  await prisma.arrInstance.delete({ where: { id } });
}

/** Masks an API key for display. The real key never leaves the server. */
export function maskApiKey(apiKey: string): string {
  if (apiKey.length <= 4) return "••••";
  return `••••••${apiKey.slice(-4)}`;
}

/** The instance shape safe to hand to a client component. */
export interface PublicInstance {
  id: string;
  label: string;
  kind: ArrKind;
  baseUrl: string;
  apiKeyMasked: string;
  qualityProfileId: number;
  rootFolderPath: string;
  tagIds: number[];
  allowSelfSigned: boolean;
  enabled: boolean;
  isDefault: boolean;
  webhookUrl: string;
}

export function toPublicInstance(
  instance: ArrInstance,
  appUrl: string,
): PublicInstance {
  return {
    id: instance.id,
    label: instance.label,
    kind: instance.kind,
    baseUrl: instance.baseUrl,
    apiKeyMasked: maskApiKey(instance.apiKey),
    qualityProfileId: instance.qualityProfileId,
    rootFolderPath: instance.rootFolderPath,
    tagIds: instance.tagIds,
    allowSelfSigned: instance.allowSelfSigned,
    enabled: instance.enabled,
    isDefault: instance.isDefault,
    webhookUrl: webhookUrlFor(instance, appUrl),
  };
}

export function webhookUrlFor(instance: ArrInstance, appUrl: string): string {
  const base = appUrl.replace(/\/+$/, "");
  return `${base}/api/webhooks/arr/${instance.id}?token=${instance.webhookSecret}`;
}

/**
 * Two enabled instances sharing a root folder will fight over the same files.
 * Surfaced as a warning in the back office rather than blocked, because a
 * deliberate shared library is a legitimate if unusual setup.
 */
export async function findRootFolderCollisions(): Promise<
  { rootFolderPath: string; labels: string[] }[]
> {
  const instances = await prisma.arrInstance.findMany({
    where: { enabled: true },
    orderBy: { label: "asc" },
  });

  const byPath = new Map<string, string[]>();
  for (const instance of instances) {
    const key = `${instance.kind}:${instance.rootFolderPath}`;
    byPath.set(key, [...(byPath.get(key) ?? []), instance.label]);
  }

  return [...byPath.entries()]
    .filter(([, labels]) => labels.length > 1)
    .map(([key, labels]) => ({
      rootFolderPath: key.split(":").slice(1).join(":"),
      labels,
    }));
}

/** Pings every instance for the dashboard health panel. */
export async function pingInstances(): Promise<
  { id: string; label: string; ok: boolean; version: string | null; message: string | null }[]
> {
  const instances = await prisma.arrInstance.findMany({
    orderBy: { label: "asc" },
  });

  return Promise.all(
    instances.map(async (instance) => {
      try {
        const status = await getStatus({
          label: instance.label,
          baseUrl: instance.baseUrl,
          apiKey: instance.apiKey,
          allowSelfSigned: instance.allowSelfSigned,
        });
        return {
          id: instance.id,
          label: instance.label,
          ok: true,
          version: status.version,
          message: null,
        };
      } catch (error) {
        return {
          id: instance.id,
          label: instance.label,
          ok: false,
          version: null,
          message: error instanceof ArrError ? error.hint : "Unreachable.",
        };
      }
    }),
  );
}

export { joinArrUrl };
