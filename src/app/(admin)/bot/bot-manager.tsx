"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Data } from "@/components/admin/data";
import { Label as StatusChip } from "@/components/status-label";
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
  getBotOverviewAction,
  restartBotAction,
  saveBotTokenAction,
} from "@/lib/actions/bot";

/**
 * Bot setup, in the back office rather than only in the wizard.
 *
 * The panel polls: whether the bot process is alive is written by the *other*
 * process, so it cannot be known from a single server render, and asking an
 * admin to keep pressing refresh is not a setup flow.
 *
 * The connection and the token are one panel because they are one subject —
 * the token is the only thing that changes the connection, and reading the
 * state then acting on it two panels down was a scroll for no reason. Groups
 * live on the Groups page, with the groups they become.
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
    // Saving a token here cannot start anything: the bot is its own process,
    // and the back office can only talk to one that is already up. Saying
    // "not running" without saying how to run it reads as a broken token.
    return {
      tone: "bad",
      label: "Not running",
      detail:
        status.runtime?.state === "stopped"
          ? "The bot process shut down cleanly. The token below is saved and will be picked up as soon as it starts again."
          : "The token below is saved, but nothing is polling Telegram. The bot runs as its own process, separate from this web app — start it and this turns green on its own.",
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

const TONE_KIND = {
  good: "success",
  waiting: "warning",
  bad: "danger",
} as const;

function ago(ms: number | null): string {
  if (ms === null) return "never";
  const seconds = Math.max(0, Math.round(ms / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  return `${Math.round(seconds / 60)}m ago`;
}

export function BotManager({
  initialOverview,
}: {
  initialOverview: BotOverview;
}) {
  const router = useRouter();
  const [overview, setOverview] = useState(initialOverview);
  const [token, setToken] = useState("");
  const [pending, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const next = await getBotOverviewAction();
      if (!mounted.current) return;
      setOverview(next);
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

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-col gap-1">
            <CardTitle>Connection</CardTitle>
            <CardDescription>
              Written by the bot process, read here. It updates on its own.
            </CardDescription>
          </div>
          <StatusChip kind={TONE_KIND[status.tone]} size="sm">
            {status.label}
          </StatusChip>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <p className="text-base text-muted-foreground">{status.detail}</p>

        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="flex flex-col gap-1">
            <dt className="text-sm text-muted-foreground">Bot</dt>
            <dd>
              {overview.status.runtime?.username ? (
                <Data>@{overview.status.runtime.username}</Data>
              ) : (
                <span className="text-base text-muted-foreground">—</span>
              )}
            </dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-sm text-muted-foreground">Last heartbeat</dt>
            <dd>
              <Data>{ago(overview.status.ageMs)}</Data>
            </dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-sm text-muted-foreground">Token source</dt>
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

        {!overview.status.alive && (
          <div className="flex flex-col gap-2 rounded-md border border-border bg-background p-3">
            <p className="text-sm text-muted-foreground">Start the bot process:</p>
            <Data className="text-foreground">docker compose up -d bot</Data>
            <p className="text-sm text-muted-foreground">
              Or <Data>npm run dev:bot</Data> when running from source.
            </p>
          </div>
        )}

        <div>
          <Button
            size="sm"
            onClick={restart}
            // A restart request is a row the bot reads on its next tick.
            // Nothing reads it while the process is down, so offering the
            // button there would promise something it cannot do.
            disabled={
              pending ||
              !overview.status.alive ||
              overview.token.source === "missing"
            }
            title={
              overview.status.alive
                ? undefined
                : "The bot is not running, so there is nothing to restart."
            }
          >
            Restart bot
          </Button>
        </div>

        <Separator />

        <div className="flex flex-col gap-2">
          <Label htmlFor="bot-token">New token from BotFather</Label>
          <p className="text-sm text-muted-foreground">
            Askarr checks a token with Telegram before saving it, then the bot
            reconnects on its own. The saved token is never shown again.
          </p>
          <Input
            id="bot-token"
            className="font-data"
            autoComplete="off"
            spellCheck={false}
            placeholder="123456789:AA…"
            value={token}
            onChange={(event) => setToken(event.target.value)}
          />
          <p className="text-sm text-muted-foreground">
            Replacing the token signs the old one out. Anything already sent
            stays; the Mini App re-authenticates against the new token.
          </p>
          <div className="pt-1">
            <Button
              size="sm"
              onClick={() => void saveToken()}
              disabled={saving || token.trim().length === 0}
            >
              {saving ? "Checking with Telegram…" : "Save token"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
