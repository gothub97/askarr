"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ActionButton } from "@/components/admin/action-button";
import { Data } from "@/components/admin/data";
import { SectionTitle } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  type BotOverview,
  type DiscoveredChat,
  addChatManuallyAction,
  getBotOverviewAction,
  listDiscoveredChatsAction,
  restartBotAction,
  revertBotTokenAction,
  saveBotTokenAction,
} from "@/lib/actions/bot";
import { setChatEnabledAction } from "@/lib/actions/chats";

/**
 * Bot setup, in the back office rather than only in the wizard.
 *
 * The whole page polls: the two things it reports — whether the bot process is
 * alive, and which groups have found it — are both written by the *other*
 * process. Neither can be known from a single server render, and asking an
 * admin to keep pressing refresh while they add a bot to a group is not a
 * setup flow.
 */

const POLL_INTERVAL_MS = 4000;

type StatusTone = "good" | "waiting" | "bad";

function statusLine(overview: BotOverview): {
  tone: StatusTone;
  label: string;
  detail: string;
} {
  const { status, token } = overview;

  if (token.source === "missing") {
    return {
      tone: "bad",
      label: "No token",
      detail: "Askarr cannot talk to Telegram until a token is saved below.",
    };
  }

  if (!status.alive) {
    return {
      tone: "bad",
      label: "Not running",
      detail:
        status.runtime?.state === "stopped"
          ? "The bot process shut down cleanly. Start it again to serve the group."
          : "No heartbeat from the bot process. Check that it is running.",
    };
  }

  const runtime = status.runtime;
  switch (runtime?.state) {
    case "polling":
      return {
        tone: "good",
        label: "Polling",
        detail: `Connected as @${runtime.username ?? "unknown"}.`,
      };
    case "token_rejected":
      return {
        tone: "bad",
        label: "Token rejected",
        detail: runtime.detail ?? "Telegram refused the token.",
      };
    case "no_token":
      return {
        tone: "bad",
        label: "No token",
        detail: runtime.detail ?? "The bot has no token to run with.",
      };
    case "unreachable":
      return {
        tone: "waiting",
        label: "Cannot reach Telegram",
        detail: runtime.detail ?? "Retrying.",
      };
    default:
      return { tone: "waiting", label: "Starting", detail: "Connecting." };
  }
}

const TONE_CLASS: Record<StatusTone, string> = {
  good: "bg-positive/10 text-positive border-positive/30",
  waiting: "bg-waiting/10 text-waiting border-waiting/30",
  bad: "bg-destructive/10 text-destructive border-destructive/30",
};

