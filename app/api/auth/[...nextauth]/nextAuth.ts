// /app/api/auth/nextAuth.ts
import NextAuth, { type NextAuthOptions, type DefaultSession } from "next-auth";
import { getServerSession } from "next-auth/next";
import type { NextApiRequest, NextApiResponse } from "next";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcrypt";
import { ROLES, type Role } from "@/lib/roles";

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
   NextAuth Configuration
====================================================== */
export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),

  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  providers: [
    /* ---------- Google OAuth ---------- */
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),

    /* ---------- Credentials ---------- */
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },

      async authorize(credentials) {

        if (!credentials?.email || !credentials?.password) return null;

        const email = credentials.email.toLowerCase().trim();

        const user = await prisma.user.findUnique({
          where: { email },
        });

        if (!user || !user.passwordHash) {
          throw new Error("Invalid credentials");
        }

        if (!user) {
          return null;
        }

        if (!user.passwordHash) {
          return null;
        }

        if (!user.isActive) {
          return null
        }

        const isValid = await bcrypt.compare(
          credentials.password,
          user.passwordHash
        );
        
        if (!isValid) {
          return null
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role as Role,
          isActive: user.isActive,
        };
      },
    }),
  ],

  callbacks: {
    /* ---------- JWT ---------- */
    async jwt({ token, user, trigger }) {
      // Initial sign-in
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.isActive = user.isActive;
      }

      // 🔒 Never trust client session.update() for auth state
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

    /* ---------- Session ---------- */
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.isActive = token.isActive;
      }
      return session;
    },

    /* ---------- Sign In ---------- */
    async signIn({ user, account }) {
      if (!user.isActive) return false;

      // Normalize email + default role for OAuth users
      if (account?.provider === "google") {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            email: user.email?.toLowerCase(),
            role: ROLES.USER,
            isActive: true,
            lastLoginAt: new Date(),
          },
        });
      } else {
        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });
      }

      return true;
    },
  },

  pages: {
    // signIn: "/auth/signin",
    // signOut: "/auth/signout",
    // error: "/auth/error",
  },

  // debug: process.env.NODE_ENV === "development",
};

// ✅ Export authOptions for use in route handler
export { authOptions };

// ✅ Create and export the NextAuth handler
const handler = NextAuth(authOptions);
export default handler;

/* ======================================================
   Session Helpers
====================================================== */

// ✅ App Router / server components
export function getAuthSession() {
  return getServerSession(authOptions);
}

// ✅ Pages Router / API routes
export function getApiAuthSession(
  req: NextApiRequest,
  res: NextApiResponse
) {
  return getServerSession(req, res, authOptions);
}

/* ======================================================
   RBAC Helpers
====================================================== */

/**
 * Enforces authentication + role access for API routes
 */
export async function requireRole(
  req: NextApiRequest,
  res: NextApiResponse,
  allowedRoles?: readonly Role[]
) {
  const session = await getApiAuthSession(req, res);

  if (!session?.user) {
    res.status(401).json({
      success: false,
      message: "Unauthorized",
    });
    return null;
  }

  if (!session.user.isActive) {
    res.status(403).json({
      success: false,
      message: "Account disabled",
    });
    return null;
  }

  if (
    allowedRoles?.length &&
    !allowedRoles.includes(session.user.role)
  ) {
    res.status(403).json({
      success: false,
      message: "Insufficient permissions",
    });
    return null;
  }

  return session.user;
}

/**
 * Requires authentication only (no role check)
 */
export async function requireAuth(
  req: NextApiRequest,
  res: NextApiResponse
) {
  return requireRole(req, res);
}