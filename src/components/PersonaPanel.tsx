"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, Bot } from "lucide-react";
import { getActivePersonaId, setActivePersonaId } from "@/lib/storage";

interface Persona {
  id: string;
  name: string;
  avatar: string;
  tone: string;
  addressUser: string;
  style: string;
  catchphrase: string;
}

interface Props {
  onBack: () => void;
}

export default function PersonaPanel({ onBack }: Props) {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("🤖");
  const [tone, setTone] = useState("");
  const [addressUser, setAddressUser] = useState("你");
  const [style, setStyle] = useState("");
  const [catchphrase, setCatchphrase] = useState("");
  const [saving, setSaving] = useState(false);
  const [isNew, setIsNew] = useState(false);

  useEffect(() => {
    fetchPersonas();
    setSelectedId(getActivePersonaId());
  }, []);

  async function fetchPersonas() {
    const res = await fetch("/api/personas");
    const data = await res.json();
    setPersonas(data.personas || []);
  }

  function selectPersona(p: Persona) {
    setSelectedId(p.id);
    setName(p.name);
    setAvatar(p.avatar);
    setTone(p.tone);
    setAddressUser(p.addressUser);
    setStyle(p.style);
    setCatchphrase(p.catchphrase);
    setIsNew(false);
    setActivePersonaId(p.id);
    window.dispatchEvent(new CustomEvent("deepbook:persona-changed", { detail: p }));
  }

  function startNew() {
    setSelectedId(null);
    setName("");
    setAvatar("🤖");
    setTone("");
    setAddressUser("你");
    setStyle("");
    setCatchphrase("");
    setIsNew(true);
  }

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    const body = { name: name.trim(), avatar, tone, addressUser, style, catchphrase };
    if (isNew || !selectedId) {
      const res = await fetch("/api/personas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.persona) {
        setSelectedId(data.persona.id);
        setIsNew(false);
        setActivePersonaId(data.persona.id);
        window.dispatchEvent(new CustomEvent("deepbook:persona-changed", { detail: data.persona }));
      }
    } else {
      await fetch("/api/personas", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedId, ...body }),
      });
    }
    fetchPersonas();
    setSaving(false);
  }

  async function handleDelete() {
    if (!selectedId) return;
    await fetch(`/api/personas?id=${selectedId}`, { method: "DELETE" });
    setSelectedId(null);
    setName(""); setAvatar("🤖"); setTone(""); setStyle(""); setCatchphrase("");
    setActivePersonaId(null);
    window.dispatchEvent(new CustomEvent("deepbook:persona-changed", { detail: null }));
    fetchPersonas();
  }

  function handleAiHelp() {
    const current = { name, avatar, tone, addressUser, style, catchphrase, id: selectedId, isNew };
    window.dispatchEvent(new CustomEvent("deepbook:edit-persona", { detail: current }));
  }

  return (
    <div className="flex h-[calc(100dvh-2.75rem)] flex-col">
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-white/5 px-3">
        <button onClick={onBack} className="text-xs text-zinc-500 hover:text-zinc-300">← 返回</button>
        <span className="text-xs font-medium text-zinc-400">智能体人格</span>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="mb-4 flex items-center gap-2">
          <select
            value={selectedId ?? ""}
            onChange={(e) => {
              const p = personas.find((x) => x.id === e.target.value);
              if (p) selectPersona(p);
            }}
            className="flex-1 rounded-lg bg-zinc-800 px-3 py-2 text-sm text-zinc-200 ring-1 ring-white/10 focus:outline-none"
          >
            <option value="" disabled>选择人格...</option>
            {personas.map((p) => (
              <option key={p.id} value={p.id}>{p.avatar} {p.name}</option>
            ))}
          </select>
          <button onClick={startNew} className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200" title="新增人格">
            <Plus size={16} />
          </button>
          <button onClick={handleAiHelp} disabled={!isNew && !selectedId} className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-blue-400 disabled:opacity-30" title="AI 辅助">
            <Bot size={16} />
          </button>
        </div>

        {(selectedId || isNew) && (
          <div className="space-y-4">
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="mb-1 block text-[11px] text-zinc-500">名称</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="如：小书" className="w-full rounded-lg bg-zinc-800 px-3 py-2 text-sm text-zinc-200 ring-1 ring-white/10 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-emerald-500/50" />
              </div>
              <div className="w-16">
                <label className="mb-1 block text-[11px] text-zinc-500">头像</label>
                <input type="text" value={avatar} onChange={(e) => setAvatar(e.target.value)} maxLength={2} className="w-full rounded-lg bg-zinc-800 px-3 py-2 text-center text-sm text-zinc-200 ring-1 ring-white/10 focus:outline-none focus:ring-1 focus:ring-emerald-500/50" />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-zinc-500">语气</label>
              <input type="text" value={tone} onChange={(e) => setTone(e.target.value)} placeholder="如：温暖鼓励、专业严谨、幽默毒舌" className="w-full rounded-lg bg-zinc-800 px-3 py-2 text-sm text-zinc-200 ring-1 ring-white/10 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-emerald-500/50" />
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-zinc-500">称呼用户</label>
              <input type="text" value={addressUser} onChange={(e) => setAddressUser(e.target.value)} placeholder="如：你、主人、老板" className="w-full rounded-lg bg-zinc-800 px-3 py-2 text-sm text-zinc-200 ring-1 ring-white/10 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-emerald-500/50" />
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-zinc-500">说话风格</label>
              <input type="text" value={style} onChange={(e) => setStyle(e.target.value)} placeholder="如：简洁、偶尔用颜文字 (。・∀・)ノ" className="w-full rounded-lg bg-zinc-800 px-3 py-2 text-sm text-zinc-200 ring-1 ring-white/10 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-emerald-500/50" />
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-zinc-500">口头禅</label>
              <input type="text" value={catchphrase} onChange={(e) => setCatchphrase(e.target.value)} placeholder="如：很高兴为你服务~" className="w-full rounded-lg bg-zinc-800 px-3 py-2 text-sm text-zinc-200 ring-1 ring-white/10 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-emerald-500/50" />
            </div>

            <div className="flex gap-2">
              <button onClick={handleSave} disabled={saving || !name.trim()} className="flex-1 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:opacity-50">
                {saving ? "保存中..." : isNew ? "创建" : "保存"}
              </button>
              {!isNew && (
                <button onClick={handleDelete} className="rounded-lg px-3 py-2 text-sm text-zinc-500 transition hover:bg-red-500/10 hover:text-red-400" title="删除">
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          </div>
        )}

        {!selectedId && !isNew && (
          <p className="py-8 text-center text-xs text-zinc-600">选择人格或点击 + 新建</p>
        )}
      </div>
    </div>
  );
}
