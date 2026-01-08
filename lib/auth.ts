import crypto from "crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "pv_session";

function hmac(data: string, secret: string) {
  return crypto.createHmac("sha256", secret).update(data).digest("hex");
}

export function signSession(payload: object) {
  const secret = process.env.AUTH_SECRET!;
  const json = JSON.stringify(payload);
  const b64 = Buffer.from(json).toString("base64url");
  const sig = hmac(b64, secret);
  return `${b64}.${sig}`;
}

export function verifySession(token: string | undefined) {
  if (!token) return null;
  const secret = process.env.AUTH_SECRET!;
  const [b64, sig] = token.split(".");
  if (!b64 || !sig) return null;

  const expected = hmac(b64, secret);
  // both are hex strings of same length
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch {
    return null;
  }

  try {
    const json = Buffer.from(b64, "base64url").toString("utf8");
    return JSON.parse(json) as { user: string; iat: number };
  } catch {
    return null;
  }
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
