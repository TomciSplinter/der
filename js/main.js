// DER — boot, loader gate, TV-room intro, fly-into-the-TV, sleigh chase sections.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { makeTextures, Post, PSXU, clamp, lerp, ease, smooth, rand } from './fx.js';
import { Sound } from './audio.js';
import { Der, makeRevolver, makeShotgun } from './der.js';
import { Room, SCREEN } from './room.js';
import { World } from './world.js';
import { drawCrack } from './boom.js';

/* ======== edit these when the links are live ======== */
const CONFIG = {
  ca: '',        // contract address, e.g. '0x1234…'
  x: '',         // e.g. 'https://x.com/yourhandle'
  telegram: '',  // e.g. 'https://t.me/yourgroup'
  chart: '',     // e.g. 'https://dexscreener.com/…'
};
const MEMES = [
  { img: 'img/m1.webp', name: 'Rooftop der', ask: 'Checking the list. Twice.' },
  { img: 'img/m2.webp', name: 'Sleigh der', ask: 'Making it snow.' },
  { img: 'img/m3.webp', name: 'Fireside der', ask: 'Counting the presents.' },
  { img: 'img/m4.webp', name: 'Santa hat der', ask: 'Ho ho hold this.' },
  { img: 'img/m5.webp', name: 'Getaway der', ask: 'Late for the party.' },
  { img: 'img/m6.webp', name: 'Boss der', ask: 'Gifts are non-refundable.' },
];
const STATIONS = ['home', 'about', 'memes'];
// 3D models: hosted copies first, then the local assets/ folder (for self-hosting)
const MODELS = {
  cop: '/_blob/101c493814e7fd0c35dd43766b9e98af', der: '/_blob/322a95844b6e9c44fa3eba65ca5c3f35', tv: '/_blob/196a9732d928166ed6d395391302a1d9', armchair: '/_blob/ece73867277618fc4d5808dd51be1034',
  tree: '/_blob/8065cb3bd3875a81fdbeb4ea1d3f42de', fireplace: '/_blob/8e85668e35274dc328db61ddaff6b6e0', sleigh: '/_blob/344b7e7c2b7f03a44b42b9d2137e624d',
  heli: '/_blob/28ffb53ece15bc105de792681c474a7e', house: '/_blob/e351a62a2fc0747211119eb0a931aaa8',
};

const $ = s => document.querySelector(s);
const gate = $('#gate'), enterBtn = $('#enter'), gword = $('#gword'), meter = $('#meter'), prog = $('#prog');
const ui = $('#ui'), navBtns = [...document.querySelectorAll('nav button')], about = $('#about'), gal = $('#gal');
const skipBtn = $('#skip'), tvEnter = $('#tventer'), flashEl = $('#flash'), cashEl = $('#cash'), sndBtn = $('#snd'), tapme = $('#tapme');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const sound = new Sound();

