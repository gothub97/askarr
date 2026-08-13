import type * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The primary action of a view.
 *
 * The burnt brick accent carries primary actions as ink, never as a fill: a
 * console stays flat, and a page of solid brick buttons would read as a SaaS
 * dashboard. The border and the label carry the emphasis instead.
 */
export function ActionButton({
  className,
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <Button
      variant="outline"
      className={cn(
        "border-brand text-brand hover:bg-muted hover:text-brand dark:border-brand dark:bg-transparent dark:hover:bg-muted",
        className,
      )}
      {...props}
    />
  );
}
