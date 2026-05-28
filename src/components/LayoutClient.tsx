"use client";

import { useState } from "react";
import Toolbar from "@/components/Toolbar";
import ConnectionDialog from "@/components/ConnectionDialog";
import FloatingChat from "@/components/FloatingChat";
import { ViewProvider, useView } from "@/lib/view-context";

function LayoutInner({ children }: { children: React.ReactNode }) {
  const [connectionOpen, setConnectionOpen] = useState(false);
  const { showPresets, togglePresets, showPersonas, togglePersonas } = useView();

  return (
    <>
      <Toolbar
        onOpenConnection={() => setConnectionOpen(true)}
        onOpenPresets={togglePresets}
        onOpenPersonas={togglePersonas}
        showPresets={showPresets}
        showPersonas={showPersonas}
      />
      <main className="min-h-[calc(100dvh-2.75rem)]">{children}</main>
      <FloatingChat />
      <ConnectionDialog open={connectionOpen} onClose={() => setConnectionOpen(false)} />
    </>
  );
}

export default function LayoutClient({ children }: { children: React.ReactNode }) {
  return (
    <ViewProvider>
      <LayoutInner>{children}</LayoutInner>
    </ViewProvider>
  );
}
