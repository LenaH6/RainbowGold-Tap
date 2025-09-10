import { useSession } from "next-auth/react";

export default function Dashboard() {
  const { data: session } = useSession();
  return (
    <main style={{ padding: 24 }}>
      <h1>Dashboard protegido</h1>
      <pre>{JSON.stringify(session, null, 2)}</pre>
    </main>
  );
}
