"use client";

import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

type ToastType = "success" | "error" | "info";
export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastCtx {
  show: (message: string, type?: ToastType, opts?: { duration?: number }) => void;
}

const Ctx = createContext<ToastCtx | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const show = useCallback((message: string, type: ToastType = "info", opts: { duration?: number } = {}) => {
    const id = Math.random().toString(36).slice(2);
    const t: Toast = { id, type, message, duration: opts.duration ?? 3000 };
    setToasts((xs) => [...xs, t]);
    if (t.duration && t.duration > 0) {
      setTimeout(() => setToasts((xs) => xs.filter((x) => x.id !== id)), t.duration);
    }
  }, []);

  const value = useMemo(() => ({ show }), [show]);

  return (
    <Ctx.Provider value={value}>
      {children}
      {/* Toast container */}
      <div className="fixed inset-x-0 top-3 z-[9999] flex flex-col items-center gap-2 px-3">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="w-full max-w-md rounded-xl border px-3 py-2 text-sm shadow-xl"
            style={{
              background: t.type === "error" ? "#43121a" : t.type === "success" ? "#052e16" : "#0b0b0b",
              borderColor: t.type === "error" ? "#7f1d1d" : t.type === "success" ? "#14532d" : "#27272a",
              color: t.type === "error" ? "#fecaca" : t.type === "success" ? "#bbf7d0" : "#e5e7eb",
            }}
          >
            {t.message}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
