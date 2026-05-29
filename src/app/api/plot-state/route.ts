import { NextRequest } from "next/server";
import { getPlotState, savePlotState, getDefaultPlotState } from "@/lib/plot-state";
import type { PlotState } from "@/lib/plot-state-types";

// GET — load plot state
export async function GET(req: NextRequest) {
  const dialogueId = req.nextUrl.searchParams.get("dialogueId");
  if (!dialogueId) return new Response("dialogueId is required", { status: 400 });
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
    savePlotState(dialogueId, state as PlotState);
    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), { status: 500 });
  }
}
