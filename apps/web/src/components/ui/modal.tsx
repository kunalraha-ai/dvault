"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Button } from "./primitives";

/** Accessible modal dialog with focus trapping and Escape handling. */
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  width = "max-w-lg",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // Latest onClose, without re-running the focus effect on every render —
  // re-running it stole focus from the input after each keystroke (typing
  // one character then having to click the box again).
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const prevFocus = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
      if (e.key === "Tab" && ref.current) {
        // simple focus trap
        const focusables = ref.current.querySelectorAll<HTMLElement>(
          "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])",
        );
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      prevFocus?.focus();
    };
    // deliberately only [open]: focus management must happen on open/close,
    // never on re-renders while the user is typing inside the dialog
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center p-4 sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <button aria-label="Close dialog" className="absolute inset-0 bg-ink-950/55 backdrop-blur-[2px] fade-in" onClick={onClose} tabIndex={-1} />
      <div
        ref={ref}
        tabIndex={-1}
        className={`relative z-10 w-full ${width} rounded-2xl border border-mist-200 bg-white shadow-lift outline-none rise-in`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-mist-200 px-5 py-4">
          <h2 className="font-display text-[15px] font-bold text-ink-900">{title}</h2>
          <button onClick={onClose} className="rounded-md p-1 text-slate-400 transition hover:bg-mist-100 hover:text-ink-700" aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-mist-200 px-5 py-4">{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  body,
  confirmLabel = "Confirm",
  danger,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  body: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  loading?: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      width="max-w-md"
      footer={
        <>
          <Button variant="ghost" size="md" onClick={onClose}>Cancel</Button>
          <Button
            size="md"
            loading={loading}
            className={danger ? "bg-red-600 hover:bg-red-500" : undefined}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-[13.5px] leading-relaxed text-slate-600">{body}</div>
    </Modal>
  );
}
