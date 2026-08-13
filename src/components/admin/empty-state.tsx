import type * as React from "react";
import { cn } from "@/lib/utils";

/**
 * An empty state is a prompt, not a shrug: it names the situation and offers
 * the next move.
 */
export function EmptyState({
  title,
  hint,
  action,
  className,
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-start gap-2 rounded-md border border-border bg-surface px-4 py-5",
        className,
      )}
    >
      <p className="text-base text-foreground">{title}</p>
      {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
      {action && <div className="pt-1">{action}</div>}
    </div>
  );
}
