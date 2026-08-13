import type {
  MediaKind,
  MediaStatus,
  TelegramRole,
} from "@prisma/client";

/**
 * The wire contract between /api/miniapp/* and the Mini App client.
 *
 * Types only, so the file is erased at build time and can be imported from a
 * route handler and a client component alike. Every BigInt is a string here:
 * Telegram ids do not survive JSON numbers.
 */

export interface ApiErrorBody {
  error: string;
  code?: string;
}

// ------------------------------------------------------------------- me

export interface QuotaDto {
  /** 0 means unlimited. */
  limit: number;
  used: number;
  /** null when unlimited. */
  remaining: number | null;
  exceeded: boolean;
}

export interface MeDto {
  id: string;
  telegramId: string;
  username: string | null;
  displayName: string;
  role: TelegramRole;
  isAdmin: boolean;
  canRequest: boolean;
  quota: QuotaDto;
  /**
   * Enabled instances per kind. The picker is only worth showing
   * when a kind has more than one.
   */
  instances: Record<MediaKind, InstanceOption[]>;
}

/** An instance a requester can send a title to, named as the admin named it. */
export interface InstanceOption {
  id: string;
  label: string;
}

// --------------------------------------------------------------- requests

export interface RequestDto {
  subscriptionId: string;
  mediaItemId: string;
  kind: MediaKind;
  /** tmdbId for movies, tvdbId for series. */
  externalId: number;
  title: string;
  year: number | null;
  overview: string | null;
  posterUrl: string | null;
  status: MediaStatus;
  statusReason: string | null;
  instanceLabel: string;
  monitorMode: string | null;
  /** ISO 8601. */
  requestedAt: string;
}

export interface RequestListDto {
  requests: RequestDto[];
}

// ----------------------------------------------------------------- search

export interface SearchResultDto {
  externalId: number;
  title: string;
  year: number | null;
  overview: string | null;
  posterUrl: string | null;
  alreadyManaged: boolean;
  latestSeason: number | null;
}

export interface SearchResponseDto {
  ok: boolean;
  results: SearchResultDto[];
  instanceLabel: string | null;
  /** Product-register copy, ready to display. */
  error?: string;
}

// ----------------------------------------------------------------- submit

export type SubmitOutcomeKind =
  | "queued"
  | "pending"
  | "already_have"
  | "already_requested"
  | "duplicate"
  | "blocked"
  | "error";

export interface SubmitResponseDto {
  outcome: SubmitOutcomeKind;
  /** One sentence, already written for a person. */
  message: string;
  title: string;
  status: MediaStatus | null;
}

// ------------------------------------------------------------------ admin

export interface PendingRequesterDto {
  id: string;
  displayName: string;
  username: string | null;
}

export interface PendingRequestDto {
  mediaItemId: string;
  kind: MediaKind;
  externalId: number;
  title: string;
  year: number | null;
  overview: string | null;
  posterUrl: string | null;
  instanceLabel: string;
  monitorMode: string | null;
  statusReason: string | null;
  requestedAt: string;
  requesters: PendingRequesterDto[];
}

export interface PendingListDto {
  pending: PendingRequestDto[];
}

export interface AdminUserDto {
  id: string;
  telegramId: string;
  username: string | null;
  displayName: string;
  role: TelegramRole;
  /** 0 means unlimited. */
  quotaPerMonth: number;
  /** Requests made inside the rolling quota window. */
  usedThisWindow: number;
  createdAt: string;
  /** True for the caller: the UI must not offer them a way to demote themselves. */
  isSelf: boolean;
}

export interface AdminUserListDto {
  users: AdminUserDto[];
}

export interface AdminActionDto {
  ok: boolean;
  message: string;
  status?: MediaStatus;
}
