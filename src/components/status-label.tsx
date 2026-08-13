import type { MediaStatus } from "@prisma/client";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { statusKind, statusShortLabel, type StatusKind } from "@/lib/status";

/**
 * The label: a small, near-square, colour-coded chip.
 *
 * This is the single most recognisable component in the *arr family. Quality
 * profiles, languages, formats, statuses and tags are all this one element,
 * which is why it is worth getting exactly right: 2px corners rather than a
 * pill, a 1px border in the fill colour, `line-height: 1` so the box hugs the
 * text, and no wrapping ever.
 *
 * `kind` is the family's semantic set. Every status in Askarr maps onto one of
 * them in `statusKind()`, so a status looks the same everywhere it appears.
 *
 * On the two-variant split: `filled` is a block of colour carrying dark text
 * (or white, on the purple); `outline` is the colour as ink on the page. Those
 * are different contrast problems, so warning and queue carry a separate ink
 * value — the gold that reads well as a fill is unreadable as text on white,
 * and the purple that reads well as a fill is unreadable as text on black.
 */
const labelVariants = cva(
  "inline-flex shrink-0 items-center gap-1 border align-middle leading-none whitespace-nowrap [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      kind: {
        default: "",
        primary: "",
        success: "",
        warning: "",
        danger: "",
        queue: "",
        disabled: "",
      },
      variant: {
        filled: "",
        outline: "bg-transparent",
      },
      size: {
        // The *arr label sizes, verbatim.
        sm: "rounded-[2px] px-[3px] py-px text-xs",
        md: "rounded-[2px] px-[5px] py-[2px] text-sm",
        lg: "rounded-[2px] px-[7px] py-[3px] text-base font-bold",
      },
    },
    compoundVariants: [
      // Filled: the kind colour as a block, with a foreground chosen for it.
      {
        variant: "filled",
        kind: "default",
        class: "border-border-strong bg-secondary text-secondary-foreground",
      },
      {
        variant: "filled",
        kind: "primary",
        class: "border-primary-fill bg-primary-fill text-primary-foreground",
      },
      {
        variant: "filled",
        kind: "success",
        class: "border-positive bg-positive text-positive-foreground",
      },
      {
        variant: "filled",
        kind: "warning",
        class: "border-warning bg-warning text-warning-foreground",
      },
      {
        variant: "filled",
        kind: "danger",
        class: "border-destructive bg-destructive text-destructive-foreground",
      },
      {
        variant: "filled",
        kind: "queue",
        class: "border-queue bg-queue text-queue-foreground",
      },
      {
        variant: "filled",
        kind: "disabled",
        class: "border-border bg-muted text-muted-foreground",
      },
      // Outline: the kind colour as ink and border, nothing behind it.
      {
        variant: "outline",
        kind: "default",
        class: "border-border-strong text-muted-foreground",
      },
      { variant: "outline", kind: "primary", class: "border-primary text-primary" },
      {
        variant: "outline",
        kind: "success",
        class: "border-positive text-positive",
      },
      {
        variant: "outline",
        kind: "warning",
        class: "border-warning-ink text-warning-ink",
      },
      {
        variant: "outline",
        kind: "danger",
        class: "border-destructive text-destructive",
      },
      { variant: "outline", kind: "queue", class: "border-queue-ink text-queue-ink" },
      {
        variant: "outline",
        kind: "disabled",
        class: "border-border text-muted-foreground",
      },
    ],
    defaultVariants: { kind: "default", variant: "filled", size: "md" },
  },
);

export type LabelKind = StatusKind | "disabled";

function Label({
  className,
  kind,
  variant,
  size,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof labelVariants>) {
  return (
    <span
      data-slot="label"
      className={cn(labelVariants({ kind, variant, size, className }))}
      {...props}
    />
  );
}

/** The label for a request's status, so the mapping lives in one place. */
function StatusLabel({
  status,
  variant,
  size,
  className,
}: {
  status: MediaStatus;
  variant?: VariantProps<typeof labelVariants>["variant"];
  size?: VariantProps<typeof labelVariants>["size"];
  className?: string;
}) {
  return (
    <Label kind={statusKind(status)} variant={variant} size={size} className={className}>
      {statusShortLabel(status)}
    </Label>
  );
}

export { Label, StatusLabel, labelVariants };
