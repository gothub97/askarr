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

  // Setup is done: /onboarding must not create a second admin. The route
  // itself answers 410; redirecting here keeps people out of a dead page.
  if (pathname === "/onboarding") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
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
     *  - /miniapp      (authenticated by initData, not by a session)
     *  - Next internals and static assets
     */
    "/((?!api|miniapp|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
