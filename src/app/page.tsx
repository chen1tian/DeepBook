"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus } from "lucide-react";
import DialogueView from "@/components/DialogueView";
import PresetPanel from "@/components/PresetPanel";
import PersonaPanel from "@/components/PersonaPanel";
import { useView } from "@/lib/view-context";

interface Book {
  id: number;
  name: string;
  genre: string;
  style: string;
  cover_color: string;
  active_dialogue_id: string | null;
}

export default function Home() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeBook, setActiveBook] = useState<Book | null>(null);
  const [activeDialogueId, setActiveDialogueId] = useState<string | null>(null);
  const { showPresets, togglePresets, showPersonas, togglePersonas } = useView();

  const fetchBooks = useCallback(async () => {
    try {
      const res = await fetch("/api/books");
      const data = await res.json();
      setBooks(data.books || []);
    } catch { /* */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchBooks(); }, [fetchBooks]);

  useEffect(() => {
    (window as unknown as Record<string, unknown>).__refreshBooks = fetchBooks;
    return () => { delete (window as unknown as Record<string, unknown>).__refreshBooks; };
  }, [fetchBooks]);

  // Listen for dialogue-started
  useEffect(() => {
    function handleStarted(e: Event) {
      const detail = (e as CustomEvent).detail;
      if (detail?.bookId) {
        setActiveDialogueId(detail.dialogueId || null);
        fetchBooks().then(() => {
          setBooks((prev) => {
            const b = prev.find((x) => x.id === detail.bookId);
            if (b && !activeBook) setActiveBook(b);
            return prev;
          });
        });
      }
    }
    window.addEventListener("deepbook:dialogue-started", handleStarted);
    return () => window.removeEventListener("deepbook:dialogue-started", handleStarted);
  }, [fetchBooks, activeBook]);

  // Listen for dialogue-closed
  useEffect(() => {
    function handleClosed() {
      setActiveBook(null);
      setActiveDialogueId(null);
      fetchBooks();
    }
    window.addEventListener("deepbook:dialogue-closed", handleClosed);
    return () => window.removeEventListener("deepbook:dialogue-closed", handleClosed);
  }, [fetchBooks]);

  function handleAdd() {
    window.dispatchEvent(new CustomEvent("deepbook:new-story"));
  }

  function handleBookClick(book: Book) {
    if (book.active_dialogue_id) {
      setActiveBook(book);
      setActiveDialogueId(book.active_dialogue_id);
      (window as unknown as Record<string, unknown>).__activeBook = {
        id: book.id, name: book.name, genre: book.genre, style: book.style,
      };
    } else {
      window.dispatchEvent(
        new CustomEvent("deepbook:open-dialogue", {
          detail: { bookId: book.id, bookName: book.name, bookGenre: book.genre, bookStyle: book.style },
        })
      );
    }
  }

  function handleBack() {
    setActiveBook(null);
    setActiveDialogueId(null);
    delete (window as unknown as Record<string, unknown>).__activeBook;
    fetchBooks();
  }

  function handleNewDialogue() {
    if (!activeBook) return;
    window.dispatchEvent(
      new CustomEvent("deepbook:new-dialogue", {
        detail: { bookId: activeBook.id, bookName: activeBook.name },
      })
    );
  }

  function handleSwitchDialogue(dialogueId: string) {
    setActiveDialogueId(dialogueId);
    if (activeBook) {
      (window as unknown as Record<string, unknown>).__activeBook = {
        id: activeBook.id, name: activeBook.name, genre: activeBook.genre, style: activeBook.style,
      };
    }
  }

  if (loading) return null;

  if (showPresets) {
    return <PresetPanel onBack={() => togglePresets()} />;
  }

  if (showPersonas) {
    return <PersonaPanel onBack={() => togglePersonas()} />;
  }

  if (activeBook) {
    return (
      <div className="flex h-[calc(100dvh-2.75rem)] flex-col">
        <DialogueView
          bookId={activeBook.id}
          bookName={activeBook.name}
          bookGenre={activeBook.genre}
          bookStyle={activeBook.style}
          dialogueId={activeDialogueId}
          onBack={handleBack}
          onNewDialogue={handleNewDialogue}
          onSwitchDialogue={handleSwitchDialogue}
          onBookUpdated={() => { fetchBooks(); }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100dvh-2.75rem)] p-6">
      {books.length === 0 ? (
        <div className="flex min-h-[calc(100dvh-2.75rem-3rem)] items-center justify-center">
          <button onClick={handleAdd} className="group flex flex-col items-center gap-3">
            <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-dashed border-zinc-700 text-zinc-600 transition group-hover:border-blue-500 group-hover:text-blue-400">
              <Plus size={28} strokeWidth={1.5} />
            </div>
            <span className="text-xs text-zinc-600 transition group-hover:text-zinc-400">创建故事</span>
          </button>
        </div>
      ) : (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xs font-medium text-zinc-500">我的故事 ({books.length})</h2>
            <button onClick={handleAdd} className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-dashed border-zinc-700 text-zinc-600 transition hover:border-blue-500 hover:text-blue-400" title="创建新故事">
              <Plus size={18} strokeWidth={1.5} />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8">
            {books.map((book) => (
              <button key={book.id} onClick={() => handleBookClick(book)} className="group flex flex-col items-center gap-2">
                <div className="flex h-16 w-16 items-center justify-center rounded-full shadow-md transition group-hover:scale-105 group-hover:shadow-lg sm:h-20 sm:w-20" style={{ backgroundColor: book.cover_color }}>
                  <span className="text-lg font-bold text-white/90 sm:text-xl">{book.name.charAt(0)}</span>
                </div>
                <span className="max-w-[5rem] truncate text-center text-[11px] leading-tight text-zinc-400 group-hover:text-zinc-200">{book.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
