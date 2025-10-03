// pages/privacidad.js
export default function Privacidad() {
  const fecha = new Date().toISOString().slice(0, 10);
  return (
    <main
      style={{
        maxWidth: 780,
        margin: "40px auto",
        padding: "0 16px",
        lineHeight: 1.55,
        fontFamily:
          "system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Helvetica,Arial,sans-serif",
      }}
    >
      <h1 style={{ fontSize: "1.6rem", margin: "0 0 12px" }}>
        Política de Privacidad
      </h1>
      <small style={{ opacity: 0.7 }}>Última actualización: {fecha}</small>

      <h2 style={{ fontSize: "1.15rem", margin: "24px 0 8px" }}>
        1. Datos que tratamos
      </h2>
      <ul style={{ paddingLeft: 18 }}>
        <li>
          Datos técnicos mínimos para operar el juego (p. ej., contadores de
          taps, energía).
        </li>
        <li>
          Resultado de la verificación World ID (válida o no). No almacenamos
          información biométrica.
        </li>
      </ul>

      <h2 style={{ fontSize: "1.15rem", margin: "24px 0 8px" }}>2. Origen</h2>
      <p>
        Obtenemos datos a través de World App/MiniKit y de las interacciones del
        usuario en el juego.
      </p>

      <h2 style={{ fontSize: "1.15rem", margin: "24px 0 8px" }}>3. Finalidad</h2>
      <p>Prevenir trampas, mantener progreso y habilitar funciones (pagos opcionales).</p>

      <h2 style={{ fontSize: "1.15rem", margin: "24px 0 8px" }}>
        4. Conservación
      </h2>
      <p>
        Guardamos el estado de juego el tiempo necesario para ofrecer el
        servicio y cumplir requisitos legales.
      </p>

      <h2 style={{ fontSize: "1.15rem", margin: "24px 0 8px" }}>5. Terceros</h2>
      <p>
        World App/MiniKit procesa pagos y verificación. No vendemos datos
        personales.
      </p>

      <h2 style={{ fontSize: "1.15rem", margin: "24px 0 8px" }}>6. Seguridad</h2>
      <p>
        Aplicamos medidas técnicas (verificación de tokens, servidor
        autoritativo). Ningún sistema es 100% seguro.
      </p>

      <h2 style={{ fontSize: "1.15rem", margin: "24px 0 8px" }}>
        7. Tus derechos
      </h2>
      <p>
        Puedes solicitarnos información o eliminación del estado asociado a tu
        sesión, sujeto a límites técnicos/legales.
      </p>

      <h2 style={{ fontSize: "1.15rem", margin: "24px 0 8px" }}>8. Contacto</h2>
      <p>
        <a href="mailto:rainbowgoldissues@gmail.com">
          rainbowgoldissues@gmail.com
        </a>
      </p>
    </main>
  );
}
