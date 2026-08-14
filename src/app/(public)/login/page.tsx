import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Sign in to Askarr",
};

/**
 * Accounts are created by an administrator (the first one by the onboarding
 * wizard), so there is no sign-up link here on purpose.
 */

/**
 * Only same-origin, absolute-path destinations are honoured. Anything else
 * ("//evil.example", "https://…", a protocol-relative path) is an open
 * redirect waiting to happen and falls back to the dashboard.
 */
function safeNext(value: string | string[] | undefined): string {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate) return "/dashboard";
  if (!candidate.startsWith("/")) return "/dashboard";
  if (candidate.startsWith("//") || candidate.startsWith("/\\")) {
    return "/dashboard";
  }
  return candidate;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;

  // The shell's column is fluid; a sign-in form caps itself.
  return (
    <div className="mx-auto w-full max-w-lg">
      <LoginForm next={safeNext(params.next)} />
    </div>
  );
}
