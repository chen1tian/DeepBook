import { join } from "path";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";

const DATA_DIR = join(process.cwd(), ".data");
const CHATS_DIR = join(DATA_DIR, "agent-chats");

export interface AgentMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface AgentChatRecord {
  id: string;
  userId: string;
  messages: AgentMessage[];
  updatedAt: string;
  compacted: boolean; // true if history was compressed
}

function ensureDir() {
  if (!existsSync(CHATS_DIR)) mkdirSync(CHATS_DIR, { recursive: true });
}

function filePath(chatId: string): string {
  return join(CHATS_DIR, `${chatId}.json`);
}

export function generateChatId(): string {
  return `chat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function loadChat(chatId: string, userId?: string): AgentChatRecord | null {
  ensureDir();
  const fp = filePath(chatId);
  if (!existsSync(fp)) return null;
  try {
    const record = JSON.parse(readFileSync(fp, "utf-8")) as AgentChatRecord;
    // 向后兼容：加载后补 userId
    if (!record.userId && userId) {
      record.userId = userId;
      saveChat(record);
    }
    // 可选 userId 过滤
    if (userId && record.userId && record.userId !== userId) return null;
    return record;
  }
  catch { return null; }
}

export function saveChat(record: AgentChatRecord): void {
  ensureDir();
  record.updatedAt = new Date().toISOString();
  writeFileSync(filePath(record.id), JSON.stringify(record, null, 2), "utf-8");
}

export function createChat(userId?: string): AgentChatRecord {
  const record: AgentChatRecord = {
    id: generateChatId(),
    userId: userId || "",
    messages: [],
    updatedAt: new Date().toISOString(),
    compacted: false,
  };
  saveChat(record);
  return record;
}

/**
 * Compact chat history when it exceeds the threshold.
 * Keeps first 5 + last 20 messages, replaces middle with a summary.
 */
export function compactChat(chatId: string, summary: string): AgentChatRecord | null {
  const record = loadChat(chatId);
  if (!record) return null;

  const KEEP_FIRST = 5;
  const KEEP_LAST = 20;

  if (record.messages.length <= KEEP_FIRST + KEEP_LAST + 5) return record;

  const first = record.messages.slice(0, KEEP_FIRST);
  const last = record.messages.slice(-KEEP_LAST);

  const summaryMsg: AgentMessage = {
    role: "system",
    content: `【对话历史摘要】${summary}`,
  };

  record.messages = [...first, summaryMsg, ...last];
  record.compacted = true;
  saveChat(record);
  return record;
}
