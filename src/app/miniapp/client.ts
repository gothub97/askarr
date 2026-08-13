import type {
  AdminActionDto,
  AdminUserDto,
  AdminUserListDto,
  ApiErrorBody,
  MeDto,
  PendingListDto,
  RequestListDto,
  SearchResponseDto,
  SubmitResponseDto,
} from "./types";
import type { AudioVersion, MediaKind, MediaStatus, TelegramRole } from "@prisma/client";

/**
 * The Mini App's only way of talking to the server.
 *
 * Every call carries the signed initData header. The string is captured once
 * at boot and closed over here so no call site can forget it — a request
 * without it is a 401, and a request with a hand-made one is also a 401.
 */

export const INIT_DATA_HEADER = "X-Telegram-Init-Data";

export class MiniAppApiError extends Error {
  readonly status: number;
  readonly code: string | undefined;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "MiniAppApiError";
    this.status = status;
    this.code = code;
  }
}

export interface MiniAppApi {
  me(): Promise<MeDto>;
  listRequests(statuses: MediaStatus[]): Promise<RequestListDto>;
  search(kind: MediaKind, term: string): Promise<SearchResponseDto>;
  submit(input: {
    kind: MediaKind;
    externalId: number;
    version?: AudioVersion;
    monitorMode?: "all" | "lastSeason" | null;
  }): Promise<SubmitResponseDto>;
  pending(): Promise<PendingListDto>;
  approve(mediaItemId: string): Promise<AdminActionDto>;
  reject(mediaItemId: string, reason?: string | null): Promise<AdminActionDto>;
  users(): Promise<AdminUserListDto>;
  updateUser(input: {
    telegramUserId: string;
    role?: TelegramRole;
    quotaPerMonth?: number;
  }): Promise<{ user: AdminUserDto }>;
}

export function createMiniAppApi(initData: string): MiniAppApi {
  async function call<T>(
    path: string,
    init?: { method?: "GET" | "POST"; body?: unknown; signal?: AbortSignal },
  ): Promise<T> {
    const headers: Record<string, string> = { [INIT_DATA_HEADER]: initData };
    if (init?.body !== undefined) headers["Content-Type"] = "application/json";

    let response: Response;
    try {
      response = await fetch(path, {
        method: init?.method ?? "GET",
        headers,
        body: init?.body === undefined ? undefined : JSON.stringify(init.body),
        // A Mini App is resumed from a suspended WebView; a cached answer would
        // show yesterday's queue.
        cache: "no-store",
        signal: init?.signal,
      });
    } catch {
      throw new MiniAppApiError(
        "Askarr is unreachable. Check your connection and try again.",
        0,
        "offline",
      );
    }

    const payload: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      const body = payload as ApiErrorBody | null;
      throw new MiniAppApiError(
        body?.error ?? "Something went wrong. Try again.",
        response.status,
        body?.code,
      );
    }

    return payload as T;
  }

  return {
    me: () => call<MeDto>("/api/miniapp/me"),

    listRequests: (statuses) => {
      const query = statuses.length ? `?status=${statuses.join(",")}` : "";
      return call<RequestListDto>(`/api/miniapp/requests${query}`);
    },

    search: (kind, term) =>
      call<SearchResponseDto>(
        `/api/miniapp/search?kind=${kind}&term=${encodeURIComponent(term)}`,
      ),

    submit: (input) =>
      call<SubmitResponseDto>("/api/miniapp/requests", {
        method: "POST",
        body: input,
      }),

    pending: () => call<PendingListDto>("/api/miniapp/admin/pending"),

    approve: (mediaItemId) =>
      call<AdminActionDto>("/api/miniapp/admin/approve", {
        method: "POST",
        body: { mediaItemId },
      }),

    reject: (mediaItemId, reason) =>
      call<AdminActionDto>("/api/miniapp/admin/reject", {
        method: "POST",
        body: { mediaItemId, reason: reason ?? null },
      }),

    users: () => call<AdminUserListDto>("/api/miniapp/admin/users"),

    updateUser: (input) =>
      call<{ user: AdminUserDto }>("/api/miniapp/admin/users", {
        method: "POST",
        body: input,
      }),
  };
}
