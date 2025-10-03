import { useEffect } from "react";
import { MiniKit } from "@worldcoin/minikit-js";
export default function MiniKitProvider({ children }) {
  useEffect(() => { try { MiniKit.install(); } catch {} }, []);
  return children;
}
