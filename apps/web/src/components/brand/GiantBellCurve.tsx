/**
 * GiantBellCurve — D-Vault's defining artwork, rebuilt to the exact
 * construction of the provided landing-page design (Desktop.svg):
 *
 *  HERO (1440×1120)
 *   · a faint #5291FF echo layer  — h=1,  31 stripes, Gaussian σ=104, W=1260
 *   · a dense #2E6EFA core layer  — h=3,  21 stripes, Gaussian σ=104, W=1350
 *   · a white halo beneath        — h=3,   9 stripes, Gaussian σ= 82, W=1120
 *   · a bright white core beneath — h=3,   9 stripes, Gaussian σ= 82, W=1120
 *   · three tiny pink squares at the design's exact positions
 *   · stripe widths follow  w(y) = W·exp(−(y−cy)²/2σ²)  (σ from the design)
 *   · opacity falls off LINEARLY from the center (design's falloff)
 *
 *  FINALE (1440×700)
 *   · a right-anchored blue bell  (cx=1040, σ=72, W=650, 21 stripes)
 *   · a white bell beneath it     (cx=1040, σ=58, W=520, 17 stripes)
 *
 * Geometry is deterministic (no jitter — the design is perfectly symmetric),
 * rendered with preserveAspectRatio="slice" so the field fills any viewport.
 * Animations: gentle drift, breathing and per-stripe brightness waves
 * (CSS only, disabled under prefers-reduced-motion).
 */

import { useId } from "react";

/**
 * Round computed geometry so the server-rendered SVG is bit-identical to the
 * client (V8's Math.exp can differ by 1 ULP between Node and the browser —
 * enough to fail React hydration, which froze page interactivity).
 */
const R = (n: number, p = 4): number => Math.round(n * 10 ** p) / 10 ** p;

export type GiantCurveVariant = "hero" | "finale";

const BLUE = "#2E6EFA";
const ECHO = "#5291FF";
const WHITE = "#F0F5FF";
const PINK = "#FA6EAB";

interface LayerSpec {
  color: string;
  cx: number;
  cy: number;
  sigma: number;
  maxW: number;
  /** first stripe y */
  y0: number;
  count: number;
  pitch: number;
  height: number;
  /** opacity at center / at the outermost stripe (linear falloff) */
  opMax: number;
  opMin: number;
}

const VARIANTS: Record<
  GiantCurveVariant,
  { viewBox: string; overlay?: boolean; layers: LayerSpec[]; dots: { x: number; y: number; s: number; op: number }[] }
> = {
  hero: {
    viewBox: "0 0 1440 1120",
    overlay: true,
    layers: [
      // faint wide echo of the blue bell
      { color: ECHO, cx: 720, cy: 620, sigma: 104, maxW: 1260, y0: 500, count: 31, pitch: 8, height: 1, opMax: 0.28, opMin: 0.204 },
      // dense blue core
      { color: BLUE, cx: 720, cy: 620, sigma: 104, maxW: 1350, y0: 540, count: 21, pitch: 8, height: 3, opMax: 0.96, opMin: 0.787 },
      // white halo beneath
      { color: WHITE, cx: 720, cy: 865, sigma: 82, maxW: 1120, y0: 769, count: 9, pitch: 24, height: 3, opMax: 0.94, opMin: 0.687 },
      // bright white core beneath
      { color: WHITE, cx: 720, cy: 865, sigma: 82, maxW: 1120, y0: 833, count: 9, pitch: 8, height: 3, opMax: 0.94, opMin: 0.856 },
    ],
    dots: [
      { x: 678, y: 195, s: 7, op: 1 },
      { x: 274, y: 704, s: 5, op: 0.9 },
      { x: 1160, y: 772, s: 4, op: 0.75 },
    ],
  },
  finale: {
    viewBox: "0 0 1440 700",
    layers: [
      { color: BLUE, cx: 1040, cy: 380, sigma: 72, maxW: 650, y0: 300, count: 21, pitch: 8, height: 3, opMax: 0.86, opMin: 0.631 },
      { color: WHITE, cx: 1040, cy: 545, sigma: 58, maxW: 520, y0: 481, count: 17, pitch: 8, height: 3, opMax: 0.9, opMin: 0.663 },
    ],
    dots: [{ x: 1320, y: 495, s: 5, op: 1 }],
  },
};

