"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { StepAccount } from "./step-account";
import { StepBot } from "./step-bot";
import { StepInstance } from "./step-instance";
import { StepSummary } from "./step-summary";
import { StepTelegram } from "./step-telegram";
import { StepTopics } from "./step-topics";
import { StepToken } from "./step-token";
import type { PublicTelegramChat, ResolvedBot, SetupProgress } from "./types";

/**
 * The first-run wizard: one card per step, seven of them.
 *
 * Three of the seven are gates, and the choice of which is the whole argument
 * of this file.
 *
 *   1. The administrator, because there has to be someone to sign in as, and
 *      this is the only screen that can ever mint one.
 *   3. The token, because without a bot there is nothing to configure.
 *   4. The first group, because a bot with nowhere to speak is not a working
 *      install, and someone who finishes setup into that state learns about
 *      Askarr by watching it do nothing.
 *
 * Radarr and Sonarr stay skippable. Askarr has to be installable before Radarr
 * is, and holding an operator hostage for credentials to a server they have not
 * set up yet is a different failure from the one above.
 *
 * Two of the gates send the operator out of the browser, to BotFather and to a
 * Telegram group, and some will close the tab. Until setup_completed is true
 * the middleware holds every route at /onboarding, so a wizard that forgot its
 * position would strand them at step 1 with a bot they cannot reconfigure. The
 * position therefore comes from `initialProgress`, which is read from the
 * database on every load, and every step commits before it advances.
 */

export type Administrator = { name: string; email: string };

/**
 * `wide` marks the steps that lay an illustration beside its instruction. The
 * column follows the step rather than being fixed, because the width that lets
 * two plates breathe turns four stacked text fields into a hard read: a label
 * at one end of 900px and its value at the other.
 */
const STEPS = [
  { number: 1, title: "Administrator", short: "Admin", wide: false },
  { number: 2, title: "Create the bot", short: "Create bot", wide: true },
  { number: 3, title: "The token", short: "Token", wide: false },
  { number: 4, title: "First group", short: "Group", wide: true },
  { number: 5, title: "Topics", short: "Topics", wide: true },
  { number: 6, title: "Radarr / Sonarr", short: "Radarr", wide: false },
  { number: 7, title: "Done", short: "Done", wide: false },
] as const;

type StepNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/**
 * The furthest step the stored state justifies opening on.
 *
 * Deliberately conservative: it never skips past a gate whose result is not on
 * disk, and it stops at 4 rather than guessing that an operator who allowed a
 * group also wanted to skip topics. Landing one step early costs a click;
 * landing one step late means a gate was passed without being satisfied.
 */
function resumeAt(progress: SetupProgress): StepNumber {
  if (!progress.administrator) return 1;
  if (!progress.hasToken) return 2;
  if (progress.allowedChats.length === 0) return 4;
  return 5;
}

export function OnboardingWizard({
  initialProgress,
}: {
  initialProgress: SetupProgress;
}) {
  const [step, setStep] = useState<StepNumber>(() => resumeAt(initialProgress));
  const [bot, setBot] = useState<ResolvedBot | null>(initialProgress.bot);
  const [allowedChats, setAllowedChats] = useState<PublicTelegramChat[]>(
    initialProgress.allowedChats,
  );

  const current = STEPS[step - 1];

  return (
    <div
      className={cn(
        "mx-auto flex w-full flex-col gap-5 transition-[max-width] duration-300 motion-reduce:transition-none",
        current.wide ? "max-w-4xl" : "max-w-xl",
      )}
    >
      <div className="flex flex-col gap-1">
        <h1 className="text-xl text-foreground">Set up Askarr</h1>
        <p className="text-base text-muted-foreground">
          Seven steps. Two of them can wait.
        </p>
      </div>

      <nav aria-label="Setup progress" className="flex flex-col gap-2">
        <ol className="grid grid-cols-7 gap-1.5">
          {STEPS.map((entry) => {
            const reached = entry.number <= step;
            return (
              <li
                key={entry.number}
                aria-current={entry.number === step ? "step" : undefined}
                className="flex min-w-0 flex-col gap-1.5"
              >
                {/* The action colour, not the brand amber: amber is chrome
                    here and never fills anything. */}
                <div
                  className={cn(
                    "h-1.5 rounded-sm",
                    reached ? "bg-primary-fill" : "bg-muted",
                  )}
                />
                {/* Seven labels do not fit below 640px; the line below carries
                    the one that matters. */}
                <span
                  className={cn(
                    "hidden truncate text-sm sm:block",
                    entry.number === step
                      ? "text-foreground"
                      : "text-muted-foreground",
                  )}
                >
                  {entry.short}
                </span>
              </li>
            );
          })}
        </ol>
        <p className="text-sm text-muted-foreground sm:hidden">
          Step {step} of {STEPS.length}: {current.title}
        </p>
      </nav>

      {step === 1 && <StepAccount onDone={() => setStep(2)} />}

      {step === 2 && (
        <StepBot onDone={() => setStep(3)} onBack={() => setStep(1)} />
      )}

      {step === 3 && (
        <StepToken
          initialBot={bot}
          initialHasToken={initialProgress.hasToken}
          tokenHint={initialProgress.tokenHint}
          onDone={(resolved) => {
            if (resolved) setBot(resolved);
            setStep(4);
          }}
          onBack={() => setStep(2)}
        />
      )}

      {step === 4 && (
        <StepTelegram
          bot={bot}
          onDone={(allowed) => {
            setAllowedChats(allowed);
            setStep(5);
          }}
          onBack={() => setStep(3)}
        />
      )}

      {step === 5 && (
        <StepTopics
          chats={allowedChats}
          alreadyCreated={initialProgress.hasTopics}
          onDone={() => setStep(6)}
          onBack={() => setStep(4)}
        />
      )}

      {step === 6 && (
        <StepInstance
          onDone={() => setStep(7)}
          onSkip={() => setStep(7)}
          onBack={() => setStep(5)}
        />
      )}

      {step === 7 && <StepSummary bot={bot} onBack={() => setStep(6)} />}
    </div>
  );
}
