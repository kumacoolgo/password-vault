import { NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import type { VaultItem } from "@/lib/types";
import { decrypt, encrypt } from "@/lib/crypto";

const INDEX_KEY = "vault:items";

export async function PUT(req: Request, ctx: { params: { id: string } }) {
  const id = ctx.params.id;
  const patch = (await req.json()) as Partial<VaultItem>;

  const key = `vault:item:${id}`;
  const currentEnc = await redis.get<VaultItem>(key);
  if (!currentEnc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const current: VaultItem = {
    ...currentEnc,
    password: decrypt(currentEnc.password ?? ""),
  };

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

  const toStore: VaultItem = { ...next, password: encrypt(next.password ?? "") };
  await redis.set(key, toStore);

  return NextResponse.json({ item: next });
}

export async function DELETE(_req: Request, ctx: { params: { id: string } }) {
  const id = ctx.params.id;
  const key = `vault:item:${id}`;

  const p = redis.pipeline();
  p.del(key);
  p.lrem(INDEX_KEY, 0, id);
  await p.exec();

  return NextResponse.json({ ok: true });
}
