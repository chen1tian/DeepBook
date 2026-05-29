import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import type { CharacterInfo, StoryState } from "./story-state-types";

// re-export types
export type { CharacterInfo, StoryState };

const DATA_DIR = join(process.cwd(), ".data");
const STATE_DIR = join(DATA_DIR, "story-states");

function ensureDir() {
  if (!existsSync(STATE_DIR)) mkdirSync(STATE_DIR, { recursive: true });
}

function statePath(dialogueId: string): string {
  return join(STATE_DIR, `${dialogueId}.json`);
}

export function getDefaultStoryState(): StoryState {
  return {
    characters: [],
    protagonist: null,
    currentLocation: "",
    currentDate: "",
    currentTime: "",
    lastAnalyzedAt: "",
    analyzedMessageIndex: -1,
  };
}

/* ── CRUD ─────────────────────────────────────────── */

export function getStoryState(dialogueId: string): StoryState {
  ensureDir();
  const fp = statePath(dialogueId);
  if (!existsSync(fp)) return getDefaultStoryState();
  try {
    return JSON.parse(readFileSync(fp, "utf-8")) as StoryState;
  } catch {
    return getDefaultStoryState();
  }
}

export function saveStoryState(dialogueId: string, state: StoryState): void {
  ensureDir();
  writeFileSync(statePath(dialogueId), JSON.stringify(state, null, 2), "utf-8");
}

export function deleteStoryState(dialogueId: string): void {
  const fp = statePath(dialogueId);
  if (existsSync(fp)) {
    try { require("fs").unlinkSync(fp); } catch { /* */ }
  }
}
