'use client';
import { signIn, signOut, useSession } from "next-auth/react";

export default function LoginButton() {
  const { data: session, status } = useSession();
  if (status === "loading") return <button disabled>Cargando…</button>;

  if (session) {
    return (
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <span>Hola, {session.user?.name ?? "usuario"}</span>
        <button onClick={() => signOut()}>Salir</button>
      </div>
    );
  }
  return <button onClick={() => signIn("worldcoin")}>Entrar con World ID</button>;
}
