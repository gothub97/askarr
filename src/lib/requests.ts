import {
  AudioVersion,
  MediaKind,
  MediaStatus,
  Prisma,
  TelegramRole,
  type ArrInstance,
  type MediaItem,
  type Subscription,
  type TelegramUser,
} from "@prisma/client";
import { prisma } from "./prisma";
import { getQuotaState, type QuotaState } from "./quota";
import { decideApproval } from "./rbac";
import { getAppSettings } from "./settings";
import {
  ArrError,
  addToInstance,
  lookup,
  lookupByExternalId,
  type LookupResult,
  type SonarrMonitorMode,
} from "./servarr";

/**
 * All Askarr business rules live here. The bot handles Telegram presentation
 * only; the API routes handle HTTP only. Both call into this module so the
 * rules cannot drift between the two surfaces.
 */

export const DRAFT_TTL_MINUTES = 15;
export const MAX_RESULTS = 5;

const arrKindFor = (kind: MediaKind) =>
  kind === MediaKind.MOVIE ? "RADARR" : ("SONARR" as const);

// ---------------------------------------------------------------- instances

/** Enabled instances able to serve this kind of media. */
export async function listInstancesForKind(
  kind: MediaKind,
): Promise<ArrInstance[]> {
  return prisma.arrInstance.findMany({
    where: { kind: arrKindFor(kind), enabled: true },
    orderBy: [{ isDefault: "desc" }, { label: "asc" }],
  });
}

/**
 * The instance to search against. Searching is version-agnostic (metadata is
 * the same either way), so the default instance is fine for lookups.
 */
export async function getSearchInstance(
  kind: MediaKind,
): Promise<ArrInstance | null> {
  const instances = await listInstancesForKind(kind);
  return instances[0] ?? null;
}

export async function getInstanceForVersion(
  kind: MediaKind,
  version: AudioVersion,
): Promise<ArrInstance | null> {
  const instances = await listInstancesForKind(kind);
  return (
    instances.find((i) => i.version === version && i.isDefault) ??
    instances.find((i) => i.version === version) ??
    null
  );
}

// ------------------------------------------------------------------ drafts

export interface DraftPayload {
  results: LookupResult[];
}

export async function createDraft(params: {
  telegramUserId: string;
  chatId: bigint;
  threadId: number | null;
  messageId: number | null;
  kind: MediaKind;
  results: LookupResult[];
}) {
  return prisma.requestDraft.create({
    data: {
      telegramUserId: params.telegramUserId,
      chatId: params.chatId,
      threadId: params.threadId,
      messageId: params.messageId,
      kind: params.kind,
      results: params.results as unknown as Prisma.InputJsonValue,
      expiresAt: new Date(Date.now() + DRAFT_TTL_MINUTES * 60 * 1000),
    },
  });
}

export async function getDraft(draftId: string) {
  const draft = await prisma.requestDraft.findUnique({
    where: { id: draftId },
    include: { telegramUser: true },
  });
  if (!draft) return null;
  if (draft.expiresAt.getTime() < Date.now()) return null;
  return draft;
}

export function draftResults(draft: { results: Prisma.JsonValue }): LookupResult[] {
  return (draft.results as unknown as LookupResult[]) ?? [];
}

export async function setDraftSelection(draftId: string, index: number) {
  return prisma.requestDraft.update({
    where: { id: draftId },
    data: { selectedIndex: index },
  });
}

export async function deleteExpiredDrafts(): Promise<number> {
  const { count } = await prisma.requestDraft.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return count;
}

// ------------------------------------------------------------------ search

export interface SearchOutcome {
  ok: boolean;
  results: LookupResult[];
  instance: ArrInstance | null;
  error?: string;
}

