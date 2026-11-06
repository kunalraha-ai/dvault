/**
 * DBadge — the D-Vault "D" mark: a midnight disc with a mini striped
 * bell-curve and the letter D, plus a whisper of pink. Palette matches the
 * landing design (#060B1B / #2E6EFA / #5291FF / #F0F5FF / #FA6EAB).
 */

export function DBadge({ size = 40, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={`shrink-0 ${className}`}
      role="img"
      aria-label="D-Vault logo"
    >
      <defs>
        <filter id="db-glow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="1.6" />
        </filter>
      </defs>
      <circle cx="32" cy="32" r="30" fill="#091025" stroke="rgba(64,92,148,0.5)" strokeWidth="1.2" />

      {/* mini striped bell curve */}
      <g filter="url(#db-glow)" opacity="0.9">
        <rect x="17" y="40" width="30" height="1.8" rx="0.9" fill="#2E6EFA" />
        <rect x="20" y="42.8" width="24" height="1.8" rx="0.9" fill="#5291FF" opacity="0.85" />
        <rect x="24" y="45.6" width="16" height="1.8" rx="0.9" fill="#5291FF" opacity="0.7" />
        <rect x="28" y="48.4" width="8" height="1.8" rx="0.9" fill="#5291FF" opacity="0.55" />
      </g>
      <rect x="26" y="39" width="12" height="1.6" rx="0.8" fill="#F0F5FF" opacity="0.9" />
      <rect x="44.5" y="40.8" width="1.4" height="1.4" fill="#FA6EAB" />

      {/* the D */}
      <text
        x="32"
        y="38"
        textAnchor="middle"
        fontFamily="var(--font-display), sans-serif"
        fontWeight="800"
        fontSize="30"
        fill="#F0F5FF"
      >
        D
      </text>
    </svg>
  );
}

export function DVaultLogo({ className = "", textClass = "" }: { className?: string; textClass?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <DBadge size={34} />
      <span className={`font-display text-[17px] font-extrabold tracking-tight text-white ${textClass}`}>
        D-VAULT
      </span>
    </span>
  );
}
