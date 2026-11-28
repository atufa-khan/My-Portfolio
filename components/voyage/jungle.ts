import type { IslandKind } from "@/lib/story";
import { mix, mixRGB, skyAt } from "./engine";

/* ==================================================================
 *  Landing on an island: a painted tropical bay.
 *  Volcanic peaks, a turquoise lagoon, a white beach, thatched huts,
 *  palms and flowers. The still parts are painted once into a layer;
 *  only water, palms, clouds and light move. Light follows the time
 *  of day you landed at.
 * ================================================================== */

const TAU = Math.PI * 2;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export type Env = { tod: number; night: number; warm: number };

/** Where the trail runs, in 0–1 screen coordinates. Shared with the HTML markers. */
/** The summits of the islands that use several peaks (II: internships, III: papers), in 0–1 screen coordinates. */
export function multiPeaks(mobile: boolean, island: number) {
  const y = trailLayout(3, mobile, island).peakY;
  const f = mobile ? (island === 2 ? 0.5 : 0.62) : 0.4;
  const at = (u: number, h: number) => ({ x: 0.5 + u * f, y: 0.66 - (0.66 - y) * h });
  return island === 1 ? [at(-0.5, 1), at(0.5, 1)] : [at(-0.7, 0.93), at(0, 1), at(0.7, 0.93)];
}

