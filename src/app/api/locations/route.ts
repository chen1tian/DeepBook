import { NextRequest } from "next/server";
import OpenAI from "openai";
import { getDialogue } from "@/lib/dialogue-store";
import {
  getLocationNetwork,
  saveLocationNetwork,
  getDefaultLocationNetwork,
  type LocationNetwork,
} from "@/lib/location-store";
import { requireUserId } from "@/lib/auth-helper";
import { applyActivePreset } from "@/lib/llm-utils";

// GET — load location network
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

  const network = getLocationNetwork(dialogueId);
  return new Response(JSON.stringify({ network }), {
    headers: { "Content-Type": "application/json" },
  });
}

// PATCH — save location network directly (manual edits)
export async function PATCH(req: NextRequest) {
  try {
    const { dialogueId, network } = await req.json();
    if (!dialogueId) return new Response(JSON.stringify({ error: "dialogueId is required" }), { status: 400 });

    const record = getDialogue(dialogueId);
    if (!record) return new Response(JSON.stringify({ error: "Dialogue not found" }), { status: 404 });

    const userId = await requireUserId();
    if (userId === "NEEDS_SETUP") return new Response(JSON.stringify({ error: "请先完成初始化设置" }), { status: 400 });
    if (record.userId && record.userId !== userId) {
      return new Response(JSON.stringify({ error: "Access denied" }), { status: 403 });
    }

    saveLocationNetwork(dialogueId, network as LocationNetwork);
    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), { status: 500 });
  }
}

// POST — AI analysis: extract locations and connections from dialogue
export async function POST(req: NextRequest) {
  try {
    const { dialogueId, baseUrl, apiKey, modelId, messageCount } = await req.json();
    if (!dialogueId || !apiKey || !modelId) {
      return new Response(JSON.stringify({ error: "dialogueId, apiKey, modelId required" }), { status: 400 });
    }

    const record = getDialogue(dialogueId);
    if (!record) return new Response(JSON.stringify({ error: "Dialogue not found" }), { status: 404 });

    const userId = await requireUserId();
    if (userId === "NEEDS_SETUP") return new Response(JSON.stringify({ error: "请先完成初始化设置" }), { status: 400 });
    if (record.userId && record.userId !== userId) {
      return new Response(JSON.stringify({ error: "Access denied" }), { status: 403 });
    }

    const existing = getLocationNetwork(dialogueId);

    const nonSystem = record.messages.filter((m) => m.role !== "system");
    const count = Math.min(messageCount || 20, nonSystem.length);
    const recentMessages = nonSystem.slice(-count);
    const recentText = recentMessages.map((m) => `${m.role}: ${m.content.slice(0, 1200)}`).join("\n\n");

    const systemPrompt = buildLocationPrompt(existing);
    const client = new OpenAI({ apiKey, baseURL: baseUrl.replace(/\/$/, "") });
    const completion = await client.chat.completions.create({
      model: modelId,
      messages: applyActivePreset([
        { role: "system", content: systemPrompt },
        { role: "user", content: `根据以下最近的对话内容，更新地点网络：\n\n${recentText}` },
      ], userId),
      temperature: 0.3,
      max_tokens: 2048,
    });

    const raw = completion.choices[0]?.message?.content || "";
    const updates = parseLocationUpdates(raw, existing);
    updates.lastAnalyzedAt = new Date().toISOString();
    saveLocationNetwork(dialogueId, updates);

    return new Response(JSON.stringify({ network: updates }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), { status: 500 });
  }
}

