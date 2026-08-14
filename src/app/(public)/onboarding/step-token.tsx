"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { CheckIcon, Loader2Icon, OctagonXIcon } from "lucide-react";
import {
  getBotRuntimeAction,
  saveTelegramTokenAction,
} from "@/lib/actions/onboarding";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { Label as StatusLabel } from "@/components/status-label";
import { cn } from "@/lib/utils";
import type { PublicBotRuntime, ResolvedBot } from "./types";

/**
 * Step 3. The token, and the first gate.
 *
 * Two things happen when this saves, and the operator should see both.
 *
 * The token is checked with getMe *before* it is written, so a typo fails here
 * rather than an hour later as a silence in a group. Then writing it bumps the
 * version the bot process watches, and that process, a separate one sharing
 * only Postgres, drops whatever it was doing and reconnects. Its idle loop
 * wakes within 500ms of the bump (see src/bot/index.ts), so the wait is short
 * enough to watch.
 *
 * Watching it is the point. The web process cannot talk to Telegram on the
 * bot's behalf, so "Telegram accepted this token" is not the same claim as
 * "your bot is running". The runtime line below reports the second one, from
 * the bot's own heartbeat, and it is the only honest confirmation this wizard
 * can give.
 */

const POLL_INTERVAL_MS = 1500;
/** Long enough for a bot that is starting; short enough to stop pretending. */
const POLL_TIMEOUT_MS = 30_000;

export function StepToken({
  initialBot,
  initialHasToken,
  tokenHint,
  onDone,
  onBack,
}: {
  initialBot: ResolvedBot | null;
  initialHasToken: boolean;
  tokenHint: string | null;
  /** Hands the resolved bot up, so step 4 can tell the operator what to add. */
  onDone: (bot: ResolvedBot | null) => void;
  onBack: () => void;
}) {
  const [token, setToken] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bot, setBot] = useState<ResolvedBot | null>(initialBot);
  const [saved, setSaved] = useState(initialHasToken);
  const [runtime, setRuntime] = useState<PublicBotRuntime | null>(null);

  /*
   * Polling rather than a socket, for the same reason step 4 polls: the bot is
   * another process and the only thing the two share is the database. It stops
   * once the bot is polling, and gives up after POLL_TIMEOUT_MS rather than
   * beating forever against an install where the bot process was never started.
   */
  const settled = runtime?.state === "polling" && runtime.fresh;
  const shouldPoll = saved && !settled;
  const startedAt = useRef<number | null>(null);

  useEffect(() => {
    if (!shouldPoll) return;
    startedAt.current ??= Date.now();

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function tick() {
      const next = await getBotRuntimeAction().catch(() => null);
      if (cancelled) return;
      if (next) setRuntime(next);

      const elapsed = Date.now() - (startedAt.current ?? Date.now());
      if (!cancelled && elapsed < POLL_TIMEOUT_MS) {
        timer = setTimeout(tick, POLL_INTERVAL_MS);
      }
    }

    void tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [shouldPoll]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaving(true);

    const result = await saveTelegramTokenAction({ token });
    setSaving(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    setBot({ username: result.username, displayName: result.displayName });
    setSaved(true);
    setToken("");
    // A fresh save means a fresh wait, even if an earlier one had settled.
    startedAt.current = null;
    setRuntime(null);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Paste the token</CardTitle>
        <CardDescription>
          Checked with Telegram before it is saved, so a typo fails here and not
          silently an hour later.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {error && (
          <Alert variant="destructive">
            <OctagonXIcon />
            <AlertTitle>Token not saved</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-1.5">
          <Label htmlFor="bot-token">Token from BotFather</Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id="bot-token"
              autoFocus
              autoComplete="off"
              spellCheck={false}
              placeholder="123456789:AA…"
              className="font-data sm:flex-1"
              aria-describedby="bot-token-hint"
              aria-invalid={error ? true : undefined}
              value={token}
              onChange={(event) => {
                setToken(event.target.value);
                setError(null);
              }}
            />
            <Button type="submit" disabled={saving || token.trim().length === 0}>
              {saving && <Loader2Icon className="animate-spin" aria-hidden />}
              {saving ? "Checking with Telegram" : saved ? "Replace it" : "Check and save"}
            </Button>
          </div>
          <p id="bot-token-hint" className="text-sm text-muted-foreground">
            Stored encrypted. Only the last four characters are ever shown again,
            so two tokens can be told apart without either being usable.
            {saved && tokenHint && !bot ? ` One ending ${tokenHint} is already saved.` : ""}
          </p>
        </form>

        {saved && (
          <div className="flex flex-col gap-3 rounded-md border border-border bg-surface p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              {bot ? (
                <span className="text-base text-foreground">
                  {bot.displayName}{" "}
                  <span className="font-data text-muted-foreground">
                    @{bot.username}
                  </span>
                </span>
              ) : (
                <span className="text-base text-muted-foreground">
                  A token is already saved
                  {tokenHint ? `, ending ${tokenHint}` : ""}.
                </span>
              )}
              <StatusLabel kind="success" variant="outline">
                <CheckIcon aria-hidden />
                Token accepted
              </StatusLabel>
            </div>

            <Separator />

            <div
              aria-live="polite"
              className="flex flex-wrap items-center justify-between gap-2"
            >
              <span className="text-sm text-muted-foreground">Bot process</span>
              <RuntimeLine runtime={runtime} waiting={shouldPoll} />
            </div>
          </div>
        )}

        <Separator />

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <Button type="button" variant="ghost" size="lg" onClick={onBack}>
            Back
          </Button>
          <Button
            type="button"
            size="lg"
            disabled={!saved}
            onClick={() => onDone(bot)}
          >
            Continue
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * The bot's own account of itself.
 *
 * Every unhappy state here is actionable, so each one says what to do rather
 * than naming the state. "unreachable" in particular is not the operator's
 * fault and must not read like an error they caused.
 */
function RuntimeLine({
  runtime,
  waiting,
}: {
  runtime: PublicBotRuntime | null;
  waiting: boolean;
}) {
  const settled = runtime?.state === "polling" && runtime.fresh;

  const description = (() => {
    if (settled) return "connected, polling Telegram";
    if (!runtime) {
      return waiting
        ? "waiting for the bot to pick the token up"
        : "no heartbeat yet";
    }
    switch (runtime.state) {
      case "polling":
        return "last seen polling, but the heartbeat has gone quiet";
      case "starting":
        return "reconnecting with the new token";
      case "no_token":
        return "reconnecting with the new token";
      case "token_rejected":
        return runtime.detail ?? "Telegram rejected the token";
      case "unreachable":
        return runtime.detail ?? "cannot reach Telegram from this machine";
      case "stopped":
        return "the bot process is not running";
    }
  })();

  const tone =
    settled
      ? "bg-positive"
      : runtime?.state === "token_rejected" || runtime?.state === "stopped"
        ? "bg-destructive"
        : "bg-warning";

  return (
    <span className="flex items-center gap-2 text-sm text-muted-foreground">
      <span
        aria-hidden
        className={cn(
          "size-2 shrink-0 rounded-full",
          tone,
          !settled && "motion-safe:animate-pulse",
        )}
      />
      {description}
    </span>
  );
}
