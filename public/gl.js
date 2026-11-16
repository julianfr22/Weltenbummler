/* =====================================================================
   WELTENBUMMLER – 3D-Welt (WebGL, ohne fremde Bibliotheken)

   Die ganze Welt ist echtes 3D-Gelände im Low-Poly-Stil:
   · Höhen, Küsten und Farben stammen aus world.js (aus der Landkarte berechnet)
   · Wasser mit Wellen & Brandung, Berge, Bäume, Sehenswürdigkeiten, Flughäfen
   · Felder sind achteckige Podeste, Wege liegen als Bänder auf dem Gelände
   · Figuren, Koffer, Flugzeug, Boote, Wolken und Partikel werden jedes Bild bewegt
   ===================================================================== */
(function () {
"use strict";
const WB = window.WB, B = WB.BOARD, N = B.nodes, WD = window.WB_WORLD;
const U = 100;                       // 100 Karten-Pixel = 1 Einheit in der 3D-Welt
const WW = B.w / U, WH = B.h / U;

/* ---------- Farben ---------- */
const hex = (h) => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const mul = (a, f) => [a[0] * f, a[1] * f, a[2] * f];
const SEATS = ["#E76F51", "#2A9D8F", "#E9C46A", "#8E6FB0", "#4A90B8", "#F4A261", "#D46A9F", "#7FB069"];
const LOOKS = {
  skin:    { label: "Hautfarbe",     names: ["Pfirsich", "Karamell", "Zimt", "Kakao", "Zitrone", "Minze", "Flieder", "Roboter"],
             cols: ["#FFD9B8", "#E8B48A", "#B87D55", "#6F4A33", "#FFD95A", "#8FDCC0", "#C3A6F2", "#A9BCCD"] },
  hair:    { label: "Frisur",        names: ["Kurz", "Locken", "Lang", "Pferdeschwanz", "Dutt", "Igel", "Glatze"] },
  hairc:   { label: "Haarfarbe",     names: ["Schwarz", "Braun", "Blond", "Rot", "Grau", "Pink"],
             cols: ["#22201F", "#6B3F22", "#E8C45F", "#C4502A", "#B9BDC2", "#E06C9F"] },
  hat:     { label: "Kopfbedeckung", names: ["Ohne", "Cap", "Zylinder", "Krone", "Mütze", "Cowboyhut", "Sombrero", "Partyhut", "Tropenhelm"] },
  glasses: { label: "Brille",        names: ["Ohne", "Rund", "Sonnenbrille", "Pink", "Skibrille"] },
  shirt:   { label: "T-Shirt",       names: ["Terracotta", "Teal", "Mustard", "Apricot", "Petrol", "Weiss", "Lila", "Pink"],
             cols: ["#E76F51", "#2A9D8F", "#E9C46A", "#F4A261", "#264653", "#FBF7F0", "#8E6FB0", "#E06C9F"] },
  shoes:   { label: "Schuhe",        names: ["Petrol", "Weiss", "Rot", "Gelb", "Teal", "Braun"],
             cols: ["#1B333D", "#F2EEE6", "#D64545", "#E9C46A", "#2A9D8F", "#7A4E2D"] },
};
const C = { petrol: hex("#264653"), dark: hex("#1B333D"), terra: hex("#E76F51"), teal: hex("#2A9D8F"), mustard: hex("#E9C46A"),
            apricot: hex("#F4A261"), white: [0.98, 0.97, 0.94], brown: hex("#8A5A33"), brownD: hex("#5E3B20"), beige: hex("#E8D9B5"), black: [0.1, 0.12, 0.14],
            cream: [0.97, 0.94, 0.87], purple: hex("#8E44AD"), stone: [0.72, 0.7, 0.66], stoneD: [0.52, 0.5, 0.48], rock: [0.58, 0.47, 0.37], ice: [0.86, 0.93, 0.98],
            wood: hex("#9B6B3D"), red: hex("#D64545"), gold: hex("#F2C14E"), green: hex("#5FAE4B"), greenD: hex("#2F7D46"), pine: hex("#2C6E52"), jungle: hex("#2E8B4A"), palm: hex("#4FA83D"), sandc: hex("#E9CF95") };
const FIELD = { coin: C.mustard, life: C.terra, item: C.teal, luck: hex("#8E6FB0"), prop: C.petrol, air: [1, 1, 1], sea: hex("#B58A55") };
const SKY = [0.6, 0.82, 0.97];

/* ---------- Matrizen (spaltenweise, wie WebGL sie erwartet) ---------- */
const M = {
  I: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
  mul(a, b) { const o = new Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3]; return o; },
  ch() { let m = arguments[0]; for (let i = 1; i < arguments.length; i++) m = M.mul(m, arguments[i]); return m; },
  t(x, y, z) { return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1]; },
  s(x, y, z) { return [x, 0, 0, 0, 0, y == null ? x : y, 0, 0, 0, 0, z == null ? x : z, 0, 0, 0, 0, 1]; },
  ry(a) { const c = Math.cos(a), s = Math.sin(a); return [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]; },
  rx(a) { const c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]; },
  rz(a) { const c = Math.cos(a), s = Math.sin(a); return [c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]; },
  persp(fovy, asp, n, f) { const k = 1 / Math.tan(fovy / 2), nf = 1 / (n - f); return [k / asp, 0, 0, 0, 0, k, 0, 0, 0, 0, (f + n) * nf, -1, 0, 0, 2 * f * n * nf, 0]; },
  look(e, c) {
    let zx = e[0] - c[0], zy = e[1] - c[1], zz = e[2] - c[2]; let l = Math.hypot(zx, zy, zz); zx /= l; zy /= l; zz /= l;
    let xx = zz, xy = 0, xz = -zx; l = Math.hypot(xx, xz); xx /= l; xz /= l;
    const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
    return [xx, yx, zx, 0, xy, yy, zy, 0, xz, yz, zz, 0, -(xx * e[0] + xy * e[1] + xz * e[2]), -(yx * e[0] + yy * e[1] + yz * e[2]), -(zx * e[0] + zy * e[1] + zz * e[2]), 1];
  },
  pt(m, x, y, z) { return [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]]; },
};
const at = (x, y, z, ry, s) => M.ch(M.t(x, y, z), M.ry(ry || 0), M.s(s == null ? 1 : s));

/* Zufall mit festem Startwert – die Welt sieht bei allen Spielern gleich aus */
let seed = 7;
function rnd() { seed = (seed * 16807) % 2147483647; return (seed & 0xffffff) / 0x1000000; }
const rr = (a, b) => a + rnd() * (b - a);

/* =====================================================================
   BAUKASTEN: flach schattierte Dreiecke mit eigener Farbe pro Fläche
   Jeder Punkt: x,y,z · Normale · r,g,b,a  (10 Zahlen)
   ===================================================================== */
function Builder() { this.a = []; this.k = 0; this.vary = 0.07; }
Builder.prototype.tri = function (p, q, r, col, ref, alpha) {
  let ux = q[0] - p[0], uy = q[1] - p[1], uz = q[2] - p[2], vx = r[0] - p[0], vy = r[1] - p[1], vz = r[2] - p[2];
  let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
  if (ref) { const cx = (p[0] + q[0] + r[0]) / 3 - ref[0], cy = (p[1] + q[1] + r[1]) / 3 - ref[1], cz = (p[2] + q[2] + r[2]) / 3 - ref[2]; if (nx * cx + ny * cy + nz * cz < 0) { nx = -nx; ny = -ny; nz = -nz; } }
  this.k = (this.k * 7 + 3) % 11; const f = 1 + (this.k / 10 - 0.5) * this.vary, al = alpha == null ? 1 : alpha;
  for (const v of [p, q, r]) this.a.push(v[0], v[1], v[2], nx, ny, nz, col[0] * f, col[1] * f, col[2] * f, al);
};
Builder.prototype.quad = function (a, b, c, d, col, ref, alpha) { this.tri(a, b, c, col, ref, alpha); this.tri(a, c, d, col, ref, alpha); };
/* Vieleck-Säule/Kegelstumpf: Radius r0 unten (y0) bis r1 oben (y1) */
Builder.prototype.prism = function (m, sides, r0, r1, y0, y1, col, o) {
  o = o || {}; const rot = o.rot || 0, sx = o.sx || 1, sz = o.sz || 1, jit = o.jit || 0, ref = M.pt(m, 0, (y0 + y1) / 2, 0), lo = [], hi = [];
  for (let i = 0; i < sides; i++) { const a = rot + (i / sides) * Math.PI * 2, j = jit ? 1 + (rnd() - 0.5) * jit : 1, cx = Math.cos(a) * sx * j, cz = Math.sin(a) * sz * j; lo.push(M.pt(m, cx * r0, y0, cz * r0)); hi.push(M.pt(m, cx * r1, y1, cz * r1)); }
  for (let i = 0; i < sides; i++) { const k = (i + 1) % sides; if (r1 > 0.0001) this.quad(lo[i], lo[k], hi[k], hi[i], col, ref); else this.tri(lo[i], lo[k], hi[i], col, ref); }
  if (o.top !== false && r1 > 0.0001) { const c = M.pt(m, 0, y1, 0), tc = o.topCol || col; for (let i = 0; i < sides; i++) this.tri(c, hi[i], hi[(i + 1) % sides], tc, ref); }
  if (o.bottom) { const c = M.pt(m, 0, y0, 0); for (let i = 0; i < sides; i++) this.tri(c, lo[i], lo[(i + 1) % sides], col, ref); }
  return this;
};
/* Quader: steht auf y=0, Breite w (x), Höhe h, Tiefe d (z) */
Builder.prototype.box = function (m, w, h, d, col, topCol) {
  const p = (x, y, z) => M.pt(m, x * w / 2, y * h, z * d / 2), ref = M.pt(m, 0, h / 2, 0);
  const v = [p(-1, 0, -1), p(1, 0, -1), p(1, 0, 1), p(-1, 0, 1), p(-1, 1, -1), p(1, 1, -1), p(1, 1, 1), p(-1, 1, 1)];
  for (const f of [[0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]]) this.quad(v[f[0]], v[f[1]], v[f[2]], v[f[3]], col, ref);
  this.quad(v[4], v[5], v[6], v[7], topCol || col, ref); this.quad(v[0], v[1], v[2], v[3], col, ref);
  return this;
};
/* kantige Kugel */
Builder.prototype.blob = function (m, rx, ry, rz, col, seg, rings, jit) {
  seg = seg || 6; rings = rings || 4; const ref = M.pt(m, 0, 0, 0), g = [];
  for (let r = 0; r <= rings; r++) { const p = (r / rings) * Math.PI, y = Math.cos(p), q = Math.sin(p), row = [];
    for (let s = 0; s < seg; s++) { const a = (s / seg) * Math.PI * 2 + (r % 2) * 0.5, j = jit ? 1 + (rnd() - 0.5) * jit : 1; row.push(M.pt(m, q * Math.cos(a) * rx * j, y * ry * j, q * Math.sin(a) * rz * j)); } g.push(row); }
  for (let r = 0; r < rings; r++) for (let s = 0; s < seg; s++) { const k = (s + 1) % seg; if (r > 0) this.tri(g[r][s], g[r][k], g[r + 1][s], col, ref); if (r < rings - 1) this.tri(g[r][k], g[r + 1][k], g[r + 1][s], col, ref); }
  return this;
};
/* flaches Vieleck (liegt waagrecht, zeigt nach oben) – pts in lokalen x/z-Koordinaten */
Builder.prototype.poly = function (m, pts, y, col, alpha) {
  let cx = 0, cz = 0; for (const p of pts) { cx += p[0]; cz += p[1]; } cx /= pts.length; cz /= pts.length;
  const c = M.pt(m, cx, y, cz), ref = M.pt(m, cx, y - 5, cz), w = pts.map((p) => M.pt(m, p[0], y, p[1]));
  for (let i = 0; i < w.length; i++) this.tri(c, w[i], w[(i + 1) % w.length], col, ref, alpha);
  return this;
};
Builder.prototype.rect = function (m, x0, z0, x1, z1, y, col) { return this.poly(m, [[x0, z0], [x1, z0], [x1, z1], [x0, z1]], y, col); };

/* =====================================================================
   GELÄNDE
   ===================================================================== */
let hV = null, bioV = null, colC = null, GW = 0, GH = 0, CELL = 0.05;
function hAt(x, z) {                        // Geländehöhe an beliebiger Stelle
  const fx = Math.max(0, Math.min(GW - 0.001, x / CELL)), fz = Math.max(0, Math.min(GH - 0.001, z / CELL)), i = fx | 0, j = fz | 0, u = fx - i, v = fz - j, w = GW + 1;
  return (hV[j * w + i] * (1 - u) + hV[j * w + i + 1] * u) * (1 - v) + (hV[(j + 1) * w + i] * (1 - u) + hV[(j + 1) * w + i + 1] * u) * v;
}
const nodeTop = [];
function nodeBase(i) { return N[i].t === "sea" ? 0 : hAt(N[i].x / U, N[i].y / U); }
/* Höhe, auf der eine Figur an Stelle x/z steht (Podest, Gelände oder Wasser) */
function surf(x, z) {
  let best = 9, bi = -1;
  for (let i = 0; i < N.length; i++) { const dx = N[i].x / U - x, dz = N[i].y / U - z, d = dx * dx + dz * dz; if (d < best) { best = d; bi = i; } }
  const g = Math.max(hAt(x, z) + 0.006, 0.0), d = Math.sqrt(best);
  if (d < 0.15) return nodeTop[bi]; if (d < 0.24) { const k = (d - 0.15) / 0.09; return nodeTop[bi] * (1 - k) + g * k; }
  return g;
}

