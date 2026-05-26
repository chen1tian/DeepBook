import { NextResponse } from "next/server";
import { getBooks, createBook } from "@/lib/db";

export async function GET() {
  try {
    const books = await getBooks();
    return NextResponse.json({ books });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, genre, style, system_prompt } = body;

    if (!name || !genre || !style) {
      return NextResponse.json(
        { error: "name, genre, style are required" },
        { status: 400 }
      );
    }

    const book = await createBook({ name, genre, style, system_prompt: system_prompt || "" });
    return NextResponse.json({ book }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
