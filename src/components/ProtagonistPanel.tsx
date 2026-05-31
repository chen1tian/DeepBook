"use client";

import { useState, useEffect } from "react";
import { X, Upload } from "lucide-react";
import type { CharacterInfo } from "@/lib/story-state-types";

interface Props {
  open: boolean;
  onClose: () => void;
  protagonist: CharacterInfo | null;
  onAvatarUpload?: (file: File) => Promise<string | null>;
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

export default function ProtagonistPanel({ open, onClose, protagonist, onAvatarUpload }: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div
        className="flex h-full w-80 max-w-[90vw] flex-col bg-zinc-900 shadow-2xl ring-1 ring-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex h-11 shrink-0 items-center justify-between border-b border-white/5 px-3">
          <span className="text-xs font-medium text-zinc-400">主角</span>
          <button onClick={onClose} className="rounded p-1 text-zinc-500 hover:text-zinc-300">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {protagonist ? (
            <div className="space-y-4">
              {/* avatar */}
              <div className="flex flex-col items-center gap-2">
                <div className="relative group">
                  <AvatarImage char={protagonist} size="lg" />
                  {onAvatarUpload && (
                    <label className="absolute inset-0 flex cursor-pointer items-center justify-center rounded-full bg-black/50 opacity-0 transition group-hover:opacity-100">
                      <Upload size={16} className="text-white" />
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file && onAvatarUpload) await onAvatarUpload(file);
                        }}
                      />
                    </label>
                  )}
                </div>
              </div>

              <Field label="名字" value={protagonist.name} />
              <Field label="别名/外号" value={protagonist.alias} />
              <Field label="人设" value={protagonist.persona} />
              <Field label="外观" value={protagonist.appearance} />
              <ItemsField label="物品" items={protagonist.items} />
              <Field label="喜好" value={protagonist.preferences} />
              <Field label="背景" value={protagonist.background} />
              <LifeEventsField events={protagonist.lifeEvents} />
            </div>
          ) : (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-zinc-600">暂无主角数据</p>
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

function ItemsField({ label, items }: { label: string; items?: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <div className="text-[10px] font-medium text-zinc-600 uppercase tracking-wide">{label}</div>
      <div className="mt-1 grid grid-cols-2 gap-1">
        {items.map((item, i) => (
          <div key={i} className="rounded-md bg-zinc-800 px-2 py-1 text-xs text-zinc-300 truncate" title={item}>
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

function LifeEventsField({ events }: { events?: { date: string; description: string; cause: string; effect: string; relatedCharacters: string[] }[] }) {
  if (!events || events.length === 0) return null;
  const sorted = [...events].sort((a, b) => b.date.localeCompare(a.date));
  return (
    <div>
      <div className="text-[10px] font-medium text-zinc-600 uppercase tracking-wide">人生经历 · 因果</div>
      <div className="mt-1 space-y-2">
        {sorted.map((e, i) => (
          <div key={i} className="rounded-lg bg-zinc-800/50 px-3 py-2 ring-1 ring-white/5">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-zinc-500">{e.date}</span>
              <span className="text-sm font-medium text-zinc-200">{e.description}</span>
            </div>
            {e.cause && <div className="mt-1 text-[11px] text-zinc-500">← {e.cause}</div>}
            {e.effect && <div className="text-[11px] text-zinc-400">→ {e.effect}</div>}
            {e.relatedCharacters && e.relatedCharacters.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {e.relatedCharacters.map((rc) => (
                  <span key={rc} className="rounded bg-zinc-700 px-1.5 py-0.5 text-[10px] text-zinc-400">{rc}</span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
