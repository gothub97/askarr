import { NextResponse } from "next/server";
import { isSetupCompleted } from "@/lib/settings";

/**
 * Read by the middleware, which cannot open a Prisma connection itself.
 * Exposes one boolean and nothing else.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const completed = await isSetupCompleted();
    return NextResponse.json(
      { completed },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    // A database that is not up yet must not trap every request in a loop.
    return NextResponse.json({ completed: true }, { status: 200 });
  }
}
