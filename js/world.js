// The sleigh chase: endless snowy town at night, stolen jet sleigh, police chopper, money trail.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { psx, lambertize, TEX, rand, clamp, lerp, damp, ease } from './fx.js';
import { Boom } from './boom.js';
import { Der } from './der.js';

export const ALT = 32;
const TL = 30, NT = 14, Z_NEAR = 70;
const _cp = new THREE.Vector3(), _cl = new THREE.Vector3(), _t1 = new THREE.Vector3(), _t2 = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _v = new THREE.Vector3(), _w = new THREE.Vector3(), _u = new THREE.Vector3();
const KEYS = {
  home: { p: [2.0, 2.3, -5.3], l: [.9, 2.0, 3.0], fov: 52, off: 0, offY: 0 },
  about: { p: [-2.25, 1.7, -2.85], l: [0, 1.32, .3], fov: 40, off: .2, offY: -.22 },
  memes: { p: [3.4, 2.1, 5.6], l: [0, 1.6, -2.2], fov: 50, off: .2, offY: -.25 },
  land: { p: [-13, 8, 25], l: [0, 1.2, -6], fov: 60, off: 0, offY: 0 },
};

// HOME opens on Der dancing while the chopper closes in, then the scripted chase:
// camera cuts, the cop's coal bombs, Der firing back
const HELI_FAR = [8, 14, 110];
const SHOTS = {
  danceFront: { p: [.35, 1.35, -3.3], l: [.05, 1.75, 4.0], fov: 46 },
  frontWide: { p: [2.0, 2.3, -5.3], l: [.9, 2.0, 3.0], fov: 52 },
  front: { p: [.72, 1.72, -2.25], l: [0, 1.5, .3], fov: 42 },
  side: { p: [-7.8, 2.6, .4], l: [2.4, 2.1, 2.6], fov: 50 },
  ots: { fov: 46 }, copFace: { fov: 40 },
};
// first scene after landing, played once: Der dances, seen from the front, as the chopper flies in from far behind him;
// then one continuous camera move ('push') carries on into the chase. Scrolling starts or speeds up the push.
const INTRO = [
  [0, 'cut', 'danceFront'], [0, 'der', 'dance'], [0, 'heliAt', HELI_FAR], [.1, 'heliFly', [1.0, 5.5, 14], 5.1], [.2, 'siren', 5.2],
  [5.4, 'push'],
];
const PUSH_TIME = 1.7;
const SCRIPT = [
  [0, 'cut', 'frontWide'], [0, 'heli', [6.5, 3.4, 9.5]],
  [3.4, 'cut', 'front'], [3.9, 'dershoot'],
  [5.2, 'cut', 'side'], [5.2, 'heli', [5.3, 2.3, 3.0]], [5.3, 'cop', 'taunt'],
  [6.7, 'throw', [-2.8, .9, -2.2], 'dodge'],
  [8.7, 'cut', 'ots'], [8.7, 'shootback'],
  [11.6, 'cut', 'frontWide'], [11.6, 'heli', [8.5, 5.2, 13.5]],
  [13.8, 'cut', 'copFace'], [13.8, 'heli', [6.0, 2.9, 6.4]], [13.9, 'cop', 'taunt'],
  [15.2, 'throw', [1.9, .2, 2.7], 'react'],
  [15.9, 'cut', 'front'],
  [19.6, 'cut', 'side'], [19.6, 'heli', [7.2, 3.8, 10]],
  [23, 'loop'],
];
function angTo(a, b, k) { let d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; return a + d * k; }
// camera moves between sections swing round Der instead of passing through his head
function orbit(out, a, b, k) {
  const aa = Math.atan2(a.z, a.x), ab = Math.atan2(b.z, b.x), ang = angTo(aa, ab, k), span = Math.abs(angTo(aa, ab, 1) - aa);
  const r = lerp(Math.hypot(a.x, a.z), Math.hypot(b.x, b.z), k) + Math.sin(Math.PI * k) * Math.min(1.6, span * .7);
  return out.set(Math.cos(ang) * r, lerp(a.y, b.y, k) + Math.sin(Math.PI * k) * span * .25, Math.sin(ang) * r);
}

