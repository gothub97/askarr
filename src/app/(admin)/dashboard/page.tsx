import { MediaStatus } from "@prisma/client";
import Link from "next/link";
import { Data, formatTimestamp } from "@/components/admin/data";
import { EmptyState } from "@/components/admin/empty-state";
import { PageHeader, SectionTitle } from "@/components/admin/page-header";
import { StatusProgress } from "@/components/progress-bar";
import { Poster } from "@/components/poster";
import { Label } from "@/components/status-label";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { prisma } from "@/lib/prisma";
import { pingInstances } from "@/lib/instances";
import { countPendingRequests, listPendingRequests } from "@/lib/requests";
import { payloadTitle } from "@/lib/webhooks/correlate";

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
      take: 12,
      include: { mediaItem: { select: { title: true } } },
    }),
    prisma.arrInstance.findMany({ select: { id: true, label: true } }),
    listPendingRequests(8),
  ]);

  const instanceLabels = new Map(instances.map((i) => [i.id, i.label]));
  const hasInstances = instances.length > 0;

  return (
    <div className="flex flex-col gap-5">
      {/*
        The three counts ride in the page header as labels rather than as a row
        of panels. Three big numbers on three cards is the shape every
        generated dashboard takes, and it spends the top third of the screen
        saying what one line says. The work starts immediately underneath.
      */}
      <PageHeader
        title="Dashboard"
        description="What the screening room is doing right now."
        action={
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <CountLabel
              value={pendingCount}
              noun="waiting"
              kind="warning"
              href="/requests?status=PENDING"
            />
            <CountLabel
              value={inProgressCount}
              noun="in progress"
              kind="queue"
              href="/requests?status=QUEUED"
            />
            <CountLabel
              value={availableThisMonth}
              noun="landed this month"
              kind="success"
            />
          </div>
        }
      />

      <section className="flex flex-col gap-2">
        <SectionTitle>Instances</SectionTitle>
        {!hasInstances ? (
          <EmptyState
            title="No instance is connected yet."
            hint="Askarr needs at least one Radarr or Sonarr instance before anyone can request anything."
            action={
              <Button render={<Link href="/instances" />} nativeButton={false} size="sm">
                Add your first instance
              </Button>
            }
          />
        ) : (
          <Panel>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Instance</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead className="w-px text-right">State</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {health.map((instance) => (
                  <TableRow key={instance.id}>
                    <TableCell className="font-bold">{instance.label}</TableCell>
                    <TableCell>
                      <Data className="text-muted-foreground">
                        {instance.ok
                          ? `v${instance.version ?? "unknown"}`
                          : (instance.message ?? "Unreachable.")}
                      </Data>
                    </TableCell>
                    <TableCell className="text-right">
                      <Label kind={instance.ok ? "success" : "danger"} size="sm">
                        {instance.ok ? "Reachable" : "Unreachable"}
                      </Label>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Panel>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <SectionTitle>Waiting for approval</SectionTitle>
          <Link
            href="/requests?status=PENDING"
            className="text-sm text-primary hover:underline"
          >
            Open requests
          </Link>
        </div>
        {pending.length === 0 ? (
          <EmptyState
            title="No requests waiting."
            hint="Approved and auto-approved titles show up in the activity list below."
          />
        ) : (
          <Panel>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-48">Title</TableHead>
                  <TableHead className="min-w-40">Progress</TableHead>
                  <TableHead className="min-w-36">Asked by</TableHead>
                  <TableHead className="min-w-44">Instance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pending.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="flex items-start gap-2.5">
                        <Poster url={item.posterUrl} className="h-12 w-8" />
                        <span className="min-w-0 font-bold">
                          {item.title}
                          {item.year ? (
                            <span className="font-normal text-muted-foreground">
                              {" "}
                              ({item.year})
                            </span>
                          ) : null}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusProgress status={item.status} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {item.subscriptions
                        .map((s) => s.telegramUser.displayName)
                        .join(", ") || "someone who has since been removed"}
                    </TableCell>
                    <TableCell>
                      <Data className="text-muted-foreground">
                        {item.instance.label} · {formatTimestamp(item.createdAt)}
                      </Data>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Panel>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <SectionTitle>Recent activity</SectionTitle>
        {events.length === 0 ? (
          <EmptyState
            title="No events received yet."
            hint="Radarr and Sonarr report progress through the webhook. Add it from the instance page, then press Test."
            action={
              <Button
                render={<Link href="/instances" />}
                nativeButton={false}
                size="sm"
                variant="outline"
              >
                Set up the webhook
              </Button>
            }
          />
        ) : (
          <Panel>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-px">Event</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead className="min-w-44 text-right">Instance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell>
                      <Label kind={eventKind(event.eventType)} size="sm">
                        {event.eventType}
                      </Label>
                    </TableCell>
                    <TableCell>
                      <EventTitle
                        tracked={event.mediaItem?.title ?? null}
                        fromPayload={payloadTitle(event.payload)}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Data className="text-muted-foreground">
                        {instanceLabels.get(event.instanceId) ?? event.instanceId} ·{" "}
                        {formatTimestamp(event.receivedAt)}
                      </Data>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Panel>
        )}
      </section>
    </div>
  );
}

/**
 * The title an event is about.
 *
 * Most events are for titles nobody asked Askarr for — someone added them in
 * Radarr, or Radarr upgraded a file on its own. Those are still worth showing
 * by name; they are just dimmed, because there is no request behind them and
 * nothing here to act on.
 */
function EventTitle({
  tracked,
  fromPayload,
}: {
  tracked: string | null;
  fromPayload: string | null;
}) {
  if (tracked) return <span>{tracked}</span>;
  if (fromPayload) {
    return (
      <span
        className="text-muted-foreground"
        title="Handled on the instance — nobody requested this through Askarr."
      >
        {fromPayload}
      </span>
    );
  }
  return <span className="text-muted-foreground">No title in the payload</span>;
}

/** A bordered surface holding a table. The one container this app has. */
function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-md border border-border bg-surface">
      {children}
    </div>
  );
}

/**
 * Radarr and Sonarr send these names verbatim, so the set is theirs, not ours.
 * Anything unrecognised stays neutral rather than being guessed at.
 */
function eventKind(eventType: string) {
  switch (eventType) {
    case "Download":
    case "MovieFileImported":
      return "success" as const;
    case "Grab":
      return "primary" as const;
    case "MovieAdded":
    case "SeriesAdd":
      return "queue" as const;
    default:
      return "default" as const;
  }
}

/** A count and what it counts, on one line. Links through when there is a view. */
function CountLabel({
  value,
  noun,
  kind,
  href,
}: {
  value: number;
  noun: string;
  kind: "warning" | "queue" | "success";
  href?: string;
}) {
  const body = (
    <>
      <Label kind={kind} size="sm">
        {value}
      </Label>
      <span className="text-sm text-muted-foreground">{noun}</span>
    </>
  );

  if (!href) {
    return <span className="inline-flex items-center gap-1.5">{body}</span>;
  }
  return (
    <Link href={href} className="group inline-flex items-center gap-1.5 rounded-sm">
      <Label kind={kind} size="sm">
        {value}
      </Label>
      <span className="text-sm text-muted-foreground group-hover:text-foreground">
        {noun}
      </span>
    </Link>
  );
}
