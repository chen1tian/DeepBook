"use client";

import { Users, MapPin, Calendar, User, GitBranch } from "lucide-react";

export type PanelType = "characters" | "location" | "time" | "protagonist" | "plot";

interface Props {
  activePanel: PanelType | null;
  onOpenPanel: (panel: PanelType) => void;
  hasData: boolean;
  hasPlotData?: boolean;
}

const items: { type: PanelType; icon: typeof Users; label: string; size: number }[] = [
  { type: "characters", icon: Users, label: "角色", size: 21 },
  { type: "location", icon: MapPin, label: "地点", size: 20 },
  { type: "time", icon: Calendar, label: "时间", size: 20 },
  { type: "protagonist", icon: User, label: "主角", size: 21 },
  { type: "plot", icon: GitBranch, label: "剧情", size: 20 },
];

function iconClass(type: PanelType, activePanel: PanelType | null, hasData: boolean, hasPlotData?: boolean): string {
  const active = activePanel === type;
  const isPlot = type === "plot";
  const dataAvail = isPlot ? hasPlotData : hasData;
  if (active) return "rounded p-1 text-purple-400";
  if (dataAvail) return "rounded p-1 text-zinc-400 hover:text-zinc-200";
  return "rounded p-1 text-zinc-600 hover:text-zinc-500";
}

export default function StoryStateBar({ activePanel, onOpenPanel, hasData, hasPlotData }: Props) {
  return (
    <div className="flex items-center gap-0.5">
      {items.map(({ type, icon: Icon, label, size }) => (
        <button
          key={type}
          onClick={() => onOpenPanel(type)}
          className={iconClass(type, activePanel, hasData, hasPlotData)}
          title={label}
        >
          <Icon size={size} />
        </button>
      ))}
    </div>
  );
}

