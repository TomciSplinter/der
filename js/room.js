// The cozy PS2 living room: CRT TV with the live sleigh-chase feed, fireplace, tree, Der in his armchair.
import * as THREE from 'three';
import { psx, lambertize, ctex, TEX, rand, clamp, lerp } from './fx.js';
import { Boom, drawCrack } from './boom.js';

const TV_S = .8, TV_POS = new THREE.Vector3(0, .95, -.25);
const SCR = { x: 0, y: .05, z: .356, w: .672, h: .532 };
export const SCREEN = new THREE.Vector3(TV_POS.x + SCR.x * TV_S, TV_POS.y + SCR.y * TV_S, TV_POS.z + SCR.z * TV_S);
export const SCREEN_H = SCR.h * TV_S, SCREEN_W = SCR.w * TV_S;

const L = (opts) => psx(new THREE.MeshLambertMaterial(opts));
const box = (w, h, d, mat, x, y, z, parent) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); parent && parent.add(m); return m; };

export class Room {
  constructor(A, feedTex) {
    const S = this.scene = new THREE.Scene();
    S.background = new THREE.Color(0x030405); S.fog = new THREE.Fog(0x030405, 8, 18);
    this.cam = new THREE.PerspectiveCamera(45, 1, .02, 40);
    this.t = 0; this.loose = []; this.suction = 0; this.bolts = []; this.boltT = 0; this.cracks = [];

    /* lights */
    S.add(new THREE.HemisphereLight(0x5a6a9a, 0x1a0e06, 1.1));
    this.fireL = new THREE.PointLight(0xff7a2a, 7, 8, 1.3); this.fireL.position.set(-1.95, .45, .55); S.add(this.fireL);
    this.tvL = new THREE.PointLight(0x9fc4ff, 3.5, 7, 1.3); this.tvL.position.set(0, 1.0, .75); S.add(this.tvL);
    this.treeL = new THREE.PointLight(0xffc870, 2.4, 5, 1.3); this.treeL.position.set(1.7, 1.2, .55); S.add(this.treeL);
    const lamp = new THREE.PointLight(0xffd6a0, 6, 9, 1.2); lamp.position.set(-1.1, 1.75, 3.6); S.add(lamp);
    this.flashL = new THREE.PointLight(0xffe0a0, 0, 6, 1.5); S.add(this.flashL);

    /* shell */
    const floorT = TEX.floor.clone(); floorT.repeat.set(3.5, 3.5); floorT.needsUpdate = true;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(7, 7), L({ map: floorT })); floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, 2.4); S.add(floor);
    const wallT = TEX.wall.clone(); wallT.repeat.set(5.5, 2.5); wallT.needsUpdate = true;
    const wm = L({ map: wallT });
    const back = new THREE.Mesh(new THREE.PlaneGeometry(7, 3.2), wm); back.position.set(0, 1.6, -.62); S.add(back);
    const side = new THREE.PlaneGeometry(6.4, 3.2);
    const lw = new THREE.Mesh(side, wm); lw.rotation.y = Math.PI / 2; lw.position.set(-3.2, 1.6, 2.6); S.add(lw);
    const rw = new THREE.Mesh(side, wm); rw.rotation.y = -Math.PI / 2; rw.position.set(3.2, 1.6, 2.6); S.add(rw);
    const fw = new THREE.Mesh(new THREE.PlaneGeometry(7, 3.2), wm); fw.rotation.y = Math.PI; fw.position.set(0, 1.6, 5.7); S.add(fw);
    const doorM = L({ map: TEX.wood }), knob = L({ map: TEX.gold });
    box(.95, 2.1, .06, doorM, -1.6, 1.05, 5.66, S); box(.07, .07, .04, knob, -1.95, 1.0, 5.62, S); box(1.05, .08, .08, L({ color: 0x2a160a }), -1.6, 2.14, 5.66, S);
    box(1.5, .05, .25, L({ map: TEX.wood }), 1.35, 1.3, 5.58, S);
    const clock = new THREE.Mesh(new THREE.CircleGeometry(.22, 16), L({ color: 0xf2ecd8 })); clock.rotation.y = Math.PI; clock.position.set(.15, 2.25, 5.66); S.add(clock);
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(7, 7), L({ color: 0x1a1410 })); ceil.rotation.x = Math.PI / 2; ceil.position.set(0, 3.2, 2.4); S.add(ceil);
    const trim = L({ color: 0x2a160a });
    box(6.4, .14, .04, trim, 0, .07, -.6, S); box(.04, .14, 6.4, trim, -3.18, .07, 2.6, S); box(.04, .14, 6.4, trim, 3.18, .07, 2.6, S);
    box(6.4, .08, .05, trim, 0, 2.45, -.59, S);
    // rug
    const rug = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.9), L({ map: TEX.rug })); rug.rotation.x = -Math.PI / 2; rug.position.set(.3, .006, 1.9); S.add(rug);
    // window on the left wall with snow
    const win = new THREE.Group(); win.position.set(-3.17, 1.55, 1.7); win.rotation.y = Math.PI / 2; S.add(win);
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.25), new THREE.MeshBasicMaterial({ map: TEX.night })); win.add(glass);
    const frameM = L({ color: 0xe8e4da });
    box(1.22, .07, .06, frameM, 0, .64, .02, win); box(1.22, .07, .06, frameM, 0, -.64, .02, win); box(.07, 1.3, .06, frameM, -.58, 0, .02, win); box(.07, 1.3, .06, frameM, .58, 0, .02, win);
    box(.04, 1.25, .05, frameM, 0, 0, .03, win); box(1.1, .04, .05, frameM, 0, 0, .03, win);
    const curt = L({ color: 0x8a1016 }); box(.3, 1.7, .05, curt, -.78, .05, .06, win); box(.3, 1.7, .05, curt, .78, .05, .06, win);
    const fl = new Float32Array(60 * 3); for (let i = 0; i < 60; i++) { fl[i * 3] = rand(-.52, .52); fl[i * 3 + 1] = rand(-.6, .6); fl[i * 3 + 2] = .01; }
    const flg = new THREE.BufferGeometry(); flg.setAttribute('position', new THREE.BufferAttribute(fl, 3));
    this.winSnow = new THREE.Points(flg, new THREE.PointsMaterial({ size: .025, color: 0xffffff, map: TEX.flake, transparent: true, depthWrite: false })); win.add(this.winSnow);

    /* TV + stand */
    const wood = TEX.wood.clone(); wood.repeat.set(2, 1); wood.needsUpdate = true;
    const woodM = L({ map: wood });
    box(1.25, .55, .62, woodM, 0, .275, -.25, S);
    const dark = L({ color: 0x1a0c05 }); box(.5, .32, .02, dark, -.3, .27, .065, S); box(.5, .32, .02, dark, .3, .27, .065, S);
    const vhs = L({ color: 0x111111 }); box(.19, .025, .11, vhs, .38, .57, .02, S); box(.19, .025, .11, L({ color: 0x8a1a1a }), .39, .595, .02, S);
    const tv = this.tv = A.tv.scene; lambertize(tv, { side: THREE.DoubleSide }); tv.scale.setScalar(TV_S); tv.position.copy(TV_POS); S.add(tv);
    const ant = L({ color: 0xc9ccd4 });
    for (const s of [-1, 1]) { const a = new THREE.Mesh(new THREE.CylinderGeometry(.006, .009, .62, 5), ant); a.position.set(s * .17, TV_POS.y + .62, TV_POS.z - .06); a.rotation.z = -s * .55; S.add(a); const b = new THREE.Mesh(new THREE.SphereGeometry(.018, 6, 4), ant); b.position.set(s * .34, TV_POS.y + .88, TV_POS.z - .06); S.add(b); this.loose.push(a, b); }
    box(.12, .05, .08, ant, 0, TV_POS.y + .41, TV_POS.z - .06, S);
    // screen: CRT shader with the live feed
    this.over = ctex(256, 192, () => { }, { nearest: false });
    const sg = new THREE.PlaneGeometry(SCR.w, SCR.h, 20, 16); const sp = sg.attributes.position;
    for (let i = 0; i < sp.count; i++) { const x = sp.getX(i) / (SCR.w / 2), y = sp.getY(i) / (SCR.h / 2); sp.setZ(i, .028 * (1 - x * x * .6) * (1 - y * y * .6)); }
    this.screenU = { tFeed: { value: feedTex }, tOver: { value: this.over }, uTime: { value: 0 }, uSwirl: { value: 0 }, uOn: { value: 1 }, uFlash: { value: 0 }, uNoise: { value: .05 } };
    const screen = new THREE.Mesh(sg, new THREE.ShaderMaterial({
      uniforms: this.screenU,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
      fragmentShader: `uniform sampler2D tFeed, tOver; uniform float uTime, uSwirl, uOn, uFlash, uNoise; varying vec2 vUv;
        float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
        void main(){
          vec2 c = vUv - .5; c *= 1. + .16 * dot(c, c);
          float r = length(c), a = atan(c.y, c.x);
          a += uSwirl * (1.25 - r) * 10. + uSwirl * uTime * 5.;
          vec2 uv = .5 + vec2(cos(a), sin(a)) * r * (1. - uSwirl * .45);
          vec3 col = (uv.x < 0. || uv.x > 1. || uv.y < 0. || uv.y > 1.) ? vec3(0.) : texture2D(tFeed, uv).rgb;
          float row = floor(vUv.y * 160.); col *= .78 + .22 * step(.5, fract(vUv.y * 160.));
          col += (h(vec2(row, floor(uTime * 30.))) - .5) * uNoise;
          vec4 ov = texture2D(tOver, vUv); col = mix(col, ov.rgb, ov.a * (1. - uSwirl));
          vec3 portal = mix(vec3(1.4, 1.0, .45), vec3(.55, 1.0, 1.5), .5 + .5 * sin(a * 3. - uTime * 9.));
          col = mix(col, portal * (1.6 - r * 2.2), smoothstep(0., 1., uSwirl) * smoothstep(.6, .0, r) * .9);
          col *= 1. - dot(c, c) * 1.6;
          col = mix(vec3(.02, .035, .03), col * 1.15, uOn) + uFlash;
          gl_FragColor = vec4(col, 1.);
        }` }));
    screen.position.set(SCR.x, SCR.y, SCR.z); tv.add(screen); this.screen = screen;
    // wreath + posters
    const wr = new THREE.Mesh(new THREE.TorusGeometry(.24, .075, 6, 14), L({ color: 0x1f5a2c, flatShading: true })); wr.position.set(0, 1.98, -.58); S.add(wr); this.loose.push(wr);
    const bow = L({ color: 0xc8141c, emissive: 0x200000 }); box(.12, .07, .03, bow, -.06, 1.76, -.53, S).rotation.z = .4; box(.12, .07, .03, bow, .06, 1.76, -.53, S).rotation.z = -.4; box(.05, .06, .04, bow, 0, 1.76, -.52, S);
    const frameG = L({ map: TEX.gold });
    const poster = (img, x, y, z, ry, s) => { const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; S.add(g); box(s + .08, s + .08, .03, frameG, 0, 0, 0, g); const p = new THREE.Mesh(new THREE.PlaneGeometry(s, s), L({ map: img })); p.position.z = .02; g.add(p); };
    poster(A.posters[2], -1.95, 1.85, -.6, 0, .55); poster(A.posters[4], -3.17, 1.65, 3.4, Math.PI / 2, .6); poster(A.posters[0], 3.17, 1.6, 1.6, -Math.PI / 2, .6); poster(A.posters[3], 3.17, 1.6, 2.85, -Math.PI / 2, .6); poster(A.posters[5], 1.35, 1.95, 5.66, Math.PI, .55); poster(A.posters[1], .15, 1.55, 5.66, Math.PI, .45);

    /* fireplace */
    const fp = A.fireplace.scene; lambertize(fp, { side: THREE.DoubleSide }); fp.scale.setScalar(1.15); fp.position.set(-1.95, .51, -.08); S.add(fp);
    this.flames = [];
    for (let i = 0; i < 4; i++) { const f = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.flame, color: 0xffb060, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); f.position.set(-1.95 + (i - 1.5) * .1, .2, .3); f.scale.set(.22, .4, 1); S.add(f); this.flames.push(f); }
    const stockT = ctex(48, 80, (g) => {
      g.drawImage(TEX.bill.userData.canvas, 0, 0, 128, 56, 4, 0, 34, 15); g.drawImage(TEX.bill.userData.canvas, 0, 0, 128, 56, 14, 3, 30, 13);
      g.fillStyle = '#c3141b'; g.beginPath(); g.moveTo(8, 12); g.lineTo(34, 12); g.lineTo(34, 54); g.quadraticCurveTo(34, 66, 44, 66); g.quadraticCurveTo(46, 78, 30, 78); g.lineTo(18, 78); g.quadraticCurveTo(6, 78, 8, 62); g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,255,255,.16)'; for (let y = 24; y < 76; y += 9) g.fillRect(6, y, 40, 3);
      g.fillStyle = '#f2f2ee'; g.fillRect(6, 10, 30, 12);
    });
    for (let i = 0; i < 3; i++) { const s = new THREE.Mesh(new THREE.PlaneGeometry(.22, .37), psx(new THREE.MeshLambertMaterial({ map: stockT, alphaTest: .5, side: THREE.DoubleSide }))); s.position.set(-2.3 + i * .35, .88, .47); s.rotation.z = rand(-.06, .06); S.add(s); }

    /* tree, lights, presents */
    const tree = this.tree = A.tree.scene; lambertize(tree, { side: THREE.DoubleSide, emissive: 0xffffff, emissiveIntensity: .12 }); tree.scale.setScalar(2.05); tree.position.set(1.85, 1.025, .05); S.add(tree);
    const tl = 54, tp = new Float32Array(tl * 3), tc = new Float32Array(tl * 3); this.treeCols = [];
    const pal = [[1, .2, .15], [.2, 1, .35], [1, .8, .2], [.3, .55, 1], [1, 1, .9]];
    for (let i = 0; i < tl; i++) { const h = rand(.1, .9), rr = (1 - h) * .62 + .03, a = rand(0, 6.28); tp.set([1.85 + Math.cos(a) * rr, .12 + h * 1.75, .05 + Math.sin(a) * rr], i * 3); this.treeCols.push(pal[i % 5]); }
    const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.BufferAttribute(tp, 3)); tg.setAttribute('color', new THREE.BufferAttribute(tc, 3));
    this.treeLights = new THREE.Points(tg, new THREE.PointsMaterial({ size: .09, map: TEX.glow, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); S.add(this.treeLights);
    // string lights along the back wall
    const sl = 40, sp2 = new Float32Array(sl * 3), sc2 = new Float32Array(sl * 3); const wire = [];
    for (let i = 0; i < sl; i++) { const u = i / (sl - 1), x = -3.1 + u * 6.2, y = 2.78 - Math.abs(Math.sin(u * Math.PI * 4)) * .22; sp2.set([x, y, -.57], i * 3); wire.push(new THREE.Vector3(x, y + .02, -.58)); }
    const sgeo = new THREE.BufferGeometry(); sgeo.setAttribute('position', new THREE.BufferAttribute(sp2, 3)); sgeo.setAttribute('color', new THREE.BufferAttribute(sc2, 3));
    this.strLights = new THREE.Points(sgeo, new THREE.PointsMaterial({ size: .1, map: TEX.glow, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); S.add(this.strLights);
    S.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(wire), new THREE.LineBasicMaterial({ color: 0x0a1a0a })));
    // presents (loose: they get sucked into the TV)
    const pm = TEX.presents.map(t => L({ map: t }));
    [[1.35, .3, .45, .2, .35], [1.6, .22, .7, .28, .22], [2.25, .26, .6, .25, .3], [2.1, .18, .2, .2, .2], [1.15, .16, .9, .16, .16], [2.4, .2, .95, .22, .22]].forEach(([x, y, z, w, d], i) => {
      const m = box(w, y * 2 * .8 + .05, d, pm[i % pm.length], x, y * .8 + .025, z, S); m.rotation.y = rand(-.5, .5); this.loose.push(m); });
    const cashM = [L({ map: TEX.cashSide }), L({ map: TEX.cashSide }), L({ map: TEX.cash }), L({ map: TEX.cash }), L({ map: TEX.cashSide }), L({ map: TEX.cashSide })];
    for (let i = 0; i < 3; i++) { const c = new THREE.Mesh(new THREE.BoxGeometry(.26, .09, .13), cashM); c.position.set(1.9 + i * .05, .045 + i * .09, .9); c.rotation.y = rand(-.4, .4); S.add(c); this.loose.push(c); }

    /* armchair + table */
    const ch = this.chair = A.armchair.scene; lambertize(ch, { side: THREE.DoubleSide, emissive: 0xffffff, emissiveIntensity: .18 }); ch.scale.setScalar(.95); ch.rotation.y = Math.PI; ch.position.set(.35, .475, 2.78); S.add(ch);
    const tbl = new THREE.Group(); tbl.position.set(.3, 0, 1.5); S.add(tbl);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(.42, .42, .05, 16), woodM); top.position.y = .42; tbl.add(top);
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + .78; box(.05, .4, .05, woodM, Math.cos(a) * .3, .2, Math.sin(a) * .3, tbl); }
    const white = L({ color: 0xf2f0ea });
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(.13, .11, .015, 14), white); plate.position.set(-.12, .452, .05); S.add(plate); plate.position.add(tbl.position); this.loose.push(plate);
    const ck = L({ map: TEX.cookie });
    for (let i = 0; i < 5; i++) { const c = new THREE.Mesh(new THREE.CylinderGeometry(.035, .035, .012, 10), ck); c.position.set(tbl.position.x - .12 + Math.cos(i * 1.3) * .06, .468 + i * .004, tbl.position.z + .05 + Math.sin(i * 1.3) * .06); S.add(c); this.loose.push(c); }
    const milk = new THREE.Mesh(new THREE.CylinderGeometry(.035, .03, .14, 10), white); milk.position.set(tbl.position.x + .16, .515, tbl.position.z - .1); S.add(milk); this.loose.push(milk);
    const mug = new THREE.Group(); mug.position.set(tbl.position.x + .2, .49, tbl.position.z + .14); S.add(mug); this.loose.push(mug);
    mug.add(new THREE.Mesh(new THREE.CylinderGeometry(.045, .045, .09, 10), L({ color: 0xc8141c }))); const hdl = new THREE.Mesh(new THREE.TorusGeometry(.03, .009, 5, 8), L({ color: 0xc8141c })); hdl.position.x = .05; mug.add(hdl);
    for (let i = 0; i < 3; i++) { const c = new THREE.Mesh(new THREE.BoxGeometry(.2, .06, .1), cashM); c.position.set(tbl.position.x + .02 + i * .03, .475 + i * .06, tbl.position.z - .22 + i * .01); c.rotation.y = rand(-.3, .3); S.add(c); this.loose.push(c); }
    this.tableGunSpot = new THREE.Vector3(tbl.position.x - .2, .455, tbl.position.z - .12);
    // floor lamp
    const lp = L({ color: 0x2a2a2a }); box(.04, 1.6, .04, lp, -1.3, .8, 3.7, S); box(.3, .03, .3, lp, -1.3, .015, 3.7, S);
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(.16, .26, .26, 10, 1, true), new THREE.MeshBasicMaterial({ color: 0xffcf8a, side: THREE.DoubleSide })); shade.position.set(-1.3, 1.68, 3.7); S.add(shade);
    // shotgun leaning on the chair
    this.leanGun = null;

    /* lightning bolts */
    for (let i = 0; i < 3; i++) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(16 * 3), 3)); const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xc8ecff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); l.visible = false; l.frustumCulled = false; S.add(l); this.bolts.push(l); }
    this.muzzle = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.burst, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); this.muzzle.scale.setScalar(.45); this.muzzle.visible = false; S.add(this.muzzle);
    this.boom = new Boom(S);
    this.drawOverlay(0);
  }
  drawOverlay(t) {
    const c = this.over.userData.canvas, g = c.getContext('2d'); g.clearRect(0, 0, 256, 192);
    g.font = 'bold 15px Arial'; g.textBaseline = 'top';
    if (Math.floor(t * 1.6) % 2 === 0) { g.fillStyle = '#ff2a2a'; g.beginPath(); g.arc(24, 21, 6, 0, 7); g.fill(); }
    g.fillStyle = '#fff'; g.shadowColor = '#000'; g.shadowOffsetX = 2; g.shadowOffsetY = 2; g.fillText('LIVE', 36, 13);
    g.font = 'bold 12px Arial'; g.fillText('CH 3', 206, 14); g.shadowOffsetX = g.shadowOffsetY = 0;
    g.fillStyle = 'rgba(150,10,14,.92)'; g.fillRect(0, 150, 256, 24); g.fillStyle = '#ffd54a'; g.fillRect(0, 150, 62, 24);
    g.fillStyle = '#2a0303'; g.font = 'bold 11px Arial'; g.fillText('BREAKING', 6, 157);
    g.save(); g.beginPath(); g.rect(62, 150, 194, 24); g.clip();
    const msg = 'DEER IN SUIT STEALS SANTA\'S SLEIGH  ★  NORTH POLE PD IN PURSUIT  ★  CASH FALLING FROM THE SKY  ★  ';
    g.fillStyle = '#fff'; g.font = 'bold 12px Arial'; const w = g.measureText(msg).width; const x = 66 - ((t * 48) % w);
    g.fillText(msg, x, 156); g.fillText(msg, x + w, 156); g.restore();
    for (const c of this.cracks) drawCrack(g, c.x, c.y, c.r, c.seed);
    this.over.needsUpdate = true;
  }
  setCam(p, l, fov) { this.cam.position.copy(p); this.cam.lookAt(l); if (fov && this.cam.fov !== fov) { this.cam.fov = fov; this.cam.updateProjectionMatrix(); } }
  bolt(from, to) {
    this.boltT -= 1; if (this.boltT > 0) return; this.boltT = 3;
    for (const b of this.bolts) {
      const p = b.geometry.attributes.position; const n = p.count;
      for (let i = 0; i < n; i++) { const u = i / (n - 1), j = (i === 0 || i === n - 1) ? 0 : .09 * Math.sin(u * Math.PI);
        p.setXYZ(i, lerp(from.x, to.x, u) + rand(-j, j), lerp(from.y, to.y, u) + rand(-j, j), lerp(from.z, to.z, u) + rand(-j, j)); }
      p.needsUpdate = true; b.visible = true;
    }
  }
  hideBolts() { this.bolts.forEach(b => b.visible = false); }
  addCrack(u, v) { this.cracks.push({ x: u * 256, y: v * 192, r: rand(70, 110), seed: Math.random() }); }
  blow() {
    const p = SCREEN.clone(); p.z += .06;
    this.boom.glass(p, new THREE.Vector3(0, .25, 1), 90); this.boom.explode(p, .32, this.cam);
    for (let i = 0; i < 60; i++) this.boom.sparks.spawn(p, new THREE.Vector3(rand(-1, 1), rand(-.2, 1.2), rand(.2, 1.4)).normalize().multiplyScalar(rand(2, 6)), rand(.6, 1.4), rand(.5, 1));
    this.flashL.position.copy(p); this.flashL.intensity = 60; setTimeout(() => this.flashL.intensity = 0, 160);
  }
  update(dt, t) {
    this.t = t; this.screenU.uTime.value = t;
    if ((t * 12 | 0) !== this._ov) { this._ov = t * 12 | 0; this.drawOverlay(t); }
    // fire flicker
    const f = .75 + .25 * Math.sin(t * 13) * Math.sin(t * 7.3 + 1) + rand(-.08, .08);
    this.fireL.intensity = 6 + f * 3; this.flames.forEach((s, i) => { s.scale.set(.2 + .05 * Math.sin(t * 9 + i), .32 + .12 * Math.sin(t * 11 + i * 2) + rand(0, .04), 1); s.material.opacity = .7 + .3 * f; });
    this.tvL.intensity = (3 + Math.sin(t * 17) * .4 + rand(-.3, .3)) * (1 + this.screenU.uSwirl.value * 3);
    // tree + string lights
    const tc = this.treeLights.geometry.attributes.color;
    for (let i = 0; i < tc.count; i++) { const c = this.treeCols[i]; const k = .35 + .65 * (Math.sin(t * 2.2 + i * 1.7) > .1 ? 1 : .15); tc.setXYZ(i, c[0] * k, c[1] * k, c[2] * k); } tc.needsUpdate = true;
    const sc = this.strLights.geometry.attributes.color; const ph = Math.floor(t * 3);
    for (let i = 0; i < sc.count; i++) { const c = [[1, .2, .15], [.2, 1, .35], [1, .8, .2], [.3, .55, 1]][i % 4]; const k = ((i + ph) % 4 === 0) ? .25 : 1; sc.setXYZ(i, c[0] * k, c[1] * k, c[2] * k); } sc.needsUpdate = true;
    // window snow
    const wp = this.winSnow.geometry.attributes.position; for (let i = 0; i < wp.count; i++) { let y = wp.getY(i) - dt * .12; if (y < -.6) y = .6; wp.setY(i, y); wp.setX(i, wp.getX(i) + Math.sin(t + i) * dt * .02); } wp.needsUpdate = true;
    this.boom.update(dt, this.cam);
    // suction: loose props fly into the screen
    if (this.suction > 0) {
      this.tree.rotation.z = Math.sin(t * 31) * .035 * this.suction; this.tree.rotation.x = Math.sin(t * 27) * .025 * this.suction;
      if (Math.random() < .3) this.boom.sparks.spawn(SCREEN, new THREE.Vector3(rand(-1, 1), rand(0, 1), rand(.3, 1)).multiplyScalar(rand(1, 4)), .5, .7);
      for (const o of this.loose) {
        if (!o.visible) continue; o.userData.v = o.userData.v || new THREE.Vector3(0, rand(.5, 1.5), 0);
        const v = o.userData.v; const d = _d.copy(SCREEN).sub(o.position); const dist = d.length();
        if (dist < .12) { o.visible = false; continue; }
        v.addScaledVector(d.normalize(), this.suction * dt * (5 + 3 / (dist + .2))); v.multiplyScalar(1 - dt * .6);
        o.position.addScaledVector(v, dt); o.rotation.x += dt * 6 * this.suction; o.rotation.z += dt * 4; if (dist < .5) o.scale.multiplyScalar(1 - dt * 3);
      }
      this.chair.position.z = Math.min(3.0, this.chair.position.z + dt * .15 * this.suction);
    }
  }
}
const _d = new THREE.Vector3();
