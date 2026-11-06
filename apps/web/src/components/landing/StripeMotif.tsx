/**
 * StripeMotif — a miniature of the signature striped bell curve, used as a
 * recurring graphical element inside the landing story sections. Same
 * Gaussian math as GiantBellCurve, at editorial scale.
 */

const BLUES = ["#2563EB", "#3B82F6", "#60A5FA"];
const ICY = "#93C5FD";
const PINK = "#F4A6C8";

/** Round geometry so SSR and client render bit-identical SVG (hydration-safe). */
const R = (n: number, p = 4): number => Math.round(n * 10 ** p) / 10 ** p;

export function StripeMotif({
  className = "",
  white = false,
  pinkIndex = 21,
  count = 32,
  sigma = 22,
  maxW = 230,
  height = 96,
  width = 250,
  seed = 11,
  animated = true,
}: {
  className?: string;
  white?: boolean;
  pinkIndex?: number;
  count?: number;
  sigma?: number;
  maxW?: number;
  height?: number;
  width?: number;
  seed?: number;
  animated?: boolean;
}) {
  const rand = (() => {
    let a = seed >>> 0;
    return () => {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  })();

  const cy = height / 2;
  const pitch = height / count;
  const stripes = [];
  for (let i = 0; i < count; i++) {
    const y = i * pitch;
    const dy = y + pitch / 2 - cy;
    const g = Math.exp(-((dy * dy) / (2 * sigma * sigma)));
    const isPink = i === pinkIndex;
    const w = maxW * g * (0.96 + rand() * 0.08) * (isPink ? 0.84 : 1);
    const jitter = (rand() - 0.5) * Math.min(4, w * 0.04);
    const fill = isPink ? PINK : white ? "#FFFFFF" : g < 0.22 ? ICY : BLUES[i % 3];
    const opacity =
      (white ? 0.12 + 0.68 * g : 0.3 + 0.65 * g) * (isPink ? 0.6 : 1);
    stripes.push(
      <rect
        key={i}
        className={animated ? "dv-stripe" : undefined}
        style={
          animated
            ? ({ "--o": R(Math.min(1, opacity)), animationDelay: `${R(-rand() * 9, 3)}s` } as React.CSSProperties)
            : undefined
        }
        x={R(width / 2 - w / 2 + jitter)}
        y={y}
        width={R(Math.max(1, w))}
        height={Math.max(1, pitch * 0.62)}
        rx={Math.max(0.5, pitch * 0.31)}
        fill={fill}
        opacity={R(Math.min(1, opacity))}
      />,
    );
  }

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={`block h-auto w-full select-none ${className}`}
      role="img"
      aria-hidden
    >
      {stripes}
    </svg>
  );
}

/**
 * FlowLine — a thin bell-shaped stroke that rises and falls between sections,
 * continuing the curve as a structural motif. flip mirrors it vertically.
 */
export function FlowLine({
  flip = false,
  className = "",
  animated = true,
}: {
  flip?: boolean;
  className?: string;
  animated?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 1600 120"
      preserveAspectRatio="none"
      aria-hidden
      className={`block h-14 w-full select-none sm:h-20 ${className}`}
    >
      <defs>
        <linearGradient id={`fl-${flip ? "b" : "a"}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#2563EB" stopOpacity="0" />
          <stop offset="0.28" stopColor="#3B82F6" stopOpacity="0.85" />
          <stop offset="0.5" stopColor="#93C5FD" stopOpacity="1" />
          <stop offset="0.72" stopColor="#3B82F6" stopOpacity="0.85" />
          <stop offset="1" stopColor="#2563EB" stopOpacity="0" />
        </linearGradient>
      </defs>
      <g
        className={animated ? (flip ? "dv-drift-b" : "dv-drift-a") : undefined}
        transform={flip ? "translate(0,120) scale(1,-1)" : undefined}
      >
        <path
          d="M0,104 C400,104 620,18 800,18 C980,18 1200,104 1600,104"
          fill="none"
          stroke={`url(#fl-${flip ? "b" : "a"})`}
          strokeWidth="1.4"
          strokeLinecap="round"
          opacity="0.5"
        />
      </g>
    </svg>
  );
}
