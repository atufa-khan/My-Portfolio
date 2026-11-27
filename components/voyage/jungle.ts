import type { IslandKind } from "@/lib/story";
import { mix, mixRGB, skyAt } from "./engine";

/* ==================================================================
 *  Landing on an island: a painted jungle with a mountain behind.
 *  Foreground leaves part as you arrive; the light follows the
 *  time of day you landed at.
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
export function trailLayout(n: number, mobile: boolean) {
  const peakY = mobile ? 0.25 : 0.15;
  const top = mobile ? 0.42 : 0.33;
  const bottom = mobile ? 0.84 : 0.85;
  const stops = Array.from({ length: n }, (_, k) => {
    const y = bottom - (k * (bottom - top)) / Math.max(1, n - 1);
    const w = (mobile ? 0.12 : 0.07) + (y - peakY) * (mobile ? 0.32 : 0.42);
    return { x: 0.5 + (k % 2 ? 1 : -1) * w, y };
  });
  const summit = { x: 0.5, y: peakY + (mobile ? 0.035 : 0.04) };
  const pts = [{ x: 0.5, y: 1.04 }, ...stops, summit];
  let d = `M ${pts[0].x * 1000} ${pts[0].y * 1000}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] ?? p2;
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    d += ` C ${c1.x * 1000} ${c1.y * 1000} ${c2.x * 1000} ${c2.y * 1000} ${p2.x * 1000} ${p2.y * 1000}`;
  }
  return { stops, summit, d, peakY, extra: mobile ? { x: 0.86, y: 0.64 } : { x: 0.9, y: 0.7 } };
}

type Crown = { u: number; v: number; r: number; tone: number };
type Leaf = { side: number; ay: number; ang: number; len: number; wid: number; ph: number; frond: boolean };

export class JungleScene {
  private g: CanvasRenderingContext2D;
  private W = 0;
  private H = 0;
  private dpr = 1;
  private mobile = false;
  private raf = 0;
  private t0 = performance.now();
  private crowns: Crown[] = [];
  private canopy: Crown[] = [];
  private leaves: Leaf[] = [];
  private vines: { x: number; len: number; ph: number }[] = [];
  private motes: { x: number; y: number; r: number; ph: number; sp: number }[] = [];
  private stars: { x: number; y: number; r: number }[] = [];
  private mx = 0;
  private my = 0;
  private sm = { x: 0, y: 0 };
  leaving = false;
  private leaveT = 0;

  constructor(private canvas: HTMLCanvasElement, private kind: IslandKind, private env: Env, seed: number) {
    this.g = canvas.getContext("2d")!;
    const r = rng(900 + seed * 31);
    this.crowns = Array.from({ length: 620 }, () => ({ u: r() * 2 - 1, v: 0.36 + r() * 0.7, r: 0.5 + r() * 0.8, tone: r() }));
    this.canopy = Array.from({ length: 140 }, () => ({ u: r(), v: r(), r: 0.6 + r() * 0.9, tone: r() }));
    this.leaves = [];
    for (const side of [-1, 1]) {
      for (let k = 0; k < 6; k++) {
        this.leaves.push({ side, ay: 0.25 + k * 0.14 + r() * 0.06, ang: (side < 0 ? 0 : Math.PI) + (r() - 0.5) * 0.9 - side * 0.25, len: 0.22 + r() * 0.16, wid: 0.3 + r() * 0.2, ph: r() * TAU, frond: k % 3 === 1 });
      }
    }
    this.vines = Array.from({ length: 7 }, (_, k) => ({ x: [0.04, 0.12, 0.27, 0.71, 0.83, 0.93, 0.6][k], len: 0.12 + r() * 0.22, ph: r() * TAU }));
    this.motes = Array.from({ length: 50 }, () => ({ x: r(), y: 0.25 + r() * 0.7, r: 0.8 + r() * 1.8, ph: r() * TAU, sp: 0.2 + r() * 0.6 }));
    this.stars = Array.from({ length: 120 }, () => ({ x: r(), y: r() * 0.5, r: 0.4 + r() * 1.1 }));
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
  }
  pointer(x: number, y: number) {
    this.mx = x / this.W - 0.5;
    this.my = y / this.H - 0.5;
  }
  leave() {
    this.leaving = true;
    this.leaveT = performance.now();
  }
  destroy() {
    cancelAnimationFrame(this.raf);
  }

  private glow(x: number, y: number, r: number, rgb: string, a: number) {
    const g = this.g;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, `rgba(${rgb},${a})`);
    gr.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = gr;
    g.beginPath();
    g.arc(x, y, r, 0, TAU);
    g.fill();
  }

  /* colours, by time of day */
  private c(day: string, night: string, warm?: string) {
    const { night: n, warm: w } = this.env;
    const d = warm ? mixRGB(day, warm, w * 0.5) : mixRGB(day, day, 0);
    const hex = "#" + d.map((v) => v.toString(16).padStart(2, "0")).join("");
    return mix(hex, night, n);
  }

  private mountainY(x: number, cx: number, peak: number, base: number) {
    const W = this.W;
    const u = (x - cx) / (W * (this.mobile ? 0.95 : 0.66));
    const k = Math.max(0, 1 - Math.abs(u));
    const main = Math.pow(k, 1.6);
    // shoulders and a crooked ridge make it a real mountain, not a cone
    const sh = 0.2 * Math.exp(-Math.pow((u - 0.38) / 0.16, 2)) + 0.15 * Math.exp(-Math.pow((u + 0.46) / 0.18, 2));
    const ridge = Math.sin(x * 0.019) * 0.03 + Math.sin(x * 0.053 + 1) * 0.015 + Math.sin(x * 0.11) * 0.006;
    const h = Math.min(1, main + sh * (1 - main));
    return base - (base - peak) * h * (1 + ridge * (1 - k * 0.6));
  }

  private drawLeaf(x: number, y: number, ang: number, len: number, wid: number, fill: string, vein: string, rim: string) {
    const g = this.g;
    g.save();
    g.translate(x, y);
    g.rotate(ang);
    g.beginPath();
    g.moveTo(0, 0);
    g.bezierCurveTo(len * 0.25, -len * wid * 0.55, len * 0.75, -len * wid * 0.5, len, 0);
    g.bezierCurveTo(len * 0.75, len * wid * 0.5, len * 0.25, len * wid * 0.55, 0, 0);
    g.fillStyle = fill;
    g.fill();
    g.strokeStyle = rim;
    g.lineWidth = 1.2;
    g.stroke();
    g.strokeStyle = vein;
    g.lineWidth = 1.6;
    g.beginPath();
    g.moveTo(0, 0);
    g.quadraticCurveTo(len * 0.5, -len * 0.02, len * 0.97, 0);
    g.stroke();
    g.lineWidth = 0.9;
    for (let k = 1; k < 7; k++) {
      const px = (k / 7) * len;
      const w = Math.sin((k / 7) * Math.PI) * len * wid * 0.42;
      g.beginPath();
      g.moveTo(px, 0);
      g.quadraticCurveTo(px + len * 0.05, -w * 0.5, px + len * 0.1, -w);
      g.moveTo(px, 0);
      g.quadraticCurveTo(px + len * 0.05, w * 0.5, px + len * 0.1, w);
      g.stroke();
    }
    g.restore();
  }

  private drawFrond(x: number, y: number, ang: number, len: number, fill: string, t: number) {
    const g = this.g;
    g.save();
    g.translate(x, y);
    g.rotate(ang);
    g.strokeStyle = fill;
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(0, 0);
    g.quadraticCurveTo(len * 0.5, -len * 0.12, len, len * 0.08);
    g.stroke();
    g.fillStyle = fill;
    for (let k = 1; k < 16; k++) {
      const u = k / 16;
      const px = u * len;
      const py = -len * 0.12 * 4 * u * (1 - u) + len * 0.08 * u * u;
      const ll = len * 0.22 * Math.sin(u * Math.PI + 0.3);
      for (const sd of [-1, 1]) {
        const a = sd * (1.0 + Math.sin(t * 1.5 + k) * 0.05) + 0.35;
        g.beginPath();
        g.moveTo(px, py);
        g.quadraticCurveTo(px + Math.cos(a) * ll * 0.5 + 4, py + Math.sin(a) * ll * 0.5, px + Math.cos(a) * ll, py + Math.sin(a) * ll);
        g.quadraticCurveTo(px + Math.cos(a) * ll * 0.5 - 2, py + Math.sin(a) * ll * 0.5 + sd * 2, px + 3, py);
        g.fill();
      }
    }
    g.restore();
  }

  private frame = (now: number) => {
    this.raf = requestAnimationFrame(this.frame);
    const g = this.g;
    const { W, H } = this;
    const t = (now - this.t0) / 1000;
    const enter = clamp(t / 1.5, 0, 1);
    const eIn = 1 - Math.pow(1 - enter, 3);
    const out = this.leaving ? clamp((now - this.leaveT) / 600, 0, 1) : 0;
    const open = eIn * (1 - out);
    this.sm.x += (this.mx - this.sm.x) * 0.05;
    this.sm.y += (this.my - this.sm.y) * 0.05;
    const par = (d: number) => ({ x: -this.sm.x * d, y: -this.sm.y * d * 0.5 });
    const { night: n, tod } = this.env;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    // sky
    const [s0, s1, s2] = skyAt(tod);
    const sky = g.createLinearGradient(0, 0, 0, H * 0.8);
    sky.addColorStop(0, s0);
    sky.addColorStop(0.6, s1);
    sky.addColorStop(1, s2);
    g.fillStyle = sky;
    g.fillRect(0, 0, W, H);
    if (n > 0.05) {
      g.fillStyle = "#fff";
      for (const s of this.stars) {
        g.globalAlpha = n * (0.4 + 0.6 * Math.abs(Math.sin(t + s.x * 50)));
        g.beginPath();
        g.arc(s.x * W, s.y * H, s.r, 0, TAU);
        g.fill();
      }
      g.globalAlpha = 1;
    }
    const lightX = W * (n > 0.5 ? 0.8 : 0.78), lightY = H * 0.12;
    this.glow(lightX, lightY, W * 0.35, n > 0.5 ? "200,220,255" : "255,236,200", n > 0.5 ? 0.18 : 0.4);

    // far hazy ridges
    let p = par(6);
    g.fillStyle = this.c("#8fb7b4", "#16303b", "#c79a96");
    g.beginPath();
    g.moveTo(0, H);
    for (let x = 0; x <= W + 10; x += 12) g.lineTo(x + p.x, H * 0.6 - Math.sin(x * 0.006 + 1) * H * 0.05 - Math.sin(x * 0.017) * H * 0.02 + p.y);
    g.lineTo(W, H);
    g.fill();

    // the mountain
    p = par(12);
    const cx = W * 0.5 + p.x;
    const peak = H * trailLayout(3, this.mobile).peakY + p.y;
    const base = H * 0.86;
    g.beginPath();
    g.moveTo(-10, H);
    for (let x = -10; x <= W + 10; x += 6) g.lineTo(x, this.mountainY(x, cx, peak, base));
    g.lineTo(W + 10, H);
    g.closePath();
    const mg = g.createLinearGradient(cx - W * 0.4, 0, cx + W * 0.4, 0);
    mg.addColorStop(0, this.c("#2c5444", "#0a1a20", "#4a3c40"));
    mg.addColorStop(0.55, this.c("#3d6c55", "#10252d", "#6a5048"));
    mg.addColorStop(1, this.c("#6a9a72", "#1a3640", "#b88264"));
    g.fillStyle = mg;
    g.fill();
    // ridge lines catching the light
    g.strokeStyle = `rgba(${n > 0.5 ? "170,210,230" : "255,240,200"},0.18)`;
    g.lineWidth = 1.4;
    for (let k = -3; k <= 3; k++) {
      if (k === 0) continue;
      g.beginPath();
      g.moveTo(cx + k * 4, peak + 6);
      g.quadraticCurveTo(cx + k * W * 0.05, peak + (base - peak) * 0.4, cx + k * W * 0.11, base - (base - peak) * 0.25);
      g.stroke();
    }
    // bare rock and gullies near the peak
    g.strokeStyle = this.c("#2a4a3c", "#081519", "#4a3a36");
    g.lineWidth = 1.6;
    for (let k = 0; k < 14; k++) {
      const u = (k / 13 - 0.5) * 0.5;
      const x0 = cx + u * W * 0.25;
      const y0 = this.mountainY(x0, cx, peak, base) + 4;
      g.beginPath();
      g.moveTo(x0, y0);
      g.quadraticCurveTo(x0 + u * 40 + Math.sin(k * 3.3) * 8, y0 + 40, x0 + u * 90, y0 + 70 + (k % 3) * 18);
      g.stroke();
    }
    // forest on the slopes
    for (const c of this.crowns) {
      const x = cx + c.u * W * (this.mobile ? 0.9 : 0.6);
      const my2 = this.mountainY(x, cx, peak, base);
      const y = my2 + (base - my2) * (c.v - 0.3) * 1.1 + 4;
      if (y < my2 + 4 || y > base + 10) continue;
      const depth = (y - peak) / (base - peak);
      const rad = (4 + c.r * 7) * (this.mobile ? 0.75 : 1) * (0.5 + 0.8 * depth);
      const lit = x > cx ? 0.5 + 0.5 * Math.min(1, (x - cx) / (W * 0.3)) : 0;
      g.fillStyle = c.tone > 0.66 ? this.c("#3b7450", "#0e232b", "#6e6046") : c.tone > 0.33 ? this.c("#346a49", "#0c2027", "#615440") : this.c("#2c5d40", "#0a1c22", "#544838");
      g.beginPath();
      g.arc(x, y, rad, 0, TAU);
      g.fill();
      if (lit > 0) {
        g.fillStyle = `rgba(${n > 0.5 ? "150,190,210" : "200,240,170"},${0.1 + 0.12 * lit})`;
        g.beginPath();
        g.arc(x + rad * 0.25, y - rad * 0.3, rad * 0.6, 0, TAU);
        g.fill();
      }
    }
    if (this.kind === "summit") {
      const pulse = 0.75 + 0.25 * Math.sin(t * 1.6);
      this.glow(cx, peak + 10, W * 0.12, "250,205,110", 0.55 * pulse);
      g.strokeStyle = `rgba(255,220,130,${0.9 * pulse})`;
      g.lineWidth = 2.5;
      g.beginPath();
      for (let x = cx - W * 0.06; x <= cx + W * 0.06; x += 4) {
        const y = this.mountainY(x, cx, peak, base);
        if (x === cx - W * 0.06) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.stroke();
    }
    if (this.kind === "arches") {
      // a waterfall down the mountain
      const fx = cx + W * (this.mobile ? 0.2 : 0.14);
      const fy = this.mountainY(fx, cx, peak, base) + 8;
      const fb = H * 0.8;
      const fg = g.createLinearGradient(fx - 14, 0, fx + 14, 0);
      fg.addColorStop(0, "rgba(220,245,255,0)");
      fg.addColorStop(0.5, `rgba(230,250,255,${0.75 - n * 0.3})`);
      fg.addColorStop(1, "rgba(220,245,255,0)");
      g.fillStyle = fg;
      g.fillRect(fx - 14, fy, 28, fb - fy);
      g.strokeStyle = "rgba(255,255,255,0.7)";
      g.lineWidth = 1.2;
      for (let k = 0; k < 9; k++) {
        const xx = fx - 9 + k * 2.2;
        const off = (t * 220 + k * 37) % 60;
        g.setLineDash([14, 46]);
        g.lineDashOffset = -off;
        g.beginPath();
        g.moveTo(xx, fy);
        g.lineTo(xx, fb);
        g.stroke();
      }
      g.setLineDash([]);
      this.glow(fx, fb, 70, "235,250,255", 0.45);
    }

    // mist
    for (let k = 0; k < 3; k++) {
      const y = H * (0.62 + k * 0.1);
      const x = ((t * 12 * (k + 1)) % (W * 1.6)) - W * 0.3;
      g.save();
      g.translate(x, y);
      g.scale(1, 0.18);
      this.glow(0, 0, W * 0.45, n > 0.5 ? "150,180,200" : "255,255,255", 0.16);
      g.restore();
    }

    // canopy at the foot of the mountain
    p = par(20);
    for (const c of this.canopy) {
      const x = c.u * (W + 60) - 30 + p.x;
      const y = H * (0.8 + c.v * 0.16) + p.y;
      const rad = (16 + c.r * 22) * (this.mobile ? 0.65 : 1);
      g.fillStyle = c.tone > 0.55 ? this.c("#2e6a45", "#0a1d22", "#6a5a3c") : this.c("#1f5236", "#06151a", "#4a3e30");
      g.beginPath();
      g.arc(x, y, rad, 0, TAU);
      g.fill();
    }

    // island features
    this.drawFeature(t, n, par(22));

    // sunbeams through the canopy by day
    if (n < 0.6) {
      g.save();
      g.globalCompositeOperation = "lighter";
      for (let k = 0; k < 5; k++) {
        const x0 = W * (0.1 + k * 0.17) + Math.sin(t * 0.2 + k) * 20;
        const a = (0.05 + 0.03 * Math.sin(t * 0.6 + k * 2)) * (1 - n);
        const bg = g.createLinearGradient(x0, 0, x0 + W * 0.25, H);
        bg.addColorStop(0, `rgba(255,245,210,${a})`);
        bg.addColorStop(1, "rgba(255,245,210,0)");
        g.fillStyle = bg;
        g.beginPath();
        g.moveTo(x0, 0);
        g.lineTo(x0 + 40, 0);
        g.lineTo(x0 + W * 0.3, H);
        g.lineTo(x0 + W * 0.22, H);
        g.fill();
      }
      g.restore();
    }

    // fireflies at night, drifting pollen by day
    for (const m of this.motes) {
      const x = (m.x * W + Math.sin(t * m.sp + m.ph) * 30) % W;
      const y = m.y * H + Math.cos(t * m.sp * 1.3 + m.ph) * 20;
      const tw = 0.4 + 0.6 * Math.max(0, Math.sin(t * 2 * m.sp + m.ph));
      if (n > 0.4) this.glow(x, y, 10, "255,235,150", 0.6 * tw * n);
      else {
        g.fillStyle = `rgba(255,255,240,${0.5 * tw})`;
        g.beginPath();
        g.arc(x, y, m.r * 0.8, 0, TAU);
        g.fill();
      }
    }

    // hanging vines
    p = par(34);
    const vineC = this.c("#24563a", "#06141a", "#4a4030");
    for (const v of this.vines) {
      const x = v.x * W + p.x;
      const L = v.len * H * (0.4 + 0.6 * open);
      const sway = Math.sin(t * 0.8 + v.ph) * 10;
      g.strokeStyle = vineC;
      g.lineWidth = 2.5;
      g.beginPath();
      g.moveTo(x, -5);
      g.quadraticCurveTo(x + sway * 0.5, L * 0.5, x + sway, L);
      g.stroke();
      for (let k = 1; k <= 6; k++) {
        const u = k / 6.5;
        const lx = x + sway * u * u;
        const ly = L * u;
        this.drawLeaf(lx, ly, Math.PI / 2 + (k % 2 ? 0.9 : -0.9), 18 * (this.mobile ? 0.8 : 1), 0.45, vineC, "rgba(255,255,255,0.08)", "rgba(0,0,0,0)");
      }
    }

    // foreground leaves: they start closed across the view and part as you land
    p = par(48);
    const fillL = this.c("#1d4a30", "#040f12", "#3a3424");
    const veinL = n > 0.5 ? "rgba(120,170,190,0.18)" : "rgba(170,230,160,0.35)";
    const rimL = n > 0.5 ? "rgba(140,190,210,0.25)" : "rgba(220,255,200,0.35)";
    for (const L of this.leaves) {
      const sideX = L.side < 0 ? 0 : W;
      const closed = (1 - open) * W * 0.42 * -L.side;
      const len = L.len * Math.min(W, H * 1.4) * (this.mobile ? 1.2 : 1);
      const sway = Math.sin(t * 0.9 + L.ph) * 0.05;
      const ang = L.ang + sway + (1 - open) * 0.25 * -L.side;
      const x = sideX + closed + p.x - L.side * 10;
      const y = L.ay * H + p.y;
      if (L.frond) this.drawFrond(x, y, ang, len * 1.2, fillL, t);
      else this.drawLeaf(x, y, ang, len, L.wid, fillL, veinL, rimL);
    }
    // ferns along the bottom
    for (let k = 0; k < 9; k++) {
      const x = (k / 8) * W + p.x;
      const ang = -Math.PI / 2 + (k % 2 ? 0.6 : -0.6) + Math.sin(t + k) * 0.04;
      this.drawFrond(x, H + 20 + (1 - open) * 120, ang, H * (this.mobile ? 0.16 : 0.2), fillL, t);
    }
    // vignette
    const vg = g.createRadialGradient(W / 2, H * 0.55, Math.min(W, H) * 0.3, W / 2, H * 0.55, Math.max(W, H) * 0.8);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, `rgba(0,8,10,${0.45 + n * 0.25})`);
    g.fillStyle = vg;
    g.fillRect(0, 0, W, H);
  };

  private drawFeature(t: number, n: number, p: { x: number; y: number }) {
    const g = this.g;
    const { W, H } = this;
    const k = this.kind;
    const s = this.mobile ? 0.7 : 1;
    const fx = W * 0.82 + p.x;
    const fy = H * 0.86 + p.y;
    if (k === "shallows" || k === "reef") {
      g.save();
      g.translate(W * 0.5 + p.x, H * 0.97 + p.y);
      g.scale(1, 0.18);
      const lg = g.createRadialGradient(0, 0, 0, 0, 0, W * 0.4);
      lg.addColorStop(0, this.c("#7fd8d4", "#1f4c5a"));
      lg.addColorStop(1, "rgba(60,160,170,0)");
      g.fillStyle = lg;
      g.beginPath();
      g.arc(0, 0, W * 0.4, 0, TAU);
      g.fill();
      g.restore();
      for (let i = 0; i < 12; i++) {
        const x = W * (0.3 + (i / 11) * 0.4) + p.x;
        const y = H * (0.94 + (i % 3) * 0.015) + p.y;
        g.fillStyle = `rgba(255,255,255,${0.3 * Math.max(0, Math.sin(t * 2 + i))})`;
        g.fillRect(x, y, 18, 1.5);
      }
      if (k === "reef") {
        for (let i = 0; i < 26; i++) {
          const x = W * (0.08 + ((i * 37) % 84) / 100) + p.x;
          const y = H * (0.9 + ((i * 13) % 9) / 100) + p.y;
          const tw = 0.5 + 0.5 * Math.sin(t * 2 + i * 1.7);
          this.glow(x, y, 14 * s, i % 3 === 0 ? "255,140,200" : "90,235,230", (0.35 + 0.35 * n) * tw);
        }
      }
    }
    if (k === "village" || k === "dock") {
      const huts = k === "village" ? [0, -70, 70] : [0];
      for (const ox of huts) {
        const hx = fx + ox * s;
        const hy = fy - Math.abs(ox) * 0.15;
        g.fillStyle = this.c("#6a4a2e", "#060d12", "#5a3a28");
        g.fillRect(hx - 22 * s, hy - 26 * s, 44 * s, 24 * s);
        g.fillStyle = this.c("#8a6a3c", "#070e13", "#6e4c34");
        g.beginPath();
        g.moveTo(hx - 32 * s, hy - 24 * s);
        g.quadraticCurveTo(hx, hy - 64 * s, hx + 32 * s, hy - 24 * s);
        g.fill();
        const fl = 0.8 + 0.2 * Math.sin(t * 6 + ox);
        this.glow(hx, hy - 14 * s, 50 * s, "255,180,90", (0.2 + 0.5 * n) * fl);
        g.fillStyle = `rgba(255,205,120,${0.6 + 0.4 * n})`;
        g.fillRect(hx - 6 * s, hy - 20 * s, 12 * s, 10 * s);
      }
      if (k === "dock") {
        for (const ox of [-90, 90]) {
          const lx = fx + ox * s;
          g.strokeStyle = this.c("#5a4630", "#04090d");
          g.lineWidth = 3;
          g.beginPath();
          g.moveTo(lx, fy + 10);
          g.lineTo(lx, fy - 50 * s);
          g.stroke();
          this.glow(lx, fy - 54 * s, 40 * s, "255,200,110", 0.3 + 0.5 * n);
          g.fillStyle = "rgba(255,220,150,0.95)";
          g.fillRect(lx - 4 * s, fy - 58 * s, 8 * s, 9 * s);
        }
      }
    }
    if (k === "fire") {
      const fl = 0.75 + 0.25 * Math.sin(t * 9) * Math.sin(t * 3.7);
      this.glow(fx, fy - 20 * s, 180 * s, "255,130,50", (0.3 + 0.35 * n) * fl);
      for (let i = 0; i < 3; i++) {
        g.fillStyle = i === 0 ? "rgba(255,110,40,0.95)" : i === 1 ? "rgba(255,175,70,0.95)" : "rgba(255,235,165,0.95)";
        const fh = (60 - i * 16) * s * (0.85 + 0.25 * Math.sin(t * (8 + i) + i));
        g.beginPath();
        g.moveTo(fx - (20 - i * 6) * s, fy);
        g.quadraticCurveTo(fx - 8 * s, fy - fh * 0.6, fx + Math.sin(t * 5 + i) * 5 * s, fy - fh);
        g.quadraticCurveTo(fx + 8 * s, fy - fh * 0.5, fx + (20 - i * 6) * s, fy);
        g.fill();
      }
      for (let i = 0; i < 18; i++) {
        const life = (t * 0.5 + i * 0.137) % 1;
        g.fillStyle = `rgba(255,190,90,${(1 - life) * 0.9})`;
        g.beginPath();
        g.arc(fx + Math.sin(i * 3.1 + t * 2) * 30 * s * life, fy - 50 * s - life * 220 * s, 2 * s, 0, TAU);
        g.fill();
      }
    }
  }
}
