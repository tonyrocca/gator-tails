/* Gator Tails, week 10 "Grand Theft Gator": one procedural 3D street (three.js r149), a spot per team.
   Everything is built from code: cars from a side profile, gators from blobs, sets from boxes. */
(function () {
'use strict';
const V = window.V3D = {ok: false};
let T, R, scene, cam, canvas, host = null, raf = 0, envTex, sky, sunM, moonM, stars, hemi, dl, pl1, pl2;
const S = 46, ROADZ = -2, spots = {}, PI = Math.PI;
let order = [], focus = 0, target = 0, mode = 'story', off = 0, offT = 0, tOrb = 0, built = 0, fv = 0, hw = 1, hh = 1, pr = 0, slow = 0, rt = null, pcam = null;
let seed = 7; const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280, pick = a => a[Math.floor(rnd() * a.length)];
const ss = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const hex = c => '#' + c.toString(16).padStart(6, '0');

// ---------- helpers
const M = (c, o = {}) => new T.MeshStandardMaterial(Object.assign({color: c, roughness: .8, metalness: 0}, o));
const glow = (c, o = {}) => new T.MeshBasicMaterial(Object.assign({color: c, toneMapped: false}, o));
const mesh = (g, m, x = 0, y = 0, z = 0) => { const k = new T.Mesh(g, m); k.position.set(x, y, z); return k; };
const box = (w, h, d, m, x, y, z) => mesh(new T.BoxGeometry(w, h, d), m, x, y, z);
const sph = (r, m, x, y, z, sx = 1, sy = 1, sz = 1) => { const k = mesh(new T.SphereGeometry(r, 20, 14), m, x, y, z); k.scale.set(sx, sy, sz); return k; };
const cyl = (r1, r2, h, m, x, y, z, seg = 16) => mesh(new T.CylinderGeometry(r1, r2, h, seg), m, x, y, z);
const cap = (r, l, m, x, y, z) => mesh(new T.CapsuleGeometry(r, l, 6, 12), m, x, y, z);
const add = (g, ...k) => { k.forEach(x => x && g.add(x)); return g; };
const rot = (m, x = 0, y = 0, z = 0) => { m.rotation.set(x, y, z); return m; };
const ctex = (w, h, draw, rep) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; t.anisotropy = 4; if (rep) { t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(rep[0], rep[1]); } return t; };
function sign(text, col, hgt = 1, font = 'Mr Dafoe') { const fs = 96, pad = 44, c0 = document.createElement('canvas').getContext('2d'); c0.font = `${fs}px "${font}", cursive`; const w = Math.ceil(c0.measureText(text).width) + pad * 2, h = fs + pad * 2;
  const tx = ctex(w, h, c => { c.font = `${fs}px "${font}", cursive`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.shadowColor = col; c.shadowBlur = 30; c.fillStyle = col; c.fillText(text, w / 2, h / 2); c.fillText(text, w / 2, h / 2); c.shadowBlur = 6; c.globalAlpha = .8; c.fillStyle = '#fff'; c.fillText(text, w / 2, h / 2); });
  return new T.Mesh(new T.PlaneGeometry(hgt * w / h, hgt), new T.MeshBasicMaterial({map: tx, transparent: true, depthWrite: false, toneMapped: false, side: T.DoubleSide})); }
function board(text, bg, fg, w, h, font = 'Anton') { const pw = 256, ph = Math.round(256 * h / w), tx = ctex(pw, ph, c => { c.fillStyle = bg; c.fillRect(0, 0, pw, ph); c.fillStyle = fg; c.textAlign = 'center'; c.textBaseline = 'middle'; const ls = text.split('|'); let fs = ph * .7 / ls.length; c.font = `${fs}px "${font}", sans-serif`; const mw = Math.max(...ls.map(l => c.measureText(l).width)); if (mw > pw * .9) { fs *= pw * .9 / mw; c.font = `${fs}px "${font}", sans-serif`; } ls.forEach((l, k) => c.fillText(l, pw / 2, ph / 2 + (k - (ls.length - 1) / 2) * fs * 1.08)); });
  return new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({map: tx, side: T.DoubleSide})); }
// crease-angle normals for the non-indexed extrusions, so the cars read as smooth sheet metal instead of facets
function smooth(geo, deg = 42) { const p = geo.attributes.position, n = p.count, cos = Math.cos(deg * PI / 180), fn = new Float32Array(n * 3), map = new Map(), a = new T.Vector3(), b = new T.Vector3(), c = new T.Vector3(), q = v => Math.round(v * 1e3);
  for (let i = 0; i < n; i += 3) { a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, i + 1); c.fromBufferAttribute(p, i + 2); b.sub(a); c.sub(a); b.cross(c);
    for (let k = 0; k < 3; k++) { const j = i + k; fn[j * 3] = b.x; fn[j * 3 + 1] = b.y; fn[j * 3 + 2] = b.z; const key = q(p.getX(j)) + ',' + q(p.getY(j)) + ',' + q(p.getZ(j)); let l = map.get(key); if (!l) map.set(key, l = []); l.push(j); } }
  const out = new Float32Array(n * 3);
  map.forEach(ids => ids.forEach(i => { let x = 0, y = 0, z = 0; const ax = fn[i * 3], ay = fn[i * 3 + 1], az = fn[i * 3 + 2], al = Math.hypot(ax, ay, az) || 1; ids.forEach(j => { const bx = fn[j * 3], by = fn[j * 3 + 1], bz = fn[j * 3 + 2], bl = Math.hypot(bx, by, bz) || 1; if ((ax * bx + ay * by + az * bz) / (al * bl) >= cos) { x += bx; y += by; z += bz; } }); const l = Math.hypot(x, y, z) || 1; out[i * 3] = x / l; out[i * 3 + 1] = y / l; out[i * 3 + 2] = z / l; }));
  geo.setAttribute('normal', new T.BufferAttribute(out, 3)); return geo; }
let DARK, CHROME, GLASS, RUBBER, CONC;

// ---------- cars
function wheel(r, w, rimC) { const g = new T.Group(), pts = [[r * .6, -w / 2], [r * .92, -w / 2], [r, -w * .3], [r, w * .3], [r * .92, w / 2], [r * .6, w / 2]].map(p => new T.Vector2(p[0], p[1]));
  add(g, rot(mesh(new T.LatheGeometry(pts, 22), RUBBER), PI / 2), rot(cyl(r * .62, r * .62, w * .86, M(0x1b1b22, {roughness: .5}), 0, 0, 0, 20), PI / 2));
  const rim = M(rimC || 0xd8dce4, {metalness: 1, roughness: .22, envMap: envTex});
  [-1, 1].forEach(s => { add(g, mesh(new T.TorusGeometry(r * .6, r * .05, 6, 22), rim, 0, 0, s * w * .44), sph(r * .16, rim, 0, 0, s * w * .44, 1, 1, .5)); for (let k = 0; k < 5; k++) add(g, rot(box(r * 1.16, r * .13, .02, rim, 0, 0, s * w * .44), 0, 0, k * PI / 5)); });
  return g; }
function car(o) { const g = new T.Group(), W = o.W, top = o.top, x0 = top[0][0], x1 = top[top.length - 1][0], belt = Math.max(...top.map(p => p[1]));
  const paint = o.mat || new T.MeshPhysicalMaterial({color: o.paint, metalness: o.metal == null ? .5 : o.metal, roughness: o.rough == null ? .3 : o.rough, clearcoat: o.coat == null ? 1 : o.coat, clearcoatRoughness: .08, envMap: envTex, envMapIntensity: o.env == null ? 1.15 : o.env, map: o.map || null});
  const sh = new T.Shape(); sh.moveTo(x0, o.c); sh.lineTo(top[0][0], top[0][1]);
  if (o.sharp) top.slice(1).forEach(p => sh.lineTo(p[0], p[1])); else sh.splineThru(top.slice(1).map(p => new T.Vector2(p[0], p[1])));
  sh.lineTo(x1, o.c);
  const ax = [[o.xf, o.r], [o.xr, o.rr || o.r]];
  ax.forEach(([x, r]) => { const ra = r * 1.17, sn = (o.c - r) / ra; if (sn >= .95) return; const a0 = Math.asin(sn), dx = ra * Math.cos(a0); sh.lineTo(x + dx, o.c); sh.absarc(x, r, ra, a0, PI - a0, false); });
  sh.lineTo(x0, o.c);
  const bv = o.bv || .05, geo = new T.ExtrudeGeometry(sh, {depth: W - 2 * bv, bevelEnabled: true, bevelThickness: bv, bevelSize: bv, bevelOffset: -bv, bevelSegments: 3, curveSegments: 14});
  geo.translate(0, 0, -(W - 2 * bv) / 2);
  const P = geo.attributes.position, hx = Math.max(-x0, x1), tum = o.tum == null ? .07 : o.tum, nose = o.nose == null ? .1 : o.nose, tail = o.tail == null ? .06 : o.tail, r0 = Math.max(o.r, o.rr || 0);
  for (let i = 0; i < P.count; i++) { const x = P.getX(i), y = P.getY(i); P.setZ(i, P.getZ(i) * (1 - tum * ss(r0 * 1.5, belt, y)) * (1 - (x > 0 ? nose : tail) * Math.pow(Math.abs(x) / hx, 3))); }
  add(g, mesh(smooth(geo), paint));
  // wheels + dark wells
  g.userData.wheels = [];
  ax.forEach(([x, r]) => { add(g, rot(cyl(r * 1.13, r * 1.13, W - .46, DARK, x, r, 0, 18), PI / 2)); if (o.noWheels) return; const ww = o.ww || r * .72; [-1, 1].forEach(s => { const w = wheel(r, ww, o.rim); w.position.set(x, r, s * (W / 2 - ww / 2 + .015)); g.add(w); g.userData.wheels.push(w); }); });
  // cabin: body-colour shell with window holes, dark glass core, windshield + rear glass laid on the slopes
  if (o.cab) { const [A, B, C, D] = o.cab, yb = Math.min(A[1], D[1]), yt = B[1], cw = W * (o.cabW || .86), ct = o.ctum == null ? .16 : o.ctum;
    const rx = y => A[0] + (B[0] - A[0]) * (y - A[1]) / (B[1] - A[1]), fx = y => D[0] + (C[0] - D[0]) * (y - D[1]) / (C[1] - D[1]), hw = y => cw / 2 * (1 - ct * Math.max(0, (y - yb) / (yt - yb)));
    const outline = () => { const s = new T.Shape(); s.moveTo(A[0], A[1]); s.lineTo(B[0], B[1]); s.quadraticCurveTo((B[0] + C[0]) / 2, yt + .05, C[0], C[1]); s.lineTo(D[0], D[1]); s.lineTo(A[0], A[1]); return s; };
    const tap = ge => { const p = ge.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, p.getZ(i) * (1 - ct * Math.max(0, (p.getY(i) - yb) / (yt - yb)))); return ge; };
    const quad = (p0, p1, n) => { const a = [p0[0] + (p1[0] - p0[0]) * .1, p0[1] + (p1[1] - p0[1]) * .1], b = [p0[0] + (p1[0] - p0[0]) * .9, p0[1] + (p1[1] - p0[1]) * .9], wa = hw(a[1]) * .88, wb = hw(b[1]) * .88, e = .034, ge = new T.BufferGeometry();
      ge.setAttribute('position', new T.Float32BufferAttribute([a[0] + n[0] * e, a[1] + n[1] * e, -wa, a[0] + n[0] * e, a[1] + n[1] * e, wa, b[0] + n[0] * e, b[1] + n[1] * e, wb, b[0] + n[0] * e, b[1] + n[1] * e, -wb], 3)); ge.setIndex([0, 1, 2, 0, 2, 3]); ge.computeVertexNormals(); return new T.Mesh(ge, GLASS); };
    const df = [C[0] - D[0], C[1] - D[1]], lf = Math.hypot(df[0], df[1]), nf = [df[1] / lf, -df[0] / lf], dr = [B[0] - A[0], B[1] - A[1]], lr = Math.hypot(dr[0], dr[1]), nr = [-dr[1] / lr, dr[0] / lr];
    if (o.open) { add(g, quad(D, C, nf), quad(D, C, [-nf[0] * 1.5, -nf[1] * 1.5]), box(.05, .04, hw(C[1]) * 1.8, CHROME, C[0], C[1], 0));
      const [ox0, ox1, oy] = o.open, tan = M(o.seat || 0xc9a06a, {roughness: .7}); add(g, box(ox1 - ox0, .03, W * .74, DARK, (ox0 + ox1) / 2, oy, 0));
      [-1, 1].forEach(s => add(g, rot(box(.16, .5, .46, tan, ox0 + .32, oy + .2, s * .39), 0, 0, .22), sph(.12, tan, ox0 + .24, oy + .5, s * .39, .7, 1, 1.2), box(.5, .12, .46, tan, ox0 + .6, oy + .04, s * .39)));
      add(g, rot(mesh(new T.TorusGeometry(.15, .018, 6, 18), DARK, ox1 - .22, oy + .2, -.39), 0, PI / 2 - .5, 0)); }
    else { const s = outline(), yl = Math.max(A[1], D[1]) + .07, yh = yt - .1, ps = o.pillars || [], n = ps.length + 1;
      for (let k = 0; k < n; k++) { const L = y => k === 0 ? rx(y) + .1 : ps[k - 1] + .04, Rt = y => k === n - 1 ? fx(y) - .1 : ps[k] - .04, h = new T.Path(); h.moveTo(L(yl), yl); h.lineTo(L(yh), yh); h.lineTo(Rt(yh), yh); h.lineTo(Rt(yl), yl); h.lineTo(L(yl), yl); s.holes.push(h); }
      const sg = new T.ExtrudeGeometry(s, {depth: cw - .04, bevelEnabled: true, bevelThickness: .02, bevelSize: .02, bevelOffset: -.02, bevelSegments: 2, curveSegments: 8}); sg.translate(0, 0, -(cw - .04) / 2);
      const cg = new T.ExtrudeGeometry(outline(), {depth: cw - .1, bevelEnabled: false, curveSegments: 8}); cg.translate(0, 0, -(cw - .1) / 2); cg.computeBoundingBox(); { const bb = cg.boundingBox, mx = (bb.min.x + bb.max.x) / 2, my = (bb.min.y + bb.max.y) / 2; cg.translate(-mx, -my, 0); cg.scale(.955, .93, 1); cg.translate(mx, my, 0); }
      add(g, mesh(smooth(tap(sg)), o.roof ? M(o.roof, {roughness: .6}) : paint), mesh(tap(cg), GLASS), quad(D, C, nf), quad(A, B, nr));
      [-1, 1].forEach(sd => add(g, box(.1, .07, .14, paint, D[0] - .1, D[1] + .1, sd * (hw(D[1]) + .09)))); } }
  // lights, grille, bumpers, plates
  const lamp = glow(0xfff3c4), red = glow(0xff1f3a), amber = glow(0xffa51f), nz = 1 - nose * .9, tz = 1 - tail * .9;
  if (o.hl) { const h = o.hl; (h.zs || [h.z]).forEach(z => [-1, 1].forEach(s => { if (h.dead && s === h.dead) return add(g, box(.05, h.h, h.w, DARK, x1 + .012, h.y, s * z * nz)); add(g, h.round ? rot(cyl(h.h / 2, h.h / 2, .06, lamp, x1 + .012, h.y, s * z * nz, 14), 0, 0, PI / 2) : box(.06, h.h, h.w, lamp, x1 + .012, h.y, s * z * nz)); })); }
  if (o.sig) [-1, 1].forEach(s => add(g, box(.05, .06, .2, amber, x1 + .012, o.sig, s * W * .36 * nz)));
  if (o.gr) add(g, box(.05, o.gr.h, o.gr.w, DARK, x1 + .008, o.gr.y, 0));
  if (o.tl) { const t = o.tl; if (t.bar) add(g, box(.05, t.h + .05, W * .86 * tz, DARK, x0 - .008, t.y, 0)); [-1, 1].forEach(s => add(g, box(.06, t.h, t.w, red, x0 - .014, t.y, s * t.z * tz))); }
  if (o.bump) { const bm = M(o.bump, {metalness: o.bump === 0xd8dce4 ? 1 : .2, roughness: .3, envMap: envTex}); add(g, box(.14, .15, W * .96 * nz, bm, x1 - .01, o.c + .12, 0), box(.14, .15, W * .96 * tz, bm, x0 + .01, o.c + .12, 0)); }
  if (o.plate) { const p = board(o.plate, '#f4f1e4', '#1d3b2a', .66, .27); p.position.set(x1 + .078, o.py || o.c + .17, 0); p.rotation.y = PI / 2; g.add(p); }
  if (o.glowC) { const u = new T.Mesh(new T.PlaneGeometry(x1 - x0 + 1.6, W + 1.6), new T.MeshBasicMaterial({map: GLOWTEX, color: o.glowC, transparent: true, depthWrite: false, blending: T.AdditiveBlending, toneMapped: false})); u.rotation.x = -PI / 2; u.position.y = .03; g.add(u); }
  if (o.extra) o.extra(g, paint, {x0, x1, W, belt});
  g.traverse(m => { if (m.isMesh && m.material.isMeshStandardMaterial) { m.castShadow = true; } });
  return g; }