function ago(ms: number | null): string {
  if (ms === null) return "never";
  const seconds = Math.max(0, Math.round(ms / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  return `${Math.round(seconds / 60)}m ago`;
}

export function BotManager({
  initialOverview,
  initialChats,
}: {
  initialOverview: BotOverview;
  initialChats: DiscoveredChat[];
}) {
  const router = useRouter();
  const [overview, setOverview] = useState(initialOverview);
  const [chats, setChats] = useState(initialChats);
  const [token, setToken] = useState("");
  const [manualId, setManualId] = useState("");
  const [pending, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const [next, nextChats] = await Promise.all([
        getBotOverviewAction(),
        listDiscoveredChatsAction(),
      ]);
      if (!mounted.current) return;
      setOverview(next);
      setChats(nextChats);
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

  const status = statusLine(overview);

  async function saveToken() {
    setSaving(true);
    const result = await saveBotTokenAction({ token });
    setSaving(false);
    if (!result.ok) {
      toast.error(result.message ?? "Could not save that token.");
      return;
    }
    setToken("");
    toast.success(
      result.username ? `Saved. Askarr is @${result.username}.` : "Saved",
      { description: "The bot reconnects within a few seconds." },
    );
    await refresh();
    router.refresh();
  }

  function revert() {
    startTransition(async () => {
      const result = await revertBotTokenAction();
      if (!result.ok) {
        toast.error(result.message ?? "Could not remove the saved token.");
        return;
      }
      toast.success("Reverted", {
        description: "Askarr is back on TELEGRAM_BOT_TOKEN.",
      });
      await refresh();
      router.refresh();
    });
  }

  function restart() {
    startTransition(async () => {
      const result = await restartBotAction();
      if (!result.ok) {
        toast.error(result.message ?? "Could not ask the bot to restart.");
        return;
      }
      toast.success("Restart requested", {
        description: "The bot reconnects within a few seconds.",
      });
    });
  }

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
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-col gap-1">
              <CardTitle>Connection</CardTitle>
              <CardDescription>
                Written by the bot process, read here. It updates on its own.
              </CardDescription>
            </div>
            <Badge variant="outline" className={TONE_CLASS[status.tone]}>
              {status.label}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">{status.detail}</p>

          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="flex flex-col gap-1">
              <dt className="text-xs text-muted-foreground">Bot</dt>
              <dd>
                {overview.status.runtime?.username ? (
                  <Data>@{overview.status.runtime.username}</Data>
                ) : (
                  <span className="text-sm text-muted-foreground">—</span>
                )}
              </dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="text-xs text-muted-foreground">Last heartbeat</dt>
              <dd>
                <Data>{ago(overview.status.ageMs)}</Data>
              </dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="text-xs text-muted-foreground">Token source</dt>
              <dd>
                <Data>
                  {overview.token.source === "database"
                    ? "database"
                    : overview.token.source === "environment"
                      ? "TELEGRAM_BOT_TOKEN"
                      : "none"}
                  {overview.token.hint ? ` ·••••${overview.token.hint}` : ""}
                </Data>
              </dd>
            </div>
          </dl>

          <div className="flex flex-wrap gap-2">
            <ActionButton
              size="sm"
              onClick={restart}
              disabled={pending || overview.token.source === "missing"}
            >
              Restart bot
            </ActionButton>
            {overview.token.source === "database" && overview.envSeedPresent && (
              <Button
                variant="outline"
                size="sm"
                onClick={revert}
                disabled={pending}
              >
                Use TELEGRAM_BOT_TOKEN instead
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Token</CardTitle>
          <CardDescription>
            Askarr checks a token with Telegram before saving it, then the bot
            reconnects on its own. The saved token is never shown again.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="bot-token">New token from BotFather</Label>
            <Input
              id="bot-token"
              className="font-data"
              autoComplete="off"
              spellCheck={false}
              placeholder="123456789:AA…"
              value={token}
              onChange={(event) => setToken(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Replacing the token signs the old one out. Anything already sent
              stays; the Mini App re-authenticates against the new token.
            </p>
          </div>
          <div>
            <ActionButton
              size="sm"
              onClick={() => void saveToken()}
              disabled={saving || token.trim().length === 0}
            >
              {saving ? "Checking with Telegram…" : "Save token"}
            </ActionButton>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Groups</CardTitle>
          <CardDescription>
            Add the bot to your private group. It shows up here, revoked, and
            you allow it.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {chats.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {overview.status.runtime?.username
                ? `Waiting for a group. Add @${overview.status.runtime.username} to it, then send a message.`
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
                    <span className="text-sm">
                      {chat.title ?? "Untitled group"}
                    </span>
                    <Data className="text-muted-foreground">{chat.chatId}</Data>
                  </div>
                  {chat.enabled ? (
                    <Badge variant="outline" className={TONE_CLASS.good}>
                      Allowed
                    </Badge>
                  ) : (
                    <ActionButton
                      size="sm"
                      onClick={() => allow(chat)}
                      disabled={pending}
                    >
                      Allow
                    </ActionButton>
                  )}
                </li>
              ))}
            </ul>
          )}

          <Separator />

          <div className="flex flex-col gap-2">
            <SectionTitle>Add by chat id</SectionTitle>
            <p className="text-xs text-muted-foreground">
              For an install where the bot cannot be restarted to notice the
              group on its own.
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
        </CardContent>
      </Card>
    </div>
  );
}
