// MiniKitProvider.js
"use client";
import { useEffect, useRef } from "react";
import { MiniKit } from "@worldcoin/minikit-js";

export default function MiniKitProvider({ children }) {
  const readyRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function setup() {
      if (typeof window === "undefined") return;

      try {
        // 1) Si World App ya inyectó MiniKit, no hagas nada
        if (window.MiniKit?.isInstalled?.()) {
          readyRef.current = true;
          return;
        }

        // 2) Solo si NO está inyectado, intenta instalar el SDK (fallback)
        await MiniKit.install();
        if (!cancelled) readyRef.current = true;
      } catch (e) {
        // No bloquear la app si falla
        console.warn("MiniKit install skipped:", e);
      }
    }

    setup();
    return () => { cancelled = true; };
  }, []);

  return children;
}