let GLOWTEX;
const CARS = {
  tony: () => car({W: 1.98, c: .14, r: .33, xf: 1.42, xr: -1.32, paint: 0xf7f5f0, metal: .25, rough: .22, rim: 0xe9edf2, glowC: 0xff4fa3, plate: 'CORRUPT',
    top: [[-2.25, .5], [-2.24, .84], [-1.5, .9], [-.6, .9], [.5, .82], [1.5, .64], [2.15, .5], [2.25, .42], [2.25, .3]], cab: [[-1.2, .86], [-.5, 1.14], [.1, 1.14], [.95, .74]], cabW: .8,
    hl: {y: .36, z: .62, w: .34, h: .07}, sig: .47, gr: {y: .27, w: 1.2, h: .1}, tl: {y: .64, z: .55, w: .62, h: .1, bar: 1},
    extra: (g, p, d) => { for (let k = 0; k < 5; k++) [-1, 1].forEach(s => add(g, box(1.3, .02, .03, DARK, -.3, .4 + k * .065, s * (d.W / 2 - .002)))); [-1, 1].forEach(s => add(g, box(.5, .34, .02, DARK, -.72, .53, s * (d.W / 2 - .012)))); } }),
  daniel: () => car({W: 1.95, c: .21, r: .35, rr: .4, xf: 1.5, xr: -1.45, paint: 0xff6a13, rim: 0xd8dce4, bump: 0xd8dce4, plate: 'CHAMP', sharp: 1, bv: .07, nose: .04, tail: .04,
    top: [[-2.45, .5], [-2.45, .9], [-2.3, .96], [-1.3, .97], [.5, .97], [2.3, .92], [2.45, .84], [2.45, .42]], cab: [[-1.55, .95], [-.7, 1.36], [.05, 1.36], [.62, .95]], pillars: [-.35],
    hl: {y: .7, zs: [.72, .46], h: .16, round: 1}, gr: {y: .7, w: .7, h: .16}, tl: {y: .72, z: .6, w: .5, h: .1},
    extra: (g, p, d) => { [-1, 1].forEach(s => add(g, box(1.86, .012, .2, DARK, 1.45, .955, s * .19), box(.76, .012, .2, DARK, -.33, 1.405, s * .19), box(1.1, .012, .2, DARK, -1.85, .972, s * .19), rot(cyl(.05, .05, 1.7, CHROME, 0, .2, s * (d.W / 2 + .04), 10), 0, 0, PI / 2)));
      add(g, box(.5, .2, .46, CHROME, 1.3, 1.06, 0), rot(box(.46, .16, .42, CHROME, 1.34, 1.22, 0), 0, 0, -.12), box(.04, .12, .36, DARK, 1.58, 1.22, 0), rot(box(.36, .03, 1.7, p, -2.32, 1.08, 0), 0, 0, .15), box(.06, .12, .06, p, -2.3, 1.01, .7), box(.06, .12, .06, p, -2.3, 1.01, -.7)); } }),
  reece: () => car({W: 2.15, c: .44, r: .47, ww: .34, xf: 1.5, xr: -1.45, paint: 0xffffff, map: CAMO(), metal: 0, rough: .85, coat: 0, env: .25, rim: 0x3b4028, plate: 'MILITRY', sharp: 1, bv: .06, tum: .02, nose: .02, tail: .02, py: .8,
    top: [[-2.35, .62], [-2.35, 1.3], [.5, 1.3], [.62, 1.24], [2.2, 1.2], [2.35, 1.08], [2.35, .62]], cab: [[-2.25, 1.28], [-2.1, 1.92], [.15, 1.92], [.45, 1.28]], pillars: [-1.3, -.45], cabW: .9, ctum: .07,
    hl: {y: 1.0, z: .78, h: .2, round: 1}, gr: {y: 1.0, w: 1.0, h: .26}, tl: {y: 1.05, z: .8, w: .2, h: .12},
    extra: (g, p, d) => { const ol = M(0x2e351f, {roughness: .9}); add(g, box(.14, .2, d.W, ol, 2.42, .72, 0), box(.1, .5, .08, ol, 2.46, .95, .5), box(.1, .5, .08, ol, 2.46, .95, -.5), box(.1, .08, 1.08, ol, 2.46, 1.2, 0), cyl(.34, .34, .1, ol, -.8, 1.97, 0, 18), cyl(.012, .012, 1.5, DARK, -2.1, 2.6, .9, 6), box(.4, .24, .02, glow(0xff4fa3), -1.9, 3.2, .9), rot(mesh(wheel(.45, .3, 0x3b4028).children[0].geometry, RUBBER, -2.52, 1.25, 0), 0, PI / 2, 0));
      for (let k = 0; k < 4; k++) add(g, box(.1, .1, .14, glow(0xfff3c4), .1, 2.0, -.6 + k * .4)); add(g, box(.08, .05, 1.5, DARK, .1, 1.95, 0)); } }),
  nicky: () => car({W: 1.78, c: .14, r: .33, xf: 1.32, xr: -1.3, paint: 0x101016, metal: .7, rough: .18, rim: 0xe2b64a, plate: 'COKE', seat: 0xc9a06a,
    top: [[-2.2, .48], [-2.2, .8], [-1.7, .87], [-.8, .88], [.5, .88], [1.5, .74], [2.1, .56], [2.2, .46], [2.2, .3]], cab: [[-.9, .86], [-.7, 1.0], [.42, 1.2], [.78, .84]], cabW: .84, ctum: .06, open: [-.85, .55, .885],
    hl: {y: .56, z: .62, h: .15, round: 1}, gr: {y: .33, w: .9, h: .12}, sig: .4, tl: {y: .66, z: .6, w: .3, h: .09}, bump: 0xd8dce4 }),
  ryan: () => car({W: 1.86, c: .17, r: .34, xf: 1.5, xr: -1.45, paint: 0xb9c0c8, metal: .85, rough: .25, rim: 0xd8dce4, bump: 0x2a2c33, plate: 'JAY-LEN',
    top: [[-2.4, .5], [-2.4, .9], [-2.2, .96], [-1.4, .97], [.7, .96], [2.2, .86], [2.4, .76], [2.4, .4]], cab: [[-1.5, .95], [-1.0, 1.42], [.2, 1.42], [.95, .93]], pillars: [-.35],
    hl: {y: .72, z: .64, w: .42, h: .13}, gr: {y: .72, w: .7, h: .2}, tl: {y: .76, z: .62, w: .46, h: .12},
    extra: (g) => { add(g, cyl(.012, .012, .12, CHROME, 2.28, .93, 0, 6), rot(mesh(new T.TorusGeometry(.05, .008, 5, 14), CHROME, 2.28, 1.02, 0), 0, PI / 2, 0)); const b = board('LEASED', '#ffe14a', '#111', .5, .16); b.position.set(.62, 1.2, 0); b.rotation.set(0, PI / 2, 0); b.rotation.z = -.55; g.add(b); } }),
  sham: () => car({W: 1.96, c: .3, r: .4, ww: .3, xf: 1.5, xr: -1.45, paint: 0x35c9d6, metal: .4, rough: .3, rim: 0xd8dce4, bump: 0x2a2c33, plate: 'RVNS420', sharp: 1, bv: .08, tum: .04,
    top: [[-2.35, .6], [-2.35, 1.12], [-2.2, 1.17], [.6, 1.17], [.8, 1.1], [2.2, 1.05], [2.35, .94], [2.35, .55]], cab: [[-2.3, 1.15], [-2.1, 1.8], [.1, 1.8], [.7, 1.12]], pillars: [-1.35, -.4], cabW: .9, ctum: .1,
    hl: {y: .9, z: .7, w: .36, h: .16}, gr: {y: .9, w: .9, h: .2}, tl: {y: .95, z: .78, w: .16, h: .3},
    extra: (g) => { [-1, 1].forEach(s => add(g, box(2.0, .04, .04, DARK, -1.0, 1.9, s * .6))); [-1.7, -.3].forEach(x => add(g, box(.04, .04, 1.3, DARK, x, 1.9, 0)));
      [[0xff4fa3, -.3, .0], [0xffe14a, .28, .06]].forEach(([c, z, r]) => { const b = mesh(new T.CapsuleGeometry(.14, 1.5, 4, 10), M(c, {roughness: .35}), -1.0, 1.95, z); b.rotation.set(0, r, PI / 2); b.scale.set(1, 1, .14); b.scale.z = 1; b.scale.x = .16; g.add(b); }); } }),
  jackson: () => car({W: 1.62, c: .16, r: .29, ww: .2, xf: 1.2, xr: -1.2, paint: 0xe0262b, metal: .3, rough: .32, rim: 0xcfd3da, bump: 0x2a2c33, plate: '8BALL',
    top: [[-1.85, .45], [-1.85, .84], [-1.6, .9], [.5, .88], [1.6, .76], [1.85, .64], [1.85, .36]], cab: [[-1.8, .87], [-1.4, 1.4], [.05, 1.4], [.68, .86]], pillars: [-.55],
    hl: {y: .64, z: .56, w: .3, h: .13}, gr: {y: .6, w: .5, h: .1}, tl: {y: .72, z: .58, w: .22, h: .14},
    extra: (g) => { const sg = board('SLICE MASTERS|PIZZA', '#fff6d8', '#d3201f', 1.0, .36); const s2 = sg.clone(); sg.position.set(-.6, 1.68, .17); s2.position.set(-.6, 1.68, -.17); s2.rotation.y = PI; add(g, sg, s2, box(1.0, .36, .32, glow(0xfff0b8), -.6, 1.68, 0), box(1.06, .05, .4, M(0xd3201f), -.6, 1.48, 0), box(1.06, .04, .4, M(0xd3201f), -.6, 1.88, 0)); } }),
  ian: () => car({W: 1.96, c: .6, r: .5, ww: .38, xf: 1.55, xr: -1.55, paint: 0x5d6e3a, metal: .1, rough: .6, coat: .2, env: .5, rim: 0x8a8f96, plate: 'NOSTRIL', sharp: 1, bv: .07, tum: .03, py: .98,
    top: [[-2.5, .78], [-2.5, 1.34], [.55, 1.34], [.7, 1.3], [2.35, 1.25], [2.5, 1.12], [2.5, .74]], cab: [[-.45, 1.32], [-.35, 1.98], [.55, 1.98], [1.0, 1.3]], cabW: .9, ctum: .1,
    hl: {y: 1.06, z: .74, w: .32, h: .18}, gr: {y: 1.06, w: 1.0, h: .22}, tl: {y: 1.1, z: .84, w: .14, h: .26}, bump: 0x8a8f96,
    extra: (g, p, d) => { add(g, box(1.95, .02, d.W * .8, DARK, -1.45, 1.352, 0), box(.06, .5, .06, DARK, -.5, 2.2, .7), box(.06, .5, .06, DARK, -.5, 2.2, -.7), box(.06, .06, 1.46, DARK, -.5, 2.44, 0), box(.5, .36, .7, M(0xf1f5f7, {roughness: .5}), -2.0, 1.53, .3), box(.52, .08, .72, M(0x1d6fd1), -2.0, 1.74, .3));
      for (let k = 0; k < 4; k++) add(g, rot(cyl(.09, .09, .06, glow(0xffe9a0), -.46, 2.56, -.54 + k * .36, 12), 0, 0, PI / 2));
      [[-1.9, -.6, .25], [-2.2, -.4, .42]].forEach(([x, z, a]) => { add(g, rot(cyl(.012, .02, 2.6, M(0x222), x - a, 2.5, z, 6), 0, 0, a), sph(.05, glow(0xff3b3b), x - a * 2.6, 3.72, z)); });
      [-1, 1].forEach(s => add(g, cyl(.05, .05, 1.1, CHROME, -.62, 1.9, s * .86, 8), box(.04, .4, .5, DARK, -2.15, .75, s * .72))); } }),
  nick: () => car({W: 1.9, c: .2, r: .34, xf: 1.45, xr: -1.4, paint: 0xd9c9a3, metal: .2, rough: .4, rim: 0xb9bdc4, bump: 0x2a2c33, plate: 'CARTER', bv: .08,
    top: [[-2.35, .5], [-2.35, .96], [-2.2, 1.0], [1.1, 1.0], [2.1, .87], [2.35, .74], [2.35, .4]], cab: [[-2.3, .98], [-2.15, 1.74], [.7, 1.74], [1.75, .9]], pillars: [-1.25, -.2, .6], cabW: .9, ctum: .1,
    hl: {y: .7, z: .66, w: .4, h: .13}, gr: {y: .7, w: .7, h: .12}, tl: {y: .9, z: .8, w: .14, h: .34},
    extra: (g, p, d) => { const wd = M(0x7a4a22, {roughness: .7}), tr = M(0xe8d9a8); [-1, 1].forEach(s => add(g, box(3.5, .34, .03, wd, -.25, .66, s * (d.W / 2 + .004)), box(3.56, .03, .04, tr, -.25, .84, s * (d.W / 2 + .006)), box(3.56, .03, .04, tr, -.25, .48, s * (d.W / 2 + .006))));
      const rb = mesh(new T.CapsuleGeometry(.2, 1.5, 6, 12), M(0x2b2d36, {roughness: .5}), -.8, 1.92, 0); rb.rotation.z = PI / 2; rb.scale.set(1, 1, 2); g.add(rb);
      const bb = ctex(128, 128, c => { c.translate(64, 64); c.rotate(PI / 4); c.fillStyle = '#ffd400'; c.fillRect(-44, -44, 88, 88); c.strokeStyle = '#111'; c.lineWidth = 4; c.strokeRect(-40, -40, 80, 80); c.rotate(-PI / 4); c.fillStyle = '#111'; c.font = '900 19px Arial'; c.textAlign = 'center'; c.fillText('BABY', 0, -8); c.fillText('ON', 0, 12); c.fillText('BOARD', 0, 32); });
      [-1, 1].forEach(s => { const m = new T.Mesh(new T.PlaneGeometry(.42, .42), new T.MeshBasicMaterial({map: bb, transparent: true, side: T.DoubleSide})); m.position.set(-1.72, 1.36, s * (d.W * .45 * .93 + .02)); g.add(m); }); } }),
  dean: () => car({W: 1.72, c: .34, r: .31, xf: 1.35, xr: -1.3, paint: 0xffffff, map: RUST(), metal: 0, rough: .95, coat: 0, env: .15, plate: '0-10', sharp: 1, bv: .06, noWheels: 1, py: .56,
    top: [[-2.15, .56], [-2.15, .94], [-1.3, .98], [.5, .98], [2.05, .9], [2.15, .8], [2.15, .5]], cab: [[-1.4, .96], [-.95, 1.42], [.2, 1.42], [.78, .96]], pillars: [-.3],
    hl: {y: .74, z: .6, w: .34, h: .13, dead: -1}, gr: {y: .74, w: .6, h: .13}, tl: {y: .78, z: .6, w: .3, h: .1},
    extra: (g, p, d) => { const cb = M(0x8d8f96, {roughness: 1}), dr = M(0x6b3a1c, {roughness: .9});
      [1.35, -1.3].forEach(x => [-1, 1].forEach(s => { add(g, box(.42, .17, .22, cb, x, .085, s * .62), box(.22, .17, .42, cb, x, .255, s * .62), rot(cyl(.16, .16, .08, dr, x, .34, s * .8, 12), PI / 2)); }));
      const hood = new T.Group(); hood.position.set(.55, .99, 0); add(hood, box(1.5, .03, d.W * .84, p, .75, 0, 0)); hood.rotation.z = .85; g.add(hood); add(g, cyl(.012, .012, .8, DARK, 1.5, 1.3, .5, 5), box(1.2, .3, 1.2, DARK, 1.3, .86, 0));
      add(g, rot(box(.14, .15, d.W * .96, M(0x9aa0a8, {metalness: .6, roughness: .5}), 2.2, .5, .05), .12, .1, .18));
      const tire = () => mesh(new T.TorusGeometry(.22, .1, 8, 18), RUBBER); add(g, rot(tire(), PI / 2, 0, 0).translateZ(0)); g.children[g.children.length - 1].position.set(-1.0, .1, 1.5); const t2 = tire(); t2.position.set(-2.45, .32, .3); t2.rotation.y = PI / 2 - .3; g.add(t2);
      const st = board('IMPOUNDED', '#ff7a1a', '#111', .6, .2); st.position.set(.55, 1.22, .2); st.rotation.set(0, PI / 2, 0); st.rotation.z = -.62; g.add(st); } })
};
const blobs = (cols, base, n) => ctex(256, 256, (c, W, H) => { c.fillStyle = base; c.fillRect(0, 0, W, H); seed = 31; for (let k = 0; k < n; k++) { c.fillStyle = pick(cols); const x = rnd() * W, y = rnd() * H, r = 14 + rnd() * 34; for (const [ox, oy] of [[0, 0], [W, 0], [-W, 0], [0, H], [0, -H]]) { c.beginPath(); c.ellipse(x + ox, y + oy, r, r * (.45 + rnd() * .4), rnd() * 3, 0, 7); c.fill(); } } }, [.55, .55]);
const CAMO = () => blobs(['#2e3a1e', '#6b6a3a', '#1e2416', '#57663a'], '#4b5a2a', 46);
const RUST = () => blobs(['#8a4a22', '#5a2e16', '#9a9da3', '#6f747a', '#a2572b'], '#7d8388', 30);

