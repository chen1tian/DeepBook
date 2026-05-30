import { NextRequest, NextResponse } from "next/server";
import { getUserByUsername, verifyPassword, sanitizeUser } from "@/lib/users";
import { setUserCookie } from "@/lib/auth-helper";

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: "用户名和密码不能为空" },
        { status: 400 }
      );
    }

    const user = getUserByUsername(username);
    if (!user) {
      return NextResponse.json(
        { error: "用户名或密码错误" },
        { status: 401 }
      );
    }

    if (!verifyPassword(user, password)) {
      return NextResponse.json(
        { error: "用户名或密码错误" },
        { status: 401 }
      );
    }

    await setUserCookie(user.id);

    return NextResponse.json({
      user: sanitizeUser(user),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
