"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus } from "lucide-react";

interface Book {
  id: number;
  name: string;
  genre: string;
  style: string;
  cover_color: string;
}

export default function Home() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBooks = useCallback(async () => {
    try {
      const res = await fetch("/api/books");
      const data = await res.json();
      setBooks(data.books || []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBooks();
  }, [fetchBooks]);

  // expose refresh for external calls (e.g., after create_book)
  useEffect(() => {
    (window as unknown as Record<string, unknown>).__refreshBooks = fetchBooks;
    return () => {
      delete (window as unknown as Record<string, unknown>).__refreshBooks;
    };
  }, [fetchBooks]);

  function handleAdd() {
    // dispatch custom event so FloatingChat picks it up
    window.dispatchEvent(
      new CustomEvent("deepbook:new-story")
    );
  }

  if (loading) return null;

  return (
    <div className="min-h-[calc(100dvh-2.75rem)] p-6">
      {books.length === 0 ? (
        /* empty state */
        <div className="flex min-h-[calc(100dvh-2.75rem-3rem)] items-center justify-center">
          <button
            onClick={handleAdd}
            className="group flex flex-col items-center gap-3"
          >
            <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-dashed border-zinc-700 text-zinc-600 transition group-hover:border-emerald-500 group-hover:text-emerald-500">
              <Plus size={28} strokeWidth={1.5} />
            </div>
            <span className="text-xs text-zinc-600 transition group-hover:text-zinc-400">
              创建故事
            </span>
          </button>
        </div>
      ) : (
        /* book grid */
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xs font-medium text-zinc-500">
              我的故事 ({books.length})
            </h2>
            <button
              onClick={handleAdd}
              className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-dashed border-zinc-700 text-zinc-600 transition hover:border-emerald-500 hover:text-emerald-500"
              title="创建新故事"
            >
              <Plus size={18} strokeWidth={1.5} />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8">
            {books.map((book) => (
              <button
                key={book.id}
                className="group flex flex-col items-center gap-2"
              >
                {/* circular cover */}
                <div
                  className="flex h-16 w-16 items-center justify-center rounded-full shadow-md transition group-hover:scale-105 group-hover:shadow-lg sm:h-20 sm:w-20"
                  style={{ backgroundColor: book.cover_color }}
                >
                  <span className="text-lg font-bold text-white/90 sm:text-xl">
                    {book.name.charAt(0)}
                  </span>
                </div>
                {/* name */}
                <span className="max-w-[5rem] truncate text-center text-[11px] leading-tight text-zinc-400 group-hover:text-zinc-200">
                  {book.name}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
