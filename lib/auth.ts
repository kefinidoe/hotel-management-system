import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

if (process.env.NEXTAUTH_SECRET) {
  process.env.NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET
    .replace(/^NEXTAUTH_SECRET\s*=\s*/i, "")
    .replace(/^["']+|["']+$/g, "")
    .trim();
}

if (process.env.NEXTAUTH_URL) {
  process.env.NEXTAUTH_URL = process.env.NEXTAUTH_URL
    .replace(/^NEXTAUTH_URL\s*=\s*/i, "")
    .replace(/^["']+|["']+$/g, "")
    .replace(/\/+$/, "")
    .trim();
}

export const authOptions: NextAuthOptions = {
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
        const cleanEmail = credentials.email.trim();
        const user = await prisma.user.findFirst({
          where: {
            email: { equals: cleanEmail, mode: "insensitive" },
          },
        });
        if (!user || !user.isActive) return null;
        const valid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!valid) return null;
        try {
          await prisma.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
          });
        } catch {
          // Do not block sign-in if lastLoginAt update fails on pooled connections
        }
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
      if (!token.id) return null as unknown as typeof session;

      try {
        const user = await prisma.user.findUnique({
          where: { id: token.id },
          select: { isActive: true, role: true },
        });
        if (!user || !user.isActive) {
          return null as unknown as typeof session;
        }
        session.user.id = token.id;
        session.user.role = user.role;
      } catch {
        session.user.id = token.id;
        session.user.role = token.role;
      }
      return session;
    },
  },
};
