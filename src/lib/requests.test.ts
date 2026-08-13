import assert from "node:assert/strict";
import { after, before, beforeEach, describe, test } from "node:test";
import {
  ArrKind,
  MediaKind,
  MediaStatus,
  TelegramRole,
  type ArrInstance,
} from "@prisma/client";
import { prisma } from "./prisma";
import { DB_TEST_SKIP, DB_TESTS_ENABLED } from "./test-db";
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

/**
 * What the fake instance claims about a title, by tmdbId.
 *
 * Managed, holding a file, and being monitored are three separate things, and
 * conflating them is exactly the bug these tests exist to pin.
 */
let library = new Map<
  number,
  { hasFile: boolean; monitored: boolean; releaseStatus?: string }
>();

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
      const held = library.get(tmdbId);
      return json([
        {
          // Radarr reports a non-zero id when it already manages the title.
          id: held ? 4242 : 0,
          tmdbId,
          title: "Fight Club",
          year: 1999,
          overview: "An insomniac and a soap salesman.",
          hasFile: held?.hasFile ?? false,
          monitored: held?.monitored ?? false,
          status: held?.releaseStatus ?? "released",
          images: [{ coverType: "poster", remoteUrl: "https://img/poster.jpg" }],
        },
      ]);
    }

    if (parsed.pathname.endsWith("/api/v3/movie") && method === "POST") {
      return json({ id: 777, tmdbId: body?.tmdbId, title: body?.title });
    }

    /*
     * The library record, fetched both by resumeMovie before its PUT and by
     * lookupMovieByTmdbId once the id says the library holds the title —
     * /movie/lookup does not carry hasFile, so this is where truth lives.
     */
    if (/\/api\/v3\/movie\/\d+$/.test(parsed.pathname) && method === "GET") {
      const held = library.get(550);
      return json({
        id: 4242,
        tmdbId: 550,
        title: "Fight Club",
        year: 1999,
        hasFile: held?.hasFile ?? false,
        monitored: held?.monitored ?? false,
        status: held?.releaseStatus ?? "released",
      });
    }
    if (/\/api\/v3\/movie\/\d+$/.test(parsed.pathname) && method === "PUT") {
      return json({ ...(body as object), id: 4242 });
    }
    if (parsed.pathname.endsWith("/api/v3/command") && method === "POST") {
      return json({ id: 1, name: body?.name });
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
    (call) =>
      call.method === "POST" && /\/api\/v3\/movie$/.test(new URL(call.url).pathname),
  );
}

function searchCommands() {
  return calls.filter(
    (call) =>
      call.method === "POST" && call.url.includes("/api/v3/command"),
  );
}

function monitorPuts() {
  return calls.filter(
    (call) => call.method === "PUT" && /\/api\/v3\/movie\/\d+$/.test(new URL(call.url).pathname),
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
  if (!DB_TESTS_ENABLED) return;
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    databaseUp = false;
    return;
  }
  installFetchStub();
});

beforeEach(async () => {
  if (!DB_TESTS_ENABLED) return;
  if (!databaseUp) return;
  calls = [];
  library = new Map();

  // Order matters: MediaItem cascades to Subscription.
  await prisma.subscription.deleteMany();
  await prisma.mediaItem.deleteMany();
  await prisma.requestDraft.deleteMany();
  await prisma.telegramUser.deleteMany();
  await prisma.arrInstance.deleteMany();

  instance = await prisma.arrInstance.create({
    data: {
      label: "Radarr (test)",
      kind: ArrKind.RADARR,
      baseUrl: "https://radarr.test/admin/radarr",
      apiKey: "test-key",
      qualityProfileId: 4,
      rootFolderPath: "/mnt/movies",
      isDefault: true,
    },
  });
});

