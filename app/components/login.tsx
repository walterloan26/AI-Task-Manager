import { signIn, signOut, useSession } from "next-auth/react";

export default function Login() {
  const { data: session, status } = useSession();

  if (session) {
    return (
      <div>
        <p>Welcome, {session.user?.name}</p>
        <p>Role: {session.user?.role}</p>
        <button onClick={() => signOut()}>Logout</button>
      </div>
    );
  }
  if (status === "loading") {
    return <p>Loading...</p>
  }

  return (
    <div>
      <button onClick={() => signIn("google")}>Sign in with Google</button>

      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const email = (e.currentTarget.email as HTMLInputElement).value;
          const password = (e.currentTarget.password as HTMLInputElement).value;
          const res = await signIn("credentials", {
            email,
            password,
            redirect: false,
          })
          if (res?.error) {
            alert("Invalid credentials")
          }
          if (!email || !password) return;
        }}
      >
        <input name="email" type="email" placeholder="Email" />
        <input name="password" type="password" placeholder="Password" />
        <button type="submit">Login</button>
      </form>
    </div>
  );
}
