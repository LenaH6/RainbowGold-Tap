import Head from "next/head";
import Script from "next/script";

const MARKUP = `...TU HTML DEL SPLASH Y EL JUEGO...`;

export default function Home() {
  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
        <meta name="theme-color" content="#1b103a" />
        <title>RainbowGold Tap</title>
      </Head>

      <main dangerouslySetInnerHTML={{ __html: MARKUP }} />

      {/* CARGA DE SCRIPTS ESTÁTICOS DESDE /public */}
      <Script src="/js/app-legacy.js" strategy="afterInteractive" />
      <Script src="/js/mk-hooks.js"  strategy="afterInteractive" />
      {/* OJO: no cargues /js/main.js si no existe */}
    </>
  );
}
