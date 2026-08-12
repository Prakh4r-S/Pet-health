import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  // The adapter writes users, accounts and sessions to Postgres. With an
  // adapter present, Auth.js defaults to database sessions: each request
  // costs one query, but a session can be revoked server-side at any time.
  // JWT sessions avoid that query but cannot be invalidated before expiry.
  adapter: PrismaAdapter(prisma),
  providers: [Google],
  pages: {
    signIn: "/signin",
  },
  callbacks: {
    // The default session object omits the user id, which every ownership
    // check in this app depends on. Copy it across.
    session({ session, user }) {
      if (session.user) session.user.id = user.id;
      return session;
    },
  },
});
