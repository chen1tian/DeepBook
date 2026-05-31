import { NextRequest } from "next/server";
import OpenAI from "openai";
import { getDialogue } from "@/lib/dialogue-store";
import { getPlotState, savePlotState, type PlotState } from "@/lib/plot-state";
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

    // build a compact story summary from recent messages
    const storySummary = recentMessages.slice(-6).map((m) =>
      `${m.role === "user" ? "用户引导" : "故事叙述"}: ${m.content.slice(0, 300)}`
    ).join("\n---\n");

    // build analysis prompt with story context
    const systemPrompt = buildPlotAnalysisPrompt(plotState, storySummary);
    if (systemPrompt === "NO_PENDING_NODES") {
      return new Response(JSON.stringify({ state: plotState, noPending: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // DEBUG: log the prompt for inspection
    console.log("=== analyze-plot SYSTEM PROMPT ===");
    console.log(systemPrompt);
    console.log("=== analyze-plot RECENT MESSAGES ===");
    recentMessages.forEach((m, i) => console.log(`[${i}] ${m.role}: ${m.content.slice(0, 200)}...`));
    console.log("=== END analyze-plot PROMPT ===\n");

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
      temperature: 0.7,
      max_tokens: 512,
    });

    const raw = completion.choices[0]?.message?.content || "";
    console.log("=== analyze-plot LLM RESPONSE ===");
    console.log(raw);
    console.log("=== END analyze-plot RESPONSE ===\n");
    activateTopNodes(raw, plotState);
    plotState.lastAnalyzedAt = new Date().toISOString();
    savePlotState(dialogueId, plotState);

    return new Response(JSON.stringify({ state: plotState }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), { status: 500 });
  }
}

function buildPlotAnalysisPrompt(state: PlotState, storySummary: string): string {
  const activeLines = state.plotLines.filter((l) => l.status === "active");
  
  // collect ALL pending nodes across all active lines, with unique IDs
  const allPending: { id: string; lineTitle: string; nodeIndex: number; content: string }[] = [];
  for (const line of activeLines) {
    if (line.nodes.some((n) => n.status === "active")) continue;
    for (let i = 0; i < line.nodes.length; i++) {
      if (line.nodes[i].status === "pending") {
        allPending.push({
          id: `${line.title}::${i}`,
          lineTitle: line.title,
          nodeIndex: i,
          content: line.nodes[i].content,
        });
      }
    }
  }

  if (allPending.length === 0) {
    return "NO_PENDING_NODES";
  }

  // limit prompt size: show max 20 lines, each node truncated
  const MAX_LINES = 20;
  const displayed = allPending.slice(0, MAX_LINES);
  const nodeList = displayed.map((n) => `[${n.id}] ${n.content.slice(0, 150)}`).join("\n");
  const suffix = allPending.length > MAX_LINES ? `\n...（还有 ${allPending.length - MAX_LINES} 个节点未列出）` : "";

  return `你是剧情匹配器，不是故事作者。只输出 JSON，绝对不要输出故事内容。

=== 当前故事 ===
${storySummary}

=== 候选节点 ===
${nodeList}${suffix}

从中选出与故事最相关的 1-3 个节点。如果多个节点属于同一条剧情线，只保留该线的第 1 个节点。

正确输出示例：
{"topNodes":["技术债引爆::0"]}
{"topNodes":["技术债引爆::0","周远的赌注::1"]}
{"topNodes":[]}

错误示例（严禁）：
- 不要写故事内容
- 不要写分析过程
- 不要写"根据故事进展..."
- 不要用 markdown 代码块

只输出一行 JSON。`;
}

function activateTopNodes(raw: string, state: PlotState): void {
  try {
    let json = raw.trim();
    const fence = json.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence) json = fence[1].trim();
    const parsed = JSON.parse(json);
    const topNodes: string[] = parsed.topNodes || [];
    console.log("=== activateTopNodes parsed ===", JSON.stringify(parsed));
    if (!Array.isArray(topNodes) || topNodes.length === 0) {
      console.log("=== activateTopNodes: no nodes to activate ===");
      return;
    }

    const now = new Date().toISOString();

    // group by plot line
    const byLine = new Map<string, number[]>();
    for (const id of topNodes) {
      const [lineTitle, idxStr] = id.split("::");
      const idx = parseInt(idxStr, 10);
      if (isNaN(idx)) continue;
      if (!byLine.has(lineTitle)) byLine.set(lineTitle, []);
      byLine.get(lineTitle)!.push(idx);
    }

    // collapse: if all top nodes from same line, keep only the closest (lowest index)
    if (byLine.size === 1) {
      const [lineTitle, indices] = [...byLine][0];
      byLine.set(lineTitle, [Math.min(...indices)]);
    }

    // activate: for each line, activate its best-match node
    for (const [lineTitle, indices] of byLine) {
      const line = state.plotLines.find((l) => l.title === lineTitle);
      if (!line || line.nodes.some((n) => n.status === "active")) continue;
      const bestIdx = Math.min(...indices);
      const node = line.nodes[bestIdx];
      if (node && node.status === "pending") {
        node.status = "active";
        node.activatedAt = now;
        delete node.pendingSince;
      }
    }
    console.log("=== activateTopNodes ACTIVATED ===", topNodes);
  } catch (e) {
    console.error("=== activateTopNodes ERROR ===", e);
  }
}