// ---------- gators
let BEAT = 0; // beats since the music started (or a 120 bpm clock when it is off)
function gator(o = {}) { const g = new T.Group(), sk = M(o.skin || 0x4fb36a, {roughness: .5}), bl = M(0xd7ecb4, {roughness: .6}), top = o.bare ? sk : M(o.top || 0xffffff, {roughness: .7}), bot = M(o.bot || 0x2a2a3a, {roughness: .7}), dk = M(0x14121c, {roughness: .35}), wh = M(0xffffff, {roughness: .25});
  const bd = new T.Group(), up = new T.Group(), B = new T.Group(), X = {}; g.add(bd); bd.add(up); up.position.y = .5; B.position.y = -.5; up.add(B);
  const legs = [-1, 1].map(s => { const l = new T.Group(); l.position.set(s * .15, .5, 0); add(l, cap(.105, .26, bot, 0, -.2, 0), sph(.13, o.shoe ? M(o.shoe, {roughness: .5}) : sk, 0, -.43, .07, 1, .55, 1.5)); bd.add(l); return l; });
  const tail = new T.Group(); add(tail, mesh(new T.ConeGeometry(.17, 1.0, 12), sk, 0, .46, 0)); tail.position.set(0, .56, -.06); tail.rotation.x = -1.95; add(B, tail);
  add(B, sph(.3, top, 0, .8, 0, 1, 1.22, .86), sph(.3, o.tee ? M(o.tee, {roughness: .7}) : (o.bare ? bl : top), 0, .8, .1, .62, 1.1, .62), sph(.15, sk, 0, 1.12, .01));
  if (o.belt) add(B, rot(mesh(new T.TorusGeometry(.275, .03, 6, 20), M(o.belt), 0, .56, 0), PI / 2));
  const hd = new T.Group(); hd.position.set(0, 1.33, .03); B.add(hd);
  add(hd, sph(.24, sk, 0, 0, 0, 1, .88, 1.02), sph(.2, sk, 0, -.04, .3, .86, .52, 1.75), sph(.2, bl, 0, -.12, .26, .8, .34, 1.62));
  [-1, 1].forEach(s => { add(hd, sph(.03, dk, s * .06, .055, .62), sph(.092, sk, s * .115, .19, .09), sph(.066, wh, s * .118, .2, .135), sph(.03, dk, s * .12, .205, .19));
    if (o.lid) add(hd, sph(.074, sk, s * .118, .225, .13, 1, .55, 1));
    for (let k = 0; k < 5; k++) add(hd, rot(mesh(new T.ConeGeometry(.016, .05, 5), wh, s * (.14 - k * .013), -.1, .2 + k * .085), PI)); });
  if (o.shades) { const gl = M(o.shades === 1 ? 0x0a0a12 : o.shades, {roughness: .05, metalness: .9, envMap: envTex}); [-1, 1].forEach(s => add(hd, box(.155, .09, .02, gl, s * .118, .2, .215), box(.02, .02, .22, dk, s * .2, .21, .1))); add(hd, box(.1, .02, .02, dk, 0, .22, .215)); }
  const hat = new T.Group(); hat.position.set(0, .26, -.04); hat.rotation.x = -.2; hd.add(hat); const hc = M(o.hatC || 0xd3201f, {roughness: .7}), dome = (r, sy = 1) => { const m = mesh(new T.SphereGeometry(r, 18, 10, 0, PI * 2, 0, PI / 2), hc); m.scale.y = sy; return m; };
  if (o.hat === 'cap') add(hat, dome(.22, .85), box(.3, .02, .24, o.brimC ? M(o.brimC) : hc, 0, .012, .27));
  if (o.hat === 'beanie') add(hat, dome(.235, 1.1), rot(mesh(new T.TorusGeometry(.225, .04, 6, 20), M(o.brimC || 0xffffff), 0, .03, 0), PI / 2), sph(.07, M(o.brimC || 0xffffff), 0, .3, 0));
  if (o.hat === 'helmet') add(hat, dome(.27, .8), rot(mesh(new T.TorusGeometry(.265, .025, 6, 20), hc, 0, .01, 0), PI / 2));
  if (o.hat === 'band') add(hd, rot(mesh(new T.TorusGeometry(.232, .03, 6, 20), hc, 0, .08, -.02), PI / 2 - .25));
  if (o.mullet) { const hr = M(0x6b4423, {roughness: .9}); add(hd, sph(.2, hr, 0, .02, -.16, 1.05, .9, .8), sph(.17, hr, 0, -.24, -.2, 1.1, 1.7, .5)); }
  if (o.chain) add(B, rot(mesh(new T.TorusGeometry(.19, .016, 6, 22), M(0xe2b64a, {metalness: 1, roughness: .25, envMap: envTex}), 0, 1.03, .1), PI / 2 - .5), sph(.05, M(0xe2b64a, {metalness: 1, roughness: .25, envMap: envTex}), 0, .92, .28, 1, 1, .4));
  if (o.goggles) add(hd, box(.36, .1, .03, M(0xffb000, {roughness: .1, metalness: .8, envMap: envTex}), 0, .2, .21), rot(mesh(new T.TorusGeometry(.24, .02, 5, 18), dk, 0, .17, 0), PI / 2));
  const arms = [-1, 1].map(s => { const sl = o.bare ? sk : (o.sleeve ? M(o.sleeve) : top), a = new T.Group(), e = new T.Group(), h = new T.Group(); a.position.set(s * .31, 1.02, 0); e.position.y = -.25; h.position.y = -.29;
    add(a, sph(.1, sl), cap(.075, .2, sl, 0, -.13, 0), e); add(e, sph(.075, sl), cap(.068, .18, o.short ? sk : sl, 0, -.12, 0), sph(.085, sk, 0, -.27, 0), h);
    const p = (s < 0 ? o.armL : o.armR) || [0, .16, -.15]; a.rotation.set(p[0], 0, s * p[1]); e.rotation.x = p[2]; a.userData = {e, h, s, p}; return a; });
  add(B, ...arms);
  const sc1 = (m, s) => { m.scale.setScalar(s); return m; };
  const hold = (i, m, up = true) => { const a = arms[i]; if (up) m.rotation.x = -(a.rotation.x + a.userData.e.rotation.x); a.userData.h.add(m); };
  if (o.prop === 'wine') { const w = new T.Group(); add(w, cyl(.012, .012, .12, GLASS, 0, .06, 0, 6), cyl(.06, .03, .1, M(0x7a0f2a, {roughness: .1, transparent: true, opacity: .9}), 0, .17, 0, 12), cyl(.04, .04, .01, GLASS, 0, 0, 0, 10)); hold(1, w); }
  if (o.prop === 'pizza') { const w = new T.Group(); add(w, box(.44, .05, .44, M(0xe9d7ae), 0, .06, .1), box(.3, .052, .3, M(0xd3201f), 0, .06, .1)); hold(1, w); X.pz = w; }
  if (o.prop === 'case') hold(1, add(new T.Group(), box(.1, .28, .4, M(0x5a3716, {roughness: .5}), 0, -.2, 0), box(.02, .06, .14, dk, 0, -.03, 0)), false);
  if (o.prop === 'bottle') hold(1, add(sc1(new T.Group(), 1.45), cyl(.045, .05, .2, M(0x5a2e0a, {roughness: .2}), 0, -.12, .02, 10), cyl(.018, .03, .1, M(0x5a2e0a, {roughness: .2}), 0, -.27, .02, 8), cyl(.047, .047, .08, M(0xf2e6c4), 0, -.1, .02, 10)), false);
  if (o.smoke) { const c = new T.Group(); add(c, rot(cyl(.017, .017, .2, M(0xffffff), 0, 0, 0, 6), 0, 0, PI / 2), rot(cyl(.018, .018, .06, M(0xd98a3a), .08, 0, 0, 6), 0, 0, PI / 2), sph(.026, glow(0xff5a1a), -.11, 0, 0)); c.position.set(.05, -.04, .07); arms[0].userData.h.add(c); X.cig = c;
    X.puffs = [...Array(12)].map(() => { const m = new T.Mesh(new T.SphereGeometry(.07, 8, 6), new T.MeshBasicMaterial({color: 0xe8e4f0, transparent: true, opacity: 0, depthWrite: false})); m.userData = {a: 9, v: new T.Vector3()}; g.add(m); return m; }); X.pt = 0; X.lt = 0; }
  if (o.prop === 'bell') { const w = new T.Group(); add(w, rot(cyl(.02, .02, .34, CHROME, 0, 0, 0, 8), 0, 0, PI / 2), sph(.09, dk, -.17, 0, 0), sph(.09, dk, .17, 0, 0)); hold(0, w); const w2 = w.clone(); hold(1, w2); }
  if (o.prop === 'rod') { const w = new T.Group(); add(w, rot(cyl(.008, .016, 2.4, M(0x222222), 0, 1.0, .25, 6), .25), cyl(.003, .003, 1.2, M(0xffffff), 0, 1.55, .55, 4), sph(.04, glow(0xff3b3b), 0, .95, .55)); hold(1, w); }
  if (o.prop === 'board') { const b = mesh(new T.CapsuleGeometry(.15, 1.3, 4, 10), M(0xff4fa3, {roughness: .35}), .56, .82, .04); b.scale.set(1, 1, .14); b.rotation.z = -.06; if (o.dance === 'ride') { b.position.set(0, .0, 0); b.rotation.set(PI / 2, 0, PI / 2); bd.add(b); } else B.add(b); }
  if (o.phones) { add(hd, mesh(new T.TorusGeometry(.26, .022, 6, 20, PI), dk, 0, .02, 0)); [-1, 1].forEach(s => add(hd, sph(.085, M(0xff4fa3, {roughness: .4}), s * .25, .02, 0, .5, 1, 1))); }
  if (o.paci) add(hd, sph(.05, glow(0xff8ad1), 0, -.06, .64), sph(.03, glow(0xffffff), 0, -.06, .68));
  if (o.hs) hd.scale.setScalar(o.hs);
  if (o.prop === 'dj') { const dkm = M(0x15121f, {roughness: .4, metalness: .3, envMap: envTex}); add(g, box(1.2, .78, .44, dkm, 0, .39, .56), box(1.24, .04, .48, glow(0xff4fa3), 0, .775, .56), box(.26, .05, .3, M(0x2a2733), 0, .82, .56)); X.discs = [-1, 1].map(s => { const d = new T.Group(); add(d, cyl(.17, .17, .025, M(0x0a0a10, {roughness: .2, metalness: .6, envMap: envTex}), 0, 0, 0, 20), cyl(.055, .055, .03, glow(s < 0 ? 0x19e6d2 : 0xffd166), 0, 0, 0, 10), box(.02, .032, .1, glow(0xffffff), 0, 0, .11)); d.position.set(s * .36, .81, .56); g.add(d); return d; });
    X.bars = [0, 1, 2, 3, 4, 5, 6, 7].map(k => { const ge = new T.BoxGeometry(.09, .5, .02); ge.translate(0, .25, 0); const m = new T.Mesh(ge, glow(k % 2 ? 0x19e6d2 : 0xff4fa3)); m.position.set(-.49 + k * .14, .12, .785); g.add(m); return m; }); [0, 1, 2].forEach(k => add(g, sph(.018, glow(0xffd166), -.08 + k * .08, .85, .6))); }
  if (o.baby) { X.kid = gator({bare: 1, bot: 0xffffff, dance: 'routine', hs: 1.3, paci: 1, scale: .46}); X.kid.position.set(.85, 0, .5); g.add(X.kid); }
  if (o.prop === 'baby') add(B, box(.3, .32, .16, M(0x3a78d6), 0, .82, .3), sph(.1, sk, 0, 1.0, .36), sph(.08, sk, 0, .98, .46, .8, .5, 1.3), sph(.022, dk, -.04, 1.05, .44), sph(.022, dk, .04, 1.05, .44), sph(.03, glow(0xff8ad1), 0, .97, .56));
  if (o.cigar) add(hd, rot(cyl(.018, .018, .16, M(0x6b3a1c), .1, -.06, .68, 6), PI / 2, 0, -.5), sph(.02, glow(0xff7a1a), .14, -.06, .76));
  hd.rotation.y = o.look || 0; const ph = rnd() * 6, sc = o.scale || 1; g.scale.setScalar(sc);
  const arm = (i, sx, sz, ex, ez = 0) => { const a = arms[i], u = a.userData; a.rotation.x = sx; a.rotation.z = u.s * sz; u.e.rotation.x = ex; u.e.rotation.z = u.s * ez; }, lk = o.look || 0;
  // one move each, on the beat (120 bpm): b is radians per beat
  const DANCE = {
    // Nick and the kid: eight moves, four beats each, in sync
    routine: (t, b) => { const bt = b / (PI * 2), sg = Math.floor(bt / 4), u = bt / 4 - sg, s1 = Math.sin(b / 2), bn = Math.abs(s1), sb = Math.sin(b),
        POSE = [
          u => [s1 * .14, -bn * .04, 0, 0, s1 * .06, -.5 + s1 * .3, .3, -.9, -.5 - s1 * .3, .3, -.9, .12, 0, -1.95, s1 * .25],
          u => { const k = .5 + .5 * s1; return [s1 * .06, -bn * .03, 0, 0, -s1 * .1, .1, .75, -1.3, -.4 - 2.2 * k, k - .5, -.1, .14, -.15 * k, -1.95, -s1 * .25]; },
          u => [0, -bn * .05, 0, 0, 0, -2.5, .3, -.9 + bn * .8, -2.5, .3, -.9 + bn * .8, .12, -.2, -1.95, s1 * .25],
          u => [0, Math.sin(Math.min(1, u) * PI) * .08, u >= 1 ? 0 : PI * 2 * ss(.1, .9, u), 0, 0, 0, 1.4, -.1, 0, 1.4, -.1, .1, 0, -1.95, 0],
          u => [-s1 * .1, -bn * .03, 0, 0, s1 * .12, -.6, -s1 * .8, -.5, -.6, s1 * .8, -.5, .14, 0, -1.95, -s1 * .3],
          u => { const k = Math.sin(Math.min(1, u) * PI); return [0, -.22 * k, sb * .1 * k, .25 * k, 0, -.9, .2, -.3, -.9, .2, -.3, .12 + .3 * k, -.1, -1.95, sb * .3]; },
          u => [0, -.07, PI, .85 + sb * .15, 0, -.75, .2, -.15, -.75, .2, -.15, .38, -.75 - sb * .15, -1.35, sb * .4],
          u => [0, bn * .1, PI * (1 - ss(0, .3, u)), 0, 0, -2.6, .5, -.1, -2.6, .5, -.1, .16, -.2, -1.95, s1 * .3]
        ], P = (k, u) => POSE[((k % 8) + 8) % 8](u), a = P(sg, u), z = P(sg - 1, 1), m = ss(0, .16, u), q = a.map((x, i) => z[i] + (x - z[i]) * m);
      bd.position.x = q[0]; bd.position.y = q[1]; bd.rotation.y = q[2]; up.rotation.x = q[3]; up.rotation.z = q[4]; arm(0, q[5], q[6], q[7]); arm(1, q[8], q[9], q[10]); legs.forEach((l, i) => { l.rotation.z = (i ? 1 : -1) * q[11]; }); hd.rotation.x = q[12]; tail.rotation.x = q[13]; tail.rotation.z = q[14]; },
    dj: (t, b) => { bd.position.y = -.03 - Math.cos(b) * .02; hd.rotation.x = .1 + Math.sin(b) * .09; hd.rotation.y = lk + Math.sin(b / 4) * .25; arm(0, 0, 2.0, 0, 1.78); arm(1, -1.0 + Math.sin(b) * .08, .1 + Math.sin(b) * .14, -.45); X.discs[0].rotation.y = b / 2; X.discs[1].rotation.y = Math.sin(b) * .9; X.bars.forEach((m, k) => { m.scale.y = .25 + Math.abs(Math.sin(b / 2 + k * 1.3) * Math.sin(b / 4 + k * .7)) * 1.05; }); },
    pump: (t, b) => { const k = .5 - .5 * Math.cos(b / 2); bd.position.y = -.1 * k; up.rotation.x = .14 * k; legs.forEach((l, i) => { l.rotation.z = (i ? 1 : -1) * (.12 + .2 * k); }); hd.rotation.y = lk + Math.sin(b / 4) * .6; arms.forEach(a => { a.userData.e.rotation.x = a.userData.p[2] + (Math.sin(b / 2 + a.userData.s) * .5 - .5) * .9; }); },
    march: (t, b) => { legs.forEach((l, i) => { l.rotation.x = (i ? 1 : -1) * Math.sin(b / 2) * .55; }); bd.position.y = Math.abs(Math.sin(b / 2)) * .03; arm(0, Math.sin(b / 2) * .55, .15, -.2); arms[1].userData.e.rotation.x = -2.2 + Math.sin(b) * .15; },
    sip: (t, b) => { const u = (b / (PI * 16)) % 1, k = ss(.5, .64, u) * (1 - ss(.88, 1, u)); arm(1, -.5 - .45 * k, .5 - .35 * k, -1.3 - 1.0 * k); arm(0, -.9, .1, -.6 + Math.sin(b / 2) * .3); hd.rotation.x = -.4 * k; bd.rotation.z = Math.sin(b / 2) * .07; },
    floss: (t, b) => { const s = Math.sin(b / 2); bd.position.x = -s * .08; up.rotation.z = s * .1; arm(0, -.4 * s, -s * .65, -.1); arm(1, -.4 * s, s * .65, -.1); hd.rotation.z = -s * .1; },
    ride: (t, b) => { const s = Math.sin(b / 4), c = Math.cos(b / 4); bd.rotation.x = s * .17; bd.rotation.y = c * .22; bd.position.x = Math.sin(b / 8) * .22; bd.position.y = .03; up.rotation.x = .2 + Math.abs(s) * .1; legs.forEach((l, i) => { l.rotation.z = (i ? 1 : -1) * .42; }); arm(0, -.2, 1.15 + s * .3, -.25); arm(1, -.2, 1.15 - s * .3, -.25); hd.rotation.x = -.1; },
    spin: (t, b) => { const s = Math.sin(b / 2); arm(1, -2.95, .12, -.1); X.pz.rotation.x = 3.05; X.pz.rotation.y = b / 2; arm(0, .1, .75, -1.3); bd.position.x = s * .07; up.rotation.z = -s * .09; hd.rotation.x = -.3; },
    thrust: (t, b) => { const k = .5 + .5 * Math.sin(b / 2); bd.rotation.x = -.3 * k; up.rotation.x = .2 * k; arm(0, 0, 2.0, 0, 1.78); arm(1, -.7 + Math.sin(b / 4) * .5, .2, -1.2); },
    // Dean: long pull off the bottle, then a drag, then blows it out. 16 beats
    drunk: (t, b) => { const u = (b / (PI * 32)) % 1, k = ss(.04, .12, u) * (1 - ss(.38, .46, u)), k2 = ss(.52, .6, u) * (1 - ss(.7, .77, u)), ex = u > .77 && u < .93;
      bd.rotation.z = Math.sin(b / 4) * .16; bd.position.x = Math.sin(b / 4) * .1; bd.rotation.x = Math.sin(b / 8) * .07 - k * .12; bd.position.y = Math.abs(Math.sin(b / 2)) * .03;
      arm(1, -.2 - 1.05 * k, .2 - .3 * k, -.15 - 2.0 * k + Math.sin(b) * .06 * k); arm(0, -.1 - 1.0 * k2, .1 - .25 * k2, -.1 - 2.05 * k2); hd.rotation.x = .15 - .6 * k - .1 * k2 + (ex ? -.2 : 0); legs.forEach((l, i) => { l.rotation.z = (i ? 1 : -1) * .12; });
      if (X.puffs) { const dt = Math.min(.1, Math.max(0, t - X.lt)); X.lt = t; X.pt -= dt; if (X.pt <= 0) { const m = X.puffs.find(q => q.userData.a > 1.6); if (m) { const mo = ex || !X.cig, src = mo ? hd : X.cig; m.position.set(mo ? 0 : -.11, mo ? -.04 : 0, mo ? .66 : 0); src.localToWorld(m.position); g.worldToLocal(m.position); m.userData.a = 0; m.userData.s = mo ? 1 : .4; m.userData.v.set((rnd() - .5) * .15, .28 + rnd() * .15, mo ? .5 : .05); } X.pt = ex ? .09 : .45; }
        X.puffs.forEach(m => { const q = m.userData; if (q.a > 1.6) { m.visible = false; return; } q.a += dt; m.visible = true; m.position.addScaledVector(q.v, dt); q.v.z *= .96; m.scale.setScalar((.5 + q.a * 1.5) * q.s); m.material.opacity = .55 * (1 - q.a / 1.6); }); } },
  }[o.dance];
  g.userData.anim = t => { hd.rotation.y = (o.look || 0) + Math.sin(t * .7 + ph) * .16; hd.rotation.z = Math.sin(t * 1.1 + ph) * .05; hd.position.y = 1.33 + Math.sin(t * 2.2 + ph) * .012;
    arms.forEach(a => { const u = a.userData, w = o.wave === u.s ? Math.sin(t * 5) * .25 : 0; a.rotation.x = u.p[0] + Math.sin(t * 1.6 + ph + u.s) * .04; a.rotation.z = u.s * (u.p[1] + w); if (o.curl) u.e.rotation.x = u.p[2] + (Math.sin(t * 2.6 + u.s) * .5 - .5) * o.curl; }); tail.rotation.z = Math.sin(t * 1.3 + ph) * .25; if (DANCE) DANCE(t, BEAT * PI * 2 + (o.bo || 0)); if (X.kid) X.kid.userData.anim(t); };
  g.traverse(m => { if (m.isMesh && m.material.isMeshStandardMaterial) m.castShadow = true; }); return g; }
// Tony's German shorthaired pointer: solid liver head and long drop ears, liver saddle and rump on a ticked coat, deep chest, docked tail. Dances on all fours
function dog() { const g = new T.Group(), d = new T.Group(), LIV = 0x4a2815, tk = ctex(128, 128, (c, W, H) => { c.fillStyle = '#ece5d8'; c.fillRect(0, 0, W, H); seed = 31; c.fillStyle = '#4a2815'; for (let k = 0; k < 900; k++) { c.globalAlpha = .5 + rnd() * .45; c.beginPath(); c.arc(rnd() * W, rnd() * H, .6 + rnd() * 1.6, 0, 7); c.fill(); } }, [2, 2]);
  const w = new T.MeshStandardMaterial({map: tk, roughness: .75}), f = M(LIV, {roughness: .6}), nz = M(0x2a140a, {roughness: .3}), pk = M(0xff4fa3, {roughness: .4}), sg = M(0x0a0a12, {roughness: .05, metalness: .9, envMap: envTex}); g.add(d);
  add(d, rot(cap(.135, .42, w, 0, .53, -.02), PI / 2), sph(.175, w, 0, .5, .2, .88, 1.16, 1), sph(.12, w, 0, .55, -.27, 1, 1, 1), sph(.14, f, 0, .6, -.02, .9, .55, 1.5), sph(.125, f, 0, .585, -.3, 1.02, .9, .8), sph(.08, f, .115, .52, .1, .45, 1, 1.3), sph(.06, f, -.125, .5, -.12, .4, 1, 1.2),
    rot(cap(.075, .2, w, 0, .7, .31), .62), sph(.085, f, 0, .79, .38, 1, 1, 1), rot(mesh(new T.TorusGeometry(.088, .02, 8, 18), pk, 0, .7, .32), -.95), sph(.022, M(0xe2b64a, {metalness: 1, roughness: .3, envMap: envTex}), 0, .64, .4));
  const hg = new T.Group(); hg.position.set(0, .87, .43); add(hg, sph(.105, f, 0, 0, 0, .95, .92, 1.1), rot(cap(.056, .15, f, 0, -.035, .15), PI / 2 + .06), box(.1, .08, .07, f, 0, -.045, .225), sph(.04, nz, 0, -.02, .265, 1.1, .85, .8), sph(.045, f, -.04, -.075, .15, 1, .8, 1.7), sph(.045, f, .04, -.075, .15, 1, .8, 1.7), box(.07, .012, .09, M(0xd96a7a), 0, -.105, .2),
    box(.085, .05, .02, sg, -.052, .035, .1), box(.085, .05, .02, sg, .052, .035, .1), box(.05, .014, .02, sg, 0, .048, .1), box(.012, .014, .13, sg, -.098, .045, .04), box(.012, .014, .13, sg, .098, .045, .04)); d.add(hg);
  const ears = [-1, 1].map(s => { const e = new T.Group(); e.position.set(s * .092, .04, -.03); add(e, sph(.075, f, 0, -.115, 0, .28, 1.65, 1)); e.userData.s = s; hg.add(e); return e; });
  const leg = (x, z, back) => { const l = new T.Group(); l.position.set(x, .42, z); add(l, cyl(.036, .028, .22, w, 0, -.11, 0, 8), cyl(.027, .022, .2, w, 0, -.3, back ? -.02 : 0, 8), sph(.042, w, 0, -.395, .03, 1, .6, 1.4)); if (back) add(l, sph(.075, w, 0, -.04, 0, .7, 1.3, 1.15)); d.add(l); return l; };
  const fl = [-1, 1].map(s => leg(s * .095, .22)), bl = [-1, 1].map(s => leg(s * .1, -.3, 1));
  const tl = new T.Group(); tl.position.set(0, .6, -.45); tl.rotation.x = -1.25; add(tl, cyl(.016, .03, .18, f, 0, .09, 0, 6)); d.add(tl);
  g.userData.anim = t => { const b = BEAT * PI * 2, s = Math.sin(b / 2), hop = Math.abs(s); d.position.y = hop * .045; d.rotation.y = s * .13; d.rotation.z = s * .05; hg.rotation.x = Math.sin(b) * .14; hg.rotation.z = s * .22; ears.forEach(e => { e.rotation.z = e.userData.s * (.12 + hop * .55); });
    fl.forEach((l, i) => { l.rotation.x = -Math.max(0, i ? s : -s) * .9; }); bl.forEach((l, i) => { l.rotation.x = (i ? 1 : -1) * s * .12; }); tl.rotation.z = Math.sin(b) * .55; };
  g.traverse(m => { if (m.isMesh) m.castShadow = true; }); return g; }