function generateId(): string {
  return `loc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function buildLocationPrompt(existing: LocationNetwork): string {
  const nodesDesc = existing.nodes.map((n) =>
    `- ${n.name}${n.id === existing.currentNodeId ? " 【当前】" : ""}：${n.description || "无描述"}`
  ).join("\n");

  const connsDesc = existing.connections.map((c) => {
    const from = existing.nodes.find((n) => n.id === c.from);
    const to = existing.nodes.find((n) => n.id === c.to);
    return `- ${from?.name || "?"} ↔ ${to?.name || "?"}：${c.description || "未知距离"}`;
  }).join("\n");

  return `你是一个地点追踪器。根据故事对话，维护一个地点网络。请识别所有出现过的地点、当前所在位置、以及地点之间的通行关系。

已有地点：
${nodesDesc || "（暂无）"}

已有连接：
${connsDesc || "（暂无）"}

请返回 JSON，包含更新后的完整数据：
{
  "nodes": [
    {
      "name": "地点名称",
      "description": "地点描述（如果有新信息则更新）"
    }
  ],
  "connections": [
    {
      "fromName": "起点名称",
      "toName": "终点名称",
      "description": "移动方式/距离（如：步行10分钟、乘坐电梯、开车20分钟）"
    }
  ],
  "currentLocationName": "角色当前所在的地点名称"
}

注意：
1. 只返回 JSON，不要其他文字
2. 基于已有数据增量更新——已有地点更新描述，新地点加入
3. 不要丢失已有地点。如果角色离开了某个地点，不要删除它
4. connections 记录双向通行关系。不需要反向重复（A→B 和 B→A 只记一条）
5. 如果对话中没有地点变化，返回当前数据即可
6. 地点名称使用原文中的称呼`;
}

function parseLocationUpdates(raw: string, existing: LocationNetwork): LocationNetwork {
  try {
    let json = raw.trim();
    const fence = json.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence) json = fence[1].trim();
    const parsed = JSON.parse(json);

    const now = new Date().toISOString();
    const nodes = [...existing.nodes];
    const nodeMap = new Map(nodes.map((n) => [n.name, n]));

    // Process nodes
    if (Array.isArray(parsed.nodes)) {
      for (const item of parsed.nodes) {
        const name = (item.name || "").trim();
        if (!name) continue;
        const existingNode = nodeMap.get(name);
        if (existingNode) {
          // Update existing
          if (item.description) existingNode.description = item.description;
          existingNode.lastVisitedAt = now;
        } else {
          // New node
          const newNode = {
            id: generateId(),
            name,
            description: item.description || "",
            firstVisitedAt: now,
            lastVisitedAt: now,
          };
          nodes.push(newNode);
          nodeMap.set(name, newNode);
        }
      }
    }

    // Process connections
    const connections = [...existing.connections];
    if (Array.isArray(parsed.connections)) {
      for (const item of parsed.connections) {
        const fromName = (item.fromName || "").trim();
        const toName = (item.toName || "").trim();
        if (!fromName || !toName || fromName === toName) continue;
        const fromNode = nodeMap.get(fromName);
        const toNode = nodeMap.get(toName);
        if (!fromNode || !toNode) continue;

        // Check if connection already exists (either direction)
        const exists = connections.some(
          (c) =>
            (c.from === fromNode.id && c.to === toNode.id) ||
            (c.from === toNode.id && c.to === fromNode.id)
        );
        if (!exists) {
          connections.push({
            from: fromNode.id,
            to: toNode.id,
            description: item.description || "",
          });
        } else {
          // Update existing connection description
          const conn = connections.find(
            (c) =>
              (c.from === fromNode.id && c.to === toNode.id) ||
              (c.from === toNode.id && c.to === fromNode.id)
          );
          if (conn && item.description) conn.description = item.description;
        }
      }
    }

    // Current location
    let currentNodeId = existing.currentNodeId;
    if (parsed.currentLocationName) {
      const currentName = (parsed.currentLocationName as string).trim();
      const currentNode = nodeMap.get(currentName);
      if (currentNode) {
        currentNodeId = currentNode.id;
        currentNode.lastVisitedAt = now;
      }
    }

    return {
      nodes,
      connections,
      currentNodeId,
      lastAnalyzedAt: existing.lastAnalyzedAt,
    };
  } catch {
    return existing;
  }
}
