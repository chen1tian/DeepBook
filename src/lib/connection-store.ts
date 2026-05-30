import { join } from "path";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";

const DATA_DIR = join(process.cwd(), ".data");
const CONNECTIONS_FILE = join(DATA_DIR, "connections.json");

export interface StoredConnection {
  id: string;
  userId: string;
  name: string;
  provider: "openai" | "deepseek";
  baseUrl: string;
  apiKey: string;
  modelId: string;
  isDefault: boolean;
  createdAt: string;
}

function ensureDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

function readAll(): StoredConnection[] {
  ensureDir();
  if (!existsSync(CONNECTIONS_FILE)) return [];
  try {
    return JSON.parse(readFileSync(CONNECTIONS_FILE, "utf-8")) as StoredConnection[];
  } catch {
    return [];
  }
}

function writeAll(connections: StoredConnection[]) {
  ensureDir();
  writeFileSync(CONNECTIONS_FILE, JSON.stringify(connections, null, 2), "utf-8");
}

/** 获取某用户的所有连接 */
export function getConnectionsByUser(userId: string): StoredConnection[] {
  return readAll()
    .filter((c) => c.userId === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** 获取单个连接（验证所有权） */
export function getConnection(id: string, userId: string): StoredConnection | null {
  return readAll().find((c) => c.id === id && c.userId === userId) ?? null;
}

/** 创建连接 */
export function createConnection(
  data: {
    name: string;
    provider: "openai" | "deepseek";
    baseUrl: string;
    apiKey: string;
    modelId: string;
    isDefault?: boolean;
  },
  userId: string
): StoredConnection {
  const all = readAll();

  // 如果要设为默认，先取消该用户其他默认
  if (data.isDefault) {
    for (const c of all) {
      if (c.userId === userId) c.isDefault = false;
    }
  }

  // 如果该用户还没有连接，自动设为默认
  const userHasConnections = all.some((c) => c.userId === userId);
  const isDefault = data.isDefault ?? !userHasConnections;

  const conn: StoredConnection = {
    id: `conn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    userId,
    name: data.name,
    provider: data.provider,
    baseUrl: data.baseUrl,
    apiKey: data.apiKey,
    modelId: data.modelId,
    isDefault,
    createdAt: new Date().toISOString(),
  };

  all.push(conn);
  writeAll(all);
  return conn;
}

/** 更新连接 */
export function updateConnection(
  id: string,
  userId: string,
  patch: Partial<Omit<StoredConnection, "id" | "userId" | "createdAt">>
): StoredConnection | null {
  const all = readAll();
  const idx = all.findIndex((c) => c.id === id && c.userId === userId);
  if (idx === -1) return null;

  // 如果要设为默认，先取消同用户其他默认
  if (patch.isDefault) {
    for (const c of all) {
      if (c.userId === userId && c.id !== id) c.isDefault = false;
    }
  }

  all[idx] = { ...all[idx], ...patch, id, userId };
  writeAll(all);
  return all[idx];
}

/** 删除连接 */
export function deleteConnection(id: string, userId: string): boolean {
  const all = readAll();
  const deleted = all.find((c) => c.id === id && c.userId === userId);
  if (!deleted) return false;

  const remaining = all.filter((c) => !(c.id === id && c.userId === userId));

  // 如果删除的是默认连接，将同用户的第一个设为默认
  if (deleted.isDefault) {
    const first = remaining.find((c) => c.userId === userId);
    if (first) first.isDefault = true;
  }

  writeAll(remaining);
  return true;
}

/** 设置默认连接 */
export function setDefaultConnection(id: string, userId: string): boolean {
  const all = readAll();
  let found = false;
  for (const c of all) {
    if (c.userId === userId) {
      c.isDefault = c.id === id;
      if (c.id === id) found = true;
    }
  }
  if (found) writeAll(all);
  return found;
}

/** 同步用户的所有连接（全量替换，用于从客户端上传） */
export function syncConnections(userId: string, connections: Omit<StoredConnection, "userId">[]): void {
  const all = readAll().filter((c) => c.userId !== userId);
  const stamped: StoredConnection[] = connections.map((c) => ({
    ...c,
    userId,
    createdAt: (c as { createdAt?: string }).createdAt || new Date().toISOString(),
  }));
  all.push(...stamped);
  writeAll(all);
}
