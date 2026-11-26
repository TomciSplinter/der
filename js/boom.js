// Pyrotechnics: explosions, sparks, smoke, debris, glass shards, shockwave rings, tracers.
import * as THREE from 'three';
import { TEX, rand } from './fx.js';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _v = new THREE.Vector3();

class Pool {
  constructor(scene, geo, mat, n) {
    this.mesh = new THREE.InstancedMesh(geo, mat, n); this.mesh.frustumCulled = false; scene.add(this.mesh);
    this.n = n; this.i = 0; this.P = new Float32Array(n * 3); this.V = new Float32Array(n * 3); this.R = new Float32Array(n * 3); this.W = new Float32Array(n * 3);
    this.L = new Float32Array(n).fill(99); this.T = new Float32Array(n).fill(1); this.S = new Float32Array(n).fill(1);
    _m.makeScale(0, 0, 0); for (let i = 0; i < n; i++) this.mesh.setMatrixAt(i, _m);
  }
  spawn(p, v, life, size = 1) { const i = this.i = (this.i + 1) % this.n, j = i * 3; this.P.set([p.x, p.y, p.z], j); this.V.set([v.x, v.y, v.z], j); this.R.set([rand(0, 6), rand(0, 6), rand(0, 6)], j); this.W.set([rand(-12, 12), rand(-12, 12), rand(-12, 12)], j); this.L[i] = 0; this.T[i] = life; this.S[i] = size; return i; }
  update(dt, g, drag, air, spin = true, stretch = false) {
    for (let i = 0; i < this.n; i++) {
      if (this.L[i] >= this.T[i]) { if (this.L[i] < 90) { this.L[i] = 99; _m.makeScale(0, 0, 0); this.mesh.setMatrixAt(i, _m); } continue; }
      this.L[i] += dt; const j = i * 3, k = 1 - this.L[i] / this.T[i];
      this.V[j + 1] -= g * dt; this.V[j] *= 1 - drag * dt; this.V[j + 1] *= 1 - drag * dt; this.V[j + 2] += (air - this.V[j + 2]) * drag * dt;
      this.P[j] += this.V[j] * dt; this.P[j + 1] += this.V[j + 1] * dt; this.P[j + 2] += this.V[j + 2] * dt;
      if (spin) { this.R[j] += this.W[j] * dt; this.R[j + 1] += this.W[j + 1] * dt; this.R[j + 2] += this.W[j + 2] * dt; }
      const sc = this.S[i] * Math.max(0, k);
      _m.compose(_v.set(this.P[j], this.P[j + 1], this.P[j + 2]), _q.setFromEuler(_e.set(this.R[j], this.R[j + 1], this.R[j + 2])), _s.set(sc, sc * (stretch ? 1 : 1), sc));
      this.mesh.setMatrixAt(i, _m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

export class Boom {
  constructor(scene, { air = 0 } = {}) {
    this.scene = scene; this.air = air;
    const add = (c) => new THREE.MeshBasicMaterial({ color: c, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
    this.sparks = new Pool(scene, new THREE.PlaneGeometry(.09, .09), add(0xffd890), 360);
    this.debris = new Pool(scene, new THREE.IcosahedronGeometry(.07, 0), new THREE.MeshLambertMaterial({ color: 0x1c1612 }), 90);
    this.shards = new Pool(scene, new THREE.PlaneGeometry(.12, .07), new THREE.MeshBasicMaterial({ color: 0xdff3ff, transparent: true, opacity: .85, side: THREE.DoubleSide, fog: false }), 140);
    this.fire = []; this.smoke = []; this.rings = [];
    for (let i = 0; i < 36; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, color: 0xff8a30, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false })); s.visible = false; scene.add(s); this.fire.push({ s, l: 99, t: 1, v: new THREE.Vector3(), r: 1 }); }
    for (let i = 0; i < 70; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.puff, color: 0x2a2626, depthWrite: false, transparent: true, opacity: .8 })); s.visible = false; scene.add(s); this.smoke.push({ s, l: 99, t: 1, v: new THREE.Vector3(), r: 1, o: .8 }); }
    for (let i = 0; i < 4; i++) { const m = new THREE.Mesh(new THREE.RingGeometry(.82, 1, 24), add(0xffd090)); m.visible = false; scene.add(m); this.rings.push({ m, l: 99, t: .45, r: 4 }); }
    this.light = new THREE.PointLight(0xff9a40, 0, 30, 1.2); scene.add(this.light);
    this.tracers = [];
    for (let i = 0; i < 6; i++) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3)); const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xffe8a0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); l.visible = false; l.frustumCulled = false; scene.add(l); this.tracers.push({ l, t: 0 }); }
    this.fi = 0; this.si = 0; this.ri = 0; this.ti = 0;
  }
  puffFire(p, v, size, life) { const f = this.fire[this.fi = (this.fi + 1) % this.fire.length]; f.s.position.copy(p); f.v.copy(v); f.l = 0; f.t = life; f.r = size; f.s.visible = true; f.s.material.color.setHSL(rand(.02, .09), 1, rand(.5, .62)); f.s.material.map = Math.random() < .5 ? TEX.flame : TEX.glow; }
  puffSmoke(p, v, size, life, dark = .16, op = .75) { const f = this.smoke[this.si = (this.si + 1) % this.smoke.length]; f.s.position.copy(p); f.v.copy(v); f.l = 0; f.t = life; f.r = size; f.o = op; f.s.visible = true; f.s.material.color.setScalar(dark); f.s.material.rotation = rand(0, 6); }
  ring(p, size, cam) { const r = this.rings[this.ri = (this.ri + 1) % this.rings.length]; r.m.position.copy(p); r.l = 0; r.r = size; r.m.visible = true; if (cam) r.m.quaternion.copy(cam.quaternion); }
  // big festive explosion
  explode(p, k = 1, cam) {
    for (let i = 0; i < 12; i++) this.puffFire(_v.set(p.x + rand(-.5, .5) * k, p.y + rand(-.3, .5) * k, p.z + rand(-.5, .5) * k), new THREE.Vector3(rand(-2.5, 2.5), rand(0, 3.5), rand(-2.5, 2.5)).multiplyScalar(k), rand(2.6, 4.4) * k, rand(.4, .75));
    for (let i = 0; i < 9; i++) this.puffSmoke(_v.set(p.x + rand(-.5, .5) * k, p.y + rand(-.2, .6) * k, p.z + rand(-.5, .5) * k), new THREE.Vector3(rand(-1.5, 1.5), rand(.6, 2.2), rand(-1.5, 1.5)), rand(2, 3.2) * k, rand(1.6, 2.6));
    for (let i = 0; i < 46; i++) this.sparks.spawn(p, _s.set(rand(-1, 1), rand(-.4, 1.2), rand(-1, 1)).normalize().multiplyScalar(rand(5, 13) * k), rand(.5, 1.1), rand(.8, 1.6));
    for (let i = 0; i < 14; i++) this.debris.spawn(p, _s.set(rand(-1, 1), rand(0, 1.3), rand(-1, 1)).normalize().multiplyScalar(rand(4, 9) * k), rand(1.2, 2), rand(.7, 1.6) * k);
    this.ring(p, 3.2 * k, cam);
    for (let i = 0; i < 4; i++) { this.puffFire(_v.set(p.x + rand(-.2, .2) * k, p.y + rand(-.1, .3) * k, p.z + rand(-.2, .2) * k), new THREE.Vector3(rand(-1, 1), rand(.5, 2), rand(-1, 1)), rand(1.6, 2.4) * k, rand(.25, .4)); this.fire[this.fi].s.material.color.set(0xfff0b0); } this.light.position.copy(p); this.light.intensity = 180 * k; this.flashT = .25;
  }
  impact(p, n = 14) { for (let i = 0; i < n; i++) this.sparks.spawn(p, _s.set(rand(-1, 1), rand(-.3, 1), rand(-1, 1)).normalize().multiplyScalar(rand(3, 8)), rand(.25, .6), rand(.6, 1.1)); this.puffSmoke(p, new THREE.Vector3(0, .6, 0), 1.1, .9, .35, .6); }
  glass(p, dir, n = 60) { for (let i = 0; i < n; i++) this.shards.spawn(p, _s.set(dir.x + rand(-.8, .8), dir.y + rand(-.4, .9), dir.z + rand(-.8, .8)).normalize().multiplyScalar(rand(2, 6)), rand(.8, 1.6), rand(.5, 1.3)); }
  tracer(a, b) { const t = this.tracers[this.ti = (this.ti + 1) % this.tracers.length]; const p = t.l.geometry.attributes.position; p.setXYZ(0, a.x, a.y, a.z); p.setXYZ(1, b.x, b.y, b.z); p.needsUpdate = true; t.l.visible = true; t.t = .07; }
  update(dt, cam) {
    const air = this.air;
    this.sparks.update(dt, 7, 1.2, air * .7); this.debris.update(dt, 11, .6, air * .5); this.shards.update(dt, 7, .8, air * .5);
    for (const f of this.fire) { if (f.l >= f.t) { if (f.s.visible) f.s.visible = false; continue; } f.l += dt; const k = f.l / f.t; f.s.position.addScaledVector(f.v, dt); f.s.position.z += air * .55 * dt; f.v.multiplyScalar(1 - dt * 3); f.s.scale.setScalar(f.r * (.35 + k * .9)); f.s.material.opacity = 1 - k; }
    for (const f of this.smoke) { if (f.l >= f.t) { if (f.s.visible) f.s.visible = false; continue; } f.l += dt; const k = f.l / f.t; f.s.position.addScaledVector(f.v, dt); f.s.position.z += air * .6 * dt; f.v.multiplyScalar(1 - dt * .8); f.s.scale.setScalar(f.r * (.45 + k * 1.1)); f.s.material.opacity = f.o * (1 - k) * Math.min(1, f.l * 6); }
    for (const r of this.rings) { if (r.l >= r.t) { if (r.m.visible) r.m.visible = false; continue; } r.l += dt; const k = r.l / r.t; r.m.scale.setScalar(.2 + k * r.r); r.m.material.opacity = (1 - k) * .35; if (cam) r.m.quaternion.copy(cam.quaternion); r.m.position.z += air * .5 * dt; }
    for (const t of this.tracers) if (t.l.visible) { t.t -= dt; if (t.t <= 0) t.l.visible = false; }
    if (this.flashT > 0) { this.flashT -= dt; this.light.intensity *= Math.exp(-dt * 12); if (this.flashT <= 0) this.light.intensity = 0; }
  }
}