// who stands where: [x, y, z, facing, scale] in car space
const GATORS = {
  tony: () => ({g: gator({top: 0xf7f5f0, tee: 0x19c8c0, bot: 0xf7f5f0, shoe: 0xf7f5f0, shades: 1, chain: 1, look: .1, dance: 'dj', prop: 'dj', phones: 1}), p: [.5, 0, 2.2, .85], extra: sp => { const d = dog(); d.position.set(2.35, 0, 2.15); d.rotation.y = 1.7; d.scale.setScalar(1.22); sp.g.add(d); sp.anims.push(d.userData.anim); }}),
  daniel: () => ({g: gator({bare: 1, bot: 0x111111, hat: 'band', hatC: 0xff2d55, prop: 'bell', curl: .9, dance: 'pump', armL: [-.2, 1.2, -1.9], armR: [-.2, 1.2, -1.9], belt: 0xe2b64a, look: .2, scale: 1.05}), p: [.4, 0, 2.2, .85]}),
  reece: () => ({g: gator({top: 0x4b5a2a, bot: 0x2e351f, hat: 'helmet', hatC: 0x3b4a22, shades: 1, armR: [-.3, 1.5, -2.2], armL: [0, .2, -.2], look: .5, dance: 'march'}), p: [.5, 0, 2.3, .85]}),
  nicky: () => ({g: gator({top: 0xff9ecb, tee: 0xffffff, bot: 0xffffff, shades: 0x3a1a4a, prop: 'wine', armR: [-.5, .5, -1.3], armL: [-.9, .1, -.6], look: .7, scale: .9, dance: 'sip'}), p: [.55, 0, 2.2, .85]}),
  ryan: () => ({g: gator({top: 0x2a3550, tee: 0xe9eef5, bot: 0x2a3550, shoe: 0x111111, prop: 'case', look: .3, belt: 0x111111, dance: 'floss'}), p: [.5, 0, 2.2, .85]}),
  sham: () => ({g: gator({top: 0x7a3df0, bot: 0x1b1b22, hat: 'beanie', hatC: 0xffe14a, brimC: 0x7a3df0, goggles: 1, prop: 'board', look: .3, scale: 1.3, dance: 'ride'}), p: [.6, 0, 2.5, .85]}),
  jackson: () => ({g: gator({top: 0xd3201f, bot: 0x1b1b22, hat: 'cap', hatC: 0xd3201f, brimC: 0xffffff, prop: 'pizza', armR: [-.5, .1, -1.3], look: .3, short: 1, dance: 'spin'}), p: [.4, 0, 2.0, .85]}),
  ian: () => ({g: gator({top: 0xb02a2a, bot: 0x3a4a6a, hat: 'cap', hatC: 0x2a5a2a, brimC: 0xf1f1f1, mullet: 1, prop: 'rod', armR: [-.5, .2, -1.2], look: .4, short: 1, dance: 'thrust'}), p: [.5, 0, 2.3, .85]}),
  nick: () => ({g: gator({top: 0x9fc7e8, bot: 0xc9b98a, shoe: 0xffffff, baby: 1, look: .2, short: 1, dance: 'routine'}), p: [.75, 0, 2.2, .85]}),
  dean: () => ({g: gator({top: 0xff7a1a, bot: 0xff7a1a, lid: 1, prop: 'bottle', smoke: 1, look: -.2, armL: [0, .1, -.1], dance: 'drunk'}), p: [.3, 0, 2.2, .7]})
};

// ---------- sets
const gnd = (g, w, d, col, x, z, o) => { const m = new T.Mesh(new T.PlaneGeometry(w, d), M(col, o)); m.rotation.x = -PI / 2; m.position.set(x, .012, z); m.receiveShadow = true; g.add(m); return m; };
const walk = (g, far = 1, near = 1) => { [far && ROADZ - 6.5, near && ROADZ + 6.5].forEach(z => { if (z === 0 || z) { const b = box(S, .18, 3, CONC, 0, .09, z); b.receiveShadow = true; g.add(b); } }); };
const lampP = (g, x, z, col = 0xffd9a0) => add(g, cyl(.06, .09, 5.2, DARK, x, 2.6, z, 8), box(1.0, .07, .07, DARK, x, 5.2, z + .45), sph(.17, glow(col), x, 5.1, z + .9));
function palm(g, x, z, h = 7, lean = .5) { const p = new T.Group(), pts = []; for (let k = 0; k <= 6; k++) { const t = k / 6; pts.push(new T.Vector3(lean * t * t * 1.4, h * t, 0)); }
  add(p, mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 10, .16, 7), PALMT));
  for (let k = 0; k < 9; k++) { const ge = new T.PlaneGeometry(3.0, .8, 7, 2), q = ge.attributes.position; for (let i = 0; i < q.count; i++) { const u = (q.getX(i) + 1.5) / 3, v = q.getY(i) / .4; q.setXYZ(i, u * 2.9, -1.5 * u * u + .25 * u - Math.abs(v) * .22 * (.3 + u), q.getY(i) * (1 - u * .75)); } ge.computeVertexNormals();
    const f = new T.Mesh(ge, PALML); f.position.set(lean * 1.4, h, 0); f.rotation.set(0, k / 9 * PI * 2 + rnd(), .2 + rnd() * .3, 'YZX'); p.add(f); }
  add(p, sph(.14, M(0x5a3a1c), lean * 1.4 + .15, h - .15, .1), sph(.14, M(0x5a3a1c), lean * 1.4 - .1, h - .2, -.12));
  p.position.set(x, 0, z); p.rotation.y = rnd() * 6; p.children[0].castShadow = true; g.add(p); return p; }
let PALMT, PALML;
function bld(g, x, z, w, h, d, wall, o = {}) { const cols = Math.max(2, Math.round(w / 1.7)), rows = Math.max(2, Math.round(h / 2)), cw = 22, rh = 26, lit = o.lit == null ? .45 : o.lit, pal = o.win || ['#ffe7a3', '#ffd27a', '#9fe8ff', '#ff9ed8'], cells = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) cells.push(rnd() < lit ? pick(pal) : null);
  const draw = em => (c, W, H) => { c.fillStyle = em ? '#000' : hex(wall); c.fillRect(0, 0, W, H); cells.forEach((v, k) => { const cc = k % cols, r = Math.floor(k / cols); c.fillStyle = v || (em ? '#000' : '#1c1733'); c.fillRect(cc * cw + 5, r * rh + 6, cw - 10, rh - 12); }); if (!em && o.band) { c.fillStyle = o.band; for (let r = 0; r <= rows; r++) c.fillRect(0, r * rh - 2, W, 4); } };
  const tx = ctex(cols * cw, rows * rh, draw(0)), em = ctex(cols * cw, rows * rh, draw(1)), fm = new T.MeshStandardMaterial({map: tx, emissiveMap: em, emissive: 0xffffff, emissiveIntensity: o.em == null ? 1 : o.em, roughness: .85}), sm = M(wall, {roughness: .9});
  const b = new T.Mesh(new T.BoxGeometry(w, h, d), [fm, sm, sm, sm, fm, sm]); b.position.set(x, h / 2, z); g.add(b);
  if (o.neon) { const n = glow(o.neon); add(g, box(w + .1, .12, .12, n, x, h + .06, z + d / 2), box(.12, h, .12, n, x - w / 2, h / 2, z + d / 2 + .02), box(.12, h, .12, n, x + w / 2, h / 2, z + d / 2 + .02)); if (o.fin) add(g, box(.5, h * .5, .6, M(o.finC || 0xffffff), x, h + h * .2, z + d / 2 - .4), box(.14, h * .5, .1, n, x, h + h * .2, z + d / 2 - .06)); }
  if (o.sign) { const s = sign(o.sign, hex(o.signC || o.neon || 0xff4fa3), o.signH || 2.2, o.font); s.position.set(x + (o.signX || 0), o.signY || h + 1.3, z + d / 2 + .25); g.add(s); }
  return b; }
function fence(g, x, z, w, h = 2.6) { const tx = ctex(64, 64, c => { c.strokeStyle = '#b9bfc9'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(0, 0); c.lineTo(64, 64); c.moveTo(64, 0); c.lineTo(0, 64); c.stroke(); }, [w * 2.4, h * 2.4]); const m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({map: tx, transparent: true, alphaTest: .35, side: T.DoubleSide, color: 0x9aa0ac})); m.position.set(x, h / 2, z); g.add(m);
  for (let k = 0; k <= w / 3; k++) add(g, cyl(.04, .04, h + .2, M(0x8a8f99, {metalness: .6, roughness: .4}), x - w / 2 + k * 3, h / 2, z, 6)); add(g, box(w, .05, .05, M(0x8a8f99), x, h, z)); }
const flamingo = (g, x, z, r = 0) => { const f = new T.Group(), pk = M(0xff6fae, {roughness: .5}); add(f, sph(.2, pk, 0, .78, 0, 1.3, .9, .8), cyl(.012, .012, .7, pk, .04, .35, 0, 5), rot(cyl(.03, .03, .5, pk, .26, 1.02, 0, 6), 0, 0, -.4), sph(.07, pk, .36, 1.28, 0), rot(mesh(new T.ConeGeometry(.03, .14, 6), M(0x222222), .46, 1.24, 0), 0, 0, -2)); f.position.set(x, 0, z); f.rotation.y = r; g.add(f); };
const tree = (g, x, z, h = 4, c = 0x2f7a3a) => add(g, cyl(.14, .2, h * .6, M(0x5a3a1c), x, h * .3, z, 7), sph(h * .32, M(c, {roughness: 1}), x, h * .78, z, 1, .9, 1), sph(h * .22, M(c, {roughness: 1}), x + h * .2, h * .62, z + .2));
const SETS = {
  dean: g => { walk(g); gnd(g, S, 40, 0x201d2a, 0, ROADZ - 28); fence(g, -8, ROADZ - 8.4, 34); lampP(g, -7, ROADZ - 8.2, 0xfff0c0);
    const bd = board('VICE CITY|POLICE IMPOUND', '#0f2a6a', '#ffffff', 4.6, 1.5); bd.position.set(-4.5, 3.4, ROADZ - 8.3); g.add(bd);
    seed = 101; for (let k = 0; k < 9; k++) { const x = -22 + k * 3.6 + rnd() * 1.5, n = 1 + Math.floor(rnd() * 3); for (let j = 0; j < n; j++) add(g, rot(box(3.6, .8, 1.6, M(pick([0x7a2a2a, 0x2a4a7a, 0x8a8a3a, 0x4a4a52, 0x2a6a4a, 0x8a5a2a]), {roughness: .9}), x, .45 + j * .82, ROADZ - 12 - rnd() * 2), 0, rnd() * .3 - .15, 0)); }
    bld(g, -14, ROADZ - 26, 26, 9, 10, 0x2a2733, {lit: .12, win: ['#ffd27a']}); bld(g, 12, ROADZ - 24, 14, 13, 10, 0x33303d, {lit: .15, win: ['#9fe8ff']});
    add(g, box(.5, .16, 1.3, DARK, -12, 2.7, ROADZ - 8.2), box(.4, .2, .5, glow(0xff2030), -12, 2.9, ROADZ - 8.5), box(.4, .2, .5, glow(0x2a6bff), -12, 2.9, ROADZ - 7.9)); },
  nick: g => { walk(g); gnd(g, S, 44, 0x2f7d44, 0, ROADZ - 30, {roughness: 1}); seed = 211;
    [[-15, 0xf6c7d9, 0xb5533c], [-2, 0xbfe6e0, 0x6a4a8a], [12, 0xfbe7a8, 0xb5533c]].forEach(([x, wc, rc]) => { bld(g, x, ROADZ - 17, 9, 4.2, 7, wc, {lit: .6, win: ['#ffe7a3']}); const rf = mesh(new T.ConeGeometry(7.2, 3, 4), M(rc, {roughness: .9}), x, 5.7, ROADZ - 17); rf.rotation.y = PI / 4; rf.scale.set(1, 1, .82); add(g, rf, box(1.1, 2.2, .1, M(0x5a3a1c), x - 1, 1.1, ROADZ - 13.45), box(3.2, 2.4, .1, M(0xf4f1e4), x + 2.4, 1.2, ROADZ - 13.45)); gnd(g, 3.4, 5.6, 0x8d8a92, x + 2.4, ROADZ - 10.7); });
    const pk = ctex(32, 64, c => { c.fillStyle = '#fff'; c.fillRect(10, 8, 12, 56); c.beginPath(); c.moveTo(10, 8); c.lineTo(16, 0); c.lineTo(22, 8); c.fill(); c.fillRect(0, 22, 32, 6); c.fillRect(0, 46, 32, 6); }, [70, 1]); const pf = new T.Mesh(new T.PlaneGeometry(S, 1.1), new T.MeshBasicMaterial({map: pk, transparent: true, alphaTest: .4, side: T.DoubleSide})); pf.position.set(0, .7, ROADZ - 8.3); g.add(pf);
    tree(g, -8.5, ROADZ - 12, 5); tree(g, 6, ROADZ - 13, 4.2, 0x3a8a4a); flamingo(g, -4, ROADZ - 9.6, .6); flamingo(g, -3.2, ROADZ - 10.2, 2); lampP(g, -10, ROADZ - 7.6);
    add(g, cyl(.04, .04, 1.1, DARK, 4.6, .55, ROADZ - 8.6, 6), box(.5, .26, .24, M(0x2a4a9a), 4.6, 1.2, ROADZ - 8.6)); const st = board('FALLOWS CT', '#1f7a3f', '#fff', 1.5, .34, 'Anton'); st.position.set(-10, 3.4, ROADZ - 7.5); g.add(st); },
  ian: g => { gnd(g, S, 6, 0x3a3320, 0, ROADZ - 7.5, {roughness: 1}); gnd(g, S, 6, 0x3a3320, 0, ROADZ + 7.5, {roughness: 1}); const w = gnd(g, S, 70, 0x0d2b24, 0, ROADZ - 45, {roughness: .08, metalness: .7, envMap: envTex, envMapIntensity: .5}); w.position.y = -.05; seed = 307;
    for (let k = 0; k < 13; k++) { const x = -23 + rnd() * 40, z = ROADZ - 12 - rnd() * 26, h = 6 + rnd() * 5, c = M(0x1d3a2a, {roughness: 1}); add(g, cyl(.22, .5, h, M(0x3a2f26), x, h / 2, z, 7), sph(h * .32, c, x, h, z, 1.3, .6, 1.3), sph(h * .22, c, x + 1, h * .86, z + .6, 1.2, .6, 1.2)); for (let j = 0; j < 4; j++) add(g, box(.05, 1 + rnd() * 1.6, .05, M(0x6a7a5a), x - 1.5 + j, h - 1.2, z + rnd())); }
    for (let k = 0; k < 26; k++) { const x = -22 + rnd() * 44, z = ROADZ - 9.6 - rnd() * 2; add(g, cyl(.015, .015, 1.4, M(0x4a6a3a), x, .7, z, 4), cap(.035, .16, M(0x4a2f1a), x, 1.45, z)); }
    bld(g, -9, ROADZ - 12.5, 5, 3, 4, 0x5a4530, {lit: .7, win: ['#ffd27a'], sign: 'BAIT', signC: 0x7dffb0, signH: 1.8, signY: 4.1, font: 'Anton'});
    const ab = new T.Group(); add(ab, box(3.4, .3, 1.7, M(0xc9ccd2, {metalness: .5, roughness: .4}), 0, .2, 0), rot(mesh(new T.TorusGeometry(.9, .05, 6, 22), DARK, -1.3, 1.4, 0), 0, PI / 2, 0), box(.06, 1.7, .16, DARK, -1.3, 1.4, 0), box(.5, .5, .5, M(0x8a2a2a), .2, .6, 0)); ab.position.set(2, 0, ROADZ - 16); ab.rotation.y = -.5; g.add(ab);
    const xs = ctex(128, 128, c => { c.translate(64, 64); c.rotate(PI / 4); c.fillStyle = '#ffd400'; c.fillRect(-44, -44, 88, 88); c.strokeStyle = '#111'; c.lineWidth = 4; c.strokeRect(-40, -40, 80, 80); c.rotate(-PI / 4); c.fillStyle = '#111'; c.font = '900 20px Arial'; c.textAlign = 'center'; c.fillText('GATOR', 0, -2); c.fillText('XING', 0, 22); }); const xg = new T.Mesh(new T.PlaneGeometry(1.5, 1.5), new T.MeshBasicMaterial({map: xs, transparent: true, side: T.DoubleSide})); xg.position.set(-4.5, 2.6, ROADZ - 6.2); add(g, xg, cyl(.04, .04, 2.2, DARK, -4.5, 1.1, ROADZ - 6.22, 6));
    const n = 40, fp = new Float32Array(n * 3); for (let k = 0; k < n; k++) { fp[k * 3] = -20 + rnd() * 36; fp[k * 3 + 1] = .6 + rnd() * 4; fp[k * 3 + 2] = ROADZ - 7 - rnd() * 16; } const fg = new T.BufferGeometry(); fg.setAttribute('position', new T.BufferAttribute(fp, 3)); const ff = new T.Points(fg, new T.PointsMaterial({color: 0xd8ff6a, size: .14, transparent: true, toneMapped: false})); g.add(ff); return t => { ff.material.opacity = .55 + Math.sin(t * 3) * .4; ff.position.y = Math.sin(t * .6) * .3; }; },
  jackson: g => { walk(g); gnd(g, S, 12, 0x24212e, 0, ROADZ - 14); seed = 401; bld(g, -8, ROADZ - 24, 30, 5, 8, 0xf1e3c6, {lit: .9, win: ['#fff0b8', '#ffe7a3'], neon: 0xff3b3b});
    const aw = ctex(64, 16, c => { for (let k = 0; k < 8; k++) { c.fillStyle = k % 2 ? '#fff' : '#d3201f'; c.fillRect(k * 8, 0, 8, 16); } }, [5, 1]); add(g, rot(mesh(new T.BoxGeometry(12, .08, 2), new T.MeshStandardMaterial({map: aw, roughness: .8}), -3, 3.3, ROADZ - 19.2), .3));
    [['Slice Masters', 0xff3b3b, -3, 6.6, 3.2, 'Mr Dafoe'], ['PIZZA', 0xffe14a, -3, 4.6, 1.6, 'Anton'], ['DONUTS', 0xff7ad9, -17, 5.9, 2.2, 'Anton'], ['OPEN 24/7', 0x19e6d2, 6.5, 4.4, 1.3, 'Anton']].forEach(([t, c, x, y, h, f]) => { const s = sign(t, hex(c), h, f); s.position.set(x, y, ROADZ - 19.7); g.add(s); });
    const eb = sph(1.5, M(0x0c0c10, {roughness: .12, metalness: .3, envMap: envTex}), 5, 6.5, ROADZ - 23); const e8 = board('8', '#ffffff', '#111', 1.1, 1.1); e8.position.set(5.5, 6.7, ROADZ - 21.6); e8.rotation.y = .35; add(g, eb, e8); palm(g, -20, ROADZ - 9.5, 7); palm(g, 10, ROADZ - 9.5, 6.4, -.4); lampP(g, -12, ROADZ - 7.6, 0xffb0d0);
    [-9, -6, -3, 0].forEach(x => add(g, box(.12, .012, 4, M(0xf1f1f1), x, .02, ROADZ - 13))); },
  sham: g => { walk(g); gnd(g, S, 40, 0x2a2733, 0, ROADZ - 28); seed = 503; const dome = mesh(new T.SphereGeometry(13, 28, 14, 0, PI * 2, 0, PI / 2), M(0xeaf6ff, {roughness: .35, metalness: .2, envMap: envTex, envMapIntensity: .6}), -9, 0, ROADZ - 27); g.add(dome);
    add(g, box(6, 4, 1, M(0x1b2a4a), -6, 2, ROADZ - 14.2), box(4, 2.6, .2, glow(0x9fe8ff), -6, 1.5, ROADZ - 13.6)); const s1 = sign('Snow Dome', '#9fe8ff', 3.4); s1.position.set(-6, 6.2, ROADZ - 14); const s2 = sign('REAL* SNOW', '#ffffff', 1.3, 'Anton'); s2.position.set(-6, 4.5, ROADZ - 13.6); add(g, s1, s2);
    for (let k = 0; k < 7; k++) add(g, sph(1 + rnd() * 1.2, M(0xffffff, {roughness: .6}), -13 + k * 2.4 + rnd(), .1, ROADZ - 10.5 - rnd() * 2, 1.4, .5, 1));
    [[-17, 7.5], [4, 6.6], [11, 7.2]].forEach(([x, h]) => { const p = palm(g, x, ROADZ - 9.4, h, .4); p.add(sph(.9, M(0xffffff, {roughness: .6}), .56, h + .2, 0, 1.3, .35, 1.3)); }); bld(g, 12, ROADZ - 22, 10, 16, 9, 0x3a3560, {lit: .4, neon: 0x19e6d2}); lampP(g, -12, ROADZ - 7.6, 0xbfe8ff);
    const n = 260, fp = new Float32Array(n * 3); for (let k = 0; k < n; k++) { fp[k * 3] = -16 + rnd() * 30; fp[k * 3 + 1] = rnd() * 12; fp[k * 3 + 2] = ROADZ - 12 + rnd() * 18; } const fg = new T.BufferGeometry(); fg.setAttribute('position', new T.BufferAttribute(fp, 3)); const sn = new T.Points(fg, new T.PointsMaterial({color: 0xffffff, size: .09, transparent: true, opacity: .9})); g.add(sn);
    return (t, dt) => { const p = fg.attributes.position; for (let k = 0; k < n; k++) { let y = p.getY(k) - dt * 1.3; if (y < 0) y = 12; p.setY(k, y); } p.needsUpdate = true; }; },
  ryan: g => { walk(g); gnd(g, S, 40, 0x24212e, 0, ROADZ - 28); seed = 601;
    [[-20, 9, 34, 0x1d2a4a], [-9, 11, 46, 0x16203a], [4, 10, 30, 0x24345a], [15, 9, 40, 0x1a2540]].forEach(([x, w, h, c], k) => bld(g, x, ROADZ - 16 - (k % 2) * 4, w, h, 9, c, {lit: .55, win: ['#bfe8ff', '#ffe7a3', '#8fc7ff'], neon: k === 1 ? 0x19e6d2 : 0, band: '#0d1326'}));
    const s = sign('SEEBERGER CAPITAL', '#19e6d2', 1.9, 'Anton'); s.position.set(-9, 6.4, ROADZ - 11.2); g.add(s); const s2 = board('NOW LEASING', '#ffffff', '#16203a', 3.4, .8); s2.position.set(4, 3.2, ROADZ - 11.4); g.add(s2);
    palm(g, -15, ROADZ - 9.4, 7.5); palm(g, -2, ROADZ - 9.4, 6.8, -.3); lampP(g, -8, ROADZ - 7.6); lampP(g, 8, ROADZ - 7.6); [-12, -5, 2].forEach(x => add(g, cyl(.04, .04, 1.1, DARK, x, .7, ROADZ - 5.4, 6), box(.16, .28, .12, M(0x8a8f99, {metalness: .7, roughness: .3}), x, 1.3, ROADZ - 5.4))); },
  nicky: g => { walk(g); gnd(g, S, 44, 0x2f8a4a, 0, ROADZ - 30, {roughness: 1}); seed = 701; const wm = M(0xfdf8ee, {roughness: .7}), rf = M(0xc2543a, {roughness: .8});
    bld(g, -8, ROADZ - 24, 22, 8, 9, 0xfdf8ee, {lit: .75, win: ['#ffe7a3', '#ffd27a']}); add(g, box(23.4, .5, 10.4, rf, -8, 8.25, ROADZ - 24), box(10, 6.4, 3, wm, -8, 3.2, ROADZ - 18.4), box(11, .5, 4, rf, -8, 6.6, ROADZ - 18.2));
    for (let k = 0; k < 5; k++) add(g, cyl(.32, .36, 6, wm, -12 + k * 2, 3, ROADZ - 16.6, 14)); add(g, box(2, 3.6, .2, M(0x5a3a1c), -8, 1.8, ROADZ - 16.9));
    for (let k = 0; k < 2; k++) add(g, box(14, 1.2, 1.2, M(0x1f5a2f, {roughness: 1}), -20 + k * 24, .6, ROADZ - 9.2));
    add(g, cyl(1.8, 2, .5, wm, -8, .25, ROADZ - 11.5, 20), cyl(.25, .4, 1.6, wm, -8, 1.0, ROADZ - 11.5, 10), cyl(.9, .2, .25, wm, -8, 1.8, ROADZ - 11.5, 16), cyl(1.6, 1.6, .1, M(0x4ac6e0, {roughness: .05, metalness: .5, envMap: envTex}), -8, .5, ROADZ - 11.5, 20));
    [-1, 1].forEach(s => add(g, box(.8, 3.2, .8, wm, -8 + s * 4.5, 1.6, ROADZ - 8.6), sph(.4, glow(0xffe9a0), -8 + s * 4.5, 3.5, ROADZ - 8.6)));
    const sg = sign('Casa Wolson', '#ffd166', 2.4); sg.position.set(-8, 10.4, ROADZ - 19); g.add(sg); palm(g, -18, ROADZ - 13, 9); palm(g, 3, ROADZ - 13, 8.4, -.5); palm(g, 9, ROADZ - 16, 10); flamingo(g, -3, ROADZ - 10.3, 1); flamingo(g, -13.5, ROADZ - 10.6, 2.4); },
  reece: g => { gnd(g, S, 60, 0x2b2933, 0, ROADZ - 37); walk(g, 0, 1); fence(g, -6, ROADZ - 7, S - 2, 2.4); seed = 801;
    add(g, cyl(1.5, 2.1, 17, M(0xe9e4dc, {roughness: .8}), -11, 8.5, ROADZ - 24, 14), cyl(3.4, 2.4, 2.6, M(0x16243a, {roughness: .1, metalness: .8, envMap: envTex}), -11, 18.2, ROADZ - 24, 14), cyl(3.6, 3.6, .4, M(0xe9e4dc), -11, 19.7, ROADZ - 24, 14), cyl(.05, .05, 3, DARK, -11, 21.4, ROADZ - 24, 5), sph(.3, glow(0xff2030), -11, 23, ROADZ - 24));
    bld(g, 9, ROADZ - 30, 26, 7, 10, 0xd9e2ea, {lit: .7, win: ['#9fe8ff', '#ffe7a3']}); const s = sign('ESCOBAR INTERNATIONAL', '#ff4fa3', 2.1, 'Anton'); s.position.set(9, 8.4, ROADZ - 24.6); g.add(s);
    const pl = new T.Group(), wt = M(0xf2f4f7, {roughness: .35, metalness: .3, envMap: envTex}); add(pl, rot(cap(1.5, 15, wt, 0, 3, 0), 0, 0, PI / 2), rot(box(3.6, .25, 17, wt, .5, 2.6, 0), 0, .25, 0), rot(box(2.6, 4.2, .25, M(0xff4fa3), -7.6, 5.8, 0), 0, 0, .5), box(2, .2, 6, wt, -7.8, 3.8, 0), cyl(.9, .9, 2.4, DARK, 1.5, 1.7, 5, 12), cyl(.9, .9, 2.4, DARK, 1.5, 1.7, -5, 12)); pl.children[4].rotation.z = PI / 2; pl.children[5].rotation.z = PI / 2; pl.position.set(-3, 0, ROADZ - 16); pl.rotation.y = .5; g.add(pl);
    for (let k = 0; k < 14; k++) add(g, sph(.12, glow(k % 2 ? 0x4aa3ff : 0xffb84a), -22 + k * 3.2, .15, ROADZ - 9.5)); },
  daniel: g => { walk(g); gnd(g, S, 26, 0xe6cf9c, 0, ROADZ - 21, {roughness: 1}); const w = gnd(g, S + 60, 160, 0x1d5a7a, 0, ROADZ - 113, {roughness: .1, metalness: .6, envMap: envTex, envMapIntensity: .9}); seed = 901;
    const lg = new T.Group(); add(lg, box(3, 2.2, 3, M(0xff9ecb, {roughness: .7}), 0, 3.6, 0), box(3.6, .2, 3.8, M(0x19c8c0), 0, 4.8, 0), box(3.6, .16, 3.6, M(0xffffff), 0, 2.45, 0), box(.5, .9, .05, M(0xff3b3b), 0, 3.9, 1.53)); [[-1.3, -1.3], [1.3, -1.3], [-1.3, 1.3], [1.3, 1.3]].forEach(([x, z]) => add(lg, cyl(.1, .1, 2.5, M(0xffffff), x, 1.25, z, 6))); add(lg, rot(box(.9, .1, 3, M(0xffffff), 0, 1.2, 2.9), -.7)); lg.position.set(-13, 0, ROADZ - 16); lg.rotation.y = .4; g.add(lg);
    const ir = M(0x8a8f99, {metalness: .9, roughness: .3, envMap: envTex}); add(g, cyl(.06, .06, 2.6, ir, -5, 1.3, ROADZ - 11, 6), cyl(.06, .06, 2.6, ir, -2, 1.3, ROADZ - 11, 6), rot(cyl(.05, .05, 3.2, ir, -3.5, 2.6, ROADZ - 11, 6), 0, 0, PI / 2), box(1.6, .14, .5, M(0x1b1b22), 2, .55, ROADZ - 11), cyl(.04, .04, .5, ir, 1.4, .27, ROADZ - 11, 5), cyl(.04, .04, .5, ir, 2.6, .27, ROADZ - 11, 5), rot(cyl(.03, .03, 2, ir, 2, 1.1, ROADZ - 11, 6), PI / 2), rot(cyl(.28, .28, .1, DARK, 2, 1.1, ROADZ - 10.1, 14), PI / 2), rot(cyl(.28, .28, .1, DARK, 2, 1.1, ROADZ - 11.9, 14), PI / 2));
    const s = sign('Muscle Beach', '#ff4fa3', 3.2); s.position.set(-3, 4.6, ROADZ - 11.2); g.add(s); [[-20, 8], [-9, 9.5, -.5], [6, 8.4], [13, 9.2, -.4]].forEach(([x, h, l]) => palm(g, x, ROADZ - 9.6 - rnd() * 3, h, l || .5)); },
  tony: g => { walk(g); gnd(g, S, 30, 0x2a2733, 0, ROADZ - 23); seed = 1001;
    [[-19, 8, 13, 0xff9ecb, 0x19e6d2, 'Hotel Gator'], [-10, 8, 16, 0x9ff0e4, 0xff4fa3, 'Club Tails'], [-1, 8, 11, 0xfff1a8, 0xff4fa3, 'Pots & Pans'], [8.5, 9, 15, 0xf7f5f0, 0x19e6d2, 'The Burrow'], [18, 8, 12, 0xc9b6ff, 0xffd166, '']].forEach(([x, w, h, c, n, t], k) => bld(g, x, ROADZ - 14.5, w, h, 8, c, {lit: .6, neon: n, fin: k % 2 === 1, finC: c, band: '#ffffff', sign: t, signC: n, signH: 2.3, signY: k % 2 ? h * .5 : h + 1.2}));
    [-22, -14.5, -5.5, 3.5, 13].forEach((x, k) => palm(g, x, ROADZ - 8.6, 7.5 + (k % 2) * 1.4, k % 2 ? -.5 : .5)); lampP(g, -9, ROADZ - 7.6, 0xff9ed8); lampP(g, 7, ROADZ - 7.6, 0x9ff0e4); },
  crew: g => { const fl = gnd(g, 44, 40, 0x1c1236, 0, -4, {roughness: .22, metalness: .35, envMap: envTex, envMapIntensity: .7}); fl.position.y = .08; seed = 1101;
    const s1 = sign('Gator Tails', '#ff4fa3', 3.6); s1.position.set(0, 8.6, -19.5); const s2 = sign('VICE CITY', '#19e6d2', 1.5, 'Anton'); s2.position.set(0, 6.1, -19.4); add(g, s1, s2);
    bld(g, -15.5, -24, 11, 15, 8, 0xff9ecb, {lit: .6, neon: 0x19e6d2, band: '#ffffff'}); bld(g, 0, -27, 16, 11, 8, 0xf7f5f0, {lit: .6, neon: 0xff4fa3, band: '#ffffff'}); bld(g, 15.5, -24, 11, 17, 8, 0x9ff0e4, {lit: .6, neon: 0xffd166, band: '#ffffff'});
    [-13, -8.5, 8.5, 13].forEach((x, k) => palm(g, x, -15.5 - (k % 2), 8 + (k % 2) * 1.5, x < 0 ? .5 : -.5));
    const a = spots2(g, [[-11, -18], [0, -21], [11, -18]]), b = moneyRain(g, 0, -1, 110); return (t, dt) => { a(t); b(t, dt); }; }
};