function buildTerrain(b) {
  const w = GW + 1, P = new Array(w * (GH + 1));
  for (let j = 0; j <= GH; j++) for (let i = 0; i <= GW; i++) {
    const e = i === 0 || j === 0 || i === GW || j === GH, h1 = Math.sin(i * 12.9898 + j * 78.233) * 43758.5453, h2 = Math.sin(i * 39.346 + j * 11.135) * 24634.6345;
    P[j * w + i] = [i * CELL + (e ? 0 : ((h1 - Math.floor(h1)) - 0.5) * CELL * 0.5), hV[j * w + i], j * CELL + (e ? 0 : ((h2 - Math.floor(h2)) - 0.5) * CELL * 0.5)];
  }
  const rockLand = [0.62, 0.5, 0.38], rockIce = [0.68, 0.76, 0.86];
  const face = (p, q, r, c, bio) => {
    const ux = q[0] - p[0], uy = q[1] - p[1], uz = q[2] - p[2], vx = r[0] - p[0], vy = r[1] - p[1], vz = r[2] - p[2];
    const ny = Math.abs(uz * vx - ux * vz) / (Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) || 1), top = Math.max(p[1], q[1], r[1]);
    let col = c;
    if (top > 0.02 && ny < 0.9) col = mix(col, bio === 4 ? rockIce : rockLand, Math.min(1, (0.9 - ny) * 3.2));   // steile Flächen = Fels
    if (top > 0.3) col = mix(col, [1, 1, 1], Math.min(1, (top - 0.3) * 6));
    b.tri(p, q, r, col, [p[0], -50, p[2]]);
  };
  for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) {
    const a = P[j * w + i], bb = P[j * w + i + 1], c = P[(j + 1) * w + i + 1], d = P[(j + 1) * w + i];
    if (a[1] < -0.172 && bb[1] < -0.172 && c[1] < -0.172 && d[1] < -0.172) continue;      // tiefes Meer: nur Wasser
    const k = (j * GW + i) * 3, col = [colC[k], colC[k + 1], colC[k + 2]], bio = bioV[j * w + i];
    if ((i + j) % 2) { face(a, bb, c, col, bio); face(a, c, d, col, bio); } else { face(a, bb, d, col, bio); face(bb, c, d, col, bio); }
  }
}

/* ---------- Wege ---------- */
function buildPaths(b, dec) {
  const seen = new Set();
  N.forEach((n, a) => n.n.forEach((bi) => {
    const m = N[bi], two = m.n.includes(a), key = Math.min(a, bi) + "-" + Math.max(a, bi), sea = n.t === "sea" || m.t === "sea";
    const ax = n.x / U, az = n.y / U, bx = m.x / U, bz = m.y / U, len = Math.hypot(bx - ax, bz - az), dx = (bx - ax) / len, dz = (bz - az) / len, px = -dz, pz = dx;
    if (!seen.has(key)) {
      seen.add(key);
      if (sea) {                                              // Bojenkette übers Meer
        const cnt = Math.max(2, Math.round(len / 0.085));
        for (let i = 1; i < cnt; i++) { const t = i / cnt, x = ax + (bx - ax) * t, z = az + (bz - az) * t; if (Math.min(t * len, (1 - t) * len) < 0.13) continue;
          b.prism(at(x, 0, z), 6, 0.017, 0.012, -0.01, 0.022, i % 2 ? C.terra : C.white); b.prism(at(x, 0, z), 5, 0.006, 0.0, 0.022, 0.042, C.white); }
      } else {
        const cnt = Math.max(2, Math.ceil(len / 0.035)), L = [], R = [], L2 = [], R2 = [];
        for (let i = 0; i <= cnt; i++) { const t = i / cnt, x = ax + (bx - ax) * t, z = az + (bz - az) * t, y = Math.max(hAt(x, z), 0.02) + 0.014;
          L.push([x + px * 0.047, y, z + pz * 0.047]); R.push([x - px * 0.047, y, z - pz * 0.047]); L2.push([x + px * 0.03, y + 0.005, z + pz * 0.03]); R2.push([x - px * 0.03, y + 0.005, z - pz * 0.03]); }
        for (let i = 0; i < cnt; i++) { const ref = [L[i][0], -50, L[i][2]]; b.quad(L[i], R[i], R[i + 1], L[i + 1], [0.5, 0.4, 0.3], ref); b.quad(L2[i], R2[i], R2[i + 1], L2[i + 1], i % 2 ? [0.99, 0.95, 0.84] : [0.95, 0.9, 0.78], ref); }
      }
    }
    if (!two && !sea) {                                       // Pfeil auf Einbahn-Wegen
      for (const t of [0.5]) { const x = ax + (bx - ax) * t, z = az + (bz - az) * t, y = Math.max(hAt(x, z), 0.02) + 0.024, s = 0.032, ref = [x, -50, z];
        const tip = [x + dx * s, y, z + dz * s], l = [x - dx * s * 0.8 + px * s * 0.9, y, z - dz * s * 0.8 + pz * s * 0.9], r = [x - dx * s * 0.8 - px * s * 0.9, y, z - dz * s * 0.8 - pz * s * 0.9], mid = [x - dx * s * 0.25, y, z - dz * s * 0.25];
        b.tri(tip, l, mid, C.terra, ref); b.tri(tip, mid, r, C.terra, ref); }
    }
  }));
}

/* ---------- Felder: achteckige Podeste mit erhabenem Symbol ---------- */
function heartPts(s) { const p = []; for (let i = 0; i < 18; i++) { const t = (i / 18) * Math.PI * 2; p.push([16 * Math.pow(Math.sin(t), 3) / 17 * s, -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 17 * s]); } return p; }
function starPts(s) { const p = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, q = i % 2 ? s * 0.42 : s; p.push([Math.cos(a) * q, Math.sin(a) * q]); } return p; }
function fieldIcon(b, m, type, y, r) {
  const W_ = C.white;
  switch (type) {
    case "coin": b.poly(m, starPts(1).map((_, i) => { const a = (i / 10) * Math.PI * 2; return [Math.cos(a) * r * 0.86, Math.sin(a) * r * 0.86]; }), y, [0.99, 0.86, 0.45]);
      b.rect(m, -r * 0.44, -r * 0.5, r * 0.44, -r * 0.24, y + 0.003, C.petrol); b.rect(m, -r * 0.13, -r * 0.24, r * 0.13, r * 0.55, y + 0.003, C.petrol); break;
    case "life": b.poly(m, heartPts(r * 0.74), y, W_); break;
    case "item": b.rect(m, -r * 0.5, -r * 0.12, r * 0.5, r * 0.6, y, W_); b.rect(m, -r * 0.6, -r * 0.38, r * 0.6, -r * 0.12, y, W_); b.rect(m, -r * 0.1, -r * 0.38, r * 0.1, r * 0.6, y + 0.003, C.mustard);
      b.poly(m, [[0, -r * 0.38], [-r * 0.42, -r * 0.72], [-r * 0.5, -r * 0.42]], y + 0.003, C.mustard); b.poly(m, [[0, -r * 0.38], [r * 0.42, -r * 0.72], [r * 0.5, -r * 0.42]], y + 0.003, C.mustard); break;
    case "luck": b.poly(m, starPts(r * 0.78), y, W_); break;
    case "prop": b.rect(m, -r * 0.38, -r * 0.6, -r * 0.24, r * 0.62, y, W_); b.poly(m, [[-r * 0.24, -r * 0.6], [r * 0.56, -r * 0.3], [-r * 0.24, 0]], y, W_); break;
    case "air": { const q = M.mul(m, M.ry(Math.PI / 4)), P_ = C.purple;
      b.poly(q, [[r * 0.72, 0], [r * 0.5, -r * 0.12], [-r * 0.6, -r * 0.1], [-r * 0.7, 0], [-r * 0.6, r * 0.1], [r * 0.5, r * 0.12]], y, P_);
      b.poly(q, [[r * 0.2, 0], [-r * 0.28, -r * 0.66], [-r * 0.46, -r * 0.66], [-r * 0.14, 0]], y, P_); b.poly(q, [[r * 0.2, 0], [-r * 0.14, 0], [-r * 0.46, r * 0.66], [-r * 0.28, r * 0.66]], y, P_);
      b.poly(q, [[-r * 0.46, 0], [-r * 0.74, -r * 0.28], [-r * 0.62, 0], [-r * 0.74, r * 0.28]], y, P_); break; }
    case "sea": for (const dz of [-0.28, 0.22]) { const pts = [], n = 8; for (let i = 0; i <= n; i++) pts.push([(-0.6 + (1.2 * i) / n) * r, (dz + Math.sin((i / n) * Math.PI * 2) * 0.16) * r]);
        for (let i = 0; i < n; i++) b.poly(m, [pts[i], pts[i + 1], [pts[i + 1][0], pts[i + 1][1] + r * 0.2], [pts[i][0], pts[i][1] + r * 0.2]], y, [0.75, 0.92, 0.98]); } break;
  }
}
function buildFields(b, dec) {
  N.forEach((n, i) => {
    const x = n.x / U, z = n.y / U, y0 = nodeBase(i), m = at(x, y0, z), rot = Math.PI / 8;
    if (n.t === "sea") {                                      // Floss
      b.prism(m, 8, 0.118, 0.11, -0.03, 0.008, C.white, { rot }); b.prism(m, 8, 0.092, 0.092, 0.008, 0.013, [0.36, 0.7, 0.9], { rot });
      for (let k = 0; k < 4; k++) { const a = 0.4 + k * 1.571, q = at(x + Math.cos(a) * 0.135, 0, z + Math.sin(a) * 0.135); b.prism(q, 6, 0.016, 0.012, -0.01, 0.024, C.terra); b.prism(q, 5, 0.006, 0, 0.024, 0.05, C.white); }
      fieldIcon(b, m, "sea", 0.0155, 0.075); nodeTop[i] = 0.014; return;
    }
    const air = n.t === "air", R = air ? 0.15 : 0.122, rim = air ? C.purple : C.cream;
    b.prism(m, 8, R * 1.04, R, -0.09, 0.04, mul(rim, 0.86), { rot, top: false });      // Sockel
    b.prism(m, 8, R, R * 0.9, 0.04, 0.056, rim, { rot });                              // abgeschrägter Rand
    b.prism(m, 8, R * 0.8, R * 0.8, 0.056, 0.062, FIELD[n.t], { rot });                // farbige Fläche
    fieldIcon(b, m, n.t, 0.0655, R * 0.72);
    dec.poly(at(x, y0 + 0.004, z), starPts(1).map((_, k) => { const a = (k / 10) * Math.PI * 2; return [Math.cos(a) * R * 1.35, Math.sin(a) * R * 1.35 + 0.02]; }), 0, [0, 0.06, 0.1], 0.22);
    nodeTop[i] = y0 + 0.063;
  });
}

/* ---------- Bäume, Felsen, Eisberge ---------- */
function buildProps(b, dec) {
  seed = 99;
  for (const [ty, px, py, s, r] of WD.props) {
    const x = px / U, z = py / U, y = ty === 9 ? 0 : hAt(x, z) - 0.006, m = at(x, y, z, r, s * 0.9);
    const shadow = (rad) => dec.poly(at(x + 0.012, y + 0.012, z + 0.012), [0, 1, 2, 3, 4, 5, 6, 7].map((k) => [Math.cos(k * 0.785) * rad * s, Math.sin(k * 0.785) * rad * s]), 0, [0, 0.08, 0.1], 0.2);
    switch (ty) {
      case 0: case 4: { const g = mix(C.pine, C.greenD, rnd() * 0.6), sn = ty === 4; shadow(0.05);
        b.prism(m, 5, 0.012, 0.01, 0, 0.05, C.brownD, { top: false }); b.prism(m, 6, 0.058, 0, 0.035, 0.12, g, { rot: r }); b.prism(m, 6, 0.046, 0, 0.085, 0.165, sn ? mix(g, C.white, 0.7) : mul(g, 1.1), { rot: r + 0.5 }); b.prism(m, 5, 0.032, 0, 0.135, 0.215, sn ? C.white : mul(g, 1.2), { rot: r }); break; }
      case 1: { const g = mix(C.green, hex("#8CBF3F"), rnd()); shadow(0.055);
        b.prism(m, 5, 0.014, 0.011, 0, 0.07, C.brown, { top: false }); b.blob(M.mul(m, M.t(0, 0.115, 0)), 0.062, 0.058, 0.062, g, 6, 4, 0.25); b.blob(M.mul(m, M.t(0.03, 0.15, 0.01)), 0.04, 0.038, 0.04, mul(g, 1.1), 5, 3, 0.25); break; }
      case 2: { shadow(0.05); let q = m; const lean = rr(0.08, 0.2);
        for (let k = 0; k < 4; k++) { b.prism(q, 5, 0.013 - k * 0.0015, 0.011 - k * 0.0015, 0, 0.052, k % 2 ? C.brown : C.wood, { top: false }); q = M.ch(q, M.t(0, 0.05, 0), M.rz(lean)); }
        for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2 + rnd(), L = M.ch(q, M.ry(a), M.rz(-0.5));
          b.tri(M.pt(L, 0, 0, -0.018), M.pt(L, 0, 0, 0.018), M.pt(L, 0.075, 0.006, 0), C.palm, null); b.tri(M.pt(L, 0.075, 0.006, 0), M.pt(L, 0.045, 0.02, 0.02), M.pt(L, 0.13, -0.045, 0), mul(C.palm, 0.85), null); b.tri(M.pt(L, 0.075, 0.006, 0), M.pt(L, 0.045, 0.02, -0.02), M.pt(L, 0.13, -0.045, 0), mul(C.palm, 1.1), null); }
        b.blob(q, 0.014, 0.014, 0.014, C.brownD, 4, 2); break; }
      case 3: { const g = mix(C.jungle, hex("#1F6B3A"), rnd()); shadow(0.07);
        b.prism(m, 5, 0.018, 0.012, 0, 0.1, C.brownD, { top: false }); b.blob(M.mul(m, M.t(0, 0.13, 0)), 0.078, 0.05, 0.078, g, 7, 3, 0.3); b.blob(M.mul(m, M.t(-0.02, 0.17, 0.015)), 0.055, 0.04, 0.055, mul(g, 1.15), 6, 3, 0.3); b.blob(M.mul(m, M.t(0.03, 0.2, -0.01)), 0.035, 0.03, 0.035, mul(g, 1.28), 5, 3, 0.3); break; }
      case 5: b.blob(M.mul(m, M.t(0, 0.012, 0)), 0.04, 0.03, 0.034, mix(C.rock, C.stone, rnd()), 5, 3, 0.5); if (rnd() > 0.5) b.blob(M.mul(m, M.t(0.04, 0.006, 0.02)), 0.02, 0.016, 0.02, C.stoneD, 4, 2, 0.4); break;
      case 6: { const g = hex("#4E9A5B"); b.prism(m, 6, 0.016, 0.014, 0, 0.1, g); b.prism(M.ch(m, M.t(0.016, 0.04, 0), M.rz(-1.1)), 5, 0.009, 0.009, 0, 0.03, g); b.prism(M.mul(m, M.t(0.04, 0.05, 0)), 5, 0.009, 0.008, 0, 0.04, g); b.prism(M.mul(m, M.t(-0.03, 0.03, 0)), 5, 0.009, 0.008, 0, 0.035, g); break; }
      case 7: b.prism(m, 5, 0.04, 0.012, 0, rr(0.05, 0.11), mix(C.ice, C.white, rnd()), { jit: 0.5 }); if (rnd() > 0.4) b.prism(M.mul(m, M.t(0.04, 0, 0.02)), 4, 0.022, 0.006, 0, 0.045, C.ice, { jit: 0.4 }); break;
      case 8: b.blob(M.mul(m, M.t(0, 0.018, 0)), 0.034, 0.024, 0.034, mix(hex("#9DB04A"), C.green, rnd()), 5, 3, 0.3); break;
      case 9: b.prism(m, 6, 0.1, 0.07, -0.04, rr(0.05, 0.1), C.white, { jit: 0.5, topCol: [1, 1, 1] }); b.prism(M.mul(m, M.t(0.03, 0, 0.02)), 5, 0.05, 0.02, 0.05, rr(0.13, 0.2), C.ice, { jit: 0.5 }); break;
    }
  }
}