/** How high each island's peak rises (screen fraction from the top), I → VII. */
const PEAK = [0.27, 0.19, 0.23, 0.14, 0.1, 0.22, 0.29];
export function trailLayout(n: number, mobile: boolean, island = 3) {
  // on phones the peaks vary less, so the cards always have room
  const peakY = mobile ? 0.24 + (PEAK[island] - 0.14) * 0.45 : PEAK[island];
  const top = peakY + (mobile ? 0.14 : 0.19);
  const bottom = mobile ? 0.84 : 0.8;
  const stops = Array.from({ length: n }, (_, k) => {
    const y = bottom - (k * (bottom - top)) / Math.max(1, n - 1);
    const w = mobile ? 0.39 : 0.2 + 0.05 * ((y - top) / (bottom - top));
    return { x: 0.5 + (k % 2 ? 1 : -1) * w, y };
  });
  const summit = { x: 0.5, y: peakY + (mobile ? 0.035 : 0.035) };
  const pts = [{ x: 0.3, y: 1.04 }, ...stops, summit];
  let d = `M ${pts[0].x * 1000} ${pts[0].y * 1000}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] ?? p2;
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    d += ` C ${c1.x * 1000} ${c1.y * 1000} ${c2.x * 1000} ${c2.y * 1000} ${p2.x * 1000} ${p2.y * 1000}`;
  }
  return { stops, summit, d, peakY, extra: mobile ? { x: 0.86, y: 0.62 } : { x: 0.9, y: 0.62 } };
}

/** Each island's skyline: gaussian bumps [centre, width, height], the one at 0 is the summit. */
const SHAPES: Record<IslandKind, [number, number, number][]> = {
  shallows: [[0, 0.42, 1], [-0.62, 0.34, 0.62], [0.58, 0.3, 0.5]],
  // two peaks side by side: one for each internship
  arches: [[-0.5, 0.2, 1], [0.5, 0.2, 1], [0, 0.42, 0.42], [-1.1, 0.25, 0.35], [1.1, 0.25, 0.3]],
  // three peaks: accepted, under review, in progress
  reef: [[-0.7, 0.15, 0.93], [0, 0.17, 1], [0.7, 0.15, 0.93], [-0.35, 0.3, 0.45], [0.35, 0.3, 0.45], [-1.2, 0.25, 0.3]],
  village: [[0, 0.2, 1], [0, 0.62, 0.62], [0.36, 0.11, 0.74], [-0.62, 0.22, 0.4], [1.05, 0.3, 0.22]],
  summit: [[0, 0.13, 1], [0, 0.5, 0.5], [-0.46, 0.2, 0.36], [0.42, 0.17, 0.32]],
  fire: [[0, 0.36, 1], [-0.58, 0.3, 0.62], [0.62, 0.34, 0.5]],
  dock: [[0, 0.5, 1], [0.62, 0.3, 0.42], [-0.7, 0.3, 0.35]],
};

type Palm = { x: number; y: number; h: number; lean: number; s: number; ph: number };
type Cloud = { x: number; y: number; w: number; blobs: { dx: number; dy: number; r: number }[]; sp: number };

export class JungleScene {
  private g: CanvasRenderingContext2D;
  private W = 0;
  private H = 0;
  private dpr = 1;
  private mobile = false;
  private raf = 0;
  private t0 = performance.now();
  private layer: HTMLCanvasElement | null = null;
  private lagoon: Path2D | null = null;
  private lag: Path2D | null = null;
  private lagoonPath() {
    return this.lag;
  }
  private palms: Palm[] = [];
  private clouds: Cloud[] = [];
  private huts: { x: number; y: number; s: number }[] = [];
  /** Village huts in screen pixels, one per project, so the page can hang signs on them. */
  hutAnchors: { x: number; y: number; s: number }[] = [];
  onLayout?: () => void;
  private motes: { x: number; y: number; r: number; ph: number; sp: number }[] = [];
  private mx = 0;
  private my = 0;
  private sm = { x: 0, y: 0 };
  leaving = false;

  constructor(private canvas: HTMLCanvasElement, private kind: IslandKind, private env: Env, private seed: number) {
    this.g = canvas.getContext("2d")!;
    this.resize();
    this.raf = requestAnimationFrame(this.frame);
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.W = rect.width;
    this.H = rect.height;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(this.W * this.dpr);
    this.canvas.height = Math.round(this.H * this.dpr);
    this.mobile = this.W < 760;
    this.bake();
  }
  pointer(x: number, y: number) {
    this.mx = x / this.W - 0.5;
    this.my = y / this.H - 0.5;
  }
  leave() {
    this.leaving = true;
  }
  destroy() {
    cancelAnimationFrame(this.raf);
  }

  /* ---------- colour by time of day ---------- */
  private c(day: string, night: string, warm?: string) {
    const { night: n, warm: w } = this.env;
    const d = mixRGB(day, warm ?? day, warm ? w * 0.55 : 0);
    const hex = "#" + d.map((v) => v.toString(16).padStart(2, "0")).join("");
    return mix(hex, night, n * 0.92);
  }
  private get lit() {
    return this.env.night > 0.5 ? "170,205,230" : this.env.warm > 0.3 ? "255,200,140" : "255,248,215";
  }

  /* ---------- geometry ---------- */
  private peakTop() {
    return this.H * trailLayout(3, this.mobile, this.seed).peakY;
  }
  private mountainY(x: number) {
    const { W, H } = this;
    const cx = W * 0.5;
    const peak = this.peakTop();
    const base = H * 0.66;
    const u = (x - cx) / (W * (this.mobile ? (this.kind === "reef" ? 0.5 : 0.62) : 0.4));
    const bumps = SHAPES[this.kind];
    let h = 0;
    for (const [c, w, a] of bumps) h = Math.max(h, a * Math.exp(-Math.pow((u - c) / w, 2)));
    h *= 1 + 0.04 * Math.sin(x * 0.045) + 0.025 * Math.sin(x * 0.11 + 2) + 0.012 * Math.sin(x * 0.27);
    return base - (base - peak) * h;
  }
  private shoreY(x: number) {
    const { W, H } = this;
    const u = x / W;
    // a curving bay: the beach sweeps from lower left round to the right
    return H * (0.9 - 0.16 * Math.sin(clamp((u - 0.28) / 0.72, 0, 1) * Math.PI * 0.62) + 0.01 * Math.sin(x * 0.02));
  }
  private treeLineY(x: number) {
    return this.shoreY(x) - this.H * (0.05 + 0.025 * Math.sin(x * 0.012 + 1));
  }

  /* ---------- painting helpers ---------- */
  private glow(g: CanvasRenderingContext2D, x: number, y: number, r: number, rgb: string, a: number) {
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, `rgba(${rgb},${a})`);
    gr.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = gr;
    g.beginPath();
    g.arc(x, y, r, 0, TAU);
    g.fill();
  }

  private palm(g: CanvasRenderingContext2D, p: Palm, t: number) {
    const { x, y, h, lean, s } = p;
    const sway = Math.sin(t * 0.9 + p.ph) * 0.05;
    const tx = x + lean + Math.sin(t * 0.9 + p.ph) * 3 * s;
    const ty = y - h;
    const trunk = this.c("#7a5a3a", "#121a1e", "#6a4430");
    const dark = this.c("#4a3522", "#0b1114", "#3e2a1e");
    // trunk, tapered with rings
    const N = 12;
    g.fillStyle = trunk;
    g.beginPath();
    const L: number[][] = [], Rr: number[][] = [];
    for (let k = 0; k <= N; k++) {
      const u = k / N;
      const cx = (1 - u) * (1 - u) * x + 2 * (1 - u) * u * (x + lean * 0.1) + u * u * tx;
      const cy = (1 - u) * (1 - u) * y + 2 * (1 - u) * u * (y - h * 0.55) + u * u * ty;
      const w = (4.2 - 2.2 * u) * s;
      L.push([cx - w, cy]);
      Rr.push([cx + w, cy]);
    }
    L.forEach(([a, b], k) => (k ? g.lineTo(a, b) : g.moveTo(a, b)));
    for (let k = N; k >= 0; k--) g.lineTo(Rr[k][0], Rr[k][1]);
    g.fill();
    g.strokeStyle = dark;
    g.lineWidth = 0.9 * s;
    for (let k = 1; k < N; k++) {
      g.beginPath();
      g.moveTo(L[k][0], L[k][1]);
      g.lineTo(Rr[k][0], Rr[k][1] - 1.5 * s);
      g.stroke();
    }
    g.strokeStyle = `rgba(${this.lit},0.35)`;
    g.lineWidth = 1.2 * s;
    g.beginPath();
    Rr.forEach(([a, b], k) => (k ? g.lineTo(a, b) : g.moveTo(a, b)));
    g.stroke();
    // coconuts
    g.fillStyle = this.c("#5a4020", "#0c1012");
    for (let k = 0; k < 4; k++) {
      g.beginPath();
      g.arc(tx - 4 * s + k * 2.6 * s, ty + 4 * s + (k % 2) * 2 * s, 2.6 * s, 0, TAU);
      g.fill();
    }
    // fronds: arched ribs lined with drooping leaflets
    const greens = [this.c("#2f7a3c", "#0b1a1e", "#5a5a2e"), this.c("#3f9447", "#0e2026", "#6e6a34"), this.c("#256a33", "#091619", "#4a4a28")];
    const F = 11;
    for (let f = 0; f < F; f++) {
      const a = -Math.PI + (f / (F - 1)) * Math.PI + (f % 2 ? 0.1 : -0.06) + sway * (f % 3 ? 1 : -0.6);
      const len = (h * 0.36 + ((f * 7 + p.ph * 10) % 5) * 2.5 * s) * (f === 0 || f === F - 1 ? 1.08 : 1);
      const droop = 0.6 + 0.4 * Math.abs(Math.cos(a));
      const ex = tx + Math.cos(a) * len;
      const ey = ty + Math.sin(a) * len * 0.5 + len * 0.45 * droop;
      const mx = tx + Math.cos(a) * len * 0.55;
      const my = ty + Math.sin(a) * len * 0.5 - len * 0.12;
      g.strokeStyle = greens[f % 3];
      g.lineWidth = 1.6 * s;
      g.beginPath();
      g.moveTo(tx, ty);
      g.quadraticCurveTo(mx, my, ex, ey);
      g.stroke();
      g.lineWidth = 1.3 * s;
      const Ls = 14;
      for (let k = 1; k < Ls; k++) {
        const u = k / Ls;
        const px = (1 - u) * (1 - u) * tx + 2 * (1 - u) * u * mx + u * u * ex;
        const py = (1 - u) * (1 - u) * ty + 2 * (1 - u) * u * my + u * u * ey;
        const ll = len * 0.2 * Math.sin(u * Math.PI * 0.9 + 0.25);
        const dx = 2 * (1 - u) * (mx - tx) + 2 * u * (ex - mx);
        const dy = 2 * (1 - u) * (my - ty) + 2 * u * (ey - my);
        const dl = Math.hypot(dx, dy) || 1;
        const nx = -dy / dl, ny = dx / dl;
        for (const sd of [-1, 1]) {
          g.beginPath();
          g.moveTo(px, py);
          g.lineTo(px + nx * ll * sd + dx / dl * ll * 0.35, py + ny * ll * sd + ll * 0.7);
          g.stroke();
        }
      }
      if (Math.cos(a) > 0.2) {
        g.strokeStyle = `rgba(${this.lit},0.22)`;
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(tx, ty);
        g.quadraticCurveTo(mx, my, ex, ey);
        g.stroke();
      }
    }
  }

  private hut(g: CanvasRenderingContext2D, x: number, y: number, s: number) {
    const straw = this.c("#c99a58", "#1a1c1c", "#b0703e");
    const strawDark = this.c("#8a6234", "#0f1213", "#6e4426");
    const wood = this.c("#6a4a2e", "#0c1114", "#543422");
    // stilts and platform
    g.strokeStyle = wood;
    g.lineWidth = 2.2 * s;
    for (const sx of [-22, -8, 8, 22]) {
      g.beginPath();
      g.moveTo(x + sx * s, y);
      g.lineTo(x + sx * s, y - 14 * s);
      g.stroke();
    }
    g.fillStyle = wood;
    g.fillRect(x - 28 * s, y - 16 * s, 56 * s, 4 * s);
    // walls
    g.fillStyle = this.c("#8a6640", "#0d1215", "#6a4630");
    g.fillRect(x - 21 * s, y - 36 * s, 42 * s, 20 * s);
    g.strokeStyle = strawDark;
    g.lineWidth = 0.8 * s;
    for (let k = -19; k <= 19; k += 4) {
      g.beginPath();
      g.moveTo(x + k * s, y - 36 * s);
      g.lineTo(x + k * s, y - 16 * s);
      g.stroke();
    }
    // door / window, glowing after dusk
    const n = this.env.night;
    g.fillStyle = n > 0.3 ? `rgba(255,190,100,${0.5 + 0.5 * n})` : this.c("#3a2616", "#0a0d0f");
    g.fillRect(x - 5 * s, y - 31 * s, 10 * s, 15 * s);
    if (n > 0.3) this.glow(g, x, y - 24 * s, 40 * s, "255,170,80", 0.35 * n);
    // steep thatched roof with an overhang
    const roof = new Path2D();
    roof.moveTo(x - 36 * s, y - 30 * s);
    roof.quadraticCurveTo(x - 20 * s, y - 52 * s, x, y - 78 * s);
    roof.quadraticCurveTo(x + 20 * s, y - 52 * s, x + 36 * s, y - 30 * s);
    roof.quadraticCurveTo(x, y - 25 * s, x - 36 * s, y - 30 * s);
    const rg = g.createLinearGradient(x - 36 * s, 0, x + 36 * s, 0);
    rg.addColorStop(0, strawDark);
    rg.addColorStop(0.55, straw);
    rg.addColorStop(1, this.c("#e2bc7a", "#22282a", "#d9925a"));
    g.fillStyle = rg;
    g.fill(roof);
    g.save();
    g.clip(roof);
    g.strokeStyle = strawDark;
    g.globalAlpha = 0.55;
    g.lineWidth = 0.9 * s;
    for (let k = 0; k < 60; k++) {
      const u = (k / 59) * 2 - 1;
      g.beginPath();
      g.moveTo(x + u * 4 * s, y - 76 * s);
      g.lineTo(x + u * 38 * s, y - 28 * s);
      g.stroke();
    }
    for (let r = 0; r < 4; r++) {
      const yy = y - (34 + r * 11) * s;
      g.beginPath();
      g.moveTo(x - 40 * s, yy);
      g.quadraticCurveTo(x, yy + 4 * s, x + 40 * s, yy);
      g.stroke();
    }
    g.restore();
    g.globalAlpha = 1;
    // ragged eave
    g.strokeStyle = strawDark;
    g.lineWidth = 1 * s;
    for (let k = -35; k <= 35; k += 2.5) {
      g.beginPath();
      g.moveTo(x + k * s, y - 29 * s);
      g.lineTo(x + (k + 0.6) * s, y - (25 + (Math.abs(k * 7) % 4)) * s);
      g.stroke();
    }
    g.fillStyle = strawDark;
    g.fillRect(x - 1.5 * s, y - 82 * s, 3 * s, 7 * s);
  }

  private hibiscus(g: CanvasRenderingContext2D, x: number, y: number, r: number, rot: number) {
    const n = this.env.night;
    const petal = mix("#ef5f86", "#4a2a3a", n * 0.8);
    const petalLite = mix("#ffb3c7", "#6a4a5a", n * 0.8);
    g.save();
    g.translate(x, y);
    g.rotate(rot);
    for (let k = 0; k < 5; k++) {
      g.save();
      g.rotate((k / 5) * TAU);
      const pg = g.createRadialGradient(0, -r * 0.55, 0, 0, -r * 0.5, r * 0.75);
      pg.addColorStop(0, petalLite);
      pg.addColorStop(1, petal);
      g.fillStyle = pg;
      g.beginPath();
      g.moveTo(0, 0);
      g.bezierCurveTo(-r * 0.6, -r * 0.3, -r * 0.55, -r * 1.05, 0, -r);
      g.bezierCurveTo(r * 0.55, -r * 1.05, r * 0.6, -r * 0.3, 0, 0);
      g.fill();
      g.restore();
    }
    g.fillStyle = mix("#a3123a", "#2a1a22", n * 0.8);
    g.beginPath();
    g.arc(0, 0, r * 0.18, 0, TAU);
    g.fill();
    g.strokeStyle = mix("#f7d35a", "#5a5a3a", n * 0.8);
    g.lineWidth = r * 0.06;
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(r * 0.5, -r * 0.35);
    g.stroke();
    g.fillStyle = mix("#ffe07a", "#6a6a4a", n * 0.8);
    g.beginPath();
    g.arc(r * 0.52, -r * 0.37, r * 0.07, 0, TAU);
    g.fill();
    g.restore();
  }

  private bigLeaf(g: CanvasRenderingContext2D, x: number, y: number, ang: number, len: number, wid: number, fill: string) {
    g.save();
    g.translate(x, y);
    g.rotate(ang);
    const lg = g.createLinearGradient(0, -len * wid * 0.5, 0, len * wid * 0.5);
    lg.addColorStop(0, fill);
    lg.addColorStop(1, mix("#0d2a18", "#020608", this.env.night));
    g.fillStyle = lg;
    g.beginPath();
    g.moveTo(0, 0);
    g.bezierCurveTo(len * 0.25, -len * wid * 0.6, len * 0.78, -len * wid * 0.45, len, 0);
    g.bezierCurveTo(len * 0.78, len * wid * 0.45, len * 0.25, len * wid * 0.6, 0, 0);
    g.fill();
    g.strokeStyle = `rgba(${this.lit},0.25)`;
    g.lineWidth = 1.6;
    g.beginPath();
    g.moveTo(0, 0);
    g.quadraticCurveTo(len * 0.5, -len * 0.02, len * 0.97, 0);
    g.stroke();
    g.lineWidth = 0.9;
    for (let k = 1; k < 9; k++) {
      const px = (k / 9) * len;
      const w = Math.sin((k / 9) * Math.PI) * len * wid * 0.45;
      for (const sd of [-1, 1]) {
        g.beginPath();
        g.moveTo(px, 0);
        g.quadraticCurveTo(px + len * 0.06, sd * w * 0.5, px + len * 0.12, sd * w);
        g.stroke();
      }
    }
    g.restore();
  }

  /* ---------- paint everything that doesn't move, once ---------- */
  private bake() {
    const { W, H, dpr } = this;
    const pad = 30;
    const c = document.createElement("canvas");
    c.width = Math.ceil((W + pad * 2) * dpr);
    c.height = Math.ceil((H + pad * 2) * dpr);
    const g = c.getContext("2d")!;
    g.scale(dpr, dpr);
    g.translate(pad, pad);
    const r = rng(1000 + this.seed * 77);
    const n = this.env.night;
    const s = this.mobile ? 0.7 : clamp(W / 1440, 0.75, 1.3);
    const cx = W * 0.5;

    // sky
    const [s0, s1, s2] = skyAt(this.env.tod);
    const sky = g.createLinearGradient(0, -pad, 0, H * 0.62);
    sky.addColorStop(0, s0);
    sky.addColorStop(0.6, s1);
    sky.addColorStop(1, s2);
    g.fillStyle = sky;
    g.fillRect(-pad, -pad, W + pad * 2, H + pad * 2);
    if (n > 0.05) {
      g.fillStyle = "#fff";
      for (let k = 0; k < 220; k++) {
        g.globalAlpha = n * (0.3 + r() * 0.7);
        g.beginPath();
        g.arc(r() * W, r() * H * 0.45, 0.4 + r() * 1.1, 0, TAU);
        g.fill();
      }
      g.globalAlpha = 1;
      this.glow(g, W * 0.82, H * 0.12, W * 0.25, "200,220,255", 0.2 * n);
      g.fillStyle = `rgba(246,243,230,${n})`;
      g.beginPath();
      g.arc(W * 0.82, H * 0.12, 22 * s, 0, TAU);
      g.fill();
    } else {
      this.glow(g, W * 0.86, H * 0.1, W * 0.4, this.env.warm > 0.3 ? "255,190,130" : "255,245,215", 0.5);
    }

    // open ocean on the horizon
    const hz = H * 0.56;
    const og = g.createLinearGradient(0, hz, 0, H * 0.72);
    og.addColorStop(0, this.c("#6fb6cf", "#10283a", "#c89a92"));
    og.addColorStop(1, this.c("#2b86a8", "#0a1c2a", "#7a6a80"));
    g.fillStyle = og;
    g.fillRect(-pad, hz, W + pad * 2, H * 0.3);
    g.strokeStyle = `rgba(${this.lit},0.35)`;
    g.lineWidth = 1;
    for (let k = 0; k < 40; k++) {
      const y = hz + 3 + r() * H * 0.08;
      const x = r() * W;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + 10 + r() * 30, y);
      g.stroke();
    }

    // distant islands, hazy
    g.fillStyle = this.c("#8fb3a6", "#18303a", "#b99496");
    g.beginPath();
    g.moveTo(-pad, hz + 2);
    for (let x = -pad; x <= W * 0.4; x += 8) g.lineTo(x, hz + 2 - Math.max(0, Math.sin((x / (W * 0.4)) * Math.PI)) * H * (0.13 + 0.03 * Math.sin(x * 0.03)));
    g.lineTo(W * 0.4, hz + 2);
    g.fill();
    g.beginPath();
    g.moveTo(W * 0.78, hz + 2);
    for (let x = W * 0.78; x <= W + pad; x += 8) g.lineTo(x, hz + 2 - Math.max(0, Math.sin(((x - W * 0.78) / (W * 0.3)) * Math.PI)) * H * 0.07);
    g.lineTo(W + pad, hz + 2);
    g.fill();

    // the main volcanic peaks
    const mt = new Path2D();
    mt.moveTo(-pad, H * 0.7);
    for (let x = -pad; x <= W + pad; x += 4) mt.lineTo(x, this.mountainY(x));
    mt.lineTo(W + pad, H * 0.7);
    mt.closePath();
    const mg = g.createLinearGradient(cx - W * 0.3, 0, cx + W * 0.3, 0);
    mg.addColorStop(0, this.c("#1f5a3c", "#071519", "#3c3a3a"));
    mg.addColorStop(0.5, this.c("#2f7444", "#0b1e24", "#5a5040"));
    mg.addColorStop(1, this.c("#58a05a", "#16303a", "#a07a52"));
    g.fillStyle = mg;
    g.fill(mt);
    g.save();
    g.clip(mt);
    // gullies running down the slopes
    for (let k = 0; k < 90; k++) {
      const x0 = cx + (r() - 0.5) * W * (this.mobile ? 1.2 : 0.8);
      const y0 = this.mountainY(x0) + 2;
      const len = H * (0.06 + r() * 0.22);
      const right = x0 > cx;
      g.strokeStyle = right ? `rgba(20,60,40,${0.35})` : `rgba(5,25,15,${0.45})`;
      g.lineWidth = 1 + r() * 3 * s;
      g.beginPath();
      g.moveTo(x0, y0);
      g.bezierCurveTo(x0 + (r() - 0.5) * 20, y0 + len * 0.3, x0 + (r() - 0.5) * 30, y0 + len * 0.7, x0 + (x0 - cx) * 0.15, y0 + len);
      g.stroke();
      if (right) {
        g.strokeStyle = `rgba(${this.lit},0.12)`;
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(x0 + 2, y0);
        g.bezierCurveTo(x0 + 2, y0 + len * 0.3, x0 + 4, y0 + len * 0.7, x0 + 2 + (x0 - cx) * 0.15, y0 + len);
        g.stroke();
      }
    }
    // jungle covering the slopes: thousands of small dabs, lit from the right
    const dabCols = [this.c("#2c6c40", "#0a1a1f", "#4a4632"), this.c("#327545", "#0c1e25", "#565034"), this.c("#265f3b", "#09181d", "#423e30"), this.c("#438a4e", "#11262d", "#786a46")];
    for (let k = 0; k < (this.mobile ? 5000 : 11000); k++) {
      const x = cx + (r() - 0.5) * W * (this.mobile ? 1.3 : 0.95);
      const top = this.mountainY(x);
      const y = top + Math.pow(r(), 0.8) * (H * 0.7 - top);
      const depth = clamp((y - this.peakTop()) / (H * 0.5), 0, 1);
      if (depth < 0.12 && r() < 0.7) continue; // bare rock near the spires
      const rad = (1 + r() * 2.2) * s * (0.6 + depth);
      const side = (x - cx) / (W * 0.4);
      g.fillStyle = dabCols[side > 0.15 && r() < 0.6 ? 3 : Math.floor(r() * 3)];
      g.beginPath();
      g.arc(x, y, rad, 0, TAU);
      g.fill();
    }
    // atmosphere: the foot of the mountain fades into haze
    const haze = g.createLinearGradient(0, H * 0.35, 0, H * 0.68);
    haze.addColorStop(0, "rgba(255,255,255,0)");
    haze.addColorStop(1, n > 0.5 ? "rgba(60,90,120,0.35)" : `rgba(${this.env.warm > 0.3 ? "255,210,180" : "220,240,245"},0.45)`);
    g.fillStyle = haze;
    g.fillRect(-pad, 0, W + pad * 2, H);
    g.restore();
    // rim light along the right-hand ridges
    g.strokeStyle = `rgba(${this.lit},0.4)`;
    g.lineWidth = 1.5;
    g.beginPath();
    for (let x = cx - 20; x <= W * 0.85; x += 3) {
      const y = this.mountainY(x);
      if (x === cx - 20) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
    if (this.kind === "summit") this.glow(g, cx, this.peakTop() + 10, W * 0.14, "255,205,110", 0.5);
    if (this.kind === "arches") {
      const fx = cx + W * (this.mobile ? 0.04 : 0.02);
      const fy = this.mountainY(fx) + 30;
      const fb = H * 0.66;
      const fg = g.createLinearGradient(fx - 10, 0, fx + 10, 0);
      fg.addColorStop(0, "rgba(230,250,255,0)");
      fg.addColorStop(0.5, `rgba(240,252,255,${0.85 - n * 0.4})`);
      fg.addColorStop(1, "rgba(230,250,255,0)");
      g.fillStyle = fg;
      g.fillRect(fx - 10, fy, 20, fb - fy);
      this.glow(g, fx, fb, 60, "240,252,255", 0.5);
    }

    // low hills and the jungle around the bay
    const hill = new Path2D();
    hill.moveTo(-pad, H + pad);
    for (let x = -pad; x <= W + pad; x += 6) {
      const u = x / W;
      const y = H * (0.6 + 0.08 * Math.pow(Math.sin(u * Math.PI), 2) + 0.03 * Math.sin(x * 0.01)) - (u < 0.35 ? H * 0.08 * (1 - u / 0.35) : 0);
      hill.lineTo(x, Math.min(y, this.treeLineY(x)));
    }
    hill.lineTo(W + pad, H + pad);
    hill.closePath();
    g.fillStyle = this.c("#1f5a34", "#061418", "#3a3a2c");
    g.fill(hill);
    g.save();
    g.clip(hill);
    for (let k = 0; k < (this.mobile ? 3200 : 7000); k++) {
      const x = r() * (W + pad * 2) - pad;
      const y = H * 0.5 + r() * H * 0.45;
      if (y > this.treeLineY(x) + 12) continue;
      g.fillStyle = dabCols[Math.floor(r() * 4)];
      g.beginPath();
      g.arc(x, y, (1.8 + r() * 3.8) * s, 0, TAU);
      g.fill();
    }
    g.restore();
    // a row of far palms along the hills
    for (let k = 0; k < (this.mobile ? 10 : 22); k++) {
      const x = r() * W;
      const y = Math.min(H * (0.6 + 0.08 * Math.pow(Math.sin((x / W) * Math.PI), 2)), this.treeLineY(x)) + 6;
      this.palm(g, { x, y, h: (40 + r() * 40) * s, lean: (r() - 0.5) * 30 * s, s: s * 0.55, ph: r() * TAU }, 0);
    }

    // the lagoon and beach
    const lag = new Path2D();
    lag.moveTo(-pad, H + pad);
    for (let x = -pad; x <= W + pad; x += 6) lag.lineTo(x, this.shoreY(x));
    lag.lineTo(W + pad, H + pad);
    lag.closePath();
    this.lagoon = lag;
    this.lag = lag;
    const sand = new Path2D();
    sand.moveTo(-pad, H + pad);
    for (let x = -pad; x <= W + pad; x += 6) sand.lineTo(x, this.treeLineY(x));
    sand.lineTo(W + pad, H + pad);
    sand.closePath();
    const sg = g.createLinearGradient(0, H * 0.7, 0, H);
    sg.addColorStop(0, this.c("#f3e7c6", "#2a3236", "#f0c8a0"));
    sg.addColorStop(1, this.c("#e6d3a6", "#1c2428", "#d9a682"));
    g.fillStyle = sg;
    g.fill(sand);
    const lg = g.createLinearGradient(0, H * 0.72, 0, H);
    lg.addColorStop(0, this.c("#5fd6d2", "#14404a", "#c8b0a0"));
    lg.addColorStop(0.35, this.c("#2fb7c9", "#0e3442", "#8a8a98"));
    lg.addColorStop(1, this.c("#1a86a8", "#082636", "#5a6a86"));
    g.fillStyle = lg;
    g.fill(lag);
    g.save();
    g.clip(lag);
    // shallow water over sand near the shore
    g.lineWidth = 26 * s;
    g.strokeStyle = this.c("#a8efe4", "#1c4c54", "#e8d0c0");
    g.globalAlpha = 0.55;
    g.beginPath();
    for (let x = W * 0.2; x <= W + pad; x += 6) {
      const y = this.shoreY(x) + 10 * s;
      if (x === W * 0.2) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
    g.globalAlpha = 1;
    g.restore();
    // the wet edge and foam of the shore
    g.strokeStyle = this.c("#ffffff", "#7a9aa8");
    g.lineWidth = 2;
    g.beginPath();
    for (let x = W * 0.2; x <= W + pad; x += 6) {
      const y = this.shoreY(x);
      if (x === W * 0.2) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();

    // things only this island has
    if (this.kind === "shallows") {
      // sandbars and a tiny palm islet in the lagoon
      for (const [u, v, w] of [[0.62, 0.9, 0.08], [0.85, 0.84, 0.06], [0.5, 0.97, 0.05]] as const) {
        const x = W * u, y = H * v;
        g.fillStyle = this.c("#bff0e6", "#1e4a52");
        g.beginPath();
        g.ellipse(x, y, W * w * 1.3, H * 0.02, 0, 0, TAU);
        g.fill();
        g.fillStyle = this.c("#f4e8c8", "#2a3236", "#f0c8a0");
        g.beginPath();
        g.ellipse(x, y, W * w, H * 0.011, 0, 0, TAU);
        g.fill();
      }
      this.palm(g, { x: W * 0.85, y: H * 0.84, h: 60 * s, lean: 18 * s, s: s * 0.6, ph: 1 }, 0);
    }
    if (this.kind === "reef") {
      // coral gardens under the clear water, and the reef's line of surf
      g.save();
      if (this.lagoonPath()) g.clip(this.lagoonPath()!);
      const cols = ["255,120,150", "255,170,90", "180,120,230", "120,230,200", "255,210,120"];
      for (let k = 0; k < 160; k++) {
        const x = W * (0.3 + r() * 0.75), y = H * (0.8 + r() * 0.2);
        if (y < this.shoreY(x) + 14) continue;
        g.fillStyle = `rgba(${cols[k % 5]},${0.25 + 0.25 * (1 - n)})`;
        g.beginPath();
        g.ellipse(x, y, (5 + r() * 14) * s, (3 + r() * 6) * s, r(), 0, TAU);
        g.fill();
      }
      g.restore();
    }
    if (this.kind === "arches") {
      // a great sea arch standing in the lagoon
      const ax = W * (this.mobile ? 0.8 : 0.84), ay = H * 0.88, aw = W * (this.mobile ? 0.22 : 0.13), ah = H * 0.2;
      const rock = new Path2D();
      rock.moveTo(ax - aw / 2, ay);
      rock.bezierCurveTo(ax - aw * 0.6, ay - ah * 0.8, ax - aw * 0.3, ay - ah * 1.05, ax, ay - ah);
      rock.bezierCurveTo(ax + aw * 0.35, ay - ah * 1.02, ax + aw * 0.62, ay - ah * 0.7, ax + aw / 2, ay);
      rock.lineTo(ax + aw * 0.22, ay);
      rock.bezierCurveTo(ax + aw * 0.2, ay - ah * 0.55, ax - aw * 0.18, ay - ah * 0.6, ax - aw * 0.22, ay);
      rock.closePath();
      const rg2 = g.createLinearGradient(ax - aw / 2, 0, ax + aw / 2, 0);
      rg2.addColorStop(0, this.c("#4a5a52", "#0c1416", "#5a4a44"));
      rg2.addColorStop(1, this.c("#8a9a88", "#1c2a30", "#b08a70"));
      g.fillStyle = rg2;
      g.fill(rock);
      g.save();
      g.clip(rock);
      for (let k = 0; k < 160; k++) {
        const x = ax + (r() - 0.5) * aw, y = ay - r() * ah;
        if (y > ay - ah * 0.82) continue;
        g.fillStyle = dabCols[Math.floor(r() * 4)];
        g.beginPath();
        g.arc(x, y, (1.5 + r() * 3) * s, 0, TAU);
        g.fill();
      }
      g.restore();
      g.strokeStyle = this.c("#ffffff", "#7a9aa8");
      g.lineWidth = 2;
      g.beginPath();
      g.ellipse(ax - aw * 0.36, ay, aw * 0.18, 3, 0, 0, TAU);
      g.ellipse(ax + aw * 0.36, ay, aw * 0.18, 3, 0, 0, TAU);
      g.stroke();
    }
    if (this.kind === "dock") {
      // crates and barrels waiting on the beach
      for (let k = 0; k < 5; k++) {
        const x = W * (0.5 + k * 0.025), y = this.treeLineY(W * 0.5) + (34 + (k % 2) * 8) * s;
        g.fillStyle = this.c(k % 2 ? "#8a6234" : "#6a4a2e", "#0c1114");
        if (k % 2) {
          g.beginPath();
          g.ellipse(x, y - 9 * s, 7 * s, 10 * s, 0, 0, TAU);
          g.fill();
        } else g.fillRect(x - 9 * s, y - 16 * s, 18 * s, 16 * s);
        g.strokeStyle = this.c("#4a3220", "#070a0c");
        g.lineWidth = 1;
        g.strokeRect(x - 9 * s, y - 16 * s, 18 * s, 16 * s);
      }
    }

    // huts on the beach
    this.huts = [];
    this.hutAnchors = [];
    if (this.kind === "village") {
      // one hut per project: Sukoonify in the middle and biggest, then Memora, PMS, RAG chatbot, Brain-X
      const xs = this.mobile ? [0.5, 0.3, 0.7, 0.1, 0.9] : [0.5, 0.305, 0.695, 0.11, 0.89];
      xs.forEach((u, k) => {
        const x = W * u;
        const y = H * (this.mobile ? (k === 0 ? 0.47 : 0.45) : k === 0 ? 0.6 : 0.57);
        const sc = s * (this.mobile ? (k === 0 ? 1.3 : 0.95) : k === 0 ? 2.5 : 1.8);
        this.hutAnchors[k] = { x, y, s: sc };
        this.huts.push({ x, y, s: sc });
      });
    } else {
      const hutXs = this.kind === "dock" || this.kind === "fire" ? [0.3, 0.42, 0.78] : [0.33, 0.44];
      for (const u of hutXs) {
        const x = W * u;
        const y = this.treeLineY(x) + (this.mobile ? 14 : 20) * s;
        this.huts.push({ x, y, s: s * (this.mobile ? 1.1 : 1.45) * (0.85 + 0.3 * (1 - Math.abs(u - 0.45))) });
      }
    }
    this.huts.sort((a, b) => a.y - b.y);
    for (const h of this.huts) {
      if (this.kind === "village") {
        g.fillStyle = "rgba(0,20,10,0.3)";
        g.beginPath();
        g.ellipse(h.x, h.y + 2 * h.s, 34 * h.s, 5 * h.s, 0, 0, TAU);
        g.fill();
      }
      this.hut(g, h.x, h.y, h.s);
    }
    if (this.kind === "fire") {
      const fx = W * 0.62, fy = this.treeLineY(W * 0.62) + 36 * s;
      g.fillStyle = this.c("#5a4030", "#0c0f10");
      g.fillRect(fx - 16 * s, fy - 2 * s, 32 * s, 4 * s);
    }
    if (this.kind === "dock") {
      g.strokeStyle = this.c("#6a4a2e", "#0c1114");
      g.lineWidth = 4 * s;
      const dx = W * 0.6, dy = this.shoreY(W * 0.6);
      g.beginPath();
      g.moveTo(dx, dy - 4);
      g.lineTo(dx + W * 0.12, dy + H * 0.08);
      g.stroke();
      for (let k = 0; k < 6; k++) {
        const px = dx + (W * 0.12 * k) / 5, py = dy - 4 + (H * 0.08 * k) / 5;
        g.beginPath();
        g.moveTo(px, py);
        g.lineTo(px, py + 14 * s);
        g.stroke();
      }
    }

    // beach palms that move are drawn every frame
    const rp = rng(5000 + this.seed);
    this.palms = [];
    const palmXs = this.mobile ? [0.05, 0.36, 0.72, 0.95] : [0.04, 0.2, 0.36, 0.5, 0.68, 0.78, 0.96];
    for (const u of palmXs) {
      if (this.kind === "village" && this.hutAnchors.some((h) => Math.abs(h.x / W - u) < 0.06)) continue;
      const x = W * (u + (rp() - 0.5) * 0.03);
      this.palms.push({ x, y: this.treeLineY(x) + (12 + rp() * 22) * s, h: (130 + rp() * 90) * s, lean: (u < 0.5 ? -1 : 1) * (25 + rp() * 35) * s, s, ph: rp() * TAU });
    }
    this.palms.sort((a, b) => a.y - b.y);

    this.clouds = Array.from({ length: 6 }, (_, k) => {
      const w = (180 + rp() * 200) * s;
      return {
        x: rp() * W, y: H * (0.07 + (k % 3) * 0.06 + rp() * 0.03), w, sp: 4 + rp() * 6,
        blobs: Array.from({ length: 16 }, (_, b) => ({ dx: (b / 15 - 0.5) * w * (0.8 + rp() * 0.3), dy: -Math.sin((b / 15) * Math.PI) * w * 0.12 + (rp() - 0.5) * w * 0.08, r: w * (0.1 + rp() * 0.08) })),
      };
    });
    this.motes = Array.from({ length: 50 }, () => ({ x: rp(), y: 0.3 + rp() * 0.65, r: 0.8 + rp() * 1.6, ph: rp() * TAU, sp: 0.2 + rp() * 0.6 }));
    this.layer = c;
    this.onLayout?.();
  }


  /** The sea creeping up over the view: each island sits lower than the last. */
  private drawSea(t: number, sink: number, s: number) {
    const g = this.g;
    const { W, H } = this;
    const n = this.env.night;
    const top = H * (1.03 - 0.36 * sink) + Math.sin(t * 0.9) * 4 * sink;
    const edge = (x: number) => top + Math.sin(x * 0.011 + t * 1.2) * 7 * s + Math.sin(x * 0.029 - t * 1.9) * 3.5 * s;
    const path = new Path2D();
    path.moveTo(-10, H + 10);
    for (let x = -10; x <= W + 10; x += 8) path.lineTo(x, edge(x));
    path.lineTo(W + 10, H + 10);
    path.closePath();
    const sg = g.createLinearGradient(0, top - 10, 0, H);
    sg.addColorStop(0, this.c("#3fb0c8", "#123444", "#c08a86"));
    sg.addColorStop(0.25, mix("#1d7c98", "#0a2232", n));
    sg.addColorStop(1, mix("#0b3c55", "#04121c", n));
    g.globalAlpha = 0.82 + 0.12 * sink;
    g.fillStyle = sg;
    g.fill(path);
    g.globalAlpha = 1;
    g.save();
    g.clip(path);
    // looking up through the water: light shafts and rising bubbles once we're deep enough
    if (sink > 0.5) {
      g.globalCompositeOperation = "lighter";
      for (let k = 0; k < 6; k++) {
        const x0 = W * (0.1 + k * 0.16) + Math.sin(t * 0.3 + k) * 30;
        const rg = g.createLinearGradient(0, top, 0, H);
        rg.addColorStop(0, `rgba(170,240,245,${0.08 * sink * (1 - n * 0.6)})`);
        rg.addColorStop(1, "rgba(170,240,245,0)");
        g.fillStyle = rg;
        g.beginPath();
        g.moveTo(x0, top);
        g.lineTo(x0 + 30, top);
        g.lineTo(x0 + 110, H);
        g.lineTo(x0 + 40, H);
        g.fill();
      }
      g.globalCompositeOperation = "source-over";
      g.strokeStyle = "rgba(220,250,255,0.45)";
      g.lineWidth = 1;
      for (let k = 0; k < 22; k++) {
        const life = (t * (0.15 + (k % 5) * 0.03) + k * 0.13) % 1;
        const x = W * ((k * 0.137) % 1) + Math.sin(t * 2 + k) * 6;
        const y = H - life * (H - top);
        g.beginPath();
        g.arc(x, y, 1.5 + (k % 3), 0, TAU);
        g.stroke();
      }
    }
    for (let k = 0; k < 40; k++) {
      const x = (k * 71.3) % W;
      const y = top + 8 + ((k * 37) % 60);
      const a = Math.max(0, Math.sin(t * 2.4 + k * 1.9)) * 0.45;
      g.fillStyle = `rgba(${this.lit},${a})`;
      g.fillRect(x, y, 10 + (k % 3) * 8, 1.3);
    }
    g.restore();
    // the bright line of the surface
    g.strokeStyle = `rgba(235,252,255,${0.6 + 0.3 * sink})`;
    g.lineWidth = 2;
    g.beginPath();
    for (let x = -10; x <= W + 10; x += 8) {
      const y = edge(x);
      if (x === -10) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
  }

  /* ---------- every frame ---------- */
  private frame = (now: number) => {
    this.raf = requestAnimationFrame(this.frame);
    const g = this.g;
    const { W, H } = this;
    if (!this.layer) return;
    const t = (now - this.t0) / 1000;
    const n = this.env.night;
    const s = this.mobile ? 0.7 : clamp(W / 1440, 0.75, 1.3);
    this.sm.x += (this.mx - this.sm.x) * 0.04;
    this.sm.y += (this.my - this.sm.y) * 0.04;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    // the painted layer, drifting very slightly with the cursor
    const still = this.kind === "village" ? 0 : 1;
    const ox = -30 - this.sm.x * 14 * still;
    const oy = -30 - this.sm.y * 8 * still;
    g.drawImage(this.layer, ox, oy, W + 60, H + 60);
    g.save();
    g.translate(ox + 30, oy + 30);

    // clouds drift by day
    if (n < 0.8) {
      for (const cl of this.clouds) {
        const x = ((cl.x + t * cl.sp) % (W + cl.w * 2)) - cl.w;
        const top = this.env.warm > 0.3 ? "255,225,200" : "255,255,255";
        const under = this.env.warm > 0.3 ? "220,150,140" : "200,215,230";
        g.save();
        g.translate(x, cl.y);
        g.scale(1, 0.62);
        for (const b of cl.blobs) {
          const gr = g.createRadialGradient(b.dx, b.dy - b.r * 0.35, 0, b.dx, b.dy, b.r);
          gr.addColorStop(0, `rgba(${top},${0.5 * (1 - n)})`);
          gr.addColorStop(0.55, `rgba(${under},${0.28 * (1 - n)})`);
          gr.addColorStop(1, `rgba(${under},0)`);
          g.fillStyle = gr;
          g.beginPath();
          g.arc(b.dx, b.dy, b.r, 0, TAU);
          g.fill();
        }
        g.restore();
      }
    }

    // the lagoon glitters, and two canoes drift
    if (this.lagoon) {
      g.save();
      g.clip(this.lagoon);
      for (let k = 0; k < 70; k++) {
        const x = ((k * 97.3) % W) + Math.sin(t * 0.6 + k) * 12;
        const y = H * 0.76 + ((k * 53.1) % (H * 0.24));
        const a = Math.max(0, Math.sin(t * 2.2 + k * 1.7)) * (n > 0.5 ? 0.25 : 0.6);
        g.fillStyle = `rgba(${this.lit},${a})`;
        g.fillRect(x, y, 8 + (k % 4) * 6, 1.4);
      }
      // ripples of light on the sand below
      g.strokeStyle = `rgba(255,255,255,${n > 0.5 ? 0.05 : 0.12})`;
      g.lineWidth = 1;
      for (let k = 0; k < 14; k++) {
        const y = H * 0.82 + k * H * 0.013;
        g.beginPath();
        for (let x = W * 0.2; x <= W; x += 14) g.lineTo(x, y + Math.sin(x * 0.03 + t * 1.5 + k) * 3);
        g.stroke();
      }
      for (const [bx, by, ph] of [[0.66, 0.9, 0], [0.84, 0.84, 2]] as const) {
        const x = W * bx + Math.sin(t * 0.25 + ph) * 18;
        const y = H * by + Math.sin(t * 1.2 + ph) * 1.5;
        const L = 70 * s;
        g.fillStyle = "rgba(0,40,50,0.25)";
        g.beginPath();
        g.ellipse(x, y + 4 * s, L * 0.55, 5 * s, 0, 0, TAU);
        g.fill();
        g.fillStyle = this.c("#6a4428", "#101416", "#5a3420");
        g.beginPath();
        g.moveTo(x - L / 2, y - 5 * s);
        g.quadraticCurveTo(x, y + 8 * s, x + L / 2, y - 6 * s);
        g.quadraticCurveTo(x, y + 1 * s, x - L / 2, y - 5 * s);
        g.fill();
        g.strokeStyle = this.c("#3a2416", "#0a0d0e");
        g.lineWidth = 1.5 * s;
        g.beginPath();
        g.moveTo(x - L * 0.3, y - 9 * s);
        g.lineTo(x + L * 0.25, y - 9 * s);
        g.stroke();
      }
      g.restore();
    }

    if (this.kind === "fire") {
      const fx = W * 0.62, fy = this.treeLineY(W * 0.62) + 34 * s;
      const fl = 0.75 + 0.25 * Math.sin(t * 9) * Math.sin(t * 3.7);
      this.glow(g, fx, fy - 20 * s, 160 * s, "255,130,50", (0.25 + 0.35 * n) * fl);
      for (let i = 0; i < 3; i++) {
        g.fillStyle = i === 0 ? "rgba(255,110,40,0.95)" : i === 1 ? "rgba(255,175,70,0.95)" : "rgba(255,235,165,0.95)";
        const fh = (46 - i * 12) * s * (0.85 + 0.25 * Math.sin(t * (8 + i) + i));
        g.beginPath();
        g.moveTo(fx - (16 - i * 5) * s, fy);
        g.quadraticCurveTo(fx - 6 * s, fy - fh * 0.6, fx + Math.sin(t * 5 + i) * 4 * s, fy - fh);
        g.quadraticCurveTo(fx + 6 * s, fy - fh * 0.5, fx + (16 - i * 5) * s, fy);
        g.fill();
      }
    }
    if (this.kind === "dock" || n > 0.5) {
      for (const h of this.huts) this.glow(g, h.x, h.y - 24 * h.s, 30 * h.s, "255,180,90", (0.15 + 0.25 * n) * (0.85 + 0.15 * Math.sin(t * 5 + h.x)));
    }
    if (this.kind === "reef" || this.kind === "shallows") {
      for (let i = 0; i < 18; i++) {
        const x = W * (0.45 + ((i * 37) % 55) / 100);
        const y = H * (0.86 + ((i * 13) % 12) / 100);
        const tw = 0.5 + 0.5 * Math.sin(t * 2 + i * 1.7);
        this.glow(g, x, y, 12 * s, i % 3 === 0 ? "255,150,200" : "120,245,235", (0.15 + 0.4 * n) * tw);
      }
    }

    // beach palms sway in the breeze
    for (const p of this.palms) this.palm(g, p, t);

    // light: sunbeams by day, fireflies at night
    if (n < 0.6) {
      g.save();
      g.globalCompositeOperation = "lighter";
      for (let k = 0; k < 5; k++) {
        const x0 = W * (0.5 + k * 0.12) + Math.sin(t * 0.2 + k) * 20;
        const a = (0.04 + 0.025 * Math.sin(t * 0.5 + k * 2)) * (1 - n);
        const bg = g.createLinearGradient(x0, 0, x0 - W * 0.3, H);
        bg.addColorStop(0, `rgba(255,240,200,${a})`);
        bg.addColorStop(1, "rgba(255,240,200,0)");
        g.fillStyle = bg;
        g.beginPath();
        g.moveTo(x0, 0);
        g.lineTo(x0 + 50, 0);
        g.lineTo(x0 - W * 0.22, H);
        g.lineTo(x0 - W * 0.3, H);
        g.fill();
      }
      g.restore();
    }
    for (const m of this.motes) {
      const x = (m.x * W + Math.sin(t * m.sp + m.ph) * 30 + W) % W;
      const y = m.y * H + Math.cos(t * m.sp * 1.3 + m.ph) * 20;
      const tw = 0.4 + 0.6 * Math.max(0, Math.sin(t * 2 * m.sp + m.ph));
      if (n > 0.4) this.glow(g, x, y, 9, "255,235,150", 0.6 * tw * n);
      else if (m.y < 0.75) {
        g.fillStyle = `rgba(255,255,240,${0.35 * tw})`;
        g.beginPath();
        g.arc(x, y, m.r * 0.7, 0, TAU);
        g.fill();
      }
    }
    g.restore();

    // foreground frame: big leaves and hibiscus in the corners (they fade as we sink)
    const sink = clamp((this.seed - 1) / 5, 0, 1);
    g.globalAlpha = 1 - sink * 0.75;
    const fx = -this.sm.x * 30, fy = -this.sm.y * 14;
    const leafC = this.c("#2b7a3e", "#06140f", "#4a5a2a");
    const sway = (k: number) => Math.sin(t * 0.8 + k) * 0.035;
    const L = Math.min(W, H * 1.5);
    this.bigLeaf(g, -20 + fx, H * 0.86 + fy, -0.75 + sway(1), L * 0.32, 0.42, leafC);
    this.bigLeaf(g, -30 + fx, H * 0.98 + fy, -0.25 + sway(2), L * 0.38, 0.4, mix("#246a36", "#05110d", n));
    this.bigLeaf(g, W * 0.12 + fx, H + 30 + fy, -1.35 + sway(3), L * 0.3, 0.38, leafC);
    this.bigLeaf(g, W + 20 + fx, -20 + fy, Math.PI * 0.78 + sway(4), L * 0.34, 0.36, mix("#246a36", "#05110d", n));
    this.bigLeaf(g, W + 30 + fx, H * 0.14 + fy, Math.PI * 0.92 + sway(5), L * 0.26, 0.4, leafC);
    this.bigLeaf(g, W + 30 + fx, H + 20 + fy, -Math.PI * 0.72 + sway(6), L * 0.3, 0.4, leafC);
    const fr = (this.mobile ? 28 : 46) * s;
    this.hibiscus(g, W * 0.04 + fx, H * 0.8 + fy, fr * 1.1, 0.3 + sway(7) * 2);
    this.hibiscus(g, W * 0.1 + fx, H * 0.9 + fy, fr, -0.6 + sway(8) * 2);
    this.hibiscus(g, W * 0.02 + fx, H * 0.95 + fy, fr * 0.8, 1.2);
    this.hibiscus(g, W * 0.96 + fx, H * 0.93 + fy, fr * 0.85, 0.9 + sway(9) * 2);

    g.globalAlpha = 1;
    if (sink > 0) this.drawSea(t, sink, s);

    // vignette
    const vg = g.createRadialGradient(W / 2, H * 0.5, Math.min(W, H) * 0.35, W / 2, H * 0.5, Math.max(W, H) * 0.8);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, `rgba(0,10,14,${0.3 + n * 0.3})`);
    g.fillStyle = vg;
    g.fillRect(0, 0, W, H);
  };
}
