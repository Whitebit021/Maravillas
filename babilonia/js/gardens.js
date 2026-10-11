// Jardines Colgantes de Babilonia: cinco terrazas de ladrillo con arcadas de bóvedas, bóvedas de la base,
// escalinata sur, tierra, plantas (InstancedMesh con viento), enredaderas, cascadas, pabellón, fantasma y ruina.
// Estado s: s.terraces, s.vaults, s.xray, s.soil, s.plants, s.cascades, s.ghost, s.decay (0..1).
// Todo es función del estado (sin acumulación); s.wall solo mueve el viento y el agua.
(function () {
  'use strict';
  const G = window.GIZA;

  function clamp01(x) { return x < 0 ? 0 : (x > 1 ? 1 : x); }
  function smooth(x) { return x * x * (3 - 2 * x); }
  function makeRng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

  G.createGardens = function (ctx) {
    const THREE = ctx.THREE, scene = ctx.scene;
    const GD = G.GARDENS, TIERS = GD.tiers, NT = TIERS.length, H = GD.height;
    const root = new THREE.Group(); scene.add(root);
    const ghostRoot = new THREE.Group(); scene.add(ghostRoot);
    const rnd = makeRng(4242);
    const UP = new THREE.Vector3(0, 1, 0);
    const ID = new THREE.Matrix4();
    const HW0 = TIERS[0][2];
    const FACES = [[0, -1], [1, 0], [0, 1], [-1, 0]];   // N, E, S, O (normal exterior)
    const HIDE = -1000, NOCUT = 1e6;
    const uWallU = { value: 0 };
    const _p = new THREE.Vector3(), _s = new THREE.Vector3(), _m = new THREE.Matrix4();
    const _q = new THREE.Quaternion(), _e = new THREE.Euler(), _qI = new THREE.Quaternion();

    function yawQ(a) { return new THREE.Quaternion().setFromAxisAngle(UP, a); }
    function put(inst, i, x, y, z, q, sx, sy, sz) {
      _p.set(x, y, z); _s.set(sx, sy, sz); _m.compose(_p, q || _qI, _s); inst.setMatrixAt(i, _m);
    }
    function hideAt(inst, i) { put(inst, i, 0, -1000, 0, null, 0, 0, 0); }
    function tex(cv, srgb, rep) {
      const t = new THREE.CanvasTexture(cv);
      if (srgb) t.encoding = THREE.sRGBEncoding;
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      if (rep) t.repeat.set(rep, rep);
      t.anisotropy = 8;
      return t;
    }

    // ---------- texturas dibujadas por código ----------
    // ladrillo cocido (#b8794a) con juntas de betún oscuro; bump = juntas hundidas
    function brickCanvases() {
      const N = 512, c = makeCanvas(N, N), b = makeCanvas(N, N), g = c.getContext('2d'), h = b.getContext('2d'), r = makeRng(9);
      g.fillStyle = '#3a2a1e'; g.fillRect(0, 0, N, N);
      h.fillStyle = '#1e1e1e'; h.fillRect(0, 0, N, N);
      const cols = 4, rows = 8, bw = N / cols, bh = N / rows, J = 6;
      for (let row = 0; row < rows; row++) {
        const off = (row % 2) ? bw * 0.5 : 0;
        for (let col = -1; col <= cols; col++) {
          const x = col * bw + off, y = row * bh, tone = 0.86 + 0.24 * r();
          g.fillStyle = 'rgb(' + Math.round(184 * tone) + ',' + Math.round(121 * tone) + ',' + Math.round(74 * tone) + ')';
          g.fillRect(x + J, y + J, bw - 2 * J, bh - 2 * J);
          for (let k = 0; k < 7; k++) {                   // manchas de cocción
            const mx = x + r() * bw, my = y + r() * bh;
            g.fillStyle = 'rgba(' + (r() < 0.5 ? '70,38,20' : '240,196,150') + ',' + (0.04 + 0.08 * r()).toFixed(2) + ')';
            g.fillRect(mx, my, 2 + r() * 6, 1 + r() * 3);
          }
          h.fillStyle = '#c4c4c4'; h.fillRect(x + J, y + J, bw - 2 * J, bh - 2 * J);
          h.fillStyle = '#4a4a4a'; h.fillRect(x + J, y + bh - J - 3, bw - 2 * J, 3);
        }
      }
      return { map: c, bump: b };
    }
    function soilCanvas() {
      const N = 256, c = makeCanvas(N, N), g = c.getContext('2d'), r = makeRng(31);
      g.fillStyle = '#4b3621'; g.fillRect(0, 0, N, N);
      for (let i = 0; i < 2600; i++) {
        const q = Math.round(40 + 60 * r()), x = r() * N, y = r() * N, sz = 1 + r() * 2.5;
        g.fillStyle = 'rgb(' + Math.round(q * 1.2) + ',' + Math.round(q * 0.82) + ',' + Math.round(q * 0.5) + ')';
        g.fillRect(x, y, sz, sz);
      }
      return c;
    }
    // hojas recortadas (fondo transparente) para enredaderas: alphaTest
    function leafCanvas() {
      const W = 128, Hc = 256, c = makeCanvas(W, Hc), g = c.getContext('2d'), r = makeRng(55);
      g.clearRect(0, 0, W, Hc);
      g.strokeStyle = 'rgba(30,60,25,0.9)'; g.lineWidth = 1.6;
      for (let i = 0; i < 5; i++) { const x = r() * W; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + (r() - 0.5) * 12, Hc); g.stroke(); }
      for (let i = 0; i < 150; i++) {
        const x = 6 + r() * (W - 12), y = 6 + r() * (Hc - 12), v = r();
        g.fillStyle = 'rgb(' + Math.round(38 + 40 * v) + ',' + Math.round(108 + 70 * v) + ',' + Math.round(38 + 22 * v) + ')';
        g.beginPath(); g.ellipse(x, y, 8 + r() * 8, 4 + r() * 4, r() * Math.PI, 0, Math.PI * 2); g.fill();
      }
      const FL = ['#d6322f', '#f0c23a', '#f4f1e6', '#e0649a'];
      for (let i = 0; i < 18; i++) {
        g.fillStyle = FL[i % 4];
        g.beginPath(); g.arc(6 + r() * (W - 12), 6 + r() * (Hc - 12), 2.5 + r() * 1.5, 0, Math.PI * 2); g.fill();
      }
      return c;
    }

    function glazeCanvas() {
      const W = 256, Hc = 64, c = makeCanvas(W, Hc), g = c.getContext('2d');
      g.fillStyle = '#1f4fa0'; g.fillRect(0, 0, W, Hc);
      g.strokeStyle = '#e0b257'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(0, 5); g.lineTo(W, 5); g.moveTo(0, Hc - 5); g.lineTo(W, Hc - 5); g.stroke();
      const x = W / 2, y = Hc / 2;
      for (let p = 0; p < 8; p++) {
        const a = p / 8 * Math.PI * 2;
        g.fillStyle = p % 2 ? '#f4f1e6' : '#e0b257';
        g.beginPath(); g.ellipse(x + Math.cos(a) * 10, y + Math.sin(a) * 10, 6, 3.5, a, 0, Math.PI * 2); g.fill();
      }
      g.fillStyle = '#f4f1e6'; g.beginPath(); g.arc(x, y, 4.5, 0, Math.PI * 2); g.fill();
      return c;
    }

    // ---------- utilidades de geometría ----------
    // fusiona piezas {g, m, c}: posición, normal, color por vértice e índices
    function mergeGeos(list) {
      const pos = [], nor = [], col = [], idx = [], uvs = [];
      const v = new THREE.Vector3(), nv = new THREE.Vector3(), nm = new THREE.Matrix3();
      let off = 0;
      list.forEach(function (it) {
        const g = it.g, P = g.attributes.position, N = g.attributes.normal, n = P.count;
        const m = it.m || ID, c = it.c || { r: 1, g: 1, b: 1 };
        nm.getNormalMatrix(m);
        for (let i = 0; i < n; i++) {
          v.fromBufferAttribute(P, i).applyMatrix4(m); pos.push(v.x, v.y, v.z);
          nv.fromBufferAttribute(N, i).applyMatrix3(nm).normalize(); nor.push(nv.x, nv.y, nv.z);
          col.push(c.r, c.g, c.b);
          const uA = g.attributes.uv; if (uA) uvs.push(uA.getX(i), uA.getY(i)); else uvs.push(0, 0);
        }
        if (g.index) { for (let i = 0; i < g.index.count; i++) idx.push(g.index.getX(i) + off); }
        else { for (let i = 0; i < n; i++) idx.push(i + off); }
        off += n;
      });
      const out = new THREE.BufferGeometry();
      out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
      out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      out.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      out.setIndex(idx);
      return out;
    }
    // malla paramétrica u,t en [0,1]
    function gridGeo(nU, nT, fn) {
      const pos = [], idx = [];
      for (let j = 0; j <= nT; j++) for (let i = 0; i <= nU; i++) { const p = fn(i / nU, j / nT); pos.push(p[0], p[1], p[2]); }
      for (let j = 0; j < nT; j++) for (let i = 0; i < nU; i++) {
        const a = j * (nU + 1) + i, b = a + nU + 1;
        idx.push(a, b, a + 1, a + 1, b, b + 1);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setIndex(idx); g.computeVertexNormals();
      return g;
    }
    // UV de ladrillo en metros (tile = lado de la baldosa de textura)
    function uvBox(geo, tile) {
      const P = geo.attributes.position, N = geo.attributes.normal, UV = geo.attributes.uv;
      for (let i = 0; i < P.count; i++) {
        const u = Math.abs(N.getX(i)) > 0.5 ? P.getZ(i) : P.getX(i);
        UV.setXY(i, u / tile + 0.5, P.getY(i) / tile + 0.5);
      }
      UV.needsUpdate = true;
      return geo;
    }
    // atributo de corte por vértice (box): discard si la y del mundo supera aCut
    function addVertCut(geo, v) {
      const a = new THREE.Float32BufferAttribute(new Float32Array(geo.attributes.position.count).fill(v), 1);
      geo.setAttribute('aCut', a);
      return a;
    }
    // atributo de corte por instancia
    function addInstCut(geo, n, v) {
      const a = new THREE.InstancedBufferAttribute(new Float32Array(n).fill(v), 1);
      geo.setAttribute('aCut', a);
      return a;
    }
    // inyecta el corte por altura (aCut por vértice o por instancia) en un material estándar
    function cutify(mat, key) {
      mat.onBeforeCompile = function (sh) {
        sh.vertexShader = sh.vertexShader
          .replace('#include <common>', '#include <common>\nattribute float aCut;\nvarying float vCut;\nvarying float vWY;')
          .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCut = aCut;\n#ifdef USE_INSTANCING\nvWY = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).y;\n#else\nvWY = (modelMatrix * vec4(transformed, 1.0)).y;\n#endif');
        sh.fragmentShader = sh.fragmentShader
          .replace('#include <common>', '#include <common>\nvarying float vCut;\nvarying float vWY;')
          .replace('void main() {', 'void main() {\n  if (vWY > vCut) discard;');
      };
      mat.customProgramCacheKey = function () { return 'cut-' + key; };
      return mat;
    }
    // viento: balanceo proporcional a la altura (s.wall), amplitud por material
    function windify(mat, amp) {
      mat.onBeforeCompile = function (sh) {
        sh.uniforms.uWall = uWallU;
        sh.uniforms.uSway = { value: amp };
        sh.vertexShader = sh.vertexShader
          .replace('#include <common>', '#include <common>\nuniform float uWall;\nuniform float uSway;')
          .replace('#include <begin_vertex>', '#include <begin_vertex>\n' +
            '#ifdef USE_INSTANCING\n float wph = instanceMatrix[3].x * 0.13 + instanceMatrix[3].z * 0.09;\n#else\n float wph = 0.0;\n#endif\n' +
            ' float wy = abs(transformed.y);\n' +
            ' float wsw = sin(uWall * 1.3 + wph) * 0.05 + 0.025 * sin(uWall * 2.7 + wph * 2.1);\n' +
            ' transformed.x += wsw * wy * uSway;\n transformed.z += wsw * 0.5 * wy * uSway;');
      };
      mat.customProgramCacheKey = function () { return 'wind'; };
      return mat;
    }
    // secado: mezcla el color difuso hacia marrón según el atributo por instancia aDry (0..1)
    function dryify(mat) {
      const prev = mat.onBeforeCompile;
      mat.onBeforeCompile = function (sh) {
        prev(sh);
        sh.vertexShader = sh.vertexShader
          .replace('#include <common>', '#include <common>\nattribute float aDry;\nvarying float vDry;')
          .replace('#include <begin_vertex>', '#include <begin_vertex>\nvDry = aDry;');
        sh.fragmentShader = sh.fragmentShader
          .replace('#include <common>', '#include <common>\nvarying float vDry;')
          .replace('#include <color_fragment>', '#include <color_fragment>\n  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.45, 0.31, 0.14), vDry);');
      };
      mat.customProgramCacheKey = function () { return 'wind-dry'; };
      return mat;
    }
    function setInstCut(attr, idxs, v) {
      const a = attr.array; let ch = false;
      for (let k = 0; k < idxs.length; k++) { const j = idxs[k]; if (a[j] !== v) { a[j] = v; ch = true; } }
      if (ch) attr.needsUpdate = true;
    }

    // ---------- materiales ----------
    const brickC = brickCanvases();
    const tierMat = cutify(new THREE.MeshStandardMaterial({
      map: tex(brickC.map, true, 1), bumpMap: tex(brickC.bump, false, 1), bumpScale: 1.8,
      roughness: 0.92, side: THREE.DoubleSide
    }), 'brick');
    const darkMat = cutify(new THREE.MeshStandardMaterial({ color: 0x1b120b, roughness: 1, side: THREE.DoubleSide }), 'dark');
    const soilMat = cutify(new THREE.MeshStandardMaterial({ map: tex(soilCanvas(), true, 1), roughness: 1 }), 'soil');
    const pavMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 });
    const rubMat = tierMat;
    const palmMat = windify(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, side: THREE.DoubleSide }), 0.35);
    const cypMat = windify(new THREE.MeshStandardMaterial({ color: 0x2f5e2c, roughness: 0.85 }), 0.3);
    const pomMat = windify(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }), 0.35);
    const shrMat = windify(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, flatShading: true }), 0.2);
    const wilMat = windify(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, side: THREE.DoubleSide }), 0.45);
    const leafTex = tex(leafCanvas(), true, 1);
    leafTex.repeat.set(1, 3);
    const vineMat = windify(new THREE.MeshStandardMaterial({
      map: leafTex, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.85
    }), 3.0);

    [palmMat, cypMat, pomMat, shrMat, wilMat, vineMat].forEach(dryify);

    // ---------- terrazas: bloques de ladrillo (altura construida = s.terraces * 25 m) ----------
    const T = TIERS.map(function (t, i) {
      return { i: i, yb: t[0], yt: t[1], hw: t[2], bh: 0, cut: HIDE };
    });
    T.forEach(function (t) {
      const g = uvBox(new THREE.BoxGeometry(2 * t.hw, t.yt - t.yb, 2 * t.hw), 2.4);
      t.cutAttr = addVertCut(g, HIDE);
      t.mesh = new THREE.Mesh(g, tierMat);
      t.mesh.position.set(0, (t.yt + t.yb) / 2, 0);
      t.mesh.receiveShadow = true; t.mesh.visible = false;
      root.add(t.mesh);
    });

    // ---------- arcadas: arcos de medio punto con bóveda oscura en cada fachada ----------
    const SPAN = GD.vault.span, ARCH_H = 2.0, ARCH_STEP = SPAN + 1.5, ARCH_YB = 0.35;
    const archInfo = [];
    T.forEach(function (t) {
      FACES.forEach(function (f) {
        const nx = f[0], nz = f[1], tx = -nz, tz = nx;
        const m = Math.max(1, Math.floor((2 * t.hw - 2) / ARCH_STEP));
        for (let j = 0; j < m; j++) {
          const u = (j - (m - 1) / 2) * ARCH_STEP;
          archInfo.push({ tier: t.i, nx: nx, nz: nz, u: u, x: nx * t.hw + tx * u, y: t.yb + ARCH_YB, z: nz * t.hw + tz * u, yaw: Math.atan2(nx, nz) });
        }
      });
    });
    function archPath(w, h, path) {
      path.moveTo(-w, 0); path.lineTo(-w, h);
      path.absarc(0, h, w, Math.PI, 0, true);
      path.lineTo(w, 0); path.lineTo(-w, 0);
      return path;
    }
    const innerShape = archPath(SPAN / 2, ARCH_H, new THREE.Shape());
    const frameShape = archPath(SPAN / 2 + 0.45, ARCH_H, new THREE.Shape());
    frameShape.holes.push(archPath(SPAN / 2, ARCH_H, new THREE.Path()));
    const NA = archInfo.length;
    const frameGeo = new THREE.ExtrudeGeometry(frameShape, { depth: 1.0, bevelEnabled: false, curveSegments: 6 });
    const frameCutAttr = addInstCut(frameGeo, NA, HIDE);
    const frameMesh = new THREE.InstancedMesh(frameGeo, tierMat, NA);
    const darkGeo = new THREE.ShapeGeometry(innerShape, 10);
    const darkCutAttr = addInstCut(darkGeo, NA, HIDE);
    const darkMesh = new THREE.InstancedMesh(darkGeo, darkMat, NA);
    const archByTier = T.map(function () { return []; });
    archInfo.forEach(function (a, i) {
      archByTier[a.tier].push(i);
      put(frameMesh, i, a.x, a.y, a.z, yawQ(a.yaw), 1, 1, 1);
      put(darkMesh, i, a.x + a.nx * 0.03, a.y, a.z + a.nz * 0.03, yawQ(a.yaw), 1, 1, 1);
    });
    frameMesh.instanceMatrix.needsUpdate = true; darkMesh.instanceMatrix.needsUpdate = true;
    frameMesh.frustumCulled = false; darkMesh.frustumCulled = false;
    root.add(frameMesh); root.add(darkMesh);

    // ---------- bóvedas de la terraza inferior: hileras de cañón paralelas (aparecen con s.vaults) ----------
    const VR = 2.3, VSP = 2 * VR;
    const NVR = Math.floor(2 * HW0 / VSP);
    const vaultGeo = gridGeo(16, 1, function (a, t) {
      const th = Math.PI * a;
      return [t - 0.5, 0.2 + VR * Math.sin(th), VR * Math.cos(th)];
    });
    const vaultCut = addInstCut(vaultGeo, NVR, NOCUT);
    const vaultMesh = new THREE.InstancedMesh(vaultGeo, tierMat, NVR);
    vaultMesh.castShadow = false; vaultMesh.frustumCulled = false;
    const vaultRowBreak = [];
    for (let k = 0; k < NVR; k++) {
      put(vaultMesh, k, 0, 0, -HW0 + VR + k * VSP, null, 2 * HW0, 1, 1);
      vaultRowBreak.push(0.3 + 0.6 * rnd());
    }
    vaultMesh.instanceMatrix.needsUpdate = true;
    root.add(vaultMesh);

    // ---------- escalinata monumental en la cara sur (20 peldaños por terraza) ----------
    const STEPS = 20, STAIR_W = 12;
    const stairGeo = uvBox(new THREE.BoxGeometry(STAIR_W, 1, 0.5), 2.4);
    const stairList = [];
    T.forEach(function (t) {
      for (let k = 0; k < STEPS; k++) {
        stairList.push({ tier: t.i, top: t.yb + (k + 1) * (t.yt - t.yb) / STEPS, z: t.hw + 10 - 0.5 * (k + 0.5) });
      }
    });
    const stairCut = addInstCut(stairGeo, stairList.length, HIDE);
    const stairMesh = new THREE.InstancedMesh(stairGeo, tierMat, stairList.length);
    stairMesh.frustumCulled = false;
    stairList.forEach(function (st, i) { put(stairMesh, i, 0, st.top / 2, st.z, null, 1, st.top, 1); });
    stairMesh.instanceMatrix.needsUpdate = true;
    root.add(stairMesh);

    // ---------- tierra fértil sobre cada terraza (una malla fusionada, corte por vértice) ----------
    const soilList = T.map(function (t) {
      return { g: new THREE.BoxGeometry(2 * t.hw - 0.2, 0.5, 2 * t.hw - 0.2).translate(0, t.yt - 0.25, 0), c: null };
    });
    const soilGeo = mergeGeos(soilList);
    const soilCut = addVertCut(soilGeo, HIDE);
    const soilMesh = new THREE.Mesh(soilGeo, soilMat);
    soilMesh.receiveShadow = true; soilMesh.visible = false;
    root.add(soilMesh);
    const soilVerts = soilList[0].g.attributes.position.count;   // 24 por caja

    // ---------- ruina: montículos de ladrillo al pie y en las terrazas caídas ----------
    const RB = 260;
    const rubGeo = uvBox(new THREE.BoxGeometry(1, 1, 1), 2.4);
    const rubCut = addInstCut(rubGeo, RB, NOCUT);
    const rubble = new THREE.InstancedMesh(rubGeo, rubMat, RB);
    rubble.castShadow = false; rubble.receiveShadow = true; rubble.frustumCulled = false;
    root.add(rubble);
    const rubItems = [];
    for (let i = 0; i < RB; i++) {
      const a = rnd() * Math.PI * 2, r = HW0 - 4 + Math.pow(rnd(), 0.7) * 30;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      const rr = clamp01((r - HW0 + 4) / 30);                       // 0 junto a la base, 1 lejos
      const sx = 1.2 + rnd() * 2.4, sy = 0.8 + rnd() * 1.4, sz = 1.2 + rnd() * 2.2;
      const hp = 10 * (1 - rr) + 1;
      const onStair = z > 0 && Math.abs(x) < 9 && r < 80;           // no tapar la escalinata
      rubItems.push({ x: x, y: rnd() * hp * 0.8 + sy / 2, z: z, yaw: rnd() * 6.28, sx: sx, sy: sy, sz: sz,
        thr: onStair ? 2 : 0.1 + 0.75 * rr + 0.15 * rnd() });
    }

    // ===== continúa en gp2 (plantas, enredaderas, agua, pabellón, fantasma) =====
    // ---------- parapetos con almenas escalonadas y banda de ladrillo vidriado azul con rosetas ----------
    const PAR_H = 1.2, PAR_T = 1.0, ONE = new THREE.Vector3(1, 1, 1);
    const glazeMat = cutify(new THREE.MeshStandardMaterial({ map: tex(glazeCanvas(), true, 1), roughness: 0.35, side: THREE.DoubleSide }), 'glaze');
    const parParts = [], glzParts = [];
    T.forEach(function (t) {
      FACES.forEach(function (f, fi) {
        const nx = f[0], nz = f[1], tx = -nz, tz = nx, yaw = Math.atan2(nx, nz), q = yawQ(yaw);
        const rd = t.hw - 0.6;                       // muro a 0.6 m del borde (cara exterior a 0.1 m)
        const P3 = function (dist, u, y) { return new THREE.Vector3(nx * dist + tx * u, y, nz * dist + tz * u); };
        const segs = (fi === 2 && t.i < NT - 1) ? [[-t.hw, -7.5], [7.5, t.hw]] : [[-t.hw, t.hw]];   // hueco de la escalinata
        segs.forEach(function (sg) {
          const a = sg[0], b = sg[1], len = b - a, cu = (a + b) / 2;
          parParts.push({ g: uvBox(new THREE.BoxGeometry(len, PAR_H, PAR_T), 2.4),
            m: new THREE.Matrix4().compose(P3(rd, cu, t.yt + PAR_H / 2), q, ONE), tier: t.i });
          for (let u = a + 1.2; u <= b - 1.2; u += 2.4) {          // almenas escalonadas: dos gradas
            parParts.push({ g: uvBox(new THREE.BoxGeometry(1.4, 0.5, PAR_T), 2.4),
              m: new THREE.Matrix4().compose(P3(rd, u, t.yt + PAR_H + 0.25), q, ONE), tier: t.i });
            parParts.push({ g: uvBox(new THREE.BoxGeometry(0.8, 0.5, PAR_T - 0.2), 2.4),
              m: new THREE.Matrix4().compose(P3(rd, u, t.yt + PAR_H + 0.75), q, ONE), tier: t.i });
          }
          const gp = new THREE.PlaneGeometry(len, 0.6, 1, 1);
          const uvA = gp.attributes.uv;
          for (let k = 0; k < uvA.count; k++) uvA.setX(k, uvA.getX(k) * len / 2.4);
          uvA.needsUpdate = true;
          glzParts.push({ g: gp, m: new THREE.Matrix4().compose(P3(rd + 0.5, cu, t.yt + 0.5), q, ONE), tier: t.i });
        });
      });
    });
    const parGeo = mergeGeos(parParts), glzGeo = mergeGeos(glzParts);
    const parCut = addVertCut(parGeo, HIDE), glzCut = addVertCut(glzGeo, HIDE);
    const parMesh = new THREE.Mesh(parGeo, tierMat); parMesh.receiveShadow = true;
    const glzMesh = new THREE.Mesh(glzGeo, glazeMat);
    root.add(parMesh); root.add(glzMesh);
    function tierRanges(list) {
      const out = []; let off = 0;
      list.forEach(function (it) { const n = it.g.attributes.position.count; out.push([off, off + n, it.tier]); off += n; });
      return out;
    }
    const parRng = tierRanges(parParts), glzRng = tierRanges(glzParts);
    function setRangeCut(attr, rng, cutOf) {
      const a = attr.array;
      rng.forEach(function (r) { for (let v = r[0]; v < r[1]; v++) a[v] = cutOf[r[2]]; });
      attr.needsUpdate = true;
    }

    // ---------- especies: geometría fusionada con color por vértice (un InstancedMesh por especie) ----------
    function colr(hex) { return new THREE.Color(hex); }
    function frondGeo(a, L, bend) {
      const D = [Math.cos(a), 0, Math.sin(a)], P = [-Math.sin(a), 0, Math.cos(a)];
      return gridGeo(1, 8, function (u, t) {
        const w = (u - 0.5) * 1.2 * (1 - 0.6 * t);
        return [D[0] * L * t * 0.85 + P[0] * w,
                13 + L * t * 0.5 - bend * t * t + P[1] * w,
                D[2] * L * t * 0.85 + P[2] * w];
      });
    }
    // palmera datilera: estípite con penachos colgantes (copa a 13 m)
    const palmParts = [{ g: new THREE.CylinderGeometry(0.2, 0.34, 13, 8, 4, true).translate(0, 6.5, 0), c: colr('#8a6a40') }];
    for (let k = 0; k < 11; k++) {
      const a = k / 11 * Math.PI * 2 + rnd() * 0.3, L = 5.6 + rnd() * 1.4;
      palmParts.push({ g: frondGeo(a, L, 2.6), c: colr(rnd() < 0.5 ? '#3f7a32' : '#56903a') });
    }
    const palmGeo = mergeGeos(palmParts);
    // granado: copa densa con frutos rojos
    const pomParts = [
      { g: new THREE.CylinderGeometry(0.22, 0.32, 3.2, 6).translate(0, 1.6, 0), c: colr('#6b4f2a') },
      { g: new THREE.IcosahedronGeometry(2.1, 1).translate(0, 3.6, 0), c: colr('#4f8a3a') }
    ];
    for (let k = 0; k < 9; k++) {
      const th = rnd() * Math.PI * 2, ph = 0.5 + rnd() * 2.0;
      pomParts.push({ g: new THREE.IcosahedronGeometry(0.2, 0).translate(2.2 * Math.sin(ph) * Math.cos(th), 3.6 + 2.2 * Math.cos(ph), 2.2 * Math.sin(ph) * Math.sin(th)), c: colr('#d0342c') });
    }
    const pomGeo = mergeGeos(pomParts);
    // sauce: copa colgante con cortinas de ramas
    const wilParts = [
      { g: new THREE.CylinderGeometry(0.22, 0.36, 4, 6).translate(0, 2, 0), c: colr('#6b4f2a') },
      { g: new THREE.IcosahedronGeometry(2.6, 1), m: new THREE.Matrix4().compose(new THREE.Vector3(0, 6.3, 0), new THREE.Quaternion(), new THREE.Vector3(1.25, 0.85, 1.25)), c: colr('#7fa04a') }
    ];
    for (let k = 0; k < 16; k++) {
      const a = k / 16 * Math.PI * 2 + rnd() * 0.2, rad = 2.5 + rnd() * 0.4;
      wilParts.push({ g: new THREE.BoxGeometry(0.12, 4.2, 0.12).translate(0, -2.1, 0),
        m: new THREE.Matrix4().compose(new THREE.Vector3(Math.cos(a) * rad, 6.0, Math.sin(a) * rad), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1)),
        c: colr('#a3b862') });
    }
    const wilGeo = mergeGeos(wilParts);
    // ciprés: cono alto y oscuro (color en el material; el color de instancia lo tiñe)
    const cypGeo = new THREE.ConeGeometry(1.7, 13, 8, 1).translate(0, 6.5, 0);
    // arbusto con flores (rojas, amarillas, blancas)
    const shrParts = [{ g: new THREE.IcosahedronGeometry(0.9, 0).translate(0, 0.7, 0), c: colr('#3e7430') }];
    const FLW = ['#d6322f', '#f0c23a', '#f4f1e6'];
    for (let k = 0; k < 3; k++) {
      const a = rnd() * Math.PI * 2, rad = rnd() * 0.75;
      shrParts.push({ g: new THREE.IcosahedronGeometry(0.22, 0).translate(Math.cos(a) * rad, 1.0 + rnd() * 0.3, Math.sin(a) * rad), c: colr(FLW[k % 3]) });
    }
    const shrGeo = mergeGeos(shrParts);

    // ---------- plantas: lista de elementos (se escriben en update según el crecimiento) ----------
    const cnt = { palm: 0, cyp: 0, pom: 0, shr: 0, wil: 0, vine: 0 };
    const items = [];
    const areaW = T.map(function (t, i) {
      return i < NT - 1 ? 4 * (t.hw * t.hw - T[i + 1].hw * T[i + 1].hw) : 4 * t.hw * t.hw;
    });
    const areaSum = areaW.reduce(function (a, b) { return a + b; }, 0);
    function pickTier() {
      let r = rnd() * areaSum;
      for (let i = 0; i < NT; i++) { r -= areaW[i]; if (r <= 0) return i; }
      return NT - 1;
    }
    // punto aleatorio sobre la cara superior de la terraza ti: anillo libre, fuera de la escalinata y del pabellón
    function topPoint(ti) {
      const t = T[ti];
      for (let k = 0; k < 60; k++) {
        const x = (rnd() * 2 - 1) * t.hw, z = (rnd() * 2 - 1) * t.hw;
        const ring = Math.max(Math.abs(x), Math.abs(z));
        if (ti < NT - 1 && ring < T[ti + 1].hw + 1.2) continue;
        if (ti === NT - 1 && ring < 9) continue;
        if (ti < NT - 1 && z > 0 && Math.abs(x) < 7.5) continue;
        return [x, z];
      }
      return null;
    }
    function addItem(sp, x, y, z, tier, sc) {
      items.push({ sp: sp, idx: cnt[sp]++, x: x, y: y, z: z, yaw: rnd() * Math.PI * 2, sc: sc, sy: 0,
        tier: tier, d: rnd() * 0.3, lean: (rnd() - 0.5) * 1.2, col: 0.86 + 0.28 * rnd() });
    }
    // [especie, n sobre terrazas, n en el suelo, escala min, escala max]
    const PLAN = [['palm', 56, 26, 0.9, 1.25], ['cyp', 50, 46, 0.8, 1.15], ['pom', 80, 12, 0.8, 1.15],
      ['wil', 16, 8, 0.9, 1.15], ['shr', 320, 110, 0.8, 1.2]];
    PLAN.forEach(function (pl) {
      const sp = pl[0];
      for (let k = 0; k < pl[1]; k++) {
        const ti = pickTier(), p = topPoint(ti);
        if (!p) continue;
        addItem(sp, p[0], T[ti].yt, p[1], ti, pl[3] + (pl[4] - pl[3]) * rnd());
      }
      const r0 = sp === 'shr' ? 62 : 66, r1 = sp === 'shr' ? 100 : 105;
      for (let k = 0; k < pl[2]; k++) {
        const a = rnd() * Math.PI * 2, r = r0 + rnd() * (r1 - r0);
        const x = Math.cos(a) * r, z = Math.sin(a) * r;
        if (z > 0 && Math.abs(x) < 9 && r < 80) continue;      // escalinata
        addItem(sp, x, 0, z, -1, pl[3] + (pl[4] - pl[3]) * rnd());
      }
    });
    // enredaderas: una cortina por cada arco, colgando de la cornisa de su terraza
    archInfo.forEach(function (a) {
      const t = T[a.tier];
      items.push({ sp: 'vine', idx: cnt.vine++, x: a.x + a.nx * 1.25, y: t.yt - 0.02, z: a.z + a.nz * 1.25, yaw: a.yaw,
        sc: 1, sy: t.yt - t.yb - 0.15, tier: a.tier, d: rnd() * 0.3, lean: 0, col: 1 });
    });

    // segunda hilera de cortinas entre arcos: la fachada queda cubierta casi por completo
    archInfo.forEach(function (a) {
      const t = T[a.tier], u2 = a.u + ARCH_STEP / 2;
      if (Math.abs(u2) > t.hw - 2) return;
      const tx = -a.nz, tz = a.nx;
      items.push({ sp: 'vine', idx: cnt.vine++, x: a.nx * (t.hw + 1.25) + tx * u2, y: t.yt - 0.02, z: a.nz * (t.hw + 1.25) + tz * u2,
        yaw: a.yaw, sc: 1, sy: t.yt - t.yb - 0.15, tier: a.tier, d: rnd() * 0.3, lean: 0, col: 1 });
    });

    // mallas principales (una por especie) y fantasma (mismas posiciones, siempre crecidas)
    const palmMesh = new THREE.InstancedMesh(palmGeo, palmMat, cnt.palm);
    const cypMesh = new THREE.InstancedMesh(cypGeo, cypMat, cnt.cyp);
    const pomMesh = new THREE.InstancedMesh(pomGeo, pomMat, cnt.pom);
    const wilMesh = new THREE.InstancedMesh(wilGeo, wilMat, cnt.wil);
    const shrMesh = new THREE.InstancedMesh(shrGeo, shrMat, cnt.shr);
    const vineGeo = new THREE.PlaneGeometry(3.4, 1, 2, 8).translate(0, -0.5, 0);
    const vineMesh = new THREE.InstancedMesh(vineGeo, vineMat, cnt.vine);
    const DRYG = { palm: palmGeo, cyp: cypGeo, pom: pomGeo, shr: shrGeo, wil: wilGeo, vine: vineGeo };
    const DRYATTR = {};
    Object.keys(DRYG).forEach(function (k) {
      DRYATTR[k] = new THREE.InstancedBufferAttribute(new Float32Array(cnt[k]), 1);
      DRYG[k].setAttribute('aDry', DRYATTR[k]);
    });
    const PM = { palm: palmMesh, cyp: cypMesh, pom: pomMesh, wil: wilMesh, shr: shrMesh, vine: vineMesh };
    palmMesh.castShadow = true; cypMesh.castShadow = true;
    Object.keys(PM).forEach(function (k) {
      PM[k].frustumCulled = false;
      root.add(PM[k]);
    });

    // ---------- cascadas (caen por cada cara) y canales en la cara norte de cada terraza ----------
    const waterMat = function (mode) {
      return new THREE.ShaderMaterial({
        uniforms: { uWall: uWallU, uAmt: { value: 0 }, uMode: { value: mode } },
        transparent: true, depthWrite: false, side: THREE.DoubleSide,
        vertexShader: 'varying vec2 vUv;\nvoid main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); }',
        fragmentShader: [
          'uniform float uWall; uniform float uAmt; uniform float uMode; varying vec2 vUv;',
          'void main() {',
          '  float ph = mix(vUv.y * 6.0 + uWall * 1.6, vUv.x * 10.0 - uWall * 1.2, uMode);',
          '  float across = mix(vUv.x, vUv.y, uMode);',
          '  float streak = 0.5 + 0.5 * sin(across * 38.0 + sin(ph * 1.7) * 1.2 + ph * 0.6);',
          '  float foam = (1.0 - uMode) * smoothstep(0.22, 0.0, vUv.y);',
          '  vec3 col = mix(vec3(0.10, 0.42, 0.52), vec3(0.55, 0.88, 0.92), streak * 0.55 + 0.1);',
          '  col = mix(col, vec3(0.92, 0.98, 1.0), foam * (0.5 + 0.5 * streak));',
          '  col += vec3(0.8, 0.95, 1.0) * pow(streak, 8.0) * 0.25;',
          '  gl_FragColor = vec4(col, 0.85 * uAmt);',
          '}'
        ].join('\n')
      });
    };
    const cascadeMat = waterMat(0), canalMat = waterMat(1);
    const CAS = [];
    GD.cascades.forEach(function (c) {
      const cx = c[0], cz = c[1];
      const nx = Math.abs(cx) >= Math.abs(cz) ? Math.sign(cx) : 0, nz = nx !== 0 ? 0 : Math.sign(cz);
      T.forEach(function (t) {
        const along = nx !== 0 ? cz * t.hw / HW0 : cx * t.hw / HW0;
        CAS.push({ tier: t.i, x: nx * (t.hw + 0.8) + (nx === 0 ? along : 0), y: t.yt, z: nz * (t.hw + 0.8) + (nz === 0 ? along : 0),
          yaw: Math.atan2(nx, nz), sy: t.yt - t.yb });
      });
    });
    const casGeo = new THREE.PlaneGeometry(3, 1, 3, 12).translate(0, -0.5, 0);
    const casMesh = new THREE.InstancedMesh(casGeo, cascadeMat, CAS.length);
    casMesh.frustumCulled = false;
    root.add(casMesh);
    const CANAL = T.map(function (t, i) {
      return i < NT - 1 ? { tier: i, x: 0, y: t.yt + 0.05, z: -(t.hw + T[i + 1].hw) / 2, len: 2 * t.hw - 6 }
        : { tier: i, x: 0, y: t.yt + 0.05, z: -14, len: 36 };
    });
    const canalGeo = new THREE.PlaneGeometry(1, 1, 1, 1).rotateX(-Math.PI / 2);
    const canalMesh = new THREE.InstancedMesh(canalGeo, canalMat, CANAL.length);
    canalMesh.frustumCulled = false;
    root.add(canalMesh);

    // ---------- pabellón en la terraza superior: columnas, toldo y remate ----------
    const pavParts = [{ g: new THREE.BoxGeometry(16, 0.6, 16).translate(0, 0.3, 0), c: colr('#d8c7a0') }];
    [[6, 6], [6, -6], [-6, 6], [-6, -6], [0, 6], [0, -6], [6, 0], [-6, 0]].forEach(function (p) {
      pavParts.push({ g: new THREE.CylinderGeometry(0.42, 0.5, 6, 10).translate(p[0], 3.6, p[1]), c: colr('#e6d6b0') });
    });
    pavParts.push({ g: new THREE.ConeGeometry(10.5, 3.2, 4, 1).rotateY(Math.PI / 4).translate(0, 8.2, 0), c: colr('#c2573a') });
    pavParts.push({ g: new THREE.SphereGeometry(0.35, 8, 6).translate(0, 10.0, 0), c: colr('#e0b257') });
    const pavMesh = new THREE.Mesh(mergeGeos(pavParts), pavMat);
    pavMesh.position.set(0, H, 0);
    pavMesh.castShadow = true; pavMesh.receiveShadow = true; pavMesh.visible = false;
    root.add(pavMesh);

    // ---------- fantasma: jardines completos translúcidos verde-dorados con aristas brillantes ----------
    const ghostTierGeo = mergeGeos(T.map(function (t) {
      return { g: new THREE.BoxGeometry(2 * t.hw, t.yt - t.yb, 2 * t.hw).translate(0, (t.yb + t.yt) / 2, 0) };
    }));
    const ghostMat = new THREE.MeshBasicMaterial({ color: 0xb9d96b, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
    const ghostPlantMat = new THREE.MeshBasicMaterial({ color: 0x8fd27a, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
    const ghostLineMat = new THREE.LineBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0, depthWrite: false });
    const ghostTier = new THREE.Mesh(ghostTierGeo, ghostMat);
    const ghostEdges = new THREE.LineSegments(new THREE.EdgesGeometry(ghostTierGeo, 30), ghostLineMat);
    ghostRoot.add(ghostTier); ghostRoot.add(ghostEdges);
    const GM = {
      palm: new THREE.InstancedMesh(palmGeo, ghostPlantMat, cnt.palm),
      cyp: new THREE.InstancedMesh(cypGeo, ghostPlantMat, cnt.cyp),
      pom: new THREE.InstancedMesh(pomGeo, ghostPlantMat, cnt.pom),
      wil: new THREE.InstancedMesh(wilGeo, ghostPlantMat, cnt.wil),
      shr: new THREE.InstancedMesh(shrGeo, ghostPlantMat, cnt.shr)
    };
    Object.keys(GM).forEach(function (k) { GM[k].frustumCulled = false; ghostRoot.add(GM[k]); });
    ghostRoot.visible = false;

    // ---------- escritura de plantas: crecimiento (g), ruina (dK) y terrazas construidas ----------
    const DRY = { palm: colr('#8a6230'), cyp: colr('#6a5a2a'), pom: colr('#8a6230'), shr: colr('#7a5a2c'), wil: colr('#9a8a40'), vine: colr('#7a5a24') };
    const tmpC = new THREE.Color();
    function writeAll(meshes, g, dK, builtMask, colored) {
      const dying = 1 - 0.45 * dK, dryK = clamp01(dK * 1.5);
      for (let k = 0; k < items.length; k++) {
        const it = items[k];
        const inst = meshes[it.sp];
        if (!inst) continue;
        const gi = smooth(clamp01((g - it.d) / 0.7));
        const vis = (it.tier < 0 || builtMask[it.tier]) ? 1 : 0;
        const sc = it.sc * gi * vis * dying;
        const sy = it.sy > 0 ? it.sy * gi * vis * dying : sc;
        _e.set(it.lean * dK * 1.5, it.yaw, 0, 'YXZ');
        _q.setFromEuler(_e);
        put(inst, it.idx, it.x, it.y, it.z, _q, sc, sy, sc);
        if (colored && DRYATTR[it.sp]) {
          const c = Math.min(1, it.col);
          tmpC.setRGB(c, c, c);
          inst.setColorAt(it.idx, tmpC);
          DRYATTR[it.sp].array[it.idx] = clamp01(dryK * (0.8 + 0.4 * (it.col - 0.86) / 0.28));
        }
      }
      Object.keys(meshes).forEach(function (k) {
        const inst = meshes[k];
        inst.instanceMatrix.needsUpdate = true;
        if (colored && inst.instanceColor) inst.instanceColor.needsUpdate = true;
        if (colored && DRYATTR[k]) DRYATTR[k].needsUpdate = true;
      });
    }
    const ALL_BUILT = []; for (let i = 0; i < NT; i++) ALL_BUILT.push(1);
    writeAll(GM, 1, 0, ALL_BUILT, false);      // fantasma: jardín completo, siempre

    // ---------- estado por frame ----------
    let lastPlantKey = '', lastRub = '', lastPar = '';
    function update(s) {
      const terr = clamp01(s.terraces || 0) * H;            // altura construida (m)
      const dK = clamp01(s.decay || 0);
      const xr = clamp01(s.xray || 0);
      const gh = clamp01(s.ghost || 0);
      const vp = clamp01(s.vaults || 0), sl = clamp01(s.soil || 0);
      const pl = Math.sqrt(clamp01(s.plants || 0)), cs = clamp01(s.cascades || 0);
      uWallU.value = s.wall || 0;

      // rayos X: terrazas, tierra y arcos translúcidos (opacidad 0.2, sin escribir profundidad)
      const xOn = xr > 0.001;
      [tierMat, darkMat, soilMat].forEach(function (m) {
        m.transparent = xOn; m.opacity = xOn ? 1 - 0.8 * xr : 1; m.depthWrite = !xOn;
      });

      // terrazas: se suben hilada a hilada (corte por altura); la ruina las baja
      const built = [];
      for (let i = 0; i < NT; i++) {
        const t = T[i];
        t.bh = clamp01((terr - t.yb) / (t.yt - t.yb)) * (t.yt - t.yb);
        const on = t.bh > 0.01;
        t.mesh.visible = on;
        const cut = on ? t.yb + t.bh * (1 - 0.55 * dK) : HIDE;
        if (cut !== t.cut) { t.cut = cut; t.cutAttr.array.fill(cut); t.cutAttr.needsUpdate = true; }
        t.mesh.castShadow = t.bh > t.yt - t.yb - 0.01;
        built.push(terr >= t.yt - 0.05 ? 1 : 0);
      }
      for (let i = 0; i < NT; i++) {
        setInstCut(frameCutAttr, archByTier[i], T[i].cut);
        setInstCut(darkCutAttr, archByTier[i], T[i].cut);
      }
      // escalinata: cada peldaño sigue el corte de su terraza
      for (let i = 0; i < NT; i++) {
        for (let k = 0; k < STEPS; k++) stairCut.array[i * STEPS + k] = T[i].cut;
      }
      stairCut.needsUpdate = true;

      // tierra: crece desde abajo sobre cada terraza ya construida
      soilMesh.visible = sl > 0.001;
      for (let i = 0; i < NT; i++) {
        const c = built[i] ? (T[i].yt - 0.5 + 0.5 * sl) : HIDE;
        for (let v = 0; v < soilVerts; v++) soilCut.array[i * soilVerts + v] = c;
      }
      soilCut.needsUpdate = true;

      // bóvedas de la base: hileras que se van cerrando desde el norte; con la ruina algunas se rompen
      vaultMesh.visible = vp > 0.001 || dK > 0.001;
      for (let k = 0; k < NVR; k++) {
        const f = clamp01(vp * NVR - k) * (1 - smooth(clamp01((dK - vaultRowBreak[k]) / 0.2)));
        put(vaultMesh, k, 0, 0, -HW0 + VR + k * VSP, null, 2 * HW0 * f, 1, 1);
      }
      vaultMesh.instanceMatrix.needsUpdate = true;

      // ruina: montículos de ladrillo que aparecen al caer las terrazas
      rubble.visible = dK > 0.001;
      const rk = dK.toFixed(3);
      if (rk !== lastRub) {
        lastRub = rk;
        rubItems.forEach(function (r, i) {
          if (dK > r.thr) put(rubble, i, r.x, r.y, r.z, yawQ(r.yaw), r.sx, r.sy, r.sz);
          else hideAt(rubble, i);
        });
        rubble.instanceMatrix.needsUpdate = true;
      }

      // parapetos y banda vidriada: siguen el corte de su terraza; la ruina los derriba
      const parCutOf = T.map(function (t, i) { return built[i] ? t.yt + PAR_H + 2.5 - 3.5 * dK : HIDE; });
      const pk = parCutOf.map(function (v) { return v.toFixed(2); }).join(',');
      if (pk !== lastPar) { lastPar = pk; setRangeCut(parCut, parRng, parCutOf); setRangeCut(glzCut, glzRng, parCutOf); }

      // plantas y enredaderas (solo cuando cambian crecimiento, ruina o terrazas)
      const pKey = pl.toFixed(3) + '|' + dK.toFixed(3) + '|' + built.join('');
      Object.keys(PM).forEach(function (k) { PM[k].visible = pl > 0.001 || dK > 0.001; });
      if (pKey !== lastPlantKey) {
        lastPlantKey = pKey;
        writeAll(PM, pl, dK, built, true);
      }

      // cascadas y canales: sólo sobre terrazas ya construidas
      const casOn = cs > 0.001;
      casMesh.visible = casOn; canalMesh.visible = casOn;
      cascadeMat.uniforms.uAmt.value = cs; canalMat.uniforms.uAmt.value = cs;
      for (let i = 0; i < CAS.length; i++) {
        const c = CAS[i], on = built[c.tier] ? cs : 0;
        put(casMesh, i, c.x, c.y, c.z, yawQ(c.yaw), 1, Math.max(0.0001, c.sy * on), 1);
      }
      casMesh.instanceMatrix.needsUpdate = true;
      for (let i = 0; i < CANAL.length; i++) {
        const c = CANAL[i], on = built[c.tier] ? cs : 0;
        put(canalMesh, i, c.x, c.y, c.z, null, Math.max(0.0001, c.len * on), 1, Math.max(0.0001, 1.4 * on));
      }
      canalMesh.instanceMatrix.needsUpdate = true;

      // pabellón: aparece con la última terraza y se viene abajo con la ruina
      pavMesh.visible = terr >= H - 0.05 && dK < 0.8;

      // fantasma (prólogo)
      ghostRoot.visible = gh > 0.001;
      ghostMat.opacity = 0.55 * gh;
      ghostPlantMat.opacity = 0.5 * gh;
      ghostLineMat.opacity = Math.min(1, 1.2 * gh);
    }

    return { update: update, group: root };
  };
})();
