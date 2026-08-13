/**
 * The gate on tests that write to a real database.
 *
 * These suites delete rows — instances, Telegram users, the saved bot token —
 * so pointing them at a working install destroys live data. That is not
 * hypothetical: run against a dev database, they wiped a bot token that had
 * been entered through the back office, and it was not recoverable.
 *
 * Two conditions, because either alone has a failure mode. The flag alone
 * would still hit a live database if DATABASE_URL is exported in the shell,
 * since `--env-file` does not override what is already set. The name check
 * alone would fire on a plain `npm test`.
 */

function databaseName(url: string | undefined): string {
  if (!url) return "";
  // Last path segment, minus any query string. Parsing loosely on purpose: a
  // malformed URL should read as "not obviously a test database".
  return url.split("?")[0]?.split("/").pop()?.toLowerCase() ?? "";
}

const flagSet = process.env.ASKARR_TEST_DB === "1";
const name = databaseName(process.env.DATABASE_URL);
const namedForTests = name.includes("test");

export const DB_TESTS_ENABLED = flagSet && namedForTests;

function reason(): string {
  if (!flagSet) return "needs a throwaway database — run `npm run test:db`";
  return `refusing to run: DATABASE_URL points at "${name || "nothing"}", which is not named as a test database`;
}

export const DB_TEST_SKIP = {
  skip: DB_TESTS_ENABLED ? false : reason(),
} as const;

// Loud, because the flag being set means someone *expected* these to run.
if (flagSet && !namedForTests) {
  console.error(`[askarr] ${reason()}`);
}
