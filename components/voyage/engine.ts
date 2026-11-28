import { chapters, cameraAt, activeAt, dockStart, dockEnd, ISLANDS, SEA_END, WAVE_END, type IslandKind } from "@/lib/story";

/* ==================================================================
 *  The Wayfinder: a night voyage drawn on one 2D canvas.
 *  Surface: stars, moon, constellations, living waves, a canoe,
 *  seven islands. Then a storm, a wave that pulls you under, and
 *  a gold ring sinking to the seabed.
 * ================================================================== */

const TAU = Math.PI * 2;
const R = Math.random;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const sstep = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hx = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
export const mixRGB = (a: string, b: string, t: number) => {
  const A = hx(a), B = hx(b);
  return [0, 1, 2].map((i) => Math.round(A[i] + (B[i] - A[i]) * t));
};
export const mix = (a: string, b: string, t: number) => `rgb(${mixRGB(a, b, t).join(",")})`;
const mix3 = (day: string, warm: string, night: string, w: number, n: number) => {
  const d = mixRGB(day, warm, w);
  const dh = "#" + d.map((v) => v.toString(16).padStart(2, "0")).join("");
  return mix(dh, night, n);
};

/** Sky colours through the day: [top, middle, horizon] at time-of-day keyframes. */
const SKY: [number, string, string, string][] = [
  [0.0, "#2b3a6e", "#e28a74", "#ffd39a"],
  [0.1, "#3f78bf", "#9cc8e6", "#ffe6c2"],
  [0.32, "#2c7acc", "#7dbfea", "#d8f1ff"],
  [0.56, "#346fb3", "#98c2e2", "#ffe2b6"],
  [0.7, "#3a3d78", "#df7a6a", "#ffb067"],
  [0.8, "#1b2350", "#5e4677", "#d9846c"],
  [0.92, "#040a18", "#0a1d33", "#1a3a4c"],
  [1.0, "#040a18", "#0a1d33", "#1a3a4c"],
];
export function skyAt(tod: number) {
  let i = 0;
  while (i < SKY.length - 2 && tod > SKY[i + 1][0]) i++;
  const a = SKY[i], b = SKY[i + 1];
  const k = clamp((tod - a[0]) / (b[0] - a[0]), 0, 1);
  return [1, 2, 3].map((c) => mix(a[c] as string, b[c] as string, k));
}

const LAYER_DAY = [
  ["#78c7d3", "#56adc2"],
  ["#63b8ca", "#459cb4"],
  ["#4fa6bd", "#348aa6"],
  ["#3d92ad", "#277896"],
  ["#2e7d99", "#1b6584"],
  ["#206b88", "#13506e"],
];
const LAYER_WARM = [
  ["#d99a86", "#b88378"],
  ["#c48a7d", "#a37572"],
  ["#a97a76", "#8a6870"],
  ["#8c6a70", "#6f5868"],
  ["#6f5a68", "#574a5e"],
  ["#564b5e", "#433e54"],
];

type Particle = { x: number; y: number; vx: number; vy: number; life: number; max: number; r: number; kind: "glow" | "drop" | "spark" };
type Swell = { x: number; t0: number };
type IslandShape = { bumps: { c: number; w: number; h: number }[]; palms: number[]; huts: number[]; stars: { x: number; y: number }[] };

const LAYERS = 6;
const LAYER_BASE = [0.0, 0.07, 0.17, 0.33, 0.58, 0.88];
const LAYER_AMP = [1.0, 2.0, 3.4, 6.0, 9.5, 15];
const LAYER_LEN = [90, 130, 190, 270, 380, 520];
const LAYER_COL = [
  ["#1b4253", "#143545"],
  ["#163a4b", "#10303f"],
  ["#123243", "#0c2836"],
  ["#0e2a39", "#09202c"],
  ["#0a2230", "#061923"],
  ["#071a25", "#04121a"],
];

export class VoyageEngine {
  private g: CanvasRenderingContext2D;
  private W = 0;
  private H = 0;
  private dpr = 1;
  private mobile = false;
  private horizon = 0;
  private spacing = 0;
  private dockX = 0;
  private canoeX = 0;
  private sc = 1;
  private sky!: HTMLCanvasElement;
  private twinkles: { x: number; y: number; r: number; ph: number }[] = [];
  private shapes: IslandShape[] = [];
  private particles: Particle[] = [];
  private swells: Swell[] = [];
  private shooting: { x: number; y: number; vx: number; vy: number; t0: number } | null = null;
  private nextShoot = 3;
  /** a shoal under the surface that scatters away from the cursor */
  private shoal: { x: number; y: number; vx: number; vy: number; ph: number; s: number }[] = [];
  private leaper: { x: number; y: number; t0: number; dir: number; s: number } | null = null;
  private nextLeap = 4;
  private whale: { x: number; t0: number } | null = null;
  private nextWhale = 12;
  private flash = 0;
  private bolt: { x: number; t0: number; pts: { x: number; y: number }[] } | null = null;
  private nextBolt = 0;
  private snow: { x: number; y: number; r: number; sp: number; ph: number; c: number }[] = [];
  private raf = 0;
  private last = 0;
  private prevCam = 0;
  private reduce = false;
  private moveS = 0;
  private lampK = 1;

  private P: Record<string, string> = {};
  private layerCols: string[][] = [];
  private night = 1;
  private lightX = 0;
  private lightRGB = "225,245,255";
  target = 0;
  p = 0;
  mouse = { x: -9999, y: -9999, last: 0 };
  ring = { x: 0, y: 0, r: 0, landed: false };
  onActive?: (i: number) => void;
  onLightning?: () => void;
  anchors: { x: number; y: number; w: number; by: number }[] = [];
  env = { tod: 0, night: 0, warm: 0 };
  paused = false;
  audio = { night: 0, storm: 0, under: 0 };
  onFrame?: (p: number) => void;
  private lastActive = -2;

  constructor(private canvas: HTMLCanvasElement) {
    this.g = canvas.getContext("2d")!;
    this.reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.resize();
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  destroy() {
    cancelAnimationFrame(this.raf);
  }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    this.W = r.width;
    this.H = r.height;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(this.W * this.dpr);
    this.canvas.height = Math.round(this.H * this.dpr);
    this.mobile = this.W < 760;
    this.horizon = this.mobile ? this.H * 0.34 : this.H * 0.58;
    this.sc = this.mobile ? 0.62 : clamp(this.H / 900, 0.75, 1.25);
    this.spacing = this.W * (this.mobile ? 1.1 : 0.95);
    this.dockX = this.W * (this.mobile ? 0.72 : 0.77);
    this.canoeX = this.W * (this.mobile ? 0.34 : 0.6);
    this.buildSky();
    this.shapes = chapters.map((c, i) => this.buildIsland(c.kind, i));
    this.snow = Array.from({ length: this.mobile ? 50 : 110 }, () => ({
      x: R() * this.W, y: R() * this.H, r: 0.5 + R() * 1.6, sp: 0.1 + R() * 0.35, ph: R() * TAU, c: R(),
    }));
  }

  /* ---------------- static sky ---------------- */
  private buildSky() {
    const c = document.createElement("canvas");
    const w = Math.ceil(this.W * 2);
    const h = Math.ceil(this.horizon + 4);
    c.width = Math.ceil(w * this.dpr);
    c.height = Math.ceil(h * this.dpr);
    const g = c.getContext("2d")!;
    g.scale(this.dpr, this.dpr);
    const r = rng(42);
    // milky way: a soft diagonal band of light and dust
    for (let i = 0; i < 160; i++) {
      const u = r();
      const x = u * w;
      const y = h * (0.85 - u * 0.55) + (r() - 0.5) * h * 0.22;
      const rad = 30 + r() * 90;
      const gr = g.createRadialGradient(x, y, 0, x, y, rad);
      const tint = r() < 0.5 ? "150,170,255" : "190,150,230";
      gr.addColorStop(0, `rgba(${tint},${0.035 + r() * 0.035})`);
      gr.addColorStop(1, `rgba(${tint},0)`);
      g.fillStyle = gr;
      g.beginPath();
      g.arc(x, y, rad, 0, TAU);
      g.fill();
    }
    const n = this.mobile ? 900 : 2200;
    for (let i = 0; i < n; i++) {
      const inBand = r() < 0.45;
      const u = r();
      const x = u * w;
      const y = inBand ? h * (0.85 - u * 0.55) + (r() - 0.5) * h * 0.16 : r() * h;
      const s = r() < 0.03 ? 1.3 + r() : 0.3 + r() * 0.7;
      g.globalAlpha = (0.25 + r() * 0.75) * (1 - (y / h) * 0.6);
      g.fillStyle = r() < 0.15 ? "#ffe9c8" : r() < 0.3 ? "#cfe0ff" : "#ffffff";
      g.beginPath();
      g.arc(x, y, s, 0, TAU);
      g.fill();
    }
    g.globalAlpha = 1;
    this.sky = c;
    this.twinkles = Array.from({ length: this.mobile ? 30 : 60 }, () => ({ x: R() * w, y: R() * h * 0.9, r: 0.8 + R() * 1.2, ph: R() * TAU }));
  }

  private buildIsland(kind: IslandKind, i: number): IslandShape {
    const r = rng(100 + i * 17);
    const bumps: IslandShape["bumps"] = [];
    const H = 120;
    if (kind === "shallows") bumps.push({ c: 0, w: 0.8, h: 0.22 * H }, { c: 0.4, w: 0.3, h: 0.12 * H });
    if (kind === "arches") bumps.push({ c: -0.3, w: 0.35, h: 0.9 * H }, { c: 0.35, w: 0.3, h: 0.7 * H }, { c: 0, w: 0.6, h: 0.3 * H });
    if (kind === "reef") bumps.push({ c: -0.1, w: 0.5, h: 0.4 * H }, { c: 0.4, w: 0.3, h: 0.25 * H });
    if (kind === "village") bumps.push({ c: -0.35, w: 0.45, h: 0.75 * H }, { c: 0.2, w: 0.5, h: 0.45 * H });
    if (kind === "summit") bumps.push({ c: 0, w: 0.3, h: 1.25 * H }, { c: -0.4, w: 0.4, h: 0.5 * H }, { c: 0.45, w: 0.35, h: 0.45 * H });
    if (kind === "fire") bumps.push({ c: -0.4, w: 0.4, h: 0.6 * H }, { c: 0.3, w: 0.55, h: 0.35 * H });
    if (kind === "dock") bumps.push({ c: -0.3, w: 0.55, h: 0.55 * H }, { c: 0.25, w: 0.4, h: 0.3 * H });
    const palmN = kind === "summit" ? 2 : kind === "arches" ? 1 : 3 + Math.floor(r() * 2);
    const palms = Array.from({ length: palmN }, () => -0.75 + r() * 1.5);
    const huts = kind === "village" ? [-0.05, 0.22, 0.42] : kind === "dock" ? [0.05] : [];
    const stars = Array.from({ length: 5 }, (_, k) => ({ x: (k / 4 - 0.5) * 0.9 + (r() - 0.5) * 0.18, y: 0.15 + r() * 0.6 }));
    return { bumps, palms, huts, stars };
  }

