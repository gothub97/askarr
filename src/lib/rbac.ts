import { MediaKind, TelegramRole, type TelegramUser } from "@prisma/client";
import type { QuotaState } from "./quota";

/** Outcome of applying the role rules to one request. */
export type ApprovalDecision =
  | { approved: true }
  | { approved: false; reason: "role" | "quota" | "full_series" };

export interface ApprovalInput {
  role: TelegramRole;
  kind: MediaKind;
  /** Sonarr only: a full-series request can trigger hundreds of grabs. */
  monitorMode: string | null;
  quota: QuotaState;
}

export function decideApproval(input: ApprovalInput): ApprovalDecision {
  const { role, kind, monitorMode, quota } = input;

  // BLOCKED never reaches this point, but never auto-approve it either.
  if (role === TelegramRole.BLOCKED) {
    return { approved: false, reason: "role" };
  }

  if (role === TelegramRole.ADMIN) {
    return { approved: true };
  }

  if (role === TelegramRole.TRUSTED) {
    // A full series always goes through review, whatever the quota says.
    if (kind === MediaKind.SERIES && monitorMode === "all") {
      return { approved: false, reason: "full_series" };
    }
    if (quota.exceeded) {
      return { approved: false, reason: "quota" };
    }
    return { approved: true };
  }

  // GUEST
  return { approved: false, reason: "role" };
}

export function isTelegramAdmin(
  user: Pick<TelegramUser, "role"> | null | undefined,
): boolean {
  return user?.role === TelegramRole.ADMIN;
}

export function canRequest(
  user: Pick<TelegramUser, "role"> | null | undefined,
): boolean {
  return !!user && user.role !== TelegramRole.BLOCKED;
}
