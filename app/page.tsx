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

export default function HomePage() {
  const [mobileOpen, setMobileOpen] = useState(false);

  const [items, setItems] = useState<VaultItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = useMemo(
    () => items.find((x) => x.id === selectedId) ?? null,
    [items, selectedId]
  );

  const [draft, setDraft] = useState<Partial<VaultItem>>({});
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/items", { cache: "no-store" });
      const data = await res.json();
      const list: VaultItem[] = data.items ?? [];
      setItems(list);

      if (list.length && !selectedId) setSelectedId(list[0].id);
      if (!list.length) setSelectedId(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setDraft(selected ?? {});
  }, [selectedId]);

  async function createNew() {
    const res = await fetch("/api/items", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        url: "https://",
        username: "",
        password: "",
        createdAt: new Date().toISOString(),
      }),
    });
    const data = await res.json();
    await load();
    if (data?.item?.id) setSelectedId(data.item.id);

    // 手机端新建后打开弹窗编辑
    if (window.innerWidth < 768) setMobileOpen(true);
  }

  async function save() {
    if (!selected) return;
    await fetch(`/api/items/${selected.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(draft),
    });
    await load();
  }

  async function remove() {
    if (!selected) return;
    await fetch(`/api/items/${selected.id}`, { method: "DELETE" });
    setSelectedId(null);
    setMobileOpen(false);
    await load();
  }

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <div className="min-h-screen p-4 md:p-8 bg-gray-50">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-semibold">密码管理</h1>
          </div>
          <div className="flex gap-2">
            <button className="rounded-xl border bg-white px-3 py-2" onClick={createNew}>
              新建
            </button>
            <button className="rounded-xl border bg-white px-3 py-2" onClick={logout}>
              退出
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Left: list */}
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
              {loading && items.length === 0 && (
                <div className="p-6 text-sm text-gray-500">加载中...</div>
              )}

              {items.map((it) => {
                const due = computeDueDate(it);
                const isSel = it.id === selectedId;

                return (
                  <button
                    key={it.id}
                    onClick={() => {
                      setSelectedId(it.id);
                      // 仅手机端打开弹窗编辑
                      if (window.innerWidth < 768) setMobileOpen(true);
                    }}
                    className={[
                      "w-full text-left px-3 py-3 hover:bg-gray-50",
                      isSel ? "bg-gray-50" : "",
                    ].join(" ")}
                  >
                    {/* Desktop row (PC 不变) */}
                    <div className="hidden md:grid grid-cols-[1fr_1.4fr_1fr_1fr_1fr_0.8fr_1fr] gap-2 text-sm">
                      <div className="truncate">{it.category ?? "-"}</div>
                      <div className="truncate">{it.url}</div>
                      <div className="truncate">{it.username ?? "-"}</div>
                      <div className="truncate">{it.password ? "••••••••" : "-"}</div>
                      <div className="truncate">
                        {it.createdAt ? new Date(it.createdAt).toLocaleString() : "-"}
                      </div>
                      <div className="truncate">{it.validDays ?? "-"}</div>
                      <div className="truncate">
                        {due ? new Date(due).toLocaleDateString() : "-"}
                      </div>
                    </div>

                    {/* Mobile card: 显示 网址 + 用户名 */}
                    <div className="md:hidden space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-medium truncate">{it.url}</div>
                        <div className="text-xs text-gray-500 shrink-0">
                          {it.category ?? "未分类"}
                        </div>
                      </div>
                      <div className="text-sm text-gray-600 truncate">
                        用户名：{it.username ?? "-"}
                      </div>
                    </div>
                  </button>
                );
              })}

              {items.length === 0 && !loading && (
                <div className="p-6 text-sm text-gray-500">暂无记录，点“新建”创建一条。</div>
              )}
            </div>
          </div>

          {/* Right: editor (PC 显示，手机隐藏) */}
          <div className="hidden md:block rounded-2xl border bg-white p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-semibold">编辑</h2>
              <div className="flex gap-2">
                <button
                  className="rounded-xl border px-3 py-2 disabled:opacity-50"
                  onClick={remove}
                  disabled={!selected}
                >
                  删除
                </button>
                <button
                  className="rounded-xl bg-black text-white px-3 py-2 disabled:opacity-50"
                  onClick={save}
                  disabled={!selected}
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
                <input
                  className="w-full rounded-xl border px-3 py-2"
                  placeholder="网址"
                  value={draft.url ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, url: e.target.value }))}
                />
                <input
                  className="w-full rounded-xl border px-3 py-2"
                  placeholder="用户名(可空)"
                  value={draft.username ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, username: e.target.value }))}
                />
                <input
                  className="w-full rounded-xl border px-3 py-2"
                  placeholder="密码"
                  value={draft.password ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, password: e.target.value }))}
                />

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
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      validDays: e.target.value ? Number(e.target.value) : undefined,
                    }))
                  }
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
          </div>
        </div>
      </div>

      {/* Mobile Modal: 手机端编辑弹窗 */}
      <div className={`md:hidden ${mobileOpen ? "" : "hidden"}`}>
        <div className="fixed inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
        <div className="fixed inset-x-0 bottom-0 max-h-[85vh] overflow-auto rounded-t-2xl bg-white p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">编辑</h2>
            <button className="rounded-xl border px-3 py-2" onClick={() => setMobileOpen(false)}>
              关闭
            </button>
          </div>

          {!selected ? (
            <div className="mt-4 text-sm text-gray-500">未选择条目</div>
          ) : (
            <>
              <div className="mt-4 space-y-3">
                <input
                  className="w-full rounded-xl border px-3 py-2"
                  placeholder="分类(可空)"
                  value={draft.category ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}
                />
                <input
                  className="w-full rounded-xl border px-3 py-2"
                  placeholder="网址"
                  value={draft.url ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, url: e.target.value }))}
                />
                <input
                  className="w-full rounded-xl border px-3 py-2"
                  placeholder="用户名(可空)"
                  value={draft.username ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, username: e.target.value }))}
                />
                <input
                  className="w-full rounded-xl border px-3 py-2"
                  placeholder="密码"
                  value={draft.password ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, password: e.target.value }))}
                />
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
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      validDays: e.target.value ? Number(e.target.value) : undefined,
                    }))
                  }
                />
                <input
                  className="w-full rounded-xl border px-3 py-2"
                  placeholder="到期日(可空, ISO)"
                  value={draft.dueDate ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, dueDate: e.target.value }))}
                />
              </div>

              <div className="mt-4 flex gap-2">
                <button className="flex-1 rounded-xl border px-3 py-2" onClick={remove}>
                  删除
                </button>
                <button className="flex-1 rounded-xl bg-black text-white px-3 py-2" onClick={save}>
                  保存
                </button>
              </div>

              <div className="mt-3 text-xs text-gray-500">
                提示：如果不填到期日，但填了创建时间+有效期，会自动计算显示到期日。
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
