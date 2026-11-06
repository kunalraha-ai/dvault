"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

type ToastKind = "success" | "error" | "info";
interface Toast { id: number; kind: ToastKind; message: string }

const ToastCtx = createContext<{ toast: (kind: ToastKind, message: string) => void }>({
  toast: () => undefined,
});

export function useToast() {
  return useContext(ToastCtx);
}

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((kind: ToastKind, message: string) => {
    const id = nextId++;
    setToasts((t) => [...t, { id, kind, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  return (
    <ToastCtx.Provider value={{ toast }}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-5 left-1/2 z-[100] flex w-full max-w-md -translate-x-1/2 flex-col gap-2 px-4"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className="pointer-events-auto flex items-center gap-3 rounded-xl border border-mist-200 bg-white px-4 py-3 text-[13px] font-medium text-ink-900 shadow-lift rise-in"
          >
            {t.kind === "success" && <CheckCircle2 className="h-4.5 w-4.5 shrink-0 text-emerald-500" />}
            {t.kind === "error" && <AlertCircle className="h-4.5 w-4.5 shrink-0 text-red-500" />}
            {t.kind === "info" && <Info className="h-4.5 w-4.5 shrink-0 text-bright-500" />}
            <span className="flex-1">{t.message}</span>
            <button
              aria-label="Dismiss"
              className="text-slate-400 transition hover:text-ink-700"
              onClick={() => setToasts((x) => x.filter((x2) => x2.id !== t.id))}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
