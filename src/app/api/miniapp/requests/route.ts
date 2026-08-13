import { MediaKind, MediaStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import type {
  RequestDto,
  RequestListDto,
  SubmitResponseDto,
} from "@/app/miniapp/types";
import {
  listInstancesForKind,
  listUserRequests,
  submitRequest,
  type SubmitOutcome,
} from "@/lib/requests";
import { ArrError, lookupByExternalId, type LookupResult } from "@/lib/servarr";
import {
  miniAppBadRequest,
  withTelegramUser,
} from "@/lib/telegram/miniapp-auth";

export const dynamic = "force-dynamic";

/** How many of the caller's own requests the list tab ever needs. */
const HISTORY_LIMIT = 100;

const mediaStatusSchema = z.enum([
  MediaStatus.PENDING,
  MediaStatus.REJECTED,
  MediaStatus.QUEUED,
  MediaStatus.GRABBED,
  MediaStatus.AVAILABLE,
  MediaStatus.FAILED,
  MediaStatus.ALREADY_HAVE,
]);

/** `?status=QUEUED,GRABBED` — the filter chips map to groups, not single states. */
const listQuerySchema = z.object({
  status: z
    .string()
    .optional()
    .transform((value) =>
      value
        ? value
            .split(",")
            .map((part) => part.trim())
            .filter(Boolean)
        : [],
    )
    .pipe(z.array(mediaStatusSchema)),
});

const submitBodySchema = z.object({
  kind: z.enum([MediaKind.MOVIE, MediaKind.SERIES]),
  externalId: z.number().int().positive(),
  /** Optional: a kind served by a single instance has nothing to choose. */
  instanceId: z.string().min(1).optional(),
  /** Series only. "all" is the full series, "lastSeason" the current one. */
  monitorMode: z.enum(["all", "firstSeason", "lastSeason"]).nullish(),
});

// -------------------------------------------------------------------- list

export async function GET(request: Request): Promise<Response> {
  return withTelegramUser(request, async (user) => {
    const url = new URL(request.url);
    const parsed = listQuerySchema.safeParse({
      status: url.searchParams.get("status") ?? undefined,
    });
    if (!parsed.success) {
      return miniAppBadRequest("That status filter is not one Askarr knows.");
    }

    const wanted = new Set(parsed.data.status);
    const subscriptions = await listUserRequests(user.id, HISTORY_LIMIT);

    // listUserRequests has no status argument, and a person's own history is
    // small enough that filtering here beats widening the shared query.
    const requests: RequestDto[] = subscriptions
      .filter((sub) => wanted.size === 0 || wanted.has(sub.mediaItem.status))
      .map((sub) => ({
        subscriptionId: sub.id,
        mediaItemId: sub.mediaItem.id,
        kind: sub.mediaItem.kind,
        externalId: sub.mediaItem.externalId,
        title: sub.mediaItem.title,
        year: sub.mediaItem.year,
        overview: sub.mediaItem.overview,
        posterUrl: sub.mediaItem.posterUrl,
        status: sub.mediaItem.status,
        statusReason: sub.mediaItem.statusReason,
        instanceLabel: sub.mediaItem.instance.label,
        monitorMode: sub.mediaItem.monitorMode,
        requestedAt: sub.createdAt.toISOString(),
      }));

    const body: RequestListDto = { requests };
    return NextResponse.json(body);
  });
}

// ------------------------------------------------------------------ submit

export async function POST(request: Request): Promise<Response> {
  return withTelegramUser(request, async (user) => {
    const raw: unknown = await request.json().catch(() => null);
    const parsed = submitBodySchema.safeParse(raw);
    if (!parsed.success) {
      return miniAppBadRequest("That request is missing something. Try again.");
    }
    const { kind, externalId } = parsed.data;

    // ---- Resolve the instance the title should go to.
    const instances = await listInstancesForKind(kind);
    if (instances.length === 0) {
      return miniAppBadRequest(
        kind === MediaKind.MOVIE
          ? "No Radarr instance is set up yet. Ask an admin to add one."
          : "No Sonarr instance is set up yet. Ask an admin to add one.",
      );
    }

    // Unlike the bot, the Mini App has room for a real id, so it sends one.
    // Resolved against the enabled list so a disabled or foreign instance
    // cannot be pushed to by a handcrafted request.
    const requested = parsed.data.instanceId;
    if (!requested && instances.length > 1) {
      return miniAppBadRequest("Pick where it should go before confirming.");
    }

    const instance = requested
      ? instances.find((i) => i.id === requested)
      : instances[0];
    if (!instance) {
      return miniAppBadRequest("That instance is not available right now.");
    }

    // ---- Re-read the title from the instance rather than trusting the client.
    // The client sends an id and nothing else; title, year, overview and poster
    // all come back from Radarr/Sonarr so nobody can plant their own metadata.
    let selection: LookupResult | null;
    try {
      selection = await lookupByExternalId(instance, externalId);
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof ArrError
              ? error.hint
              : `Could not reach ${instance.label}. Try again in a moment.`,
          code: "upstream_unreachable",
        },
        { status: 502 },
      );
    }
    if (!selection) {
      return miniAppBadRequest("That title is no longer available.");
    }

    // A movie has no seasons; Sonarr defaults to the full series.
    const monitorMode =
      kind === MediaKind.SERIES ? (parsed.data.monitorMode ?? "all") : null;

    const outcome = await submitRequest({
      telegramUser: user,
      instance,
      kind,
      selection: {
        externalId: selection.externalId,
        title: selection.title,
        year: selection.year,
        overview: selection.overview,
        posterUrl: selection.posterUrl,
      },
      monitorMode,
      // A Mini App request has no originating group message. Telegram gives a
      // private chat the same id as the user, so replies land in the DM with
      // the bot rather than nowhere.
      chatId: user.telegramId,
      threadId: null,
      messageId: null,
    });

    const body: SubmitResponseDto = describeOutcome(outcome, selection.title);
    return NextResponse.json(body, {
      status: outcome.kind === "blocked" ? 403 : 200,
    });
  });
}

