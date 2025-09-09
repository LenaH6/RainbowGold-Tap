'use client';
import { signIn, signOut, useSession } from 'next-auth/react';

export default function LoginButton() {
  const { data: session, status } = useSession();
  if (status === 'loading') return <button disabled>Cargando…</button>;

  if (session) {
    return (
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <span>Hola, {session.user?.name ?? 'usuario'}</span>
        {/* si quieres, al salir también volvemos al juego */}
        <button onClick={() => signOut({ callbackUrl: '/' })}>Salir</button>
      </div>
    );
  }

  // 👇 aquí forzamos que, tras login, regrese al juego (/)
  return (
    <button onClick={() => signIn('worldcoin', { callbackUrl: '/' })}>
      Entrar con World ID
    </button>
  );
}
