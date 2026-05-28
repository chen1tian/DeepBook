import { NextRequest, NextResponse } from "next/server";
import { listPresets, getPreset, createPreset, updatePreset, deletePreset } from "@/lib/presets";

export async function GET() {
  return NextResponse.json({ presets: listPresets() });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, mode, pov, role, rules } = body;
    if (!name || !mode) return NextResponse.json({ error: "name and mode required" }, { status: 400 });
    const preset = createPreset({ name, mode, pov: pov || "third", role: role || "", rules: rules || "" });
    return NextResponse.json({ preset }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { id, ...patch } = await req.json();
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    const preset = updatePreset(id, patch);
    if (!preset) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ preset });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const ok = deletePreset(id);
  return NextResponse.json({ success: ok });
}
