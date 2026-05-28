"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { MessageCircle, X, GripHorizontal } from "lucide-react";
import ChatWindow from "./ChatWindow";
import { getChatPosition, saveChatPosition, getActivePersonaId, type ChatPosition } from "@/lib/storage";

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
  const [bookContext, setBookContext] = useState<{ genre: string; style: string } | null>(null);
  const [activeBook, setActiveBook] = useState<{ id: number; name: string; genre: string; style: string } | null>(null);
  const [persona, setPersona] = useState<{ name: string; avatar: string; tone: string; addressUser: string; style: string; catchphrase: string } | null>(null);

  // load active persona
  useEffect(() => {
    async function load() {
      const id = getActivePersonaId();
      if (id) {
        try {
          const res = await fetch(`/api/personas`);
          const data = await res.json();
          const p = (data.personas || []).find((x: { id: string }) => x.id === id);
          if (p) setPersona(p);
        } catch {}
      }
    }
    load();
    function onChanged(e: Event) {
      const p = (e as CustomEvent).detail;
      setPersona(p);
    }
    window.addEventListener("deepbook:persona-changed", onChanged);
    return () => window.removeEventListener("deepbook:persona-changed", onChanged);
  }, []);

  // re-clamp position on window resize so button doesn't go off-screen
  useEffect(() => {
    function onResize() {
      setPos((prev) => {
        if (prev.x < 0) return prev; // using default, no need to clamp
        const clamped = clamp(prev.x, prev.y, BTN_SIZE, BTN_SIZE);
        if (clamped.x !== prev.x || clamped.y !== prev.y) {
          saveChatPosition(clamped);
          return clamped;
        }
        return prev;
      });
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // listen for task events from the page
  useEffect(() => {
    function handleNewStory() {
      setBookId(null);
      setBookName("");
      setTask("create-story");
      setOpen(true);
    }
    function handleEditPersona(e: Event) {
      const detail = (e as CustomEvent).detail;
      setBookId(null);
      setBookName(detail.name || "");
      (window as unknown as Record<string, unknown>).__editingPersona = detail;
      setTask("edit-persona");
      setOpen(true);
    }
    function handleEditPreset(e: Event) {
      const detail = (e as CustomEvent).detail;
      // Store preset context for the AI
      setBookId(null);
      setBookName(detail.name || "");
      (window as unknown as Record<string, unknown>).__editingPreset = detail;
      setTask("edit-preset");
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
      setBookContext(detail.bookGenre ? { genre: detail.bookGenre, style: detail.bookStyle || "" } : null);
      setTask("open-dialogue");
      setOpen(true);
    }
    window.addEventListener("deepbook:new-story", handleNewStory);
    window.addEventListener("deepbook:open-dialogue", handleOpenDialogue);
    window.addEventListener("deepbook:new-dialogue", handleNewDialogue);
    window.addEventListener("deepbook:edit-preset", handleEditPreset);
    window.addEventListener("deepbook:edit-persona", handleEditPersona);
    return () => {
      window.removeEventListener("deepbook:new-story", handleNewStory);
      window.removeEventListener("deepbook:open-dialogue", handleOpenDialogue);
      window.removeEventListener("deepbook:new-dialogue", handleNewDialogue);
      window.removeEventListener("deepbook:edit-preset", handleEditPreset);
      window.removeEventListener("deepbook:edit-persona", handleEditPersona);
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

  const isTask = task === "create-story" || task === "open-dialogue" || task === "new-dialogue" || task === "edit-preset" || task === "edit-persona";

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
          title={persona?.name || "AI 助手（可拖动）"}
        >
          {persona ? (
            <span className="text-xl">{persona.avatar}</span>
          ) : (
            <MessageCircle size={20} />
          )}
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
          className="z-50 flex flex-col overflow-hidden rounded-xl bg-zinc-950 shadow-2xl ring-1 ring-blue-400/40 shadow-blue-400/10"
        >
          {/* header */}
          <div
            onPointerDown={(e) => onPointerDown(e, "panel")}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            className="flex h-10 cursor-grab touch-none select-none items-center justify-between border-b border-blue-400/20 px-2 active:cursor-grabbing"
          >
            <div className="flex items-center gap-1 text-blue-400/60">
              <GripHorizontal size={12} />
              <span className="text-xs font-medium text-blue-300/80">
                {task === "create-story" ? "创建故事" : task === "open-dialogue" ? "开场白创建" : task === "new-dialogue" ? "新建对话" : task === "edit-preset" ? "编辑预设" : task === "edit-persona" ? "编辑人格" : persona?.name || "AI 助手"}
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
              bookContext={bookContext}
              activeBook={activeBook}
              persona={persona}
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
