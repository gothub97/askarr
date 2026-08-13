import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import {
  clearBotToken,
  getActiveBotToken,
  getBotTokenState,
  getBotTokenVersion,
  setBotToken,
} from "./bot-token";
import { prisma } from "./prisma";

/**
 * Needs the dev database, like requests.test.ts. The encryption is only worth
 * anything if it round-trips through a real Setting row, so this does not mock
 * Prisma.
 */

const REAL_TOKEN = "123456789:AAHfake-token-used-only-by-this-test";
const OTHER_TOKEN = "987654321:BBanother-fake-token-for-the-test";

let savedEnv: string | undefined;

before(async () => {
  savedEnv = process.env.TELEGRAM_BOT_TOKEN;
  process.env.BETTER_AUTH_SECRET ??= "test-secret-for-bot-token-encryption";
  await clearBotToken();
});

after(async () => {
  await clearBotToken();
  if (savedEnv === undefined) delete process.env.TELEGRAM_BOT_TOKEN;
  else process.env.TELEGRAM_BOT_TOKEN = savedEnv;
  await prisma.$disconnect();
});

describe("bot token storage", () => {
  test("a saved token round-trips through encryption", async () => {
    await setBotToken(REAL_TOKEN);
    assert.equal(await getActiveBotToken(), REAL_TOKEN);
  });

  test("the token is not stored in the clear", async () => {
    await setBotToken(REAL_TOKEN);
    const row = await prisma.setting.findUnique({ where: { key: "bot_token" } });
    const serialised = JSON.stringify(row?.value);

    assert.ok(serialised, "the row should exist");
    assert.ok(
      !serialised.includes(REAL_TOKEN),
      "the plaintext token must not appear in the stored value",
    );
    // The secret half specifically — the numeric prefix is not the credential.
    assert.ok(!serialised.includes("AAHfake-token-used-only-by-this-test"));
  });

  test("the saved token wins over the environment seed", async () => {
    process.env.TELEGRAM_BOT_TOKEN = OTHER_TOKEN;
    await setBotToken(REAL_TOKEN);
    assert.equal(await getActiveBotToken(), REAL_TOKEN);
  });

  test("clearing falls back to the environment seed", async () => {
    process.env.TELEGRAM_BOT_TOKEN = OTHER_TOKEN;
    await setBotToken(REAL_TOKEN);
    await clearBotToken();
    assert.equal(await getActiveBotToken(), OTHER_TOKEN);
  });

  test("with neither, there is no token rather than an empty string", async () => {
    await clearBotToken();
    delete process.env.TELEGRAM_BOT_TOKEN;
    assert.equal(await getActiveBotToken(), null);
  });

  // The version is the whole reload signal: if it does not move, a running bot
  // keeps serving on the token the admin just replaced.
  test("every save bumps the version the bot watches", async () => {
    await clearBotToken();
    assert.equal(await getBotTokenVersion(), 0);

    assert.equal(await setBotToken(REAL_TOKEN), 1);
    assert.equal(await getBotTokenVersion(), 1);

    assert.equal(await setBotToken(OTHER_TOKEN), 2);
    assert.equal(await getBotTokenVersion(), 2);
  });

  test("the state exposes a hint but never the token", async () => {
    await setBotToken(REAL_TOKEN);
    const state = await getBotTokenState();

    assert.equal(state.source, "database");
    assert.equal(state.hint, REAL_TOKEN.slice(-4));
    assert.ok(!JSON.stringify(state).includes(REAL_TOKEN));
  });

  test("a token encrypted under a different secret is not silently trusted", async () => {
    await setBotToken(REAL_TOKEN);
    process.env.TELEGRAM_BOT_TOKEN = OTHER_TOKEN;

    // Simulates BETTER_AUTH_SECRET being rotated out from under the row.
    const row = await prisma.setting.findUnique({ where: { key: "bot_token" } });
    const tampered = { ...(row?.value as object), ciphertext: "AAAA" };
    await prisma.setting.update({
      where: { key: "bot_token" },
      data: { value: tampered },
    });

    // Falls back rather than throwing or returning garbage.
    assert.equal(await getActiveBotToken(), OTHER_TOKEN);
  });
});
