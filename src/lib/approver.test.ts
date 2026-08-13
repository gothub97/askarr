import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { parseApprover, telegramApprover, webApprover } from "./requests";

/**
 * Subscription.approvedById is a bare String with no relation, and it receives
 * ids from two disjoint tables. These tests pin the tagging that keeps a
 * TelegramUser.id from being read back as a User.id.
 */
describe("approver tagging", () => {
  test("a Telegram approval round-trips", () => {
    const stored = telegramApprover("ckq1abc");
    assert.equal(stored, "tg:ckq1abc");
    assert.deepEqual(parseApprover(stored), {
      source: "telegram",
      id: "ckq1abc",
    });
  });

  test("a web approval round-trips", () => {
    const stored = webApprover("user_42");
    assert.equal(stored, "web:user_42");
    assert.deepEqual(parseApprover(stored), { source: "web", id: "user_42" });
  });

  test("the two spaces stay distinguishable for the same raw id", () => {
    const fromTelegram = parseApprover(telegramApprover("same-id"));
    const fromWeb = parseApprover(webApprover("same-id"));

    assert.equal(fromTelegram?.id, fromWeb?.id);
    assert.notEqual(fromTelegram?.source, fromWeb?.source);
  });

  test("an unapproved request has no approver", () => {
    assert.equal(parseApprover(null), null);
    assert.equal(parseApprover(""), null);
  });

  // A cuid never contains a colon, so an untagged value can only predate the
  // tagging. Reading it as a web id matches where approvals came from then.
  test("an untagged legacy value is read as a web id", () => {
    assert.deepEqual(parseApprover("plain-user-id"), {
      source: "web",
      id: "plain-user-id",
    });
  });

  test("an id containing a colon survives the round trip", () => {
    const stored = webApprover("odd:id:value");
    assert.deepEqual(parseApprover(stored), {
      source: "web",
      id: "odd:id:value",
    });
  });
});