function emissiveFromMap(map) {
  const img = map.image; const w = Math.min(512, img.width), h = Math.min(512, img.height);
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.drawImage(img, 0, 0, w, h);
  const d = g.getImageData(0, 0, w, h), p = d.data;
  for (let i = 0; i < p.length; i += 4) {
    const r = p[i], gg = p[i + 1], b = p[i + 2], mx = Math.max(r, gg, b), mn = Math.min(r, gg, b), sat = mx - mn;
    const warm = r > 170 && gg > 130 && b < 120 && r - b > 90;
    const bulb = mx > 200 && sat > 120;
    if (warm || bulb) { p[i] = r; p[i + 1] = gg; p[i + 2] = b; } else { p[i] = p[i + 1] = p[i + 2] = 0; }
  }
  g.putImageData(d, 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.flipY = map.flipY; t.magFilter = THREE.NearestFilter; return t;
}
function firstMesh(root) { let m; root.traverse(o => { if (!m && o.isMesh) m = o; }); return m; }
// float copy of a (possibly quantized) glTF mesh geometry with its node transform baked in
function bake(mesh, root) {
  root.updateMatrixWorld(true); const src = mesh.geometry, g = new THREE.BufferGeometry();
  for (const k of ['position', 'normal', 'uv']) { const a = src.attributes[k]; if (!a) continue; const f = new Float32Array(a.count * a.itemSize);
    for (let i = 0; i < a.count; i++) for (let c = 0; c < a.itemSize; c++) f[i * a.itemSize + c] = a.getComponent(i, c);
    g.setAttribute(k, new THREE.BufferAttribute(f, a.itemSize)); }
  if (src.index) g.setIndex(Array.from(src.index.array));
  _m.copy(root.matrixWorld).invert().multiply(mesh.matrixWorld); g.applyMatrix4(_m); return g;
}

function pineGeo() {
  const parts = [];
  const col = (g, top, bot) => { const n = g.attributes.position.count, c = new Float32Array(n * 3); g.computeBoundingBox(); const y0 = g.boundingBox.min.y, y1 = g.boundingBox.max.y;
    for (let i = 0; i < n; i++) { const u = (g.attributes.position.getY(i) - y0) / (y1 - y0 || 1); const k = u > .55 ? 1 : 0; c.set([lerp(bot[0], top[0], k), lerp(bot[1], top[1], k), lerp(bot[2], top[2], k)], i * 3); } g.setAttribute('color', new THREE.BufferAttribute(c, 3)); return g; };
  [[2.4, 3, 2.2], [1.85, 2.7, 3.7], [1.2, 2.3, 5.1]].forEach(([r, h, y]) => { const g = new THREE.ConeGeometry(r, h, 7, 1).toNonIndexed(); g.translate(0, y, 0); parts.push(col(g, [.82, .88, .98], [.05, .19, .12])); });
  const tr = new THREE.CylinderGeometry(.3, .4, 1.4, 5).toNonIndexed(); tr.translate(0, .7, 0); parts.push(col(tr, [.22, .12, .06], [.22, .12, .06]));
  parts.forEach(g => { g.deleteAttribute('uv'); });
  return mergeGeometries(parts);
}

export class World {
  constructor(A) {
    const S = this.scene = new THREE.Scene();
    this.fogC = new THREE.Color(0x33425e); S.fog = new THREE.FogExp2(this.fogC, .0052); S.background = this.fogC.clone();
    this.cam = new THREE.PerspectiveCamera(55, 1, .1, 3000);
    this.feedCam = new THREE.PerspectiveCamera(34, 4 / 3, .5, 3000);
    this.t = 0; this.speed = 24; this.cash = 1225000; this.boost = 0; this.boostT = 0; this.boostHold = 0; this.alt = ALT; this.altT = ALT; this.high = 0;
    this.rig = new THREE.Group(); this.rig.position.y = ALT; S.add(this.rig);
    this.camCur = { ...KEYS.home, p: new THREE.Vector3(...KEYS.home.p), l: new THREE.Vector3(...KEYS.home.l) };
    this.camFrom = null; this.camTo = 'home'; this.camK = 1; this.camDur = 1.6;
    this.busy = false; this.events = [];

    /* light */
    this.moonDir = new THREE.Vector3(.45, .42, -1).normalize();
    const moon = new THREE.DirectionalLight(0xb8c8ff, 1.5); moon.position.copy(this.moonDir).multiplyScalar(100); S.add(moon); S.add(moon.target);
    S.add(new THREE.HemisphereLight(0x5a6aa8, 0x1a1a2a, 1.25));
    this.heliOff = new THREE.Vector3(8.5, 5, 13); this.heliT = this.heliOff.clone(); this.heliDmg = 0; this.heliShake = 0; this.heliRoll = 0; this.heliDrop = 0; this.smokeAcc = 0;
    this.heliMove = null; this.hk = -1; this.push = null; this.smoothCut = false;
    this.shake = 0; this.act = null; this.shot = 'frontWide'; this.shotT = 0; this.derYawT = Math.PI; this.bombs = []; this.sfx = null; this.cutGlitch = 0;
    this.buildSky(); this.buildGround(); this.buildTown(A); this.buildSleigh(A); this.buildHeli(A); this.buildParticles();
    this.boom = new Boom(S);
    for (let i = 0; i < 3; i++) { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(.2, 0), new THREE.MeshBasicMaterial({ color: 0x161212 })); const g = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, color: 0xff7a20, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false })); g.scale.setScalar(1.1); m.add(g); m.visible = false; S.add(m); this.bombs.push({ m, on: false }); }
  }

  /* ---------- sky ---------- */
  buildSky() {
    const S = this.scene; this.sky = new THREE.Group(); S.add(this.sky);
    this.skyU = { uMoon: { value: this.moonDir }, uHigh: { value: 0 } };
    const dome = new THREE.Mesh(new THREE.SphereGeometry(1800, 24, 12), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false, uniforms: this.skyU,
      vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); gl_Position.z = gl_Position.w * .9999; }',
      fragmentShader: `varying vec3 vD; uniform vec3 uMoon; uniform float uHigh;
        void main(){ float y = vD.y; vec3 hor = mix(vec3(.034,.052,.11), vec3(.05,.03,.12), uHigh * .5), mid = vec3(.011,.018,.048), zen = vec3(.002,.004,.012);
          vec3 c = mix(hor, mid, smoothstep(-.06, .28, y)); c = mix(c, zen, smoothstep(.28, .95, y));
          float m = max(dot(vD, uMoon), 0.); c += vec3(.25, .28, .4) * (pow(m, 60.) * .5 + pow(m, 7.) * .06);
          gl_FragColor = vec4(c, 1.); }` }));
    dome.renderOrder = -10; this.sky.add(dome);
    const n = 1400, sp = new Float32Array(n * 3), ph = new Float32Array(n);
    for (let i = 0; i < n; i++) { const a = rand(0, 6.283), y = rand(.04, 1); const r = Math.sqrt(1 - y * y); sp.set([Math.cos(a) * r * 1700, y * 1700, Math.sin(a) * r * 1700], i * 3); ph[i] = rand(0, 100); }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3)); sg.setAttribute('ph', new THREE.BufferAttribute(ph, 1));
    this.starU = { uTime: { value: 0 }, uSize: { value: 2 } };
    const stars = new THREE.Points(sg, new THREE.ShaderMaterial({ uniforms: this.starU, transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending,
      vertexShader: 'attribute float ph; uniform float uTime, uSize; varying float vA; void main(){ vA = .55 + .45 * sin(uTime * (1.5 + fract(ph) * 3.) + ph); gl_PointSize = uSize * (ph > 96. ? 2. : 1.); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); gl_Position.z = gl_Position.w * .9998; }',
      fragmentShader: 'varying float vA; void main(){ gl_FragColor = vec4(vec3(.9, .95, 1.) * vA, 1.); }' }));
    stars.renderOrder = -9; this.sky.add(stars);
    const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.moon, fog: false, depthWrite: false, transparent: true })); moon.position.copy(this.moonDir).multiplyScalar(1500); moon.scale.setScalar(260); moon.renderOrder = -8; this.sky.add(moon);
    // aurora
    const ag = new THREE.PlaneGeometry(2400, 420, 80, 1); const ap = ag.attributes.position;
    for (let i = 0; i < ap.count; i++) { const x = ap.getX(i); ap.setZ(i, -Math.cos(x / 1300) * 380); }
    this.auroraU = { uTime: { value: 0 }, uVis: { value: .3 } };
    const au = new THREE.Mesh(ag, new THREE.ShaderMaterial({ uniforms: this.auroraU, transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); gl_Position.z = gl_Position.w * .9997; }',
      fragmentShader: `uniform float uTime, uVis; varying vec2 vUv;
        void main(){ float x = vUv.x * 9. + sin(vUv.x * 23. + uTime * .3) * .6; float band = .5 + .5 * sin(x * 4. + uTime * .7 + sin(x * 1.3 - uTime * .4) * 2.);
          float a = smoothstep(0., .25, vUv.y) * smoothstep(1., .35, vUv.y) * (.35 + .65 * band) * smoothstep(0., .15, vUv.x) * smoothstep(1., .85, vUv.x);
          vec3 c = mix(vec3(.1, 1., .45), vec3(.65, .25, 1.), smoothstep(.45, 1., vUv.y));
          gl_FragColor = vec4(c * a * uVis * .5, 1.); }` }));
    au.position.set(0, 420, -1150); au.renderOrder = -7; this.sky.add(au);
    // mountains ring (static, far)
    const mg = [];
    for (let i = 0; i < 46; i++) { const a = i / 46 * 6.283 + rand(-.05, .05), d = rand(900, 1200), h = rand(140, 340), r = rand(160, 300);
      const g = new THREE.ConeGeometry(r, h, 6, 1).toNonIndexed(); g.translate(Math.cos(a) * d, h / 2 - 20, Math.sin(a) * d - 300);
      const n2 = g.attributes.position.count, c = new Float32Array(n2 * 3); for (let k = 0; k < n2; k++) { const top = g.attributes.position.getY(k) > h * .6; c.set(top ? [.55, .6, .72] : [.05, .07, .12], k * 3); }
      g.setAttribute('color', new THREE.BufferAttribute(c, 3)); g.deleteAttribute('uv'); mg.push(g); }
    this.mountains = new THREE.Mesh(mergeGeometries(mg), new THREE.MeshBasicMaterial({ vertexColors: true })); this.scene.add(this.mountains);
  }

  /* ---------- ground + roads ---------- */
  buildGround() {
    const S = this.scene;
    this.snowT = TEX.snow.clone(); this.snowT.repeat.set(1400 / 16, 1400 / 16); this.snowT.needsUpdate = true;
    const g = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), psx(new THREE.MeshLambertMaterial({ map: this.snowT }))); g.rotation.x = -Math.PI / 2; g.position.set(0, 0, -500); S.add(g);
    this.roadT = TEX.road.clone(); this.roadT.repeat.set(1, 1400 / 16); this.roadT.needsUpdate = true;
    const r = new THREE.Mesh(new THREE.PlaneGeometry(14, 1400), psx(new THREE.MeshLambertMaterial({ map: this.roadT }))); r.rotation.x = -Math.PI / 2; r.position.set(0, .05, -500); S.add(r);
  }

  /* ---------- instanced town: houses, pines, lamps, cross streets ---------- */
  buildTown(A) {
    const S = this.scene;
    const hm = firstMesh(A.house.scene); const hgeo = bake(hm, A.house.scene); hgeo.computeBoundingBox(); hgeo.translate(0, -hgeo.boundingBox.min.y, 0);
    const hmat = psx(new THREE.MeshLambertMaterial({ map: hm.material.map, emissiveMap: emissiveFromMap(hm.material.map), emissive: 0xffffff, emissiveIntensity: 1.25, side: THREE.DoubleSide }));
    hmat.map.magFilter = THREE.NearestFilter;
    this.houses = new THREE.InstancedMesh(hgeo, hmat, NT * 10); this.houses.frustumCulled = false; S.add(this.houses);
    this.pines = new THREE.InstancedMesh(pineGeo(), psx(new THREE.MeshLambertMaterial({ vertexColors: true })), NT * 16); this.pines.frustumCulled = false; S.add(this.pines);
    this.poles = new THREE.InstancedMesh(new THREE.BoxGeometry(.2, 6.5, .2).translate(0, 3.25, 0), psx(new THREE.MeshLambertMaterial({ color: 0x20242c })), NT * 4); this.poles.frustumCulled = false; S.add(this.poles);
    const crossT = TEX.road.clone(); crossT.repeat.set(1, 240 / 16); crossT.needsUpdate = true;
    this.cross = new THREE.InstancedMesh(new THREE.PlaneGeometry(10, 240).rotateZ(Math.PI / 2).rotateX(-Math.PI / 2), psx(new THREE.MeshLambertMaterial({ map: crossT })), NT); this.cross.frustumCulled = false; S.add(this.cross);
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NT * 4 * 3), 3));
    this.lampGlow = new THREE.Points(lg, new THREE.PointsMaterial({ size: 2.6, map: TEX.glow, color: 0xffcf7a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); this.lampGlow.frustumCulled = false; S.add(this.lampGlow);
    const rng = (seed) => () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    this.tiles = [];
    for (let i = 0; i < NT; i++) this.tiles.push(this.genTile({ z: Z_NEAR - (i + 1) * TL, id: i }, rng(1000 + i * 77)));
    // plaza: big town tree with lights
    this.plaza = new THREE.Group(); S.add(this.plaza);
    const big = A.tree.scene.clone(true); big.traverse(o => { if (o.isMesh) o.material = o.material.clone(); }); lambertize(big, { side: THREE.DoubleSide, emissive: 0xffffff, emissiveIntensity: .35 }); big.scale.setScalar(16); big.position.y = 8; this.plaza.add(big);
    const n = 90, pp = new Float32Array(n * 3), pc = new Float32Array(n * 3); const pal = [[1, .25, .2], [.25, 1, .4], [1, .85, .3], [.4, .6, 1], [1, 1, .9]];
    for (let i = 0; i < n; i++) { const h = rand(.08, .9), r = (1 - h) * 5.2 + .3, a = rand(0, 6.28); pp.set([Math.cos(a) * r, h * 15.5, Math.sin(a) * r], i * 3); pc.set(pal[i % 5], i * 3); }
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pp, 3)); pg.setAttribute('color', new THREE.BufferAttribute(pc, 3));
    this.plazaLights = new THREE.Points(pg, new THREE.PointsMaterial({ size: 1.1, map: TEX.glow, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); this.plaza.add(this.plazaLights);
    const ring = new THREE.Mesh(new THREE.CircleGeometry(11, 16), psx(new THREE.MeshLambertMaterial({ color: 0xd8e2f4 }))); ring.rotation.x = -Math.PI / 2; ring.position.y = .08; this.plaza.add(ring);
    this.writeTown();
  }
  genTile(tile, rnd = Math.random) {
    const R = (a, b) => a + rnd() * (b - a); const plaza = tile.id === 3;
    tile.houses = []; tile.pines = []; tile.lamps = [];
    for (const side of [-1, 1]) {
      for (const [x, n] of [[17, 2], [39, 2], [63, 1]]) {
        if (plaza && side < 0 && x < 50) continue;
        for (let k = 0; k < n; k++) tile.houses.push({ x: side * (x + R(-1.5, 1.5)), z: (k + .5) * TL / n + R(-2, 2), r: side < 0 ? Math.PI / 2 : -Math.PI / 2, s: R(8, 10.5), c: new THREE.Color().setHSL(R(0, 1), R(0, .25), R(.75, 1)) });
      }
      for (let k = 0; k < 8; k++) { const x = side * (k < 3 ? R(25, 31) : k < 6 ? R(47, 56) : R(70, 110)); tile.pines.push({ x, z: R(0, TL), s: R(.7, 1.5), r: R(0, 6) }); }
      tile.lamps.push({ x: side * 8.4, z: 4 }, { x: side * 8.4, z: 19 });
    }
    return tile;
  }
  writeTown() {
    let hi = 0, pi = 0, li = 0; const lp = this.lampGlow.geometry.attributes.position;
    for (let t = 0; t < NT; t++) {
      const tile = this.tiles[t];
      for (const h of tile.houses) { _m.compose(_v.set(h.x, 0, tile.z + h.z), _q.setFromEuler(_e.set(0, h.r, 0)), _s.setScalar(h.s)); this.houses.setMatrixAt(hi, _m); this.houses.setColorAt(hi, h.c); hi++; }
      for (const p of tile.pines) { _m.compose(_v.set(p.x, 0, tile.z + p.z), _q.setFromEuler(_e.set(0, p.r, 0)), _s.setScalar(p.s)); this.pines.setMatrixAt(pi++, _m); }
      for (const l of tile.lamps) { _m.compose(_v.set(l.x, 0, tile.z + l.z), _q.identity(), _s.setScalar(1)); this.poles.setMatrixAt(li, _m); lp.setXYZ(li, l.x, 6.6, tile.z + l.z); li++; }
      _m.compose(_v.set(0, .04, tile.z), _q.identity(), _s.setScalar(1)); this.cross.setMatrixAt(t, _m);
      if (tile.id === 3) this.plaza.position.set(-27, 0, tile.z + TL / 2);
    }
    this.houses.count = hi; this.pines.count = pi; this.poles.count = li;
    this.houses.instanceMatrix.needsUpdate = true; if (this.houses.instanceColor) this.houses.instanceColor.needsUpdate = true;
    this.pines.instanceMatrix.needsUpdate = true; this.poles.instanceMatrix.needsUpdate = true; this.cross.instanceMatrix.needsUpdate = true; lp.needsUpdate = true;
  }

  /* ---------- sleigh rig ---------- */
  buildSleigh(A) {
    const sl = this.sleigh = A.sleigh.scene; lambertize(sl, { side: THREE.DoubleSide, emissive: 0xffffff, emissiveIntensity: .12 }); sl.scale.setScalar(3.2); sl.rotation.y = Math.PI; this.rig.add(sl);
    // money sack
    const sg = new THREE.IcosahedronGeometry(.55, 1); const p = sg.attributes.position;
    for (let i = 0; i < p.count; i++) { _v.fromBufferAttribute(p, i); _v.multiplyScalar(1 + rand(-.08, .08)); _v.y *= .85; p.setXYZ(i, _v.x, _v.y, _v.z); } sg.computeVertexNormals();
    const sack = this.sack = new THREE.Mesh(sg, psx(new THREE.MeshLambertMaterial({ map: TEX.burlap, flatShading: true }))); sack.position.set(-.62, .22, 1.0); sack.scale.setScalar(.8); this.rig.add(sack);
    const bm = psx(new THREE.MeshLambertMaterial({ map: TEX.bill, side: THREE.DoubleSide, emissive: 0x111a11 }));
    for (let i = 0; i < 7; i++) { const b = new THREE.Mesh(new THREE.PlaneGeometry(.36, .16), bm); b.position.set(-.62 + rand(-.2, .2), .6 + rand(0, .08), 1.0 + rand(-.16, .16)); b.rotation.set(rand(-1, 1), rand(0, 3), rand(-.6, .6)); this.rig.add(b); }
    // jet flames
    this.flames = [];
    const outer = new THREE.ConeGeometry(.26, 1.6, 10, 1, true).rotateX(Math.PI / 2).translate(0, 0, .8);
    const inner = new THREE.ConeGeometry(.13, .9, 8, 1, true).rotateX(Math.PI / 2).translate(0, 0, .45);
    const fo = new THREE.MeshBasicMaterial({ color: 0xff8a2a, transparent: true, opacity: .85, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
    const fi = new THREE.MeshBasicMaterial({ color: 0xcfe8ff, transparent: true, opacity: .9, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
    for (const s of [-1, 1]) { const g = new THREE.Group(); g.position.set(s * .96, .4, 1.62); g.add(new THREE.Mesh(outer, fo), new THREE.Mesh(inner, fi));
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, color: 0xffa050, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false })); glow.scale.setScalar(1.3); g.add(glow); this.rig.add(g); this.flames.push(g); }
    this.jetL = new THREE.PointLight(0xff8a3a, 8, 14, 1.2); this.jetL.position.set(0, .8, 2.4); this.rig.add(this.jetL);
    const fill = new THREE.PointLight(0xffd9b0, 1.8, 9, 1.2); fill.position.set(1.5, 2.6, -2.2); this.rig.add(fill);
    this.muzzle = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.burst, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false })); this.muzzle.scale.setScalar(.7); this.muzzle.visible = false; this.scene.add(this.muzzle);
    this.muzzleL = new THREE.PointLight(0xffd080, 0, 8, 1.4); this.scene.add(this.muzzleL);
  }
  attachDer(der) {
    this.der = der; der.root.position.set(0, -.27, .1); der.root.rotation.set(0, Math.PI, 0); der.root.scale.setScalar(1.1); this.rig.add(der.root);
    der.off.position.set(0, 0, 0); der.offK = 1;
    this.scene.add(der.gun); this.scene.add(der.shotgun); der.gun.visible = true; der.shotgun.visible = true;
  }

  /* ---------- police chopper ---------- */
  buildHeli(A) {
    const h = this.heli = new THREE.Group(); this.scene.add(h);
    const body = this.heliBody = new THREE.Group(); h.add(body);
    const m = A.heli.scene; lambertize(m, { side: THREE.DoubleSide, emissive: 0xffffff, emissiveIntensity: .16 }); m.scale.setScalar(9); m.rotation.y = Math.PI; body.add(m);
    const rm = new THREE.MeshBasicMaterial({ map: TEX.rotor, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    const rotor = this.rotor = new THREE.Mesh(new THREE.CircleGeometry(5, 24), rm); rotor.rotation.x = -Math.PI / 2; rotor.position.set(0, 2.0, -.86); body.add(rotor);
    const tail = this.tailRotor = new THREE.Mesh(new THREE.CircleGeometry(1.05, 14), rm); tail.rotation.y = Math.PI / 2; tail.position.set(-.35, .8, 4.3); body.add(tail);
    this.strobes = [0xff2020, 0x2050ff].map((c, i) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, color: c, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false })); s.position.set(i ? .4 : -.4, 1.45, -1.8); s.scale.setScalar(2.6); body.add(s); return s; });
    this.nose = new THREE.Object3D(); this.nose.position.set(0, -1.5, -3.75); body.add(this.nose);
    this.engine = new THREE.Object3D(); this.engine.position.set(0, 1.5, .9); body.add(this.engine);
    const bg = new THREE.CylinderGeometry(.22, 2.6, 1, 18, 1, true).translate(0, -.5, 0);
    this.beam = new THREE.Mesh(bg, new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
      vertexShader: 'varying vec2 vUv; varying float vF; void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.); vec3 n = normalize(normalMatrix * normal); vF = abs(dot(n, normalize(-mv.xyz))); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'varying vec2 vUv; varying float vF; void main(){ float a = pow(vUv.y, 1.6) * .3 * pow(vF, 1.3); gl_FragColor = vec4(vec3(1., .96, .85) * a, 1.); }' }));
    this.beam.frustumCulled = false; this.scene.add(this.beam);
    const spot = this.spot = new THREE.SpotLight(0xfff0d0, 110, 60, .26, .7, 1.2); this.scene.add(spot); this.scene.add(spot.target);
    const g = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, color: 0xfff4dd, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false })); g.scale.setScalar(3); this.nose.add(g);
    // the cop rides in the open side door
    const cop = this.cop = new Der(A.cop, { inPlace: ['idle', 'throw', 'taunt'] });
    cop.root.position.set(-.98, -1.06, -1.35); cop.root.rotation.y = -Math.PI / 2; cop.root.scale.setScalar(.95); body.add(cop.root);
    cop.model.traverse(o => { if (o.isMesh) o.material.emissive = new THREE.Color(0x10141c); });
    cop.play('idle', { fade: 0 });
    const doorL = new THREE.PointLight(0xffe0b0, 6, 6, 1.4); doorL.position.set(-2.2, .4, -1.35); body.add(doorL);
  }

  /* ---------- particles: snow, clouds, bills, confetti ---------- */
  buildParticles() {
    const S = this.scene;
    const n = 1600, sp = new Float32Array(n * 3); for (let i = 0; i < n; i++) sp.set([rand(-60, 60), rand(-35, 35), rand(-90, 25)], i * 3);
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    this.snow = new THREE.Points(sg, new THREE.PointsMaterial({ size: .22, map: TEX.flake, color: 0xeaf2ff, transparent: true, depthWrite: false, opacity: .95 })); this.snow.frustumCulled = false; S.add(this.snow);
    this.clouds = [];
    const cm = new THREE.SpriteMaterial({ map: TEX.puff, color: 0x8796b8, transparent: true, depthWrite: false, opacity: .85 });
    for (let i = 0; i < 80; i++) { const c = new THREE.Sprite(cm); c.position.set(rand(-260, 260), ALT + rand(70, 96), rand(-520, 80)); c.scale.set(rand(60, 110), rand(30, 50), 1); S.add(c); this.clouds.push(c); }
    // bills
    const NB = this.NB = 240;
    this.bills = new THREE.InstancedMesh(new THREE.PlaneGeometry(.36, .16), psx(new THREE.MeshLambertMaterial({ map: TEX.bill, side: THREE.DoubleSide, emissive: 0x2a3a2a })), NB); this.bills.frustumCulled = false; S.add(this.bills);
    this.bP = new Float32Array(NB * 3); this.bV = new Float32Array(NB * 3); this.bR = new Float32Array(NB * 3); this.bW = new Float32Array(NB * 3); this.bL = new Float32Array(NB).fill(99); this.bi = 0; this.bAcc = 0;
    // confetti
    const NC = this.NC = 260;
    this.conf = new THREE.InstancedMesh(new THREE.PlaneGeometry(.1, .07), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), NC); this.conf.frustumCulled = false; S.add(this.conf);
    this.cP = new Float32Array(NC * 3); this.cV = new Float32Array(NC * 3); this.cR = new Float32Array(NC * 3); this.cL = new Float32Array(NC).fill(99); this.ci = 0;
    const pal = [0xe8261b, 0x1fa85a, 0xffd54a, 0xf4f4f4, 0x6fc0ff]; for (let i = 0; i < NC; i++) this.conf.setColorAt(i, new THREE.Color(pal[i % pal.length]));
    this.hideAll(this.bills, NB); this.hideAll(this.conf, NC);
  }
  hideAll(im, n) { _m.makeScale(0, 0, 0); for (let i = 0; i < n; i++) im.setMatrixAt(i, _m); im.instanceMatrix.needsUpdate = true; }
  spawnBill(p, vx, vy, vz) { const i = this.bi = (this.bi + 1) % this.NB; this.bP.set([p.x, p.y, p.z], i * 3); this.bV.set([vx, vy, vz], i * 3); this.bR.set([rand(0, 6), rand(0, 6), rand(0, 6)], i * 3); this.bW.set([rand(-6, 6), rand(-6, 6), rand(-6, 6)], i * 3); this.bL[i] = 0; }
  spawnConf(p, d) { const i = this.ci = (this.ci + 1) % this.NC; this.cP.set([p.x, p.y, p.z], i * 3); this.cV.set([d.x * rand(4, 10) + rand(-2.5, 2.5), d.y * rand(4, 10) + rand(1, 5), d.z * rand(4, 10) + rand(-2.5, 2.5)], i * 3); this.cR.set([rand(0, 6), rand(0, 6), rand(0, 6)], i * 3); this.cL[i] = 0; }

  /* ---------- stations ---------- */
  setStation(name, dur = 1.6) {
    if (!KEYS[name]) return;
    this.camFrom = { p: this.camCur.p.clone(), l: this.camCur.l.clone(), fov: this.camCur.fov, off: this.camCur.off, offY: this.camCur.offY };
    this.camTo = name; this.camK = 0; this.camDur = dur; this.station = name === 'land' ? 'home' : name;
    if (this.station === 'home') this.later(dur, () => { if (this.station === 'home' && !this.act) { this.startAction(); } }); else this.stopAction();
    this.altT = name === 'memes' ? ALT + 135 : ALT;
    if (name === 'memes') { this.boostT = 1; this.boostHold = 2.6; } else { this.boostT = 0; this.boostHold = 0; }
  }
  land() {
    this.station = 'home'; this.camK = 1; this.altT = ALT; this.boostT = 0; this.startAction(true); this.cut('danceFront');
  }
  later(t, f) { this.events.push({ t: this.t + t, f }); }
  startAction(intro) { this.act = { t: 0, i: 0, s: intro ? INTRO : SCRIPT }; }
  stopAction() { this.act = null; this.push = null; this.heliMove = null; this.heliT.set(8.5, 5, 13); }
  cut(name) { this.shot = name; this.shotT = 0; if (this.smoothCut) this.smoothCut = false; else this.cutGlitch = .12; }
  inIntro() { return !!(this.act && this.act.s === INTRO && this.station === 'home' && this.camK >= 1); }
  startPush() {
    if (this.push || !this.inIntro()) return;
    this.push = { k: 0, kT: 0, p: this.camCur.p.clone(), l: this.camCur.l.clone(), fov: this.camCur.fov };
    const d = this.der; if (d && !this.busy && d.name !== 'idle') d.play('idle', { fade: .7 });
    this.heliMove = null; this.heliT.set(6.5, 3.4, 9.5);
  }
  // scroll input during the opening dance: returns true when it was used to push the camera on
  pushBy(v) { if (!this.inIntro()) return false; this.startPush(); if (this.push) this.push.kT = Math.min(1, this.push.kT + v); return true; }
  runScript(dt) {
    const A = this.act; if (!A) return; A.t += dt;
    while (A.i < A.s.length && A.s[A.i][0] <= A.t) {
      const [, k, a, b] = A.s[A.i++];
      if (k === 'cut') this.cut(a);
      else if (k === 'heli') { this.heliMove = null; this.heliT.set(...a); }
      else if (k === 'heliAt') { this.heliMove = null; this.heliOff.set(...a); this.heliT.set(...a); }
      else if (k === 'heliFly') { this.heliMove = { from: this.heliOff.clone(), to: new THREE.Vector3(...a), t: 0, dur: b }; this.heliT.set(...a); }
      else if (k === 'siren') this.sfx && this.sfx.sirenIn(a);
      else if (k === 'der') { const d = this.der; if (d && !this.busy && d.name !== a) d.play(a, { fade: .5 }); }
      else if (k === 'push') this.startPush();
      else if (k === 'cop') { this.cop.play(a, { fade: .25, once: true }); this.later(2.2, () => { if (this.cop.name === a) this.cop.play('idle', { fade: .4 }); }); }
      else if (k === 'throw') this.throwBomb(a, b);
      else if (k === 'shootback') this.shootHeli();
      else if (k === 'dershoot') this.shoot(() => this.sfx && this.sfx.shot(), () => this.sfx && this.sfx.ching());
      else if (k === 'loop') { A.t = 0; A.i = 0; }
    }
  }
  throwBomb(target, react) {
    const cop = this.cop; cop.play('throw', { from: 1.8, speed: 1.2, once: true, fade: .2 });
    this.later(.67, () => {
      const b = this.bombs.find(x => !x.on); if (!b) return;
      cop.root.updateMatrixWorld(true); cop.hand.getWorldPosition(_v);
      const T = .95, to = this.rig.localToWorld(new THREE.Vector3(...target));
      b.p0 = _v.clone(); b.v = to.clone().sub(_v).divideScalar(T); b.v.y += .5 * 9 * T; b.t = 0; b.T = T; b.to = to; b.on = true; b.m.visible = true; b.react = react;
      this.sfx && this.sfx.whistle(T);
      if (react === 'dodge') this.later(T - .45, () => this.derMove('dodge'));
    });
    this.later(2.1, () => { if (this.cop.name === 'throw') this.cop.play('idle', { fade: .4 }); });
  }
  updateBombs(dt) {
    for (const b of this.bombs) {
      if (!b.on) continue; b.t += dt; const t = Math.min(b.t, b.T);
      b.m.position.set(b.p0.x + b.v.x * t, b.p0.y + b.v.y * t - 4.5 * t * t, b.p0.z + b.v.z * t); b.m.rotation.x += dt * 9; b.m.rotation.y += dt * 7;
      this.boom.puffFire(b.m.position, _w.set(0, 0, 0), .8, .2); if (Math.random() < .5) this.boom.puffSmoke(b.m.position, _w.set(0, .3, 0), .7, .8, .1, .55);
      if (b.t >= b.T) {
        b.on = false; b.m.visible = false; this.boom.explode(b.to, 1.1, this.cam); this.shake = .55; this.sfx && this.sfx.explode(1);
        for (let i = 0; i < 26; i++) this.spawnBill(b.to, rand(-6, 6), rand(2, 9), rand(-5, 5));
        if (b.react === 'react') this.derMove('react');
      }
    }
  }
  derMove(kind) {
    const d = this.der; if (!d || this.busy) return;
    d.play(kind, { fade: .1, once: true, speed: kind === 'dodge' ? 1.1 : 1.3 });
    this.later(kind === 'dodge' ? 1.25 : 2.1, () => { if (d.name === kind) d.play('idle', { fade: .35 }); });
  }
  shootHeli() {
    const d = this.der; if (!d || this.busy) return; this.busy = true;
    this.rig.worldToLocal(_v.copy(this.heli.position)); this.derYawT = Math.atan2(_v.x, _v.z);
    d.play('draw', { from: 1.9, fade: .2 });
    for (const s of [.85, 1.3, 1.75]) this.later(s, () => {
      this.fire(true); const hit = this.heliBody.localToWorld(new THREE.Vector3(rand(-.9, .9), rand(-.5, .7), rand(-2.6, 1.6)));
      d.muzzlePos(_v); this.boom.tracer(_v, hit); this.heliHit(hit); this.sfx && this.sfx.shot();
    });
    this.later(2.45, () => { d.play('idle', { fade: .45 }); this.derYawT = Math.PI; });
    this.later(2.9, () => { this.busy = false; });
  }
  heliHit(p) {
    this.boom.impact(p, 18); this.heliShake = .4; this.heliDmg = Math.min(1, this.heliDmg + .36); this.sfx && this.sfx.clank();
    if (this.heliDmg >= .99 && !this.heliBig) {
      this.heliBig = true; this.engine.getWorldPosition(_u); this.boom.explode(_u, .6, this.cam); this.heliRoll = .55; this.heliDrop = -2.2; this.shake = .35; this.sfx && this.sfx.explode(.6);
      this.later(4, () => { this.heliBig = false; });
    }
  }
  shoot(onShot, onDone) {
    if (this.busy || !this.der) return false; this.busy = true;
    const d = this.der, was = d.name;
    d.play('draw', { from: 1.9, fade: .2 });
    const at = (t, f) => this.events.push({ t: this.t + t, f });
    for (const s of [.85, 1.3, 1.75]) at(s, () => { this.fire(); onShot && onShot(); });
    // back to dancing only if he still should be (memes, or the opening dance)
    at(2.45, () => { const keep = was === 'dance' && (this.station === 'memes' || (this.act && this.act.s === INTRO && !this.push)); d.play(keep ? 'dance' : 'idle', { fade: .45 }); });
    at(2.9, () => { this.busy = false; onDone && onDone(); });
    return true;
  }
  fire(atHeli) {
    const d = this.der; d.muzzlePos(_v); this.muzzle.position.copy(_v); this.muzzle.visible = true; this.muzzle.material.rotation = rand(0, 6); this.muzzleL.position.copy(_v); this.muzzleL.intensity = 60; this.mflash = .07;
    _w.set(0, 1, 0).applyQuaternion(d.gun.quaternion).normalize(); _w.y = Math.max(_w.y, .35); _w.normalize();
    for (let i = 0; i < (atHeli ? 8 : 26); i++) this.spawnConf(_v, _w);
    this.rig.localToWorld(_u.set(0, 1.0, 1.2));
    for (let i = 0; i < 14; i++) this.spawnBill(_u, rand(-4, 4), rand(3, 7), rand(-2, 3));
    this.cash += 25000 + (Math.random() * 9 | 0) * 1000;
  }

  /* ---------- per-frame ---------- */
  update(dt, renderMain) {
    const t = this.t += dt;
    for (let i = this.events.length - 1; i >= 0; i--) if (this.events[i].t <= t) { const e = this.events[i]; this.events.splice(i, 1); e.f(); }
    // boost / altitude
    if (this.boostHold > 0) { this.boostHold -= dt; if (this.boostHold <= 0) this.boostT = .35; }
    this.boost = damp(this.boost, this.boostT, 3, dt);
    this.alt = damp(this.alt, this.altT, this.altT > this.alt ? .9 : 1.2, dt);
    this.high = clamp((this.alt - ALT) / 135, 0, 1);
    const spd = this.speed * (1 + this.boost * .8); this.scroll += spd * dt;
    this.rig.position.y = this.alt + Math.sin(t * 1.3) * .35 + Math.sin(t * .7) * .25;
    this.rig.position.x = Math.sin(t * .23) * 1.6;
    this.rig.rotation.z = Math.sin(t * .23 + 1.2) * .06; this.rig.rotation.x = Math.sin(t * 1.3 + .5) * .015 - this.boost * .06;
    // town scroll
    for (const tile of this.tiles) { tile.z += spd * dt; if (tile.z > Z_NEAR) { tile.z -= NT * TL; this.genTile(tile); } }
    this.writeTown();
    this.snowT.offset.y += spd * dt / 16; this.roadT.offset.y += spd * dt / 16;
    this.plazaLights.material.size = 1.0 + .25 * Math.sin(t * 3);
    for (const c of this.clouds) { c.position.z += spd * dt * .9; if (c.position.z > 90) c.position.z -= 600; }
    // sky follows camera
    this.sky.position.copy(this.cam.position); this.starU.uTime.value = t; this.auroraU.uTime.value = t; this.auroraU.uVis.value = .35 + this.high * .9; this.skyU.uHigh.value = this.high;
    this.scene.fog.density = lerp(.0052, .0016, this.high);
    // jets
    for (const f of this.flames) { const k = 1 + Math.sin(t * 40 + f.position.x) * .12 + rand(-.08, .08); f.scale.set(.7 + this.boost * .6, .7 + this.boost * .6, k * (.6 + this.boost * 2.6)); }
    this.jetL.intensity = 7 + this.boost * 22 + rand(-1, 1);
    // chopper: rides close on the sleigh's tail, door side facing it
    const home = this.station === 'home' && this.act;
    if (!home) { this.heliMove = null; this.heliT.set(8.5, 5, 13); }
    const hm = this.heliMove;
    if (hm) { hm.t += dt; const u = clamp(hm.t / hm.dur, 0, 1); this.heliOff.lerpVectors(hm.from, hm.to, u * u * (3 - 2 * u)); if (u >= 1) this.heliMove = null; }
    else { this.heliOff.x = damp(this.heliOff.x, this.heliT.x, 1.1, dt); this.heliOff.y = damp(this.heliOff.y, this.heliT.y, 1.1, dt); this.heliOff.z = damp(this.heliOff.z, this.heliT.z, .9, dt); }
    this.heliRoll = damp(this.heliRoll, 0, 1.2, dt); this.heliDrop = damp(this.heliDrop, 0, .8, dt); this.heliShake = Math.max(0, this.heliShake - dt);
    this.heliDmg = Math.max(0, this.heliDmg - dt * .045);
    const h = this.heli, rp = this.rig.position;
    h.position.set(rp.x + this.heliOff.x + Math.sin(t * .5) * .6, rp.y + this.heliOff.y + Math.sin(t * .9) * .35 - this.high * 2 + this.heliDrop, rp.z + this.heliOff.z + this.boost * 16);
    h.rotation.set(-.08 - this.boost * .05 + this.heliDrop * .03, -.3 + Math.sin(t * .4) * .06 + this.heliRoll * .5, Math.sin(t * .4 + 1) * .05 + this.heliRoll + Math.sin(t * 13) * this.heliDmg * .03);
    const hs = this.heliShake * .25; this.heliBody.position.set(rand(-hs, hs), rand(-hs, hs), rand(-hs, hs));
    this.rotor.rotation.z += dt * 34; this.tailRotor.rotation.x += dt * 40; this.strobes[0].visible = (t * 5 | 0) % 2 === 0; this.strobes[1].visible = !this.strobes[0].visible;
    h.updateMatrixWorld(true); this.nose.getWorldPosition(_v);
    _w.copy(rp).add(_u.set(0, 1, 0)); const len = _v.distanceTo(_w) * 1.15;
    this.beam.position.copy(_v); this.beam.quaternion.setFromUnitVectors(_u.set(0, -1, 0), _w.clone().sub(_v).normalize()); this.beam.scale.set(1, len, 1);
    this.spot.position.copy(_v); this.spot.target.position.copy(_w);
    // rotor gets louder as the chopper closes in
    const hk = clamp(1 - (h.position.distanceTo(rp) - 9) / 75, 0, 1);
    if (this.sfx && Math.abs(hk - this.hk) > .04) { this.hk = hk; this.sfx.heliNear(hk); }
    if (this.heliDmg > .2) { this.smokeAcc += dt; if (this.smokeAcc > .05) { this.smokeAcc = 0; this.engine.getWorldPosition(_u); this.boom.puffSmoke(_u, _w.set(rand(-.5, .5), 1.6, -this.speed * .35), 2.2 + this.heliDmg * 2.6, 2.2, .06, .85); if (this.heliDmg > .55) this.boom.puffFire(_u, _w.set(0, .8, 0), 1.3, .3); } }
    this.cop.update(dt);
    const pu = this.push;
    if (pu) {
      pu.kT = Math.min(1, pu.kT + dt / PUSH_TIME); pu.k = damp(pu.k, pu.kT, 6, dt);
      // the camera has arrived where the chase's first shot starts: hand over without a cut
      if (pu.kT >= 1 && pu.k > .996) { this.push = null; this.act.s = SCRIPT; this.act.t = 0; this.act.i = 0; this.smoothCut = true; }
    }
    if (home) this.runScript(dt);
    this.updateBombs(dt);
    this.boom.air = spd * .9; this.boom.update(dt, this.cam);
    this.shake = Math.max(0, this.shake - dt * .9); this.cutGlitch = Math.max(0, this.cutGlitch - dt);
    // snow: relative wind streams past the sleigh
    const sp = this.snow.geometry.attributes.position, cp = this.rig.position;
    for (let i = 0; i < sp.count; i++) {
      let x = sp.getX(i) + Math.sin(t * .5 + i) * dt * .8, y = sp.getY(i) - dt * (2.2 + (i % 5) * .3), z = sp.getZ(i) + spd * .55 * dt;
      if (y < cp.y - 35) y += 70; if (y > cp.y + 35) y -= 70; if (z > cp.z + 25) z -= 115; if (z < cp.z - 90) z += 115; if (x > cp.x + 60) x -= 120; if (x < cp.x - 60) x += 120;
      sp.setXYZ(i, x, y, z);
    } sp.needsUpdate = true;
    // money trail from the sack
    this.bAcc += dt * (18 + this.boost * 20);
    while (this.bAcc > 1) { this.bAcc -= 1; this.rig.localToWorld(_u.set(-.62 + rand(-.2, .2), .75, 1.0)); this.spawnBill(_u, rand(-2.2, 2.2), rand(1.5, 4), rand(1, 4)); if (this.der) this.cash += 100; }
    const air = spd * .9;
    for (let i = 0; i < this.NB; i++) {
      if (this.bL[i] > 4.5) continue; this.bL[i] += dt; const j = i * 3;
      this.bV[j + 2] += (air - this.bV[j + 2]) * 1.1 * dt; this.bV[j + 1] -= 4.5 * dt; this.bV[j + 1] *= 1 - dt * .8; this.bV[j] += Math.sin(t * 6 + i) * dt * 3;
      this.bP[j] += this.bV[j] * dt; this.bP[j + 1] += this.bV[j + 1] * dt; this.bP[j + 2] += this.bV[j + 2] * dt;
      this.bR[j] += this.bW[j] * dt; this.bR[j + 1] += this.bW[j + 1] * dt; this.bR[j + 2] += this.bW[j + 2] * dt;
      _m.compose(_v.set(this.bP[j], this.bP[j + 1], this.bP[j + 2]), _q.setFromEuler(_e.set(this.bR[j], this.bR[j + 1], this.bR[j + 2])), _s.setScalar(this.bL[i] > 4.5 ? 0 : 1));
      this.bills.setMatrixAt(i, _m);
    } this.bills.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < this.NC; i++) {
      if (this.cL[i] > 3) continue; this.cL[i] += dt; const j = i * 3;
      this.cV[j + 1] -= 6 * dt; this.cV[j] *= 1 - dt * 1.5; this.cV[j + 1] *= 1 - dt * 1.2; this.cV[j + 2] += (air * .6 - this.cV[j + 2]) * .8 * dt;
      this.cP[j] += this.cV[j] * dt; this.cP[j + 1] += this.cV[j + 1] * dt; this.cP[j + 2] += this.cV[j + 2] * dt; this.cR[j] += dt * 9; this.cR[j + 1] += dt * 7;
      _m.compose(_v.set(this.cP[j], this.cP[j + 1], this.cP[j + 2]), _q.setFromEuler(_e.set(this.cR[j], this.cR[j + 1], this.cR[j + 2])), _s.setScalar(this.cL[i] > 3 ? 0 : 1));
      this.conf.setMatrixAt(i, _m);
    } this.conf.instanceMatrix.needsUpdate = true;
    if (this.mflash > 0) { this.mflash -= dt; if (this.mflash <= 0) { this.muzzle.visible = false; this.muzzleL.intensity = 0; } }
    if (this.der) { this.der.root.rotation.y = angTo(this.der.root.rotation.y, this.derYawT, 1 - Math.exp(-dt * 9)); this.der.update(dt); if (this.muzzle.visible) { this.der.muzzlePos(_v); this.muzzle.position.copy(_v); } }
    // cameras
    if (renderMain) this.updateCam(dt);
    const fc = this.feedCam; fc.position.set(this.rig.position.x + 22 + Math.sin(t * .2) * 6, this.rig.position.y + 17, 8 + Math.cos(t * .2) * 8); fc.lookAt(this.rig.position.x, this.rig.position.y, -6);
  }
  updateCam(dt) {
    const t = this.t, cam = this.cam, rp = this.rig.position, c = this.camCur, wide = cam.aspect > 1.05, px = wide ? 1 : .35;
    const P = _cp, L = _cl;
    if (this.act && this.station === 'home' && this.camK >= 1 && this.der) {
      this.shotT += dt; const sh = SHOTS[this.shot];
      if (this.shot === 'ots') {
        this.der.head.getWorldPosition(L); const hp = this.heli.position; const d = _u.copy(hp).sub(L).normalize(); const side = _t1.crossVectors(d, UP).normalize();
        P.copy(L).addScaledVector(d, -1.9).addScaledVector(side, .7).add(_t2.set(0, .4, 0)); L.lerp(hp, .85);
      } else if (this.shot === 'copFace') {
        this.cop.head.getWorldPosition(L); P.copy(this.heliBody.localToWorld(_u.set(-4.4, .9, -2.7))); L.y -= .2;
      } else { P.set(rp.x + sh.p[0] * (wide ? 1 : .55), rp.y + sh.p[1], rp.z + sh.p[2] * (wide ? 1 : 1.15)); L.set(rp.x + sh.l[0], rp.y + sh.l[1], rp.z + sh.l[2]); }
      P.lerp(L, Math.min(.16, this.shotT * .022));
      let fov = sh.fov;
      const pu = this.push;
      if (pu) {
        // continuous move from the dance close-up to the start of the chase's first shot
        const to = SHOTS[SCRIPT[0][2]], e = ease(pu.k);
        _t1.set(to.p[0] * (wide ? 1 : .55), to.p[1], to.p[2] * (wide ? 1 : 1.15)); _t2.set(...to.l);
        P.copy(pu.p).lerp(_t1, e).add(rp); L.copy(pu.l).lerp(_t2, e).add(rp); fov = lerp(pu.fov, to.fov, e);
      }
      c.p.copy(P).sub(rp); c.l.copy(L).sub(rp); c.fov = fov; c.off = 0; c.offY = 0;
    } else {
      if (this.camK < 1) {
        this.camK = Math.min(1, this.camK + dt / this.camDur); const k = ease(this.camK), f = this.camFrom, to = KEYS[this.camTo];
        orbit(c.p, f.p, _v.set(...to.p), k); c.l.lerpVectors(f.l, _w.set(...to.l), k); c.fov = lerp(f.fov, to.fov, k); c.off = lerp(f.off, to.off, k); c.offY = lerp(f.offY, to.offY, k);
      }
      P.set(rp.x + c.p.x * px + Math.sin(t * .7) * .12, rp.y + c.p.y + Math.sin(t * 1.1) * .08, rp.z + c.p.z * (px < 1 ? 1.15 : 1)); L.set(rp.x + c.l.x, rp.y + c.l.y, rp.z + c.l.z);
    }
    const sk = this.shake * .45 + (this.boost > .5 ? .04 * this.boost : 0);
    if (sk > 0) { P.x += rand(-sk, sk); P.y += rand(-sk, sk); L.x += rand(-sk, sk) * .4; L.y += rand(-sk, sk) * .4; }
    cam.position.copy(P); cam.lookAt(L);
    const asp = cam.aspect, ox = wide ? c.off : 0, oy = wide ? 0 : c.offY, fv = wide ? c.fov : c.fov * 1.25;
    if (cam.fov !== fv || this._ox !== ox || this._oy !== oy || this._asp !== asp) {
      cam.fov = fv; this._ox = ox; this._oy = oy; this._asp = asp;
      if (ox || oy) cam.setViewOffset(1000 * asp, 1000, ox * 1000 * asp * .5, -oy * 1000 * .5, 1000 * asp, 1000); else cam.clearViewOffset();
      cam.updateProjectionMatrix();
    }
  }
  derHit(ray) {
    if (!this.der) return false; this.rig.localToWorld(_v.set(0, .9, .1));
    const b = new THREE.Box3(_w.copy(_v).add(_u.set(-.6, -.7, -.6)), _v.clone().add(_u.set(.6, 1.05, .6)));
    return ray.intersectsBox(b);
  }
}
