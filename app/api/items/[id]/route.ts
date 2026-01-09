import { NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import type { VaultItem } from "@/lib/types";
import { decryptSafe, encrypt, isEncrypted } from "@/lib/crypto";
import { ratelimit } from "@/lib/ratelimit";

const INDEX_KEY = "vault:items";

export async function PUT(req: Request, ctx: { params: { id: string } }) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = await ratelimit.limit(`items:write:${ip}`);
  if (!rl.success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const id = ctx.params.id;
  const patch = (await req.json()) as Partial<VaultItem> & { clearPassword?: boolean };

  // reject encrypted from client
  if (typeof patch.password === "string" && isEncrypted(patch.password)) {
    return NextResponse.json({ error: "password must be plaintext" }, { status: 400 });
  }

  const key = `vault:item:${id}`;
  const currentEnc = await redis.get<VaultItem>(key);
  if (!currentEnc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const current: VaultItem = { ...currentEnc, password: decryptSafe(currentEnc.password ?? "") };

  const nextPassword =
    patch.clearPassword === true
      ? ""
      : patch.password === undefined
        ? current.password
        : patch.password === ""
          ? current.password
          : patch.password;

  const next: VaultItem = {
    ...current,
    category: patch.category?.trim() || undefined,
    url: (patch.url ?? current.url).trim(),
    username: patch.username?.trim() || undefined,
    password: nextPassword,
    createdAt: patch.createdAt ?? current.createdAt,
    validDays: patch.validDays ?? current.validDays,
    dueDate: patch.dueDate ?? current.dueDate,
  };

  const toStore: VaultItem = { ...next, password: encrypt(next.password ?? "") };
  await redis.set(key, toStore);

  return NextResponse.json({ item: next });
}

export async function DELETE(req: Request, ctx: { params: { id: string } }) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = await ratelimit.limit(`items:write:${ip}`);
  if (!rl.success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const id = ctx.params.id;
  const key = `vault:item:${id}`;

  const p = redis.pipeline();
  p.del(key);
  p.lrem(INDEX_KEY, 0, id);
  await p.exec();

  return NextResponse.json({ ok: true });
}
