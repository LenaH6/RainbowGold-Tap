export default async function handler(req, res) {
  const id = "ref_" + Math.random().toString(36).slice(2, 10);
  res.status(200).json({ id });
}
