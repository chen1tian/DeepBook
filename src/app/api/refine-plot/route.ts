import { NextRequest } from "next/server";
import OpenAI from "openai";

export async function POST(req: NextRequest) {
  try {
    const { idea, baseUrl, apiKey, modelId } = await req.json();
    if (!idea || !apiKey || !modelId) {
      return new Response(JSON.stringify({ error: "idea, apiKey, modelId required" }), { status: 400 });
    }

    const client = new OpenAI({ apiKey, baseURL: baseUrl.replace(/\/$/, "") });
    const completion = await client.chat.completions.create({
      model: modelId,
      messages: [
        {
          role: "system",
          content: `你是一个故事策划师。用户给你一个粗略的情节方向，你将其展开为 2-4 个具体的故事节点。

返回 JSON：
{
  "title": "剧情线标题（简短）",
  "nodes": [
    { "content": "节点1的具体情节描述" },
    { "content": "节点2的具体情节描述" }
  ]
}

注意：只返回 JSON，不要其他文字。节点按故事发展顺序排列。`,
        },
        { role: "user", content: idea },
      ],
      temperature: 0.7,
      max_tokens: 1024,
    });

    const raw = completion.choices[0]?.message?.content || "";

    let json = raw.trim();
    const fence = json.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence) json = fence[1].trim();

    const parsed = JSON.parse(json);
    return new Response(JSON.stringify({
      title: parsed.title || idea.slice(0, 30),
      nodes: (parsed.nodes || []).map((n: { content: string }, i: number) => ({
        content: n.content || "",
        order: i,
      })),
    }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), { status: 500 });
  }
}
