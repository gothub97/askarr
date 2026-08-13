import type * as React from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import { countPendingRequests } from "@/lib/requests";
import { requireSession } from "@/lib/session";

/**
 * The one place the back office is gated. Checking the session here — on the
 * server, in the layout — is what makes every page under (admin) private;
 * a client-side check would ship the page and merely hide it.
 */
export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // The pending count rides in the sidebar on every page, so it is fetched
  // here rather than per page. It is the one number an operator has to act on.
  const [session, pendingCount] = await Promise.all([
    requireSession(),
    countPendingRequests(),
  ]);

  return (
    <AdminShell email={session.user.email} pendingCount={pendingCount}>
      {children}
    </AdminShell>
  );
}
