// Construcción de Olimpia para la Estatua de Zeus: estadio con atletas, público y juez; obra del templo con
// grúas de madera y bloques; taller de Fidias (artesanos, colmillos en remojo, oro, moldes, hornos, carros de
// placas); andamios dentro de la cella y peregrinos con lámparas. Todo procedural. Función pura del estado s;
// W (reloj) solo anima. Figuras: miran a +Z local; grúas: a +X local.
(function () {
  'use strict';
  const G = window.GIZA;

  G.createConstruction = function (ctx) {
    const THREE = ctx.THREE, scene = ctx.scene, renderer = ctx.renderer;
    const root = new THREE.Group();
    scene.add(root);

    const SITE = G.SITE;
    const TAU = Math.PI * 2;
    const _yAxis = new THREE.Vector3(0, 1, 0);
    const IDM = new THREE.Matrix4();

    // ---------- utilidades ----------
    function V(x) { return typeof x === 'number' && isFinite(x) ? x : 0; }
    function clamp(x, a, b) { return x < a ? a : (x > b ? b : x); }
    function frac(x) { return x - Math.floor(x); }
    function fmod(a, m) { return ((a % m) + m) % m; }
    function sstep(x) { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); }
    function hash(n) { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
    function pingPong(d, L) { const p = frac(d / (2 * L)); return p < 0.5 ? 2 * p : 2 - 2 * p; }
    function hZ(dx, dz) { return Math.atan2(dx, dz); }
    function hX(dx, dz) { return Math.atan2(-dz, dx); }
    function faceZ(x, z, tx, tz) { return Math.atan2(tx - x, tz - z); }
    function polyline(pts) {
      const segs = []; let L = 0;
      for (let i = 1; i < pts.length; i++) {
        const dx = pts[i][0] - pts[i - 1][0], dz = pts[i][1] - pts[i - 1][1], l = Math.hypot(dx, dz);
        segs.push({ a: pts[i - 1], dx: dx / l, dz: dz / l, l0: L, l: l }); L += l;
      }
      return {
        L: L,
        at: function (u) {
          const d = clamp(u, 0, 1) * L; let sg = segs[segs.length - 1];
          for (let i = 0; i < segs.length; i++) { if (d <= segs[i].l0 + segs[i].l) { sg = segs[i]; break; } }
          const k = clamp((d - sg.l0) / sg.l, 0, 1);
          return [sg.a[0] + sg.dx * sg.l * k, sg.a[1] + sg.dz * sg.l * k, sg.dx, sg.dz];
        }
      };
    }

    // ---------- entorno (reflejos del mármol y del oro: cielo degradado en PMREM) ----------
    const envTex = (function () {
      const pm = new THREE.PMREMGenerator(renderer);
      const es = new THREE.Scene();
      const geo = new THREE.SphereGeometry(100, 16, 10);
      const pos = geo.attributes.position, col = [];
      const top = new THREE.Color(0x8fbfe6), hor = new THREE.Color(0xf1e6cf), bot = new THREE.Color(0x2c4f5e);
      const c = new THREE.Color();
      for (let i = 0; i < pos.count; i++) {
        const y = pos.getY(i) / 100;
        if (y >= 0) c.copy(hor).lerp(top, Math.pow(y, 0.6)); else c.copy(hor).lerp(bot, Math.min(1, -y * 3));
        col.push(c.r, c.g, c.b);
      }
      geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      es.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
      const rt = pm.fromScene(es, 0.02);
      pm.dispose();
      return rt.texture;
    })();

    // ---------- materiales ----------
    // vertexColors: geometría fusionada (MB). Planos (sin vertexColors): primitivas con instanceColor.
    const M = {
      stone: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78 }),
      wood: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }),
      track: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }),
      cup: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.2, metalness: 0.05, envMap: envTex, envMapIntensity: 0.7 }),
      gold: new THREE.MeshStandardMaterial({ color: 0xd4a63c, metalness: 1, roughness: 0.28, envMap: envTex, envMapIntensity: 1.1 }),
      marble: new THREE.MeshStandardMaterial({ color: 0xe7dcc4, roughness: 0.7 }),
      woodP: new THREE.MeshStandardMaterial({ color: 0x7a5230, roughness: 0.9 }),
      ivory: new THREE.MeshStandardMaterial({ color: 0xf0e6cf, roughness: 0.5 }),
      bronze: new THREE.MeshStandardMaterial({ color: 0x9a7a3a, metalness: 0.6, roughness: 0.4, envMap: envTex, envMapIntensity: 0.8 }),
      rope: new THREE.MeshStandardMaterial({ color: 0xb8a070, roughness: 1 }),
      cloth: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }),
      legs: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }),
      skin: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 }),
      flag: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, side: THREE.DoubleSide }),
      flame: new THREE.MeshBasicMaterial({ color: 0xffb050 })
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
    function mbAdd(mb, geo, m, c) {
      const g = geo.clone(); g.applyMatrix4(m);
      if (!g.attributes.normal) g.computeVertexNormals();
      mbAppend(mb, g, c); g.dispose();
    }
    function mbBox(mb, x, y, z, sx, sy, sz, c, ry) {
      const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(_yAxis, ry || 0), new THREE.Vector3(1, 1, 1));
      mbAdd(mb, new THREE.BoxGeometry(sx, sy, sz), m, c);
    }
    // triángulo plano (para frontones de los extremos del taller)
    function mbTri(mb, a, b, q, c) {
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
      const vx = q[0] - a[0], vy = q[1] - a[1], vz = q[2] - a[2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
      const base = mb.p.length / 3;
      [a, b, q].forEach(function (v) { mb.p.push(v[0], v[1], v[2]); mb.n.push(nx, ny, nz); mb.c.push(c.r, c.g, c.b); });
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
    function staticMesh(mb, mat, shadow) {
      const m = new THREE.Mesh(mbGeo(mb), mat);
      m.frustumCulled = false; m.receiveShadow = true; m.castShadow = !!shadow;
      return m;
    }
    function mkIM(geo, mat, n, shadow) {
      const im = new THREE.InstancedMesh(geo, mat, n);
      im.frustumCulled = false;
      if (shadow) { im.castShadow = true; im.receiveShadow = true; }
      return im;
    }
    function T(x, y, z) { return new THREE.Matrix4().makeTranslation(x, y, z); }

    // ---------- matrices de trabajo (sin crear objetos por frame) ----------
    const _a = new THREE.Matrix4(), _b = new THREE.Matrix4(), _c = new THREE.Matrix4(), _R = new THREE.Matrix4();
    const _e = new THREE.Euler(), _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3();
    // raíz: posición, giro en Y y escala uniforme (sc = 0.0001 oculta)
    function setM(out, x, y, z, th, sc) {
      _v.set(x, y, z); _q.setFromAxisAngle(_yAxis, th || 0);
      const k = sc === undefined ? 1 : sc; _s.set(k, k, k);
      return out.compose(_v, _q, _s);
    }
    // pieza articulada: T(p)·Rot(rx,rz)·T(o)·S(s) (la pieza gira alrededor de p)
    function place(im, idx, R, px, py, pz, rx, rz, ox, oy, oz, sx, sy, sz) {
      _a.makeTranslation(px, py, pz);
      _e.set(rx || 0, 0, rz || 0, 'XYZ'); _b.makeRotationFromEuler(_e); _a.multiply(_b);
      _b.makeTranslation(ox || 0, oy || 0, oz || 0); _a.multiply(_b);
      _b.makeScale(sx === undefined ? 1 : sx, sy === undefined ? 1 : sy, sz === undefined ? 1 : sz); _a.multiply(_b);
      _c.multiplyMatrices(R, _a); im.setMatrixAt(idx, _c);
    }
    function setInst(im, idx, x, y, z, th, sc) { setM(_c, x, y, z, th, sc); im.setMatrixAt(idx, _c); }

    // =====================================================================
    // FIGURAS (obreros, artesanos, empujadores, juez): 40 instancias con brazos y piernas articulados
    //   0-7 obra del templo, 8-20 taller, 21-26 empujadores de carros, 27-30 andamios, 31 juez
    // =====================================================================
    const NF = 40;
    const fT = mkIM(new THREE.BoxGeometry(0.42, 0.66, 0.24), M.cloth, NF, true);
    const fH = mkIM(new THREE.SphereGeometry(0.14, 8, 6), M.skin, NF, false);
    const fL = mkIM(new THREE.BoxGeometry(0.19, 0.9, 0.2), M.legs, NF * 2, true);
    const fA = mkIM(new THREE.BoxGeometry(0.13, 0.66, 0.13), M.skin, NF * 2, false);
    const fTool = mkIM((function () {
      const mb = MB();
      mbBox(mb, 0, 0, 0, 0.07, 0.9, 0.07, new THREE.Color(0x7a5230));
      mbBox(mb, 0, 0.42, 0, 0.3, 0.1, 0.1, new THREE.Color(0x4a4a4a));
      return mbGeo(mb);
    })(), M.wood, NF, false);
    const figG = new THREE.Group(); root.add(figG);
    figG.add(fT, fH, fL, fA, fTool);
    (function () {
      const CLOTH = [0xd9c9a3, 0xb8794a, 0x3d6f9e, 0xe6e0d0, 0x8c3b2a, 0x6b8a4e, 0xc9a24a];
      const SKIN = [0x8c5a3a, 0x9a6a46, 0x7a4b30, 0xa87850];
      const LEGS = [0x5b4a36, 0x6b5a42, 0x3a3a40, 0x7a6a50];
      for (let i = 0; i < NF; i++) {
        fT.setColorAt(i, new THREE.Color(CLOTH[i % CLOTH.length]));
        fH.setColorAt(i, new THREE.Color(SKIN[i % SKIN.length]));
        fA.setColorAt(2 * i, new THREE.Color(SKIN[i % SKIN.length]));
        fA.setColorAt(2 * i + 1, new THREE.Color(SKIN[i % SKIN.length]));
        fL.setColorAt(2 * i, new THREE.Color(LEGS[i % LEGS.length]));
        fL.setColorAt(2 * i + 1, new THREE.Color(LEGS[i % LEGS.length]));
      }
      fT.setColorAt(31, new THREE.Color(0x8c3b2a));   // juez: túnica roja
      [fT, fH, fA, fL].forEach(function (im) { if (im.instanceColor) im.instanceColor.needsUpdate = true; });
    })();
    const PF = { ll: 0, lr: 0, al: 0, ar: 0, lean: 0, tool: 0 };
    function pose(ll, lr, al, ar, lean, tool) { PF.ll = ll; PF.lr = lr; PF.al = al; PF.ar = ar; PF.lean = lean; PF.tool = tool; }
    const _FR = new THREE.Matrix4();
    function drawFig(i, R) {
      place(fT, i, R, 0, 1.25, 0, PF.lean, 0, 0, 0, 0, 1, 1, 1);
      place(fH, i, R, 0, 1.25, 0, PF.lean, 0, 0, 0.45, 0, 1, 1, 1);
      place(fL, 2 * i, R, -0.11, 0.9, 0, PF.ll, 0, 0, -0.45, 0, 1, 1, 1);
      place(fL, 2 * i + 1, R, 0.11, 0.9, 0, PF.lr, 0, 0, -0.45, 0, 1, 1, 1);
      place(fA, 2 * i, R, -0.27, 1.5, 0, PF.al, 0, 0, -0.33, 0, 1, 1, 1);
      place(fA, 2 * i + 1, R, 0.27, 1.5, 0, PF.ar, 0, 0, -0.33, 0, 1, 1, 1);
      const tl = PF.tool ? 1 : 0.0001;
      place(fTool, i, R, 0.27, 1.5, 0, PF.ar, 0, 0, -0.72, 0.1, tl, tl, tl);
    }
    function figAt(i, x, y, z, th, sc) { setM(_FR, x, y, z, th, sc); drawFig(i, _FR); }
    function flushFigs() { [fT, fH, fL, fA, fTool].forEach(function (im) { im.instanceMatrix.needsUpdate = true; }); }
    function fs(x) { return Math.max(0.0001, x); }

    // =====================================================================
    // 1. ESTADIO (games): pista con carriles, taludes escalonados con público sentado, banderines, atletas
    // =====================================================================
    const gamesG = new THREE.Group(); root.add(gamesG);
    const ST = SITE.stadium;
    const SX0 = ST.x - ST.length / 2, SX1 = ST.x + ST.length / 2;
    const SZN = ST.z - ST.width / 2, SZS = ST.z + ST.width / 2;
    (function buildTrack() {
      const mb = MB(), cT = new THREE.Color(0xb9794a), cL = new THREE.Color(0xf2e6cf);
      mbBox(mb, ST.x, 0.015, ST.z, ST.length, 0.03, ST.width, cT);
      for (let k = 0; k <= 8; k++) mbBox(mb, ST.x, 0.045, SZN + k * ST.width / 8, ST.length, 0.02, 0.12, cL);
      mbBox(mb, SX0 + 6, 0.05, ST.z, 0.2, 0.02, ST.width, cL);   // línea de salida
      mbBox(mb, SX1 - 6, 0.05, ST.z, 0.2, 0.02, ST.width, cL);   // meta
      gamesG.add(staticMesh(mb, M.track, false));
    })();
    const FLAGS = [];
    (function buildBanks() {
      const mb = MB(), cA = new THREE.Color(0xd8ccb0), cB = new THREE.Color(0xc4b493), cW = new THREE.Color(0x7a5230);
      for (let side = -1; side <= 1; side += 2) {
        for (let r = 0; r < 10; r++) {
          const top = 0.45 * (r + 1);
          const zc = side < 0 ? SZN - 1.2 * r - 0.6 : SZS + 1.2 * r + 0.6;
          mbBox(mb, ST.x, top / 2, zc, ST.length, top, 1.2, r % 2 ? cB : cA);
        }
        const zTop = side < 0 ? SZN - 1.2 * 9 - 0.6 : SZS + 1.2 * 9 + 0.6;
        for (let i = 0; i < 16; i++) {
          const x = SX0 + 6 + i * 12;
          mbBox(mb, x, 4.5 + 1.5, zTop, 0.08, 3.0, 0.08, cW);
          FLAGS.push([x, 6.9, zTop]);
        }
      }
      gamesG.add(staticMesh(mb, M.wood, false));
    })();
    const NFL = FLAGS.length;
    const flagIM = mkIM(new THREE.PlaneGeometry(1.0, 0.6).translate(0.5, 0, 0), M.flag, NFL, false);
    (function () {
      const cols = [0x8c3b2a, 0x2a4d8f, 0xf2e6cf, 0xd4a63c];
      for (let i = 0; i < NFL; i++) flagIM.setColorAt(i, new THREE.Color(cols[i % cols.length]));
      flagIM.instanceColor.needsUpdate = true;
    })();
    gamesG.add(flagIM);

    // público sentado en los escalones (determinista, precalculado)
    const SEATS = [];
    for (let side = -1; side <= 1; side += 2) {
      for (let r = 0; r < 10; r++) {
        for (let k = 0; k < 30; k++) {
          if (hash(k * 31 + r * 7 + (side > 0 ? 101 : 3)) < 0.22) continue;
          const x = SX0 + 3 + k * 6.4 + (hash(k + r * 13 + (side > 0 ? 57 : 9)) - 0.5) * 2;
          const zc = side < 0 ? SZN - 1.2 * r - 0.6 : SZS + 1.2 * r + 0.6;
          const z = zc + (hash(k * 5 + r * 3 + 17) - 0.5) * 0.3;
          SEATS.push([x, 0.45 * (r + 1), z, side < 0 ? 0 : Math.PI]);
        }
      }
    }
    const NSP = SEATS.length;
    const spT = mkIM(new THREE.BoxGeometry(0.42, 0.5, 0.26), M.cloth, NSP, true);
    const spH = mkIM(new THREE.SphereGeometry(0.13, 6, 4), M.skin, NSP, false);
    const spL = mkIM((function () {
      const mb = MB(), c = new THREE.Color(0xffffff);
      mbBox(mb, 0, 0.1, 0.25, 0.4, 0.2, 0.5, c);     // muslos
      mbBox(mb, 0, -0.12, 0.55, 0.36, 0.45, 0.16, c); // piernas
      return mbGeo(mb);
    })(), M.legs, NSP, true);
    gamesG.add(spT, spH, spL);
    (function () {
      const CLOTH = [0xf2ead8, 0xd9c9a3, 0x3d6f9e, 0x8c3b2a, 0xb8794a, 0xe6e0d0, 0x6b8a4e];
      const SKIN = [0x8c5a3a, 0x9a6a46, 0x7a4b30, 0xa87850];
      SEATS.forEach(function (S, i) {
        spT.setColorAt(i, new THREE.Color(CLOTH[Math.floor(hash(i + 5) * CLOTH.length)]));
        spH.setColorAt(i, new THREE.Color(SKIN[Math.floor(hash(i + 9) * SKIN.length)]));
        spL.setColorAt(i, new THREE.Color(hash(i + 3) < 0.5 ? 0x5a4a36 : 0x3a3a40));
        setM(_R, S[0], S[1], S[2], S[3], 1);
        place(spT, i, _R, 0, 0.45, 0, 0, 0, 0, 0, 0, 1, 1, 1);
        place(spH, i, _R, 0, 0.85, 0, 0, 0, 0, 0, 0, 1, 1, 1);
        place(spL, i, _R, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1);
      });
      [spT, spH, spL].forEach(function (im) { im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true; });
    })();

    // atletas corriendo en su carril (posición función de t; las piernas, de W)
    const NRUN = 8;
    const rTorso = mkIM(new THREE.BoxGeometry(0.34, 0.6, 0.22), M.skin, NRUN, true);
    const rHead = mkIM(new THREE.SphereGeometry(0.12, 8, 6), M.skin, NRUN, false);
    const rLimb = mkIM(new THREE.BoxGeometry(0.14, 0.9, 0.14), M.skin, NRUN * 4, true);
    gamesG.add(rTorso, rHead, rLimb);
    (function () {
      const SKIN = [0xa0704a, 0x8c5a3a, 0xb98660, 0x7a4b30];
      for (let i = 0; i < NRUN; i++) {
        const col = new THREE.Color(SKIN[i % SKIN.length]);
        rTorso.setColorAt(i, col); rHead.setColorAt(i, col);
        for (let k = 0; k < 4; k++) rLimb.setColorAt(4 * i + k, col);
      }
      [rTorso, rHead, rLimb].forEach(function (im) { im.instanceColor.needsUpdate = true; });
    })();

    // juez: figura 31, al borde de la meta, de pie sobre el primer escalón
    const JUDGE = [290, 0.45, -104.2];

    function updGames(W, t, g) {
      for (let i = 0; i < NRUN; i++) {
        const x = SX0 + fmod((t - 18) * 7 + i * 24, ST.length);
        const z = SZN + (i + 0.5) * ST.width / 8;
        setM(_R, x, 0, z, Math.PI / 2, fs(g));
        const sw = Math.sin(W * 9 + i * 1.3);
        place(rTorso, i, _R, 0, 1.25, 0, 0.12, 0, 0, 0, 0, 1, 1, 1);
        place(rHead, i, _R, 0, 1.7, 0.02, 0, 0, 0, 0, 0, 1, 1, 1);
        place(rLimb, 4 * i, _R, -0.12, 0.9, 0, 0.8 * sw, 0, 0, -0.45, 0, 1, 1, 1);      // pierna izq.
        place(rLimb, 4 * i + 1, _R, 0.12, 0.9, 0, -0.8 * sw, 0, 0, -0.45, 0, 1, 1, 1);  // pierna der.
        place(rLimb, 4 * i + 2, _R, -0.24, 1.5, 0, -0.7 * sw, 0, 0, -0.3, 0, 1, 0.67, 1);
        place(rLimb, 4 * i + 3, _R, 0.24, 1.5, 0, 0.7 * sw, 0, 0, -0.3, 0, 1, 0.67, 1);
      }
      [rTorso, rHead, rLimb].forEach(function (im) { im.instanceMatrix.needsUpdate = true; });
      // banderines ondeando
      for (let i = 0; i < NFL; i++) {
        const F = FLAGS[i], fl = 0.25 * Math.sin(W * 4 + i * 0.9);
        _a.makeTranslation(F[0], F[1], F[2]); _b.makeRotationZ(fl); _a.multiply(_b);
        _b.makeScale(1, 1 + 0.12 * Math.sin(W * 5 + i), 1); _a.multiply(_b);
        flagIM.setMatrixAt(i, _a);
      }
      flagIM.instanceMatrix.needsUpdate = true;
    }
    function updJudge(g) { figAt(31, JUDGE[0], JUDGE[1], JUDGE[2], Math.PI, fs(g)); }

    // =====================================================================
    // 2. OBRA DEL TEMPLO (workers): grúas de madera junto al templo, bloques y tambores, obreros
    //    (visible mientras el templo se construye: temple 0..1 en t 38..58)
    // =====================================================================
    const siteG = new THREE.Group(); root.add(siteG);
    const CRANE = [[48, -24, hX(-48, 24)], [-46, 26, hX(46, -26)]];   // x, z, giro (pluma hacia el templo)
    const craneFrameG = (function () {
      const mb = MB(), cW = new THREE.Color(0x6e4a2a), cD = new THREE.Color(0x3a2a1a);
      mbBox(mb, 0, 0.35, 0, 4, 0.7, 3, cW);              // plataforma
      mbBox(mb, 0, 10.7, 0, 0.5, 20, 0.5, cW);           // mástil de 20 m
      mbBox(mb, 9.5, 19.6, 0, 20, 0.35, 0.35, cW);       // pluma
      mbBox(mb, -3.2, 19.4, 0, 7, 0.3, 0.3, cW);         // contrapluma
      mbBox(mb, -6.3, 18.6, 0, 2, 1.6, 1.6, cD);         // contrapeso
      mbBox(mb, 0, 21.2, 0, 1, 0.8, 1, cW);              // cabeza del mástil
      mbBox(mb, -2, 2.2, 1.4, 0.3, 3.2, 0.3, cW);        // soporte de la rueda de pisar
      return mbGeo(mb);
    })();
    const wheelG = (function () {
      const mb = MB(), cW = new THREE.Color(0x6e4a2a);
      mbAdd(mb, new THREE.TorusGeometry(2.4, 0.2, 6, 20), new THREE.Matrix4(), cW);
      for (let k = 0; k < 6; k++) mbAdd(mb, new THREE.BoxGeometry(4.8, 0.12, 0.12), new THREE.Matrix4().makeRotationZ(k * Math.PI / 3), cW);
      return mbGeo(mb);
    })();
    const cFrameIM = mkIM(craneFrameG, M.wood, 2, true);
    const cWheelIM = mkIM(wheelG, M.wood, 2, true);
    const cRopeIM = mkIM(new THREE.BoxGeometry(0.05, 1, 0.05), M.rope, 2, false);
    const cHookIM = mkIM(new THREE.BoxGeometry(2.4, 1.2, 1.2), M.marble, 2, true);
    const cMenT = mkIM(new THREE.BoxGeometry(0.34, 0.6, 0.24), M.cloth, 8, false);
    const cMenH = mkIM(new THREE.SphereGeometry(0.13, 6, 4), M.skin, 8, false);
    siteG.add(cFrameIM, cWheelIM, cRopeIM, cHookIM, cMenT, cMenH);
    (function () {
      for (let i = 0; i < 8; i++) { cMenT.setColorAt(i, new THREE.Color(i % 2 ? 0x3d6f9e : 0xd9c9a3)); cMenH.setColorAt(i, new THREE.Color(0x8c5a3a)); }
      cMenT.instanceColor.needsUpdate = true; cMenH.instanceColor.needsUpdate = true;
    })();
    // bloques y tambores apilados junto al templo (dos pilas: NE y SO)
    const NBLK = 28, NQD = 6;
    const blockIM = mkIM(new THREE.BoxGeometry(2.4, 1.2, 1.2), M.marble, NBLK, true);
    const drumIM = mkIM((function () { const g = new THREE.CylinderGeometry(0.9, 0.9, 2.0, 20, 1); g.rotateZ(Math.PI / 2); return g; })(), M.marble, NQD, true);
    siteG.add(blockIM, drumIM);
    const PILE = [[43, -4], [-38, 20]];
    for (let i = 0; i < NBLK; i++) {
      const P = PILE[i < 16 ? 0 : 1];
      setInst(blockIM, i, P[0] + (hash(i + 1) - 0.5) * 8, 0.6 + 1.2 * Math.floor(hash(i + 3) * 2), P[1] + (hash(i + 2) - 0.5) * 8, hash(i + 4) * 0.4 - 0.2);
    }
    for (let i = 0; i < NQD; i++) {
      const P = PILE[i < 3 ? 0 : 1];
      setInst(drumIM, i, P[0] + (hash(i + 40) - 0.5) * 9, 0.9, P[1] + (hash(i + 50) - 0.5) * 9, hash(i + 60) * Math.PI);
    }
    blockIM.instanceMatrix.needsUpdate = true; drumIM.instanceMatrix.needsUpdate = true;

    function updTemple(W, siteOn) {
      const sc = fs(siteOn);
      for (let k = 0; k < 2; k++) {
        const C = CRANE[k], dir = k ? -1 : 1;
        setM(_R, C[0], 0, C[1], C[2], sc);
        cFrameIM.setMatrixAt(k, _R);
        // rueda de pisar: su centro en (-2, 3.6, 1.4) local; gira con la cuadrilla
        const wa = W * 0.9 * dir;
        _a.makeTranslation(-2, 3.6, 1.4);
        _b.multiplyMatrices(_R, _a).multiply(_c.makeRotationZ(wa));
        cWheelIM.setMatrixAt(k, _b);
        for (let m = 0; m < 4; m++) {
          const th = m * Math.PI / 2 + wa;
          _a.makeTranslation(-2 + Math.cos(th) * 1.8, 3.6 + Math.sin(th) * 1.8, 1.4);
          _b.multiplyMatrices(_R, _a);
          cMenT.setMatrixAt(k * 4 + m, _b);
          _a.makeTranslation(0, 0.45, 0);
          cMenH.setMatrixAt(k * 4 + m, _c.multiplyMatrices(_b, _a));
        }
        // polipasto: el cable y el bloque bajan y suben
        const L = 6 + 8 * (0.5 + 0.5 * Math.sin(W * 0.4 + k * 2));
        _a.compose(new THREE.Vector3(17.5, 19.6 - L / 2, 0), new THREE.Quaternion(), new THREE.Vector3(1, L, 1));
        cRopeIM.setMatrixAt(k, _b.multiplyMatrices(_R, _a));
        _a.makeTranslation(17.5, 19.6 - L - 0.6, 0);
        cHookIM.setMatrixAt(k, _b.multiplyMatrices(_R, _a));
      }
      [cFrameIM, cWheelIM, cRopeIM, cHookIM, cMenT, cMenH].forEach(function (im) { im.instanceMatrix.needsUpdate = true; });
    }
    // obreros que llevan bloques y los dejan junto al frente oriental del templo
    function updBuilders(W, siteOn) {
      for (let j = 0; j < 8; j++) {
        const d = W * 0.5 + j * 0.37, p = frac(d / 2);
        const dir = p < 0.5 ? 1 : -1;
        const x = 38 + 8 * (p < 0.5 ? 2 * p : 2 - 2 * p);
        const z = -8 + j * 2.3 + 0.6 * Math.sin(j);
        const sw = Math.sin(W * 5 + j);
        if (j % 2 === 0) pose(0.25 * sw, -0.25 * sw, -1.25, -1.25, 0.15, 0);   // lleva un bloque a cuestas
        else pose(0.45 * sw, -0.45 * sw, -0.2 * sw, 0.2 * sw, 0.05, 0);       // camina
        figAt(j, x, 0, z, hZ(dir, 0), fs(siteOn));
      }
    }

    // =====================================================================
    // 3. TALLER DE FIDIAS (workshop): edificio de piedra con muro norte abierto, tejado a dos aguas,
    //    mesas, colmillos en tinas de remojo, oro, moldes de arcilla, hornos, la estatua en maqueta,
    //    la taza en SITE.cupSpot, artesanos y carros de placas
    // =====================================================================
    const wsG = new THREE.Group(); root.add(wsG);
    const WS = SITE.workshop;
    const WX0 = WS.x - WS.halfX, WX1 = WS.x + WS.halfX, WZ0 = WS.z - WS.halfZ, WZ1 = WS.z + WS.halfZ;
    const H_EAVE = 9.5, H_RIDGE = WS.height;
    (function buildWorkshop() {
      const mb = MB(), cS = new THREE.Color(0xe7dcc4), cS2 = new THREE.Color(0xd8cdb8), cFl = new THREE.Color(0xbdb190);
      const cRoof = new THREE.Color(0x9a5b3a), cWd = new THREE.Color(0x7a5230), cWdT = new THREE.Color(0x8b6038);
      const cDk = new THREE.Color(0x2a1d14), cKiln = new THREE.Color(0x8a5a3a), cIv = new THREE.Color(0xefe6d6);
      const cBr = new THREE.Color(0x9a7a3a), cGo = new THREE.Color(0xd4a63c), cEb = new THREE.Color(0x2a1d14);

      // suelo, muros de piedra (oeste, este, sur), pilares del lado norte abierto y dintel
      mbBox(mb, WS.x, 0.06, WS.z, WX1 - WX0, 0.12, WZ1 - WZ0, cFl);
      mbBox(mb, WX0 + 0.6, H_EAVE / 2, WS.z, 1.2, H_EAVE, WZ1 - WZ0, cS);
      mbBox(mb, WX1 - 0.6, H_EAVE / 2, WS.z, 1.2, H_EAVE, WZ1 - WZ0, cS);
      mbBox(mb, WS.x, H_EAVE / 2, WZ1 - 0.6, WX1 - WX0, H_EAVE, 1.2, cS);
      for (let i = 0; i < 8; i++) mbBox(mb, WX0 + 0.5 + i * (WX1 - WX0 - 1) / 7, H_EAVE / 2, WZ0 + 0.5, 1.0, H_EAVE, 1.0, cS2);
      mbBox(mb, WS.x, 9.1, WZ0 + 0.5, WX1 - WX0 - 1, 0.8, 1.0, cS);
      // frontones de los extremos
      [WX0, WX1].forEach(function (x) {
        const A = [x, H_EAVE, WZ0], B = [x, H_EAVE, WZ1], C = [x, H_RIDGE, WS.z];
        mbTri(mb, A, B, C, cS); mbTri(mb, A, C, B, cS);
      });
      // tejado a dos aguas (cumbrera a lo largo de X)
      const slope = Math.atan2(H_RIDGE - H_EAVE, (WZ1 - WZ0) / 2 + 0.5), len = Math.hypot((WZ1 - WZ0) / 2 + 0.5, H_RIDGE - H_EAVE) + 0.3;
      [-1, 1].forEach(function (sg) {
        const zc = WS.z + sg * ((WZ1 - WZ0) / 4 + 0.25), yc = (H_EAVE + H_RIDGE) / 2 + 0.1;
        const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), sg * slope);
        mbAdd(mb, new THREE.BoxGeometry(WX1 - WX0 + 1.4, 0.4, len), new THREE.Matrix4().compose(new THREE.Vector3(WS.x, yc, zc), q, new THREE.Vector3(1, 1, 1)), cRoof);
      });
      mbBox(mb, WS.x, H_RIDGE + 0.1, WS.z, WX1 - WX0 + 1.4, 0.5, 0.7, cRoof);

      // mesas de trabajo (tapa a y=1.0)
      function table(cx, cz, w, d) {
        mbBox(mb, cx, 0.95, cz, w, 0.1, d, cWdT);
        const lx = w / 2 - 0.15, lz = d / 2 - 0.15;
        [[-lx, -lz], [lx, -lz], [-lx, lz], [lx, lz]].forEach(function (p) { mbBox(mb, cx + p[0], 0.45, cz + p[1], 0.12, 0.9, 0.12, cWd); });
      }
      table(-102.0, 8.5, 3.6, 2.2);   // maqueta
      table(-96.0, 4.0, 2.2, 1.4);    // taza
      table(-86.0, 8.0, 3.0, 1.6);    // láminas de oro
      table(-88.0, 2.5, 2.4, 1.4);    // moldes de arcilla
      table(-90.0, 11.2, 2.6, 1.1);   // banco de herramientas

      // tinas de remojo con colmillos de elefante (curvos, afinados)
      [3.5, 7.0, 10.5].forEach(function (z) {
        const tx = -107.5;
        mbAdd(mb, new THREE.CylinderGeometry(0.9, 0.8, 0.9, 16, 1, true), T(tx, 0.45, z), cWd);
        mbAdd(mb, new THREE.CircleGeometry(0.8, 16).rotateX(-Math.PI / 2), T(tx, 0.05, z), cWd);
        mbAdd(mb, new THREE.TorusGeometry(0.9, 0.05, 6, 20).rotateX(Math.PI / 2), T(tx, 0.9, z), cWd);
        mbAdd(mb, new THREE.CircleGeometry(0.82, 16).rotateX(-Math.PI / 2), T(tx, 0.78, z), new THREE.Color(0x3b3026));
        mbAppend(mb, tuskGeo(tx - 0.2, 0.3, z, -1, 1.5, 0.13), cIv);
        mbAppend(mb, tuskGeo(tx + 0.2, 0.3, z, 1, 1.5, 0.13), cIv);
      });

      // moldes de arcilla con pliegues (bandejas con relieve sinusoidal)
      mbAdd(mb, new THREE.BoxGeometry(1.2, 0.06, 0.9), T(-88.4, 1.03, 2.2), cFl);
      mbAdd(mb, moldGeo(1.1, 0.8, 0.0), T(-88.4, 1.0, 2.2), cKiln);
      mbAdd(mb, new THREE.BoxGeometry(0.9, 0.06, 0.7), T(-87.0, 1.03, 3.0), cFl);
      mbAdd(mb, moldGeo(0.8, 0.6, 1.7), T(-87.0, 1.0, 3.0), cKiln);

      // hornos pequeños con boca oscura
      kiln(-102.5, 0.2); kiln(-84.0, 0.6);
      function kiln(x, z) {
        mbAdd(mb, new THREE.SphereGeometry(1.0, 14, 8, 0, TAU, 0, Math.PI / 2), T(x, 0, z), cKiln);
        mbAdd(mb, new THREE.CylinderGeometry(0.34, 0.34, 0.12, 10).rotateX(Math.PI / 2), T(x, 0.42, z - 0.95), cDk);
      }

      // la estatua a escala (1:10) en maqueta, sobre la mesa de la maqueta
      (function maquette(bx, by, bz) {
        const P = function (x, y, z) { return T(bx + x, by + y, bz + z); };
        mbAdd(mb, new THREE.BoxGeometry(1.0, 0.1, 0.7), P(0, 0.05, 0), cEb);
        mbAdd(mb, new THREE.BoxGeometry(0.42, 0.12, 0.42), P(0, 0.16, 0), cEb);       // asiento
        mbAdd(mb, new THREE.BoxGeometry(0.08, 0.62, 0.42), P(-0.2, 0.47, 0), cEb);    // respaldo
        mbAdd(mb, new THREE.BoxGeometry(0.3, 0.05, 0.05), P(0, 0.36, 0.22), cEb);     // reposabrazos
        mbAdd(mb, new THREE.BoxGeometry(0.3, 0.05, 0.05), P(0, 0.36, -0.22), cEb);
        mbAdd(mb, new THREE.CylinderGeometry(0.1, 0.13, 0.52, 14), P(-0.02, 0.52, 0), cGo);   // manto
        mbAdd(mb, new THREE.SphereGeometry(0.075, 12, 8), P(-0.02, 0.9, 0), cIv);             // cabeza de marfil
        mbAdd(mb, new THREE.BoxGeometry(0.05, 0.1, 0.1), P(0.06, 0.84, 0), cGo);              // barba
        mbAdd(mb, new THREE.CylinderGeometry(0.035, 0.03, 0.36, 8), P(0.02, 0.6, 0.15), cIv); // brazo con Nike
        mbAdd(mb, new THREE.ConeGeometry(0.03, 0.1, 8), P(0.08, 0.8, 0.17), cGo);            // Nike
        mbAdd(mb, new THREE.CylinderGeometry(0.012, 0.012, 0.62, 6), P(0.14, 0.62, -0.18), cGo); // cetro
        mbAdd(mb, new THREE.SphereGeometry(0.03, 8, 6), P(0.14, 0.95, -0.18), cGo);          // águila
        mbAdd(mb, new THREE.CylinderGeometry(0.05, 0.05, 0.3, 8).rotateZ(Math.PI / 2), P(0.22, 0.2, 0.11), cGo);
        mbAdd(mb, new THREE.CylinderGeometry(0.05, 0.05, 0.3, 8).rotateZ(Math.PI / 2), P(0.22, 0.2, -0.11), cGo);
        mbAdd(mb, new THREE.BoxGeometry(0.16, 0.08, 0.3), P(0.36, 0.04, 0), cEb);            // escabel
      })(-102.0, 1.0, 8.5);

      // rack de herramientas en el muro oeste
      mbBox(mb, -109.2, 2.0, 7.0, 0.12, 2.0, 3.0, cWd);
      for (let k = 0; k < 7; k++) mbBox(mb, -109.0, 1.2 + k * 0.2, 5.6 + k * 0.3, 0.04, 0.04, 0.4, cDk);

      wsG.add(staticMesh(mb, M.stone, true));

      // láminas de oro sobre la mesa del oro (material metálico propio)
      const gb = MB();
      for (let k = 0; k < 12; k++) {
        mbBox(gb, -86.6 + hash(k + 70) * 1.6, 1.006 + k * 0.007, 7.6 + hash(k + 80) * 0.8, 0.5, 0.006, 0.5, new THREE.Color(0xd4a63c), (hash(k + 90) - 0.5) * 0.8);
      }
      for (let k = 0; k < 3; k++) {
        mbAdd(gb, new THREE.CylinderGeometry(0.12, 0.12, 0.42, 8, 1, true, 0, Math.PI * 0.8),
          new THREE.Matrix4().compose(new THREE.Vector3(-85.4 + k * 0.5, 1.12, 8.2 - k * 0.2), new THREE.Quaternion().setFromAxisAngle(_yAxis, k * 0.9), new THREE.Vector3(1, 1, 1)),
          new THREE.Color(0xe0b257));
      }
      wsG.add(staticMesh(gb, M.gold, false));

      // taza negra "Pertenezco a Fidias" sobre la mesa de la taza (SITE.cupSpot)
      const cb = MB(), cup = SITE.cupSpot, cCup = new THREE.Color(0x141416);
      mbAdd(cb, new THREE.CylinderGeometry(0.05, 0.035, 0.07, 14), T(cup.x, 1.035, cup.z), cCup);
      mbAdd(cb, new THREE.TorusGeometry(0.025, 0.007, 6, 12), new THREE.Matrix4().compose(new THREE.Vector3(cup.x + 0.06, 1.035, cup.z), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1)), cCup);
      wsG.add(staticMesh(cb, M.cup, false));

      // luces cálidas: lámparas del taller y horno
      wsG.userData.L1 = new THREE.PointLight(0xffd9a6, 0, 26, 1.2);
      wsG.userData.L1.position.set(-96, 7.5, 4);
      wsG.userData.L2 = new THREE.PointLight(0xff9a4a, 0, 9, 1.2);
      wsG.userData.L2.position.set(-102.5, 1.6, 0.8);
      wsG.add(wsG.userData.L1, wsG.userData.L2);
    })();
    // helpers del taller usados arriba (definidos a nivel de módulo)
    function tuskGeo(bx, by, bz, side, len, r0) {
      const N = 14, S = 10, pos = [], idx = [];
      for (let i = 0; i <= N; i++) {
        const u = i / N;
        const cx = bx + side * len * 0.35 * u * u, cy = by + len * u, cz = bz;
        const tx = side * len * 0.7 * u, ty = len, tl = Math.hypot(tx, ty);
        const qx = -ty / tl, qy = tx / tl;
        const r = r0 * (1 - 0.85 * u) + 0.012;
        for (let j = 0; j <= S; j++) {
          const ph = j / S * TAU, cp = Math.cos(ph), sp = Math.sin(ph);
          pos.push(cx + r * sp * qx, cy + r * sp * qy, cz + r * cp);
        }
      }
      for (let i = 0; i < N; i++) for (let j = 0; j < S; j++) {
        const a = i * (S + 1) + j, b = a + S + 1;
        idx.push(a, b, a + 1, a + 1, b, b + 1);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setIndex(idx); g.computeVertexNormals();
      return g;
    }
    function moldGeo(w, d, ph) {
      const g = new THREE.PlaneGeometry(w, d, 24, 12);
      g.rotateX(-Math.PI / 2);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), z = p.getZ(i);
        p.setY(i, 0.035 * Math.sin(x * 9 + ph) * Math.cos(z * 6) + 0.03 * Math.sin(z * 14 + ph) + 0.05);
      }
      p.needsUpdate = true; g.computeVertexNormals();
      return g;
    }

    // hornos: llamas pequeñas en la boca
    const kFlame = mkIM(new THREE.ConeGeometry(0.2, 0.5, 6), M.flame, 2, false);
    wsG.add(kFlame);

    // artesanos del taller (índices 8..20)
    const ART = [
      [-106.2, 3.5, -Math.PI / 2, 'tub'], [-106.2, 7.0, -Math.PI / 2, 'tub'], [-106.2, 10.5, -Math.PI / 2, 'tub'],
      [-102.0, 6.4, 0, 'maq'], [-102.0, 10.6, Math.PI, 'maq'],
      [-86.0, 6.3, 0, 'gold'], [-86.0, 9.7, Math.PI, 'gold'],
      [-90.3, 2.5, Math.PI / 2, 'clay'], [-85.7, 2.5, -Math.PI / 2, 'clay'],
      [-90.0, 9.8, 0, 'bench'],
      [-100.6, -0.2, faceZ(-100.6, -0.2, -102.5, 0.2), 'kiln'], [-84.0, 2.5, faceZ(-84, 2.5, -84, 0.6), 'kiln'],
      [-96.0, 6.4, Math.PI, 'cup']
    ];
    const KILNS = [[-102.5, 0.2], [-84.0, 0.6]];
    function updArtisans(W, ws) {
      const on = fs(ws);
      for (let i = 0; i < ART.length; i++) {
        const A = ART[i], sw = Math.sin(W * 2.3 + i), cw = Math.cos(W * 3.1 + i * 0.7);
        if (A[3] === 'tub') pose(0.1 * sw, -0.1 * sw, -1.1 + 0.25 * sw, -1.1 - 0.25 * sw, 0.45, 0);
        else if (A[3] === 'maq') pose(0, 0, -1.15 + 0.15 * sw, -0.9 + 0.3 * cw, 0.3, 1);
        else if (A[3] === 'gold') pose(0, 0, -1.0, -1.0 + 0.3 * sw, 0.2, 0);
        else if (A[3] === 'clay') pose(0.05 * sw, -0.05 * sw, -1.0 + 0.2 * sw, -1.0 - 0.2 * sw, 0.4, 0);
        else if (A[3] === 'bench') pose(0, 0, -0.9, -1.0 + 0.7 * Math.max(0, Math.sin(W * 3.5 + i)), 0.25, 1);
        else if (A[3] === 'kiln') pose(0.3 * sw, -0.3 * sw, -0.5, -0.5, 0.15, 0);
        else pose(0, 0, -0.4, -1.2 + 0.05 * sw, 0.25, 0);
        figAt(8 + i, A[0], 0, A[1], A[2], on);
      }
      [0, 1].forEach(function (k) {
        const K = KILNS[k], f = 0.8 + 0.3 * Math.sin(W * 13 + k * 2);
        place(kFlame, k, IDM, K[0], 0.5, K[1] - 0.75, 0, 0, 0, 0, 0, on, on * f, on);
      });
      kFlame.instanceMatrix.needsUpdate = true;
      const wsd = wsG.userData;
      if (wsd.L1) wsd.L1.intensity = 1.6 * ws;
      if (wsd.L2) wsd.L2.intensity = (0.7 + 0.3 * Math.sin(W * 11)) * ws;
    }

    // =====================================================================
    // 4. CARROS DE PLACAS (t 104-126): salen del taller por el norte y llegan al templo; empujados por dos hombres
    // =====================================================================
    const cartG = new THREE.Group(); root.add(cartG);
    const CART_PATH = polyline([[-96, 2], [-96, -4], [-70, -30], [-30, -34], [0, -30], [26, -24], [38, -6]]);
    const cartBedIM = mkIM((function () {
      const mb = MB(), cW = new THREE.Color(0x7a5230);
      mbBox(mb, 0, 0.9, 0, 1.4, 0.12, 2.4, cW);
      mbBox(mb, -0.68, 1.1, 0, 0.1, 0.36, 2.4, cW);
      mbBox(mb, 0.68, 1.1, 0, 0.1, 0.36, 2.4, cW);
      mbBox(mb, 0, 1.1, 1.18, 1.36, 0.36, 0.1, cW);
      mbBox(mb, 0, 1.1, -1.18, 1.36, 0.36, 0.1, cW);
      return mbGeo(mb);
    })(), M.wood, 3, true);
    const cartWheelIM = mkIM((function () { const g = new THREE.CylinderGeometry(0.6, 0.6, 0.14, 14); g.rotateZ(Math.PI / 2); return g; })(), M.woodP, 6, true);
    const cartPlateIM = mkIM(new THREE.BoxGeometry(1.1, 0.07, 0.9), M.ivory, 9, true);
    cartG.add(cartBedIM, cartWheelIM, cartPlateIM);

    function updCarts(W, t) {
      for (let k = 0; k < 3; k++) {
        const u = (t - 104 - 4 * k) / 22;
        const inside = u > 0 && u < 1;
        const fade = inside ? sstep(u / 0.03) * sstep((1 - u) / 0.03) : 0;
        const sc = fs(fade);
        const P = CART_PATH.at(clamp(u, 0, 1));
        const th = hZ(P[2], P[3]);
        setM(_R, P[0], 0, P[1], th, sc);
        cartBedIM.setMatrixAt(k, _R);
        const spin = clamp(u, 0, 1) * CART_PATH.L / 0.6;
        place(cartWheelIM, 2 * k, _R, -0.8, 0.6, 0, spin, 0, 0, 0, 0, 1, 1, 1);
        place(cartWheelIM, 2 * k + 1, _R, 0.8, 0.6, 0, spin, 0, 0, 0, 0, 1, 1, 1);
        for (let j = 0; j < 3; j++) place(cartPlateIM, 3 * k + j, _R, 0, 1.03 + 0.08 * j, 0, 0, 0, 0, 0, 0, 1, 1, 1);
        // empujadores detrás del carro (adelante = (dx,dz); derecha = (dz,-dx))
        const fx = P[2], fz = P[3], rx = P[3], rz = -P[2];
        for (let m = 0; m < 2; m++) {
          const side = m ? 0.55 : -0.55;
          const px = P[0] - fx * 1.5 + rx * side, pz = P[1] - fz * 1.5 + rz * side;
          const sw = Math.sin(W * 4 + k * 2 + m);
          pose(0.3 * sw, -0.3 * sw, -1.2 + 0.1 * sw, -1.2 - 0.1 * sw, 0.35, 0);
          figAt(21 + 2 * k + m, px, 0, pz, th, sc);
        }
      }
      cartBedIM.instanceMatrix.needsUpdate = true; cartWheelIM.instanceMatrix.needsUpdate = true; cartPlateIM.instanceMatrix.needsUpdate = true;
    }

    // =====================================================================
    // 5. ANDAMIOS dentro de la cella: alrededor de la estatua (x -20..-8, |z|<4), lado +X libre
    // =====================================================================
    const scaffoldG = new THREE.Group(); root.add(scaffoldG);
    (function buildScaffold() {
      const mb = MB(), cW = new THREE.Color(0x8b6038), cI = new THREE.Color(0xefe6d6);
      const H0 = 1.5, H1 = 14.5, Hh = H1 - H0;
      [[-20, -3.9], [-20, 0], [-20, 3.9], [-14, -3.9], [-14, 3.9], [-8, -3.9], [-8, 3.9]].forEach(function (p) {
        mbBox(mb, p[0], H0 + Hh / 2, p[1], 0.22, Hh, 0.22, cW);
      });
      [4.5, 8.5, 12.5].forEach(function (y) {
        mbBox(mb, -20, y, 0, 0.14, 0.14, 7.8, cW);          // travesaño del fondo
        mbBox(mb, -16.5, y, -3.9, 7, 0.14, 0.14, cW);       // largueros de los lados (solo hasta x=-13)
        mbBox(mb, -16.5, y, 3.9, 7, 0.14, 0.14, cW);
        mbBox(mb, -18.6, y - 0.05, 0, 2.8, 0.1, 7.8, cW);   // tablón del fondo
        mbBox(mb, -16.5, y - 0.05, -3.95, 7, 0.1, 0.7, cW);  // plataforma norte (|z|>3.6: fuera de la línea de visión)
        mbBox(mb, -16.5, y - 0.05, 3.95, 7, 0.1, 0.7, cW);   // plataforma sur
      });
      // escaleras de mano apoyadas en el fondo
      ladder(mb, -22.6, 1.5, -2.6, -20.2, 8.6, cW);
      ladder(mb, -22.6, 1.5, 2.6, -20.2, 8.6, cW);
      // placas de marfil apiladas junto a los artesanos
      for (let k = 0; k < 4; k++) mbBox(mb, -19.4, 8.54 + k * 0.08, 0.6, 0.8, 0.05, 0.6, cI, 0.05 * k);
      for (let k = 0; k < 3; k++) mbBox(mb, -15.2, 12.54 + k * 0.08, -3.95, 0.8, 0.05, 0.6, cI);
      scaffoldG.add(staticMesh(mb, M.wood, true));
    })();
    function ladder(mb, bx, by, bz, tx, ty, c) {
      const dx = tx - bx, dy = ty - by, L = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
      const cx = (bx + tx) / 2, cy = (by + ty) / 2;
      [-0.28, 0.28].forEach(function (sz) {
        mbAdd(mb, new THREE.BoxGeometry(L, 0.07, 0.07).rotateZ(a), T(cx, cy, bz + sz), c);
      });
      for (let k = 0; k < 14; k++) {
        const f = (k + 0.5) / 14;
        mbAdd(mb, new THREE.BoxGeometry(0.05, 0.05, 0.6), T(bx + dx * f, by + dy * f, bz), c);
      }
    }
    // obreros colocando placas en la altura de la obra (índices 27..30)
    const SCAF_W = [[-18.6, 8.5, 0, Math.PI / 2], [-15.5, 4.5, -3.95, 0], [-16.5, 12.5, 3.95, Math.PI], [-18.6, 12.5, -1.2, Math.PI / 2]];
    function updScaffold(W, scf) {
      for (let j = 0; j < SCAF_W.length; j++) {
        const Q = SCAF_W[j], sw = Math.sin(W * 3 + j * 1.7);
        pose(0.05, -0.05, -1.1 + 0.3 * sw, -1.0 + 0.3 * Math.cos(W * 2.6 + j), 0.4, 0);
        figAt(27 + j, Q[0], Q[1], Q[2], Q[3], fs(scf));
      }
    }

    // =====================================================================
    // 6. PEREGRINOS Y LÁMPARAS: 7 dentro de la cella (x 2..8 y -6..6), 6 frente al templo; lámparas en pie
    // =====================================================================
    const pilG = new THREE.Group(); root.add(pilG);
    // [x, z, giro, altura del suelo]: la cella está sobre el estilóbato (y=1.5); el frente del templo, en el suelo
    const PIL = [
      [-6.6, 5.6, -Math.PI / 2, 1.5], [-2.4, 5.6, -Math.PI / 2, 1.5], [1.7, 5.6, -Math.PI / 2, 1.5], [5.9, 5.6, -Math.PI / 2, 1.5],
      [-6.6, -5.6, -Math.PI / 2, 1.5], [-2.4, -5.6, -Math.PI / 2, 1.5], [1.7, -5.6, -Math.PI / 2, 1.5], [5.9, -5.6, -Math.PI / 2, 1.5],
      [46, -9, -Math.PI / 2, 0], [44, -5.5, -Math.PI / 2, 0], [47, -2, -Math.PI / 2, 0], [45, 2.5, -Math.PI / 2, 0], [44, 6, -Math.PI / 2, 0], [46, 9.5, -Math.PI / 2, 0]
    ];
    const NPIL = PIL.length;
    const pRobe = mkIM(new THREE.CylinderGeometry(0.2, 0.42, 1.7, 8, 1), M.cloth, NPIL, true);
    const pHead = mkIM(new THREE.SphereGeometry(0.15, 8, 6), M.skin, NPIL, false);
    const pBowl = mkIM(new THREE.CylinderGeometry(0.08, 0.05, 0.06, 8), M.bronze, NPIL, false);
    const STANDS = [[-12.8, -6.6], [-12.8, 6.6], [-4.5, -6.6], [-4.5, 6.6]];   // lámparas de pie en la cella (suelo y=1.5)
    const pFlame = mkIM(new THREE.ConeGeometry(0.09, 0.26, 6), M.flame, NPIL + STANDS.length, false);
    const standMesh = (function () {
      const mb = MB(), cB = new THREE.Color(0x9a7a3a);
      STANDS.forEach(function (p) {
        mbAdd(mb, new THREE.CylinderGeometry(0.22, 0.3, 0.08, 12), T(p[0], 1.54, p[1]), cB);
        mbAdd(mb, new THREE.CylinderGeometry(0.035, 0.035, 1.1, 6), T(p[0], 2.1, p[1]), cB);
        mbAdd(mb, new THREE.CylinderGeometry(0.2, 0.1, 0.1, 12), T(p[0], 2.7, p[1]), cB);
      });
      return staticMesh(mb, M.wood, false);
    })();
    pilG.add(pRobe, pHead, pBowl, pFlame, standMesh);
    (function () {
      const CLOTH = [0xf2ead8, 0xa8322a, 0x2a4d8f, 0xe0b257, 0x5d6b3a, 0x7a3c7a];
      for (let i = 0; i < NPIL; i++) {
        pRobe.setColorAt(i, new THREE.Color(CLOTH[i % CLOTH.length]));
        pHead.setColorAt(i, new THREE.Color(0x9a6a46));
      }
      pRobe.instanceColor.needsUpdate = true; pHead.instanceColor.needsUpdate = true;
    })();
    function updPilgrims(W, pil) {
      const on = fs(pil);
      for (let i = 0; i < NPIL; i++) {
        const P = PIL[i], bob = 0.02 * Math.sin(W * 2 + i);
        setM(_R, P[0], P[3], P[1], P[2], on);
        place(pRobe, i, _R, 0, 0.85 + bob, 0, 0, 0, 0, 0, 0, 1, 1, 1);
        place(pHead, i, _R, 0, 1.8 + bob, 0, 0, 0, 0, 0, 0, 1, 1, 1);
        place(pBowl, i, _R, 0, 1.2 + bob, 0.4, 0.5, 0, 0, 0, 0, 1, 1, 1);
        place(pFlame, i, _R, 0, 1.32 + bob, 0.4, 0, 0, 0, 0, 0, 1, 0.85 + 0.25 * Math.sin(W * 14 + i), 1);
      }
      for (let k = 0; k < STANDS.length; k++) {
        const f = 0.85 + 0.25 * Math.sin(W * 14 + k * 1.9);
        place(pFlame, NPIL + k, IDM, STANDS[k][0], 1.5 + 1.32, STANDS[k][1], 0, 0, 0, 0, 0, 1, f, 1);
      }
      [pRobe, pHead, pBowl, pFlame].forEach(function (im) { im.instanceMatrix.needsUpdate = true; });
    }

    // =====================================================================
    // update: cada sección según su pista. Todo es función del estado (t); W solo anima.
    // =====================================================================
    function update(s) {
      const W = V(s.wall), t = V(s.t);
      const games = clamp(V(s.games), 0, 1);
      const siteOn = clamp(V(s.workers), 0, 1) * (1 - sstep(V(s.temple)));
      const ws = clamp(V(s.workshop), 0, 1);
      const scf = clamp(V(s.scaffold), 0, 1);
      const pil = clamp(V(s.pilgrims), 0, 1);

      gamesG.visible = games > 0.01;
      siteG.visible = siteOn > 0.005;
      wsG.visible = ws > 0.01;
      scaffoldG.visible = scf > 0.01;
      pilG.visible = pil > 0.01;

      updGames(W, t, games);
      updJudge(games);
      updTemple(W, siteOn);
      updBuilders(W, siteOn);
      updArtisans(W, ws);
      updCarts(W, t);
      updScaffold(W, scf);
      updPilgrims(W, pil);
      flushFigs();
    }

    return { update: update, group: root };
  };
})();
