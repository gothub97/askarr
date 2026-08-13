import type { TelegramChat } from "@prisma/client";

/**
 * Which forum topic a message belongs in.
 *
 * A forum group splits one chat into topics, and Askarr's three kinds of
 * message want different ones: people ask in #request, admins decide in
 * #admin, arrivals are announced in #general. All three are optional — a
 * plain group has no topics at all, and every helper falls back to the topic
 * the conversation is already in.
 *
 * The hard constraint underneath: Telegram will not let a message reply to
 * one in a different topic. Any reply that crosses topics has to become a
 * plain message with a mention, or Telegram answers 400.
 */

export type Purpose = "request" | "admin" | "general";

export function topicFor(
  chat: Pick<
    TelegramChat,
    "requestThreadId" | "adminThreadId" | "generalThreadId"
  >,
  purpose: Purpose,
): number | null {
  switch (purpose) {
    case "request":
      return chat.requestThreadId;
    case "admin":
      return chat.adminThreadId;
    case "general":
      return chat.generalThreadId;
  }
}

/**
 * True when a reply would have to cross topics, which Telegram rejects.
 *
 * Callers use this to decide between replying to the original message and
 * sending a plain message that mentions the person instead.
 */
export function crossesTopic(
  from: number | null,
  to: number | null,
): boolean {
  return (from ?? null) !== (to ?? null);
}
