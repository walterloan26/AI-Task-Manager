// Use the default export (handler) directly
import auth from "@/app/api/auth/[...nextauth]/nextAuth";

export { auth as GET, auth as POST };