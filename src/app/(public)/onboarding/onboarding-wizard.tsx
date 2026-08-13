"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { StepAccount } from "./step-account";
import { StepInstance } from "./step-instance";
import { StepSummary } from "./step-summary";
import { StepTelegram } from "./step-telegram";

/**
 * The first-run wizard: one card per step, four steps, no way back to step 1
 * once the administrator exists (that account is created for good).
 *
 * Steps 2 and 3 are skippable by design — Askarr must boot with no instance
 * and no group, and say so plainly, rather than hold the operator hostage
 * until they have credentials for a Radarr they have not installed yet.
 */

export type Administrator = { name: string; email: string };

const STEPS = [
  { number: 1, title: "Administrator" },
  { number: 2, title: "First instance" },
  { number: 3, title: "Telegram group" },
  { number: 4, title: "Summary" },
] as const;

type StepNumber = 1 | 2 | 3 | 4;

export function OnboardingWizard({
  initialAdministrator,
}: {
  initialAdministrator: Administrator | null;
}) {
  const [administrator, setAdministrator] = useState<Administrator | null>(
    initialAdministrator,
  );
  const [step, setStep] = useState<StepNumber>(initialAdministrator ? 2 : 1);

  const currentTitle = STEPS[step - 1].title;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-xl text-foreground">Set up Askarr</h1>
        <p className="text-sm text-muted-foreground">
          Four steps. Two of them can wait.
        </p>
      </div>

      <nav aria-label="Setup progress" className="flex flex-col gap-2">
        <ol className="grid grid-cols-4 gap-1.5">
          {STEPS.map((entry) => {
            const reached = entry.number <= step;
            return (
              <li
                key={entry.number}
                aria-current={entry.number === step ? "step" : undefined}
                className="flex flex-col gap-1.5"
              >
                <div
                  className={cn(
                    "h-1 rounded-[1px]",
                    reached ? "bg-brand" : "bg-border",
                  )}
                />
                {/* Four labels do not fit at 360px; the line below carries them. */}
                <span
                  className={cn(
                    "hidden text-xs sm:block",
                    entry.number === step
                      ? "text-foreground"
                      : "text-muted-foreground",
                  )}
                >
                  {entry.title}
                </span>
              </li>
            );
          })}
        </ol>
        <p className="text-xs text-muted-foreground sm:hidden">
          Step {step} of {STEPS.length} — {currentTitle}
        </p>
      </nav>

      {step === 1 && (
        <StepAccount
          onDone={(admin) => {
            setAdministrator(admin);
            setStep(2);
          }}
        />
      )}

      {step === 2 && (
        <StepInstance onDone={() => setStep(3)} onSkip={() => setStep(3)} />
      )}

      {step === 3 && (
        <StepTelegram onDone={() => setStep(4)} onSkip={() => setStep(4)} />
      )}

      {step === 4 && (
        <StepSummary
          administrator={administrator}
          onBack={() => setStep(3)}
        />
      )}
    </div>
  );
}
