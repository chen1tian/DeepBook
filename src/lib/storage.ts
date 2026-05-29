"use client";

const STORAGE_KEY = "deepbook_connections";
const LEGACY_KEY = "deepbook_connection";

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

function readAll(): ConnectionConfig[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as ConnectionConfig[];
  } catch { /* */ }
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
      localStorage.setItem(STORAGE_KEY, JSON.stringify([migrated]));
      return [migrated];
    }
  } catch { /* */ }
  return [];
}

function writeAll(connections: ConnectionConfig[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(connections));
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
}
