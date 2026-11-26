// DER: rigged character, clip switching with hip continuity, held props.
import * as THREE from 'three';
import { lambertize, psx, TEX } from './fx.js';

const _v = new THREE.Vector3(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3();

function inPlace(clip) {
  const tr = clip.tracks.find(t => t.name === 'Hips.position'); if (!tr) return;
  const v = tr.values; for (let i = 0; i < v.length; i += 3) { v[i] = 0; v[i + 2] = 0; }
}

export function makeRevolver() {
  const g = new THREE.Group();
  const gold = psx(new THREE.MeshLambertMaterial({ map: TEX.gold, emissive: 0x3a2400 }));
  const wood = psx(new THREE.MeshLambertMaterial({ color: 0x5a1e12 }));
  const red = psx(new THREE.MeshLambertMaterial({ color: 0xd0141c, emissive: 0x300000 }));
  const add = (geo, mat, x, y, z, rx = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.x = rx; g.add(m); return m; };
  // gun points along +Y, top is +Z, grip goes to -Z
  add(new THREE.CylinderGeometry(.017, .017, .2, 8), gold, 0, .16, .035);
  add(new THREE.CylinderGeometry(.036, .036, .055, 8), gold, 0, .045, .03);
  add(new THREE.BoxGeometry(.04, .1, .06), gold, 0, .02, .015);
  add(new THREE.BoxGeometry(.034, .045, .11), wood, 0, -.035, -.05, -.35);
  add(new THREE.BoxGeometry(.05, .03, .03), red, 0, .2, .062);
  add(new THREE.BoxGeometry(.03, .02, .05), red, .03, .2, .055, .6);
  add(new THREE.BoxGeometry(.03, .02, .05), red, -.03, .2, .055, -.6);
  g.userData.muzzle = new THREE.Vector3(0, .27, .035);
  return g;
}

export function makeShotgun() {
  const g = new THREE.Group();
  const candy = TEX.candy.clone(); candy.repeat.set(1, 6); candy.needsUpdate = true;
  const cm = psx(new THREE.MeshLambertMaterial({ map: candy }));
  const gold = psx(new THREE.MeshLambertMaterial({ map: TEX.gold, emissive: 0x2a1800 }));
  const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); g.add(m); return m; };
  add(new THREE.CylinderGeometry(.024, .024, .62, 8), cm, 0, .36, .02);
  add(new THREE.CylinderGeometry(.032, .032, .16, 8), gold, 0, .22, -.015);
  add(new THREE.BoxGeometry(.06, .18, .08), cm, 0, 0, 0);
  const stock = add(new THREE.BoxGeometry(.05, .3, .08), cm, 0, -.22, -.02); stock.rotation.x = .12;
  const hook = new THREE.Mesh(new THREE.TorusGeometry(.07, .022, 6, 10, Math.PI), cm); hook.position.set(0, -.39, -.09); hook.rotation.set(0, Math.PI / 2, Math.PI); g.add(hook);
  return g;
}

export class Der {
  constructor(gltf, opts = {}) {
    this.root = new THREE.Group(); this.off = new THREE.Group(); this.root.add(this.off);
    const sc = gltf.scene; this.off.add(sc); this.model = sc;
    lambertize(sc, { side: THREE.DoubleSide });
    sc.traverse(o => { if (o.isMesh) { o.frustumCulled = false; o.material.emissive = new THREE.Color(0x140808); } if (o.isBone) { if (o.name === 'Hips') this.hips = o; if (o.name === 'RightHand') this.hand = o; if (o.name === 'Spine02') this.spine = o; if (o.name === 'Head') this.head = o; } });
    this.armature = sc.getObjectByName('Armature') || sc.children[0];
    this.clips = {}; for (const c of gltf.animations) this.clips[c.name] = c;
    (opts.inPlace || ['idle', 'draw', 'fall', 'dance', 'react', 'dodge']).forEach(n => this.clips[n] && inPlace(this.clips[n]));
    if (this.clips.sit) this.clips.sitUp = THREE.AnimationUtils.subclip(this.clips.sit, 'sitUp', 0, 40, 30);
    this.mixer = new THREE.AnimationMixer(sc);
    this.cur = null; this.name = '';
    this.offFrom = new THREE.Vector3(); this.offTo = new THREE.Vector3(); this.offK = 1; this.offDur = .3; this.relax = false;
    this.gun = makeRevolver(); this.gun.visible = false;
    this.shotgun = makeShotgun(); this.shotgun.visible = false;
    this.gunOff = { p: new THREE.Vector3(.0, .075, -.01), q: new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, 0)) };
    this.sgOff = { p: new THREE.Vector3(.04, .02, -.17), q: new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, .62)) };
  }
  // hips position (x,z) of a clip at time t, in this.off space
  hipsAt(clip, t) {
    const tr = clip.tracks.find(k => k.name === 'Hips.position'); if (!tr) return _v.set(0, 0, 0);
    const out = tr.createInterpolant().evaluate(t); _v.set(out[0], out[1], out[2]);
    this.armature.updateMatrix(); return _v.applyMatrix4(this.armature.matrix);
  }
  play(name, o = {}) {
    const clip = this.clips[name]; if (!clip) return;
    const fade = o.fade ?? .3, from = o.from ?? 0;
    if (o.keepHips && this.cur) {
      this.root.updateMatrixWorld(true); this.hips.getWorldPosition(_p); this.root.worldToLocal(_p);
      const h = this.hipsAt(clip, from);
      this.offFrom.copy(this.off.position); this.offTo.set(_p.x - h.x, 0, _p.z - h.z); this.offK = 0; this.offDur = Math.max(.05, fade); this.relax = false;
    } else if (o.resetOff) { this.off.position.set(0, 0, 0); this.offK = 1; }
    else this.relax = true;
    const a = this.mixer.clipAction(clip);
    const prev = this.cur;
    a.reset(); a.time = from; a.timeScale = o.speed ?? 1; a.setLoop(o.once ? THREE.LoopOnce : o.pingpong ? THREE.LoopPingPong : THREE.LoopRepeat, Infinity); a.clampWhenFinished = true; a.setEffectiveWeight(1);
    a.play();
    if (prev && prev !== a && fade > 0) a.crossFadeFrom(prev, fade, false); else if (prev && prev !== a) prev.stop();
    this.cur = a; this.name = name;
  }
  get time() { return this.cur ? this.cur.time : 0; }
  update(dt) {
    this.mixer.update(dt);
    if (this.offK < 1) { this.offK = Math.min(1, this.offK + dt / this.offDur); this.off.position.lerpVectors(this.offFrom, this.offTo, this.offK); }
    else if (this.relax) { this.off.position.multiplyScalar(Math.exp(-dt * 1.5)); }
    this.root.updateMatrixWorld(true);
    this.follow(this.gun, this.hand, this.gunOff);
    this.follow(this.shotgun, this.spine, this.sgOff);
  }
  follow(obj, bone, off) {
    if (!obj.visible || !obj.parent) return;
    bone.matrixWorld.decompose(_p, _q, _s);
    obj.position.copy(off.p).multiplyScalar(this.root.scale.x).applyQuaternion(_q).add(_p);
    obj.quaternion.copy(_q).multiply(off.q);
    obj.scale.setScalar(this.root.scale.x);
  }
  headPos(v) { return this.head.getWorldPosition(v); }
  muzzlePos(v) { return v.copy(this.gun.userData.muzzle).applyMatrix4(this.gun.matrixWorld); }
}