// the two openers. Nobody's car, just the city: the strip on a night out (cover) and South Beach after dark (intro)
const hang = (g, an, o, x, z, ry, y = .1) => { const q = gator(o); q.position.set(x, y, z); q.rotation.y = ry; g.add(q); an.push(q.userData.anim); return q; };
const torch = (g, x, z, y = .08) => { const fl = sph(.11, glow(0xffb040), x, y + 1.95, z, 1, 1.5, 1), h = halo(0xff8a3a, 2.2, x, y + 2, z, .55); add(g, cyl(.035, .045, 1.8, M(0x5a3716), x, y + .9, z, 6), cyl(.09, .05, .16, M(0x3a2410), x, y + 1.82, z, 8), fl, h); return t => { const k = 1 + Math.sin(t * 11 + x) * .18; fl.scale.set(k, 1.5 * k, k); h.material.opacity = .45 + Math.sin(t * 9 + x * 2) * .12; }; };
SETS.beach = g => { const an = [], Y = .08; seed = 4242; gnd(g, 90, 48, 0x7d6a55, 0, 2, {roughness: 1}).position.y = Y;
  gnd(g, 500, 300, 0x0b1c44, 0, -162, {roughness: .1, metalness: .75, envMap: envTex, envMapIntensity: 1}).position.y = Y + .03;
  const streak = new T.Mesh(new T.PlaneGeometry(2.6, 90), glow(0xcfeaff, {transparent: true, opacity: .13, depthWrite: false, blending: T.AdditiveBlending, fog: false})); streak.rotation.x = -PI / 2; streak.position.set(0, Y + .06, -60); g.add(streak);
  const foam = [0, 1, 2].map(k => { const m = box(90, .02, .3 + k * .12, glow(0xe6f6ff, {transparent: true, opacity: .5, depthWrite: false}), 0, Y + .05, -12); g.add(m); return m; });
  an.push(t => foam.forEach((m, k) => { const u = (t * .16 + k / 3) % 1; m.position.z = -15.5 + u * 4.2; m.material.opacity = .55 * Math.sin(u * PI); }));
  // bonfire
  const fx = 0, fz = -1, wood = M(0x3a2410, {roughness: 1}), fl = [[.3, .95, 0xff5a1a], [.21, .72, 0xffa030], [.12, .5, 0xffe27a]].map(([r, h, c], k) => { const m = mesh(new T.ConeGeometry(r, h, 8), glow(c), fx, Y + .12 + h / 2, fz); g.add(m); return m; });
  for (let k = 0; k < 5; k++) add(g, rot(cyl(.07, .07, .9, wood, fx, Y + .1, fz, 6), PI / 2, k * 1.26, 0)); for (let k = 0; k < 9; k++) add(g, sph(.11, M(0x6a6470, {roughness: 1}), fx + Math.cos(k * .7) * .62, Y + .05, fz + Math.sin(k * .7) * .62));
  const fh = halo(0xff8a3a, 5, fx, Y + .7, fz, .5); g.add(fh); const sparks = [0, 1, 2, 3, 4, 5, 6].map(k => { const s = halo(0xffc060, .16, fx, 0, fz, .9); s.userData.o = k / 7; g.add(s); return s; });
  an.push(t => { fl.forEach((m, k) => { const s = 1 + Math.sin(t * (9 + k * 3) + k) * .16; m.scale.set(1 + Math.sin(t * 7 + k * 2) * .1, s, 1); m.position.x = fx + Math.sin(t * 5 + k) * .03; }); fh.material.opacity = .42 + Math.sin(t * 8) * .08; sparks.forEach(s => { const u = (t * .45 + s.userData.o) % 1; s.position.set(fx + Math.sin(u * 9 + s.userData.o * 30) * .3, Y + .6 + u * 3.2, fz + Math.cos(u * 7 + s.userData.o * 12) * .3); s.material.opacity = .9 * (1 - u); }); });
  [[-5.6, -5.4], [5.6, -5.2], [-7.2, 2.2], [7.2, 2.4]].forEach(([x, z]) => an.push(torch(g, x, z, Y)));
  // lifeguard stand, umbrellas, towels, cooler, boombox
  const lx = -6.6, lz = -8.2, wt = M(0xfdf8ee, {roughness: .7}); [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => add(g, cyl(.07, .07, 1.5, wt, lx + a * .85, Y + .75, lz + b * .7, 6)));
  add(g, box(2.2, .1, 1.9, wt, lx, Y + 1.5, lz), box(1.9, 1.3, 1.4, M(0xff9ecb, {roughness: .6}), lx, Y + 2.2, lz - .15), box(2.4, .12, 2.0, M(0x19e6d2, {roughness: .5}), lx, Y + 2.92, lz), box(1.9, .32, .06, M(0xffd166), lx, Y + 2.0, lz + .86), box(.7, .9, .05, M(0x19e6d2), lx, Y + 2.1, lz + .57), rot(box(.5, 1.9, .06, wt, lx + 1.25, Y + .75, lz + .4), 0, 0, -.9));
  [[-5.4, -3.2, 0xff4fa3], [5.9, -3.6, 0x19e6d2], [-8.6, -1.2, 0xffd166]].forEach(([x, z, c], k) => { const u = mesh(new T.ConeGeometry(1.25, .5, 10), M(c, {roughness: .7, side: T.DoubleSide}), x, Y + 2.1, z); add(g, cyl(.03, .03, 2.1, wt, x, Y + 1.05, z, 6), u, sph(.06, wt, x, Y + 2.38, z), box(.95, .03, 1.9, M([0x19e6d2, 0xff4fa3, 0xffffff][k], {roughness: .9}), x + .15, Y + .02, z + .5)); });
  add(g, box(.7, .42, .42, M(0xd3201f, {roughness: .5}), 2.7, Y + .21, .9), box(.72, .08, .44, wt, 2.7, Y + .46, .9), box(.8, .44, .24, DARK, -2.9, Y + .22, .7), sph(.13, glow(0xff4fa3), -3.12, Y + .22, .83, 1, 1, .2), sph(.13, glow(0x19e6d2), -2.68, Y + .22, .83, 1, 1, .2));
  // palms with string lights, hotels down the sand
  palm(g, -9.5, -9.5, 8.5, .6); palm(g, 9.5, -9, 9, -.6); palm(g, -12, 3, 7.5, .5); palm(g, 12, 2.5, 8, -.5);
  for (let k = 0; k <= 16; k++) { const u = k / 16; g.add(halo([0xffd166, 0xff4fa3, 0x19e6d2][k % 3], .55, -8.6 + u * 17.2, 7.4 - Math.sin(u * PI) * 1.5, -9.2, .95)); }
  bld(g, -21, -5, 9, 15, 8, 0xff9ecb, {lit: .65, neon: 0x19e6d2, band: '#ffffff'}); bld(g, 21, -5, 9, 13, 8, 0x9ff0e4, {lit: .65, neon: 0xff4fa3, band: '#ffffff'});
  // the locals
  hang(g, an, {bare: 1, bot: 0xff4fa3, shades: 1, dance: 'floss', look: .3}, -1.9, .6, 1.0, Y);
  hang(g, an, {top: 0xffffff, bot: 0x19e6d2, prop: 'wine', hat: 'band', hatC: 0xff4fa3, dance: 'sip', look: -.3}, 2.0, .3, -1.0, Y);
  hang(g, an, {top: 0xffd166, bot: 0x3a78d6, lid: 1, prop: 'bottle', smoke: 1, dance: 'drunk'}, -3.6, -1.9, .7, Y);
  hang(g, an, {bare: 1, bot: 0x9b5cff, chain: 1, dance: 'thrust'}, 3.6, -2.2, -.6, Y);
  hang(g, an, {top: 0x9b5cff, bot: 0xffffff, shades: 0xff4fa3, dance: 'routine', scale: 1.05}, 1.7, 3.6, -.2, Y);
  hang(g, an, {top: 0x19e6d2, bot: 0xff7a1a, hat: 'cap', hatC: 0xff4fa3, dance: 'pump', armL: [0, .5, -1.2], armR: [0, .5, -1.2]}, -4.4, 3.0, .35, Y);
  hang(g, an, {bare: 1, bot: 0xff7a1a, mullet: 1, dance: 'floss', bo: PI}, 4.5, 3.2, -.35, Y);
  const lay = hang(g, an, {bare: 1, bot: 0xd3201f, shades: 1}, -5.25, -1.9, 0, Y + .3); lay.rotation.x = -PI / 2;
  hang(g, an, {top: 0xff9ecb, bot: 0xffffff, look: .5}, -1.0, -10.6, PI - .15, Y); hang(g, an, {top: 0x19e6d2, bot: 0x1a1030, look: -.5}, -.1, -10.6, PI + .15, Y);
  const ball = sph(.34, M(0xff4fa3, {roughness: .4}), 0, 0, 3.2), bs = sph(.345, M(0xffffff, {roughness: .4}), 0, 0, 3.2, 1, .34, 1); add(g, ball, bs);
  an.push(t => { ball.position.set(Math.sin(t * .8) * 4.2, Y + 1.5 + Math.abs(Math.cos(t * .8)) * 2.3, 3.2); bs.position.copy(ball.position); bs.rotation.set(t * 2, 0, t * 1.3); });
  // fireworks over the water
  const FC = [0xff4fa3, 0x19e6d2, 0xffd166, 0xffffff, 0x9b5cff], dirs = []; for (let j = 0; j < 20; j++) { const a = rnd() * PI * 2, e = (rnd() - .5) * PI; dirs.push([Math.cos(a) * Math.cos(e), Math.sin(e), Math.sin(a) * Math.cos(e) * .3]); }
  [0, 1, 2].forEach(k => { const ps = dirs.map(() => { const s = halo(0xffffff, 1.5, 0, 0, 0, 0); s.material.fog = false; g.add(s); return s; }), fh = halo(0xffffff, 26, 0, 0, -64, 0); fh.material.fog = false; g.add(fh);
    an.push(t => { const c = t / 3.4 + k / 3, n = Math.floor(c), u = c - n, cx = Math.sin(n * 12.9 + k * 4) * 15, cy = 9.5 + (Math.sin(n * 7.3 + k * 2) * .5 + .5) * 4, col = FC[(n + k * 2) % 5];
      if (u < .22) { ps.forEach((s, j) => { s.material.opacity = j ? 0 : .9; }); ps[0].material.color.setHex(0xffe9a0); ps[0].scale.setScalar(.7); ps[0].position.set(cx, Y + (cy - Y) * (u / .22), -62); fh.material.opacity = 0; return; }
      const w = (u - .22) / .78, r = 5.2 * (1 - (1 - w) * (1 - w)); ps.forEach((s, j) => { const d = dirs[j]; s.material.color.setHex(col); s.scale.setScalar(1.5 - w * .6); s.material.opacity = (1 - w) * (.75 + .25 * Math.sin(t * 30 + j)); s.position.set(cx + d[0] * r, cy + d[1] * r - w * w * 2.2, -62 + d[2] * r); });
      fh.material.color.setHex(col); fh.position.set(cx, cy, -64); fh.material.opacity = .3 * (1 - w) * (1 - w); }); });
  // party yacht cruising by
  const yt = new T.Group(), yw = M(0xfdf8ee, {roughness: .4}); add(yt, box(8, 1.0, 2.2, yw, 0, .5, 0), box(1.6, .8, 1.6, yw, -4.3, .6, 0), box(4.2, .9, 1.7, yw, .6, 1.45, 0), box(4.0, .3, 1.72, glow(0xffd166), .6, 1.5, 0), box(2.0, .7, 1.3, yw, 1.2, 2.25, 0), box(1.9, .22, 1.32, glow(0x19e6d2), 1.2, 2.3, 0), halo(0xff4fa3, 9, 0, .2, 0, .5));
  for (let k = 0; k < 7; k++) yt.add(halo([0xff4fa3, 0xffd166, 0x19e6d2][k % 3], .9, -3.6 + k * 1.2, 3.1 - Math.abs(k - 3) * .25, 0, 1)); yt.position.z = -36; g.add(yt);
  an.push(t => { yt.position.x = (((t * .022 + .32) % 1) - .5) * 110; yt.position.y = Y + Math.sin(t * 1.3) * .06; yt.rotation.z = Math.sin(t * 1.1) * .012; });
  // conga line down the shoreline
  const cg = new T.Group(); [[0xff4fa3, 0xffffff], [0xffd166, 0x19e6d2], [0x19e6d2, 0xff7a1a], [0xffffff, 0x9b5cff], [0x9b5cff, 0xffd166]].forEach(([a, b], k) => { const q = gator({top: a, bot: b, dance: 'march', scale: .92, armL: [0, .2, -1.3], armR: [0, .2, -1.3], hat: k ? 0 : 'band', hatC: 0xffd166}); q.position.x = -k * 1.25; q.rotation.y = PI / 2; cg.add(q); an.push(q.userData.anim); });
  cg.position.set(0, Y, -7.6); g.add(cg); an.push(t => { cg.position.x = (((t * .03 + .45) % 1) - .5) * 44 + 3; });
  // crab
  const cr = new T.Group(), cm = M(0xe0402a, {roughness: .5}); add(cr, sph(.17, cm, 0, .14, 0, 1.4, .6, 1), sph(.08, cm, -.26, .2, .1), sph(.08, cm, .26, .2, .1), sph(.035, DARK, -.07, .27, .1), sph(.035, DARK, .07, .27, .1)); cr.position.set(0, Y, 4.6); g.add(cr);
  an.push(t => { cr.position.x = Math.sin(t * .45) * 3.4; cr.position.y = Y + Math.abs(Math.sin(t * 9)) * .03; cr.rotation.y = Math.sin(t * .45 + PI / 2) * .3; });
  const bb = [halo(0xff4fa3, 1.3, -3.12, Y + .25, .9, .5), halo(0x19e6d2, 1.3, -2.68, Y + .25, .9, .5)]; bb.forEach(h => g.add(h)); an.push(() => { const k = Math.pow(Math.max(0, Math.cos(BEAT * PI * 2)), 3); bb.forEach(h => { h.material.opacity = .2 + k * .7; h.scale.setScalar(1 + k * .8); }); });
  return (t, dt) => an.forEach(f => f(t, dt)); };
