import { NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import type { VaultItem } from "@/lib/types";
import { nanoid } from "nanoid";
import { decrypt, encrypt } from "@/lib/crypto";

const INDEX_KEY = "vault:items";

// GET /api/items?offset=0&limit=200
export async function GET(req: Request) {
  const url = new URL(req.url);
  const offset = Math.max(0, Number(url.searchParams.get("offset") ?? "0") || 0);
  const limitRaw = Number(url.searchParams.get("limit") ?? "0") || 0;
  const limit = limitRaw > 0 ? Math.min(limitRaw, 500) : 0; // 0 means "all"

  const stop = limit > 0 ? offset + limit - 1 : -1;

  const ids = (await redis.lrange<string[]>(INDEX_KEY, offset, stop)) ?? [];
  if (!ids.length) return NextResponse.json({ items: [], offset, limit });

  const keys = ids.map((id) => `vault:item:${id}`);
  const items = (await redis.mget<VaultItem[]>(...keys)) ?? [];
  const filtered = items.filter(Boolean).map((it) => ({
    ...it,
    password: decrypt(it.password ?? ""),
  }));

  filtered.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  return NextResponse.json({ items: filtered, offset, limit });
}

export async function POST(req: Request) {
  const body = (await req.json()) as Partial<VaultItem>;
  if (!body.url) return NextResponse.json({ error: "url required" }, { status: 400 });

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

  // Store encrypted password
  const toStore: VaultItem = { ...item, password: encrypt(item.password ?? "") };

  // Pipeline to reduce partial writes
  const p = redis.pipeline();
  p.set(`vault:item:${id}`, toStore);
  p.lpush(INDEX_KEY, id);
  await p.exec();

  return NextResponse.json({ item });
}
