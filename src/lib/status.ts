import { MediaStatus } from "@prisma/client";

/** The four notches of the status rail, in order. */
export const RAIL_STEPS = [
  "Requested",
  "Approved",
  "Grabbed",
  "Available",
] as const;

export type RailStep = (typeof RAIL_STEPS)[number];

/** How far along the rail a status has reached. 0 means "requested only". */
export function railProgress(status: MediaStatus): number {
  switch (status) {
    case MediaStatus.PENDING:
      return 0;
    case MediaStatus.QUEUED:
      return 1;
    case MediaStatus.GRABBED:
      return 2;
    case MediaStatus.AVAILABLE:
    case MediaStatus.ALREADY_HAVE:
      return 3;
    // Rejected and failed stop at the first notch; the label carries the rest.
    case MediaStatus.REJECTED:
    case MediaStatus.FAILED:
      return 0;
  }
}

export type StatusTone = "waiting" | "progress" | "positive" | "negative";

export function statusTone(status: MediaStatus): StatusTone {
  switch (status) {
    case MediaStatus.PENDING:
      return "waiting";
    case MediaStatus.QUEUED:
    case MediaStatus.GRABBED:
      return "progress";
    case MediaStatus.AVAILABLE:
    case MediaStatus.ALREADY_HAVE:
      return "positive";
    case MediaStatus.REJECTED:
    case MediaStatus.FAILED:
      return "negative";
  }
}

/** Product-register labels. Never surface the raw enum to a person. */
export function statusLabel(status: MediaStatus): string {
  switch (status) {
    case MediaStatus.PENDING:
      return "Waiting for approval";
    case MediaStatus.REJECTED:
      return "Rejected";
    case MediaStatus.QUEUED:
      return "Looking for a release";
    case MediaStatus.GRABBED:
      return "Downloading";
    case MediaStatus.AVAILABLE:
      return "Ready to watch";
    case MediaStatus.FAILED:
      return "Failed";
    case MediaStatus.ALREADY_HAVE:
      return "Already in the library";
  }
}

/** Same wording, phrased for a Telegram message. */
export function statusSentence(status: MediaStatus, title: string): string {
  switch (status) {
    case MediaStatus.PENDING:
      return `${title} is waiting for approval.`;
    case MediaStatus.REJECTED:
      return `${title} was rejected.`;
    case MediaStatus.QUEUED:
      return `${title} is queued and looking for a release.`;
    case MediaStatus.GRABBED:
      return `${title} is downloading.`;
    case MediaStatus.AVAILABLE:
      return `${title} is ready to watch.`;
    case MediaStatus.FAILED:
      return `${title} failed. An admin can retry it.`;
    case MediaStatus.ALREADY_HAVE:
      return `${title} is already in the library.`;
  }
}
