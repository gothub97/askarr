import {
  MediaKind,
  MediaStatus,
  Prisma,
  TelegramRole,
  type ArrInstance,
  type MediaItem,
  type Subscription,
  type TelegramUser,
} from "@prisma/client";
import { notifyMediaAvailable } from "./notifications";
import { prisma } from "./prisma";
import { getQuotaState, type QuotaState } from "./quota";
import { decideApproval } from "./rbac";
import { getAppSettings } from "./settings";
import {
  ArrError,
  addToInstance,
  resumeOnInstance,
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
 * The instance to search against. Lookup only reads metadata, which is the
 * same on every instance of a kind, so the default one answers for all of
 * them and the requester is not asked to choose before they have seen results.
 */
export async function getSearchInstance(
  kind: MediaKind,
): Promise<ArrInstance | null> {
  const instances = await listInstancesForKind(kind);
  return instances[0] ?? null;
}

/**
 * The instance a requester picked, by position in listInstancesForKind().
 *
 * An index rather than an id because this travels in callback_data, which
 * Telegram caps at 64 bytes — a cuid would not fit beside the draft id. The
 * ordering is deterministic, and a draft lives 15 minutes, so the only way to
 * land on the wrong one is to add or disable an instance mid-request.
 */
export async function getInstanceByIndex(
  kind: MediaKind,
  index: number,
): Promise<ArrInstance | null> {
  const instances = await listInstancesForKind(kind);
  return instances[index] ?? null;
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

/**
 * Which of these titles Askarr already tracks, keyed by external id.
 *
 * Lets a result list say "already in the library" or "already requested"
 * while someone is still choosing, instead of after they have walked the
 * whole flow and confirmed. One query for a whole page of results.
 */
export async function findTrackedStatuses(
  kind: MediaKind,
  externalIds: number[],
): Promise<Map<number, MediaStatus>> {
  if (externalIds.length === 0) return new Map();

  const items = await prisma.mediaItem.findMany({
    where: {
      kind,
      externalId: { in: externalIds },
      instance: { kind: arrKindFor(kind), enabled: true },
    },
    select: { externalId: true, status: true },
  });

  const tracked = new Map<number, MediaStatus>();
  for (const item of items) {
    // The same title can sit on two instances; the furthest-along wins, since
    // "already available somewhere" is the more useful thing to be told.
    const seen = tracked.get(item.externalId);
    if (!seen || rank(item.status) > rank(seen)) {
      tracked.set(item.externalId, item.status);
    }
  }
  return tracked;
}

const STATUS_RANK: Record<MediaStatus, number> = {
  [MediaStatus.REJECTED]: 0,
  [MediaStatus.FAILED]: 1,
  [MediaStatus.PENDING]: 2,
  [MediaStatus.QUEUED]: 3,
  [MediaStatus.GRABBED]: 4,
  [MediaStatus.AVAILABLE]: 5,
  [MediaStatus.ALREADY_HAVE]: 5,
};

function rank(status: MediaStatus): number {
  return STATUS_RANK[status];
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
  /** The instance holds a playable file; nothing was sent. */
  | { kind: "already_have"; mediaItem: MediaItem; subscription: Subscription }
  /**
   * The instance manages the title but holds no file. `resumed` means it was
   * sitting there unmonitored and Askarr put it back under watch.
   */
  | {
      kind: "already_tracked";
      mediaItem: MediaItem;
      subscription: Subscription;
      resumed: boolean;
    }
  /** Someone already requested it; this person was added as a subscriber. */
  | {
      kind: "already_requested";
      mediaItem: MediaItem;
      subscription: Subscription;
      status: MediaStatus;
      note: string | null;
    }
  /** This person had already requested this exact title. */
  | {
      kind: "duplicate";
      mediaItem: MediaItem;
      status: MediaStatus;
      note: string | null;
    }
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
    /*
     * Ask the instance again rather than answering from our own row.
     *
     * The stored status is a snapshot taken when the request was made, and
     * nothing updates it except a webhook — so an install whose webhook was
     * missing, or briefly down, answers "queued and looking for a release"
     * about a film that has been sitting on disk for a week. Re-checking on a
     * repeat request is cheap, happens rarely, and heals the row.
     */
    const state = await refreshFromInstance(instance, existingItem);
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
        mediaItem: state.mediaItem,
        status: state.mediaItem.status,
        note: state.note,
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

    if (state.mediaItem.status === MediaStatus.ALREADY_HAVE) {
      return { kind: "already_have", mediaItem: state.mediaItem, subscription };
    }
    return {
      kind: "already_requested",
      mediaItem: state.mediaItem,
      subscription,
      status: state.mediaItem.status,
      note: state.note,
    };
  }

  // ---- Not tracked yet. Ask the instance what it already knows about it.
  let onInstance: {
    arrId: number | null;
    hasFile: boolean;
    monitored: boolean;
  } | null = null;
  try {
    const fresh = await lookupByExternalId(instance, selection.externalId);
    if (fresh?.alreadyManaged) {
      onInstance = {
        arrId: fresh.arrId,
        hasFile: fresh.hasFile,
        monitored: fresh.monitored,
      };
    }
  } catch (error) {
    return {
      kind: "error",
      message:
        error instanceof ArrError
          ? error.hint
          : `Could not reach ${instance.label}. Try again in a moment.`,
    };
  }

  if (onInstance) {
    // Holding a file is the only state that means "go watch it".
    if (onInstance.hasFile) {
      const { mediaItem, subscription } = await createItemWithSubscription({
        params,
        status: MediaStatus.ALREADY_HAVE,
        statusReason: "Already in the library when requested",
        arrId: onInstance.arrId,
      });
      // Nothing is sent to the instance in this branch, by design.
      return { kind: "already_have", mediaItem, subscription };
    }

    /*
     * Managed but empty. Unmonitored is the case that matters: the instance
     * will never search for it, so answering "we have it" would leave the
     * request doing nothing at all. Putting it back under watch is the only
     * response that makes the request mean something.
     */
    let resumed = false;
    if (!onInstance.monitored && onInstance.arrId !== null) {
      try {
        await resumeOnInstance(instance, onInstance.arrId);
        resumed = true;
      } catch (error) {
        return {
          kind: "error",
          message:
            error instanceof ArrError
              ? error.hint
              : `${selection.title} is on ${instance.label} but not being searched for, and it could not be restarted. An admin needs to monitor it.`,
        };
      }
    }

    const { mediaItem, subscription } = await createItemWithSubscription({
      params,
      status: MediaStatus.QUEUED,
      statusReason: resumed
        ? "Was on the instance unmonitored; monitoring resumed and a search started"
        : "Already on the instance, waiting for a release",
      arrId: onInstance.arrId,
    });
    return { kind: "already_tracked", mediaItem, subscription, resumed };
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

/**
 * Re-reads a tracked title from the instance and corrects the stored row.
 *
 * Returns the item as it now stands, plus a short note explaining anything the
 * status alone cannot say — chiefly that a title is announced but unreleased,
 * which is why an otherwise healthy request never produces anything.
 */
async function refreshFromInstance(
  instance: ArrInstance,
  item: MediaItem,
): Promise<{ mediaItem: MediaItem; note: string | null }> {
  let fresh: LookupResult | null = null;
  try {
    fresh = await lookupByExternalId(instance, item.externalId);
  } catch {
    // The instance being unreachable is not a reason to fail a duplicate
    // check; answer from the row we have.
    return { mediaItem: item, note: null };
  }

  if (!fresh?.alreadyManaged) return { mediaItem: item, note: null };

  const note = describeInstanceState(fresh, instance.label);

  // The instance holds a file but our row never heard about it: the webhook
  // was missing or down when it landed.
  const stale =
    fresh.hasFile &&
    item.status !== MediaStatus.AVAILABLE &&
    item.status !== MediaStatus.ALREADY_HAVE;

  if (!stale) return { mediaItem: item, note };

  const mediaItem = await prisma.mediaItem.update({
    where: { id: item.id },
    data: {
      status: MediaStatus.AVAILABLE,
      statusReason: `Found on ${instance.label} during a later check`,
    },
  });

  /*
   * Tell the subscribers now rather than leaving it to the drain.
   *
   * The drain holds an item back for the aggregation window, which exists to
   * group the episodes of a season arriving in a burst. Nothing is arriving
   * here — the file landed long ago and we have only just noticed — so the
   * window would be ten minutes of silence after a person pressed a button.
   *
   * Not awaited: the requester is waiting on a reply, and notifyMediaAvailable
   * never throws.
   */
  void notifyMediaAvailable(mediaItem.id);

  return { mediaItem, note };
}

/** The one thing the instance knows that a MediaStatus cannot express. */
function describeInstanceState(
  fresh: LookupResult,
  instanceLabel: string,
): string | null {
  if (fresh.hasFile) return null;

  const status = (fresh.releaseStatus ?? "").toLowerCase();
  if (status === "announced" || status === "tba" || status === "upcoming") {
    return `${instanceLabel} has it, but it has not been released yet — there is nothing to find until it is.`;
  }
  if (!fresh.monitored) {
    return `${instanceLabel} has it but is not searching for it.`;
  }
  return `${instanceLabel} has it and is still looking for a release.`;
}

// ---------------------------------------------------------------- approval

/**
 * Who approved a request.
 *
 * Approvals arrive from two places with two disjoint identity spaces: a
 * Telegram admin tapping a button only has a TelegramUser.id, while a web
 * admin only has a User.id. `Subscription.approvedById` is a bare String with
 * no relation, so nothing in the schema stops those two being mixed into one
 * column and silently pointing at the wrong table.
 *
 * The value is therefore tagged at the point of writing. Always build it with
 * one of these helpers rather than passing a raw id.
 */
export type Approver =
  | { source: "telegram"; id: string }
  | { source: "web"; id: string };

export function telegramApprover(telegramUserId: string): string {
  return `tg:${telegramUserId}`;
}

export function webApprover(userId: string): string {
  return `web:${userId}`;
}

/** Reads a tagged approver back. Untagged legacy values are treated as web. */
export function parseApprover(value: string | null): Approver | null {
  if (!value) return null;
  if (value.startsWith("tg:")) {
    return { source: "telegram", id: value.slice(3) };
  }
  if (value.startsWith("web:")) {
    return { source: "web", id: value.slice(4) };
  }
  return { source: "web", id: value };
}

/** Resolves a tagged approver to a display name for the back office. */
export async function describeApprover(
  value: string | null,
): Promise<string | null> {
  const approver = parseApprover(value);
  if (!approver) return null;

  if (approver.source === "telegram") {
    const user = await prisma.telegramUser.findUnique({
      where: { id: approver.id },
      select: { displayName: true },
    });
    return user?.displayName ?? "A Telegram admin";
  }

  const user = await prisma.user.findUnique({
    where: { id: approver.id },
    select: { name: true },
  });
  return user?.name ?? "An admin";
}

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
