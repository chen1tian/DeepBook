"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Loader2, ArrowLeft, Menu, X, Trash2, Plus, MessageSquare, Settings, CheckSquare, RefreshCw } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { getConnectionConfig } from "@/lib/storage";

interface DialogueMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface DialogueMeta {
  id: string;
  name: string;
  createdAt: string;
  messageCount: number;
  lastMessage: string;
  hasConfig: boolean;
}

interface Props {
  bookId: number;
  bookName: string;
  bookGenre: string;
  bookStyle: string;
  dialogueId: string | null;
  onBack: () => void;
  onNewDialogue: () => void;
  onSwitchDialogue: (dialogueId: string) => void;
  onBookUpdated: () => void;
}

export default function DialogueView({
  bookId, bookName, bookGenre, bookStyle, dialogueId, onBack, onNewDialogue, onSwitchDialogue, onBookUpdated,
}: Props) {
  const [messages, setMessages] = useState<DialogueMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editName, setEditName] = useState(bookName);
  const [editGenre, setEditGenre] = useState(bookGenre);
  const [editStyle, setEditStyle] = useState(bookStyle);
  const [saving, setSaving] = useState(false);
  const [deleteMode, setDeleteMode] = useState(false);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [dialogues, setDialogues] = useState<DialogueMeta[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load dialogue list
  const fetchList = useCallback(async () => {
    try {
      const res = await fetch(`/api/dialogues?bookId=${bookId}`);
      if (res.ok) {
        const data = await res.json();
        setDialogues(data.dialogues || []);
      }
    } catch { /* */ }
  }, [bookId]);

  // Load message history
  useEffect(() => {
    if (!dialogueId) { setLoading(false); return; }
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/dialogue?dialogueId=${dialogueId}`);
        if (res.ok) {
          const data = await res.json();
          setMessages(data.messages || []);
        }
      } catch { /* */ }
      setLoading(false);
    }
    load();
  }, [dialogueId]);

  useEffect(() => { fetchList(); }, [fetchList]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function resendMessage(content: string) {
    if (!dialogueId || streaming) return;
    // Remove last user message from dialogue store
    const lastIndex = messages.length - 1;
    await fetch("/api/dialogue", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dialogueId, indices: [lastIndex] }),
    });
    // Remove from local state
    setMessages((prev) => prev.slice(0, -1));
    // Resend
    await sendWithText(content);
  }

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || streaming || !dialogueId) return;
    setInput("");
    await sendWithText(text);
  }, [input, streaming, dialogueId, fetchList]);

  async function sendWithText(text: string) {
    if (!dialogueId) return;

    const config = getConnectionConfig();
    if (!config) return;

    setInput("");
    setStreaming(true);

    const userMsg: DialogueMessage = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    const assistantMsg: DialogueMessage = { role: "assistant", content: "" };
    setMessages((prev) => [...prev, assistantMsg]);

    try {
      const res = await fetch("/api/dialogue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dialogueId,
          message: text,
          baseUrl: config.baseUrl,
          apiKey: config.apiKey,
          modelId: config.modelId,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const d = line.slice(6);
            if (d === "[DONE]") continue;
            try {
              const p = JSON.parse(d);
              if (p.error) {
                setMessages((prev) => { const c = [...prev]; c[c.length - 1] = { role: "assistant", content: `❌ ${p.error}` }; return c; });
              }
              if (p.text) {
                setMessages((prev) => { const c = [...prev]; c[c.length - 1] = { ...c[c.length - 1], content: c[c.length - 1].content + p.text }; return c; });
              }
            } catch { /* */ }
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "发送失败";
      setMessages((prev) => { const c = [...prev]; c[c.length - 1] = { role: "assistant", content: `❌ ${msg}` }; return c; });
    } finally {
      setStreaming(false);
      fetchList();
    }
  }

  function toggleMessage(index: number) {
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        // deselect: only remove this one
        next.delete(index);
      } else {
        // select: this one and all below
        for (let i = index; i < messages.length; i++) {
          next.add(i);
        }
      }
      return next;
    });
  }

  async function handleDeleteMessages() {
    if (selectedIndices.size === 0) return;
    const indices = Array.from(selectedIndices);
    await fetch("/api/dialogue", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dialogueId, indices }),
    });
    setMessages((prev) => prev.filter((_, i) => !selectedIndices.has(i)));
    setDeleteMode(false);
    setSelectedIndices(new Set());
    fetchList();
  }

  async function handleDelete(dlgId: string) {
    await fetch(`/api/dialogues?bookId=${bookId}&dialogueId=${dlgId}`, { method: "DELETE" });
    fetchList();
    if (dlgId === dialogueId) {
      onBack();
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* toolbar */}
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-white/5 px-3">
        <button onClick={onBack} className="rounded p-1 text-zinc-500 hover:text-zinc-300" title="返回">
          <ArrowLeft size={16} />
        </button>
        <span className="flex-1 truncate text-xs font-medium text-zinc-400">{bookName}</span>

        {/* delete mode toggle */}
        {dialogueId && (
          <button
            onClick={() => {
              setDeleteMode(!deleteMode);
              setSelectedIndices(new Set());
            }}
            className={`rounded p-1 transition ${deleteMode ? "text-red-400" : "text-zinc-500 hover:text-zinc-300"}`}
            title={deleteMode ? "退出删除模式" : "删除消息"}
          >
            <Trash2 size={14} />
          </button>
        )}

        {/* menu button */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="rounded p-1 text-zinc-500 hover:text-zinc-300"
            title="菜单"
          >
            <Menu size={16} />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-full z-50 mt-1 w-44 rounded-lg bg-zinc-800 py-1 shadow-xl ring-1 ring-white/10">
                <button
                  onClick={() => { setMenuOpen(false); setListOpen(true); }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-zinc-300 hover:bg-zinc-700"
                >
                  <MessageSquare size={13} />
                  对话列表
                </button>
                <button
                  onClick={() => { setMenuOpen(false); onNewDialogue(); }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-zinc-300 hover:bg-zinc-700"
                >
                  <Plus size={13} />
                  开始新对话
                </button>
                <div className="my-1 border-t border-white/5" />
                <button
                  onClick={() => { setMenuOpen(false); setEditName(bookName); setEditGenre(bookGenre); setEditStyle(bookStyle); setSettingsOpen(true); }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-zinc-300 hover:bg-zinc-700"
                >
                  <Settings size={13} />
                  故事设定
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* messages */}
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {loading && <p className="py-8 text-center text-xs text-zinc-600">加载中...</p>}
        {!loading && !dialogueId && (
          <p className="py-8 text-center text-xs text-zinc-600">
            选择一个对话或开始新对话
          </p>
        )}
        {!loading && dialogueId && messages.length === 0 && (
          <p className="py-8 text-center text-xs text-zinc-600">对话为空</p>
        )}
        {messages.map((m, i) => {
          const isUser = m.role === "user";
          const isSelected = selectedIndices.has(i);
          return (
          <div
            key={i}
            className={`flex items-start gap-2 ${deleteMode ? "cursor-pointer" : ""} ${isSelected ? "rounded-lg bg-red-950/40 ring-1 ring-red-500/30" : ""}`}
            onClick={() => deleteMode && toggleMessage(i)}
          >
            {deleteMode && (
              <div className={`mt-1 shrink-0 rounded p-0.5 ${isSelected ? "text-red-400" : "text-zinc-700"}`}>
                <CheckSquare size={14} />
              </div>
            )}
            <div
              className={
                isUser
                  ? `ml-auto max-w-[75%] rounded-xl rounded-br-md px-4 py-3 text-sm whitespace-pre-wrap ${isSelected ? "bg-red-950/60 text-red-200" : "bg-zinc-800 text-zinc-200"}`
                  : `max-w-[85%] text-sm prose-sm prose-invert prose-headings:text-zinc-200 prose-strong:text-zinc-200 prose-code:text-zinc-800 prose-code:bg-zinc-800 prose-code:px-1 prose-code:rounded prose-table:text-xs prose-table:border-zinc-700 prose-th:border-zinc-700 prose-td:border-zinc-700 ${isSelected ? "text-red-300" : "text-zinc-400"}`
              }
            >
              {m.content ? (
                isUser ? (
                  m.content
                ) : (
                  <ReactMarkdown>{m.content}</ReactMarkdown>
                )
              ) : (
                <span className="inline-flex items-center gap-1 text-zinc-600">
                  <Loader2 size={12} className="animate-spin" /> 思考中...
                </span>
              )}
            </div>
          </div>
        )})}
        {/* resend button for last user message (when no assistant reply) */}
        {!deleteMode && !streaming && messages.length > 0 && (() => {
          const last = messages[messages.length - 1];
          if (last.role === "user") {
            return (
              <div className="flex justify-end px-4">
                <button
                  onClick={() => resendMessage(last.content)}
                  className="flex items-center gap-1 rounded px-2 py-1 text-xs text-zinc-600 transition hover:bg-zinc-800 hover:text-zinc-400"
                  title="重新发送"
                >
                  <RefreshCw size={12} />
                  重新发送
                </button>
              </div>
            );
          }
          return null;
        })()}
        <div ref={bottomRef} />
      </div>

      {/* delete mode action bar */}
      {deleteMode && (
        <div className="flex items-center justify-between border-t border-red-500/20 bg-red-950/30 px-4 py-2">
          <span className="text-xs text-red-300">
            已选 {selectedIndices.size} 条消息
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => { setDeleteMode(false); setSelectedIndices(new Set()); }}
              className="rounded px-3 py-1.5 text-xs text-zinc-400 transition hover:bg-zinc-800"
            >
              取消
            </button>
            <button
              onClick={handleDeleteMessages}
              disabled={selectedIndices.size === 0}
              className="rounded bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-red-500 disabled:opacity-40"
            >
              删除
            </button>
          </div>
        </div>
      )}

      {/* input */}
      {dialogueId && !deleteMode && (
        <div className="flex items-center gap-2 border-t border-white/5 p-3">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="输入消息..."
            className="flex-1 rounded-lg bg-zinc-800 px-4 py-2.5 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
            disabled={streaming}
          />
          <button
            onClick={send}
            disabled={streaming || !input.trim()}
            className="rounded-lg p-2.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-30"
          >
            <Send size={16} />
          </button>
        </div>
      )}

      {/* dialogue list panel */}
      {listOpen && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setListOpen(false)}>
          <div
            className="flex h-full w-80 max-w-[90vw] flex-col bg-zinc-900 shadow-2xl ring-1 ring-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex h-11 shrink-0 items-center justify-between border-b border-white/5 px-3">
              <span className="text-xs font-medium text-zinc-400">对话列表</span>
              <button onClick={() => setListOpen(false)} className="rounded p-1 text-zinc-500 hover:text-zinc-300">
                <X size={14} />
              </button>
            </div>
            <div className="flex-1 space-y-1 overflow-y-auto p-2">
              {dialogues.length === 0 && (
                <p className="py-8 text-center text-xs text-zinc-600">暂无对话</p>
              )}
              {dialogues.map((dlg) => (
                <div
                  key={dlg.id}
                  className={`group flex items-start gap-2 rounded-lg px-3 py-2 cursor-pointer transition ${
                    dlg.id === dialogueId ? "bg-emerald-600/10 ring-1 ring-emerald-600/30" : "hover:bg-zinc-800"
                  }`}
                  onClick={() => { onSwitchDialogue(dlg.id); setListOpen(false); }}
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-medium text-zinc-300">{dlg.name}</div>
                    <div className="mt-0.5 truncate text-[11px] text-zinc-600">
                      {dlg.lastMessage || "（空）"}
                    </div>
                    <div className="mt-0.5 text-[10px] text-zinc-700">
                      {dlg.messageCount} 条消息
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(dlg.id); }}
                    className="mt-0.5 rounded p-0.5 text-zinc-700 opacity-0 transition hover:text-red-400 group-hover:opacity-100"
                    title="删除"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* settings panel */}
      {settingsOpen && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setSettingsOpen(false)}>
          <div
            className="flex h-full w-80 max-w-[90vw] flex-col bg-zinc-900 shadow-2xl ring-1 ring-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex h-11 shrink-0 items-center justify-between border-b border-white/5 px-3">
              <span className="text-xs font-medium text-zinc-400">故事设定</span>
              <button onClick={() => setSettingsOpen(false)} className="rounded p-1 text-zinc-500 hover:text-zinc-300">
                <X size={14} />
              </button>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto p-4">
              {/* name */}
              <div>
                <label className="mb-1 block text-[11px] text-zinc-500">书名</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full rounded-lg bg-zinc-800 px-3 py-2 text-sm text-zinc-200 ring-1 ring-white/10 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                />
              </div>
              {/* genre */}
              <div>
                <label className="mb-1 block text-[11px] text-zinc-500">背景</label>
                <input
                  type="text"
                  value={editGenre}
                  onChange={(e) => setEditGenre(e.target.value)}
                  placeholder="仙侠、科幻、都市..."
                  className="w-full rounded-lg bg-zinc-800 px-3 py-2 text-sm text-zinc-200 ring-1 ring-white/10 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                />
              </div>
              {/* style */}
              <div>
                <label className="mb-1 block text-[11px] text-zinc-500">风格</label>
                <input
                  type="text"
                  value={editStyle}
                  onChange={(e) => setEditStyle(e.target.value)}
                  placeholder="网络小说、轻小说..."
                  className="w-full rounded-lg bg-zinc-800 px-3 py-2 text-sm text-zinc-200 ring-1 ring-white/10 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                />
              </div>
            </div>
            <div className="border-t border-white/5 p-3">
              <button
                onClick={async () => {
                  setSaving(true);
                  try {
                    await fetch("/api/books", {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        id: bookId,
                        name: editName,
                        genre: editGenre,
                        style: editStyle,
                      }),
                    });
                    onBookUpdated();
                    setSettingsOpen(false);
                  } catch { /* */ }
                  setSaving(false);
                }}
                disabled={saving || !editName.trim()}
                className="w-full rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:opacity-50"
              >
                {saving ? "保存中..." : "保存"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
