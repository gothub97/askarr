import type { Metadata } from "next";
import { JetBrains_Mono, Lato } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeScript } from "@/components/theme-script";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

/**
 * ─── DESIGN DIRECTION ────────────────────────────────────────────────────────
 *
 * A contract, not a note. The build is finished when the render still matches
 * every block below. DESIGN.md holds the full system; this is the reminder at
 * the top of the file everyone edits.
 *
 * THESIS: Askarr is the request desk of an *arr stack, so it wears that
 *   stack's interface language rather than a dashboard's. It refuses the
 *   centred max-width column, the hero-metric card row, and the accent used as
 *   decoration.
 * OWN-WORLD: Three-value grey chrome — page #202020, header and sidebar
 *   #2a2a2a, panels #333. Two-tone accenting: amber #ff8c2b on nav, hover and
 *   logo; blue on buttons and links. Lato at 14px on a 20px line, no
 *   uppercase, no tracking. Square: 2px on labels, 4px on everything else.
 *   Fixed 60px header over a fixed 210px sidebar, full-bleed content.
 * STORY: An operator recognises the room before reading a word, finds what is
 *   waiting on them, and acts on it without leaving the table.
 * FIRST VIEWPORT: Sidebar left, active item on a 3px amber border; header with
 *   the mark and a title search; content opening on what is waiting for
 *   approval, as rows, not cards.
 * FORM: The *arr canon, pinned by the user with Radarr and Sonarr named as the
 *   craft bar. No roll — a pinned direction beats the roll.
 * FINISH: unreviewed and undocumented is unfinished; this build ends with the
 *   finish review, the verdict, and DESIGN.md
 *
 * This is a source comment rather than an HTML comment in the emitted body.
 * Injecting one there (a `hidden` div with dangerouslySetInnerHTML) put comment
 * nodes where React puts its own Suspense markers, and hydration stopped
 * running: no fibers attached and every control in the app went dead. A
 * convention is not worth an inert page.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * Lato carries the whole interface; there is no display face.
 *
 * Three real cuts, matching how the *arr apps use Roboto: 300 for the large
 * numbers that would look heavy at 400, 400 for everything, 700 for table
 * headers and emphasis. Lato ships 100/300/400/700/900 — no 500, no 600 — so
 * loading only cuts that exist keeps the browser from synthesising a fake
 * weight, which is what makes a substituted one look smeared.
 */
const lato = Lato({
  variable: "--font-lato",
  subsets: ["latin"],
  weight: ["300", "400", "700"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Askarr",
  description: "Request movies and shows from Telegram, straight into Radarr and Sonarr.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // The font variables go on <html>, not <body>. The @theme tokens in
  // globals.css resolve against :root, so a --font-* defined one level down on
  // <body> is still undefined where --font-sans is built from it — which
  // silently empties the family and drops the whole app to Times.
  return (
    <html
      lang="en"
      className={`${lato.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <ThemeScript />
      </head>
      <body className="antialiased">
        <ThemeProvider>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
