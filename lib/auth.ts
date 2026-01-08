import crypto from "crypto";
import { cookies } from "next/headers";
import { mustEnv } from "@/lib/env";

const COOKIE_NAME = "pv_session";

function hmac(data: string, secret: string) {
  return crypto.createHmac("sha256", secret).update(data).digest("hex");
}

export function signSession(payload: object) {
  const secret = mustEnv("AUTH_SECRET");
  const json = JSON.stringify(payload);
  const b64 = Buffer.from(json).toString("base64url");
  const sig = hmac(b64, secret);
  return `${b64}.${sig}`;
}

export function verifySession(token: string | undefined | null) {
  if (!token) return null;
  const secret = mustEnv("AUTH_SECRET");

  const [b64, sig] = token.split(".");
  if (!b64 || !sig) return null;

  const expected = hmac(b64, secret);
  // timing safe compare
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  if (!crypto.timingSafeEqual(a, b)) return null;

  try {
    const json = Buffer.from(b64, "base64url").toString("utf8");
    return JSON.parse(json) as { user?: string; iat?: number };
  } catch {
    return null;
  }
}

export function getSession() {
  const token = cookies().get(COOKIE_NAME)?.value;
  return verifySession(token);
}

export function setSessionCookie(user: string) {
  const token = signSession({ user, iat: Date.now() });
  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
}

export function clearSessionCookie() {
  cookies().set(COOKIE_NAME, "", { httpOnly: true, path: "/", maxAge: 0 });
}
