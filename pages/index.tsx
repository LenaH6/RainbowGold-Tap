import Head from "next/head";
import Link from "next/link";
import LoginButton from "@/components/LoginButton";

export default function Home() {
  return (
    <>
      <Head>
        <title>RainbowGold Tap (Next)</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <main style={{height: "100vh", margin: 0, padding: 0, display: "flex", flexDirection: "column"}}>
        <div style={{ padding: 12, display: "flex", justifyContent: "space-between", alignItems: "center", background: "#111", color: "#fff" }}>
          <strong>RainbowGold Tap</strong>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <Link href="/dashboard">Dashboard</Link>
            <LoginButton />
          </div>
        </div>
        <iframe
          src="/game/index.html"
          title="RainbowGold Tap"
          style={{border: "none", width: "100%", height: "100%"}}
        />
      </main>
    </>
  );
}
