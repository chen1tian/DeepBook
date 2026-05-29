import { NextRequest } from "next/server";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const AVATARS_DIR = join(process.cwd(), ".data", "avatars");

function ensureDir() {
  if (!existsSync(AVATARS_DIR)) mkdirSync(AVATARS_DIR, { recursive: true });
}

function generateFilename(): string {
  return `av_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`;
}

// GET — serve an avatar file
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const file = searchParams.get("file");
  if (!file) return new Response("file is required", { status: 400 });

  // security: prevent path traversal
  const safe = file.replace(/[^a-zA-Z0-9_.-]/g, "");
  const fp = join(AVATARS_DIR, safe);
  if (!existsSync(fp)) return new Response("Not found", { status: 404 });

  const data = readFileSync(fp);
  return new Response(data, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400",
    },
  });
}

// POST — upload an avatar
export async function POST(req: NextRequest) {
  ensureDir();
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return new Response("No file provided", { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const filename = generateFilename();
    writeFileSync(join(AVATARS_DIR, filename), buffer);

    return new Response(JSON.stringify({ filename }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Upload failed";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