/* ---------- Berge ---------- */
function peak(b, x, z, rad, H, snow, tone) {
  const y = hAt(x, z) - 0.04, m = at(x, y, z, rnd() * 6, 1), sides = 7, rock = mix([0.52, 0.47, 0.5], [0.6, 0.5, 0.4], tone), k = 0.56;
  const ring = (r, yy, j) => { const a = []; for (let i = 0; i < sides; i++) { const an = (i / sides) * Math.PI * 2, q = r * (1 + (rnd() - 0.5) * j); a.push(M.pt(m, Math.cos(an) * q, yy, Math.sin(an) * q)); } return a; };
  const r0 = ring(rad, 0, 0.3), r1 = ring(rad * (1 - k) * 1.05, H * k, 0.35), top = M.pt(m, rad * 0.06, H, 0), ref = M.pt(m, 0, H * 0.3, 0);
  for (let i = 0; i < sides; i++) { const n = (i + 1) % sides; b.quad(r0[i], r0[n], r1[n], r1[i], mul(rock, 0.94 + rnd() * 0.12), ref); b.tri(r1[i], r1[n], top, snow ? [0.98, 0.99, 1] : mul(rock, 1.18), ref); }
}
function buildMountains(b) {
  seed = 5;
  for (const [px, py, h, w, snow] of WD.mt) {
    const x = px / U, z = py / U, rad = (w / U) * 0.8, H = h * 1.7 + 0.16, tone = rnd();
    peak(b, x, z, rad, H, snow, tone);
    for (let k = 0; k < 3; k++) { const a = rnd() * 6.28, d = rad * rr(0.75, 1.05), s = rr(0.42, 0.62); peak(b, x + Math.cos(a) * d, z + Math.sin(a) * d * 0.8, rad * s, H * s, snow && s > 0.48, tone); }
  }
}

