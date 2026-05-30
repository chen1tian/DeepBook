import { join } from "path";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";

const DATA_DIR = join(process.cwd(), ".data");
/** 用户可直接编辑的根目录配置文件 — 最高优先级（重启生效） */
const USER_CONFIG_FILE = join(process.cwd(), "deepbook.config.json");
/** 运行时数据（API 调用写入），优先级低于用户配置文件 */
const RUNTIME_CONFIG_FILE = join(DATA_DIR, "config.json");

export interface AppConfig {
  /** 是否启用多用户模式 */
  multiUser: boolean;
}

const DEFAULT_CONFIG: AppConfig = {
  multiUser: false,
};

function ensureDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

/**
 * 读取用户配置文件（根目录 deepbook.config.json）。
 * 不存在时自动创建带有默认值和注释的模板。
 */
function readUserConfig(): Partial<AppConfig> {
  if (!existsSync(USER_CONFIG_FILE)) {
    const template = {
      // ===== 多用户模式 =====
      // true  → 进入系统需要登录，每个用户数据隔离
      // false → 单用户模式，首次设置用户名密码后自动登录
      multiUser: false,
    };
    // 写入带注释的 JSON（用 // 注释，不是标准 JSON，但用 JSON5 风格）
    // 为兼容性，写标准 JSON + 注释说明
    const header = `// DeepBook 配置文件
// 修改此文件后重启应用生效。
// 以下是当前支持的配置项：
//
// multiUser: 是否启用多用户模式
//   - false (默认): 单用户模式，首次访问时设置用户名密码，之后自动登录
//   - true: 多用户模式，需要登录才能使用，每个用户的数据完全隔离
//
`;
    writeFileSync(USER_CONFIG_FILE, header + JSON.stringify(template, null, 2), "utf-8");
    return template;
  }
  try {
    const raw = readFileSync(USER_CONFIG_FILE, "utf-8");
    // 支持 // 注释：移除注释行后解析 JSON
    const cleaned = raw
      .split("\n")
      .filter((line) => !line.trim().startsWith("//"))
      .join("\n");
    return JSON.parse(cleaned) as Partial<AppConfig>;
  } catch {
    return {};
  }
}

/** 读取运行时覆盖配置（API 调用写入 .data/config.json） */
function readRuntimeConfig(): Partial<AppConfig> {
  ensureDir();
  if (!existsSync(RUNTIME_CONFIG_FILE)) return {};
  try {
    return JSON.parse(readFileSync(RUNTIME_CONFIG_FILE, "utf-8")) as Partial<AppConfig>;
  } catch {
    return {};
  }
}

function writeRuntimeConfig(config: AppConfig): void {
  ensureDir();
  writeFileSync(RUNTIME_CONFIG_FILE, JSON.stringify(config, null, 2), "utf-8");
}

function readConfig(): AppConfig {
  const runtime = readRuntimeConfig();
  const user = readUserConfig();
  // 优先级：默认 < 运行时覆盖 < 用户配置文件（最高）
  return { ...DEFAULT_CONFIG, ...runtime, ...user };
}

/** 获取当前应用配置 */
export function getConfig(): AppConfig {
  return readConfig();
}

/** 更新运行时配置（API 调用入口，写入 .data/config.json） */
export function updateConfig(patch: Partial<AppConfig>): AppConfig {
  const current = readConfig();
  const updated: AppConfig = { ...current, ...patch };

  // 排除用户手动配置的项（只写入与用户配置文件不同的部分）
  const userConfig = readUserConfig();
  const runtimePatch: Partial<AppConfig> = {};
  for (const key of Object.keys(patch) as (keyof AppConfig)[]) {
    // 只有与用户配置文件值不同的才写入运行时覆盖
    if (updated[key] !== userConfig[key]) {
      runtimePatch[key] = updated[key];
    }
  }

  // 合并现有运行时配置
  const existingRuntime = readRuntimeConfig();
  const newRuntime = { ...existingRuntime, ...runtimePatch };

  // 清理与默认值相同的键（减少冗余）
  for (const key of Object.keys(newRuntime) as (keyof AppConfig)[]) {
    if (newRuntime[key] === DEFAULT_CONFIG[key]) {
      delete newRuntime[key];
    }
  }

  writeRuntimeConfig(newRuntime as AppConfig);
  return updated;
}

