"use client";

const STORAGE_KEY = "deepbook_connections";
const LEGACY_KEY = "deepbook_connection";
const USER_ID_KEY = "deepbook_current_user_id";

export type ProviderType = "openai" | "deepseek";

export interface ConnectionConfig {
  id: string;
  name: string;
  provider: ProviderType;
  baseUrl: string;
  apiKey: string;
  modelId: string;
  isDefault?: boolean;
}

const DEEPSEEK_BASE = "https://api.deepseek.com";

function generateId(): string {
  return `conn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** 设置当前用户 ID，用于连接配置隔离 */
export function setStorageUserId(userId: string | null): void {
  if (typeof window === "undefined") return;
  if (userId) {
    localStorage.setItem(USER_ID_KEY, userId);
  } else {
    localStorage.removeItem(USER_ID_KEY);
  }
}

/** 获取当前用户 ID */
export function getStorageUserId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(USER_ID_KEY);
}

/** 获取当前用户的连接存储键 */
function getConnectionsKey(): string {
  const uid = getStorageUserId();
  return uid ? `deepbook_connections_${uid}` : STORAGE_KEY;
}

function readAll(): ConnectionConfig[] {
  if (typeof window === "undefined") return [];
  const key = getConnectionsKey();
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as ConnectionConfig[];
  } catch { /* */ }
  // 如果新 key 无数据，尝试从旧 key 迁移
  if (key !== STORAGE_KEY) {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const migrated = JSON.parse(raw) as ConnectionConfig[];
        localStorage.setItem(key, JSON.stringify(migrated));
        return migrated;
      }
    } catch { /* */ }
  }
  // migrate legacy single connection
  try {
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const old = JSON.parse(legacy) as Omit<ConnectionConfig, "id" | "name" | "isDefault">;
      const migrated: ConnectionConfig = {
        id: generateId(),
        name: "默认连接",
        provider: old.provider || "deepseek",
        baseUrl: old.baseUrl || DEEPSEEK_BASE,
        apiKey: old.apiKey || "",
        modelId: old.modelId || "",
        isDefault: true,
      };
      localStorage.removeItem(LEGACY_KEY);
      localStorage.setItem(key, JSON.stringify([migrated]));
      return [migrated];
    }
  } catch { /* */ }
  return [];
}

function writeAll(connections: ConnectionConfig[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(getConnectionsKey(), JSON.stringify(connections));
}

export function getConnections(): ConnectionConfig[] {
  return readAll();
}

export function getConnectionConfig(): ConnectionConfig | null {
  const all = readAll();
  if (all.length === 0) return null;
  return all.find((c) => c.isDefault) || all[0];
}

export function saveConnection(config: ConnectionConfig): void {
  const all = readAll();
  if (!config.id) config.id = generateId();
  const idx = all.findIndex((c) => c.id === config.id);
  if (config.isDefault) {
    // ensure exclusivity
    for (const c of all) c.isDefault = false;
  }
  if (idx >= 0) {
    all[idx] = config;
  } else {
    // new connection — if no default yet, make it default
    if (!all.some((c) => c.isDefault)) config.isDefault = true;
    all.push(config);
  }
  writeAll(all);
}

export function deleteConnection(id: string): void {
  let all = readAll();
  const deleted = all.find((c) => c.id === id);
  all = all.filter((c) => c.id !== id);
  // if deleted was default, make the first remaining default
  if (deleted?.isDefault && all.length > 0) {
    all[0].isDefault = true;
  }
  writeAll(all);
}

export function setDefaultConnection(id: string): void {
  const all = readAll();
  for (const c of all) c.isDefault = (c.id === id);
  writeAll(all);
}

export function duplicateConnection(id: string): ConnectionConfig | null {
  const all = readAll();
  const source = all.find((c) => c.id === id);
  if (!source) return null;
  const copy: ConnectionConfig = {
    ...source,
    id: generateId(),
    name: `${source.name} (副本)`,
    isDefault: false,
  };
  all.push(copy);
  writeAll(all);
  return copy;
}

export function clearConnectionConfig(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

/** 从服务端加载当前用户的连接配置到 localStorage */
export async function loadConnectionsFromServer(): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const res = await fetch("/api/connections");
    if (!res.ok) return;
    const data = await res.json();
    if (data.connections && Array.isArray(data.connections)) {
      // 移除服务端独有字段，只保留客户端需要的字段
      const clientConns: ConnectionConfig[] = data.connections.map(
        (c: Record<string, unknown>) => ({
          id: c.id as string,
          name: c.name as string,
          provider: c.provider as ProviderType,
          baseUrl: c.baseUrl as string,
          apiKey: c.apiKey as string,
          modelId: c.modelId as string,
          isDefault: c.isDefault as boolean | undefined,
        })
      );
      writeAll(clientConns);
    }
  } catch {
    // 静默失败，使用本地缓存
  }
}

/** 将连接保存到服务端（创建或更新） */
export async function saveConnectionToServer(config: ConnectionConfig): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    // 先检查是否已存在
    const existing = readAll().find((c) => c.id === config.id);
    if (existing) {
      await fetch("/api/connections", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
    } else {
      await fetch("/api/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
    }
  } catch { /* */ }
}

/** 从服务端删除连接 */
export async function deleteConnectionFromServer(id: string): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    await fetch(`/api/connections?id=${encodeURIComponent(id)}`, { method: "DELETE" });
  } catch { /* */ }
}

/** 将服务端某连接设为默认 */
export async function setDefaultConnectionOnServer(id: string): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    await fetch("/api/connections", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action: "setDefault" }),
    });
  } catch { /* */ }
}

// --- analysis settings ---

const ANALYSIS_KEY = "deepbook_analysis_settings";

export interface AnalysisSettings {
  messageCount: number;
  connectionId: string;
}

const DEFAULT_ANALYSIS_SETTINGS: AnalysisSettings = {
  messageCount: 20,
  connectionId: "",
};

export function getAnalysisSettings(): AnalysisSettings {
  if (typeof window === "undefined") return DEFAULT_ANALYSIS_SETTINGS;
  try {
    const raw = localStorage.getItem(ANALYSIS_KEY);
    if (raw) return JSON.parse(raw) as AnalysisSettings;
  } catch { /* */ }
  return DEFAULT_ANALYSIS_SETTINGS;
}

export function saveAnalysisSettings(settings: AnalysisSettings): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(ANALYSIS_KEY, JSON.stringify(settings));
  // 同步到服务端
  fetch("/api/user-prefs", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ analysisSettings: settings }),
  }).catch(() => {});
}

// --- plot settings ---

const PLOT_KEY = "deepbook_plot_settings";

export interface PlotSettings {
  messageCount: number;
  generationConnectionId: string;
  analysisConnectionId: string;
  spoilerPrevention: boolean;
  autoGenerate: boolean;
}

const DEFAULT_PLOT_SETTINGS: PlotSettings = {
  messageCount: 20,
  generationConnectionId: "",
  analysisConnectionId: "",
  spoilerPrevention: true,
  autoGenerate: true,
};

export function getPlotSettings(): PlotSettings {
  if (typeof window === "undefined") return DEFAULT_PLOT_SETTINGS;
  try {
    const raw = localStorage.getItem(PLOT_KEY);
    if (raw) return JSON.parse(raw) as PlotSettings;
  } catch { /* */ }
  return DEFAULT_PLOT_SETTINGS;
}

export function savePlotSettings(settings: PlotSettings): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(PLOT_KEY, JSON.stringify(settings));
  // 同步到服务端
  fetch("/api/user-prefs", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plotSettings: settings }),
  }).catch(() => {});
}

export function getDefaultBaseUrl(provider: ProviderType): string {
  if (provider === "deepseek") return DEEPSEEK_BASE;
  return "https://api.openai.com/v1";
}

// --- floating chat position ---

const POSITION_KEY = "deepbook_chat_position";

export interface ChatPosition {
  x: number;
  y: number;
}

const DEFAULT_POSITION: ChatPosition = { x: -1, y: -1 }; // -1 = use default

export function getChatPosition(): ChatPosition {
  if (typeof window === "undefined") return DEFAULT_POSITION;
  try {
    const raw = localStorage.getItem(POSITION_KEY);
    if (!raw) return DEFAULT_POSITION;
    return JSON.parse(raw) as ChatPosition;
  } catch {
    return DEFAULT_POSITION;
  }
}

export function saveChatPosition(pos: ChatPosition): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(POSITION_KEY, JSON.stringify(pos));
}

// --- active persona ---

const PERSONA_KEY = "deepbook_active_persona";

export function getActivePersonaId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(PERSONA_KEY);
}

export function setActivePersonaId(id: string | null): void {
  if (typeof window === "undefined") return;
  if (id) localStorage.setItem(PERSONA_KEY, id);
  else localStorage.removeItem(PERSONA_KEY);
  // 同步到服务端
  fetch("/api/user-prefs", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ activePersonaId: id }),
  }).catch(() => {});
}

/** 从服务端加载用户偏好到 localStorage */
export async function loadPrefsFromServer(): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const res = await fetch("/api/user-prefs");
    if (!res.ok) return;
    const data = await res.json();
    const prefs = data.preferences;
    if (!prefs) return;
    if (prefs.analysisSettings) {
      localStorage.setItem(ANALYSIS_KEY, JSON.stringify(prefs.analysisSettings));
    }
    if (prefs.plotSettings) {
      localStorage.setItem(PLOT_KEY, JSON.stringify(prefs.plotSettings));
    }
    if (prefs.activePersonaId) {
      localStorage.setItem(PERSONA_KEY, prefs.activePersonaId);
    } else if (prefs.activePersonaId === null) {
      localStorage.removeItem(PERSONA_KEY);
    }
  } catch { /* */ }
}
