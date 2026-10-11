// Pirámide: núcleo escalonado (hiladas), piramidión, rayo, revestimiento de Tura,
// erosión, modo rayos X. Todo generado por código. Estado s = función pura (sin acumulación).
// Nota: main.js usa THREE.ColorManagement.legacyMode = false; las CanvasTexture llevan encoding sRGB.
(function () {
  'use strict';
  const G = window.GIZA;

  // ---------- shaders auxiliares ----------
  const BEAM_VS = [
    'varying float vY; varying vec3 vN; varying vec3 vV;',
    'void main() {',
    '  vY = position.y;',
    '  vec4 mv = modelViewMatrix * vec4(position, 1.0);',
    '  vN = normalize(normalMatrix * normal);',
    '  vV = normalize(-mv.xyz);',
    '  gl_Position = projectionMatrix * mv;',
    '}'
  ].join('\n');

  const BEAM_FS = [
    'uniform float uI; uniform float uT; uniform vec3 uCol;',
    'varying float vY; varying vec3 vN; varying vec3 vV;',
    'void main() {',
    '  float fade = 1.0 - smoothstep(0.0, 2000.0, vY);',
    '  float fres = pow(abs(dot(normalize(vN), normalize(vV))), 1.6);',
    '  float pulse = 0.85 + 0.15 * sin(uT * 2.3 + vY * 0.03);',
    '  float a = uI * fade * fres * pulse * 0.9;',
    '  gl_FragColor = vec4(uCol, a);',
    '}'
  ].join('\n');

  // ruido de valor 3D (sin texturas) para la disolución del revestimiento
  const NOISE_GLSL = [
    'float hash3(vec3 p) {',
    '  p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));',
    '  p *= 17.0;',
    '  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));',
    '}',
    'float vnoise(vec3 x) {',
    '  vec3 i = floor(x); vec3 f = fract(x);',
    '  f = f * f * (3.0 - 2.0 * f);',
    '  return mix(',
    '    mix(mix(hash3(i), hash3(i + vec3(1.0,0.0,0.0)), f.x), mix(hash3(i + vec3(0.0,1.0,0.0)), hash3(i + vec3(1.0,1.0,0.0)), f.x), f.y),',
    '    mix(mix(hash3(i + vec3(0.0,0.0,1.0)), hash3(i + vec3(1.0,0.0,1.0)), f.x), mix(hash3(i + vec3(0.0,1.0,1.0)), hash3(i + vec3(1.0,1.0,1.0)), f.x), f.y),',
    '    f.z);',
    '}',
    'float fbm3(vec3 p) { return 0.6 * vnoise(p) + 0.4 * vnoise(p * 2.7 + vec3(11.3, 4.1, 7.7)); }'
  ].join('\n');

  G.createPyramid = function (ctx) {
    const THREE = ctx.THREE, scene = ctx.scene;
    const root = new THREE.Group();
    scene.add(root);

    const P = G.PYR;
    const H = P.height, HALF = P.half, NC = P.courses;
    const DEPTH = 2.0;                     // espesor radial de cada sillar
    const BLOCK_L = 2.6;                   // largo de sillar corriente
    const CORNER_L = 4.0;                  // piedras angulares (esquinas)
    const SLOPE_N = Math.sqrt(H * H + HALF * HALF);
    const SIN_SLOPE = H / SLOPE_N, COS_SLOPE = HALF / SLOPE_N;
    const CAS_OFF = 0.6 / SIN_SLOPE;       // +0.6 m perpendicular a la cara = desplazamiento horizontal
    const CAS_TOP = (HALF + CAS_OFF) * H / HALF;
    const CAP_H = H * 0.015;               // piramidión ~1.5 % de la altura
    const CAP_HALF = CAP_H * HALF / H;
    const CUSP = H + CAP_H;
    const SIDES = [[0, -1], [1, 0], [0, 1], [-1, 0]];   // normales exteriores N, E, S, O

    function clamp01(x) { return x < 0 ? 0 : (x > 1 ? 1 : x); }
    function smooth(x) { return x * x * (3 - 2 * x); }

    // RNG determinista (mulberry32): la pirámide es siempre igual
    let seed = 20240531;
    function rnd() {
      seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    // ---------- alturas de hilada ----------
    // Pedido: inferiores ~1.5 m, superiores ~0.6 m, altura total 146.6 m. Con 105 hiladas esa
    // combinación es imposible (media 1.40 m), así que se usa el perfil lineal 1.5 -> 0.6
    // reescalado para sumar H (resulta ~2.0 m abajo y ~0.8 m arriba).
    const cb = new Float64Array(NC), ch = new Float64Array(NC);   // base y altura de cada hilada
    (function () {
      const w = []; let sum = 0;
      for (let c = 0; c < NC; c++) { const x = 1.5 + (0.6 - 1.5) * c / (NC - 1); w.push(x); sum += x; }
      let acc = 0;
      for (let c = 0; c < NC; c++) { ch[c] = w[c] * H / sum; cb[c] = acc; acc += ch[c]; }
    })();

    // ---------- 1. sillares del núcleo (anillo por hilada, con juntas y esquinas) ----------
    const courseStart = new Int32Array(NC), courseEnd = new Int32Array(NC);
    const courseHw = new Float64Array(NC);
    const bBase = [], bHgt = [], bCx = [], bCz = [], bNx = [], bNz = [], bLen = [], bDep = [], bYaw = [], bStart = [], bCol = [];

    for (let c = 0; c < NC; c++) {
      const base = cb[c], hc = ch[c], hw = P.halfAt(base);
      const lens = [], corner = [];
      if (hw > 6) {
        const inner = 2 * hw - 2 * CORNER_L;
        const n = Math.max(1, Math.round(inner / BLOCK_L));
        lens.push(CORNER_L); corner.push(true);
        for (let i = 0; i < n; i++) { lens.push(inner / n); corner.push(false); }
        lens.push(CORNER_L); corner.push(true);
      } else {
        const n = Math.max(1, Math.round(2 * hw / BLOCK_L));
        for (let i = 0; i < n; i++) { lens.push(2 * hw / n); corner.push(false); }
      }
      const N = 4 * lens.length;
      courseStart[c] = bBase.length;
      courseHw[c] = hw;
      let j = 0;
      for (let sd = 0; sd < 4; sd++) {
        const nx = SIDES[sd][0], nz = SIDES[sd][1];
        const tx = -nz, tz = nx;                       // tangente del lado
        const yaw0 = Math.atan2(-tz, tx);
        let start = -hw;
        for (let k = 0; k < lens.length; k++, j++) {
          const Ls = lens[k], isC = corner[k];
          const tau = start + Ls / 2; start += Ls;
          const D = DEPTH * (0.94 + 0.12 * rnd()) * (isC ? 1.4 : 1);
          const rd = hw - D / 2 + (rnd() - 0.5) * 0.12;
          bBase.push(base);
          bHgt.push(hc * 0.955 * (0.99 + 0.02 * rnd()));   // junta horizontal (mortero)
          bCx.push(nx * rd + tx * tau);
          bCz.push(nz * rd + tz * tau);
          bNx.push(nx); bNz.push(nz);
          bLen.push(Ls * 0.965);                            // junta vertical (mortero)
          bDep.push(D * 0.98);
          bYaw.push(yaw0 + (rnd() - 0.5) * 0.015);
          bStart.push(0.8 * j / N);                         // orden de aparición alrededor del perímetro
          bCol.push(rnd());
        }
      }
      courseEnd[c] = bBase.length;
    }
    const NB = bBase.length;

    // ---------- materiales ----------
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.94, metalness: 0.0, side: THREE.FrontSide });
    const boxGeo = new THREE.BoxGeometry(1, 1, 1);

    const SPARE_N = 8;
    const coreMesh = new THREE.InstancedMesh(boxGeo, stoneMat, NB);
    const fillMesh = new THREE.InstancedMesh(boxGeo, stoneMat, NC);   // mortero / relleno
    const spareMesh = new THREE.InstancedMesh(boxGeo, stoneMat, SPARE_N); // sillares esperando
    [coreMesh, fillMesh, spareMesh].forEach(function (m) {
      m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false;
      root.add(m);
    });

    // colores: caliza variada (algo más oscura y sucia hacia la hilada en curso)
    const STONE = ['#c9a66b', '#bd9860', '#d1af76', '#a88552', '#c2a06a', '#b8925e', '#d6b67e']
      .map(function (h) { return new THREE.Color(h); });
    const tmpCol = new THREE.Color();
    for (let i = 0; i < NB; i++) {
      tmpCol.copy(STONE[Math.floor(bCol[i] * STONE.length) % STONE.length]).multiplyScalar(0.88 + 0.18 * rnd());
      coreMesh.setColorAt(i, tmpCol);
    }
    const mortarCol = new THREE.Color('#b08c5c');
    for (let c = 0; c < NC; c++) fillMesh.setColorAt(c, mortarCol);
    for (let i = 0; i < SPARE_N; i++) {
      tmpCol.copy(STONE[i % STONE.length]).multiplyScalar(0.9);
      spareMesh.setColorAt(i, tmpCol);
    }
    coreMesh.instanceColor.needsUpdate = true;
    fillMesh.instanceColor.needsUpdate = true;
    spareMesh.instanceColor.needsUpdate = true;

    // ---------- matrices (solo al cambiar hilada/fracción) ----------
    const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), Q0 = new THREE.Quaternion();
    const S = new THREE.Vector3(), Pz = new THREE.Vector3(), ZERO = new THREE.Vector3();
    const UP = new THREE.Vector3(0, 1, 0);

    // f: fracción construida de la hilada (0..1); cap: fracción de altura que queda (erosión de la cima)
    function writeBlock(i, f, cap) {
      const u = clamp01((f - bStart[i]) / 0.2);
      if (u <= 0 || cap <= 0) {
        M.compose(ZERO, Q0, S.set(0, 0, 0));
      } else {
        const k = 1 - smooth(u);                      // 1 = aún cayendo, 0 = asentado
        const sy = bHgt[i] * cap;
        const rd = k * 1.2;
        Pz.set(bCx[i] + bNx[i] * rd, bBase[i] + sy * 0.5 + k * 6.0, bCz[i] + bNz[i] * rd);
        S.set(bLen[i], sy, bDep[i]);
        Q.setFromAxisAngle(UP, bYaw[i]);
        M.compose(Pz, Q, S);
      }
      coreMesh.setMatrixAt(i, M);
    }

    function writeFill(c, g) {
      if (g <= 0) {
        M.compose(ZERO, Q0, S.set(0, 0, 0));
      } else {
        const fh = Math.max(0.5, courseHw[c] - DEPTH - 0.05);
        Pz.set(0, cb[c] + g * ch[c] * 0.5, 0);
        S.set(2 * fh, g * ch[c], 2 * fh);
        M.compose(Pz, Q0, S);
      }
      fillMesh.setMatrixAt(c, M);
    }

    // sillares sueltos esperando sobre la plataforma (tramo de hilada anterior), por hilada
    const SPARE_ALL = [];
    for (let c = 0; c < NC; c++) {
      for (let i = 0; i < SPARE_N; i++) {
        const m = new THREE.Matrix4();
        if (c >= 1) {
          const sd = i % 4, nx = SIDES[sd][0], nz = SIDES[sd][1], tx = -nz, tz = nx;
          const hwB = P.halfAt(cb[c]);
          const tread = P.halfAt(cb[c - 1]) - hwB;     // ancho de la plataforma superior
          const D = Math.min(0.9, tread * 0.6);
          const rd = hwB + tread * 0.5;
          const tau = (rnd() * 2 - 1) * hwB * 0.7;
          const L = 1.6 + rnd() * 0.8, Hs = 0.7;
          const yaw = Math.atan2(-tz, tx) + (rnd() - 0.5) * 0.6;
          const q = new THREE.Quaternion().setFromAxisAngle(UP, yaw);
          m.compose(new THREE.Vector3(nx * rd + tx * tau, cb[c] + Hs * 0.5, nz * rd + tz * tau),
                    q, new THREE.Vector3(L, Hs, D));
        } else {
          m.compose(ZERO, Q0, new THREE.Vector3(0, 0, 0));
        }
        SPARE_ALL.push(m);
      }
    }

    // marcas de nivelación: cuerdas de obra a la altura de la hilada en curso
    const levelMat = new THREE.MeshBasicMaterial({ color: 0xff9a3c });
    const levelMeshes = [];
    for (let sd = 0; sd < 4; sd++) {
      const mm = new THREE.Mesh(boxGeo, levelMat);
      mm.frustumCulled = false;
      root.add(mm);
      levelMeshes.push(mm);
    }

    const prevF = new Float64Array(NC).fill(-1), prevCap = new Float64Array(NC).fill(-1);
    let prevK = -2;
    function setLevelMarks(k) {
      const visible = k >= 1 && k < NC;
      for (let sd = 0; sd < 4; sd++) {
        const mm = levelMeshes[sd];
        mm.visible = visible;
        if (!visible) continue;
        const nx = SIDES[sd][0], nz = SIDES[sd][1], tx = -nz, tz = nx;
        const hw = P.halfAt(cb[k]) + 4;
        const len = 2 * P.halfAt(cb[k]) + 12;
        mm.position.set(nx * hw, cb[k] + 0.05, nz * hw);
        mm.rotation.set(0, Math.atan2(-tz, tx), 0);
        mm.scale.set(len, 0.08, 0.08);
      }
    }

    // hideTop: hiladas cuya cara superior queda por debajo de esta altura se ocultan (cubiertas por el revestimiento)
    function refresh(build, erosion, hideTop) {
      const hTop = build * H;                          // altura construida
      const cutY = H - 8 * erosion;                    // la cima se trunca ~8 m con la erosión
      let changed = false, kDone = 0, first = true;
      for (let c = 0; c < NC; c++) {
        const f = clamp01((hTop - cb[c]) / ch[c]);
        const cap = (cb[c] + ch[c] <= hideTop) ? 0 : clamp01((cutY - cb[c]) / ch[c]);
        if (f >= 1) kDone = c + 1;
        if (f === prevF[c] && cap === prevCap[c]) continue;
        prevF[c] = f; prevCap[c] = cap;
        for (let i = courseStart[c]; i < courseEnd[c]; i++) writeBlock(i, f, cap);
        writeFill(c, Math.min(f, cap));
        changed = true;
      }
      if (changed) {
        coreMesh.instanceMatrix.needsUpdate = true;
        fillMesh.instanceMatrix.needsUpdate = true;
      }
      // hilada en curso: sillares de espera y marcas de nivelación
      if (kDone !== prevK) {
        prevK = kDone;
        for (let i = 0; i < SPARE_N; i++) {
          const idx = kDone * SPARE_N + i;
          spareMesh.setMatrixAt(i, kDone >= 1 && kDone < NC ? SPARE_ALL[idx] : (SPARE_ALL[0] || M));
        }
        spareMesh.instanceMatrix.needsUpdate = true;
        setLevelMarks(kDone);
      }
      spareMesh.visible = kDone >= 1 && kDone < NC;
    }
    refresh(0, 0, -1);

    // ---------- 2. revestimiento de Tura (8 caras con hendidura central) ----------
    const casingU = {
      uCut: { value: -2 },
      uErode: { value: 0 },
      uGlowOn: { value: 1 }
    };
    const casingMat = new THREE.MeshPhysicalMaterial({
      color: 0xcdbb98, roughness: 0.35, metalness: 0.0,
      side: THREE.FrontSide,
      polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4
    });
    casingMat.onBeforeCompile = function (sh) {
      sh.uniforms.uCut = casingU.uCut;
      sh.uniforms.uErode = casingU.uErode;
      sh.uniforms.uGlowOn = casingU.uGlowOn;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying float vWY;\nvarying vec3 vWP;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvWY = vWP.y;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uCut;\nuniform float uErode;\nuniform float uGlowOn;\nvarying float vWY;\nvarying vec3 vWP;\n' + NOISE_GLSL)
        .replace('void main() {', 'void main() {\n  if (vWY > uCut) discard;\n  float dn = fbm3(vWP * 0.05);\n  if (dn < uErode) discard;')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  float cutGlow = smoothstep(uCut - 0.8, uCut, vWY) * uGlowOn;\n  float erodeEdge = (uErode > 0.001 && uErode < 0.999) ? (1.0 - smoothstep(0.0, 0.05, dn - uErode)) : 0.0;\n  totalEmissiveRadiance += vec3(1.0, 0.82, 0.45) * (cutGlow * 0.6 + erodeEdge * 1.2);');
    };

    function casingGeometry() {
      const NU = 28, NV = 70;
      const faces = SIDES;
      const pos = [], nor = [], idx = [];
      faces.forEach(function (f) {
        const nx = f[0], nz = f[1];
        const tx = -nz, tz = nx;
        const base = pos.length / 3;
        for (let j = 0; j <= NV; j++) {
          const y = CAS_TOP * j / NV;
          const r = Math.max(0, HALF * (1 - y / H) + CAS_OFF);
          const damp = Math.min(1, r / 8);
          for (let i = 0; i <= NU; i++) {
            const u = -1 + 2 * i / NU;
            const groove = 0.9 * (1 - u * u) * damp;    // hendidura de ~0.9 m en el eje de cada cara
            const rr = r - groove;
            pos.push(nx * rr + tx * u * r, y, nz * rr + tz * u * r);
            // normal plana por cara (cada cara se distingue por su sombreado)
            nor.push(nx * SIN_SLOPE, COS_SLOPE, nz * SIN_SLOPE);
          }
        }
        for (let j = 0; j < NV; j++) {
          for (let i = 0; i < NU; i++) {
            const a = base + j * (NU + 1) + i, b = a + (NU + 1);
            idx.push(a, b, a + 1, a + 1, b, b + 1);
          }
        }
      });
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
      g.setIndex(idx);
      return g;
    }
    const casingMesh = new THREE.Mesh(casingGeometry(), casingMat);
    casingMesh.castShadow = true;
    casingMesh.receiveShadow = true;
    root.add(casingMesh);

    // ---------- 3. piramidión de oro con jeroglíficos ----------
    function pyramidGeometry(hb, ht) {
      const corners = [[-hb, 0, -hb], [hb, 0, -hb], [hb, 0, hb], [-hb, 0, hb]];
      const pos = [], nor = [], uv = [];
      for (let k = 0; k < 4; k++) {
        const a = corners[k], b = corners[(k + 1) % 4];
        const d = SIDES[k];
        const nl = Math.sqrt(ht * ht + hb * hb);
        const n = [d[0] * ht / nl, hb / nl, d[1] * ht / nl];
        // triángulo (a, apex, b) con orientación exterior
        pos.push(a[0], a[1], a[2], 0, ht, 0, b[0], b[1], b[2]);
        nor.push(n[0], n[1], n[2], n[0], n[1], n[2], n[0], n[1], n[2]);
        uv.push(0, 0, 0.5, 1, 1, 0);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      return g;
    }
    const capGeo = pyramidGeometry(CAP_HALF, CAP_H);
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xd4a017, metalness: 1, roughness: 0.2,
      emissive: 0x8a6410, emissiveIntensity: 0.35
    });
    const capMesh = new THREE.Mesh(capGeo, goldMat);
    capMesh.castShadow = true;
    root.add(capMesh);

    // textura de halo / destello dibujada en canvas (sin imágenes)
    function glowTexture(inner, mid) {
      const c = document.createElement('canvas');
      c.width = c.height = 128;
      const g = c.getContext('2d');
      const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      grd.addColorStop(0, inner);
      grd.addColorStop(0.35, mid);
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grd;
      g.fillRect(0, 0, 128, 128);
      const tex = new THREE.CanvasTexture(c);
      tex.encoding = THREE.sRGBEncoding;
      return tex;
    }
    const goldGlow = glowTexture('rgba(255,235,170,1)', 'rgba(255,190,80,0.35)');

    // jeroglíficos esquemáticos dorados (trazos emisivos) para la cara del piramidión
    function inscriptionTexture() {
      const c = document.createElement('canvas');
      c.width = 512; c.height = 256;
      const g = c.getContext('2d');
      g.clearRect(0, 0, 512, 256);
      g.strokeStyle = '#ffd36a'; g.fillStyle = '#ffd36a';
      g.lineWidth = 7; g.lineCap = 'round';
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 6; col++) {
          const x = 46 + col * 80, y = 52 + row * 76;
          const kind = (row * 6 + col * 5) % 6;
          g.beginPath();
          if (kind === 0) {                       // ojo
            g.ellipse(x, y, 26, 14, 0, 0, Math.PI * 2); g.stroke();
            g.beginPath(); g.arc(x, y, 5, 0, Math.PI * 2); g.fill();
          } else if (kind === 1) {                // ankh
            g.arc(x, y - 14, 12, 0, Math.PI * 2); g.stroke();
            g.beginPath(); g.moveTo(x, y - 2); g.lineTo(x, y + 26); g.moveTo(x - 14, y + 8); g.lineTo(x + 14, y + 8); g.stroke();
          } else if (kind === 2) {                // ondas (agua)
            g.moveTo(x - 30, y); g.quadraticCurveTo(x - 15, y - 14, x, y); g.quadraticCurveTo(x + 15, y + 14, x + 30, y); g.stroke();
          } else if (kind === 3) {               // casa
            g.rect(x - 22, y - 6, 44, 30); g.moveTo(x - 28, y - 6); g.lineTo(x, y - 26); g.lineTo(x + 28, y - 6); g.stroke();
          } else if (kind === 4) {               // ave
            g.moveTo(x - 26, y + 12); g.lineTo(x, y - 18); g.lineTo(x + 26, y + 12); g.moveTo(x, y - 18); g.lineTo(x, y + 18); g.stroke();
          } else {                                // cuerda enrollada
            g.arc(x, y, 18, 0.4, Math.PI * 1.9); g.stroke();
            g.beginPath(); g.arc(x, y, 6, 0, Math.PI * 2); g.fill();
          }
        }
      }
      const tex = new THREE.CanvasTexture(c);
      tex.encoding = THREE.sRGBEncoding;
      return tex;
    }
    const inscMat = new THREE.MeshBasicMaterial({
      map: inscriptionTexture(), color: 0xffffff, transparent: true, opacity: 0,
      depthWrite: false, blending: THREE.AdditiveBlending
    });
    const inscMesh = new THREE.Mesh(capGeo, inscMat);
    inscMesh.scale.setScalar(1.02);
    capMesh.add(inscMesh);

    const haloMat = new THREE.SpriteMaterial({
      map: goldGlow, color: 0xffd27a, blending: THREE.AdditiveBlending,
      transparent: true, depthWrite: false, opacity: 0
    });
    const halo = new THREE.Sprite(haloMat);
    halo.visible = false;
    root.add(halo);

    // ---------- 4. rayo, destello y anillos ----------
    const beamGroup = new THREE.Group();
    beamGroup.position.set(0, CUSP, 0);
    root.add(beamGroup);

    const beamGeo = new THREE.CylinderGeometry(0.4, 2.2, 2000, 32, 1, true);
    beamGeo.translate(0, 1000, 0);
    const beamU = { uI: { value: 0 }, uT: { value: 0 }, uCol: { value: new THREE.Color(0xffd27a) } };
    const beamMat = new THREE.ShaderMaterial({
      uniforms: beamU, vertexShader: BEAM_VS, fragmentShader: BEAM_FS,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide
    });
    const beamMesh = new THREE.Mesh(beamGeo, beamMat);
    beamMesh.frustumCulled = false;
    beamGroup.add(beamMesh);

    const flashMat = new THREE.SpriteMaterial({
      map: goldGlow, color: 0xfff0c8, blending: THREE.AdditiveBlending,
      transparent: true, depthWrite: false, opacity: 0
    });
    const flash = new THREE.Sprite(flashMat);
    beamGroup.add(flash);

    const ringGeo = new THREE.RingGeometry(0.96, 1, 96);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMats = [], rings = [];
    for (let i = 0; i < 3; i++) {
      const m = new THREE.MeshBasicMaterial({
        color: 0xffc85a, transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
      });
      const r = new THREE.Mesh(ringGeo, m);
      r.frustumCulled = false;
      ringMats.push(m); rings.push(r);
      beamGroup.add(r);
    }

    // ---------- 5. escombro en la base y mástil en la cima truncada ----------
    const DEB_N = 240;
    const debrisMat = new THREE.MeshStandardMaterial({ color: 0xe8dcc4, roughness: 0.75 });
    const debrisMesh = new THREE.InstancedMesh(boxGeo, debrisMat, DEB_N);
    debrisMesh.castShadow = true; debrisMesh.receiveShadow = true; debrisMesh.frustumCulled = false;
    root.add(debrisMesh);
    const debThr = new Float64Array(DEB_N);
    const debPos = [], debSize = [], debYaw = [];
    for (let i = 0; i < DEB_N; i++) {
      debThr[i] = rnd();
      const a = rnd() * Math.PI * 2;
      const r = HALF * (0.95 + rnd() * 0.25) + rnd() * 18;
      debPos.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
      debSize.push(1 + rnd() * 2.5);
      debYaw.push(rnd() * Math.PI);
    }
    const debM = new THREE.Matrix4(), debQ = new THREE.Quaternion(), debS = new THREE.Vector3(), debP = new THREE.Vector3();
    let prevEr = -1;
    function writeDebris(er) {
      for (let i = 0; i < DEB_N; i++) {
        const s = smooth(clamp01((er - debThr[i]) / 0.08)) * debSize[i];
        debP.copy(debPos[i]); debP.y = debSize[i] * 0.25;
        debQ.setFromAxisAngle(UP, debYaw[i]);
        debS.set(debSize[i] * 1.3, Math.max(1e-4, s * 0.6), debSize[i] * 0.9);
        if (s <= 0.01) debS.set(0, 0, 0);
        debM.compose(debP, debQ, debS);
        debrisMesh.setMatrixAt(i, debM);
      }
      debrisMesh.instanceMatrix.needsUpdate = true;
    }
    writeDebris(0);

    const mastMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2b, roughness: 0.9 });
    const mastMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 1, 8), mastMat);
    mastMesh.castShadow = true;
    mastMesh.visible = false;
    root.add(mastMesh);

    // ---------- 6. modo rayos X (solo aristas holográficas) ----------
    // aristas: contorno de cada 5 hiladas + 4 aristas de esquina
    const linePts = [];
    for (let k = 0; k <= NC; k += 5) {
      const y = k < NC ? cb[k] : H;
      const r = P.halfAt(y);
      if (r < 0.5) continue;
      const cs = [[-r, y, -r], [r, y, -r], [r, y, r], [-r, y, r]];
      for (let q = 0; q < 4; q++) {
        const a = cs[q], b = cs[(q + 1) % 4];
        linePts.push(a[0], a[1], a[2], b[0], b[1], b[2]);
      }
    }
    [[-HALF, 0, -HALF], [HALF, 0, -HALF], [HALF, 0, HALF], [-HALF, 0, HALF]].forEach(function (c) {
      linePts.push(c[0], c[1], c[2], 0, H, 0);
    });
    const edgeGeo = new THREE.BufferGeometry();
    edgeGeo.setAttribute('position', new THREE.Float32BufferAttribute(linePts, 3));
    const edgeMat = new THREE.LineBasicMaterial({
      color: 0x44ffff, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    const edgeLines = new THREE.LineSegments(edgeGeo, edgeMat);
    edgeLines.visible = false;
    root.add(edgeLines);

    function applyXray(x) {
      // bloques del núcleo ocultos a partir de 0.5; las caras casi invisibles (opacity <= 0.05)
      const hideBlocks = x > 0.5;
      coreMesh.visible = !hideBlocks;
      fillMesh.visible = !hideBlocks;
      spareMesh.visible = !hideBlocks && spareMesh.visible;
      const face = 1 - 0.95 * clamp01(x * 2);
      const on = x > 0.001;
      if (!on) {                       // sin rayos X: materiales opacos, sin transparencia residual
        stoneMat.transparent = false; stoneMat.opacity = 1; stoneMat.depthWrite = true;
        casingMat.transparent = false; casingMat.opacity = 1; casingMat.depthWrite = true;
        casingMat.emissive.setRGB(0, 0, 0);
      }

      stoneMat.transparent = on;
      stoneMat.opacity = face;
      stoneMat.depthWrite = !on;

      casingMat.transparent = on;
      casingMat.opacity = face;
      casingMat.depthWrite = !on;
      casingMat.emissive.setRGB(0.05 * x, 0.35 * x, 0.4 * x);

      edgeMat.opacity = 0.95 * clamp01(x * 2);
      edgeLines.visible = x > 0.002;
    }

    // ---------- update (función pura del estado) ----------
    let lastTop = 0;

    function update(s) {
      const build = clamp01(s.build || 0);
      const er = clamp01(s.erosion || 0);
      const xr = clamp01(s.xray || 0);
      const cs = clamp01(s.casing || 0);
      const cap = clamp01(s.capstone || 0);
      const bm = clamp01(s.beam || 0);
      const wall = s.wall || 0;

      // núcleo, sillares de espera y marcas
      // revestimiento: sube de abajo a arriba; borde brillante fino solo mientras casing < 1
      casingU.uCut.value = -2 + cs * (CAS_TOP + 3);
      // núcleo oculto por el revestimiento (z-fighting): todo si casing>=0.999; por debajo del corte-2 m mientras sube
      let hideTop = -1;
      if (er <= 0.001) {
        if (cs >= 0.999) hideTop = 1e9;
        else if (cs > 0.001) hideTop = casingU.uCut.value - 2;
      }
      refresh(build, er, hideTop);
      lastTop = Math.max(0, Math.min(build * H, H - 8 * er));
      if (er <= 0.001 && cs >= 0.999) spareMesh.visible = false;

      casingU.uGlowOn.value = cs < 0.999 ? 1 : 0;
      casingU.uErode.value = er;
      casingMesh.visible = cs > 0.001 && er < 0.999;

      // escombro y mástil de la erosión
      if (er !== prevEr) { prevEr = er; writeDebris(er); }
      const cutY = H - 8 * er;
      mastMesh.visible = er > 0.001;
      mastMesh.position.set(0, H - 4 * er, 0);
      mastMesh.scale.set(1, Math.max(0.001, 8 * er), 1);

      // piramidión: desciende desde ~40 m y se asienta; se va con la erosión
      const e = smooth(cap);
      const capVis = cap > 0.001 ? 1 - smooth(clamp01(er * 1.2)) : 0;
      const yOff = H + (1 - e) * 40;
      capMesh.visible = capVis > 0.001;
      capMesh.position.y = yOff;
      capMesh.scale.setScalar(Math.max(capVis, 0.0001));
      inscMat.opacity = cap > 0.5 ? 0.9 * smooth(clamp01((cap - 0.5) * 2)) : 0;
      inscMesh.visible = inscMat.opacity > 0.001;

      const haloOp = cap * capVis * (0.75 + 0.25 * Math.sin(wall * 1.7));
      haloMat.opacity = haloOp;
      halo.visible = haloOp > 0.001;
      halo.position.set(0, yOff + CAP_H * 0.5, 0);
      halo.scale.setScalar(20);

      // rayo
      beamGroup.visible = bm > 0.001;
      beamU.uI.value = bm;
      beamU.uT.value = wall;
      flashMat.opacity = bm * 0.95;
      flash.scale.setScalar(20 + 30 * bm);
      for (let i = 0; i < 3; i++) {
        const p = (wall * 0.22 + i / 3) % 1;
        rings[i].scale.setScalar(4 + 110 * p);
        ringMats[i].opacity = bm * (1 - p) * 0.7;
      }

      // rayos X
      applyXray(xr);
    }

    return {
      update: update,
      group: root,
      topY: function () { return lastTop; }
    };
  };
})();
