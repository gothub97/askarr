import assert from "node:assert/strict";
import { after, before, beforeEach, describe, test } from "node:test";
import {
  ArrKind,
  AudioVersion,
  MediaKind,
  MediaStatus,
  TelegramRole,
  type ArrInstance,
} from "@prisma/client";
import { prisma } from "./prisma";
import { ensureTelegramUser, submitRequest } from "./requests";

/**
 * Integration tests for the deduplication and approval rules.
 *
 * These run against a real Postgres, because the rules they cover are enforced
 * by unique constraints and a transaction: a mock would test the mock. Radarr
 * itself is stubbed at the fetch boundary so nothing leaves the machine, and
 * so we can assert that certain paths perform NO add call at all.
 *
 * Skipped automatically when no database is reachable.
 */

const realFetch = globalThis.fetch;

/** Calls the stub recorded, so a test can assert what was and was not sent. */
let calls: { url: string; method: string; body: unknown }[] = [];

/** Titles the fake instance claims to already manage, by tmdbId. */
let libraryIds = new Set<number>();

function installFetchStub() {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ url, method, body });

    const parsed = new URL(url);
    const term = parsed.searchParams.get("term") ?? "";

    if (parsed.pathname.endsWith("/api/v3/movie/lookup")) {
      const tmdbId = Number(term.replace("tmdb:", "")) || 550;
      const managed = libraryIds.has(tmdbId);
      return json([
        {
          // Radarr reports a non-zero id when it already manages the title.
          id: managed ? 4242 : 0,
          tmdbId,
          title: "Fight Club",
          year: 1999,
          overview: "An insomniac and a soap salesman.",
          images: [{ coverType: "poster", remoteUrl: "https://img/poster.jpg" }],
        },
      ]);
    }

    if (parsed.pathname.endsWith("/api/v3/movie") && method === "POST") {
      return json({ id: 777, tmdbId: body?.tmdbId, title: body?.title });
    }

    return json([]);
  }) as typeof fetch;
}

function json(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function addCalls() {
  return calls.filter(
    (call) => call.method === "POST" && call.url.includes("/api/v3/movie"),
  );
}

let instance: ArrInstance;
let databaseUp = true;

const SELECTION = {
  externalId: 550,
  title: "Fight Club",
  year: 1999,
  overview: "An insomniac and a soap salesman.",
  posterUrl: "https://img/poster.jpg",
};

before(async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    databaseUp = false;
    return;
  }
  installFetchStub();
});

beforeEach(async () => {
  if (!databaseUp) return;
  calls = [];
  libraryIds = new Set();

  // Order matters: MediaItem cascades to Subscription.
  await prisma.subscription.deleteMany();
  await prisma.mediaItem.deleteMany();
  await prisma.requestDraft.deleteMany();
  await prisma.telegramUser.deleteMany();
  await prisma.arrInstance.deleteMany();

  instance = await prisma.arrInstance.create({
    data: {
      label: "Radarr MULTI (test)",
      kind: ArrKind.RADARR,
      version: AudioVersion.MULTI,
      baseUrl: "https://radarr.test/admin/radarr",
      apiKey: "test-key",
      qualityProfileId: 4,
      rootFolderPath: "/mnt/movies",
      isDefault: true,
    },
  });
});

after(async () => {
  globalThis.fetch = realFetch;
  if (databaseUp) await prisma.$disconnect();
});

async function makeUser(role: TelegramRole, telegramId: bigint) {
  const user = await ensureTelegramUser({
    telegramId,
    username: `u${telegramId}`,
    displayName: `User ${telegramId}`,
  });
  return prisma.telegramUser.update({
    where: { id: user.id },
    data: { role },
  });
}

function submit(
  user: Awaited<ReturnType<typeof makeUser>>,
  overrides: Partial<Parameters<typeof submitRequest>[0]> = {},
) {
  return submitRequest({
    telegramUser: user,
    instance,
    kind: MediaKind.MOVIE,
    selection: SELECTION,
    monitorMode: null,
    chatId: -1001234567890n,
    threadId: null,
    messageId: 10,
    ...overrides,
  });
}

/**
 * `describe` options are evaluated before `before()` runs, so the skip cannot
 * be declared up front. Each test opts out at run time instead.
 */
function needsDatabase(t: { skip: (reason?: string) => void }): boolean {
  if (databaseUp) return true;
  t.skip("no database reachable; start one with `docker compose up -d postgres`");
  return false;
}

