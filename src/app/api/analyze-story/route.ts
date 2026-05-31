import { NextRequest } from "next/server";
import OpenAI from "openai";
import { getDialogue } from "@/lib/dialogue-store";
import { getStoryState, saveStoryState, getDefaultStoryState, type StoryState, type CharacterInfo } from "@/lib/story-state";
import type { LifeEvent } from "@/lib/story-state-types";
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

// PATCH — save story state directly (e.g. manual settings edits)
export async function PATCH(req: NextRequest) {
  try {
    const { dialogueId, state } = await req.json();
    if (!dialogueId) return new Response(JSON.stringify({ error: "dialogueId is required" }), { status: 400 });

    const record = getDialogue(dialogueId);
    if (!record) return new Response(JSON.stringify({ error: "Dialogue not found" }), { status: 404 });

    const userId = await requireUserId();
    if (userId === "NEEDS_SETUP") return new Response(JSON.stringify({ error: "请先完成初始化设置" }), { status: 400 });
    if (record.userId && record.userId !== userId) {
      return new Response(JSON.stringify({ error: "Access denied" }), { status: 403 });
    }

    saveStoryState(dialogueId, state as StoryState);
    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), { status: 500 });
  }
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
    settings: existing.settings || [],
  }, null, 2);

  return `你是一个故事状态追踪器。根据对话记录，提取并更新当前故事状态。结合已有的状态进行增量更新——新增角色、更新已有角色信息、更新地点时间、提取故事设定等。

已有状态：
${existingJson}

请以 JSON 格式返回更新后的完整状态：
{
  "characters": [
    {
      "name": "角色名",
      "alias": "别名/外号/昵称/小名，多个用中文逗号分隔。例如：胖子、磊哥、肥仔（没有则为空字符串）",
      "avatar": "default",
      "persona": "人设/性格描述",
      "appearance": "外观/衣物打扮",
      "preferences": "喜好",
      "background": "背景故事",
      "items": ["物品1", "物品2"],
      "lifeEvents": [
        {
          "date": "2024年9月",
          "description": "升职为技术经理",
          "cause": "周远山在裁员后推荐了他",
          "effect": "开始承担管理职责，与林薇薇产生摩擦",
          "relatedCharacters": ["周远山", "林薇薇"]
        }
      ]
    }
  ],
  "protagonist": { ...主角信息，格式同角色 },
  "currentLocation": "当前地点（没有则为空字符串）",
  "currentDate": "当前日期（没有则为空字符串）",
  "currentTime": "当前时间（没有则为空字符串）",
  "settings": [
    {
      "key": "设定名称（简短概括）",
      "value": "设定内容（详细描述这个设定）",
      "category": "分类：世界观/人物关系/历史事件/规则体系/其他"
    }
  ]
}

注意：
1. avatar 字段固定为 "default"，不要修改
2. 只返回 JSON，不要任何其他文字
3. 基于已有状态增量更新，不要丢失已有角色和设定
4. 主角也放在 characters 列表中
5. alias 要收集角色在对话中出现的所有称呼、外号、昵称、小名，多个用中文逗号分隔
6. 【重要】items 必须精确追踪角色当前拥有的所有物品。仔细阅读每一条对话，发现角色获得或失去物品时，更新 items 列表。获得物品 → 加入列表，失去/用掉/丢弃物品 → 从列表移除。不要遗漏任何物品变化
7. lifeEvents 提取最近对话中角色发生的重要事件，重点关注因果：谁做了什么，导致这个角色怎么样了。不要重复已有的事件。每个事件必须包含 cause 和 effect 字段
8. settings 收集对话中提到的重要故事设定（世界观规则、人物关系、历史背景、能力体系等）。同一个设定如果已有则用新信息更新，不要创建重复项`;
}

function parseState(raw: string, fallback: StoryState): StoryState {
  try {
    let json = raw.trim();
    const fenceMatch = json.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) json = fenceMatch[1].trim();
    const parsed = JSON.parse(json);

    const defaults = getDefaultStoryState();

    // Merge settings: dedup by key, assign IDs to new ones
    const existingSettings = fallback.settings || [];
    const existingKeys = new Set(existingSettings.map((s) => s.key));
    const newSettings: typeof existingSettings = Array.isArray(parsed.settings)
      ? parsed.settings.map((s: { key: string; value: string; category: string }) => {
          const existing = existingSettings.find((es) => es.key === s.key);
          if (existing) {
            return { ...existing, value: s.value || existing.value, category: s.category || existing.category };
          }
          return {
            id: `set_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            key: s.key || "",
            value: s.value || "",
            category: s.category || "其他",
          };
        })
      : [];
    const keptSettings = existingSettings.filter((s) => !newSettings.some((ns: { key: string }) => ns.key === s.key));
    const mergedSettings = [...newSettings, ...keptSettings];

    // Merge lifeEvents for characters: dedup by date+description
    const existingChars = new Map(fallback.characters.map((c) => [c.name, c]));
    const mergedChars = (Array.isArray(parsed.characters) ? parsed.characters : []).map((c: CharacterInfo) => {
      const existing = existingChars.get(c.name);
      if (!existing) return { ...c, lifeEvents: c.lifeEvents || [], items: c.items || [] };
      // merge lifeEvents: keep existing, add new ones not yet present
      const existingEventKeys = new Set(existing.lifeEvents?.map((e) => `${e.date}::${e.description}`) || []);
      const newEvents = (c.lifeEvents || []).filter((e) => !existingEventKeys.has(`${e.date}::${e.description}`));
      return { ...c, lifeEvents: [...(existing.lifeEvents || []), ...newEvents], items: c.items || existing.items || [] };
    });

    // Merge protagonist: prefer merged character if already in list, else merge manually
    let mergedProtagonist = parsed.protagonist || null;
    if (mergedProtagonist) {
      const existingProto = existingChars.get(mergedProtagonist.name);
      if (existingProto) {
        mergedProtagonist = {
          ...existingProto,
          ...mergedProtagonist,
          lifeEvents: [...(existingProto.lifeEvents || []), ...((mergedProtagonist.lifeEvents || []).filter(
            (e: LifeEvent) => !(existingProto.lifeEvents || []).some((ee: LifeEvent) => ee.date === e.date && ee.description === e.description)
          ))],
          items: mergedProtagonist.items || existingProto.items || [],
        };
      }
    }

    return {
      characters: mergedChars.length > 0 ? mergedChars : defaults.characters,
      protagonist: mergedProtagonist,
      currentLocation: parsed.currentLocation || defaults.currentLocation,
      currentDate: parsed.currentDate || defaults.currentDate,
      currentTime: parsed.currentTime || defaults.currentTime,
      settings: mergedSettings,
      lastAnalyzedAt: fallback.lastAnalyzedAt,
      analyzedMessageIndex: fallback.analyzedMessageIndex,
    };
  } catch {
    return fallback;
  }
}
