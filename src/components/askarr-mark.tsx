import { cn } from "@/lib/utils";

/**
 * The Askarr mark: a speech bubble with a play triangle knocked out of it.
 *
 * The two halves of what the product is — someone asks, in a chat, for
 * something to watch. Flat, one colour, no gradient, drawn to read at 20px in
 * the sidebar, which is the only size that really matters.
 *
 * The triangle is a hole rather than a second shape (`fill-rule="evenodd"`),
 * so the mark works on any ground and inherits `currentColor`.
 */
export function AskarrMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      aria-hidden
      focusable="false"
      className={cn("size-5", className)}
    >
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M4 4h24a2 2 0 0 1 2 2v15a2 2 0 0 1-2 2H15l-7 6v-6H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm9 5v9l9-4.5z"
      />
    </svg>
  );
}

/** The mark plus the wordmark, for the sidebar head and the public header. */
export function AskarrLockup({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <AskarrMark className="size-5 text-sidebar-primary" />
      <span className="text-xl font-bold text-sidebar-foreground">Askarr</span>
    </span>
  );
}
