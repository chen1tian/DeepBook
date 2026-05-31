"use client";

import { useState, useEffect } from "react";
import Toolbar from "@/components/Toolbar";
import ConnectionDialog from "@/components/ConnectionDialog";
import AppSettingsPanel from "@/components/AppSettingsPanel";
import FloatingChat from "@/components/FloatingChat";
import LoginPage from "@/components/LoginPage";
import { ViewProvider, useView } from "@/lib/view-context";
import { AuthProvider, useAuth } from "@/lib/auth-context";

function LayoutInner({ children }: { children: React.ReactNode }) {
  const [connectionOpen, setConnectionOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { showPresets, togglePresets, showPersonas, togglePersonas } = useView();
  const { user, loading, needsSetup, multiUser, logout } = useAuth();

  // 监听全局"打开连接面板"事件（聊天组件在无连接时触发）
  useEffect(() => {
    function handleOpen() {
      setConnectionOpen(true);
    }
    window.addEventListener("deepbook:open-connection", handleOpen);
    return () => window.removeEventListener("deepbook:open-connection", handleOpen);
  }, []);

  // Loading spinner while checking auth
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <div className="w-8 h-8 border-2 border-zinc-600 border-t-zinc-300 rounded-full animate-spin" />
      </div>
    );
  }

  // Needs initial setup (single-user mode, no users yet)
  if (!user && needsSetup) {
    return <LoginPage mode="setup" />;
  }

  // Multi-user mode, not logged in
  if (!user && multiUser) {
    return <LoginPage mode="login" />;
  }

  // Logged in or single-user auto-login
  return (
    <>
      <Toolbar
        onOpenConnection={() => setConnectionOpen(true)}
        onOpenPresets={togglePresets}
        showPresets={showPresets}
        onOpenPersonas={togglePersonas}
        showPersonas={showPersonas}
        onOpenSettings={() => setSettingsOpen(true)}
        user={user}
        multiUser={multiUser}
        onLogout={logout}
      />
      <main className="min-h-[calc(100dvh-2.75rem)]">{children}</main>
      <FloatingChat />
      <ConnectionDialog open={connectionOpen} onClose={() => setConnectionOpen(false)} />
      <AppSettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}

export default function LayoutClient({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ViewProvider>
        <LayoutInner>{children}</LayoutInner>
      </ViewProvider>
    </AuthProvider>
  );
}
