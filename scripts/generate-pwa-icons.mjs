/**
 * Genera le icone PWA/favicon di Onizuka. Nessuna dipendenza: PNG scritto a mano
 * (zlib di Node) e antialiasing per supersampling.
 *
 *   node scripts/generate-pwa-icons.mjs
 *
 * Marchio: anello bianco ("O" di Onizuka) con un nodo staccato in orbita,
 * su gradiente indaco -> viola (gli stessi --primary di light e dark in globals.css).
 */
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** #4F46E5 (light --primary) -> #8B5CF6, in diagonale. */
const GRADIENT_FROM = [79, 70, 229];
const GRADIENT_TO = [139, 92, 246];

const SAMPLES = 4; // 4x4 sottocampioni per pixel

const TAU = Math.PI * 2;
const NODE_ANGLE = -Math.PI / 4; // in alto a destra
const GAP_HALF_ANGLE = 0.34; // semi-apertura dell'anello attorno al nodo

/** Distanza con segno da un quadrato con angoli arrotondati (<=0 = dentro). */
function roundedSquareDistance(x, y, half, radius) {
  const qx = Math.abs(x) - (half - radius);
  const qy = Math.abs(y) - (half - radius);
  const dx = Math.max(qx, 0);
  const dy = Math.max(qy, 0);
  return Math.hypot(dx, dy) + Math.min(Math.max(qx, qy), 0) - radius;
}

/** Differenza angolare minima, in valore assoluto. */
function angleDelta(a, b) {
  let d = Math.abs(a - b) % TAU;
  if (d > Math.PI) d = TAU - d;
  return d;
}

/**
 * @param {number} size lato in px
 * @param {object} opts
 * @param {boolean} opts.fullBleed true = niente angoli arrotondati e niente
 *   trasparenza (richiesto da iOS e dalle icone `maskable`)
 * @param {number} opts.glyph fattore di scala del marchio (1 = pieno)
 */
function renderIcon(size, { fullBleed, glyph }) {
  const ringRadius = 0.315 * size * glyph;
  const ringHalfWidth = 0.048 * size * glyph;
  const nodeRadius = 0.072 * size * glyph;
  const cornerRadius = 0.22 * size;
  const half = size / 2;

  const nodeX = Math.cos(NODE_ANGLE) * ringRadius;
  const nodeY = Math.sin(NODE_ANGLE) * ringRadius;

  const pixels = Buffer.alloc(size * size * 4);
  const step = 1 / SAMPLES;
  const total = SAMPLES * SAMPLES;

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let covered = 0;
      let r = 0;
      let g = 0;
      let b = 0;

      for (let sy = 0; sy < SAMPLES; sy++) {
        for (let sx = 0; sx < SAMPLES; sx++) {
          const x = px + (sx + 0.5) * step - half;
          const y = py + (sy + 0.5) * step - half;

          const inside =
            fullBleed || roundedSquareDistance(x, y, half, cornerRadius) <= 0;
          if (!inside) continue;
          covered++;

          const distFromCenter = Math.hypot(x, y);
          const onRing =
            Math.abs(distFromCenter - ringRadius) <= ringHalfWidth &&
            angleDelta(Math.atan2(y, x), NODE_ANGLE) > GAP_HALF_ANGLE;
          const onNode = Math.hypot(x - nodeX, y - nodeY) <= nodeRadius;

          if (onRing || onNode) {
            r += 255;
            g += 255;
            b += 255;
            continue;
          }

          // Gradiente diagonale: 0 in alto a sinistra, 1 in basso a destra.
          const t = (x + y + size) / (2 * size);
          r += GRADIENT_FROM[0] + (GRADIENT_TO[0] - GRADIENT_FROM[0]) * t;
          g += GRADIENT_FROM[1] + (GRADIENT_TO[1] - GRADIENT_FROM[1]) * t;
          b += GRADIENT_FROM[2] + (GRADIENT_TO[2] - GRADIENT_FROM[2]) * t;
        }
      }

      const offset = (py * size + px) * 4;
      if (covered === 0) continue; // resta trasparente
      pixels[offset] = Math.round(r / covered);
      pixels[offset + 1] = Math.round(g / covered);
      pixels[offset + 2] = Math.round(b / covered);
      pixels[offset + 3] = Math.round((covered / total) * 255);
    }
  }

  return pixels;
}

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, crc]);
}

function encodePng(size, pixels) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  // Scanline con filtro 0 (None) in testa a ogni riga.
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0;
    pixels.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const TARGETS = [
  // Favicon e tab del browser (convenzione file di Next).
  { path: "src/app/icon.png", size: 256, fullBleed: false, glyph: 1 },
  // Home screen iOS: Safari non gestisce la trasparenza, serve full bleed.
  { path: "src/app/apple-icon.png", size: 180, fullBleed: true, glyph: 0.82 },
  // Manifest, purpose "any".
  { path: "public/icons/icon-192.png", size: 192, fullBleed: false, glyph: 1 },
  { path: "public/icons/icon-512.png", size: 512, fullBleed: false, glyph: 1 },
  // Manifest, purpose "maskable": il marchio deve stare nel cerchio interno all'80%.
  { path: "public/icons/icon-maskable-512.png", size: 512, fullBleed: true, glyph: 0.78 },
];

for (const target of TARGETS) {
  const file = join(ROOT, target.path);
  mkdirSync(dirname(file), { recursive: true });
  const png = encodePng(target.size, renderIcon(target.size, target));
  writeFileSync(file, png);
  console.log(`${target.path}  ${target.size}x${target.size}  ${(png.length / 1024).toFixed(1)} kB`);
}
