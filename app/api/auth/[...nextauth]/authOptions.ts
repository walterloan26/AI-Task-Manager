import { type NextAuthOptions, type DefaultSession } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { ROLES, type Role } from "@/lib/roles";
import { getServerSession } from "next-auth/next";

/* ======================================================
   Type Augmentation - FIXED
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
    maxAge: 30 * 24 * 60 * 60,
  },

  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: { 
        params: { 
          scope: "openid email profile",
          prompt: "consent" 
        } 
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
          data: { 
            failedLoginAttempts: 0, 
            lockedUntil: null, 
            lastLoginAt: new Date() 
          },
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
    async jwt({ token, user, account, profile, trigger }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.isActive = user.isActive;
        token.image = user.image;
      }
      
      if (account?.provider === "google" && profile?.picture) {
        token.image = profile.picture;
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

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id!;
        session.user.role = token.role!;
        session.user.isActive = token.isActive!;
        session.user.image = token.image as string;
      }
      return session;
    },

    async signIn({ user, account, profile }) {
      if (account?.provider === "google") {
        const dbUser = await prisma.user.upsert({
          where: { email: user.email!.toLowerCase() },
          update: { 
            lastLoginAt: new Date(), 
            name: user.name,
            image: profile?.picture || user.image,
          },
          create: {
            email: user.email!.toLowerCase(),
            name: user.name,
            image: profile?.picture,
            role: ROLES.USER,
            isActive: true,
            lastLoginAt: new Date(),
          },
        });

        if (!dbUser.isActive) return false;

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

      if (account?.provider === "credentials") {
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