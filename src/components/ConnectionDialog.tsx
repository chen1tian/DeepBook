"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { X, Check, ChevronDown, RefreshCw, Loader2, Plus, Copy, Trash2, Star, Pencil } from "lucide-react";
import {
  type ConnectionConfig,
  type ProviderType,
  getConnections,
  getConnectionConfig,
  saveConnection,
  deleteConnection,
  setDefaultConnection,
  duplicateConnection,
  getDefaultBaseUrl,
  saveConnectionToServer,
  deleteConnectionFromServer,
  setDefaultConnectionOnServer,
} from "@/lib/storage";

interface Props {
  open: boolean;
  onClose: () => void;
}

type ViewMode = "list" | "form";

export default function ConnectionDialog({ open, onClose }: Props) {
  const [view, setView] = useState<ViewMode>("list");
  const [connections, setConnections] = useState<ConnectionConfig[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  // form state
  const [step, setStep] = useState<"connect" | "select">("connect");
  const [connName, setConnName] = useState("");
  const [provider, setProvider] = useState<ProviderType>("deepseek");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [models, setModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showProviderMenu, setShowProviderMenu] = useState(false);
  const providerBtnRef = useRef<HTMLButtonElement>(null);

  const prevOpen = useRef(false);

  const refreshConnections = useCallback(() => {
    setConnections(getConnections());
  }, []);

  // load connections when dialog opens
  useEffect(() => {
    if (open && !prevOpen.current) {
      refreshConnections();
      setView("list");
    }
    prevOpen.current = open;
  }, [open, refreshConnections]);

  // close provider menu on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (providerBtnRef.current && !providerBtnRef.current.contains(e.target as Node)) {
        setShowProviderMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // update baseUrl when provider changes (only for new connections)
  useEffect(() => {
    if (!editingId) {
      setBaseUrl(getDefaultBaseUrl(provider));
      setError("");
    }
  }, [provider, editingId]);

  /* ── form actions ──────────────────────────────── */

  function openAddForm() {
    setEditingId(null);
    setConnName("");
    setProvider("deepseek");
    setBaseUrl(getDefaultBaseUrl("deepseek"));
    setApiKey("");
    setModels([]);
    setSelectedModel("");
    setStep("connect");
    setError("");
    setView("form");
  }

  function openEditForm(conn: ConnectionConfig) {
    setEditingId(conn.id);
    setConnName(conn.name);
    setProvider(conn.provider);
    setBaseUrl(conn.baseUrl);
    setApiKey(conn.apiKey);
    setSelectedModel(conn.modelId);
    setModels([]);
    setStep("connect");
    setError("");
    setView("form");
  }

  function handleCancelForm() {
    setView("list");
    refreshConnections();
    window.dispatchEvent(new CustomEvent("deepbook:connection-changed"));
  }

  async function handleFetchModels() {
    if (!apiKey.trim()) {
      setError("请输入 API Key");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseUrl: baseUrl.trim(), apiKey: apiKey.trim(), provider }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch models");
      setModels(data.models || []);
      setStep("select");
    } catch (err) {
      setError(err instanceof Error ? err.message : "获取模型列表失败");
    } finally {
      setLoading(false);
    }
  }

  function handleSave() {
    const name = connName.trim() || "未命名连接";
    if (!selectedModel) {
      setError("请选择一个模型");
      return;
    }
    const config: ConnectionConfig = {
      id: editingId || "",
      name,
      provider,
      baseUrl: baseUrl.trim(),
      apiKey: apiKey.trim(),
      modelId: selectedModel,
    };
    saveConnection(config);
    saveConnectionToServer(config); // 同步到服务端
    handleCancelForm();
  }

  /* ── list actions ──────────────────────────────── */

  function handleDelete(id: string) {
    const all = getConnections();
    if (all.length <= 1) {
      setError("至少保留一个连接");
      return;
    }
    deleteConnection(id);
    deleteConnectionFromServer(id); // 同步到服务端
    refreshConnections();
    window.dispatchEvent(new CustomEvent("deepbook:connection-changed"));
  }

  function handleSetDefault(id: string) {
    setDefaultConnection(id);
    setDefaultConnectionOnServer(id); // 同步到服务端
    refreshConnections();
    window.dispatchEvent(new CustomEvent("deepbook:connection-changed"));
  }

  function handleDuplicate(id: string) {
    const dup = duplicateConnection(id);
    if (dup) {
      saveConnectionToServer(dup); // 同步到服务端
    }
    refreshConnections();
    window.dispatchEvent(new CustomEvent("deepbook:connection-changed"));
  }

  if (!open) return null;

  const isDefaultAvailable = connections.some((c) => c.isDefault);
  if (!isDefaultAvailable && connections.length > 0) {
    // ensure at least one default
    setDefaultConnection(connections[0].id);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-zinc-900 p-5 shadow-2xl ring-1 ring-white/10">
        {/* header */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-medium text-zinc-200">
            {view === "list" ? "连接管理" : editingId ? "编辑连接" : "新建连接"}
          </h2>
          <button onClick={onClose} className="rounded p-1 text-zinc-500 hover:text-zinc-300">
            <X size={16} />
          </button>
        </div>

        {error && (
          <div className="mb-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">{error}</div>
        )}

        {/* ── LIST VIEW ─────────────────────────────── */}
        {view === "list" && (
          <div className="space-y-3">
            {connections.length === 0 ? (
              <p className="py-4 text-center text-xs text-zinc-500">暂无连接，请添加一个</p>
            ) : (
              <div className="max-h-72 space-y-2 overflow-y-auto">
                {connections.map((conn) => (
                  <div
                    key={conn.id}
                    className={`rounded-lg px-3 py-2.5 ring-1 transition ${
                      conn.isDefault
                        ? "bg-emerald-500/5 ring-emerald-500/30"
                        : "bg-zinc-800 ring-white/10"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-sm font-medium text-zinc-200">{conn.name}</span>
                          {conn.isDefault && (
                            <span className="shrink-0 rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400">
                              默认
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 flex items-center gap-2 text-[11px] text-zinc-500">
                          <span>{conn.provider === "deepseek" ? "DeepSeek" : "OpenAI"}</span>
                          <span className="text-zinc-700">·</span>
                          <span className="truncate">{conn.modelId}</span>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-0.5">
                        {!conn.isDefault && (
                          <button
                            onClick={() => handleSetDefault(conn.id)}
                            className="rounded p-1 text-zinc-600 hover:text-emerald-400"
                            title="设为默认"
                          >
                            <Star size={13} />
                          </button>
                        )}
                        <button
                          onClick={() => handleDuplicate(conn.id)}
                          className="rounded p-1 text-zinc-600 hover:text-zinc-300"
                          title="复制"
                        >
                          <Copy size={13} />
                        </button>
                        <button
                          onClick={() => openEditForm(conn)}
                          className="rounded p-1 text-zinc-600 hover:text-zinc-300"
                          title="编辑"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => handleDelete(conn.id)}
                          className="rounded p-1 text-zinc-600 hover:text-red-400"
                          title="删除"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={openAddForm}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-zinc-800 px-3 py-2.5 text-sm text-zinc-300 ring-1 ring-white/10 transition hover:bg-zinc-700 hover:text-zinc-100"
            >
              <Plus size={15} />
              添加连接
            </button>
          </div>
        )}

        {/* ── FORM VIEW ─────────────────────────────── */}
        {view === "form" && (
          <div className="space-y-3">
            {/* connection name */}
            <div>
              <label className="mb-1 block text-[11px] text-zinc-500">连接名称</label>
              <input
                type="text"
                value={connName}
                onChange={(e) => setConnName(e.target.value)}
                placeholder="例如：DeepSeek 个人账号"
                className="w-full rounded-lg bg-zinc-800 px-3 py-2 text-sm text-zinc-200 ring-1 ring-white/10 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
            </div>

            {/* provider selector */}
            <div className="relative">
              <label className="mb-1 block text-[11px] text-zinc-500">提供商</label>
              <button
                ref={providerBtnRef}
                onClick={() => setShowProviderMenu((v) => !v)}
                className="flex w-full items-center justify-between rounded-lg bg-zinc-800 px-3 py-2 text-sm text-zinc-200 ring-1 ring-white/10"
              >
                {provider === "deepseek" ? "DeepSeek" : "OpenAI 兼容"}
                <ChevronDown size={14} className="text-zinc-500" />
              </button>
              {showProviderMenu && (
                <div className="absolute top-full z-10 mt-1 w-full rounded-lg bg-zinc-800 py-1 ring-1 ring-white/10">
                  {(["deepseek", "openai"] as ProviderType[]).map((p) => (
                    <button
                      key={p}
                      className="w-full px-3 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-700"
                      onClick={() => {
                        setProvider(p);
                        setShowProviderMenu(false);
                      }}
                    >
                      {p === "deepseek" ? "DeepSeek" : "OpenAI 兼容"}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* base URL */}
            {provider === "openai" && (
              <div>
                <label className="mb-1 block text-[11px] text-zinc-500">Base URL</label>
                <input
                  type="text"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder="https://api.openai.com/v1"
                  className="w-full rounded-lg bg-zinc-800 px-3 py-2 text-sm text-zinc-200 ring-1 ring-white/10 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                />
              </div>
            )}

            {/* api key */}
            <div>
              <label className="mb-1 block text-[11px] text-zinc-500">
                API Key
                {provider === "deepseek" && <span className="ml-1 text-zinc-600">— 必填</span>}
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-..."
                className="w-full rounded-lg bg-zinc-800 px-3 py-2 text-sm text-zinc-200 ring-1 ring-white/10 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                onKeyDown={(e) => e.key === "Enter" && handleFetchModels()}
              />
            </div>

            {step === "connect" ? (
              <div className="flex gap-2">
                <button
                  onClick={handleCancelForm}
                  className="flex-1 rounded-lg bg-zinc-800 px-3 py-2 text-sm text-zinc-400 ring-1 ring-white/10 transition hover:text-zinc-200"
                >
                  返回
                </button>
                <button
                  onClick={handleFetchModels}
                  disabled={loading}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-500 disabled:opacity-50"
                >
                  {loading ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <RefreshCw size={14} />
                  )}
                  {loading ? "获取中..." : editingId && selectedModel ? "重新获取模型" : "获取模型列表"}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-zinc-400">可用模型 ({models.length})</p>
                <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg bg-zinc-800 p-1">
                  {models.map((m) => (
                    <button
                      key={m}
                      onClick={() => {
                        setSelectedModel(m);
                        setError("");
                      }}
                      className={`w-full truncate rounded px-3 py-2 text-left text-sm transition ${
                        selectedModel === m
                          ? "bg-blue-600/20 text-blue-400"
                          : "text-zinc-300 hover:bg-zinc-700"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setStep("connect")}
                    className="flex-1 rounded-lg bg-zinc-800 px-3 py-2 text-sm text-zinc-400 ring-1 ring-white/10 transition hover:text-zinc-200"
                  >
                    返回
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={!selectedModel}
                    className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-500 disabled:opacity-50"
                  >
                    <Check size={14} />
                    保存
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
