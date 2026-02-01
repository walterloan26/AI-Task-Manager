import NextAuth from "next-auth";
import { authOptions, getAuthSession } from "./authOptions";

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
export { getAuthSession };