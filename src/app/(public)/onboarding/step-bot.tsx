"use client";

import type { ReactNode } from "react";
import { LockIcon } from "lucide-react";
import {
  PlateInline,
  PlateNaming,
  PlateNewBot,
  PlatePrivacy,
  PlateToken,
} from "@/components/onboarding/illustrations/botfather";
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

/**
 * Step 2. Creating the bot.
 *
 * The one step with no input, no action and no network call. It exists because
 * the alternative is what Askarr did before: ask for a token, and leave the
 * operator to find out elsewhere where tokens come from. That instruction lived
 * in README.md, which is not where someone stuck in a wizard is looking.
 *
 * It teaches and does not gate. Someone who already has a bot walks past it in
 * one click, and nothing here can fail in a way that traps them.
 *
 * Two of the five commands are easy to skip and expensive to miss:
 *
 *   /setprivacy  keeps the bot from reading the group's conversation. It is on
 *                by default, so this is a confirmation rather than a change,
 *                and the whole design rests on it.
 *   /setinline   is *off* by default, and turning it on is written down nowhere
 *                else. Without it `@yourbot dune` silently does nothing, which
 *                reads as a broken install rather than an unset switch.
 */

export function StepBot({
  onDone,
  onBack,
}: {
  onDone: () => void;
  onBack: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Create your bot</CardTitle>
        <CardDescription>
          Telegram bots are made by a bot. About a minute in @BotFather, and you
          will not need it again.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <ol className="grid gap-4 sm:grid-cols-2">
          <Instruction
            number={1}
            plate={<PlateNewBot />}
            text={
              <>
                Open{" "}
                <a
                  href="https://t.me/botfather"
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary underline-offset-2 hover:underline"
                >
                  @BotFather
                </a>{" "}
                and send <Command>/newbot</Command>.
              </>
            }
          />
          <Instruction
            number={2}
            plate={<PlateNaming />}
            text={
              <>
                Give it a display name, then a username ending in{" "}
                <Command>bot</Command>.
              </>
            }
          />
          <Instruction
            number={3}
            plate={<PlateToken />}
            text="BotFather answers with the token. Copy the whole line, you need it on the next step."
          />
          <Instruction
            number={4}
            plate={<PlatePrivacy />}
            text={
              <>
                Send <Command>/setprivacy</Command> and choose{" "}
                <strong className="font-bold text-foreground">Enable</strong>.
              </>
            }
          />
          <Instruction
            number={5}
            plate={<PlateInline />}
            text={
              <>
                Send <Command>/setinline</Command> and give it a placeholder.
                This one is off by default and Askarr needs it on.
              </>
            }
          />
        </ol>

        <Alert>
          <LockIcon />
          <AlertTitle>Privacy mode is the whole design</AlertTitle>
          <AlertDescription>
            With it on, the bot sees commands and replies to its own messages,
            and nothing else. Your group&apos;s conversation stays yours. Inline
            mode does not weaken that: it answers on identity, so only someone
            who has already spoken in an allowed group gets results.
          </AlertDescription>
        </Alert>

        <Separator />

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <Button type="button" variant="ghost" size="lg" onClick={onBack}>
            Back
          </Button>
          <Button type="button" size="lg" onClick={onDone}>
            I have my token
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Instruction({
  number,
  text,
  plate,
}: {
  number: number;
  text: ReactNode;
  plate: ReactNode;
}) {
  return (
    <li className="flex min-w-0 flex-col gap-1.5">
      <p className="flex gap-2 text-sm text-muted-foreground">
        {/* The brand hue as chrome, never as a fill: see globals.css. */}
        <span aria-hidden className="shrink-0 font-data text-brand">
          {String(number).padStart(2, "0")}
        </span>
        <span>{text}</span>
      </p>
      {plate}
    </li>
  );
}

function Command({ children }: { children: string }) {
  return <span className="font-data text-foreground">{children}</span>;
}
