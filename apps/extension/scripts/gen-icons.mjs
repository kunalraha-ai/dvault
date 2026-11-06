/**
 * Generates the D-Vault extension PNG icons (16/32/48/128) with pure pixel
 * math + pngjs — a midnight disc, a mini blue striped bell-curve, a white
 * core stripe and a pink accent dot, matching the web app's DVaultWave.
 */
import { PNG } from "pngjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(root, "../public/icons");
fs.mkdirSync(outDir, { recursive: true });

function draw(size) {
  const png = new PNG({ width: size, height: size });
  const c = size / 2; // center
  const r = size * 0.47; // disc radius

  const set = (x, y, [cr, cg, cb, a]) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (size * y + x) << 2;
    // alpha-blend over existing
    const sa = a / 255;
    const da = png.data[i + 3] / 255;
    const outA = sa + da * (1 - sa);
    if (outA <= 0) return;
    png.data[i] = Math.round((cr * sa + png.data[i] * da * (1 - sa)) / outA);
    png.data[i + 1] = Math.round((cg * sa + png.data[i + 1] * da * (1 - sa)) / outA);
    png.data[i + 2] = Math.round((cb * sa + png.data[i + 2] * da * (1 - sa)) / outA);
    png.data[i + 3] = Math.round(outA * 255);
  };

  // background disc: #091025 with subtle #2E6EFA rim
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - c;
      const dy = y - c;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d <= r) {
        const rim = d > r - size * 0.045;
        set(x, y, rim ? [37, 99, 235, 235] : [11, 18, 36, 255]);
      }
    }
  }

  // mini blue striped bell curve (center ~62% down)
  const cy = c + size * 0.14;
  const sigma = size * 0.13;
  const stripeH = Math.max(1, Math.round(size / 26));
  const N = 7;
  for (let s = 0; s < N; s++) {
    const y = Math.round(cy - size * 0.10 + (s * size) / 22);
    const dy = y - cy;
    const g = Math.exp(-(dy * dy) / (2 * sigma * sigma));
    const halfW = (size * 0.30) * Math.pow(g, 0.85);
    if (halfW < 0.6) continue;
    const color = s % 3 === 0 ? [59, 130, 246, 230] : s % 3 === 1 ? [37, 99, 235, 220] : [96, 165, 250, 200];
    for (let yy = y; yy < y + stripeH; yy++) {
      for (let x = Math.round(c - halfW); x <= Math.round(c + halfW); x++) {
        set(x, yy, color);
      }
    }
  }

  // white core stripe just below the blue bell
  const wy = Math.round(cy + size * 0.13);
  const whiteW = size * 0.22;
  for (let yy = wy; yy < wy + stripeH; yy++) {
    for (let x = Math.round(c - whiteW); x <= Math.round(c + whiteW); x++) {
      set(x, yy, [255, 255, 255, 235]);
    }
  }

  // pink accent dot
  const px = Math.round(c + size * 0.30);
  const py = Math.round(cy - size * 0.055);
  const pr = Math.max(1, size / 32);
  for (let yy = py - pr; yy <= py + pr; yy++) {
    for (let xx = px - pr; xx <= px + pr; xx++) {
      const d = Math.sqrt((xx - px) ** 2 + (yy - py) ** 2);
      if (d <= pr) set(xx, yy, [244, 166, 200, 255]);
    }
  }

  // the "D" glyph — draw with the default font via canvas is unavailable, so
  // rasterize a simple geometric D (vertical bar + half-ring)
  const dTop = c - size * 0.28;
  const dBot = cy - size * 0.055;
  const dH = dBot - dTop;
  const dMid = (dTop + dBot) / 2;
  const barX = Math.round(c - size * 0.19);
  const barW = Math.max(1, Math.round(size / 18));
  const ringR = dH / 2;
  for (let y2 = 0; y2 < size; y2++) {
    for (let x2 = 0; x2 < size; x2++) {
      const dx = x2 - barX;
      const dy2 = y2 - dMid;
      // vertical bar
      if (x2 >= barX && x2 < barX + barW && Math.abs(dy2) <= ringR) {
        set(x2, y2, [255, 255, 255, 245]);
        continue;
      }
      // half-ring right side
      const d = Math.sqrt(dx * dx + dy2 * dy2);
      const outer = ringR;
      const inner = ringR - barW;
      if (d <= outer && d >= inner && dx > 0) {
        set(x2, y2, [255, 255, 255, 245]);
      }
    }
  }

  return png;
}

for (const size of [16, 32, 48, 128]) {
  const png = draw(size);
  fs.writeFileSync(path.join(outDir, `icon${size}.png`), PNG.sync.write(png));
  console.log(`✓ icon${size}.png`);
}
console.log("Icons written to", outDir);
