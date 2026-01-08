import { NextResponse } from "next/server";
import { setSessionCookie } from "@/lib/auth";

export async function POST(req: Request) {
  const { user, pass } = await req.json();

  const ADMIN_USER = process.env.ADMIN_USER;
  const ADMIN_PASS = process.env.ADMIN_PASS;

  if (!ADMIN_USER || !ADMIN_PASS) {
    return NextResponse.json({ ok: false, error: "Missing ADMIN_USER/ADMIN_PASS" }, { status: 500 });
  }

  if (user === ADMIN_USER && pass === ADMIN_PASS) {
    setSessionCookie(user);
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ ok: false, error: "Invalid credentials" }, { status: 401 });
}
