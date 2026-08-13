"use client";

import { Film, X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The small shared parts of the Mini App shell.
 *
 * Flat and quiet by design: no shadows, no gradients, one hairline border. The
 * status rail is the only element allowed to decorate anything.
 */

/**
 * Posters come from the operator's own Radarr/Sonarr, which proxy TMDB and
 * TheTVDB. The hosts are unknown at build time, so next/image cannot be used
 * here and a plain <img> is the correct tool.
 */
export function Poster({
  url,
  className,
}: {
  url: string | null;
  className?: string;
}) {
  const shared = "shrink-0 overflow-hidden rounded-sm bg-muted";
  if (!url) {
    return (
      <div
        className={cn(
          shared,
          "flex items-center justify-center text-muted-foreground",
          className,
        )}
        aria-hidden
      >
        <Film className="size-4" />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      // Decorative: the title always sits next to it as real text.
      alt=""
      loading="lazy"
      decoding="async"
      className={cn(shared, "object-cover", className)}
    />
  );
}

/** Empty states always name the next action rather than reporting a void. */
export function EmptyState({
  title,
  action,
}: {
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <p className="text-sm text-muted-foreground">{title}</p>
      {action}
    </div>
  );
}

export function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "shrink-0 rounded-full border px-3 py-1 text-xs transition-colors",
        active
          ? "border-brand text-brand"
          : "border-border text-muted-foreground",
      )}
    >
      {children}
    </button>
  );
}

/** Two-or-more-way switch. Reads as one control, not as a row of buttons. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="flex w-full overflow-hidden rounded-md border border-border"
    >
      {options.map((option, index) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "flex-1 px-2 py-2 text-xs transition-colors",
            index > 0 && "border-l border-border",
            value === option.value
              ? "bg-secondary text-foreground"
              : "text-muted-foreground",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/** A technical identifier reads as data, never as prose. */
export function DataTag({ children }: { children: ReactNode }) {
  return (
    <span className="font-data text-xs text-muted-foreground">{children}</span>
  );
}

/**
 * Bottom sheet. Phone-first: it comes up from the thumb, not from the middle
 * of the screen, and it never grows past 85% of the viewport.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);

    // Without this the page behind keeps scrolling under the sheet, which on a
    // phone reads as the sheet itself being broken.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    closeRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <button
        type="button"
        aria-label="Close"
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 bg-black/50"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative max-h-[85dvh] overflow-y-auto rounded-t-xl border-t border-border bg-card pb-[max(1rem,env(safe-area-inset-bottom))]"
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-border bg-card px-4 py-3">
          <h2 id={titleId} className="font-display text-lg leading-tight">
            {title}
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 rounded-md p-1 text-muted-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="px-4 py-4">{children}</div>
      </div>
    </div>
  );
}

/** Placeholder rows while a list loads. */
export function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3" aria-hidden>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex gap-3">
          <div className="h-[60px] w-10 animate-pulse rounded-sm bg-muted" />
          <div className="flex flex-1 flex-col gap-2 pt-1">
            <div className="h-3 w-2/3 animate-pulse rounded-sm bg-muted" />
            <div className="h-2 w-1/3 animate-pulse rounded-sm bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Inline failure copy. Never a stack trace, never a status code. */
export function ErrorNote({ message }: { message: string }) {
  return (
    <p role="alert" className="px-1 py-3 text-sm text-destructive">
      {message}
    </p>
  );
}
