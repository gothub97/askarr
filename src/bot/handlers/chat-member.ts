import { Composer } from "grammy";
import { prisma } from "../../lib/prisma";
import type { AskarrContext } from "./context";

const JOINED = new Set(["member", "administrator", "creator"]);

export const chatMember = new Composer<AskarrContext>();

/**
 * Registered ahead of the guard, because a group the bot has just been added
 * to is by definition not in TelegramChat yet — the guard would drop the very
 * update that is supposed to create it.
 *
 * The row lands disabled. Onboarding step 3 is an admin flipping it on from
 * the back office; until then the group gets total silence.
 */
chatMember.on("my_chat_member", async (ctx) => {
  const { chat, new_chat_member: membership } = ctx.myChatMember;
  if (chat.type === "private") return;
  if (!JOINED.has(membership.status)) return;

  const title = "title" in chat ? chat.title : null;

  await prisma.telegramChat.upsert({
    where: { chatId: BigInt(chat.id) },
    // Never flip an already-approved chat back off just because the bot was
    // re-promoted or re-added.
    update: { title },
    create: { chatId: BigInt(chat.id), title, enabled: false },
  });

  console.log(`[askarr] registered chat ${chat.id} (${title ?? "untitled"}), disabled`);
});
