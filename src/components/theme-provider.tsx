"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { THEME_STORAGE_KEY } from "./theme-script";

/**
 * Theme state: system, light or dark, persisted and shared.
 *
 * This replaces next-themes, which renders its no-flash <script> from inside a
 * client component. React 19 warns about that on every render — a script
 * created during a client render never executes — and next-themes offers no
 * way to turn it off. The script belongs in the server layout instead, so here
 * there is only state; see theme-script.tsx.
 *
 * The API deliberately matches next-themes' useTheme() so consumers read the
 * same either way.
 */

export type Theme = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const DARK_QUERY = "(prefers-color-scheme: dark)";

function systemPrefersDark(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia(DARK_QUERY).matches;
}

function resolve(theme: Theme): ResolvedTheme {
  if (theme === "system") return systemPrefersDark() ? "dark" : "light";
  return theme;
}

/** Kept in sync with the inline script in theme-script.tsx. */
function applyTheme(resolved: ResolvedTheme): void {
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
  // Makes form controls and scrollbars follow the theme too.
  root.style.colorScheme = resolved;
}

function readStored(): Theme {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    if (value === "light" || value === "dark" || value === "system") {
      return value;
    }
  } catch {
    // Private mode, or storage disabled. Following the system is a fine answer.
  }
  return "system";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  /*
   * "system" on the server and on the first client render, so both produce the
   * same markup. The real preference is applied by the inline script before
   * paint and picked up here on mount, which is why <html> carries
   * suppressHydrationWarning.
   */
  const [theme, setThemeState] = useState<Theme>("system");
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("light");

  useEffect(() => {
    const stored = readStored();
    setThemeState(stored);
    setResolvedTheme(resolve(stored));
  }, []);

  // Following the system means following it live, not just at load.
  useEffect(() => {
    if (theme !== "system") return;
    const media = window.matchMedia(DARK_QUERY);
    const onChange = () => {
      const next = media.matches ? "dark" : "light";
      setResolvedTheme(next);
      applyTheme(next);
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    const resolved = resolve(next);
    setResolvedTheme(resolved);
    applyTheme(resolved);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // The choice still holds for this tab; it just will not survive a reload.
    }
  }, []);

  const value = useMemo(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme, setTheme],
  );

  return <ThemeContext value={value}>{children}</ThemeContext>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used inside ThemeProvider.");
  }
  return context;
}
