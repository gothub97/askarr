import type { ReactNode } from "react";
import { AskarrMark } from "@/components/askarr-mark";
import { ThemeToggle } from "@/components/theme-toggle";

/**
 * Shell for the two pages that exist before anyone is signed in: /login and
 * /onboarding. The same 60px chrome as the back office, so the app is already
 * recognisable before the first sign-in, but no sidebar, because there is
 * nowhere else to go yet.
 */
export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="flex h-header shrink-0 items-center justify-between gap-3 bg-sidebar px-4 text-sidebar-foreground sm:px-6">
        <span className="flex items-center gap-2">
          <AskarrMark className="size-[22px] text-sidebar-primary" />
          <span className="text-xl font-bold">Askarr</span>
          <span className="hidden text-sm text-sidebar-foreground/70 sm:inline">
            Private screening room
          </span>
        </span>
        <ThemeToggle />
      </header>

      {/*
        The column is fluid and 360px-safe. Its cap belongs to each page rather
        than to the shell: /login is a four-field form and wants max-w-lg, while
        /onboarding lays illustrations beside their instructions and would put
        them at thumbnail size in 512px.
      */}
      <main className="flex flex-1 justify-center px-4 py-8 sm:py-12">
        <div className="w-full">{children}</div>
      </main>
    </div>
  );
}
