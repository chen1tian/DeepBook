import { NextRequest, NextResponse } from "next/server";
import { loadChat, saveChat, createChat, compactChat, type AgentChatRecord } from "@/lib/agent-chat-store";
import { requireUserId } from "@/lib/auth-helper";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const chatId = searchParams.get("chatId");
  if (!chatId) return NextResponse.json({ error: "chatId required" }, { status: 400 });

  const userId = await requireUserId();
  if (userId === "NEEDS_SETUP") return NextResponse.json({ error: "请先完成初始化设置" }, { status: 400 });
  const record = loadChat(chatId, userId);
  if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ chat: record });
}

export async function POST(req: NextRequest) {
  try {
    const userId = await requireUserId();
    if (userId === "NEEDS_SETUP") return NextResponse.json({ error: "请先完成初始化设置" }, { status: 400 });
    const body = await req.json();
    const { chatId, messages } = body;

    let record: AgentChatRecord;
    if (chatId) {
      const existing = loadChat(chatId);
      if (existing && existing.userId && existing.userId !== userId) {
        // 不属于当前用户，创建新的
        record = createChat(userId);
      } else {
        record = existing ?? createChat(userId);
        if (chatId !== record.id) record = { ...record, id: chatId };
      }
    } else {
      record = createChat(userId);
    }

    // Replace or append messages
    if (messages) {
      record.messages = messages;
    }

    saveChat(record);
    return NextResponse.json({ chat: record });
  } catch (err) {
    if (err instanceof Response) throw err;
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { chatId, compact } = await req.json();
    if (!chatId) return NextResponse.json({ error: "chatId required" }, { status: 400 });

    if (compact) {
      // Trigger compaction: send the middle messages to LLM for summarization
      const record = loadChat(chatId);
      if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 });
      return NextResponse.json({ needsCompaction: true, chat: record });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
