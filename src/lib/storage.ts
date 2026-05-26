"use client";

const STORAGE_KEY = "deepbook_connection";

export type ProviderType = "openai" | "deepseek";

export interface ConnectionConfig {
  provider: ProviderType;
  baseUrl: string;
  apiKey: string;
  modelId: string;
}

const DEEPSEEK_BASE = "https://api.deepseek.com";

export function getConnectionConfig(): ConnectionConfig | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ConnectionConfig;
  } catch {
    return null;
  }
}

export function saveConnectionConfig(config: ConnectionConfig): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
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
