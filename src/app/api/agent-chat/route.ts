import { NextRequest, NextResponse } from "next/server";
import { loadChat, saveChat, createChat, compactChat, type AgentChatRecord } from "@/lib/agent-chat-store";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const chatId = searchParams.get("chatId");
  if (!chatId) return NextResponse.json({ error: "chatId required" }, { status: 400 });

  const record = loadChat(chatId);
  if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ chat: record });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { chatId, messages } = body;

    let record: AgentChatRecord;
    if (chatId) {
      record = loadChat(chatId) ?? createChat();
      if (chatId !== record.id) record = { ...record, id: chatId };
    } else {
      record = createChat();
    }

    // Replace or append messages
    if (messages) {
      record.messages = messages;
    }

    saveChat(record);
    return NextResponse.json({ chat: record });
  } catch (err) {
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
