import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /*
   * In development Next blocks cross-origin requests to `/_next/*` — its dev
   * chunks, fonts and HMR socket — unless the requesting origin is listed here.
   *
   * The Mini App only ever loads through a tunnel, because Telegram will not
   * open anything but a public HTTPS URL. The document itself is served fine,
   * so the page appears to load; every script behind it comes back 403 and
   * React never hydrates, which looks like a blank or dead Mini App rather
   * than a configuration problem.
   *
   * Development only — `next start` ignores this.
   */
  allowedDevOrigins: [
    "*.ngrok-free.app",
    "*.ngrok.app",
    "*.ngrok.io",
    "*.trycloudflare.com",
    "*.loca.lt",
  ],
};

export default nextConfig;
