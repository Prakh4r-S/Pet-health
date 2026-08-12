import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
 
const connectionString = process.env.DATABASE_URL;
 
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}
 
// Prisma 7 requires an explicit driver adapter — the client no longer
// opens its own connection from a URL in the schema.
const adapter = new PrismaPg({ connectionString });
 
// Next.js re-evaluates modules on every hot reload in development. Without
// this guard a fresh PrismaClient is constructed on each edit, and the pool
// of connections to Neon is exhausted within a few minutes of working.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
 
export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });
 
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
 