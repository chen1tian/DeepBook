import { cookies } from "next/headers";
import { getConfig } from "./config";
import { getUserById, getDefaultUser } from "./users";

const USER_ID_COOKIE = "deepbook_user_id";

/**
 * 从请求 cookie 中提取当前用户 ID。
 * 在 API Route Handler 中调用。
 */
export async function getUserIdFromCookies(): Promise<string | null> {
  const cookieStore = await cookies();
  const userId = cookieStore.get(USER_ID_COOKIE)?.value;
  if (!userId) return null;

  // 验证用户是否仍然存在
  const user = getUserById(userId);
  if (!user) return null;

  return userId;
}

/**
 * 获取请求的 userId，根据多用户配置处理。
 *
 * - 多用户模式：必须有有效 cookie，否则抛出 401
 * - 单用户模式：自动使用默认用户 ID，若无默认用户则返回特殊标记 "NEEDS_SETUP"
 *
 * @returns userId 或 "NEEDS_SETUP"
 * @throws {Response} 401 未授权（多用户模式下）
 */
export async function requireUserId(): Promise<string> {
  const config = getConfig();
  const userId = await getUserIdFromCookies();

  if (config.multiUser) {
    // 多用户模式：必须有登录 cookie
    if (!userId) {
      throw Response.json(
        { error: "请先登录", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }
    return userId;
  } else {
    // 单用户模式：使用默认用户
    if (userId) return userId;

    const defaultUser = getDefaultUser();
    if (!defaultUser) {
      // 尚无任何用户，需要初始化
      return "NEEDS_SETUP";
    }
    return defaultUser.id;
  }
}

/**
 * 设置登录 cookie（在登录/注册/Setup API 中调用）
 */
export async function setUserCookie(userId: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(USER_ID_COOKIE, userId, {
    path: "/",
    httpOnly: true,
    sameSite: "strict",
    maxAge: 60 * 60 * 24 * 365, // 1 年
  });
}

/**
 * 清除登录 cookie
 */
export async function clearUserCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(USER_ID_COOKIE, "", {
    path: "/",
    httpOnly: true,
    sameSite: "strict",
    maxAge: 0,
  });
}
