import { ensureDatabase } from "../../../db/bootstrap";
import { getD1 } from "../../../db";
import { clearSessionCookie, randomToken, sessionCookie, sha256 } from "../_lib/auth";

export async function POST(request: Request) {
  await ensureDatabase();
  let payload: unknown;
  try { payload = await request.json(); } catch { return Response.json({ error: "درخواست نامعتبر است." }, { status: 400 }); }
  if (!payload || typeof payload !== "object" || Array.isArray(payload) || Object.keys(payload).some((key) => key !== "email" && key !== "password")) return Response.json({ error: "درخواست نامعتبر است." }, { status: 400 });
  const email = typeof (payload as { email?: unknown })?.email === "string" ? (payload as { email: string }).email.trim().toLowerCase() : "";
  const password = typeof (payload as { password?: unknown })?.password === "string" ? (payload as { password: string }).password : "";
  if (!email || password.length < 8 || email.length > 120 || password.length > 120) return Response.json({ error: "ایمیل یا رمز عبور نادرست است." }, { status: 401 });

  const user = await getD1().prepare("SELECT id, password_hash AS passwordHash FROM users WHERE email = ? LIMIT 1").bind(email).first<{ id: string; passwordHash: string }>();
  const suppliedHash = await sha256(password);
  if (!user || suppliedHash !== user.passwordHash) return Response.json({ error: "ایمیل یا رمز عبور نادرست است." }, { status: 401 });

  const token = randomToken();
  const tokenHash = await sha256(token);
  const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();
  await getD1().batch([
    getD1().prepare("DELETE FROM sessions WHERE expires_at <= CURRENT_TIMESTAMP"),
    getD1().prepare("INSERT INTO sessions (id, token_hash, user_id, expires_at) VALUES (?, ?, ?, ?)").bind(crypto.randomUUID(), tokenHash, user.id, expiresAt),
  ]);
  return Response.json({ ok: true }, { headers: { "Set-Cookie": sessionCookie(token, request), "Cache-Control": "no-store" } });
}

export async function DELETE(request: Request) {
  return Response.json({ ok: true }, { headers: { "Set-Cookie": clearSessionCookie(request), "Cache-Control": "no-store" } });
}
