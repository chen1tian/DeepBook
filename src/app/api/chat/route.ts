import { NextRequest } from "next/server";
import OpenAI from "openai";
import { createBook } from "@/lib/db";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

/* ── tools ─────────────────────────────────────────── */

const CREATE_BOOK_TOOL = {
  type: "function" as const,
  function: {
    name: "create_book",
    description: "创建一本新故事。在收集完用户的背景、风格、名字信息后调用。",
    parameters: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "故事名字" },
        genre: { type: "string", description: "故事背景类型，如 仙侠/科幻/都市/奇幻 等" },
        style: { type: "string", description: "文字风格，如 网络小说/轻小说/传统文学 等" },
        system_prompt: {
          type: "string",
          description:
            "为这个故事生成的系统提示词（200-400字），帮助后续AI理解故事的世界观、人物设定和文风。",
        },
      },
      required: ["name", "genre", "style", "system_prompt"],
    },
  },
};

/* ── prompts ───────────────────────────────────────── */

const DEFAULT_SYSTEM = `你是 DeepBook 的智能助手，一位博学、善解人意且富有创造力的伙伴。

你的职责：
- 帮助用户进行小说创作：情节构思、角色塑造、世界观构建、文笔润色等
- 支持角色扮演：扮演任意角色与用户互动
- 回答文学、写作相关问题
- 引导用户探索故事的多种可能性

对话风格：
- 创作时专业细致，角色扮演时全情投入
- 保持友好、温暖的语调
- 使用中文交流

你是一个创意伙伴，不是命令执行工具。主动思考、给出有见地的建议。
`;

function loadSkillPrompt(name: string): string {
  try {
    const path = join(process.cwd(), "src", "prompts", `${name}.md`);
    if (existsSync(path)) return readFileSync(path, "utf-8");
  } catch {}
  return "";
}

/* ── handler ───────────────────────────────────────── */

export async function POST(req: NextRequest) {
  try {
    const { messages, baseUrl, apiKey, modelId, task } = await req.json();

    if (!apiKey) return new Response("API Key is required", { status: 400 });
    if (!modelId) return new Response("Model ID is required", { status: 400 });

    const client = new OpenAI({ apiKey, baseURL: baseUrl.replace(/\/$/, "") });

    // pick system prompt
    let systemContent = DEFAULT_SYSTEM;
    const includeTools = task === "create-story";

    if (task === "create-story") {
      const skill = loadSkillPrompt("create-story");
      if (skill) {
        systemContent = `${DEFAULT_SYSTEM}\n\n---\n\n## 当前任务：创建故事\n\n${skill}`;
      }
    }

    // build message array for the LLM
    const llmMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: "system", content: systemContent },
      ...messages.map((m: { role: string; content: string }) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    ];

    const encoder = new TextEncoder();

    const readable = new ReadableStream({
      async start(controller) {
        try {
          // Phase 1: stream the first response (may include tool calls)
          const stream1 = await client.chat.completions.create({
            model: modelId,
            messages: llmMessages,
            stream: true,
            tools: includeTools ? [CREATE_BOOK_TOOL] : undefined,
            tool_choice: includeTools ? "auto" : undefined,
          });

          let toolCalls: Map<
            number,
            { id: string; name: string; args: string }
          > = new Map();
          let reasoningContent = "";

          for await (const chunk of stream1) {
            const delta = chunk.choices[0]?.delta;

            // collect reasoning_content (DeepSeek thinking mode)
            if ((delta as Record<string, unknown>)?.reasoning_content) {
              reasoningContent += (delta as Record<string, unknown>).reasoning_content as string;
            }

            // collect tool calls
            if (delta?.tool_calls) {
              for (const tc of delta.tool_calls) {
                const idx = tc.index;
                if (!toolCalls.has(idx)) {
                  toolCalls.set(idx, { id: tc.id || "", name: tc.function?.name || "", args: "" });
                }
                const entry = toolCalls.get(idx)!;
                if (tc.id) entry.id = tc.id;
                if (tc.function?.name) entry.name = tc.function.name;
                if (tc.function?.arguments) entry.args += tc.function.arguments;
              }
            }

            // stream text content
            if (delta?.content) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ text: delta.content })}\n\n`)
              );
            }
          }

          // Phase 2: if tool calls were collected, execute them
          if (toolCalls.size > 0) {
            for (const [, tc] of toolCalls) {
              if (tc.name === "create_book") {
                try {
                  const args = JSON.parse(tc.args);
                  const book = await createBook({
                    name: args.name,
                    genre: args.genre,
                    style: args.style,
                    system_prompt: args.system_prompt || "",
                  });

                  // notify client
                  controller.enqueue(
                    encoder.encode(
                      `data: ${JSON.stringify({ tool_result: { name: "create_book", success: true, book } })}\n\n`
                    )
                  );

                  // append assistant tool_call + tool result to messages for follow-up
                  llmMessages.push({
                    role: "assistant",
                    content: null,
                    ...(reasoningContent
                      ? { reasoning_content: reasoningContent }
                      : {}),
                    tool_calls: [
                      {
                        id: tc.id,
                        type: "function" as const,
                        function: { name: tc.name, arguments: tc.args },
                      },
                    ],
                  } as OpenAI.Chat.Completions.ChatCompletionMessageParam);
                  llmMessages.push({
                    role: "tool",
                    tool_call_id: tc.id,
                    content: JSON.stringify({ success: true, book_id: book.id, name: book.name }),
                  });

                  // Phase 3: stream the follow-up response
                  const stream2 = await client.chat.completions.create({
                    model: modelId,
                    messages: llmMessages,
                    stream: true,
                  });

                  for await (const chunk of stream2) {
                    const delta = chunk.choices[0]?.delta?.content;
                    if (delta) {
                      controller.enqueue(
                        encoder.encode(`data: ${JSON.stringify({ text: delta })}\n\n`)
                      );
                    }
                  }
                } catch (err) {
                  const msg = err instanceof Error ? err.message : "创建失败";
                  controller.enqueue(
                    encoder.encode(
                      `data: ${JSON.stringify({ tool_result: { name: "create_book", success: false, error: msg } })}\n\n`
                    )
                  );
                }
              }
            }
          }

          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (err) {
          const message = err instanceof Error ? err.message : "Unknown error";
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: message })}\n\n`)
          );
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