// bullet holes + spider-web cracks drawn on a 2D canvas (screen overlay or the TV glass)
export function drawCrack(g, x, y, R, seed = Math.random()) {
  let s = seed * 1e4; const rnd = () => (s = (s * 16807 + 11) % 2147483647) / 2147483647;
  g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
  const rays = 9 + (rnd() * 6 | 0), pts = [];
  for (let i = 0; i < rays; i++) {
    const a = i / rays * Math.PI * 2 + rnd() * .5, len = R * (.45 + rnd() * .65); let px = x, py = y; const ray = [[px, py]];
    const segs = 4 + (rnd() * 3 | 0);
    for (let k = 1; k <= segs; k++) { const d = len * k / segs, aa = a + (rnd() - .5) * .35; px = x + Math.cos(aa) * d; py = y + Math.sin(aa) * d; ray.push([px, py]); }
    pts.push(ray);
  }
  const stroke = (w, c, off) => { g.strokeStyle = c; g.lineWidth = w; for (const r of pts) { g.beginPath(); g.moveTo(r[0][0] + off, r[0][1] + off); for (const p of r) g.lineTo(p[0] + off, p[1] + off); g.stroke(); }
    for (const f of [.28, .52, .78]) { g.beginPath(); pts.forEach((r, i) => { const p = r[Math.max(1, Math.round(f * (r.length - 1)))]; if (i === 0) g.moveTo(p[0] + off, p[1] + off); else g.lineTo(p[0] + off, p[1] + off); }); g.closePath(); g.globalAlpha = .55; g.stroke(); g.globalAlpha = 1; } };
  stroke(Math.max(1.5, R / 70), 'rgba(0,0,0,.45)', Math.max(1, R / 120)); stroke(Math.max(1, R / 110), 'rgba(235,245,255,.9)', 0);
  const hr = Math.max(4, R * .07); const gr = g.createRadialGradient(x, y, 0, x, y, hr * 1.8); gr.addColorStop(0, 'rgba(0,0,0,.95)'); gr.addColorStop(.55, 'rgba(20,20,25,.9)'); gr.addColorStop(.7, 'rgba(240,248,255,.85)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.beginPath(); g.arc(x, y, hr * 1.8, 0, 7); g.fill();
  g.restore();
}
