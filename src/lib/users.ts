import { join } from "path";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { createHash, randomBytes } from "crypto";

const DATA_DIR = join(process.cwd(), ".data");
const USERS_FILE = join(DATA_DIR, "users.json");

export interface User {
  id: string;
  username: string;
  passwordHash: string;
  salt: string;
  createdAt: string;
  isDefault: boolean;
}

function ensureDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

function readAll(): User[] {
  ensureDir();
  if (!existsSync(USERS_FILE)) return [];
  try {
    return JSON.parse(readFileSync(USERS_FILE, "utf-8")) as User[];
  } catch {
    return [];
  }
}

function writeAll(users: User[]) {
  ensureDir();
  writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), "utf-8");
}

function generateId(): string {
  return `usr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function hashPassword(password: string, salt: string): string {
  return createHash("sha256")
    .update(salt + password)
    .digest("hex");
}

function generateSalt(): string {
  return randomBytes(16).toString("hex");
}

/** 获取所有用户 */
export function getAllUsers(): User[] {
  return readAll();
}

/** 按 ID 获取用户 */
export function getUserById(id: string): User | null {
  return readAll().find((u) => u.id === id) ?? null;
}

/** 按用户名获取用户 */
export function getUserByUsername(username: string): User | null {
  return readAll().find((u) => u.username === username) ?? null;
}

/** 创建用户。如果是系统中第一个用户，自动设为默认用户。 */
export function createUser(username: string, password: string): User {
  const users = readAll();

  // 检查用户名是否已存在
  if (users.some((u) => u.username === username)) {
    throw new Error("用户名已存在");
  }

  const salt = generateSalt();
  const user: User = {
    id: generateId(),
    username,
    passwordHash: hashPassword(password, salt),
    salt,
    createdAt: new Date().toISOString(),
    isDefault: users.length === 0, // 第一个用户为默认用户
  };

  users.push(user);
  writeAll(users);
  return user;
}

/** 验证密码 */
export function verifyPassword(user: User, password: string): boolean {
  const hash = hashPassword(password, user.salt);
  return hash === user.passwordHash;
}

/** 获取默认用户（单用户模式使用） */
export function getDefaultUser(): User | null {
  return readAll().find((u) => u.isDefault) ?? null;
}

/** 是否存在任何用户 */
export function hasUsers(): boolean {
  return readAll().length > 0;
}

/** 安全用户信息（去除敏感字段，返回给前端） */
export function sanitizeUser(user: User): Omit<User, "passwordHash" | "salt"> {
  const { passwordHash, salt, ...safe } = user;
  return safe;
}

/** 修改密码 */
export function changePassword(userId: string, oldPassword: string, newPassword: string): User {
  const users = readAll();
  const idx = users.findIndex((u) => u.id === userId);
  if (idx === -1) throw new Error("用户不存在");

  const user = users[idx];
  if (!verifyPassword(user, oldPassword)) {
    throw new Error("原密码错误");
  }

  const newSalt = generateSalt();
  users[idx] = {
    ...user,
    salt: newSalt,
    passwordHash: hashPassword(newPassword, newSalt),
  };

  writeAll(users);
  return users[idx];
}
