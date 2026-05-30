import { join } from "path";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";

const DATA_DIR = join(process.cwd(), ".data");
const PERSONAS_FILE = join(DATA_DIR, "personas.json");

export interface Persona {
  id: string;
  userId: string;
  name: string;
  avatar: string;
  tone: string;
  addressUser: string;
  style: string;
  catchphrase: string;
  createdAt: string;
}

function ensureDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

function readAll(): Persona[] {
  ensureDir();
  if (!existsSync(PERSONAS_FILE)) return [];
  try { return JSON.parse(readFileSync(PERSONAS_FILE, "utf-8")) as Persona[]; }
  catch { return []; }
}

function writeAll(personas: Persona[]) {
  ensureDir();
  writeFileSync(PERSONAS_FILE, JSON.stringify(personas, null, 2), "utf-8");
}

function genId(): string {
  return `persona_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

export function listPersonas(userId: string): Persona[] {
  const personas = readAll().filter((p) => p.userId === userId);
  // 向后兼容：旧数据无 userId，自动迁移
  const all = readAll();
  if (all.some((p) => !p.userId)) {
    for (const p of all) {
      if (!p.userId) (p as Persona).userId = userId;
    }
    writeAll(all);
    return all.filter((p) => p.userId === userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  return personas.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getPersona(id: string, userId: string): Persona | null {
  return readAll().find((p) => p.id === id && p.userId === userId) ?? null;
}

export function createPersona(data: Omit<Persona, "id" | "createdAt" | "userId">, userId: string): Persona {
  const personas = readAll();
  const persona: Persona = { id: genId(), userId, ...data, createdAt: new Date().toISOString() };
  personas.push(persona);
  writeAll(personas);
  return persona;
}

export function updatePersona(id: string, userId: string, patch: Partial<Persona>): Persona | null {
  const personas = readAll();
  const idx = personas.findIndex((p) => p.id === id && p.userId === userId);
  if (idx === -1) return null;
  personas[idx] = { ...personas[idx], ...patch, id };
  writeAll(personas);
  return personas[idx];
}

export function deletePersona(id: string, userId: string): boolean {
  const personas = readAll().filter((p) => !(p.id === id && p.userId === userId));
  if (personas.length === readAll().length) return false;
  writeAll(personas);
  return true;
}
