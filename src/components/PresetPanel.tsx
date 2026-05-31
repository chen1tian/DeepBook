"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, Bot, Check } from "lucide-react";
import { getActivePresetId } from "@/lib/storage";

interface Preset {
  id: string;
  name: string;
  mode: "novel" | "roleplay";
  pov: "first" | "third";
  role: string;
  rules: string;
}

interface Props {
  onBack: () => void;
}

export default function PresetPanel({ onBack }: Props) {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"novel" | "roleplay">("novel");
  const [pov, setPov] = useState<"first" | "third">("third");
  const [role, setRole] = useState("");
  const [rules, setRules] = useState("");
  const [saving, setSaving] = useState(false);
  const [isNew, setIsNew] = useState(false);
  const [activePresetId, setLocalActivePresetId] = useState<string | null>(null);

  useEffect(() => { fetchPresets(); }, []);

  // refresh when AI updates presets
  useEffect(() => {
    function onUpdated() { fetchPresets(); }
    window.addEventListener("deepbook:presets-updated", onUpdated);
    return () => window.removeEventListener("deepbook:presets-updated", onUpdated);
  }, []);

  async function fetchPresets() {
    const res = await fetch("/api/presets");
    const data = await res.json();
    const list = data.presets || [];
    setPresets(list);
    // 自动选中当前激活的预设
    const activeId = getActivePresetId();
    setLocalActivePresetId(activeId);
    if (activeId && !selectedId) {
      const active = list.find((p: Preset) => p.id === activeId);
      if (active) selectPreset(active);
    }
  }

  function selectPreset(p: Preset) {
    setSelectedId(p.id);
    setName(p.name);
    setMode(p.mode);
    setPov(p.pov);
    setRole(p.role);
    setRules(p.rules);
    setIsNew(false);
  }

  function startNew() {
    setSelectedId(null);
    setName("");
    setMode("novel");
    setPov("third");
    setRole("");
    setRules("");
    setIsNew(true);
  }

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    const body = { name: name.trim(), mode, pov, role, rules };
    if (isNew || !selectedId) {
      const res = await fetch("/api/presets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.preset) {
        setSelectedId(data.preset.id);
        setIsNew(false);
      }
    } else {
      await fetch("/api/presets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedId, ...body }),
      });
    }
    fetchPresets();
    setSaving(false);
  }

  async function handleDelete() {
    if (!selectedId) return;
    await fetch(`/api/presets?id=${selectedId}`, { method: "DELETE" });
    setSelectedId(null);
    setName(""); setRole(""); setRules("");
    fetchPresets();
  }

  function handleAiHelp() {
    const current = { name, mode, pov, role, rules, id: selectedId, isNew };
    window.dispatchEvent(
      new CustomEvent("deepbook:edit-preset", { detail: current })
    );
  }

  async function handleApply() {
    if (!selectedId) return;
    // 先同步到服务端，确保后续 LLM 调用能读取到
    try {
      await fetch("/api/user-prefs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activePresetId: selectedId }),
      });
    } catch { /* 静默失败，localStorage 兜底 */ }
    // 再更新本地状态
    localStorage.setItem("deepbook_active_preset", selectedId);
    setLocalActivePresetId(selectedId);
  }

  function handleClose() {
    // refresh global preset list so other components see changes
    window.dispatchEvent(new CustomEvent("deepbook:presets-updated"));
    onBack();
  }

  return (
    <div className="flex h-[calc(100dvh-2.75rem)] flex-col">
      {/* toolbar */}
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-white/5 px-3">
        <button onClick={handleClose} className="text-xs text-zinc-500 hover:text-zinc-300">
          ← 返回
        </button>
        <span className="text-xs font-medium text-zinc-400">预设管理</span>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {/* selector row */}
        <div className="mb-4 flex items-center gap-2">
          <select
            value={selectedId ?? ""}
            onChange={(e) => {
              const p = presets.find((x) => x.id === e.target.value);
              if (p) selectPreset(p);
            }}
            className="flex-1 rounded-lg bg-zinc-800 px-3 py-2 text-sm text-zinc-200 ring-1 ring-white/10 focus:outline-none"
          >
            <option value="" disabled>选择预设...</option>
            {presets.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <button
            onClick={startNew}
            className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
            title="新增预设"
          >
            <Plus size={16} />
          </button>
          <button
            onClick={handleAiHelp}
            disabled={!isNew && !selectedId}
            className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-blue-400 disabled:opacity-30"
            title="AI 辅助编辑"
          >
            <Bot size={16} />
          </button>
        </div>

        {/* form */}
        {(selectedId || isNew) && (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-[11px] text-zinc-500">名称</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="如：网络爽文代笔"
                className="w-full rounded-lg bg-zinc-800 px-3 py-2 text-sm text-zinc-200 ring-1 ring-white/10 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
              />
            </div>

            <div>
              <label className="mb-1 block text-[11px] text-zinc-500">模式</label>
              <div className="flex gap-3">
                {(["novel", "roleplay"] as const).map((m) => (
                  <label key={m} className="flex items-center gap-1.5 text-sm text-zinc-300 cursor-pointer">
                    <input
                      type="radio"
                      name="mode"
                      value={m}
                      checked={mode === m}
                      onChange={() => setMode(m)}
                      className="accent-emerald-500"
                    />
                    {m === "novel" ? "小说" : "角色扮演"}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-[11px] text-zinc-500">人称</label>
              <div className="flex gap-3">
                {(["first", "third"] as const).map((pv) => (
                  <label key={pv} className="flex items-center gap-1.5 text-sm text-zinc-300 cursor-pointer">
                    <input
                      type="radio"
                      name="pov"
                      value={pv}
                      checked={pov === pv}
                      onChange={() => setPov(pv)}
                      className="accent-emerald-500"
                    />
                    {pv === "first" ? "第一人称" : "第三人称"}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-[11px] text-zinc-500">角色定义</label>
              <textarea
                value={role}
                onChange={(e) => setRole(e.target.value)}
                rows={3}
                placeholder="如：你是一位小说代笔助手..."
                className="w-full resize-none rounded-lg bg-zinc-800 px-3 py-2 text-sm text-zinc-200 ring-1 ring-white/10 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
              />
            </div>

            <div>
              <label className="mb-1 block text-[11px] text-zinc-500">写作规则</label>
              <textarea
                value={rules}
                onChange={(e) => setRules(e.target.value)}
                rows={8}
                placeholder="1. 采用第三人称...&#10;2. 每次回复 300-600 字..."
                className="w-full resize-none rounded-lg bg-zinc-800 px-3 py-2 text-sm text-zinc-200 ring-1 ring-white/10 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={saving || !name.trim()}
                className="flex-1 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:opacity-50"
              >
                {saving ? "保存中..." : isNew ? "创建" : "保存"}
              </button>
              {!isNew && (
                <button
                  onClick={handleApply}
                  disabled={selectedId === activePresetId}
                  className="rounded-lg px-3 py-2 text-sm font-medium transition disabled:opacity-50"
                  style={{
                    background: selectedId === activePresetId ? "rgb(22 163 74 / 0.15)" : "rgb(250 204 21 / 0.1)",
                    color: selectedId === activePresetId ? "#4ade80" : "#facc15",
                  }}
                  title={selectedId === activePresetId ? "已应用" : "应用为当前预设"}
                >
                  {selectedId === activePresetId ? (
                    <span className="flex items-center gap-1">
                      <Check size={14} /> 已应用
                    </span>
                  ) : (
                    "应用"
                  )}
                </button>
              )}
              {!isNew && (
                <button
                  onClick={handleDelete}
                  className="rounded-lg px-3 py-2 text-sm text-zinc-500 transition hover:bg-red-500/10 hover:text-red-400"
                  title="删除预设"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          </div>
        )}

        {!selectedId && !isNew && (
          <p className="py-8 text-center text-xs text-zinc-600">
            选择预设或点击 + 新建
          </p>
        )}
      </div>
    </div>
  );
}
