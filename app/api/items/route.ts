import { NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import type { VaultItem } from "@/lib/types";
import { nanoid } from "nanoid";

const INDEX_KEY = "vault:items";

export async function GET() {
  const ids = (await redis.lrange<string[]>(INDEX_KEY, 0, -1)) ?? [];
  if (!ids.length) return NextResponse.json({ items: [] });

  const keys = ids.map((id) => `vault:item:${id}`);
  const items = (await redis.mget<VaultItem[]>(...keys)) ?? [];
  const filtered = items.filter(Boolean);

  filtered.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  return NextResponse.json({ items: filtered });
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

  await redis.set(`vault:item:${id}`, item);
  await redis.lpush(INDEX_KEY, id);

  return NextResponse.json({ item });
}
