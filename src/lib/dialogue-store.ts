import { join } from "path";
import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync } from "fs";
import type { DialogueConfig } from "./db";

const DATA_DIR = join(process.cwd(), ".data");
const DIALOGUES_DIR = join(DATA_DIR, "dialogues");

/* ── helpers ──────────────────────────────────────── */

function ensureDir() {
  if (!existsSync(DIALOGUES_DIR)) mkdirSync(DIALOGUES_DIR, { recursive: true });
}

function generateId(): string {
  return `dlg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/* ── types ────────────────────────────────────────── */

export interface DialogueMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface DialogueMeta {
  id: string;
  bookId: number;
  name: string;
  createdAt: string;
  messageCount: number;
  lastMessage: string; // last 50 chars
  hasConfig: boolean;  // has opening config
}

export interface DialogueRecord {
  id: string;
  userId: string;
  bookId: number;
  name: string;
  createdAt: string;
  messages: DialogueMessage[];
  config: DialogueConfig | null;
  compactionSummary?: string;
}

/* ── file paths ───────────────────────────────────── */

function dialoguePath(id: string): string {
  return join(DIALOGUES_DIR, `${id}.json`);
}

function indexPath(bookId: number): string {
  return join(DIALOGUES_DIR, `idx_${bookId}.json`);
}

/* ── index CRUD ───────────────────────────────────── */

function readIndex(bookId: number): DialogueMeta[] {
  ensureDir();
  const fp = indexPath(bookId);
  if (!existsSync(fp)) return [];
  try { return JSON.parse(readFileSync(fp, "utf-8")) as DialogueMeta[]; }
  catch { return []; }
}

function writeIndex(bookId: number, metas: DialogueMeta[]) {
  ensureDir();
  writeFileSync(indexPath(bookId), JSON.stringify(metas, null, 2), "utf-8");
}

function upsertMeta(meta: DialogueMeta) {
  const metas = readIndex(meta.bookId);
  const idx = metas.findIndex((m) => m.id === meta.id);
  if (idx >= 0) metas[idx] = meta;
  else metas.push(meta);
  writeIndex(meta.bookId, metas);
}

function removeMeta(bookId: number, dialogueId: string) {
  const metas = readIndex(bookId).filter((m) => m.id !== dialogueId);
  writeIndex(bookId, metas);
}

/* ── dialogue CRUD ────────────────────────────────── */

/** Map component index (non-system messages only) to file index */
function componentToFileIndex(record: DialogueRecord, componentIndex: number): number {
  let compIdx = 0;
  for (let i = 0; i < record.messages.length; i++) {
    if (record.messages[i].role !== "system") {
      if (compIdx === componentIndex) return i;
      compIdx++;
    }
  }
  return -1;
}

export function listDialogues(bookId: number, userId: string): DialogueMeta[] {
  return readIndex(bookId).filter((m) => {
    const rec = getDialogue(m.id);
    return rec && rec.userId === userId;
  }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getDialogue(dialogueId: string): DialogueRecord | null {
  ensureDir();
  const fp = dialoguePath(dialogueId);
  if (!existsSync(fp)) return null;
  try { return JSON.parse(readFileSync(fp, "utf-8")) as DialogueRecord; }
  catch { return null; }
}

export function getDialogueMessages(dialogueId: string): DialogueMessage[] {
  return getDialogue(dialogueId)?.messages ?? [];
}

export function createDialogue(
  bookId: number,
  userId: string,
  name: string,
  messages: DialogueMessage[],
  config: DialogueConfig | null
): DialogueRecord {
  const id = generateId();
  const record: DialogueRecord = {
    id,
    userId,
    bookId,
    name,
    createdAt: new Date().toISOString(),
    messages,
    config,
  };
  ensureDir();
  writeFileSync(dialoguePath(id), JSON.stringify(record, null, 2), "utf-8");

  // update index
  const lastMsg = messages.filter((m) => m.role === "assistant").pop();
  upsertMeta({
    id,
    bookId,
    name,
    createdAt: record.createdAt,
    messageCount: messages.length,
    lastMessage: (lastMsg?.content || "").slice(-50),
    hasConfig: config !== null,
  });

  return record;
}

export function appendMessage(dialogueId: string, message: DialogueMessage): DialogueMessage[] {
  const record = getDialogue(dialogueId);
  if (!record) return [];
  record.messages.push(message);
  writeFileSync(dialoguePath(dialogueId), JSON.stringify(record, null, 2), "utf-8");

  // update index preview
  const meta = readIndex(record.bookId).find((m) => m.id === dialogueId);
  if (meta) {
    meta.messageCount = record.messages.length;
    if (message.role === "user" || message.role === "assistant") {
      meta.lastMessage = message.content.slice(-50);
    }
    upsertMeta(meta);
  }

  return record.messages;
}

export function deleteDialogue(bookId: number, dialogueId: string): void {
  const fp = dialoguePath(dialogueId);
  if (existsSync(fp)) unlinkSync(fp);
  removeMeta(bookId, dialogueId);
}

/** Delete specific messages from a dialogue by their component indices
 *  (indices are relative to the non-system message list exposed by GET) */
export function deleteMessages(dialogueId: string, componentIndices: number[]): DialogueMessage[] {
  const record = getDialogue(dialogueId);
  if (!record) return [];
  const fileIndices = componentIndices.map((i) => componentToFileIndex(record, i));
  const indexSet = new Set(fileIndices);
  record.messages = record.messages.filter((_, i) => !indexSet.has(i));
  writeFileSync(dialoguePath(dialogueId), JSON.stringify(record, null, 2), "utf-8");

  // update index
  const meta = readIndex(record.bookId).find((m) => m.id === dialogueId);
  if (meta) {
    meta.messageCount = record.messages.length;
    const lastAssistant = [...record.messages].reverse().find((m) => m.role === "assistant");
    if (lastAssistant) meta.lastMessage = lastAssistant.content.slice(-50);
    else meta.lastMessage = "";
    upsertMeta(meta);
  }

  return record.messages;
}

/** Update a single message's content by component index
 *  (index is relative to the non-system message list exposed by GET) */
export function updateMessage(dialogueId: string, componentIndex: number, newContent: string): DialogueMessage[] {
  const record = getDialogue(dialogueId);
  if (!record) return [];
  const index = componentToFileIndex(record, componentIndex);
  if (index < 0 || index >= record.messages.length) return [];
  record.messages[index].content = newContent;
  writeFileSync(dialoguePath(dialogueId), JSON.stringify(record, null, 2), "utf-8");

  const meta = readIndex(record.bookId).find((m) => m.id === dialogueId);
  if (meta && record.messages[index].role === "assistant") {
    meta.lastMessage = newContent.slice(-50);
    upsertMeta(meta);
  }

  return record.messages;
}

export function updateCompactionSummary(dialogueId: string, summary: string): void {
  const record = getDialogue(dialogueId);
  if (!record) return;
  record.compactionSummary = summary;
  writeFileSync(dialoguePath(dialogueId), JSON.stringify(record, null, 2), "utf-8");
}

/** Get a summary of all openings for a book (for reuse) */
export function getOpeningOptions(bookId: number, userId: string): { dialogueId: string; name: string; opening: string }[] {
  const metas = readIndex(bookId).filter((m) => m.hasConfig);
  return metas.map((m) => {
    const record = getDialogue(m.id);
    if (!record || record.userId !== userId) return null;
    const opening = record?.messages.find((msg) => msg.role === "assistant")?.content || "";
    return { dialogueId: m.id, name: m.name, opening };
  }).filter((x): x is { dialogueId: string; name: string; opening: string } => x !== null);
}
