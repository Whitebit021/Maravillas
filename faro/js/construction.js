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
      smoke:    new THREE.PointsMaterial({ color: 0xd0cabc, size: 5.5, transparent: true, opacity: 0.38, depthWrite: false }),
      spark:    new THREE.PointsMaterial({ color: 0xffc070, size: 1.3, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending })
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
    cargoIM.setColorAt = cargoIM.setColorAt; // (se colorea abajo)
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
    const _ref = new THREE.Vector3();
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
    const _cargoCols = [0xd9978a, 0xc97e70, 0xb9b09a, 0xd9c69a];

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
          _tm.makeTranslation(-5.0 + (c % 3) * 3.2, 1.6 + Math.floor(c / 3) * 1.2, 0);
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
        const onBoat = t < t0 ? 1 : 0;
        // posición sobre cubierta (o en el aire, entre la barcaza y la pila)
        const sx = qb.x + Math.cos(qb.hd) * (-5 + (c % 3) * 3.2);
        const sz = qb.z + Math.sin(qb.hd) * (-5 + (c % 3) * 3.2);
        const k = STACK[c];
        const bx = sx + (k.x - sx) * sstep(p), bz = sz + (k.z - sz) * sstep(p);
        const by = (1.6 + Math.floor(c / 3) * 1.2) + (k.y - (1.6 + Math.floor(c / 3) * 1.2)) * sstep(p) + Math.sin(Math.PI * p) * 6 * (p > 0 && p < 1 ? 1 : 0);
        const lift = t < t0 ? 1 : (p >= 1 ? 1 : 1);
        _tm.makeTranslation(bx, by + SEA + 0.3, bz);
        _rm.makeRotationY(qb.hd);
        _lm.copy(_tm).multiply(_rm).multiply(_rm.makeScale(b, b, b));
        blockIM.setMatrixAt(bi * 6 + c, _lm);
      }
      bargeIM.instanceMatrix.needsUpdate = true;
      blockIM.instanceMatrix.needsUpdate = true;
    }
