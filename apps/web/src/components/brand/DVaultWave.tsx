/**
 * DVaultWave — D-Vault's signature visual.
 *
 * Two striped bell curves built from thin horizontal rounded stripes whose
 * lengths follow a Gaussian profile:
 *
 *   ████ a BLUE bell curve (electric blue → icy blue), long stripes at its
 *        waist, shrinking toward the edges
 *   ▂▂▂▂ a WHITE bell curve beneath it — a second, narrower Gaussian made of
 *        thin white stripes with varying opacity
 *
 * plus a very small amount of soft pink in a few individual stripes and
 * glow intersections. No blobs, no purple gradients. Geometry is computed
 * from a seeded PRNG so SSR and client renders match exactly.
 */

import { useId } from "react";

/**
 * Round computed geometry to a fixed precision.
 *
 * V8's transcendental functions (Math.exp/pow) can differ by 1 ULP between
 * Node (SSR) and the browser, which made the server-rendered SVG attributes
 * differ from the client by ~1e-13 — enough to fail React hydration
 * (error #418, freezing interactivity). Rounding to 4 decimals makes the
 * rendered values bit-identical on both sides.
 */
const R = (n: number, p = 4): number => Math.round(n * 10 ** p) / 10 ** p;

export type WaveVariant = "hero" | "panel" | "strip";

