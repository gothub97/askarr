import type { MediaStatus } from "@prisma/client";
import { cn } from "@/lib/utils";
import { RAIL_STEPS, railProgress, statusLabel, statusTone } from "@/lib/status";

/**
 * The status rail: the product's one decorative element.
 *
 * A four-notch band, Requested · Approved · Grabbed · Available, separated by
 * film sprocket perforations. Reached notches are filled in accent, the rest
 * in border colour. Everything around it stays flat and quiet.
 */
export function StatusRail({
  status,
  showLabel = true,
  className,
}: {
  status: MediaStatus;
  showLabel?: boolean;
  className?: string;
}) {
  const reached = railProgress(status);
  const tone = statusTone(status);
  const halted = tone === "negative";

  const fill =
    tone === "negative"
      ? "bg-destructive"
      : tone === "positive"
        ? "bg-positive"
        : tone === "waiting"
          ? "bg-waiting"
          : "bg-brand";

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div
        className="flex items-center gap-1"
        role="img"
        aria-label={`${statusLabel(status)} — step ${reached + 1} of ${RAIL_STEPS.length}`}
      >
        {RAIL_STEPS.map((step, index) => (
          <div key={step} className="flex flex-1 items-center gap-1">
            <div className="relative h-1.5 flex-1 overflow-hidden rounded-[1px] bg-border">
              {index <= reached && !(halted && index > 0) && (
                <div className={cn("absolute inset-0", fill)} />
              )}
            </div>
            {/* Sprocket perforation between notches, not after the last one. */}
            {index < RAIL_STEPS.length - 1 && (
              <span
                aria-hidden
                className="size-1 shrink-0 rounded-[1px] bg-muted-foreground/40"
              />
            )}
          </div>
        ))}
      </div>

      {showLabel && (
        <div className="flex items-center justify-between gap-2">
          <span
            className={cn(
              "text-xs",
              tone === "negative"
                ? "text-destructive"
                : tone === "positive"
                  ? "text-positive"
                  : tone === "waiting"
                    ? "text-waiting"
                    : "text-muted-foreground",
            )}
          >
            {statusLabel(status)}
          </span>
        </div>
      )}
    </div>
  );
}

/** The rail with its four step names spelled out, for detail views. */
export function StatusRailDetailed({
  status,
  className,
}: {
  status: MediaStatus;
  className?: string;
}) {
  const reached = railProgress(status);
  const tone = statusTone(status);
  const halted = tone === "negative";

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <StatusRail status={status} showLabel={false} />
      <div className="flex items-center justify-between gap-1">
        {RAIL_STEPS.map((step, index) => (
          <span
            key={step}
            className={cn(
              "text-xs",
              index <= reached && !(halted && index > 0)
                ? "text-foreground"
                : "text-muted-foreground",
            )}
          >
            {step}
          </span>
        ))}
      </div>
    </div>
  );
}
