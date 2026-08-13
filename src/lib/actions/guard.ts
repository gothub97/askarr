import { getSession } from "../session";
import { isSetupCompleted } from "../settings";

/**
 * Server actions shared between onboarding and the back office.
 *
 * During onboarding there is no session yet for the first couple of steps, so
 * the guard also accepts "setup is not completed". Once setup is marked
 * complete that door closes for good and only a session gets through.
 */
export async function assertConfigurator(): Promise<void> {
  const session = await getSession();
  if (session) return;

  const completed = await isSetupCompleted();
  if (!completed) return;

  throw new Error("Sign in to do that.");
}

export async function assertSession() {
  const session = await getSession();
  if (!session) throw new Error("Sign in to do that.");
  return session;
}
