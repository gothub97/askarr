"use client";

import { TelegramRole, type MediaStatus } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Data } from "@/components/admin/data";
import { StatusProgress } from "@/components/progress-bar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { updateTelegramUserAction } from "@/lib/actions/users";

export interface UserRequestRow {
  id: string;
  title: string;
  year: number | null;
  status: MediaStatus;
  instanceLabel: string;
  createdAt: string;
}

export interface TelegramUserRow {
  id: string;
  /** BigInt serialized on the server; it cannot cross as a number. */
  telegramId: string;
  displayName: string;
  username: string | null;
  role: TelegramRole;
  quotaPerMonth: number;
  quotaUsed: number;
  history: UserRequestRow[];
}

const ROLE_LABELS: Record<TelegramRole, string> = {
  BLOCKED: "Blocked",
  GUEST: "Guest",
  TRUSTED: "Trusted",
  ADMIN: "Admin",
};

interface Draft {
  role: TelegramRole;
  quota: string;
}

export function UsersTable({ users }: { users: TelegramUserRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [history, setHistory] = useState<TelegramUserRow | null>(null);

  function draftFor(user: TelegramUserRow): Draft {
    return (
      drafts[user.id] ?? {
        role: user.role,
        quota: String(user.quotaPerMonth),
      }
    );
  }

  function patch(user: TelegramUserRow, next: Partial<Draft>): void {
    setDrafts((current) => ({
      ...current,
      [user.id]: { ...draftFor(user), ...next },
    }));
  }

  function save(user: TelegramUserRow): void {
    const draft = draftFor(user);
    startTransition(async () => {
      const result = await updateTelegramUserAction({
        telegramUserId: user.id,
        role: draft.role,
        quotaPerMonth: draft.quota.trim() === "" ? 0 : Number(draft.quota),
      });
      if (!result.ok) {
        toast.error(result.message ?? "Could not save that person.");
        return;
      }
      toast.success("Saved", { description: user.displayName });
      setDrafts((current) => {
        const next = { ...current };
        delete next[user.id];
        return next;
      });
      router.refresh();
    });
  }

  return (
    <>
      <div className="overflow-hidden rounded-md border border-border bg-surface">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-44">Person</TableHead>
              <TableHead className="min-w-36">Role</TableHead>
              <TableHead className="min-w-32">Quota per month</TableHead>
              <TableHead className="min-w-32">Used this window</TableHead>
              <TableHead className="w-px text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => {
              const draft = draftFor(user);
              const dirty =
                draft.role !== user.role ||
                draft.quota !== String(user.quotaPerMonth);

              return (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-base text-foreground">
                        {user.displayName}
                      </span>
                      <Data className="text-muted-foreground">
                        {user.username ? `@${user.username} · ` : ""}
                        {user.telegramId}
                      </Data>
                    </div>
                  </TableCell>

                  <TableCell >
                    <Select
                      items={ROLE_LABELS}
                      value={draft.role}
                      onValueChange={(value) => {
                        if (value) patch(user, { role: value as TelegramRole });
                      }}
                    >
                      <SelectTrigger
                        className="w-full"
                        aria-label={`Role for ${user.displayName}`}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.values(TelegramRole).map((role) => (
                          <SelectItem key={role} value={role}>
                            {ROLE_LABELS[role]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>

                  <TableCell >
                    <Input
                      type="number"
                      min={0}
                      max={1000}
                      inputMode="numeric"
                      className="w-24 font-data"
                      aria-label={`Quota for ${user.displayName}`}
                      value={draft.quota}
                      onChange={(event) =>
                        patch(user, { quota: event.target.value })
                      }
                    />
                    <span className="block pt-1 text-sm text-muted-foreground">
                      0 = unlimited
                    </span>
                  </TableCell>

                  <TableCell >
                    <Data className="text-foreground">
                      {user.quotaPerMonth === 0
                        ? `${user.quotaUsed} / ∞`
                        : `${user.quotaUsed} / ${user.quotaPerMonth}`}
                    </Data>
                    <span className="block pt-1 text-sm text-muted-foreground">
                      rolling 30 days
                    </span>
                  </TableCell>

                  <TableCell className="align-top text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setHistory(user)}
                      >
                        History
                      </Button>
                      <Button
                        size="sm"
                        disabled={!dirty || pending}
                        onClick={() => save(user)}
                      >
                        Save
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog
        open={history !== null}
        onOpenChange={(open) => {
          if (!open) setHistory(null);
        }}
      >
        <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {history?.displayName ?? "Request history"}
            </DialogTitle>
            <DialogDescription>
              The most recent titles this person asked for.
            </DialogDescription>
          </DialogHeader>

          {history && history.history.length === 0 ? (
            <p className="text-base text-muted-foreground">
              Nothing requested yet.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {history?.history.map((request) => (
                <li key={request.id} className="flex flex-col gap-2 py-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <span className="text-base text-foreground">
                      {request.title}
                      {request.year ? (
                        <span className="text-muted-foreground">
                          {" "}
                          ({request.year})
                        </span>
                      ) : null}
                    </span>
                    <Data className="text-muted-foreground">
                      {request.instanceLabel} · {request.createdAt}
                    </Data>
                  </div>
                  <StatusProgress status={request.status} size="sm" showCaption={false} />
                </li>
              ))}
            </ul>
          )}

          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Close</DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
