// Set a staff member's password from the command line.
//
// This is the break-glass path: for when nobody can sign in, or when you want to
// rotate the admin password on a live deployment without opening the UI.
//
//   npm run reset-password -- admin@hotel.com                # generates a strong one
//   npm run reset-password -- admin@hotel.com 'MyNewPw!'     # sets one you choose
//   npm run reset-password -- --list                         # list accounts
//
// It only ever writes a bcrypt hash -- never a plaintext password -- and it tells
// you what it did. It runs against whatever DATABASE_URL points at, so be sure
// that's the database you mean to change.

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { generatePassword, passwordProblem } from "../lib/password";

const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    console.log(`
Usage:
  npm run reset-password -- <email> [newPassword]
  npm run reset-password -- --list

  <email>        the account to change
  [newPassword]  optional. Omit it and a strong random password is generated
                 and printed once.
  --list         show every account (name, email, role, active)
`);
    return;
  }

  if (args[0] === "--list") {
    const users = await prisma.user.findMany({
      select: { name: true, email: true, role: true, isActive: true, lastLoginAt: true },
      orderBy: { name: "asc" },
    });
    if (users.length === 0) {
      console.log("No accounts yet. Run `npm run seed` or create one in the app.");
      return;
    }
    console.log("");
    for (const u of users) {
      const status = u.isActive ? "active  " : "INACTIVE";
      const last = u.lastLoginAt ? u.lastLoginAt.toISOString().slice(0, 10) : "never";
      console.log(
        `  ${status}  ${u.role.padEnd(12)}  ${u.email.padEnd(28)}  ${u.name}  (last login: ${last})`
      );
    }
    console.log("");
    return;
  }

  const email = args[0];
  const provided = args[1];

  if (provided !== undefined) {
    const problem = passwordProblem(provided);
    if (problem) {
      console.error(`\n  ${problem}\n`);
      process.exitCode = 1;
      return;
    }
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`\n  No account found with email "${email}".`);
    console.error(`  Run:  npm run reset-password -- --list\n`);
    process.exitCode = 1;
    return;
  }

  const password = provided ?? generatePassword();

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(password, 10) },
  });

  console.log("");
  console.log(`  Password updated for ${user.name} <${user.email}> (${user.role})`);
  if (provided === undefined) {
    console.log("");
    console.log(`    ${password}`);
    console.log("");
    console.log("  Shown once. Sign in with it, then change it in the app.");
  }
  console.log("");
  console.log("  Note: sessions that are already open stay valid until they expire.");
  console.log("  Anyone currently signed in as this account is not logged out by this.");
  console.log("");
}

main()
  .catch((err) => {
    console.error("\n  Could not reset the password:", err instanceof Error ? err.message : err, "\n");
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
