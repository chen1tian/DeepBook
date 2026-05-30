import { NextRequest } from "next/server";
import OpenAI from "openai";
import { getDialogue } from "@/lib/dialogue-store";
import { getPlotState, savePlotState, getDefaultPlotState, type PlotState } from "@/lib/plot-state";
import { requireUserId } from "@/lib/auth-helper";

export async function POST(req: NextRequest) {
  try {
    const { dialogueId, baseUrl, apiKey, modelId, messageCount } = await req.json();
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
    if (plotState.plotLines.length === 0) {
      return new Response(JSON.stringify({ state: plotState, noChanges: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // collect recent messages
    const nonSystem = record.messages.filter((m) => m.role !== "system");
    const count = Math.min(messageCount || 20, nonSystem.length);
    const recentMessages = nonSystem.slice(-count);

    // build concise analysis prompt
    const systemPrompt = buildPlotAnalysisPrompt(plotState);

    const client = new OpenAI({ apiKey, baseURL: baseUrl.replace(/\/$/, "") });
    const completion = await client.chat.completions.create({
      model: modelId,
      messages: [
        { role: "system", content: systemPrompt },
        ...recentMessages.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content.slice(0, 2000),
        })),
      ],
      temperature: 0.2,
      max_tokens: 1024,
    });

    const raw = completion.choices[0]?.message?.content || "";
    const updates = parsePlotUpdates(raw, plotState);
    plotState.lastAnalyzedAt = new Date().toISOString();
    savePlotState(dialogueId, plotState);

    return new Response(JSON.stringify({ state: plotState, updates }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), { status: 500 });
  }
}

function buildPlotAnalysisPrompt(state: PlotState): string {
  const activeLines = state.plotLines.filter((l) => l.status === "active");
  const pendingNodes: string[] = [];
  const activeNodes: string[] = [];

  for (const line of activeLines) {
    for (const node of line.nodes) {
      if (node.status === "active") activeNodes.push(`[${line.title}] ${node.content}`);
      if (node.status === "pending" && line.nodes.some((n) => n.status === "active")) {
        pendingNodes.push(`[${line.title}] ${node.content}`);
      }
    }
  }

  // also include first pending nodes for lines without active
  for (const line of activeLines) {
    if (!line.nodes.some((n) => n.status === "active")) {
      const firstPending = line.nodes.find((n) => n.status === "pending");
      if (firstPending) pendingNodes.push(`[${line.title}] ${firstPending.content}`);
    }
  }

  return `你是一个剧情状态追踪器。根据最新的对话内容，判断以下剧情节点的状态变化。

当前激活的节点：
${activeNodes.length > 0 ? activeNodes.map((n) => `- ${n}`).join("\n") : "（无）"}

待激活的节点：
${pendingNodes.length > 0 ? pendingNodes.map((n) => `- ${n}`).join("\n") : "（无）"}

请返回 JSON，格式如下（只列出有变化的节点）：
{
  "activations": ["剧情线标题::节点内容"],  // pending→active
  "completions": ["剧情线标题::节点内容"],  // active→completed
  "skips": ["剧情线标题::节点内容"],        // pending→skipped（情节跳跃）
  "archiveLines": ["剧情线标题"]            // 整条线归档
}

注意：
1. 只返回 JSON，不要其他文字
2. 只列出确实有变化的节点
3. 如果没有任何变化，返回空对象 {}`;
}

function parsePlotUpdates(raw: string, state: PlotState): Record<string, string[]> {
  try {
    let json = raw.trim();
    const fence = json.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence) json = fence[1].trim();
    const parsed = JSON.parse(json);

    const now = new Date().toISOString();

    // process completions
    for (const key of (parsed.completions || [])) {
      const [lineTitle, nodeContent] = key.split("::");
      const line = state.plotLines.find((l) => l.title === lineTitle);
      if (!line) continue;
      const node = line.nodes.find((n) => n.content === nodeContent && n.status === "active");
      if (node) {
        node.status = "completed";
        node.completedAt = now;
        // activate next pending node
        const next = line.nodes.find((n) => n.status === "pending");
        if (next) {
          next.status = "active";
          next.activatedAt = now;
        }
      }
    }

    // process activations
    for (const key of (parsed.activations || [])) {
      const [lineTitle, nodeContent] = key.split("::");
      const line = state.plotLines.find((l) => l.title === lineTitle);
      if (!line) continue;
      // ensure no other active in this line
      if (line.nodes.some((n) => n.status === "active")) continue;
      const node = line.nodes.find((n) => n.content === nodeContent && n.status === "pending");
      if (node) {
        node.status = "active";
        node.activatedAt = now;
      }
    }

    // process skips
    for (const key of (parsed.skips || [])) {
      const [lineTitle, nodeContent] = key.split("::");
      const line = state.plotLines.find((l) => l.title === lineTitle);
      if (!line) continue;
      const node = line.nodes.find((n) => n.content === nodeContent);
      if (node) node.status = "skipped";
    }

    // process archive lines
    for (const title of (parsed.archiveLines || [])) {
      const line = state.plotLines.find((l) => l.title === title);
      if (line) line.status = "archived";
    }

    return parsed;
  } catch {
    return {};
  }
}
