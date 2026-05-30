"use client";

import { useState, useRef, useEffect } from "react";
import { Users, MapPin, Calendar, User, GitBranch, Ellipsis, Settings, BookOpen } from "lucide-react";

export type PanelType = "characters" | "location" | "time" | "protagonist" | "plot" | "settings";

interface Props {
  activePanel: PanelType | null;
  onOpenPanel: (panel: PanelType) => void;
  hasData: boolean;
  hasPlotData?: boolean;
  hasSettingsData?: boolean;
  onOpenAnalysisSettings?: () => void;
  onOpenPlotSettings?: () => void;
}

interface ToolItem {
  type: PanelType | "analysisSettings" | "plotSettings";
  icon: typeof Users;
  label: string;
  size: number;
  isPanel: boolean; // true = opens a side panel, false = opens settings dialog
  panelType?: PanelType; // the actual PanelType for side panels
}

const mainTools: ToolItem[] = [
  { type: "characters", icon: Users, label: "角色", size: 21, isPanel: true, panelType: "characters" },
  { type: "location", icon: MapPin, label: "地点", size: 20, isPanel: true, panelType: "location" },
  { type: "time", icon: Calendar, label: "时间", size: 20, isPanel: true, panelType: "time" },
  { type: "protagonist", icon: User, label: "主角", size: 21, isPanel: true, panelType: "protagonist" },
];

const moreTools: ToolItem[] = [
  { type: "plot", icon: GitBranch, label: "剧情", size: 18, isPanel: true, panelType: "plot" },
  { type: "settings", icon: BookOpen, label: "世界设定", size: 18, isPanel: true, panelType: "settings" },
  { type: "analysisSettings", icon: Settings, label: "分析设置", size: 18, isPanel: false },
  { type: "plotSettings", icon: Settings, label: "剧情设置", size: 18, isPanel: false },
];

function iconClass(active: boolean, hasData: boolean): string {
  if (active) return "rounded p-1 text-purple-400";
  if (hasData) return "rounded p-1 text-zinc-400 hover:text-zinc-200";
  return "rounded p-1 text-zinc-600 hover:text-zinc-500";
}

export default function StoryStateBar({
  activePanel, onOpenPanel, hasData, hasPlotData, hasSettingsData,
  onOpenAnalysisSettings, onOpenPlotSettings,
}: Props) {
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleToolClick(tool: ToolItem) {
    if (tool.isPanel && tool.panelType) {
      onOpenPanel(tool.panelType);
    } else if (tool.type === "analysisSettings") {
      onOpenAnalysisSettings?.();
    } else if (tool.type === "plotSettings") {
      onOpenPlotSettings?.();
    }
    setMoreOpen(false);
  }

  function getHasData(type: string): boolean {
    switch (type) {
      case "plot": return !!hasPlotData;
      case "settings": return !!hasSettingsData;
      default: return hasData;
    }
  }

  return (
    <div className="flex items-center gap-0.5">
      {/* Main 4 tools */}
      {mainTools.map((tool) => (
        <button
          key={tool.type}
          onClick={() => tool.panelType && onOpenPanel(tool.panelType)}
          className={iconClass(activePanel === tool.type, hasData)}
          title={tool.label}
        >
          <tool.icon size={tool.size} />
        </button>
      ))}

      {/* More button */}
      <div className="relative" ref={moreRef}>
        <button
          onClick={() => setMoreOpen((v) => !v)}
          className={`rounded p-1 transition ${moreOpen ? "text-purple-400" : "text-zinc-500 hover:text-zinc-300"}`}
          title="更多"
        >
          <Ellipsis size={18} />
        </button>

        {moreOpen && (
          <div className="absolute right-0 top-full z-50 mt-1 w-48 rounded-xl bg-zinc-800 p-2 shadow-2xl ring-1 ring-white/10">
            <div className="grid grid-cols-2 gap-1">
              {moreTools.map((tool) => {
                const isActive = tool.isPanel && tool.panelType ? activePanel === tool.panelType : false;
                return (
                  <button
                    key={tool.type}
                    onClick={() => handleToolClick(tool)}
                    className={`flex flex-col items-center gap-1 rounded-lg px-2 py-2.5 text-center transition ${
                      isActive
                        ? "bg-purple-500/15 text-purple-400"
                        : "text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
                    }`}
                    title={tool.label}
                  >
                    <tool.icon size={tool.size} />
                    <span className="text-[10px] leading-none">{tool.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