interface StripeSpec {
  x: number;
  y: number;
  w: number;
  h: number;
  fill: string;
  opacity: number;
  delay: number;
  glowDot?: boolean;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const BLUES_CORE = ["#2E6EFA", "#5291FF", "#2E6EFA"];
const BLUES_EDGE = "#B5CDFF";
const PINK = "#FA6EAB";

interface CurveConfig {
  cy: number;
  sigma: number;
  count: number;
  pitch: number;
  height: number;
  maxW: number;
  baseOpacity: number;
  opacitySpan: number;
}

function buildCurve(
  cfg: CurveConfig,
  rand: () => number,
  opts: {
    colors: string[];
    edgeColor?: string;
    white?: boolean;
    pinkIndices?: number[];
  },
): StripeSpec[] {
  const stripes: StripeSpec[] = [];
  const half = ((cfg.count - 1) / 2) * cfg.pitch;
  for (let i = 0; i < cfg.count; i++) {
    const y = cfg.cy - half + i * cfg.pitch;
    const dy = y - cfg.cy;
    // Gaussian envelope: stripe width traces the bell curve exactly.
    const g = Math.exp(-(dy * dy) / (2 * cfg.sigma * cfg.sigma));
    const w = cfg.maxW * g * (0.97 + rand() * 0.06);
    // jitter scaled to width so thin edge stripes stay centered
    const jitter = (rand() - 0.5) * Math.min(10, w * 0.05);
    const isPink = opts.pinkIndices?.includes(i);
    let fill: string;
    if (isPink) fill = PINK;
    else if (opts.white) fill = "#FFFFFF";
    else if (g < 0.32 && opts.edgeColor) fill = opts.edgeColor;
    else fill = opts.colors[i % opts.colors.length];
    const opacity = Math.min(
      1,
      (opts.white ? 0.9 : cfg.baseOpacity) *
        (0.18 + 0.85 * g) *
        (isPink ? 0.62 : 1),
    );
    stripes.push({
      x: R(600 - w / 2 + jitter),
      y,
      w: R(Math.max(3, w)),
      h: cfg.height,
      fill,
      opacity: R(opacity),
      delay: R(-rand() * 7),
      glowDot: isPink && g > 0.75,
    });
  }
  return stripes;
}

export interface DVaultWaveProps {
  variant?: WaveVariant;
  /** subtle breathing + shimmer animation */
  animated?: boolean;
  className?: string;
  /** show the smooth gradient backdrop (disable to layer on a custom bg) */
  background?: boolean;
  /** preserveAspectRatio="slice": crop to fill the container (background use) */
  fill?: boolean;
  /** decorative everywhere it is used */
  "aria-hidden"?: boolean;
}

const VARIANTS: Record<WaveVariant, {
  w: number; h: number; blue: CurveConfig; white: CurveConfig; shimmer: boolean;
}> = {
  // σ is small relative to the stripe extent so the envelope tapers to a
  // whisper at the edges — a true bell silhouette: longest stripes at the
  // waist, near-zero at the ends.
  hero: {
    w: 1200, h: 520,
    blue: { cy: 190, sigma: 78, count: 41, pitch: 9.4, height: 3.4, maxW: 940, baseOpacity: 1, opacitySpan: 0.6 },
    white: { cy: 352, sigma: 38, count: 23, pitch: 8.2, height: 2.5, maxW: 560, baseOpacity: 1, opacitySpan: 0.5 },
    shimmer: true,
  },
  panel: {
    w: 960, h: 420,
    blue: { cy: 158, sigma: 62, count: 35, pitch: 8.6, height: 3.1, maxW: 760, baseOpacity: 1, opacitySpan: 0.6 },
    white: { cy: 288, sigma: 32, count: 21, pitch: 7.6, height: 2.4, maxW: 440, baseOpacity: 1, opacitySpan: 0.5 },
    shimmer: true,
  },
  strip: {
    w: 1200, h: 320,
    blue: { cy: 118, sigma: 48, count: 27, pitch: 8.6, height: 3.1, maxW: 860, baseOpacity: 1, opacitySpan: 0.6 },
    white: { cy: 218, sigma: 30, count: 19, pitch: 7.4, height: 2.4, maxW: 480, baseOpacity: 1, opacitySpan: 0.5 },
    shimmer: false,
  },
};

export function DVaultWave({
  variant = "hero",
  animated = true,
  className = "",
  background = true,
  fill = false,
  ...rest
}: DVaultWaveProps) {
  const uid = useId().replace(/[:]/g, "");
  const cfg = VARIANTS[variant];

  // Seeded PRNG → deterministic SSR/client geometry.
  const rand = mulberry32(variant === "hero" ? 42 : variant === "panel" ? 7 : 99);
  const blue = buildCurve(cfg.blue, rand, {
    colors: BLUES_CORE,
    edgeColor: BLUES_EDGE,
    pinkIndices: variant === "hero" ? [15, 25] : [9, 13],
  });
  const white = buildCurve(cfg.white, rand, {
    colors: ["#FFFFFF"],
    white: true,
    pinkIndices: variant === "hero" ? [11] : [8],
  });

  const gid = (s: string) => `${s}-${uid}`;

  return (
    <svg
      viewBox={`0 0 ${cfg.w} ${cfg.h}`}
      className={`block h-auto w-full select-none ${className}`}
      preserveAspectRatio={fill ? "xMidYMid slice" : "xMidYMid meet"}
      role="img"
      aria-label="D-Vault"
      {...rest}
    >
      <defs>
        <linearGradient id={gid("bg")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#060B1B" />
          <stop offset="0.45" stopColor="#091025" />
          <stop offset="1" stopColor="#0A1229" />
        </linearGradient>
        <radialGradient id={gid("blueglow")} cx="0.5" cy="0.38" r="0.5">
          <stop offset="0" stopColor="#2E6EFA" stopOpacity="0.16" />
          <stop offset="0.55" stopColor="#2E6EFA" stopOpacity="0.05" />
          <stop offset="1" stopColor="#2563EB" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={gid("pinkglow")} cx="0.5" cy="0.62" r="0.42">
          <stop offset="0" stopColor="#FA6EAB" stopOpacity="0.07" />
          <stop offset="1" stopColor="#F4A6C8" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={gid("shimmer")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0" />
          <stop offset="0.5" stopColor="#FFFFFF" stopOpacity="0.05" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>
        <filter id={gid("blur")} x="-20%" y="-40%" width="140%" height="180%">
          <feGaussianBlur stdDeviation="9" />
        </filter>
        <filter id={gid("dotglow")} x="-150%" y="-150%" width="400%" height="400%">
          <feGaussianBlur stdDeviation="2.4" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {background && (
        <>
          <rect x="0" y="0" width={cfg.w} height={cfg.h} fill={`url(#${gid("bg")})`} rx={variant === "panel" ? 0 : 0} />
          <rect x="0" y="0" width={cfg.w} height={cfg.h} fill={`url(#${gid("blueglow")})`} />
          <rect x="0" y="0" width={cfg.w} height={cfg.h} fill={`url(#${gid("pinkglow")})`} />
        </>
      )}

      {/* soft glow bed beneath the blue curve */}
      <g filter={`url(#${gid("blur")})`} opacity="0.34">
        {blue.map((s, i) => (
          <rect key={`g${i}`} x={s.x} y={s.y} width={s.w} height={s.h} rx={s.h / 2} fill={s.fill} opacity={s.opacity * 0.6} />
        ))}
      </g>

      {/* the blue bell curve */}
      <g>
        {blue.map((s, i) => (
          <rect
            key={`b${i}`}
            className={animated ? "wave-stripe" : undefined}
            style={animated ? { animationDelay: `${s.delay}s` } : undefined}
            x={s.x}
            y={s.y}
            width={s.w}
            height={s.h}
            rx={s.h / 2}
            fill={s.fill}
            opacity={s.opacity}
          />
        ))}
      </g>

      {/* pink accent dots at glowing intersections */}
      {blue
        .filter((s) => s.glowDot)
        .map((s, i) => (
          <g key={`p${i}`} filter={`url(#${gid("dotglow")})`}>
            <circle cx={s.x + s.w * 0.5} cy={s.y + s.h / 2} r="2.1" fill={PINK} opacity="0.85" />
          </g>
        ))}

      {/* the white bell curve beneath */}
      <g>
        {white.map((s, i) => (
          <rect
            key={`w${i}`}
            className={animated ? "wave-stripe" : undefined}
            style={animated ? { animationDelay: `${s.delay + 1.7}s` } : undefined}
            x={s.x}
            y={s.y}
            width={s.w}
            height={s.h}
            rx={s.h / 2}
            fill={s.fill}
            opacity={s.opacity}
          />
        ))}
      </g>

      {/* a single restrained light wash */}
      {animated && cfg.shimmer && (
        <rect
          className="wave-shimmer-bar"
          x="0"
          y="0"
          width={cfg.w}
          height="72"
          fill={`url(#${gid("shimmer")})`}
        />
      )}
    </svg>
  );
}
