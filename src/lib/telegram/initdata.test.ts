import assert from "node:assert/strict";
import crypto from "node:crypto";
import { test, describe } from "node:test";
import { validateInitData } from "./initdata";

const BOT_TOKEN = "123456:test-token-for-signing";

/** Builds a correctly signed initData string, the way Telegram would. */
function signInitData(
  fields: Record<string, string>,
  token = BOT_TOKEN,
): string {
  const dataCheckString = Object.entries(fields)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secret = crypto.createHmac("sha256", "WebAppData").update(token).digest();
  const hash = crypto
    .createHmac("sha256", secret)
    .update(dataCheckString)
    .digest("hex");

  return new URLSearchParams({ ...fields, hash }).toString();
}

function nowSeconds(): string {
  return Math.floor(Date.now() / 1000).toString();
}

const USER = JSON.stringify({ id: 42, first_name: "Ada", username: "ada" });

describe("validateInitData", () => {
  test("accepts a freshly signed payload", () => {
    const initData = signInitData({ auth_date: nowSeconds(), user: USER });
    const result = validateInitData(initData, BOT_TOKEN);

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.user.id, 42);
    assert.equal(result.user.username, "ada");
  });

  // The acceptance criterion: forged initData is rejected.
  test("rejects a tampered user id", () => {
    const initData = signInitData({ auth_date: nowSeconds(), user: USER });
    const forged = initData.replace(
      encodeURIComponent(USER),
      encodeURIComponent(JSON.stringify({ id: 999, first_name: "Mallory" })),
    );

    const result = validateInitData(forged, BOT_TOKEN);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.reason, "bad_hash");
  });

  test("rejects a payload signed with a different bot token", () => {
    const initData = signInitData(
      { auth_date: nowSeconds(), user: USER },
      "999:someone-elses-token",
    );
    const result = validateInitData(initData, BOT_TOKEN);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.reason, "bad_hash");
  });

  test("rejects an invented hash", () => {
    const initData = new URLSearchParams({
      auth_date: nowSeconds(),
      user: USER,
      hash: "00".repeat(32),
    }).toString();

    const result = validateInitData(initData, BOT_TOKEN);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.reason, "bad_hash");
  });

  // A valid signature would otherwise be replayable forever.
  test("rejects a correctly signed but stale payload", () => {
    const stale = (Math.floor(Date.now() / 1000) - 6 * 60).toString();
    const initData = signInitData({ auth_date: stale, user: USER });

    const result = validateInitData(initData, BOT_TOKEN);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.reason, "expired");
  });

  test("rejects a payload dated in the future", () => {
    const future = (Math.floor(Date.now() / 1000) + 10 * 60).toString();
    const initData = signInitData({ auth_date: future, user: USER });

    const result = validateInitData(initData, BOT_TOKEN);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.reason, "expired");
  });

  test("rejects a missing hash", () => {
    const initData = new URLSearchParams({
      auth_date: nowSeconds(),
      user: USER,
    }).toString();
    const result = validateInitData(initData, BOT_TOKEN);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.reason, "malformed");
  });

  test("rejects empty input", () => {
    const result = validateInitData("", BOT_TOKEN);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.reason, "missing");
  });

  test("rejects a signed payload carrying no user", () => {
    const initData = signInitData({ auth_date: nowSeconds() });
    const result = validateInitData(initData, BOT_TOKEN);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.reason, "malformed");
  });

  test("signature covers every field, not just the user", () => {
    const initData = signInitData({
      auth_date: nowSeconds(),
      user: USER,
      query_id: "abc",
    });
    const forged = initData.replace("query_id=abc", "query_id=xyz");

    const result = validateInitData(forged, BOT_TOKEN);
    assert.equal(result.ok, false);
  });
});
