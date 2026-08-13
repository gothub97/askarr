import { AudioVersion } from "@prisma/client";
import { InlineKeyboard } from "grammy";
import type { LookupResult } from "../../lib/servarr/types";
import { buttonLabel } from "../render";
import { type Choice, encodeCallback, encodeChoice } from "./callback";

const CANCEL_LABEL = "Cancel";

const VERSION_LABEL: Record<AudioVersion, string> = {
  [AudioVersion.VO]: "Original audio (VO)",
  [AudioVersion.MULTI]: "Multi audio",
};

/** One row per result: labels are long and wrap badly side by side. */
export function resultsKeyboard(
  draftId: string,
  results: LookupResult[],
): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  results.forEach((result, index) => {
    keyboard
      .text(buttonLabel(result), encodeCallback({ action: "p", id: draftId, arg: String(index) }))
      .row();
  });
  return keyboard.text(CANCEL_LABEL, cancelData(draftId));
}

export function versionKeyboard(
  draftId: string,
  choice: Choice,
  versions: AudioVersion[],
): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  for (const version of versions) {
    keyboard.text(
      VERSION_LABEL[version],
      encodeCallback({
        action: "s",
        id: draftId,
        arg: encodeChoice({ ...choice, version }),
      }),
    );
  }
  return keyboard.row().text(CANCEL_LABEL, cancelData(draftId));
}

export function monitorKeyboard(
  draftId: string,
  choice: Choice,
): InlineKeyboard {
  return new InlineKeyboard()
    .text(
      "Full series",
      encodeCallback({
        action: "s",
        id: draftId,
        arg: encodeChoice({ ...choice, monitor: "all" }),
      }),
    )
    .text(
      "Current season",
      encodeCallback({
        action: "s",
        id: draftId,
        arg: encodeChoice({ ...choice, monitor: "lastSeason" }),
      }),
    )
    .row()
    .text(CANCEL_LABEL, cancelData(draftId));
}

export function confirmKeyboard(
  draftId: string,
  choice: Choice,
): InlineKeyboard {
  return new InlineKeyboard()
    .text(
      "Request it",
      encodeCallback({ action: "c", id: draftId, arg: encodeChoice(choice) }),
    )
    .text(CANCEL_LABEL, cancelData(draftId));
}

/** Attached to the pending ping; the handler still re-checks the clicker. */
export function approvalKeyboard(mediaItemId: string): InlineKeyboard {
  return new InlineKeyboard()
    .text("Approve", encodeCallback({ action: "ap", id: mediaItemId, arg: "" }))
    .text("Reject", encodeCallback({ action: "rj", id: mediaItemId, arg: "" }));
}

/**
 * A plain URL button, not a `web_app` one: Telegram only allows web_app
 * buttons in private chats, and Askarr lives in the group.
 */
export function miniAppKeyboard(url: string): InlineKeyboard {
  return new InlineKeyboard().url("Open Askarr", url);
}

export function backOfficeKeyboard(url: string): InlineKeyboard {
  return new InlineKeyboard().url("Open the back office", url);
}

function cancelData(draftId: string): string {
  return encodeCallback({ action: "x", id: draftId, arg: "" });
}
