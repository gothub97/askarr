import { NextResponse } from "next/server";
import type { PublicTelegramChat } from "@/app/(public)/onboarding/types";
import { prisma } from "@/lib/prisma";
import { isSetupCompleted } from "@/lib/settings";

/**
 * Step 4 of the wizard polls this every few seconds while the operator adds
 * the bot to their group. The bot process writes a TelegramChat row when it is
 * added somewhere; this endpoint is how the browser learns about it without a
 * websocket.
 *
 * This is a Route Handler rather than a server action because a handler owns
 * its Response, which is the only way in the App Router to answer a genuine
 * **410 Gone** once setup is completed. `notFound()` and friends are capped at
 * 401/403/404 by Next itself, so a page cannot express "this door is bricked
 * up, permanently". Onboarding is exactly that once it has run once.
 *
 * While setup is incomplete the endpoint is unauthenticated, like the wizard
 * it serves: there is no account to authenticate against yet. That window is
 * closed by the very first successful run.
 */

export const dynamic = "force-dynamic";

export async function GET() {
  if (await isSetupCompleted()) {
    return NextResponse.json(
      { error: "Onboarding is over. This endpoint no longer exists." },
      { status: 410, headers: { "Cache-Control": "no-store" } },
    );
  }

  const rows = await prisma.telegramChat.findMany({
    orderBy: { createdAt: "asc" },
  });

  const chats: PublicTelegramChat[] = rows.map((row) => ({
    id: row.id,
    // BigInt has no JSON form; serialise it before it crosses to the client.
    chatId: row.chatId.toString(),
    threadId: row.requestThreadId,
    title: row.title,
    enabled: row.enabled,
  }));

  return NextResponse.json(
    { chats },
    { headers: { "Cache-Control": "no-store" } },
  );
}
