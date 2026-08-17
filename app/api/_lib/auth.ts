import { ensureDatabase } from "../../../db/bootstrap";
import { getD1 } from "../../../db";
import type { ActorContext, Role } from "../../../domain/policy";

const COOKIE_NAME = "narenj_session";

export async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function readCookie(request: Request, name: string) {
  const header = request.headers.get("cookie") ?? "";
  for (const part of header.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return null;
}

export async function getActor(request: Request): Promise<ActorContext | null> {
  await ensureDatabase();
  const token = readCookie(request, COOKIE_NAME);
  if (!token) return null;
  const tokenHash = await sha256(token);
  const row = await getD1().prepare(`
    SELECT u.id AS userId, u.name, u.email, m.restaurant_id AS restaurantId,
      m.branch_id AS branchId, m.role
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    JOIN memberships m ON m.user_id = u.id
    WHERE s.token_hash = ? AND s.expires_at > CURRENT_TIMESTAMP
    LIMIT 1
  `).bind(tokenHash).first<ActorContext>();
  if (!row?.branchId || !isRole(row.role)) return null;
  return row;
}

export async function requireActor(request: Request) {
  const actor = await getActor(request);
  if (!actor) throw new AuthenticationError();
  return actor;
}

export function sessionCookie(token: string, request: Request) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${secure}`;
}

export function clearSessionCookie(request: Request) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${COOKIE_NAME}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure}`;
}

function isRole(value: unknown): value is Role {
  return value === "manager" || value === "waiter" || value === "kitchen";
}

export class AuthenticationError extends Error {
  readonly status = 401;
  constructor() { super("Authentication required"); }
}