/* ---------- Sehenswürdigkeiten ---------- */
const LM = {
  nyc(b, m) { const g = [[0.55, 0.66, 0.78], [0.42, 0.52, 0.66], [0.7, 0.76, 0.84], [0.5, 0.58, 0.62], [0.36, 0.44, 0.56]];
    const T = [[0, 0, 0.07, 0.46], [0.09, 0.02, 0.06, 0.34], [-0.09, 0.03, 0.065, 0.3], [0.04, 0.1, 0.07, 0.24], [-0.05, 0.11, 0.06, 0.2], [0.13, 0.1, 0.05, 0.17], [-0.14, -0.04, 0.055, 0.22], [0.02, -0.09, 0.06, 0.27], [0.13, -0.07, 0.05, 0.19], [-0.07, -0.1, 0.05, 0.16]];
    T.forEach(([x, z, w, h], i) => { const q = M.mul(m, M.t(x, 0, z)), c = g[i % g.length]; b.box(q, w, h, w, c, mul(c, 1.15)); b.box(M.mul(q, M.t(0, h, 0)), w * 0.6, 0.02, w * 0.6, mul(c, 0.8));
      for (let k = 1; k * 0.045 < h - 0.02; k++) b.box(M.mul(q, M.t(0, k * 0.045, 0)), w * 1.02, 0.006, w * 1.02, mul(c, 0.7));
      if (i < 2) b.prism(M.mul(q, M.t(0, h + 0.02, 0)), 4, 0.012, 0.002, 0, 0.1, C.stone); }); },
  liberty(b, m) { const g = [0.5, 0.78, 0.68]; b.prism(m, 8, 0.07, 0.06, 0, 0.02, C.stone); b.box(M.mul(m, M.t(0, 0.02, 0)), 0.07, 0.08, 0.07, C.beige); b.box(M.mul(m, M.t(0, 0.1, 0)), 0.085, 0.012, 0.085, C.stone);
    b.prism(M.mul(m, M.t(0, 0.112, 0)), 7, 0.03, 0.02, 0, 0.13, g); b.blob(M.mul(m, M.t(0, 0.262, 0)), 0.02, 0.022, 0.02, g, 6, 3);
    for (let k = 0; k < 7; k++) { const a = (k / 6) * Math.PI - Math.PI; b.prism(M.ch(m, M.t(Math.cos(a) * 0.016, 0.275, Math.sin(a) * 0.016 * 0.4), M.rz(-Math.cos(a) * 0.9)), 3, 0.005, 0, 0, 0.03, g); }
    b.prism(M.ch(m, M.t(0.024, 0.2, 0), M.rz(-0.25)), 5, 0.008, 0.007, 0, 0.11, g); b.blob(M.mul(m, M.t(0.052, 0.32, 0)), 0.012, 0.018, 0.012, C.gold, 5, 3); b.box(M.ch(m, M.t(-0.028, 0.17, 0.015), M.rz(0.3)), 0.02, 0.04, 0.008, g); },
  goldengate(b, m) { const r = hex("#D9532F"); b.box(M.mul(m, M.t(0, 0.07, 0)), 0.5, 0.012, 0.045, r, [0.35, 0.36, 0.4]);
    for (const x of [-0.13, 0.13]) { for (const z of [-0.022, 0.022]) b.box(M.mul(m, M.t(x, -0.02, z)), 0.016, 0.26, 0.012, r); for (const y of [0.11, 0.16, 0.21]) b.box(M.mul(m, M.t(x, y, 0)), 0.014, 0.012, 0.05, r); }
    for (const z of [-0.022, 0.022]) for (const [x0, y0, x1, y1] of [[-0.25, 0.08, -0.13, 0.235], [-0.13, 0.235, -0.065, 0.12], [-0.065, 0.12, 0, 0.09], [0, 0.09, 0.065, 0.12], [0.065, 0.12, 0.13, 0.235], [0.13, 0.235, 0.25, 0.08]]) {
      const len = Math.hypot(x1 - x0, y1 - y0); b.box(M.ch(m, M.t((x0 + x1) / 2, (y0 + y1) / 2, z), M.rz(Math.atan2(y1 - y0, x1 - x0)), M.t(0, -0.003, 0)), len, 0.006, 0.006, r); } },
  maya(b, m) { const s = [0.74, 0.69, 0.56]; for (let k = 0; k < 6; k++) { const w = 0.34 - k * 0.048; b.box(M.mul(m, M.t(0, k * 0.036, 0)), w, 0.036, w, mul(s, 0.92 + (k % 2) * 0.1), mul(s, 1.1)); }
    b.box(M.mul(m, M.t(0, 0.216, 0)), 0.075, 0.05, 0.075, mul(s, 0.9)); b.box(M.mul(m, M.t(0, 0.266, 0)), 0.09, 0.012, 0.09, s); b.box(M.mul(m, M.t(0, 0.216, 0.03)), 0.028, 0.035, 0.02, C.dark);
    for (const [dx, dz, w, d] of [[0, 1, 0.06, 0.3], [0, -1, 0.06, 0.3], [1, 0, 0.3, 0.06], [-1, 0, 0.3, 0.06]]) b.box(M.ch(m, M.t(dx * 0.095, 0.104, dz * 0.095), dx ? M.rz(-dx * 0.64) : M.rx(dz * 0.64), M.t(0, -0.008, 0)), dx ? 0.27 : w, 0.016, dz ? 0.27 : d, mul(s, 1.18)); },
  christ(b, m) { b.prism(m, 7, 0.1, 0.05, -0.02, 0.12, [0.45, 0.6, 0.38], { jit: 0.35, topCol: [0.55, 0.68, 0.42] }); const q = M.mul(m, M.t(0, 0.12, 0)), w = [0.96, 0.95, 0.92];
    b.box(q, 0.04, 0.035, 0.04, C.stone); b.prism(M.mul(q, M.t(0, 0.035, 0)), 6, 0.02, 0.014, 0, 0.14, w); b.box(M.mul(q, M.t(0, 0.135, 0)), 0.19, 0.018, 0.02, w); b.blob(M.mul(q, M.t(0, 0.195, 0)), 0.016, 0.018, 0.016, w, 6, 3);
    for (const sx of [-1, 1]) b.box(M.mul(q, M.t(sx * 0.07, 0.105, 0)), 0.05, 0.03, 0.012, w); },
  bigben(b, m) { const s = [0.83, 0.72, 0.5], d = [0.36, 0.33, 0.3]; b.box(M.mul(m, M.t(0.07, 0, 0)), 0.13, 0.07, 0.06, mul(s, 0.92)); b.prism(M.ch(m, M.t(0.07, 0.07, 0), M.rz(Math.PI / 2), M.t(0, -0.065, 0)), 3, 0.036, 0.036, 0, 0.13, d, { rot: Math.PI / 2, bottom: true });
    b.box(m, 0.056, 0.26, 0.056, s); b.box(M.mul(m, M.t(0, 0.26, 0)), 0.068, 0.062, 0.068, mul(s, 1.05));
    for (let k = 0; k < 4; k++) { const q = M.ch(m, M.t(0, 0.291, 0), M.ry(k * Math.PI / 2), M.t(0, 0, 0.0345), M.rx(Math.PI / 2)); b.prism(q, 10, 0.024, 0.024, 0, 0.002, C.white); b.box(M.ch(q, M.t(0, 0.002, 0)), 0.004, 0.002, 0.03, C.dark); }
    b.prism(M.mul(m, M.t(0, 0.322, 0)), 4, 0.05, 0.022, 0, 0.05, d, { rot: Math.PI / 4 }); b.prism(M.mul(m, M.t(0, 0.372, 0)), 4, 0.022, 0, 0, 0.07, d, { rot: Math.PI / 4 }); for (let k = 1; k < 5; k++) b.box(M.mul(m, M.t(0, k * 0.052, 0)), 0.06, 0.005, 0.06, mul(s, 0.8)); },
  eiffel(b, m, col, col2) { const c = col || [0.47, 0.37, 0.3], c2 = col2 || c, r4 = { rot: Math.PI / 4 };
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) b.prism(M.ch(m, M.t(sx * 0.07, 0, sz * 0.07), M.rz(sx * 0.33), M.rx(-sz * 0.33)), 4, 0.016, 0.012, 0, 0.115, c, r4);
    b.box(M.mul(m, M.t(0, 0.1, 0)), 0.1, 0.014, 0.1, c2); b.prism(M.mul(m, M.t(0, 0.114, 0)), 4, 0.055, 0.03, 0, 0.1, c, r4); b.box(M.mul(m, M.t(0, 0.214, 0)), 0.055, 0.012, 0.055, c2);
    b.prism(M.mul(m, M.t(0, 0.226, 0)), 4, 0.027, 0.008, 0, 0.2, c2 === c ? c : C.white, r4); b.prism(M.mul(m, M.t(0, 0.3, 0)), 4, 0.021, 0.014, 0, 0.06, c, r4); b.prism(M.mul(m, M.t(0, 0.426, 0)), 4, 0.005, 0.001, 0, 0.06, c2, r4); },
  tokyotower(b, m) { LM.eiffel(b, m, hex("#E0452B"), C.white); },
  colosseum(b, m) { const s = [0.87, 0.78, 0.62], n = 18, q = M.mul(m, M.s(1, 1, 0.82)), ro = 0.14, ri = 0.095;
    for (let i = 0; i < n; i++) { const a0 = (i / n) * 6.2832, a1 = ((i + 1) / n) * 6.2832, h = i < 11 ? 0.11 : i < 13 ? 0.085 : 0.062, c = mul(s, 0.95 + (i % 2) * 0.08);
      const P_ = (r, a, y) => M.pt(q, Math.cos(a) * r, y, Math.sin(a) * r), mid = P_((ro + ri) / 2, (a0 + a1) / 2, h / 2);
      b.quad(P_(ro, a0, 0), P_(ro, a1, 0), P_(ro, a1, h), P_(ro, a0, h), c, mid); b.quad(P_(ri, a0, 0), P_(ri, a1, 0), P_(ri, a1, h), P_(ri, a0, h), mul(c, 0.8), mid); b.quad(P_(ro, a0, h), P_(ro, a1, h), P_(ri, a1, h), P_(ri, a0, h), mul(s, 1.1), mid);
      for (let lv = 0; lv * 0.036 + 0.03 < h; lv++) { const am = (a0 + a1) / 2, y = 0.006 + lv * 0.036; b.quad(P_(ro + 0.001, am - 0.07, y), P_(ro + 0.001, am + 0.07, y), P_(ro + 0.001, am + 0.07, y + 0.022), P_(ro + 0.001, am - 0.07, y + 0.022), [0.3, 0.24, 0.2], mid); } }
    b.prism(q, 16, ri, ri, 0, 0.012, [0.9, 0.82, 0.62]); },
  dom(b, m) { const s = [0.44, 0.42, 0.45], d = [0.3, 0.3, 0.34]; b.box(M.mul(m, M.t(0, 0, -0.06)), 0.07, 0.1, 0.17, s); b.prism(M.ch(m, M.t(0, 0.1, -0.145), M.rx(Math.PI / 2)), 3, 0.04, 0.04, 0, 0.17, d, { rot: -Math.PI / 2, bottom: true });
    b.box(M.mul(m, M.t(0, 0, -0.08)), 0.15, 0.085, 0.05, s); for (const sx of [-1, 1]) { const q = M.mul(m, M.t(sx * 0.028, 0, 0.045)); b.box(q, 0.046, 0.2, 0.046, s); b.prism(M.mul(q, M.t(0, 0.2, 0)), 4, 0.034, 0, 0, 0.17, d, { rot: Math.PI / 4 });
      for (let k = 1; k < 4; k++) b.box(M.mul(q, M.t(0, k * 0.05, 0)), 0.05, 0.005, 0.05, d); b.box(M.mul(q, M.t(0, 0.02, 0.0235)), 0.016, 0.04, 0.002, C.dark); }
    b.prism(M.mul(m, M.t(0, 0.14, -0.08)), 4, 0.01, 0, 0, 0.08, d); },
  castle(b, m) { const s = [0.76, 0.74, 0.7], rf = hex("#C8553D"); b.box(m, 0.16, 0.07, 0.13, s); b.box(M.mul(m, M.t(0, 0.07, 0)), 0.08, 0.07, 0.07, mul(s, 1.05)); b.prism(M.mul(m, M.t(0, 0.14, 0)), 4, 0.062, 0, 0, 0.06, rf, { rot: Math.PI / 4 });
    for (const [x, z] of [[-0.08, -0.065], [0.08, -0.065], [0.08, 0.065], [-0.08, 0.065]]) { const q = M.mul(m, M.t(x, 0, z)); b.prism(q, 7, 0.026, 0.026, 0, 0.12, s); b.prism(M.mul(q, M.t(0, 0.12, 0)), 7, 0.034, 0, 0, 0.07, rf); }
    b.box(M.mul(m, M.t(0, 0, 0.066)), 0.03, 0.04, 0.002, C.brownD); },
  windmill(b, m) { b.prism(m, 7, 0.036, 0.022, 0, 0.12, C.white); b.prism(M.mul(m, M.t(0, 0.12, 0)), 7, 0.03, 0, 0, 0.04, C.terra); const q = M.ch(m, M.t(0, 0.115, 0.03), M.rz(0.4));
    for (let k = 0; k < 4; k++) b.box(M.ch(q, M.rz(k * Math.PI / 2), M.t(0, 0.008, 0)), 0.022, 0.1, 0.004, C.wood); b.box(M.mul(m, M.t(0, 0, 0.034)), 0.016, 0.03, 0.002, C.brownD); },
  kreml(b, m) { const r = hex("#C24A3A"); b.box(m, 0.16, 0.07, 0.1, r, C.white); b.box(M.mul(m, M.t(0, 0.07, 0)), 0.17, 0.008, 0.11, C.white);
    const dome = (x, z, h, rad, c) => { const q = M.mul(m, M.t(x, 0, z)); b.prism(q, 7, rad * 0.75, rad * 0.7, 0, h, mul(r, 1.08)); b.blob(M.mul(q, M.t(0, h + rad * 0.8, 0)), rad, rad * 1.1, rad, c, 7, 4); b.prism(M.mul(q, M.t(0, h + rad * 1.7, 0)), 5, rad * 0.35, 0, 0, rad * 1.1, c); b.prism(M.mul(q, M.t(0, h + rad * 2.7, 0)), 4, 0.003, 0.003, 0, 0.02, C.gold); };
    dome(0, 0, 0.17, 0.03, C.gold); dome(-0.06, 0.03, 0.11, 0.022, C.teal); dome(0.06, 0.03, 0.11, 0.022, hex("#4A90B8")); dome(-0.05, -0.035, 0.12, 0.02, C.mustard); dome(0.05, -0.035, 0.12, 0.02, C.white); },
  fuji(b, m) { seed = 21; const c = [0.44, 0.46, 0.62], n = 10, R = [], R1 = [], R2 = [], ref = M.pt(m, 0, 0.1, 0);
    for (let i = 0; i < n; i++) { const a = (i / n) * 6.2832, j = 1 + (rnd() - 0.5) * 0.14; R.push(M.pt(m, Math.cos(a) * 0.32 * j, -0.03, Math.sin(a) * 0.3 * j)); R1.push(M.pt(m, Math.cos(a) * 0.15 * j, 0.24, Math.sin(a) * 0.14 * j)); R2.push(M.pt(m, Math.cos(a) * 0.055, 0.39 + (i % 2) * 0.012, Math.sin(a) * 0.055)); }
    for (let i = 0; i < n; i++) { const k = (i + 1) % n; b.quad(R[i], R[k], R1[k], R1[i], mul(c, 0.95 + (i % 3) * 0.05), ref); b.quad(R1[i], R1[k], R2[k], R2[i], [0.98, 0.98, 1], ref); b.tri(R2[i], R2[k], M.pt(m, 0, 0.36, 0), [0.8, 0.84, 0.92], ref); } },
  torii(b, m) { const r = hex("#D8402B"); for (const sx of [-1, 1]) { b.prism(M.ch(m, M.t(sx * 0.085, 0, 0), M.rz(sx * 0.05)), 6, 0.013, 0.011, 0, 0.2, r); b.box(M.mul(m, M.t(sx * 0.085, 0, 0)), 0.034, 0.014, 0.034, C.dark); }
    b.box(M.mul(m, M.t(0, 0.15, 0)), 0.2, 0.014, 0.016, r); b.box(M.mul(m, M.t(0, 0.195, 0)), 0.26, 0.016, 0.026, r); b.box(M.mul(m, M.t(0, 0.211, 0)), 0.3, 0.014, 0.034, C.dark);
    for (const sx of [-1, 1]) b.box(M.ch(m, M.t(sx * 0.15, 0.214, 0), M.rz(sx * 0.35)), 0.04, 0.012, 0.034, C.dark); b.box(M.mul(m, M.t(0, 0.164, 0)), 0.022, 0.031, 0.012, C.gold); },
  pagoda(b, m) { const r = hex("#C8402E"), d = [0.2, 0.22, 0.26]; b.box(m, 0.11, 0.012, 0.11, C.stone); for (let k = 0; k < 4; k++) { const w = 0.07 - k * 0.011, q = M.mul(m, M.t(0, 0.012 + k * 0.062, 0)); b.box(q, w, 0.042, w, k % 2 ? C.cream : r); b.prism(M.mul(q, M.t(0, 0.04, 0)), 4, w * 1.25, w * 0.5, 0, 0.022, d, { rot: Math.PI / 4 }); }
    b.prism(M.mul(m, M.t(0, 0.262, 0)), 4, 0.006, 0.001, 0, 0.07, C.gold); },
  temple(b, m) { const s = [0.66, 0.6, 0.5]; b.box(m, 0.2, 0.02, 0.2, mul(s, 0.9)); b.box(M.mul(m, M.t(0, 0.02, 0)), 0.15, 0.02, 0.15, s); b.box(M.mul(m, M.t(0, 0.04, 0)), 0.1, 0.03, 0.1, mul(s, 1.05));
    const tw = (x, z, h) => { const q = M.mul(m, M.t(x, 0.04, z)); b.prism(q, 6, 0.022, 0.016, 0, h * 0.5, s); b.prism(M.mul(q, M.t(0, h * 0.5, 0)), 6, 0.02, 0.004, 0, h * 0.5, mul(s, 1.1)); };
    tw(0, 0, 0.18); for (const [x, z] of [[-0.06, -0.06], [0.06, -0.06], [0.06, 0.06], [-0.06, 0.06]]) tw(x, z, 0.1); },
  tajmahal(b, m) { const w = [0.97, 0.96, 0.93], w2 = [0.88, 0.89, 0.92]; b.box(m, 0.26, 0.02, 0.2, w2); b.box(M.mul(m, M.t(0, 0.02, 0)), 0.11, 0.08, 0.11, w); b.box(M.mul(m, M.t(0, 0.02, 0.056)), 0.035, 0.06, 0.002, [0.4, 0.45, 0.55]);
    b.prism(M.mul(m, M.t(0, 0.1, 0)), 8, 0.036, 0.036, 0, 0.02, w2); b.blob(M.mul(m, M.t(0, 0.15, 0)), 0.044, 0.05, 0.044, w, 8, 5); b.prism(M.mul(m, M.t(0, 0.195, 0)), 4, 0.004, 0.001, 0, 0.04, C.gold);
    for (const [x, z] of [[-0.036, -0.036], [0.036, -0.036], [0.036, 0.036], [-0.036, 0.036]]) b.blob(M.mul(m, M.t(x, 0.11, z)), 0.016, 0.018, 0.016, w, 6, 3);
    for (const [x, z] of [[-0.115, -0.085], [0.115, -0.085], [0.115, 0.085], [-0.115, 0.085]]) { const q = M.mul(m, M.t(x, 0.02, z)); b.prism(q, 6, 0.01, 0.008, 0, 0.14, w); b.blob(M.mul(q, M.t(0, 0.15, 0)), 0.012, 0.014, 0.012, w, 5, 3); } },
  pyramids(b, m) { const s = [0.93, 0.78, 0.48]; for (const [x, z, r, h] of [[-0.02, -0.03, 0.2, 0.2], [0.17, 0.06, 0.15, 0.15], [-0.16, 0.1, 0.1, 0.1]]) { const q = M.ch(m, M.t(x, -0.012, z), M.ry(0.5)); b.prism(q, 4, r, r * 0.12, 0, h * 0.88, s, { rot: Math.PI / 4, top: false }); b.prism(M.mul(q, M.t(0, h * 0.88, 0)), 4, r * 0.12, 0, 0, h * 0.12, [1, 0.93, 0.7], { rot: Math.PI / 4 }); }
    const q = M.ch(m, M.t(0.03, 0, 0.17), M.ry(0.3)); b.box(q, 0.09, 0.03, 0.035, mul(s, 0.9)); b.box(M.mul(q, M.t(0.035, 0.03, 0)), 0.03, 0.035, 0.03, mul(s, 0.95)); },
  tablerock(b, m) { seed = 31; b.prism(m, 9, 0.2, 0.15, -0.03, 0.1, [0.68, 0.45, 0.3], { jit: 0.3, top: false }); b.prism(M.mul(m, M.t(0, 0.1, 0)), 9, 0.15, 0.12, 0, 0.07, [0.6, 0.38, 0.26], { jit: 0.25, topCol: [0.6, 0.7, 0.36] }); b.prism(M.mul(m, M.t(0.17, 0, 0.08)), 6, 0.06, 0.035, -0.02, 0.09, [0.64, 0.42, 0.28], { jit: 0.3 }); b.prism(M.mul(m, M.t(-0.16, 0, 0.1)), 5, 0.045, 0.02, -0.02, 0.06, [0.7, 0.48, 0.32], { jit: 0.3 }); },
  kili(b, m) { seed = 41; b.prism(m, 9, 0.21, 0.07, -0.03, 0.2, [0.55, 0.42, 0.32], { jit: 0.22, top: false }); b.prism(M.mul(m, M.t(0, 0.2, 0)), 9, 0.07, 0.035, 0, 0.04, C.white, { jit: 0.15, topCol: [0.9, 0.94, 1] }); },
  burj(b, m) { const c = [0.72, 0.8, 0.88]; let y = 0, r = 0.034; for (let k = 0; k < 7; k++) { const h = 0.09 - k * 0.006; b.prism(M.mul(m, M.t(0, y, 0)), 6, r, r * 0.86, 0, h, mul(c, 0.92 + (k % 2) * 0.12), { rot: k * 0.5 }); y += h; r *= 0.76; } b.prism(M.mul(m, M.t(0, y, 0)), 4, 0.004, 0.0005, 0, 0.1, C.stone);
    b.box(M.mul(m, M.t(0.06, 0, 0.03)), 0.03, 0.09, 0.03, [0.62, 0.7, 0.8]); b.box(M.mul(m, M.t(-0.055, 0, 0.02)), 0.028, 0.06, 0.028, [0.8, 0.82, 0.86]); },
  uluru(b, m) { seed = 51; const c = hex("#C5532F"); b.prism(m, 12, 0.24, 0.2, -0.03, 0.06, c, { jit: 0.16, sz: 0.62, top: false }); b.prism(M.mul(m, M.t(0, 0.06, 0)), 12, 0.2, 0.15, 0, 0.05, mul(c, 1.08), { jit: 0.14, sz: 0.6, topCol: hex("#D9673A") }); },
  opera(b, m) { const w = [0.98, 0.98, 0.96]; b.box(m, 0.3, 0.025, 0.17, [0.82, 0.74, 0.62]); b.box(M.mul(m, M.t(0, 0, 0.1)), 0.2, 0.012, 0.05, [0.86, 0.78, 0.66]);
    const sail = (x, z, s, dir) => { const q = M.ch(m, M.t(x, 0.025, z), M.ry(dir), M.s(s)), A = M.pt(q, 0.07, 0, 0), L = M.pt(q, -0.05, 0, -0.045), R = M.pt(q, -0.05, 0, 0.045), P_ = M.pt(q, 0.085, 0.15, 0), ref = M.pt(q, 0, 0.03, 0); b.tri(A, L, P_, w, ref); b.tri(A, R, P_, mul(w, 0.9), ref); b.tri(L, R, P_, [0.82, 0.85, 0.9], ref); };
    for (const z of [-0.04, 0.045]) { sail(-0.09, z, 1.0, 0); sail(-0.01, z, 0.8, 0); sail(0.05, z, 0.6, 0); sail(0.1, z, 0.7, Math.PI); } },
  igloo(b, m) { b.blob(m, 0.07, 0.06, 0.07, [0.94, 0.97, 1], 8, 6); b.box(M.mul(m, M.t(0, 0, 0.065)), 0.045, 0.036, 0.05, [0.9, 0.95, 1]); b.box(M.mul(m, M.t(0, 0, 0.091)), 0.024, 0.024, 0.002, C.dark);
    for (const [x, z, r] of [[0.11, 0.05, 0.3], [0.14, 0.0, -0.4], [-0.1, 0.07, 0.9]]) { const q = M.ch(m, M.t(x, 0, z), M.ry(r)); b.blob(M.mul(q, M.t(0, 0.028, 0)), 0.017, 0.028, 0.017, C.black, 6, 4); b.blob(M.mul(q, M.t(0, 0.026, 0.008)), 0.012, 0.021, 0.012, C.white, 5, 3); b.prism(M.ch(q, M.t(0, 0.044, 0.016), M.rx(Math.PI / 2)), 3, 0.005, 0, 0, 0.012, C.apricot); for (const sx of [-1, 1]) b.box(M.mul(q, M.t(sx * 0.009, 0, 0.01)), 0.01, 0.004, 0.018, C.apricot); } },
  station(b, m) { for (const [x, z] of [[-0.05, -0.025], [0.05, -0.025], [0.05, 0.025], [-0.05, 0.025]]) b.box(M.mul(m, M.t(x, 0, z)), 0.008, 0.03, 0.008, C.stoneD);
    b.box(M.mul(m, M.t(0, 0.03, 0)), 0.14, 0.05, 0.07, C.red, C.white); for (const x of [-0.04, 0, 0.04]) b.box(M.mul(m, M.t(x, 0.045, 0.0355)), 0.02, 0.018, 0.002, [0.6, 0.85, 0.95]);
    b.blob(M.mul(m, M.t(0.11, 0.015, 0)), 0.035, 0.035, 0.035, C.white, 7, 4); b.prism(M.mul(m, M.t(-0.05, 0.08, 0)), 4, 0.003, 0.003, 0, 0.09, C.stoneD); b.box(M.mul(m, M.t(-0.034, 0.145, 0)), 0.03, 0.02, 0.002, C.terra); },
};
function buildLandmarks(b, dec) {
  for (const [name, px, py, sc] of WD.lm) { const x = px / U, z = py / U; if (!LM[name]) continue; seed = 3 + name.length;
    LM[name](b, at(x, hAt(x, z) - 0.004, z, name === "goldengate" ? 0.9 : name === "opera" ? -0.3 : 0, sc * 1.05)); }
}
/* Flughäfen: Tower, Halle und Windsack neben dem Feld */
function buildAirports(b) {
  for (const i of WB.AIRPORTS) {
    const n = N[i], x = n.x / U, z = n.y / U; let ax = 0, az = 0;
    N.forEach((o, k) => { if (k === i) return; const dx = o.x / U - x, dz = o.y / U - z, d = Math.hypot(dx, dz); if (d < 1.2) { ax -= dx / (d * d); az -= dz / (d * d); } });
    let best = null;
    for (let k = 0; k < 16; k++) { const a = Math.atan2(az, ax) + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.35, tx = x + Math.cos(a) * 0.3, tz = z + Math.sin(a) * 0.3; if (hAt(tx, tz) > 0.07) { best = [tx, tz, a]; break; } }
    if (!best) continue;
    const m = at(best[0], hAt(best[0], best[1]) - 0.004, best[1], 0, 1);
    b.box(m, 0.15, 0.045, 0.08, C.cream, C.purple); for (const dx of [-0.045, 0, 0.045]) b.box(M.mul(m, M.t(dx, 0.012, 0.041)), 0.03, 0.022, 0.002, [0.55, 0.8, 0.92]);
    const t = M.mul(m, M.t(0.1, 0, -0.01)); b.prism(t, 6, 0.016, 0.013, 0, 0.13, C.cream); b.prism(M.mul(t, M.t(0, 0.13, 0)), 6, 0.026, 0.03, 0, 0.028, [0.5, 0.78, 0.9]); b.prism(M.mul(t, M.t(0, 0.158, 0)), 6, 0.034, 0.01, 0, 0.016, C.purple);
    const w = M.mul(m, M.t(-0.1, 0, 0.03)); b.prism(w, 4, 0.004, 0.004, 0, 0.1, C.stoneD); b.prism(M.ch(w, M.t(0, 0.095, 0), M.rz(-1.35)), 5, 0.012, 0.005, 0, 0.05, C.terra);
  }
}

