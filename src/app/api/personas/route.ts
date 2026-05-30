import { NextRequest, NextResponse } from "next/server";
import { listPersonas, getPersona, createPersona, updatePersona, deletePersona } from "@/lib/personas";
import { requireUserId } from "@/lib/auth-helper";

export async function GET() {
  const userId = await requireUserId();
  if (userId === "NEEDS_SETUP") return NextResponse.json({ personas: [] });
  return NextResponse.json({ personas: listPersonas(userId) });
}

export async function POST(req: NextRequest) {
  try {
    const userId = await requireUserId();
    if (userId === "NEEDS_SETUP") return NextResponse.json({ error: "请先完成初始化设置" }, { status: 400 });
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
    }, userId);
    return NextResponse.json({ persona }, { status: 201 });
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
    const persona = updatePersona(id, userId, patch);
    if (!persona) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ persona });
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
  const ok = deletePersona(id, userId);
  return NextResponse.json({ success: ok });
}
