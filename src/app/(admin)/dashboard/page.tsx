import { MediaStatus } from "@prisma/client";
import Link from "next/link";
import { ActionButton } from "@/components/admin/action-button";
import { Data, formatTimestamp } from "@/components/admin/data";
import { EmptyState } from "@/components/admin/empty-state";
import { PageHeader, SectionTitle } from "@/components/admin/page-header";
import { StatusRail } from "@/components/status-rail";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { pingInstances } from "@/lib/instances";
import { countPendingRequests, listPendingRequests } from "@/lib/requests";

// Instance health is a live probe over the network, so this page is never cached.
export const dynamic = "force-dynamic";

function startOfMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

export default async function DashboardPage() {
  const [
    pendingCount,
    inProgressCount,
    availableThisMonth,
    health,
    events,
    instances,
    pending,
  ] = await Promise.all([
    countPendingRequests(),
    prisma.mediaItem.count({
      where: { status: { in: [MediaStatus.QUEUED, MediaStatus.GRABBED] } },
    }),
    prisma.mediaItem.count({
      where: { status: MediaStatus.AVAILABLE, updatedAt: { gte: startOfMonth() } },
    }),
    pingInstances(),
    prisma.arrEvent.findMany({
      orderBy: { receivedAt: "desc" },
      take: 10,
      include: { mediaItem: { select: { title: true } } },
    }),
    prisma.arrInstance.findMany({ select: { id: true, label: true } }),
    listPendingRequests(5),
  ]);

  const instanceLabels = new Map(instances.map((i) => [i.id, i.label]));
  const hasInstances = instances.length > 0;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Dashboard"
        description="What the screening room is doing right now."
      />

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Counter
          value={pendingCount}
          label="Waiting for approval"
          href="/requests?status=PENDING"
        />
        <Counter
          value={inProgressCount}
          label="In progress"
          href="/requests?status=QUEUED"
        />
        <Counter value={availableThisMonth} label="Available this month" />
      </section>

      <section className="flex flex-col gap-3">
        <SectionTitle>Instance health</SectionTitle>
        {!hasInstances ? (
          <EmptyState
            title="No instance is connected yet."
            hint="Askarr needs at least one Radarr or Sonarr instance before anyone can request anything."
            action={
              <ActionButton render={<Link href="/instances" />} size="sm">
                Add your first instance
              </ActionButton>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {health.map((instance) => (
              <Card key={instance.id} size="sm">
                <CardContent className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="truncate text-sm text-foreground">
                      {instance.label}
                    </span>
                    <Data className="text-muted-foreground">
                      {instance.ok
                        ? `v${instance.version ?? "unknown"}`
                        : (instance.message ?? "Unreachable.")}
                    </Data>
                  </div>
                  <span
                    className={
                      instance.ok
                        ? "shrink-0 text-xs text-positive"
                        : "shrink-0 text-xs text-destructive"
                    }
                  >
                    {instance.ok ? "Reachable" : "Unreachable"}
                  </span>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <SectionTitle>Waiting for approval</SectionTitle>
          <Link href="/requests?status=PENDING" className="text-xs text-brand">
            Open requests
          </Link>
        </div>
        {pending.length === 0 ? (
          <EmptyState
            title="No requests waiting."
            hint="Approved and auto-approved titles show up in the activity list below."
          />
        ) : (
          <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
            {pending.map((item) => (
              <li key={item.id} className="flex flex-col gap-2 px-3 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <span className="text-sm text-foreground">
                    {item.title}
                    {item.year ? (
                      <span className="text-muted-foreground"> ({item.year})</span>
                    ) : null}
                  </span>
                  <Data className="text-muted-foreground">
                    {item.instance.label} · {formatTimestamp(item.createdAt)}
                  </Data>
                </div>
                <StatusRail status={item.status} />
                <p className="text-xs text-muted-foreground">
                  Asked by{" "}
                  {item.subscriptions
                    .map((s) => s.telegramUser.displayName)
                    .join(", ") || "someone who has since been removed"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <SectionTitle>Recent activity</SectionTitle>
        {events.length === 0 ? (
          <EmptyState
            title="No events received yet."
            hint="Radarr and Sonarr report progress through the webhook. Add it from the instance page, then press Test."
            action={
              <Button
                render={<Link href="/instances" />}
                size="sm"
                variant="outline"
              >
                Set up the webhook
              </Button>
            }
          />
        ) : (
          <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
            {events.map((event) => (
              <li
                key={event.id}
                className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-3 py-2"
              >
                <div className="flex min-w-0 items-baseline gap-2">
                  <Data className="text-brand">{event.eventType}</Data>
                  <span className="truncate text-sm text-foreground">
                    {event.mediaItem?.title ?? "Untracked title"}
                  </span>
                </div>
                <Data className="text-muted-foreground">
                  {instanceLabels.get(event.instanceId) ?? event.instanceId} ·{" "}
                  {formatTimestamp(event.receivedAt)}
                </Data>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Counter({
  value,
  label,
  href,
}: {
  value: number;
  label: string;
  href?: string;
}) {
  const body = (
    <>
      <span className="font-display text-2xl leading-none text-foreground">
        {value}
      </span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="flex flex-col gap-2 rounded-lg border border-border bg-card px-4 py-4 transition-colors hover:border-brand"
      >
        {body}
      </Link>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-card px-4 py-4">
      {body}
    </div>
  );
}
