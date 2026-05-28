import { NextRequest, NextResponse } from "next/server";
import { listPersonas, getPersona, createPersona, updatePersona, deletePersona } from "@/lib/personas";

export async function GET() {
  return NextResponse.json({ personas: listPersonas() });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, avatar, tone, addressUser, style, catchphrase } = body;
    if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });
    const persona = createPersona({
      name,
      avatar: avatar || "🤖",
      tone: tone || "",
      addressUser: addressUser || "你",
      style: style || "",
      catchphrase: catchphrase || "",
    });
    return NextResponse.json({ persona }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { id, ...patch } = await req.json();
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    const persona = updatePersona(id, patch);
    if (!persona) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ persona });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const ok = deletePersona(id);
  return NextResponse.json({ success: ok });
}
