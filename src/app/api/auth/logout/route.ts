import { NextResponse } from "next/server";
import { clearUserCookie } from "@/lib/auth-helper";

export async function POST() {
  try {
    await clearUserCookie();
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
