import { NextResponse } from "next/server";
import { getConfig, updateConfig } from "@/lib/config";

export async function GET() {
  try {
    const config = getConfig();
    return NextResponse.json({ config });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const config = updateConfig(body);
    return NextResponse.json({ config });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
