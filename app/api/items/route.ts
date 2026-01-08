import { NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import type { VaultItem } from "@/lib/types";
import { nanoid } from "nanoid";
import { decryptSafe, encrypt, isEncrypted } from "@/lib/crypto";
import { ratelimit } from "@/lib/ratelimit";
import { parseMaybeJSON } from "@/lib/kv";

const INDEX_KEY = "vault:items";

export async function GET(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = await ratelimit.limit(`items:get:${ip}`);
  if (!rl.success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const { searchParams } = new URL(req.url);
  const offset = Math.max(0, Number(searchParams.get("offset")) || 0);
  const limit = Math.min(Number(searchParams.get("limit")) || 500, 500);
  const stop = limit > 0 ? offset + limit - 1 : -1;

  const ids = (await redis.lrange<string>(INDEX_KEY, offset, stop)) ?? [];
  if (!ids.length) return NextResponse.json({ items: [] });

  const keys = ids.map((id) => `vault:item:${id}`);
  const rows = (await redis.mget<any[]>(...keys)) ?? [];

  const out: VaultItem[] = [];
  for (const row of rows) {
    if (!row) continue;
    // 自动处理 SDK 可能已解析的对象或原始字符串
    const it = typeof row === 'object' ? (row as VaultItem) : parseMaybeJSON<VaultItem>(row);
    if (!it) continue;

    out.push({ 
      ...it, 
      password: decryptSafe(it.password ?? "") 
    });
  }

  out.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  return NextResponse.json({ items: out });
}

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = await ratelimit.limit(`items:write:${ip}`);
  if (!rl.success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const body = (await req.json()) as Partial<VaultItem>;
  if (!body.url) return NextResponse.json({ error: "url required" }, { status: 400 });

  const id = nanoid();
  const item: VaultItem = {
    id,
    category: body.category?.trim(),
    url: body.url.trim(),
    username: body.username?.trim(),
    password: encrypt(body.password ?? ""), // 写入前加密
    createdAt: body.createdAt || new Date().toISOString(),
    validDays: body.validDays,
    dueDate: body.dueDate,
  };

  const p = redis.pipeline();
  p.set(`vault:item:${id}`, item);
  p.lpush(INDEX_KEY, id);
  await p.exec();

  return NextResponse.json({ item });
}