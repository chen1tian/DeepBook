"use client";

import { useState, useEffect, useRef } from "react";
import { X, Check, ChevronDown, RefreshCw, Loader2 } from "lucide-react";
import {
  type ConnectionConfig,
  type ProviderType,
  getConnectionConfig,
  saveConnectionConfig,
  getDefaultBaseUrl,
} from "@/lib/storage";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function ConnectionDialog({ open, onClose }: Props) {
  const [step, setStep] = useState<"connect" | "select">("connect");
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

  useEffect(() => {
    if (open && !prevOpen.current) {
      // dialog just opened — load saved config
      const existing = getConnectionConfig();
      if (existing) {
        setProvider(existing.provider);
        setBaseUrl(existing.baseUrl);
        setApiKey(existing.apiKey);
        setSelectedModel(existing.modelId);
      } else {
        setBaseUrl(getDefaultBaseUrl(provider));
      }
    }
    prevOpen.current = open;
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // when user manually switches provider, update baseUrl only if no saved config
  useEffect(() => {
    const existing = getConnectionConfig();
    if (!existing || existing.provider !== provider) {
      setBaseUrl(getDefaultBaseUrl(provider));
      setError("");
    }
  }, [provider]); // eslint-disable-line react-hooks/exhaustive-deps

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
    if (!selectedModel) {
      setError("请选择一个模型");
      return;
    }
    saveConnectionConfig({
      provider,
      baseUrl: baseUrl.trim(),
      apiKey: apiKey.trim(),
      modelId: selectedModel,
    });
    onClose();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-xl bg-zinc-900 p-5 shadow-2xl ring-1 ring-white/10">
        {/* header */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-medium text-zinc-200">连接配置</h2>
          <button onClick={onClose} className="rounded p-1 text-zinc-500 hover:text-zinc-300">
            <X size={16} />
          </button>
        </div>

        {error && (
          <div className="mb-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">
            {error}
          </div>
        )}

        {step === "connect" ? (
          <div className="space-y-3">
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
                {provider === "deepseek" && (
                  <span className="ml-1 text-zinc-600">— 必填</span>
                )}
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

            <button
              onClick={handleFetchModels}
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-500 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <RefreshCw size={14} />
              )}
              {loading ? "获取中..." : "连接并获取模型"}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-zinc-400">
              可用模型 ({models.length})
            </p>
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
                确认
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
