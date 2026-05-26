"use client";

import { Plug } from "lucide-react";

interface Props {
  onOpenConnection: () => void;
}

export default function Toolbar({ onOpenConnection }: Props) {
  return (
    <header className="sticky top-0 z-40 flex h-11 items-center gap-1 border-b border-white/5 bg-zinc-950 px-3">
      {/* brand */}
      <span className="mr-2 text-xs font-medium text-zinc-500">DeepBook</span>

      {/* tools */}
      <div className="flex items-center gap-1">
        <button
          onClick={onOpenConnection}
          title="连接"
          className="rounded-md p-1.5 text-zinc-500 transition hover:bg-white/5 hover:text-zinc-300"
        >
          <Plug size={16} />
        </button>
      </div>

      {/* spacer */}
      <div className="flex-1" />
    </header>
  );
}
