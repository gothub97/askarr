import type * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Technical identifiers — chat_id, tmdbId, API keys, webhook URLs, timestamps —
 * are data, not prose. They always render in the mono face so they read as
 * something the machine produced.
 */
export function Data({
  children,
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span className={cn("font-data text-xs", className)} {...props}>
      {children}
    </span>
  );
}

/**
 * A fixed `YYYY-MM-DD HH:MM` shape rather than a locale format: back-office
 * timestamps are read as data, and a stable string cannot drift between the
 * server render and the browser.
 */
export function formatTimestamp(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    ` ${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

export function formatDate(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
