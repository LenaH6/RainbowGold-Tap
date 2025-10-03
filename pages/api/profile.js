// Placeholder para hidratar el saldo en UI.
// Conéctalo a tu backend/portal si quieres el balance real.
export default async function handler(req, res) {
  // Si tuvieras address en cookie rg_session, podrías usarla:
  // const cookie = req.headers.cookie || '';
  // const addr = decodeURIComponent((/rg_session=([^;]+)/.exec(cookie) || [])[1] || '');

  // De momento devolvemos "--" para no romper UI.
  res.status(200).json({ wldBalance: "--" });
}
