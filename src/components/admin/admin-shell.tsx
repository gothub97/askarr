"use client";

import {
  BotIcon,
  GaugeIcon,
  InboxIcon,
  LogOutIcon,
  MenuIcon,
  MessagesSquareIcon,
  SearchIcon,
  ServerIcon,
  SettingsIcon,
  UsersIcon,
  XIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { AskarrMark } from "@/components/askarr-mark";
import { Label } from "@/components/status-label";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

/**
 * The back-office chrome: a fixed 60px bar over a fixed 210px sidebar, with
 * the content full-bleed beside them.
 *
 * Both dimensions are the *arr family's, and the sidebar's active item is its
 * signature — a 3px left border in the brand colour, with the row itself a
 * value step lighter. Nothing here is centred or capped: a queue of requests
 * should use the whole window, the way Radarr's does.
 *
 * The chrome keeps the same near-black in both themes. That is deliberate;
 * `globals.css` explains why.
 */

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", Icon: GaugeIcon },
  { href: "/requests", label: "Requests", Icon: InboxIcon },
  { href: "/instances", label: "Instances", Icon: ServerIcon },
  { href: "/users", label: "Telegram users", Icon: UsersIcon },
  { href: "/chats", label: "Groups", Icon: MessagesSquareIcon },
  { href: "/bot", label: "Bot", Icon: BotIcon },
  { href: "/settings", label: "Settings", Icon: SettingsIcon },
] as const;

function useCurrentHref() {
  const pathname = usePathname();
  return (
    NAV_ITEMS.find(
      (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
    )?.href ?? NAV_ITEMS[0].href
  );
}

function NavList({
  pendingCount,
  onNavigate,
}: {
  pendingCount: number;
  onNavigate?: () => void;
}) {
  const current = useCurrentHref();

  return (
    <nav aria-label="Sections" className="flex flex-col py-1">
      {NAV_ITEMS.map(({ href, label, Icon }) => {
        const active = href === current;
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              // 12px/24px rows on a 3px left edge that only the active item
              // colours in — the family's one piece of nav decoration.
              "flex items-center gap-[7px] border-l-[3px] py-3 pr-4 pl-[21px] text-base transition-colors",
              active
                ? "border-l-sidebar-primary bg-sidebar-accent text-sidebar-accent-foreground"
                : "border-l-transparent text-sidebar-foreground hover:text-sidebar-primary",
            )}
          >
            <Icon className="size-[18px] shrink-0" aria-hidden />
            <span className="truncate">{label}</span>
            {href === "/requests" && pendingCount > 0 && (
              <Label
                kind="warning"
                size="sm"
                className="ml-auto"
                aria-label={`${pendingCount} waiting for approval`}
              >
                {pendingCount}
              </Label>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

/** Jumps to the request list filtered by title. The family puts search here. */
function HeaderSearch({ onSubmitted }: { onSubmitted?: () => void }) {
  const router = useRouter();
  const [term, setTerm] = useState("");
  const id = useId();

  return (
    <form
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        const q = term.trim();
        router.push(q ? `/requests?q=${encodeURIComponent(q)}` : "/requests");
        onSubmitted?.();
      }}
      // Below sm there is no room for it next to the theme control, and it
      // squeezes to a stub. The Requests page has its own title filter.
      className="ml-auto hidden min-w-0 items-center sm:flex"
    >
      <label htmlFor={id} className="sr-only">
        Search requested titles
      </label>
      {/* The icon is positioned against the field, not against the form — the
          form stretches, and anchoring to it strands the icon across the bar. */}
      <div className="relative w-56 max-w-full min-w-0">
        <SearchIcon
          className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-sidebar-foreground/60"
          aria-hidden
        />
        <input
          id={id}
          type="search"
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="Search titles"
          className="w-full min-w-0 rounded-md border border-transparent bg-black/25 py-1.5 pr-2 pl-7 text-base text-sidebar-foreground transition-colors outline-none placeholder:text-sidebar-foreground/60 focus-visible:border-[#66afe9] focus-visible:outline-none"
        />
      </div>
    </form>
  );
}

function SignOutButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Sign out"
      disabled={pending}
      className="text-sidebar-foreground hover:bg-white/10 hover:text-sidebar-primary"
      onClick={() =>
        startTransition(async () => {
          const result = await signOut();
          if (result.error) {
            toast.error("Could not sign out. Try again.");
            return;
          }
          router.push("/login");
          router.refresh();
        })
      }
    >
      <LogOutIcon />
    </Button>
  );
}

export function AdminShell({
  email,
  pendingCount,
  children,
}: {
  email: string;
  pendingCount: number;
  children: React.ReactNode;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // The drawer is a modal surface: Escape closes it, focus moves into it and
  // comes back to the button that opened it, and the page behind cannot scroll.
  useEffect(() => {
    if (!drawerOpen) return;
    drawerRef.current?.focus();
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDrawerOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      triggerRef.current?.focus();
    };
  }, [drawerOpen]);

  return (
    <div className="min-h-svh bg-background">
      <header className="fixed inset-x-0 top-0 z-30 flex h-header items-center bg-sidebar text-sidebar-foreground">
        <div className="flex h-full w-sidebar shrink-0 items-center gap-2 pr-4 pl-4 md:pl-6">
          <Button
            ref={triggerRef}
            variant="ghost"
            size="icon"
            aria-label="Open the menu"
            aria-expanded={drawerOpen}
            className="-ml-1 text-sidebar-foreground hover:bg-white/10 md:hidden"
            onClick={() => setDrawerOpen(true)}
          >
            <MenuIcon />
          </Button>
          <Link
            href="/dashboard"
            className="flex items-center gap-2 rounded-sm text-sidebar-foreground"
          >
            <AskarrMark className="size-[22px] text-sidebar-primary" />
            <span className="text-xl font-bold">Askarr</span>
          </Link>
        </div>

        <div className="flex min-w-0 flex-1 items-center gap-2 pr-4 md:pr-5">
          <HeaderSearch />
          <span
            className="hidden max-w-44 truncate text-sm text-sidebar-foreground/70 lg:inline"
            title={email}
          >
            {email}
          </span>
          <ThemeToggle />
          <SignOutButton />
        </div>
      </header>

      {/* Desktop sidebar. */}
      <aside className="fixed top-header bottom-0 left-0 z-20 hidden w-sidebar overflow-y-auto bg-sidebar md:block">
        <NavList pendingCount={pendingCount} />
      </aside>

      {/* Mobile drawer, same list. */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            aria-label="Close the menu"
            tabIndex={-1}
            className="absolute inset-0 bg-black/60"
            onClick={() => setDrawerOpen(false)}
          />
          <div
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label="Sections"
            tabIndex={-1}
            className="absolute inset-y-0 left-0 w-sidebar overflow-y-auto bg-sidebar outline-none"
          >
            <div className="flex h-header items-center justify-between pr-2 pl-6">
              <AskarrMark className="size-[22px] text-sidebar-primary" />
              <Button
                variant="ghost"
                size="icon"
                aria-label="Close the menu"
                className="text-sidebar-foreground hover:bg-white/10"
                onClick={() => setDrawerOpen(false)}
              >
                <XIcon />
              </Button>
            </div>
            <NavList
              pendingCount={pendingCount}
              onNavigate={() => setDrawerOpen(false)}
            />
          </div>
        </div>
      )}

      <main className="pt-header md:pl-sidebar">
        <div className="p-2.5 sm:p-5">{children}</div>
      </main>
    </div>
  );
}
