import type * as React from "react";
import { cn } from "@/lib/utils";

/**
 * A page title, its one-line purpose, and the page's primary action.
 *
 * There is no display face and no size jump: 16px bold over 14px body. The
 * *arr apps put nothing large at the top of a page, and that restraint is a
 * large part of why they read as a console rather than a product page.
 */
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
        "flex flex-col gap-2 border-b border-border pb-3 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="flex flex-col gap-0.5">
        <h1>{title}</h1>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  );
}

/**
 * A section heading. Plain bold at body size — an uppercase tracked-out micro
 * label is a dashboard habit this family does not have.
 */
export function SectionTitle({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <h2 className={cn("text-lg", className)}>{children}</h2>;
}
