import { NextRequest } from "next/server";
import OpenAI from "openai";
import { getDialogue } from "@/lib/dialogue-store";
import { getStoryState, saveStoryState, getDefaultStoryState, type StoryState } from "@/lib/story-state";
import { requireUserId } from "@/lib/auth-helper";

// GET — load existing story state
export async function GET(req: NextRequest) {
  const dialogueId = req.nextUrl.searchParams.get("dialogueId");
  if (!dialogueId) return new Response("dialogueId is required", { status: 400 });

  const record = getDialogue(dialogueId);
  if (!record) return new Response(JSON.stringify({ error: "Dialogue not found" }), { status: 404 });

  const userId = await requireUserId();
  if (userId === "NEEDS_SETUP") return new Response(JSON.stringify({ error: "请先完成初始化设置" }), { status: 400 });
  if (record.userId && record.userId !== userId) {
    return new Response(JSON.stringify({ error: "Access denied" }), { status: 403 });
  }

  const state = getStoryState(dialogueId);
  return new Response(JSON.stringify({ state }), {
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(req: NextRequest) {
  try {
    const { dialogueId, baseUrl, apiKey, modelId, messageCount } = await req.json();

    if (!dialogueId || !apiKey || !modelId) {
      return new Response(JSON.stringify({ error: "dialogueId, apiKey, modelId are required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const record = getDialogue(dialogueId);
    if (!record) return new Response(JSON.stringify({ error: "Dialogue not found" }), { status: 404 });

    // 验证所有权
    const userId = await requireUserId();
    if (userId === "NEEDS_SETUP") return new Response(JSON.stringify({ error: "请先完成初始化设置" }), { status: 400 });
    if (record.userId && record.userId !== userId) {
      return new Response(JSON.stringify({ error: "Access denied" }), { status: 403 });
    }

    // get existing state for incremental update
    const existingState = getStoryState(dialogueId);

    // collect recent messages for analysis
    const nonSystem = record.messages.filter((m) => m.role !== "system");
    const count = Math.min(messageCount || 20, nonSystem.length);
    const recentMessages = nonSystem.slice(-count);

    // build messages for LLM
    const systemPrompt = buildAnalysisPrompt(existingState);

    const client = new OpenAI({ apiKey, baseURL: baseUrl.replace(/\/$/, "") });

    const completion = await client.chat.completions.create({
      model: modelId,
      messages: [
        { role: "system", content: systemPrompt },
        ...recentMessages.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      ],
      temperature: 0.3,
      max_tokens: 2048,
    });

    const raw = completion.choices[0]?.message?.content || "";
    const state = parseState(raw, existingState);

    // save
    state.lastAnalyzedAt = new Date().toISOString();
    state.analyzedMessageIndex = nonSystem.length - 1;
    // ensure protagonist is in characters list
    if (state.protagonist && !state.characters.some((c) => c.name === state.protagonist!.name)) {
      state.characters.push(state.protagonist);
    }
    saveStoryState(dialogueId, state);

    return new Response(JSON.stringify({ state }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

function buildAnalysisPrompt(existing: StoryState): string {
  const existingJson = JSON.stringify({
    characters: existing.characters,
    protagonist: existing.protagonist,
    currentLocation: existing.currentLocation,
    currentDate: existing.currentDate,
    currentTime: existing.currentTime,
  }, null, 2);

  return `你是一个故事状态追踪器。根据对话记录，提取并更新当前故事状态。结合已有的状态进行增量更新——新增角色、更新已有角色信息、更新地点时间等。

已有状态：
${existingJson}

请以 JSON 格式返回更新后的完整状态：
{
  "characters": [
    {
      "name": "角色名",
      "alias": "别名/外号（没有则为空字符串）",
      "avatar": "default",
      "persona": "人设/性格描述",
      "appearance": "外观/衣物打扮",
      "preferences": "喜好",
      "background": "背景故事"
    }
  ],
  "protagonist": { ...主角信息，格式同角色 },
  "currentLocation": "当前地点（没有则为空字符串）",
  "currentDate": "当前日期（没有则为空字符串）",
  "currentTime": "当前时间（没有则为空字符串）"
}

注意：
1. avatar 字段固定为 "default"，不要修改
2. 只返回 JSON，不要任何其他文字
3. 基于已有状态增量更新，不要丢失已有角色
4. 主角也放在 characters 列表中`;
}

function parseState(raw: string, fallback: StoryState): StoryState {
  try {
    // try to extract JSON from the response
    let json = raw.trim();
    // remove markdown code fences if present
    const fenceMatch = json.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) json = fenceMatch[1].trim();
    const parsed = JSON.parse(json);

    const defaults = getDefaultStoryState();
    return {
      characters: Array.isArray(parsed.characters) ? parsed.characters : defaults.characters,
      protagonist: parsed.protagonist || defaults.protagonist,
      currentLocation: parsed.currentLocation || defaults.currentLocation,
      currentDate: parsed.currentDate || defaults.currentDate,
      currentTime: parsed.currentTime || defaults.currentTime,
      lastAnalyzedAt: fallback.lastAnalyzedAt,
      analyzedMessageIndex: fallback.analyzedMessageIndex,
    };
  } catch {
    // if parsing fails, return existing state unchanged
    return fallback;
  }
}
