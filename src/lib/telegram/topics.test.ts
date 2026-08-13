import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { crossesTopic, topicFor } from "./topics";

const forum = {
  requestThreadId: 2,
  adminThreadId: 3,
  generalThreadId: 4,
};

const plainGroup = {
  requestThreadId: null,
  adminThreadId: null,
  generalThreadId: null,
};

describe("forum topic routing", () => {
  test("each purpose reads its own topic", () => {
    assert.equal(topicFor(forum, "request"), 2);
    assert.equal(topicFor(forum, "admin"), 3);
    assert.equal(topicFor(forum, "general"), 4);
  });

  test("a plain group has no topics, so every purpose is the main thread", () => {
    for (const purpose of ["request", "admin", "general"] as const) {
      assert.equal(topicFor(plainGroup, purpose), null);
    }
  });

  test("a forum that only set the requests topic leaves the rest unset", () => {
    const partial = { ...plainGroup, requestThreadId: 7 };
    assert.equal(topicFor(partial, "request"), 7);
    // Callers fall back to the conversation's own topic for these.
    assert.equal(topicFor(partial, "admin"), null);
    assert.equal(topicFor(partial, "general"), null);
  });
});

/**
 * Telegram rejects a reply pointing into a different topic, so this decides
 * between replying to the original message and mentioning the person instead.
 */
describe("crossesTopic", () => {
  test("announcing in #general crosses out of #request", () => {
    assert.equal(crossesTopic(2, 4), true);
  });

  test("staying in the same topic does not cross", () => {
    assert.equal(crossesTopic(2, 2), false);
  });

  test("a plain group never crosses, so replies keep working", () => {
    assert.equal(crossesTopic(null, null), false);
  });

  test("leaving the main thread for a topic counts as crossing", () => {
    assert.equal(crossesTopic(null, 4), true);
    assert.equal(crossesTopic(4, null), true);
  });
});
