"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { CheckIcon, Loader2Icon, OctagonXIcon, RadioIcon } from "lucide-react";
import {
  addTelegramChatManuallyAction,
  allowTelegramChatAction,
} from "@/lib/actions/onboarding";
import { PlateAddToGroup } from "@/components/onboarding/illustrations/group";
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
import type { PublicTelegramChat, ResolvedBot } from "./types";

/**
 * Step 4. The first allowed group, and the second gate.
 *
 * Nothing here can be done by the web process. The group is discovered when the
 * operator adds the bot to it and the *bot* process writes the row from a
 * my_chat_member update. So the page waits, polling, and shows groups as they
 * turn up.
 *
 * This step used to be skippable, with a note saying Askarr must boot with no
 * group rather than hold the operator hostage. That reasoning still holds for
 * Radarr, which someone may genuinely not have installed yet. It does not hold
 * here: a bot with nowhere to speak is not a working install, and letting
 * someone finish setup into that state means the first thing they learn about
 * Askarr is that it does nothing.
 *
 * The manual chat-id field stays, and it is what keeps the gate from being a
 * trap: an install where the bot cannot report the group itself still has a way
 * through.
 */

const POLL_INTERVAL_MS = 3000;

export function StepTelegram({
  bot,
  onDone,
  onBack,
}: {
  bot: ResolvedBot | null;
  onDone: (allowed: PublicTelegramChat[]) => void;
  onBack: () => void;
}) {
  const [chats, setChats] = useState<PublicTelegramChat[]>([]);
  const [listening, setListening] = useState(true);
  const [allowingChatId, setAllowingChatId] = useState<string | null>(null);
  const [manualChatId, setManualChatId] = useState("");
  const [manualError, setManualError] = useState<string | null>(null);
  const [addingManually, setAddingManually] = useState(false);

  /*
   * Polling rather than a websocket: the bot runs in a separate process and the
   * only thing they share is Postgres. A 3s beat is invisible to the operator
   * and costs one indexed read.
   */
  const stopped = useRef(false);
  useEffect(() => {
    stopped.current = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function tick() {
      try {
        const response = await fetch("/api/onboarding/telegram-chats", {
          cache: "no-store",
        });

        if (response.status === 410) {
          // Setup was completed in another tab. Stop, do not retry.
          stopped.current = true;
          setListening(false);
          return;
        }

        if (response.ok) {
          const body = (await response.json()) as {
            chats: PublicTelegramChat[];
          };
          if (!stopped.current) setChats(body.chats);
        }
      } catch {
        // A dropped request is normal on a home server; the next beat retries.
      }

      if (!stopped.current) timer = setTimeout(tick, POLL_INTERVAL_MS);
    }

    void tick();

    return () => {
      stopped.current = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  const mergeChat = useCallback((chat: PublicTelegramChat) => {
    setChats((current) => {
      const index = current.findIndex((entry) => entry.chatId === chat.chatId);
      if (index === -1) return [...current, chat];
      const next = [...current];
      next[index] = chat;
      return next;
    });
  }, []);

  async function onAllow(chatId: string) {
    setAllowingChatId(chatId);
    const result = await allowTelegramChatAction(chatId);
    setAllowingChatId(null);

    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    mergeChat(result.chat);
    toast.success(`${result.chat.title ?? "Group"} allowed.`);
  }

  async function onAddManually() {
    setManualError(null);
    setAddingManually(true);
    const result = await addTelegramChatManuallyAction({
      chatId: manualChatId,
    });
    setAddingManually(false);

    if (!result.ok) {
      setManualError(result.message);
      return;
    }

    mergeChat(result.chat);
    setManualChatId("");
    toast.success("Group allowed.");
  }

  const allowed = chats.filter((chat) => chat.enabled);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Allow your first group</CardTitle>
        <CardDescription>
          Askarr answers only in groups you allow. A message from anywhere else
          gets no reply at all: not an error, not a refusal.
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
                Add{" "}
                <span className="font-data text-foreground">
                  @{bot?.username ?? "your_bot"}
                </span>{" "}
                to your group, promote it to administrator, then send any
                message.
              </span>
            </p>
            <PlateAddToGroup />
          </div>

          <div className="flex min-w-0 flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-bold text-foreground">
                Discovered groups
              </h2>
              {listening && (
                <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <RadioIcon
                    className="size-3.5 text-primary motion-safe:animate-pulse"
                    aria-hidden
                  />
                  Listening
                </span>
              )}
            </div>

            {/* Groups arrive without a user action, so announce them politely. */}
            <div aria-live="polite" className="flex flex-col gap-2">
              {chats.length === 0 ? (
                <p className="rounded-md border border-border bg-surface px-4 py-5 text-base text-muted-foreground">
                  No group yet. Add the bot to one and send a message. This list
                  updates on its own.
                </p>
              ) : (
                chats.map((chat) => (
                  <div
                    key={chat.id}
                    className="flex flex-col gap-2 rounded-md border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-base text-foreground">
                        {chat.title ?? "Untitled group"}
                      </p>
                      <p className="font-data text-sm text-muted-foreground">
                        {chat.chatId}
                      </p>
                    </div>

                    {chat.enabled ? (
                      <StatusLabel
                        kind="success"
                        variant="outline"
                        className="w-fit"
                      >
                        <CheckIcon aria-hidden className="inline size-3" />{" "}
                        Allowed
                      </StatusLabel>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-fit"
                        disabled={allowingChatId === chat.chatId}
                        onClick={() => onAllow(chat.chatId)}
                      >
                        {allowingChatId === chat.chatId && (
                          <Loader2Icon className="animate-spin" aria-hidden />
                        )}
                        Allow
                      </Button>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="manual-chat-id">Or enter a chat id</Label>
              <p
                id="manual-chat-id-hint"
                className="text-sm text-muted-foreground"
              >
                The way through when the bot cannot report the group itself.
                Group ids are negative.
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  id="manual-chat-id"
                  inputMode="numeric"
                  placeholder="-1001234567890"
                  className="font-data sm:flex-1"
                  aria-describedby="manual-chat-id-hint"
                  aria-invalid={manualError ? true : undefined}
                  value={manualChatId}
                  onChange={(event) => {
                    setManualChatId(event.target.value);
                    setManualError(null);
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={manualChatId.trim().length === 0 || addingManually}
                  onClick={onAddManually}
                >
                  {addingManually && (
                    <Loader2Icon className="animate-spin" aria-hidden />
                  )}
                  Allow
                </Button>
              </div>
              {manualError && (
                <p role="alert" className="text-sm text-destructive">
                  {manualError}
                </p>
              )}
            </div>
          </div>
        </div>

        {chats.length > 0 && allowed.length === 0 && (
          <Alert variant="warning">
            <OctagonXIcon />
            <AlertTitle>Nothing is allowed yet</AlertTitle>
            <AlertDescription>
              Askarr found a group but will stay silent in it until you press
              Allow.
            </AlertDescription>
          </Alert>
        )}

        <Separator />

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <Button type="button" variant="ghost" size="lg" onClick={onBack}>
            Back
          </Button>
          <Button
            type="button"
            size="lg"
            disabled={allowed.length === 0}
            onClick={() => onDone(allowed)}
          >
            {allowed.length > 1
              ? `Continue with ${allowed.length} groups`
              : "Continue"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
