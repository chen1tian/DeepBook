"use client";

import { useState, useEffect } from "react";
import { Eye, EyeOff, LogIn, UserPlus, BookOpen } from "lucide-react";
import { useAuth, getRememberedUsername } from "@/lib/auth-context";

type Mode = "login" | "register";

interface LoginPageProps {
  mode: "setup" | "login";
}

export default function LoginPage({ mode }: LoginPageProps) {
  const { login, register, setup, error, clearError, multiUser } = useAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [pageMode, setPageMode] = useState<Mode>("login");
  const [localError, setLocalError] = useState<string | null>(null);

  // 预填记住的用户名
  useEffect(() => {
    const remembered = getRememberedUsername();
    if (remembered) {
      setUsername(remembered);
      setRemember(true);
    }
  }, []);

  function resetForm() {
    setLocalError(null);
    clearError();
    setPassword("");
    setConfirmPassword("");
  }

  function switchMode(m: Mode) {
    setPageMode(m);
    resetForm();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLocalError(null);
    clearError();

    if (!username.trim() || !password) {
      setLocalError("请填写用户名和密码");
      return;
    }

    if (mode === "setup") {
      if (password.length < 4) {
        setLocalError("密码长度至少 4 个字符");
        return;
      }
    }

    // 注册时检查密码一致性
    if (pageMode === "register" && password !== confirmPassword) {
      setLocalError("两次输入的密码不一致");
      return;
    }

    setSubmitting(true);
    try {
      if (mode === "setup") {
        await setup(username.trim(), password);
      } else if (pageMode === "register") {
        await register(username.trim(), password);
      } else {
        await login(username.trim(), password, remember);
      }
      // 成功后 AuthProvider 会自动更新 user 状态，页面会切换到正常视图
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "操作失败");
    } finally {
      setSubmitting(false);
    }
  }

  const displayError = localError || error;

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 p-4">
      <div className="w-full max-w-sm">
        {/* Logo / Title */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-zinc-800 mb-4">
            <BookOpen className="w-8 h-8 text-zinc-300" />
          </div>
          <h1 className="text-2xl font-bold text-zinc-100">DeepBook</h1>
          <p className="text-sm text-zinc-500 mt-1">
            {mode === "setup" ? "欢迎使用，请设置您的账户" : "AI 小说创作与角色扮演"}
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username */}
            <div>
              <label className="block text-sm text-zinc-400 mb-1.5">用户名</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={mode === "setup" ? "设置用户名" : "输入用户名"}
                autoFocus
                maxLength={20}
                className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-500 text-sm"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm text-zinc-400 mb-1.5">密码</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="输入密码"
                  className="w-full px-3 py-2 pr-10 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-500 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirm Password (register only) */}
            {mode !== "setup" && pageMode === "register" && (
              <div>
                <label className="block text-sm text-zinc-400 mb-1.5">确认密码</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="再次输入密码"
                  className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-500 text-sm"
                />
              </div>
            )}

            {/* Remember username (login mode only) */}
            {mode !== "setup" && pageMode === "login" && (
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 accent-zinc-500"
                />
                <span className="text-xs text-zinc-500">记住用户名</span>
              </label>
            )}

            {/* Error */}
            {displayError && (
              <div className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
                {displayError}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 rounded-lg bg-zinc-100 text-zinc-900 font-medium text-sm hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {submitting ? (
                <span className="inline-block w-4 h-4 border-2 border-zinc-400 border-t-zinc-600 rounded-full animate-spin" />
              ) : mode === "setup" ? (
                <>
                  <UserPlus className="w-4 h-4" /> 创建账户
                </>
              ) : pageMode === "register" ? (
                <>
                  <UserPlus className="w-4 h-4" /> 注册
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" /> 登录
                </>
              )}
            </button>
          </form>

          {/* Switch mode (multi-user only) */}
          {mode !== "setup" && (
            <div className="mt-4 text-center">
              {pageMode === "login" ? (
                <button
                  onClick={() => switchMode("register")}
                  className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  没有账户？<span className="underline underline-offset-2">注册新用户</span>
                </button>
              ) : (
                <button
                  onClick={() => switchMode("login")}
                  className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  已有账户？<span className="underline underline-offset-2">去登录</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
