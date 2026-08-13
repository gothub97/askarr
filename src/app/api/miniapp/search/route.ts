import { MediaKind } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import type { SearchResponseDto } from "@/app/miniapp/types";
import { canRequest } from "@/lib/rbac";
import { searchMedia } from "@/lib/requests";
import {
  miniAppBadRequest,
  withTelegramUser,
} from "@/lib/telegram/miniapp-auth";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  kind: z.enum([MediaKind.MOVIE, MediaKind.SERIES]),
  term: z.string().trim().min(2).max(120),
});

/**
 * Metadata lookup against the default instance for the kind. Blocked accounts
 * get nothing at all: there is no point letting them browse a catalogue they
 * cannot request from.
 */
export async function GET(request: Request): Promise<Response> {
  return withTelegramUser(request, async (user) => {
    if (!canRequest(user)) {
      return NextResponse.json(
        { error: "Your account cannot make requests. Ask an admin.", code: "forbidden" },
        { status: 403 },
      );
    }

    const url = new URL(request.url);
    const parsed = querySchema.safeParse({
      kind: url.searchParams.get("kind"),
      term: url.searchParams.get("term"),
    });
    if (!parsed.success) {
      return miniAppBadRequest("Type at least two characters to search.");
    }

    const outcome = await searchMedia(parsed.data.kind, parsed.data.term);

    const body: SearchResponseDto = {
      ok: outcome.ok,
      instanceLabel: outcome.instance?.label ?? null,
      results: outcome.results.map((result) => ({
        externalId: result.externalId,
        title: result.title,
        year: result.year,
        overview: result.overview,
        posterUrl: result.posterUrl,
        alreadyManaged: result.alreadyManaged,
        latestSeason: result.latestSeason,
      })),
      ...(outcome.error ? { error: outcome.error } : {}),
    };

    return NextResponse.json(body);
  });
}
