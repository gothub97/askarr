import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "./auth";

/**
 * Session access for server components and server actions.
 *
 * Back-office pages check the session in a layout on the server. Never gate a
 * page from a client component: that ships the page and only hides it.
 */
export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

export type AppSession = NonNullable<Awaited<ReturnType<typeof getSession>>>;

export async function requireSession(): Promise<AppSession> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

export async function requireAdmin(): Promise<AppSession> {
  const session = await requireSession();
  const role = (session.user as { role?: string }).role;
  if (role !== "admin") redirect("/dashboard");
  return session;
}
