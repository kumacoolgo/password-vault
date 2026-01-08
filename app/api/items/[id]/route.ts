import { NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import type { VaultItem } from "@/lib/types";

const INDEX_KEY = "vault:items";

export async function PUT(req: Request, ctx: { params: { id: string } }) {
  const id = ctx.params.id;
  const patch = (await req.json()) as Partial<VaultItem>;

  const key = `vault:item:${id}`;
  const current = await redis.get<VaultItem>(key);
  if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const next: VaultItem = {
    ...current,
    category: patch.category?.trim() || undefined,
    url: (patch.url ?? current.url).trim(),
    username: patch.username?.trim() || undefined,
    password: patch.password ?? current.password,
    createdAt: patch.createdAt ?? current.createdAt,
    validDays: patch.validDays ?? current.validDays,
    dueDate: patch.dueDate ?? current.dueDate,
  };

  await redis.set(key, next);
  return NextResponse.json({ item: next });
}

export async function DELETE(_req: Request, ctx: { params: { id: string } }) {
  const id = ctx.params.id;
  const key = `vault:item:${id}`;

  await redis.del(key);
  await redis.lrem(INDEX_KEY, 0, id);

  return NextResponse.json({ ok: true });
}
