import { NextRequest } from "next/server";
import OpenAI from "openai";
import { createBook, getBook, updateBook } from "@/lib/db";
import { createDialogue, getDialogue, getOpeningOptions } from "@/lib/dialogue-store";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

/* ── tools ─────────────────────────────────────────── */

const CREATE_BOOK_TOOL = {
  type: "function" as const,
  function: {
    name: "create_book",
    description: "创建一本新故事。收集完背景、风格、名字后调用。",
    parameters: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "故事名字" },
        genre: { type: "string", description: "故事背景，如 仙侠/科幻/都市/奇幻" },
        style: { type: "string", description: "文字风格，如 网络小说/轻小说/传统文学" },
        system_prompt: {
          type: "string",
          description: "系统提示词（200-400字），帮助后续AI理解故事设定和文风。",
        },
      },
      required: ["name", "genre", "style", "system_prompt"],
    },
  },
};

const START_DIALOGUE_TOOL = {
  type: "function" as const,
  function: {
    name: "start_dialogue",
    description:
      "创建故事对话的开场白和配置。收集完时间、地点、主角、NPC、模式后调用。",
    parameters: {
      type: "object" as const,
      properties: {
        mode: { type: "string", enum: ["novel", "roleplay"], description: "对话模式" },
        pov: { type: "string", enum: ["first", "third"], description: "人称：first=第一人称, third=第三人称" },
        time: { type: "string", description: "故事发生的时间" },
        place: { type: "string", description: "故事发生的地点" },
        protagonist_name: { type: "string", description: "主角（用户扮演）的名字" },
        protagonist_description: { type: "string", description: "主角的描述" },
        npcs: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              description: { type: "string" },
            },
            required: ["name", "description"],
          },
          description: "NPC 列表（AI 扮演）",
        },
        dialogue_system_prompt: {
          type: "string",
          description: "对话系统提示词（300-500字），永不修改，作为对话的 system 消息。",
        },
        opening: { type: "string", description: "开场白（200-400字），对话的第一条消息。" },
      },
      required: [
        "mode", "pov", "time", "place",
        "protagonist_name", "protagonist_description",
        "npcs", "dialogue_system_prompt", "opening",
      ],
    },
  },
};

const SAVE_PROTAGONIST_TOOL = {
  type: "function" as const,
  function: {
    name: "save_protagonist",
    description: "将主角信息保存到故事中。在用户同意保存后调用。",
    parameters: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "主角名字" },
        description: { type: "string", description: "主角描述" },
      },
      required: ["name", "description"],
    },
  },
};

const REUSE_OPENING_TOOL = {
  type: "function" as const,
  function: {
    name: "reuse_opening",
    description: "复用已有的开场白创建新对话。用户选择复用某个开场白时调用。",
    parameters: {
      type: "object" as const,
      properties: {
        source_dialogue_id: { type: "string", description: "要复用的对话 ID" },
      },
      required: ["source_dialogue_id"],
    },
  },
};

const CLOSE_DIALOGUE_TOOL = {
  type: "function" as const,
  function: {
    name: "close_dialogue",
    description: "关闭当前对话，返回故事列表。用户说「关闭对话」「退出」「回到首页」等时调用。",
    parameters: { type: "object" as const, properties: {} },
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

function loadSkillPrompt(name: string, vars?: Record<string, string>): string {
  try {
    const p = join(process.cwd(), "src", "prompts", `${name}.md`);
    if (!existsSync(p)) return "";
    let content = readFileSync(p, "utf-8");
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        content = content.replaceAll(`{${k}}`, v);
      }
    }
    return content;
  } catch {
    return "";
  }
}

/* ── tool execution helpers ────────────────────────── */