/** Turns the business outcome into one sentence in the product's register. */
function describeOutcome(
  outcome: SubmitOutcome,
  title: string,
): SubmitResponseDto {
  switch (outcome.kind) {
    case "queued":
      return {
        outcome: "queued",
        title,
        status: outcome.mediaItem.status,
        message: `${title} is on its way. You'll get a message when it lands.`,
      };
    case "pending":
      return {
        outcome: "pending",
        title,
        status: outcome.mediaItem.status,
        message:
          outcome.reason === "quota"
            ? "You've used your monthly quota, so this one goes to an admin for approval."
            : outcome.reason === "full_series"
              ? "A full series always needs approval. It's in the queue."
              : `${title} is waiting for an admin to approve it.`,
      };
    case "already_have":
      return {
        outcome: "already_have",
        title,
        status: outcome.mediaItem.status,
        message: `${title} is already in the library. Go watch it.`,
      };
    case "already_tracked":
      return {
        // Reuses the queued outcome on the wire: from the requester's side it
        // is the same story, something is now on its way.
        outcome: "queued",
        title,
        status: outcome.mediaItem.status,
        message: outcome.resumed
          ? `${title} was on the shelf but nothing was searching for it. Monitoring is back on and the hunt has started.`
          : `${title} is already on the list, waiting for a release. You'll get a message when it lands.`,
      };
    case "already_requested":
      return {
        outcome: "already_requested",
        title,
        status: outcome.status,
        message: [
          `Someone already asked for ${title}. You're on the list for it.`,
          outcome.note,
        ]
          .filter(Boolean)
          .join(" "),
      };
    case "duplicate":
      return {
        outcome: "duplicate",
        title,
        status: outcome.status,
        message: [`You already asked for ${title}.`, outcome.note ?? "Check My requests."]
          .filter(Boolean)
          .join(" "),
      };
    case "blocked":
      return {
        outcome: "blocked",
        title,
        status: null,
        message: "Your account cannot make requests. Ask an admin.",
      };
    case "error":
      return {
        outcome: "error",
        title,
        status: null,
        message: outcome.message,
      };
  }
}
