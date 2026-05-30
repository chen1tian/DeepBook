"use client";

import { useState, useEffect, useRef } from "react";
import { User, LogOut, Eye, EyeOff, Key, Loader2, X, ChevronRight } from "lucide-react";
import type { AuthUser } from "@/lib/auth-context";

interface Props {
  user: AuthUser;
  onLogout: () => Promise<void>;
}

export default function AccountPanel({ user, onLogout }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [pwDialogOpen, setPwDialogOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  // 点击外部关闭菜单
  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e: MouseEvent) {
      if (
        menuRef.current && !menuRef.current.contains(e.target as Node) &&
        btnRef.current && !btnRef.current.contains(e.target as Node)
      ) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await onLogout();
      setMenuOpen(false);
    } finally {
      setLoggingOut(false);
    }
  }

  function handleOpenPwDialog() {
    setMenuOpen(false);
    setPwDialogOpen(true);
  }

  return (
    <div className="relative">
      {/* 触发按钮 */}
      <button
        ref={btnRef}
        onClick={() => setMenuOpen(!menuOpen)}
        className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition ${
          menuOpen ? "bg-white/10 text-zinc-300" : "text-zinc-400 hover:bg-white/5 hover:text-zinc-300"
        }`}
      >
        <User size={13} />
        <span className="max-w-[80px] truncate">{user.username}</span>
      </button>

      {/* 下拉菜单 */}
      {menuOpen && (
        <div
          ref={menuRef}
          className="absolute right-0 top-full mt-1.5 w-52 rounded-xl border border-zinc-800 bg-zinc-900 shadow-2xl z-50 overflow-hidden"
        >
          {/* 用户信息 */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
            <div className="w-7 h-7 rounded-full bg-zinc-800 flex items-center justify-center shrink-0">
              <User size={14} className="text-zinc-400" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium text-zinc-200 truncate">{user.username}</div>
              <div className="text-[10px] text-zinc-500">
                {new Date(user.createdAt).toLocaleDateString("zh-CN")} 加入
              </div>
            </div>
          </div>

          {/* 菜单项 */}
          <div className="py-1">
            <button
              onClick={handleOpenPwDialog}
              className="w-full flex items-center justify-between px-4 py-2 text-xs text-zinc-300 hover:bg-white/5 transition-colors"
            >
              <span className="flex items-center gap-2">
                <Key size={12} className="text-zinc-500" />
                修改密码
              </span>
              <ChevronRight size={12} className="text-zinc-600" />
            </button>
          </div>

          <div className="border-t border-white/5 py-1">
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="w-full flex items-center gap-2 px-4 py-2 text-xs text-red-400 hover:bg-red-400/10 transition-colors disabled:opacity-50"
            >
              {loggingOut ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <LogOut size={12} />
              )}
              退出登录
            </button>
          </div>
        </div>
      )}

      {/* 修改密码对话框 */}
      {pwDialogOpen && (
        <ChangePasswordDialog
          onClose={() => setPwDialogOpen(false)}
        />
      )}
    </div>
  );
}

/* ── 修改密码对话框 ──────────────────────────────── */

function ChangePasswordDialog({ onClose }: { onClose: () => void }) {
  const [showPassword, setShowPassword] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const overlayRef = useRef<HTMLDivElement>(null);

  // ESC 关闭
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!oldPassword || !newPassword) {
      setError("请填写原密码和新密码");
      return;
    }
    if (newPassword.length < 4) {
      setError("新密码长度至少 4 个字符");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("两次输入的新密码不一致");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oldPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error((data as { error?: string }).error || "修改失败");
      setSuccess("密码修改成功");
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "修改失败");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div className="w-full max-w-sm mx-4 rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl">
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <h2 className="text-sm font-medium text-zinc-200">修改密码</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* 表单 */}
        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-3">
          <input
            type="password"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            placeholder="原密码"
            autoFocus
            className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-200 text-sm placeholder-zinc-500 focus:outline-none focus:border-zinc-600"
          />

          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="新密码（至少4位）"
              className="w-full px-3 py-2 pr-9 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-200 text-sm placeholder-zinc-500 focus:outline-none focus:border-zinc-600"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>

          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="确认新密码"
            className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-200 text-sm placeholder-zinc-500 focus:outline-none focus:border-zinc-600"
          />

          {error && (
            <div className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
              {error}
            </div>
          )}
          {success && (
            <div className="text-xs text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 rounded-lg px-3 py-2">
              {success}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 rounded-lg bg-zinc-100 text-zinc-900 text-sm font-medium hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {submitting ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Key size={14} />
            )}
            确认修改
          </button>
        </form>
      </div>
    </div>
  );
}
