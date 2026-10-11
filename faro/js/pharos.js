// Faro de Alejandría: podio escalonado de bloques, torre (cuadrada, octogonal, cilíndrica),
// linterna con columnas y estatua de bronce, inscripción con yeso que cae, fantasma,
// colapso, hundimiento y ciudadela. Todo procedural. El estado s es función pura (sin acumulación).
(function () {
  'use strict';
  const G = window.GIZA;

  function clamp01(x) { return x < 0 ? 0 : (x > 1 ? 1 : x); }
  function smooth(x) { return x * x * (3 - 2 * x); }
  function makeRng(seed) {
    let s = seed | 0;
    return function () {
      s = (s + 0x6D2B79F5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function makeCanvas(w, h) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; return c;
  }

  G.createPharos = function (ctx) {
    const THREE = ctx.THREE, scene = ctx.scene, renderer = ctx.renderer;
    const root = new THREE.Group();
    scene.add(root);
    const rnd = makeRng(297);
    const T = G.TOWER, T1 = T.tier1, LN = T.lantern;
    const SEA = G.SITE.seaLevel;
    const UP = new THREE.Vector3(0, 1, 0);
    const SQ2 = Math.SQRT2;
    if (renderer) renderer.localClippingEnabled = true;

    function halfT1(y) { return T.tier1HalfAt(Math.max(T1.y0, Math.min(T1.y1, y))); }
    function podHalf(y) { return y < 2 ? 25 : (y < 4 ? 21 : 17); }
    // yaw de una pieza plana cuya normal exterior es (nx,nz): su eje X queda sobre la cara
    function faceYaw(nx, nz) { return Math.atan2(-nx, -nz); }
    function mat(x, y, z, yaw, sx, sy, sz) {
      return new THREE.Matrix4().compose(
        new THREE.Vector3(x, y, z),
        new THREE.Quaternion().setFromAxisAngle(UP, yaw || 0),
        new THREE.Vector3(sx === undefined ? 1 : sx, sy === undefined ? 1 : sy, sz === undefined ? 1 : sz));
    }
    function matQ(x, y, z, q, sx, sy, sz) {
      return new THREE.Matrix4().compose(
        new THREE.Vector3(x, y, z), q,
        new THREE.Vector3(sx === undefined ? 1 : sx, sy === undefined ? 1 : sy, sz === undefined ? 1 : sz));
    }
    const ID = new THREE.Matrix4();

    // ---------- geometría ----------
    // Prisma/cilindro de n caras planas (normales explícitas, uv en metros). Radio = vértice.
    // Cara k: ángulos rot+2πk/n .. rot+2π(k+1)/n. Radio interpolado de r0 (y0) a r1 (y1).
    function prismGeo(n, rot, y0, y1, r0, r1, opt) {
      opt = opt || {};
      const tile = 12, pos = [], nor = [], uv = [], idx = [];
      const dr = (r1 - r0) / (y1 - y0);
      const nl = Math.sqrt(1 + dr * dr);
      const faceW = 2 * r0 * Math.sin(Math.PI / n);
      for (let k = 0; k < n; k++) {
        const a0 = rot + 2 * Math.PI * k / n, a1 = rot + 2 * Math.PI * (k + 1) / n;
        const am = (a0 + a1) / 2;
        const N = [Math.cos(am) / nl, -dr / nl, Math.sin(am) / nl];
        const b = pos.length / 3;
        const V = [[a0, y0, r0, 0], [a1, y0, r0, faceW], [a1, y1, r1, faceW], [a0, y1, r1, 0]];
        for (let q = 0; q < 4; q++) {
          const a = V[q][0], y = (q < 2) ? y0 : y1, r = (q < 2) ? r0 : r1;
          pos.push(Math.cos(a) * r, y, Math.sin(a) * r);
          nor.push(N[0], N[1], N[2]);
          uv.push((k * faceW + V[q][3]) / tile, y / tile);
        }
        idx.push(b, b + 2, b + 1, b, b + 3, b + 2);
      }
      [[opt.top, y1, r1, 1], [opt.bottom, y0, r0, -1]].forEach(function (c) {
        if (!c[0]) return;
        const cy = c[1], rr = c[2], sg = c[3];
        const ci = pos.length / 3;
        pos.push(0, cy, 0); nor.push(0, sg, 0); uv.push(0, 0);
        const ri = pos.length / 3;
        for (let k = 0; k < n; k++) {
          const a = rot + 2 * Math.PI * k / n;
          pos.push(Math.cos(a) * rr, cy, Math.sin(a) * rr); nor.push(0, sg, 0);
          uv.push(Math.cos(a) * rr / tile, Math.sin(a) * rr / tile);
        }
        for (let k = 0; k < n; k++) {
          const A = ri + k, B = ri + (k + 1) % n;
          if (sg > 0) idx.push(ci, B, A); else idx.push(ci, A, B);
        }
      });
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.setIndex(idx);
      return g;
    }
    // caja con uv en metros (para que la piedra no se estire)
    function boxG(w, h, d) {
      const g = new THREE.BoxGeometry(w, h, d);
      const uv = g.attributes.uv, pos = g.attributes.position, nor = g.attributes.normal;
      for (let i = 0; i < uv.count; i++) {
        const nx = Math.abs(nor.getX(i)), ny = Math.abs(nor.getY(i));
        const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
        let u, v;
        if (nx > 0.5) { u = z; v = y; } else if (ny > 0.5) { u = x; v = z; } else { u = x; v = y; }
        uv.setXY(i, u / 12, v / 12);
      }
      return g;
    }
    function lathe(pts, seg) {
      return new THREE.LatheGeometry(pts.map(function (p) { return new THREE.Vector2(p[0], p[1]); }), seg || 24);
    }
    // cilindro entre dos puntos (brazos, mástil del tridente)
    function beam(a, b, r, seg) {
      const dir = new THREE.Vector3().subVectors(b, a);
      const L = dir.length();
      const g = new THREE.CylinderGeometry(r, r, L, seg || 8, 1);
      const q = new THREE.Quaternion().setFromUnitVectors(UP, dir.clone().normalize());
      const m = new THREE.Matrix4().compose(new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1));
      return { g: g, m: m };
    }
    function sphereAt(x, y, z, r, sy) {
      return { g: new THREE.SphereGeometry(r, 14, 10), m: mat(x, y, z, 0, 1, sy || 1, 1) };
    }
    // fusiona geometrías ({g, m}) en una sola BufferGeometry (una sola draw call)
    function mergeGeos(list) {
      const pos = [], nor = [], uv = [], idx = [];
      let off = 0;
      list.forEach(function (it) {
        const g = it.g, P_ = g.attributes.position, N_ = g.attributes.normal, U_ = g.attributes.uv;
        const count = P_.count, m = it.m || ID;
        const nm = new THREE.Matrix3().getNormalMatrix(m);
        const v = new THREE.Vector3(), nv = new THREE.Vector3();
        for (let i = 0; i < count; i++) {
          v.fromBufferAttribute(P_, i).applyMatrix4(m);
          pos.push(v.x, v.y, v.z);
          if (N_) { nv.fromBufferAttribute(N_, i).applyMatrix3(nm).normalize(); nor.push(nv.x, nv.y, nv.z); }
          else nor.push(0, 1, 0);
          if (U_) uv.push(U_.getX(i), U_.getY(i)); else uv.push(0, 0);
        }
        if (g.index) { for (let i = 0; i < g.index.count; i++) idx.push(g.index.getX(i) + off); }
        else { for (let i = 0; i < count; i++) idx.push(i + off); }
        off += count;
      });
      const out = new THREE.BufferGeometry();
      out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
      out.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      out.setIndex(idx);
      return out;
    }
    function instanced(geo, material, mats) {
      const im = new THREE.InstancedMesh(geo, material, Math.max(1, mats.length));
      for (let i = 0; i < mats.length; i++) im.setMatrixAt(i, mats[i]);
      if (!mats.length) im.count = 0;
      im.instanceMatrix.needsUpdate = true;
      im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false;
      return im;
    }
    const unitBox = new THREE.BoxGeometry(1, 1, 1);

    // ---------- textura de sillares (calizas con juntas, tono variable) y su bump ----------
    function ashlarTextures() {
      const N = 512, rowH = 64, blkW = 128;     // 512 px = 12 m; hilada 1.5 m; sillar 3 m
      const c = makeCanvas(N, N), b = makeCanvas(N, N);
      const g = c.getContext('2d'), h = b.getContext('2d');
      const r = makeRng(4242);
      g.fillStyle = '#7d6444'; g.fillRect(0, 0, N, N);       // juntas
      h.fillStyle = '#4a4a4a'; h.fillRect(0, 0, N, N);
      for (let row = 0; row < 8; row++) {
        const off = (row % 2) * 64;
        for (let col = -1; col < 4; col++) {
          const x0 = col * blkW + off, y0 = row * rowH;
          const tone = 0.84 + 0.26 * r();
          const warm = 0.94 + 0.12 * r();
          const R = Math.round(204 * tone), G2 = Math.round(170 * tone * warm), B = Math.round(116 * tone);
          const gv = Math.round(186 + 60 * r());
          for (let dx = -N; dx <= N; dx += N) {
            const x = x0 + dx;
            g.fillStyle = 'rgb(' + R + ',' + G2 + ',' + B + ')';
            g.fillRect(x + 2, y0 + 2, blkW - 4, rowH - 4);
            g.fillStyle = 'rgba(255,240,210,0.22)'; g.fillRect(x + 2, y0 + 2, blkW - 4, 4);
            g.fillStyle = 'rgba(70,45,25,0.22)'; g.fillRect(x + 2, y0 + rowH - 6, blkW - 4, 4);
            h.fillStyle = 'rgb(' + gv + ',' + gv + ',' + gv + ')';
            h.fillRect(x + 2, y0 + 2, blkW - 4, rowH - 4);
            h.fillStyle = 'rgba(255,255,255,0.35)'; h.fillRect(x + 2, y0 + 2, blkW - 4, 3);
            h.fillStyle = 'rgba(0,0,0,0.3)'; h.fillRect(x + 2, y0 + rowH - 5, blkW - 4, 3);
          }
        }
      }
      for (let i = 0; i < 1400; i++) {            // motas y vetas
        const x = r() * N, y = r() * N, s = 1 + r() * 2.5;
        g.fillStyle = r() < 0.5 ? 'rgba(90,65,35,0.22)' : 'rgba(255,245,220,0.18)';
        g.fillRect(x, y, s, s);
        h.fillStyle = r() < 0.5 ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.2)';
        h.fillRect(x, y, s, s);
      }
      const tc = new THREE.CanvasTexture(c); tc.encoding = THREE.sRGBEncoding;
      const tb = new THREE.CanvasTexture(b);
      [tc, tb].forEach(function (t) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; });
      return { map: tc, bump: tb };
    }

    // ---------- entorno para metales: cielo degradado con sol (PMREM) ----------
    function skyEnv() {
      try {
        const sc = new THREE.Scene();
        const sky = new THREE.ShaderMaterial({
          side: THREE.BackSide, depthWrite: false,
          vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
          fragmentShader: 'varying vec3 vP; void main(){ float h = vP.y; vec3 top = vec3(0.30,0.50,0.76); vec3 hor = vec3(0.95,0.82,0.62); vec3 gnd = vec3(0.22,0.17,0.12); vec3 c = h > 0.0 ? mix(hor, top, smoothstep(0.0, 0.6, h)) : mix(hor, gnd, smoothstep(0.0, -0.3, h)); float sun = pow(max(dot(normalize(vP), normalize(vec3(0.4,0.5,-0.6))), 0.0), 60.0); c += vec3(1.0,0.85,0.5) * sun * 2.0; gl_FragColor = vec4(c, 1.0); }'
        });
        sc.add(new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), sky));
        const pm = new THREE.PMREMGenerator(renderer);
        return pm.fromScene(sc, 0.04).texture;
      } catch (e) { return null; }
    }

    // ---------- planos de recorte: obra (altura) y muñón (colapso) ----------
    // plano: se oculta lo que queda por encima de constant (normal -Y: conserva y <= constant)
    const buildPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);
    const stumpPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 1000);
    const clipArr = [buildPlane, stumpPlane];

    // ---------- materiales ----------
    const ash = ashlarTextures();
    const stoneMat = new THREE.MeshStandardMaterial({ map: ash.map, bumpMap: ash.bump, bumpScale: 0.6, roughness: 0.92, metalness: 0, side: THREE.DoubleSide });
    const towerStone = stoneMat.clone();     // misma textura, pero recortable (la torre)
    const frameMat = new THREE.MeshStandardMaterial({ color: 0xd8c59c, roughness: 0.9, side: THREE.DoubleSide });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x1d1812, roughness: 0.85, side: THREE.DoubleSide });
    const marbleMat = new THREE.MeshStandardMaterial({ color: 0xeee4cf, roughness: 0.45, side: THREE.DoubleSide });
    const fillMat = new THREE.MeshStandardMaterial({ color: 0xa88c5e, roughness: 1, side: THREE.DoubleSide });
    const env = skyEnv();
    const bronzeMat = new THREE.MeshStandardMaterial({ color: 0xb07a38, metalness: 1, roughness: 0.32, envMap: env || null, envMapIntensity: 1.2, side: THREE.DoubleSide });
    const towerMats = [towerStone, frameMat, darkMat, marbleMat, bronzeMat];
    towerMats.forEach(function (m) { m.clippingPlanes = clipArr; });


    // ---------- 1. podio escalonado: 12 hiladas de 0.5 m; escalones de 25, 21 y 17 m de semiancho ----------
    const NCOURSE = 12, CH = 0.5;
    const pb = [];
    for (let c = 0; c < NCOURSE; c++) {
      const y0 = c * CH, hw = podHalf(y0 + 0.01);
      const n = Math.max(2, Math.round(2 * hw / 2.4)), L = 2 * hw / n;
      for (let sd = 0; sd < 4; sd++) {
        const nx = [0, 1, 0, -1][sd], nz = [-1, 0, 1, 0][sd], tx = -nz, tz = nx;
        for (let k = 0; k < n; k++) {
          const tau = -hw + (k + 0.5) * L;
          const D = 1.8 * (0.96 + 0.08 * rnd());
          const rd = hw - D / 2 - 0.02;
          const idxF = (sd * n + k) / (4 * n);
          pb.push({ x: nx * rd + tx * tau, z: nz * rd + tz * tau, y: y0, L: L * 0.96, H: CH * 0.95, D: D,
            yaw: faceYaw(nx, nz) + (rnd() - 0.5) * 0.01, start: (c + 0.6 * idxF) / NCOURSE, col: rnd() });
        }
      }
    }
    const pbN = pb.length;
    const podInst = new THREE.InstancedMesh(unitBox, stoneMat, pbN);
    podInst.castShadow = true; podInst.receiveShadow = true; podInst.frustumCulled = false;
    const tcol = new THREE.Color();
    for (let i = 0; i < pbN; i++) { tcol.setScalar(0.84 + 0.26 * pb[i].col); podInst.setColorAt(i, tcol); }
    podInst.instanceColor.needsUpdate = true;
    root.add(podInst);
    const fillInst = new THREE.InstancedMesh(unitBox, fillMat, NCOURSE);
    fillInst.castShadow = true; fillInst.receiveShadow = true; fillInst.frustumCulled = false;
    root.add(fillInst);

    const _M = new THREE.Matrix4(), _Q = new THREE.Quaternion(), _S = new THREE.Vector3(), _P = new THREE.Vector3();
    const ZS = new THREE.Vector3(0, 0, 0);
    // f = fracción del podio (0..1): cada sillar cae a su sitio; la hilada rellena el núcleo
    function writePod(f) {
      for (let i = 0; i < pbN; i++) {
        const b = pb[i];
        const u = clamp01((f - b.start) * NCOURSE * 1.1);
        if (u <= 0) {
          _M.compose(_P.set(0, 0, 0), _Q.identity(), ZS);
        } else {
          const k = 1 - smooth(u);
          _P.set(b.x, b.y + b.H * 0.5 + k * 7, b.z);
          _Q.setFromAxisAngle(UP, b.yaw);
          _S.set(b.L, b.H, b.D);
          _M.compose(_P, _Q, _S);
        }
        podInst.setMatrixAt(i, _M);
      }
      podInst.instanceMatrix.needsUpdate = true;
      for (let c = 0; c < NCOURSE; c++) {
        const y0 = c * CH, hw = podHalf(y0 + 0.01);
        const g = clamp01(f * NCOURSE - c);
        if (g <= 0) {
          _M.compose(_P.set(0, 0, 0), _Q.identity(), ZS);
        } else {
          const fh = Math.max(0.5, hw - 2.2);
          _P.set(0, y0 + CH * g * 0.5, 0);
          _S.set(2 * fh, CH * g, 2 * fh);
          _M.compose(_P, _Q, _S);
        }
        fillInst.setMatrixAt(c, _M);
      }
      fillInst.instanceMatrix.needsUpdate = true;
    }
    writePod(0);

    // rampa exterior en la cara sur: desde z=30 (y=0) hasta el umbral de la puerta (z=15.5, y=6)
    const rampL = Math.sqrt(14.5 * 14.5 + 6 * 6);
    const ramp = new THREE.Mesh(boxG(5, 0.6, rampL), stoneMat);
    ramp.rotation.x = -Math.atan2(6, 14.5);
    ramp.position.set(0, 3.0, 22.75);
    ramp.castShadow = true; ramp.receiveShadow = true;
    root.add(ramp);

    // ---------- 2. cuerpo 1 (cuadrado, ligera inclinación) ----------
    // radio de vértice = semiancho * √2 (rot π/4 deja las caras sobre los ejes)
    const SQ_ROT = Math.PI / 4;
    const wall1G = prismGeo(4, SQ_ROT, T1.y0, T1.y1, T1.halfBottom * SQ2, T1.halfTop * SQ2);
    const wall2G = prismGeo(8, -Math.PI / 8, T.tier2.y0 + 0.8, T.tier2.y1, T.tier2.radius, T.tier2.radius);
    const wall3G = prismGeo(32, 0, T.tier3.y0 + 0.6, T.tier3.y1, T.tier3.radius, T.tier3.radius);

    // caras del cuerpo 1: normal exterior de cada cara (mids del prisma)
    const faces1 = [0, 1, 2, 3].map(function (k) {
      const am = SQ_ROT + Math.PI / 2 * (k + 0.5);
      return { nx: Math.cos(am), nz: Math.sin(am) };
    });

    // ventanas: marco (caja) + vidrio oscuro saliente; lista {f:[], p:[]}
    const W1 = { f: [], p: [] }, W2 = { f: [], p: [] };
    function addWin(L, cx, cy, cz, yaw, fw, fh, pw, ph, nx, nz, d) {
      L.f.push(mat(cx - nx * 0.1, cy, cz - nz * 0.1, yaw, fw, fh, 0.3));
      L.p.push(mat(cx + nx * 0.1, cy, cz + nz * 0.1, yaw, pw, ph, 0.1));
    }
    // posición sobre una cara: distancia d al eje, u a lo largo de la cara
    function facePos(nx, nz, d, u, y) {
      const tx = -nz, tz = nx;
      return [nx * d + tx * u, y, nz * d + tz * u];
    }
    // cuerpo 1: 8 pisos, 9 ventanas por cara
    for (let f = 0; f < 8; f++) {
      const y = T1.y0 + 7.5 * (f + 0.5);
      for (let fi = 0; fi < 4; fi++) {
        const fc = faces1[fi];
        const isN = fc.nz < -0.5, isS = fc.nz > 0.5;
        if (isN && f === 0) continue;                   // bajo la dedicatoria
        for (let k = 0; k < 9; k++) {
          const u = (k - 4) * 3.2;
          if (isS && f === 0 && Math.abs(u) < 4) continue; // puerta
          const d = halfT1(y) + 0.02;
          const p = facePos(fc.nx, fc.nz, d, u, y);
          addWin(W1, p[0], p[1], p[2], faceYaw(fc.nx, fc.nz), 1.5, 2.4, 1.1, 1.9, fc.nx, fc.nz, d);
        }
      }
    }

    // ---------- estructura del cuerpo 1 (estática, se recorta con la obra) ----------
    const stoneT1 = [];
    stoneT1.push({ g: wall1G, m: ID });
    // bandas horizontales (impostas) a 31 m
    stoneT1.push({ g: prismGeo(4, SQ_ROT, 30.6, 31.4, (halfT1(30.6) + 0.35) * SQ2, (halfT1(31.4) + 0.35) * SQ2), m: ID });
    // cornisa y terraza con almenas (66.8 m)
    stoneT1.push({ g: prismGeo(4, SQ_ROT, 64.6, 65.6, 16.2 * SQ2, 16.2 * SQ2), m: ID });
    const terrace1G = prismGeo(4, SQ_ROT, 65.6, 66.8, 15.8 * SQ2, 15.8 * SQ2, { top: true });
    stoneT1.push({ g: terrace1G, m: ID });
    // portada en la cara sur: pilastras y dintel (umbral en y=6)
    const S_FI = 0, sN = faces1[S_FI];   // mids: k=0 -> sur (+Z), k=2 -> norte (-Z)
    const dS = halfT1(9.8) + 0.25;
    [-2.9, 2.9].forEach(function (u) {
      const p = facePos(sN.nx, sN.nz, dS, u, 9.8);
      stoneT1.push({ g: boxG(0.9, 7.6, 0.9), m: mat(p[0], p[1], p[2], faceYaw(sN.nx, sN.nz)) });
    });
    { const p = facePos(sN.nx, sN.nz, dS, 0, 13.3);
      stoneT1.push({ g: boxG(6.6, 1.0, 0.9), m: mat(p[0], p[1], p[2], faceYaw(sN.nx, sN.nz)) });
      const q = facePos(sN.nx, sN.nz, dS, 0, 6.0);
      stoneT1.push({ g: boxG(6.8, 0.5, 2.6), m: mat(q[0], q[1], q[2], faceYaw(sN.nx, sN.nz)) }); }
    const t1Static = mergeGeos(stoneT1);

    // vidrio de la puerta (oscuro, en hueco)
    const pD = facePos(sN.nx, sN.nz, dS - 0.05, 0, 9.3);
    const doorPane = instanced(unitBox, darkMat, [mat(pD[0], pD[1], pD[2], faceYaw(sN.nx, sN.nz), 4.2, 6.4, 0.2)]);

    // merlones sobre la terraza (almenas)
    const merl = [];
    for (let fi = 0; fi < 4; fi++) {
      const fc = faces1[fi];
      for (let u = -12.6; u <= 12.6 + 1e-6; u += 2.8) {
        const p = facePos(fc.nx, fc.nz, 15.8 - 0.35, u, 67.6);
        merl.push(mat(p[0], p[1], p[2], faceYaw(fc.nx, fc.nz), 1.4, 1.6, 0.9));
      }
    }
    const merlons = instanced(unitBox, towerStone, merl);

    // tritones en las esquinas de la terraza (figuras con caracola, de mármol)
    const triG = mergeGeos([
      { g: lathe([[0.001, 0], [0.5, 0.0], [0.42, 0.35], [0.3, 0.9], [0.27, 1.25], [0.3, 1.5], [0.001, 1.5]], 20), m: mat(0, 0, 0, 0) },
      { g: lathe([[0.001, 1.45], [0.33, 1.45], [0.36, 1.85], [0.4, 2.15], [0.34, 2.4], [0.2, 2.55], [0.001, 2.6]], 24), m: null },
      { g: lathe([[0.001, 0], [0.28, 0.0], [0.22, 0.6], [0.12, 1.0], [0.06, 1.2], [0.001, 1.2]], 20), m: mat(0, 0, 0, 0, 1.8, 1, 0.35) },
      sphereAt(0, 2.8, 0, 0.23, 1.12),
      beam(new THREE.Vector3(0.36, 2.35, 0), new THREE.Vector3(0.6, 1.95, 0.08), 0.13),
      beam(new THREE.Vector3(0.6, 1.95, 0.08), new THREE.Vector3(0.52, 2.62, 0.2), 0.11),
      { g: lathe([[0.02, 0], [0.18, 0.1], [0.26, 0.3], [0.22, 0.5], [0.1, 0.66], [0.001, 0.7]], 16), m: mat(0.52, 2.72, 0.25, 0, 1, 1, 1) },
      beam(new THREE.Vector3(-0.36, 2.35, 0), new THREE.Vector3(-0.5, 1.7, 0.2), 0.13),
      beam(new THREE.Vector3(-0.5, 1.7, 0.2), new THREE.Vector3(-0.42, 1.2, 0.38), 0.11)
    ]);
    const triSpots = [];
    [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(function (s) {
      const dx = s[0] / SQ2, dz = s[1] / SQ2;
      triSpots.push(mat(dx * 11.5, 66.8, dz * 11.5, Math.atan2(-dz, dx), 1.5, 1.5, 1.5));
    });
    const tritons = instanced(triG, marbleMat, triSpots);

    // ---------- 3. cuerpo 2 (octógono) y 4. cuerpo 3 (cilindro): ventanas ----------
    const oR = T.tier2.radius;
    const oApo = oR * Math.cos(Math.PI / 8);
    for (let fi = 0; fi < 8; fi++) {
      const am = -Math.PI / 8 + Math.PI / 4 * (fi + 0.5);
      const nx = Math.cos(am), nz = Math.sin(am);
      [74, 85].forEach(function (y) {
        [-2.0, 2.0].forEach(function (u) {
          const p = facePos(nx, nz, oApo + 0.02, u, y);
          addWin(W2, p[0], p[1], p[2], faceYaw(nx, nz), 1.5, 2.4, 1.1, 1.9, nx, nz, oApo);
        });
      });
    }
    const cR = T.tier3.radius, cApo = cR * Math.cos(Math.PI / 32);
    for (let k = 0; k < 16; k++) {
      const a = k * Math.PI * 2 / 16;
      const nx = Math.cos(a), nz = Math.sin(a);
      [101.5, 107.0].forEach(function (y) {
        addWin(W2, nx * (cApo + 0.02), y, nz * (cApo + 0.02), faceYaw(nx, nz), 0.9, 2.0, 0.6, 1.6, nx, nz, cApo);
      });
    }
    const winT1F = instanced(unitBox, frameMat, W1.f), winT1P = instanced(unitBox, darkMat, W1.p);
    const winUF = instanced(unitBox, frameMat, W2.f), winUP = instanced(unitBox, darkMat, W2.p);

    // ---------- estructura del cuerpo 2 y 3 (estática, sube con la obra) ----------
    const stoneUp = [];
    stoneUp.push({ g: wall2G, m: ID });
    stoneUp.push({ g: prismGeo(8, -Math.PI / 8, 95.4, 96.6, 9.9, 9.9, { top: true }), m: ID });   // terraza con barandilla
    stoneUp.push({ g: prismGeo(8, -Math.PI / 8, 94.8, 95.4, 10.2, 10.2), m: ID });                // cornisa bajo la terraza
    stoneUp.push({ g: wall3G, m: ID });
    stoneUp.push({ g: prismGeo(32, 0, 110.2, 111, 5.0, 5.0), m: ID });                             // cornisa del cilindro
    stoneUp.push({ g: prismGeo(32, 0, 111, 111.8, 4.9, 4.9, { top: true }), m: ID });              // base de la linterna
    // barandilla octogonal (8 tramos de 7.6 m a 8.8 m del eje)
        const balusters = [];
    for (let fi = 0; fi < 8; fi++) {
      const am = -Math.PI / 8 + Math.PI / 4 * (fi + 0.5);
      const nx = Math.cos(am), nz = Math.sin(am);
      stoneUp.push({ g: boxG(1, 1, 1), m: mat(nx * 8.8, 97.9, nz * 8.8, faceYaw(nx, nz), 7.6, 0.6, 0.4) });
      for (let j = 0; j < 8; j++) {
        const u = -3.15 + j * 0.9;
        const p = facePos(nx, nz, 8.8, u, 97.1);
        balusters.push(mat(p[0], p[1], p[2], 0, 1, 1, 1));
      }
    }
    const upStatic = mergeGeos(stoneUp);
    const balInst = instanced(new THREE.CylinderGeometry(0.11, 0.11, 1, 6), towerStone, balusters);

    // ---------- 5. linterna: 8 columnas, arquitrabe, cúpula y basamento ----------
    const colG = mergeGeos([
      { g: new THREE.CylinderGeometry(0.3, 0.3, 4.8, 12, 1), m: mat(0, 2.4, 0) },
      { g: boxG(1.0, 0.3, 1.0), m: mat(0, 0.15, 0) },
      { g: boxG(0.9, 0.4, 0.9), m: mat(0, 4.8 + 0.2, 0) }
    ]);
    const colCount = 8, colR = 3.7;
    const colMats = [];
    for (let i = 0; i < colCount; i++) {
      const a = i * Math.PI * 2 / colCount;
      colMats.push(mat(Math.cos(a) * colR, LN.y0 + 0.8, Math.sin(a) * colR, 0));
    }
    const columns = instanced(colG, towerStone, colMats);
    // arquitrabe, cúpula (media esfera de piedra) y basamento de la estatua: un solo bloque estático
    const lanternTopG = mergeGeos([
      { g: prismGeo(8, -Math.PI / 8, LN.y1, LN.y1 + 0.9, 4.4, 4.4, { top: true }), m: ID },
      { g: lathe([[4.3, 0], [4.0, 0.5], [3.2, 1.2], [2.0, 1.9], [1.0, 2.35], [0.001, 2.6]], 32), m: mat(0, LN.y1 + 0.9, 0, 0) },
      { g: prismGeo(16, 0, 120.4, 121.3, 1.2, 1.2, { top: true }), m: ID }
    ]);
    const lanternTop = new THREE.Mesh(lanternTopG, towerStone);
    lanternTop.castShadow = true; lanternTop.receiveShadow = true;

    // ---------- 6. estatua de bronce (Poseidón: tridente en alto, brazo izquierdo caído) ----------
    const statueG = mergeGeos([
      { g: lathe([[0.001, 0], [0.55, 0], [0.6, 0.6], [0.5, 1.3], [0.42, 1.9], [0.48, 2.3], [0.5, 2.45], [0.001, 2.45]], 24), m: null },
      { g: lathe([[0.001, 2.4], [0.42, 2.45], [0.5, 2.8], [0.46, 3.15], [0.34, 3.4], [0.2, 3.5], [0.001, 3.52]], 24), m: null },
      sphereAt(0, 3.72, 0, 0.25, 1.1),
      beam(new THREE.Vector3(0.42, 3.3, 0), new THREE.Vector3(0.7, 3.85, 0.1), 0.15),
      beam(new THREE.Vector3(0.7, 3.85, 0.1), new THREE.Vector3(0.6, 3.2, 0.15), 0.12),
      sphereAt(0.6, 3.2, 0.15, 0.13),
      beam(new THREE.Vector3(0.7, 0.0, 0.25), new THREE.Vector3(0.6, 3.6, 0.15), 0.05, 6),
      beam(new THREE.Vector3(0.6, 3.55, 0.15), new THREE.Vector3(0.6, 3.85, 0.15), 0.06, 6),
      beam(new THREE.Vector3(0.6, 3.6, 0.15), new THREE.Vector3(0.46, 3.92, 0.15), 0.04, 6),
      beam(new THREE.Vector3(0.6, 3.6, 0.15), new THREE.Vector3(0.74, 3.92, 0.15), 0.04, 6),
      beam(new THREE.Vector3(-0.42, 3.3, 0), new THREE.Vector3(-0.6, 2.6, 0.25), 0.15),
      beam(new THREE.Vector3(-0.6, 2.6, 0.25), new THREE.Vector3(-0.55, 2.0, 0.4), 0.13),
      sphereAt(-0.55, 1.95, 0.42, 0.14)
    ]);
    const statue = new THREE.Mesh(statueG, bronzeMat);
    statue.castShadow = true;

    // ---------- grupos: cuerpos 2-3 y linterna caen juntos (colapso); cuerpo 1 queda como muñón ----------
    const fdx = G.SITE.fallDir.x, fdz = G.SITE.fallDir.z, fdl = Math.hypot(fdx, fdz);
    const HP = new THREE.Vector3(fdx / fdl * T.tier2.radius, 66.8, fdz / fdl * T.tier2.radius);   // bisagra: borde del octógono en la dirección de caída
    const FD = new THREE.Vector3(fdx / fdl, 0, fdz / fdl);
    const AX = new THREE.Vector3(FD.z, 0, -FD.x).normalize();   // eje horizontal perpendicular a la caída
    const upperIn = new THREE.Group();
    upperIn.position.set(-HP.x, -HP.y, -HP.z);
    const upperG = new THREE.Group();
    upperG.add(upperIn);
    root.add(upperG);
    upperIn.add(new THREE.Mesh(upStatic, towerStone));
    upperIn.add(balInst); upperIn.add(winUF); upperIn.add(winUP);
    upperIn.add(columns); upperIn.add(lanternTop); upperIn.add(statue);
    upperIn.children.forEach(function (c) { c.castShadow = true; c.receiveShadow = true; });
    // (la estatua y la linterna se mueven dentro de upperIn)
    statue.position.set(0, 121.3, 0);   // 121.3 m: sobre el basamento de la cúpula
    lanternTop.visible = true;

    const stumpG = new THREE.Group();
    root.add(stumpG);
    [new THREE.Mesh(t1Static, towerStone), winT1F, winT1P, doorPane, merlons, tritons].forEach(function (m) { stumpG.add(m); });
    stumpG.children.forEach(function (c) { c.castShadow = true; c.receiveShadow = true; });

    // PART3

    // ---------- 7. dedicatoria en la cara norte: piedra grabada bajo un yeso con "ΠΤΟΛΕΜΑΙΟΣ" ----------
    const INS_W = 1400, INS_H = 320;
    const INS_WM = 14, INS_HM = 3.2;
    function fitText(g, text, cx, y, maxW, px, italic) {
      let size = px;
      do {
        g.font = (italic ? 'italic ' : 'bold ') + size + 'px Georgia, "Times New Roman", serif';
        if (g.measureText(text).width <= maxW || size <= 12) break;
        size -= 2;
      } while (true);
      g.fillText(text, cx, y);
    }
    function inscriptionCanvases() {
      const c = makeCanvas(INS_W, INS_H), b = makeCanvas(INS_W, INS_H);
      const g = c.getContext('2d'), h = b.getContext('2d');
      const r = makeRng(77);
      g.fillStyle = '#cfb07c'; g.fillRect(0, 0, INS_W, INS_H);
      for (let i = 0; i < 2600; i++) {
        g.fillStyle = r() < 0.5 ? 'rgba(90,60,30,0.10)' : 'rgba(255,240,210,0.10)';
        g.fillRect(r() * INS_W, r() * INS_H, 2 + r() * 3, 2 + r() * 3);
      }
      h.fillStyle = '#b8b8b8'; h.fillRect(0, 0, INS_W, INS_H);
      g.strokeStyle = '#7a5d37'; g.lineWidth = 8; g.strokeRect(14, 14, INS_W - 28, INS_H - 28);
      h.strokeStyle = '#333'; h.lineWidth = 8; h.strokeRect(14, 14, INS_W - 28, INS_H - 28);
      const lines = [
        { t: 'ΣΩΣΤΡΑΤΟΣ ΔΕΞΙΦΑΝΟΥΣ ΚΝΙΔΙΟΣ', y: 118, px: 96, it: false },
        { t: 'ΘΕΟΙΣ ΣΩΤΗΡΣΙΝ ΥΠΕΡ ΤΩΝ ΠΛΩΙΖΟΜΕΝΩΝ', y: 226, px: 96, it: false },
        { t: 'Sóstrato de Cnido, hijo de Dexífanes, a los dioses salvadores, por los navegantes', y: 286, px: 40, it: true }
      ];
      [g, h].forEach(function (ctx2, idx) {
        ctx2.textAlign = 'center'; ctx2.textBaseline = 'alphabetic';
        lines.forEach(function (L) {
          if (idx === 0) {
            // grabado: borde de luz abajo-derecha, sombra arriba-izquierda, relleno oscuro
            ctx2.fillStyle = 'rgba(245,230,195,0.85)'; fitText(ctx2, L.t, INS_W / 2 + 3, L.y + 3, INS_W * 0.9, L.px, L.it);
            ctx2.fillStyle = 'rgba(60,40,20,0.55)'; fitText(ctx2, L.t, INS_W / 2 - 2, L.y - 2, INS_W * 0.9, L.px, L.it);
            ctx2.fillStyle = '#4a3320'; fitText(ctx2, L.t, INS_W / 2, L.y, INS_W * 0.9, L.px, L.it);
          } else {
            ctx2.fillStyle = '#202020'; fitText(ctx2, L.t, INS_W / 2, L.y, INS_W * 0.9, L.px, L.it);
          }
        });
      });
      const tc = new THREE.CanvasTexture(c); tc.encoding = THREE.sRGBEncoding;
      const tb = new THREE.CanvasTexture(b);
      return { map: tc, bump: tb };
    }
    // yeso: celdas de Voronoi con grietas. El canal verde (alphaMap) es el orden en que cae cada pieza.
    function plasterCanvases() {
      const W = INS_W, H = INS_H, NP = 70;
      const r = makeRng(9001), px = [], py = [], pv = [];
      for (let i = 0; i < NP; i++) { px.push(r() * W); py.push(r() * H); pv.push(0.08 + 0.9 * r()); }
      const pc = makeCanvas(W, H), ac = makeCanvas(W, H);
      const pg = pc.getContext('2d'), ag = ac.getContext('2d');
      const img = pg.createImageData(W, H), aimg = ag.createImageData(W, H);
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          let d1 = 1e12, d2 = 1e12, id = 0;
          for (let i = 0; i < NP; i++) {
            const dx = x - px[i], dy = y - py[i], d = dx * dx + dy * dy;
            if (d < d1) { d2 = d1; d1 = d; id = i; } else if (d < d2) { d2 = d; }
          }
          const crack = Math.sqrt(d2) - Math.sqrt(d1) < 2.2;
          const k = (y * W + x) * 4;
          const n = 0.93 + 0.07 * r();
          img.data[k] = 236 * n; img.data[k + 1] = 227 * n; img.data[k + 2] = 204 * n; img.data[k + 3] = 255;
          if (crack) { img.data[k] = 128; img.data[k + 1] = 108; img.data[k + 2] = 82; }
          const gv = crack ? 0 : Math.round(pv[id] * 255);
          aimg.data[k] = gv; aimg.data[k + 1] = gv; aimg.data[k + 2] = gv; aimg.data[k + 3] = 255;
        }
      }
      pg.putImageData(img, 0, 0);
      ag.putImageData(aimg, 0, 0);
      pg.textAlign = 'center'; pg.textBaseline = 'middle';
      pg.fillStyle = '#9b3b24';
      fitText(pg, 'ΠΤΟΛΕΜΑΙΟΣ', W / 2, H * 0.5, W * 0.86, 230, false);
      const tc = new THREE.CanvasTexture(pc); tc.encoding = THREE.sRGBEncoding;
      const ta = new THREE.CanvasTexture(ac);
      return { map: tc, alpha: ta };
    }
    const insTex = inscriptionCanvases();
    const plTex = plasterCanvases();
    const zN = -(halfT1(12) + 0.06);
    const insPanel = new THREE.Mesh(new THREE.PlaneGeometry(INS_WM, INS_HM),
      new THREE.MeshStandardMaterial({ map: insTex.map, bumpMap: insTex.bump, bumpScale: 2.0, roughness: 0.9, side: THREE.DoubleSide }));
    insPanel.position.set(0, 12, zN); insPanel.rotation.y = Math.PI;
    const plasterMat = new THREE.MeshStandardMaterial({ map: plTex.map, alphaMap: plTex.alpha, alphaTest: 0.001, roughness: 0.95, side: THREE.DoubleSide });
    const plasterPlane = new THREE.Mesh(new THREE.PlaneGeometry(INS_WM, INS_HM), plasterMat);
    plasterPlane.position.set(0, 12, zN - 0.07); plasterPlane.rotation.y = Math.PI;
    // trozos de yeso que caen al suelo (22 piezas, orden fijo)
    const fr = makeRng(555), FR = [];
    for (let i = 0; i < 22; i++) {
      FR.push({ x: -6.6 + fr() * 13.2, y: 10.5 + fr() * 3.0, w: 0.7 + fr() * 1.1, h: 0.5 + fr() * 0.9,
        thr: 0.05 + 0.85 * fr(), spin: (fr() - 0.5) * 2.5, dx: (fr() - 0.5) * 3.0, zo: fr() * 1.5 });
    }
    const frMat = new THREE.MeshStandardMaterial({ color: 0xe8dfc8, roughness: 0.95, side: THREE.DoubleSide });
    const frInst = new THREE.InstancedMesh(unitBox, frMat, FR.length);
    frInst.castShadow = true; frInst.frustumCulled = false;
    const _E = new THREE.Euler(), _QF = new THREE.Quaternion();
    function writePlaster(pl) {
      for (let i = 0; i < FR.length; i++) {
        const F = FR[i];
        const f = smooth(clamp01((pl - F.thr) / 0.25));
        if (f <= 0.001) {
          _M.compose(_P.set(0, 0, 0), _Q.identity(), ZS);
        } else {
          _P.set(F.x + F.dx * f, F.y + (0.5 - F.y) * f * f, zN - 0.12 + (-(3.0 + F.zo) * f));
          _E.set(f * F.spin, f * F.spin * 0.5, 0); _QF.setFromEuler(_E);
          _S.set(F.w, F.h, 0.12);
          _M.compose(_P, _QF, _S);
        }
        frInst.setMatrixAt(i, _M);
      }
      frInst.instanceMatrix.needsUpdate = true;
    }
    writePlaster(0);

    // inscripción, yeso y trozos: parte del muñón (se ocultan con la ciudadela)
    stumpG.add(insPanel); stumpG.add(plasterPlane); stumpG.add(frInst);

    // ---------- 8. fantasma: torre completa translúcida con aristas (cian y dorado) ----------
    const ghostShell = mergeGeos([
      { g: prismGeo(4, SQ_ROT, 0, 2, 25 * SQ2, 25 * SQ2, { top: true }), m: ID },
      { g: prismGeo(4, SQ_ROT, 2, 4, 21 * SQ2, 21 * SQ2, { top: true }), m: ID },
      { g: prismGeo(4, SQ_ROT, 4, 6, 17 * SQ2, 17 * SQ2, { top: true }), m: ID },
      { g: wall1G, m: ID }, { g: wall2G, m: ID }, { g: wall3G, m: ID },
      { g: prismGeo(16, 0, 111.8, 117, 3.9, 3.9), m: ID },
      { g: lanternTopG, m: ID },
      { g: statueG, m: mat(0, 121.3, 0, 0) }
    ]);
    const ghostG = new THREE.Group();
    const ghostMat = new THREE.MeshBasicMaterial({ color: 0x7fe3f0, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
    ghostG.add(new THREE.Mesh(ghostShell, ghostMat));
    const ghostEdgeMat = new THREE.LineBasicMaterial({ color: 0x9ff6ff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
    ghostG.add(new THREE.LineSegments(new THREE.EdgesGeometry(ghostShell, 30), ghostEdgeMat));
    const goldEdgeMat = new THREE.LineBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
    const goldShell = mergeGeos([{ g: lanternTopG, m: ID }, { g: statueG, m: mat(0, 121.3, 0, 0) }]);
    ghostG.add(new THREE.LineSegments(new THREE.EdgesGeometry(goldShell, 30), goldEdgeMat));
    ghostG.visible = false;
    root.add(ghostG);

    // ---------- borde de obra: anillo luminoso en la altura construida ----------
    const buildEdge = new THREE.Mesh(prismGeo(32, 0, -0.15, 0.15, 1, 1),
      new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    buildEdge.visible = false;
    root.add(buildEdge);

    // ---------- 9. hundimiento: bloques, columnas y estatuas bajo el agua junto al faro ----------
    const sr = makeRng(911), SB = [], SC = [], SS = [];
    for (let i = 0; i < 60; i++) {
      const a = sr() * Math.PI * 2, rr = 14 + sr() * 36;
      SB.push({ x: Math.cos(a) * rr, z: Math.sin(a) * rr, yF: SEA - 0.8 - sr() * 6.5, yaw: sr() * Math.PI, thr: sr() * 0.45, sz: 0.8 + sr() * 0.8 });
    }
    for (let i = 0; i < 12; i++) {
      const a = sr() * Math.PI * 2, rr = 16 + sr() * 30;
      SC.push({ x: Math.cos(a) * rr, z: Math.sin(a) * rr, yF: SEA - 0.6 - sr() * 4, yaw: sr() * Math.PI, thr: 0.1 + sr() * 0.3 });
    }
    for (let i = 0; i < 2; i++) {
      const a = (i === 0 ? -0.7 : 2.4) + sr() * 0.3, rr = 22 + sr() * 8;
      SS.push({ x: Math.cos(a) * rr, z: Math.sin(a) * rr, yF: SEA - 3.2, yaw: sr() * Math.PI, thr: 0.2 + sr() * 0.2 });
    }
    const sunkBlk = new THREE.InstancedMesh(unitBox, stoneMat, SB.length);
    const sunkCol = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.6, 0.6, 8, 12), stoneMat, SC.length);
    const sunkSta = new THREE.InstancedMesh(statueG, bronzeMat, SS.length);
    [sunkBlk, sunkCol, sunkSta].forEach(function (m) { m.frustumCulled = false; m.receiveShadow = true; root.add(m); });
    const _Qc = new THREE.Quaternion(), _Ec = new THREE.Euler();
    let lastSk = -1;
    function writeSunk(sk) {
      for (let i = 0; i < SB.length; i++) {
        const B = SB[i], ss = smooth(clamp01((sk - B.thr) / 0.6));
        if (ss <= 0.001) _M.compose(_P.set(0, 0, 0), _Q.identity(), ZS);
        else {
          _P.set(B.x, B.yF + (1 - ss) * 12, B.z);
          _Q.setFromAxisAngle(UP, B.yaw);
          _S.set(2.4 * B.sz * ss, 1.2 * B.sz * ss, 1.2 * B.sz * ss);
          _M.compose(_P, _Q, _S);
        }
        sunkBlk.setMatrixAt(i, _M);
      }
      for (let i = 0; i < SC.length; i++) {
        const C = SC[i], ss = smooth(clamp01((sk - C.thr) / 0.6));
        if (ss <= 0.001) _M.compose(_P.set(0, 0, 0), _Q.identity(), ZS);
        else {
          _P.set(C.x, C.yF + (1 - ss) * 12, C.z);
          _Ec.set(0, C.yaw, Math.PI / 2); _Qc.setFromEuler(_Ec);
          _S.set(ss, ss, ss);
          _M.compose(_P, _Qc, _S);
        }
        sunkCol.setMatrixAt(i, _M);
      }
      for (let i = 0; i < SS.length; i++) {
        const St = SS[i], ss = smooth(clamp01((sk - St.thr) / 0.6));
        if (ss <= 0.001) _M.compose(_P.set(0, 0, 0), _Q.identity(), ZS);
        else {
          _P.set(St.x, St.yF + (1 - ss) * 12, St.z);
          _Ec.set(0, St.yaw, Math.PI / 2); _Qc.setFromEuler(_Ec);
          _S.set(ss, ss, ss);
          _M.compose(_P, _Qc, _S);
        }
        sunkSta.setMatrixAt(i, _M);
      }
      sunkBlk.instanceMatrix.needsUpdate = true;
      sunkCol.instanceMatrix.needsUpdate = true;
      sunkSta.instanceMatrix.needsUpdate = true;
    }
    writeSunk(0);

    // ---------- 10. ciudadela de Qaitbey (1477): torre del homenaje, muralla, torres ----------
    const CIT = G.CITADEL, WH = CIT.wallHalf, WHt = CIT.wallH;
    const citList = [];
    citList.push({ g: prismGeo(4, SQ_ROT, 0, CIT.keepH, CIT.keepHalf * SQ2, CIT.keepHalf * SQ2, { top: true }), m: ID });
    [[-15, -15], [15, -15], [-15, 15], [15, 15]].forEach(function (p) {
      citList.push({ g: prismGeo(24, 0, 0, CIT.keepH + 2, 3.6, 3.6, { top: true }), m: mat(p[0], 0, p[1], 0) });
    });
    citList.push({ g: boxG(WH * 2, WHt, 3), m: mat(0, WHt / 2, -WH) });
    citList.push({ g: boxG(WH * 2, WHt, 3), m: mat(0, WHt / 2, WH) });
    citList.push({ g: boxG(3, WHt, WH * 2), m: mat(-WH, WHt / 2, 0) });
    citList.push({ g: boxG(3, WHt, WH * 2), m: mat(WH, WHt / 2, 0) });
    const mG = boxG(1.4, 1.4, 0.9);
    for (let s2 = -WH + 1.5; s2 <= WH - 1.5; s2 += 2.6) {
      citList.push({ g: mG, m: mat(s2, WHt + 0.7, -WH) });
      citList.push({ g: mG, m: mat(s2, WHt + 0.7, WH) });
      citList.push({ g: mG, m: mat(-WH, WHt + 0.7, s2, Math.PI / 2) });
      citList.push({ g: mG, m: mat(WH, WHt + 0.7, s2, Math.PI / 2) });
    }
    [[-WH, -WH], [WH, -WH], [-WH, WH], [WH, WH], [0, -WH], [0, WH], [-WH, 0], [WH, 0]].forEach(function (p) {
      citList.push({ g: prismGeo(24, 0, 0, 13, 4.2, 4.2, { top: true }), m: mat(p[0], 0, p[1], 0) });
    });
    const citG = new THREE.Group();
    citG.add(new THREE.Mesh(mergeGeos(citList), stoneMat));
    citG.visible = false;
    root.add(citG);

    // ---------- estado de la animación ----------
    let lastFnd = -1, lastLan = -1;

    function update(s) {
      const bld = clamp01(s.build || 0), xr = clamp01(s.xray || 0), fnd = clamp01(s.foundation || 0);
      const lan = clamp01(s.lantern || 0), col = clamp01(s.collapse || 0), cit = clamp01(s.citadel || 0);
      const gh = clamp01(s.ghost || 0), sk = clamp01(s.sunken || 0), wall = s.wall || 0, t = s.t || 0;
      const pl = (t >= 209.5) ? 1 : clamp01(s.plaster || 0);
      const q = clamp01((s.quake1 || 0) * 0.7 + (s.quake2 || 0));
      const qx = Math.sin(wall * 17) * 0.12 * q, qz = Math.cos(wall * 13) * 0.10 * q;

      // podio
      if (fnd !== lastFnd) { lastFnd = fnd; writePod(fnd); }
      ramp.visible = fnd >= 0.999;

      // obra: se oculta lo que queda por encima de la altura construida (de abajo arriba)
      const hB = bld * T.H;
      buildPlane.constant = bld >= 0.999 ? 1000 : hB;
      // colapso: el cuerpo cuadrado se rompe de 66 m a 22 m
      stumpPlane.constant = col <= 0.6 ? 1000 : 66 - 44 * smooth(clamp01((col - 0.6) / 0.4));
      const towerOn = bld > 0.001 || col > 0.001;
      stumpG.position.set(qx, 0, qz);
      stumpG.visible = towerOn && cit <= 0.5;
      upperG.visible = towerOn;

      // cuerpos 2-3 y linterna: giran sobre el borde del octógono y caen al mar
      const theta = smooth(clamp01(col / 0.6)) * (Math.PI / 2);
      const drop = smooth(clamp01((col - 0.3) / 0.3)) * (HP.y - (SEA - 8));   // la base del cuerpo llega al mar
      upperG.quaternion.setFromAxisAngle(AX, theta);
      upperG.position.set(HP.x + qx, HP.y - drop, HP.z + qz);

      // linterna: columnas que bajan a su sitio, cúpula, y la estatua se posa al final
      lanternVisible(lan);

      // ventanas, puerta y piedras: transparencia para ver el interior
      const xOn = xr > 0.001;
      towerMats.forEach(function (m) { m.transparent = xOn; m.opacity = 1 - 0.72 * xr; m.depthWrite = !xOn; });

      // yeso: se agrieta y cae a trozos; la dedicatoria queda al descubierto
      plasterMat.alphaTest = 0.001 + pl * 1.01;
      plasterPlane.visible = pl < 1;
      writePlaster(pl);

      // borde de obra
      const edgeOn = bld > 0.001 && bld < 0.999;
      buildEdge.visible = edgeOn;
      if (edgeOn) {
        const R = hB <= 66 ? halfT1(Math.max(6.01, hB)) * SQ2 : (hB <= 96 ? 9 : 4.6);
        buildEdge.position.set(0, hB, 0);
        buildEdge.scale.set(R + 0.4, 1, R + 0.4);
      }

      // fantasma
      ghostG.visible = gh > 0.001;
      ghostMat.opacity = 0.16 * gh;
      ghostEdgeMat.opacity = 0.85 * gh;
      goldEdgeMat.opacity = 0.9 * gh;

      // hundimiento
      if (sk !== lastSk) { lastSk = sk; writeSunk(sk); }

      // ciudadela
      citG.visible = cit > 0.001;
      citG.position.y = -(1 - smooth(cit)) * 24;
    }

    // columnas (instancias), cúpula y estatua según el avance de la linterna (0..1)
    function lanternVisible(lan) {
      if (lan === lastLan) return;
      lastLan = lan;
      columns.visible = lan > 0.001;
      for (let i = 0; i < colCount; i++) {
        const a = i * Math.PI * 2 / colCount;
        const off = (1 - smooth(clamp01(lan * 1.2 - i * 0.04))) * 30;
        columns.setMatrixAt(i, mat(Math.cos(a) * colR, LN.y0 + 0.8 + off, Math.sin(a) * colR, 0));
      }
      columns.instanceMatrix.needsUpdate = true;
      lanternTop.visible = lan > 0.001;
      lanternTop.position.y = (1 - smooth(lan)) * 25;
      statue.visible = lan > 0.001;
      statue.position.y = 121.3 + (1 - smooth(clamp01((lan - 0.35) / 0.65))) * 30;
    }

    return { update: update, group: root };
  };
})();
