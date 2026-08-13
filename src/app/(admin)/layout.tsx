import Link from "next/link";
import type * as React from "react";
import { AdminNav, SignOutButton } from "@/components/admin/admin-nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { requireSession } from "@/lib/session";

/**
 * The one place the back office is gated. Checking the session here — on the
 * server, in the layout — is what makes every page under (admin) private;
 * a client-side check would ship the page and merely hide it.
 */
export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await requireSession();

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-2 px-3 py-2 sm:gap-4 sm:px-6">
          <Link
            href="/dashboard"
            className="rounded-sm font-display text-base tracking-tight text-foreground"
          >
            Askarr
          </Link>

          <AdminNav />

          <div className="ml-auto flex items-center gap-1">
            <span
              className="hidden max-w-40 truncate text-xs text-muted-foreground lg:inline"
              title={session.user.email}
            >
              {session.user.email}
            </span>
            <ThemeToggle />
            <SignOutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-3 py-6 sm:px-6">
        {children}
      </main>
    </div>
  );
}
