// pages/terminos.js
export default function Terminos() {
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
        Términos y Condiciones
      </h1>
      <small style={{ opacity: 0.7 }}>Última actualización: {fecha}</small>

      <h2 style={{ fontSize: "1.15rem", margin: "24px 0 8px" }}>1. Descripción</h2>
      <p>
        <b>RainbowGold</b> es una miniapp “tap-to-earn” para World App. El
        objetivo es jugar, acumular puntos y realizar compras opcionales dentro
        de la app.
      </p>

      <h2 style={{ fontSize: "1.15rem", margin: "24px 0 8px" }}>
        2. Uso bajo tu responsabilidad
      </h2>
      <p>
        Este software se ofrece “tal cual”. No garantizamos disponibilidad
        continua, ausencia de errores ni resultados específicos.
      </p>

      <h2 style={{ fontSize: "1.15rem", margin: "24px 0 8px" }}>3. Elegibilidad</h2>
      <p>
        El uso requiere acceso a World App y, cuando corresponda, verificación
        mediante World ID. El incumplimiento de condiciones de World App puede
        impedir el acceso.
      </p>

      <h2 style={{ fontSize: "1.15rem", margin: "24px 0 8px" }}>4. Pagos</h2>
      <p>
        Algunas funciones pueden requerir pagos dentro de World App. El
        procesamiento lo gestiona World App/MiniKit. No almacenamos información
        de pago en nuestros servidores.
      </p>

      <h2 style={{ fontSize: "1.15rem", margin: "24px 0 8px" }}>
        5. Conducta y trampas
      </h2>
      <p>
        Queda prohibido manipular el cliente, automatizar taps o alterar
        estados. Podemos suspender o anular progreso si detectamos fraude.
      </p>

      <h2 style={{ fontSize: "1.15rem", margin: "24px 0 8px" }}>
        6. Propiedad intelectual
      </h2>
      <p>
        El código, las marcas y los contenidos pertenecen a sus titulares. No
        se otorga licencia fuera del uso normal del servicio.
      </p>

      <h2 style={{ fontSize: "1.15rem", margin: "24px 0 8px" }}>7. Cambios</h2>
      <p>
        Podemos actualizar estos términos en cualquier momento. Si el cambio es
        sustancial, lo indicaremos en la miniapp.
      </p>

      <h2 style={{ fontSize: "1.15rem", margin: "24px 0 8px" }}>8. Contacto</h2>
      <p>
        Consultas:{" "}
        <a href="mailto:rainbowgoldissues@gmail.com">
          rainbowgoldissues@gmail.com
        </a>
      </p>
    </main>
  );
}
