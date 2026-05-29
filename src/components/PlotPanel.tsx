"use client";

import { useState, useEffect } from "react";
import { X, Plus, ChevronRight, ChevronDown, GitBranch, Loader2, Eye, EyeOff, Archive } from "lucide-react";
import type { PlotState, PlotLine, PlotNode } from "@/lib/plot-state-types";
import { getPlotSettings } from "@/lib/storage";

interface Props {
  open: boolean;
  onClose: () => void;
  dialogueId: string | null;
}

const statusColors: Record<PlotNode["status"], string> = {
  pending: "text-zinc-600",
  active: "text-emerald-400",
  completed: "text-blue-400",
  skipped: "text-zinc-700 line-through",
};

const statusDots: Record<PlotNode["status"], string> = {
  pending: "○",
  active: "●",
  completed: "◉",
  skipped: "⊗",
};

export default function PlotPanel({ open, onClose, dialogueId }: Props) {
  const [state, setState] = useState<PlotState>({ plotLines: [], lastAnalyzedAt: "", lastGeneratedAt: "" });
  const [expandedLines, setExpandedLines] = useState<Set<string>>(new Set());
  const [spoiler, setSpoiler] = useState(true);
  const [addingLine, setAddingLine] = useState(false);
  const [newIdea, setNewIdea] = useState("");
  const [refining, setRefining] = useState(false);

  useEffect(() => {
    if (open && dialogueId) loadState();
  }, [open, dialogueId]);

  useEffect(() => {
    setSpoiler(getPlotSettings().spoilerPrevention);
  }, [open]);

  async function loadState() {
    if (!dialogueId) return;
    try {
      const res = await fetch(`/api/plot-state?dialogueId=${dialogueId}`);
      if (res.ok) {
        const data = await res.json();
        setState(data.state);
      }
    } catch { /* */ }
  }

  function toggleLine(id: string) {
    setExpandedLines((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleAddLine() {
    if (!newIdea.trim() || !dialogueId) return;
    setRefining(true);
    try {
      const { getPlotSettings, getConnections, getConnectionConfig } = await import("@/lib/storage");
      const settings = getPlotSettings();
      let config = getConnectionConfig();
      if (settings.generationConnectionId) {
        const conns = getConnections();
        const picked = conns.find((c) => c.id === settings.generationConnectionId);
        if (picked) config = picked;
      }
      if (!config) { setRefining(false); return; }

      const res = await fetch("/api/refine-plot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idea: newIdea.trim(),
          baseUrl: config.baseUrl,
          apiKey: config.apiKey,
          modelId: config.modelId,
        }),
      });
      if (!res.ok) { setRefining(false); return; }
      const data = await res.json();

      const newLine: PlotLine = {
        id: `pl_${Date.now()}`,
        title: data.title || newIdea.slice(0, 30),
        nodes: (data.nodes || []).map((n: { content: string; order: number }) => ({
          id: `nd_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          content: n.content,
          status: "pending" as const,
          order: n.order,
        })),
        status: "active",
        createdAt: new Date().toISOString(),
      };

      const newState = { ...state, plotLines: [...state.plotLines, newLine] };
      setState(newState);
      // save to server
      await fetch("/api/plot-state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dialogueId, state: newState }),
      });
      setNewIdea("");
      setAddingLine(false);
    } catch { /* */ }
    setRefining(false);
  }

  if (!open) return null;

  const activeLines = state.plotLines.filter((l) => l.status === "active");
  const archivedLines = state.plotLines.filter((l) => l.status === "archived");
  const hasData = state.plotLines.length > 0;
  const activeNodeCount = state.plotLines.reduce(
    (sum, l) => sum + l.nodes.filter((n) => n.status === "active").length, 0
  );

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div
        className="flex h-full w-80 max-w-[90vw] flex-col bg-zinc-900 shadow-2xl ring-1 ring-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className="flex h-11 shrink-0 items-center justify-between border-b border-white/5 px-3">
          <div className="flex items-center gap-2">
            <GitBranch size={14} className="text-purple-400" />
            <span className="text-xs font-medium text-zinc-400">剧情</span>
            {activeNodeCount > 0 && (
              <span className="rounded bg-purple-500/20 px-1.5 py-0.5 text-[10px] text-purple-400">
                {activeNodeCount} 激活
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {spoiler && hasData && <EyeOff size={13} className="text-zinc-600" title="防剧透已启用" />}
            <button onClick={onClose} className="rounded p-1 text-zinc-500 hover:text-zinc-300">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* content */}
        <div className="flex-1 overflow-y-auto p-3">
          {/* add line button */}
          {addingLine ? (
            <div className="mb-3 rounded-lg bg-zinc-800 p-3">
              <textarea
                value={newIdea}
                onChange={(e) => setNewIdea(e.target.value)}
                placeholder="输入你想要的情节方向..."
                className="w-full resize-none rounded-lg bg-zinc-700 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-500 focus:outline-none"
                rows={3}
              />
              <div className="mt-2 flex gap-2">
                <button
                  onClick={handleAddLine}
                  disabled={refining || !newIdea.trim()}
                  className="flex items-center gap-1 rounded bg-purple-600 px-3 py-1.5 text-xs text-white hover:bg-purple-500 disabled:opacity-50"
                >
                  {refining ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                  生成节点
                </button>
                <button
                  onClick={() => { setAddingLine(false); setNewIdea(""); }}
                  className="rounded px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200"
                >
                  取消
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setAddingLine(true)}
              className="mb-3 flex w-full items-center justify-center gap-1 rounded-lg bg-zinc-800 px-3 py-2 text-xs text-zinc-400 ring-1 ring-white/10 hover:text-zinc-200"
            >
              <Plus size={13} /> 添加剧情线
            </button>
          )}

          {!hasData ? (
            <p className="py-8 text-center text-xs text-zinc-600">暂无剧情数据</p>
          ) : (
            <div className="space-y-3">
              {/* active lines */}
              {activeLines.map((line) => (
                <PlotLineCard
                  key={line.id}
                  line={line}
                  expanded={expandedLines.has(line.id)}
                  onToggle={() => toggleLine(line.id)}
                  spoiler={spoiler}
                />
              ))}

              {/* archived lines */}
              {archivedLines.length > 0 && (
                <div>
                  <div className="mb-2 flex items-center gap-1 text-[10px] text-zinc-600">
                    <Archive size={10} /> 已归档 ({archivedLines.length})
                  </div>
                  {archivedLines.map((line) => (
                    <PlotLineCard
                      key={line.id}
                      line={line}
                      expanded={expandedLines.has(line.id)}
                      onToggle={() => toggleLine(line.id)}
                      spoiler={spoiler}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PlotLineCard({
  line, expanded, onToggle, spoiler,
}: {
  line: PlotLine;
  expanded: boolean;
  onToggle: () => void;
  spoiler: boolean;
}) {
  const activeNode = line.nodes.find((n) => n.status === "active");
  const completedCount = line.nodes.filter((n) => n.status === "completed").length;

  return (
    <div className={`rounded-lg ring-1 transition ${
      line.status === "archived" ? "bg-zinc-800/50 ring-zinc-700/50" : "bg-zinc-800 ring-white/10"
    }`}>
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
      >
        {expanded ? <ChevronDown size={12} className="text-zinc-500" /> : <ChevronRight size={12} className="text-zinc-500" />}
        <span className={`flex-1 truncate text-sm ${line.status === "archived" ? "text-zinc-500" : "text-zinc-200"}`}>
          {line.title}
        </span>
        <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] ${
          activeNode ? "bg-emerald-500/20 text-emerald-400" :
          completedCount === line.nodes.length ? "bg-blue-500/20 text-blue-400" :
          "bg-zinc-700 text-zinc-500"
        }`}>
          {activeNode ? "进行中" : completedCount === line.nodes.length ? "已完成" : "等待中"}
        </span>
      </button>

      {expanded && (
        <div className="border-t border-white/5 px-3 pb-2 pt-1">
          {spoiler ? (
            <p className="py-2 text-center text-[11px] text-zinc-600">
              <EyeOff size={11} className="inline mr-1" />
              防剧透模式已启用
            </p>
          ) : (
            <div className="space-y-0.5">
              {line.nodes.map((node, i) => (
                <div key={node.id} className="flex items-start gap-2 py-1">
                  <span className={`mt-0.5 text-[10px] ${statusColors[node.status]}`}>
                    {statusDots[node.status]}
                  </span>
                  <span className={`flex-1 text-[11px] leading-relaxed ${statusColors[node.status]}`}>
                    {node.content}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
