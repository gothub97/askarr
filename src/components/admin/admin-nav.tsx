"use client";

import { ChevronDownIcon, LogOutIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/requests", label: "Requests" },
  { href: "/instances", label: "Instances" },
  { href: "/users", label: "Telegram users" },
  { href: "/chats", label: "Groups" },
  { href: "/settings", label: "Settings" },
] as const;

function useCurrentItem() {
  const pathname = usePathname();
  return (
    NAV_ITEMS.find(
      (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
    ) ?? NAV_ITEMS[0]
  );
}

/**
 * Inline row on wide screens, a single dropdown below `md`. At 360px the header
 * still has to hold the wordmark, the nav, the theme toggle and sign out, so
 * the nav is the part that collapses.
 */
export function AdminNav() {
  const current = useCurrentItem();
  const router = useRouter();

  return (
    <>
      <nav aria-label="Sections" className="hidden md:flex md:items-center md:gap-1">
        {NAV_ITEMS.map((item) => {
          const active = item.href === current.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "rounded-md px-2 py-1 text-sm transition-colors hover:text-foreground",
                active
                  ? "text-brand underline decoration-brand decoration-2 underline-offset-8"
                  : "text-muted-foreground",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="md:hidden">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="outline" size="sm" aria-label="Sections" />}
          >
            {current.label}
            <ChevronDownIcon />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-44">
            {NAV_ITEMS.map((item) => (
              <DropdownMenuItem
                key={item.href}
                onClick={() => router.push(item.href)}
                className={cn(item.href === current.href && "text-brand")}
              >
                {item.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  );
}

export function SignOutButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleSignOut() {
    startTransition(async () => {
      const result = await signOut();
      if (result.error) {
        toast.error("Could not sign out. Try again.");
        return;
      }
      router.push("/login");
      router.refresh();
    });
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleSignOut}
      disabled={pending}
      aria-label="Sign out"
    >
      <LogOutIcon />
      <span className="hidden sm:inline">Sign out</span>
    </Button>
  );
}