SETS.strip = g => { const an = [], rough = {roughness: .85}; seed = 5151;
  gnd(g, 320, 220, 0x2a2238, 0, 0, rough).position.y = -.04; gnd(g, 130, 12, 0x4a3a5a, 0, -13, rough).position.y = .16; add(g, box(130, .18, .3, CONC, 0, .08, -7.1)); gnd(g, 130, 24, 0x3a2c4c, 0, 15, rough).position.y = .1;
  // low deco hotels so the sun sits on the rooftops
  [[-45, 6, 0x9ff0e4, 0xff4fa3], [-34, 7, 0xff9ecb, 0x19e6d2], [-23, 5.5, 0xffd9a0, 0xff4fa3], [-12, 6.5, 0x9ff0e4, 0xffd166], [0, 8, 0xf7f5f0, 0xff4fa3], [12, 6, 0xff9ecb, 0x19e6d2], [23, 7, 0xffd9a0, 0x19e6d2], [34, 5.5, 0x9ff0e4, 0xff4fa3], [45, 6.5, 0xff9ecb, 0xffd166]].forEach(([x, h, c, n]) => bld(g, x, -19, 10.4, h, 6, c, {lit: .6, neon: n, band: '#ffffff'}));
  const S1 = (txt, col, h, x, y, font) => { const s = sign(txt, col, h, font); s.position.set(x, y, -15.9); g.add(s); return s; };
  const club = S1('Club Gator', '#ff4fa3', 2.3, 0, 6.2), ol = S1('OPEN LATE', '#19e6d2', .8, 0, 4.5, 'Anton'); S1('Big Penis Lounge', '#ffd166', 1.5, 12, 4.4); S1('Tail', '#19e6d2', 2.0, -12, 4.6); S1('Ocean Drive', '#ff4fa3', 1.8, -23, 4.0); S1('Vice City', '#19e6d2', 1.9, 23, 5.0);
  an.push(t => { club.visible = Math.sin(t * 1.3) > -.86 || Math.sin(t * 37) > 0; ol.visible = (t * 1.5 % 1) < .7; });
  for (let k = 0; k < 11; k++) { const x = -40 + k * 8; palm(g, x, -8.4 - (k % 2) * .6, 8 + (k * 7 % 3), k % 2 ? .5 : -.5); g.add(halo(k % 2 ? 0xff4fa3 : 0x19e6d2, 3.2, x, .6, -8.5, .3)); }
  // the door: carpet, ropes, bouncer, a line
  const gold = M(0xe2b64a, {metalness: 1, roughness: .25, envMap: envTex}), red = M(0xb0122a, {roughness: .8}); add(g, box(2.0, 3.0, .1, glow(0xff4fa3), 0, 1.6, -15.97), box(1.6, 2.6, .12, DARK, 0, 1.45, -15.93), box(2.2, .03, 8.4, red, 0, .19, -11.8));
  [-1, 1].forEach(s => { [-8.5, -11, -13.5].forEach(z => add(g, cyl(.045, .045, .95, gold, s * 1.3, .65, z, 8), sph(.08, gold, s * 1.3, 1.15, z))); add(g, box(.05, .05, 5, red, s * 1.3, 1.0, -11)); });
  hang(g, an, {top: 0x111118, bot: 0x111118, shoe: 0x0a0a0a, shades: 1, scale: 1.3, armL: [-.5, -.15, -1.7], armR: [-.5, -.15, -1.7], look: .3}, 2.3, -14.0, .5, .17);
  hang(g, an, {top: 0xffffff, bot: 0xff4fa3, dance: 'floss', hat: 'cap', hatC: 0x19e6d2}, 2.4, -11.6, -1.2, .17); hang(g, an, {top: 0xffd166, bot: 0x1a1030, prop: 'wine', dance: 'sip'}, 3.6, -10.4, -1.2, .17); hang(g, an, {top: 0x9b5cff, bot: 0xffffff, mullet: 1, dance: 'pump', look: -.4}, 4.9, -9.4, -1.2, .17);
  hang(g, an, {top: 0xff7a1a, bot: 0xffffff, dance: 'thrust'}, -5.2, -9.6, .6, .17); hang(g, an, {bare: 1, bot: 0x19e6d2, shades: 1, dance: 'floss', bo: PI}, -6.6, -10.2, .9, .17);
  // traffic: a chase in the far lane, cruisers in the other two
  const car = (kind, z, dir, per, ph, hop) => { const r = ride(kind); r.g.position.z = z; if (dir > 0) r.g.rotation.y = PI; g.add(r.g); an.push(t => { const u = (t / per + ph) % 1; r.g.position.x = dir * (u - .5) * 120; r.g.position.y = hop ? Math.abs(Math.sin(BEAT * PI)) * .13 : 0; if (hop) r.g.rotation.z = Math.sin(BEAT * PI) * .035; r.fl.forEach((m, k) => { m.visible = (Math.floor(t * 7) % 2) === (k >> 1); }); }); };
  car('sport', -6.1, -1, 8, 0); car('cop', -6.1, -1, 8, .955); car('cop', -6.1, -1, 8, .905);
  car('limo', -4.3, -1, 21, .5); car('moped', -4.3, -1, 21, .08); car('pink', -2.4, 1, 24, .42, 1); car('taxi', -2.4, 1, 24, .86);
  // chopper with a searchlight
  const hl = new T.Group(), rotor = box(4.2, .04, .24, DARK, 0, .85, 0), beam = new T.Mesh(new T.ConeGeometry(2.6, 11, 16, 1, true), glow(0xdff0ff, {transparent: true, opacity: .13, depthWrite: false, side: T.DoubleSide, blending: T.AdditiveBlending, fog: false})); beam.position.y = -5.6;
  add(hl, sph(.75, M(0x14141c, {roughness: .3, metalness: .6, envMap: envTex}), 0, 0, 0, 1.6, 1, 1), box(2.2, .16, .16, DARK, 1.9, .15, 0), box(.1, .7, .1, DARK, 2.9, .4, 0), box(.1, .5, .1, DARK, 0, .6, 0), rotor, beam, halo(0xff2030, 1.2, 2.9, .8, 0, .9), halo(0xdff0ff, 2.2, -.6, -.5, 0, .8)); g.add(hl);
  an.push(t => { const a = t * .32; hl.position.set(Math.cos(a) * 12, 8.2 + Math.sin(t * .9) * .4, -7 + Math.sin(a) * 6); hl.rotation.y = -a + PI / 2; hl.rotation.z = .12; rotor.rotation.y = t * 30; beam.rotation.z = Math.sin(t * .7) * .25; beam.rotation.x = Math.cos(t * .5) * .2; });
  // the street party
  const ry = .8, D = (o, x, z, r = 0) => hang(g, an, o, x, z, ry + r, z > 3 ? .1 : .02);
  D({top: 0xff4fa3, bot: 0xffffff, shades: 1, chain: 1, dance: 'routine', scale: 1.08}, 0, 1.0); D({bare: 1, bot: 0x19e6d2, dance: 'floss', hat: 'band', hatC: 0xffd166}, -2.3, .2, .2); D({top: 0xffffff, bot: 0x9b5cff, prop: 'wine', dance: 'sip'}, 2.3, .4, -.2);
  D({top: 0xffd166, bot: 0xd3201f, dance: 'thrust', shades: 0x19e6d2}, -1.2, 2.7); D({top: 0xff7a1a, bot: 0x3a78d6, lid: 1, prop: 'bottle', smoke: 1, dance: 'drunk'}, 3.7, 2.5, -.3);
  D({top: 0x19e6d2, bot: 0xff4fa3, dance: 'floss', bo: PI, mullet: 1}, -3.7, 2.3, .3); D({top: 0x9b5cff, bot: 0x111118, dance: 'pump', armL: [0, .5, -1.2], armR: [0, .5, -1.2], hat: 'cap'}, 1.4, 3.2);
  const mr = moneyRain(g, 0, 1, 46); if (typeof mr === 'function') an.push(mr);
  an.push(spots2(g, [[-18, -25], [0, -27], [18, -25]]));
  return (t, dt) => an.forEach(f => f(t, dt)); };

// ---------- street life. Camera sits front-right, so "behind the car" is x = 1.37 z; XS(z, s) picks a point s metres right of centre at that depth
const XS = (z, s = 0) => .1 + 1.373 * z + s * 1.69;
const halo = (c, s, x, y, z, op = .6) => { const k = new T.Sprite(new T.SpriteMaterial({map: GLOWTEX, color: c, transparent: true, depthWrite: false, opacity: op, blending: T.AdditiveBlending})); k.scale.setScalar(s); k.position.set(x, y, z); return k; };
function ride(kind) { const g = new T.Group(), fl = [], wh = (x, r = .33, zz = .75) => [-1, 1].forEach(s => add(g, rot(cyl(r, r, .22, RUBBER, x, r, s * zz, 12), PI / 2)));
  if (kind === 'moped') { const sk = M(0x4fb36a, {roughness: .5}); add(g, box(1.15, .32, .3, M(0xd3201f, {roughness: .4}), 0, .5, 0), box(.08, .6, .08, DARK, -.5, .8, 0), box(.06, .06, .5, DARK, -.5, 1.1, 0), rot(cyl(.25, .25, .12, RUBBER, -.55, .25, 0, 12), PI / 2), rot(cyl(.25, .25, .12, RUBBER, .55, .25, 0, 12), PI / 2), sph(.22, M(0xd3201f), .05, .95, 0, 1, 1.25, 1), sph(.17, sk, -.05, 1.36, 0), sph(.12, sk, -.24, 1.33, 0, 1.6, .6, .8), sph(.18, M(0xf4f4f6, {roughness: .3}), -.03, 1.42, 0, 1, .8, 1), sph(.07, glow(0xfff2c0), -.6, .75, 0)); for (let k = 0; k < 4; k++) add(g, box(.46, .06, .46, M(k % 2 ? 0xe9d7ae : 0xf4ead0), .58, .72 + k * .065, 0)); return {g, fl}; }
  const long = kind === 'limo' || kind === 'pink' ? 1.8 : 1, low = kind === 'sport' ? .78 : 1, L = 3.9 * long, col = {cop: 0xf4f4f6, taxi: 0xffc51f, limo: 0xfdf8ee, pink: 0xff7fc0, beater: 0x6a4a32, sport: 0x19c8c0}[kind], pm = M(col, kind === 'beater' ? {roughness: .95} : {roughness: .28, metalness: .45, envMap: envTex});
  add(g, box(L, .52 * low, 1.6, pm, 0, .6, 0), box(L * (long > 1 ? .7 : .5), .46 * low, 1.42, M(0x10131c, {roughness: .1, metalness: .8, envMap: envTex}), L * .05, .6 + .49 * low, 0), box(L * (long > 1 ? .7 : .5) + .04, .05, 1.46, pm, L * .05, .6 + .74 * low, 0)); wh(-L * .32); wh(L * .32);
  [-1, 1].forEach(s => { if (kind !== 'beater' || s > 0) add(g, box(.06, .14, .3, glow(0xfff2c0), -L / 2 - .02, .64, s * .52)); add(g, box(.06, .12, .32, glow(0xff2030), L / 2 + .02, .64, s * .52)); });
  if (kind === 'cop') { add(g, box(L * .34, .54, 1.62, M(0x14141c, {roughness: .4}), .1, .6, 0)); [0xff2030, 0x2a6bff].forEach((c, k) => { const m = box(.2, .14, .5, glow(c), .15, 1.42, k ? .32 : -.32), h = halo(c, 3.2, .15, 1.5, k ? .32 : -.32, .8); add(g, m, h); fl.push(m, h); }); }
  if (kind === 'taxi') add(g, box(.5, .2, .24, glow(0xfff2a0), .15, 1.44, 0), box(L * .5, .1, 1.62, M(0x14141c), 0, .62, 0));
  if (kind === 'beater') add(g, box(1.0, .5, 1.62, M(0x8a8a3a, {roughness: .95}), -.2, .6, 0), box(.9, .06, 1.2, M(0x3a2f26), .9, 1.0, 0));
  return {g, fl}; }
const traffic = (g, kind, o = {}) => { const r = ride(kind), P = o.P || 9, dur = o.dur || 4.2, ph = o.ph || 0; r.g.position.z = ROADZ - 2.7; r.g.visible = false; g.add(r.g);
  return t => { const u = ((t + ph) % P) / dur; r.g.visible = u < 1; if (u >= 1) return; r.g.position.x = (.5 - u) * S * 1.5; r.g.position.y = kind === 'beater' ? Math.abs(Math.sin(t * 9)) * .03 : 0; r.fl.forEach((m, k) => { m.visible = (Math.floor(t * 7) % 2) === (k >> 1); }); }; };
const pickup = (g, e, c, x, y, z, k = 0) => { const q = new T.Group(), m = new T.Mesh(new T.PlaneGeometry(.62, .62), new T.MeshBasicMaterial({map: ctex(128, 128, c2 => { c2.font = '92px serif'; c2.textAlign = 'center'; c2.textBaseline = 'middle'; c2.fillText(e, 64, 72); }), transparent: true, alphaTest: .25, side: T.DoubleSide, toneMapped: false})); add(q, halo(c, 1.9, 0, 0, 0, .55), m); q.position.set(x, y, z); g.add(q);
  return t => { m.rotation.y = t * 2.6 + k; q.position.y = y + Math.sin(t * 2.2 + k * 2) * .09; }; };
