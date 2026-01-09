"use client";

import { useEffect, useMemo, useState } from "react";
import type { VaultItem } from "@/lib/types";

function computeDueDate(item: VaultItem) {
  if (item.dueDate) return item.dueDate;
  if (item.createdAt && item.validDays) {
    const d = new Date(item.createdAt);
    d.setDate(d.getDate() + item.validDays);
    return d.toISOString();
  }
  return "";
}

function genPassword(len = 16) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*()-_=+";
  const buf = new Uint32Array(len);
  crypto.getRandomValues(buf);
  return Array.from(buf)
    .map((n) => alphabet[n % alphabet.length])
    .join("");
}

async function copyText(text: string) {
  await navigator.clipboard.writeText(text);
}

export default function HomePage() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [items, setItems] = useState<VaultItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<VaultItem>>({});
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  const selected = useMemo(() => items.find((x) => x.id === selectedId) ?? null, [items, selectedId]);

  const isDirty = useMemo(() => {
    if (!selected) return false;
    const norm = (v: any) => (v === undefined || v === null ? "" : String(v));
    // Compare all editable fields (treat undefined and "" as equal)
    return (
      norm(draft.category) !== norm(selected.category) ||
      norm(draft.url) !== norm(selected.url) ||
      norm(draft.username) !== norm(selected.username) ||
      norm(draft.password) !== norm(selected.password) ||
      norm(draft.createdAt) !== norm(selected.createdAt) ||
      norm(draft.validDays) !== norm(selected.validDays) ||
      norm(draft.dueDate) !== norm(selected.dueDate)
    );
  }, [draft, selected]);

  const filteredItems = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter(
      (it) =>
        (it.category ?? "").toLowerCase().includes(s) ||
        (it.url ?? "").toLowerCase().includes(s) ||
        (it.username ?? "").toLowerCase().includes(s)
    );
  }, [items, q]);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/items", { cache: "no-store" });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      const list: VaultItem[] = data.items ?? [];
      setItems(list);
      if (list.length && !selectedId) setSelectedId(list[0].id);
      if (!list.length) setSelectedId(null);
    } catch (e: any) {
      setToast(e?.message || "加载失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line
  }, []);
  useEffect(() => {
    setDraft(selected ?? {});
  }, [selectedId, selected]);

  async function createNew() {
    const res = await fetch("/api/items", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: "https://", username: "", password: "", createdAt: new Date().toISOString() }),
    });
    if (!res.ok) return setToast("新建失败");
    const data = await res.json();
    await load();
    if (data?.item?.id) setSelectedId(data.item.id);
    if (window.innerWidth < 768) setMobileOpen(true);
  }

  async function save() {
    if (!selected) return;
    if (!isDirty) {
      setToast("没有变化，无需保存");
      return;
    }
    const res = await fetch(`/api/items/${selected.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(draft),
    });
    if (!res.ok) return setToast((await res.text()) || "保存失败");
    await load();
    setToast("已保存");
  }

  async function remove() {
    if (!selected) return;
    const res = await fetch(`/api/items/${selected.id}`, { method: "DELETE" });
    if (!res.ok) return setToast("删除失败");
    setSelectedId(null);
    setMobileOpen(false);
    await load();
  }

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    window.location.href = "/login";
  }

  const Editor = (
    <>
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">编辑</h2>
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded-xl border px-3 py-2 disabled:opacity-50"
            onClick={remove}
            disabled={!selected}
          >
            删除
          </button>
          <button
            type="button"
            className="rounded-xl bg-black text-white px-3 py-2 disabled:opacity-50"
            onClick={save}
            disabled={!selected || !isDirty}
          >
            保存
          </button>
        </div>
      </div>

      {!selected ? (
        <div className="mt-4 text-sm text-gray-500">选择一条记录开始编辑。</div>
      ) : (
        <div className="mt-4 space-y-3">
          <input
            className="w-full rounded-xl border px-3 py-2"
            placeholder="分类(可空)"
            value={draft.category ?? ""}
            onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}
          />

          {/* URL + Copy */}
          <div className="flex gap-2 items-center">
            <input
              className="w-full rounded-xl border px-3 py-2"
              placeholder="网址"
              value={draft.url ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, url: e.target.value }))}
            />
            <button
              type="button"
              className="rounded-xl border bg-white px-3 py-2"
              onClick={async () => {
                if (!draft.url) return;
                await copyText(draft.url);
                setToast("已复制网址");
              }}
            >
              Copy
            </button>
          </div>

          {/* Username + Copy */}
          <div className="flex gap-2 items-center">
            <input
              className="w-full rounded-xl border px-3 py-2"
              placeholder="用户名(可空)"
              value={draft.username ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, username: e.target.value }))}
            />
            <button
              type="button"
              className="rounded-xl border bg-white px-3 py-2"
              onClick={async () => {
                if (!draft.username) return;
                await copyText(draft.username);
                setToast("已复制用户名");
              }}
            >
              Copy
            </button>
          </div>

          {/* Password + Generate + Copy */}
          <div className="flex gap-2 items-center">
            <input
              className="w-full rounded-xl border px-3 py-2"
              placeholder="密码"
              value={draft.password ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, password: e.target.value }))}
              autoComplete="new-password"
            />
            <button
              type="button"
              className="rounded-xl border bg-white px-3 py-2"
              onClick={() => setDraft((d) => ({ ...d, password: genPassword(16) }))}
            >
              Generate
            </button>
            <button
              type="button"
              className="rounded-xl border bg-white px-3 py-2"
              onClick={async () => {
                if (!draft.password) return;
                await copyText(draft.password);
                setToast("已复制密码");
              }}
            >
              Copy
            </button>
          </div>

          <input
            className="w-full rounded-xl border px-3 py-2"
            placeholder="创建时间(可空, ISO 或留空)"
            value={draft.createdAt ?? ""}
            onChange={(e) => setDraft((d) => ({ ...d, createdAt: e.target.value }))}
          />
          <input
            className="w-full rounded-xl border px-3 py-2"
            placeholder="有效期(可空, 天数)"
            inputMode="numeric"
            value={draft.validDays?.toString() ?? ""}
            onChange={(e) => setDraft((d) => ({ ...d, validDays: e.target.value ? Number(e.target.value) : undefined }))}
          />
          <input
            className="w-full rounded-xl border px-3 py-2"
            placeholder="到期日(可空, ISO)"
            value={draft.dueDate ?? ""}
            onChange={(e) => setDraft((d) => ({ ...d, dueDate: e.target.value }))}
          />
          <div className="text-xs text-gray-500">
            提示：如果不填到期日，但填了创建时间+有效期，会自动计算显示到期日。
          </div>
        </div>
      )}
    </>
  );

  return (
    <div className="min-h-screen p-4 md:p-8 bg-gray-50">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-semibold">密码管理</h1>
          </div>
          <div className="flex gap-2">
            <button type="button" className="rounded-xl border bg-white px-3 py-2" onClick={createNew}>
              新建
            </button>
            <button type="button" className="rounded-xl border bg-white px-3 py-2" onClick={logout}>
              退出
            </button>
          </div>
        </div>

        <div className="mt-4">
          <input
            className="w-full rounded-2xl border bg-white px-4 py-3"
            placeholder="搜索：分类 / 网址 / 用户名"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 rounded-2xl border bg-white overflow-hidden">
            <div className="hidden md:grid grid-cols-[1fr_1.4fr_1fr_1fr_1fr_0.8fr_1fr] gap-2 bg-gray-50 px-3 py-2 text-xs font-medium">
              <div>分类</div>
              <div>网址</div>
              <div>用户名</div>
              <div>密码</div>
              <div>创建时间</div>
              <div>有效期</div>
              <div>到期日</div>
            </div>
            <div className="divide-y">
              {loading && items.length === 0 && <div className="p-6 text-sm text-gray-500">加载中...</div>}
              {filteredItems.map((it) => {
                const due = computeDueDate(it);
                const isSel = it.id === selectedId;
                return (
                  <div
                    key={it.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      setSelectedId(it.id);
                      if (window.innerWidth < 768) setMobileOpen(true);
                    }}
                    className={["w-full text-left px-3 py-3 hover:bg-gray-50 cursor-pointer", isSel ? "bg-gray-50" : ""].join(
                      " "
                    )}
                  >
                    <div className="hidden md:grid grid-cols-[1fr_1.4fr_1fr_1fr_1fr_0.8fr_1fr] gap-2 text-sm items-center">
                      <div className="truncate">{it.category ?? "-"}</div>

                      <div className="truncate">{it.url}</div>

                      <div className="truncate flex items-center gap-2">
                        <span className="truncate">{it.username ?? "-"}</span>
                        {it.username ? (
                          <button
                            type="button"
                            className="rounded-lg border px-2 py-1 text-xs bg-white"
                            onClick={async (e) => {
                              e.stopPropagation();
                              await copyText(it.username ?? "");
                              setToast("已复制用户名");
                            }}
                          >
                            复制
                          </button>
                        ) : null}
                      </div>

                      <div className="truncate flex items-center gap-2">
                        <span>{it.password ? "••••••••" : "-"}</span>
                        {it.password ? (
                          <button
                            type="button"
                            className="rounded-lg border px-2 py-1 text-xs bg-white"
                            onClick={async (e) => {
                              e.stopPropagation();
                              await copyText(it.password ?? "");
                              setToast("已复制密码");
                            }}
                          >
                            复制
                          </button>
                        ) : null}
                      </div>

                      <div className="truncate">{it.createdAt ? new Date(it.createdAt).toLocaleString() : "-"}</div>
                      <div className="truncate">{it.validDays ?? "-"}</div>
                      <div className="truncate">{due ? new Date(due).toLocaleDateString() : "-"}</div>
                    </div>

                    <div className="md:hidden space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-medium truncate">{it.url}</div>
                        <div className="text-xs text-gray-500 shrink-0">{it.category ?? "未分类"}</div>
                      </div>
                      <div className="text-sm text-gray-600 truncate">用户名：{it.username ?? "-"}</div>
                    </div>
                  </div>
                );
              })}
              {filteredItems.length === 0 && !loading && <div className="p-6 text-sm text-gray-500">暂无匹配记录。</div>}
            </div>
          </div>

          <div className="hidden md:block rounded-2xl border bg-white p-4">{Editor}</div>
        </div>
      </div>

      <div className={`md:hidden ${mobileOpen ? "" : "hidden"}`}>
        <div className="fixed inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
        <div className="fixed inset-x-0 bottom-0 max-h-[85vh] overflow-auto rounded-t-2xl bg-white p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">编辑</h2>
            <button type="button" className="rounded-xl border px-3 py-2" onClick={() => setMobileOpen(false)}>
              关闭
            </button>
          </div>
          {Editor}
        </div>
      </div>

      {toast ? (
        <div className="fixed left-4 bottom-4 rounded-xl bg-black text-white px-4 py-3 text-sm">
          <div className="flex items-center gap-3">
            <span>{toast}</span>
            <button
              type="button"
              className="rounded-lg border border-white/30 px-2 py-1 text-xs"
              onClick={() => setToast(null)}
            >
              ×
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
