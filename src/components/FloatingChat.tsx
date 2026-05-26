"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { MessageCircle, X, GripHorizontal } from "lucide-react";
import ChatWindow from "./ChatWindow";
import { getChatPosition, saveChatPosition, type ChatPosition } from "@/lib/storage";

const BTN_SIZE = 48;
const PANEL_W = 380;
const PANEL_H = 460;
const PADDING = 16;
const DRAG_THRESHOLD = 5;

export default function FloatingChat() {
  const [open, setOpen] = useState(false);
  const [task, setTask] = useState<string | null>(null);
  const [pos, setPos] = useState<ChatPosition>(() => getChatPosition());

  const dragState = useRef({
    active: false,
    target: null as "btn" | "panel" | null,
    startX: 0,
    startY: 0,
    startPosX: 0,
    startPosY: 0,
    moved: false,
  });

  const [bookId, setBookId] = useState<number | null>(null);
  const [bookName, setBookName] = useState<string>("");
  const [activeBook, setActiveBook] = useState<{ id: number; name: string; genre: string; style: string } | null>(null);

  // listen for task events from the page
  useEffect(() => {
    function handleNewStory() {
      setBookId(null);
      setBookName("");
      setTask("create-story");
      setOpen(true);
    }
    function handleNewDialogue(e: Event) {
      const detail = (e as CustomEvent).detail;
      setBookId(detail.bookId);
      setBookName(detail.bookName || "");
      setTask("new-dialogue");
      setOpen(true);
    }
    function handleOpenDialogue(e: Event) {
      const detail = (e as CustomEvent).detail;
      setBookId(detail.bookId);
      setBookName(detail.bookName || "");
      setTask("open-dialogue");
      setOpen(true);
    }
    window.addEventListener("deepbook:new-story", handleNewStory);
    window.addEventListener("deepbook:open-dialogue", handleOpenDialogue);
    window.addEventListener("deepbook:new-dialogue", handleNewDialogue);
    return () => {
      window.removeEventListener("deepbook:new-story", handleNewStory);
      window.removeEventListener("deepbook:open-dialogue", handleOpenDialogue);
      window.removeEventListener("deepbook:new-dialogue", handleNewDialogue);
    };
  }, []);

  function handleClose() {
    setOpen(false);
    setTask(null);
  }

  function handleOpen() {
    setTask(null);
    const ab = (window as unknown as Record<string, unknown>).__activeBook as typeof activeBook | undefined;
    setActiveBook(ab || null);
    setOpen(true);
  }

  const clamp = (x: number, y: number, w: number, h: number): ChatPosition => ({
    x: Math.min(window.innerWidth - w - PADDING, Math.max(PADDING, x)),
    y: Math.min(window.innerHeight - h - PADDING, Math.max(PADDING, y)),
  });

  const onPointerDown = useCallback(
    (e: React.PointerEvent, target: "btn" | "panel") => {
      const ds = dragState.current;
      ds.active = true;
      ds.target = target;
      ds.startX = e.clientX;
      ds.startY = e.clientY;
      ds.startPosX = pos.x;
      ds.startPosY = pos.y;
      ds.moved = false;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [pos]
  );

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const ds = dragState.current;
    if (!ds.active) return;
    if (Math.abs(e.clientX - ds.startX) > DRAG_THRESHOLD || Math.abs(e.clientY - ds.startY) > DRAG_THRESHOLD) {
      ds.moved = true;
    }
  }, []);

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      const ds = dragState.current;
      if (!ds.active || !ds.target) return;
      ds.active = false;
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);

      if (ds.moved) {
        const w = ds.target === "btn" ? BTN_SIZE : PANEL_W;
        const h = ds.target === "btn" ? BTN_SIZE : PANEL_H;
        const newX = ds.startPosX >= 0 ? ds.startPosX + (e.clientX - ds.startX) : e.clientX - BTN_SIZE / 2;
        const newY = ds.startPosY >= 0 ? ds.startPosY + (e.clientY - ds.startY) : e.clientY - BTN_SIZE / 2;
        const clamped = clamp(newX, newY, w, h);
        setPos(clamped);
        saveChatPosition(clamped);
      }
      ds.target = null;
    },
    [clamp]
  );

  const usingDefault = pos.x < 0;

  const btnStyle: React.CSSProperties = usingDefault
    ? { position: "fixed" as const, bottom: PADDING, right: PADDING }
    : { position: "fixed" as const, left: pos.x, top: pos.y };

  // Compute panel position, clamped to viewport
  const panelStyle: React.CSSProperties = useMemo(() => {
    if (usingDefault) {
      // default: right-bottom corner, naturally safe
      return { position: "fixed" as const, bottom: PADDING, right: PADDING };
    }
    // dragged position: clamp panel so it doesn't overflow
    const clamped = clamp(pos.x, pos.y, PANEL_W, PANEL_H);
    return { position: "fixed" as const, left: clamped.x, top: clamped.y };
  }, [usingDefault, pos.x, pos.y, clamp]);

  const isTask = task === "create-story" || task === "open-dialogue" || task === "new-dialogue";

  return (
    <>
      {/* floating button */}
      {!open && (
        <button
          onPointerDown={(e) => onPointerDown(e, "btn")}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onClick={() => { if (!dragState.current.moved) handleOpen(); }}
          style={btnStyle}
          className="z-50 flex h-12 w-12 touch-none select-none items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg transition hover:bg-emerald-500 hover:shadow-xl active:scale-95"
          title="AI 助手（可拖动）"
        >
          <MessageCircle size={20} />
        </button>
      )}

      {/* chat panel */}
      {open && (
        <div
          style={{
            ...(isTask
              ? { position: "fixed" as const, left: "50%", top: "50%", transform: "translate(-50%, -50%)" }
              : panelStyle),
            width: isTask ? "90vw" : `${PANEL_W}px`,
            maxWidth: isTask ? "90vw" : `calc(100vw - ${PADDING * 2}px)`,
            height: isTask ? "90dvh" : `${PANEL_H}px`,
            maxHeight: isTask ? "90dvh" : `calc(100dvh - ${PADDING * 2}px)`,
          }}
          className="z-50 flex flex-col overflow-hidden rounded-xl bg-zinc-950 shadow-2xl ring-1 ring-white/10"
        >
          {/* header */}
          <div
            onPointerDown={(e) => onPointerDown(e, "panel")}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            className="flex h-10 cursor-grab touch-none select-none items-center justify-between border-b border-white/5 px-2 active:cursor-grabbing"
          >
            <div className="flex items-center gap-1 text-zinc-500">
              <GripHorizontal size={12} />
              <span className="text-xs font-medium text-zinc-400">
                {task === "create-story" ? "创建故事" : task === "open-dialogue" ? "开场白创建" : task === "new-dialogue" ? "新建对话" : "AI 助手"}
              </span>
            </div>
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={handleClose}
              className="rounded p-1 text-zinc-500 transition hover:text-zinc-300"
            >
              <X size={14} />
            </button>
          </div>

          {/* chat content */}
          <div className="flex-1 overflow-hidden">
            <ChatWindow
              key={task ?? "default"}
              task={task}
              bookId={bookId}
              bookName={bookName}
              activeBook={activeBook}
              onBookCreated={() => {
                const refresh = (window as unknown as Record<string, unknown>).__refreshBooks as (() => void) | undefined;
                refresh?.();
              }}
            />
          </div>
        </div>
      )}
    </>
  );
}
