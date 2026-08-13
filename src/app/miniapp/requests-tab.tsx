"use client";

import type { MediaStatus } from "@prisma/client";
import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { StatusRail } from "@/components/status-rail";
import { MiniAppApiError, type MiniAppApi } from "./client";
import {
  Chip,
  DataTag,
  EmptyState,
  ErrorNote,
  ListSkeleton,
  Poster,
} from "./pieces";
import type { RequestDto } from "./types";

/**
 * Tab 1 — what this person has asked for, and how far along it is.
 *
 * The filters are groups rather than raw statuses: nobody thinks in terms of
 * GRABBED versus QUEUED, they think "is it moving yet".
 */

interface Filter {
  id: string;
  label: string;
  statuses: MediaStatus[];
}

const FILTERS: readonly Filter[] = [
  { id: "all", label: "All", statuses: [] },
  { id: "waiting", label: "Waiting", statuses: ["PENDING"] },
  { id: "moving", label: "In progress", statuses: ["QUEUED", "GRABBED"] },
  { id: "ready", label: "Ready", statuses: ["AVAILABLE", "ALREADY_HAVE"] },
  { id: "stopped", label: "Stopped", statuses: ["REJECTED", "FAILED"] },
];

export function RequestsTab({
  api,
  onSearch,
}: {
  api: MiniAppApi;
  onSearch: () => void;
}) {
  const [filterId, setFilterId] = useState<string>("all");
  const [requests, setRequests] = useState<RequestDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (nextFilterId: string) => {
      const filter = FILTERS.find((f) => f.id === nextFilterId) ?? FILTERS[0];
      setRefreshing(true);
      setError(null);
      try {
        const body = await api.listRequests(filter.statuses);
        setRequests(body.requests);
      } catch (caught) {
        setError(
          caught instanceof MiniAppApiError
            ? caught.message
            : "Could not load your requests. Try again.",
        );
      } finally {
        setRefreshing(false);
      }
    },
    [api],
  );

  useEffect(() => {
    void load(filterId);
  }, [load, filterId]);

  return (
    <section className="flex flex-col gap-4" aria-label="My requests">
      <div className="flex items-center gap-2">
        <div
          className="-mx-1 flex flex-1 gap-2 overflow-x-auto px-1 pb-1"
          role="group"
          aria-label="Filter by state"
        >
          {FILTERS.map((filter) => (
            <Chip
              key={filter.id}
              active={filter.id === filterId}
              onClick={() => setFilterId(filter.id)}
            >
              {filter.label}
            </Chip>
          ))}
        </div>
        <button
          type="button"
          onClick={() => void load(filterId)}
          aria-label="Refresh"
          className="shrink-0 rounded-md p-2 text-muted-foreground"
        >
          <RefreshCw className={refreshing ? "size-4 animate-spin" : "size-4"} />
        </button>
      </div>

      {error && <ErrorNote message={error} />}

      {requests === null && !error && <ListSkeleton />}

      {requests !== null && requests.length === 0 && !error && (
        <EmptyState
          title={
            filterId === "all"
              ? "No requests yet."
              : "Nothing in this state right now."
          }
          action={
            <button
              type="button"
              onClick={onSearch}
              className="text-sm text-brand underline underline-offset-4"
            >
              Search for something to watch
            </button>
          }
        />
      )}

      {requests !== null && requests.length > 0 && (
        <ul className="flex flex-col divide-y divide-border">
          {requests.map((request) => (
            <RequestRow key={request.subscriptionId} request={request} />
          ))}
        </ul>
      )}
    </section>
  );
}

function RequestRow({ request }: { request: RequestDto }) {
  return (
    <li className="flex gap-3 py-3">
      <Poster url={request.posterUrl} className="h-[66px] w-11" />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm text-foreground">{request.title}</p>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <DataTag>
              {request.year ?? "—"} · {request.instanceLabel}
            </DataTag>
            <DataTag>
              {request.kind === "MOVIE" ? "tmdb" : "tvdb"}:{request.externalId}
            </DataTag>
          </p>
        </div>

        <StatusRail status={request.status} />

        {request.statusReason && (
          <p className="text-xs text-muted-foreground">{request.statusReason}</p>
        )}

        <DataTag>{request.requestedAt.slice(0, 10)}</DataTag>
      </div>
    </li>
  );
}
