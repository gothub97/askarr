import { MiniAppShell } from "./miniapp-shell";

/**
 * /miniapp — the Telegram Mini App.
 *
 * Nothing is rendered on the server: the identity comes from initData, which
 * only exists inside the WebView, so a server render would either be empty or
 * be a lie. The page is a mount point and nothing else.
 */
export const dynamic = "force-static";

export default function MiniAppPage() {
  return <MiniAppShell />;
}
