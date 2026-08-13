"use client";

import { useEffect, useState } from "react";
import { Loader2Icon, OctagonXIcon } from "lucide-react";
import {
  completeSetupAction,
  getSetupSummaryAction,
} from "@/lib/actions/onboarding";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { Administrator } from "./onboarding-wizard";
import type { SetupSummary } from "./types";

/**
 * Step 4 — the recap, then the point of no return.
 *
 * The recap is read back from the database rather than from wizard state: what
 * matters is what was actually written, not what the browser thinks it sent.
 */

export function StepSummary({
  administrator,
  onBack,
}: {
  administrator: Administrator | null;
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

  const admin = summary?.administrator ?? administrator;
  const instances = summary?.instances ?? [];
  const allowedChats = summary?.chats.filter((chat) => chat.enabled) ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-lg">
          Check and finish
        </CardTitle>
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
          <p className="text-sm text-muted-foreground">Reading back setup…</p>
        ) : (
          <>
            <section className="flex flex-col gap-1.5">
              <h2 className="text-xs text-muted-foreground">Administrator</h2>
              {admin ? (
                <p className="text-sm text-foreground">
                  {admin.name}{" "}
                  <span className="font-data text-muted-foreground">
                    {admin.email}
                  </span>
                </p>
              ) : (
                <p className="text-sm text-destructive">
                  No administrator. Go back to step 1 and create one.
                </p>
              )}
            </section>

            <Separator />

            <section className="flex flex-col gap-2">
              <h2 className="text-xs text-muted-foreground">Instances</h2>
              {instances.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">
                  No instance connected. Askarr will accept no request until
                  you add Radarr or Sonarr from Instances.
                </p>
              ) : (
                instances.map((instance) => (
                  <div
                    key={instance.id}
                    className="flex flex-col gap-1 rounded-lg border border-border p-3"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm text-foreground">
                        {instance.label}
                      </span>
                      <Badge variant="outline">{instance.kind}</Badge>
                    </div>
                    <p className="font-data text-xs break-all text-muted-foreground">
                      {instance.baseUrl}
                    </p>
                    <p className="font-data text-xs break-all text-muted-foreground">
                      {instance.rootFolderPath} · profile{" "}
                      {instance.qualityProfileId}
                    </p>
                  </div>
                ))
              )}
            </section>

            <Separator />

            <section className="flex flex-col gap-2">
              <h2 className="text-xs text-muted-foreground">Allowed groups</h2>
              {allowedChats.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">
                  No group allowed. The bot will stay silent everywhere until
                  you allow one from Telegram groups.
                </p>
              ) : (
                allowedChats.map((chat) => (
                  <div
                    key={chat.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-border p-3"
                  >
                    <span className="truncate text-sm text-foreground">
                      {chat.title ?? "Untitled group"}
                    </span>
                    <span className="font-data text-xs text-muted-foreground">
                      {chat.chatId}
                    </span>
                  </div>
                ))
              )}
            </section>
          </>
        )}

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
            {finishing ? "Finishing setup" : "Finish setup"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