function buildTools(task: string | null, bookId?: number) {
  const list: typeof CREATE_BOOK_TOOL[] = [];
  if (task === "create-story") list.push(CREATE_BOOK_TOOL);
  if (task === "open-dialogue")
    list.push(START_DIALOGUE_TOOL, SAVE_PROTAGONIST_TOOL);
  if (task === "new-dialogue")
    list.push(REUSE_OPENING_TOOL, START_DIALOGUE_TOOL, SAVE_PROTAGONIST_TOOL);
  // close_dialogue is always available (no special task needed)
  list.push(CLOSE_DIALOGUE_TOOL);
  return list.length > 0 ? list : undefined;
}

function buildSystemPrompt(
  task: string | null,
  bookId?: number,
  contextBook?: { id: number; name: string; genre: string; style: string }
): string {
  if (task === "create-story") {
    const skill = loadSkillPrompt("create-story");
    if (skill) return `${DEFAULT_SYSTEM}\n\n---\n\n## 当前任务：创建故事\n\n${skill}`;
  }
  if (task === "new-dialogue" && bookId) {
    const openings = getOpeningOptions(bookId);
    let openingList = "";
    if (openings.length > 0) {
      openingList = openings
        .map((o, i) => `${i + 1}. ${o.name}\n   开场白预览：${o.opening.slice(0, 100)}...`)
        .join("\n");
    }
    const skill = loadSkillPrompt("new-dialogue", { book_name: contextBook?.name || "故事" });
    if (skill) {
      let prompt = `${DEFAULT_SYSTEM}\n\n---\n\n${skill}`;
      if (openingList) {
        prompt = prompt.replace(
          "{opening_1_name}",
          openingList || "（暂无已有开场白，请直接创建新的）"
        );
      }
      return prompt;
    }
  }
  if (task === "open-dialogue" && bookId) {
    const skill = loadSkillPrompt("open-dialogue");
    if (skill) return `${DEFAULT_SYSTEM}\n\n---\n\n## 当前任务：为故事创建开场白\n\n${skill}`;
  }
  if (contextBook) {
    return `${DEFAULT_SYSTEM}\n\n---\n\n## 用户当前正在编辑的故事\n\n- **书名**：《${contextBook.name}》
- **背景**：${contextBook.genre}
- **风格**：${contextBook.style}

当用户提到"这个故事""当前故事""它"等词时，指的是上面这个故事。请在回答时结合该故事的背景和风格。`;
  }
  return DEFAULT_SYSTEM;
}

async function executeToolCall(
  name: string,
  args: Record<string, unknown>,
  bookId?: number
): Promise<{ success: boolean; [key: string]: unknown }> {
  switch (name) {
    case "create_book": {
      const book = await createBook({
        name: args.name as string,
        genre: args.genre as string,
        style: args.style as string,
        system_prompt: (args.system_prompt as string) || "",
      });
      return { success: true, book };
    }
    case "start_dialogue": {
      if (!bookId) return { success: false, error: "bookId is required" };
      const config = {
        mode: args.mode as "novel" | "roleplay",
        pov: args.pov as "first" | "third",
        time: args.time as string,
        place: args.place as string,
        protagonist: {
          name: args.protagonist_name as string,
          description: args.protagonist_description as string,
        },
        npcs: (args.npcs as { name: string; description: string }[]) || [],
        dialogue_system_prompt: args.dialogue_system_prompt as string,
      };
      const name = `对话 - ${new Date().toLocaleString("zh-CN")}`;
      const dialogue = createDialogue(bookId, name, [
        { role: "system", content: config.dialogue_system_prompt },
        { role: "assistant", content: args.opening as string },
      ], config);
      await updateBook(bookId, { active_dialogue_id: dialogue.id, dialogue_config: config });
      return { success: true, dialogueId: dialogue.id, bookId };
    }
    case "save_protagonist": {
      if (!bookId) return { success: false, error: "bookId is required" };
      const book = await getBook(bookId);
      if (!book?.dialogue_config) return { success: false, error: "No dialogue config" };
      const updatedConfig = {
        ...book.dialogue_config,
        protagonist: {
          name: args.name as string,
          description: args.description as string,
        },
      };
      await updateBook(bookId, { dialogue_config: updatedConfig });
      return { success: true };
    }
    case "reuse_opening": {
      if (!bookId) return { success: false, error: "bookId is required" };
      const sourceId = args.source_dialogue_id as string;
      const source = getDialogue(sourceId);
      if (!source) return { success: false, error: "Source dialogue not found" };
      if (!source.config) return { success: false, error: "Source dialogue has no config" };
      const name = `对话 - ${new Date().toLocaleString("zh-CN")}`;
      const dialogue = createDialogue(bookId, name, [
        { role: "system", content: source.config.dialogue_system_prompt },
        { role: "assistant", content: source.messages.find((m) => m.role === "assistant")?.content || "" },
      ], source.config);
      await updateBook(bookId, { active_dialogue_id: dialogue.id, dialogue_config: source.config });
      return { success: true, dialogueId: dialogue.id, bookId };
    }
    case "close_dialogue": {
      if (bookId) {
        await updateBook(bookId, { active_dialogue_id: null });
      }
      return { success: true, action: "close_dialogue" };
    }
    default:
      return { success: false, error: `Unknown tool: ${name}` };
  }
}

