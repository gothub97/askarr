import { MediaStatus } from "@prisma/client";

/**
 * A request's status, expressed in the *arr vocabulary.
 *
 * The family has one semantic set — the `kind` — that every label, button and
 * progress bar takes. Mapping our seven statuses onto it once, here, is what
 * keeps a status looking the same wherever it appears.
 */
export type StatusKind =
  | "default"
  | "primary"
  | "success"
  | "warning"
  | "danger"
  | "queue";

export function statusKind(status: MediaStatus): StatusKind {
  switch (status) {
    // Waiting on a person, which is the one thing an operator can act on.
    case MediaStatus.PENDING:
      return "warning";
    // The family's purple means "known about, not here yet".
    case MediaStatus.QUEUED:
      return "queue";
    case MediaStatus.GRABBED:
      return "primary";
    case MediaStatus.AVAILABLE:
    case MediaStatus.ALREADY_HAVE:
      return "success";
    case MediaStatus.REJECTED:
    case MediaStatus.FAILED:
      return "danger";
  }
}

/**
 * How far along a request is, 0–100, for the progress bar.
 *
 * The four stages behind these numbers are requested, approved, grabbed, here.
 * Rejected and failed sit at the point they stopped rather than at zero: the
 * bar shows how far it got, and the label says it is not going further.
 */
export function statusProgress(status: MediaStatus): number {
  switch (status) {
    case MediaStatus.PENDING:
      return 10;
    case MediaStatus.QUEUED:
      return 40;
    case MediaStatus.GRABBED:
      return 75;
    case MediaStatus.AVAILABLE:
    case MediaStatus.ALREADY_HAVE:
      return 100;
    case MediaStatus.REJECTED:
      return 10;
    case MediaStatus.FAILED:
      return 40;
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

/**
 * The same status as a short label, for a table cell or a chip where the full
 * sentence would wrap. `statusLabel` stays the long form: it is what the bot
 * says, and the two must not drift.
 */
export function statusShortLabel(status: MediaStatus): string {
  switch (status) {
    case MediaStatus.PENDING:
      return "Waiting";
    case MediaStatus.REJECTED:
      return "Rejected";
    case MediaStatus.QUEUED:
      return "Searching";
    case MediaStatus.GRABBED:
      return "Downloading";
    case MediaStatus.AVAILABLE:
      return "Available";
    case MediaStatus.FAILED:
      return "Failed";
    case MediaStatus.ALREADY_HAVE:
      return "In library";
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
