import { NextResponse, type NextRequest } from "next/server";

/**
 * Two gates:
 *  - while setup is not completed, everything redirects to /onboarding
 *  - once it is, back-office pages require a session cookie
 *
 * The cookie check here is a cheap redirect, not the security boundary. Pages
 * still verify the session server-side in their layout; a forged cookie gets
 * past the middleware and straight into a redirect from the layout.
 *
 * Setup state is read through an internal endpoint because middleware cannot
 * open a Prisma connection.
 */

const PUBLIC_PATHS = ["/login", "/onboarding"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

async function isSetupCompleted(request: NextRequest): Promise<boolean> {
  try {
    const response = await fetch(new URL("/api/setup-state", request.url), {
      headers: { "x-internal": "1" },
      cache: "no-store",
    });
    if (!response.ok) return true; // fail open rather than trap the user
    const body = (await response.json()) as { completed?: boolean };
    return body.completed === true;
  } catch {
    return true;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const completed = await isSetupCompleted(request);

  if (!completed) {
    if (pathname === "/onboarding") return NextResponse.next();
    return NextResponse.redirect(new URL("/onboarding", request.url));
  }

  // Setup is done, so the wizard is gone for good: it is the one path that can
  // mint an administrator, and a second one must never be creatable.
  //
  // 410 rather than a redirect to /dashboard, and answered here rather than in
  // the page, because a page in the App Router cannot set its own status code
  // (Next only allows 401/403/404 through the access-fallback family). The
  // wizard's server actions refuse independently — they are addressable by id
  // and replayable, so sealing the URL alone would not be enough.
  if (pathname === "/onboarding") {
    return new NextResponse(
      "Setup is already done. Sign in at /login instead.",
      {
        status: 410,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      },
    );
  }

  if (isPublicPath(pathname)) return NextResponse.next();

  if (pathname === "/") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  const hasSessionCookie =
    request.cookies.has("better-auth.session_token") ||
    request.cookies.has("__Secure-better-auth.session_token");

  if (!hasSessionCookie) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Everything except:
     *  - /api          (routes do their own auth; the bot and webhooks need in)
     *  - Next internals and static assets
     */
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
