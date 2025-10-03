// pages/_app.js
import '../src/styles/app.css';
import '../src/styles/globals.css';
import dynamic from 'next/dynamic';

const SafeMiniKitProvider = dynamic(() => import('../MiniKitProvider'), { ssr: false });

export default function App({ Component, pageProps }) {
  return (
    <SafeMiniKitProvider>
      <Component {...pageProps} />
    </SafeMiniKitProvider>
  );
}
