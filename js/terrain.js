// Backdrop for the chase: a ring of moonlit, faceted snow mountains around a long valley (the town road runs
// down the middle), forested foothills, mist that hugs the low ground and distant cabin lights.
// Everything is generated from seeded noise, so it looks the same on every visit.
import * as THREE from 'three';

const smoothstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
function mulberry(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// 2D simplex noise (Gustavson), roughly -1..1
function makeNoise(seed) {
  const rnd = mulberry(seed), perm = [...Array(256).keys()], p = new Uint8Array(512);
  for (let i = 255; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
  for (let i = 0; i < 512; i++) p[i] = perm[i & 255];
  const G = [[1, 1], [-1, 1], [1, -1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]], F2 = .5 * (Math.sqrt(3) - 1), G2 = (3 - Math.sqrt(3)) / 6;
  return (x, y) => {
    const s = (x + y) * F2, i = Math.floor(x + s), j = Math.floor(y + s), t = (i + j) * G2;
    const x0 = x - (i - t), y0 = y - (j - t), i1 = x0 > y0 ? 1 : 0, j1 = 1 - i1;
    const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2, x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2, ii = i & 255, jj = j & 255;
    let n = 0, q, g;
    q = .5 - x0 * x0 - y0 * y0; if (q > 0) { g = G[p[ii + p[jj]] & 7]; q *= q; n += q * q * (g[0] * x0 + g[1] * y0); }
    q = .5 - x1 * x1 - y1 * y1; if (q > 0) { g = G[p[ii + i1 + p[jj + j1]] & 7]; q *= q; n += q * q * (g[0] * x1 + g[1] * y1); }
    q = .5 - x2 * x2 - y2 * y2; if (q > 0) { g = G[p[ii + 1 + p[jj + 1]] & 7]; q *= q; n += q * q * (g[0] * x2 + g[1] * y2); }
    return 70 * n;
  };
}
const N1 = makeNoise(11), N2 = makeNoise(23), N3 = makeNoise(37);
// ridge network for the peaks (few octaves: finer detail would alias on the mesh)
function ridged(x, z) {
  let sum = 0, amp = .55, f = 1, w = 1;
  for (let o = 0; o < 4; o++) { let v = 1 - Math.abs(N1(x * f, z * f)); v *= v; v *= w; w = Math.min(1, v * 1.6); sum += v * amp; f *= 2.1; amp *= .48; }
  return sum;
}
// ground height: flat valley floor along the road (x ≈ 0), rolling foothills either side, then big massifs
export function terrainHeight(x, z) {
  const r = Math.hypot(x, z), a = Math.atan2(z, x);
  const start = 560 + 240 * N3(Math.cos(a) * 1.7, Math.sin(a) * 1.7); // the big range starts nearer in some directions
  const far = smoothstep(start - 220, start + 520, r);
  const valley = Math.max(smoothstep(165, 420, Math.abs(x)), smoothstep(950, 1450, r));
  const massif = smoothstep(-.7, .55, N2(x / 820 + 3.1, z / 820 - 1.7));
  const peaks = massif * (.32 + .68 * ridged(x / 520 + 7.3, z / 520 - 2.1));
  const hills = .5 + .5 * N2(x / 170, z / 170) + .2 * N2(x / 70, z / 70);
  return valley * (lerp(20, 720, far) * peaks + 34 * hills * (1 - far * .6)) - 5;
}

// low ground sits in the same thick fog as the town; higher up the air clears, so peaks stand out against the sky
const HAZE_VS = `
  { vec4 wp = modelMatrix * vec4(transformed, 1.);
  #ifdef USE_INSTANCING
    wp = modelMatrix * instanceMatrix * vec4(transformed, 1.);
  #endif
    float d = distance(wp.xyz, cameraPosition), hk = smoothstep(0., 45., wp.y), dn = uDens * mix(1., .16, hk);
    float f = 1. - exp(-dn * dn * d * d), hc = smoothstep(25., 200., wp.y);
    vHz = mix(f, min(f, .55 * (1. - exp(-d * .0005))), hc); }`;
function hazeMaterial(mat, U) {
  mat.fog = false;
  mat.onBeforeCompile = sh => {
    sh.uniforms.uDens = U.uDens; sh.uniforms.uFogC = U.uFogC;
    sh.vertexShader = 'uniform float uDens; varying float vHz;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>' + HAZE_VS);
    sh.fragmentShader = 'uniform vec3 uFogC; varying float vHz;\n' + sh.fragmentShader.replace('#include <fog_fragment>', 'gl_FragColor.rgb = mix(gl_FragColor.rgb, uFogC, vHz);');
  };
  return mat;
}

// soft, ragged cloud texture (fbm noise with a feathered edge)
export function cloudTexture() {
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d'), img = g.createImageData(S, S), n = makeNoise(41);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const u = x / S - .5, v = y / S - .5, edge = 1 - smoothstep(.22, .5, Math.hypot(u, v * 1.15));
    let f = 0, a = .5, fr = 3; for (let o = 0; o < 5; o++) { f += a * n(u * fr + 9, v * fr - 4); fr *= 2.1; a *= .5; }
    const al = smoothstep(-.05, .45, f + edge * .55 - .3) * edge, k = (y * S + x) * 4, sh = 205 + 50 * smoothstep(-.3, .4, f);
    img.data[k] = sh; img.data[k + 1] = sh + 4; img.data[k + 2] = 255; img.data[k + 3] = al * 255;
  }
  g.putImageData(img, 0, 0); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export class Terrain {
  constructor(scene, fogColor) {
    this.U = { uDens: { value: .0052 }, uFogC: { value: fogColor } };
    this.group = new THREE.Group(); scene.add(this.group);
    this.buildMesh(); this.buildTrees(); this.buildLights();
  }

  buildMesh() {
    const Na = 400, Nr = 56, r0 = 150, r1 = 1700, W = Na + 1;
    const rr = j => r0 + (r1 - r0) * Math.pow(j / Nr, 1.3);
    const P = new Float32Array(W * (Nr + 1) * 3);
    for (let j = 0; j <= Nr; j++) for (let i = 0; i <= Na; i++) {
      const a = (i % Na) / Na * Math.PI * 2, r = rr(j), x = Math.cos(a) * r, z = Math.sin(a) * r;
      P.set([x, terrainHeight(x, z), z], (j * W + i) * 3);
    }
    // two smoothing passes over the far rows round off one-vertex needles into proper peaks
    for (let pass = 0; pass < 2; pass++) {
      const Y = new Float32Array(W * (Nr + 1)); for (let q = 0; q < Y.length; q++) Y[q] = P[q * 3 + 1];
      for (let j = 1; j < Nr; j++) for (let i = 0; i <= Na; i++) {
        const q = j * W + i, l = j * W + (i === 0 ? Na - 1 : i - 1), rt = j * W + (i === Na ? 1 : i + 1);
        if (Y[q] > 60) P[q * 3 + 1] = Y[q] * .55 + (Y[l] + Y[rt] + Y[q - W] + Y[q + W]) * .1125;
      }
      for (let j = 0; j <= Nr; j++) P[(j * W + Na) * 3 + 1] = P[(j * W) * 3 + 1];
    }
    const tris = Na * Nr * 2, pos = new Float32Array(tris * 9), col = new Float32Array(tris * 9);
    const rnd = mulberry(5), A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3(), n = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3();
    const SNOW = [.8, .86, .97], ROCK = [.075, .078, .095], PINE = [.028, .062, .05], FLOOR = [.72, .78, .92];
    let k = 0;
    const tri = (ia, ib, ic) => {
      A.fromArray(P, ia * 3); B.fromArray(P, ib * 3); C.fromArray(P, ic * 3);
      pos.set([A.x, A.y, A.z, B.x, B.y, B.z, C.x, C.y, C.z], k * 9);
      n.crossVectors(e1.subVectors(C, A), e2.subVectors(B, A)).normalize(); if (n.y < 0) n.negate();
      const cx = (A.x + B.x + C.x) / 3, cy = (A.y + B.y + C.y) / 3, cz = (A.z + B.z + C.z) / 3, r = Math.hypot(cx, cz);
      const slope = 1 - n.y, m = .5 + .5 * N3(cx / 38, cz / 38), snowLine = 85 + 70 * N3(cx / 260, cz / 260);
      let c;
      if (cy < 4) c = FLOOR;
      else if (slope > .58 + .16 * (m - .5)) c = ROCK; // steep faces: bare dark rock
      else if (cy < snowLine && r < 1150 && slope > .04) { const s = .1 + .3 * m * m; c = [lerp(PINE[0], SNOW[0], s), lerp(PINE[1], SNOW[1], s), lerp(PINE[2], SNOW[2], s)]; } // snowy pine forest
      else if (slope > .4 && m < .3) c = [lerp(ROCK[0], SNOW[0], .4), lerp(ROCK[1], SNOW[1], .4), lerp(ROCK[2], SNOW[2], .4)]; // wind-scoured patches
      else c = SNOW;
      const j = .9 + rnd() * .16;
      for (let v = 0; v < 3; v++) col.set([c[0] * j, c[1] * j, c[2] * j], k * 9 + v * 3);
      k++;
    };
    for (let j = 0; j < Nr; j++) for (let i = 0; i < Na; i++) {
      const a = j * W + i, b = a + 1, c = a + W, d = c + 1;
      if ((i + j) & 1) { tri(a, b, c); tri(b, d, c); } else { tri(a, b, d); tri(a, d, c); } // counter-clockwise seen from above
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeVertexNormals();
    this.mesh = new THREE.Mesh(g, hazeMaterial(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }), this.U));
    this.mesh.frustumCulled = false; this.group.add(this.mesh);
  }

  // pines on the foothills, big enough to read as a tree line on the ridges
  buildTrees() {
    const rnd = mulberry(9), cones = [];
    for (const [rad, h, y] of [[1, 1.4, .7], [.72, 1.25, 1.45], [.45, 1, 2.1]]) { const c = new THREE.ConeGeometry(rad, h, 5, 1, true); c.translate(0, y, 0); cones.push(c.toNonIndexed()); }
    const pos = [], col = [];
    for (const c of cones) { const p = c.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); pos.push(p.getX(i), y, p.getZ(i)); const s = y > 2.3 ? .32 : y > 1.7 ? .12 : .02; col.push(lerp(.025, .78, s), lerp(.06, .84, s), lerp(.045, .95, s)); } }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals();
    const max = 2600, mesh = new THREE.InstancedMesh(g, hazeMaterial(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }), this.U), max);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), v = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    let n = 0;
    for (let tries = 0; tries < 40000 && n < max; tries++) {
      const a = rnd() * Math.PI * 2, r = 190 + Math.pow(rnd(), 1.3) * 900, x = Math.cos(a) * r, z = Math.sin(a) * r, y = terrainHeight(x, z);
      if (y < 3) continue;
      const sl = Math.abs(terrainHeight(x + 3, z) - y) + Math.abs(terrainHeight(x, z + 3) - y), snowLine = 85 + 70 * N3(x / 260, z / 260);
      if (sl > 2.6 || y > snowLine + 10 || N2(x / 70, z / 70) < -.25) continue; // not on cliffs, above the snowline, or in clearings
      const sc = 4 + rnd() * 3 + r * .003;
      m.compose(v.set(x, y - .8, z), q.setFromAxisAngle(up, rnd() * 6.3), s.set(sc * (.8 + rnd() * .3), sc, sc * (.8 + rnd() * .3)));
      mesh.setMatrixAt(n++, m);
    }
    mesh.count = n; mesh.frustumCulled = false; this.group.add(mesh); this.trees = mesh;
  }

  // warm cabin and village windows glowing through the mist
  buildLights() {
    const rnd = mulberry(17), pos = [], ph = [];
    for (let c = 0, tries = 0; c < 16 && tries < 4000; tries++) {
      const a = rnd() * Math.PI * 2, r = 300 + rnd() * 850, x = Math.cos(a) * r, z = Math.sin(a) * r, y = terrainHeight(x, z);
      if (y < 2 || y > 60 || Math.abs(x) < 190) continue;
      c++;
      const k = 5 + Math.floor(rnd() * 16);
      for (let i = 0; i < k; i++) { const lx = x + (rnd() - .5) * 40, lz = z + (rnd() - .5) * 40, ly = terrainHeight(lx, lz); if (ly < 1) continue; pos.push(lx, ly + 2, lz); ph.push(rnd() * 100); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('ph', new THREE.Float32BufferAttribute(ph, 1));
    this.lightU = { uTime: { value: 0 }, uDens: this.U.uDens };
    this.lights = new THREE.Points(g, new THREE.ShaderMaterial({ uniforms: this.lightU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `attribute float ph; uniform float uTime, uDens; varying float vA; varying vec3 vC;
        void main(){ vec4 wp = modelMatrix * vec4(position, 1.); float d = distance(wp.xyz, cameraPosition), f = 1. - exp(-uDens * uDens * d * d * .45);
          vA = (1. - .7 * f) * (.75 + .25 * sin(uTime * (1. + fract(ph) * 2.) + ph)); vC = fract(ph * 7.3) > .8 ? vec3(1., .55, .3) : vec3(1., .78, .42);
          gl_PointSize = fract(ph * 3.1) > .7 ? 3. : 2.; gl_Position = projectionMatrix * viewMatrix * wp; }`,
      fragmentShader: 'varying float vA; varying vec3 vC; void main(){ gl_FragColor = vec4(vC * vA, 1.); }' }));
    this.lights.frustumCulled = false; this.group.add(this.lights);
  }

  update(dt, t, density) {
    this.U.uDens.value = density; this.lightU.uTime.value = t;
  }
}
