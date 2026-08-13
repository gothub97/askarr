"use client";

import { createAuthClient } from "better-auth/react";

/**
 * No `baseURL` on purpose.
 *
 * Askarr's auth routes are always same-origin, and better-auth's client falls
 * back to `window.location.origin` when none is given. Passing one would mean
 * reading a `NEXT_PUBLIC_*` variable, which Next inlines at *build* time — and
 * that would make the published Docker image specific to whichever URL it was
 * built against. Leaving it out is what lets one image serve every install.
 */
export const authClient = createAuthClient();

export const { signIn, signOut, signUp, useSession } = authClient;
