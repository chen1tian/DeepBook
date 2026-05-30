"use client";

import { useState, useEffect } from "react";
import { X, ArrowLeft, Upload } from "lucide-react";
import type { CharacterInfo } from "@/lib/story-state-types";

interface Props {
  open: boolean;
  onClose: () => void;
  characters: CharacterInfo[];
  onAvatarUpload?: (characterName: string, file: File) => Promise<string | null>;
}

const AVATAR_COLORS = [
  "bg-rose-500", "bg-orange-500", "bg-amber-500", "bg-emerald-500",
  "bg-teal-500", "bg-sky-500", "bg-indigo-500", "bg-violet-500",
  "bg-pink-500", "bg-lime-500", "bg-cyan-500", "bg-fuchsia-500",
];

function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function avatarUrl(filename: string): string | null {
  if (filename === "default" || !filename) return null;
  return `/api/avatars?file=${filename}`;
}

function AvatarImage({ char, size }: { char: { name: string; avatar: string }; size: "sm" | "lg" }) {
  const url = avatarUrl(char.avatar);
  const dims = size === "lg" ? "h-20 w-20 text-2xl" : "h-10 w-10 text-sm";
  const [imgKey, setImgKey] = useState(0);

  // Force refresh when avatar filename changes
  useEffect(() => {
    setImgKey((k) => k + 1);
  }, [char.avatar]);

  if (url) {
    return (
      <img
        key={imgKey}
        src={`${url}&t=${imgKey}`}
        alt={char.name}
        className={`${dims} shrink-0 rounded-full object-cover ring-1 ring-white/10`}
      />
    );
  }

  const firstChar = char.name.charAt(0);
  return (
    <div className={`${dims} shrink-0 rounded-full ${avatarColor(char.name)} flex items-center justify-center font-bold text-white ring-1 ring-white/10`}>
      {firstChar}
    </div>
  );
}

export default function CharacterPanel({ open, onClose, characters, onAvatarUpload }: Props) {
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Derive selected from characters to stay in sync after uploads
  const selected = selectedName ? characters.find((c) => c.name === selectedName) || null : null;

  if (!open) return null;

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>, name: string) {
    const file = e.target.files?.[0];
    if (!file || !onAvatarUpload) return;
    setUploading(true);
    await onAvatarUpload(name, file);
    setUploading(false);
  }

  if (selected) {
    return (
      <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
        <div
          className="flex h-full w-80 max-w-[90vw] flex-col bg-zinc-900 shadow-2xl ring-1 ring-white/10"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex h-11 shrink-0 items-center gap-2 border-b border-white/5 px-3">
            <button onClick={() => setSelectedName(null)} className="rounded p-1 text-zinc-500 hover:text-zinc-300">
              <ArrowLeft size={16} />
            </button>
            <span className="text-xs font-medium text-zinc-400">{selected.name}</span>
            <button onClick={onClose} className="ml-auto rounded p-1 text-zinc-500 hover:text-zinc-300">
              <X size={16} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* avatar */}
            <div className="flex flex-col items-center gap-2">
              <div className="relative group">
                <AvatarImage char={selected} size="lg" />
                {onAvatarUpload && (
                  <label className="absolute inset-0 flex cursor-pointer items-center justify-center rounded-full bg-black/50 opacity-0 transition group-hover:opacity-100">
                    <Upload size={16} className="text-white" />
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleAvatarUpload(e, selected.name)}
                      disabled={uploading}
                    />
                  </label>
                )}
              </div>
              {uploading && <span className="text-[10px] text-zinc-500">上传中...</span>}
            </div>

            {/* fields */}
            <Field label="名字" value={selected.name} />
            <Field label="别名/外号" value={selected.alias} />
            <Field label="人设" value={selected.persona} />
            <Field label="外观" value={selected.appearance} />
            <Field label="喜好" value={selected.preferences} />
            <Field label="背景" value={selected.background} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div
        className="flex h-full w-80 max-w-[90vw] flex-col bg-zinc-900 shadow-2xl ring-1 ring-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex h-11 shrink-0 items-center justify-between border-b border-white/5 px-3">
          <span className="text-xs font-medium text-zinc-400">角色列表</span>
          <button onClick={onClose} className="rounded p-1 text-zinc-500 hover:text-zinc-300">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {characters.length === 0 ? (
            <p className="py-8 text-center text-xs text-zinc-600">暂无角色数据</p>
          ) : (
            <div className="space-y-1">
              {characters.map((char) => (
                <button
                  key={char.name}
                  onClick={() => setSelectedName(char.name)}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition hover:bg-zinc-800"
                >
                  <AvatarImage char={char} size="sm" />
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-zinc-200">{char.name}</div>
                    {char.alias && (
                      <div className="truncate text-[11px] text-zinc-500">{char.alias}</div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div>
      <div className="text-[10px] font-medium text-zinc-600 uppercase tracking-wide">{label}</div>
      <div className="mt-0.5 text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">{value}</div>
    </div>
  );
}
