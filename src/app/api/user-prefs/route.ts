import { NextRequest, NextResponse } from "next/server";
import { getUserPreferences, updateUserPreferences } from "@/lib/user-prefs";
import { requireUserId } from "@/lib/auth-helper";

export async function GET() {
  const userId = await requireUserId();
  if (userId === "NEEDS_SETUP") {
    return NextResponse.json({ preferences: null });
  }
  const prefs = getUserPreferences(userId);
  return NextResponse.json({ preferences: prefs });
}

export async function PATCH(req: NextRequest) {
  try {
    const userId = await requireUserId();
    if (userId === "NEEDS_SETUP") {
      return NextResponse.json({ error: "请先完成初始化设置" }, { status: 400 });
    }
    const body = await req.json();
    const prefs = updateUserPreferences(userId, body);
    return NextResponse.json({ preferences: prefs });
  } catch (err) {
    if (err instanceof Response) throw err;
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
