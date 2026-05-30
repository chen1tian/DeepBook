import { NextRequest } from "next/server";
import { getPlotState, savePlotState, getDefaultPlotState } from "@/lib/plot-state";
import { getDialogue } from "@/lib/dialogue-store";
import { requireUserId } from "@/lib/auth-helper";
import type { PlotState } from "@/lib/plot-state-types";

// GET — load plot state
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

  const state = getPlotState(dialogueId);
  return new Response(JSON.stringify({ state }), {
    headers: { "Content-Type": "application/json" },
  });
}

// POST — save entire plot state (manual edits)
export async function POST(req: NextRequest) {
  try {
    const { dialogueId, state } = await req.json();
    if (!dialogueId || !state) return new Response("dialogueId and state required", { status: 400 });

    const record = getDialogue(dialogueId);
    if (!record) return new Response(JSON.stringify({ error: "Dialogue not found" }), { status: 404 });

    const userId = await requireUserId();
    if (userId === "NEEDS_SETUP") return new Response(JSON.stringify({ error: "请先完成初始化设置" }), { status: 400 });
    if (record.userId && record.userId !== userId) {
      return new Response(JSON.stringify({ error: "Access denied" }), { status: 403 });
    }

    savePlotState(dialogueId, state as PlotState);
    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    if (err instanceof Response) throw err;
    const msg = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), { status: 500 });
  }
}
