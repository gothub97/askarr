import type { ReactNode } from "react";
import { ThemeToggle } from "@/components/theme-toggle";

/**
 * Shell for the two pages that exist before anyone is signed in: /login and
 * /onboarding. No navigation — there is nowhere else to go yet — just the
 * wordmark, the theme control, and one centred column.
 */
export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex items-baseline gap-2">
          <span className="font-display text-base text-foreground">Askarr</span>
          <span className="hidden text-xs text-muted-foreground sm:inline">
            Private screening room
          </span>
        </div>
        <ThemeToggle />
      </header>

      <main className="flex flex-1 justify-center px-4 py-8 sm:py-12">
        {/* 360px-safe: the column is fluid and only capped on wider screens. */}
        <div className="w-full max-w-lg">{children}</div>
      </main>
    </div>
  );
}
