"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import {
  getAnalysisSettings,
  saveAnalysisSettings,
  getConnections,
} from "@/lib/storage";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function AnalysisSettingsPanel({ open, onClose }: Props) {
  const [messageCount, setMessageCount] = useState(20);
  const [connectionId, setConnectionId] = useState("");
  const [connections, setConnections] = useState<{ id: string; name: string }[]>([]);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (open) {
      const settings = getAnalysisSettings();
      setMessageCount(settings.messageCount);
      setConnectionId(settings.connectionId);
      setConnections(getConnections().map((c) => ({ id: c.id, name: c.name })));
      setSaved(false);
    }
  }, [open]);

  function handleSave() {
    saveAnalysisSettings({ messageCount, connectionId: connectionId || "" });
    setSaved(true);
    setTimeout(() => {
      onClose();
      window.dispatchEvent(new CustomEvent("deepbook:settings-changed"));
    }, 600);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-xl bg-zinc-900 p-5 shadow-2xl ring-1 ring-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-medium text-zinc-200">分析设置</h2>
          <button onClick={onClose} className="rounded p-1 text-zinc-500 hover:text-zinc-300">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4">
          {/* message count */}
          <div>
            <label className="mb-1 block text-[11px] text-zinc-500">
              分析消息数量（{messageCount} 条）
            </label>
            <input
              type="range"
              min={5}
              max={50}
              step={5}
              value={messageCount}
              onChange={(e) => setMessageCount(Number(e.target.value))}
              className="w-full accent-emerald-500"
            />
            <div className="flex justify-between text-[10px] text-zinc-600">
              <span>5</span>
              <span>50</span>
            </div>
          </div>

          {/* connection selector */}
          <div>
            <label className="mb-1 block text-[11px] text-zinc-500">使用连接</label>
            {connections.length === 0 ? (
              <p className="text-xs text-zinc-600">暂无可用连接</p>
            ) : (
              <select
                value={connectionId}
                onChange={(e) => setConnectionId(e.target.value)}
                className="w-full rounded-lg bg-zinc-800 px-3 py-2 text-sm text-zinc-200 ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              >
                <option value="">使用默认连接</option>
                {connections.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <button
            onClick={handleSave}
            disabled={saved}
            className={`w-full rounded-lg px-3 py-2 text-sm font-medium transition ${
              saved
                ? "bg-emerald-600/20 text-emerald-400"
                : "bg-emerald-600 text-white hover:bg-emerald-500"
            }`}
          >
            {saved ? "已保存 ✓" : "保存设置"}
          </button>
        </div>
      </div>
    </div>
  );
}
