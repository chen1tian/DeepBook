"use client";

import { useState } from "react";
import { X, Plus, Pencil, Trash2, Check, BookOpen } from "lucide-react";
import type { StorySetting } from "@/lib/story-state-types";

interface Props {
  open: boolean;
  onClose: () => void;
  settings: StorySetting[];
  onSave: (settings: StorySetting[]) => Promise<void>;
}

const CATEGORY_COLORS: Record<string, string> = {
  "世界观": "bg-sky-500/20 text-sky-400",
  "人物关系": "bg-rose-500/20 text-rose-400",
  "历史事件": "bg-amber-500/20 text-amber-400",
  "规则体系": "bg-emerald-500/20 text-emerald-400",
  "其他": "bg-zinc-500/20 text-zinc-400",
};

export default function SettingPanel({ open, onClose, settings, onSave }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editKey, setEditKey] = useState("");
  const [editValue, setEditValue] = useState("");
  const [editCat, setEditCat] = useState("其他");
  const [saving, setSaving] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  if (!open) return null;

  function startEdit(s: StorySetting) {
    setEditingId(s.id);
    setEditKey(s.key);
    setEditValue(s.value);
    setEditCat(s.category);
    setIsAdding(false);
  }

  function startAdd() {
    setIsAdding(true);
    setEditingId(null);
    setEditKey("");
    setEditValue("");
    setEditCat("其他");
  }

  function cancelEdit() {
    setEditingId(null);
    setIsAdding(false);
  }

  async function handleSaveEdit() {
    if (!editKey.trim() || !editValue.trim()) return;
    setSaving(true);

    let updated: StorySetting[];
    if (isAdding) {
      const newSetting: StorySetting = {
        id: `set_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        key: editKey.trim(),
        value: editValue.trim(),
        category: editCat,
      };
      updated = [...settings, newSetting];
    } else {
      updated = settings.map((s) =>
        s.id === editingId
          ? { ...s, key: editKey.trim(), value: editValue.trim(), category: editCat }
          : s
      );
    }
    await onSave(updated);
    setSaving(false);
    cancelEdit();
  }

  async function handleDelete(id: string) {
    const updated = settings.filter((s) => s.id !== id);
    await onSave(updated);
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div
        className="flex h-full w-80 max-w-[90vw] flex-col bg-zinc-900 shadow-2xl ring-1 ring-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className="flex h-11 shrink-0 items-center justify-between border-b border-white/5 px-3">
          <div className="flex items-center gap-2">
            <BookOpen size={16} className="text-purple-400" />
            <span className="text-xs font-medium text-zinc-400">世界设定</span>
            <span className="text-[10px] text-zinc-600">({settings.length})</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={startAdd}
              className="rounded p-1 text-zinc-500 hover:text-purple-400"
              title="添加设定"
            >
              <Plus size={16} />
            </button>
            <button onClick={onClose} className="rounded p-1 text-zinc-500 hover:text-zinc-300">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* content */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {settings.length === 0 && !isAdding && (
            <p className="py-8 text-center text-xs text-zinc-600">
              暂无世界设定。AI 分析对话后会自动提取，也可以手动添加。
            </p>
          )}

          {/* add/edit form */}
          {(isAdding || editingId) && (
            <div className="rounded-lg bg-zinc-800 p-3 space-y-2 ring-1 ring-purple-500/30">
              <input
                type="text"
                value={editKey}
                onChange={(e) => setEditKey(e.target.value)}
                placeholder="设定名称"
                className="w-full rounded bg-zinc-700 px-2 py-1.5 text-sm text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-purple-400/50"
              />
              <textarea
                value={editValue}
                onChange={(e) => {
                  setEditValue(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = e.target.scrollHeight + "px";
                }}
                placeholder="设定内容"
                rows={2}
                className="w-full resize-none rounded bg-zinc-700 px-2 py-1.5 text-sm text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-purple-400/50"
              />
              <div className="flex items-center gap-2">
                <select
                  value={editCat}
                  onChange={(e) => setEditCat(e.target.value)}
                  className="flex-1 rounded bg-zinc-700 px-2 py-1.5 text-xs text-zinc-300 focus:outline-none"
                >
                  {Object.keys(CATEGORY_COLORS).map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <button
                  onClick={handleSaveEdit}
                  disabled={saving || !editKey.trim() || !editValue.trim()}
                  className="rounded p-1.5 text-emerald-400 hover:bg-emerald-400/10 disabled:opacity-30"
                  title="保存"
                >
                  <Check size={14} />
                </button>
                <button
                  onClick={cancelEdit}
                  className="rounded p-1.5 text-zinc-500 hover:text-zinc-300"
                  title="取消"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          )}

          {/* settings list */}
          {settings.map((s) => (
            <div
              key={s.id}
              className="rounded-lg bg-zinc-800/50 px-3 py-2.5 ring-1 ring-white/5 group"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-zinc-200 truncate">{s.key}</span>
                    <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${CATEGORY_COLORS[s.category] || CATEGORY_COLORS["其他"]}`}>
                      {s.category}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-400 leading-relaxed whitespace-pre-wrap">
                    {s.value}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
                  <button
                    onClick={() => startEdit(s)}
                    className="rounded p-1 text-zinc-500 hover:text-zinc-300"
                    title="编辑"
                  >
                    <Pencil size={12} />
                  </button>
                  <button
                    onClick={() => handleDelete(s.id)}
                    className="rounded p-1 text-zinc-500 hover:text-red-400"
                    title="删除"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
