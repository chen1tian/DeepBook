"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { getDisplayMessageCount, saveDisplayMessageCount, getFontSize, saveFontSize, getQuoteColor, saveQuoteColor } from "@/lib/storage";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function AppSettingsPanel({ open, onClose }: Props) {
  const [displayCount, setDisplayCount] = useState(30);
  const [fontSize, setFontSize] = useState(14);
  const [quoteColor, setQuoteColor] = useState("#ca824e");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (open) {
      setDisplayCount(getDisplayMessageCount());
      setFontSize(getFontSize());
      setQuoteColor(getQuoteColor());
      setSaved(false);
    }
  }, [open]);

  function handleSave() {
    saveDisplayMessageCount(displayCount);
    saveFontSize(fontSize);
    saveQuoteColor(quoteColor);
    setSaved(true);
    setTimeout(() => {
      onClose();
      window.dispatchEvent(new CustomEvent("deepbook:settings-changed"));
    }, 500);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-xl bg-zinc-900 p-5 shadow-2xl ring-1 ring-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-medium text-zinc-200">应用设置</h2>
          <button onClick={onClose} className="rounded p-1 text-zinc-500 hover:text-zinc-300">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-[11px] text-zinc-500">
              对话显示条数（{displayCount} 条）
            </label>
            <input
              type="range"
              min={10}
              max={200}
              step={10}
              value={displayCount}
              onChange={(e) => setDisplayCount(Number(e.target.value))}
              className="w-full accent-zinc-400"
            />
            <div className="flex justify-between text-[10px] text-zinc-600">
              <span>10</span>
              <span>200</span>
            </div>
            <p className="mt-1 text-[10px] text-zinc-600">
              仅控制界面显示数量，不影响对话数据和 AI 上下文。
            </p>
          </div>

          <div>
            <label className="mb-1 block text-[11px] text-zinc-500">
              对话文字大小（{fontSize}px）
            </label>
            <input
              type="range"
              min={12}
              max={22}
              step={1}
              value={fontSize}
              onChange={(e) => setFontSize(Number(e.target.value))}
              className="w-full accent-zinc-400"
            />
            <div className="flex justify-between text-[10px] text-zinc-600">
              <span>12px</span>
              <span>22px</span>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[11px] text-zinc-500">
              对话引用颜色
            </label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={quoteColor}
                onChange={(e) => setQuoteColor(e.target.value)}
                className="h-8 w-12 cursor-pointer rounded border-0 bg-transparent"
              />
              <span className="text-xs text-zinc-400">{quoteColor}</span>
              <span className="text-xs" style={{ color: quoteColor }}>预览</span>
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={saved}
            className={`w-full rounded-lg px-3 py-2 text-sm font-medium transition ${
              saved ? "bg-zinc-600/20 text-zinc-400" : "bg-zinc-600 text-white hover:bg-zinc-500"
            }`}
          >
            {saved ? "已保存 ✓" : "保存设置"}
          </button>
        </div>
      </div>
    </div>
  );
}
