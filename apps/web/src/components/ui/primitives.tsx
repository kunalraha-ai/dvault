"use client";

import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type TextareaHTMLAttributes, type SelectHTMLAttributes, type ReactNode } from "react";
import clsx from "clsx";
import { Loader2 } from "lucide-react";

// ---------------------------------------------------------------- Button

type Variant = "primary" | "secondary" | "ghost" | "dark" | "danger" | "outline-dark";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
}

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-electric-600 text-white hover:bg-bright-500 active:scale-[0.98] shadow-[0_8px_20px_-8px_rgba(46,110,250,0.55)]",
  // clearly-visible white button with dark text — used on both light and dark
  // surfaces; never fades into the background
  secondary:
    "bg-white text-ink-900 border border-mist-300 shadow-soft hover:border-ice-300 hover:bg-mist-50 active:scale-[0.98]",
  ghost: "bg-transparent text-ink-700 hover:bg-mist-100 hover:text-ink-900",
  dark: "bg-ink-900 text-ice-200 hover:bg-ink-800 border border-white/10 active:scale-[0.98]",
  danger: "bg-red-600 text-white hover:bg-red-500 active:scale-[0.98]",
  // "on-dark" CTA: SOLID WHITE with dark text (was a faded outline —
  // buttons must never mix into the artwork behind them)
  "outline-dark": "bg-white text-ink-900 border border-white shadow-lift hover:bg-ice-200 active:scale-[0.98]",
};

const SIZES: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px] gap-1.5 rounded-lg",
  md: "h-10 px-4 text-sm gap-2 rounded-xl",
  lg: "h-12 px-6 text-[15px] gap-2 rounded-xl",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading, icon, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={clsx(
        "inline-flex select-none items-center justify-center font-medium transition-all duration-200",
        "disabled:pointer-events-none disabled:opacity-50",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
});

// ---------------------------------------------------------------- Input

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string | null;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, className, id, ...rest },
  ref,
) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={inputId} className="block text-[13px] font-medium text-ink-700">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        aria-invalid={!!error}
        className={clsx(
          "h-10 w-full rounded-xl border bg-white px-3.5 text-[14px] text-ink-900 transition-colors",
          "placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-bright-500/40",
          error ? "border-red-300" : "border-mist-200 hover:border-ice-300",
          className,
        )}
        {...rest}
      />
      {hint && !error && <p className="text-xs text-slate-500">{hint}</p>}
      {error && <p className="text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string }>(
  function Textarea({ label, className, id, ...rest }, ref) {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
    return (
      <div className="space-y-1.5">
        {label && (
          <label htmlFor={inputId} className="block text-[13px] font-medium text-ink-700">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={inputId}
          className={clsx(
            "w-full rounded-xl border border-mist-200 bg-white px-3.5 py-2.5 text-[14px] text-ink-900",
            "placeholder:text-slate-400 transition-colors focus:outline-none focus:ring-2 focus:ring-bright-500/40",
            className,
          )}
          {...rest}
        />
      </div>
    );
  },
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & { label?: string }>(
  function Select({ label, className, id, children, ...rest }, ref) {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
    return (
      <div className="space-y-1.5">
        {label && (
          <label htmlFor={inputId} className="block text-[13px] font-medium text-ink-700">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={inputId}
          className={clsx(
            "h-10 w-full appearance-none rounded-xl border border-mist-200 bg-white bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%228%22%3E%3Cpath%20d%3D%22M1%201l5%205%205-5%22%20stroke%3D%22%2364748b%22%20stroke-width%3D%222%22%20fill%3D%22none%22%20stroke-linecap%3D%22round%22%2F%3E%3C%2Fsvg%3E')] bg-[position:right_12px_center] bg-no-repeat px-3.5 pr-9 text-[14px] text-ink-900",
            "transition-colors focus:outline-none focus:ring-2 focus:ring-bright-500/40",
            className,
          )}
          {...rest}
        >
          {children}
        </select>
      </div>
    );
  },
);

// ---------------------------------------------------------------- Card

export function Card({ className, children, ...rest }: { className?: string; children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx("rounded-2xl border border-mist-200 bg-white shadow-soft", className)}
      {...rest}
    >
      {children}
    </div>
  );
}

export function SectionCard({ title, description, action, children, className = "" }: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-mist-200 px-5 py-4">
        <div>
          <h2 className="font-display text-[15px] font-bold text-ink-900">{title}</h2>
          {description && <p className="mt-0.5 text-[13px] text-slate-500">{description}</p>}
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </Card>
  );
}

// ---------------------------------------------------------------- Badges

type BadgeTone = "blue" | "green" | "amber" | "red" | "gray" | "pink" | "dark";
const TONES: Record<BadgeTone, string> = {
  blue: "bg-electric-600/10 text-electric-600 border-electric-600/20",
  green: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  amber: "bg-amber-500/10 text-amber-600 border-amber-500/25",
  red: "bg-red-500/10 text-red-600 border-red-500/20",
  gray: "bg-mist-100 text-slate-500 border-mist-200",
  pink: "bg-blush-300/15 text-blush-400 border-blush-300/30",
  dark: "bg-white/8 text-ice-300 border-white/12",
};

export function Badge({ tone = "gray", className, children }: { tone?: BadgeTone; className?: string; children: ReactNode }) {
  return (
    <span className={clsx("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold", TONES[tone], className)}>
      {children}
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-mist-100 ${className ?? ""}`} />;
}

export function EmptyState({ icon, title, description, action }: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-mist-300 bg-mist-50/60 px-6 py-12 text-center">
      {icon && <div className="text-slate-400">{icon}</div>}
      <h3 className="font-display text-[15px] font-bold text-ink-900">{title}</h3>
      {description && <p className="max-w-sm text-[13px] leading-relaxed text-slate-500">{description}</p>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
