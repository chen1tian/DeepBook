import { join } from "path";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";

const DATA_DIR = join(process.cwd(), ".data");
const PREFS_FILE = join(DATA_DIR, "user-prefs.json");

export interface UserPreferences {
  userId: string;
  analysisSettings: {
    messageCount: number;
    connectionId: string;
  };
  plotSettings: {
    messageCount: number;
    generationConnectionId: string;
    analysisConnectionId: string;
    spoilerPrevention: boolean;
    autoGenerate: boolean;
    maxActiveLines: number;
  };
  activePersonaId: string | null;
}

const DEFAULT_PREFS: Omit<UserPreferences, "userId"> = {
  analysisSettings: { messageCount: 20, connectionId: "" },
  plotSettings: {
    messageCount: 20,
    generationConnectionId: "",
    analysisConnectionId: "",
    spoilerPrevention: true,
    autoGenerate: true,
    maxActiveLines: 10,
  },
  activePersonaId: null,
};

function ensureDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

function readAll(): UserPreferences[] {
  ensureDir();
  if (!existsSync(PREFS_FILE)) return [];
  try {
    return JSON.parse(readFileSync(PREFS_FILE, "utf-8")) as UserPreferences[];
  } catch {
    return [];
  }
}

function writeAll(prefs: UserPreferences[]) {
  ensureDir();
  writeFileSync(PREFS_FILE, JSON.stringify(prefs, null, 2), "utf-8");
}

/** 获取用户偏好（不存在时返回默认值） */
export function getUserPreferences(userId: string): UserPreferences {
  const all = readAll();
  const existing = all.find((p) => p.userId === userId);
  if (existing) {
    return {
      userId,
      analysisSettings: { ...DEFAULT_PREFS.analysisSettings, ...existing.analysisSettings },
      plotSettings: { ...DEFAULT_PREFS.plotSettings, ...existing.plotSettings },
      activePersonaId: existing.activePersonaId ?? null,
    };
  }
  return { userId, ...DEFAULT_PREFS };
}

/** 更新用户偏好（部分更新） */
export function updateUserPreferences(
  userId: string,
  patch: Partial<Omit<UserPreferences, "userId">>
): UserPreferences {
  const all = readAll();
  const idx = all.findIndex((p) => p.userId === userId);
  const current = getUserPreferences(userId);

  const updated: UserPreferences = {
    userId,
    analysisSettings: patch.analysisSettings
      ? { ...current.analysisSettings, ...patch.analysisSettings }
      : current.analysisSettings,
    plotSettings: patch.plotSettings
      ? { ...current.plotSettings, ...patch.plotSettings }
      : current.plotSettings,
    activePersonaId: patch.activePersonaId !== undefined ? patch.activePersonaId : current.activePersonaId,
  };

  if (idx >= 0) {
    all[idx] = updated;
  } else {
    all.push(updated);
  }

  writeAll(all);
  return updated;
}
