"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Loader2 } from "lucide-react";
import { getConnectionConfig } from "@/lib/storage";

interface Message {
  role: "user" | "assistant" | "tool";
  content: string;
}

interface Props {
  task?: string | null;
  bookId?: number | null;
  bookName?: string;
  activeBook?: { id: number; name: string; genre: string; style: string } | null;
  onBookCreated?: () => void;
}

export default function ChatWindow({ task, bookId, bookName, activeBook, onBookCreated }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState("");
  const [initialized, setInitialized] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
  }, [task, initialized]);

  async function sendMessage(text?: string, overrideTask?: string | null) {
    const content = text ?? input.trim();
    if (!content || streaming) return;

    const config = getConnectionConfig();
    if (!config) {
      setError("请先配置连接");
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
      if (activeBook && !task) {
        body.contextBook = activeBook;
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
        return copy;
      });
    } finally {
      setStreaming(false);
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
        {messages.map((m, i) => (
          <div
            key={i}
            className={`text-sm leading-relaxed whitespace-pre-wrap ${
              m.role === "user"
                ? "ml-auto max-w-[80%] rounded-xl rounded-br-md bg-zinc-800 px-3 py-2 text-zinc-200"
                : "max-w-[85%] text-zinc-400"
            }`}
          >
            {m.content || (
              <span className="inline-flex items-center gap-1 text-zinc-600">
                <Loader2 size={12} className="animate-spin" />
                思考中...
              </span>
            )}
          </div>
        ))}
        {error && <p className="text-center text-xs text-red-400">{error}</p>}
        <div ref={bottomRef} />
      </div>

      {/* input */}
      <div className="flex items-center gap-2 border-t border-white/5 p-2">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          placeholder="输入消息..."
          className="flex-1 rounded-lg bg-zinc-800 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none"
          disabled={streaming}
        />
        <button
          onClick={() => sendMessage()}
          disabled={streaming || !input.trim()}
          className="rounded-lg p-2 text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-30"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}
