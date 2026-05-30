import { NextRequest, NextResponse } from "next/server";
import { listDialogues, deleteDialogue } from "@/lib/dialogue-store";
import { requireUserId } from "@/lib/auth-helper";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const bookId = parseInt(searchParams.get("bookId") || "", 10);
  if (!bookId) return NextResponse.json({ error: "bookId required" }, { status: 400 });
  const userId = await requireUserId();
  if (userId === "NEEDS_SETUP") return NextResponse.json({ dialogues: [] });
  const dialogues = listDialogues(bookId, userId);
  return NextResponse.json({ dialogues });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const bookId = parseInt(searchParams.get("bookId") || "", 10);
  const dialogueId = searchParams.get("dialogueId");
  if (!bookId || !dialogueId)
    return NextResponse.json({ error: "bookId and dialogueId required" }, { status: 400 });
  const userId = await requireUserId();
  if (userId === "NEEDS_SETUP") return NextResponse.json({ error: "请先完成初始化设置" }, { status: 400 });
  deleteDialogue(bookId, dialogueId);
  return NextResponse.json({ success: true });
}
