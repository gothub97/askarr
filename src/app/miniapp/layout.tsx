import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

/**
 * The Mini App shell.
 *
 * `.tg-viewport` is what makes this screen belong to Telegram rather than to
 * Askarr's own back office: it remaps the design tokens onto the
 * `--tg-theme-*` variables the client injects, so light and dark follow the
 * user's Telegram theme instead of fighting it.
 */

export const metadata: Metadata = {
  title: "Askarr",
  description: "Request a film or a series, straight from Telegram.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Zoom stays available on purpose; locking it out fails accessibility for
  // the sake of a marginally more native feel.
  viewportFit: "cover",
};

export default function MiniAppLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <>
      {/*
        Telegram's bridge. It must come from telegram.org — the WebApp object is
        wired to the host client, so a bundled copy would be inert. React hoists
        this into <head>, so it runs before the shell hydrates and initData is
        normally there on the first tick.
      */}
      <script src="https://telegram.org/js/telegram-web-app.js" async={false} />
      <div className="tg-viewport min-h-dvh bg-background text-foreground">
        {children}
      </div>
    </>
  );
}
