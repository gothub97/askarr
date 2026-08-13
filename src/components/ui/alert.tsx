import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * A tinted panel with a 1px border in the kind's colour — the family's alert,
 * which is a Bootstrap descendant. The tint is what carries the meaning; a
 * thick coloured left edge is a different design language's habit.
 */
const alertVariants = cva(
  "group/alert relative grid w-full gap-0.5 rounded-md border px-3 py-2 text-left text-base has-data-[slot=alert-action]:relative has-data-[slot=alert-action]:pr-18 has-[>svg]:grid-cols-[auto_1fr] has-[>svg]:gap-x-2 *:[svg]:row-span-2 *:[svg]:translate-y-0.5 *:[svg]:text-current *:[svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "border-border bg-surface text-foreground",
        destructive:
          "border-destructive/50 bg-destructive/10 text-destructive *:data-[slot=alert-description]:text-destructive *:[svg]:text-current",
        warning:
          "border-warning-ink/50 bg-warning/10 text-warning-ink *:data-[slot=alert-description]:text-warning-ink",
        success:
          "border-positive/50 bg-positive/10 text-positive *:data-[slot=alert-description]:text-positive",
        info: "border-primary/50 bg-primary/10 text-primary *:data-[slot=alert-description]:text-primary",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return (
    <div
      data-slot="alert"
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  )
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-title"
      className={cn(
        "font-medium group-has-[>svg]/alert:col-start-2 [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-foreground",
        className
      )}
      {...props}
    />
  )
}

function AlertDescription({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn(
        "text-sm text-balance text-muted-foreground md:text-pretty [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-foreground [&_p:not(:last-child)]:mb-4",
        className
      )}
      {...props}
    />
  )
}

function AlertAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-action"
      className={cn("absolute top-2 right-2", className)}
      {...props}
    />
  )
}

export { Alert, AlertTitle, AlertDescription, AlertAction }
