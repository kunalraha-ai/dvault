"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * ParallaxLayer — very subtle scroll parallax for the curve fields.
 * rAF-throttled, transform-only (compositor friendly), disabled under
 * prefers-reduced-motion.
 */
export function ParallaxLayer({
  speed = 0.16,
  className = "",
  children,
}: {
  /** fraction of scrollY the layer shifts by (positive = drifts down) */
  speed?: number;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const apply = () => {
      if (ref.current) {
        ref.current.style.transform = `translate3d(0, ${window.scrollY * speed}px, 0)`;
      }
    };
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(apply);
    };
    apply();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [speed]);

  return (
    <div ref={ref} className={className} aria-hidden>
      {children}
    </div>
  );
}
