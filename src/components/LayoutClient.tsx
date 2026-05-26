"use client";

import { useState } from "react";
import Toolbar from "@/components/Toolbar";
import ConnectionDialog from "@/components/ConnectionDialog";
import FloatingChat from "@/components/FloatingChat";

export default function LayoutClient({ children }: { children: React.ReactNode }) {
  const [connectionOpen, setConnectionOpen] = useState(false);

  return (
    <>
      <Toolbar onOpenConnection={() => setConnectionOpen(true)} />
      <main className="min-h-[calc(100dvh-2.75rem)]">{children}</main>
      <FloatingChat />
      <ConnectionDialog open={connectionOpen} onClose={() => setConnectionOpen(false)} />
    </>
  );
}
