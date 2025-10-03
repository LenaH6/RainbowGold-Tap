export default async function handler(req, res) {
  // Aquí verificarías la firma si tuvieras clave/endpoint del portal
  res.status(200).json({ ok: true });
}
