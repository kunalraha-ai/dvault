/**
 * CurveSeparator — the bell-curve language carried across section borders.
 *
 * The SVG's fill is the PREVIOUS section's color; the section it sits in shows
 * its own background beneath the curved edge, so one section flows into the
 * next along a Gaussian shoulder instead of a hard line.
 */
export function CurveSeparator({
  fill,
  height = 150,
  className = "",
}: {
  /** color of the section the curve flows OUT of */
  fill: string;
  height?: number;
  className?: string;
}) {
  return (
    <div
      aria-hidden
      className={`w-full overflow-hidden ${className}`}
      style={{ height }}
    >
      <svg
        viewBox="0 0 1600 150"
        preserveAspectRatio="none"
        className="block h-full w-full"
      >
        {/* top band + a downward bell-shoulder bulge */}
        <path
          d="M0,0 H1600 V52 C1216,152 384,152 0,52 Z"
          fill={fill}
        />
      </svg>
    </div>
  );
}
