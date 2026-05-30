"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { setStorageUserId, loadConnectionsFromServer, loadPrefsFromServer } from "@/lib/storage";

export interface AuthUser {
  id: string;
  username: string;
  createdAt: string;
  isDefault: boolean;
}

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  needsSetup: boolean;
  multiUser: boolean;
  error: string | null;
}

interface AuthContextType extends AuthState {
  login: (username: string, password: string, remember: boolean) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  setup: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

const REMEMBERED_USERNAME_KEY = "deepbook_remembered_username";

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

async function apiCall(url: string, body?: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(url, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error((data as { error?: string }).error || "请求失败");
  return data;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    needsSetup: false,
    multiUser: false,
    error: null,
  });

  // 检查登录状态
  useEffect(() => {
    (async () => {
      try {
        const data = (await apiCall("/api/auth/check")) as {
          authenticated: boolean;
          user: AuthUser | null;
          multiUser: boolean;
          needsSetup: boolean;
        };
        setState({
          user: data.user,
          loading: false,
          needsSetup: data.needsSetup,
          multiUser: data.multiUser,
          error: null,
        });
        setStorageUserId(data.user?.id ?? null);
        if (data.user) {
          loadConnectionsFromServer();
          loadPrefsFromServer();
        }
      } catch {
        setState((s) => ({ ...s, loading: false, error: "无法连接到服务器" }));
      }
    })();
  }, []);

  const login = useCallback(async (username: string, password: string, remember: boolean) => {
    setState((s) => ({ ...s, error: null }));
    const data = (await apiCall("/api/auth/login", { username, password })) as { user: AuthUser };
    setState((s) => ({ ...s, user: data.user, error: null }));
    setStorageUserId(data.user.id);
    loadConnectionsFromServer();
    loadPrefsFromServer();
    if (remember) {
      localStorage.setItem(REMEMBERED_USERNAME_KEY, username);
    } else {
      localStorage.removeItem(REMEMBERED_USERNAME_KEY);
    }
  }, []);

  const register = useCallback(async (username: string, password: string) => {
    setState((s) => ({ ...s, error: null }));
    const data = (await apiCall("/api/auth/register", { username, password })) as { user: AuthUser };
    setState((s) => ({ ...s, user: data.user, error: null }));
    setStorageUserId(data.user.id);
    loadConnectionsFromServer();
    loadPrefsFromServer();
  }, []);

  const setup = useCallback(async (username: string, password: string) => {
    setState((s) => ({ ...s, error: null }));
    const data = (await apiCall("/api/auth/setup", { username, password })) as { user: AuthUser };
    setState((s) => ({ ...s, user: data.user, needsSetup: false, error: null }));
    setStorageUserId(data.user.id);
    loadConnectionsFromServer();
    loadPrefsFromServer();
  }, []);

  const logout = useCallback(async () => {
    await apiCall("/api/auth/logout", {});
    setState((s) => ({ ...s, user: null, error: null }));
    setStorageUserId(null);
  }, []);

  const clearError = useCallback(() => {
    setState((s) => ({ ...s, error: null }));
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, register, setup, logout, clearError }}>
      {children}
    </AuthContext.Provider>
  );
}

/** 获取记住的用户名（用于登录页预填） */
export function getRememberedUsername(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(REMEMBERED_USERNAME_KEY);
}