/** Searches the default instance for a kind and truncates to MAX_RESULTS. */
export async function searchMedia(
  kind: MediaKind,
  term: string,
): Promise<SearchOutcome> {
  const instance = await getSearchInstance(kind);
  if (!instance) {
    return {
      ok: false,
      results: [],
      instance: null,
      error:
        kind === MediaKind.MOVIE
          ? "No Radarr instance is set up yet. Ask an admin to add one."
          : "No Sonarr instance is set up yet. Ask an admin to add one.",
    };
  }

  try {
    const results = await lookup(instance, term);
    return { ok: true, results: results.slice(0, MAX_RESULTS), instance };
  } catch (error) {
    return {
      ok: false,
      results: [],
      instance,
      error:
        error instanceof ArrError
          ? error.hint
          : "The search failed. Try again in a moment.",
    };
  }
}

// ----------------------------------------------------------- telegram users

/** Resolves the requester, creating them as GUEST on their first message. */
export async function ensureTelegramUser(params: {
  telegramId: bigint;
  username: string | null;
  displayName: string;
}): Promise<TelegramUser> {
  const existing = await prisma.telegramUser.findUnique({
    where: { telegramId: params.telegramId },
  });

  if (existing) {
    // Keep the display name and handle fresh; people rename themselves.
    if (
      existing.username !== params.username ||
      existing.displayName !== params.displayName
    ) {
      return prisma.telegramUser.update({
        where: { id: existing.id },
        data: { username: params.username, displayName: params.displayName },
      });
    }
    return existing;
  }

  const settings = await getAppSettings();
  return prisma.telegramUser.create({
    data: {
      telegramId: params.telegramId,
      username: params.username,
      displayName: params.displayName,
      role: TelegramRole.GUEST,
      quotaPerMonth: settings.defaultQuotaPerMonth,
    },
  });
}

// ----------------------------------------------------------------- requests

export type SubmitOutcome =
  /** Newly requested and pushed to the instance. */
  | { kind: "queued"; mediaItem: MediaItem; subscription: Subscription }
  /** Newly requested, waiting for an admin. */
  | {
      kind: "pending";
      mediaItem: MediaItem;
      subscription: Subscription;
      reason: "role" | "quota" | "full_series";
    }
  /** The instance already has this title; nothing was sent. */
  | { kind: "already_have"; mediaItem: MediaItem; subscription: Subscription }
  /** Someone already requested it; this person was added as a subscriber. */
  | {
      kind: "already_requested";
      mediaItem: MediaItem;
      subscription: Subscription;
      status: MediaStatus;
    }
  /** This person had already requested this exact title. */
  | { kind: "duplicate"; mediaItem: MediaItem; status: MediaStatus }
  | { kind: "blocked" }
  | { kind: "error"; message: string };

export interface SubmitParams {
  telegramUser: TelegramUser;
  instance: ArrInstance;
  kind: MediaKind;
  selection: Pick<
    LookupResult,
    "externalId" | "title" | "year" | "overview" | "posterUrl"
  >;
  monitorMode: SonarrMonitorMode | null;
  chatId: bigint;
  threadId: number | null;
  messageId: number | null;
}

/**
 * The single entry point for turning an intent into a request.
 *
 * Deduplication is enforced by the database, not by a read-then-write: the
 * unique constraints on (externalId, instanceId) and (mediaItemId,
 * telegramUserId) are what make two people requesting the same movie converge
 * on one MediaItem with two Subscriptions.
 */
