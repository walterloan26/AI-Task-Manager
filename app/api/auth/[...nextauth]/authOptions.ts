import { type NextAuthOptions, type DefaultSession } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { ROLES, type Role } from "@/lib/roles";
import { getServerSession } from "next-auth/next";
import { rateLimitLoginAttempt } from "@/lib/appRateLimit";
import { ACTIVITY_TYPES } from "@/lib/activityTypes";

/* ======================================================
   Type Augmentation
====================================================== */
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      isActive: boolean;
      image?: string;
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    role: Role;
    isActive: boolean;
    image?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: Role;
    isActive: boolean;
    image?: string;
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
      authorization: {
        params: {
          scope: "openid email profile",
          prompt: "consent",
        },
      },
      profile(profile) {
        return {
          id: profile.sub,
          name: profile.name,
          email: profile.email,
          image: profile.picture,
        };
      },
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

        // Rate limiting
        const allowed = await rateLimitLoginAttempt(email);
        if (!allowed) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !user.passwordHash || !user.isActive) return null;
        if (user.lockedUntil && user.lockedUntil > new Date()) return null;

        const valid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!valid) {
          await prisma.user.update({
            where: { id: user.id },
            data: {
              failedLoginAttempts: user.failedLoginAttempts + 1,
              lockedUntil:
                user.failedLoginAttempts + 1 >= 5
                  ? new Date(Date.now() + 15 * 60 * 1000)
                  : null,
            },
          });
          return null;
        }

        // Reset failed attempts and last login
        await prisma.user.update({
          where: { id: user.id },
          data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
        });

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
          role: user.role,
          isActive: user.isActive,
        };
      },
    }),
  ],

  callbacks: {
    /* ======================================================
       JWT callback
       - On first sign-in, set token from user
       - On update trigger, refresh token from DB
    ====================================================== */
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.isActive = user.isActive;
        token.image = user.image;
      }

      if (trigger === "update" && token.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id },
          select: { role: true, isActive: true, image: true },
        });
        if (dbUser) {
          token.role = dbUser.role as Role;
          token.isActive = dbUser.isActive;
          token.image = dbUser.image;
        }
      }

      return token;
    },

    /* ======================================================
       Session callback
       - Populate session.user from token
    ====================================================== */
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id!;
        session.user.role = token.role!;
        session.user.isActive = token.isActive!;
        session.user.image = token.image!;
      }
      return session;
    },

    /* ======================================================
       SignIn callback
       - Handles both Google and Credentials login
       - Upserts Google users
       - Logs activity if last login > 1 min
    ====================================================== */
    async signIn({ user, account, profile }) {
  console.log('🔥 SIGNIN TRIGGERED - Stack trace:');
  console.log(new Error().stack);
  console.log('User:', user.email);
  console.log('Provider:', account?.provider);
  console.log('Time:', new Date().toISOString());
  console.log('---');
  
  // -------- GOOGLE LOGIN --------
  if (account?.provider === "google") {
    try {
      const dbUser = await prisma.user.findUnique({
        where: { email: user.email!.toLowerCase() },
      });
      
      if (!dbUser || !dbUser.isActive) return false;

      // Update last login
      await prisma.user.update({
        where: { id: dbUser.id },
        data: { 
          lastLoginAt: new Date(),
          name: user.name,
          image: profile?.picture || user.image,
        },
      });

      // ✅ Log activity for EVERY login (remove 1-minute check)
      try {
        await prisma.Activity.create({
          data: { type: ACTIVITY_TYPES.LOGIN, actorId: dbUser.id },
        });
        console.log(`✅ Logged activity for ${dbUser.email}`);
      } catch (err) {
        console.error("Failed to log Google login activity", err);
      }

      return true;
    } catch (error) {
      console.error("Google signIn error:", error);
      return false;
    }
  }

  // -------- CREDENTIALS LOGIN --------
  if (account?.provider === "credentials") {
    try {
      const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
      if (!dbUser?.isActive) return false;

      // Update last login
      await prisma.user.update({
        where: { id: dbUser.id },
        data: { lastLoginAt: new Date() },
      });

      // ✅ Log activity for EVERY login (remove 1-minute check)
      try {
        await prisma.Activity.create({
          data: { type: ACTIVITY_TYPES.LOGIN, actorId: dbUser.id },
        });
        console.log(`✅ Logged activity for ${dbUser.email}`);
      } catch (err) {
        console.error("Failed to log Credentials login activity", err);
      }

      return true;
    } catch (error) {
      console.error("Credentials signIn error:", error);
      return false;
    }
  }

  return false;
},

    // Redirect after login
    async redirect({ url, baseUrl }) {
      return url.startsWith(baseUrl) ? url : baseUrl + "/dashboard";
    },
  },

  pages: {
    signIn: "/login",
  },
};

/* ======================================================
   Session Helper
====================================================== */
export function getAuthSession() {
  return getServerSession(authOptions);
}
