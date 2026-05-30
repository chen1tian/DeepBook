import { join } from "path";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";

const DATA_DIR = join(process.cwd(), ".data");
const BOOKS_FILE = join(DATA_DIR, "books.json");

export interface Protagonist {
  name: string;
  description: string;
}

export interface DialogueConfig {
  mode: "novel" | "roleplay";
  pov: "first" | "third";
  time: string;
  place: string;
  protagonist: Protagonist;
  npcs: { name: string; description: string }[];
  dialogue_system_prompt: string;
}

export interface Book {
  id: number;
  userId: string;
  name: string;
  genre: string;
  style: string;
  system_prompt: string;
  cover_color: string;
  created_at: string;
  active_dialogue_id: string | null;
  dialogue_config: DialogueConfig | null;
}

function ensureDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

function readBooks(): Book[] {
  ensureDir();
  if (!existsSync(BOOKS_FILE)) return [];
  try {
    return JSON.parse(readFileSync(BOOKS_FILE, "utf-8")) as Book[];
  } catch {
    return [];
  }
}

function writeBooks(books: Book[]) {
  ensureDir();
  writeFileSync(BOOKS_FILE, JSON.stringify(books, null, 2), "utf-8");
}

let nextId = 0;
function getNextId(): number {
  if (nextId === 0) {
    const books = readBooks();
    nextId = books.reduce((max, b) => Math.max(max, b.id), 0);
  }
  return ++nextId;
}

export async function getBooks(userId: string): Promise<Book[]> {
  const books = readBooks().filter((b) => b.userId === userId);
  // 向后兼容：旧数据无 userId，自动迁移
  const needsMigration = readBooks().some((b) => !b.userId);
  if (needsMigration) {
    migrateBooks(userId);
    return readBooks().filter((b) => b.userId === userId).sort((a, b) => b.id - a.id);
  }
  return books.sort((a, b) => b.id - a.id);
}

function migrateBooks(defaultUserId: string) {
  const all = readBooks();
  let changed = false;
  for (const b of all) {
    if (!b.userId) {
      (b as Book).userId = defaultUserId;
      changed = true;
    }
  }
  if (changed) writeBooks(all);
}

export async function getBook(id: number, userId: string): Promise<Book | null> {
  return readBooks().find((b) => b.id === id && b.userId === userId) ?? null;
}

export async function createBook(
  book: {
    name: string;
    genre: string;
    style: string;
    system_prompt: string;
    cover_color?: string;
  },
  userId: string
): Promise<Book> {
  const books = readBooks();
  const newBook: Book = {
    id: getNextId(),
    userId,
    name: book.name,
    genre: book.genre,
    style: book.style,
    system_prompt: book.system_prompt,
    cover_color: book.cover_color || genreColor(book.genre),
    created_at: new Date().toISOString(),
    active_dialogue_id: null,
    dialogue_config: null,
  };
  books.push(newBook);
  writeBooks(books);
  return newBook;
}

export async function updateBook(id: number, userId: string, patch: Partial<Book>): Promise<Book | null> {
  const books = readBooks();
  const idx = books.findIndex((b) => b.id === id && b.userId === userId);
  if (idx === -1) return null;
  books[idx] = { ...books[idx], ...patch };
  writeBooks(books);
  return books[idx];
}

export async function deleteBook(id: number, userId: string): Promise<void> {
  const books = readBooks().filter((b) => !(b.id === id && b.userId === userId));
  writeBooks(books);
}

export function genreColor(genre: string): string {
  const map: Record<string, string> = {
    "仙侠": "#8b5cf6",
    "奇幻": "#3b82f6",
    "科幻": "#06b6d4",
    "都市": "#f59e0b",
    "历史": "#b45309",
    "悬疑": "#6b7280",
    "言情": "#ec4899",
    "武侠": "#ef4444",
    "游戏": "#84cc16",
    "轻小说": "#14b8a6",
    "末世": "#78716c",
    "无限流": "#a855f7",
    "盗墓": "#92400e",
    "军事": "#4b5563",
    "体育": "#22c55e",
  };
  return map[genre] || "#16a34a";
}
