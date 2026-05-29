"use client";

import { X, Upload } from "lucide-react";
import type { CharacterInfo } from "@/lib/story-state-types";

interface Props {
  open: boolean;
  onClose: () => void;
  protagonist: CharacterInfo | null;
  onAvatarUpload?: (file: File) => Promise<string | null>;
}

function avatarUrl(filename: string): string {
  if (filename === "default" || !filename) return "/avatars/default.png";
  return `/api/avatars?file=${filename}`;
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
                  <img
                    src={avatarUrl(protagonist.avatar)}
                    alt={protagonist.name}
                    className="h-20 w-20 rounded-full object-cover ring-2 ring-white/10"
                  />
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
              <Field label="喜好" value={protagonist.preferences} />
              <Field label="背景" value={protagonist.background} />
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
