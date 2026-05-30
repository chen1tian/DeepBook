import { NextRequest, NextResponse } from "next/server";
import { getConfig } from "@/lib/config";
import { getUserByUsername, createUser, sanitizeUser } from "@/lib/users";
import { setUserCookie } from "@/lib/auth-helper";

export async function POST(req: NextRequest) {
  try {
    const config = getConfig();

    // 仅在多用户模式下允许注册
    if (!config.multiUser) {
      return NextResponse.json(
        { error: "单用户模式下不支持注册，请使用初始化设置" },
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

    // 检查用户名是否已存在
    if (getUserByUsername(username)) {
      return NextResponse.json(
        { error: "用户名已存在" },
        { status: 409 }
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
