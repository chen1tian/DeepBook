import { NextRequest, NextResponse } from "next/server";
import { listPresets, getPreset, createPreset, updatePreset, deletePreset } from "@/lib/presets";
import { requireUserId } from "@/lib/auth-helper";

export async function GET() {
  const userId = await requireUserId();
  if (userId === "NEEDS_SETUP") return NextResponse.json({ presets: [] });
  return NextResponse.json({ presets: listPresets(userId) });
}

export async function POST(req: NextRequest) {
  try {
    const userId = await requireUserId();
    if (userId === "NEEDS_SETUP") return NextResponse.json({ error: "请先完成初始化设置" }, { status: 400 });
    const body = await req.json();
    const { name, mode, pov, role, rules } = body;
    if (!name || !mode) return NextResponse.json({ error: "name and mode required" }, { status: 400 });
    const preset = createPreset({ name, mode, pov: pov || "third", role: role || "", rules: rules || "" }, userId);
    return NextResponse.json({ preset }, { status: 201 });
  } catch (err) {
    if (err instanceof Response) throw err;
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const userId = await requireUserId();
    if (userId === "NEEDS_SETUP") return NextResponse.json({ error: "请先完成初始化设置" }, { status: 400 });
    const { id, ...patch } = await req.json();
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    const preset = updatePreset(id, userId, patch);
    if (!preset) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ preset });
  } catch (err) {
    if (err instanceof Response) throw err;
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const userId = await requireUserId();
  if (userId === "NEEDS_SETUP") return NextResponse.json({ error: "请先完成初始化设置" }, { status: 400 });
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const ok = deletePreset(id, userId);
  return NextResponse.json({ success: ok });
}
