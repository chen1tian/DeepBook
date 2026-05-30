import { NextRequest, NextResponse } from "next/server";
import { changePassword, sanitizeUser } from "@/lib/users";
import { getUserIdFromCookies } from "@/lib/auth-helper";

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserIdFromCookies();
    if (!userId) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const { oldPassword, newPassword } = await req.json();

    if (!oldPassword || !newPassword) {
      return NextResponse.json(
        { error: "请填写原密码和新密码" },
        { status: 400 }
      );
    }

    if (newPassword.length < 4) {
      return NextResponse.json(
        { error: "新密码长度至少 4 个字符" },
        { status: 400 }
      );
    }

    if (oldPassword === newPassword) {
      return NextResponse.json(
        { error: "新密码不能与原密码相同" },
        { status: 400 }
      );
    }

    const user = changePassword(userId, oldPassword, newPassword);
    return NextResponse.json({ user: sanitizeUser(user) });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    const status = msg === "原密码错误" ? 401 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