interface Stripe {
  x: number;
  y: number;
  w: number;
  h: number;
  fill: string;
  opacity: number;
}

/** Build one striped Gaussian layer exactly as the design does. */
function buildLayer(spec: LayerSpec): Stripe[] {
  const half = spec.pitch * (spec.count - 1) / 2;
  const out: Stripe[] = [];
  for (let i = 0; i < spec.count; i++) {
    const y = spec.y0 + i * spec.pitch;
    const dy = y - spec.cy;
    const g = Math.exp(-((dy * dy) / (2 * spec.sigma * spec.sigma)));
    const w = spec.maxW * g;
    // linear opacity falloff from the center stripe to the outermost stripe
    const t = half === 0 ? 0 : Math.abs(dy) / half;
    const opacity = spec.opMax - (spec.opMax - spec.opMin) * t;
    out.push({
      x: R(spec.cx - w / 2),
      y,
      w: R(w),
      h: spec.height,
      fill: spec.color,
      opacity: R(opacity),
    });
  }
  return out;
}

export interface GiantBellCurveProps {
  variant?: GiantCurveVariant;
  /** drift / shimmer / breathing animations (CSS-only, reduced-motion safe) */
  animated?: boolean;
  className?: string;
}

export function GiantBellCurve({
  variant = "hero",
  animated = true,
  className = "",
}: GiantBellCurveProps) {
  const uid = useId().replace(/:/g, "");
  const gid = (s: string) => `${s}-${uid}`;
  const spec = VARIANTS[variant];
  const layers = spec.layers.map(buildLayer);

  const stripeClass = animated ? "dv-stripe" : undefined;
  const stripeStyle = (s: Stripe): React.CSSProperties | undefined =>
    animated
      ? ({ "--o": s.opacity, animationDelay: `${R(-(s.y % 97) / 10 - s.x / 300, 3)}s` } as React.CSSProperties)
      : undefined;

  return (
    <svg
      viewBox={spec.viewBox}
      preserveAspectRatio="xMidYMid slice"
      className={`absolute inset-0 h-full w-full select-none ${className}`}
      role="img"
      aria-label="D-Vault — striped bell curve artwork"
    >
      <defs>
        {/* soft ambient glow behind the field (restrained, no blur on stripes) */}
        <radialGradient id={gid("glow")} cx="0.5" cy="0.5" r="0.6">
          <stop offset="0" stopColor={BLUE} stopOpacity="0.12" />
          <stop offset="0.6" stopColor={BLUE} stopOpacity="0.04" />
          <stop offset="1" stopColor={BLUE} stopOpacity="0" />
        </radialGradient>
        <filter id={gid("dotglow")} x="-300%" y="-300%" width="700%" height="700%">
          <feGaussianBlur stdDeviation="2.6" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* midnight base + the design's top overlay */}
      <rect x="0" y="0" width="1440" height={variant === "hero" ? 1120 : 700} fill="#060B1B" />
      {spec.overlay && (
        <rect x="0" y="0" width="1440" height="1120" fill="#091025" fillOpacity="0.65" />
      )}
      <rect x="0" y="0" width="1440" height={variant === "hero" ? 1120 : 700} fill={`url(#${gid("glow")})`} />

      {/* the striped Gaussian layers */}
      {layers.map((stripes, li) => (
        <g key={li} className={animated ? (li % 2 === 0 ? "dv-drift-a" : "dv-drift-b") : undefined}>
          <g className={animated ? "dv-breathe" : undefined}>
            {stripes.map((s, i) => (
              <rect
                key={i}
                className={stripeClass}
                style={stripeStyle(s)}
                x={s.x}
                y={s.y}
                width={s.w}
                height={s.h}
                fill={s.fill}
                opacity={s.opacity}
              />
            ))}
          </g>
        </g>
      ))}

      {/* tiny pink accents at the design's positions */}
      <g filter={`url(#${gid("dotglow")})`}>
        {spec.dots.map((d, i) => (
          <rect key={i} x={d.x} y={d.y} width={d.s} height={d.s} fill={PINK} opacity={d.op} />
        ))}
      </g>
    </svg>
  );
}
