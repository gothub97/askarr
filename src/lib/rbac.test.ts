import assert from "node:assert/strict";
import { test, describe } from "node:test";
import { MediaKind, TelegramRole } from "@prisma/client";
import { decideApproval } from "./rbac";
import type { QuotaState } from "./quota";

const withinQuota: QuotaState = {
  limit: 5,
  used: 1,
  remaining: 4,
  exceeded: false,
};
const overQuota: QuotaState = {
  limit: 5,
  used: 5,
  remaining: 0,
  exceeded: true,
};
const unlimited: QuotaState = {
  limit: 0,
  used: 0,
  remaining: Number.POSITIVE_INFINITY,
  exceeded: false,
};

describe("decideApproval", () => {
  test("GUEST always waits for approval", () => {
    const decision = decideApproval({
      role: TelegramRole.GUEST,
      kind: MediaKind.MOVIE,
      monitorMode: null,
      quota: withinQuota,
    });
    assert.equal(decision.approved, false);
    if (decision.approved) return;
    assert.equal(decision.reason, "role");
  });

  test("BLOCKED is never auto-approved", () => {
    const decision = decideApproval({
      role: TelegramRole.BLOCKED,
      kind: MediaKind.MOVIE,
      monitorMode: null,
      quota: unlimited,
    });
    assert.equal(decision.approved, false);
  });

  test("ADMIN is auto-approved, quota notwithstanding", () => {
    const decision = decideApproval({
      role: TelegramRole.ADMIN,
      kind: MediaKind.MOVIE,
      monitorMode: null,
      quota: overQuota,
    });
    assert.equal(decision.approved, true);
  });

  test("ADMIN is auto-approved even for a full series", () => {
    const decision = decideApproval({
      role: TelegramRole.ADMIN,
      kind: MediaKind.SERIES,
      monitorMode: "all",
      quota: overQuota,
    });
    assert.equal(decision.approved, true);
  });

  test("TRUSTED is auto-approved within quota", () => {
    const decision = decideApproval({
      role: TelegramRole.TRUSTED,
      kind: MediaKind.MOVIE,
      monitorMode: null,
      quota: withinQuota,
    });
    assert.equal(decision.approved, true);
  });

  test("TRUSTED falls back to approval once the quota is spent", () => {
    const decision = decideApproval({
      role: TelegramRole.TRUSTED,
      kind: MediaKind.MOVIE,
      monitorMode: null,
      quota: overQuota,
    });
    assert.equal(decision.approved, false);
    if (decision.approved) return;
    assert.equal(decision.reason, "quota");
  });

  test("TRUSTED may auto-approve a single season", () => {
    const decision = decideApproval({
      role: TelegramRole.TRUSTED,
      kind: MediaKind.SERIES,
      monitorMode: "lastSeason",
      quota: withinQuota,
    });
    assert.equal(decision.approved, true);
  });

  // A full series can trigger hundreds of grabs, so it is reviewed even for a
  // TRUSTED user sitting well inside their quota.
  test("TRUSTED never auto-approves a full series", () => {
    const decision = decideApproval({
      role: TelegramRole.TRUSTED,
      kind: MediaKind.SERIES,
      monitorMode: "all",
      quota: withinQuota,
    });
    assert.equal(decision.approved, false);
    if (decision.approved) return;
    assert.equal(decision.reason, "full_series");
  });

  test("an unlimited quota keeps TRUSTED auto-approved", () => {
    const decision = decideApproval({
      role: TelegramRole.TRUSTED,
      kind: MediaKind.MOVIE,
      monitorMode: null,
      quota: unlimited,
    });
    assert.equal(decision.approved, true);
  });
});
