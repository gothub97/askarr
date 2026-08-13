import assert from "node:assert/strict";
import { test, describe } from "node:test";
import { joinArrUrl } from "./client";

describe("joinArrUrl", () => {
  test("joins onto a bare host", () => {
    assert.equal(
      joinArrUrl("https://10.0.0.5:7878", "/api/v3/system/status"),
      "https://10.0.0.5:7878/api/v3/system/status",
    );
  });

  // The acceptance criterion: an instance behind a reverse-proxy prefix works.
  // `new URL("/api/v3/x", base)` would silently drop "/admin/radarr".
  test("preserves a path prefix", () => {
    assert.equal(
      joinArrUrl("https://10.0.0.5/admin/radarr", "/api/v3/movie/lookup"),
      "https://10.0.0.5/admin/radarr/api/v3/movie/lookup",
    );
  });

  test("does not double slashes when the base has a trailing one", () => {
    assert.equal(
      joinArrUrl("https://host/radarr/", "/api/v3/rootfolder"),
      "https://host/radarr/api/v3/rootfolder",
    );
  });

  test("handles a path argument with no leading slash", () => {
    assert.equal(
      joinArrUrl("https://host/radarr", "api/v3/rootfolder"),
      "https://host/radarr/api/v3/rootfolder",
    );
  });

  test("preserves a deep prefix", () => {
    assert.equal(
      joinArrUrl("https://host/a/b/c", "/api/v3/movie"),
      "https://host/a/b/c/api/v3/movie",
    );
  });

  test("appends query parameters and skips undefined ones", () => {
    const url = new URL(
      joinArrUrl("https://host/radarr", "/api/v3/movie/lookup", {
        term: "dune",
        deleteFiles: false,
        missing: undefined,
      }),
    );
    assert.equal(url.pathname, "/radarr/api/v3/movie/lookup");
    assert.equal(url.searchParams.get("term"), "dune");
    assert.equal(url.searchParams.get("deleteFiles"), "false");
    assert.equal(url.searchParams.has("missing"), false);
  });

  test("escapes a term with spaces and specials", () => {
    const url = new URL(
      joinArrUrl("https://host", "/api/v3/movie/lookup", {
        term: "the lord & the rings",
      }),
    );
    assert.equal(url.searchParams.get("term"), "the lord & the rings");
  });

  test("rejects a base URL that is not a URL", () => {
    assert.throws(() => joinArrUrl("not a url", "/api/v3/x"));
  });
});
