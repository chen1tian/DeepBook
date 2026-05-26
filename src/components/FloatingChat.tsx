"use client";

import { useState, useRef, useCallback, useEffect } from "react";
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

  // listen for task events from the page
  useEffect(() => {
    function handleNewStory() {
      setTask("create-story");
      setOpen(true);
    }
    window.addEventListener("deepbook:new-story", handleNewStory);
    return () => window.removeEventListener("deepbook:new-story", handleNewStory);
  }, []);

  // reset task when closed
  function handleClose() {
    setOpen(false);
    setTask(null);
  }

  function handleOpen() {
    setTask(null); // plain chat
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

  const panelStyle: React.CSSProperties = usingDefault
    ? { position: "fixed" as const, bottom: PADDING, right: PADDING }
    : { position: "fixed" as const, left: pos.x, top: pos.y };

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

      {/* chat panel — large for tasks, small for casual chat */}
      {open && (() => {
        const isTask = task === "create-story";
        const panelW = isTask ? "66.67vw" : `${PANEL_W}px`;
        const panelH = isTask ? "80dvh" : `${PANEL_H}px`;
        const posOverride: React.CSSProperties = isTask
          ? { position: "fixed" as const, left: "50%", top: "50%", transform: "translate(-50%, -50%)" }
          : panelStyle;

        return (
        <div
          style={{
            ...posOverride,
            width: panelW,
            maxWidth: `calc(100vw - ${PADDING * 2}px)`,
            height: panelH,
            maxHeight: `calc(100dvh - ${PADDING * 2}px)`,
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
                {task === "create-story" ? "创建故事" : "AI 助手"}
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
              onBookCreated={() => {
                // refresh homepage book list
                const refresh = (window as unknown as Record<string, unknown>).__refreshBooks as (() => void) | undefined;
                refresh?.();
              }}
            />
          </div>
        </div>
        );
      })()}
    </>
  );
}
