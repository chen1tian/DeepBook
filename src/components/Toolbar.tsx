"use client";

import { useState, useEffect } from "react";
import { Plug, Sliders } from "lucide-react";
import { getConnectionConfig } from "@/lib/storage";
import AccountPanel from "@/components/AccountPanel";
import type { AuthUser } from "@/lib/auth-context";

interface Props {
  onOpenConnection: () => void;
  onOpenPresets: () => void;
  showPresets: boolean;
  onOpenPersonas: () => void;
  showPersonas: boolean;
  user: AuthUser | null;
  multiUser: boolean;
  onLogout: () => Promise<void>;
}

export default function Toolbar({
  onOpenConnection, onOpenPresets, showPresets,
  onOpenPersonas, showPersonas,
  user, multiUser, onLogout,
}: Props) {
  const [connName, setConnName] = useState("");

  useEffect(() => {
    const update = () => {
      const cfg = getConnectionConfig();
      setConnName(cfg?.name || "");
    };
    update();
    // listen for connection changes
    window.addEventListener("deepbook:connection-changed", update);
    window.addEventListener("focus", update);
    return () => {
      window.removeEventListener("deepbook:connection-changed", update);
      window.removeEventListener("focus", update);
    };
  }, []);

  return (
    <header className="sticky top-0 z-40 flex h-11 items-center gap-1 border-b border-white/5 bg-zinc-950 px-3">
      <span className="mr-2 text-xs font-medium text-zinc-500">DeepBook</span>
      <div className="flex items-center gap-1">
        <button onClick={onOpenConnection} title="连接" className="flex items-center gap-1.5 rounded-md p-1.5 text-zinc-500 transition hover:bg-white/5 hover:text-zinc-300">
          <Plug size={16} />
          {connName && (
            <span className="max-w-[100px] truncate text-[11px] text-zinc-500">{connName}</span>
          )}
        </button>
        <button onClick={onOpenPresets} title="预设" className={`rounded-md p-1.5 transition ${showPresets ? "bg-white/5 text-zinc-300" : "text-zinc-500 hover:bg-white/5 hover:text-zinc-300"}`}>
          <Sliders size={16} />
        </button>
      </div>
      <div className="flex-1" />
      {/* 账户面板（多用户模式下可见） */}
      {multiUser && user && (
        <AccountPanel user={user} onLogout={onLogout} />
      )}
    </header>
  );
}
