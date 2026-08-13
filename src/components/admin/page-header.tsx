import type * as React from "react";
import { cn } from "@/lib/utils";

/** Page title plus one line saying what the page is for. Display face here only. */
export function PageHeader({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-xl leading-none">{title}</h1>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  );
}

/** A quiet section heading. Body face: only page titles get the display face. */
export function SectionTitle({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h2
      className={cn(
        "font-sans text-xs font-medium tracking-wide text-muted-foreground uppercase",
        className,
      )}
    >
      {children}
    </h2>
  );
}
