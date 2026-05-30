import { NextResponse } from "next/server";
import { getBooks, createBook, updateBook } from "@/lib/db";
import { requireUserId } from "@/lib/auth-helper";

export async function GET() {
  try {
    const userId = await requireUserId();
    if (userId === "NEEDS_SETUP") {
      return NextResponse.json({ books: [] });
    }
    const books = await getBooks(userId);
    return NextResponse.json({ books });
  } catch (err) {
    if (err instanceof Response) throw err;
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const userId = await requireUserId();
    if (userId === "NEEDS_SETUP") {
      return NextResponse.json({ error: "请先完成初始化设置" }, { status: 400 });
    }
    const body = await req.json();
    const { name, genre, style, system_prompt } = body;

    if (!name || !genre || !style) {
      return NextResponse.json(
        { error: "name, genre, style are required" },
        { status: 400 }
      );
    }

    const book = await createBook({ name, genre, style, system_prompt: system_prompt || "" }, userId);
    return NextResponse.json({ book }, { status: 201 });
  } catch (err) {
    if (err instanceof Response) throw err;
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const userId = await requireUserId();
    if (userId === "NEEDS_SETUP") {
      return NextResponse.json({ error: "请先完成初始化设置" }, { status: 400 });
    }
    const body = await req.json();
    const { id, ...patch } = body;
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const book = await updateBook(id, userId, patch);
    if (!book) return NextResponse.json({ error: "Book not found" }, { status: 404 });
    return NextResponse.json({ book });
  } catch (err) {
    if (err instanceof Response) throw err;
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