export async function submitRequest(
  params: SubmitParams,
): Promise<SubmitOutcome> {
  const {
    telegramUser,
    instance,
    kind,
    selection,
    monitorMode,
    chatId,
    threadId,
    messageId,
  } = params;

  if (telegramUser.role === TelegramRole.BLOCKED) return { kind: "blocked" };

  const existingItem = await prisma.mediaItem.findUnique({
    where: {
      externalId_instanceId: {
        externalId: selection.externalId,
        instanceId: instance.id,
      },
    },
  });

  // ---- The title is already tracked: only the subscription is new.
  if (existingItem) {
    const alreadyMine = await prisma.subscription.findUnique({
      where: {
        mediaItemId_telegramUserId: {
          mediaItemId: existingItem.id,
          telegramUserId: telegramUser.id,
        },
      },
    });
    if (alreadyMine) {
      return {
        kind: "duplicate",
        mediaItem: existingItem,
        status: existingItem.status,
      };
    }

    const subscription = await prisma.subscription.create({
      data: {
        mediaItemId: existingItem.id,
        telegramUserId: telegramUser.id,
        chatId,
        threadId,
        messageId,
      },
    });

    if (existingItem.status === MediaStatus.ALREADY_HAVE) {
      return { kind: "already_have", mediaItem: existingItem, subscription };
    }
    return {
      kind: "already_requested",
      mediaItem: existingItem,
      subscription,
      status: existingItem.status,
    };
  }

  // ---- Not tracked yet. Ask the instance whether it already holds the title.
  let alreadyInLibrary: { arrId: number | null } | null = null;
  try {
    const fresh = await lookupByExternalId(instance, selection.externalId);
    if (fresh?.alreadyManaged) alreadyInLibrary = { arrId: fresh.arrId };
  } catch (error) {
    return {
      kind: "error",
      message:
        error instanceof ArrError
          ? error.hint
          : `Could not reach ${instance.label}. Try again in a moment.`,
    };
  }

  if (alreadyInLibrary) {
    const { mediaItem, subscription } = await createItemWithSubscription({
      params,
      status: MediaStatus.ALREADY_HAVE,
      statusReason: "Already in the library when requested",
      arrId: alreadyInLibrary.arrId,
    });
    // Nothing is sent to Radarr/Sonarr in this branch, by design.
    return { kind: "already_have", mediaItem, subscription };
  }

  // ---- Genuinely new. Apply the role rules.
  const quota: QuotaState = await getQuotaState(telegramUser);
  const decision = decideApproval({
    role: telegramUser.role,
    kind,
    monitorMode,
    quota,
  });

  const { mediaItem, subscription } = await createItemWithSubscription({
    params,
    status: MediaStatus.PENDING,
    statusReason: decision.approved ? null : reasonText(decision.reason),
    arrId: null,
  });

  if (!decision.approved) {
    return { kind: "pending", mediaItem, subscription, reason: decision.reason };
  }

  const pushed = await pushToInstance(mediaItem.id, {
    approvedById: null,
    autoApproved: true,
  });
  if (!pushed.ok) return { kind: "error", message: pushed.message };

  return { kind: "queued", mediaItem: pushed.mediaItem, subscription };
}

function reasonText(reason: "role" | "quota" | "full_series"): string {
  switch (reason) {
    case "quota":
      return "Monthly quota reached, waiting for approval";
    case "full_series":
      return "Full series requests always need approval";
    default:
      return "Waiting for approval";
  }
}

async function createItemWithSubscription(args: {
  params: SubmitParams;
  status: MediaStatus;
  statusReason: string | null;
  arrId: number | null;
}): Promise<{ mediaItem: MediaItem; subscription: Subscription }> {
  const { params, status, statusReason, arrId } = args;

  return prisma.$transaction(async (tx) => {
    const mediaItem = await tx.mediaItem.upsert({
      where: {
        externalId_instanceId: {
          externalId: params.selection.externalId,
          instanceId: params.instance.id,
        },
      },
      // A concurrent request may have created it a moment ago; keep that one.
      update: {},
      create: {
        kind: params.kind,
        externalId: params.selection.externalId,
        title: params.selection.title,
        year: params.selection.year,
        overview: params.selection.overview,
        posterUrl: params.selection.posterUrl,
        instanceId: params.instance.id,
        arrId,
        monitorMode: params.monitorMode,
        status,
        statusReason,
      },
    });

    const subscription = await tx.subscription.upsert({
      where: {
        mediaItemId_telegramUserId: {
          mediaItemId: mediaItem.id,
          telegramUserId: params.telegramUser.id,
        },
      },
      update: {
        chatId: params.chatId,
        threadId: params.threadId,
        messageId: params.messageId,
      },
      create: {
        mediaItemId: mediaItem.id,
        telegramUserId: params.telegramUser.id,
        chatId: params.chatId,
        threadId: params.threadId,
        messageId: params.messageId,
      },
    });

    return { mediaItem, subscription };
  });
}

