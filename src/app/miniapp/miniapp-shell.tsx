"use client";

import { ListChecks, Search, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { AdminTab } from "./admin-tab";
import { MiniAppApiError, createMiniAppApi } from "./client";
import { ErrorNote, ListSkeleton } from "./pieces";
import { RequestsTab } from "./requests-tab";
import { SearchTab } from "./search-tab";
import { hapticTap, waitForWebApp } from "./telegram";
import type { MeDto } from "./types";

/**
 * The Mini App shell: boot, identity, and the three tabs.
 *
 * Boot order matters. Telegram's bridge script has to have run before initData
 * exists, and initData is the only credential the app has — so nothing is
 * fetched until it is in hand, and the absence of it is a screen of its own
 * rather than a failed request.
 */

type TabId = "requests" | "search" | "admin";

type BootState =
  | { phase: "booting" }
  | { phase: "outside" }
  | { phase: "ready"; initData: string; me: MeDto }
  | { phase: "failed"; message: string };

export function MiniAppShell() {
  const [boot, setBoot] = useState<BootState>({ phase: "booting" });
  const [tab, setTab] = useState<TabId>("requests");
  // Bumped after a successful request so My requests refetches when opened.
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      const webApp = await waitForWebApp();
      if (cancelled) return;

      if (!webApp || !webApp.initData) {
        setBoot({ phase: "outside" });
        return;
      }

      // Tells the client the WebView has painted, then takes the full height:
      // without expand() the app opens as a half sheet on most clients.
      webApp.ready();
      webApp.expand();

      try {
        const me = await createMiniAppApi(webApp.initData).me();
        if (cancelled) return;
        setBoot({ phase: "ready", initData: webApp.initData, me });
      } catch (caught) {
        if (cancelled) return;
        setBoot({
          phase: "failed",
          message:
            caught instanceof MiniAppApiError
              ? caught.message
              : "Askarr could not start. Close and reopen it.",
        });
      }
    }

    void start();
    return () => {
      cancelled = true;
    };
  }, []);

  const onRequested = useCallback(() => setRevision((n) => n + 1), []);

  if (boot.phase === "booting") {
    return (
      <Frame>
        <div className="px-4 py-6">
          <ListSkeleton />
        </div>
      </Frame>
    );
  }

  if (boot.phase === "outside") {
    return <OutsideTelegram />;
  }

  if (boot.phase === "failed") {
    return (
      <Frame>
        <div className="px-4 py-6">
          <ErrorNote message={boot.message} />
        </div>
      </Frame>
    );
  }

  return <ReadyShell boot={boot} tab={tab} setTab={setTab} revision={revision} onRequested={onRequested} />;
}

function ReadyShell({
  boot,
  tab,
  setTab,
  revision,
  onRequested,
}: {
  boot: { phase: "ready"; initData: string; me: MeDto };
  tab: TabId;
  setTab: (tab: TabId) => void;
  revision: number;
  onRequested: () => void;
}) {
  const api = useMemo(() => createMiniAppApi(boot.initData), [boot.initData]);
  const { me } = boot;

  const tabs: { id: TabId; label: string; icon: typeof Search }[] = [
    { id: "requests", label: "Requests", icon: ListChecks },
    { id: "search", label: "Search", icon: Search },
    // The tab is hidden for non-admins; the routes behind it check anyway.
    ...(me.isAdmin
      ? [{ id: "admin" as const, label: "Admin", icon: ShieldCheck }]
      : []),
  ];

  return (
    <Frame>
      <header className="sticky top-0 z-20 border-b border-border bg-background px-4 py-3">
        <div className="flex items-baseline justify-between gap-3">
          <h1 className="text-xl">Askarr</h1>
          <p className="truncate text-sm text-muted-foreground">
            {me.displayName} ·{" "}
            <span className="font-data">
              {me.quota.limit === 0
                ? "unlimited"
                : `${me.quota.used}/${me.quota.limit}`}
            </span>
          </p>
        </div>
      </header>

      <main className="flex-1 px-4 pt-4 pb-28">
        {!me.canRequest && (
          <p className="mb-4 rounded-md border border-destructive px-3 py-2 text-sm text-destructive">
            Your account is blocked. Ask an admin to restore it.
          </p>
        )}

        {tab === "requests" && (
          <RequestsTab
            key={`requests-${revision}`}
            api={api}
            onSearch={() => setTab("search")}
          />
        )}
        {tab === "search" && (
          <SearchTab
            api={api}
            instances={me.instances}
            onRequested={onRequested}
          />
        )}
        {tab === "admin" && me.isAdmin && <AdminTab api={api} />}
      </main>

      <nav
        aria-label="Sections"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background pb-[env(safe-area-inset-bottom)]"
      >
        <ul className="mx-auto flex max-w-lg">
          {tabs.map((entry) => {
            const Icon = entry.icon;
            const active = tab === entry.id;
            return (
              <li key={entry.id} className="flex-1">
                <button
                  type="button"
                  aria-current={active ? "page" : undefined}
                  onClick={() => {
                    hapticTap();
                    setTab(entry.id);
                  }}
                  className={cn(
                    // The accent carries the active state as colour and a
                    // hairline, never as a filled background.
                    "flex w-full flex-col items-center gap-1 border-t-2 px-2 py-2.5 text-sm",
                    active
                      ? "border-brand text-brand"
                      : "border-transparent text-muted-foreground",
                  )}
                >
                  <Icon className="size-4" aria-hidden />
                  {entry.label}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </Frame>
  );
}

/** The shell chrome, shared by every boot phase so nothing ever jumps. */
function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col bg-background text-foreground">
      {children}
    </div>
  );
}

/**
 * Opened in a normal browser. There is no signed payload to work with, so this
 * says so plainly instead of firing requests that can only ever 401.
 */
function OutsideTelegram() {
  return (
    <Frame>
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        <h1 className="text-xl">Askarr</h1>
        <p className="text-base text-muted-foreground">
          This screen only works inside Telegram.
        </p>
        <p className="text-base text-muted-foreground">
          Open your Askarr bot and tap the Mini App button to request a film or
          a series.
        </p>
      </div>
    </Frame>
  );
}