/* ── handler ───────────────────────────────────────── */

export async function POST(req: NextRequest) {
  try {
    const { messages, baseUrl, apiKey, modelId, task, bookId, contextBook } = await req.json();

    if (!apiKey) return new Response("API Key is required", { status: 400 });
    if (!modelId) return new Response("Model ID is required", { status: 400 });

    const client = new OpenAI({ apiKey, baseURL: baseUrl.replace(/\/$/, "") });

    const systemContent = buildSystemPrompt(task, bookId, contextBook);
    const tools = buildTools(task, bookId);

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
          const stream1 = await client.chat.completions.create({
            model: modelId,
            messages: llmMessages,
            stream: true,
            tools,
            tool_choice: tools ? "auto" : undefined,
          });

          let toolCalls: Map<number, { id: string; name: string; args: string }> = new Map();
          let reasoningContent = "";

          for await (const chunk of stream1) {
            const delta = chunk.choices[0]?.delta;
            const d = delta as Record<string, unknown>;

            if (d?.reasoning_content)
              reasoningContent += d.reasoning_content as string;

            if (delta?.tool_calls) {
              for (const tc of delta.tool_calls) {
                const idx = tc.index;
                if (!toolCalls.has(idx))
                  toolCalls.set(idx, { id: tc.id || "", name: tc.function?.name || "", args: "" });
                const e = toolCalls.get(idx)!;
                if (tc.id) e.id = tc.id;
                if (tc.function?.name) e.name = tc.function.name;
                if (tc.function?.arguments) e.args += tc.function.arguments;
              }
            }

            if (delta?.content) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ text: delta.content })}\n\n`)
              );
            }
          }

          if (toolCalls.size > 0) {
            for (const [, tc] of toolCalls) {
              try {
                const args = JSON.parse(tc.args);
                const result = await executeToolCall(tc.name, args, bookId);

                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({ tool_result: { name: tc.name, ...result } })}\n\n`
                  )
                );

                // append assistant tool_call + tool result for follow-up
                llmMessages.push({
                  role: "assistant",
                  content: null,
                  ...(reasoningContent ? { reasoning_content: reasoningContent } : {}),
                  tool_calls: [{
                    id: tc.id,
                    type: "function" as const,
                    function: { name: tc.name, arguments: tc.args },
                  }],
                } as OpenAI.Chat.Completions.ChatCompletionMessageParam);
                llmMessages.push({
                  role: "tool",
                  tool_call_id: tc.id,
                  content: JSON.stringify(result),
                });

                // stream follow-up response
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
                const msg = err instanceof Error ? err.message : "执行失败";
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({ tool_result: { name: tc.name, success: false, error: msg } })}\n\n`
                  )
                );
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
