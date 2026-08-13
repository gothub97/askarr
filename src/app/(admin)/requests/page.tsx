import { MediaStatus, type Prisma } from "@prisma/client";
import Link from "next/link";
import { formatTimestamp } from "@/components/admin/data";
import { EmptyState } from "@/components/admin/empty-state";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";
import { statusLabel } from "@/lib/status";
import {
  RequestsFilters,
  type FilterOption,
} from "./requests-filters";
import { RequestsTable, type RequestRow } from "./requests-table";

export const dynamic = "force-dynamic";

const MAX_ROWS = 100;

const STATUS_OPTIONS: FilterOption[] = Object.values(MediaStatus).map(
  (status) => ({ value: status, label: statusLabel(status) }),
);

function readParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
): string {
  const value = params[key];
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function parseStatus(value: string): MediaStatus | null {
  return (Object.values(MediaStatus) as string[]).includes(value)
    ? (value as MediaStatus)
    : null;
}

export default async function RequestsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const search = readParam(params, "q");
  const status = parseStatus(readParam(params, "status"));
  const requester = readParam(params, "requester");
  const instance = readParam(params, "instance");

  const where: Prisma.MediaItemWhereInput = {};
  if (search) where.title = { contains: search, mode: "insensitive" };
  if (status) where.status = status;
  if (instance) where.instanceId = instance;
  if (requester) where.subscriptions = { some: { telegramUserId: requester } };

  const [items, instances, requesters, totalCount] = await Promise.all([
    prisma.mediaItem.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: MAX_ROWS,
      include: {
        instance: { select: { label: true } },
        subscriptions: {
          include: { telegramUser: { select: { displayName: true } } },
        },
      },
    }),
    prisma.arrInstance.findMany({
      orderBy: { label: "asc" },
      select: { id: true, label: true },
    }),
    prisma.telegramUser.findMany({
      orderBy: { displayName: "asc" },
      select: { id: true, displayName: true },
    }),
    prisma.mediaItem.count(),
  ]);

  const rows: RequestRow[] = items.map((item) => ({
    id: item.id,
    title: item.title,
    year: item.year,
    kind: item.kind,
    externalId: item.externalId,
    status: item.status,
    posterUrl: item.posterUrl,
    statusReason: item.statusReason,
    instanceLabel: item.instance.label,
    requesters: item.subscriptions.map((s) => s.telegramUser.displayName),
    createdAt: formatTimestamp(item.createdAt),
  }));

  const filtering = Boolean(search || status || requester || instance);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Requests"
        description="Approve, reject or retry what the group has asked for."
      />

      <RequestsFilters
        filters={{
          search,
          status: status ?? "all",
          requester: requester || "all",
          instance: instance || "all",
        }}
        statuses={STATUS_OPTIONS}
        requesters={requesters.map((user) => ({
          value: user.id,
          label: user.displayName,
        }))}
        instances={instances.map((item) => ({
          value: item.id,
          label: item.label,
        }))}
      />

      {rows.length === 0 ? (
        filtering ? (
          <EmptyState
            title="No request matches these filters."
            hint="Widen the search or clear the filters to see everything."
            action={
              <Button
                render={<Link href="/requests" />} nativeButton={false}
                size="sm"
                variant="outline"
              >
                Clear filters
              </Button>
            }
          />
        ) : (
          <EmptyState
            title="No requests waiting."
            hint="Requests arrive from the Telegram group. Check that the group is allowed and that an instance is connected."
            action={
              <Button render={<Link href="/chats" />} nativeButton={false} size="sm">
                Allow a group
              </Button>
            }
          />
        )
      ) : (
        <>
          <RequestsTable rows={rows} />
          {totalCount > rows.length && (
            <p className="text-sm text-muted-foreground">
              Showing the {rows.length} most recent of {totalCount}. Narrow the
              search to reach older ones.
            </p>
          )}
        </>
      )}
    </div>
  );
}