const rat = slice => { const q = new T.Group(), f = M(0x3a3640, {roughness: .9}); add(q, rot(cap(.06, .16, f, 0, .07, 0), 0, 0, PI / 2), sph(.055, f, -.16, .09, 0), sph(.025, M(0xd9a0a8), -.17, .15, .04), sph(.025, M(0xd9a0a8), -.17, .15, -.04), rot(cyl(.008, .012, .26, M(0xd9a0a8), .25, .06, 0, 4), 0, 0, PI / 2 - .3)); if (slice) add(q, rot(mesh(new T.ConeGeometry(.2, .4, 3), M(0xf2c14a, {roughness: .6}), -.38, .08, 0), PI / 2, 0, PI / 2), box(.06, .05, .34, M(0xb5713a), -.2, .09, 0), sph(.04, M(0xc0271f), -.36, .1, .04), sph(.04, M(0xc0271f), -.44, .1, -.03)); return q; };
function dress(sp, key, idx, G) { const g = sp.g, A = sp.anims, n = order.indexOf('crew'), low = idx <= 3, hi = idx >= n - 4; seed = 2000 + idx * 37;
  // pickups floating over the far lane: more cash the higher you rank
  const cash = idx >= n - 2 ? 3 : idx >= n - 5 ? 2 : idx >= 3 ? 1 : 0, own = {dean: ['❤️', 0xff3050], nick: ['⭐', 0xffd166], ian: ['🛡️', 0x4aa3ff], jackson: ['🍕', 0xffb040], sham: ['🛡️', 0x4aa3ff], tony: ['🏆', 0xffd166]}[key], ps = [2.7, 3.6, 4.5, -3.3]; let pk = 0;
  for (let k = 0; k < cash; k++) A.push(pickup(g, '💵', 0x3dff8a, XS(-3.3, ps[pk]), .85, -3.3, pk++)); if (own) A.push(pickup(g, own[0], own[1], XS(-3.3, ps[pk]), .85, -3.3, pk));
  if (low) { // potholes, puddles, bin bags, rats
    for (let k = 0; k < 5; k++) { const z = ROADZ - .6 - rnd() * 4, m = new T.Mesh(new T.CircleGeometry(.35 + rnd() * .45, 9), k % 2 ? M(0x0d0b12, {roughness: 1}) : M(0x1a1826, {roughness: .03, metalness: .9, envMap: envTex})); m.rotation.x = -PI / 2; m.scale.set(1.5, 1, 1); m.position.set(XS(z, -4 + rnd() * 8), .026, z); g.add(m); }
    for (let k = 0; k < 4 + (3 - idx) * 2; k++) { const z = ROADZ - 5.4 - rnd() * 1.2, x = XS(z, -5 + rnd() * 10), bm = M(pick([0x15131c, 0x1d1b26, 0x23202c]), {roughness: .5}); add(g, sph(.3 + rnd() * .15, bm, x, .36, z, 1, .85, 1), sph(.07, bm, x, .66, z)); if (rnd() < .5) add(g, rot(box(.5, .4, .4, M(0x8a6a4a, {roughness: 1}), x + .55, .38, z + .1), 0, rnd() * 2, 0)); }
    const rs = [0, 1, 2].slice(0, key === 'jackson' ? 1 : 3 - Math.min(2, idx)).map(k => { const r = rat(key === 'jackson'); r.userData.o = rnd(); r.userData.v = .08 + rnd() * .06; g.add(r); return r; }), rz = ROADZ - 5.15;
    A.push(t => rs.forEach((r, k) => { const u = (t * r.userData.v + r.userData.o) % 1; r.position.set(XS(rz, 6 - u * 12), .02 + Math.abs(Math.sin(t * 16 + k)) * .03, rz + k * .25); }));
    // one busted streetlight
    const lx = XS(ROADZ - 5.6, 3.4), bulb = sph(.17, glow(0xfff0c0), lx, 5.1, ROADZ - 4.7), hl = halo(0xfff0c0, 3, lx, 5.1, ROADZ - 4.7, .5); add(g, cyl(.06, .09, 5.2, DARK, lx, 2.6, ROADZ - 5.6, 8), box(.07, .07, 1.0, DARK, lx, 5.2, ROADZ - 5.15), bulb, hl); A.push(t => { const on = Math.sin(t * 23) * Math.sin(t * 3.1) > -.25 && (t * .7 % 1) > .18; bulb.visible = hl.visible = on; });
  }
  if (hi) { // freshly waxed
    const tw = []; for (let k = 0; k < 4 + (idx - (n - 4)) * 2; k++) { const s = halo(0xffffff, .5, -1.8 + rnd() * 3.9, .55 + rnd() * .65, .7 + rnd() * .3, 0); s.userData.o = rnd() * 6; s.userData.v = 1.2 + rnd() * 1.5; g.add(s); tw.push(s); } A.push(t => tw.forEach(s => { const k = Math.pow(Math.max(0, Math.sin(t * s.userData.v + s.userData.o)), 14); s.material.opacity = k; s.scale.setScalar(.25 + k * .7); }));
  }
  A.push(traffic(g, {dean: 'beater', nick: 'beater', ian: 'beater', jackson: 'moped', sham: 'taxi', nicky: 'limo', reece: 'taxi', ryan: 'sport', daniel: 'sport', tony: 'pink'}[key] || 'taxi', {P: 8 + (idx % 3) * 1.5, ph: idx * 2.3, dur: key === 'ian' ? 6.5 : key === 'jackson' ? 5 : 4.2}));
  const X = {
    dean: () => { A.push(traffic(g, 'cop', {P: 8, ph: -.55}));
      const sl = new T.Mesh(new T.CircleGeometry(2.3, 24), new T.MeshBasicMaterial({color: 0xcfe0ff, transparent: true, opacity: .16, depthWrite: false, blending: T.AdditiveBlending, toneMapped: false})); sl.rotation.x = -PI / 2; g.add(sl); const beam = new T.Mesh(new T.CylinderGeometry(.2, 2.3, 30, 16, 1, true), new T.MeshBasicMaterial({color: 0xcfe0ff, transparent: true, opacity: .05, depthWrite: false, side: T.DoubleSide, blending: T.AdditiveBlending, toneMapped: false})); g.add(beam);
      A.push(t => { const x = -4 + Math.sin(t * .5) * 7, z = -3 + Math.cos(t * .37) * 5; sl.position.set(x, .05, z); beam.position.set(x, 15, z); });
      const ch = new T.Mesh(new T.PlaneGeometry(2.6, 1.5), new T.MeshBasicMaterial({map: ctex(256, 148, c => { c.strokeStyle = '#fff'; c.lineWidth = 5; c.lineCap = c.lineJoin = 'round'; c.beginPath(); c.ellipse(120, 74, 52, 26, 0, 0, 7); c.stroke(); c.beginPath(); c.ellipse(196, 60, 22, 17, -.2, 0, 7); c.stroke(); c.beginPath(); c.ellipse(232, 50, 20, 8, -.25, 0, 7); c.stroke(); c.beginPath(); c.moveTo(70, 66); c.quadraticCurveTo(30, 40, 8, 78); c.moveTo(100, 50); c.lineTo(84, 14); c.lineTo(100, 8); c.moveTo(150, 50); c.lineTo(160, 12); c.lineTo(178, 14); c.moveTo(96, 98); c.lineTo(76, 136); c.lineTo(94, 142); c.moveTo(146, 98); c.lineTo(164, 132); c.lineTo(182, 126); c.stroke(); }), transparent: true, opacity: .85, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4})); ch.rotation.x = -PI / 2; ch.rotation.z = .5; ch.position.set(XS(-3.4, 3.1), .03, -3.4); g.add(ch);
      [[.9, .2], [-.8, .7], [.2, -.9]].forEach(([dx, dz], k) => { const b = board(String(k + 1), '#ffd400', '#111', .2, .2); b.position.set(ch.position.x + dx * 1.4, .14, ch.position.z + dz * 1.1); b.rotation.y = .94; g.add(b); });
      const bz = ROADZ - 5.9, bx = XS(bz, -3), fl = [0, 1, 2].map(k => mesh(new T.ConeGeometry(.2 - k * .04, .55 + k * .1, 6), glow([0xff5a1a, 0xff9a2a, 0xffe07a][k]), bx, 1.3 + k * .05, bz)), fh = halo(0xff7a2a, 4, bx, 1.4, bz, .7); add(g, cyl(.32, .28, .95, M(0x4a2a1c, {roughness: 1}), bx, .65, bz, 10), ...fl, fh); A.push(t => { fl.forEach((f, k) => { f.scale.set(1 + Math.sin(t * 13 + k * 2) * .2, 1 + Math.sin(t * 17 + k) * .3, 1); f.rotation.y = t * 3; }); fh.material.opacity = .55 + Math.sin(t * 15) * .15; });
      const gr = sign('0-10 lol', '#7dffb0', 1.3); gr.position.set(XS(-10.5, 1.5), 1.5, ROADZ - 8.25); g.add(gr); },
    nick: () => { const z = ROADZ - 6.2, x = XS(z, 1.2), cm = M(0x7a5a3a, {roughness: 1}), q = new T.Group(); add(q, box(2.0, .4, .8, cm, 0, .3, 0), box(2.0, .6, .22, cm, 0, .75, -.32), box(.22, .5, .8, cm, -.95, .55, 0), box(.22, .5, .8, cm, .95, .55, 0), box(.7, .12, .6, M(0x9a7a5a), -.45, .56, .05), rot(box(.7, .12, .6, M(0x9a7a5a), .45, .58, .05), 0, 0, .12)); const fb = board('FREE', '#f4f1e4', '#c0271f', .7, .34); fb.position.set(0, .8, -.2); fb.rotation.x = -.2; q.add(fb); q.position.set(x, .18, z); q.rotation.y = .9; g.add(q); },
    ian: () => { const ey = []; for (let k = 0; k < 6; k++) { const q = new T.Group(), z = ROADZ - 12 - rnd() * 9; add(q, sph(.07, glow(0xffe94a), -.11, 0, 0), sph(.07, glow(0xffe94a), .11, 0, 0), halo(0xffe94a, .9, 0, 0, 0, .4)); q.position.set(XS(z, -6 + rnd() * 12), .1, z); q.rotation.y = .94; q.userData.o = rnd() * 9; g.add(q); ey.push(q); } A.push(t => ey.forEach(q => { const u = (t * .35 + q.userData.o) % 3; q.visible = u < 2.2; q.scale.y = (u % 1.1) > 1 ? .1 : 1; q.position.y = .1 - ss(1.9, 2.2, u) * .2; }));
      [[-2.5, 0], [-2.1, .5], [3.2, .2]].forEach(([s, dz]) => add(g, rot(mesh(new T.TorusGeometry(.33, .13, 6, 14), RUBBER, XS(ROADZ - 5.6 - dz, s), .14, ROADZ - 5.6 - dz), PI / 2))); },
    jackson: () => { const z = ROADZ - 5.8, x = XS(z, -3.4), sm = [0, 1, 2, 3, 4, 5].map(k => { const s = new T.Sprite(new T.SpriteMaterial({map: GLOWTEX, color: 0xd8d4e0, transparent: true, depthWrite: false, opacity: .4})); s.userData.o = k / 6; g.add(s); return s; }); add(g, box(.9, .06, .9, DARK, x, .2, z)); A.push(t => sm.forEach(s => { const u = (t * .3 + s.userData.o) % 1; s.position.set(x + Math.sin(u * 8 + s.userData.o * 20) * .2, .3 + u * 3, z); s.scale.setScalar(.5 + u * 1.6); s.material.opacity = .4 * (1 - u) * Math.min(1, u * 8); })); add(g, box(2.2, 1.3, 1.1, M(0x2a5a3a, {roughness: .7}), XS(z - .8, 3.6), .83, z - .8), box(2.3, .08, 1.2, M(0x1d3f29), XS(z - .8, 3.6), 1.52, z - .8)); },
    sham: () => {},
    nicky: () => { const N = 46, fp = new Float32Array(N * 3), fg = new T.BufferGeometry(), cx = -8, cz = ROADZ - 11.5; fg.setAttribute('position', new T.BufferAttribute(fp, 3)); const f = new T.Points(fg, new T.PointsMaterial({color: 0xcfefff, size: .12, transparent: true, opacity: .9, toneMapped: false})); f.frustumCulled = false; g.add(f); A.push(t => { for (let k = 0; k < N; k++) { const u = (t * .7 + k / N * 7.3) % 1, a = k * 2.4, r = 1.45 * u; fp[k * 3] = cx + Math.cos(a) * r; fp[k * 3 + 1] = 1.9 + 2.6 * u - 4.0 * u * u; fp[k * 3 + 2] = cz + Math.sin(a) * r; } fg.attributes.position.needsUpdate = true; }); },
    reece: () => { const hs = [0, 1, 2].map(() => { const h = halo(0xffffff, 1.6, 0, .25, ROADZ - 9.5, .9); g.add(h); return h; }); A.push(t => hs.forEach((h, k) => { h.position.x = -22 + ((t * 16 + k * 15) % 45); })); },
    ryan: () => { const tx = ctex(1024, 64, c => { c.fillStyle = '#05060c'; c.fillRect(0, 0, 1024, 64); c.font = '40px Anton, sans-serif'; c.textBaseline = 'middle'; let x = 14; [['SEEB', '#fff'], ['▲ 189.4', '#3dff8a'], ['CMC', '#fff'], ['▲ 46.3', '#3dff8a'], ['WINS', '#fff'], ['5-5 ▬', '#ffd166'], ['RENT', '#fff'], ['▲ DUE', '#ff4f6a'], ['LEASE', '#fff'], ['▼ 36 MO', '#ff4f6a']].forEach(([s, col]) => { c.fillStyle = col; c.fillText(s, x, 34); x += c.measureText(s).width + 22; }); }, [1, 1]), tk = new T.Mesh(new T.PlaneGeometry(15, .95), new T.MeshBasicMaterial({map: tx, toneMapped: false})); tk.position.set(-15, 4.4, ROADZ - 11.05); add(g, tk, box(15.3, 1.15, .1, DARK, -15, 4.4, ROADZ - 11.12)); A.push((t, dt) => { tx.offset.x = (t * .09) % 1; }); },
    daniel: () => { const y = new T.Group(), wt = M(0xfdfdfd, {roughness: .3}); add(y, box(11, 1.3, 3, wt, 0, .6, 0), box(6.5, 1.1, 2.6, wt, .6, 1.8, 0), box(3.4, .9, 2.2, wt, 1.2, 2.8, 0), box(6.6, .3, 2.62, M(0x10131c, {roughness: .1, metalness: .8, envMap: envTex}), .6, 1.95, 0), box(.1, 1.6, .1, wt, 1.4, 4, 0), sph(.16, glow(0xff2030), 1.4, 4.9, 0)); y.position.set(0, 0, ROADZ - 62); g.add(y); const ball = sph(.38, M(0xff4fa3, {roughness: .4}), 0, 0, ROADZ - 12.5), bs = sph(.385, M(0xffffff, {roughness: .4}), 0, 0, ROADZ - 12.5, 1, .34, 1); add(g, ball, bs);
      A.push(t => { y.position.x = -118 + ((t * 2.2) % 70); y.position.y = Math.sin(t * .9) * .12; y.rotation.z = Math.sin(t * .7) * .015; const bx = XS(ROADZ - 12.5, -1 + Math.sin(t * .8) * 3), by = .56 + Math.abs(Math.sin(t * 2.6)) * 2; ball.position.set(bx, by, ROADZ - 12.5); bs.position.copy(ball.position); bs.rotation.set(t * 2, 0, t * 1.3); }); },
    tony: () => { const cx = -10, cz = ROADZ - 7.6, gold = M(0xe2b64a, {metalness: 1, roughness: .25, envMap: envTex}), red = M(0xb0122a, {roughness: .8}); add(g, box(2.2, .03, 4.6, red, cx, .2, cz + .3)); [-1, 1].forEach(s => { [-.9, 1.5].forEach(dz => add(g, cyl(.045, .045, .95, gold, cx + s * 1.35, .66, cz + dz, 8), sph(.08, gold, cx + s * 1.35, 1.16, cz + dz), cyl(.16, .16, .04, gold, cx + s * 1.35, .2, cz + dz, 10))); add(g, box(.05, .05, 2.4, red, cx + s * 1.35, 1.0, cz + .3)); });
      const bo = gator({top: 0x111118, bot: 0x111118, shoe: 0x0a0a0a, shades: 1, scale: 1.3, armL: [-.5, -.15, -1.7], armR: [-.5, -.15, -1.7], look: .3}); bo.position.set(cx + 2.1, .18, cz - .2); bo.rotation.y = .94; g.add(bo); A.push(bo.userData.anim);
      A.push(spots2(g, [[-26, ROADZ - 22], [-14, ROADZ - 23], [-3, ROADZ - 22]])); A.push(moneyRain(g, XS(-3, 0), -3, 70)); }
  }[key]; if (X) X(); }
// club searchlights and a cash shower, for Ocean Drive and the family photo
const spots2 = (g, at) => { const bs = at.map(([x, z], k) => { const ge = new T.CylinderGeometry(1.9, .12, 46, 12, 1, true); ge.translate(0, 23, 0); const m = new T.Mesh(ge, new T.MeshBasicMaterial({color: [0xff7fd0, 0x7ff0e4, 0xffe9a0][k % 3], transparent: true, opacity: .09, depthWrite: false, side: T.DoubleSide, blending: T.AdditiveBlending, toneMapped: false, fog: false})); m.position.set(x, 0, z); g.add(m); return m; }); return t => bs.forEach((m, k) => { m.rotation.z = Math.sin(t * .55 + k * 2.1) * .5; m.rotation.x = .25 + Math.cos(t * .4 + k) * .2; }); };
const moneyRain = (g, cx, cz, N) => { const fp = new Float32Array(N * 3), fg = new T.BufferGeometry(), sd = []; for (let k = 0; k < N; k++) { sd.push([rnd() * 6, .6 + rnd() * .7]); fp[k * 3] = cx - 9 + rnd() * 18; fp[k * 3 + 1] = rnd() * 9; fp[k * 3 + 2] = cz - 6 + rnd() * 12; } fg.setAttribute('position', new T.BufferAttribute(fp, 3)); const m = new T.Points(fg, new T.PointsMaterial({map: ctex(64, 64, c => { c.translate(32, 32); c.rotate(-.4); c.fillStyle = '#2fbf6a'; c.fillRect(-28, -14, 56, 28); c.strokeStyle = '#d8ffe4'; c.lineWidth = 3; c.strokeRect(-24, -10, 48, 20); c.fillStyle = '#d8ffe4'; c.font = '900 20px Arial'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('$', 0, 1); }), size: .34, transparent: true, alphaTest: .3, toneMapped: false})); m.frustumCulled = false; g.add(m);
  return (t, dt) => { for (let k = 0; k < N; k++) { let y = fp[k * 3 + 1] - dt * sd[k][1] * 1.5; if (y < 0) y = 9; fp[k * 3 + 1] = y; fp[k * 3] += Math.sin(t * 2 + sd[k][0]) * dt * .5; } fg.attributes.position.needsUpdate = true; }; };
// the family photo: everyone and their car in a pyramid, #1 front and centre
function buildCrew(sp) { const g = sp.g, keys = order.filter(k => CARS[k]).reverse(), ROWS = [[6.8, [0]], [1.0, [-2.6, 2.6]], [-4.8, [-4.6, 0, 4.6]], [-10.6, [-7, -2.4, 2.3, 6.9]]]; let n = 0;
  ROWS.forEach(([z, xs]) => xs.forEach(x => { const key = keys[n++]; if (!key) return; const u = new T.Group(), G = GATORS[key](), ga = G.g, p = n === 1 || G.p[1] > 0 ? G.p : [1.75, 0, 1.45]; u.add(CARS[key]()); ga.position.set(p[0], p[1], p[2]); ga.rotation.y = PI / 2; u.add(ga); sp.anims.push(ga.userData.anim); if (G.extra) G.extra({g: u, anims: sp.anims}); u.position.set(x, .08, z); u.rotation.y = -PI / 2 - x * .035; g.add(u); })); }
const P = (a, b, c, fog, fn, ff, hs, hg, hi, sc, si, sun, st, moon) => ({a, b, c, fog, fn, ff, hs, hg, hi, sc, si, sun, st, moon: moon || 0});
const PAL = {
  sunset: P(0x2a1466, 0xff4f9a, 0xffb35c, 0xd96a9a, 40, 170, 0xffb0d0, 0x4a2a5a, .8, 0xffb07a, 1.9, 1, 0),
  magic: P(0x1a0f55, 0xd13a9a, 0xff8a5c, 0xa8468c, 40, 160, 0xff9ed8, 0x3a2050, .75, 0xff9a8a, 1.6, 1, .25),
  gold: P(0x3550a8, 0xff9a70, 0xffdf9a, 0xeeb08a, 45, 180, 0xffe0c0, 0x5a4a3a, .85, 0xffe0b0, 2.1, 1, 0),
  dusk: P(0x0c0a3a, 0x5a2a8a, 0xe0608a, 0x57307c, 36, 150, 0x9a8ae0, 0x2a1a40, .7, 0xc090ff, 1.1, .3, .6),
  night: P(0x04041a, 0x15104a, 0x3a1a5a, 0x130e30, 30, 130, 0x7a80d0, 0x15102a, .6, 0x8aa0ff, .8, 0, 1),
  swamp: P(0x030a12, 0x0a2a2a, 0x1a4a3a, 0x0a2420, 26, 110, 0x70c0b0, 0x0a1a10, .6, 0xa0ffd0, .9, 0, 1, 1)
};
// per spot: palette, two accent lights [x,y,z,colour,intensity], camera [yaw°, pitch°, fit m, look x, look y]
const META = {
  dean: {pal: 'night', l1: [3, 4.5, 4, 0xfff0c0, 1.5], l2: [-6, 3, -5, 0xff2030, 1.6], cam: [36, 9, 5.2, .1, .9], cop: 1},
  nick: {pal: 'dusk', l1: [3, 4, 4, 0xffd9a0, 1.2], l2: [-6, 3, -8, 0xffe7a3, .8], cam: [36, 9, 5.4, .1, 1.0]},
  ian: {pal: 'swamp', l1: [3, 4, 4, 0xd8ffb0, 1.2], l2: [-8, 3, -9, 0x7dffb0, 1.0], cam: [36, 9, 5.8, -.1, 1.5]},
  jackson: {pal: 'night', l1: [3, 4, 4, 0xffb0d0, 1.4], l2: [-3, 4, -12, 0xff3b3b, 1.6], cam: [36, 9, 4.8, .1, .95]},
  sham: {pal: 'dusk', l1: [3, 4, 4, 0xbfe8ff, 1.3], l2: [-6, 4, -9, 0x9fe8ff, 1.2], cam: [36, 9, 5.4, .1, 1.2]},
  ryan: {pal: 'dusk', l1: [3, 4, 4, 0xffd9a0, 1.2], l2: [-8, 5, -8, 0x19e6d2, 1.2], cam: [36, 9, 5.4, .1, .95]},
  nicky: {pal: 'gold', l1: [3, 4, 4, 0xffe0b0, .6], l2: [-8, 4, -9, 0xffd166, .6], cam: [34, 10, 5.0, .1, .9]},
  reece: {pal: 'sunset', l1: [3, 4, 4, 0xffb07a, .6], l2: [-8, 4, -9, 0xff4fa3, .6], cam: [36, 8, 5.6, 0, 1.6]},
  daniel: {pal: 'sunset', l1: [3, 4, 4, 0xffb07a, .6], l2: [-3, 4, -9, 0xff4fa3, 1.0], cam: [36, 9, 5.5, .1, 1.0]},
  tony: {pal: 'magic', l1: [3, 3, 4, 0xff4fa3, 1.3], l2: [-6, 4, -8, 0x19e6d2, 1.3], cam: [36, 9, 5.3, .2, .95]},
  beach: {pal: 'night', l1: [0, 1.5, -.4, 0xff8a3a, 2.4], l2: [-4, 5, 7, 0x19e6d2, 1.1], cam: [90, 9, 8.6, 0, 1.5]},
  strip: {pal: 'sunset', l1: [3, 7, 7, 0xff4fa3, 1.5], l2: [-6, 7, 5, 0xffb35c, 1.4], cam: [44, 7, 9, 0, 1.4]},
  crew: {pal: 'magic', l1: [-4, 5, 11, 0xff4fa3, 1.8], l2: [5, 7, 12, 0x19e6d2, 1.6], cam: [90, 17, 11.5, -.5, 1.3]}
};