// ---------------------------------------------------------------- approval

export type PushOutcome =
  | { ok: true; mediaItem: MediaItem }
  | { ok: false; message: string };

/**
 * Sends an approved item to its instance and records the id it was given.
 * Safe to call twice: an item already carrying an arrId is left alone.
 */
export async function pushToInstance(
  mediaItemId: string,
  options: { approvedById: string | null; autoApproved: boolean },
): Promise<PushOutcome> {
  const mediaItem = await prisma.mediaItem.findUnique({
    where: { id: mediaItemId },
    include: { instance: true },
  });
  if (!mediaItem) return { ok: false, message: "That request no longer exists." };

  if (mediaItem.status === MediaStatus.ALREADY_HAVE) {
    return { ok: true, mediaItem };
  }
  if (mediaItem.arrId) {
    return { ok: true, mediaItem };
  }

  try {
    const arrId = await addToInstance(mediaItem.instance, {
      externalId: mediaItem.externalId,
      title: mediaItem.title,
      year: mediaItem.year,
      monitorMode: (mediaItem.monitorMode as SonarrMonitorMode) ?? "all",
    });

    const updated = await prisma.$transaction(async (tx) => {
      const item = await tx.mediaItem.update({
        where: { id: mediaItemId },
        data: {
          arrId: arrId || null,
          status: MediaStatus.QUEUED,
          statusReason: null,
        },
      });
      await tx.subscription.updateMany({
        where: { mediaItemId, approvedAt: null },
        data: {
          approvedAt: new Date(),
          approvedById: options.approvedById,
        },
      });
      return item;
    });

    return { ok: true, mediaItem: updated };
  } catch (error) {
    const message =
      error instanceof ArrError
        ? error.hint
        : `Could not add this to ${mediaItem.instance.label}. Try again in a moment.`;

    await prisma.mediaItem.update({
      where: { id: mediaItemId },
      data: { status: MediaStatus.FAILED, statusReason: message },
    });
    return { ok: false, message };
  }
}

export async function approveRequest(
  mediaItemId: string,
  approvedById: string | null,
): Promise<PushOutcome> {
  return pushToInstance(mediaItemId, { approvedById, autoApproved: false });
}

export async function rejectRequest(
  mediaItemId: string,
  reason: string | null,
): Promise<MediaItem> {
  return prisma.mediaItem.update({
    where: { id: mediaItemId },
    data: {
      status: MediaStatus.REJECTED,
      statusReason: reason ?? "Rejected by an admin",
    },
  });
}

export async function retryRequest(mediaItemId: string): Promise<PushOutcome> {
  await prisma.mediaItem.update({
    where: { id: mediaItemId },
    data: { status: MediaStatus.PENDING, statusReason: null, arrId: null },
  });
  return pushToInstance(mediaItemId, { approvedById: null, autoApproved: false });
}

// -------------------------------------------------------------------- reads

/** The caller's most recent requests, newest first. */
export async function listUserRequests(
  telegramUserId: string,
  limit = 10,
) {
  return prisma.subscription.findMany({
    where: { telegramUserId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { mediaItem: { include: { instance: true } } },
  });
}

export async function listPendingRequests(limit = 50) {
  return prisma.mediaItem.findMany({
    where: { status: MediaStatus.PENDING },
    orderBy: { createdAt: "asc" },
    take: limit,
    include: {
      instance: true,
      subscriptions: { include: { telegramUser: true } },
    },
  });
}

export async function countPendingRequests(): Promise<number> {
  return prisma.mediaItem.count({ where: { status: MediaStatus.PENDING } });
}
