// Obra del faro: barcos y trirremes, barcazas de granito, obreros instanciados, grúas de
// rueda de pisar, andamios de madera y plomo fundido entre los bloques del podio.
// Todo procedural. Función pura del estado s (t, wall, build, lead, ...).
(function () {
  'use strict';
  const G = window.GIZA;

  G.createConstruction = function (ctx) {
    const THREE = ctx.THREE, scene = ctx.scene, renderer = ctx.renderer;
    const root = new THREE.Group();
    scene.add(root);

    const SITE = G.SITE, TOWER = G.TOWER;
    const SEA = SITE.seaLevel;
    const TAU = Math.PI * 2;

    // ---------- utilidades ----------
    function hash(n) { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
    function clamp(x, a, b) { return x < a ? a : (x > b ? b : x); }
    function frac(x) { return x - Math.floor(x); }
    function sstep(x) { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); }
    // ida y vuelta en [0,1] a partir de una distancia d (módulo 2L)
    function pingPong(d, L) { const p = frac(d / (2 * L)); return p < 0.5 ? 2 * p : 2 - 2 * p; }

    // sprite circular para humo y chispas (evita puntos cuadrados)
    const dotTex = (function () {
      const cv = document.createElement('canvas');
      cv.width = cv.height = 64;
      const g = cv.getContext('2d');
      const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, 'rgba(255,255,255,1)');
      gr.addColorStop(0.5, 'rgba(255,255,255,0.6)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
      const tex = new THREE.CanvasTexture(cv);
      tex.encoding = THREE.sRGBEncoding;
      return tex;
    })();

    // ---------- materiales ----------
    const MAT = {
      hull:     new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true }),
      wood:     new THREE.MeshStandardMaterial({ color: 0x7a5230, roughness: 0.9 }),
      woodDk:   new THREE.MeshStandardMaterial({ color: 0x4a3018, roughness: 0.95 }),
      woodVC:   new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true, side: THREE.DoubleSide }),
      sail:     new THREE.MeshStandardMaterial({ color: 0xf2ecdc, roughness: 0.95, side: THREE.DoubleSide }),
      granite:  new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7, flatShading: true }),
      stone:    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, flatShading: true }),
      skin:     new THREE.MeshStandardMaterial({ color: 0x8c5a3a, roughness: 0.8, flatShading: true }),
      cloth:    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, flatShading: true }),
      iron:     new THREE.MeshStandardMaterial({ color: 0x2b2a29, roughness: 0.7, metalness: 0.1 }),
      rope:     new THREE.LineBasicMaterial({ color: 0xd9c58a }),
      wake:     new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, depthWrite: false }),
      lead:     new THREE.MeshStandardMaterial({ color: 0xb4b8be, roughness: 0.3, metalness: 0.7, emissive: 0x5a2c0c, emissiveIntensity: 0.55 }),
      clay:     new THREE.MeshStandardMaterial({ color: 0xb9835a, roughness: 1, flatShading: true }),
      molten:   new THREE.MeshBasicMaterial({ color: 0xffa456 }),
      glow:     new THREE.MeshBasicMaterial({ color: 0xff8a2a, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false }),
      smoke:    new THREE.PointsMaterial({ color: 0xd0cabc, map: dotTex, size: 6.5, transparent: true, opacity: 0.3, depthWrite: false }),
      spark:    new THREE.PointsMaterial({ color: 0xffc070, map: dotTex, size: 1.6, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending })
    };

    // ---------- geometría fusionada con vertex colors ----------
    function MB() { return { p: [], n: [], c: [], i: [] }; }
    function mbAppend(mb, geo, c) {
      const pa = geo.attributes.position.array, na = geo.attributes.normal.array, ia = geo.index.array;
      const base = mb.p.length / 3;
      for (let k = 0; k < pa.length; k += 3) {
        mb.p.push(pa[k], pa[k + 1], pa[k + 2]);
        mb.n.push(na[k], na[k + 1], na[k + 2]);
        mb.c.push(c.r, c.g, c.b);
      }
      for (let k = 0; k < ia.length; k++) mb.i.push(ia[k] + base);
      geo.dispose();
    }
    function mbBox(mb, x, y, z, sx, sy, sz, c, ry, rx, rz) {
      const g = new THREE.BoxGeometry(sx, sy, sz);
      const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx || 0, ry || 0, rz || 0, 'YXZ'));
      m.setPosition(x, y, z);
      g.applyMatrix4(m);
      mbAppend(mb, g, c);
    }
    function mbTri(mb, a, b, c, col, inside) {
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
      const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const L = Math.hypot(nx, ny, nz) || 1; nx /= L; ny /= L; nz /= L;
      const cx = (a[0] + b[0] + c[0]) / 3 - inside[0], cy = (a[1] + b[1] + c[1]) / 3 - inside[1], cz = (a[2] + b[2] + c[2]) / 3 - inside[2];
      if (nx * cx + ny * cy + nz * cz < 0) { nx = -nx; ny = -ny; nz = -nz; }
      const base = mb.p.length / 3;
      [a, b, c].forEach(function (v) { mb.p.push(v[0], v[1], v[2]); mb.n.push(nx, ny, nz); mb.c.push(col.r, col.g, col.b); });
      mb.i.push(base, base + 1, base + 2);
    }
    function mbGeo(mb) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(mb.p, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(mb.n, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(mb.c, 3));
      g.setIndex(mb.i);
      return g;
    }
    function mkIM(geo, mat, n, shadow) {
      const im = new THREE.InstancedMesh(geo, mat, n);
      im.frustumCulled = false;
      if (shadow) { im.castShadow = true; im.receiveShadow = true; }
      return im;
    }

    // ---------- matrices auxiliares ----------
    const _m4 = new THREE.Matrix4(), _q4 = new THREE.Quaternion(), _p3 = new THREE.Vector3();
    const _s3 = new THREE.Vector3(1, 1, 1), _e3 = new THREE.Euler(), _c3 = new THREE.Color();
    const _yAxis = new THREE.Vector3(0, 1, 0);
    function setPRS(im, idx, x, y, z, ry, sx, sy, sz) {
      _p3.set(x, y, z);
      _q4.setFromAxisAngle(_yAxis, ry || 0);
      _s3.set(sx === undefined ? 1 : sx, sy === undefined ? 1 : sy, sz === undefined ? 1 : sz);
      _m4.compose(_p3, _q4, _s3);
      im.setMatrixAt(idx, _m4);
    }
    // polilínea con longitud acumulada: at(u) -> [x,z,dirx,dirz]
    function polyline(pts) {
      const cum = [0];
      for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
      const L = cum[cum.length - 1];
      return {
        L: L,
        at: function (u) {
          const d = clamp(u, 0, 1) * L;
          let i = 1;
          while (i < cum.length - 1 && cum[i] < d) i++;
          const a = pts[i - 1], b = pts[i], seg = Math.max(1e-6, cum[i] - cum[i - 1]);
          const f = clamp((d - cum[i - 1]) / seg, 0, 1);
          const dx = b[0] - a[0], dz = b[1] - a[1], dl = Math.hypot(dx, dz) || 1;
          return [a[0] + dx * f, a[1] + dz * f, dx / dl, dz / dl];
        }
      };
    }
    // rumbo (rotación Y) para una dirección (dx,dz) en plano XZ: el +X local apunta a la proa
    function headingOf(dx, dz) { return Math.atan2(-dz, dx); }

    // =====================================================================
    // 1. BARCOS: mercantes y trirremes en el mar frente a la isla, pecio encallado
    // =====================================================================
    const boatsG = new THREE.Group();
    root.add(boatsG);

    // casco mercante: eslora 24 m (local X), manga 7 m (Z), quilla en y=0
    const merchMB = MB();
    (function buildMerch() {
      const cH = new THREE.Color(0x5b3d24), cB = new THREE.Color(0x2e1f12), cRail = new THREE.Color(0x7a5230);
      const top = [[-12, 1.8, 0], [-10, 2.6, 3.0], [-2, 2.6, 3.4], [6, 2.6, 3.4], [11, 2.4, 2.0], [13, 2.2, 0], [11, 2.4, -2.0], [6, 2.6, -3.4], [-2, 2.6, -3.4], [-10, 2.6, -3.0]];
      const bot = top.map(function (p) { return [p[0] * 0.75, 0.2, p[2] * 0.55]; });
      const inside = [0, 1.0, 0];
      for (let i = 1; i < top.length - 1; i++) mbTri(merchMB, top[0], top[i], top[i + 1], cH, inside);
      for (let i = 0; i < top.length; i++) {
        const j = (i + 1) % top.length;
        mbTri(merchMB, top[i], top[j], bot[j], cH, inside);
        mbTri(merchMB, top[i], bot[j], bot[i], cB, inside);
      }
      mbBox(merchMB, -9.0, 4.0, 0, 4.0, 2.4, 5.6, cRail);
      mbBox(merchMB, 0, 6.0, 0, 0.3, 11.0, 0.3, cRail);
      mbBox(merchMB, 0, 8.4, 0, 0.12, 0.12, 9.0, cRail, 0, 0, Math.PI / 2);
    })();
    const merchGeo = mbGeo(merchMB);
    const NM = 3;
    const merchIM = mkIM(merchGeo, MAT.hull, NM, true);
    const merchSailGeo = (function () {
      // vela cuadra: plano athwartship (YZ) abombado hacia +X
      const g = new THREE.PlaneGeometry(8.5, 8, 4, 4);
      g.translate(0, 4.0, 0);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) { const v = p.getY(i) / 8; p.setZ(i, 0.8 * Math.sin(Math.PI * v) * Math.sin(Math.PI * (p.getX(i) / 8.5 + 0.5))); }
      g.rotateY(Math.PI / 2);
      g.computeVertexNormals();
      return g;
    })();
    const merchSailIM = mkIM(merchSailGeo, MAT.sail, NM, true);
    // carga de mármol/granito y lingotes sobre cubierta
    const cargoIM = mkIM(new THREE.BoxGeometry(1.4, 0.9, 1.0), MAT.stone, NM * 6, true);
    boatsG.add(merchIM, merchSailIM, cargoIM);

    // trirreme: 36 m, manga 5 m, con remos (ritmo de remada con el reloj de pared)
    const NT = 3, OARS = 12; // remos por banda
    const triMB = MB();
    (function buildTri() {
      const cH = new THREE.Color(0x6b4a2c), cB = new THREE.Color(0x3a2612), cRail = new THREE.Color(0x9a7344);
      const top = [[-16, 1.2, 0], [-13, 1.8, 2.2], [-4, 1.6, 2.5], [6, 1.6, 2.5], [14, 1.8, 1.6], [18, 1.4, 0], [14, 1.8, -1.6], [6, 1.6, -2.5], [-4, 1.6, -2.5], [-13, 1.8, -2.2]];
      const bot = top.map(function (p) { return [p[0] * 0.8, -0.8, p[2] * 0.35]; });
      const inside = [0, 0.6, 0];
      for (let i = 1; i < top.length - 1; i++) mbTri(triMB, top[0], top[i], top[i + 1], cH, inside);
      for (let i = 0; i < top.length; i++) {
        const j = (i + 1) % top.length;
        mbTri(triMB, top[i], top[j], bot[j], cH, inside);
        mbTri(triMB, top[i], bot[j], bot[i], cB, inside);
      }
      // espolón de bronce en la proa, castillo de popa y mástil
      mbBox(triMB, 18.6, 0.6, 0, 1.4, 0.3, 0.3, new THREE.Color(0xb07a3c), 0, 0, -0.35);
      mbBox(triMB, -14.0, 3.2, 0, 3.0, 2.2, 3.4, cRail);
      mbBox(triMB, 2.0, 7.0, 0, 0.22, 12.0, 0.22, cRail);
      mbBox(triMB, 2.0, 11.6, 0, 0.1, 0.1, 7.0, cRail, 0, 0, Math.PI / 2);
    })();
    const triGeo = mbGeo(triMB);
    const triIM = mkIM(triGeo, MAT.hull, NT, true);
    const triSailIM = mkIM((function () {
      const g = new THREE.PlaneGeometry(6, 9, 3, 4);
      g.translate(0, 4.5, 0);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) { const v = p.getY(i) / 9; p.setZ(i, 0.6 * Math.sin(Math.PI * v)); }
      g.rotateY(Math.PI / 2);
      g.computeVertexNormals();
      return g;
    })(), MAT.sail, NT, true);
    const oarGeo = new THREE.BoxGeometry(0.12, 0.12, 5.2).translate(0, 0, 2.6);
    const oarR = mkIM(oarGeo, MAT.wood, NT * OARS, false);
    const oarL = mkIM(oarGeo, MAT.wood, NT * OARS, false);
    boatsG.add(triIM, triSailIM, oarR, oarL);

    // pecio encallado: mercante volcado sobre el escollo de SITE.wreck (proa fuera del agua)
    const wreck = new THREE.Group();
    const wreckHull = new THREE.Mesh(merchGeo, MAT.hull);
    wreckHull.castShadow = true; wreckHull.receiveShadow = true;
    wreckHull.position.set(0, -0.6, 0);
    wreckHull.rotation.set(0, 0, 0.55);
    wreck.add(wreckHull);
    const wreckMast = new THREE.Mesh(new THREE.BoxGeometry(0.3, 9, 0.3), MAT.woodDk);
    wreckMast.position.set(-4.0, 3.2, 1.0); wreckMast.rotation.set(0.2, 0, 0.9);
    wreck.add(wreckMast);
    wreck.position.set(SITE.wreck.x, SEA + 0.6, SITE.wreck.z);
    wreck.rotation.y = 0.6;
    boatsG.add(wreck);

    // rutas de los barcos (ida y vuelta, ping-pong). Velocidades en m/s de video.
    const MERCH_LANES = [
      { A: [-1400, -330], B: [700, -380], v: 2.4, ph: 0.15, s: 0 },
      { A: [600, -520], B: [-900, -470], v: 2.0, ph: 0.55, s: 1 },
      { A: [900, -170], B: [520, -90], v: 1.6, ph: 0.8, s: 2 }
    ];
    const TRI_LANES = [
      { A: [-700, -200], B: [380, -235], v: 1.5, ph: 0.3 },
      { A: [320, -400], B: [-520, -330], v: 1.3, ph: 0.6 },
      { A: [-200, -640], B: [520, -640], v: 1.1, ph: 0.9 }
    ];
    function laneLen(l) { return Math.hypot(l.B[0] - l.A[0], l.B[1] - l.A[1]); }
    function placeOnLane(l, t, out) {
      const L = laneLen(l);
      const d = l.v * t + l.ph * L;
      const p = frac(d / (2 * L));
      const u = p < 0.5 ? 2 * p : 2 - 2 * p;
      const dirSign = p < 0.5 ? 1 : -1;
      const dx = (l.B[0] - l.A[0]) / L * dirSign, dz = (l.B[1] - l.A[1]) / L * dirSign;
      out.x = l.A[0] + (l.B[0] - l.A[0]) * u;
      out.z = l.A[1] + (l.B[1] - l.A[1]) * u;
      out.hd = headingOf(dx, dz);
      return out;
    }
    const _pos = { x: 0, z: 0, hd: 0 };
    const _hm = new THREE.Matrix4(), _lm = new THREE.Matrix4(), _tm = new THREE.Matrix4(), _rm = new THREE.Matrix4();

    // colores de la carga (granito rojo de Asuán y caliza)
    for (let i = 0; i < NM * 6; i++) cargoIM.setColorAt(i, _c3.setHex(i % 3 === 0 ? 0xd9978a : (i % 3 === 1 ? 0xc97e70 : 0xd9c69a)));
    cargoIM.instanceColor.needsUpdate = true;

    function updateBoats(s) {
      const b = clamp(s.boats, 0, 1), W = s.wall, t = s.t;
      boatsG.visible = b > 0.002;
      if (!boatsG.visible) return;
      // mercantes
      for (let i = 0; i < NM; i++) {
        const P = placeOnLane(MERCH_LANES[i], t, _pos);
        const bob = 0.07 * Math.sin(W * 0.9 + i * 2.1), roll = 0.025 * Math.sin(W * 0.7 + i * 1.3);
        _p3.set(P.x, SEA + 0.25 + bob, P.z);
        _q4.setFromEuler(_e3.set(0, P.hd, roll, 'YXZ'));
        _hm.compose(_p3, _q4, _s3.set(1, 1, 1));
        merchIM.setMatrixAt(i, _hm);
        // vela (algunos barcos la izan a medias)
        const sc = i === 1 ? 0.0001 : 1;
        _tm.makeTranslation(0, 0, 0);
        _lm.copy(_hm).multiply(_tm).multiply(_rm.makeScale(sc, sc, sc));
        merchSailIM.setMatrixAt(i, _lm);
        // carga: bloques que se van cargando con t
        for (let c = 0; c < 6; c++) {
          const load = sstep((t - 3 * c - i * 5) / 2) * b;
          _tm.makeTranslation(-4 + (c % 3) * 1.6, 3.4 + Math.floor(c / 3) * 0.95, 0);
          _lm.copy(_hm).multiply(_tm).multiply(_rm.makeScale(load, load, load));
          cargoIM.setMatrixAt(i * 6 + c, _lm);
        }
      }
      // trirremes: remada (los remos barren en oposición entre bandas)
      for (let i = 0; i < NT; i++) {
        const L = TRI_LANES[i];
        const P = placeOnLane(L, t, _pos);
        const bob = 0.05 * Math.sin(W * 1.1 + i * 1.7);
        _p3.set(P.x, SEA + 0.3 + bob, P.z);
        _q4.setFromEuler(_e3.set(0, P.hd, 0.015 * Math.sin(W * 0.8 + i), 'YXZ'));
        _hm.compose(_p3, _q4, _s3.set(1, 1, 1));
        triIM.setMatrixAt(i, _hm);
        triSailIM.setMatrixAt(i, _hm);
        for (let o = 0; o < OARS; o++) {
          const ph = W * 2.4 + i * 0.7 + o * 0.11;
          const ang = 0.5 * Math.sin(ph);
          const ox = -12 + o * 2.1;
          _tm.makeTranslation(ox, 1.7, 2.1);
          _rm.makeRotationY(ang);
          _lm.copy(_hm).multiply(_tm).multiply(_rm);
          oarR.setMatrixAt(i * OARS + o, _lm);
          _tm.makeTranslation(ox, 1.7, -2.1);
          _rm.makeRotationY(-ang);
          _lm.copy(_hm).multiply(_tm).multiply(_rm).multiply(_rm.makeScale(1, 1, -1));
          oarL.setMatrixAt(i * OARS + o, _lm);
        }
      }
      merchIM.instanceMatrix.needsUpdate = true;
      merchSailIM.instanceMatrix.needsUpdate = true;
      cargoIM.instanceMatrix.needsUpdate = true;
      triIM.instanceMatrix.needsUpdate = true;
      triSailIM.instanceMatrix.needsUpdate = true;
      oarR.instanceMatrix.needsUpdate = true;
      oarL.instanceMatrix.needsUpdate = true;
    }

    // =====================================================================
    // 2. BARCAZAS de fondo plano con granito de Asuán y caliza (SITE.bargeRoute)
    //    4 en tránsito (posición = f(t)) y 1 amarrada en SITE.quay descargando.
    // =====================================================================
    const bargesG = new THREE.Group();
    root.add(bargesG);
    const bargeMB = MB();
    (function buildBarge() {
      const cW = new THREE.Color(0x6e4a2a), cIn = new THREE.Color(0x4f3519);
      mbBox(bargeMB, 0, 0.3, 0, 16, 0.6, 4.6, cW);             // fondo
      mbBox(bargeMB, 0, 0.95, 2.25, 16, 0.9, 0.3, cW);         // bordas
      mbBox(bargeMB, 0, 0.95, -2.25, 16, 0.9, 0.3, cW);
      mbBox(bargeMB, 8.1, 0.95, 0, 0.3, 0.9, 4.6, cW);
      mbBox(bargeMB, -8.1, 0.95, 0, 0.3, 0.9, 4.6, cW);
      mbBox(bargeMB, 0, 0.1, 0, 15.2, 0.1, 4.0, cIn);          // cubierta interior
      // timón de remo
      mbBox(bargeMB, -8.6, 0.6, 0, 0.3, 0.3, 1.8, cIn);
    })();
    const bargeIM = mkIM(mbGeo(bargeMB), MAT.woodVC, 5, true);
    // bloques: 6 por barcaza (la del muelle, 6 de descarga)
    const NBLK = 30;
    const blockIM = mkIM(new THREE.BoxGeometry(2.4, 1.2, 1.2), MAT.granite, NBLK, true);
    bargesG.add(bargeIM, blockIM);
    for (let i = 0; i < NBLK; i++) {
      const granite = (i % 2) === 0;
      blockIM.setColorAt(i, _c3.setHex(granite ? 0xd9978a : 0xd9c69a));
    }
    blockIM.instanceColor.needsUpdate = true;

    const BARGE_ROUTE = polyline(SITE.bargeRoute);
    const TRANSIT = [
      { v: 4.0, ph: 0.12 }, { v: 3.6, ph: 0.42 }, { v: 4.2, ph: 0.68 }, { v: 3.4, ph: 0.9 }
    ];
    const QUAY_PIER = { x: 72, z: 134 };   // grúa de descarga sobre el pantalán
    const QUAY_BARGE = { x: 84, z: 150, hd: headingOf(-(SITE.quay.x - 84), -(SITE.quay.z - 150)) };
    // muelle: pilas de bloques descargados
    const STACK = [];
    for (let i = 0; i < 6; i++) STACK.push({ x: 56 + (i % 3) * 4.2, y: 0.6 + Math.floor(i / 3) * 1.2, z: 118 + hash(i + 40) * 2 });
    const UNLOAD_T0 = 66, UNLOAD_DT = 12;

    function updateBarges(s) {
      const b = clamp(s.barges, 0, 1), W = s.wall, t = s.t;
      bargesG.visible = b > 0.002;
      if (!bargesG.visible) return;
      // barcazas en tránsito: u = avance a lo largo de la ruta (fade en los extremos)
      let bi = 0;
      for (let i = 0; i < TRANSIT.length; i++) {
        const T = TRANSIT[i];
        const u = frac(t * T.v / BARGE_ROUTE.L + T.ph);
        const P = BARGE_ROUTE.at(u);
        const fade = Math.min(sstep(u / 0.04), sstep((1 - u) / 0.04)) * b;
        const bob = 0.08 * Math.sin(W * 1.2 + i * 2.0);
        _p3.set(P[0], SEA + 0.3 + bob, P[1]);
        _q4.setFromAxisAngle(_yAxis, headingOf(P[2], P[3]));
        _hm.compose(_p3, _q4, _s3.set(fade, fade, fade));
        bargeIM.setMatrixAt(bi, _hm);
        for (let c = 0; c < 6; c++) {
          _tm.makeTranslation(-5.0 + (c % 3) * 3.2, 1.0 + Math.floor(c / 3) * 1.2, 0);
          _lm.copy(_hm).multiply(_tm).multiply(_rm.makeScale(fade, fade, fade));
          blockIM.setMatrixAt(bi * 6 + c, _lm);
        }
        bi++;
      }
      // barcaza amarrada junto al muelle: bloques que se descargan uno a uno con la grúa
      const qb = QUAY_BARGE;
      _p3.set(qb.x, SEA + 0.3, qb.z);
      _q4.setFromAxisAngle(_yAxis, qb.hd);
      _hm.compose(_p3, _q4, _s3.set(b, b, b));
      bargeIM.setMatrixAt(bi, _hm);
      for (let c = 0; c < 6; c++) {
        const t0 = UNLOAD_T0 + c * UNLOAD_DT;
        const p = clamp((t - t0) / 9, 0, 1);
        // posición sobre cubierta (o en el aire, entre la barcaza y la pila)
        // origen en cubierta: eje X local de la barcaza = (cos hd, -sin hd)
        const lx = -5 + (c % 3) * 3.2, lyDeck = SEA + 0.3 + 1.0 + Math.floor(c / 3) * 1.2;
        const sx = qb.x + Math.cos(qb.hd) * lx, sz = qb.z - Math.sin(qb.hd) * lx;
        const k = STACK[c];
        const bx = sx + (k.x - sx) * sstep(p), bz = sz + (k.z - sz) * sstep(p);
        // sube con la grúa hasta la altura de la pila y luego baja (arco de 6 m)
        const by = lyDeck + (k.y - lyDeck) * sstep(p) + Math.sin(Math.PI * p) * 6 * (p > 0 && p < 1 ? 1 : 0);
        _tm.makeTranslation(bx, by, bz);
        _rm.makeRotationY(qb.hd);
        _lm.copy(_tm).multiply(_rm).multiply(_rm.makeScale(b, b, b));
        blockIM.setMatrixAt(bi * 6 + c, _lm);
      }
      bargeIM.instanceMatrix.needsUpdate = true;
      blockIM.instanceMatrix.needsUpdate = true;
    }

    // =====================================================================
    // 3. OBREROS (InstancedMesh, animados con s.wall)
    //    0-35 patio de labra (picando bloques), 36-47 muelle (acarreo),
    //    48-63 podio (martilleo), 64-83 cima de la obra (a la altura build*111), 84-99 caminantes
    // =====================================================================
    // bloques del patio de labra: montones de caliza y granito a medio labrar (arco oeste-norte)
    const YARD = [];
    (function buildYard() {
      const YB = 22;
      const SIZES = [[2.4, 1.2, 1.2], [1.6, 1.0, 1.0], [3.0, 1.5, 1.5], [1.2, 0.9, 0.9]];
      const yardIM = mkIM(new THREE.BoxGeometry(1, 1, 1), MAT.stone, YB, true);
      const chiselIM = mkIM(new THREE.BoxGeometry(0.07, 0.07, 0.8), MAT.iron, 16, false);
      root.add(yardIM, chiselIM);
      for (let i = 0; i < YB; i++) {
        const a = 1.9 + hash(i + 1500) * 4.1, r = 9 + hash(i + 1600) * 6;
        const x = SITE.stoneYard.x + Math.cos(a) * r, z = SITE.stoneYard.z + Math.sin(a) * r;
        const sz = SIZES[i % SIZES.length];
        setPRS(yardIM, i, x, sz[1] / 2, z, hash(i + 1700) * Math.PI, sz[0], sz[1], sz[2]);
        yardIM.setColorAt(i, _c3.setHex(i % 2 === 0 ? 0xd9978a : 0xd9c69a));
        YARD.push({ x: x, z: z, top: sz[1] });
      }
      // cinceles tirados junto a los bloques
      for (let i = 0; i < 16; i++) {
        const B = YARD[i % YB];
        setPRS(chiselIM, i, B.x + 1.2 + hash(i + 1800) * 0.8, B.top + 0.04, B.z + hash(i + 1900) * 1.2, hash(i + 2000) * Math.PI);
      }
      yardIM.instanceMatrix.needsUpdate = true;
      yardIM.instanceColor.needsUpdate = true;
      chiselIM.instanceMatrix.needsUpdate = true;
    })();

    const workersG = new THREE.Group();
    root.add(workersG);
    const NW = 100;
    const wTorso = mkIM(new THREE.BoxGeometry(0.42, 0.66, 0.24), MAT.cloth, NW, true);
    const wHead = mkIM(new THREE.SphereGeometry(0.14, 6, 4), MAT.skin, NW, false);
    const wLeg = mkIM(new THREE.BoxGeometry(0.19, 0.9, 0.2), MAT.cloth, NW * 2, true);
    const wArm = mkIM(new THREE.BoxGeometry(0.13, 0.66, 0.13), MAT.skin, NW * 2, false);
    // mazo de madera: mango y cabeza
    const wTool = mkIM((function () {
      const mb = MB();
      mbBox(mb, 0, 0, 0, 0.07, 0.9, 0.07, new THREE.Color(0x7a5230));
      mbBox(mb, 0, 0.42, 0, 0.22, 0.16, 0.16, new THREE.Color(0x4a3018));
      return mbGeo(mb);
    })(), MAT.woodVC, NW, false);
    const WIMS = [wTorso, wHead, wLeg, wArm, wTool];
    WIMS.forEach(function (im) { workersG.add(im); });
    (function () {
      const pal = [0xd9c9a3, 0xb8794a, 0x3d6f9e, 0xe6e0d0, 0x8c3b2a];
      for (let i = 0; i < NW; i++) wTorso.setColorAt(i, _c3.setHex(pal[i % pal.length]));
      for (let i = 0; i < NW * 2; i++) wLeg.setColorAt(i, _c3.setHex(i % 2 ? 0x5b4a36 : 0x6b5a42));
      wTorso.instanceColor.needsUpdate = true;
      wLeg.instanceColor.needsUpdate = true;
    })();
    const _wR = new THREE.Matrix4(), _wq = new THREE.Quaternion(), _wp = new THREE.Vector3();
    const _wA = new THREE.Matrix4(), _wB = new THREE.Matrix4(), _wE = new THREE.Euler();
    function wRoot(x, y, z, hd) { _wp.set(x, y, z); _wq.setFromAxisAngle(_yAxis, hd); _wR.compose(_wp, _wq, _s3.set(1, 1, 1)); }
    // pieza: M = root * T(p) * R(rx,rz) * T(off) * S(size)
    function wPart(im, idx, px, py, pz, rx, rz, ox, oy, oz, sx, sy, sz) {
      _wA.makeTranslation(px, py, pz);
      _wE.set(rx, 0, rz, 'XYZ'); _wB.makeRotationFromEuler(_wE); _wA.multiply(_wB);
      _wB.makeTranslation(ox, oy, oz); _wA.multiply(_wB);
      _wB.makeScale(sx, sy, sz); _wA.multiply(_wB);
      _wB.multiplyMatrices(_wR, _wA);
      im.setMatrixAt(idx, _wB);
    }
    function drawWorker(i, P) {
      wPart(wTorso, i, 0, 1.25, 0, P.lean, 0, 0, 0, 0, 1, 1, 1);
      wPart(wHead, i, 0, 1.25, 0, P.lean, 0, 0, 0.45, 0, 1, 1, 1);
      wPart(wLeg, 2 * i, -0.11, 0.9, 0, P.ll, 0, 0, -0.45, 0, 1, 1, 1);
      wPart(wLeg, 2 * i + 1, 0.11, 0.9, 0, P.lr, 0, 0, -0.45, 0, 1, 1, 1);
      wPart(wArm, 2 * i, -0.27, 1.5, 0, P.al, 0, 0, -0.33, 0, 1, 1, 1);
      wPart(wArm, 2 * i + 1, 0.27, 1.5, 0, P.ar, 0, 0, -0.33, 0, 1, 1, 1);
      wPart(wTool, i, 0.27, 1.5, 0, P.ar, 0, 0, -0.72, 0.1, P.tool ? 1 : 0.0001, P.tool ? 1 : 0.0001, P.tool ? 1 : 0.0001);
    }
    const PW = { ll: 0, lr: 0, al: 0, ar: 0, lean: 0, tool: 0 };
    const QUAY_TGT = { x: 60, z: 120 };
    // radio del tramo de cima (donde están los obreros y las grúas) según la altura y
    function rimR(y) {
      if (y < TOWER.tier2.y0) return TOWER.tier1HalfAt(y) * 0.9;
      if (y < TOWER.tier3.y0) return TOWER.tier2.radius - 1.2;
      return TOWER.tier3.radius - 1.2;
    }
    // radio exterior del andamio (alrededor de la franja en construcción)
    function scaffoldR(y) {
      if (y < TOWER.tier2.y0) return 21;
      if (y < TOWER.tier3.y0) return TOWER.tier2.radius + 2.2;
      return TOWER.tier3.radius + 2.2;
    }

    function updateWorkers(s) {
      const W = s.wall, w = clamp(s.workers, 0, 1);
      workersG.visible = w > 0.002;
      if (!workersG.visible) return;
      const SY = SITE.stoneYard;
      // 0-35: patio de labra, de pie picando con cincel y mazo; arco al oeste y norte (la cámara mira desde el SE)
      for (let i = 0; i < 36; i++) {
        const h1 = hash(i + 500), h2 = hash(i + 600), h3 = hash(i + 700);
        // cada obrero trabaja frente a un bloque (dos por bloque), mirando hacia él
        const Bk = YARD[i % YARD.length];
        const ux = SY.x - Bk.x, uz = SY.z - Bk.z, ul = Math.hypot(ux, uz) || 1;
        const x = Bk.x + ux / ul * 2.0 + (h2 - 0.5) * 1.0, z = Bk.z + uz / ul * 2.0 + (h3 - 0.5) * 1.0;
        wRoot(x, 0, z, Math.atan2(-(x - Bk.x), -(z - Bk.z)) + (h1 - 0.5) * 0.3);
        const ph = W * 3.0 + i;
        PW.ar = -1.2 + 0.9 * Math.cos(ph); PW.al = -0.3; PW.ll = 0.08; PW.lr = -0.08; PW.lean = 0.35; PW.tool = 1;
        drawWorker(i, PW);
      }
      // 36-47: muelle, cargan bloques entre la barcaza y la pila
      const qb = QUAY_BARGE;
      for (let j = 0; j < 12; j++) {
        const i = 36 + j, h1 = hash(i + 500);
        const f = pingPong(W * 0.12 + h1 * 2, 1);
        const sx = qb.x + (QUAY_TGT.x - qb.x) * f, sz = qb.z + (QUAY_TGT.z - qb.z) * f;
        wRoot(sx + (hash(i + 900) - 0.5) * 2, 0, sz, headingOf(QUAY_TGT.x - qb.x, QUAY_TGT.z - qb.z) + Math.PI * (f > 0.5 ? 1 : 0));
        const sw = Math.sin(W * 5 + h1 * TAU);
        PW.ll = 0.4 * sw; PW.lr = -0.4 * sw; PW.al = -1.0; PW.ar = -1.0; PW.lean = 0.12; PW.tool = 0;
        drawWorker(i, PW);
      }
      // 48-63: podio, martilleando los bloques del basamento (arco al oeste, fuera de la vista de la cámara)
      for (let j = 0; j < 16; j++) {
        const i = 48 + j, h1 = hash(i + 500), h2 = hash(i + 600);
        const a = 3.0 + j / 15 * 1.4 + h1 * 0.1, r = 30 + h2 * 2;
        const x = Math.cos(a) * r, z = Math.sin(a) * r;
        wRoot(x, 0, z, Math.atan2(-x, -z));
        PW.ar = -1.2 + 0.9 * Math.cos(W * 3 + i); PW.al = -0.3; PW.ll = 0.08; PW.lr = -0.08; PW.lean = 0.35; PW.tool = 1;
        drawWorker(i, PW);
      }
      // 64-83: cima de la obra, de pie en el borde a la altura actual (solo arco sur-oeste)
      const yt = clamp(s.build, 0, 1) * TOWER.H;
      // la cima se despeja al completarse la altura (la linterna ocupa ese sitio)
      const topOn = s.build > 0.1 && s.build < 0.97 && s.cranes > 0.5 && s.collapse <= 0.001 && yt > 8;
      for (let j = 0; j < 20; j++) {
        const i = 64 + j, h1 = hash(i + 500), h2 = hash(i + 600);
        if (!topOn) { wRoot(0, -50, 0, 0); }
        else {
          const a = 1.3 + j / 19 * 3.3 + h1 * 0.15, r = rimR(yt) * (0.8 + 0.2 * h2);
          const x = Math.cos(a) * r, z = Math.sin(a) * r;
          wRoot(x, yt, z, Math.atan2(-x, -z));
        }
        PW.ar = -1.0 + 0.8 * Math.cos(W * 3 + i); PW.al = -0.2; PW.ll = 0; PW.lr = 0; PW.lean = 0.25; PW.tool = 1;
        drawWorker(i, PW);
      }
      // 84-99: caminantes al noroeste de la isla, lejos de la torre
      for (let j = 0; j < 16; j++) {
        const i = 84 + j, h1 = hash(i + 500);
        const a = 3.7 + 0.9 * pingPong(W * 0.05 + h1, 1), r = 90;
        const x = Math.cos(a) * r, z = Math.sin(a) * r;
        wRoot(x, 0, z, Math.atan2(-Math.sin(a), Math.cos(a)) + Math.PI * 0.5);
        const sw = Math.sin(W * 5 + h1 * TAU);
        PW.ll = 0.4 * sw; PW.lr = -0.4 * sw; PW.al = -0.35 * sw; PW.ar = 0.35 * sw; PW.lean = 0.04; PW.tool = 0;
        drawWorker(i, PW);
      }
      WIMS.forEach(function (im) { im.instanceMatrix.needsUpdate = true; });
    }

    // =====================================================================
    // 4. GRÚAS de madera con rueda de pisar (hombres dentro) en la cima, a la altura actual;
    //    andamios de madera ~8 m bajo la cima; grúa de descarga en el muelle.
    // =====================================================================
    const cW = new THREE.Color(0x6e4a2a), cDk = new THREE.Color(0x3a2a1a);
    function mbGeom(mb, geo, m, c) {
      const g = geo.clone().applyMatrix4(m);
      if (!g.index) { const n = g.attributes.position.count; const idx = []; for (let i = 0; i < n; i++) idx.push(i); g.setIndex(idx); }
      if (!g.attributes.normal) g.computeVertexNormals();
      mbAppend(mb, g, c);
      g.dispose();
    }
    // armazón (mástil 14 m, pluma hacia +X, contrapeso hacia -X)
    const craneFrameGeo = (function () {
      const mb = MB();
      mbBox(mb, 0, 0.3, 0, 3.6, 0.6, 2.4, cW);                 // plataforma
      mbBox(mb, 0, 7.0, 0, 0.45, 14, 0.45, cW);                // mástil
      mbBox(mb, 0, 4.6, 0.8, 0.12, 0.12, 0.12, cW);            // travesaños
      mbBox(mb, 0, 9.6, 0.8, 0.12, 0.12, 0.12, cW);
      mbBox(mb, 6.2, 13.2, 0, 12.5, 0.3, 0.3, cW);             // pluma
      mbBox(mb, -2.2, 13.0, 0, 4.8, 0.25, 0.25, cW);           // contrapluma
      mbBox(mb, -4.6, 12.5, 0, 1.4, 1.1, 1.1, cDk);            // contrapeso
      mbBox(mb, 0, 14.3, 0, 1.0, 0.6, 0.9, cW);                // cabeza del mástil
      return mbGeo(mb);
    })();
    // rueda de pisar: aro y radios (plano XY, eje Z)
    const wheelGeo = (function () {
      const mb = MB();
      mbGeom(mb, new THREE.TorusGeometry(2.4, 0.2, 6, 20), new THREE.Matrix4(), cW);
      for (let k = 0; k < 6; k++) mbBox(mb, 0, 0, 0, 4.8, 0.12, 0.12, cW, 0, 0, k * Math.PI / 3);
      return mbGeo(mb);
    })();
    const menWheelIM = mkIM(new THREE.BoxGeometry(0.34, 0.6, 0.24), MAT.cloth, 4, false);
    const menHeadIM = mkIM(new THREE.SphereGeometry(0.13, 6, 4), MAT.skin, 4, false);
    const _cm = new THREE.Matrix4(), _cp = new THREE.Vector3(), _cs = new THREE.Vector3(1, 1, 1), _cq = new THREE.Quaternion();
    for (let k = 0; k < 4; k++) {
      const a = k * TAU / 4;
      _cp.set(Math.cos(a) * 1.9, Math.sin(a) * 1.9, 0); _cq.setFromAxisAngle(_yAxis, 0);
      _cm.compose(_cp, _cq, _cs); menWheelIM.setMatrixAt(k, _cm);
      _cp.set(Math.cos(a) * 1.85, Math.sin(a) * 1.85 + 0.42, 0);
      _cm.compose(_cp, _cq, _cs); menHeadIM.setMatrixAt(k, _cm);
    }
    menWheelIM.instanceMatrix.needsUpdate = true;
    menHeadIM.instanceMatrix.needsUpdate = true;
    const ropeMesh = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1, 0.06), MAT.woodDk);
    const hookBlockGeo = new THREE.BoxGeometry(2.4, 1.2, 1.2);
    // constructor de grúa: grupo con armazón, rueda (girando con s.wall), bloque colgando
    function makeCrane(withWheel) {
      const g = new THREE.Group();
      const frame = new THREE.Mesh(craneFrameGeo, MAT.wood);
      frame.castShadow = true;
      g.add(frame);
      const rope = new THREE.Mesh(ropeMesh.geometry, MAT.woodDk);
      const block = new THREE.Mesh(hookBlockGeo, MAT.stone);
      block.castShadow = true;
      g.add(rope, block);
      let wheel = null;
      if (withWheel) {
        wheel = new THREE.Group();
        wheel.position.set(-2.6, 3.0, 0.6);
        const wm = new THREE.Mesh(wheelGeo, MAT.wood);
        wm.castShadow = true;
        wheel.add(wm);
        const men = new THREE.Group();
        men.add(menWheelIM.clone(), menHeadIM.clone());
        wheel.add(men);
        g.add(wheel);
      }
      g.userData = { rope: rope, block: block, wheel: wheel };
      root.add(g);
      return g;
    }
    // dos grúas sobre la cima (posición en la cima a la altura build*111)
    const TOPC = [{ a: 3.4, r: 1.0 }, { a: 4.0, r: 1.0 }].map(function (c) { c.g = makeCrane(true); return c; });
    // grúa de descarga del muelle, sobre el pantalán, girando hacia la barcaza
    const quayCrane = makeCrane(false);
    quayCrane.position.set(QUAY_PIER.x, 0, QUAY_PIER.z);
    quayCrane.rotation.y = -headingOf(QUAY_BARGE.x - QUAY_PIER.x, QUAY_BARGE.z - QUAY_PIER.z);
    // andamios: postes y tablones alrededor de la franja en construcción (~8 m bajo la cima)
    const NPOST = 80, NBRD = 160;
    const postIM = mkIM(new THREE.BoxGeometry(0.22, 8, 0.22), MAT.wood, NPOST, true);
    const boardIM = mkIM(new THREE.BoxGeometry(1.8, 0.14, 0.5), MAT.wood, NBRD, true);
    root.add(postIM, boardIM);

    function updateCranes(s) {
      const W = s.wall, b = clamp(s.build, 0, 1);
      const yt = b * TOWER.H;
      const topOn = b > 0.1 && b < 0.97 && s.cranes > 0.5 && s.collapse <= 0.001 && yt > 8;
      // grúas de la cima
      TOPC.forEach(function (C, k) {
        const g = C.g;
        g.visible = topOn;
        if (!topOn) return;
        const rr = rimR(yt) * C.r;
        const cx = Math.cos(C.a) * rr, cz = Math.sin(C.a) * rr;
        g.position.set(cx, yt, cz);
        g.rotation.y = -C.a + 0.12 * Math.sin(W * 0.25 + k * 2);
        const ud = g.userData;
        const ropeLen = 3.8 + 1.4 * (0.5 + 0.5 * Math.sin(W * 0.5 + k));
        ud.rope.position.set(12.5, 13.2 - ropeLen / 2, 0);
        ud.rope.scale.set(1, ropeLen, 1);
        ud.block.position.set(12.5, 13.2 - ropeLen - 0.6, 0);
        if (ud.wheel) ud.wheel.rotation.z = -W * 0.9;
      });
      // grúa del muelle: visible mientras hay barcazas
      quayCrane.visible = s.barges > 0.002 && s.collapse <= 0.001;
      if (quayCrane.visible) {
        const ql = 3.5 + 2.5 * (0.5 + 0.5 * Math.sin(W * 0.4));
        quayCrane.userData.rope.position.set(12.5, 13.2 - ql / 2, 0);
        quayCrane.userData.rope.scale.set(1, ql, 1);
        quayCrane.userData.block.position.set(12.5, 13.2 - ql - 0.6, 0);
      }
      // andamios: una fila de postes y tablones a ~8 m bajo la cima, en el arco sur-oeste
      // andamio pegado a las caras (1 m fuera de la pared), con la forma de cada cuerpo:
      // cuadrado con postes en las esquinas (cuerpo 1), octogonal (cuerpo 2), circular (cilindro)
      const scOn = b > 0.2 && yt > 22 && s.cranes > 0.5 && s.collapse <= 0.001 && b < 0.97;
      const sy = yt - 8;
      const P = scOn ? scaffoldPts(sy, 1.0) : null;
      const keep = [];
      let np = 0;
      if (P) {
        for (let k = 0; k < P.length; k++) {
          const kp = inSector(P[k]);
          keep.push(kp);
          if (kp && np < NPOST) { setPRS(postIM, np, P[k][0], sy, P[k][1], 0); np++; }
        }
      }
      for (let k = np; k < NPOST; k++) setPRS(postIM, k, 0, -60, 0, 0, 0.0001, 0.0001, 0.0001);
      // tablones entre postes consecutivos, a dos alturas
      let nb = 0;
      if (P) {
        for (let k = 0; k + 1 < P.length; k++) {
          if (!keep[k] || !keep[k + 1]) continue;
          const A = P[k], B = P[k + 1];
          const dx = B[0] - A[0], dz = B[1] - A[1], L = Math.hypot(dx, dz);
          const mx = (A[0] + B[0]) / 2, mz = (A[1] + B[1]) / 2, ry = headingOf(dx, dz);
          for (let lv = 0; lv < 2 && nb < NBRD; lv++) {
            setPRS(boardIM, nb, mx, sy + (lv ? 2.2 : -2.2), mz, ry, L / 1.8, 1, 1);
            nb++;
          }
        }
      }
      for (let k = nb; k < NBRD; k++) setPRS(boardIM, k, 0, -60, 0, 0, 0.0001, 0.0001, 0.0001);
      postIM.instanceMatrix.needsUpdate = true;
      boardIM.instanceMatrix.needsUpdate = true;
    }

    // =====================================================================
    // 5. PLOMO FUNDIDO (s.lead, t 66-77): tres crisoles sobre el podio, vertiendo en las juntas
    //    entre bloques en el arco sureste; resplandor moderado, chispas y humo.
    // =====================================================================
    const leadG = new THREE.Group();
    root.add(leadG);
    const NCR = 3, PT_R = 21.5, PT_Y = 6.0;
    const POUR_ANG = [0.35, 0.6, 0.85];
    const crucibleIM = mkIM(new THREE.CylinderGeometry(1.0, 0.7, 1.1, 10, 1, true), MAT.iron, NCR, true);
    const poolIM = mkIM(new THREE.CircleGeometry(0.9, 12).rotateX(-Math.PI / 2), MAT.lead, NCR, false);
    const streamIM = mkIM(new THREE.CylinderGeometry(0.16, 0.12, 1, 8), MAT.lead, NCR, false);
    const glowIM = mkIM(new THREE.CylinderGeometry(0.55, 0.35, 1, 8), MAT.glow, NCR, false);
    leadG.add(crucibleIM, poolIM, streamIM, glowIM);
    const NSM = 70, smokePos = new Float32Array(NSM * 3);
    const smokeGeo = new THREE.BufferGeometry();
    smokeGeo.setAttribute('position', new THREE.BufferAttribute(smokePos, 3));
    const smokePts = new THREE.Points(smokeGeo, MAT.smoke);
    smokePts.frustumCulled = false;
    const NSP = 40, sparkPos = new Float32Array(NSP * 3);
    const sparkGeo = new THREE.BufferGeometry();
    sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
    const sparkPts = new THREE.Points(sparkGeo, MAT.spark);
    sparkPts.frustumCulled = false;
    leadG.add(smokePts, sparkPts);

    function updateLead(s) {
      const f = clamp(s.lead, 0, 1), W = s.wall;
      leadG.visible = f > 0.002;
      if (!leadG.visible) return;
      for (let k = 0; k < NCR; k++) {
        const a = POUR_ANG[k];
        const cx = Math.cos(a) * PT_R, cz = Math.sin(a) * PT_R;
        const fk = clamp(f * 1.25 - k * 0.12, 0, 1);
        const ix = -Math.cos(a) * 0.9, iz = -Math.sin(a) * 0.9;     // el chorro cae hacia el centro
        setPRS(crucibleIM, k, cx, PT_Y + 0.55, cz, -a);
        setPRS(poolIM, k, cx, PT_Y + 1.06, cz, 0, fk > 0.01 ? 1 : 0.0001, 1, fk > 0.01 ? 1 : 0.0001);
        const Ls = 1.8 * fk;
        setPRS(streamIM, k, cx + ix, PT_Y + 1.0 - Ls / 2, cz + iz, 0, 1, Math.max(Ls, 0.0001), 1);
        setPRS(glowIM, k, cx + ix, PT_Y + 0.5, cz + iz, 0, 1, Math.max(0.8 * fk, 0.0001), 1);
      }
      crucibleIM.instanceMatrix.needsUpdate = true;
      poolIM.instanceMatrix.needsUpdate = true;
      streamIM.instanceMatrix.needsUpdate = true;
      glowIM.instanceMatrix.needsUpdate = true;
      // humo: asciende desde las juntas, deriva con el viento
      const nS = Math.round(NSM * clamp(f * 2, 0, 1));
      smokeGeo.setDrawRange(0, nS);
      for (let i = 0; i < NSM; i++) {
        const k = i % NCR, a = POUR_ANG[k];
        const age = frac(W * 0.22 + hash(i + 3000));
        const bx = Math.cos(a) * PT_R + (-Math.cos(a)) * 0.9, bz = Math.sin(a) * PT_R + (-Math.sin(a)) * 0.9;
        smokePos[i * 3] = bx + (hash(i + 3100) - 0.5) * 1.5 + age * 3.0;
        smokePos[i * 3 + 1] = PT_Y + 1.5 + age * 11;
        smokePos[i * 3 + 2] = bz + (hash(i + 3200) - 0.5) * 1.5 + age * 1.5;
      }
      smokeGeo.attributes.position.needsUpdate = true;
      // chispas en el punto de impacto
      const nP = Math.round(NSP * clamp((f - 0.4) * 2, 0, 1));
      sparkGeo.setDrawRange(0, nP);
      for (let i = 0; i < NSP; i++) {
        const k = i % NCR, a = POUR_ANG[k];
        const age = frac(W * 1.3 + hash(i + 4000));
        sparkPos[i * 3] = Math.cos(a) * PT_R - Math.cos(a) * 0.9 + (hash(i + 4100) - 0.5) * 1.6 * age;
        sparkPos[i * 3 + 1] = PT_Y + 0.4 + age * 1.8;
        sparkPos[i * 3 + 2] = Math.sin(a) * PT_R - Math.sin(a) * 0.9 + (hash(i + 4200) - 0.5) * 1.6 * age;
      }
      sparkGeo.attributes.position.needsUpdate = true;
    }

    // =====================================================================
    // update: cada grupo depende solo de s (sin acumular)
    // =====================================================================
    // muestras (cada 2.4 m) sobre el contorno poligonal de la torre a la altura y, desplazado off
    // hacia fuera. Convención: punto = (R sin θ, R cos θ). Cuadrado en las esquinas, octógono con
    // la fase de pharos.js (vértices en -π/8 + k·π/4, expresado aquí como π/8), círculo en el cilindro.
    function scaffoldPts(y, off) {
      let n, apo, ph;
      if (y < TOWER.tier2.y0) { n = 4; apo = TOWER.tier1HalfAt(Math.max(TOWER.tier1.y0, Math.min(TOWER.tier1.y1, y))) + off; ph = Math.PI / 4; }
      else if (y < TOWER.tier3.y0) { n = 8; apo = TOWER.tier2.radius * Math.cos(Math.PI / 8) + off; ph = Math.PI / 8; }
      else { n = 32; apo = TOWER.tier3.radius * Math.cos(Math.PI / 32) + off; ph = 0; }
      const Rv = apo / Math.cos(Math.PI / n);
      const V = [];
      for (let k = 0; k <= n; k++) { const th = ph + k * TAU / n; V.push([Rv * Math.sin(th), Rv * Math.cos(th)]); }
      const out = [];
      for (let k = 0; k < n; k++) {
        const A = V[k], B = V[k + 1];
        const m = Math.max(1, Math.round(Math.hypot(B[0] - A[0], B[1] - A[1]) / 2.4));
        for (let j = 0; j < m; j++) { const f = j / m; out.push([A[0] + (B[0] - A[0]) * f, A[1] + (B[1] - A[1]) * f]); }
      }
      return out;
    }
    // sector de obra: ángulo a = atan2(x, z) entre 1.3 y 4.6 rad (sur-oeste), fuera del lado de la cámara
    function inSector(p) {
      let a = Math.atan2(p[0], p[1]);
      if (a < 0) a += TAU;
      return a >= 1.3 && a <= 4.6;
    }
    // contorno de la torre a la altura y, ángulo a, desplazado off metros hacia fuera de la pared
    function outlineAt(y, a, off) {
      const s = Math.sin(a), c = Math.cos(a);
      if (y < TOWER.tier2.y0) {
        const h = TOWER.tier1HalfAt(Math.max(TOWER.tier1.y0, Math.min(TOWER.tier1.y1, y))) + off;
        const m = Math.max(Math.abs(s), Math.abs(c));
        return [s / m * h, c / m * h];
      }
      const R = (y < TOWER.tier3.y0 ? TOWER.tier2.radius * Math.cos(Math.PI / 8) : TOWER.tier3.radius * Math.cos(Math.PI / 32)) + off;
      return [s * R, c * R];
    }

    // barcaza grande (~25 m) con granito rojo y caliza: pasa por (110,·,240) hacia el muelle (t 35-58)
    const HERO_P0 = [128, 292], HERO_P1 = [92, 188];
    const HERO_HD = headingOf(HERO_P1[0] - HERO_P0[0], HERO_P1[1] - HERO_P0[1]);
    const heroG = new THREE.Group();
    root.add(heroG);
    let heroOarR = null, heroOarL = null;
    (function buildHero() {
      const hMB = MB();
      const cW = new THREE.Color(0x6e4a2a), cIn = new THREE.Color(0x4f3519);
      mbBox(hMB, 0, 0.4, 0, 25, 0.8, 7, cW);                    // casco
      mbBox(hMB, 0, 1.2, 3.4, 25, 1.2, 0.35, cW);               // bordas
      mbBox(hMB, 0, 1.2, -3.4, 25, 1.2, 0.35, cW);
      mbBox(hMB, 12.6, 1.2, 0, 0.35, 1.2, 7, cW);
      mbBox(hMB, -12.6, 1.2, 0, 0.35, 1.2, 7, cW);
      mbBox(hMB, 0, 0.85, 0, 24.2, 0.1, 6.2, cIn);              // cubierta
      mbBox(hMB, 0, 6.5, 0, 0.35, 11, 0.35, cW);                // mástil
      mbBox(hMB, 0, 11.6, 0, 0.12, 0.12, 8, cW, 0, 0, Math.PI / 2); // verga
      const hull = new THREE.Mesh(mbGeo(hMB), MAT.woodVC);
      hull.castShadow = true; hull.receiveShadow = true;
      heroG.add(hull);
      // vela cuadra (plano YZ)
      const sailG = new THREE.PlaneGeometry(6.4, 7, 4, 4);
      sailG.rotateY(Math.PI / 2); sailG.translate(0, 8.4, 0);
      sailG.computeVertexNormals();
      const sail = new THREE.Mesh(sailG, MAT.sail);
      sail.castShadow = true;
      heroG.add(sail);
      // carga: 10 bloques, granito (impares) y caliza (pares), en dos hileras
      const blocks = mkIM(new THREE.BoxGeometry(1, 1, 1), MAT.granite, 10, true);
      for (let k = 0; k < 10; k++) {
        const row = Math.floor(k / 5), col = k % 5;
        const granite = (k % 2) === 0;
        const sz = granite ? [3.0, 1.4, 1.4] : [2.4, 1.2, 1.2];
        setPRS(blocks, k, -9 + col * 4.5, 0.9 + sz[1] / 2, -1.4 + row * 2.8, 0, sz[0], sz[1], sz[2]);
        blocks.setColorAt(k, _c3.setHex(granite ? 0xd9978a : 0xd9c69a));
      }
      blocks.instanceMatrix.needsUpdate = true;
      blocks.instanceColor.needsUpdate = true;
      heroG.add(blocks);
      // remos: 8 por banda, pivotan en la borda
      const oarG = new THREE.BoxGeometry(0.12, 0.12, 4.5).translate(0, 0, 2.25);
      heroOarR = mkIM(oarG, MAT.wood, 8, false);
      heroOarL = mkIM(oarG, MAT.wood, 8, false);
      heroG.add(heroOarR, heroOarL);
    })();
    function updateHero(s) {
      const t = s.t, W = s.wall;
      const on = t >= 35 && t <= 58 && s.barges > 0.002;
      heroG.visible = on;
      if (!on) return;
      const u = clamp((t - 35) / 18, 0, 1);
      const x = HERO_P0[0] + (HERO_P1[0] - HERO_P0[0]) * u, z = HERO_P0[1] + (HERO_P1[1] - HERO_P0[1]) * u;
      heroG.position.set(x, SEA + 0.3 + 0.06 * Math.sin(W * 1.1), z);
      heroG.rotation.y = HERO_HD;
      for (let k = 0; k < 8; k++) {
        const ang = 0.45 * Math.sin(W * 2.2 + k * 0.4), xo = -10 + k * 2.8;
        _tm.makeTranslation(xo, 1.1, 3.7); _rm.makeRotationY(ang);
        _lm.copy(_tm).multiply(_rm); heroOarR.setMatrixAt(k, _lm);
        _tm.makeTranslation(xo, 1.1, -3.7); _rm.makeRotationY(-ang);
        _lm.copy(_tm).multiply(_rm).multiply(_rm.makeScale(1, 1, -1)); heroOarL.setMatrixAt(k, _lm);
      }
      heroOarR.instanceMatrix.needsUpdate = true;
      heroOarL.instanceMatrix.needsUpdate = true;
    }

    function update(s) {
      updateHero(s);
      updateBoats(s);
      updateBarges(s);
      updateWorkers(s);
      updateCranes(s);
      updateLead(s);
    }

    return { update: update, group: root };
  };
})();
