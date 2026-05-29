"use client";

import { Users, MapPin, Calendar, User } from "lucide-react";

export type PanelType = "characters" | "location" | "time" | "protagonist";

interface Props {
  activePanel: PanelType | null;
  onOpenPanel: (panel: PanelType) => void;
  hasData: boolean;
}

const items: { type: PanelType; icon: typeof Users; label: string; size: number }[] = [
  { type: "characters", icon: Users, label: "角色", size: 15 },
  { type: "location", icon: MapPin, label: "地点", size: 14 },
  { type: "time", icon: Calendar, label: "时间", size: 14 },
  { type: "protagonist", icon: User, label: "主角", size: 15 },
];

export default function StoryStateBar({ activePanel, onOpenPanel, hasData }: Props) {
  return (
    <div className="flex items-center gap-0.5">
      {items.map(({ type, icon: Icon, label, size }) => (
        <button
          key={type}
          onClick={() => onOpenPanel(type)}
          className={`rounded p-1 transition ${
            activePanel === type
              ? "text-emerald-400"
              : hasData
                ? "text-zinc-400 hover:text-zinc-200"
                : "text-zinc-600 hover:text-zinc-500"
          }`}
          title={label}
        >
          <Icon size={size} />
        </button>
      ))}
    </div>
  );
}
