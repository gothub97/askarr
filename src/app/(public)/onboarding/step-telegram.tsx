"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  CheckIcon,
  Loader2Icon,
  OctagonXIcon,
  RadioIcon,
} from "lucide-react";
import {
  addTelegramChatManuallyAction,
  allowTelegramChatAction,
  resolveTelegramBotAction,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import type { PublicTelegramChat } from "./types";

/**
 * Step 3 — the Telegram group.
 *
 * Nothing here can be done by the web process: the group is discovered when
 * the operator adds the bot to it and the *bot* process writes the row. So the
 * page waits, polling, and shows groups as they turn up. A manual chat_id
 * entry is the escape hatch for an install where the bot cannot be restarted.
 */

const POLL_INTERVAL_MS = 3000;

export function StepTelegram({
  onDone,
  onSkip,
}: {
  onDone: () => void;
  onSkip: () => void;
}) {
  const [bot, setBot] = useState<{ username: string; displayName: string } | null>(
    null,
  );
  const [botError, setBotError] = useState<string | null>(null);
  const [chats, setChats] = useState<PublicTelegramChat[]>([]);
  const [listening, setListening] = useState(true);
  const [allowingChatId, setAllowingChatId] = useState<string | null>(null);
  const [manualChatId, setManualChatId] = useState("");
  const [manualError, setManualError] = useState<string | null>(null);
  const [addingManually, setAddingManually] = useState(false);

  useEffect(() => {
    let cancelled = false;
    resolveTelegramBotAction().then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setBot({ username: result.username, displayName: result.displayName });
      } else {
        setBotError(result.message);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  /*
   * Polling rather than a websocket: the bot runs in a separate process and
   * the only thing they share is Postgres. A 3s beat is invisible to the
   * operator and costs one indexed read.
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

  const allowedCount = chats.filter((chat) => chat.enabled).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">
          Allow a Telegram group
        </CardTitle>
        <CardDescription>
          Askarr only answers in groups you allow. Add the bot to yours and it
          will show up below.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {botError && (
          <Alert variant="destructive">
            <OctagonXIcon />
            <AlertTitle>Bot not reachable</AlertTitle>
            <AlertDescription>{botError}</AlertDescription>
          </Alert>
        )}

        <div className="rounded-md border border-border p-3">
          <p className="text-sm text-muted-foreground">Your bot</p>
          {bot ? (
            <p className="mt-0.5 text-base text-foreground">
              {bot.displayName}{" "}
              <span className="font-data text-muted-foreground">
                @{bot.username}
              </span>
            </p>
          ) : (
            <p className="mt-0.5 text-base text-muted-foreground">
              {botError ? "Unknown" : "Resolving…"}
            </p>
          )}

          <ol className="mt-3 flex list-decimal flex-col gap-1 pl-4 text-base text-muted-foreground">
            <li>Open your Telegram group.</li>
            <li>
              Add{" "}
              <span className="font-data">
                @{bot?.username ?? "your_bot"}
              </span>{" "}
              as a member.
            </li>
            <li>Promote it to administrator so it can read requests.</li>
            <li>Send any message in the group.</li>
          </ol>
        </div>

        <Separator />

        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-medium text-foreground">
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
            <p className="rounded-md border border-border bg-surface p-3 text-base text-muted-foreground">
              No group yet. Add the bot to a group and send a message — this
              list updates on its own.
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
                    {chat.threadId !== null && ` · topic ${chat.threadId}`}
                  </p>
                </div>

                {chat.enabled ? (
                  <Badge variant="outline" className="w-fit text-positive">
                    <CheckIcon aria-hidden />
                    Allowed
                  </Badge>
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

        <Separator />

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="manual-chat-id">Or enter a chat id</Label>
          <p id="manual-chat-id-hint" className="text-sm text-muted-foreground">
            Use this if the bot cannot report the group itself. Group ids are
            negative.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id="manual-chat-id"
              inputMode="numeric"
              placeholder="-1001234567890"
              className="font-data"
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
              className="sm:w-auto"
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

        <Separator />

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <Button type="button" variant="ghost" size="lg" onClick={onSkip}>
            Skip for now
          </Button>
          <Button type="button" size="lg" onClick={onDone}>
            {allowedCount > 0
              ? `Continue with ${allowedCount} group${allowedCount > 1 ? "s" : ""}`
              : "Continue"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
