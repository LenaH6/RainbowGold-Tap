export default async function handler(req, res) {
  // Aquí consultarías el portal para confirmar estado
  res.status(200).json({ ok: true });
}
