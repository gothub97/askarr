import type { Metadata } from "next";
import Link from "next/link";
import { LockIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getSetupProgressAction } from "@/lib/actions/onboarding";
import { isSetupCompleted } from "@/lib/settings";
import { OnboardingWizard } from "./onboarding-wizard";

/*
 * ---------------------------------------------------------------------------
 * On answering 410 Gone
 * ---------------------------------------------------------------------------
 * A page in the App Router cannot choose its own HTTP status. The only lever
 * Next gives a Server Component is the access-fallback family (`notFound`,
 * `forbidden`, `unauthorized`), and Next hard-limits those to 404 / 403 / 401
 * (see `HTTPAccessErrorStatus` in
 * next/dist/client/components/http-access-fallback/http-access-fallback.js,
 * where any other code is rejected by `isHTTPAccessFallbackError`. A 410 has
 * to come from something that owns the Response object: the proxy/middleware
 * or a Route Handler.
 *
 * So "gone" is enforced at every layer that can actually express it, and the
 * page is the least load-bearing of the three:
 *
 *   1. src/middleware.ts intercepts /onboarding once setup is completed, so
 *      the wizard is unreachable in a browser. (It currently redirects to
 *      /dashboard; one line there could return a real 410 body instead, and that
 *      file is not ours to change.)
 *   2. GET /api/onboarding/telegram-chats answers a literal 410 Gone.
 *   3. Every server action in src/lib/actions/onboarding.ts refuses with a
 *      `gone` result. This is the one that matters: server actions are
 *      addressable by id and replayable, so shutting the page alone would
 *      still let a replayed step 1 mint a second administrator.
 *
 * What is left here is the terminal state below, for the case where the
 * middleware has failed open (a database that was not up when it checked).
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Set up Askarr",
  robots: { index: false, follow: false },
};

export default async function OnboardingPage() {
  if (await isSetupCompleted()) return <SetupAlreadyDone />;

  /*
   * Where to resume is read from the database, not from the browser. Two of the
   * seven steps send the operator to Telegram, and some of them will close the
   * tab on the way; they must come back to the step they left rather than to an
   * offer to create a second administrator.
   */
  const progress = await getSetupProgressAction();

  // The wizard caps its own column: the width it wants changes with the step.
  return <OnboardingWizard initialProgress={progress} />;
}

function SetupAlreadyDone() {
  return (
    <Card className="mx-auto w-full max-w-lg">
      <CardHeader>
        <CardTitle className="text-xl">
          Setup is already done
        </CardTitle>
        <CardDescription>
          This Askarr install has an administrator. The wizard runs once and
          never again.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Alert>
          <LockIcon />
          <AlertTitle>Gone, not hidden</AlertTitle>
          <AlertDescription>
            Every onboarding endpoint now answers 410 Gone, so no second
            administrator can be created from here.
          </AlertDescription>
        </Alert>
        <Button render={<Link href="/login" />} nativeButton={false} size="lg" className="w-full">
          Sign in
        </Button>
      </CardContent>
    </Card>
  );
}
