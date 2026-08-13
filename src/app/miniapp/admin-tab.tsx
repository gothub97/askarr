"use client";

import type { TelegramRole } from "@prisma/client";
import { Check, RefreshCw, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { MiniAppApiError, type MiniAppApi } from "./client";
import {
  DataTag,
  EmptyPane,
  ErrorNote,
  ListSkeleton,
  Segmented,
} from "./pieces";
import { haptic } from "./telegram";
import type { AdminUserDto, PendingRequestDto } from "./types";
import { Poster } from "@/components/poster";

/**
 * Tab 3 — admins only. The tab itself is hidden for everyone else, but that is
 * cosmetic: every route behind it re-reads the role from the database.
 *
 * Approve and reject are single taps with no confirmation step. Both are
 * recoverable (a rejected item can be requested again, an approved one removed
 * in Radarr/Sonarr), and a queue that takes two taps per item does not get
 * cleared.
 */

const ROLES: readonly { value: TelegramRole; label: string }[] = [
  { value: "BLOCKED", label: "Blocked" },
  { value: "GUEST", label: "Guest" },
  { value: "TRUSTED", label: "Trusted" },
  { value: "ADMIN", label: "Admin" },
];

type Pane = "queue" | "people";

export function AdminTab({ api }: { api: MiniAppApi }) {
  const [pane, setPane] = useState<Pane>("queue");

  return (
    <section className="flex flex-col gap-4" aria-label="Admin">
      <Segmented
        label="Admin section"
        options={[
          { value: "queue" as const, label: "Queue" },
          { value: "people" as const, label: "People" },
        ]}
        value={pane}
        onChange={setPane}
      />
      {pane === "queue" ? <QueuePane api={api} /> : <PeoplePane api={api} />}
    </section>
  );
}

// ------------------------------------------------------------------- queue

function QueuePane({ api }: { api: MiniAppApi }) {
  const [pending, setPending] = useState<PendingRequestDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const body = await api.pending();
      setPending(body.pending);
    } catch (caught) {
      setError(
        caught instanceof MiniAppApiError
          ? caught.message
          : "Could not load the queue. Try again.",
      );
    } finally {
      setRefreshing(false);
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  async function decide(item: PendingRequestDto, approve: boolean) {
    setBusyId(item.mediaItemId);
    setError(null);
    try {
      const body = approve
        ? await api.approve(item.mediaItemId)
        : await api.reject(item.mediaItemId, null);
      if (!body.ok) {
        haptic("error");
        setError(body.message);
        return;
      }
      haptic("success");
      setNotice(body.message);
      // The item has left the queue either way; drop it rather than refetching
      // the whole list under the admin's thumb.
      setPending((current) =>
        current
          ? current.filter((row) => row.mediaItemId !== item.mediaItemId)
          : current,
      );
    } catch (caught) {
      haptic("error");
      setError(
        caught instanceof MiniAppApiError
          ? caught.message
          : "That did not go through. Try again.",
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {pending === null
            ? "Loading the queue…"
            : pending.length === 0
              ? "Nothing waiting."
              : `${pending.length} waiting`}
        </p>
        <button
          type="button"
          onClick={() => void load()}
          aria-label="Refresh the queue"
          className="rounded-md p-2 text-muted-foreground"
        >
          <RefreshCw className={refreshing ? "size-4 animate-spin" : "size-4"} />
        </button>
      </div>

      {notice && (
        <p role="status" className="text-sm text-positive">
          {notice}
        </p>
      )}
      {error && <ErrorNote message={error} />}

      {pending === null && !error && <ListSkeleton />}

      {pending !== null && pending.length === 0 && !error && (
        <EmptyPane title="No requests waiting. The queue is clear." />
      )}

      {pending !== null && pending.length > 0 && (
        <ul className="flex flex-col divide-y divide-border">
          {pending.map((item) => (
            <li key={item.mediaItemId} className="flex flex-col gap-3 py-3">
              <div className="flex gap-3">
                <Poster url={item.posterUrl} className="h-[66px] w-11" />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <p className="truncate text-base text-foreground">
                    {item.title}
                  </p>
                  <DataTag>
                    {item.year ?? "—"} · {item.instanceLabel}
                    {item.monitorMode === "all" ? " · full series" : ""}
                  </DataTag>
                  <p className="truncate text-sm text-muted-foreground">
                    {item.requesters.map((r) => r.displayName).join(", ") ||
                      "No requester"}
                  </p>
                  <DataTag>{item.requestedAt.slice(0, 10)}</DataTag>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void decide(item, true)}
                  disabled={busyId === item.mediaItemId}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-positive bg-positive px-3 py-2.5 text-base text-positive-foreground disabled:opacity-65"
                >
                  <Check className="size-4" aria-hidden />
                  Approve
                </button>
                <button
                  type="button"
                  onClick={() => void decide(item, false)}
                  disabled={busyId === item.mediaItemId}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-destructive bg-destructive px-3 py-2.5 text-base text-destructive-foreground disabled:opacity-65"
                >
                  <X className="size-4" aria-hidden />
                  Reject
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ people

function PeoplePane({ api }: { api: MiniAppApi }) {
  const [users, setUsers] = useState<AdminUserDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const body = await api.users();
      setUsers(body.users);
    } catch (caught) {
      setError(
        caught instanceof MiniAppApiError
          ? caught.message
          : "Could not load the member list. Try again.",
      );
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  function replace(updated: AdminUserDto) {
    setUsers((current) =>
      current
        ? current.map((user) => (user.id === updated.id ? updated : user))
        : current,
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {error && <ErrorNote message={error} />}
      {users === null && !error && <ListSkeleton rows={4} />}
      {users !== null && users.length === 0 && !error && (
        <EmptyPane title="Nobody has messaged the bot yet." />
      )}
      {users !== null && users.length > 0 && (
        <ul className="flex flex-col divide-y divide-border">
          {users.map((user) => (
            <UserRow key={user.id} api={api} user={user} onSaved={replace} />
          ))}
        </ul>
      )}
    </div>
  );
}

function UserRow({
  api,
  user,
  onSaved,
}: {
  api: MiniAppApi;
  user: AdminUserDto;
  onSaved: (user: AdminUserDto) => void;
}) {
  const [quota, setQuota] = useState(String(user.quotaPerMonth));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const quotaDirty = quota.trim() !== String(user.quotaPerMonth);

  async function save(patch: { role?: TelegramRole; quotaPerMonth?: number }) {
    setSaving(true);
    setError(null);
    try {
      const body = await api.updateUser({
        telegramUserId: user.id,
        ...patch,
      });
      onSaved(body.user);
      setQuota(String(body.user.quotaPerMonth));
      haptic("success");
    } catch (caught) {
      haptic("error");
      setError(
        caught instanceof MiniAppApiError
          ? caught.message
          : "That change did not save. Try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <li className="flex flex-col gap-2 py-3">
      <div className="flex min-w-0 items-baseline justify-between gap-2">
        <p className="truncate text-base text-foreground">{user.displayName}</p>
        <DataTag>{user.username ? `@${user.username}` : user.telegramId}</DataTag>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <span className="sr-only">Role for {user.displayName}</span>
          {/* A native select is the right control in a WebView: it opens the
              platform picker instead of a popover fighting the keyboard. */}
          <select
            value={user.role}
            // The server refuses this too; disabling it just avoids the dead end.
            disabled={saving || user.isSelf}
            onChange={(event) =>
              void save({ role: event.target.value as TelegramRole })
            }
            className="rounded-md border border-border bg-transparent px-2 py-1.5 text-sm text-foreground disabled:opacity-50"
          >
            {ROLES.map((role) => (
              <option key={role.value} value={role.value}>
                {role.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
          Quota
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={1000}
            value={quota}
            disabled={saving}
            onChange={(event) => setQuota(event.target.value)}
            aria-label={`Monthly quota for ${user.displayName}`}
            className="w-16 rounded-md border border-border bg-transparent px-2 py-1.5 font-data text-sm text-foreground"
          />
        </label>

        {quotaDirty && (
          <button
            type="button"
            disabled={saving}
            onClick={() => void save({ quotaPerMonth: Number(quota) || 0 })}
            className="rounded-md border border-primary bg-primary px-2.5 py-1.5 text-sm text-primary-foreground disabled:opacity-65"
          >
            Save
          </button>
        )}

        <DataTag>
          {user.usedThisWindow}/{user.quotaPerMonth === 0 ? "∞" : user.quotaPerMonth}
        </DataTag>
      </div>

      {error && <ErrorNote message={error} />}
    </li>
  );
}
