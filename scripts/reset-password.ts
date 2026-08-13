/**
 * Reset a back-office password from the command line.
 *
 *   npx tsx scripts/reset-password.ts <email> [newPassword]
 *
 * Askarr has no "forgot password" flow — it has no mail server to send one
 * through, and adding an unauthenticated reset endpoint to a self-hosted app
 * that sits on someone's LAN is a worse trade than this. Without this script,
 * an operator who loses the only administrator password has no way back in
 * short of editing the database by hand.
 *
 * Runs against DATABASE_URL, so it must be run where the database is reachable
 * — on the host for a local install, or `docker compose exec web` otherwise.
 *
 * Hashing goes through better-auth's own `ctx.password.hash`, never a
 * hand-rolled scrypt: the format has to match what the sign-in path verifies,
 * and that is better-auth's business, not ours.
 */

import { randomBytes } from "node:crypto";
import { auth } from "../src/lib/auth";
import { prisma } from "../src/lib/prisma";

/** Readable, ~93 bits, no ambiguous glyphs. Comfortably over the 10-char floor. */
function generatePassword(): string {
  const alphabet = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(16);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

async function main(): Promise<void> {
  const [email, provided] = process.argv.slice(2);

  if (!email) {
    console.error("Usage: npx tsx scripts/reset-password.ts <email> [newPassword]");
    process.exitCode = 1;
    return;
  }

  const user = await prisma.user.findFirst({ where: { email } });
  if (!user) {
    const known = await prisma.user.findMany({ select: { email: true } });
    console.error(`No account for ${email}.`);
    if (known.length) {
      console.error(`Accounts on this database: ${known.map((u) => u.email).join(", ")}`);
    }
    process.exitCode = 1;
    return;
  }

  const ctx = await auth.$context;
  const minimum = ctx.options.emailAndPassword?.minPasswordLength ?? 8;
  const password = provided ?? generatePassword();

  if (password.length < minimum) {
    console.error(`That password is shorter than the ${minimum}-character minimum.`);
    process.exitCode = 1;
    return;
  }

  const hash = await ctx.password.hash(password);

  // updatePassword writes to the credential account, creating it if this user
  // only ever had a social login. Sessions are left alone deliberately: this
  // is a password reset, not a remote sign-out.
  await ctx.internalAdapter.updatePassword(user.id, hash);

  console.log(`\nPassword reset for ${email}`);
  if (!provided) console.log(`New password: ${password}`);
  console.log("\nChange it after signing in if you want one you chose yourself.\n");
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