/* ---------- kleine Modelle, die sich bewegen ---------- */
function modelBoat() { const b = new Builder(), m = M.I, hull = C.wood, P_ = (x, y, z) => [x, y, z];
  const bow = P_(0, 0.03, 0.2), st = P_(0, 0.03, -0.17), keelF = P_(0, -0.05, 0.1), keelB = P_(0, -0.05, -0.1), ref = [0, 0, 0];
  for (const s of [-1, 1]) { const a = P_(s * 0.085, 0.04, 0.06), c = P_(s * 0.085, 0.04, -0.1); b.tri(bow, a, keelF, hull, ref); b.quad(a, c, keelB, keelF, mul(hull, 0.9), ref); b.tri(c, st, keelB, hull, ref); b.tri(bow, a, P_(0, 0.04, 0.06), C.sandc, [0, -1, 0]); b.quad(a, c, P_(0, 0.04, -0.1), P_(0, 0.04, 0.06), C.sandc, [0, -1, 0]); b.tri(c, st, P_(0, 0.04, -0.1), C.sandc, [0, -1, 0]); }
  b.box(M.t(0, 0.04, -0.03), 0.17, 0.012, 0.016, C.brownD); b.prism(M.t(0, 0.04, 0.03), 5, 0.008, 0.006, 0, 0.3, C.brownD);
  b.tri(P_(0, 0.09, 0.03), P_(0, 0.32, 0.03), P_(0.1, 0.09, -0.12), C.white, [-1, 0.2, 0.2]); b.tri(P_(0, 0.09, 0.03), P_(0, 0.32, 0.03), P_(0.1, 0.09, -0.12), [0.9, 0.92, 0.95], [1, 0.2, -0.2]); b.tri(P_(0, 0.1, 0.04), P_(0, 0.27, 0.04), P_(-0.07, 0.1, 0.14), [0.98, 0.9, 0.8], [1, 0.2, 0]); b.tri(P_(0, 0.1, 0.04), P_(0, 0.27, 0.04), P_(-0.07, 0.1, 0.14), [0.92, 0.84, 0.74], [-1, 0.2, 0.3]);
  b.tri(P_(0, 0.34, 0.03), P_(0, 0.31, 0.03), P_(0, 0.325, -0.04), C.terra, null); return b; }
function modelPlane() { const b = new Builder(), w = C.white; b.vary = 0.03;
  b.prism(M.ch(M.t(0, 0, -0.34), M.rx(Math.PI / 2)), 8, 0.03, 0.075, 0, 0.14, w, { top: false, bottom: true }); b.prism(M.ch(M.t(0, 0, -0.2), M.rx(Math.PI / 2)), 8, 0.075, 0.075, 0, 0.42, w, { top: false });
  b.prism(M.ch(M.t(0, 0, 0.22), M.rx(Math.PI / 2)), 8, 0.075, 0.05, 0, 0.1, w, { top: false }); b.prism(M.ch(M.t(0, 0, 0.32), M.rx(Math.PI / 2)), 8, 0.05, 0.012, 0, 0.06, C.teal);
  b.prism(M.ch(M.t(0, 0.022, 0.24), M.rx(Math.PI / 2)), 6, 0.062, 0.04, 0, 0.07, C.petrol, { top: false });
  for (const s of [-1, 1]) { b.quad([s * 0.06, -0.02, 0.1], [s * 0.5, 0.0, -0.03], [s * 0.5, 0.0, -0.11], [s * 0.06, -0.02, -0.08], C.teal, [0, -9, 0]); b.quad([s * 0.06, -0.03, 0.1], [s * 0.5, -0.008, -0.03], [s * 0.5, -0.008, -0.11], [s * 0.06, -0.03, -0.08], mul(C.teal, 0.8), [0, 9, 0]);
    b.box(M.t(s * 0.5, -0.008, -0.07), 0.012, 0.045, 0.08, C.terra); b.quad([s * 0.03, 0.02, -0.26], [s * 0.2, 0.03, -0.34], [s * 0.2, 0.03, -0.39], [s * 0.03, 0.02, -0.36], C.teal, [0, -9, 0]);
    b.prism(M.ch(M.t(s * 0.22, -0.055, -0.05), M.rx(Math.PI / 2)), 7, 0.032, 0.032, 0, 0.11, C.petrol, { bottom: true }); for (let k = 0; k < 6; k++) b.box(M.t(s * 0.0745, 0.008, 0.16 - k * 0.058), 0.003, 0.024, 0.028, [0.35, 0.55, 0.72]); }
  b.quad([0, 0.06, -0.24], [0, 0.22, -0.36], [0, 0.22, -0.41], [0, 0.06, -0.38], C.terra, null); b.box(M.t(0, -0.074, 0.0), 0.153, 0.012, 0.44, C.terra); return b; }
function modelCase() { const b = new Builder(), br = hex("#A8683A"), brD = hex("#7A4526"); b.vary = 0.04;
  b.box(M.t(0, -0.14, 0), 0.38, 0.28, 0.14, br); b.box(M.t(0, -0.146, 0), 0.34, 0.292, 0.146, mul(br, 1.08)); b.box(M.t(0, 0.02, 0), 0.384, 0.008, 0.146, brD);
  for (const x of [-0.11, 0.11]) b.box(M.t(x, -0.143, 0), 0.036, 0.286, 0.152, brD);
  for (const x of [-0.176, 0.176]) for (const y of [-0.14, 0.1]) b.box(M.t(x, y, 0), 0.04, 0.045, 0.156, C.gold);
  b.box(M.t(0, 0.15, 0), 0.13, 0.02, 0.028, C.dark); for (const x of [-0.06, 0.06]) b.box(M.t(x, 0.13, 0), 0.02, 0.03, 0.028, C.dark);
  for (const x of [-0.11, 0.11]) b.box(M.t(x, 0.0, 0.076), 0.03, 0.03, 0.006, C.gold);
  b.prism(M.ch(M.t(0.02, -0.03, 0.074), M.rx(Math.PI / 2)), 9, 0.05, 0.05, 0, 0.004, C.terra); b.prism(M.ch(M.t(0.02, -0.03, 0.079), M.rx(Math.PI / 2)), 9, 0.032, 0.032, 0, 0.002, C.white);
  b.box(M.ch(M.t(-0.04, -0.11, 0.074), M.rz(0.2)), 0.07, 0.045, 0.004, C.teal); b.box(M.ch(M.t(0.03, -0.09, -0.078), M.rz(-0.3)), 0.08, 0.05, 0.004, C.mustard); b.prism(M.ch(M.t(-0.05, 0.03, -0.079), M.rx(Math.PI / 2)), 5, 0.035, 0.035, 0, 0.003, hex("#8E6FB0")); return b; }
function modelCloud() { const b = new Builder(); b.vary = 0.03; seed = 77; const w = [1, 1, 1];
  b.blob(M.t(0, 0, 0), 0.34, 0.2, 0.26, w, 7, 4, 0.2); b.blob(M.t(0.3, -0.03, 0.04), 0.24, 0.15, 0.2, w, 7, 4, 0.2); b.blob(M.t(-0.3, -0.04, -0.02), 0.26, 0.15, 0.2, [0.96, 0.97, 1], 7, 4, 0.2); b.blob(M.t(0.08, 0.1, -0.03), 0.2, 0.15, 0.17, w, 6, 4, 0.2); return b; }
function modelBalloon() { const b = new Builder(); b.vary = 0.02; const cols = [C.terra, C.mustard, C.teal, C.white];
  for (let r = 0; r < 5; r++) { const y0 = 0.3 - r * 0.075, y1 = y0 - 0.075, f = (y) => Math.sqrt(Math.max(0, 1 - Math.pow((y - 0.12) / 0.2, 2))) * 0.17; b.prism(M.I, 10, Math.max(0.035, f(y1)), Math.max(0.0, f(y0)), y1, y0, cols[r % 4], { top: r === 0 }); }
  b.box(M.t(0, -0.2, 0), 0.06, 0.05, 0.06, C.wood); for (const [x, z] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) b.box(M.t(x * 0.028, -0.15, z * 0.028), 0.004, 0.09, 0.004, C.brownD); return b; }
function modelFlag() { const b = new Builder(); b.vary = 0; b.tri([0, 0.2, 0], [0, 0.13, 0], [0.1, 0.165, 0], [1, 1, 1], null); return b; }

/* =====================================================================
   WebGL
   ===================================================================== */
let gl, cv, prog, progW, dyn = {}, world, decal, mdl = {}, dataTex;
let VP = M.I, vw = 1, vh = 1, eye = [0, 5, 5];
function sh(type, src) { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; }
function mkProg(vs, fs, attrs) { const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); attrs.forEach((a, i) => gl.bindAttribLocation(p, i, a)); gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p)); return p; }
function uni(p, names) { for (const n of names) p[n] = gl.getUniformLocation(p, n); }

const VS = "attribute vec3 p;attribute vec3 n;attribute vec4 c;uniform mat4 uVP,uM;uniform vec3 uS;varying vec3 vN,vW;varying vec4 vC;void main(){vec4 w=uM*vec4(p,1.);vW=w.xyz;vN=mat3(uM)*(n/(uS*uS));vC=c;gl_Position=uVP*w;}";
const FS = "precision mediump float;uniform vec3 uEye,uSky;uniform float uFlat,uRim;varying vec3 vN,vW;varying vec4 vC;void main(){vec3 n=normalize(vN);float d=max(dot(n,normalize(vec3(.42,.8,.43))),0.);" +
  "vec3 l=vec3(.55,.6,.7)+vec3(1.,.94,.8)*d*.62+vec3(.05,.06,.04)*n.y;vec3 col=vC.rgb*mix(l,vec3(1.),uFlat);vec3 v=normalize(uEye-vW);col+=uRim*pow(1.-max(dot(n,v),0.),2.5)*vec3(.9,.95,1.);" +
  "float f=smoothstep(22.,75.,distance(uEye,vW));gl_FragColor=vec4(mix(col,uSky,f),vC.a);}";
const VW = "attribute vec2 p;uniform mat4 uVP;varying vec3 vW;void main(){vW=vec3(p.x,0.,p.y);gl_Position=uVP*vec4(vW,1.);}";
const FW = "precision mediump float;uniform sampler2D uD;uniform float uT;uniform vec3 uEye,uSky;uniform vec2 uW;varying vec3 vW;void main(){vec2 uv=vW.xz/uW;" +
  "uv=(vW.xz+.025)/uW;float inb=step(0.,uv.x)*step(uv.x,1.)*step(0.,uv.y)*step(uv.y,1.);float d=mix(1.,texture2D(uD,uv).g,inb);float deep=smoothstep(.03,.7,d);" +
  "vec3 col=mix(vec3(.3,.83,.86),vec3(.05,.4,.78),deep);" +
  "float w=sin(vW.x*5.+uT*.9+sin(vW.z*3.+uT*.5)*1.5)*sin(vW.z*6.-uT*.7+sin(vW.x*2.5-uT*.3)*1.3);col+=vec3(.07,.08,.08)*smoothstep(.5,.95,w);col-=vec3(.03)*smoothstep(.5,.95,-w);" +
  "float band=smoothstep(.55,.9,sin(d*52.-uT*1.5)*.5+.5)*(1.-smoothstep(0.,.26,d))*smoothstep(.0,.03,d);float edge=1.-smoothstep(.0,.05,d);" +
  "col=mix(col,vec3(1.),clamp(band*.55+edge*.85,0.,1.));float a=mix(.66,.97,deep);float f=smoothstep(22.,75.,distance(uEye,vW));gl_FragColor=vec4(mix(col,uSky,f),mix(a,1.,f));}";

function meshSphere(seg, rings) { const v = [], ix = []; for (let r = 0; r <= rings; r++) { const p = (r / rings) * Math.PI, y = Math.cos(p), q = Math.sin(p); for (let s = 0; s <= seg; s++) { const a = (s / seg) * Math.PI * 2, x = q * Math.cos(a), z = q * Math.sin(a); v.push(x, y, z, x, y, z); } }
  for (let r = 0; r < rings; r++) for (let s = 0; s < seg; s++) { const a = r * (seg + 1) + s, b = a + seg + 1; ix.push(a, a + 1, b, b, a + 1, b + 1); } return { v, ix }; }
