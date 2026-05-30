import { NextRequest, NextResponse } from "next/server";
import {
  getConnectionsByUser,
  createConnection,
  updateConnection,
  deleteConnection,
  setDefaultConnection,
  syncConnections,
} from "@/lib/connection-store";
import { requireUserId } from "@/lib/auth-helper";

export async function GET() {
  const userId = await requireUserId();
  if (userId === "NEEDS_SETUP") return NextResponse.json({ connections: [] });
  const connections = getConnectionsByUser(userId);
  return NextResponse.json({ connections });
}

export async function POST(req: NextRequest) {
  try {
    const userId = await requireUserId();
    if (userId === "NEEDS_SETUP") {
      return NextResponse.json({ error: "请先完成初始化设置" }, { status: 400 });
    }
    const body = await req.json();

    // 支持全量同步（客户端上传所有连接）
    if (body.sync && Array.isArray(body.connections)) {
      syncConnections(userId, body.connections);
      return NextResponse.json({ connections: getConnectionsByUser(userId) });
    }

    // 单个创建
    const { name, provider, baseUrl, apiKey, modelId, isDefault } = body;
    if (!name || !provider || !apiKey) {
      return NextResponse.json({ error: "name, provider, apiKey are required" }, { status: 400 });
    }
    const conn = createConnection(
      { name, provider: provider || "deepseek", baseUrl: baseUrl || "", apiKey, modelId: modelId || "", isDefault },
      userId
    );
    return NextResponse.json({ connection: conn }, { status: 201 });
  } catch (err) {
    if (err instanceof Response) throw err;
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const userId = await requireUserId();
    if (userId === "NEEDS_SETUP") {
      return NextResponse.json({ error: "请先完成初始化设置" }, { status: 400 });
    }
    const { id, action, ...patch } = await req.json();
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    // 设置默认连接
    if (action === "setDefault") {
      const ok = setDefaultConnection(id, userId);
      if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
      return NextResponse.json({ success: true });
    }

    const conn = updateConnection(id, userId, patch);
    if (!conn) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ connection: conn });
  } catch (err) {
    if (err instanceof Response) throw err;
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const userId = await requireUserId();
    if (userId === "NEEDS_SETUP") {
      return NextResponse.json({ error: "请先完成初始化设置" }, { status: 400 });
    }
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    const ok = deleteConnection(id, userId);
    return NextResponse.json({ success: ok });
  } catch (err) {
    if (err instanceof Response) throw err;
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
