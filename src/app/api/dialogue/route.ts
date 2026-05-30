import { NextRequest } from "next/server";
import OpenAI from "openai";
import { getBook } from "@/lib/db";
import { getDialogueMessages, getDialogue, appendMessage, deleteMessages, updateMessage } from "@/lib/dialogue-store";
import { getPlotState } from "@/lib/plot-state";
import { requireUserId } from "@/lib/auth-helper";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const dialogueId = searchParams.get("dialogueId");
  if (!dialogueId) return new Response("dialogueId is required", { status: 400 });

  const userId = await requireUserId();
  if (userId === "NEEDS_SETUP") return new Response("请先完成初始化设置", { status: 400 });

  const record = getDialogue(dialogueId);
  if (!record) return new Response("Dialogue not found", { status: 404 });
  // 验证所有权（多用户模式下）
  if (record.userId && record.userId !== userId) {
    return new Response("Access denied", { status: 403 });
  }

  // Return messages excluding system prompt
  const messages = record.messages.filter((m) => m.role !== "system");
  return new Response(JSON.stringify({ messages, name: record.name }), {
    headers: { "Content-Type": "application/json" },
  });
}

export async function DELETE(req: NextRequest) {
  try {
    const userId = await requireUserId();
    if (userId === "NEEDS_SETUP") return new Response("请先完成初始化设置", { status: 400 });
    const { dialogueId, indices } = await req.json();
    if (!dialogueId || !indices) return new Response("dialogueId and indices required", { status: 400 });
    // verify ownership
    const record = getDialogue(dialogueId);
    if (!record) return new Response("Dialogue not found", { status: 404 });
    if (record.userId && record.userId !== userId) return new Response("Access denied", { status: 403 });
    const messages = deleteMessages(dialogueId, indices);
    return new Response(JSON.stringify({ messages }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    if (err instanceof Response) throw err;
    const msg = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const userId = await requireUserId();
    if (userId === "NEEDS_SETUP") return new Response("请先完成初始化设置", { status: 400 });
    const { dialogueId, index, content } = await req.json();
    if (!dialogueId || index === undefined || !content) {
      return new Response("dialogueId, index, content are required", { status: 400 });
    }
    // verify ownership
    const record = getDialogue(dialogueId);
    if (!record) return new Response("Dialogue not found", { status: 404 });
    if (record.userId && record.userId !== userId) return new Response("Access denied", { status: 403 });
    const messages = updateMessage(dialogueId, index, content);
    return new Response(JSON.stringify({ messages }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    if (err instanceof Response) throw err;
    const msg = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await requireUserId();
    if (userId === "NEEDS_SETUP") return new Response("请先完成初始化设置", { status: 400 });

    const { dialogueId, message, baseUrl, apiKey, modelId, regenerate } = await req.json();

    if (!apiKey) return new Response("API Key is required", { status: 400 });
    if (!modelId) return new Response("Model ID is required", { status: 400 });
    if (!dialogueId) return new Response("dialogueId is required", { status: 400 });

    const record = getDialogue(dialogueId);
    if (!record) return new Response("Dialogue not found", { status: 404 });
    // 验证所有权
    if (record.userId && record.userId !== userId) {
      return new Response("Access denied", { status: 403 });
    }

    const client = new OpenAI({ apiKey, baseURL: baseUrl.replace(/\/$/, "") });

    // Build LLM messages: system prompt (from config or first message) + history + new user msg
    const llmMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

    // Add system prompt if present in the record config
    let systemContent = "";
    if (record.config?.dialogue_system_prompt) {
      systemContent = record.config.dialogue_system_prompt;
    } else {
      const sysMsg = record.messages.find((m) => m.role === "system");
      if (sysMsg) systemContent = sysMsg.content;
    }

    // inject active plot node hints
    const plotHints = buildPlotHints(dialogueId);
    if (plotHints) {
      systemContent += "\n\n" + plotHints;
    }

    if (systemContent) {
      llmMessages.push({ role: "system", content: systemContent });
    }

    // Add existing user/assistant history
    for (const m of record.messages) {
      if (m.role === "user" || m.role === "assistant") {
        llmMessages.push({ role: m.role, content: m.content });
      }
    }

    // Append new user message (skip if regenerating)
    if (message && !regenerate) {
      appendMessage(dialogueId, { role: "user", content: message });
      llmMessages.push({ role: "user", content: message });
    }

    const encoder = new TextEncoder();
    let fullResponse = "";

    const readable = new ReadableStream({
      async start(controller) {
        try {
          const stream = await client.chat.completions.create({
            model: modelId,
            messages: llmMessages,
            stream: true,
          });

          for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta?.content;
            if (delta) {
              fullResponse += delta;
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: delta })}\n\n`));
            }
          }

          if (fullResponse) {
            appendMessage(dialogueId, { role: "assistant", content: fullResponse });
          }

          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Unknown error";
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`));
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

function buildPlotHints(dialogueId: string): string | null {
  try {
    const state = getPlotState(dialogueId);
    const activeLines = state.plotLines.filter((l) => l.status === "active");
    if (activeLines.length === 0) return null;

    const hints: string[] = [];
    for (const line of activeLines) {
      const activeNode = line.nodes.find((n) => n.status === "active");
      if (!activeNode) continue;
      const nextNode = line.nodes.find(
        (n) => n.status === "pending" && n.order > activeNode.order
      );
      if (nextNode) {
        hints.push(`- 【${line.title}】当前：${activeNode.content} → 下一步可发展：${nextNode.content}`);
      } else {
        hints.push(`- 【${line.title}】当前：${activeNode.content}`);
      }
    }

    if (hints.length === 0) return null;
    return `[剧情提示] 以下是当前故事的可能发展方向，请自然地融入叙事中，不要生硬地照搬：\n${hints.join("\n")}`;
  } catch {
    return null;
  }
}
