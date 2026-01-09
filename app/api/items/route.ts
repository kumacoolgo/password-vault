import { NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import type { VaultItem } from "@/lib/types";
import { nanoid } from "nanoid";
import { decryptSafe, encrypt, isEncrypted } from "@/lib/crypto";
import { ratelimit } from "@/lib/ratelimit";
import { parseMaybeJSON, stringifyStore } from "@/lib/kv";

const INDEX_KEY = "vault:items";

export async function GET(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = await ratelimit.limit(`items:get:${ip}`);
  if (!rl.success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const url = new URL(req.url);
  const offset = Math.max(0, Number(url.searchParams.get("offset") ?? "0") || 0);
  const limitRaw = Number(url.searchParams.get("limit") ?? "0") || 0;
  const limit = limitRaw > 0 ? Math.min(limitRaw, 500) : 0;
  const stop = limit > 0 ? offset + limit - 1 : -1;

  const ids = (await redis.lrange<string>(INDEX_KEY, offset, stop)) ?? [];
  if (!ids.length) return NextResponse.json({ items: [], offset, limit });

  const keys = ids.map((id) => `vault:item:${id}`);

  // We store as JSON string, so read as string
  const rows = (await redis.mget<string>(...keys)) ?? [];

  const out: VaultItem[] = [];
  for (const raw of rows.filter(Boolean)) {
    const it = parseMaybeJSON<VaultItem>(raw);
    if (!it) continue;
    out.push({ ...it, password: decryptSafe(it.password ?? "") });
  }

  out.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  return NextResponse.json({ items: out, offset, limit });
}

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = await ratelimit.limit(`items:write:${ip}`);
  if (!rl.success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const body = (await req.json()) as Partial<VaultItem>;
  if (!body.url) return NextResponse.json({ error: "url required" }, { status: 400 });
  if (typeof body.password === "string" && isEncrypted(body.password)) {
    return NextResponse.json({ error: "password must be plaintext" }, { status: 400 });
  }

  const id = nanoid();
  const item: VaultItem = {
    id,
    category: body.category?.trim() || undefined,
    url: body.url.trim(),
    username: body.username?.trim() || undefined,
    password: body.password ?? "",
    createdAt: body.createdAt || new Date().toISOString(),
    validDays: body.validDays ?? undefined,
    dueDate: body.dueDate ?? undefined,
  };

  const toStore: VaultItem = { ...item, password: encrypt(item.password ?? "") };

  const p = redis.pipeline();
  p.set(`vault:item:${id}`, stringifyStore(toStore));
  p.lpush(INDEX_KEY, id);
  await p.exec();

  return NextResponse.json({ item });
}
