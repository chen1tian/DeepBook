"use client";

import { Plug, Sliders, User } from "lucide-react";

interface Props {
  onOpenConnection: () => void;
  onOpenPresets: () => void;
  onOpenPersonas: () => void;
  showPresets: boolean;
  showPersonas: boolean;
}

export default function Toolbar({ onOpenConnection, onOpenPresets, onOpenPersonas, showPresets, showPersonas }: Props) {
  return (
    <header className="sticky top-0 z-40 flex h-11 items-center gap-1 border-b border-white/5 bg-zinc-950 px-3">
      <span className="mr-2 text-xs font-medium text-zinc-500">DeepBook</span>

      <div className="flex items-center gap-1">
        <button
          onClick={onOpenConnection}
          title="连接"
          className="rounded-md p-1.5 text-zinc-500 transition hover:bg-white/5 hover:text-zinc-300"
        >
          <Plug size={16} />
        </button>
        <button
          onClick={onOpenPresets}
          title="预设"
          className={`rounded-md p-1.5 transition ${
            showPresets
              ? "bg-white/5 text-zinc-300"
              : "text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
          }`}
        >
          <Sliders size={16} />
        </button>
        <button
          onClick={onOpenPersonas}
          title="人格"
          className={`rounded-md p-1.5 transition ${
            showPersonas
              ? "bg-white/5 text-zinc-300"
              : "text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
          }`}
        >
          <User size={16} />
        </button>
      </div>

      <div className="flex-1" />
    </header>
  );
}