function meshCyl(seg, top) { const v = [], ix = [], ny = 1 - top, nl = Math.hypot(1, ny);
  for (let s = 0; s <= seg; s++) { const a = (s / seg) * Math.PI * 2, x = Math.cos(a), z = Math.sin(a); v.push(x, 0, z, x / nl, ny / nl, z / nl, x * top, 1, z * top, x / nl, ny / nl, z / nl); }
  for (let s = 0; s < seg; s++) { const a = s * 2; ix.push(a, a + 1, a + 2, a + 2, a + 1, a + 3); }
  for (const [y, n, r] of [[0, -1, 1], [1, 1, top]]) { if (!r) continue; const c = v.length / 6; v.push(0, y, 0, 0, n, 0); for (let s = 0; s <= seg; s++) { const a = (s / seg) * Math.PI * 2; v.push(Math.cos(a) * r, y, Math.sin(a) * r, 0, n, 0); } for (let s = 0; s < seg; s++) ix.push(c, c + 1 + s, c + 2 + s); }
  return { v, ix }; }
function meshBox() { const v = [], ix = []; for (const n of [[0, 0, 1], [0, 0, -1], [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0]]) { const u = n[0] ? [0, 1, 0] : [1, 0, 0], w = [n[1] * u[2] - n[2] * u[1], n[2] * u[0] - n[0] * u[2], n[0] * u[1] - n[1] * u[0]], c = v.length / 6;
    for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) v.push((n[0] + a * u[0] + b * w[0]) / 2, (n[1] + a * u[1] + b * w[1]) / 2, (n[2] + a * u[2] + b * w[2]) / 2, n[0], n[1], n[2]); ix.push(c, c + 1, c + 2, c, c + 2, c + 3); } return { v, ix }; }
function meshDisc(seg) { const v = [0, 0, 0, 0, 1, 0], ix = []; for (let s = 0; s <= seg; s++) { const a = (s / seg) * Math.PI * 2; v.push(Math.cos(a), 0, Math.sin(a), 0, 1, 0); } for (let s = 0; s < seg; s++) ix.push(0, 1 + s, 2 + s); return { v, ix }; }
function meshRing(seg, inner) { const v = [], ix = []; for (let s = 0; s <= seg; s++) { const a = (s / seg) * Math.PI * 2, x = Math.cos(a), z = Math.sin(a); v.push(x, 0, z, 0, 1, 0, x * inner, 0, z * inner, 0, 1, 0); } for (let s = 0; s < seg; s++) { const a = s * 2; ix.push(a, a + 1, a + 2, a + 2, a + 1, a + 3); } return { v, ix }; }
function upIdx(m) { const o = { n: m.ix.length }; o.vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, o.vb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(m.v), gl.STATIC_DRAW); o.ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, o.ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(m.ix), gl.STATIC_DRAW); return o; }
function upBuilder(b) { const o = { n: b.a.length / 10 }; o.vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, o.vb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(b.a), gl.STATIC_DRAW); b.a = null; return o; }

let cur = null;
/* einfache Form in einer Farbe (Figuren, Ringe, Schatten …) */
function draw(m, col, mat, sx, sy, sz, alpha, flat) {
  if (sx != null) mat = M.mul(mat, M.s(sx, sy, sz)); else sx = sy = sz = 1;
  if (cur !== m) { gl.bindBuffer(gl.ARRAY_BUFFER, m.vb); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, m.ib); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12); gl.disableVertexAttribArray(2); cur = m; }
  gl.uniformMatrix4fv(prog.uM, false, mat); gl.uniform3f(prog.uS, sx, sy, sz); gl.vertexAttrib4f(2, col[0], col[1], col[2], alpha == null ? 1 : alpha); gl.uniform1f(prog.uFlat, flat ? 1 : 0);
  gl.drawElements(gl.TRIANGLES, m.n, gl.UNSIGNED_SHORT, 0);
}
/* gebautes Modell mit eigenen Farben; tint färbt z. B. Fahnen ein */
function drawModel(o, mat, flat) {
  if (cur !== o) { gl.bindBuffer(gl.ARRAY_BUFFER, o.vb); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 40, 0); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 40, 12); gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 40, 24); cur = o; }
  gl.uniformMatrix4fv(prog.uM, false, mat); gl.uniform3f(prog.uS, 1, 1, 1); gl.uniform1f(prog.uFlat, flat ? 1 : 0);
  gl.drawArrays(gl.TRIANGLES, 0, o.n);
}

/* =====================================================================
   SZENE
   ===================================================================== */
const G = {
  SEATS, LOOKS, U, surf, hAt: (x, z) => hAt(x, z),
  chars: {}, caseObj: { node: -1, scale: 1, y: 0 }, plane: { on: false, x: 0, y: 0, z: 0, rot: 0, bank: 0, pitch: 0 },
  rings: [], turnId: null, owners: {}, seatOf: () => 0, parts: [],
  cam: { x: WW / 2, z: WH / 2, dist: 14, pitch: 0.9, tx: WW / 2, tz: WH / 2, td: 14, tp: 0.9, free: false },
  pos(i) { return { x: N[i].x / U, z: N[i].y / U, y: nodeTop[i] }; },
};
G.focus = function (x, z, dist, pitch) { const c = G.cam; c.tx = x; c.tz = z; if (dist) c.td = dist; if (pitch) c.tp = pitch; c.free = false; };
G.focusNode = function (i, dist) { const p = G.pos(i); G.focus(p.x, p.z + 0.2, dist || 3.1, 0.9); };
G.overview = function () { G.focus(WW / 2, WH / 2 + 0.5, Math.max(12.5, 15.5 / Math.min(1.9, vw / vh) * 1.55), 1.08); };
G.project = function (x, y, z) { const m = VP, w = m[3] * x + m[7] * y + m[11] * z + m[15]; return { x: ((m[0] * x + m[4] * y + m[8] * z + m[12]) / w * 0.5 + 0.5) * vw, y: (1 - ((m[1] * x + m[5] * y + m[9] * z + m[13]) / w * 0.5 + 0.5)) * vh, ok: w > 0.1 }; };
G.setChar = function (id, look, node, seat) {
  let c = G.chars[id];
  if (!c) { const p = G.pos(node); c = G.chars[id] = { id, x: p.x, z: p.z, y: 0, rot: 0, scale: 1, vis: true, moving: false, walk: 0, cheer: false, tilt: 0, busy: false, seed: Math.random() * 9, sq: 1, gy: p.y }; }
  c.look = look; c.seat = seat; if (!c.busy) c.node = node; return c;
};
G.keepOnly = function (ids) { for (const k in G.chars) if (!ids.includes(k)) delete G.chars[k]; };
G.bake = function (owners, seatOf) { G.owners = owners || {}; G.seatOf = seatOf; };
/* Höhe der Füsse einer Figur über dem Meer (für Beschriftungen) */
G.cy = function (c) { return (c.gy || 0) + c.y; };
/* Partikel: coin · heart · confetti · dust · star */
G.burst = function (x, y, z, kind, n) {
  for (let i = 0; i < n && G.parts.length < 260; i++) {
    const a = Math.random() * 6.28, sp = kind === "dust" ? 0.25 : kind === "confetti" ? 0.9 : 0.55;
    const col = kind === "coin" ? C.gold : kind === "heart" ? [1, 0.45, 0.55] : kind === "dust" ? [0.95, 0.92, 0.85] : kind === "star" ? [1, 0.95, 0.5] : hex(SEATS[(Math.random() * 8) | 0]);
    G.parts.push({ x, y, z, vx: Math.cos(a) * sp * Math.random(), vy: kind === "dust" ? 0.15 + Math.random() * 0.2 : 0.9 + Math.random() * 0.9, vz: Math.sin(a) * sp * Math.random(), life: 0, max: kind === "dust" ? 0.55 : 0.9 + Math.random() * 0.5, col, kind, rot: Math.random() * 6, g: kind === "dust" ? 0.2 : kind === "confetti" ? 1.6 : 2.6 });
  }
};

function resize() { const dpr = Math.min(window.devicePixelRatio || 1, 2); vw = window.innerWidth; vh = window.innerHeight; const w = Math.round(vw * dpr), h = Math.round(vh * dpr); if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; } gl.viewport(0, 0, w, h); }

