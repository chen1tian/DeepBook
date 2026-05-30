import { NextRequest, NextResponse } from "next/server";
import { getConfig } from "@/lib/config";
import { hasUsers, createUser, sanitizeUser } from "@/lib/users";
import { setUserCookie } from "@/lib/auth-helper";

/**
 * 单用户初始化设置。
 * 仅在 multiUser=false 且尚无任何用户时可用。
 */
export async function POST(req: NextRequest) {
  try {
    const config = getConfig();

    if (config.multiUser) {
      return NextResponse.json(
        { error: "多用户模式下请使用注册功能" },
        { status: 403 }
      );
    }

    if (hasUsers()) {
      return NextResponse.json(
        { error: "已存在用户，无需重复初始化" },
        { status: 403 }
      );
    }

    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: "用户名和密码不能为空" },
        { status: 400 }
      );
    }

    if (username.length < 2 || username.length > 20) {
      return NextResponse.json(
        { error: "用户名长度需在 2-20 个字符之间" },
        { status: 400 }
      );
    }

    if (password.length < 4) {
      return NextResponse.json(
        { error: "密码长度至少 4 个字符" },
        { status: 400 }
      );
    }

    const user = createUser(username, password);
    await setUserCookie(user.id);

    return NextResponse.json(
      { user: sanitizeUser(user) },
      { status: 201 }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
