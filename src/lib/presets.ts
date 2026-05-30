import { join } from "path";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";

const DATA_DIR = join(process.cwd(), ".data");
const PRESETS_FILE = join(DATA_DIR, "presets.json");

export interface Preset {
  id: string;
  userId: string;
  name: string;
  mode: "novel" | "roleplay";
  pov: "first" | "third";
  role: string;
  rules: string;
  createdAt: string;
}

function ensureDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

function readAll(): Preset[] {
  ensureDir();
  if (!existsSync(PRESETS_FILE)) return [];
  try { return JSON.parse(readFileSync(PRESETS_FILE, "utf-8")) as Preset[]; }
  catch { return []; }
}

function writeAll(presets: Preset[]) {
  ensureDir();
  writeFileSync(PRESETS_FILE, JSON.stringify(presets, null, 2), "utf-8");
}

function genId(): string {
  return `preset_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

export function listPresets(userId: string): Preset[] {
  const presets = readAll().filter((p) => p.userId === userId);
  // 向后兼容：旧数据无 userId，自动迁移
  const all = readAll();
  if (all.some((p) => !p.userId)) {
    for (const p of all) {
      if (!p.userId) (p as Preset).userId = userId;
    }
    writeAll(all);
    return all.filter((p) => p.userId === userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  return presets.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getPreset(id: string, userId: string): Preset | null {
  return readAll().find((p) => p.id === id && p.userId === userId) ?? null;
}

export function createPreset(
  data: {
    name: string;
    mode: "novel" | "roleplay";
    pov: "first" | "third";
    role: string;
    rules: string;
  },
  userId: string
): Preset {
  const presets = readAll();
  const preset: Preset = {
    id: genId(),
    userId,
    ...data,
    createdAt: new Date().toISOString(),
  };
  presets.push(preset);
  writeAll(presets);
  return preset;
}

export function updatePreset(id: string, userId: string, patch: Partial<Preset>): Preset | null {
  const presets = readAll();
  const idx = presets.findIndex((p) => p.id === id && p.userId === userId);
  if (idx === -1) return null;
  presets[idx] = { ...presets[idx], ...patch, id }; // id immutable
  writeAll(presets);
  return presets[idx];
}

export function deletePreset(id: string, userId: string): boolean {
  const presets = readAll().filter((p) => !(p.id === id && p.userId === userId));
  if (presets.length === readAll().length) return false;
  writeAll(presets);
  return true;
}
