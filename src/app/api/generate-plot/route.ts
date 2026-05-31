import { NextRequest } from "next/server";
import OpenAI from "openai";
import { getDialogue } from "@/lib/dialogue-store";
import { getPlotState, savePlotState } from "@/lib/plot-state";
import { getStoryState } from "@/lib/story-state";
import { requireUserId } from "@/lib/auth-helper";
import { applyActivePreset } from "@/lib/llm-utils";

export async function POST(req: NextRequest) {
  try {
    const { dialogueId, baseUrl, apiKey, modelId, messageCount, maxActiveLines } = await req.json();
    if (!dialogueId || !apiKey || !modelId) {
      return new Response(JSON.stringify({ error: "dialogueId, apiKey, modelId required" }), { status: 400 });
    }

    const record = getDialogue(dialogueId);
    if (!record) return new Response(JSON.stringify({ error: "Dialogue not found" }), { status: 404 });

    // 验证所有权
    const userId = await requireUserId();
    if (userId === "NEEDS_SETUP") return new Response(JSON.stringify({ error: "请先完成初始化设置" }), { status: 400 });
    if (record.userId && record.userId !== userId) {
      return new Response(JSON.stringify({ error: "Access denied" }), { status: 403 });
    }

    const plotState = getPlotState(dialogueId);

    // 检查激活剧情线数量是否已达上限
    const threshold = maxActiveLines ?? 10;
    const activeCount = plotState.plotLines.filter((l) => l.status === "active").length;
    if (activeCount >= threshold) {
      return new Response(JSON.stringify({
        state: plotState,
        newLines: 0,
        skipped: true,
        reason: `已有 ${activeCount} 条激活剧情线，达到上限 ${threshold}`,
      }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const storyState = getStoryState(dialogueId);

    // collect recent messages
    const nonSystem = record.messages.filter((m) => m.role !== "system");
    const count = Math.min(messageCount || 20, nonSystem.length);
    const recentMessages = nonSystem.slice(-count);
    const recentText = recentMessages.map((m) => `${m.role}: ${m.content.slice(0, 1500)}`).join("\n\n");

    const systemPrompt = buildRichContext(plotState, storyState, recentMessages);

    const client = new OpenAI({ apiKey, baseURL: baseUrl.replace(/\/$/, "") });
    const completion = await client.chat.completions.create({
      model: modelId,
      messages: applyActivePreset([
        { role: "system", content: systemPrompt },
        { role: "user", content: `基于以下最近的对话内容，分析故事发展方向并生成新的剧情线：\n\n${recentText}` },
      ], userId),
      temperature: 0.8,
      max_tokens: 2048,
    });

    const raw = completion.choices[0]?.message?.content || "";
    const newLines = parseNewPlotLines(raw);

    if (newLines.length > 0) {
      for (const line of newLines) {
        // avoid duplicates by title
        if (plotState.plotLines.some((l) => l.title === line.title)) continue;
        plotState.plotLines.push(line);
      }
      plotState.lastGeneratedAt = new Date().toISOString();
      savePlotState(dialogueId, plotState);
    }

    return new Response(JSON.stringify({ state: plotState, newLines: newLines.length }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), { status: 500 });
  }
}

function generateId(): string {
  return `pl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function buildRichContext(
  plotState: ReturnType<typeof getPlotState>,
  storyState: ReturnType<typeof getStoryState>,
  recentMessages: { role: string; content: string }[]
): string {
  const existingTitles = plotState.plotLines.map((l) => `- ${l.title} (${l.status})`).join("\n");

  // build recent text for keyword matching
  const recentText = recentMessages.map((m) => m.content).join(" ");

  // multi-name matching: find mentioned characters
  const characterProfiles: string[] = [];
  let protagonistProfile = "";
  for (const char of storyState.characters) {
    const keywords = [char.name, ...char.alias.split(/[、，,]/).map((s) => s.trim()).filter(Boolean)];
    const mentioned = keywords.some((kw) => recentText.includes(kw));
    const isProtagonist = storyState.protagonist?.name === char.name;
    if (!mentioned && !isProtagonist) continue;

    const profile = buildCharacterProfile(char);
    if (isProtagonist) {
      protagonistProfile = `【★主角】${profile}`;
    } else if (profile) {
      characterProfiles.push(profile);
    }
  }
  // protagonist always first
  if (protagonistProfile) characterProfiles.unshift(protagonistProfile);

  // causal network: extract unresolved tensions
  const causalSummary = buildCausalNetwork(storyState);

  // compose
  const parts: string[] = [];
  parts.push(`已有剧情线：\n${existingTitles || "（无）"}`);
  parts.push(`当前地点：${storyState.currentLocation || "未知"}`);
  parts.push(`当前日期：${storyState.currentDate || "未知"}  当前时间：${storyState.currentTime || "未知"}`);
  if (characterProfiles.length > 0) {
    parts.push(`相关角色信息（最近对话中提及的角色）：\n${characterProfiles.join("\n---\n")}`);
  }
  if (causalSummary) {
    parts.push(`角色因果网络（未解决的张力/冲突/人情债）：\n${causalSummary}`);
  }

  // story settings
  const settings = storyState.settings || [];
  if (settings.length > 0) {
    const settingLines = settings.slice(0, 10).map((s) => `- [${s.category}] ${s.key}：${s.value}`).join("\n");
    parts.push(`故事设定（世界观/规则/背景）：\n${settingLines}`);
  }

  const contextBlock = parts.join("\n\n");

  return `你是一个创意故事策划师。根据当前故事进展和角色状态，为故事生成可能的分支剧情线。

${contextBlock}

请生成 1-3 条新的剧情线（不要与已有剧情线重复标题），每条剧情线包含 2-4 个具体节点。

剧情方向应该多样化，随机涵盖：
- 和缓路线（日常、温情、成长）
- 紧张路线（冲突、危机、对抗）
- 反转路线（意外、背叛、真相揭露）
- 高风险高回报路线（冒险、赌注、重大抉择）

优先从角色因果网络中提取素材——未解决的冲突、人情债、积压的情绪，都是绝佳的剧情种子。

返回 JSON 格式：
{
  "lines": [
    {
      "title": "剧情线标题（简短）",
      "direction": "路线类型描述",
      "nodes": [
        { "content": "节点1内容（具体的故事情节描述）" },
        { "content": "节点2内容" }
      ]
    }
  ]
}

注意：只返回 JSON，不要其他文字。`;
}

function buildCharacterProfile(char: { name: string; alias: string; persona: string; appearance: string; preferences: string; background: string; items?: string[]; lifeEvents?: { date: string; description: string; cause: string; effect: string; relatedCharacters: string[] }[] }): string {
  const lines: string[] = [];
  lines.push(`【${char.name}】${char.alias ? `（别名：${char.alias}）` : ""}`);
  if (char.persona) lines.push(`性格：${char.persona}`);
  if (char.appearance) lines.push(`外观：${char.appearance}`);
  if (char.preferences) lines.push(`喜好：${char.preferences}`);
  if (char.background) lines.push(`背景：${char.background}`);
  if (char.items && char.items.length > 0) lines.push(`物品：${char.items.join("、")}`);

  // life events: sorted by date descending, recent first
  const events = char.lifeEvents || [];
  if (events.length > 0) {
    const sorted = [...events].sort((a, b) => b.date.localeCompare(a.date));
    const recent = sorted.slice(0, 10);
    const eventLines = recent.map((e) =>
      `  ${e.date}: ${e.description} ← 原因：${e.cause} → 结果：${e.effect}${e.relatedCharacters?.length ? `（关联：${e.relatedCharacters.join("、")}）` : ""}`
    );
    // collapse older events
    if (sorted.length > 10) {
      const olderSummary = sorted.slice(10).map((e) => `${e.date}: ${e.description}`).join("；");
      lines.push(`最近经历：\n${eventLines.join("\n")}\n更早经历：${olderSummary}`);
    } else {
      lines.push(`人生经历：\n${eventLines.join("\n")}`);
    }
  }

  // truncate to ~500 chars
  let profile = lines.join("\n");
  if (profile.length > 500) {
    profile = profile.slice(0, 497) + "...";
  }
  return profile;
}

function buildCausalNetwork(storyState: ReturnType<typeof getStoryState>): string {
  const allEvents: { char: string; event: { date: string; description: string; cause: string; effect: string; relatedCharacters: string[] } }[] = [];
  for (const char of storyState.characters) {
    for (const ev of (char.lifeEvents || [])) {
      allEvents.push({ char: char.name, event: ev });
    }
  }
  // sort by date descending
  allEvents.sort((a, b) => b.event.date.localeCompare(a.event.date));
  if (allEvents.length === 0) return "";

  const recent = allEvents.slice(0, 15);
  return recent.map(({ char, event: e }) =>
    `${char}: ${e.date} ${e.description}（因：${e.cause} → 果：${e.effect}）`
  ).join("\n");
}

interface RawNode { content: string; }
interface RawLine { title: string; direction?: string; nodes: RawNode[]; }

function parseNewPlotLines(raw: string): ReturnType<typeof getPlotState>["plotLines"] {
  try {
    let json = raw.trim();
    const fence = json.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence) json = fence[1].trim();
    const parsed = JSON.parse(json);
    const lines = parsed.lines as RawLine[];
    if (!Array.isArray(lines)) return [];

    const now = new Date().toISOString();
    return lines.map((l) => ({
      id: generateId(),
      title: l.title || "未命名剧情线",
      nodes: (l.nodes || []).map((n, i) => ({
        id: generateId(),
        content: n.content || "",
        status: "pending" as const,
        pendingSince: 0,
        order: i,
      })),
      status: "active" as const,
      createdAt: now,
    }));
  } catch {
    return [];
  }
}
