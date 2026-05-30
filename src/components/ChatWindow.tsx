"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { getConnectionConfig } from "@/lib/storage";

interface Message {
  role: "user" | "assistant" | "tool" | "system";
  content: string;
}

interface Props {
  task?: string | null;
  bookId?: number | null;
  bookName?: string;
  bookContext?: { genre: string; style: string } | null;
  activeBook?: { id: number; name: string; genre: string; style: string } | null;
  persona?: { name: string; avatar: string; tone: string; addressUser: string; style: string; catchphrase: string } | null;
  onBookCreated?: () => void;
}

export default function ChatWindow({ task, bookId, bookName, bookContext, activeBook, persona, onBookCreated }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState("");
  const [initialized, setInitialized] = useState(false);
  const [chatId, setChatId] = useState<string | null>(null);
  const chatIdRef = useRef<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load chat history on mount — each task has its own chatId
  useEffect(() => {
    const storageKey = `deepbook_agent_chat_${task || "default"}`;
    const stored = typeof window !== "undefined" ? localStorage.getItem(storageKey) : null;
    if (stored) {
      setChatId(stored);
      chatIdRef.current = stored;
      fetch(`/api/agent-chat?chatId=${stored}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.chat?.messages) {
            setMessages(data.chat.messages.filter((m: Message) => m.role !== "system"));
          }
        })
        .catch(() => {});
    } else {
      // Fresh start for this task
      setChatId(null);
      chatIdRef.current = null;
      setMessages([]);
    }
  }, [task]);

  // Save messages after each exchange
  async function persistMessages(msgs: Message[]) {
    const id = chatIdRef.current;
    const allMessages = msgs.map((m) => ({ role: m.role, content: m.content }));
    try {
      const res = await fetch("/api/agent-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId: id, messages: allMessages }),
      });
      const data = await res.json();
      if (data.chat?.id && !id) {
        setChatId(data.chat.id);
        chatIdRef.current = data.chat.id;
        const storageKey = `deepbook_agent_chat_${task || "default"}`;
        localStorage.setItem(storageKey, data.chat.id);
      }
    } catch {}
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // auto-trigger first message when task is set
  useEffect(() => {
    if (task === "create-story" && !initialized) {
      setInitialized(true);
      sendMessage("我想创建一本新故事", task);
    }
    if (task === "open-dialogue" && !initialized) {
      setInitialized(true);
      sendMessage(`我想为《${bookName || "故事"}》创建开场白`, task);
    }
    if (task === "new-dialogue" && !initialized) {
      setInitialized(true);
      sendMessage(`我想在《${bookName || "故事"}》中开始一个新对话`, task);
    }
    if (task === "edit-preset" && !initialized) {
      setInitialized(true);
      const preset = (window as unknown as Record<string, unknown>).__editingPreset as Record<string, unknown> | undefined;
      if (preset) {
        const info = `当前预设信息：\n名称：${preset.name || "（新建）"}\n模式：${preset.mode}\n人称：${preset.pov}\n角色定义：${preset.role}\n写作规则：${preset.rules}`;
        sendMessage(`我想修改这个预设。${info}`, task);
      } else {
        sendMessage("我想创建一个新预设", task);
      }
    }
    if (task === "edit-persona" && !initialized) {
      setInitialized(true);
      const p = (window as unknown as Record<string, unknown>).__editingPersona as Record<string, unknown> | undefined;
      if (p) {
        const info = `当前人格信息：\n名称：${p.name || "（新建）"}\n头像：${p.avatar}\n语气：${p.tone}\n称呼用户：${p.addressUser}\n风格：${p.style}\n口头禅：${p.catchphrase}`;
        sendMessage(`我想修改这个人格。${info}`, task);
      } else {
        sendMessage("我想创建一个新的人格", task);
      }
    }
  }, [task, initialized]);

  async function sendMessage(text?: string, overrideTask?: string | null) {
    const content = text ?? input.trim();
    if (!content || streaming) return;

    const config = getConnectionConfig();
    if (!config) {
      if (typeof window !== "undefined" && window.confirm("尚未配置 API 连接，是否现在设置？")) {
        window.dispatchEvent(new CustomEvent("deepbook:open-connection"));
      }
      return;
    }

    setError("");
    if (!text) setInput("");

    const userMsg: Message = { role: "user", content };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setStreaming(true);

    const assistantMsg: Message = { role: "assistant", content: "" };
    setMessages([...updated, assistantMsg]);

    try {
      const body: Record<string, unknown> = {
        messages: updated,
        baseUrl: config.baseUrl,
        apiKey: config.apiKey,
        modelId: config.modelId,
      };
      if (overrideTask ?? task) {
        body.task = overrideTask ?? task;
      }
      if (bookId) {
        body.bookId = bookId;
      }
      if (bookContext && task === "open-dialogue") {
        body.contextBook = { name: bookName, ...bookContext };
      }
      if (activeBook && !task) {
        body.contextBook = activeBook;
      }
      if (persona) {
        body.contextPersona = persona;
      }

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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
            const data = line.slice(6);
            if (data === "[DONE]") continue;
            try {
              const parsed = JSON.parse(data);

              if (parsed.error) {
                setMessages((prev) => {
                  const copy = [...prev];
                  copy[copy.length - 1] = {
                    ...copy[copy.length - 1],
                    content: copy[copy.length - 1].content
                      ? copy[copy.length - 1].content + `\n\n❌ ${parsed.error}`
                      : `❌ ${parsed.error}`,
                  };
                  return copy;
                });
                continue;
              }

              if (parsed.text) {
                setMessages((prev) => {
                  const copy = [...prev];
                  copy[copy.length - 1] = {
                    ...copy[copy.length - 1],
                    content: copy[copy.length - 1].content + parsed.text,
                  };
                  return copy;
                });
              }

              if (parsed.tool_result) {
                if (parsed.tool_result.name === "create_book" && parsed.tool_result.success) {
                  setMessages((prev) => {
                    const copy = [...prev];
                    copy[copy.length - 1] = {
                      ...copy[copy.length - 1],
                      content:
                        copy[copy.length - 1].content +
                        `\n\n✅ 故事「${parsed.tool_result.book.name}」已创建！`,
                    };
                    return copy;
                  });
                  onBookCreated?.();
                } else if (parsed.tool_result.name === "create_book" && !parsed.tool_result.success) {
                  setMessages((prev) => {
                    const copy = [...prev];
                    copy[copy.length - 1] = {
                      ...copy[copy.length - 1],
                      content:
                        copy[copy.length - 1].content +
                        `\n\n❌ 创建失败: ${parsed.tool_result.error}`,
                    };
                    return copy;
                  });
                }

                if (parsed.tool_result.name === "start_dialogue" && parsed.tool_result.success) {
                  setMessages((prev) => {
                    const copy = [...prev];
                    copy[copy.length - 1] = {
                      ...copy[copy.length - 1],
                      content:
                        copy[copy.length - 1].content +
                        `\n\n✅ 开场白已创建！关闭此窗口，在对话界面中继续吧。`,
                    };
                    return copy;
                  });
                  window.dispatchEvent(
                    new CustomEvent("deepbook:dialogue-started", {
                      detail: {
                        bookId: parsed.tool_result.bookId || bookId,
                        dialogueId: parsed.tool_result.dialogueId,
                      },
                    })
                  );
                }

                if (parsed.tool_result.name === "reuse_opening" && parsed.tool_result.success) {
                  setMessages((prev) => {
                    const copy = [...prev];
                    copy[copy.length - 1] = {
                      ...copy[copy.length - 1],
                      content:
                        copy[copy.length - 1].content +
                        `\n\n✅ 新对话已创建！关闭此窗口继续吧。`,
                    };
                    return copy;
                  });
                  window.dispatchEvent(
                    new CustomEvent("deepbook:dialogue-started", {
                      detail: {
                        bookId: parsed.tool_result.bookId || bookId,
                        dialogueId: parsed.tool_result.dialogueId,
                      },
                    })
                  );
                }

                if (parsed.tool_result.name === "close_dialogue" && parsed.tool_result.success) {
                  window.dispatchEvent(new CustomEvent("deepbook:dialogue-closed"));
                }

                if (
                  (parsed.tool_result.name === "update_preset" || parsed.tool_result.name === "create_preset") &&
                  parsed.tool_result.success
                ) {
                  window.dispatchEvent(new CustomEvent("deepbook:presets-updated"));
                }

                if (
                  (parsed.tool_result.name === "create_persona" || parsed.tool_result.name === "update_persona") &&
                  parsed.tool_result.success
                ) {
                  window.dispatchEvent(new CustomEvent("deepbook:persona-changed", { detail: parsed.tool_result.persona }));
                }
              }
            } catch {
              // partial chunk
            }
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "发送失败";
      setMessages((prev) => {
        const copy = [...prev];
        copy[copy.length - 1] = {
          ...copy[copy.length - 1],
          content: `错误: ${msg}`,
        };
        persistMessages(copy);
        return copy;
      });
    } finally {
      setStreaming(false);
      // Persist after stream completes
      setMessages((prev) => {
        persistMessages(prev);
        return prev;
      });
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* messages */}
      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        {messages.length === 0 && (
          <p className="py-8 text-center text-xs text-zinc-600">
            {task === "create-story"
              ? "正在初始化创建流程..."
              : "有什么可以帮你的？开始对话吧。"}
          </p>
        )}
        {messages.length > 0 && (
          <div className="flex items-center gap-2 py-2">
            <div className="h-px flex-1 bg-white/5" />
            <span className="text-[10px] text-zinc-600 shrink-0">
              {task === "create-story" ? "创建故事" : task === "open-dialogue" ? "开场白创建" : task === "new-dialogue" ? "新建对话" : "历史对话"}
            </span>
            <div className="h-px flex-1 bg-white/5" />
          </div>
        )}
        {messages.map((m, i) => {
          const isUser = m.role === "user";
          return (
          <div
            key={i}
            className={
              isUser
                ? "ml-auto max-w-[80%] rounded-xl rounded-br-md bg-zinc-800 px-3 py-2 text-sm text-zinc-200 whitespace-pre-wrap"
                : "max-w-[85%] text-sm text-zinc-400 prose-sm prose-invert prose-headings:text-zinc-200 prose-strong:text-zinc-200 prose-code:text-zinc-300 prose-code:bg-zinc-800 prose-code:px-1 prose-code:rounded prose-table:text-xs prose-table:border-zinc-700 prose-th:border-zinc-700 prose-td:border-zinc-700"
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
                <Loader2 size={12} className="animate-spin" />
                思考中...
              </span>
            )}
          </div>
        )})}
        {error && <p className="text-center text-xs text-red-400">{error}</p>}
        <div ref={bottomRef} />
      </div>

      {/* input */}
      <div className="flex items-center gap-2 border-t border-blue-400/20 p-2">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          placeholder="输入消息..."
          className="flex-1 rounded-lg bg-zinc-800 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-blue-400/60"
          disabled={streaming}
        />
        <button
          onClick={() => sendMessage()}
          disabled={streaming || !input.trim()}
          className="rounded-lg p-2 text-zinc-400 transition hover:bg-blue-500/15 hover:text-blue-400 disabled:opacity-30"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}
