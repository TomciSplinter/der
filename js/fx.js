// Rendering helpers: PS2-style low-res pipeline, vertex snapping, canvas textures.
import * as THREE from 'three';

export const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
export const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = t => t * t * (3 - 2 * t);
export const ease = t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));

/* ---------- PSX vertex snapping (wobbly low-precision geometry) ---------- */
export const PSXU = { uSnap: { value: new THREE.Vector2(200, 150) } };
export function psx(mat) {
  if (!mat || mat.userData.psx) return mat;
  mat.userData.psx = true;
  mat.onBeforeCompile = sh => {
    sh.uniforms.uSnap = PSXU.uSnap;
    sh.vertexShader = 'uniform vec2 uSnap;\n' + sh.vertexShader.replace('#include <project_vertex>',
      '#include <project_vertex>\n{ vec4 sp = gl_Position; if (sp.w > 0.0) { sp.xy = floor(sp.xy / sp.w * uSnap + 0.5) / uSnap * sp.w; gl_Position = sp; } }');
  };
  return mat;
}
// convert GLB PBR materials to cheap lit Lambert with nearest-filtered maps
export function lambertize(root, opts = {}) {
  root.traverse(o => {
    if (!o.isMesh) return;
    const old = o.material;
    const m = new THREE.MeshLambertMaterial({ map: old.map || null, color: old.color ? old.color.clone() : 0xffffff, side: opts.side ?? THREE.FrontSide });
    if (m.map) { m.map.magFilter = THREE.NearestFilter; m.map.anisotropy = 1; }
    if (opts.emissive) { m.emissive = new THREE.Color(opts.emissive); m.emissiveMap = m.map; m.emissiveIntensity = opts.emissiveIntensity ?? 0.25; }
    o.material = psx(m);
    old.dispose && old.dispose();
  });
  return root;
}

/* ---------- canvas textures ---------- */
export function ctex(w, h, draw, { nearest = true, repeat = false, srgb = true } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); draw(g, w, h, c);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (nearest) { t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestMipmapLinearFilter; }
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.userData.canvas = c;
  return t;
}
const noise = (g, w, h, a, col = '#000') => { g.fillStyle = col; for (let i = 0; i < w * h * a; i++) { g.globalAlpha = Math.random() * .25; g.fillRect(Math.random() * w | 0, Math.random() * h | 0, 1, 1); } g.globalAlpha = 1; };

