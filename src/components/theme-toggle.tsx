"use client";

import { useEffect, useState } from "react";
import { useTheme } from "@/components/theme-provider";
import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Three-state theme control: system / light / dark.
 *
 * A segmented control rather than a cycling button, because the three states
 * are not ordered and "system" is not a stop on the way to "dark". The provider
 * owns persistence (localStorage) and the class on <html>.
 *
 * Shared component: the back office and the onboarding shell both mount it.
 */

const OPTIONS = [
  { value: "system", label: "Follow the system theme", Icon: MonitorIcon },
  { value: "light", label: "Use the light theme", Icon: SunIcon },
  { value: "dark", label: "Use the dark theme", Icon: MoonIcon },
] as const;

type ThemeValue = (typeof OPTIONS)[number]["value"];

function isThemeValue(value: string | undefined): value is ThemeValue {
  return value === "system" || value === "light" || value === "dark";
}

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();

  /*
   * The stored theme is only knowable on the client. Rendering the active state
   * before mount would make the server HTML disagree with the first client
   * render, so nothing is marked active until then: the control is present and
   * usable from the first paint, it simply does not claim a selection yet.
   */
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const current: ThemeValue = isThemeValue(theme) ? theme : "system";

  return (
    <div
      role="group"
      aria-label="Colour theme"
      className={cn(
        // This control only ever sits on the dark chrome, in either theme, so
        // it is coloured against the chrome rather than against the page.
        "inline-flex shrink-0 items-center rounded-md border border-white/15",
        className,
      )}
    >
      {OPTIONS.map(({ value, label, Icon }, index) => {
        const active = mounted && current === value;
        return (
          <button
            key={value}
            type="button"
            aria-label={label}
            aria-pressed={active}
            onClick={() => setTheme(value)}
            className={cn(
              "inline-flex size-6 items-center justify-center transition-colors first:rounded-l-[3px] last:rounded-r-[3px]",
              index > 0 && "border-l border-white/15",
              "hover:bg-white/10",
              active
                ? "bg-white/10 text-sidebar-primary"
                : "text-sidebar-foreground/70",
            )}
          >
            <Icon className="size-3.5" aria-hidden />
          </button>
        );
      })}
    </div>
  );
}
