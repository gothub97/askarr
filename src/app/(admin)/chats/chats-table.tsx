"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Data } from "@/components/admin/data";
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
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  createForumTopicsAction,
  deleteChatAction,
  setChatEnabledAction,
  setChatTopicAction,
} from "@/lib/actions/chats";

/** The three jobs a forum topic can hold, in the order they read on screen. */
const PURPOSES = ["request", "admin", "general"] as const;
type Purpose = (typeof PURPOSES)[number];

const PURPOSE_LABEL: Record<Purpose, string> = {
  request: "Request",
  admin: "Approval",
  general: "General",
};

/** Each row says what lands there, so the name alone need not carry it. */
const PURPOSE_HINT: Record<Purpose, string> = {
  request: "where people ask for a film or a show",
  admin: "where admins approve or turn a request down",
  general: "where a new film or show is announced once it lands",
};

const PURPOSE_FIELD = {
  request: "requestThreadId",
  admin: "adminThreadId",
  general: "generalThreadId",
} as const;

export interface ChatRow {
  id: string;
  /** BigInt serialized on the server. Rendered as data, never as prose. */
  chatId: string;
  title: string | null;
  requestThreadId: number | null;
  adminThreadId: number | null;
  generalThreadId: number | null;
  enabled: boolean;
  createdAt: string;
}

export function ChatsTable({ chats }: { chats: ChatRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // Keyed "<chatId>:<purpose>" so three inputs per row edit independently.
  const [topics, setTopics] = useState<Record<string, string>>({});
  const [deleting, setDeleting] = useState<ChatRow | null>(null);

  function savedTopic(chat: ChatRow, purpose: Purpose): string {
    const value = chat[PURPOSE_FIELD[purpose]];
    return value === null ? "" : String(value);
  }

  function topicFor(chat: ChatRow, purpose: Purpose): string {
    return topics[`${chat.id}:${purpose}`] ?? savedTopic(chat, purpose);
  }

  function toggle(chat: ChatRow, enabled: boolean): void {
    startTransition(async () => {
      const result = await setChatEnabledAction({ id: chat.id, enabled });
      if (!result.ok) {
        toast.error(result.message ?? "Could not change that group.");
        return;
      }
      toast.success(enabled ? "Allowed" : "Revoked", {
        description: chat.title ?? chat.chatId,
      });
      router.refresh();
    });
  }

  function saveTopic(chat: ChatRow, purpose: Purpose): void {
    const raw = topicFor(chat, purpose).trim();
    startTransition(async () => {
      const result = await setChatTopicAction({
        id: chat.id,
        purpose,
        threadId: raw === "" ? null : Number(raw),
      });
      if (!result.ok) {
        toast.error(result.message ?? "Could not save that topic.");
        return;
      }
      toast.success("Saved", { description: PURPOSE_LABEL[purpose] });
      setTopics((current) => {
        const next = { ...current };
        delete next[`${chat.id}:${purpose}`];
        return next;
      });
      router.refresh();
    });
  }

  function createTopics(chat: ChatRow): void {
    startTransition(async () => {
      const result = await createForumTopicsAction({ id: chat.id });
      if (!result.ok) {
        toast.error(result.message ?? "Could not create the topics.");
        return;
      }
      toast.success("Topics created", {
        description: "Request, Approval and General are now in the group.",
      });
      router.refresh();
    });
  }

  function confirmDelete(): void {
    const target = deleting;
    if (!target) return;
    startTransition(async () => {
      const result = await deleteChatAction({ id: target.id });
      if (!result.ok) {
        toast.error(result.message ?? "Could not remove that group.");
        return;
      }
      toast.success("Deleted", { description: target.title ?? target.chatId });
      setDeleting(null);
      router.refresh();
    });
  }

  return (
    <>
      <div className="overflow-hidden rounded-md border border-border bg-surface">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-48">Group</TableHead>
              <TableHead className="min-w-80">Forum topics</TableHead>
              <TableHead className="min-w-28">Seen</TableHead>
              <TableHead className="min-w-28">Allowed</TableHead>
              <TableHead className="w-px text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {chats.map((chat) => (
              <TableRow key={chat.id}>
                <TableCell>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-base text-foreground">
                      {chat.title ?? "Untitled group"}
                    </span>
                    <Data className="text-muted-foreground">{chat.chatId}</Data>
                  </div>
                </TableCell>

                <TableCell>
                  <div className="flex flex-col gap-3">
                    {PURPOSES.map((purpose) => {
                      const dirty =
                        topicFor(chat, purpose) !== savedTopic(chat, purpose);
                      return (
                        // Hint on its own line: side by side it fights the
                        // input for width and ends up sitting under it.
                        <div key={purpose} className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <span className="w-20 shrink-0 text-sm text-foreground">
                              {PURPOSE_LABEL[purpose]}
                            </span>
                          <Input
                            type="number"
                            min={1}
                            inputMode="numeric"
                            className="w-24 font-data"
                            placeholder="main"
                            aria-label={`${PURPOSE_LABEL[purpose]} topic for ${chat.title ?? chat.chatId}`}
                            value={topicFor(chat, purpose)}
                            onChange={(event) =>
                              setTopics((current) => ({
                                ...current,
                                [`${chat.id}:${purpose}`]: event.target.value,
                              }))
                            }
                          />
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={!dirty || pending}
                              onClick={() => saveTopic(chat, purpose)}
                            >
                              Save
                            </Button>
                          </div>
                          <span className="text-sm text-muted-foreground">
                            {PURPOSE_HINT[purpose]}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  {PURPOSES.some((p) => chat[PURPOSE_FIELD[p]] === null) && (
                    <div className="flex flex-col gap-1 pt-3">
                      <Button
                        size="sm"
                        className="self-start"
                        disabled={pending}
                        onClick={() => createTopics(chat)}
                      >
                        Create the missing topics
                      </Button>
                      <span className="text-sm text-muted-foreground">
                        Askarr makes them in the group and fills the ids in.
                        Telegram offers no way to list topics that already
                        exist, so those have to be pasted below.
                      </span>
                    </div>
                  )}

                  <span className="block pt-2 text-sm text-muted-foreground">
                    Empty posts in the group's main thread. To find a topic
                    id, open the topic in Telegram, copy its link, and take the
                    last number.
                  </span>
                </TableCell>

                  <TableCell >
                    <Data className="text-muted-foreground">{chat.createdAt}</Data>
                  </TableCell>

                  <TableCell >
                    <Switch
                      checked={chat.enabled}
                      disabled={pending}
                      aria-label={`Allow ${chat.title ?? chat.chatId}`}
                      onCheckedChange={(checked) => toggle(chat, checked)}
                    />
                  </TableCell>

                  <TableCell className="align-top text-right">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setDeleting(chat)}
                    >
                      Delete
                    </Button>
                  </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete group</DialogTitle>
            <DialogDescription>
              Askarr forgets this group. If the bot is still in it, the group
              comes back as revoked the next time someone talks to it.
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
    </>
  );
}
