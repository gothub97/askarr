import { formatTimestamp } from "@/components/admin/data";
import { EmptyState } from "@/components/admin/empty-state";
import { PageHeader } from "@/components/admin/page-header";
import { prisma } from "@/lib/prisma";
import { ChatsTable, type ChatRow } from "./chats-table";

export const dynamic = "force-dynamic";

export default async function ChatsPage() {
  const chats = await prisma.telegramChat.findMany({
    orderBy: { createdAt: "desc" },
  });

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
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Groups"
        description="Only allowed groups can ask Askarr for anything."
      />

      {rows.length === 0 ? (
        <EmptyState
          title="No group has talked to the bot yet."
          hint="Add the bot to your private group and send it a message. The group appears here, revoked, and you allow it from this page."
        />
      ) : (
        <ChatsTable chats={rows} />
      )}
    </div>
  );
}
