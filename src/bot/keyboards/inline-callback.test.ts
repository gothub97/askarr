import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  MAX_CALLBACK_BYTES,
  decodeCallback,
  encodeCallback,
} from "./callback";

/**
 * Inline results carry the title's identity in callback_data rather than a
 * draft id, because no draft exists until someone taps Request. These pin the
 * two things that would break silently: the byte budget, and the fact that a
 * handcrafted payload has to be rejected rather than guessed at.
 */
describe("inline request callback", () => {
  test("stays far inside the byte limit at the largest realistic id", () => {
    // tvdbIds and tmdbIds are 6-7 digits; 9 is well past anything real.
    const data = encodeCallback({ action: "i", id: "M999999999", arg: "" });
    assert.ok(
      Buffer.byteLength(data) < MAX_CALLBACK_BYTES,
      `${data} is ${Buffer.byteLength(data)} bytes`,
    );
  });

  test("a movie round-trips", () => {
    const data = encodeCallback({ action: "i", id: "M438631", arg: "" });
    const decoded = decodeCallback(data);

    assert.equal(decoded?.action, "i");
    assert.equal(decoded?.id, "M438631");
    assert.equal(decoded?.id.startsWith("M"), true);
    assert.equal(Number(decoded?.id.slice(1)), 438631);
  });

  test("a series round-trips and stays distinguishable from a movie", () => {
    const series = decodeCallback(
      encodeCallback({ action: "i", id: "S121361", arg: "" }),
    );
    const movie = decodeCallback(
      encodeCallback({ action: "i", id: "M121361", arg: "" }),
    );

    assert.notEqual(series?.id, movie?.id);
    assert.equal(series?.id.slice(1), movie?.id.slice(1));
  });

  test("a malformed payload decodes to null rather than a wrong request", () => {
    for (const bad of [
      "a:i:M438631",          // missing the arg segment
      "a:i:../../etc:",       // path-ish id
      "a:i:M438631:thirteenchars", // arg is capped at 12
      "a:i:M438631:has spaces",
      "hello",
      "",
    ]) {
      assert.equal(decodeCallback(bad), null, `${bad} should not decode`);
    }
  });
});
