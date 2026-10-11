// Interior de la cella del Templo de Zeus: suelo de losas, doble colonata dórica con galería superior,
// friso y artesonado pintados, lámparas de aceite, estanque de aceite y el armazón de madera del núcleo
// de la estatua (siguiendo ZEUS.joints) con su contorno cian cuando se activan los rayos X.
(function () {
  'use strict';
  const G = window.GIZA;

  G.createInterior = function (ctx) {
    const THREE = ctx.THREE, scene = ctx.scene, camera = ctx.camera, renderer = ctx.renderer;
    const TEMPLE = G.TEMPLE, ZEUS = G.ZEUS;
    const DEG = Math.PI / 180;
    const SRGB = THREE.sRGBEncoding;
    const ADD = THREE.AdditiveBlending;
    const CYAN = '#7fe3f0';

    const clamp = function (x, a, b) { return Math.max(a, Math.min(b, x)); };
    const clamp01 = function (x) { return clamp(x, 0, 1); };
    const smooth = function (x) { return x * x * (3 - 2 * x); };
    const V = function (x, y, z) { return new THREE.Vector3(x, y, z); };
    const Vj = function (a) { return V(a[0], a[1], a[2]); };
    const UP = V(0, 1, 0);
    const IDQ = new THREE.Quaternion();
    const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
    let seed = 41;
    const rnd = function () { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const pick = function (arr) { return arr[Math.floor(rnd() * arr.length) % arr.length]; };

    // ---------- medidas (mundo) ----------
    const NX0 = TEMPLE.naos.x0, NX1 = TEMPLE.naos.x1, NZ = TEMPLE.naos.halfZ;
    const FLOOR = TEMPLE.stylobateY;           // 1.5
    const CEIL = TEMPLE.ceilingY;              // 15.4
    const IC = TEMPLE.innerCols;
    const ZC = IC.z;                           // 4.6: fila de columnas
    const COL_X = [];
    for (let i = 0; i < IC.count; i++) COL_X.push(IC.xFrom + (IC.xTo - IC.xFrom) * i / (IC.count - 1));
    const LOW_H = IC.lowerH, UP_H = IC.upperH;
    const ARCH_LO = FLOOR + LOW_H;             // 7.7: techo de la columna inferior
    const UP_BASE = ARCH_LO + 0.8;             // 8.5: suelo de la galería
    const UP_TOP = UP_BASE + UP_H;             // 13.1
    const FRIEZE_TOP = UP_TOP + 0.8;           // 13.9
    const CX = (NX0 + NX1) / 2, CW = NX1 - NX0;
    const POOL = ZEUS.pool;                    // x0 -6, x1 1, halfZ 3.3, y 1.52
    const ORIG = V(ZEUS.origin[0], ZEUS.origin[1], ZEUS.origin[2]);

    // ---------- utilidades de textura y geometría ----------
    function tex(w, h, draw, rx, ry) {
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      draw(cv.getContext('2d'), w, h);
      const t = new THREE.CanvasTexture(cv);
      t.encoding = SRGB;
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(rx || 1, ry || 1);
      t.anisotropy = 4;
      return t;
    }
    function speckle(g, w, h, n, col, a) {
      for (let i = 0; i < n; i++) {
        g.globalAlpha = a * (0.3 + 0.7 * rnd());
        g.fillStyle = col;
        g.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2, 1 + rnd() * 2);
      }
      g.globalAlpha = 1;
    }
    function mergeGeos(list) {
      const parts = list.map(function (g) { return g.index ? g.toNonIndexed() : g; });
      let count = 0;
      parts.forEach(function (p) { count += p.attributes.position.count; });
      const pos = new Float32Array(count * 3), nor = new Float32Array(count * 3), uvs = new Float32Array(count * 2);
      let o = 0;
      parts.forEach(function (p) {
        pos.set(p.attributes.position.array, o * 3);
        nor.set(p.attributes.normal.array, o * 3);
        uvs.set(p.attributes.uv.array, o * 2);
        o += p.attributes.position.count;
      });
      const out = new THREE.BufferGeometry();
      out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      out.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
      return out;
    }
    function boxAt(x0, x1, y0, y1, z0, z1) {
      return new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0).translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    }
    function cylBetween(a, b, r, seg) {
      const d = new THREE.Vector3().subVectors(b, a), L = d.length();
      const g = new THREE.CylinderGeometry(r, r, L, seg || 6, 1);
      const q = new THREE.Quaternion().setFromUnitVectors(UP, d.clone().normalize());
      const m = new THREE.Matrix4().compose(new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1));
      return g.applyMatrix4(m);
    }
    // fuste acanalado (20 estrías) con éntasis; base en y=0, altura h
    function fluted(rTop, rBot, h) {
      const g = new THREE.CylinderGeometry(rTop, rBot, h, 120, 6, false).translate(0, h / 2, 0);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        if (Math.hypot(x, z) < 1e-6) continue;
        const th = Math.atan2(z, x);
        const f = (1 - 0.045 * (0.5 + 0.5 * Math.cos(20 * th))) * (1 + 0.025 * Math.sin(Math.PI * clamp01(y / h)));
        p.setXYZ(i, x * f, y, z * f);
      }
      g.computeVertexNormals();
      return g;
    }
    function inst(geo, mat, mats) {
      const m = new THREE.InstancedMesh(geo, mat, mats.length);
      m.frustumCulled = false;
      mats.forEach(function (mm, i) { m.setMatrixAt(i, mm); });
      m.instanceMatrix.needsUpdate = true;
      return m;
    }

    // ---------- texturas (dibujadas por código) ----------
    const floorTex = tex(512, 512, function (g, w, h) {
      const tones = ['#eae0c9', '#e3d7bc', '#ede5d1', '#dccfb3'];
      for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
        g.fillStyle = pick(tones); g.fillRect(i * 256, j * 256, 256, 256);
      }
      g.strokeStyle = 'rgba(110,90,62,0.45)'; g.lineWidth = 3;
      for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) g.strokeRect(i * 256 + 1.5, j * 256 + 1.5, 253, 253);
      speckle(g, w, h, 2600, '#7d6a4c', 0.16);
    }, CW / 2, 14.8 / 2);
    const stoneTex = tex(512, 512, function (g, w, h) {
      g.fillStyle = '#f0e8d8'; g.fillRect(0, 0, w, h);
      g.strokeStyle = 'rgba(120,100,70,0.28)'; g.lineWidth = 2;
      for (let row = 0; row < 4; row++) {
        const y = row * 128; g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke();
        for (let c = 0; c < 4; c++) {
          const x = c * 128 + (row % 2) * 64;
          g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 128); g.stroke();
        }
      }
      speckle(g, w, h, 1800, '#8c7a5c', 0.14);
    });
    const marbleTex = tex(512, 512, function (g, w, h) {
      g.fillStyle = '#efe6d6'; g.fillRect(0, 0, w, h);
      for (let k = 0; k < 16; k++) {
        g.strokeStyle = 'rgba(140,120,96,' + (0.1 + rnd() * 0.16).toFixed(3) + ')';
        g.lineWidth = 0.8 + rnd() * 2.2;
        let x = rnd() * w, y = rnd() * h;
        g.beginPath(); g.moveTo(x, y);
        for (let s = 0; s < 5; s++) {
          const nx = x + (rnd() - 0.5) * 220, ny = y + 40 + rnd() * 80;
          g.quadraticCurveTo(x + (rnd() - 0.5) * 120, y + 30, nx, ny);
          x = nx; y = ny;
        }
        g.stroke();
      }
      speckle(g, w, h, 900, '#a8977a', 0.1);
    });
    const blackTex = tex(256, 256, function (g, w, h) {
      g.fillStyle = '#1b1b1e'; g.fillRect(0, 0, w, h);
      speckle(g, w, h, 500, '#6a6a74', 0.35);
      speckle(g, w, h, 200, '#3a3a40', 0.5);
    });
    const woodTex = tex(256, 256, function (g, w, h) {
      g.fillStyle = '#f4f1ea'; g.fillRect(0, 0, w, h);
      for (let k = 0; k < 90; k++) {
        const x0 = rnd() * w, a = 0.05 + rnd() * 0.2;
        g.strokeStyle = rnd() < 0.6 ? 'rgba(110,70,35,' + a.toFixed(3) + ')' : 'rgba(255,255,255,' + a.toFixed(3) + ')';
        g.lineWidth = 0.5 + rnd() * 2.2;
        g.beginPath(); g.moveTo(x0, 0);
        for (let y = 0; y <= h; y += 16) g.lineTo(x0 + Math.sin(y * 0.02 + k) * 3 + (rnd() - 0.5) * 1.5, y);
        g.stroke();
      }
      for (let k = 0; k < 5; k++) {
        const nx = rnd() * w, ny = rnd() * h;
        const gr = g.createRadialGradient(nx, ny, 1, nx, ny, 10 + rnd() * 8);
        gr.addColorStop(0, 'rgba(90,55,25,0.45)'); gr.addColorStop(1, 'rgba(90,55,25,0)');
        g.fillStyle = gr; g.fillRect(0, 0, w, h);
      }
    });
    const cofferTex = tex(1024, 512, function (g, w, h) {
      g.fillStyle = '#1d3d74'; g.fillRect(0, 0, w, h);
      const cols = 6, rows = 3, cw = w / cols, ch = h / rows, m = 14;
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
        const x = i * cw, y = j * ch;
        g.fillStyle = '#244a82'; g.fillRect(x + m, y + m, cw - 2 * m, ch - 2 * m);
        g.strokeStyle = '#c9a33a'; g.lineWidth = 6; g.strokeRect(x + m, y + m, cw - 2 * m, ch - 2 * m);
        g.strokeStyle = 'rgba(201,163,58,0.6)'; g.lineWidth = 2; g.strokeRect(x + m + 14, y + m + 14, cw - 2 * m - 28, ch - 2 * m - 28);
        const cx = x + cw / 2, cy = y + ch / 2;
        const gr = g.createRadialGradient(cx, cy, 4, cx, cy, cw * 0.26);
        gr.addColorStop(0, '#f2d27a'); gr.addColorStop(1, '#8a6320');
        g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, cw * 0.24, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#b8862e';
        for (let k = 0; k < 8; k++) {
          const a = k / 8 * Math.PI * 2;
          g.beginPath(); g.arc(cx + Math.cos(a) * cw * 0.33, cy + Math.sin(a) * cw * 0.33, cw * 0.035, 0, Math.PI * 2); g.fill();
        }
      }
      speckle(g, w, h, 700, '#0d2246', 0.2);
    });
    const friezeTex = tex(1024, 64, function (g, w, h) {
      g.fillStyle = '#1d3d74'; g.fillRect(0, 0, w, h);
      g.strokeStyle = '#d4a63c'; g.lineWidth = 5; g.lineCap = 'square';
      const cell = 64;
      for (let x = 0; x < w; x += cell) {
        g.beginPath();
        g.moveTo(x + 6, h - 6); g.lineTo(x + 6, 6); g.lineTo(x + cell - 6, 6);
        g.lineTo(x + cell - 6, h * 0.62); g.lineTo(x + cell * 0.5 + 6, h * 0.62);
        g.lineTo(x + cell * 0.5 + 6, h * 0.3); g.lineTo(x + cell * 0.5 - 6, h * 0.3);
        g.stroke();
      }
    });
    const flameTex = tex(128, 128, function (g, w, h) {
      const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      gr.addColorStop(0, 'rgba(255,244,210,1)');
      gr.addColorStop(0.25, 'rgba(255,190,90,0.9)');
      gr.addColorStop(0.6, 'rgba(255,110,30,0.25)');
      gr.addColorStop(1, 'rgba(255,80,0,0)');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    });

    // ---------- entorno para reflejos (cielo degradado + PMREM) ----------
    const envTex = (function () {
      const es = new THREE.Scene();
      const geo = new THREE.SphereGeometry(100, 32, 16);
      const pos = geo.attributes.position, cols = [];
      const top = new THREE.Color(0xfff1d6), mid = new THREE.Color(0xc89a5a), bot = new THREE.Color(0x2a1d14);
      const c = new THREE.Color();
      for (let i = 0; i < pos.count; i++) {
        const y = pos.getY(i) / 100;
        if (y > 0) c.copy(mid).lerp(top, Math.pow(y, 0.7));
        else c.copy(mid).lerp(bot, Math.min(1, -y * 1.5));
        cols.push(c.r, c.g, c.b);
      }
      geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
      es.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
      const pm = new THREE.PMREMGenerator(renderer);
      const rt = pm.fromScene(es, 0.02, 1, 300);
      pm.dispose();
      return rt.texture;
    })();

    // ---------- materiales ----------
    const wallU = { value: 0 };
    const M = {
      floor: new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.85, metalness: 0 }),
      stone: new THREE.MeshStandardMaterial({ map: stoneTex, color: 0xf2e9d6, roughness: 0.85, metalness: 0 }),
      marble: new THREE.MeshStandardMaterial({ map: marbleTex, roughness: 0.3, metalness: 0.02, envMap: envTex, envMapIntensity: 0.6 }),
      black: new THREE.MeshStandardMaterial({ map: blackTex, roughness: 0.18, metalness: 0.25, envMap: envTex, envMapIntensity: 0.8 }),
      ceiling: new THREE.MeshStandardMaterial({ map: cofferTex, roughness: 0.6, metalness: 0, side: THREE.DoubleSide }),
      frieze: new THREE.MeshStandardMaterial({ map: friezeTex, roughness: 0.6, metalness: 0, side: THREE.DoubleSide }),
      brass: new THREE.MeshStandardMaterial({ color: 0x9a6b2b, roughness: 0.35, metalness: 0.8, envMap: envTex }),
      wood: new THREE.MeshStandardMaterial({ map: woodTex, color: 0xb98c5a, roughness: 0.75, metalness: 0 }),
      oil: new THREE.MeshStandardMaterial({ color: 0xc9a33a, roughness: 0.05, metalness: 0, transparent: true, opacity: 0, depthWrite: false, envMap: envTex, envMapIntensity: 1.2 }),
      flame: new THREE.PointsMaterial({ map: flameTex, color: 0xffd08a, size: 1.1, sizeAttenuation: true, transparent: true, opacity: 0.9, blending: ADD, depthWrite: false }),
      contour: new THREE.LineBasicMaterial({ color: CYAN, transparent: true, opacity: 0, blending: ADD, depthWrite: false })
    };
    // ondulación suave del aceite: desplazamiento en el vértice con uniform (sin reconstruir geometría)
    M.oil.onBeforeCompile = function (sh) {
      sh.uniforms.uWall = wallU;
      sh.vertexShader = 'uniform float uWall;\n' + sh.vertexShader.replace('#include <begin_vertex>',
        '#include <begin_vertex>\n transformed.y += 0.012 * sin(position.x * 1.9 + uWall * 1.4) + 0.009 * sin(position.z * 2.7 - uWall * 1.0);');
    };
    M.oil.customProgramCacheKey = function () { return 'zeusOilRipple'; };

    // ---------- cella: suelo, techo, friso, galerías y arquitrabes (estáticos, fusionados) ----------
    const cellaRoot = new THREE.Group(); scene.add(cellaRoot);
    const floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(CW, NZ * 2).rotateX(-Math.PI / 2).translate(CX, FLOOR + 0.005, 0), M.floor);
    const ceilMesh = new THREE.Mesh(new THREE.PlaneGeometry(CW, NZ * 2).rotateX(Math.PI / 2).translate(CX, CEIL, 0), M.ceiling);
    const friezeZ = NZ - 0.05, friezeH = CEIL - FRIEZE_TOP;
    const friezeMesh = new THREE.Mesh(mergeGeos([
      new THREE.PlaneGeometry(CW, friezeH).translate(CX, FRIEZE_TOP + friezeH / 2, friezeZ),
      new THREE.PlaneGeometry(CW, friezeH).translate(CX, FRIEZE_TOP + friezeH / 2, -friezeZ)
    ]), M.frieze);
    const archGeos = [];
    const xa0 = COL_X[0] - 0.9, xa1 = COL_X[COL_X.length - 1] + 0.9;
    [-1, 1].forEach(function (sg) {
      const z = sg * ZC;
      archGeos.push(boxAt(xa0, xa1, ARCH_LO, UP_BASE, z - 0.7, z + 0.7));          // arquitrabe inferior
      archGeos.push(boxAt(xa0, xa1, UP_TOP, FRIEZE_TOP, z - 0.6, z + 0.6));       // arquitrabe superior
      // suelo de la galería superior (entre la colonata y el muro)
      const zi = sg > 0 ? ZC + 0.7 : -NZ, zo = sg > 0 ? NZ : -ZC - 0.7;
      archGeos.push(boxAt(NX0, NX1, UP_BASE - 0.2, UP_BASE, zi, zo));
    });
    const archMesh = new THREE.Mesh(mergeGeos(archGeos), M.stone);

    // estanque de aceite: piso de piedra negra, borde de mármol y aceite
    const pCX = (POOL.x0 + POOL.x1) / 2, pW = POOL.x1 - POOL.x0, pHZ = POOL.halfZ, pY = POOL.y;
    const blackMesh = new THREE.Mesh(boxAt(POOL.x0, POOL.x1, FLOOR - 0.1, pY, -pHZ, pHZ), M.black);
    const rimW = 0.4, rimTop = FLOOR + 0.22;
    const rimMesh = new THREE.Mesh(mergeGeos([
      boxAt(POOL.x0 - rimW, POOL.x1 + rimW, FLOOR, rimTop, pHZ, pHZ + rimW),
      boxAt(POOL.x0 - rimW, POOL.x1 + rimW, FLOOR, rimTop, -pHZ - rimW, -pHZ),
      boxAt(POOL.x0 - rimW, POOL.x0, FLOOR, rimTop, -pHZ, pHZ),
      boxAt(POOL.x1, POOL.x1 + rimW, FLOOR, rimTop, -pHZ, pHZ)
    ]), M.marble);
    const oilGeo = new THREE.PlaneGeometry(pW, pHZ * 2, 28, 14).rotateX(-Math.PI / 2);
    const oilMesh = new THREE.Mesh(oilGeo, M.oil);
    oilMesh.visible = false;
    oilMesh.renderOrder = 2;

    // columnas: fustes, equinos y ábacos (instanciados para poder ocultarlas cerca de la cámara)
    const COLXZ = [];
    [-1, 1].forEach(function (sg) { COL_X.forEach(function (x) { COLXZ.push({ x: x, z: sg * ZC }); }); });
    const NC = COLXZ.length;
    const LOW_M = COLXZ.map(function (c) { return new THREE.Matrix4().makeTranslation(c.x, FLOOR, c.z); });
    const UP_M = COLXZ.map(function (c) { return new THREE.Matrix4().makeTranslation(c.x, UP_BASE, c.z); });
    const LOW_SH = LOW_H - 0.6, UP_SH = UP_H - 0.6;
    const lowCapGeo = mergeGeos([
      new THREE.CylinderGeometry(0.72, 0.5, 0.3, 24, 1).translate(0, LOW_SH + 0.15, 0),
      new THREE.BoxGeometry(1.5, 0.3, 1.5).translate(0, LOW_SH + 0.45, 0)
    ]);
    const upCapGeo = mergeGeos([
      new THREE.CylinderGeometry(0.6, 0.45, 0.3, 24, 1).translate(0, UP_SH + 0.15, 0),
      new THREE.BoxGeometry(1.2, 0.3, 1.2).translate(0, UP_SH + 0.45, 0)
    ]);
    const lowShaft = inst(fluted(0.46, 0.55, LOW_SH), M.stone, LOW_M);
    const lowCap = inst(lowCapGeo, M.stone, LOW_M);
    const upShaft = inst(fluted(0.4, 0.48, UP_SH), M.stone, UP_M);
    const upCap = inst(upCapGeo, M.stone, UP_M);
    const colMeshes = [lowShaft, lowCap, upShaft, upCap];
    colMeshes.forEach(function (m) { cellaRoot.add(m); });
    const colHidden = new Uint8Array(NC);
    function cullColumns() {
      const cx = camera.position.x, cz = camera.position.z;
      let changed = false;
      for (let i = 0; i < NC; i++) {
        const c = COLXZ[i];
        const hide = Math.hypot(cx - c.x, cz - c.z) < 1.5 ? 1 : 0;
        if (hide === colHidden[i]) continue;
        colHidden[i] = hide; changed = true;
        lowShaft.setMatrixAt(i, hide ? ZERO : LOW_M[i]);
        lowCap.setMatrixAt(i, hide ? ZERO : LOW_M[i]);
        upShaft.setMatrixAt(i, hide ? ZERO : UP_M[i]);
        upCap.setMatrixAt(i, hide ? ZERO : UP_M[i]);
      }
      if (changed) colMeshes.forEach(function (m) { m.instanceMatrix.needsUpdate = true; });
    }

    // lámparas de aceite colgantes y en trípodes (bronce + llamas que parpadean)
    const bowlPts = [[0.0, 0.0], [0.12, 0.02], [0.3, 0.08], [0.36, 0.16], [0.3, 0.26], [0.14, 0.22], [0.0, 0.2]]
      .map(function (p) { return new THREE.Vector2(p[0], p[1]); });
    const brassParts = [];
    const HANG = [[-5.5, 12.6, 0.0], [3.0, 12.6, -2.3], [3.0, 12.6, 2.3]];
    const TRIPOD = [[-6.5, -6.2], [-6.5, 6.2], [6.0, -6.2], [6.0, 6.2]];
    const FLAME_BASE = [];
    HANG.forEach(function (h) {
      brassParts.push(cylBetween(V(h[0], CEIL, h[2]), V(h[0], h[1] + 0.25, h[2]), 0.03, 5));
      brassParts.push(new THREE.LatheGeometry(bowlPts, 20).translate(h[0], h[1], h[2]));
      FLAME_BASE.push(V(h[0], h[1] + 0.34, h[2]));
    });
    TRIPOD.forEach(function (t) {
      const x = t[0], z = t[1], topY = FLOOR + 2.0;
      brassParts.push(cylBetween(V(x, FLOOR, z), V(x, topY, z), 0.05, 6));
      for (let k = 0; k < 3; k++) {
        const a = k / 3 * Math.PI * 2 + 0.4;
        brassParts.push(cylBetween(V(x, topY - 0.7, z), V(x + Math.cos(a) * 0.6, FLOOR, z + Math.sin(a) * 0.6), 0.03, 5));
      }
      brassParts.push(new THREE.LatheGeometry(bowlPts, 20).translate(x, topY, z));
      FLAME_BASE.push(V(x, topY + 0.34, z));
    });
    const brassMesh = new THREE.Mesh(mergeGeos(brassParts), M.brass);
    const flamePos = new Float32Array(FLAME_BASE.length * 3);
    FLAME_BASE.forEach(function (p, i) { flamePos[i * 3] = p.x; flamePos[i * 3 + 1] = p.y; flamePos[i * 3 + 2] = p.z; });
    const flameGeo = new THREE.BufferGeometry();
    flameGeo.setAttribute('position', new THREE.BufferAttribute(flamePos, 3));
    const flamePts = new THREE.Points(flameGeo, M.flame);
    flamePts.frustumCulled = false;

    // luces cálidas (máx. 3) dentro de la cella
    const LIGHT_DEF = [[-6.0, 11.2, 0.0, 1.7], [2.6, 10.6, -3.0, 0.9], [2.6, 10.6, 3.0, 0.9]];
    const lights = LIGHT_DEF.map(function (l) {
      const pl = new THREE.PointLight(0xffc27a, 0, 26, 1.3);
      pl.position.set(l[0], l[1], l[2]);
      cellaRoot.add(pl);
      return { light: pl, base: l[3] };
    });

    [floorMesh, ceilMesh, friezeMesh, archMesh, blackMesh, rimMesh, oilMesh, brassMesh, flamePts].forEach(function (m) {
      cellaRoot.add(m);
    });

    // ---------- núcleo de madera: armazón siguiendo la silueta (ZEUS.joints) ----------
    const coreRoot = new THREE.Group(); coreRoot.position.copy(ORIG); scene.add(coreRoot);
    const J = ZEUS.joints, T = ZEUS.throne, HC = Vj(J.head), HR = ZEUS.radii.head;
    const CORE_TOP = Math.max(T.backTop, HC.y + HR) + 0.2;
    const BEAMS = [], PLANKS = [], NODES = [];

    // Viga de sección cuadrada (lado w) entre a y b
    function beam(a, b, w) { BEAMS.push({ a: a.clone(), b: b.clone(), w: w }); }
    // Aro (travesaño) de cuatro vigas alrededor de P, perpendicular a d; ru/rv = semilados
    function frameOf(d) {
      const ref = Math.abs(d.y) > 0.85 ? V(1, 0, 0) : UP;
      const s = new THREE.Vector3().crossVectors(d, ref).normalize();
      const v = new THREE.Vector3().crossVectors(s, d).normalize();
      return { s: s, v: v };
    }
    function ringPts(P, d, ru, rv) {
      const f = frameOf(d);
      return [
        P.clone().addScaledVector(f.s, ru).addScaledVector(f.v, rv),
        P.clone().addScaledVector(f.s, -ru).addScaledVector(f.v, rv),
        P.clone().addScaledVector(f.s, -ru).addScaledVector(f.v, -rv),
        P.clone().addScaledVector(f.s, ru).addScaledVector(f.v, -rv)
      ];
    }
    // Miembro de armazón entre A y B: aros cada ~step m y largueros entre aros; rf(u) -> [ru, rv]
    function lattice(A, B, rf, w, step) {
      const L = A.distanceTo(B), n = Math.max(1, Math.round(L / (step || 1.4)));
      const d = B.clone().sub(A).normalize();
      let prev = null;
      for (let k = 0; k <= n; k++) {
        const u = k / n, P = A.clone().lerp(B, u), r = rf(u);
        const C = ringPts(P, d, r[0], r[1]);
        for (let i = 0; i < 4; i++) {
          beam(C[i], C[(i + 1) % 4], w);
          NODES.push({ p: C[i], d: C[i].clone().sub(P).normalize() });   // clavija en el nudo
        }
        if (prev) for (let i = 0; i < 4; i++) beam(prev[i], C[i], w * 0.85);
        prev = C;
      }
    }
    function plank(x0, x1, y0, y1, z0, z1) { PLANKS.push({ x0: x0, x1: x1, y0: y0, y1: y1, z0: z0, z1: z1 }); }

    // torso: pelvis -> pecho -> cuello (sección elíptica: 1.6 m de ancho, 1.0 de fondo)
    lattice(Vj(J.pelvis), Vj(J.chest), function (u) { return [1.6 - 0.1 * u, 1.0]; }, 0.2, 1.4);
    lattice(Vj(J.chest), Vj(J.neck), function (u) { return [1.45 - 0.25 * u, 0.9]; }, 0.18, 1.2);
    beam(Vj(J.lHip), Vj(J.rHip), 0.26);          // travesaño de la cadera
    beam(Vj(J.lShoulder), Vj(J.rShoulder), 0.26); // travesaño de los hombros
    // cuello y cabeza (esfera con aros en tres alturas)
    lattice(Vj(J.neck), V(HC.x, HC.y - 0.6 * HR, HC.z), function () { return [0.42, 0.42]; }, 0.14, 1.0);
    lattice(V(HC.x, HC.y - 0.8 * HR, HC.z), V(HC.x, HC.y + 0.8 * HR, HC.z), function (u) {
      const y = (HC.y - 0.8 * HR) + 1.6 * HR * u, dy = y - HC.y;
      const r = Math.sqrt(Math.max(0.01, HR * HR - dy * dy)) - 0.18;
      return [r, r];
    }, 0.1, 0.45);
    // piernas sentadas (muslo, pantorrilla) y brazos (brazo, antebrazo)
    ['l', 'r'].forEach(function (sd) {
      lattice(Vj(J[sd + 'Hip']), Vj(J[sd + 'Knee']), function () { return [0.6, 0.6]; }, 0.2, 1.4);
      lattice(Vj(J[sd + 'Knee']), Vj(J[sd + 'Foot']), function () { return [0.45, 0.45]; }, 0.16, 1.4);
      lattice(Vj(J[sd + 'Shoulder']), Vj(J[sd + 'Elbow']), function () { return [0.42, 0.42]; }, 0.16, 1.2);
      lattice(Vj(J[sd + 'Elbow']), Vj(J[sd + 'Hand']), function () { return [0.32, 0.32]; }, 0.14, 1.2);
    });
    // armazón del trono: patas, asiento, respaldo con travesaños, brazos y reposapiés
    const sx0 = T.seat[0], sx1 = T.seat[1], sy0 = T.seat[2], sy1 = T.seat[3], hz = T.halfZ;
    const bxA = -2.3, armY = T.armY;
    function seatRect(y) {
      const p = [V(sx0, y, -hz), V(sx1, y, -hz), V(sx1, y, hz), V(sx0, y, hz)];
      for (let i = 0; i < 4; i++) beam(p[i], p[(i + 1) % 4], 0.22);
    }
    seatRect(sy0 + 0.1); seatRect(sy1 - 0.25);
    [sx0 + 0.25, sx1 - 0.25].forEach(function (x) {
      [-hz + 0.25, hz - 0.25].forEach(function (z) { beam(V(x, 0, z), V(x, sy0, z), 0.24); });
    });
    plank(sx0 + 0.1, sx1 - 0.1, sy1 - 0.3, sy1 - 0.05, -hz + 0.1, hz - 0.1);           // asiento
    [-hz + 0.25, hz - 0.25].forEach(function (z) { beam(V(bxA, sy1, z), V(bxA, T.backTop, z), 0.24); });
    [5.2, 8.0, 10.6].forEach(function (y) { beam(V(bxA, y, -hz + 0.25), V(bxA, y, hz - 0.25), 0.2); });
    beam(V(bxA, T.backTop, -hz + 0.25), V(bxA, T.backTop, hz - 0.25), 0.26);
    [-hz + 0.2, hz - 0.2].forEach(function (z) {
      beam(V(sx0 + 0.2, armY, z), V(sx1 - 0.5, armY, z), 0.24);
      beam(V(sx1 - 0.5, sy1, z), V(sx1 - 0.5, armY, z), 0.22);
      beam(V(T.backX[1], sy1, z), V(T.backX[1], armY, z), 0.22);
    });
    const FS = ZEUS.footstool;
    plank(FS.x0, FS.x1, 0, FS.y1, -FS.halfZ, FS.halfZ);

    // mallas instanciadas del núcleo
    const beamMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), M.wood, BEAMS.length);
    const plankMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), M.wood, Math.max(1, PLANKS.length));
    const dowelMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.045, 0.045, 0.26, 6), M.wood, Math.max(1, NODES.length));
    beamMesh.frustumCulled = plankMesh.frustumCulled = dowelMesh.frustumCulled = false;
    const DOWEL_M = NODES.map(function (n) {
      return new THREE.Matrix4().compose(n.p, new THREE.Quaternion().setFromUnitVectors(UP, n.d), V(1, 1, 1));
    });
    DOWEL_M.forEach(function (m, i) { dowelMesh.setMatrixAt(i, m); });
    dowelMesh.instanceMatrix.needsUpdate = true;
    const cPos = new Float32Array(BEAMS.length * 6);
    const contourGeo = new THREE.BufferGeometry();
    contourGeo.setAttribute('position', new THREE.BufferAttribute(cPos, 3));
    const contour = new THREE.LineSegments(contourGeo, M.contour);
    contour.frustumCulled = false;
    coreRoot.add(beamMesh, plankMesh, dowelMesh, contour);

    const _cl = V(0, 0, 0), _ch = V(0, 0, 0), _dv = V(0, 0, 0), _mid = V(0, 0, 0), _sc = V(1, 1, 1);
    const _q = new THREE.Quaternion(), _m = new THREE.Matrix4();
    // Recorta la viga a la altura H (solo la parte por debajo de H) y fija su matriz y su contorno
    function setBeam(i, H) {
      const B = BEAMS[i];
      let lo = B.a, hi = B.b;
      if (lo.y > hi.y) { lo = B.b; hi = B.a; }
      const o = i * 6;
      if (lo.y > H) {
        beamMesh.setMatrixAt(i, ZERO); cPos.fill(0, o, o + 6); return;
      }
      _cl.copy(lo);
      if (hi.y <= H) _ch.copy(hi); else _ch.copy(lo).lerp(hi, (H - lo.y) / (hi.y - lo.y));
      _dv.subVectors(_ch, _cl);
      const len = _dv.length();
      if (len < 1e-3) { beamMesh.setMatrixAt(i, ZERO); cPos.fill(0, o, o + 6); return; }
      _dv.multiplyScalar(1 / len);
      _mid.addVectors(_cl, _ch).multiplyScalar(0.5);
      _q.setFromUnitVectors(UP, _dv);
      _sc.set(B.w, len, B.w);
      _m.compose(_mid, _q, _sc);
      beamMesh.setMatrixAt(i, _m);
      cPos[o] = _cl.x; cPos[o + 1] = _cl.y; cPos[o + 2] = _cl.z;
      cPos[o + 3] = _ch.x; cPos[o + 4] = _ch.y; cPos[o + 5] = _ch.z;
    }
    let lastH = -1;
    function setCore(H) {
      for (let i = 0; i < BEAMS.length; i++) setBeam(i, H);
      beamMesh.instanceMatrix.needsUpdate = true;
      contourGeo.attributes.position.needsUpdate = true;
      for (let i = 0; i < PLANKS.length; i++) {
        const p = PLANKS[i], top = Math.min(p.y1, H);
        if (top <= p.y0 + 1e-4) { plankMesh.setMatrixAt(i, ZERO); continue; }
        _m.compose(V((p.x0 + p.x1) / 2, (p.y0 + top) / 2, (p.z0 + p.z1) / 2), IDQ, V(p.x1 - p.x0, top - p.y0, p.z1 - p.z0));
        plankMesh.setMatrixAt(i, _m);
      }
      plankMesh.instanceMatrix.needsUpdate = true;
      for (let i = 0; i < NODES.length; i++) dowelMesh.setMatrixAt(i, NODES[i].p.y <= H ? DOWEL_M[i] : ZERO);
      dowelMesh.instanceMatrix.needsUpdate = true;
    }

    // ---------- etiquetas (Sprite + CanvasTexture, en español) ----------
    const labelGroup = new THREE.Group(); scene.add(labelGroup);
    const labels = [];
    const CEN = V(ORIG.x - 1, ORIG.y + 6, ORIG.z);
    function makeCanvas(text, sub, color) {
      const cv = document.createElement('canvas');
      const c = cv.getContext('2d');
      c.font = 'bold 44px Georgia, serif';
      const w1 = c.measureText(text).width;
      c.font = '26px "Courier New", monospace';
      const w2 = sub ? c.measureText(sub).width : 0;
      cv.width = Math.ceil(Math.max(w1, w2) + 52);
      cv.height = sub ? 118 : 84;
      const g = cv.getContext('2d');
      g.fillStyle = 'rgba(4,12,16,0.74)';
      g.fillRect(0, 0, cv.width, cv.height);
      g.strokeStyle = color; g.lineWidth = 3;
      g.strokeRect(1.5, 1.5, cv.width - 3, cv.height - 3);
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = color;
      g.font = 'bold 44px Georgia, serif';
      g.fillText(text, cv.width / 2, sub ? 40 : cv.height / 2);
      if (sub) {
        g.font = '26px "Courier New", monospace';
        g.fillStyle = 'rgba(230,240,245,0.92)';
        g.fillText(sub, cv.width / 2, 86);
      }
      const t = new THREE.CanvasTexture(cv);
      t.encoding = SRGB;
      t.minFilter = THREE.LinearFilter;
      t.generateMipmaps = false;
      return { tex: t, aspect: cv.width / cv.height };
    }
    // anchorLocal: punto del núcleo (coordenadas locales de la estatua); ndc: posición fija en pantalla
    function label(text, sub, anchorLocal, ndc) {
      const cv = makeCanvas(text, sub, CYAN);
      const mat = new THREE.SpriteMaterial({ map: cv.tex, transparent: true, opacity: 0, depthTest: false, depthWrite: false });
      const sprite = new THREE.Sprite(mat);
      sprite.renderOrder = 5;
      labelGroup.add(sprite);
      const lm = new THREE.LineBasicMaterial({ color: CYAN, transparent: true, opacity: 0, depthTest: false, depthWrite: false, blending: ADD });
      const anchor = Vj(anchorLocal).add(ORIG);
      const geo = new THREE.BufferGeometry().setFromPoints([anchor.clone(), anchor.clone()]);
      const line = new THREE.Line(geo, lm);
      labelGroup.add(line);
      labels.push({ sprite: sprite, mat: mat, line: line, lm: lm, geo: geo, aspect: cv.aspect, anchor: anchor, ndc: ndc, base: V(0, 0, 0) });
    }
    // fuera de las zonas del HUD: derecha-media (x≈0.6), sin tapar el centro-alto ni la esquina
    label('NÚCLEO DE MADERA', 'ARMAZÓN · VIGAS Y TRAVESAÑOS', [-1.0, 8.6, 0.0], { x: 0.7, y: 0.42 });
    label('PLACAS DE MARFIL', 'PIEL DE MARFIL SOBRE LA MADERA', [0.3, 10.6, 0.0], { x: 0.7, y: 0.02 });
    label('LÁMINAS DE ORO', 'MANTO · SANDALIAS · CORONA', [0.2, 6.6, -1.6], { x: 0.7, y: -0.38 });

    const _cp = camera.position, _v = V(0, 0, 0), _nd = V(0, 0, 0);
    function updateLabels(xa) {
      camera.updateMatrixWorld();
      const halfTan = Math.tan(camera.fov * DEG / 2);
      const dF = Math.max(3, _cp.distanceTo(CEN));
      const placed = [];
      for (let i = 0; i < labels.length; i++) {
        const L = labels[i];
        const vis = xa > 0.001;
        L.mat.opacity = xa * 0.95; L.lm.opacity = xa * 0.8;
        L.sprite.visible = vis; L.line.visible = vis;
        if (!vis) continue;
        _v.set(L.ndc.x, L.ndc.y, 0.5).unproject(camera).sub(_cp).normalize().multiplyScalar(dF).add(_cp);
        L.base.copy(_v);
        const d = Math.max(1, _cp.distanceTo(L.base));
        let hgt = clamp(d * 0.06, 2, 10);
        hgt = Math.min(hgt, 0.5 * d * halfTan * camera.aspect / L.aspect);
        const hh = (hgt / 2) / (d * halfTan), hw = (hgt * L.aspect / 2) / (d * halfTan * camera.aspect);
        _nd.copy(L.base).project(camera);
        let dy = 0, ny = _nd.y;
        for (let k = 0; k < placed.length; k++) {
          const q = placed[k];
          const ox = hw + q.hw - Math.abs(_nd.x - q.x), oy = hh + q.hh - Math.abs(ny - q.y);
          if (ox > 0 && oy > 0) { const sh = oy + 0.02; dy -= sh * d * halfTan; ny -= sh; }
        }
        placed.push({ x: _nd.x, y: ny, hw: hw, hh: hh });
        L.sprite.position.set(L.base.x, L.base.y + dy, L.base.z);
        L.sprite.scale.set(hgt * L.aspect, hgt, 1);
        const arr = L.geo.attributes.position.array;
        arr[0] = L.anchor.x; arr[1] = L.anchor.y; arr[2] = L.anchor.z;
        arr[3] = L.sprite.position.x; arr[4] = L.sprite.position.y; arr[5] = L.sprite.position.z;
        L.geo.attributes.position.needsUpdate = true;
      }
    }

    // ---------- update ----------
    const CORE_STEP = 0.003;
    function update(s) {
      const temple = s.temple || 0, ruin = s.ruin || 0, burn = clamp01(s.burn || 0);
      // interior visible con el templo construido; todo se oculta cuando el templo se derrumba
      const cellaOn = temple > 0.5 && ruin <= 0.3;
      cellaRoot.visible = cellaOn;
      if (!cellaOn) {
        coreRoot.visible = false; labelGroup.visible = false;
        return;
      }
      const wall = s.wall || 0;

      // luces cálidas: fundido con el templo, apagadas fuera de la cella
      const lk = smooth(clamp01((temple - 0.5) * 2));
      for (let i = 0; i < lights.length; i++) lights[i].light.intensity = lights[i].base * lk;

      // llamas de las lámparas: parpadeo con el reloj de pared
      for (let i = 0; i < FLAME_BASE.length; i++) {
        const b = FLAME_BASE[i], ph = i * 1.37;
        flamePos[i * 3] = b.x + 0.012 * Math.sin(wall * 9.0 + ph);
        flamePos[i * 3 + 1] = b.y + 0.05 * Math.sin(wall * 6.1 + ph) + 0.02 * Math.sin(wall * 11.3 + ph * 1.7);
        flamePos[i * 3 + 2] = b.z + 0.012 * Math.cos(wall * 7.3 + ph);
      }
      flameGeo.attributes.position.needsUpdate = true;
      M.flame.opacity = 0.85 + 0.1 * Math.sin(wall * 9.0);

      cullColumns();

      // estanque: el aceite sube al llenarse (s.oil) y reflejan el entorno
      const fill = smooth(clamp01(s.oil || 0));
      oilMesh.visible = fill > 0.01;
      oilMesh.position.set(pCX, pY + 0.08 + 0.1 * fill, 0);
      M.oil.opacity = 0.85 * fill;
      wallU.value = wall;

      // núcleo de madera: se oculta si la piel está completa (sin rayos X) o si la estatua se ha consumido
      const xa = clamp01(s.xray || 0);
      const skinDone = (s.ivory || 0) >= 1 && (s.gold || 0) >= 1 && xa <= 0.001;
      const coreOn = (s.core || 0) > 0.001 && burn < 1 && !skinDone;
      coreRoot.visible = coreOn;
      if (coreOn) {
        const H = clamp01(s.core) * CORE_TOP;
        if (Math.abs(H - lastH) > CORE_STEP) { lastH = H; setCore(H); }
        const pulse = 0.9 + 0.1 * Math.sin(wall * 2.1);
        M.contour.opacity = xa * 0.75 * pulse;
      }
      labelGroup.visible = coreOn && xa > 0.001;
      if (labelGroup.visible) updateLabels(xa);
    }

    return { update: update, group: cellaRoot };
  };
})();
