import "../src/styles/globals.css";
import "../src/styles/app.css";
import MiniKitProvider from "../components/MiniKitProvider";
export default function App({ Component, pageProps }) {
  return (
    <MiniKitProvider>
      <Component {...pageProps} />
    </MiniKitProvider>
  );
}
