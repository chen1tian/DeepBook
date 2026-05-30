"use client";

import { useState, useEffect } from "react";
import { X, ScrollText } from "lucide-react";
import { getCompactionThreshold, saveCompactionThreshold } from "@/lib/storage";

interface Props {
  open: boolean;
  onClose: () => void;
  dialogueId: string | null;
}

export default function HistoryPanel({ open, onClose, dialogueId }: Props) {
  const [summary, setSummary] = useState("");
  const [threshold, setThreshold] = useState(30);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (open) {
      setThreshold(getCompactionThreshold());
      setSaved(false);
      if (dialogueId) {
        fetch(`/api/dialogue?dialogueId=${dialogueId}`)
          .then((r) => r.json())
          .then((d) => setSummary(d.compactionSummary || ""))
          .catch(() => {});
      }
    }
  }, [open, dialogueId]);

  function handleSaveThreshold() {
    saveCompactionThreshold(threshold);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div
        className="flex h-full w-96 max-w-[90vw] flex-col bg-zinc-900 shadow-2xl ring-1 ring-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex h-11 shrink-0 items-center justify-between border-b border-white/5 px-3">
          <div className="flex items-center gap-2">
            <ScrollText size={14} className="text-amber-400" />
            <span className="text-xs font-medium text-zinc-400">历史记录摘要</span>
          </div>
          <button onClick={onClose} className="rounded p-1 text-zinc-500 hover:text-zinc-300">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {summary ? (
            <div className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">{summary}</div>
          ) : (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-zinc-600">
                暂无历史摘要。对话超过设置的消息数后会自动生成。
              </p>
            </div>
          )}
        </div>

        {/* threshold setting */}
        <div className="border-t border-white/5 p-4">
          <label className="mb-2 block text-[11px] text-zinc-500">
            摘要触发阈值（{threshold} 条消息后自动压缩）
          </label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={10}
              max={100}
              step={5}
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              className="flex-1 accent-amber-500"
            />
            <button
              onClick={handleSaveThreshold}
              className={`shrink-0 rounded px-3 py-1.5 text-xs font-medium transition ${
                saved
                  ? "bg-amber-500/20 text-amber-400"
                  : "bg-amber-600 text-white hover:bg-amber-500"
              }`}
            >
              {saved ? "已保存" : "保存"}
            </button>
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-zinc-600">
            <span>10 (频繁)</span>
            <span>100 (长对话)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
