"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Data } from "@/components/admin/data";
import { Label } from "@/components/status-label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  type DiscoveredChat,
  addChatManuallyAction,
  getBotOverviewAction,
  listDiscoveredChatsAction,
} from "@/lib/actions/bot";
import { setChatEnabledAction } from "@/lib/actions/chats";

/**
 * Groups that have found the bot but nobody has allowed yet.
 *
 * This polls because the event it is waiting for happens in another process:
 * someone adds the bot to a group in Telegram, and the row appears. Asking an
 * admin to keep pressing refresh while they do that is not a setup flow.
 *
 * It lives on the Groups page, next to the groups it turns into — the Bot page
 * is about the token and the connection.
 */

const POLL_INTERVAL_MS = 4000;

export function DiscoveredChats({
  initialChats,
  initialBotUsername,
}: {
  initialChats: DiscoveredChat[];
  initialBotUsername: string | null;
}) {
  const [chats, setChats] = useState(initialChats);
  const [botUsername, setBotUsername] = useState(initialBotUsername);
  const [manualId, setManualId] = useState("");
  const [pending, startTransition] = useTransition();
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const [nextChats, overview] = await Promise.all([
        listDiscoveredChatsAction(),
        getBotOverviewAction(),
      ]);
      if (!mounted.current) return;
      setChats(nextChats);
      setBotUsername(overview.status.runtime?.username ?? null);
    } catch {
      // A failed poll is not worth a toast; the next one in four seconds will
      // either succeed or the session has gone, which the next action reports.
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    const timer = setInterval(() => void refresh(), POLL_INTERVAL_MS);
    return () => {
      mounted.current = false;
      clearInterval(timer);
    };
  }, [refresh]);

  function allow(chat: DiscoveredChat) {
    startTransition(async () => {
      const result = await setChatEnabledAction({ id: chat.id, enabled: true });
      if (!result.ok) {
        toast.error(result.message ?? "Could not allow that group.");
        return;
      }
      toast.success("Allowed");
      await refresh();
    });
  }

  function addManually() {
    startTransition(async () => {
      const result = await addChatManuallyAction({ chatId: manualId });
      if (!result.ok) {
        toast.error(result.message ?? "Could not add that group.");
        return;
      }
      setManualId("");
      toast.success("Allowed");
      await refresh();
    });
  }

  return (
    <section className="flex flex-col gap-3 rounded-md border border-border bg-surface p-4">
      <div className="flex flex-col gap-0.5">
        <h2>Groups that found the bot</h2>
        <p className="text-sm text-muted-foreground">
          Add the bot to your private group. It shows up here, revoked, and you
          allow it.
        </p>
      </div>

      {chats.length === 0 ? (
        <p className="text-base text-muted-foreground">
          {botUsername
            ? `Waiting for a group. Add @${botUsername} to it, then send a message.`
            : "Waiting for a group."}
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {chats.map((chat) => (
            <li
              key={chat.id}
              className="flex flex-wrap items-center justify-between gap-2 py-2"
            >
              <div className="flex flex-col gap-0.5">
                <span className="text-base">{chat.title ?? "Untitled group"}</span>
                <Data className="text-muted-foreground">{chat.chatId}</Data>
              </div>
              {chat.enabled ? (
                <Label kind="success" size="sm">
                  Allowed
                </Label>
              ) : (
                <Button size="sm" onClick={() => allow(chat)} disabled={pending}>
                  Allow
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      <Separator />

      <div className="flex flex-col gap-2">
        <h3>Add by chat id</h3>
        <p className="text-sm text-muted-foreground">
          For an install where the bot cannot be restarted to notice the group on
          its own.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            aria-label="Chat id"
            className="max-w-56 font-data"
            inputMode="numeric"
            placeholder="-1001234567890"
            value={manualId}
            onChange={(event) => setManualId(event.target.value)}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={addManually}
            disabled={pending || manualId.trim().length === 0}
          >
            Allow this id
          </Button>
        </div>
      </div>
    </section>
  );
}