/* ---------- Figur ---------- */
function drawChar(c, t) {
  if (!c.vis || c.scale < 0.02) return;
  const L = c.look, skin = hex(LOOKS.skin.cols[L.skin]), skinD = mul(skin, 0.86), shirt = hex(LOOKS.shirt.cols[L.shirt]), shoe = hex(LOOKS.shoes.cols[L.shoes]), hairc = hex(LOOKS.hairc.cols[L.hairc || 0]);
  const seat = hex(SEATS[(c.seat || 0) % 8]), shirtD = mul(shirt, 0.8), S = dyn.sph, robot = L.skin === 7;
  const k = 0.32 * c.scale * (c.busy ? 1 : c.crowd || 1), mv = c.moving, breathe = Math.sin(t * 2.3 + c.seed), bob = mv ? 0 : breathe * 0.01;
  const w = mv ? Math.sin(c.walk * Math.PI * 2) : 0, jump = c.cheer ? Math.abs(Math.sin(t * 7 + c.seed)) * 0.12 : 0;
  gl.uniform1f(prog.uRim, 0.22);
  const base = M.ch(M.t(c.x, c.gy + c.y + jump * c.scale, c.z), M.ry(c.rot + (mv || c.cheer ? 0 : Math.sin(t * 0.7 + c.seed) * 0.12)), M.rz(c.tilt), M.rx(mv ? 0.12 : 0), M.s(k, k * c.sq, k));
  for (const sd of [-1, 1]) {                                   // Beine & Schuhe
    const hip = M.ch(base, M.t(sd * 0.115, 0.36, 0), M.rx(-sd * w * 0.75));
    draw(dyn.cyl, C.dark, M.mul(hip, M.t(0, -0.13, 0)), 0.085, 0.15, 0.085);                       // Shorts
    draw(dyn.cyl, skin, M.mul(hip, M.t(0, -0.29, 0)), 0.062, 0.17, 0.062);
    draw(S, C.white, M.mul(hip, M.t(0, -0.33, 0.045)), 0.105, 0.04, 0.165); draw(S, shoe, M.mul(hip, M.t(0, -0.295, 0.04)), 0.098, 0.068, 0.155);
    draw(S, C.white, M.mul(hip, M.t(0, -0.27, 0.11)), 0.05, 0.02, 0.05);
    const cheer = c.cheer ? 2.6 + Math.sin(t * 10 + sd) * 0.25 : 0.24 + (mv ? 0 : breathe * 0.03);
    const arm = M.ch(base, M.t(sd * 0.265, 0.7 + bob, 0), M.rz(sd * cheer), M.rx(sd * w * 0.95));  // Arme
    draw(S, shirt, M.mul(arm, M.t(0, -0.07, 0)), 0.085, 0.11, 0.085); draw(dyn.cyl, skin, M.mul(arm, M.t(0, -0.3, 0)), 0.052, 0.16, 0.052); draw(S, skin, M.mul(arm, M.t(0, -0.33, 0)), 0.07, 0.07, 0.07);
  }
  draw(S, C.dark, M.mul(base, M.t(0, 0.37, 0)), 0.22, 0.13, 0.18);                                 // Hüfte
  const torso = M.mul(base, M.t(0, 0.55 + bob, 0));
  draw(S, shirt, torso, 0.272, 0.265 + breathe * 0.004, 0.215);
  draw(dyn.cyl, shirtD, M.mul(torso, M.t(0, -0.2, 0)), 0.232, 0.045, 0.187);                        // Saum
  draw(S, L.shirt === 5 ? C.terra : C.white, M.mul(torso, M.t(0, 0.03, 0.2)), 0.085, 0.085, 0.03);  // Aufdruck
  draw(S, shirt, M.mul(torso, M.t(0, 0.03, 0.215)), 0.05, 0.05, 0.025);
  draw(dyn.cyl, shirtD, M.mul(torso, M.t(0, 0.19, 0)), 0.115, 0.05, 0.105);                         // Kragen
  // Rucksack in Spielerfarbe
  const bp = M.mul(torso, M.t(0, 0.0, -0.21));
  draw(S, seat, bp, 0.19, 0.22, 0.13); draw(S, mul(seat, 0.78), M.mul(bp, M.t(0, -0.06, -0.09)), 0.12, 0.09, 0.07); draw(S, mul(seat, 1.15), M.mul(bp, M.t(0, 0.13, -0.02)), 0.17, 0.08, 0.11);
  for (const sd of [-1, 1]) draw(dyn.box, mul(seat, 0.7), M.ch(torso, M.t(sd * 0.16, 0.06, 0.1), M.rz(sd * 0.12), M.rx(0.25)), 0.05, 0.34, 0.2);
  draw(dyn.cyl, skinD, M.mul(base, M.t(0, 0.76 + bob, 0)), 0.085, 0.1, 0.085);                      // Hals
  const h = M.ch(base, M.t(0, 1.02 + bob, 0), M.ry(mv || c.cheer ? 0 : Math.sin(t * 0.9 + c.seed * 3) * 0.18));
  draw(S, skin, h, 0.275, 0.26, 0.265);
  for (const sd of [-1, 1]) { draw(S, skin, M.mul(h, M.t(sd * 0.27, -0.01, 0)), 0.045, 0.065, 0.05); draw(S, skinD, M.mul(h, M.t(sd * 0.285, -0.01, 0.005)), 0.02, 0.035, 0.03); }
  // Gesicht
  const blink = (t * 0.37 + c.seed) % 1 > 0.96 ? 0.12 : 1, happy = c.cheer;
  for (const sd of [-1, 1]) {
    draw(S, robot ? [0.2, 0.9, 1] : C.white, M.mul(h, M.t(sd * 0.1, 0.015, 0.226)), 0.058, 0.07 * blink, 0.03);
    draw(S, C.black, M.mul(h, M.t(sd * 0.1, 0.01, 0.247)), 0.031, 0.04 * blink, 0.018);
    if (blink === 1) draw(S, C.white, M.mul(h, M.t(sd * 0.1 + 0.012, 0.028, 0.262)), 0.01, 0.012, 0.006, 1, true);
    draw(dyn.box, robot ? C.dark : mul(hairc, 0.8), M.ch(h, M.t(sd * 0.1, 0.105 + (happy ? 0.02 : 0), 0.238), M.rz(-sd * (happy ? 0.35 : 0.12)), M.rx(-0.2)), 0.075, 0.016, 0.02);
    draw(S, mix(skin, [1, 0.45, 0.5], 0.42), M.mul(h, M.t(sd * 0.165, -0.065, 0.19)), 0.045, 0.03, 0.02);
  }
  draw(S, skinD, M.mul(h, M.t(0, -0.035, 0.262)), 0.028, 0.024, 0.024);
  if (happy) { draw(S, [0.35, 0.1, 0.12], M.mul(h, M.t(0, -0.125, 0.235)), 0.07, 0.05, 0.03); draw(S, [0.95, 0.4, 0.45], M.mul(h, M.t(0, -0.145, 0.24)), 0.04, 0.02, 0.02); }
  else for (let i = -2; i <= 2; i++) draw(S, [0.35, 0.12, 0.14], M.mul(h, M.t(i * 0.026, -0.118 - (4 - i * i) * 0.006, 0.238 - Math.abs(i) * 0.008)), 0.017, 0.012, 0.012);
  // Frisur
  const hat = L.hat, topOk = hat === 0 || hat === 3 || hat === 7, hs = L.hair || 0, hc = hairc, hc2 = mul(hairc, 1.18);
  if (hs !== 6 && !robot) {
    if (topOk) {
      if (hs === 0 || hs === 3 || hs === 4) { draw(S, hc, M.mul(h, M.t(0, 0.075, -0.025)), 0.285, 0.225, 0.275); draw(S, hc2, M.mul(h, M.t(0.05, 0.19, 0.12)), 0.17, 0.07, 0.12); }
      if (hs === 1) for (let i = 0; i < 11; i++) { const a = i * 2.4, r = i < 4 ? 0.12 : 0.23, y = i < 4 ? 0.21 : 0.1 + (i % 3) * 0.03; draw(S, i % 2 ? hc : hc2, M.mul(h, M.t(Math.cos(a) * r, y, Math.sin(a) * r * 0.9 - 0.04)), 0.105, 0.1, 0.105); }
      if (hs === 2) { draw(S, hc, M.mul(h, M.t(0, 0.08, -0.03)), 0.29, 0.23, 0.28); draw(S, hc2, M.mul(h, M.t(-0.06, 0.18, 0.13)), 0.18, 0.07, 0.11); }
      if (hs === 5) { draw(S, hc, M.mul(h, M.t(0, 0.09, -0.03)), 0.275, 0.2, 0.265); for (let i = 0; i < 9; i++) { const a = i * 0.7; draw(dyn.cone, i % 2 ? hc : hc2, M.ch(h, M.t(Math.cos(a) * 0.13 * (i % 3 ? 1 : 0.3), 0.2, Math.sin(a) * 0.13 - 0.02), M.rz(-Math.cos(a) * 0.5), M.rx(Math.sin(a) * 0.5)), 0.06, 0.16, 0.06); } }
    } else if (hs !== 5) draw(S, hc, M.mul(h, M.t(0, 0.0, -0.06)), 0.275, 0.2, 0.245);
    if (hs === 2) { draw(S, hc, M.mul(h, M.t(0, -0.16, -0.15)), 0.24, 0.3, 0.14); for (const sd of [-1, 1]) draw(S, hc2, M.mul(h, M.t(sd * 0.22, -0.14, -0.02)), 0.075, 0.25, 0.1); }
    if (hs === 3) { draw(S, hc2, M.mul(h, M.t(0, 0.08, -0.27)), 0.07, 0.07, 0.07); draw(S, hc, M.ch(h, M.t(0, 0.02, -0.3), M.rx(-0.5), M.t(0, -0.13, 0)), 0.075, 0.2, 0.075); draw(S, seat, M.mul(h, M.t(0, 0.07, -0.265)), 0.05, 0.05, 0.03); }
    if (hs === 4 && topOk) { draw(S, hc2, M.mul(h, M.t(0, 0.31, -0.06)), 0.11, 0.1, 0.11); draw(S, seat, M.mul(h, M.t(0, 0.245, -0.05)), 0.085, 0.025, 0.085); }
  }
  if (robot) { draw(dyn.cyl, C.stoneD, M.mul(h, M.t(0, 0.24, 0)), 0.012, 0.12, 0.012); draw(S, C.terra, M.mul(h, M.t(0, 0.38, 0)), 0.035, 0.035, 0.035, 1, Math.sin(t * 5) > 0); }
  switch (hat) {
    case 1: draw(S, C.terra, M.mul(h, M.t(0, 0.12, 0)), 0.285, 0.185, 0.28); draw(dyn.cyl, mul(C.terra, 0.85), M.ch(h, M.t(0, 0.1, 0.2), M.rx(0.12)), 0.19, 0.022, 0.2); draw(S, C.white, M.mul(h, M.t(0, 0.305, 0)), 0.035, 0.02, 0.035); draw(S, C.white, M.mul(h, M.t(0, 0.17, 0.262)), 0.06, 0.05, 0.02); break;
    case 2: draw(dyn.cyl, C.dark, M.mul(h, M.t(0, 0.19, 0)), 0.33, 0.03, 0.33); draw(dyn.cyl, C.dark, M.mul(h, M.t(0, 0.2, 0)), 0.2, 0.32, 0.2); draw(dyn.cyl, C.terra, M.mul(h, M.t(0, 0.22, 0)), 0.205, 0.06, 0.205); draw(dyn.cyl, [0.2, 0.3, 0.36], M.mul(h, M.t(0, 0.515, 0)), 0.19, 0.008, 0.19); break;
    case 3: draw(dyn.cyl, C.gold, M.mul(h, M.t(0, 0.19, 0)), 0.2, 0.1, 0.2); for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; draw(dyn.cone, C.gold, M.mul(h, M.t(Math.cos(a) * 0.17, 0.28, Math.sin(a) * 0.17)), 0.05, 0.12, 0.05); draw(S, i % 2 ? C.terra : C.teal, M.mul(h, M.t(Math.cos(a + 0.52) * 0.195, 0.24, Math.sin(a + 0.52) * 0.195)), 0.026, 0.026, 0.026); } draw(dyn.cyl, hex("#B02A3A"), M.mul(h, M.t(0, 0.2, 0)), 0.18, 0.1, 0.18); break;
    case 4: draw(S, C.teal, M.mul(h, M.t(0, 0.12, 0)), 0.285, 0.2, 0.28); draw(dyn.cyl, C.white, M.mul(h, M.t(0, 0.06, 0)), 0.287, 0.075, 0.282); draw(S, C.white, M.mul(h, M.t(0, 0.35, 0)), 0.075, 0.075, 0.075); for (let i = 0; i < 6; i++) draw(dyn.box, mul(C.teal, 0.8), M.ch(h, M.t(0, 0.2, 0), M.ry(i * 1.047), M.t(0, 0, 0.268)), 0.02, 0.14, 0.02); break;
    case 5: draw(dyn.cyl, C.brown, M.mul(h, M.t(0, 0.165, 0)), 0.44, 0.025, 0.4); draw(S, C.brown, M.mul(h, M.t(0, 0.25, 0)), 0.215, 0.17, 0.21); draw(dyn.cyl, C.brownD, M.mul(h, M.t(0, 0.19, 0)), 0.205, 0.045, 0.2); draw(S, C.gold, M.mul(h, M.t(0, 0.21, 0.2)), 0.03, 0.03, 0.015); for (const sd of [-1, 1]) draw(S, C.brown, M.mul(h, M.t(sd * 0.39, 0.2, 0)), 0.07, 0.05, 0.32); break;
    case 6: draw(dyn.cyl, C.mustard, M.mul(h, M.t(0, 0.165, 0)), 0.52, 0.028, 0.52); draw(dyn.cyl, C.terra, M.mul(h, M.t(0, 0.183, 0)), 0.52, 0.016, 0.52); draw(dyn.cyl, C.mustard, M.mul(h, M.t(0, 0.189, 0)), 0.47, 0.02, 0.47); draw(dyn.cone, C.mustard, M.mul(h, M.t(0, 0.18, 0)), 0.2, 0.3, 0.2); draw(dyn.cyl, C.teal, M.mul(h, M.t(0, 0.2, 0)), 0.19, 0.045, 0.19); for (let i = 0; i < 10; i++) { const a = i * 0.628; draw(S, i % 2 ? C.terra : C.teal, M.mul(h, M.t(Math.cos(a) * 0.5, 0.2, Math.sin(a) * 0.5)), 0.028, 0.028, 0.028); } break;
    case 7: draw(dyn.cone, C.terra, M.mul(h, M.t(0, 0.19, 0)), 0.15, 0.38, 0.15); draw(dyn.cyl, C.mustard, M.mul(h, M.t(0, 0.19, 0)), 0.155, 0.04, 0.155); draw(dyn.cyl, C.teal, M.mul(h, M.t(0, 0.31, 0)), 0.107, 0.035, 0.107); draw(S, C.mustard, M.mul(h, M.t(0, 0.58, 0)), 0.05, 0.05, 0.05); break;
    case 8: draw(S, C.beige, M.mul(h, M.t(0, 0.13, 0)), 0.29, 0.2, 0.3); draw(dyn.cyl, C.beige, M.mul(h, M.t(0, 0.1, 0.02)), 0.37, 0.025, 0.39); draw(dyn.cyl, C.brown, M.mul(h, M.t(0, 0.125, 0)), 0.292, 0.04, 0.302); draw(S, C.beige, M.mul(h, M.t(0, 0.33, 0)), 0.04, 0.025, 0.04); break;
  }
  const gl_ = L.glasses;
  if (gl_ === 1 || gl_ === 3) { const fr = gl_ === 1 ? C.black : hex("#E06C9F"), ln = gl_ === 1 ? [0.78, 0.92, 1] : [1, 0.82, 0.92];
    for (const sd of [-1, 1]) { const e = M.ch(h, M.t(sd * 0.1, 0.012, 0.236), M.rx(Math.PI / 2)); draw(dyn.cyl, fr, e, 0.084, 0.04, 0.084); draw(dyn.cyl, ln, e, 0.064, 0.044, 0.064, 0.55); draw(dyn.box, fr, M.mul(h, M.t(sd * 0.225, 0.02, 0.12)), 0.012, 0.016, 0.26); }
    draw(dyn.box, fr, M.mul(h, M.t(0, 0.02, 0.262)), 0.05, 0.016, 0.016);
  } else if (gl_ === 2) { for (const sd of [-1, 1]) { draw(dyn.box, C.black, M.mul(h, M.t(sd * 0.105, 0.012, 0.255)), 0.14, 0.085, 0.04); draw(dyn.box, [0.3, 0.36, 0.45], M.ch(h, M.t(sd * 0.085, 0.03, 0.277), M.rz(0.6)), 0.012, 0.07, 0.004, 1, true); draw(dyn.box, C.black, M.mul(h, M.t(sd * 0.225, 0.025, 0.12)), 0.012, 0.016, 0.28); } draw(dyn.box, C.black, M.mul(h, M.t(0, 0.035, 0.258)), 0.1, 0.02, 0.03);
  } else if (gl_ === 4) { draw(dyn.cyl, C.dark, M.mul(h, M.t(0, -0.02, 0)), 0.28, 0.065, 0.272); draw(dyn.box, C.white, M.mul(h, M.t(0, 0.012, 0.235)), 0.38, 0.14, 0.07); draw(dyn.box, C.apricot, M.mul(h, M.t(0, 0.012, 0.25)), 0.33, 0.1, 0.06); draw(dyn.box, [1, 0.85, 0.6], M.ch(h, M.t(-0.07, 0.025, 0.282), M.rz(0.6)), 0.014, 0.08, 0.004, 1, true); }
  gl.uniform1f(prog.uRim, 0);
}

/* stehende Figuren auf demselben Feld nebeneinander stellen */
function layout(dt) {
  const by = {};
  for (const id in G.chars) { const c = G.chars[id]; if (c.busy || c.node == null) continue; (by[c.node] = by[c.node] || []).push(c); }
  for (const k in by) { const l = by[k].sort((a, b) => a.seat - b.seat), p = G.pos(+k);
    l.forEach((c, i) => { const a = (i / l.length) * Math.PI * 2 + 0.6, r = l.length > 1 ? 0.085 + l.length * 0.012 : 0, tx = p.x + Math.cos(a) * r, tz = p.z + Math.sin(a) * r, f = 1 - Math.exp(-dt * 10); c.x += (tx - c.x) * f; c.z += (tz - c.z) * f; c.crowd = l.length > 2 ? 0.82 : l.length > 1 ? 0.9 : 1; }); }
}
const CLOUDS = []; for (let i = 0; i < 16; i++) { const e = i % 4, u = ((i * 0.37) % 1); CLOUDS.push({ x: e === 0 ? -1.2 : e === 1 ? WW + 1.2 : u * WW, z: e === 2 ? -1.3 : e === 3 ? WH + 1.6 : u * WH, y: 1.1 + (i % 3) * 0.35, s: 1.2 + (i % 5) * 0.35, ph: i * 1.7 }); }
const BALLOONS = [{ x: 7.0, z: 6.6, ph: 0 }, { x: 12.6, z: 6.9, ph: 2 }, { x: 0.9, z: 4.6, ph: 4 }];
const SHIPS = [{ x: 6.2, z: 5.6, r: 0.8 }, { x: 13.6, z: 6.2, r: 4 }, { x: 2.1, z: 6.6, r: 2.2 }, { x: 16.4, z: 4.4, r: 5 }];
let trail = 0;

