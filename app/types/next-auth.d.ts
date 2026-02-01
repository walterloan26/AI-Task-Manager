import NextAuth, { DefaultSession } from "next-auth";
import type { Role } from "@/lib/roles";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      isActive: boolean; // <-- added
      image?: string;
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    role: Role;
    isActive: boolean; // <-- added
    image?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: Role;
    isActive: boolean; // <-- added
    image?: string;
  }
}
