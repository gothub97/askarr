"use client";

import { useEffect, useState } from "react";
import { Loader2Icon, OctagonXIcon, TriangleAlertIcon } from "lucide-react";
import {
  completeSetupAction,
  getSetupSummaryAction,
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
import { Separator } from "@/components/ui/separator";
import { Label as StatusLabel } from "@/components/status-label";
import type { ResolvedBot, SetupSummary } from "./types";

/**
 * Step 7. The recap, then the point of no return.
 *
 * The recap is read back from the database rather than from wizard state: what
 * matters is what was actually written, not what the browser thinks it sent.
 *
 * The last block is the one worth having. Two things cannot be finished from
 * here (the Mini App has to be switched on in BotFather by hand, and quotas
 * start at a default nobody chose) and an operator who is not told will find
 * out from a person asking why something does not work. Saying it here costs a
 * paragraph.
 */

export function StepSummary({
  bot,
  onBack,
}: {
  bot: ResolvedBot | null;
  onBack: () => void;
}) {
  const [summary, setSummary] = useState<SetupSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getSetupSummaryAction().then((result) => {
      if (cancelled) return;
      if (result.ok) setSummary(result.summary);
      else setError(result.message);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function onFinish() {
    setError(null);
    setFinishing(true);
    /*
     * On success this action redirects and never returns a value; the router
     * takes over. Only a refusal comes back through here.
     */
    const result = await completeSetupAction();
    setFinishing(false);
    if (result?.message) setError(result.message);
  }

  const admin = summary?.administrator ?? null;
  const instances = summary?.instances ?? [];
  const allowedChats = summary?.chats.filter((chat) => chat.enabled) ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Askarr is running</CardTitle>
        <CardDescription>
          Finishing locks this wizard for good. Everything below stays editable
          from the back office.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {error && (
          <Alert variant="destructive">
            <OctagonXIcon />
            <AlertTitle>Setup not finished</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {!summary && !error ? (
          <p className="text-base text-muted-foreground">Reading back setup…</p>
        ) : (
          <div className="flex flex-col rounded-md border border-border">
            <Row
              label="Administrator"
              detail={admin ? admin.email : "None. Go back to step 1."}
              status={admin ? "Created" : null}
            />
            <Row
              label={bot?.displayName ?? "Bot"}
              detail={bot ? `@${bot.username}` : "Token saved"}
              status="Connected"
            />
            <Row
              label={
                allowedChats.length === 1
                  ? (allowedChats[0]?.title ?? "Group")
                  : `${allowedChats.length} groups`
              }
              detail={
                allowedChats.length === 1
                  ? (allowedChats[0]?.chatId ?? "")
                  : allowedChats.map((chat) => chat.chatId).join(", ")
              }
              status="Allowed"
            />
            <Row
              label={
                instances.length === 0
                  ? "Radarr and Sonarr"
                  : instances.map((instance) => instance.label).join(", ")
              }
              detail={
                instances.length === 0
                  ? "None yet. Askarr will accept no request until you add one."
                  : instances.map((instance) => instance.baseUrl).join(", ")
              }
              status={instances.length === 0 ? null : "Connected"}
              last
            />
          </div>
        )}

        <Alert variant="warning">
          <TriangleAlertIcon />
          <AlertTitle>Two things Askarr cannot do for you</AlertTitle>
          <AlertDescription>
            The Mini App has to be switched on in BotFather by hand, under Bot
            Settings then Configure Mini App. And everyone starts on five
            requests a month until you change it under Settings.
          </AlertDescription>
        </Alert>

        <Separator />

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <Button type="button" variant="ghost" size="lg" onClick={onBack}>
            Back
          </Button>
          <Button
            type="button"
            size="lg"
            disabled={finishing || !admin}
            onClick={onFinish}
          >
            {finishing && <Loader2Icon className="animate-spin" aria-hidden />}
            {finishing ? "Finishing setup" : "Open the dashboard"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Row({
  label,
  detail,
  status,
  last,
}: {
  label: string;
  detail: string;
  status: string | null;
  last?: boolean;
}) {
  return (
    <div
      className={
        last
          ? "flex flex-wrap items-center justify-between gap-2 p-3"
          : "flex flex-wrap items-center justify-between gap-2 border-b border-border p-3"
      }
    >
      <div className="min-w-0">
        <p className="truncate text-base text-foreground">{label}</p>
        <p className="truncate font-data text-sm text-muted-foreground">
          {detail}
        </p>
      </div>
      {status ? (
        <StatusLabel kind="success">{status}</StatusLabel>
      ) : (
        <StatusLabel kind="disabled">Not set</StatusLabel>
      )}
    </div>
  );
}
