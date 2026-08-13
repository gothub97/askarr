import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { MediaKind, MediaStatus, Prisma, type MediaItem } from "@prisma/client";
import {
  drainPendingNotifications,
  notifyMediaAvailable,
} from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { correlateMediaItem } from "@/lib/webhooks/correlate";
import {
  arrWebhookSchema,
  readEventType,
  type ArrWebhookPayload,
} from "@/lib/webhooks/schemas";

/**
 * Inbound Radarr/Sonarr webhooks.
 *
 *   POST /api/webhooks/arr/<instanceId>?token=<webhookSecret>
 *
 * Radarr and Sonarr cannot authenticate an outbound webhook: no signature, no
 * mTLS, nothing but the URL they were handed. The token in the query string is
 * therefore the entire security boundary, which is why it is compared in
 * constant time and why a bad one answers 404 — a 401 would confirm that the
 * instance id exists and turn the endpoint into an enumeration oracle.
 *
 * Everything else answers 200. Radarr disables a webhook that keeps failing,
 * and losing status updates for the rest of time is far worse than swallowing
 * one malformed payload.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Compared against when the instance does not exist, so both paths cost the same. */
const DECOY_SECRET = "askarr-no-such-instance";

const MAX_RAW_BODY_CHARS = 20_000;

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ instanceId: string }> },
): Promise<NextResponse> {
  const { instanceId } = await context.params;
  const token = request.nextUrl.searchParams.get("token") ?? "";

  let instance: { id: string; webhookSecret: string } | null = null;
  try {
    instance = await prisma.arrInstance.findUnique({
      where: { id: instanceId },
      select: { id: true, webhookSecret: true },
    });
  } catch (error) {
    // The database being down is our problem, not the sender's; a 404 here
    // would look like a revoked secret and send an admin down the wrong path.
    console.error("[webhook] instance lookup failed", error);
    return NextResponse.json({ ok: false }, { status: 503 });
  }

  // The compare runs even when there is no instance: skipping it would make an
  // unknown id measurably faster than a wrong token.
  const secretMatches = secretsMatch(token, instance?.webhookSecret ?? DECOY_SECRET);
  if (!instance || !secretMatches) return notFound();

  const body = await readBody(request);
  const eventType = readEventType(body.value);

  // Permissive on purpose: a payload that fails to parse still gets recorded.
  const parsed = arrWebhookSchema.safeParse(body.value);
  const payload: ArrWebhookPayload | null = parsed.success ? parsed.data : null;

  const mediaItem = payload
    ? await correlateMediaItem(instance.id, payload).catch(() => null)
    : null;

  // Written before anything is acted on, correlated or not. When a request
  // silently fails to flip to Available, this row is the only way to find out
  // what the instance actually sent.
  await recordEvent({
    instanceId: instance.id,
    mediaItemId: mediaItem?.id ?? null,
    eventType,
    payload: body.json,
  });

  if (eventType === "Test") {
    // Shown verbatim in the Radarr/Sonarr connection dialog.
    return NextResponse.json({
      ok: true,
      message: "Askarr received the test webhook. This connection works.",
    });
  }

  if (payload && mediaItem) {
    try {
      await applyEvent(eventType, payload, mediaItem);
    } catch (error) {
      console.error("[webhook] processing failed", eventType, error);
    }
  }

  // Anything whose aggregation window elapsed while no webhook was arriving.
  // Cheap and idempotent, so it rides along on every delivery rather than
  // depending on the interval driver being up.
  void drainPendingNotifications().catch((error: unknown) => {
    console.error("[webhook] opportunistic drain failed", error);
  });

  return NextResponse.json({ ok: true });
}

// ------------------------------------------------------------------ handlers

/**
 * The status machine, exactly as specified:
 *
 *   Grab                      -> GRABBED, silent (a grab is not news yet)
 *   Download, isUpgrade false -> AVAILABLE, notify
 *   Download, isUpgrade true  -> nothing: same title, better file
 *   MovieAdded / SeriesAdd    -> informational, recorded only
 *   anything else             -> ignored
 */
async function applyEvent(
  eventType: string,
  payload: ArrWebhookPayload,
  mediaItem: MediaItem,
): Promise<void> {
  switch (eventType) {
    case "Grab": {
      // updateMany, not update: the guard belongs in the WHERE so a late Grab
      // for one episode cannot drag an already-available series backwards.
      await prisma.mediaItem.updateMany({
        where: {
          id: mediaItem.id,
          status: {
            in: [
              MediaStatus.PENDING,
              MediaStatus.QUEUED,
              MediaStatus.GRABBED,
              MediaStatus.FAILED,
            ],
          },
        },
        data: { status: MediaStatus.GRABBED, statusReason: null },
      });
      return;
    }

    case "Download": {
      if (payload.isUpgrade === true) return; // already there, just better

      await prisma.mediaItem.update({
        where: { id: mediaItem.id },
        data: { status: MediaStatus.AVAILABLE, statusReason: null },
      });

      if (mediaItem.kind === MediaKind.MOVIE) {
        // A movie import is one event: nothing to wait for. Fired and
        // forgotten so the Bot API round trip stays off the response path.
        void notifyMediaAvailable(mediaItem.id).catch((error: unknown) => {
          console.error("[webhook] movie notification failed", error);
        });
      }
      // A series says nothing yet. Its episodes arrive one webhook at a time
      // and the drain groups them into a single season message.
      return;
    }

    case "MovieAdded":
    case "SeriesAdd":
      // The instance confirming it took the title. Already reflected by
      // QUEUED when it was pushed, so there is nothing to say.
      return;

    default:
      // Rename, Health, ApplicationUpdate, MovieDelete... recorded, ignored.
      return;
  }
}

// ------------------------------------------------------------------- helpers

/**
 * Constant-time secret comparison.
 *
 * timingSafeEqual throws on buffers of different lengths, and branching on
 * length first would leak how long the real secret is. Hashing both sides
 * gives two 32-byte digests: always comparable, and the length of the input
 * never reaches the comparison.
 */
function secretsMatch(provided: string, expected: string): boolean {
  const a = createHash("sha256").update(provided, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b);
}

/** Identical answer for an unknown instance and for a wrong token. */
function notFound(): NextResponse {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

interface RawBody {
  /** Parsed JSON, or null when the body was not JSON at all. */
  value: unknown;
  /** What to store in ArrEvent.payload; always a valid Json value. */
  json: Prisma.InputJsonValue;
}

async function readBody(request: NextRequest): Promise<RawBody> {
  let text: string;
  try {
    text = await request.text();
  } catch {
    return { value: null, json: { unreadable: true } };
  }

  try {
    const value: unknown = JSON.parse(text);
    if (value && typeof value === "object") {
      return { value, json: value as Prisma.InputJsonValue };
    }
    // A bare scalar is legal JSON but never something Radarr sends; wrap it so
    // the column always holds an object.
    return { value, json: { raw: text.slice(0, MAX_RAW_BODY_CHARS) } };
  } catch {
    // Keep the bytes: a reverse proxy rewriting the body shows up here.
    return { value: null, json: { raw: text.slice(0, MAX_RAW_BODY_CHARS) } };
  }
}

async function recordEvent(data: {
  instanceId: string;
  mediaItemId: string | null;
  eventType: string;
  payload: Prisma.InputJsonValue;
}): Promise<void> {
  try {
    await prisma.arrEvent.create({ data });
  } catch (error) {
    // Losing the audit row is bad; failing the delivery over it is worse.
    console.error("[webhook] could not record event", error);
  }
}