after(async () => {
  if (!DB_TESTS_ENABLED) return;
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

describe("submitRequest", DB_TEST_SKIP, () => {
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
    library.set(550, { hasFile: true, monitored: true });
    const ada = await makeUser(TelegramRole.ADMIN, 1n);

    const outcome = await submit(ada);

    assert.equal(outcome.kind, "already_have");
    assert.equal(addCalls().length, 0, "nothing must be POSTed to Radarr");

    const item = await prisma.mediaItem.findFirstOrThrow();
    assert.equal(item.status, MediaStatus.ALREADY_HAVE);

    // The requester is still subscribed, so they get told about it.
    assert.equal(await prisma.subscription.count(), 1);
  });

  /*
   * The three states behind "the instance already knows this title". Radarr
   * reports a non-zero id for all of them, and treating that alone as "already
   * in the library" told someone to go watch a film that did not exist and
   * that nothing was even looking for.
   */
  test("a film on the instance with no file is not called watchable", async (t) => {
    if (!needsDatabase(t)) return;
    library.set(550, { hasFile: false, monitored: true });
    const ada = await makeUser(TelegramRole.ADMIN, 20n);

    const outcome = await submit(ada);

    assert.equal(outcome.kind, "already_tracked");
    assert.equal(
      outcome.kind === "already_tracked" && outcome.resumed,
      false,
      "it was already monitored, so nothing needed restarting",
    );
    assert.equal(addCalls().length, 0, "it is already there; do not add it again");
    assert.equal(monitorPuts().length, 0, "monitoring was already on");

    const item = await prisma.mediaItem.findFirstOrThrow();
    assert.equal(item.status, MediaStatus.QUEUED);
  });

  /*
   * A stored status is a snapshot, and only a webhook ever moves it. An
   * install whose webhook was missing when the file landed would otherwise
   * keep answering "queued and looking for a release" about a film that has
   * been on disk for a week.
   */
  test("asking again heals a status the missing webhook never updated", async (t) => {
    if (!needsDatabase(t)) return;
    const ada = await makeUser(TelegramRole.ADMIN, 22n);

    // First request: not on the instance yet, so it is added and queued.
    const first = await submit(ada);
    assert.equal(first.kind, "queued");
    const before = await prisma.mediaItem.findFirstOrThrow();
    assert.equal(before.status, MediaStatus.QUEUED);

    // It lands, but no webhook ever tells Askarr.
    library.set(550, { hasFile: true, monitored: true });

    const second = await submit(ada);

    assert.equal(second.kind, "duplicate");
    const after = await prisma.mediaItem.findFirstOrThrow();
    assert.equal(
      after.status,
      MediaStatus.AVAILABLE,
      "the row must be corrected from what the instance actually holds",
    );
  });

  test("an announced film says so instead of claiming to be looking", async (t) => {
    if (!needsDatabase(t)) return;
    const ada = await makeUser(TelegramRole.ADMIN, 23n);
    await submit(ada);

    // Present, monitored, but not out yet: nothing will ever be found.
    library.set(550, { hasFile: false, monitored: true, releaseStatus: "announced" });

    const outcome = await submit(ada);

    assert.equal(outcome.kind, "duplicate");
    assert.match(
      outcome.kind === "duplicate" ? (outcome.note ?? "") : "",
      /not been released/i,
      "the reason nothing is happening has to be said out loud",
    );
  });

  test("an unmonitored film is put back under watch and searched for", async (t) => {
    if (!needsDatabase(t)) return;
    library.set(550, { hasFile: false, monitored: false });
    const ada = await makeUser(TelegramRole.ADMIN, 21n);

    const outcome = await submit(ada);

    assert.equal(outcome.kind, "already_tracked");
    assert.equal(
      outcome.kind === "already_tracked" && outcome.resumed,
      true,
      "an unmonitored title must be resumed, or the request does nothing",
    );
    assert.equal(monitorPuts().length, 1, "monitoring must be turned back on");
    assert.equal(
      (monitorPuts()[0]?.body as { monitored?: boolean })?.monitored,
      true,
      "the PUT must actually set monitored, not just re-send the object",
    );

    const searches = searchCommands();
    assert.equal(searches.length, 1, "a search must actually be kicked off");
    assert.equal((searches[0]?.body as { name?: string })?.name, "MoviesSearch");

    // Still never re-added: it is already in the library, just neglected.
    assert.equal(addCalls().length, 0);
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