/* ---------- gate: CRT glass with Christmas-light bokeh ---------- */
const glass = $('#glass'), gx = glass.getContext('2d');
const bokeh = Array.from({ length: 18 }, (_, i) => ({ p: rand(0, 6.3), s: rand(.5, 1.3), rx: rand(.15, .45), ry: rand(.12, .4), r: rand(.06, .16), c: ['255,70,50', '60,255,140', '255,210,90', '255,250,235', '90,170,255'][i % 5] }));
const flakes = Array.from({ length: 70 }, () => ({ x: Math.random(), y: Math.random(), v: rand(.02, .06), s: rand(.6, 1.6) }));
let gateOn = true;
function sizeGlass() { glass.width = Math.ceil(innerWidth / 4); glass.height = Math.ceil(innerHeight / 4); }
function drawGlass(t) {
  const W = glass.width, H = glass.height, cx = W / 2, cy = H / 2, R = Math.hypot(W, H) / 2;
  gx.fillStyle = '#121b16'; gx.fillRect(0, 0, W, H);
  for (let k = 0; k < 24; k++) { const a0 = k / 24 * 6.283 + t * .12, a1 = a0 + 6.283 / 24; gx.fillStyle = k % 2 ? 'rgba(255,255,255,.025)' : 'rgba(0,0,0,.05)'; gx.beginPath(); gx.moveTo(cx, cy); gx.arc(cx, cy, R, a0, a1); gx.fill(); }
  for (let i = 0; i < 7; i++) { const f = ((i / 7 + t * .06) % 1); gx.strokeStyle = `rgba(255,220,150,${.06 * f})`; gx.lineWidth = 1 + f * 3; gx.beginPath(); gx.arc(cx, cy, f * f * R, 0, 6.283); gx.stroke(); }
  for (const b of bokeh) { const x = cx + Math.cos(t * .13 * b.s + b.p) * b.rx * W, y = cy + Math.sin(t * .1 * b.s + b.p * 1.7) * b.ry * H, r = b.r * Math.min(W, H) * 1.6;
    const g = gx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(${b.c},.42)`); g.addColorStop(.7, `rgba(${b.c},.18)`); g.addColorStop(1, `rgba(${b.c},0)`); gx.fillStyle = g; gx.fillRect(x - r, y - r, r * 2, r * 2); }
  gx.fillStyle = 'rgba(240,248,255,.75)'; for (const f of flakes) { const y = ((f.y + t * f.v) % 1) * H, x = (f.x + Math.sin(t * .5 + f.y * 9) * .01) * W; gx.fillRect(x, y, f.s, f.s); }
}
for (let i = 0; i < 12; i++) meter.appendChild(document.createElement('i'));
function setProgress(p) { const n = Math.round(clamp(p, 0, 1) * 12); [...meter.children].forEach((e, i) => e.classList.toggle('f', i < n)); prog.textContent = 'Loading ' + Math.round(p * 100) + '%'; }
sizeGlass();
(function gateLoop(now) { if (!gateOn) return; drawGlass(now / 1000); requestAnimationFrame(gateLoop); })(0);

/* ---------- static UI: stars, links, CA, sound ---------- */
const STAR = '<svg class="st" viewBox="0 0 10 10" aria-hidden="true"><path d="M5 0l1.5 3.2 3.5.5-2.5 2.4.6 3.5L5 8 1.9 9.6l.6-3.5L0 3.7l3.5-.5z"/></svg>';
document.querySelectorAll('.stars').forEach(e => e.innerHTML = STAR.repeat(5));
const links = $('#links');
for (const [label, key] of [['X', 'x'], ['TG', 'telegram'], ['Chart', 'chart']]) {
  const url = CONFIG[key]; const el = document.createElement(url ? 'a' : 'span'); el.className = 'psx lk';
  const l = document.createElement('span'); l.className = 'lbl'; l.textContent = label; el.appendChild(l);
  if (url) { el.href = url; el.target = '_blank'; el.rel = 'noopener'; el.setAttribute('aria-label', label); }
  else { el.setAttribute('aria-disabled', 'true'); el.title = label + ': coming soon'; }
  links.appendChild(el);
}
if (CONFIG.ca) {
  const ca = $('#ca'); ca.textContent = ''; const code = document.createElement('code'); code.textContent = CONFIG.ca.length > 16 ? CONFIG.ca.slice(0, 6) + '…' + CONFIG.ca.slice(-4) : CONFIG.ca; code.title = CONFIG.ca;
  const b = document.createElement('button'); b.className = 'psx'; b.type = 'button'; b.textContent = 'Copy';
  b.onclick = () => { navigator.clipboard.writeText(CONFIG.ca).then(() => { b.textContent = 'Copied'; setTimeout(() => b.textContent = 'Copy', 1400); }, () => { code.textContent = CONFIG.ca; }); };
  ca.append(code, b);
}
function syncSnd() { sndBtn.setAttribute('aria-pressed', String(!sound.muted)); sndBtn.setAttribute('aria-label', sound.muted ? 'Sound off' : 'Sound on'); }
syncSnd(); sndBtn.onclick = () => { sound.init(); sound.setMuted(!sound.muted); sound.resume(); syncSnd(); };

/* ---------- three ---------- */
let renderer, post, room, world, der, feedRT, tableGun;
const canvas = $('#gl');
function fail(e) { console.error(e); gword.textContent = 'OOPS'; $('#err').style.display = 'block'; meter.style.display = 'none'; }
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1); renderer.outputColorSpace = THREE.SRGBColorSpace;
} catch (e) { fail(e); }

async function load() {
  makeTextures();
  const files = ['der', 'cop', 'tv', 'armchair', 'tree', 'fireplace', 'sleigh', 'heli', 'house'];
  const total = files.length + 6; let done = 0; const tick = () => setProgress(++done / total * .92);
  const gl = new GLTFLoader();
  // load embedded textures as plain <img> (blob: image URLs) instead of fetch() + ImageBitmap
  gl.register(parser => { parser.textureLoader = new THREE.TextureLoader(parser.options.manager); return { name: 'der_img_textures' }; });
  const tl = new THREE.TextureLoader();
  const A = {};
  await Promise.all([
    ...files.map(f => gl.loadAsync('assets/' + f + '.glb').catch(() => gl.loadAsync(MODELS[f])).then(g => { A[f] = g; tick(); })),
    ...[1, 2, 3, 4, 5, 6].map(i => tl.loadAsync(`img/m${i}_s.webp`).then(t => { t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter; (A.posters ||= [])[i - 1] = t; tick(); })),
  ]);
  const hf = renderer.extensions.has('EXT_color_buffer_float') || renderer.extensions.has('EXT_color_buffer_half_float');
  feedRT = new THREE.WebGLRenderTarget(200, 150, hf ? { type: THREE.HalfFloatType } : {});
  post = new Post(renderer);
  world = new World(A); world.sfx = sound;
  room = new Room(A, feedRT.texture);
  der = new Der(A.der);
  // Der sits in his armchair facing the TV
  room.scene.add(der.root); der.root.position.set(.56, -.03, 2.45); der.root.rotation.y = Math.PI;
  room.scene.add(der.gun); room.scene.add(der.shotgun);
  der.play('sitUp', { fade: 0, pingpong: true, speed: .45 });
  tableGun = makeRevolver(); tableGun.position.copy(room.tableGunSpot); tableGun.rotation.set(Math.PI / 2, 0, 1.2); room.scene.add(tableGun);
  const lean = makeShotgun(); lean.position.set(.98, .42, 2.5); lean.rotation.set(.1, .3, -.32); room.scene.add(lean);
  resize(); addEventListener('resize', resize);
  // warm up shaders + textures behind the gate
  der.update(0); world.update(.016, true);
  renderer.compile(room.scene, room.cam); renderer.compile(world.scene, world.cam);
  renderer.setRenderTarget(feedRT); renderer.render(world.scene, world.feedCam);
  post.render(room.scene, room.cam, 0); post.render(world.scene, world.cam, 0);
  setProgress(1);
  ready = true; enterBtn.disabled = false; enterBtn.classList.add('ready'); enterBtn.setAttribute('aria-label', 'Enter'); gword.textContent = 'ENTER'; prog.textContent = 'Ready. Press Enter.';
  requestAnimationFrame(frame);
}
let ready = false;
if (renderer) load().catch(fail);

function resize() {
  const W = innerWidth, H = innerHeight, k = Math.max(W, H) / 760;
  const w = Math.max(160, Math.round(W / k)), h = Math.max(120, Math.round(H / k));
  renderer.setSize(w, h, false); post.setSize(w, h); PSXU.uSnap.value.set(w / 3, h / 3);
  for (const c of [room.cam, world.cam]) { c.aspect = w / h; c.updateProjectionMatrix(); }
  world._asp = -1; sizeGlass();
}

/* ---------- room camera keys ---------- */
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const RK = {
  tube: { p: V(0, SCREEN.y, SCREEN.z + .3), l: SCREEN.clone(), fov: 40 },
  wide: { p: V(1.3, 1.42, 4.15), l: V(-.12, .98, .25), fov: 46 },
  close: { p: V(1.2, 1.46, 3.8), l: V(.02, 1.02, .3), fov: 42 },
  near: { p: V(.08, 1.03, .95), l: SCREEN.clone(), fov: 38 },
  pov: { p: V(.06, 1.06, .52), l: V(.3, 1.22, 2.35), fov: 44 },
  pov2: { p: V(.1, 1.1, .78), l: V(.3, 1.3, 2.35), fov: 40 },
  side: { p: V(-1.75, 1.3, 1.5), l: V(.2, 1.0, 1.05), fov: 52 },
  into: { p: V(0, SCREEN.y, SCREEN.z + .06), l: V(0, SCREEN.y, SCREEN.z - 1), fov: 80 },
};
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _h = new THREE.Vector3();
function roomCam(A, B, k, shake = 0) {
  const p = _a.lerpVectors(A.p, B.p, k), l = _b.lerpVectors(A.l, B.l, k); let fov = lerp(A.fov, B.fov, k);
  if (room.cam.aspect < 1) { fov *= 1.5; l.x += .22; }
  if (shake) { p.x += rand(-1, 1) * shake; p.y += rand(-1, 1) * shake; }
  room.setCam(p, l, fov);
}

/* ---------- state machine ---------- */
let state = 'gate', T = 0, tS = 0, last = 0, frameN = 0, station = 0, shake = 0, fly = null, glitch = 0, cardT = 0, autoShot = 0;
const ACT = [];
function at(t, f) { ACT.push({ t, f, done: false }); }

enterBtn.onclick = () => {
  if (!ready || state !== 'gate') return;
  sound.init(); sound.setMuted(sound.muted); sound.resume(); sound.tvOn(); sound.startRoom();
  gate.classList.add('off'); gateOn = false; setTimeout(() => gate.style.display = 'none', 700);
  document.body.classList.add('cine'); skipBtn.classList.add('on');
  state = 'tube'; tS = 0; last = performance.now();
};
tvEnter.onclick = () => { if (state === 'room') startAct(); };
skipBtn.onclick = () => { if (state === 'tube' || state === 'room') { flash(1, 80); setTimeout(() => startDrive(), 120); } };

function startAct() {
  state = 'act'; tS = 0; tvEnter.classList.remove('on'); skipBtn.classList.remove('on'); sound.whoosh();
  ACT.length = 0; cracksOn();
  at(0, () => der.play('stand', { from: 1.2, fade: .35, speed: 1.5, keepHips: true, once: true }));
  at(1.25, () => der.play('draw', { from: 1.9, fade: .3, keepHips: true }));
  at(1.55, () => { der.gun.visible = true; tableGun.visible = false; });
  [2.05, 2.5, 2.95].forEach((s, i) => at(s, () => roomShot(i)));
  at(3.3, tvBlow);
  at(3.75, () => { room.suction = 1; sound.suck(); });
  at(4.15, startFly);
  at(5.45, () => { der.root.visible = false; der.gun.visible = false; room.hideBolts(); });
  at(5.7, () => { flash(1, 140); sound.boom(); });
  at(5.9, () => startDrive());
}
const CR = [[.47, .43], [.58, .55], [.42, .6]];
function roomShot(i) {
  sound.shot(); setTimeout(() => sound.glass(), 40); shake = i === 2 ? .12 : .07; der.muzzlePos(_c); room.muzzle.position.copy(_c); room.muzzle.visible = true; room.muzzle.material.rotation = rand(0, 6);
  room.flashL.position.copy(_c); room.flashL.intensity = 40; setTimeout(() => { room.muzzle.visible = false; room.flashL.intensity = 0; }, 70);
  room.screenU.uNoise.value = .6; glitch = .25;
  const [u, v] = CR[i]; crack(u + rand(-.04, .04), v + rand(-.04, .04), i === 2 ? 1.25 : 1); room.addCrack(u, 1 - v);
}
function tvBlow() {
  room.blow(); sound.explode(.8); sound.glass(); sound.zap(2.6); shake = .22; glitch = .4;
  crackEl.style.transition = 'opacity .35s'; crackEl.style.opacity = '0';
}
function startFly() {
  der.play('fall', { fade: .25 });
  der.hips.getWorldPosition(_h);
  fly = { t: 0, dur: 1.3, p0: _h.clone(), p1: V(lerp(_h.x, 0, .5), _h.y + .35, lerp(_h.z, SCREEN.z, .45)), p2: V(SCREEN.x, SCREEN.y, SCREEN.z - .05) };
  sound.whoosh();
}
/* bullet holes on the viewer's screen (the TV's point of view) */
const crackEl = document.getElementById('cracks'), cg = crackEl.getContext('2d');
function cracksOn() { const d = Math.min(2, devicePixelRatio || 1); crackEl.width = innerWidth * d; crackEl.height = innerHeight * d; cg.setTransform(d, 0, 0, d, 0, 0); cg.clearRect(0, 0, innerWidth, innerHeight); crackEl.style.transition = 'none'; crackEl.style.opacity = '1'; }
function crack(u, v, k) { drawCrack(cg, u * innerWidth, v * innerHeight, Math.min(innerWidth, innerHeight) * .3 * k, Math.random()); }
function flash(to, ms) { flashEl.style.transition = `opacity ${ms}ms`; flashEl.style.opacity = to; }

function startDrive() {
  if (state === 'drive') return;
  state = 'drive'; tS = 0;
  room.hideBolts(); der.root.visible = true; der.gun.visible = true; der.shotgun.visible = true; fly = null; crackEl.style.opacity = '0';
  world.attachDer(der); der.play('idle', { fade: 0, resetOff: true });
  world.land(); glitch = .9;
  setTimeout(() => flash(0, 900), 60);
  document.body.classList.remove('cine'); skipBtn.classList.remove('on'); tvEnter.classList.remove('on');
  sound.stopLoop('room'); sound.startDrive(); sound.startMusic();
  setTimeout(() => { ui.classList.add('on'); tapme.classList.add('on'); setTimeout(() => tapme.classList.remove('on'), 6000); }, 1500);
  setStation(0, true);
}

function setStation(i, force) {
  if (state !== 'drive') return; i = clamp(i, 0, 2); if (i === station && !force) return;
  const prev = station; station = i;
  navBtns.forEach((b, k) => b.setAttribute('aria-pressed', String(k === i)));
  if (!force) { ui.classList.add('nav-used'); sound.whoosh(); world.setStation(STATIONS[i]); }
  about.classList.remove('on'); about.setAttribute('aria-hidden', 'true'); gal.classList.remove('on'); gal.setAttribute('aria-hidden', 'true'); clearTimeout(cardT); clearTimeout(autoShot);
  if (i === 1) { cardT = setTimeout(() => { about.classList.add('on'); about.setAttribute('aria-hidden', 'false'); }, 900); autoShot = setTimeout(doShoot, 1900); }
  if (i === 2) { der.play('dance', { fade: .6 }); cardT = setTimeout(() => { gal.classList.add('on'); gal.setAttribute('aria-hidden', 'false'); }, 1900); sound.setBoost(1); setTimeout(() => sound.setBoost(.3), 2600); }
  else { sound.setBoost(0); if (prev === 2 && der.name === 'dance') der.play('idle', { fade: .6 }); }
}
navBtns.forEach((b, k) => b.onclick = () => { sound.blip(); setStation(k); });
function doShoot() { world.shoot(() => { sound.shot(); }, () => sound.ching()); }

/* ---------- memes card ---------- */
const faceA = $('#faceA'), faceB = $('#faceB'), cardIn = $('#cardIn'), galCap = $('#galCap');
let mi = 0, rot = 0;
function setFace(el, m) { el.style.backgroundImage = `url("${m.img}")`; el.setAttribute('aria-label', m.name); }
function caption() { const m = MEMES[mi]; galCap.textContent = ''; const n = document.createElement('span'); n.className = 'n'; n.textContent = `${mi + 1} / ${MEMES.length}`; const b = document.createElement('b'); b.textContent = m.name; galCap.append(n, "It's ", b, '. ' + m.ask); }
setFace(faceA, MEMES[0]); caption();
function meme(dir) {
  mi = (mi + dir + MEMES.length) % MEMES.length; rot += 180 * dir;
  setFace(Math.round(rot / 180) % 2 === 0 ? faceA : faceB, MEMES[mi]);
  cardIn.style.transform = `rotateY(${rot}deg)`; caption(); sound.blip();
}
$('#galPrev').onclick = () => meme(-1); $('#galNext').onclick = () => meme(1);
MEMES.forEach(m => { const i = new Image(); i.src = m.img; });

/* ---------- input ---------- */
let wAcc = 0, wLock = 0;
addEventListener('wheel', e => {
  if (state !== 'drive') return; const now = performance.now(); if (now < wLock) { wAcc = 0; return; }
  wAcc += e.deltaY; if (Math.abs(wAcc) > 45) { setStation(station + Math.sign(wAcc)); wAcc = 0; wLock = now + 950; }
}, { passive: true });
let ty = 0, tx = 0, tt = 0;
addEventListener('touchstart', e => { const p = e.touches[0]; ty = p.clientY; tx = p.clientX; tt = performance.now(); }, { passive: true });
addEventListener('touchend', e => {
  if (state !== 'drive') return; const p = e.changedTouches[0], dy = ty - p.clientY, dx = tx - p.clientX;
  if (Math.abs(dy) > 50 && Math.abs(dy) > Math.abs(dx) * 1.2) setStation(station + Math.sign(dy));
  else if (station === 2 && Math.abs(dx) > 50 && e.target.closest && e.target.closest('#card')) meme(dx > 0 ? 1 : -1);
}, { passive: true });
addEventListener('keydown', e => {
  if (e.key === 'Enter' || e.key === ' ') { if (state === 'gate' && ready && document.activeElement !== enterBtn) { enterBtn.click(); return; } if (state === 'room' && document.activeElement !== tvEnter) { startAct(); return; } }
  if (state !== 'drive') return;
  if (['ArrowDown', 'PageDown'].includes(e.key)) { e.preventDefault(); setStation(station + 1); }
  if (['ArrowUp', 'PageUp'].includes(e.key)) { e.preventDefault(); setStation(station - 1); }
  if (station === 2 && e.key === 'ArrowRight') meme(1);
  if (station === 2 && e.key === 'ArrowLeft') meme(-1);
});
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
function hitDer(e) { const r = canvas.getBoundingClientRect(); ndc.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1); ray.setFromCamera(ndc, world.cam); return world.derHit(ray.ray); }
let downAt = null;
canvas.addEventListener('pointermove', e => { if (state === 'drive') canvas.style.cursor = hitDer(e) ? 'pointer' : ''; });
canvas.addEventListener('pointerdown', e => { downAt = { x: e.clientX, y: e.clientY }; });
canvas.addEventListener('pointerup', e => {
  if (state !== 'drive' || !downAt) return; const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y); downAt = null;
  if (moved < 12 && hitDer(e)) { tapme.classList.remove('on'); doShoot(); }
});
document.addEventListener('visibilitychange', () => { if (document.hidden) sound.suspend(); else if (state !== 'gate') sound.resume(); });

/* ---------- frame ---------- */
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(.05, Math.max(0, (now - last) / 1000)); last = now; if (state === 'gate') return;
  T += dt; tS += dt; frameN++;
  shake = Math.max(0, shake - dt * .25); glitch = Math.max(0, glitch - dt);
  post.U.uGlitch.value = Math.max(glitch * .9, world.cutGlitch * 2.2); post.U.uGhost.value = reduce ? .08 : .22;
  if (state === 'drive') {
    world.update(dt, true);
    if (frameN % 6 === 0) cashEl.textContent = '$' + String(Math.floor(world.cash)).padStart(8, '0');
    post.render(world.scene, world.cam, T);
    return;
  }
  // room phases: the world keeps flying so the TV shows a live feed
  world.update(dt, false);
  der.update(dt);
  room.update(dt, T);
  room.screenU.uNoise.value = Math.max(.05, room.screenU.uNoise.value - dt * 1.5);
  if (state === 'tube') {
    const k = ease(clamp((tS - .5) / 4.4, 0, 1)); roomCam(RK.tube, RK.wide, k);
    const c = _c.set(1.25, 1.95, 1.7), q = 2 * k * (1 - k); _a.copy(RK.tube.p).multiplyScalar((1 - k) * (1 - k)).addScaledVector(c, q).addScaledVector(RK.wide.p, k * k); room.cam.position.copy(_a); room.cam.lookAt(_b.lerpVectors(RK.tube.l, RK.wide.l, k));
    if (tS > 4.9) { state = 'room'; tS = 0; tvEnter.classList.add('on'); }
  } else if (state === 'room') {
    const s = Math.sin(T * .4) * .5 + .5; roomCam(RK.wide, RK.close, s * .12);
  } else if (state === 'act') {
    for (const e of ACT) if (!e.done && tS >= e.t) { e.done = true; e.f(); }
    if (tS < 3.3) roomCam(RK.pov, RK.pov2, ease(clamp(tS / 3.3, 0, 1)), shake + .003);
    else if (tS < 4.6) roomCam(RK.side, RK.side, 0, shake + .012);
    else if (tS < 5.35) roomCam(RK.side, RK.near, ease((tS - 4.6) / .75), shake * .5 + .006);
    else roomCam(RK.near, RK.into, smooth(clamp((tS - 5.35) / .4, 0, 1)));
    if (tS > 3.3) room.screenU.uSwirl.value = smooth(clamp((tS - 3.3) / .9, 0, 1));
    if (tS > 5.3) room.screenU.uFlash.value = clamp((tS - 5.3) / .35, 0, 1.5);
    if (tS > 3.45 && tS < 5.45) { der.head.getWorldPosition(_c); room.bolt(SCREEN, _c); }
    if (fly) {
      fly.t += dt; const u = clamp(fly.t / fly.dur, 0, 1), e = Math.pow(u, 2.1);
      const a = _a.lerpVectors(fly.p0, fly.p1, e), b = _b.lerpVectors(fly.p1, fly.p2, e); const p = a.lerp(b, e);
      der.hips.getWorldPosition(_h); _c.copy(_h).sub(der.root.position);
      der.root.position.copy(p).sub(_c);
      der.root.quaternion.setFromEuler(new THREE.Euler(0, Math.PI, 0)).multiply(new THREE.Quaternion().setFromAxisAngle(V(0, 0, 1), e * 8));
      der.root.scale.setScalar(lerp(1, .05, smooth(clamp((u - .45) / .55, 0, 1))));
    }
  }
  if (frameN % 2 === 0 || state === 'act') { renderer.setRenderTarget(feedRT); renderer.render(world.scene, world.feedCam); }
  post.render(room.scene, room.cam, T);
}

// tiny hook for automated checks
window.DER = { get act() { return world && world.act ? world.act.t : -1; }, get world() { return world; }, get room() { return room; }, get der() { return der; }, get state() { return state; }, get t() { return tS; }, get station() { return station; }, go: i => setStation(i), shoot: () => doShoot(), meme: d => meme(d) };
