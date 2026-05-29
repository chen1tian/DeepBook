"use client";

import { X, Clock, CalendarDays } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  date: string;
  time: string;
}

export default function TimePanel({ open, onClose, date, time }: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div
        className="flex h-full w-80 max-w-[90vw] flex-col bg-zinc-900 shadow-2xl ring-1 ring-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex h-11 shrink-0 items-center justify-between border-b border-white/5 px-3">
          <span className="text-xs font-medium text-zinc-400">日期时间</span>
          <button onClick={onClose} className="rounded p-1 text-zinc-500 hover:text-zinc-300">
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-1 items-center justify-center p-6">
          {date || time ? (
            <div className="space-y-6 text-center">
              {date && (
                <div>
                  <CalendarDays size={28} className="mx-auto mb-2 text-emerald-400" />
                  <p className="text-lg font-medium text-zinc-200">{date}</p>
                  <p className="text-[11px] text-zinc-500">当前日期</p>
                </div>
              )}
              {time && (
                <div>
                  <Clock size={28} className="mx-auto mb-2 text-emerald-400" />
                  <p className="text-lg font-medium text-zinc-200">{time}</p>
                  <p className="text-[11px] text-zinc-500">当前时间</p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-zinc-600">暂无时间数据</p>
          )}
        </div>
      </div>
    </div>
  );
}
