/**
 * A hand-written typing of the slice of Telegram's WebApp API Askarr uses.
 *
 * Typed here rather than pulled from a package on purpose: the surface is a
 * handful of methods, and the bridge script itself is served by Telegram, so a
 * dependency would only add a second, drifting copy of these signatures.
 */

export interface TelegramThemeParams {
  bg_color?: string;
  text_color?: string;
  hint_color?: string;
  link_color?: string;
  button_color?: string;
  button_text_color?: string;
  secondary_bg_color?: string;
}

export type HapticStyle = "light" | "medium" | "heavy" | "rigid" | "soft";
export type HapticNotification = "error" | "success" | "warning";

export interface TelegramHapticFeedback {
  impactOccurred(style: HapticStyle): void;
  notificationOccurred(type: HapticNotification): void;
  selectionChanged(): void;
}

export type TelegramEvent = "themeChanged" | "viewportChanged";

export interface TelegramWebApp {
  /** The signed payload. Empty when the page was not opened by Telegram. */
  initData: string;
  colorScheme: "light" | "dark";
  themeParams: TelegramThemeParams;
  isExpanded: boolean;
  viewportStableHeight: number;
  version: string;
  platform: string;
  ready(): void;
  expand(): void;
  close(): void;
  onEvent(event: TelegramEvent, handler: () => void): void;
  offEvent(event: TelegramEvent, handler: () => void): void;
  /** Absent on older clients; every call site must guard. */
  HapticFeedback?: TelegramHapticFeedback;
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

/** The WebApp object if the bridge script has already run, else null. */
export function getWebApp(): TelegramWebApp | null {
  if (typeof window === "undefined") return null;
  return window.Telegram?.WebApp ?? null;
}

/**
 * Waits for the bridge script to define window.Telegram.
 *
 * The script is a plain <script src> in the layout, so it is usually there
 * before hydration — but a cold WebView on a slow connection can hydrate first,
 * and deciding "not in Telegram" in that window would be wrong.
 */
export function waitForWebApp(timeoutMs = 3000): Promise<TelegramWebApp | null> {
  return new Promise((resolve) => {
    const immediate = getWebApp();
    if (immediate) {
      resolve(immediate);
      return;
    }
    if (typeof window === "undefined") {
      resolve(null);
      return;
    }

    const deadline = Date.now() + timeoutMs;
    const tick = () => {
      const app = getWebApp();
      if (app) {
        resolve(app);
        return;
      }
      if (Date.now() >= deadline) {
        resolve(null);
        return;
      }
      window.setTimeout(tick, 100);
    };
    window.setTimeout(tick, 100);
  });
}

/** Fire-and-forget feedback; silently a no-op on clients without haptics. */
export function haptic(kind: HapticNotification): void {
  getWebApp()?.HapticFeedback?.notificationOccurred(kind);
}

export function hapticTap(): void {
  getWebApp()?.HapticFeedback?.selectionChanged();
}
