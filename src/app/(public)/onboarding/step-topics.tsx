"use client";

import { useState } from "react";
import { CheckCircle2Icon, Loader2Icon, OctagonXIcon } from "lucide-react";
import { createForumTopicsAction } from "@/lib/actions/chats";
import { PlateTopics } from "@/components/onboarding/illustrations/group";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { PublicTelegramChat } from "./types";

/**
 * Step 5. Forum topics. Optional, and offered rather than buried.
 *
 * The action behind this button already existed, but only on /chats, which is a
 * page a first-run operator has never seen. Someone finishing setup without
 * being shown it ends up with requests, approvals and announcements competing
 * for one stream, and no reason to think it could be otherwise.
 *
 * There is no dropdown to pick an existing topic from, and there cannot be: the
 * Bot API has createForumTopic and no getForumTopics. Creating them is the one
 * path that ends with the right ids and no copying of links by hand.
 *
 * Skippable in both directions. If the group is not a forum the action says so
 * plainly, and turning Topics on is a thing only the operator can do, in
 * Telegram, with the switch the plate points at.
 */

export function StepTopics({
  chats,
  alreadyCreated,
  onDone,
  onBack,
}: {
  chats: PublicTelegramChat[];
  /** True when a resumed wizard finds the topics already stored. */
  alreadyCreated: boolean;
  onDone: () => void;
  onBack: () => void;
}) {
  const [target, setTarget] = useState(chats[0]?.id ?? null);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState(alreadyCreated);
  const [error, setError] = useState<string | null>(null);

  async function onCreate() {
    if (!target) return;
    setError(null);
    setCreating(true);
    const result = await createForumTopicsAction({ id: target });
    setCreating(false);

    if (!result.ok) {
      setError(result.message ?? "Could not create the topics.");
      return;
    }
    setCreated(true);
  }

  const chat = chats.find((entry) => entry.id === target) ?? null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">
          Keep the three kinds of message apart
        </CardTitle>
        <CardDescription>
          Optional, and worth it. With Topics on, requests, approvals and
          announcements stop competing for the same scroll.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-1.5">
            <p className="flex gap-2 text-sm text-muted-foreground">
              <span aria-hidden className="shrink-0 font-data text-brand">
                01
              </span>
              <span>
                Turn{" "}
                <strong className="font-bold text-foreground">Topics</strong> on
                in your group&apos;s settings first. Only you can do that, in
                Telegram.
              </span>
            </p>
            <PlateTopics />
          </div>

          <div className="flex min-w-0 flex-col gap-3">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Topic</TableHead>
                  <TableHead>What lands there</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>Request</TableCell>
                  <TableCell className="text-muted-foreground">
                    where people ask for a film or a show
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Approval</TableCell>
                  <TableCell className="text-muted-foreground">
                    where admins approve or turn a request down
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>General</TableCell>
                  <TableCell className="text-muted-foreground">
                    where a new film or show is announced once it lands
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>

            {chats.length > 1 && (
              <div className="flex flex-wrap gap-1.5">
                {chats.map((entry) => (
                  <Button
                    key={entry.id}
                    type="button"
                    size="sm"
                    variant={entry.id === target ? "default" : "outline"}
                    onClick={() => {
                      setTarget(entry.id);
                      setCreated(false);
                      setError(null);
                    }}
                  >
                    {entry.title ?? entry.chatId}
                  </Button>
                ))}
              </div>
            )}

            {error && (
              <Alert variant="destructive">
                <OctagonXIcon />
                <AlertTitle>Topics not created</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {created ? (
              <Alert variant="success">
                <CheckCircle2Icon />
                <AlertTitle>Three topics created</AlertTitle>
                <AlertDescription>
                  Request, Approval and General, with their ids stored.
                </AlertDescription>
              </Alert>
            ) : (
              <Button
                type="button"
                variant="outline"
                disabled={!target || creating}
                onClick={onCreate}
                className="w-fit"
              >
                {creating && <Loader2Icon className="animate-spin" aria-hidden />}
                {creating
                  ? "Creating the topics"
                  : "Create the missing topics"}
              </Button>
            )}

            <p className="text-sm text-muted-foreground">
              Askarr creates them in{" "}
              {chat?.title ?? "your group"} and remembers their ids. Pressing it
              twice is safe: it only fills the purposes still unset.
            </p>
          </div>
        </div>

        <Separator />

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <Button type="button" variant="ghost" size="lg" onClick={onBack}>
            Back
          </Button>
          <Button type="button" size="lg" onClick={onDone}>
            {created ? "Continue" : "Skip for now"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