describe("submitRequest", () => {
  // Acceptance: two people requesting the same movie on the same instance
  // produce one MediaItem and two Subscriptions, and both get notified.
  test("two people asking for the same film share one MediaItem", async (t) => {
    if (!needsDatabase(t)) return;
    const ada = await makeUser(TelegramRole.ADMIN, 1n);
    const bob = await makeUser(TelegramRole.ADMIN, 2n);

    const first = await submit(ada);
    const second = await submit(bob, { messageId: 20 });

    assert.equal(first.kind, "queued");
    assert.equal(second.kind, "already_requested");

    const items = await prisma.mediaItem.findMany();
    assert.equal(items.length, 1, "expected exactly one MediaItem");

    const subs = await prisma.subscription.findMany({
      where: { mediaItemId: items[0].id },
    });
    assert.equal(subs.length, 2, "expected one Subscription per person");

    // Both keep their own reply target, so each is notified in place.
    assert.deepEqual(subs.map((s) => s.messageId).sort(), [10, 20]);

    // The film is added to Radarr exactly once, not once per requester.
    assert.equal(addCalls().length, 1);
  });

  test("the same person asking twice is a duplicate, not a second row", async (t) => {
    if (!needsDatabase(t)) return;
    const ada = await makeUser(TelegramRole.ADMIN, 1n);

    await submit(ada);
    const again = await submit(ada);

    assert.equal(again.kind, "duplicate");
    assert.equal(await prisma.subscription.count(), 1);
    assert.equal(addCalls().length, 1);
  });

  // Acceptance: a movie already in the library triggers no add call.
  test("a film already in the library is never sent to Radarr", async (t) => {
    if (!needsDatabase(t)) return;
    libraryIds.add(550);
    const ada = await makeUser(TelegramRole.ADMIN, 1n);

    const outcome = await submit(ada);

    assert.equal(outcome.kind, "already_have");
    assert.equal(addCalls().length, 0, "nothing must be POSTed to Radarr");

    const item = await prisma.mediaItem.findFirstOrThrow();
    assert.equal(item.status, MediaStatus.ALREADY_HAVE);

    // The requester is still subscribed, so they get told about it.
    assert.equal(await prisma.subscription.count(), 1);
  });

  // Acceptance: a GUEST request stays pending and never reaches Radarr.
  test("a GUEST request waits and is not pushed", async (t) => {
    if (!needsDatabase(t)) return;
    const guest = await makeUser(TelegramRole.GUEST, 3n);

    const outcome = await submit(guest);

    assert.equal(outcome.kind, "pending");
    assert.equal(addCalls().length, 0, "nothing must reach Radarr before approval");

    const item = await prisma.mediaItem.findFirstOrThrow();
    assert.equal(item.status, MediaStatus.PENDING);
    assert.equal(item.arrId, null);
  });

  test("a BLOCKED user gets no reaction and leaves no trace", async (t) => {
    if (!needsDatabase(t)) return;
    const blocked = await makeUser(TelegramRole.BLOCKED, 4n);

    const outcome = await submit(blocked);

    assert.equal(outcome.kind, "blocked");
    assert.equal(await prisma.mediaItem.count(), 0);
    assert.equal(await prisma.subscription.count(), 0);
    assert.equal(addCalls().length, 0);
  });

  test("a TRUSTED user is auto-approved inside their quota", async (t) => {
    if (!needsDatabase(t)) return;
    const trusted = await makeUser(TelegramRole.TRUSTED, 5n);

    const outcome = await submit(trusted);

    assert.equal(outcome.kind, "queued");
    const item = await prisma.mediaItem.findFirstOrThrow();
    assert.equal(item.status, MediaStatus.QUEUED);
    assert.equal(item.arrId, 777);
  });

  test("a TRUSTED user over quota falls back to approval", async (t) => {
    if (!needsDatabase(t)) return;
    const trusted = await makeUser(TelegramRole.TRUSTED, 6n);
    await prisma.telegramUser.update({
      where: { id: trusted.id },
      data: { quotaPerMonth: 1 },
    });
    const capped = await prisma.telegramUser.findUniqueOrThrow({
      where: { id: trusted.id },
    });

    await submit(capped);
    const second = await submit(capped, {
      selection: { ...SELECTION, externalId: 551, title: "Se7en" },
    });

    assert.equal(second.kind, "pending");
    if (second.kind !== "pending") return;
    assert.equal(second.reason, "quota");
  });

  // A full series can trigger hundreds of grabs, so it is always reviewed.
  test("a TRUSTED user's full-series request still waits", async (t) => {
    if (!needsDatabase(t)) return;
    const trusted = await makeUser(TelegramRole.TRUSTED, 7n);

    const outcome = await submit(trusted, {
      kind: MediaKind.SERIES,
      monitorMode: "all",
    });

    assert.equal(outcome.kind, "pending");
    if (outcome.kind !== "pending") return;
    assert.equal(outcome.reason, "full_series");
  });

  test("the request goes to the instance's path prefix", async (t) => {
    if (!needsDatabase(t)) return;
    const ada = await makeUser(TelegramRole.ADMIN, 8n);
    await submit(ada);

    const post = addCalls()[0];
    assert.ok(
      post.url.startsWith("https://radarr.test/admin/radarr/api/v3/movie"),
      `prefix was dropped: ${post.url}`,
    );
  });
});
