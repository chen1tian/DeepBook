"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import {
  getPlotSettings,
  savePlotSettings,
  getConnections,
} from "@/lib/storage";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function PlotSettingsPanel({ open, onClose }: Props) {
  const [messageCount, setMessageCount] = useState(20);
  const [genConnId, setGenConnId] = useState("");
  const [anaConnId, setAnaConnId] = useState("");
  const [spoiler, setSpoiler] = useState(true);
  const [autoGen, setAutoGen] = useState(true);
  const [maxActiveLines, setMaxActiveLines] = useState(10);
  const [connections, setConnections] = useState<{ id: string; name: string }[]>([]);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (open) {
      const s = getPlotSettings();
      setMessageCount(s.messageCount);
      setGenConnId(s.generationConnectionId);
      setAnaConnId(s.analysisConnectionId);
      setSpoiler(s.spoilerPrevention);
      setAutoGen(s.autoGenerate);
      setMaxActiveLines(s.maxActiveLines ?? 10);
      setConnections(getConnections().map((c) => ({ id: c.id, name: c.name })));
      setSaved(false);
    }
  }, [open]);

  function handleSave() {
    savePlotSettings({
      messageCount,
      generationConnectionId: genConnId,
      analysisConnectionId: anaConnId,
      spoilerPrevention: spoiler,
      autoGenerate: autoGen,
      maxActiveLines,
    });
    setSaved(true);
    setTimeout(() => {
      onClose();
      window.dispatchEvent(new CustomEvent("deepbook:plot-settings-changed"));
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
          <h2 className="text-sm font-medium text-zinc-200">剧情设置</h2>
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
              type="range" min={5} max={50} step={5}
              value={messageCount}
              onChange={(e) => setMessageCount(Number(e.target.value))}
              className="w-full accent-purple-500"
            />
            <div className="flex justify-between text-[10px] text-zinc-600">
              <span>5</span><span>50</span>
            </div>
          </div>

          {/* generation connection */}
          <div>
            <label className="mb-1 block text-[11px] text-zinc-500">产生剧情（高智商 AI）</label>
            {connections.length === 0 ? (
              <p className="text-xs text-zinc-600">暂无可用连接</p>
            ) : (
              <select
                value={genConnId}
                onChange={(e) => setGenConnId(e.target.value)}
                className="w-full rounded-lg bg-zinc-800 px-3 py-2 text-sm text-zinc-200 ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
              >
                <option value="">使用默认连接</option>
                {connections.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            )}
          </div>

          {/* analysis connection */}
          <div>
            <label className="mb-1 block text-[11px] text-zinc-500">分析剧情（简单 AI）</label>
            {connections.length === 0 ? (
              <p className="text-xs text-zinc-600">暂无可用连接</p>
            ) : (
              <select
                value={anaConnId}
                onChange={(e) => setAnaConnId(e.target.value)}
                className="w-full rounded-lg bg-zinc-800 px-3 py-2 text-sm text-zinc-200 ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
              >
                <option value="">使用默认连接</option>
                {connections.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            )}
          </div>

          {/* max active plot lines */}
          <div>
            <label className="mb-1 block text-[11px] text-zinc-500">
              最大激活剧情线（{maxActiveLines} 条）
            </label>
            <input
              type="range" min={3} max={30} step={1}
              value={maxActiveLines}
              onChange={(e) => setMaxActiveLines(Number(e.target.value))}
              className="w-full accent-purple-500"
            />
            <div className="flex justify-between text-[10px] text-zinc-600">
              <span>3</span><span>30</span>
            </div>
          </div>

          {/* toggles */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={spoiler}
                onChange={(e) => setSpoiler(e.target.checked)}
                className="accent-purple-500"
              />
              <span className="text-sm text-zinc-300">防剧透模式</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={autoGen}
                onChange={(e) => setAutoGen(e.target.checked)}
                className="accent-purple-500"
              />
              <span className="text-sm text-zinc-300">自动生成剧情线</span>
            </label>
          </div>

          <button
            onClick={handleSave}
            disabled={saved}
            className={`w-full rounded-lg px-3 py-2 text-sm font-medium transition ${
              saved ? "bg-purple-600/20 text-purple-400" : "bg-purple-600 text-white hover:bg-purple-500"
            }`}
          >
            {saved ? "已保存 ✓" : "保存设置"}
          </button>
        </div>
      </div>
    </div>
  );
}
