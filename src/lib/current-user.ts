import { prisma } from "@/lib/prisma";

// TEMPORARY. Returns a single fixed user so the app can be built and
// tested before authentication exists. Replace the body of this
// function with a real session lookup when Auth.js goes in — every
// caller already treats it as "who is logged in", so nothing else
// should need to change.

const DEMO_EMAIL = "demo@pethealth.local";

export async function getCurrentUser() {
  return prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: {},
    create: { email: DEMO_EMAIL, name: "Demo User" },
  });
}
