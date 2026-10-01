import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const authOptions: NextAuthOptions = {
  // Sessions are JWTs. Left at the default they last 30 days, which means a
  // staff member who leaves -- or one you deactivate -- keeps working access for
  // up to a month. 12 hours covers even a long shift, and updateAge keeps the
  // clock sliding while they are actually working, so nobody is signed out
  // mid-shift. This is the second line of defence; the re-check in the session
  // callback below is the first.
  session: { strategy: "jwt", maxAge: 12 * 60 * 60, updateAge: 60 * 60 },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });
        if (!user || !user.isActive) return null;

        const valid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!valid) return null;

        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as any).id;
        token.role = (user as any).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (!session.user) return session;

      // Re-check the account against the database every time a session is read.
      //
      // A JWT carries whatever it was issued with, so without this a staff
      // member who has been deactivated (or demoted) keeps their old access
      // until the token expires. Because this runs on every getServerSession()
      // call, deactivating someone takes effect on their very next request --
      // not in 30 days.
      //
      // Returning null here ends the session: getServerSession() yields null, so
      // every `if (!session)` check in the app treats them as signed out, and the
      // browser sees an unauthenticated session too.
      // A token carrying no user id cannot belong to a real account.
      if (!token.id) return null as unknown as typeof session;

      try {
        const user = await prisma.user.findUnique({
          where: { id: token.id },
          select: { isActive: true, role: true },
        });

        if (!user || !user.isActive) {
          return null as unknown as typeof session;
        }

        // Use the role from the database, so a role change takes effect on the
        // next request instead of at the next sign-in.
        session.user.id = token.id;
        session.user.role = user.role;
      } catch {
        // Temporary database problem: fall back to the token's own values rather
        // than signing the whole hotel out. Every route still requires a valid,
        // signed session, and the route's own queries will surface the outage.
        session.user.id = token.id;
        session.user.role = token.role;
      }

      return session;
    },
  },
};
