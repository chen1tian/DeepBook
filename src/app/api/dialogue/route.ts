import { NextRequest } from "next/server";
import OpenAI from "openai";
import { getBook } from "@/lib/db";
import { getDialogueMessages, getDialogue, appendMessage, deleteMessages, updateMessage, updateCompactionSummary } from "@/lib/dialogue-store";
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
  return new Response(JSON.stringify({ messages, name: record.name, compactionSummary: record.compactionSummary }), {
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

    const { dialogueId, message, baseUrl, apiKey, modelId, regenerate, compactionThreshold } = await req.json();

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

    // inject compaction summary if present
    if (record.compactionSummary) {
      llmMessages.push({ role: "system", content: `[前情提要] ${record.compactionSummary}` });
    }

    // Add recent user/assistant history (keep last N, older summarized above)
    const userAssistantMsgs = record.messages.filter((m) => m.role === "user" || m.role === "assistant");
    const threshold = Math.max(10, Math.min(100, compactionThreshold || 30));
    const keepRecent = Math.max(5, threshold - 10);
    const recentMsgs = userAssistantMsgs.length > threshold
      ? userAssistantMsgs.slice(-keepRecent)
      : userAssistantMsgs;
    for (const m of recentMsgs) {
      llmMessages.push({ role: m.role, content: m.content });
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

          // trigger compaction asynchronously (non-blocking)
          triggerCompaction(dialogueId, client, modelId, threshold).catch(() => {});
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

async function triggerCompaction(dialogueId: string, client: OpenAI, modelId: string, threshold: number) {
  const record = getDialogue(dialogueId);
  if (!record) return;
  const userAssistant = record.messages.filter((m) => m.role === "user" || m.role === "assistant");
  if (userAssistant.length < threshold) return;

  const keepRecent = Math.max(5, threshold - 10);
  const olderMsgs = userAssistant.slice(0, -keepRecent);
  const olderText = olderMsgs.map((m) => `${m.role === "user" ? "用户" : "AI"}: ${m.content.slice(0, 800)}`).join("\n");
  const existingSummary = record.compactionSummary || "";

  const prompt = existingSummary
    ? `以下是之前的故事进度摘要：\n${existingSummary}\n\n请根据以下新的对话记录，将新内容融入摘要中，更新为一个完整的故事进度摘要（不超过500字）：\n\n${olderText}`
    : `请根据以下对话记录，生成一个故事进度摘要（不超过500字），包括：已发生的关键事件、角色关系变化、当前未解决的冲突、重要的伏笔：\n\n${olderText}`;

  try {
    const completion = await client.chat.completions.create({
      model: modelId,
      messages: [
        { role: "system", content: "你是一个故事进度摘要生成器。请简洁地总结故事进展，保留关键事件和因果链。" },
        { role: "user", content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 600,
    });
    const summary = completion.choices[0]?.message?.content?.trim();
    if (summary) {
      updateCompactionSummary(dialogueId, summary);
    }
  } catch { /* compaction is best-effort */ }
}

function buildPlotHints(dialogueId: string): string | null {
  try {
    const state = getPlotState(dialogueId);
    const activeLines = state.plotLines.filter((l) => l.status === "active");
    if (activeLines.length === 0) return null;

    // get current message count for pressure calculation
    const record = getDialogue(dialogueId);
    const currentMsgIndex = record ? record.messages.filter((m) => m.role !== "system").length : 0;

    const hints: string[] = [];
    const sections: string[] = [];

    // 1) active node next steps
    for (const line of activeLines) {
      const activeNode = line.nodes.find((n) => n.status === "active");
      if (!activeNode) continue;
      const nextNode = line.nodes.find(
        (n) => n.status === "pending" && n.order > activeNode.order
      );
      if (nextNode) {
        hints.push(`- 【${line.title}】当前：${activeNode.content} → 下一步：${nextNode.content}`);
      } else {
        hints.push(`- 【${line.title}】当前：${activeNode.content}`);
      }
    }

    // 2) pending first-nodes on inactive lines (no active node yet) — with pressure
    const untouchedLines: string[] = [];
    const pressureLines: string[] = [];
    const urgentLines: string[] = [];

    for (const line of activeLines) {
      if (line.nodes.some((n) => n.status === "active")) continue; // already has active
      const firstPending = line.nodes.find((n) => n.status === "pending");
      if (!firstPending) continue;
      const waited = firstPending.pendingSince != null
        ? currentMsgIndex - firstPending.pendingSince
        : 0;
      const entry = `- 【${line.title}】${firstPending.content}`;
      if (waited >= 20) urgentLines.push(entry);
      else if (waited >= 10) pressureLines.push(entry);
      else untouchedLines.push(entry);
    }

    if (untouchedLines.length > 0) {
      sections.push(`📋 可选方向（请根据故事节奏自然地选择时机引入）：\n${untouchedLines.join("\n")}`);
    }
    if (pressureLines.length > 0) {
      sections.push(`⏳ 建议方向（这些剧情线已经等待了一段时间，请考虑在合适的时机展开）：\n${pressureLines.join("\n")}`);
    }
    if (urgentLines.length > 0) {
      sections.push(`🔥 强烈推荐（这些剧情线已经等待较久，请尽快寻找切入点引入）：\n${urgentLines.join("\n")}`);
    }

    if (hints.length === 0 && sections.length === 0) return null;

    const parts: string[] = [];
    if (hints.length > 0) {
      parts.push(`[剧情提示-进行中] 以下是当前正在进行的故事发展方向：\n${hints.join("\n")}`);
    }
    parts.push(...sections);

    return `${parts.join("\n\n")}\n\n注意：请自然地融入叙事，不要生硬地照搬。根据故事当下的节奏和氛围，自主判断何时引入哪个方向。`;
  } catch {
    return null;
  }
}
