import { NextResponse } from "next/server";
import { getUserById } from "@/lib/users";
import { getUserIdFromCookies } from "@/lib/auth-helper";
import { getConfig } from "@/lib/config";
import { hasUsers } from "@/lib/users";
import { sanitizeUser } from "@/lib/users";

export async function GET() {
  try {
    const config = getConfig();
    const userId = await getUserIdFromCookies();

    if (userId) {
      const user = getUserById(userId);
      if (user) {
        return NextResponse.json({
          authenticated: true,
          user: sanitizeUser(user),
          multiUser: config.multiUser,
          needsSetup: false,
        });
      }
    }

    // 未登录
    return NextResponse.json({
      authenticated: false,
      user: null,
      multiUser: config.multiUser,
      needsSetup: !config.multiUser && !hasUsers(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
