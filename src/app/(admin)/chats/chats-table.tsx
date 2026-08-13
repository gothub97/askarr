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

export interface ChatRow {
  id: string;
  /** BigInt serialized on the server. Rendered as data, never as prose. */
  chatId: string;
  title: string | null;
  threadId: number | null;
  enabled: boolean;
  createdAt: string;
}

export function ChatsTable({ chats }: { chats: ChatRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [topics, setTopics] = useState<Record<string, string>>({});
  const [deleting, setDeleting] = useState<ChatRow | null>(null);

  function topicFor(chat: ChatRow): string {
    return topics[chat.id] ?? (chat.threadId === null ? "" : String(chat.threadId));
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

  function saveTopic(chat: ChatRow): void {
    const raw = topicFor(chat).trim();
    startTransition(async () => {
      const result = await setChatTopicAction({
        id: chat.id,
        threadId: raw === "" ? null : Number(raw),
      });
      if (!result.ok) {
        toast.error(result.message ?? "Could not save that topic.");
        return;
      }
      toast.success("Saved", { description: chat.title ?? chat.chatId });
      setTopics((current) => {
        const next = { ...current };
        delete next[chat.id];
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
              <TableHead className="min-w-36">Forum topic</TableHead>
              <TableHead className="min-w-28">Seen</TableHead>
              <TableHead className="min-w-28">Allowed</TableHead>
              <TableHead className="w-px text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {chats.map((chat) => {
              const dirty =
                topicFor(chat) !==
                (chat.threadId === null ? "" : String(chat.threadId));

              return (
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
                    <div className="flex items-center gap-1.5">
                      <Input
                        type="number"
                        min={1}
                        inputMode="numeric"
                        className="w-24 font-data"
                        placeholder="main"
                        aria-label={`Forum topic for ${chat.title ?? chat.chatId}`}
                        value={topicFor(chat)}
                        onChange={(event) =>
                          setTopics((current) => ({
                            ...current,
                            [chat.id]: event.target.value,
                          }))
                        }
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!dirty || pending}
                        onClick={() => saveTopic(chat)}
                      >
                        Save
                      </Button>
                    </div>
                    <span className="block pt-1 text-xs text-muted-foreground">
                      Empty posts in the main thread.
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
              );
            })}
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
