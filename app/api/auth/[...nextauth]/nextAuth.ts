// /app/api/auth/nextAuth.ts
import NextAuth, { type NextAuthOptions, type DefaultSession } from "next-auth";
import { getServerSession } from "next-auth/next";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { ROLES, type Role } from "@/lib/roles";
import { headers } from "next/headers";
import { ratelimit } from "@/lib/rateLimit";
import type { NextApiRequest, NextApiResponse } from "next";

/* ======================================================
   Type Augmentation
====================================================== */
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      isActive: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    role: Role;
    isActive: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: Role;
    isActive: boolean;
  }
}

/* ======================================================
   NextAuth Options
====================================================== */
export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma, { linkAccountByEmail: true }),

  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: { params: { scope: "openid email profile", prompt: "consent" } },
    }),
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const email = credentials.email.toLowerCase().trim();

        const h = await headers();
        const ip =
          h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
          h.get("x-real-ip") ??
          "unknown";

        const { success } = await ratelimit.limit(`login:${ip}:${email}`);
        if (!success) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !user.passwordHash || !user.isActive) return null;
        if (user.lockedUntil && user.lockedUntil > new Date()) return null;

        const isValid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!isValid) {
          await prisma.user.update({
            where: { id: user.id },
            data: {
              failedLoginAttempts: user.failedLoginAttempts + 1,
              lockedUntil: user.failedLoginAttempts + 1 >= 5
                ? new Date(Date.now() + 15 * 60 * 1000)
                : null,
            },
          });
          return null;
        }

        await prisma.user.update({
          where: { id: user.id },
          data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role,
          isActive: user.isActive,
        };
      },
    }),
  ],

  callbacks: {
    // Redirect after login/signout
    async redirect({ url, baseUrl }) {
      return url.startsWith(baseUrl) ? url : baseUrl + "/dashboard";
    },

    // JWT callback
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.isActive = user.isActive;
      }
      if (trigger === "update" && token.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id },
          select: { role: true, isActive: true },
        });
        if (dbUser) {
          token.role = dbUser.role as Role;
          token.isActive = dbUser.isActive;
        }
      }
      return token;
    },

    // Session callback
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id!;
        session.user.role = token.role!;
        session.user.isActive = token.isActive!;
      }
      return session;
    },

    // Unified sign-in for Google + Credentials
    async signIn({ user, account, credentials }) {
      // Google OAuth
      if (account?.provider === "google") {
        const dbUser = await prisma.user.upsert({
          where: { email: user.email!.toLowerCase() },
          update: { lastLoginAt: new Date(), name: user.name },
          create: {
            email: user.email!.toLowerCase(),
            name: user.name,
            role: ROLES.USER,
            isActive: true,
            lastLoginAt: new Date(),
          },
        });

        if (!dbUser.isActive) return false;

        // Ensure the Account record exists for OAuth
        await prisma.account.upsert({
          where: {
            provider_providerAccountId: {
              provider: "google",
              providerAccountId: account.providerAccountId!,
            },
          },
          update: {},
          create: {
            userId: dbUser.id,
            provider: "google",
            providerAccountId: account.providerAccountId!,
            type: "oauth",
            access_token: account.access_token,
            refresh_token: account.refresh_token,
            expires_at: account.expires_at,
            token_type: account.token_type,
            scope: account.scope,
            id_token: account.id_token,
          },
        });

        return true;
      }

      // Credentials provider
      if (account?.provider === "credentials" && credentials) {
        const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
        if (!dbUser?.isActive) return false;

        await prisma.user.update({
          where: { id: dbUser.id },
          data: { lastLoginAt: new Date() },
        });

        return true;
      }

      return false;
    },
  },

  pages: {
    signIn: "/login",
  },
};

/* ======================================================
   Export NextAuth
====================================================== */
export { authOptions };
export default NextAuth(authOptions);

/* ======================================================
   Session Helpers
====================================================== */
export function getAuthSession() {
  return getServerSession(authOptions);
}

export function getApiAuthSession(req: NextApiRequest, res: NextApiResponse) {
  return getServerSession(req, res, authOptions);
}

/* ======================================================
   RBAC Helpers
====================================================== */
export async function requireRole(
  req: NextApiRequest,
  res: NextApiResponse,
  allowedRoles?: readonly Role[]
) {
  const session = await getApiAuthSession(req, res);
  if (!session?.user) return res.status(401).json({ success: false, message: "Unauthorized" }) && null;
  if (!session.user.isActive) return res.status(403).json({ success: false, message: "Account disabled" }) && null;
  if (allowedRoles?.length && !allowedRoles.includes(session.user.role))
    return res.status(403).json({ success: false, message: "Insufficient permissions" }) && null;
  return session.user;
}

export async function requireAuth(req: NextApiRequest, res: NextApiResponse) {
  return requireRole(req, res);
}
