import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { baseUrl, apiKey, provider } = await req.json();

    if (!apiKey) {
      return NextResponse.json({ error: "API Key is required" }, { status: 400 });
    }

    const url = `${baseUrl.replace(/\/$/, "")}/models`;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    };

    const res = await fetch(url, { headers, signal: AbortSignal.timeout(15000) });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return NextResponse.json(
        { error: `Failed to fetch models: ${res.status} ${body}` },
        { status: res.status }
      );
    }

    const data = await res.json();

    // OpenAI-compatible response: { data: [{ id: string, ... }] }
    const models: string[] = (data.data ?? [])
      .map((m: { id: string }) => m.id)
      .filter((id: string) => id)
      .sort();

    return NextResponse.json({ models });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
