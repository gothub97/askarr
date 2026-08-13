import { PageHeader } from "@/components/admin/page-header";
import { readBotStatus } from "@/lib/bot-control";
import { getBotTokenState } from "@/lib/bot-token";
import { prisma } from "@/lib/prisma";
import { BotManager } from "./bot-manager";

export const dynamic = "force-dynamic";

export default async function BotPage() {
  const [token, status, chats] = await Promise.all([
    getBotTokenState(),
    readBotStatus(),
    prisma.telegramChat.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Bot"
        description="The token Askarr talks to Telegram with, and the groups that found it."
      />

      <BotManager
        initialOverview={{
          token,
          status,
          envSeedPresent: Boolean(process.env.TELEGRAM_BOT_TOKEN),
        }}
        initialChats={chats.map((chat) => ({
          id: chat.id,
          // BigInt cannot cross to a client component; send the digits.
          chatId: chat.chatId.toString(),
          title: chat.title,
          enabled: chat.enabled,
        }))}
      />
    </div>
  );
}
