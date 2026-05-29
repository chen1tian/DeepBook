import { NextRequest } from "next/server";
import OpenAI from "openai";
import { getDialogue } from "@/lib/dialogue-store";
import { getPlotState, savePlotState } from "@/lib/plot-state";
import { getStoryState } from "@/lib/story-state";

export async function POST(req: NextRequest) {
  try {
    const { dialogueId, baseUrl, apiKey, modelId, messageCount } = await req.json();
    if (!dialogueId || !apiKey || !modelId) {
      return new Response(JSON.stringify({ error: "dialogueId, apiKey, modelId required" }), { status: 400 });
    }

    const record = getDialogue(dialogueId);
    if (!record) return new Response(JSON.stringify({ error: "Dialogue not found" }), { status: 404 });

    const plotState = getPlotState(dialogueId);
    const storyState = getStoryState(dialogueId);

    // collect recent messages
    const nonSystem = record.messages.filter((m) => m.role !== "system");
    const count = Math.min(messageCount || 20, nonSystem.length);
    const recentMessages = nonSystem.slice(-count);
    const recentText = recentMessages.map((m) => `${m.role}: ${m.content.slice(0, 1500)}`).join("\n\n");

    const systemPrompt = buildGenerationPrompt(plotState, storyState);

    const client = new OpenAI({ apiKey, baseURL: baseUrl.replace(/\/$/, "") });
    const completion = await client.chat.completions.create({
      model: modelId,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `基于以下最近的对话内容，分析故事发展方向并生成新的剧情线：\n\n${recentText}` },
      ],
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

function buildGenerationPrompt(plotState: ReturnType<typeof getPlotState>, storyState: ReturnType<typeof getStoryState>): string {
  const existingTitles = plotState.plotLines.map((l) => `- ${l.title} (${l.status})`).join("\n");
  const characters = storyState.characters.map((c) => c.name).join("、") || "未知";

  return `你是一个创意故事策划师。根据当前故事进展，为故事生成可能的分支剧情线。

已有剧情线：
${existingTitles || "（无）"}

主要角色：${characters}
当前地点：${storyState.currentLocation || "未知"}

请生成 1-3 条新的剧情线（不要与已有剧情线重复标题），每条剧情线包含 2-4 个具体节点。

剧情方向应该多样化，随机涵盖：
- 和缓路线（日常、温情、成长）
- 紧张路线（冲突、危机、对抗）
- 反转路线（意外、背叛、真相揭露）
- 高风险高回报路线（冒险、赌注、重大抉择）

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
        order: i,
      })),
      status: "active" as const,
      createdAt: now,
    }));
  } catch {
    return [];
  }
}