export const TEX = {};
export function makeTextures() {
  TEX.glow = ctex(64, 64, (g, w) => { const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, '#fff'); r.addColorStop(.25, 'rgba(255,255,255,.75)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, w, w); }, { nearest: false });
  TEX.flake = ctex(16, 16, g => { const r = g.createRadialGradient(8, 8, 0, 8, 8, 8); r.addColorStop(0, '#fff'); r.addColorStop(.5, 'rgba(255,255,255,.8)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 16, 16); }, { nearest: false });
  TEX.burst = ctex(64, 64, g => { g.translate(32, 32); for (let i = 0; i < 12; i++) { g.rotate(Math.PI / 6); const l = i % 2 ? 30 : 18; const gr = g.createLinearGradient(0, 0, l, 0); gr.addColorStop(0, '#fff'); gr.addColorStop(.4, '#ffe08a'); gr.addColorStop(1, 'rgba(255,140,30,0)'); g.fillStyle = gr; g.beginPath(); g.moveTo(0, -3); g.lineTo(l, 0); g.lineTo(0, 3); g.fill(); } const r = g.createRadialGradient(0, 0, 0, 0, 0, 12); r.addColorStop(0, '#fff'); r.addColorStop(1, 'rgba(255,230,150,0)'); g.fillStyle = r; g.fillRect(-12, -12, 24, 24); }, { nearest: false });
  TEX.flame = ctex(32, 64, (g, w, h) => { const r = g.createRadialGradient(16, 46, 2, 16, 40, 30); r.addColorStop(0, '#fff8d0'); r.addColorStop(.3, '#ffc23a'); r.addColorStop(.6, 'rgba(255,90,20,.8)'); r.addColorStop(1, 'rgba(120,20,0,0)'); g.fillStyle = r; g.beginPath(); g.moveTo(16, 2); g.bezierCurveTo(30, 26, 30, 62, 16, 62); g.bezierCurveTo(2, 62, 2, 26, 16, 2); g.fill(); }, { nearest: false });
  TEX.puff = ctex(128, 128, (g) => { for (let i = 0; i < 14; i++) { const x = rand(46, 82), y = rand(52, 78), rr = rand(14, 30); const r = g.createRadialGradient(x, y - rr * .3, 0, x, y, rr); r.addColorStop(0, 'rgba(255,255,255,.9)'); r.addColorStop(.6, 'rgba(225,232,250,.55)'); r.addColorStop(1, 'rgba(200,210,240,0)'); g.fillStyle = r; g.beginPath(); g.arc(x, y, rr, 0, 7); g.fill(); } }, { nearest: false });
  TEX.bill = ctex(128, 56, (g, w, h) => {
    g.fillStyle = '#cfe3c2'; g.fillRect(0, 0, w, h); g.fillStyle = '#3f7a4a'; g.fillRect(3, 3, w - 6, h - 6); g.fillStyle = '#d8ecd0'; g.fillRect(6, 6, w - 12, h - 12);
    g.fillStyle = '#4d8a57'; g.fillRect(9, 9, w - 18, h - 18); g.fillStyle = '#cfe6c6'; g.beginPath(); g.ellipse(64, 28, 15, 15, 0, 0, 7); g.fill();
    g.fillStyle = '#2b5a33'; g.font = 'bold 22px Georgia,serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('$', 64, 29);
    g.font = 'bold 11px Arial'; g.fillStyle = '#e8f6e0'; g.fillText('100', 24, 18); g.fillText('100', 104, 40); noise(g, w, h, .5, '#1a3a20');
  });
  TEX.candy = ctex(64, 64, (g) => { g.fillStyle = '#fff6f0'; g.fillRect(0, 0, 64, 64); g.fillStyle = '#e3141c'; for (let i = -64; i < 128; i += 16) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 8, 0); g.lineTo(i + 8 - 64, 64); g.lineTo(i - 64, 64); g.fill(); } }, { repeat: true });
  TEX.gold = ctex(32, 32, (g) => { const gr = g.createLinearGradient(0, 0, 32, 32); gr.addColorStop(0, '#fff2a8'); gr.addColorStop(.5, '#d9a21b'); gr.addColorStop(1, '#8a5a06'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32); noise(g, 32, 32, 1, '#5a3a00'); });
  TEX.wood = ctex(128, 128, (g, w, h) => { g.fillStyle = '#5a3418'; g.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 2) { g.fillStyle = `rgba(${90 + Math.random() * 40 | 0},${50 + Math.random() * 25 | 0},${20 + Math.random() * 10 | 0},.5)`; g.fillRect(0, y, w, 1 + Math.random() * 2); } noise(g, w, h, .6, '#2a1206'); }, { repeat: true });
  TEX.floor = ctex(256, 256, (g, w, h) => {
    for (let y = 0; y < h; y += 32) for (let x0 = -(y / 32 % 2) * 96; x0 < w; x0 += 192) {
      const c = [[96, 54, 28], [110, 62, 30], [84, 46, 22], [102, 58, 32]][Math.random() * 4 | 0];
      g.fillStyle = `rgb(${c})`; g.fillRect(x0, y, 192, 32);
      for (let k = 0; k < 6; k++) { g.fillStyle = 'rgba(40,18,6,.35)'; g.fillRect(x0, y + rand(2, 30), 192, 1); }
      g.fillStyle = '#1e0d04'; g.fillRect(x0, y, 2, 32); g.fillRect(x0, y + 31, 192, 1);
    } noise(g, w, h, .5, '#140800');
  }, { repeat: true });
  TEX.wall = ctex(128, 128, (g, w, h) => {
    g.fillStyle = '#163a2a'; g.fillRect(0, 0, w, h); g.fillStyle = '#12301f'; for (let x = 0; x < w; x += 32) g.fillRect(x + 16, 0, 16, h);
    g.fillStyle = '#c9a24a'; for (let y = 8; y < h; y += 32) for (let x = 8; x < w; x += 32) { g.save(); g.translate(x + 8, y + 8); g.rotate(Math.PI / 4); g.fillRect(-3, -3, 6, 6); g.restore(); }
    noise(g, w, h, .4, '#06140c');
  }, { repeat: true });
  TEX.rug = ctex(128, 128, (g, w, h) => {
    g.fillStyle = '#7a1414'; g.fillRect(0, 0, w, h); g.fillStyle = '#1d5a36'; g.fillRect(6, 6, w - 12, h - 12); g.fillStyle = '#8e1a17'; g.fillRect(14, 14, w - 28, h - 28);
    g.strokeStyle = '#e0b85a'; g.lineWidth = 2; g.strokeRect(10, 10, w - 20, h - 20); g.beginPath(); g.moveTo(64, 30); g.lineTo(98, 64); g.lineTo(64, 98); g.lineTo(30, 64); g.closePath(); g.stroke();
    g.fillStyle = '#1d5a36'; g.beginPath(); g.moveTo(64, 44); g.lineTo(84, 64); g.lineTo(64, 84); g.lineTo(44, 64); g.fill(); noise(g, w, h, .8, '#200404');
  });
  TEX.burlap = ctex(64, 64, (g, w, h) => { g.fillStyle = '#9b7442'; g.fillRect(0, 0, w, h); for (let i = 0; i < w; i += 3) { g.fillStyle = 'rgba(60,40,15,.35)'; g.fillRect(i, 0, 1, h); g.fillRect(0, i, w, 1); } noise(g, w, h, 1, '#3a2408'); }, { repeat: true });
  TEX.snow = ctex(256, 256, (g, w, h) => {
    g.fillStyle = '#c9d6ec'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) { const r = g.createRadialGradient(rand(0, w), rand(0, h), 0, 0, 0, 0); g.fillStyle = `rgba(150,170,205,${rand(.05, .18)})`; g.beginPath(); g.ellipse(rand(0, w), rand(0, h), rand(10, 40), rand(6, 20), rand(0, 3), 0, 7); g.fill(); }
    for (let i = 0; i < 260; i++) { g.fillStyle = Math.random() < .5 ? '#ffffff' : '#a9b9d6'; g.fillRect(rand(0, w) | 0, rand(0, h) | 0, 1, 1); }
  }, { repeat: true });
  TEX.road = ctex(64, 128, (g, w, h) => {
    g.fillStyle = '#4a4f5c'; g.fillRect(0, 0, w, h); g.fillStyle = '#aab6cc'; g.fillRect(0, 0, 6, h); g.fillRect(w - 6, 0, 6, h);
    g.fillStyle = '#5d6373'; g.fillRect(14, 0, 6, h); g.fillRect(w - 20, 0, 6, h);
    g.fillStyle = '#c9a43a'; g.fillRect(31, 0, 2, 40); g.fillRect(31, 64, 2, 40); noise(g, w, h, 1.2, '#1a1d24');
    for (let i = 0; i < 50; i++) { g.fillStyle = 'rgba(230,236,248,.5)'; g.fillRect(rand(0, w) | 0, rand(0, h) | 0, rand(1, 4) | 0, 1); }
  }, { repeat: true });
  TEX.presents = ['#c81d25', '#1d6b3a', '#e8b72e', '#2d4fa8', '#f4f4f4', '#7a2a8c'].map((c, i) => ctex(64, 64, (g) => {
    g.fillStyle = c; g.fillRect(0, 0, 64, 64);
    if (i % 2) { g.fillStyle = 'rgba(255,255,255,.18)'; for (let k = 0; k < 64; k += 10) g.fillRect(k, 0, 4, 64); }
    else { g.fillStyle = 'rgba(255,255,255,.22)'; for (let k = 0; k < 9; k++) g.fillRect(rand(4, 56), rand(4, 56), 4, 4); }
    g.fillStyle = ['#ffd54a', '#f4f4f4', '#c81d25'][i % 3]; g.fillRect(28, 0, 8, 64); g.fillRect(0, 28, 64, 8); noise(g, 64, 64, .5);
  }));
  TEX.cash = ctex(64, 64, (g) => { g.drawImage(TEX.bill.userData.canvas, 0, 0, 128, 56, 0, 0, 64, 28); g.drawImage(TEX.bill.userData.canvas, 0, 0, 128, 56, 0, 30, 64, 28); g.fillStyle = '#e8e0c0'; g.fillRect(26, 0, 12, 64); g.fillStyle = '#b8a060'; g.fillRect(26, 0, 1, 64); g.fillRect(37, 0, 1, 64); });
  TEX.cashSide = ctex(32, 32, (g) => { for (let y = 0; y < 32; y += 2) { g.fillStyle = y % 4 ? '#d8ecd0' : '#6aa070'; g.fillRect(0, y, 32, 2); } g.fillStyle = '#e8e0c0'; g.fillRect(12, 0, 8, 32); });
  TEX.cookie = ctex(32, 32, (g) => { g.fillStyle = '#c98b43'; g.beginPath(); g.arc(16, 16, 15, 0, 7); g.fill(); g.fillStyle = '#3a1d0a'; for (let i = 0; i < 7; i++) g.fillRect(rand(6, 24), rand(6, 24), 3, 3); });
  TEX.rotor = ctex(128, 128, (g) => { g.translate(64, 64); for (let i = 0; i < 2; i++) { g.rotate(Math.PI); const gr = g.createLinearGradient(0, 0, 64, 0); gr.addColorStop(0, 'rgba(20,20,25,.55)'); gr.addColorStop(1, 'rgba(20,20,25,.15)'); g.fillStyle = gr; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, 63, -0.5, 0.25); g.fill(); } }, { nearest: false });
  TEX.moon = ctex(128, 128, (g) => { const r = g.createRadialGradient(64, 64, 20, 64, 64, 64); r.addColorStop(0, 'rgba(255,250,225,1)'); r.addColorStop(.42, 'rgba(255,246,215,1)'); r.addColorStop(.46, 'rgba(255,240,200,.35)'); r.addColorStop(1, 'rgba(160,180,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 128, 128); g.fillStyle = 'rgba(200,190,160,.5)'; [[54, 52, 8], [74, 70, 6], [60, 78, 5], [80, 50, 4]].forEach(([x, y, s]) => { g.beginPath(); g.arc(x, y, s, 0, 7); g.fill(); }); }, { nearest: false });
  TEX.night = ctex(128, 128, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#060b1e'); gr.addColorStop(.7, '#1b2d55'); gr.addColorStop(1, '#2a3f70'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) { g.fillStyle = '#fff'; g.fillRect(rand(0, w) | 0, rand(0, h * .6) | 0, 1, 1); }
    g.fillStyle = '#d9e4f8'; g.beginPath(); g.moveTo(0, 96); g.quadraticCurveTo(40, 80, 70, 92); g.quadraticCurveTo(100, 100, 128, 86); g.lineTo(128, 128); g.lineTo(0, 128); g.fill();
    for (let i = 0; i < 9; i++) { const x = rand(4, 120), y = rand(92, 110); g.fillStyle = '#2a2230'; g.fillRect(x, y - 6, 9, 7); g.fillStyle = '#ffd36a'; g.fillRect(x + 2, y - 4, 2, 2); g.fillRect(x + 5, y - 4, 2, 2); }
  });
  TEX.stocking = ctex(32, 64, (g) => { g.fillStyle = '#c3141b'; g.fillRect(0, 0, 32, 64); g.fillStyle = 'rgba(255,255,255,.12)'; for (let y = 16; y < 64; y += 8) g.fillRect(0, y, 32, 3); g.fillStyle = '#f4f4f4'; g.fillRect(0, 0, 32, 14); noise(g, 32, 64, .6); });
  return TEX;
}

/* ---------- low-res pipeline: scene -> bloom -> composite (ghosting, dither, glitch) ---------- */
const VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }';
export class Post {
  constructor(renderer) {
    this.r = renderer;
    const hf = renderer.extensions.has('EXT_color_buffer_float') || renderer.extensions.has('EXT_color_buffer_half_float');
    const mk = (d) => hf ? new THREE.WebGLRenderTarget(4, 4, { depthBuffer: d, type: THREE.HalfFloatType })
      : new THREE.WebGLRenderTarget(4, 4, { depthBuffer: d, colorSpace: THREE.SRGBColorSpace });
    this.rtScene = mk(true); this.rtA = mk(false); this.rtB = mk(false);
    this.hist = [new THREE.WebGLRenderTarget(4, 4, { depthBuffer: false }), new THREE.WebGLRenderTarget(4, 4, { depthBuffer: false })]; this.hi = 0;
    this.scene = new THREE.Scene(); this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)); this.quad.frustumCulled = false; this.scene.add(this.quad);
    this.mBright = new THREE.ShaderMaterial({ uniforms: { tSrc: { value: null }, uThr: { value: .8 } }, vertexShader: VS, depthTest: false,
      fragmentShader: 'uniform sampler2D tSrc; uniform float uThr; varying vec2 vUv; void main(){ vec3 c = texture2D(tSrc, vUv).rgb; float l = max(c.r, max(c.g, c.b)); gl_FragColor = vec4(c * smoothstep(uThr, uThr + .6, l), 1.); }' });
    this.mBlur = new THREE.ShaderMaterial({ uniforms: { tSrc: { value: null }, uDir: { value: new THREE.Vector2() } }, vertexShader: VS, depthTest: false,
      fragmentShader: 'uniform sampler2D tSrc; uniform vec2 uDir; varying vec2 vUv; void main(){ vec3 c = texture2D(tSrc, vUv).rgb * .227; c += (texture2D(tSrc, vUv + uDir * 1.38).rgb + texture2D(tSrc, vUv - uDir * 1.38).rgb) * .316; c += (texture2D(tSrc, vUv + uDir * 3.23).rgb + texture2D(tSrc, vUv - uDir * 3.23).rgb) * .07; gl_FragColor = vec4(c, 1.); }' });
    this.mComp = new THREE.ShaderMaterial({
      uniforms: { tScene: { value: null }, tBloom: { value: null }, tPrev: { value: null }, uTime: { value: 0 }, uGhost: { value: .22 }, uGlitch: { value: 0 }, uBloom: { value: .9 }, uFade: { value: 0 }, uWhite: { value: 0 }, uDither: { value: 1 } },
      vertexShader: VS, depthTest: false,
      fragmentShader: `uniform sampler2D tScene, tBloom, tPrev; uniform float uTime, uGhost, uGlitch, uBloom, uFade, uWhite, uDither; varying vec2 vUv;
      float h(float n){ return fract(sin(n) * 43758.5453); }
      float bayer(vec2 p){ int x = int(mod(p.x, 4.)), y = int(mod(p.y, 4.)); int i = x + y * 4;
        float m[16] = float[16](0.,8.,2.,10.,12.,4.,14.,6.,3.,11.,1.,9.,15.,7.,13.,5.); return m[i] / 16. - .5; }
      vec3 toSRGB(vec3 c){ c = max(c, 0.); return mix(c * 12.92, 1.055 * pow(c, vec3(1. / 2.4)) - .055, step(.0031308, c)); }
      void main(){
        vec2 uv = vUv;
        if (uGlitch > .001) { float row = floor(uv.y * 54.); float n = h(row * 12.99 + floor(uTime * 22.) * 7.7); if (n > 1. - uGlitch * .7) uv.x += (h(row + uTime) - .5) * .22 * uGlitch; }
        float ca = .0012 + uGlitch * .012;
        vec3 c = vec3(texture2D(tScene, uv + vec2(ca, 0.)).r, texture2D(tScene, uv).g, texture2D(tScene, uv - vec2(ca, 0.)).b);
        c += texture2D(tBloom, uv).rgb * uBloom;
        c = c / (1. + c * .12);
        c = toSRGB(c);
        vec2 d = vUv - .5; c *= 1. - dot(d, d) * .6;
        c = mix(c, texture2D(tPrev, vUv).rgb, uGhost);
        c = mix(c, vec3(0.), uFade); c = mix(c, vec3(1.), uWhite);
        c = floor(c * 31. + .5 + bayer(gl_FragCoord.xy) * uDither) / 31.;
        gl_FragColor = vec4(c, 1.);
      }` });
    this.mCopy = new THREE.ShaderMaterial({ uniforms: { tSrc: { value: null } }, vertexShader: VS, depthTest: false, fragmentShader: 'uniform sampler2D tSrc; varying vec2 vUv; void main(){ gl_FragColor = texture2D(tSrc, vUv); }' });
    this.U = this.mComp.uniforms;
  }
  setSize(w, h) {
    this.rtScene.setSize(w, h); this.hist[0].setSize(w, h); this.hist[1].setSize(w, h);
    const bw = Math.max(2, w >> 2), bh = Math.max(2, h >> 2); this.rtA.setSize(bw, bh); this.rtB.setSize(bw, bh); this.bw = bw; this.bh = bh;
  }
  pass(mat, target) { this.quad.material = mat; this.r.setRenderTarget(target); this.r.render(this.scene, this.cam); }
  render(scene, camera, t) {
    const r = this.r;
    r.setRenderTarget(this.rtScene); r.render(scene, camera);
    this.mBright.uniforms.tSrc.value = this.rtScene.texture; this.pass(this.mBright, this.rtA);
    this.mBlur.uniforms.tSrc.value = this.rtA.texture; this.mBlur.uniforms.uDir.value.set(1 / this.bw, 0); this.pass(this.mBlur, this.rtB);
    this.mBlur.uniforms.tSrc.value = this.rtB.texture; this.mBlur.uniforms.uDir.value.set(0, 1 / this.bh); this.pass(this.mBlur, this.rtA);
    const cur = this.hist[this.hi], prev = this.hist[1 - this.hi];
    this.U.tScene.value = this.rtScene.texture; this.U.tBloom.value = this.rtA.texture; this.U.tPrev.value = prev.texture; this.U.uTime.value = t;
    this.pass(this.mComp, cur);
    this.mCopy.uniforms.tSrc.value = cur.texture; this.pass(this.mCopy, null);
    this.hi = 1 - this.hi;
  }
}
