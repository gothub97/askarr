import Link from "next/link";
import { ActionButton } from "@/components/admin/action-button";
import { formatTimestamp } from "@/components/admin/data";
import { EmptyState } from "@/components/admin/empty-state";
import { PageHeader } from "@/components/admin/page-header";
import { prisma } from "@/lib/prisma";
import { getQuotaState } from "@/lib/quota";
import { listUserRequests } from "@/lib/requests";
import { UsersTable, type TelegramUserRow } from "./users-table";

export const dynamic = "force-dynamic";

const HISTORY_LIMIT = 8;

export default async function UsersPage() {
  const users = await prisma.telegramUser.findMany({
    orderBy: [{ role: "asc" }, { displayName: "asc" }],
  });

  // A private instance has a handful of people; a query per person is cheaper
  // to read than a hand-rolled aggregate.
  const rows: TelegramUserRow[] = await Promise.all(
    users.map(async (user) => {
      const [quota, history] = await Promise.all([
        getQuotaState(user),
        listUserRequests(user.id, HISTORY_LIMIT),
      ]);

      return {
        id: user.id,
        // BigInt cannot cross to a client component; send the digits.
        telegramId: user.telegramId.toString(),
        displayName: user.displayName,
        username: user.username,
        role: user.role,
        quotaPerMonth: user.quotaPerMonth,
        quotaUsed: quota.used,
        history: history.map((subscription) => ({
          id: subscription.id,
          title: subscription.mediaItem.title,
          year: subscription.mediaItem.year,
          status: subscription.mediaItem.status,
          instanceLabel: subscription.mediaItem.instance.label,
          createdAt: formatTimestamp(subscription.createdAt),
        })),
      };
    }),
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Telegram users"
        description="Who may ask for what, and how much of it."
      />

      {rows.length === 0 ? (
        <EmptyState
          title="Nobody has talked to the bot yet."
          hint="People appear here as guests the first time they message the bot in an allowed group."
          action={
            <ActionButton render={<Link href="/chats" />} size="sm">
              Allow a group
            </ActionButton>
          }
        />
      ) : (
        <UsersTable users={rows} />
      )}
    </div>
  );
}
