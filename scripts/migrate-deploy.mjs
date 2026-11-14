// Applies pending database migrations as part of a production build.
//
// The schema and the code that depends on it have to arrive together: a
// deployment whose queries name a column the database does not have yet
// fails on every page that runs them. Running `prisma migrate deploy`
// here, before `next build`, means a deployment can only go live against
// a database that matches it — and if the migration cannot be applied,
// the build fails and the previous deployment stays up.
//
// Only production builds do this. Preview deployments share the
// production database, and a branch that has not been merged must not be
// able to change it.

import { spawnSync } from "node:child_process";

const env = { ...process.env };

if (env.VERCEL && env.VERCEL_ENV !== "production") {
  console.log("migrate-deploy: not a production build, leaving the database alone.");
  process.exit(0);
}

if (!env.DIRECT_URL && !env.DATABASE_URL) {
  console.log("migrate-deploy: no database URL set, skipping.");
  process.exit(0);
}

// Migrate takes a session-level advisory lock, which a pooled connection
// (Neon's "-pooler" host) does not hold reliably. With only the pooled
// URL to go on, do without the lock rather than hang on it; one build
// migrating at a time is the normal case anyway.
if (!env.DIRECT_URL) env.PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK = "1";

function prisma(...args) {
  const result = spawnSync("npx", ["prisma", ...args], { env, encoding: "utf8" });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  process.stdout.write(output);
  return { ok: result.status === 0, output };
}

let attempt = prisma("migrate", "deploy");

// P3009: an earlier run left a migration marked as failed, and Prisma
// will apply nothing until that is cleared. The migrations in this
// project are written to be safe to run again, so the failed one is
// marked as rolled back and the deploy retried — once per migration, so
// one that keeps failing still stops the build.
const retried = new Set();
while (!attempt.ok && attempt.output.includes("P3009")) {
  const failed = /The `([^`]+)` migration started at/.exec(attempt.output)?.[1];
  if (!failed || retried.has(failed)) break;
  retried.add(failed);

  console.log(`migrate-deploy: clearing failed migration ${failed} and retrying.`);
  if (!prisma("migrate", "resolve", "--rolled-back", failed).ok) break;
  attempt = prisma("migrate", "deploy");
}

if (!attempt.ok) {
  console.error("migrate-deploy: migrations could not be applied; stopping the build.");
  process.exit(1);
}
