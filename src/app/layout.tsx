import type { Metadata } from "next";
import { JetBrains_Mono, Lato } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

/**
 * Lato carries both the display and the body role.
 *
 * It ships 100/300/400/700/900 — no 500 and no 600 — so the two weights the
 * design asks for land on their nearest real cut: body 400 stays 400, and
 * display 600 becomes 700. Loading only the weights that exist keeps the
 * browser from synthesising a fake bold, which is what makes a substituted
 * weight look smeared.
 */
const lato = Lato({
  variable: "--font-lato",
  subsets: ["latin"],
  weight: ["400", "700"],
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
      <body className="antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
