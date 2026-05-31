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

    // build full story context — keep it tight
    const storySummary = recentMessages.slice(-4).map((m) =>
      `${m.role === "user" ? "用户" : "AI"}: ${m.content.slice(0, 250)}`
    ).join("\n\n");

    // build analysis prompt with story context
    const systemPrompt = buildPlotAnalysisPrompt(plotState, storySummary);
    if (systemPrompt === "NO_PENDING_NODES") {
      return new Response(JSON.stringify({ state: plotState, noPending: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // DEBUG
    console.log("=== analyze-plot PROMPT ===\n" + systemPrompt + "\n=== END PROMPT ===\n");

    const client = new OpenAI({ apiKey, baseURL: baseUrl.replace(/\/$/, "") });
    console.log("=== analyze-plot CALLING ===", { model: modelId, thinking: "enabled", effort: "max" });
    const completion = await client.chat.completions.create({
      model: modelId,
      messages: [
        { role: "user", content: systemPrompt },
      ],
      max_tokens: 65536,
      // @ts-expect-error -- extra_body is needed for DeepSeek thinking mode
      extra_body: { thinking: { type: "enabled" } },
    });

    // log if reasoning was used
    try {
      const msg = completion.choices[0]?.message as unknown as Record<string, unknown> | undefined;
      console.log("=== analyze-plot REASONING ===", msg?.reasoning_content ? String(msg.reasoning_content).slice(0, 300) + "..." : "(无)");
    } catch { /* */ }
    try { console.log("=== analyze-plot USAGE ===", JSON.stringify(completion.usage)); } catch { /* */ }
    const raw = completion.choices[0]?.message?.content || "";
    console.log("=== analyze-plot LLM RESPONSE ===");
    console.log(raw);
    console.log("=== END analyze-plot RESPONSE ===\n");
    applyPlotAnalysis(raw, plotState);
    plotState.lastAnalyzedAt = new Date().toISOString();
    savePlotState(dialogueId, plotState);

    return new Response(JSON.stringify({ state: plotState }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("=== analyze-plot ERROR ===", err);
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

  return `=== 聊天历史（最近对话） ===
${storySummary}

=== 候选剧情节点 ===
${nodeList}${suffix}

=== 活跃剧情线 ===
${activeLines.map((l) => `- ${l.title}`).join("\n")}

---

根据上面的聊天历史和剧情数据，完成两项分析任务：

任务1 — 从候选节点中找出与当前故事最相关的 1-3 个节点。如果多个节点属于同一剧情线，只保留该线第 1 个节点。

任务2 — 检查活跃剧情线：是否存在因故事方向已改变，该线已彻底不可能再发生？将其标题列入 archiveLines。"还没轮到"的线不归档。

只输出一行 JSON：
{"topNodes":["老赵的隐藏代码::0"],"archiveLines":["双十一前的豪赌"]}

严禁输出故事内容、分析过程、或 markdown 代码块。`;
}

function applyPlotAnalysis(raw: string, state: PlotState): void {
  try {
    let json = raw.trim();
    const fence = json.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence) json = fence[1].trim();
    const parsed = JSON.parse(json);
    console.log("=== applyPlotAnalysis parsed ===", JSON.stringify(parsed));

    const now = new Date().toISOString();

    // 1) activate top nodes
    const topNodes: string[] = parsed.topNodes || [];
    if (Array.isArray(topNodes) && topNodes.length > 0) {
      const byLine = new Map<string, number[]>();
      for (const id of topNodes) {
        const [lineTitle, idxStr] = id.split("::");
        const idx = parseInt(idxStr, 10);
        if (isNaN(idx)) continue;
        if (!byLine.has(lineTitle)) byLine.set(lineTitle, []);
        byLine.get(lineTitle)!.push(idx);
      }
      if (byLine.size === 1) {
        const [lt, indices] = [...byLine][0];
        byLine.set(lt, [Math.min(...indices)]);
      }
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
      console.log("=== applyPlotAnalysis ACTIVATED ===", topNodes);
    }

    // 2) archive expired lines
    const archiveLines: string[] = parsed.archiveLines || [];
    if (Array.isArray(archiveLines) && archiveLines.length > 0) {
      for (const title of archiveLines) {
        const line = state.plotLines.find((l) => l.title === title);
        if (line && line.status === "active") {
          line.status = "archived";
        }
      }
      console.log("=== applyPlotAnalysis ARCHIVED ===", archiveLines);
    }
  } catch (e) {
    console.error("=== applyPlotAnalysis ERROR ===", e);
  }
}