  /* ---------------- interaction ---------------- */
  pointer(x: number, y: number) {
    const moved = Math.hypot(x - this.mouse.x, y - this.mouse.y);
    this.mouse = { x, y, last: performance.now() };
    if (y > this.horizon + 8 && moved > 6 && R() < 0.5 && this.p < WAVE_END) {
      this.particles.push({ x, y: y + R() * 6, vx: (R() - 0.5) * 0.4, vy: -0.1 - R() * 0.3, life: 0, max: 60 + R() * 40, r: 1.5 + R() * 2.5, kind: "glow" });
    }
  }

  click(x: number, y: number): boolean {
    if (this.ring.landed && Math.hypot(x - this.ring.x, y - this.ring.y) < this.ring.r * 2.2) return true;
    if (this.p >= WAVE_END) {
      for (let i = 0; i < 18; i++) this.particles.push({ x, y, vx: (R() - 0.5) * 3, vy: (R() - 0.5) * 3, life: 0, max: 50 + R() * 40, r: 1.5 + R() * 2, kind: "glow" });
      return false;
    }
    if (y > this.horizon) {
      this.swells.push({ x, t0: performance.now() });
      for (let i = 0; i < 22; i++) {
        const a = -Math.PI / 2 + (R() - 0.5) * 1.6;
        const v = 2 + R() * 4;
        this.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0, max: 40 + R() * 25, r: 1 + R() * 2, kind: "drop" });
      }
      for (let i = 0; i < 16; i++) this.particles.push({ x: x + (R() - 0.5) * 30, y: y + R() * 10, vx: (R() - 0.5) * 1.2, vy: -R() * 0.5, life: 0, max: 80 + R() * 50, r: 2 + R() * 3, kind: "glow" });
    } else {
      this.shooting = { x, y, vx: -(6 + R() * 4), vy: 2.5 + R() * 2, t0: performance.now() };
    }
    return false;
  }

  /* ---------------- waves ---------------- */
  private storm = 0;
  private cam = 0;
  private t = 0;
  private boatY: number | null = null;
  private boatTilt = 0;
  private dtNow = 1;
  private waveY(j: number, x: number, calm = false) {
    const { horizon, H, t } = this;
    const base = horizon + (H - horizon) * LAYER_BASE[j] + 2;
    const amp = LAYER_AMP[j] * (this.mobile ? 0.7 : 1) * (1 + this.storm * 3.2);
    const par = 0.25 + 0.75 * (j / (LAYERS - 1));
    const X = x + this.cam * par;
    const k = TAU / LAYER_LEN[j];
    let y = base + amp * (0.62 * Math.sin(X * k + t * (0.9 + j * 0.12)) + 0.38 * Math.sin(X * k * 2.3 - t * (1.3 + j * 0.1) + j));
    // the ocean is alive: it rises to meet the cursor
    const near = j / (LAYERS - 1);
    if (calm) return y;
    if (performance.now() - this.mouse.last < 2500 && this.mouse.y > horizon) {
      const lift = (this.mobile ? 10 : 22) * near * Math.exp(-Math.pow((this.mouse.y - base) / 140, 2));
      y -= lift * Math.exp(-Math.pow((x - this.mouse.x) / 75, 2));
    }
    for (const s of this.swells) {
      const a = (performance.now() - s.t0) / 1000;
      const rad = a * 230;
      const amp2 = 18 * near * Math.max(0, 1 - a / 2.4);
      y -= amp2 * (Math.exp(-Math.pow((x - s.x - rad) / 45, 2)) + Math.exp(-Math.pow((x - s.x + rad) / 45, 2)));
      if (a < 0.4) y -= 26 * near * (1 - a / 0.4) * Math.exp(-Math.pow((x - s.x) / 30, 2));
    }
    return y;
  }

  private drawLayer(j: number, moonX: number) {
    const g = this.g;
    const { W, H } = this;
    const step = this.mobile ? 10 : 8;
    g.beginPath();
    g.moveTo(0, H + 10);
    for (let x = -step; x <= W + step; x += step) g.lineTo(x, this.waveY(j, x));
    g.lineTo(W + step, H + 10);
    g.closePath();
    const base = this.horizon + (H - this.horizon) * LAYER_BASE[j];
    const fill = g.createLinearGradient(0, base - 20, 0, H);
    fill.addColorStop(0, this.layerCols[j][0]);
    fill.addColorStop(1, this.layerCols[j][1]);
    g.fillStyle = fill;
    g.fill();
    // moonlight catching the crest
    const crest = g.createLinearGradient(0, 0, W, 0);
    const a = (0.1 + 0.05 * (LAYERS - j)) * (1 - this.storm * 0.6);
    const L = this.lightRGB;
    const aa = a * (1.4 - this.night * 0.4);
    crest.addColorStop(0, `rgba(200,230,240,${aa * 0.45})`);
    crest.addColorStop(clamp(moonX / W - 0.15, 0, 1), `rgba(${L},${aa * 0.7})`);
    crest.addColorStop(clamp(moonX / W, 0, 1), `rgba(${L},${aa * 2.4})`);
    crest.addColorStop(clamp(moonX / W + 0.15, 0, 1), `rgba(${L},${aa * 0.7})`);
    crest.addColorStop(1, `rgba(200,230,240,${aa * 0.45})`);
    g.strokeStyle = crest;
    g.lineWidth = 1.2 + j * 0.25;
    g.beginPath();
    for (let x = -step; x <= W + step; x += step) {
      const y = this.waveY(j, x);
      if (x === -step) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
  }

  /* ---------------- islands ---------------- */
  private islandBaseY() {
    return this.horizon + (this.H - this.horizon) * 0.12;
  }

  private drawPalm(px: number, py: number, h: number, lean: number, s: number, seed: number) {
    const g = this.g;
    const t = this.t;
    const sway = Math.sin(t * 0.9 + seed * 3) * 0.06;
    const top = { x: px + lean + Math.sin(t * 0.9 + seed * 3) * 2 * s, y: py - h };
    const ctrl = { x: px + lean * 0.15, y: py - h * 0.55 };
    // tapered trunk
    const N = 10;
    const L: { x: number; y: number }[] = [];
    const Rt: { x: number; y: number }[] = [];
    for (let k = 0; k <= N; k++) {
      const u = k / N;
      const x = (1 - u) * (1 - u) * px + 2 * (1 - u) * u * ctrl.x + u * u * top.x;
      const y = (1 - u) * (1 - u) * py + 2 * (1 - u) * u * ctrl.y + u * u * top.y;
      const wdt = (3.4 - 1.8 * u) * s;
      L.push({ x: x - wdt, y });
      Rt.push({ x: x + wdt, y });
    }
    g.fillStyle = this.P.trunk;
    g.beginPath();
    L.forEach((p, k) => (k ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
    for (let k = Rt.length - 1; k >= 0; k--) g.lineTo(Rt[k].x, Rt[k].y);
    g.closePath();
    g.fill();
    // moonlit edge of the trunk
    g.strokeStyle = `rgba(${this.P.rim},0.22)`;
    g.lineWidth = 1;
    g.beginPath();
    Rt.forEach((p, k) => (k ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
    g.stroke();
    // fronds: tapered, drooping leaves
    const fronds = 9;
    for (let f = 0; f < fronds; f++) {
      const a = -Math.PI + (f / (fronds - 1)) * Math.PI + (f % 2 ? 0.08 : -0.05) + sway;
      const fl = (26 + ((seed * 7 + f * 3) % 5) * 2.5) * s;
      const tip = { x: top.x + Math.cos(a) * fl, y: top.y + Math.sin(a) * fl * 0.55 + fl * 0.55 * Math.abs(Math.cos(a)) + 4 * s };
      const mid = { x: (top.x + tip.x) / 2, y: (top.y + tip.y) / 2 - fl * 0.22 };
      const nx = -(tip.y - top.y), ny = tip.x - top.x;
      const nl = Math.hypot(nx, ny) || 1;
      const wv = 5 * s;
      g.fillStyle = this.P.frond;
      g.beginPath();
      g.moveTo(top.x, top.y);
      g.quadraticCurveTo(mid.x + (nx / nl) * wv, mid.y + (ny / nl) * wv, tip.x, tip.y);
      g.quadraticCurveTo(mid.x - (nx / nl) * wv * 0.4, mid.y - (ny / nl) * wv * 0.4, top.x, top.y);
      g.fill();
      if (Math.cos(a) > 0.1) {
        g.strokeStyle = `rgba(${this.P.rim},0.2)`;
        g.beginPath();
        g.moveTo(top.x, top.y);
        g.quadraticCurveTo(mid.x, mid.y, tip.x, tip.y);
        g.stroke();
      }
    }
    g.fillStyle = this.P.nut;
    for (let c = 0; c < 3; c++) {
      g.beginPath();
      g.arc(top.x - 2 * s + c * 2.2 * s, top.y + 3 * s, 1.8 * s, 0, TAU);
      g.fill();
    }
  }

  private drawIsland(i: number, x: number, active: number, now: number) {
    const g = this.g;
    const kind = chapters[i].kind;
    const shape = this.shapes[i];
    const s = this.sc * (this.mobile ? 0.85 : 1);
    const w = 430 * s;
    const by = this.islandBaseY();
    const t = this.t;
    const seed = i * 13.7;
    const hAt = (u: number, k = 1.3) => {
      let h = 0;
      for (const b of shape.bumps) h += b.h * Math.exp(-Math.pow((u - b.c) / b.w, 2));
      return h * k * Math.pow(Math.max(0, 1 - u * u), 0.45) * s;
    };
    const land = (scaleH: number, shift: number, widen: number) => {
      const path = new Path2D();
      const ww = w * widen;
      path.moveTo(x + shift - ww / 2, by);
      for (let k = 0; k <= 80; k++) {
        const u = -1 + (k / 80) * 2;
        path.lineTo(x + shift + (u * ww) / 2, by - hAt(u, 1.3 * scaleH));
      }
      path.lineTo(x + shift + ww / 2, by);
      path.closePath();
      return path;
    };

    // reflection, squashed and broken up by the water
    g.save();
    g.beginPath();
    g.rect(x - w, by, w * 2, 200 * s);
    g.clip();
    g.translate(0, by);
    g.scale(1, -0.5);
    g.translate(0, -by);
    g.globalAlpha = 0.3;
    g.fillStyle = this.P.reflect;
    g.fill(land(1, 0, 1));
    g.restore();
    for (let k = 0; k < 7; k++) {
      const yy = by + 6 * s + k * 9 * s;
      const ww2 = w * (0.7 - k * 0.07) * (0.85 + 0.15 * Math.sin(t * 1.4 + k + seed));
      g.fillStyle = `rgba(${this.P.rim},${0.08 - k * 0.008})`;
      g.fillRect(x - ww2 / 2 + Math.sin(t + k * 2) * 6 * s, yy, ww2, 1.2 * s);
    }

    // hazy back ridge for depth
    g.fillStyle = this.P.ridge;
    g.fill(land(kind === "summit" ? 0.55 : 1.18, -w * 0.12, 0.9));

    // main land: lit from the moon on the right
    const main = land(1, 0, 1);
    if (kind === "arches") {
      main.moveTo(x - w * 0.02 + w * 0.085, by);
      main.ellipse(x - w * 0.02, by, w * 0.085, 54 * s, 0, 0, Math.PI, true);
      main.closePath();
    }
    const lg = g.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
    lg.addColorStop(0, this.P.landDark);
    lg.addColorStop(0.6, this.P.landMid);
    lg.addColorStop(1, this.P.landLit);
    g.fillStyle = lg;
    g.fill(main, "evenodd");

    // jungle canopy: a soft bumpy edge of tree crowns
    const r = rng(500 + i);
    for (let u = -0.88; u <= 0.88; u += 0.028) {
      const h = hAt(u);
      if (h < 16 * s || (kind === "arches" && Math.abs(u + 0.04) < 0.2)) continue;
      const cx = x + (u * w) / 2;
      const cy = by - h + 3 * s;
      const rad = (4 + r() * 5) * s;
      g.fillStyle = u > 0.2 ? this.P.canopyLit : this.P.canopyDark;
      g.beginPath();
      g.arc(cx, cy, rad, 0, TAU);
      g.fill();
      if (u > -0.2) {
        g.strokeStyle = `rgba(${this.P.rim},${0.14 + 0.22 * Math.max(0, u)})`;
        g.lineWidth = 1;
        g.beginPath();
        g.arc(cx, cy, rad, -Math.PI * 0.75, -Math.PI * 0.1);
        g.stroke();
      }
    }

    // beach, rocks and gentle surf
    const sand = g.createLinearGradient(0, by - 8 * s, 0, by + 3 * s);
    sand.addColorStop(0, this.P.sandTop);
    sand.addColorStop(1, this.P.sandBot);
    g.fillStyle = sand;
    g.beginPath();
    g.moveTo(x - w * 0.5, by + 1);
    g.quadraticCurveTo(x, by - 12 * s, x + w * 0.5, by + 1);
    g.lineTo(x + w * 0.5, by + 3 * s);
    g.lineTo(x - w * 0.5, by + 3 * s);
    g.closePath();
    g.fill();
    g.fillStyle = this.P.rock;
    for (const ru of [-0.46, -0.41, 0.44]) {
      g.beginPath();
      g.ellipse(x + (ru * w) / 2 * 2, by - 1 * s, 9 * s, 6 * s, 0, Math.PI, 0);
      g.fill();
    }
    for (let k = 0; k < 14; k++) {
      const u = -0.95 + (k / 13) * 1.9;
      const fx = x + (u * w) / 2;
      const a = 0.25 + 0.35 * Math.max(0, Math.sin(t * 1.6 - k * 0.7 + seed));
      g.strokeStyle = `rgba(225,245,250,${a})`;
      g.lineWidth = 1.2;
      g.beginPath();
      g.moveTo(fx - 12 * s, by + 3 * s + Math.sin(t * 1.6 + k) * 1.2);
      g.quadraticCurveTo(fx, by + 1 * s, fx + 12 * s, by + 3 * s + Math.sin(t * 1.6 + k + 1) * 1.2);
      g.stroke();
    }

    // palms on the beach
    shape.palms.forEach((u, k) => {
      const px = x + (u * w) / 2;
      const py = by - Math.min(hAt(u), 30 * s) + 2 * s;
      const ph = (48 + ((k * 17 + i * 5) % 30)) * s;
      this.drawPalm(px, py, ph, (u > 0 ? 1 : -1) * (10 + ((k * 7) % 12)) * s, s, k + i);
    });

    // stilt huts with warm light and chimney smoke
    for (const u of shape.huts) {
      const hx = x + (u * w) / 2;
      const hy = by - Math.min(hAt(u), 22 * s);
      g.strokeStyle = this.P.post;
      g.lineWidth = 1.6 * s;
      for (const sx of [-9, 9]) {
        g.beginPath();
        g.moveTo(hx + sx * s, hy);
        g.lineTo(hx + sx * s, hy - 8 * s);
        g.stroke();
      }
      g.fillStyle = this.P.hutWall;
      g.fillRect(hx - 12 * s, hy - 20 * s, 24 * s, 12 * s);
      g.fillStyle = this.P.hutRoof;
      g.beginPath();
      g.moveTo(hx - 18 * s, hy - 19 * s);
      g.quadraticCurveTo(hx, hy - 40 * s, hx + 18 * s, hy - 19 * s);
      g.closePath();
      g.fill();
      g.strokeStyle = `rgba(${this.P.rim},0.25)`;
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(hx, hy - 33 * s);
      g.quadraticCurveTo(hx + 10 * s, hy - 28 * s, hx + 18 * s, hy - 19 * s);
      g.stroke();
      const flick = 0.75 + 0.25 * Math.sin(t * 6 + u * 9) * Math.sin(t * 2.3 + u);
      this.glow(hx, hy - 14 * s, 30 * s, `rgba(255,180,90,${0.35 * flick * this.lampK})`);
      g.fillStyle = `rgba(255,205,120,${0.95 * flick})`;
      g.fillRect(hx - 4 * s, hy - 17 * s, 8 * s, 6 * s);
      this.reflection(hx, by, "255,195,110", flick * this.lampK, s);
      for (let k = 0; k < 4; k++) {
        const life = (t * 0.25 + k * 0.25 + u) % 1;
        g.fillStyle = `rgba(170,185,195,${0.12 * (1 - life)})`;
        g.beginPath();
        g.arc(hx + 6 * s + Math.sin(life * 6 + k) * 6 * s + life * 14 * s, hy - 36 * s - life * 50 * s, (4 + life * 10) * s, 0, TAU);
        g.fill();
      }
    }

    if (kind === "dock") {
      g.strokeStyle = this.P.post;
      g.lineWidth = 3 * s;
      const dx0 = x - w * 0.32;
      g.beginPath();
      g.moveTo(dx0, by - 5 * s);
      g.lineTo(dx0 - 110 * s, by - 5 * s);
      g.stroke();
      for (let k = 0; k < 5; k++) {
        const px = dx0 - k * 27 * s;
        g.beginPath();
        g.moveTo(px, by - 5 * s);
        g.lineTo(px, by + 9 * s);
        g.stroke();
      }
      for (const px of [dx0 - 108 * s, dx0 - 40 * s]) {
        g.beginPath();
        g.moveTo(px, by - 5 * s);
        g.lineTo(px, by - 28 * s);
        g.stroke();
        const fl = 0.8 + 0.2 * Math.sin(t * 5 + px);
        this.glow(px, by - 30 * s, 26 * s, `rgba(255,200,110,${0.5 * fl * this.lampK})`);
        g.fillStyle = `rgba(255,220,150,${fl})`;
        g.fillRect(px - 2.5 * s, by - 33 * s, 5 * s, 6 * s);
        this.reflection(px, by, "255,200,120", fl * this.lampK, s);
      }
    }
    if (kind === "fire") {
      const fx = x + w * 0.06;
      const fy = by - 4 * s;
      const fl = 0.75 + 0.25 * Math.sin(t * 9) * Math.sin(t * 3.7);
      this.glow(fx, fy - 10 * s, 110 * s, `rgba(255,130,50,${0.32 * fl * this.lampK})`);
      for (let k = 0; k < 3; k++) {
        g.fillStyle = k === 0 ? "rgba(255,110,40,0.9)" : k === 1 ? "rgba(255,175,70,0.92)" : "rgba(255,235,165,0.95)";
        const fh = (30 - k * 8) * s * (0.85 + 0.25 * Math.sin(t * (8 + k) + k));
        g.beginPath();
        g.moveTo(fx - (10 - k * 3) * s, fy);
        g.quadraticCurveTo(fx - 5 * s + Math.sin(t * 7) * 2, fy - fh * 0.6, fx + Math.sin(t * 5 + k) * 3 * s, fy - fh);
        g.quadraticCurveTo(fx + 5 * s, fy - fh * 0.5, fx + (10 - k * 3) * s, fy);
        g.fill();
      }
      // people gathered around the fire, as silhouettes
      g.fillStyle = this.P.people;
      for (const ox of [-30, -18, 20, 33]) {
        const hx = fx + ox * s;
        g.beginPath();
        g.arc(hx, fy - 15 * s, 3.4 * s, 0, TAU);
        g.fill();
        g.beginPath();
        g.moveTo(hx - 5 * s, fy);
        g.quadraticCurveTo(hx, fy - 16 * s, hx + 5 * s, fy);
        g.fill();
      }
      for (let k = 0; k < 14; k++) {
        const life = (t * 0.55 + k * 0.137) % 1;
        g.fillStyle = `rgba(255,190,90,${(1 - life) * 0.9})`;
        g.beginPath();
        g.arc(fx + Math.sin(k * 3.1 + t * 2) * 14 * s * life, fy - 24 * s - life * 110 * s, 1.4 * s, 0, TAU);
        g.fill();
      }
      this.reflection(fx, by, "255,150,70", fl * this.lampK, s * 1.5);
    }
    if (kind === "summit") {
      const pulse = 0.7 + 0.3 * Math.sin(t * 1.5);
      const top = by - hAt(0);
      this.glow(x, top + 6 * s, 90 * s, `rgba(240,196,90,${0.42 * pulse})`);
      g.strokeStyle = `rgba(250,215,120,${0.85 * pulse})`;
      g.lineWidth = 2;
      g.beginPath();
      for (let k = 0; k <= 24; k++) {
        const u = -0.16 + (k / 24) * 0.32;
        const y = by - hAt(u);
        if (k === 0) g.moveTo(x + (u * w) / 2, y);
        else g.lineTo(x + (u * w) / 2, y);
      }
      g.stroke();
      // a thread of gold running down the mountain
      g.strokeStyle = `rgba(240,200,110,${0.35 * pulse})`;
      g.lineWidth = 1.2;
      g.beginPath();
      g.moveTo(x, top + 4 * s);
      for (let k = 1; k <= 12; k++) g.lineTo(x + Math.sin(k * 1.7) * 6 * s + k * 3 * s, top + k * ((by - top) / 13));
      g.stroke();
      this.reflection(x, by, "240,200,110", pulse * 0.8, s);
    }
    if (kind === "reef" || kind === "shallows") {
      for (let k = 0; k < (kind === "reef" ? 34 : 14); k++) {
        const u = Math.sin(k * 12.9898 + seed) * 0.5 + 0.5;
        const rx = x + (u - 0.5) * w * 1.2;
        const ry = by + 6 * s + ((k * 7) % 24) * s;
        const tw = 0.5 + 0.5 * Math.sin(t * 2 + k * 1.7);
        const col = k % 3 === 0 ? "255,140,200" : k % 3 === 1 ? "90,235,230" : "150,180,255";
        this.glow(rx, ry, 8 * s, `rgba(${col},${0.55 * tw})`);
      }
    }
    // low mist hugging the shore
    g.save();
    g.translate(x, by - 4 * s);
    g.scale(1, 0.12);
    const mist = g.createRadialGradient(0, 0, 0, 0, 0, w * 0.7);
    mist.addColorStop(0, `rgba(${this.P.mist},0.2)`);
    mist.addColorStop(1, `rgba(${this.P.mist},0)`);
    g.fillStyle = mist;
    g.beginPath();
    g.arc(0, 0, w * 0.7, 0, TAU);
    g.fill();
    g.restore();

    this.anchors[i] = { x, y: by - hAt(0), w, by };
    // name, once you are close
    const near = sstep(-0.55, 0, -Math.abs(x - this.dockX) / this.W);
    if (near > 0.01) {
      const topY = by - hAt(0) - (kind === "summit" ? 34 : 52) * s;
      g.globalAlpha = near;
      g.fillStyle = "rgba(255,255,255,0.95)";
      g.shadowColor = "rgba(0,20,30,0.6)";
      g.shadowBlur = 10;
      g.font = `italic ${Math.round((this.mobile ? 17 : 22) * this.sc)}px "Instrument Serif", Georgia, serif`;
      g.textAlign = "center";
      g.fillText(`${chapters[i].n} · ${chapters[i].island}`, x, topY);
      g.font = `600 ${Math.round((this.mobile ? 11 : 13) * this.sc)}px "DM Sans Variable", system-ui, sans-serif`;
      g.fillStyle = "rgba(255,226,150,0.95)";
      g.fillText(chapters[i].year.toUpperCase(), x, topY + (this.mobile ? 15 : 22) * this.sc);
      g.shadowBlur = 0;
      g.globalAlpha = 1;
    }
    if (active === i) {
      const bx = x - w * 0.4;
      const bob = Math.sin(t * 3) * 0.15 + 0.85;
      g.strokeStyle = this.P.post;
      g.lineWidth = 2 * s;
      g.beginPath();
      g.moveTo(bx, by);
      g.lineTo(bx, by - 24 * s);
      g.stroke();
      this.glow(bx, by - 26 * s, 34 * s, `rgba(255,200,110,${0.6 * bob})`);
      g.fillStyle = "#ffd98a";
      g.beginPath();
      g.arc(bx, by - 26 * s, 2.6 * s, 0, TAU);
      g.fill();
    }
  }

  private glow(x: number, y: number, r: number, col: string) {
    const g = this.g;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, col);
    gr.addColorStop(1, col.replace(/[\d.]+\)$/, "0)"));
    g.fillStyle = gr;
    g.beginPath();
    g.arc(x, y, r, 0, TAU);
    g.fill();
  }

  private reflection(x: number, by: number, rgb: string, k: number, s: number) {
    const g = this.g;
    for (let n = 0; n < 6; n++) {
      const y = by + 6 * s + n * 7 * s;
      const w = (10 - n) * 1.6 * s * (0.7 + 0.3 * Math.sin(this.t * 3 + n * 1.7));
      g.fillStyle = `rgba(${rgb},${(0.35 - n * 0.05) * k})`;
      g.fillRect(x - w / 2 + Math.sin(this.t * 2 + n) * 3 * s, y, w, 1.6 * s);
    }
  }



  /* ---------------- canoe ---------------- */
  private drawCanoe(moving: number) {
    const g = this.g;
    const t = this.t;
    const s = this.sc * (this.mobile ? 1.4 : 2.05);
    const cx = this.canoeX;
    const L = 150 * s;
    // the canoe rides a calm version of the swell (no cursor ripples), filtered so it rocks gently
    const calm = (x: number) => this.waveY(3, x, true);
    const rawY = (calm(cx - L * 0.3) + calm(cx) + calm(cx + L * 0.3)) / 3 - 2 * s;
    const rawTilt = Math.atan2(calm(cx + L * 0.4) - calm(cx - L * 0.4), L * 0.8) * 0.7 - moving * 0.035;
    const k = 1 - Math.pow(0.92, this.dtNow);
    this.boatY = this.boatY === null ? rawY : this.boatY + (rawY - this.boatY) * k;
    this.boatTilt += (rawTilt - this.boatTilt) * k * 0.8;
    const cy = this.boatY + Math.sin(t * 1.1) * 1.2 * s;
    const tilt = this.boatTilt + Math.sin(t * 0.8 + 1) * 0.012;
    g.save();
    g.translate(cx, cy);
    g.rotate(tilt);
    // outrigger, seen a little behind the hull
    g.strokeStyle = this.P.hull1;
    g.lineWidth = 2 * s;
    for (const bx of [-0.2, 0.18]) {
      g.beginPath();
      g.moveTo(bx * L, -8 * s);
      g.lineTo(bx * L + 6 * s, -15 * s);
      g.stroke();
    }
    g.fillStyle = this.P.hull1;
    g.beginPath();
    g.ellipse(0, -15 * s, L * 0.33, 3 * s, 0, 0, TAU);
    g.fill();
    // hull
    g.beginPath();
    g.moveTo(-L * 0.52, -14 * s);
    g.quadraticCurveTo(-L * 0.2, -4 * s, 0, -5 * s);
    g.quadraticCurveTo(L * 0.25, -4 * s, L * 0.52, -17 * s);
    g.quadraticCurveTo(L * 0.3, 9 * s, 0, 9 * s);
    g.quadraticCurveTo(-L * 0.32, 9 * s, -L * 0.52, -14 * s);
    g.closePath();
    const hg = g.createLinearGradient(0, -10 * s, 0, 10 * s);
    hg.addColorStop(0, this.P.hull0);
    hg.addColorStop(1, this.P.hull1);
    g.fillStyle = hg;
    g.fill();
    g.strokeStyle = "rgba(230,205,160,0.35)";
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(-L * 0.52, -14 * s);
    g.quadraticCurveTo(-L * 0.2, -4 * s, 0, -5 * s);
    g.quadraticCurveTo(L * 0.25, -4 * s, L * 0.52, -17 * s);
    g.stroke();
    // mast + crab-claw sail
    const foot = { x: -L * 0.12, y: -6 * s };
    const fill = 0.55 + 0.45 * moving;
    const up = { x: L * 0.22, y: -L * 1.0 };
    const low = { x: L * (0.36 + 0.06 * fill), y: -L * 0.34 };
    g.beginPath();
    g.moveTo(foot.x, foot.y);
    g.quadraticCurveTo(-L * 0.12, -L * 0.62, up.x, up.y);
    g.quadraticCurveTo(L * (0.06 + 0.1 * fill), -L * 0.58, low.x, low.y);
    g.quadraticCurveTo(L * 0.16, -L * 0.12, foot.x, foot.y);
    g.closePath();
    const sg = g.createLinearGradient(-L * 0.1, -L, L * 0.4, -L * 0.2);
    sg.addColorStop(0, "rgba(226,208,170,0.95)");
    sg.addColorStop(1, "rgba(140,120,92,0.95)");
    g.fillStyle = sg;
    g.fill();
    // woven seams
    g.strokeStyle = "rgba(90,70,48,0.35)";
    g.lineWidth = 1;
    for (let k = 1; k < 5; k++) {
      const f = k / 5;
      g.beginPath();
      g.moveTo(foot.x + (up.x - foot.x) * f * 0.95, foot.y + (up.y - foot.y) * f * 0.95);
      g.lineTo(foot.x + (low.x - foot.x) * f, foot.y + (low.y - foot.y) * f);
      g.stroke();
    }
    g.strokeStyle = this.P.spar;
    g.lineWidth = 2.6 * s;
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(foot.x, foot.y);
    g.quadraticCurveTo(-L * 0.12, -L * 0.62, up.x, up.y);
    g.moveTo(foot.x, foot.y);
    g.quadraticCurveTo(L * 0.16, -L * 0.12, low.x, low.y);
    g.stroke();
    // lantern at the stern
    const lx = -L * 0.42;
    const ly = -30 * s;
    g.lineWidth = 1.6 * s;
    g.beginPath();
    g.moveTo(lx, -10 * s);
    g.lineTo(lx, ly);
    g.stroke();
    const fl = 0.8 + 0.2 * Math.sin(t * 7) * Math.sin(t * 2.9);
    g.restore();
    const wx = cx + Math.cos(tilt) * lx - Math.sin(tilt) * ly;
    const wy = cy + Math.sin(tilt) * lx + Math.cos(tilt) * ly;
    this.glow(wx, wy, 60 * s, `rgba(255,196,100,${0.32 * fl * this.lampK})`);
    this.glow(wx, wy, 10 * s, `rgba(255,225,150,${0.9 * fl})`);
    // waterline: a thin band of sea laps over the hull, tapering at both ends
    const g2 = this.g;
    const half = L * 0.56;
    const top: { x: number; y: number }[] = [];
    for (let x = cx - half; x <= cx + half; x += 5) top.push({ x, y: cy + 6 * s + (x - cx) * Math.tan(tilt) + Math.sin(x * 0.08 + t * 3) * 1.4 * s });
    g2.beginPath();
    top.forEach((pt, k) => (k ? g2.lineTo(pt.x, pt.y) : g2.moveTo(pt.x, pt.y)));
    for (let k = top.length - 1; k >= 0; k--) {
      const u = (top[k].x - cx) / half;
      g2.lineTo(top[k].x, top[k].y + 12 * s * (1 - u * u));
    }
    g2.closePath();
    g2.fillStyle = this.layerCols[3][0];
    g2.fill();
    g2.strokeStyle = "rgba(170,220,235,0.35)";
    g2.lineWidth = 1;
    g2.beginPath();
    top.forEach((pt, k) => (k ? g2.lineTo(pt.x, pt.y) : g2.moveTo(pt.x, pt.y)));
    g2.stroke();
    // bioluminescent wake and bow spray while sailing
    if (moving > 0.2 && R() < moving * 0.9) {
      this.particles.push({ x: cx - L * 0.5, y: cy + 4 * s, vx: -1 - R(), vy: (R() - 0.5) * 0.3, life: 0, max: 90 + R() * 60, r: 1.5 + R() * 2.5, kind: "glow" });
      if (R() < 0.5) this.particles.push({ x: cx + L * 0.5, y: cy - 6 * s, vx: 1 + R() * 2, vy: -1.5 - R() * 2, life: 0, max: 30, r: 1 + R(), kind: "drop" });
    }
  }


  /* ---------------- dolphins ---------------- */
  private pods: { dir: number; x: number; x0: number; speed: number; layer: number; s: number; members: { off: number; ph: number; above: boolean }[] }[] = [];
  private nextPod = 2.5;

  private dolphinPath() {
    const d = new Path2D();
    d.moveTo(32, 1);
    d.quadraticCurveTo(29, -2, 24, -3);
    d.quadraticCurveTo(20, -9, 10, -9.5);
    d.bezierCurveTo(-2, -10, -16, -7, -24, -2.5);
    d.quadraticCurveTo(-28, -1.5, -30, -1);
    d.lineTo(-38, -8);
    d.quadraticCurveTo(-35, -1, -34, 0);
    d.quadraticCurveTo(-35, 1, -38, 8);
    d.lineTo(-30, 1);
    d.quadraticCurveTo(-20, 5, -6, 7.5);
    d.bezierCurveTo(6, 9, 18, 7, 26, 3);
    d.quadraticCurveTo(30, 2.5, 32, 1);
    d.closePath();
    d.moveTo(2, -9.5);
    d.quadraticCurveTo(-1, -19, -9, -19.5);
    d.quadraticCurveTo(-6, -14, -8, -8.5);
    d.closePath();
    d.moveTo(12, 5);
    d.quadraticCurveTo(9, 12, 4, 13);
    d.quadraticCurveTo(7, 9, 7, 6);
    d.closePath();
    return d;
  }
  private dPath: Path2D | null = null;

  private updatePods(dt: number) {
    if (!this.pods.length && this.t > this.nextPod && this.storm < 0.15 && this.p < 0.68) {
      const dir = R() < 0.5 ? 1 : -1;
      const layer = R() < 0.6 ? 2 : 4;
      const s = this.sc * (layer === 2 ? 1.05 : 1.5) * (this.mobile ? 0.75 : 1);
      const n = 3 + Math.floor(R() * 4);
      const x0 = dir > 0 ? -120 * s : this.W + 120 * s;
      this.pods.push({
        dir, x: x0, x0, layer, s, speed: (2.4 + R() * 0.8) * s * (this.mobile ? 1.3 : 1),
        members: Array.from({ length: n }, (_, k) => ({ off: -dir * k * (34 + R() * 26) * s, ph: -k * 0.9 + (R() - 0.5) * 0.5, above: false })),
      });
      this.nextPod = this.t + 6 + R() * 7;
    }
    for (const pod of this.pods) pod.x += pod.dir * pod.speed * dt;
    this.pods = this.pods.filter((pod) => {
      const xs = pod.members.map((m) => pod.x + m.off);
      return pod.dir > 0 ? Math.min(...xs) < this.W + 160 : Math.max(...xs) > -160;
    });
  }

  private drawPods(layer: number) {
    const g = this.g;
    if (!this.dPath) this.dPath = this.dolphinPath();
    for (const pod of this.pods) {
      if (pod.layer !== layer) continue;
      const s = pod.s;
      const leapLen = 210 * s;
      const leapH = (layer === 2 ? 42 : 58) * s;
      g.save();
      // only what is above the water is visible
      g.beginPath();
      g.moveTo(-10, -10);
      g.lineTo(this.W + 10, -10);
      for (let x = this.W + 10; x >= -10; x -= 12) g.lineTo(x, this.waveY(layer, x, true) + 3);
      g.closePath();
      g.clip();
      for (const m of pod.members) {
        const x = pod.x + m.off;
        const ph = ((x - pod.x0) * pod.dir) / leapLen * TAU + m.ph;
        const h = Math.sin(ph);
        const base = this.waveY(layer, x, true) + 6 * s;
        const above = h > 0;
        if (above !== m.above) {
          m.above = above;
          if (x > -40 && x < this.W + 40) this.splash(x, base - 4 * s, layer === 2 ? 6 : 12);
        }
        if (!above) continue;
        const y = base - h * leapH;
        const slope = -Math.cos(ph) * leapH * (TAU / leapLen);
        g.save();
        g.translate(x, y);
        g.scale(pod.dir, 1);
        g.rotate(Math.atan(slope));
        g.scale(s * 1.05, s * 1.05);
        const body = g.createLinearGradient(0, -10, 0, 9);
        body.addColorStop(0, "#1a3140");
        body.addColorStop(0.55, "#2c4756");
        body.addColorStop(1, "#7d939c");
        g.fillStyle = body;
        g.fill(this.dPath);
        g.strokeStyle = "rgba(200,232,242,0.35)";
        g.lineWidth = 0.9 / s;
        g.stroke(this.dPath);
        g.fillStyle = "#08131a";
        g.beginPath();
        g.arc(19, -3, 1.1, 0, TAU);
        g.fill();
        g.restore();
        if (R() < 0.25) this.particles.push({ x: x - pod.dir * 30 * s, y: y + 2 * s, vx: -pod.dir * 0.5 + (R() - 0.5), vy: 0.5, life: 0, max: 30, r: 0.8 + R(), kind: "drop" });
      }
      g.restore();
    }
  }

  /* ---------------- life on the surface ---------------- */
  private gulls: { x: number; y: number; dir: number; members: { dx: number; dy: number; ph: number }[] } | null = null;
  private nextGulls = 1.5;
  private drawLife(now: number) {
    const g = this.g;
    const t = this.t;
    // gulls glide across the daytime sky
    if (!this.gulls && t > this.nextGulls && this.night < 0.3 && this.storm < 0.1) {
      const dir = R() < 0.5 ? 1 : -1;
      this.gulls = {
        x: dir > 0 ? -60 : this.W + 60, y: this.horizon * (0.25 + R() * 0.35), dir,
        members: Array.from({ length: 3 + Math.floor(R() * 4) }, (_, k) => ({ dx: -dir * k * (22 + R() * 14), dy: (k % 2 ? 1 : -1) * k * 8 + (R() - 0.5) * 6, ph: R() * TAU })),
      };
      this.nextGulls = t + 7 + R() * 8;
    }
    if (this.gulls) {
      const G = this.gulls;
      G.x += G.dir * 1.3 * this.sc;
      G.y += Math.sin(t * 0.7) * 0.15;
      g.strokeStyle = `rgba(${this.night > 0.2 ? "20,30,40" : "40,50,60"},${0.75 * (1 - this.night)})`;
      g.lineWidth = 1.6;
      g.lineCap = "round";
      for (const m of G.members) {
        const x = G.x + m.dx, y = G.y + m.dy;
        const f = Math.sin(t * 6 + m.ph) * 4 * this.sc;
        const w = 9 * this.sc;
        g.beginPath();
        g.moveTo(x - w, y - f);
        g.quadraticCurveTo(x - w * 0.4, y - 4 * this.sc, x, y);
        g.quadraticCurveTo(x + w * 0.4, y - 4 * this.sc, x + w, y - f);
        g.stroke();
      }
      const xs = G.members.map((m) => G.x + m.dx);
      if ((G.dir > 0 && Math.min(...xs) > this.W + 40) || (G.dir < 0 && Math.max(...xs) < -40)) this.gulls = null;
    }
    // a fish leaps
    if (!this.leaper && t > this.nextLeap && this.storm < 0.3) {
      const dir = R() < 0.5 ? 1 : -1;
      this.leaper = { x: this.W * (0.1 + R() * 0.8), y: this.waveY(2, 0) + 10, t0: now, dir, s: this.sc * (0.7 + R() * 0.5) };
      this.nextLeap = t + 5 + R() * 7;
    }
    if (this.leaper) {
      const L = this.leaper;
      const a = (now - L.t0) / 1100;
      if (a > 1) {
        this.splash(L.x + L.dir * 90 * L.s, L.y, 10);
        this.leaper = null;
      } else {
        if (a < 0.05 && R() < 0.5) this.splash(L.x, L.y, 6);
        const x = L.x + L.dir * a * 90 * L.s;
        const y = L.y - Math.sin(a * Math.PI) * 70 * L.s;
        const ang = Math.atan2(-Math.cos(a * Math.PI) * 70 * L.s * Math.PI, L.dir * 90 * L.s);
        g.save();
        g.translate(x, y);
        g.rotate(L.dir > 0 ? ang : Math.PI - ang);
        g.scale(L.s, L.dir > 0 ? L.s : -L.s);
        g.fillStyle = "#0b1a22";
        g.beginPath();
        g.moveTo(14, 0);
        g.quadraticCurveTo(4, -6, -8, -1);
        g.lineTo(-16, -6);
        g.lineTo(-13, 0);
        g.lineTo(-16, 6);
        g.lineTo(-8, 1);
        g.quadraticCurveTo(4, 6, 14, 0);
        g.fill();
        g.strokeStyle = "rgba(200,230,240,0.35)";
        g.lineWidth = 1;
        g.stroke();
        g.restore();
      }
    }
    // a whale shows its tail far away
    if (!this.whale && t > this.nextWhale && this.storm < 0.2) {
      this.whale = { x: this.W * (0.15 + R() * 0.7), t0: now };
      this.nextWhale = t + 16 + R() * 14;
    }
    if (this.whale) {
      const a = (now - this.whale.t0) / 3200;
      if (a > 1) this.whale = null;
      else {
        const by = this.waveY(1, this.whale.x) + 2;
        const rise = Math.sin(a * Math.PI);
        const s = this.sc * 0.9;
        g.save();
        g.beginPath();
        g.rect(0, 0, this.W, by);
        g.clip();
        g.translate(this.whale.x, by + (1 - rise) * 40 * s);
        g.fillStyle = "#08161e";
        g.beginPath();
        g.moveTo(-4 * s, 0);
        g.lineTo(-3 * s, -26 * s);
        g.quadraticCurveTo(-18 * s, -30 * s, -34 * s, -44 * s);
        g.quadraticCurveTo(-14 * s, -42 * s, 0, -32 * s);
        g.quadraticCurveTo(14 * s, -42 * s, 34 * s, -44 * s);
        g.quadraticCurveTo(18 * s, -30 * s, 3 * s, -26 * s);
        g.lineTo(4 * s, 0);
        g.fill();
        g.restore();
        if (a > 0.6 && a < 0.65) this.splash(this.whale.x, by, 8);
      }
    }
  }

  private drawShoal(dt: number, vis: number) {
    const { W, H, g } = this;
    const hz = this.horizon;
    const top = hz + (H - hz) * 0.42, bot = H - 20;
    if (!this.shoal.length) {
      const cx = W * 0.3, cy = (top + bot) / 2;
      for (let i = 0; i < (this.mobile ? 10 : 18); i++)
        this.shoal.push({ x: cx + (R() - 0.5) * 220, y: cy + (R() - 0.5) * 70, vx: 0.6 + R() * 0.3, vy: 0, ph: R() * 6, s: (0.7 + R() * 0.6) * this.sc * (this.mobile ? 0.8 : 1) });
    }
    const m = this.mouse;
    const live = performance.now() - m.last < 1500;
    // the shoal's heart, so stragglers keep together
    let ax = 0, ay = 0;
    for (const f of this.shoal) { ax += f.x; ay += f.y; }
    ax /= this.shoal.length; ay /= this.shoal.length;
    for (const f of this.shoal) {
      if (!this.reduce) {
        if (live) {
          const dx = f.x - m.x, dy = f.y - m.y, d = Math.hypot(dx, dy);
          if (d < 140) { const k = (1 - d / 140) * 0.9; f.vx += (dx / (d || 1)) * k; f.vy += (dy / (d || 1)) * k; }
        }
        f.vx += (0.7 - f.vx) * 0.02 + (ax - f.x) * 0.0006;
        f.vy += (ay - f.y) * 0.0008 - f.vy * 0.04;
        if (f.y < top) f.vy += 0.15;
        if (f.y > bot) f.vy -= 0.15;
        f.x += f.vx * dt;
        f.y += f.vy * dt;
        if (f.x > W + 60) { f.x -= W + 260; }
        if (f.x < -260) f.x += W + 260;
      }
      const a = 0.22 * vis * (1 - this.night * 0.5);
      const ang = Math.atan2(f.vy, f.vx);
      const wag = Math.sin(this.t * 9 + f.ph) * 0.35;
      g.save();
      g.translate(f.x, f.y);
      g.rotate(ang);
      g.scale(f.s, f.s);
      g.fillStyle = `rgba(8,40,55,${a})`;
      g.beginPath();
      g.ellipse(0, 0, 11, 3.6, 0, 0, TAU);
      g.fill();
      g.beginPath();
      g.moveTo(-9, 0);
      g.lineTo(-16, -4 + wag * 4);
      g.lineTo(-16, 4 + wag * 4);
      g.closePath();
      g.fill();
      g.restore();
    }
  }

  private splash(x: number, y: number, n: number) {
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (R() - 0.5) * 1.4;
      const v = 1.5 + R() * 3;
      this.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0, max: 35, r: 1 + R() * 1.5, kind: "drop" });
    }
    for (let i = 0; i < 5; i++) this.particles.push({ x: x + (R() - 0.5) * 20, y: y + 4, vx: (R() - 0.5) * 0.6, vy: 0, life: 0, max: 70, r: 2 + R() * 2, kind: "glow" });
  }

  private drawParticles(dt: number, camVel: number) {
    const g = this.g;
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      if (p.life > p.max) {
        this.particles.splice(i, 1);
        continue;
      }
      if (p.kind === "drop") p.vy += 0.15 * dt;
      p.x += (p.vx - (p.kind === "glow" && this.p < WAVE_END ? camVel * 0.6 : 0)) * dt;
      p.y += p.vy * dt;
      const k = 1 - p.life / p.max;
      if (p.kind === "glow") {
        if (this.night > 0.4) this.glow(p.x, p.y, p.r * 4, `rgba(110,240,230,${0.5 * k * this.night})`);
        g.fillStyle = `rgba(${this.night > 0.4 ? "200,255,250" : "255,255,255"},${0.8 * k})`;
        g.beginPath();
        g.arc(p.x, p.y, p.r * 0.5, 0, TAU);
        g.fill();
      } else {
        g.fillStyle = `rgba(215,240,245,${0.8 * k})`;
        g.beginPath();
        g.arc(p.x, p.y, p.r, 0, TAU);
        g.fill();
      }
    }
  }

  /* ---------------- the ring underwater ---------------- */
  private drawUnder(k: number, now: number) {
    const g = this.g;
    const { W, H, t } = this;
    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, `rgb(${Math.round(16 - 12 * k)},${Math.round(70 - 55 * k)},${Math.round(90 - 70 * k)})`);
    bg.addColorStop(1, "#01060a");
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);
    // the surface above, rippling away
    const surf = -k * H * 1.2 + H * 0.06;
    if (surf > -60) {
      g.fillStyle = "rgba(160,220,230,0.25)";
      g.beginPath();
      g.moveTo(0, surf);
      for (let x = 0; x <= W; x += 10) g.lineTo(x, surf + Math.sin(x * 0.02 + t * 2) * 6);
      g.lineTo(W, surf - 40);
      g.lineTo(0, surf - 40);
      g.fill();
    }
    // moonlight shafts fading out
    g.save();
    g.globalCompositeOperation = "lighter";
    for (let i = 0; i < 6; i++) {
      const x = W * (0.15 + i * 0.15) + Math.sin(t * 0.3 + i) * 40;
      const a = (0.06 + 0.03 * Math.sin(t + i)) * (1 - k);
      const rg = g.createLinearGradient(0, 0, 0, H);
      rg.addColorStop(0, `rgba(170,230,240,${a})`);
      rg.addColorStop(1, "rgba(170,230,240,0)");
      g.fillStyle = rg;
      g.beginPath();
      g.moveTo(x - 20, 0);
      g.lineTo(x + 25, 0);
      g.lineTo(x + 120, H);
      g.lineTo(x + 30, H);
      g.fill();
    }
    g.restore();
    // plankton & marine snow
    for (const s of this.snow) {
      s.y -= s.sp * 0.6;
      s.x += Math.sin(t * 0.5 + s.ph) * 0.2;
      if (s.y < -5) s.y = H + 5;
      const glowy = s.c < 0.18;
      const a = (glowy ? 0.7 : 0.35) * (0.5 + 0.5 * Math.sin(t * 1.5 + s.ph));
      if (glowy) this.glow(s.x, s.y, s.r * 5, `rgba(90,230,230,${a * 0.5})`);
      g.fillStyle = glowy ? `rgba(170,255,250,${a})` : `rgba(220,235,240,${a * 0.6})`;
      g.beginPath();
      g.arc(s.x, s.y, s.r, 0, TAU);
      g.fill();
    }
    // the seabed rises into view
    const bedK = sstep(0.4, 0.9, k);
    const bedTop = H - H * (this.mobile ? 0.2 : 0.24) * bedK;
    const rk = clamp(k / 0.92, 0, 1);
    const ease = 1 - Math.pow(1 - rk, 2.2);
    const landed = rk >= 1;
    const rx = W / 2 + (landed ? 0 : Math.sin(t * 0.9) * 30 * (1 - rk));
    const ry = H * 0.1 + (bedTop + 14 - H * 0.1) * ease;
    if (bedK > 0) {
      const pool = g.createRadialGradient(W / 2, bedTop + 20, 0, W / 2, bedTop + 20, W * 0.35);
      pool.addColorStop(0, `rgba(233,196,106,${0.22 * bedK * (landed ? 1.3 : 0.6)})`);
      pool.addColorStop(1, "rgba(233,196,106,0)");
      g.fillStyle = "#14160f";
      g.beginPath();
      g.moveTo(0, H);
      g.lineTo(0, bedTop + 30);
      for (let x = 0; x <= W; x += 20) g.lineTo(x, bedTop + 26 + Math.sin(x * 0.006) * 14 + Math.sin(x * 0.017 + 1) * 6 - Math.exp(-Math.pow((x - W / 2) / (W * 0.2), 2)) * 12);
      g.lineTo(W, H);
      g.fill();
      g.fillStyle = pool;
      g.beginPath();
      g.arc(W / 2, bedTop + 20, W * 0.35, 0, TAU);
      g.fill();
      // seagrass and glowing anemones
      for (let i = 0; i < (this.mobile ? 8 : 16); i++) {
        const x = (i / (this.mobile ? 8 : 16)) * W + 20 + Math.sin(i * 7.7) * 30;
        if (Math.abs(x - W / 2) < W * 0.12) continue;
        const by = bedTop + 30 + Math.sin(x * 0.006) * 14;
        g.strokeStyle = "rgba(30,80,70,0.9)";
        g.lineWidth = 3;
        g.beginPath();
        g.moveTo(x, by);
        for (let sgm = 1; sgm <= 5; sgm++) g.lineTo(x + Math.sin(t * 1.2 + sgm * 0.8 + i) * 6 * (sgm / 5), by - sgm * (10 + (i % 3) * 5));
        g.stroke();
        if (i % 3 === 0) this.glow(x + 14, by - 2, 10, `rgba(255,120,190,${0.4 + 0.2 * Math.sin(t * 2 + i)})`);
      }
    }
    // the ring
    const r = (this.mobile ? 20 : 26) * this.sc;
    const spin = landed ? 0.34 : 0.28 + 0.72 * Math.abs(Math.cos(t * 1.3));
    const pulse = landed ? 0.85 + 0.15 * Math.sin(t * 2.2) : 1;
    this.glow(rx, ry, r * (landed ? 7 : 5) * pulse, `rgba(255,200,100,${landed ? 0.42 : 0.3})`);
    g.save();
    g.translate(rx, ry);
    g.rotate(landed ? -0.05 : Math.sin(t * 0.7) * 0.4);
    g.scale(1, spin);
    const rg = g.createLinearGradient(-r, -r, r, r);
    rg.addColorStop(0, "#fff4c9");
    rg.addColorStop(0.35, "#f0c057");
    rg.addColorStop(0.65, "#b47b25");
    rg.addColorStop(1, "#f6d888");
    g.strokeStyle = rg;
    g.lineWidth = r * 0.34;
    g.beginPath();
    g.arc(0, 0, r, 0, TAU);
    g.stroke();
    g.strokeStyle = "rgba(255,252,235,0.9)";
    g.lineWidth = r * 0.08;
    g.beginPath();
    g.arc(0, 0, r, Math.PI * 1.1, Math.PI * 1.55);
    g.stroke();
    g.restore();
    // a glint now and then
    const gl = Math.max(0, Math.sin(t * 2.1)) ** 12;
    if (gl > 0.05) {
      g.fillStyle = `rgba(255,253,240,${gl})`;
      const gx = rx + r * 0.7, gy = ry - r * spin * 0.7;
      g.beginPath();
      g.moveTo(gx, gy - 9);
      g.quadraticCurveTo(gx, gy, gx + 9, gy);
      g.quadraticCurveTo(gx, gy, gx, gy + 9);
      g.quadraticCurveTo(gx, gy, gx - 9, gy);
      g.quadraticCurveTo(gx, gy, gx, gy - 9);
      g.fill();
    }
    this.ring = { x: rx, y: ry, r, landed };
  }

  /* ---------------- main loop ---------------- */
  private frame = (now: number) => {
    this.raf = requestAnimationFrame(this.frame);
    if (this.paused) {
      this.last = now;
      return;
    }
    const dt = Math.min(2.5, (now - this.last) / 16.67);
    this.last = now;
    this.dtNow = dt;
    this.t = now / 1000;
    const g = this.g;
    const { W, H } = this;
    this.p += (this.target - this.p) * (this.reduce ? 1 : 1 - Math.pow(0.95, dt));
    const p = this.p;
    this.onFrame?.(p);
    const act = activeAt(p);
    if (act !== this.lastActive) {
      this.lastActive = act;
      this.onActive?.(act);
    }

    this.cam = cameraAt(p) * this.spacing;
    const camVel = (this.cam - this.prevCam) / Math.max(dt, 0.001);
    this.prevCam = this.cam;
    this.moveS += (clamp(Math.abs(camVel) / 6, 0, 1) - this.moveS) * (1 - Math.pow(0.94, dt));
    const moving = this.moveS;
    this.storm = sstep(dockEnd(ISLANDS - 1) + 0.015, SEA_END, p);
    const tod = clamp(p / 0.69, 0, 1);
    this.night = sstep(0.76, 0.93, tod);
    const warm = Math.max(Math.exp(-Math.pow(tod / 0.09, 2)), Math.exp(-Math.pow((tod - 0.73) / 0.08, 2))) * (1 - this.night);
    const n = this.night;
    this.env = { tod, night: n, warm };
    this.lampK = 0.3 + 0.7 * sstep(0.6, 0.85, tod);
    this.layerCols = LAYER_DAY.map((d, j) => [0, 1].map((k) => mix3(d[k], LAYER_WARM[j][k], LAYER_COL[j][k], warm * 0.55, n)));
    const P = (day: string, nightC: string, warmC?: string) => mix3(day, warmC ?? day, nightC, warmC ? warm * 0.5 : 0, n);
    this.P = {
      landDark: P("#24553a", "#040d13", "#4a3a3a"),
      landMid: P("#2f6b45", "#08171f", "#5a4540"),
      landLit: P("#5f9e5b", "#11303d", "#b07a55"),
      canopyDark: P("#265a3b", "#071820", "#4c3d3c"),
      canopyLit: P("#4f9152", "#0e2a35", "#a6764f"),
      ridge: P("#7fa9a6", "#1a3a48", "#b08a86"),
      reflect: P("#2c6e78", "#071a24"),
      sandTop: P("#ecdcae", "#3a4a44", "#f0c49a"),
      sandBot: P("#cdb586", "#1b2826", "#c79b78"),
      rock: P("#6a6a60", "#081419"),
      trunk: P("#6b5236", "#04090d", "#4a3528"),
      frond: P("#2f6f3a", "#050c11", "#3d4a2c"),
      nut: P("#5a3d1f", "#0a0805"),
      hutWall: P("#a88660", "#060d12", "#8a5c45"),
      hutRoof: P("#8a6a3c", "#060d12", "#6e4c34"),
      post: P("#5a4630", "#04090d"),
      people: P("#3b2a1e", "#03080b"),
      hull0: P("#8a6240", "#3a2a1c", "#7a4a30"),
      hull1: P("#4a3220", "#140e09"),
      spar: P("#5a3e24", "#2a1d12"),
    };
    this.P.rim = n > 0.5 ? "160,210,225" : warm > 0.3 ? "255,190,140" : "255,245,210";
    this.P.mist = n > 0.5 ? "150,190,205" : "255,255,255";
    const rise = sstep(SEA_END, WAVE_END - 0.005, p);
    const under = sstep(WAVE_END - 0.01, WAVE_END + 0.02, p);
    this.swells = this.swells.filter((s) => now - s.t0 < 2600);

    this.audio = { night: this.night, storm: this.storm, under };
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    if (under < 1) {
      const hz = this.horizon;
      // sky through the day
      const st = this.storm;
      const [c0, c1, c2] = skyAt(tod);
      const sky = g.createLinearGradient(0, 0, 0, hz);
      sky.addColorStop(0, st > 0 ? mix("#040a18", "#0a0e14", st) : c0);
      sky.addColorStop(0.55, st > 0 ? mix("#0a1d33", "#141b22", st) : c1);
      sky.addColorStop(1, st > 0 ? mix("#1a3a4c", "#16252c", st) : c2);
      g.fillStyle = sky;
      g.fillRect(0, 0, W, hz + 4);
      const nightA = this.night * (1 - st * 0.9);
      g.globalAlpha = nightA;
      const off = ((this.cam * 0.03) % W + W) % W;
      g.drawImage(this.sky, -off, 0, W * 2, hz + 4);
      for (const s2 of this.twinkles) {
        const x = s2.x - off;
        if (x < 0 || x > W) continue;
        g.fillStyle = `rgba(255,255,255,${0.3 + 0.7 * Math.abs(Math.sin(this.t * 1.3 + s2.ph))})`;
        g.beginPath();
        g.arc(x, s2.y, s2.r, 0, TAU);
        g.fill();
      }
      g.globalAlpha = 1;
      // the sun: rises on the left, crosses the sky, sets on the right
      const sunK = clamp(tod / 0.74, 0, 1);
      const sunX = W * (0.1 + 0.8 * sunK);
      const sunY = hz + 10 - Math.sin(sunK * Math.PI) * hz * 0.82;
      const low = 1 - Math.sin(sunK * Math.PI);
      if (sunK < 1 && sunY < hz + 30) {
        const sunCol = mix("#fff6dc", "#ffb05a", Math.pow(low, 1.5));
        this.glow(sunX, sunY, (150 + 160 * low) * this.sc, `rgba(255,${Math.round(220 - 70 * low)},${Math.round(170 - 90 * low)},${0.5 + 0.2 * low})`);
        g.save();
        g.beginPath();
        g.rect(0, 0, W, hz);
        g.clip();
        g.fillStyle = sunCol;
        g.beginPath();
        g.arc(sunX, sunY, (26 + 10 * low) * this.sc, 0, TAU);
        g.fill();
        g.restore();
      }
      // daytime clouds, blushing at dawn and sunset
      const dayA = (1 - this.night) * (1 - st);
      if (dayA > 0.02) {
        const warmC = Math.max(Math.exp(-Math.pow(tod / 0.08, 2)), Math.exp(-Math.pow((tod - 0.72) / 0.07, 2)));
        for (let i = 0; i < 7; i++) {
          const cw = (160 + (i % 3) * 70) * this.sc;
          const x = ((i * 0.19 * W * 1.6 - this.cam * 0.05 + this.t * 6 * (1 + (i % 2))) % (W + cw * 2) + (W + cw * 2)) % (W + cw * 2) - cw;
          const y = hz * (0.12 + (i % 4) * 0.13);
          const col = mixRGB("#ffffff", "#ffb08a", warmC).join(",");
          g.save();
          g.translate(x, y);
          g.scale(1, 0.42);
          for (let k = 0; k < 5; k++) {
            const bx = (k - 2) * cw * 0.2;
            const by2 = -Math.sin(((k + 0.5) / 5) * Math.PI) * cw * 0.28 + (k % 2) * cw * 0.05;
            this.glow(bx, by2, cw * (0.32 + 0.06 * Math.sin(k * 1.7 + i)), `rgba(${col},${0.42 * dayA})`);
          }
          g.restore();
        }
      }
      // the moon rises after sunset
      const moonK = sstep(0.7, 1, tod);
      const moonX = W * (0.12 + 0.7 * moonK);
      const moonY = hz + 20 - Math.sin(moonK * Math.PI * 0.62) * hz * 0.78;
      if (moonK > 0) {
        const ma = Math.min(1, moonK * 3) * (1 - st * 0.8);
        this.glow(moonX, moonY, 150 * this.sc, `rgba(200,225,255,${0.18 * ma})`);
        g.save();
        g.beginPath();
        g.rect(0, 0, W, hz);
        g.clip();
        g.fillStyle = `rgba(246,243,230,${ma})`;
        g.beginPath();
        g.arc(moonX, moonY, 22 * this.sc, 0, TAU);
        g.fill();
        g.fillStyle = `rgba(200,200,190,${0.25 * ma})`;
        g.beginPath();
        g.arc(moonX - 6 * this.sc, moonY - 4 * this.sc, 5 * this.sc, 0, TAU);
        g.arc(moonX + 7 * this.sc, moonY + 6 * this.sc, 3.5 * this.sc, 0, TAU);
        g.fill();
        g.restore();
      }
      // the water reflects whichever light is up
      this.lightX = this.night > 0.5 ? moonX : sunX;
      this.lightRGB = this.night > 0.5 ? "225,245,255" : low > 0.6 ? "255,200,140" : "255,250,235";

      // constellations: one guides the way to each island
      for (let i = 0; i < ISLANDS; i++) {
        const ix = this.dockX + (i * this.spacing - this.cam);
        const cx = ix * 0.55 + this.dockX * 0.45 - W * 0.12;
        if (cx < -W * 0.4 || cx > W * 1.4) continue;
        const draw = sstep(dockStart(i) - 0.06, dockStart(i) - 0.005, p);
        const cw = W * (this.mobile ? 0.5 : 0.28);
        const ch = hz * 0.5;
        const pts = this.shapes[i].stars.map((s) => ({ x: cx + s.x * cw, y: hz * 0.1 + s.y * ch }));
        g.globalAlpha = nightA;
        if (draw > 0) {
          g.strokeStyle = "rgba(233,196,106,0.55)";
          g.lineWidth = 1;
          g.beginPath();
          const segs = pts.length - 1;
          const upto = draw * segs;
          g.moveTo(pts[0].x, pts[0].y);
          for (let k = 1; k <= segs; k++) {
            const f = clamp(upto - (k - 1), 0, 1);
            if (f <= 0) break;
            g.lineTo(pts[k - 1].x + (pts[k].x - pts[k - 1].x) * f, pts[k - 1].y + (pts[k].y - pts[k - 1].y) * f);
          }
          g.stroke();
        }
        pts.forEach((pt, k) => {
          const lead = k === pts.length - 1;
          const b = 0.5 + 0.5 * draw;
          this.glow(pt.x, pt.y, (lead ? 16 : 8) * b, `rgba(255,236,190,${(lead ? 0.6 : 0.35) * b})`);
          g.fillStyle = `rgba(255,248,230,${0.6 + 0.4 * b})`;
          g.beginPath();
          g.arc(pt.x, pt.y, lead ? 2.2 : 1.4, 0, TAU);
          g.fill();
          if (lead && draw > 0.6) {
            g.strokeStyle = `rgba(255,240,200,${0.5 * draw})`;
            g.beginPath();
            g.moveTo(pt.x - 12, pt.y);
            g.lineTo(pt.x + 12, pt.y);
            g.moveTo(pt.x, pt.y - 12);
            g.lineTo(pt.x, pt.y + 12);
            g.stroke();
          }
        });
        g.globalAlpha = 1;
      }

      // a shooting star now and then
      if (!this.shooting && this.t > this.nextShoot && st < 0.3) {
        this.shooting = { x: W * (0.3 + R() * 0.7), y: hz * (0.05 + R() * 0.3), vx: -(7 + R() * 5), vy: 2.5 + R() * 2, t0: now };
        this.nextShoot = this.t + 4 + R() * 6;
      }
      if (this.shooting) {
        const s = this.shooting;
        const a = (now - s.t0) / 900;
        if (a > 1) this.shooting = null;
        else {
          const x = s.x + s.vx * a * 60;
          const y = s.y + s.vy * a * 60;
          const tail = g.createLinearGradient(x, y, x - s.vx * 14, y - s.vy * 14);
          tail.addColorStop(0, `rgba(255,255,245,${1 - a})`);
          tail.addColorStop(1, "rgba(255,255,245,0)");
          g.strokeStyle = tail;
          g.lineWidth = 1.6;
          g.beginPath();
          g.moveTo(x, y);
          g.lineTo(x - s.vx * 14, y - s.vy * 14);
          g.stroke();
        }
      }

      // storm clouds, rain and lightning
      if (st > 0) {
        for (let i = 0; i < 9; i++) {
          const x = ((i * 0.13 * W + this.t * 18 * (i % 2 ? 1 : 0.6)) % (W * 1.4)) - W * 0.2;
          const y = hz * (0.08 + (i % 4) * 0.12);
          this.glow(x, y, W * 0.22, `rgba(10,16,22,${0.75 * st})`);
        }
        if (st > 0.35 && this.t > this.nextBolt) {
          this.flash = 1;
          this.onLightning?.();
          const bx = W * (0.2 + R() * 0.6);
          const pts = [{ x: bx, y: 0 }];
          while (pts[pts.length - 1].y < hz) pts.push({ x: pts[pts.length - 1].x + (R() - 0.5) * 50, y: pts[pts.length - 1].y + 20 + R() * 30 });
          this.bolt = { x: bx, t0: now, pts };
          this.nextBolt = this.t + 1.6 + R() * 2.6;
        }
        if (this.bolt && now - this.bolt.t0 < 220) {
          g.strokeStyle = `rgba(230,240,255,${1 - (now - this.bolt.t0) / 220})`;
          g.lineWidth = 2;
          g.beginPath();
          this.bolt.pts.forEach((pt, k) => (k ? g.lineTo(pt.x, pt.y) : g.moveTo(pt.x, pt.y)));
          g.stroke();
        }
      }

      for (let j = 0; j < 3; j++) this.drawLayer(j, this.lightX);
      for (let i = 0; i < ISLANDS; i++) {
        const ix = this.dockX + (i * this.spacing - this.cam);
        if (ix < -400 || ix > W + 400) continue;
        this.drawIsland(i, ix, act, now);
      }
      this.drawLife(now);
      this.updatePods(dt);
      this.drawPods(2);
      this.drawLayer(3, this.lightX);
      this.drawCanoe(moving);
      // moonlight glitter on the water
      for (let i = 0; i < 40; i++) {
        const yy = hz + 6 + ((i * 37) % 100) / 100 * (H - hz) * 0.8;
        const spread = 10 + (yy - hz) * 0.35;
        const xx = this.lightX + Math.sin(i * 91.7 + Math.floor(this.t * 2 + i) * 3.1) * spread;
        const a = Math.max(0, Math.sin(this.t * 3 + i * 1.3)) * (0.5 + 0.3 * (1 - this.night)) * (1 - st);
        g.fillStyle = `rgba(${this.lightRGB},${a})`;
        g.fillRect(xx, yy, 4 + (i % 4) * 4, 1.2);
      }
      if (under <= 0) this.drawParticles(dt, camVel);
      if (st < 0.5) this.drawShoal(dt, 1 - st * 2);
      this.drawLayer(4, this.lightX);
      this.drawPods(4);
      this.drawLayer(5, this.lightX);
      if (st > 0.2) {
        g.strokeStyle = `rgba(190,210,220,${0.25 * st})`;
        g.lineWidth = 1;
        g.beginPath();
        for (let i = 0; i < 90; i++) {
          const x = ((i * 53.3 + this.t * 900) % (W + 200)) - 100;
          const y = ((i * 97.1 + this.t * 1500) % (H + 100)) - 50;
          g.moveTo(x, y);
          g.lineTo(x - 6, y + 22);
        }
        g.stroke();
      }
      // the wave that takes you under
      if (rise > 0) {
        const top = H + 80 - rise * (H + 380);
        g.beginPath();
        g.moveTo(-10, H + 10);
        for (let x = -10; x <= W + 10; x += 10) {
          const crest = Math.sin(x * 0.008 + this.t * 1.5) * 30 + Math.sin(x * 0.021 - this.t * 2) * 12;
          g.lineTo(x, top + crest - Math.exp(-Math.pow((x - this.canoeX) / (W * 0.4), 2)) * 60 * rise);
        }
        g.lineTo(W + 10, H + 10);
        g.closePath();
        const wg = g.createLinearGradient(0, top - 60, 0, top + H * 0.6);
        wg.addColorStop(0, "rgba(70,190,195,0.95)");
        wg.addColorStop(0.08, "rgba(20,90,105,0.98)");
        wg.addColorStop(1, "#02090d");
        g.fillStyle = wg;
        g.fill();
        g.strokeStyle = "rgba(210,255,250,0.7)";
        g.lineWidth = 2;
        g.stroke();
      }
      if (this.flash > 0) {
        g.fillStyle = `rgba(220,235,255,${this.flash * 0.35})`;
        g.fillRect(0, 0, W, H);
        this.flash = Math.max(0, this.flash - 0.08 * dt);
      }
    }
    if (under > 0) {
      g.globalAlpha = under;
      this.drawUnder(clamp((p - WAVE_END) / (1 - WAVE_END - 0.005), 0, 1), now);
      g.globalAlpha = 1;
      this.drawParticles(dt, 0);
    } else {
      this.ring.landed = false;
    }
  };
}
