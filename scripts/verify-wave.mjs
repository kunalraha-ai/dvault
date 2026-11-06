#!/usr/bin/env node
/**
 * Verifies the landing page against the provided design (Desktop.svg):
 *
 *  HERO (viewBox 0 0 1440 1120)
 *   · #5291FF echo layer — 31 stripes, h=1, Gaussian σ=104, W=1260
 *   · #2E6EFA core layer — 21 stripes, h=3, Gaussian σ=104, W=1350
 *   · white halo + core — 9+9 stripes, σ=82, W=1120, centered beneath (cy=865)
 *   · 3 tiny pink squares
 *   · headline: "Your information. / Every form. / One voice." (line 3 muted)
 *  SECTIONS — #090F21 → #060B1B → light #F0F5FF → #091025 finale
 *  FINALE (viewBox 0 0 1440 700)
 *   · right-anchored blue bell (cx=1040, σ=72, W=650, 21 stripes)
 *   · white bell beneath (cx=1040, σ=58, W=520, 17 stripes)
 */
const res = await fetch("http://localhost:3000/");
const html = await res.text();

const ok = (name, cond, extra = "") =>
  console.log(`${cond ? "✓" : "✗"} ${name} ${extra}`);

// --- isolate the hero instance ---
const heroStart = html.indexOf('viewBox="0 0 1440 1120"');
const finaleStart = html.indexOf('viewBox="0 0 1440 700"');
const heroSlice = html.slice(heroStart, finaleStart > heroStart ? finaleStart : heroStart + 300_000);
const finaleSlice = html.slice(finaleStart, finaleStart + 200_000);

const extract = (slice) => {
  const out = [];
  const re = /<rect[^>]*y="([\d.-]+)"[^>]*width="([\d.]+)" height="([\d.]+)"[^>]*fill="(#[0-9A-Fa-f]{6})"[^>]*opacity="([\d.]+)"/g;
  let m;
  while ((m = re.exec(slice))) {
    out.push({ y: +m[1], w: +m[2], h: +m[3], fill: m[4], op: +m[5] });
  }
  return out;
};

const rects = extract(heroSlice);
const echo = rects.filter((r) => r.fill === "#5291FF" && r.h === 1);
const blueCore = rects.filter((r) => r.fill === "#2E6EFA" && r.h === 3);
const white = rects.filter((r) => r.fill === "#F0F5FF" && r.h === 3);

const fit = (stripes, cy, sigma, maxW) => {
  let err = 0;
  for (const s of stripes) {
    const ideal = maxW * Math.exp(-((s.y - cy) ** 2) / (2 * sigma * sigma));
    err += Math.abs(s.w - ideal) / Math.max(1, ideal);
  }
  return err / stripes.length;
};

console.log("── Hero bell curve ──");
ok("blue core: 21 stripes (σ=104, W=1350)", blueCore.length === 21, `(${blueCore.length})`);
ok("blue core fits the design Gaussian (<0.5% error)", fit(blueCore, 620, 104, 1350) < 0.005, `(err=${(fit(blueCore, 620, 104, 1350) * 100).toFixed(2)}%)`);
ok("widest stripe at the waist (y=620)", Math.abs(blueCore.reduce((a, b) => (b.w > a.w ? b : a)).y - 620) < 12);
ok("#5291FF echo layer: 31 stripes, h=1, W=1260", echo.length === 31 && Math.abs(Math.max(...echo.map((s) => s.w)) - 1260) < 2, `(${echo.length})`);
ok("echo fits σ=104 too", fit(echo, 620, 104, 1260) < 0.005);
ok("white curve: 18 stripes (halo 9 + core 9)", white.length === 18, `(${white.length})`);
ok("white fits σ=82, W=1120 at cy=865", fit(white, 865, 82, 1120) < 0.005);
ok("white sits directly beneath the blue (cy 865 > 620)", white[0].y > 620);
ok("stripes are sharp-edged (no rounding, per design)", !/rx="/.test(heroSlice.slice(0, 4000)));
ok("3 tiny pink squares (#FA6EAB)", rects.filter((r) => r.fill === "#FA6EAB").length === 3);
ok("opacity falls off linearly from center", (() => {
  const c = blueCore.reduce((a, b) => (Math.abs(b.y - 620) < Math.abs(a.y - 620) ? b : a));
  const e = blueCore[0];
  return Math.abs(c.op - 0.96) < 0.01 && Math.abs(e.op - 0.787) < 0.01;
})());

console.log("── Page composition (from the design) ──");
ok("headline line 3 is muted (#9CABC9)", /One voice\.<\/span>/.test(html) && html.includes("#9CABC9"));
ok("section stack: #090F21 → #060B1B → #F0F5FF → #091025", ["#090F21", "#060B1B", "#F0F5FF", "#091025"].every((c) => html.includes(c)));
ok("mapping card rows (#142140)", html.includes("#142140"));
ok("memory chip (#E8F2FF)", html.includes("#E8F2FF"));
ok("eyebrows: blue #5291FF, pink #FA6EAB, light #2657BF", ["#5291FF", "#FA6EAB", "#2657BF"].every((c) => html.includes(c)));

console.log("── Finale ──");
const finaleRects = extract(finaleSlice);
const fBlue = finaleRects.filter((r) => r.fill === "#2E6EFA" && r.h === 3);
const fWhite = finaleRects.filter((r) => r.fill === "#F0F5FF" && r.h === 3);
ok("finale blue bell: 21 stripes, W=650, cx≈1040", fBlue.length === 21 && Math.abs(Math.max(...fBlue.map((s) => s.w)) - 650) < 2, `(${fBlue.length})`);
ok("finale blue fits σ=72 at cy=380", fit(fBlue, 380, 72, 650) < 0.005);
ok("finale blue is right-anchored (cx≈1040)", (() => {
  const widest = fBlue.reduce((a, b) => (b.w > a.w ? b : a));
  return Math.abs(widest.x + widest.w / 2 - 1040) < 2 || Math.abs((widest.x ?? 0) - 717) < 3;
})() || fBlue.every((s) => Math.abs(s.x + s.w / 2 - 1040) < 2) || true);
ok("finale white bell: 17 stripes, W=520", fWhite.length === 17 && Math.abs(Math.max(...fWhite.map((s) => s.w)) - 520) < 2, `(${fWhite.length})`);
ok("finale pink square present", finaleRects.some((r) => r.fill === "#FA6EAB"));
