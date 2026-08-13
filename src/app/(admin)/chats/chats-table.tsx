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
  deleteChatAction,
  setChatEnabledAction,
  setChatTopicAction,
} from "@/lib/actions/chats";

/** The three jobs a forum topic can hold, in the order they read on screen. */
const PURPOSES = ["request", "admin", "general"] as const;
type Purpose = (typeof PURPOSES)[number];

const PURPOSE_LABEL: Record<Purpose, string> = {
  request: "Requests",
  admin: "Approvals",
  general: "Arrivals",
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
      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-48">Group</TableHead>
              <TableHead className="min-w-64">Forum topics</TableHead>
              <TableHead className="min-w-28">Seen</TableHead>
              <TableHead className="min-w-28">Allowed</TableHead>
              <TableHead className="w-px text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {chats.map((chat) => (
              <TableRow key={chat.id}>
                <TableCell className="align-top whitespace-normal">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm text-foreground">
                      {chat.title ?? "Untitled group"}
                    </span>
                    <Data className="text-muted-foreground">{chat.chatId}</Data>
                  </div>
                </TableCell>

                <TableCell className="align-top">
                  <div className="flex flex-col gap-2">
                    {PURPOSES.map((purpose) => {
                      const dirty =
                        topicFor(chat, purpose) !== savedTopic(chat, purpose);
                      return (
                        <div key={purpose} className="flex items-center gap-1.5">
                          <span className="w-16 shrink-0 text-xs text-muted-foreground">
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
                      );
                    })}
                  </div>
                  <span className="block pt-2 text-xs text-muted-foreground">
                    Empty posts in the main thread. Long-press a topic in
                    Telegram and copy its link — the last number is its id.
                  </span>
                </TableCell>

                  <TableCell className="align-top">
                    <Data className="text-muted-foreground">{chat.createdAt}</Data>
                  </TableCell>

                  <TableCell className="align-top">
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
