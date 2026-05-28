import { NextRequest } from "next/server";
import OpenAI from "openai";
import { getBook } from "@/lib/db";
import { getDialogueMessages, getDialogue, appendMessage, deleteMessages } from "@/lib/dialogue-store";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const dialogueId = searchParams.get("dialogueId");
  if (!dialogueId) return new Response("dialogueId is required", { status: 400 });

  const record = getDialogue(dialogueId);
  if (!record) return new Response("Dialogue not found", { status: 404 });

  // Return messages excluding system prompt
  const messages = record.messages.filter((m) => m.role !== "system");
  return new Response(JSON.stringify({ messages, name: record.name }), {
    headers: { "Content-Type": "application/json" },
  });
}

export async function DELETE(req: NextRequest) {
  try {
    const { dialogueId, indices } = await req.json();
    if (!dialogueId || !indices) return new Response("dialogueId and indices required", { status: 400 });
    const messages = deleteMessages(dialogueId, indices);
    return new Response(JSON.stringify({ messages }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { dialogueId, message, baseUrl, apiKey, modelId, regenerate } = await req.json();

    if (!apiKey) return new Response("API Key is required", { status: 400 });
    if (!modelId) return new Response("Model ID is required", { status: 400 });
    if (!dialogueId) return new Response("dialogueId is required", { status: 400 });

    const record = getDialogue(dialogueId);
    if (!record) return new Response("Dialogue not found", { status: 404 });

    const client = new OpenAI({ apiKey, baseURL: baseUrl.replace(/\/$/, "") });

    // Build LLM messages: system prompt (from config or first message) + history + new user msg
    const llmMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

    // Add system prompt if present in the record config
    if (record.config?.dialogue_system_prompt) {
      llmMessages.push({ role: "system", content: record.config.dialogue_system_prompt });
    } else {
      // Fallback: use the first system message from stored messages
      const sysMsg = record.messages.find((m) => m.role === "system");
      if (sysMsg) llmMessages.push({ role: "system", content: sysMsg.content });
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
