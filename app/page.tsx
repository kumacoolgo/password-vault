"use client";

import { useEffect, useMemo, useState } from "react";
import type { VaultItem } from "@/lib/types";

export default function HomePage() {
  const [items, setItems] = useState<VaultItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<VaultItem>>({});
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  const selected = useMemo(() => items.find((x) => x.id === selectedId) || null, [items, selectedId]);

  // 检查内容是否被修改
  const isDirty = useMemo(() => {
    if (!selected) return false;
    return JSON.stringify(draft) !== JSON.stringify(selected);
  }, [draft, selected]);

  const filteredItems = useMemo(() => {
    const s = q.trim().toLowerCase();
    return items.filter(it => !s || [it.url, it.category, it.username].some(v => v?.toLowerCase().includes(s)));
  }, [items, q]);

  const load = async () => {
    setLoading(true);
    const res = await fetch("/api/items");
    const data = await res.json();
    setItems(data.items || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { if (selected) setDraft(selected); }, [selectedId, selected]);

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setToast("已复制到剪贴板");
    setTimeout(() => setToast(null), 2000);
  };

  const onSave = async () => {
    if (!selected || !isDirty) return;
    const res = await fetch(`/api/items/${selected.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(draft),
    });
    if (res.ok) {
      await load();
      setToast("保存成功");
    }
  };

  return (
    <div className="min-h-screen p-4 md:p-8 bg-gray-50 text-gray-900">
      <div className="mx-auto max-w-6xl">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Password Vault</h1>
          <button onClick={() => {}} className="px-4 py-2 bg-black text-white rounded-xl">新建</button>
        </div>

        <input 
          className="w-full px-4 py-3 border rounded-2xl mb-6 outline-none focus:ring-2 focus:ring-black"
          placeholder="搜索关键词..."
          value={q}
          onChange={e => setQ(e.target.value)}
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* 列表区 */}
          <div className="md:col-span-2 bg-white border rounded-2xl overflow-hidden shadow-sm">
            <div className="divide-y">
              {filteredItems.map(it => (
                <div 
                  key={it.id}
                  onClick={() => setSelectedId(it.id)}
                  className={`p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 ${it.id === selectedId ? 'bg-blue-50' : ''}`}
                >
                  <div className="truncate">
                    <p className="font-semibold truncate">{it.url}</p>
                    <p className="text-xs text-gray-500">{it.username || '-'}</p>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={(e) => { e.stopPropagation(); copy(it.password); }}
                      className="px-3 py-1 text-xs border rounded-lg hover:bg-white"
                    >复制密码</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 编辑区 */}
          <aside className="bg-white border rounded-2xl p-6 shadow-sm h-fit sticky top-6">
            <h2 className="font-bold mb-4 text-lg">详情编辑</h2>
            {!selected ? <p className="text-gray-400 text-sm">选择条目以编辑</p> : (
              <div className="space-y-4">
                <input className="w-full p-2 border rounded-lg" value={draft.url || ''} onChange={e => setDraft({...draft, url: e.target.value})} placeholder="URL" />
                <input className="w-full p-2 border rounded-lg" value={draft.username || ''} onChange={e => setDraft({...draft, username: e.target.value})} placeholder="Username" />
                <div className="flex gap-2">
                  <input className="flex-1 p-2 border rounded-lg" value={draft.password || ''} onChange={e => setDraft({...draft, password: e.target.value})} placeholder="Password" />
                  <button onClick={() => setDraft({...draft, password: Math.random().toString(36).slice(-10)})} className="px-2 border rounded-lg text-xs">生成</button>
                </div>
                <button 
                  onClick={onSave}
                  disabled={!isDirty}
                  className="w-full py-2 bg-black text-white rounded-xl disabled:opacity-30"
                >保存修改</button>
              </div>
            )}
          </aside>
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 px-6 py-3 bg-gray-900 text-white rounded-full shadow-2xl transition-all">
          {toast}
        </div>
      )}
    </div>
  );
}