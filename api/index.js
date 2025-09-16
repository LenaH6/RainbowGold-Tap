import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import crypto from "crypto";
import { SiweMessage } from "siwe";
import { v4 as uuidv4 } from "uuid";

// IMPORTANT: Vercel serverless handler (no app.listen)
const app = express();
app.use(express.json());
app.use(cookieParser(process.env.SESSION_SECRET || "dev_secret"));

const ORIGIN = process.env.ORIGIN || "*"; // allow your Vercel domain via env
app.use(cors({ origin: true, credentials: true }));

// In-memory stores (replace with Redis/DB in production)
const sessions = new Map();
const orders = new Map();
const newSid = () => crypto.randomBytes(24).toString("hex");

// SIWE endpoints
app.get("/api/nonce", (req, res) => {
  const nonce = crypto.randomBytes(16).toString("hex");
  const sid = newSid();
  sessions.set(sid, { nonce, createdAt: Date.now() });
  res.cookie("sid", sid, { httpOnly: true, path: "/", sameSite: "lax", secure: false });
  res.json({ nonce });
});

app.post("/api/verify", async (req, res) => {
  try {
    const { message, signature } = req.body || {};
    const sid = req.cookies?.sid;
    if (!sid || !sessions.has(sid))
      return res.status(440).json({ ok: false, error: "Sesión inválida" });
    const { nonce } = sessions.get(sid) || {};

    const m = new SiweMessage(message);
    const fields = await m.validate(signature);

    if (fields.nonce !== nonce)
      return res.status(400).json({ ok: false, error: "Nonce inválido" });

    sessions.set(sid, { valid: true, address: fields.address, issuedAt: fields.issuedAt });
    res.json({ ok: true, address: fields.address });
  } catch (e) {
    res.status(400).json({ ok: false, error: e?.message || "Error de verificación" });
  }
});

app.get("/api/me", (req, res) => {
  const sid = req.cookies?.sid;
  const s = sid && sessions.get(sid);
  if (s?.valid) return res.json({ ok: true, address: s.address });
  res.json({ ok: false });
});

// MiniKit Pay (client triggers pay, server tracks order)
app.post("/api/pay/create-order", (req, res) => {
  const sid = req.cookies?.sid;
  const s = sid && sessions.get(sid);
  if (!s?.valid) return res.status(401).json({ ok: false, error: "Login requerido" });

  const { amountWLD, description } = req.body || {};
  if (!amountWLD || amountWLD <= 0) return res.status(400).json({ ok: false, error: "Monto inválido" });

  const orderId = uuidv4();
  orders.set(orderId, { address: s.address, amountWLD, description: description || "", status: "PENDING" });
  res.json({ ok: true, orderId });
});

// NOTE: In production, verify payment server-side with MiniKit/World APIs before confirming
app.post("/api/pay/confirm", (req, res) => {
  const sid = req.cookies?.sid;
  const s = sid && sessions.get(sid);
  if (!s?.valid) return res.status(401).json({ ok: false, error: "Login requerido" });

  const { orderId, txHash } = req.body || {};
  if (!orders.has(orderId)) return res.status(404).json({ ok: false, error: "Orden no encontrada" });

  const o = orders.get(orderId);
  if (o.address !== s.address) return res.status(403).json({ ok: false, error: "Orden no pertenece a este usuario" });
  o.status = "PAID";
  o.txHash = txHash || null;
  orders.set(orderId, o);

  res.json({ ok: true, status: o.status });
});

export default app;
