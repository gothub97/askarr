"use client";

import { PlusIcon, TriangleAlertIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ActionButton } from "@/components/admin/action-button";
import { CopyButton } from "@/components/admin/copy-button";
import { Data } from "@/components/admin/data";
import { EmptyState } from "@/components/admin/empty-state";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { deleteInstanceAction } from "@/lib/actions/instances";
import type { PublicInstance } from "@/lib/instances";
import { InstanceForm } from "./instance-form";

export interface RootFolderCollision {
  rootFolderPath: string;
  labels: string[];
}

export function InstancesManager({
  instances,
  collisions,
}: {
  instances: PublicInstance[];
  collisions: RootFolderCollision[];
}) {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<PublicInstance | null>(null);
  const [deleting, setDeleting] = useState<PublicInstance | null>(null);
  const [pending, startTransition] = useTransition();

  function openCreate(): void {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(instance: PublicInstance): void {
    setEditing(instance);
    setFormOpen(true);
  }

  function confirmDelete(): void {
    const target = deleting;
    if (!target) return;
    startTransition(async () => {
      const result = await deleteInstanceAction(target.id);
      if (!result.ok) {
        toast.error(result.message ?? "Could not remove that instance.");
        return;
      }
      toast.success("Deleted", { description: target.label });
      setDeleting(null);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {collisions.length > 0 && (
        <Alert variant="destructive">
          <TriangleAlertIcon />
          <AlertTitle>Two enabled instances share a root folder</AlertTitle>
          <AlertDescription>
            <ul className="flex flex-col gap-1">
              {collisions.map((collision) => (
                <li key={collision.rootFolderPath}>
                  <Data>{collision.rootFolderPath}</Data> is used by{" "}
                  {collision.labels.join(" and ")}. They will fight over the same
                  files. Give one of them its own folder, or disable it.
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex justify-end">
        <ActionButton onClick={openCreate}>
          <PlusIcon />
          Add instance
        </ActionButton>
      </div>

      {instances.length === 0 ? (
        <EmptyState
          title="No instance is connected yet."
          hint="Askarr pushes every approved title to a Radarr or Sonarr instance. Connect one to get started."
          action={
            <ActionButton size="sm" onClick={openCreate}>
              Add your first instance
            </ActionButton>
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          {instances.map((instance) => (
            <Card key={instance.id}>
              <CardContent className="flex flex-col gap-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-col gap-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-base text-foreground">
                        {instance.label}
                      </span>
                      <Badge variant="outline">{instance.kind}</Badge>
                      {instance.isDefault && (
                        <Badge variant="secondary">Default</Badge>
                      )}
                      {!instance.enabled && (
                        <Badge variant="destructive">Disabled</Badge>
                      )}
                    </div>
                    <Data className="break-all text-muted-foreground">
                      {instance.baseUrl}
                    </Data>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEdit(instance)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setDeleting(instance)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>

                <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-3">
                  <DetailRow label="API key" value={instance.apiKeyMasked} />
                  <DetailRow
                    label="Quality profile"
                    value={`#${instance.qualityProfileId}`}
                  />
                  <DetailRow
                    label="Root folder"
                    value={instance.rootFolderPath}
                  />
                </dl>

                <WebhookPanel instance={instance} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <InstanceForm
        open={formOpen}
        instance={editing}
        onOpenChange={setFormOpen}
        onSaved={() => router.refresh()}
      />

      <Dialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete instance</DialogTitle>
            <DialogDescription>
              {deleting?.label ?? "This instance"} and every request tracked
              against it are removed from Askarr. Radarr and Sonarr keep their
              own libraries untouched.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button variant="destructive" disabled={pending} onClick={confirmDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd>
        <Data className="break-all text-foreground">{value}</Data>
      </dd>
    </div>
  );
}

/**
 * Radarr and Sonarr only report progress if the webhook is wired by hand, and
 * the event names differ between the two. Spelling out exactly which boxes to
 * tick is the difference between a working install and a silent one.
 */
function WebhookPanel({ instance }: { instance: PublicInstance }) {
  const events =
    instance.kind === "RADARR"
      ? ["On Grab", "On Import / On Download", "On Movie Added"]
      : ["On Grab", "On Import / On Download", "On Series Add"];

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface px-3 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">Webhook URL</span>
        <CopyButton
          value={instance.webhookUrl}
          label="Copy URL"
          copiedMessage="Copied the webhook URL"
        />
      </div>
      <Data className="break-all text-foreground">{instance.webhookUrl}</Data>
      <p className="text-xs text-muted-foreground">
        In {instance.kind === "RADARR" ? "Radarr" : "Sonarr"}, open Settings &gt;
        Connect &gt; add a Webhook, paste the URL, tick these events, then press
        Test:
      </p>
      <ul className="flex flex-wrap gap-1.5">
        {events.map((event) => (
          <li key={event}>
            <Badge variant="outline" className="font-data">
              {event}
            </Badge>
          </li>
        ))}
      </ul>
    </div>
  );
}
