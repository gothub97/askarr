import type { MediaStatus } from "@prisma/client";
import { cn } from "@/lib/utils";
import {
  statusKind,
  statusLabel,
  statusProgress,
  type StatusKind,
} from "@/lib/status";

/**
 * The progress bar, with the *arr family's dual-layer label.
 *
 * The problem it solves: a caption centred over a partly-filled bar sits on
 * two different backgrounds at once, and no single text colour is readable on
 * both. The fix is to render the caption twice — once over the empty track,
 * once over the fill — and clip the second copy to exactly the filled width.
 * Whichever side of the boundary a glyph falls on, it is drawn in the colour
 * that suits that side. It costs one duplicated node and removes the need to
 * pick a compromise grey.
 *
 * The duplicate is hidden from assistive tech; the caption is read once.
 */

const FILL: Record<StatusKind, string> = {
  default: "bg-border-strong",
  primary: "bg-primary-fill",
  success: "bg-positive",
  warning: "bg-warning",
  danger: "bg-destructive",
  queue: "bg-queue",
};

/** Text drawn on top of each fill, matched to it for contrast. */
const ON_FILL: Record<StatusKind, string> = {
  default: "text-foreground",
  primary: "text-primary-foreground",
  success: "text-positive-foreground",
  warning: "text-warning-foreground",
  danger: "text-destructive-foreground",
  queue: "text-queue-foreground",
};

const HEIGHT = {
  sm: "h-[5px]",
  md: "h-[15px]",
  lg: "h-5",
} as const;

export function ProgressBar({
  value,
  kind = "primary",
  size = "md",
  caption,
  className,
  "aria-label": ariaLabel,
}: {
  /** 0–100. */
  value: number;
  kind?: StatusKind;
  size?: keyof typeof HEIGHT;
  /** Drawn across the bar. Omit for the 5px size, which has no room. */
  caption?: string;
  className?: string;
  "aria-label"?: string;
}) {
  const pct = Math.max(0, Math.min(100, value));
  const showCaption = Boolean(caption) && size !== "sm";

  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={ariaLabel ?? caption}
      className={cn(
        "relative w-full overflow-hidden rounded-md bg-muted shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)]",
        HEIGHT[size],
        className,
      )}
    >
      {/* The caption over the empty track. It sits at the bottom of the paint
          order: an absolutely-positioned sibling would otherwise paint on top
          of the fill, and both copies would show through each other over the
          filled half. */}
      {showCaption && (
        <span className="absolute inset-0 z-0 flex items-center justify-center px-1 text-xs text-muted-foreground">
          <span className="truncate">{caption}</span>
        </span>
      )}

      <div
        className={cn(
          "relative z-10 h-full transition-[width] duration-500 ease-out",
          FILL[kind],
        )}
        style={{ width: `${pct}%` }}
      />

      {/* The same caption, clipped to the fill. Positioned against the track,
          not the fill, so the two copies land on identical coordinates and the
          text does not shift as the bar grows. */}
      {showCaption && (
        <span
          aria-hidden
          className="absolute inset-y-0 left-0 z-20 overflow-hidden"
          style={{ width: `${pct}%` }}
        >
          <span
            className={cn(
              // Same weight and size as the back copy: only the colour may
              // differ, or the boundary shows up as a jump mid-word.
              "absolute inset-y-0 left-0 flex w-[var(--bar-w)] items-center justify-center px-1 text-xs",
              ON_FILL[kind],
            )}
            style={{ "--bar-w": pct > 0 ? `${(100 / pct) * 100}%` : "0" } as React.CSSProperties}
          >
            <span className="truncate">{caption}</span>
          </span>
        </span>
      )}
    </div>
  );
}

/** The bar for a request, so status → kind → width lives in one place. */
export function StatusProgress({
  status,
  size = "md",
  showCaption = true,
  className,
}: {
  status: MediaStatus;
  size?: keyof typeof HEIGHT;
  showCaption?: boolean;
  className?: string;
}) {
  const label = statusLabel(status);
  return (
    <ProgressBar
      value={statusProgress(status)}
      kind={statusKind(status)}
      size={size}
      caption={showCaption ? label : undefined}
      aria-label={label}
      className={className}
    />
  );
}