G.frame = function (dt, t) {
  resize();
  const c = G.cam, f = 1 - Math.exp(-dt * 4.2);
  c.td = Math.max(1.7, Math.min(17, c.td)); c.tx = Math.max(0.3, Math.min(WW - 0.3, c.tx)); c.tz = Math.max(0.2, Math.min(WH + 0.6, c.tz));
  c.x += (c.tx - c.x) * f; c.z += (c.tz - c.z) * f; c.dist += (c.td - c.dist) * f; c.pitch += (c.tp - c.pitch) * f;
  eye = [c.x, 0.22 + c.dist * Math.sin(c.pitch), c.z + c.dist * Math.cos(c.pitch)];
  VP = M.mul(M.persp(0.62, vw / vh, 0.15, 120), M.look(eye, [c.x, 0.22, c.z]));
  layout(dt);
  for (const id in G.chars) { const ch = G.chars[id], g = ch.fly ? ch.gy : surf(ch.x, ch.z); ch.gy = ch.moving ? g : ch.gy + (g - ch.gy) * Math.min(1, dt * 18); }

  gl.clearColor(SKY[0], SKY[1], SKY[2], 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.depthMask(true); gl.disable(gl.BLEND);
  gl.useProgram(prog); cur = null; gl.enableVertexAttribArray(0); gl.enableVertexAttribArray(1);
  gl.uniformMatrix4fv(prog.uVP, false, VP); gl.uniform3f(prog.uEye, eye[0], eye[1], eye[2]); gl.uniform3f(prog.uSky, SKY[0], SKY[1], SKY[2]); gl.uniform1f(prog.uRim, 0);
  drawModel(world, M.I);

  // beanspruchte Zollfelder: Fläche + wehende Fahne in der Farbe des Besitzers
  for (const k in G.owners) { const o = G.owners[k], p = G.pos(+k), col = hex(SEATS[G.seatOf(o.p) % 8]);
    draw(dyn.oct, col, M.ch(M.t(p.x, p.y - 0.006, p.z), M.ry(Math.PI / 8)), 0.102, 0.012, 0.102); draw(dyn.oct, col, M.ch(M.t(p.x, p.y - 0.1, p.z), M.ry(Math.PI / 8)), 0.134, 0.085, 0.134);
    if (o.toll === "life") draw(dyn.sph, [1, 0.5, 0.55], M.t(p.x, p.y + 0.008, p.z), 0.04, 0.008, 0.04); else { draw(dyn.cyl, C.gold, M.t(p.x, p.y + 0.006, p.z), 0.042, 0.008, 0.042); draw(dyn.cyl, [1, 0.93, 0.6], M.t(p.x, p.y + 0.0145, p.z), 0.028, 0.002, 0.028); }
    const pole = M.t(p.x + 0.1, p.y - 0.02, p.z - 0.06); draw(dyn.cyl, C.cream, pole, 0.008, 0.33, 0.008); draw(dyn.sph, C.gold, M.mul(pole, M.t(0, 0.335, 0)), 0.014, 0.014, 0.014);
    gl.disableVertexAttribArray(2); gl.vertexAttrib4f(2, col[0], col[1], col[2], 1);
    cur = null; gl.bindBuffer(gl.ARRAY_BUFFER, mdl.flag.vb); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 40, 0); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 40, 12);
    gl.uniformMatrix4fv(prog.uM, false, M.ch(pole, M.t(0, 0.02, 0), M.ry(Math.sin(t * 3 + p.x * 7) * 0.35), M.s(1.55))); gl.uniform3f(prog.uS, 1, 1, 1); gl.uniform1f(prog.uFlat, 1); gl.drawArrays(gl.TRIANGLES, 0, 3); }

  // Figuren (auf dem Meer im Boot)
  for (const id in G.chars) { const ch = G.chars[id];
    const onSea = ch.vis && ch.scale > 0.5 && !ch.fly && !ch.stage && ch.gy < 0.03;
    if (onSea) { drawModel(mdl.boat, M.ch(M.t(ch.x, 0.03 + Math.sin(t * 2.2 + ch.seed) * 0.01, ch.z), M.ry(ch.rot), M.rz(Math.sin(t * 1.7 + ch.seed) * 0.07), M.s(1.15))); const y = ch.y; ch.y = y + 0.045; drawChar(ch, t); ch.y = y; }
    else drawChar(ch, t); }
  // Koffer
  const co = G.caseObj;
  if (co.node >= 0 && co.scale > 0.02) { const p = G.pos(co.node), s = co.scale * 0.95; gl.uniform1f(prog.uRim, 0.25);
    drawModel(mdl.case, M.ch(M.t(p.x, p.y + 0.42 + co.y + Math.sin(t * 2.4) * 0.04, p.z), M.ry(t * 1.3), M.rz(0.12), M.s(s))); gl.uniform1f(prog.uRim, 0);
    if (Math.random() < dt * 5) G.parts.push({ x: p.x + (Math.random() - 0.5) * 0.3, y: p.y + 0.2 + Math.random() * 0.4, z: p.z + (Math.random() - 0.5) * 0.2, vx: 0, vy: 0.25, vz: 0, life: 0, max: 0.8, col: [1, 0.95, 0.55], kind: "star", rot: 0, g: 0 }); }
  // Flugzeug mit Kondensstreifen
  const pl = G.plane;
  if (pl.on) { drawModel(mdl.plane, M.ch(M.t(pl.x, pl.y, pl.z), M.ry(pl.rot), M.rz(pl.bank), M.rx(pl.pitch || 0), M.s(1.05))); trail += dt; if (trail > 0.045) { trail = 0; G.parts.push({ x: pl.x - Math.sin(pl.rot) * 0.4, y: pl.y, z: pl.z - Math.cos(pl.rot) * 0.4, vx: 0, vy: 0.02, vz: 0, life: 0, max: 1.1, col: [1, 1, 1], kind: "dust", rot: 0, g: 0 }); } }
  // Deko: Schiffe, Ballons, Wolken
  for (const s of SHIPS) drawModel(mdl.boat, M.ch(M.t(s.x + Math.sin(t * 0.05 + s.r) * 0.25, 0.035 + Math.sin(t * 1.8 + s.r) * 0.012, s.z + Math.cos(t * 0.04 + s.r) * 0.2), M.ry(s.r + Math.sin(t * 0.05 + s.r) * 0.4), M.rz(Math.sin(t * 1.5 + s.r) * 0.06), M.s(1.25)));
  for (const b of BALLOONS) drawModel(mdl.balloon, M.ch(M.t(b.x + Math.sin(t * 0.07 + b.ph) * 0.5, 0.95 + Math.sin(t * 0.6 + b.ph) * 0.07, b.z + Math.cos(t * 0.05 + b.ph) * 0.3), M.ry(t * 0.1 + b.ph), M.s(1.25)));
  for (const cl of CLOUDS) drawModel(mdl.cloud, M.ch(M.t(cl.x + Math.sin(t * 0.03 + cl.ph) * 0.5, cl.y + Math.sin(t * 0.3 + cl.ph) * 0.05, cl.z + Math.cos(t * 0.025 + cl.ph) * 0.3), M.ry(cl.ph), M.s(cl.s)));
  // Partikel
  for (let i = G.parts.length - 1; i >= 0; i--) { const p = G.parts[i]; p.life += dt; if (p.life >= p.max) { G.parts.splice(i, 1); continue; }
    p.vy -= p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.rot += dt * 9; const k = p.life / p.max, s = (p.kind === "dust" ? 0.03 + k * 0.05 : 0.03) * (k > 0.7 ? (1 - k) / 0.3 : 1);
    const m = M.ch(M.t(p.x, p.y, p.z), M.ry(p.rot), M.rx(p.rot * 0.7));
    if (p.kind === "coin") draw(dyn.cyl, p.col, M.mul(m, M.rx(Math.PI / 2)), s, s * 0.25, s, 1, false); else if (p.kind === "confetti") draw(dyn.box, p.col, m, s * 1.2, s * 0.2, s * 0.8, 1, true); else if (p.kind === "star") draw(dyn.oct, p.col, M.mul(m, M.rx(Math.PI / 2)), s * 0.7, s * 0.2, s * 0.7, 1, true); else draw(dyn.sph, p.col, m, s, s, s, 1, p.kind === "dust"); }

  // Wasser
  gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
  gl.useProgram(progW); gl.disableVertexAttribArray(1); gl.disableVertexAttribArray(2); gl.bindBuffer(gl.ARRAY_BUFFER, dyn.water); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.uniformMatrix4fv(progW.uVP, false, VP); gl.uniform1f(progW.uT, t); gl.uniform3f(progW.uEye, eye[0], eye[1], eye[2]); gl.uniform3f(progW.uSky, SKY[0], SKY[1], SKY[2]); gl.uniform2f(progW.uW, (GW + 1) * CELL, (GH + 1) * CELL);
  gl.bindTexture(gl.TEXTURE_2D, dataTex); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  // Schatten, Ringe & Leuchten (durchsichtig, knapp über dem Boden)
  gl.useProgram(prog); cur = null; gl.enableVertexAttribArray(1); gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(-2, -4);
  drawModel(decal, M.I, true);
  const pulse = 0.5 + 0.5 * Math.sin(t * 5);
  for (const r of G.rings) { const p = G.pos(r.node); draw(dyn.ring, r.col, M.t(p.x, p.y + 0.004, p.z), 0.17 + pulse * 0.04, 1, 0.17 + pulse * 0.04, 0.95, true); }
  if (co.node >= 0 && co.scale > 0.5) { const p = G.pos(co.node); draw(dyn.disc, [1, 0.86, 0.35], M.t(p.x, p.y + 0.003, p.z), 0.2 + pulse * 0.06, 1, 0.2 + pulse * 0.06, 0.45, true); draw(dyn.ring, [1, 1, 1], M.t(p.x, p.y + 0.004, p.z), 0.23 + pulse * 0.06, 1, 0.23 + pulse * 0.06, 0.9, true); }
  for (const id in G.chars) { const ch = G.chars[id]; if (!ch.vis || ch.scale < 0.05) continue;
    if (id === G.turnId && !ch.stage) draw(dyn.ring, hex(SEATS[ch.seat % 8]), M.t(ch.x, ch.gy + 0.005, ch.z), 0.135, 1, 0.135, 0.95, true);
    const sz = 0.09 * ch.scale * Math.max(0.5, 1 - ch.y * 0.8); draw(dyn.disc, [0, 0.05, 0.08], M.t(ch.x, ch.gy + 0.004, ch.z), sz, 1, sz, 0.3, true); }
  if (pl.on) { const sz = Math.max(0.1, 0.36 - pl.y * 0.07); draw(dyn.disc, [0, 0.05, 0.08], M.t(pl.x, Math.max(0.01, hAt(pl.x, pl.z) + 0.02), pl.z), sz, 1, sz * 0.6, 0.22, true); }
  for (const cl of CLOUDS) draw(dyn.disc, [0, 0.08, 0.15], M.t(cl.x + Math.sin(t * 0.03 + cl.ph) * 0.5 + 0.3, 0.012, cl.z + Math.cos(t * 0.025 + cl.ph) * 0.3 + 0.3), 0.5 * cl.s, 1, 0.3 * cl.s, 0.1, true);
  gl.disable(gl.POLYGON_OFFSET_FILL); gl.disable(gl.BLEND); gl.depthMask(true);
};

function loadImg(src) { return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("Die Weltdaten konnten nicht geladen werden.")); i.src = src; }); }
function pixels(img) { const c = document.createElement("canvas"); c.width = img.width; c.height = img.height; const g = c.getContext("2d"); g.drawImage(img, 0, 0); return g.getImageData(0, 0, img.width, img.height).data; }

G.init = function (canvas) {
  cv = canvas;
  gl = cv.getContext("webgl", { antialias: true, alpha: false }) || cv.getContext("experimental-webgl");
  if (!gl) return Promise.reject(new Error("WebGL wird von diesem Browser nicht unterstützt."));
  prog = mkProg(VS, FS, ["p", "n", "c"]); uni(prog, ["uVP", "uM", "uS", "uEye", "uSky", "uFlat", "uRim"]);
  progW = mkProg(VW, FW, ["p"]); uni(progW, ["uVP", "uD", "uT", "uEye", "uSky", "uW"]);
  dyn = { sph: upIdx(meshSphere(22, 14)), cyl: upIdx(meshCyl(20, 1)), cone: upIdx(meshCyl(14, 0)), box: upIdx(meshBox()), disc: upIdx(meshDisc(28)), ring: upIdx(meshRing(36, 0.74)), oct: upIdx(meshCyl(8, 1)) };
  dyn.water = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, dyn.water); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-60, -60, 80, -60, -60, 70, 80, 70]), gl.STATIC_DRAW);

  // Kamera: ziehen & zoomen
  let drag = null, pinch = 0; const pts = new Map();
  cv.addEventListener("pointerdown", (e) => { pts.set(e.pointerId, e); cv.setPointerCapture(e.pointerId); drag = { x: e.clientX, y: e.clientY }; pinch = 0; });
  cv.addEventListener("pointermove", (e) => {
    if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, e); const c = G.cam;
    if (pts.size === 2) { const [a, b] = [...pts.values()], d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY); if (pinch) { c.td *= pinch / d; c.free = true; } pinch = d; return; }
    if (!drag) return; const k = (c.dist * 0.68) / vh, dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.abs(dx) + Math.abs(dy) < 2) return;
    c.tx -= dx * k; c.tz -= dy * k * 1.25; c.x = c.tx; c.z = c.tz; c.free = true; drag = { x: e.clientX, y: e.clientY };
  });
  const up = (e) => { pts.delete(e.pointerId); drag = null; pinch = 0; };
  cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", up);
  cv.addEventListener("wheel", (e) => { e.preventDefault(); G.cam.td *= e.deltaY > 0 ? 1.14 : 0.88; G.cam.free = true; }, { passive: false });

  return Promise.all([loadImg(WD.color), loadImg(WD.data)]).then(([ci, di]) => {
    GW = WD.gw; GH = WD.gh; CELL = WD.cell / U;
    const cp = pixels(ci), dp = pixels(di), w = GW + 1;
    hV = new Float32Array(w * (GH + 1)); bioV = new Uint8Array(w * (GH + 1)); colC = new Float32Array(GW * GH * 3);
    for (let i = 0; i < w * (GH + 1); i++) { hV[i] = (dp[i * 4] / 255) * 0.8 - 0.2; bioV[i] = Math.round(dp[i * 4 + 2] / 40); }
    for (let i = 0; i < GW * GH; i++) { colC[i * 3] = cp[i * 4] / 255; colC[i * 3 + 1] = cp[i * 4 + 1] / 255; colC[i * 3 + 2] = cp[i * 4 + 2] / 255; }
    dataTex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, dataTex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, di);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const b = new Builder(), dec = new Builder(); dec.vary = 0;
    b.vary = 0.09; buildTerrain(b); b.vary = 0.07;
    buildFields(b, dec); buildPaths(b, dec); buildMountains(b); buildProps(b, dec); buildLandmarks(b, dec); buildAirports(b);
    G.stats = { tris: b.a.length / 30 };
    world = upBuilder(b); decal = upBuilder(dec);
    mdl = { boat: upBuilder(modelBoat()), plane: upBuilder(modelPlane()), case: upBuilder(modelCase()), cloud: upBuilder(modelCloud()), balloon: upBuilder(modelBalloon()), flag: upBuilder(modelFlag()) };
  });
};
window.G3 = G;
})();
