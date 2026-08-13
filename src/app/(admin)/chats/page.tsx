import { formatTimestamp } from "@/components/admin/data";
import { PageHeader } from "@/components/admin/page-header";
import { readBotStatus } from "@/lib/bot-control";
import { prisma } from "@/lib/prisma";
import { ChatsTable, type ChatRow } from "./chats-table";
import { DiscoveredChats } from "./discovered-chats";

export const dynamic = "force-dynamic";

export default async function ChatsPage() {
  const [chats, status] = await Promise.all([
    prisma.telegramChat.findMany({ orderBy: { createdAt: "desc" } }),
    readBotStatus(),
  ]);

  const rows: ChatRow[] = chats.map((chat) => ({
    id: chat.id,
    // BigInt cannot cross to a client component; send the digits.
    chatId: chat.chatId.toString(),
    title: chat.title,
    requestThreadId: chat.requestThreadId,
    adminThreadId: chat.adminThreadId,
    generalThreadId: chat.generalThreadId,
    enabled: chat.enabled,
    createdAt: formatTimestamp(chat.createdAt),
  }));

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Groups"
        description="Only allowed groups can ask Askarr for anything."
      />

      {/* The allowed groups first — that is the list an operator maintains.
          Discovery sits underneath, because it only matters while adding one. */}
      {rows.length > 0 && <ChatsTable chats={rows} />}

      <DiscoveredChats
        initialChats={chats.slice(0, 20).map((chat) => ({
          id: chat.id,
          chatId: chat.chatId.toString(),
          title: chat.title,
          enabled: chat.enabled,
        }))}
        initialBotUsername={status.runtime?.username ?? null}
      />
    </div>
  );
}
