"use client";

import type { MediaKind, MediaStatus } from "@prisma/client";
import { MoreHorizontalIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Data } from "@/components/admin/data";
import { Poster } from "@/components/poster";
import { StatusProgress } from "@/components/progress-bar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  approveRequestAction,
  deleteRequestAction,
  rejectRequestAction,
  retryRequestAction,
  type RequestActionResult,
} from "@/lib/actions/requests";

/** Everything the table needs, already serialized by the server component. */
export interface RequestRow {
  id: string;
  title: string;
  year: number | null;
  kind: MediaKind;
  externalId: number;
  posterUrl: string | null;
  status: MediaStatus;
  statusReason: string | null;
  instanceLabel: string;
  requesters: string[];
  createdAt: string;
}

type PendingDialog =
  | { kind: "reject"; row: RequestRow }
  | { kind: "delete"; row: RequestRow }
  | null;

export function RequestsTable({ rows }: { rows: RequestRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [dialog, setDialog] = useState<PendingDialog>(null);
  const [reason, setReason] = useState("");

  /**
   * One runner for every action so the success wording always matches the
   * control that was pressed: "Approve" reports "Approved", never "Saved".
   */
  function run(
    action: () => Promise<RequestActionResult>,
    successTitle: string,
    row: RequestRow,
  ) {
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        toast.success(successTitle, { description: row.title });
        setDialog(null);
        setReason("");
        router.refresh();
      } else {
        toast.error(result.message ?? "That did not go through. Try again.");
      }
    });
  }

  return (
    <>
      <div className="overflow-hidden rounded-md border border-border bg-surface">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-52">Title</TableHead>
              <TableHead className="min-w-44">Progress</TableHead>
              <TableHead className="min-w-36">Requested by</TableHead>
              <TableHead className="min-w-36">Instance</TableHead>
              <TableHead className="min-w-32">Asked</TableHead>
              <TableHead className="w-px text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  <div className="flex items-start gap-2.5">
                    <Poster url={row.posterUrl} className="h-12 w-8" />
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="font-bold text-foreground">
                        {row.title}
                        {row.year ? (
                          <span className="font-normal text-muted-foreground">
                            {" "}
                            ({row.year})
                          </span>
                        ) : null}
                      </span>
                      <Data className="text-muted-foreground">
                        {row.kind === "MOVIE" ? "tmdbId" : "tvdbId"} {row.externalId}
                      </Data>
                    </div>
                  </div>
                </TableCell>

                <TableCell>
                  <StatusProgress status={row.status} />
                  {row.statusReason && (
                    <p className="pt-1 text-sm text-muted-foreground">
                      {row.statusReason}
                    </p>
                  )}
                </TableCell>

                <TableCell className="text-base text-muted-foreground">
                  {row.requesters.length > 0
                    ? row.requesters.join(", ")
                    : "No subscriber left"}
                </TableCell>

                <TableCell>
                  <span className="text-base text-foreground">{row.instanceLabel}</span>
                </TableCell>

                <TableCell >
                  <Data className="text-muted-foreground">{row.createdAt}</Data>
                </TableCell>

                <TableCell className="align-top text-right">
                  <div className="flex items-center justify-end gap-1">
                    {row.status === "PENDING" && (
                      <Button
                        size="sm"
                        disabled={pending}
                        onClick={() =>
                          run(
                            () => approveRequestAction({ mediaItemId: row.id }),
                            "Approved",
                            row,
                          )
                        }
                      >
                        Approve
                      </Button>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`More actions for ${row.title}`}
                          />
                        }
                      >
                        <MoreHorizontalIcon />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="min-w-40">
                        <DropdownMenuItem
                          disabled={pending || row.status !== "PENDING"}
                          onClick={() =>
                            run(
                              () => approveRequestAction({ mediaItemId: row.id }),
                              "Approved",
                              row,
                            )
                          }
                        >
                          Approve
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={pending || row.status === "REJECTED"}
                          onClick={() => {
                            setReason("");
                            setDialog({ kind: "reject", row });
                          }}
                        >
                          Reject
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={pending}
                          onClick={() =>
                            run(
                              () => retryRequestAction({ mediaItemId: row.id }),
                              "Retried",
                              row,
                            )
                          }
                        >
                          Retry
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          disabled={pending}
                          onClick={() => setDialog({ kind: "delete", row })}
                        >
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog
        open={dialog?.kind === "reject"}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject request</DialogTitle>
            <DialogDescription>
              The reason is sent back to the person who asked, so write it for
              them.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reject-reason">Reason</Label>
            <Textarea
              id="reject-reason"
              value={reason}
              maxLength={280}
              placeholder="Already scheduled for next month."
              onChange={(event) => setReason(event.target.value)}
            />
            <span className="text-sm text-muted-foreground">
              Optional · {reason.length}/280
            </span>
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() => {
                const row = dialog?.row;
                if (!row) return;
                run(
                  () =>
                    rejectRequestAction({
                      mediaItemId: row.id,
                      reason: reason.trim() || undefined,
                    }),
                  "Rejected",
                  row,
                );
              }}
            >
              Reject request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={dialog?.kind === "delete"}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete request</DialogTitle>
            <DialogDescription>
              Askarr forgets {dialog?.row.title ?? "this title"} and everyone who
              asked for it. Nothing is removed from Radarr or Sonarr.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() => {
                const row = dialog?.row;
                if (!row) return;
                run(
                  () => deleteRequestAction({ mediaItemId: row.id }),
                  "Deleted",
                  row,
                );
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