function buildSpot(key) { if (spots[key] || !SETS[key]) return spots[key]; const idx = order.indexOf(key), g = new T.Group(), sp = spots[key] = {g, idx, x: idx * S, anims: []}; g.position.x = sp.x;
  const sub = new T.Group(); g.add(sub); const tk = SETS[key](sub); if (tk) sp.anims.push(tk);
  if (!CARS[key]) { if (key === 'crew') buildCrew(sp); scene.add(g); built++; return sp; }
  const c = sp.car = CARS[key](); g.add(c);
  const G = GATORS[key](), ga = G.g, sc = ga.scale.x; ga.position.set(G.p[0], G.p[1], G.p[2]); ga.rotation.y = G.p[3]; g.add(ga); sp.anims.push(ga.userData.anim); if (G.extra) G.extra(sp); dress(sp, key, idx, G);
  if (key === 'dean') { const sm = [], tx = GLOWTEX; for (let k = 0; k < 9; k++) { const s = new T.Sprite(new T.SpriteMaterial({map: tx, color: 0x8a8a94, transparent: true, depthWrite: false, opacity: .5})); s.userData.o = k / 9; g.add(s); sm.push(s); } sp.anims.push(t => sm.forEach(s => { const u = (t * .22 + s.userData.o) % 1; s.position.set(1.3 + Math.sin(u * 9 + s.userData.o * 20) * .25 - u * .8, 1.0 + u * 3.6, Math.cos(u * 7 + s.userData.o * 9) * .25); s.scale.setScalar(.5 + u * 1.8); s.material.opacity = .5 * (1 - u) * Math.min(1, u * 8); })); }
  scene.add(g); built++; return sp; }

// ---------- world
function world() { scene = new T.Scene(); scene.fog = new T.Fog(0xd96a9a, 40, 170); cam = new T.PerspectiveCamera(50, 1, 1, 480);
  const skyMat = () => new T.ShaderMaterial({side: T.BackSide, depthWrite: false, fog: false, uniforms: {a: {value: new T.Color()}, b: {value: new T.Color()}, c: {value: new T.Color()}},
    vertexShader: 'varying vec3 p; void main(){ p = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: 'uniform vec3 a, b, c; varying vec3 p; void main(){ float h = normalize(p).y; vec3 col = mix(c, b, smoothstep(-.02, .17, h)); col = mix(col, a, smoothstep(.1, .6, h)); gl_FragColor = vec4(pow(col, vec3(.4545)), 1.); }'});
  // one sunset environment map for paint, glass and wet road
  const es = new T.Scene(), em = new T.Mesh(new T.SphereGeometry(50, 24, 12), skyMat()); em.material.uniforms.a.value.set(0x2a1466); em.material.uniforms.b.value.set(0xff4f9a); em.material.uniforms.c.value.set(0xffc27a); es.add(em);
  add(es, mesh(new T.SphereGeometry(5, 12, 8), glow(0xfff0c0), -30, 8, -34), mesh(new T.SphereGeometry(9, 12, 8), glow(0x19e6d2), 36, 14, 20), mesh(new T.PlaneGeometry(200, 200), glow(0x2a1a3a), 0, -6, 0)); es.children[es.children.length - 1].rotation.x = -PI / 2;
  const pm = new T.PMREMGenerator(R); envTex = pm.fromScene(es, .03).texture; pm.dispose();
  DARK = M(0x0c0b12, {roughness: .7}); CHROME = M(0xe6e9ee, {metalness: 1, roughness: .16, envMap: envTex}); GLASS = M(0x0a1622, {metalness: .9, roughness: .06, envMap: envTex, envMapIntensity: 1.5, side: T.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4}); RUBBER = M(0x121116, {roughness: .92}); CONC = M(0xa99aa6, {roughness: .95});
  PALMT = M(0x7a5a3a, {roughness: 1}); PALML = M(0x2f8a4a, {roughness: .8, side: T.DoubleSide});
  GLOWTEX = ctex(128, 128, c => { const gr = c.createRadialGradient(64, 64, 4, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,.9)'); gr.addColorStop(.5, 'rgba(255,255,255,.3)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = gr; c.fillRect(0, 0, 128, 128); });
  sky = new T.Mesh(new T.SphereGeometry(420, 32, 16), skyMat()); sky.frustumCulled = false; scene.add(sky);
  const sunT = ctex(512, 512, c => { const gl = c.createRadialGradient(256, 256, 60, 256, 256, 256); gl.addColorStop(0, 'rgba(255,170,120,.55)'); gl.addColorStop(1, 'rgba(255,90,160,0)'); c.fillStyle = gl; c.fillRect(0, 0, 512, 512); c.save(); c.beginPath(); c.arc(256, 256, 150, 0, 7); c.clip(); const g2 = c.createLinearGradient(0, 106, 0, 406); g2.addColorStop(0, '#fff6a8'); g2.addColorStop(.5, '#ffa23c'); g2.addColorStop(1, '#ff3d8b'); c.fillStyle = g2; c.fillRect(0, 0, 512, 512); c.globalCompositeOperation = 'destination-out'; for (let k = 0; k < 6; k++) c.fillRect(0, 270 + k * 24, 512, 4 + k * 2.6); c.restore(); });
  sunM = new T.Mesh(new T.PlaneGeometry(150, 150), new T.MeshBasicMaterial({map: sunT, transparent: true, depthWrite: false, fog: false, toneMapped: false})); scene.add(sunM);
  const moonT = ctex(256, 256, c => { const gl = c.createRadialGradient(128, 128, 30, 128, 128, 128); gl.addColorStop(0, 'rgba(200,255,230,.5)'); gl.addColorStop(1, 'rgba(200,255,230,0)'); c.fillStyle = gl; c.fillRect(0, 0, 256, 256); c.fillStyle = '#f2fff4'; c.beginPath(); c.arc(128, 128, 62, 0, 7); c.fill(); c.fillStyle = '#cfe6d6'; [[108, 110, 12], [150, 140, 9], [135, 96, 6]].forEach(([x, y, r]) => { c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); }); });
  moonM = new T.Mesh(new T.PlaneGeometry(70, 70), new T.MeshBasicMaterial({map: moonT, transparent: true, depthWrite: false, fog: false, toneMapped: false})); scene.add(moonM);
  const sp = new Float32Array(900); seed = 5; for (let k = 0; k < 300; k++) { const a = rnd() * PI * 2, e = .05 + rnd() * 1.3; sp[k * 3] = Math.cos(a) * Math.cos(e) * 400; sp[k * 3 + 1] = Math.sin(e) * 400; sp[k * 3 + 2] = Math.sin(a) * Math.cos(e) * 400; } const sg = new T.BufferGeometry(); sg.setAttribute('position', new T.BufferAttribute(sp, 3));
  stars = new T.Points(sg, new T.PointsMaterial({color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, fog: false, depthWrite: false})); stars.frustumCulled = false; scene.add(stars);
  hemi = new T.HemisphereLight(0xffffff, 0x444444, .8); scene.add(hemi);
  dl = new T.DirectionalLight(0xffffff, 1.5); dl.castShadow = true; dl.shadow.mapSize.set(1024, 1024); const sc = dl.shadow.camera; sc.left = -11; sc.right = 11; sc.top = 11; sc.bottom = -11; sc.near = 1; sc.far = 90; dl.shadow.bias = -.0006; dl.shadow.normalBias = .04; scene.add(dl, dl.target);
  pl1 = new T.PointLight(0xffffff, 1, 26, 1.6); pl2 = new T.PointLight(0xffffff, 1, 30, 1.6); scene.add(pl1, pl2);
  const LEN = S * (order.length + 6), cx = S * (order.length - 1) / 2;
  const rt = ctex(512, 512, (c, W, H) => { c.fillStyle = '#2b2835'; c.fillRect(0, 0, W, H); seed = 77; for (let k = 0; k < 2600; k++) { c.fillStyle = `rgba(${rnd() < .5 ? '255,255,255' : '0,0,0'},${rnd() * .07})`; c.fillRect(rnd() * W, rnd() * H, 2, 2); } c.fillStyle = '#f2c94c'; c.fillRect(0, H * .5 - 7, W, 4); c.fillRect(0, H * .5 + 3, W, 4); c.fillStyle = '#e9e6f0'; c.fillRect(0, H * .04, W, 5); c.fillRect(0, H * .96 - 5, W, 5); c.fillRect(40, H * .25, 190, 5); c.fillRect(40, H * .75, 190, 5); }, [LEN / 9, 1]);
  const road = new T.Mesh(new T.PlaneGeometry(LEN, 10), new T.MeshStandardMaterial({map: rt, roughness: .38, metalness: 0, envMap: envTex, envMapIntensity: .7})); road.rotation.x = -PI / 2; road.position.set(cx, .02, ROADZ); road.receiveShadow = true; scene.add(road);
  const base = new T.Mesh(new T.PlaneGeometry(LEN + 600, 900), M(0x1c1926, {roughness: 1})); base.rotation.x = -PI / 2; base.position.set(cx, -.06, 0); base.receiveShadow = true; scene.add(base); }

const col = new (function () { this.a = null; })(), tmp = {};
function lerpPal(A, B, f) { const o = {}; for (const k in A) o[k] = typeof A[k] === 'number' && k !== 'a' && k !== 'b' && k !== 'c' && k !== 'fog' && k !== 'hs' && k !== 'hg' && k !== 'sc' ? A[k] + (B[k] - A[k]) * f : (tmp[k] = tmp[k] || new T.Color()).set(A[k]).lerp(new T.Color(B[k]), f).clone(); return o; }
const lerp = (a, b, f) => a + (b - a) * f;
function frame(now) { raf = 0; if (!host) return; raf = requestAnimationFrame(frame); const t = now / 1000, rdt = t - (frame.t || t), dt = Math.min(.05, rdt); frame.t = t; { const mb = V.beat && V.beat(); BEAT = mb == null ? t * 2 : mb; }
  if (Math.abs(offT - off) > .0015) { off += (offT - off) * (1 - Math.exp(-dt * 7)); const w = hw, h = hh; if (w > 1 && h > 1) { cam.setViewOffset(w, h, 0, off * h, w, h); cam.updateProjectionMatrix(); } }
  const tx = target * S; { const om = 2 / .42, x = om * dt, e = 1 / (1 + x + .48 * x * x + .235 * x * x * x), ch = focus - tx, q = (fv + om * ch) * dt; fv = (fv - om * q) * e; focus = tx + (ch + q) * e; if (Math.abs(tx - focus) < .002 && Math.abs(fv) < .01) { focus = tx; fv = 0; } }
  // drop resolution a notch if the phone can't hold 60
  if (rdt < .1) { slow = rdt > .021 ? slow + 1 : Math.max(0, slow - 2); if (slow > 45 && pr > 1) { pr = Math.max(1, pr - .25); slow = 0; size(); } }
  const u = Math.max(0, Math.min(order.length - 1, focus / S)), i0 = Math.floor(u), i1 = Math.min(order.length - 1, i0 + 1), f = ss(0, 1, u - i0), A = META[order[i0]], B = META[order[i1]], p = lerpPal(PAL[A.pal], PAL[B.pal], f);
  sky.material.uniforms.a.value.copy(p.a); sky.material.uniforms.b.value.copy(p.b); sky.material.uniforms.c.value.copy(p.c); scene.fog.color.copy(p.fog); scene.fog.near = p.fn; scene.fog.far = p.ff; R.setClearColor(p.fog);
  hemi.color.copy(p.hs); hemi.groundColor.copy(p.hg); hemi.intensity = p.hi; dl.color.copy(p.sc); dl.intensity = p.si; sunM.material.opacity = p.sun; moonM.material.opacity = p.moon; stars.material.opacity = p.st * .9;
  [[pl1, 'l1'], [pl2, 'l2']].forEach(([l, k]) => { const a = A[k], b = B[k]; l.position.set(lerp(i0 * S + a[0], i1 * S + b[0], f), lerp(a[1], b[1], f), lerp(a[2], b[2], f)); l.color.set(a[3]).lerp(tmp.lc = (tmp.lc || new T.Color()).set(b[3]), f); l.intensity = lerp(a[4], b[4], f); });
  const near = META[order[Math.round(u)]]; if (near.cop) { const k = Math.floor(t * 3.2) % 2; pl2.color.set(k ? 0xff2030 : 0x2a6bff); }
  // camera: 3/4 front view, distance picked so `fit` metres of street fill the width
  const ca = A.cam, cb = B.cam, orbit = mode !== 'story'; tOrb += dt;
  let yaw = lerp(ca[0], cb[0], f), pitch = lerp(ca[1], cb[1], f), fit = lerp(ca[2], cb[2], f); const lx = lerp(ca[3], cb[3], f), ly = lerp(ca[4], cb[4], f);
  if (mode === 'orbit') { yaw = 44 + Math.sin(tOrb * .2) * 30; pitch = 7; fit *= 1.12; } else if (mode === 'card') { yaw = 42 + Math.sin(tOrb * .3) * 14; fit *= 1.1; } else yaw += Math.sin(t * .23) * 2.5;
  const w = hw, h = hh, asp = w / h, th = Math.tan(cam.fov * PI / 360), d = Math.max(fit / 2 / (th * asp), (mode === 'card' ? 4.8 : 3.4) / 2 / th), yr = yaw * PI / 180, pr = pitch * PI / 180;
  const speed = Math.sin(Math.min(1, Math.abs(tx - focus) / S) * PI) * .6;
  cam.position.set(focus + lx + d * Math.cos(pr) * Math.cos(yr), ly + d * Math.sin(pr) + speed * 2.5, d * Math.cos(pr) * Math.sin(yr) + speed * 2); cam.lookAt(focus + lx, ly, 0);
  sky.position.copy(cam.position); stars.position.copy(cam.position);
  const sa = (yr + PI) + .06, se = .075; sunM.position.set(cam.position.x + Math.cos(sa) * 380, cam.position.y * 0 + Math.sin(se) * 380 + 6, cam.position.z + Math.sin(sa) * 380); sunM.lookAt(cam.position);
  moonM.position.set(cam.position.x + Math.cos(sa - .1) * 380, 62, cam.position.z + Math.sin(sa - .1) * 380); moonM.lookAt(cam.position);
  dl.target.position.set(focus, 0, 0); dl.position.set(focus - 14, 16, -9 + 26 * (1 - p.sun * .0)); dl.position.set(focus - 12, 15, 14);
  const nk = order[Math.round(focus / S)], solo = nk === 'beach' || nk === 'strip';
  for (const k in spots) { const s = spots[k], vis = solo ? k === nk : k !== 'beach' && k !== 'strip' && Math.abs(s.x - focus) < S * 1.7; s.g.visible = vis; if (vis && Math.abs(s.x - focus) < S * .8) s.anims.forEach(fn => fn(t, dt)); }
  R.render(scene, cam); }
function size() { if (!host || !R) return; const w = host.clientWidth, h = host.clientHeight; if (!w || !h) return; hw = w; hh = h; if (!pr) pr = Math.min(window.devicePixelRatio || 1, 2); R.setPixelRatio(pr); R.setSize(w, h, false); cam.aspect = w / h; if (off) cam.setViewOffset(w, h, 0, off * h, w, h); else cam.clearViewOffset(); cam.updateProjectionMatrix(); }

V.init = function (o) { T = window.THREE; order = o.order.filter(k => SETS[k] && CARS[k]); order.push('crew', 'beach', 'strip');
  const fonts = document.fonts ? Promise.race([Promise.all([document.fonts.load('96px "Mr Dafoe"'), document.fonts.load('96px "Anton"')]), new Promise(r => setTimeout(r, 2500))]).catch(() => {}) : Promise.resolve();
  return fonts.then(() => { canvas = document.createElement('canvas'); canvas.className = 'v3d-c';
    R = new T.WebGLRenderer({canvas, antialias: true, powerPreference: 'high-performance'}); if (T.ColorManagement) T.ColorManagement.legacyMode = false; R.outputEncoding = T.sRGBEncoding; R.toneMapping = T.ACESFilmicToneMapping; R.toneMappingExposure = 1.12; R.shadowMap.enabled = true; R.shadowMap.type = T.PCFSoftShadowMap;
    world(); V.ok = true; window.addEventListener('resize', size);
    canvas.addEventListener('webglcontextlost', e => e.preventDefault()); }); };
// queue the rest of the street so flying between spots never waits on a build
function prime(sp) { if (!sp || sp.primed) return; sp.primed = 1; try { rt = rt || new T.WebGLRenderTarget(32, 32); pcam = pcam || new T.PerspectiveCamera(110, 1, .1, 2500); const vis = {}; for (const k in spots) { vis[k] = spots[k].g.visible; spots[k].g.visible = spots[k] === sp; }
    [[0, 30, 50, -12], [0, 12, -50, 0]].forEach(([x, y, z, lz]) => { pcam.position.set(sp.x + x, y, z); pcam.lookAt(sp.x, 0, lz); R.setRenderTarget(rt); R.render(scene, pcam); }); R.setRenderTarget(null); for (const k in spots) spots[k].g.visible = vis[k]; } catch (e) { R.setRenderTarget(null); } }
function warm() { if (Math.abs(target * S - focus) > .05) return setTimeout(warm, 150); const k = order.find(k => !spots[k]) || order.find(k => !spots[k].primed); if (!k) return; if (!spots[k]) buildSpot(k); else prime(spots[k]); setTimeout(warm, 60); }
V.attach = function (el) { if (!V.ok) return; host = el || null; if (!host) { if (raf) cancelAnimationFrame(raf); raf = 0; return; }
  if (canvas.parentNode !== host) { host.appendChild(canvas); canvas.style.transition = 'none'; canvas.style.opacity = 0; void canvas.offsetWidth; canvas.style.transition = ''; requestAnimationFrame(() => { canvas.style.opacity = 1; }); } mode = host.dataset.mode || 'story'; off = offT = parseFloat(host.dataset.off || 0); size();
  if (host.dataset.scene) V.go(host.dataset.scene, true); if (!raf) raf = requestAnimationFrame(frame); };
V.off = function (f) { offT = f; };
V.go = function (key, snap) { if (!V.ok || !SETS[key]) return; const sp = buildSpot(key), far = Math.abs(sp.idx * S - focus) > S * 2.5; [order[sp.idx - 1], order[sp.idx + 1]].forEach(k => k && buildSpot(k)); target = sp.idx;
  if (snap || far) { if (snap) { focus = target * S; fv = 0; } else { canvas.style.opacity = 0; setTimeout(() => { focus = target * S; fv = 0; prime(spots[order[target]]); canvas.style.opacity = 1; }, 240); } }
  prime(sp); if (!V.warmed) { V.warmed = 1; setTimeout(warm, 300); } };
V.mode = function (m) { mode = m; };
V.grab = function () { if (!V.ok || !host) return null; R.render(scene, cam); return canvas; };
})();
