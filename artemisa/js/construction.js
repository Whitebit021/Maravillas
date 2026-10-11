// Obra del Templo de Artemisa: cantera de mármol, "ruedas de Quersifrón" (tambores rodados por bueyes),
// obreros, grúas y andamios alrededor de las columnas en obra, rampa de sacos de arena con el arquitrabe
// y procesión de peregrinos hacia el altar. Todo procedural. Función pura del estado s.
(function () {
  'use strict';
  const G = window.GIZA;

  G.createConstruction = function (ctx) {
    const THREE = ctx.THREE, scene = ctx.scene, renderer = ctx.renderer;
    const root = new THREE.Group();
    scene.add(root);

    const SITE = G.SITE, TEMPLE = G.TEMPLE;
    const TAU = Math.PI * 2;
    const _yAxis = new THREE.Vector3(0, 1, 0);
    const _ONE = new THREE.Vector3(1, 1, 1);

    // ---------- utilidades ----------
    function V(x) { return typeof x === 'number' && isFinite(x) ? x : 0; }
    function clamp(x, a, b) { return x < a ? a : (x > b ? b : x); }
    function frac(x) { return x - Math.floor(x); }
    function sstep(x) { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); }
    function hash(n) { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
    function pingPong(d, L) { const p = frac(d / (2 * L)); return p < 0.5 ? 2 * p : 2 - 2 * p; }
    function headingOf(dx, dz) { return Math.atan2(-dz, dx); }
    function canvasTex(w, h, draw) {
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      draw(cv.getContext('2d'), w, h);
      const tex = new THREE.CanvasTexture(cv);
      tex.encoding = THREE.sRGBEncoding;
      return tex;
    }
    // polilínea parametrizada por longitud de arco: at(u) -> [x, z, dirX, dirZ]
    function polyline(pts) {
      const segs = []; let L = 0;
      for (let i = 1; i < pts.length; i++) {
        const dx = pts[i][0] - pts[i - 1][0], dz = pts[i][1] - pts[i - 1][1], l = Math.hypot(dx, dz);
        segs.push({ a: pts[i - 1], dx: dx / l, dz: dz / l, l0: L, l: l }); L += l;
      }
      return {
        L: L, segs: segs,
        at: function (u) {
          const d = clamp(u, 0, 1) * L; let sg = segs[segs.length - 1];
          for (let i = 0; i < segs.length; i++) { if (d <= segs[i].l0 + segs[i].l) { sg = segs[i]; break; } }
          const k = clamp((d - sg.l0) / sg.l, 0, 1);
          return [sg.a[0] + sg.dx * sg.l * k, sg.a[1] + sg.dz * sg.l * k, sg.dx, sg.dz];
        }
      };
    }

    // ---------- entorno (reflejos del mármol: cielo degradado en PMREM) ----------
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

    // textura de sillares (bump) y de punteado para sacos de arena
    const sillarTex = canvasTex(256, 256, function (g, w, h) {
      g.fillStyle = '#808080'; g.fillRect(0, 0, w, h);
      g.strokeStyle = '#202020'; g.lineWidth = 3;
      for (let y = 0; y <= h; y += 64) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
      for (let r = 0; r < 4; r++) {
        const off = (r % 2) * 64;
        for (let x = off; x <= w; x += 128) { g.beginPath(); g.moveTo(x, r * 64); g.lineTo(x, r * 64 + 64); g.stroke(); }
      }
      for (let i = 0; i < 900; i++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.12)'; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
    });
    sillarTex.wrapS = sillarTex.wrapT = THREE.RepeatWrapping;
    const sackTex = canvasTex(128, 128, function (g, w, h) {
      g.fillStyle = '#c9a86a'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 260; i++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(90,60,20,0.25)' : 'rgba(255,240,200,0.25)'; g.fillRect(Math.random() * w, Math.random() * h, 3, 1.5); }
    });
    sackTex.wrapS = sackTex.wrapT = THREE.RepeatWrapping;

    // ---------- materiales ----------
    const MAT = {
      marble:   new THREE.MeshStandardMaterial({ color: 0xefe6d6, roughness: 0.5, envMap: envTex, envMapIntensity: 0.5, bumpMap: sillarTex, bumpScale: 0.6 }),
      marbleVC: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, flatShading: true, envMap: envTex, envMapIntensity: 0.4 }),
      wood:     new THREE.MeshStandardMaterial({ color: 0x7a5230, roughness: 0.9 }),
      woodVC:   new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true }),
      iron:     new THREE.MeshStandardMaterial({ color: 0x2b2a29, roughness: 0.6, metalness: 0.4 }),
      cloth:    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, flatShading: true }),
      skin:     new THREE.MeshStandardMaterial({ color: 0x8c5a3a, roughness: 0.8, flatShading: true }),
      ox:       new THREE.MeshStandardMaterial({ color: 0x8a5a33, roughness: 0.95, flatShading: true }),
      horn:     new THREE.MeshStandardMaterial({ color: 0xe9e0c8, roughness: 0.5 }),
      sack:     new THREE.MeshStandardMaterial({ color: 0xffffff, map: sackTex, roughness: 1, flatShading: true }),
      rope:     new THREE.MeshStandardMaterial({ color: 0xb8a070, roughness: 1 }),
      rut:      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }),
      sand:     new THREE.PointsMaterial({ color: 0xd9bf8a, size: 0.9, transparent: true, opacity: 0.85, depthWrite: false }),
      smoke:    new THREE.PointsMaterial({ color: 0xd8d2c4, size: 6.0, transparent: true, opacity: 0.35, depthWrite: false }),
      flame:    new THREE.MeshBasicMaterial({ color: 0xffb050 }),
      dust:     new THREE.PointsMaterial({ color: 0xd8c08a, size: 2.2, transparent: true, opacity: 0.4, depthWrite: false })
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
      const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(_yAxis, ry || 0), _ONE);
      mbAdd(mb, new THREE.BoxGeometry(sx, sy, sz), m, c);
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
    // matrices auxiliares
    const _m = new THREE.Matrix4(), _m2 = new THREE.Matrix4(), _m3 = new THREE.Matrix4(), _m4 = new THREE.Matrix4();
    const _P = new THREE.Vector3(), _Q = new THREE.Quaternion(), _S = new THREE.Vector3(), _EU = new THREE.Euler();
    const _c = new THREE.Color();
    function TRS(m, x, y, z, rx, ry, rz, sx, sy, sz) {
      _P.set(x, y, z); _EU.set(rx || 0, ry || 0, rz || 0, 'YXZ'); _Q.setFromEuler(_EU);
      _S.set(sx === undefined ? 1 : sx, sy === undefined ? 1 : sy, sz === undefined ? 1 : sz);
      return m.compose(_P, _Q, _S);
    }
    function Tr(x, y, z) { return new THREE.Matrix4().makeTranslation(x, y, z); }
    function Ry(a) { return new THREE.Matrix4().makeRotationY(a); }
    function Rz(a) { return new THREE.Matrix4().makeRotationZ(a); }
    function setInst(im, idx, x, y, z, ry, sc) {
      _P.set(x, y, z); _Q.setFromAxisAngle(_yAxis, ry || 0);
      const k = sc === undefined ? 1 : sc; _S.set(k, k, k);
      im.setMatrixAt(idx, _m.compose(_P, _Q, _S));
    }
    const ZERO = new THREE.Matrix4().makeScale(0.0001, 0.0001, 0.0001);

    // =====================================================================
    // FIGURAS (obreros, boyeros, cortadores): NF figuras con brazos y piernas animados
    //   0-13 cantera, 14-35 plataforma, 36-49 columnas en obra, 50-57 rampa, 58-63 boyeros
    // =====================================================================
    const NF = 64;
    const fT = mkIM(new THREE.BoxGeometry(0.42, 0.66, 0.24), MAT.cloth, NF, true);
    const fH = mkIM(new THREE.SphereGeometry(0.14, 7, 5), MAT.skin, NF, false);
    const fL = mkIM(new THREE.BoxGeometry(0.19, 0.9, 0.2), MAT.cloth, NF * 2, true);
    const fA = mkIM(new THREE.BoxGeometry(0.13, 0.66, 0.13), MAT.skin, NF * 2, false);
    const fTool = mkIM((function () {
      const mb = MB();
      mbBox(mb, 0, 0, 0, 0.07, 0.9, 0.07, new THREE.Color(0x7a5230));
      mbBox(mb, 0, 0.42, 0, 0.3, 0.1, 0.1, new THREE.Color(0x4a4a4a));
      return mbGeo(mb);
    })(), MAT.woodVC, NF, false);
    const FIGS = [fT, fH, fL, fA, fTool];
    const figG = new THREE.Group(); root.add(figG); FIGS.forEach(function (im) { figG.add(im); });
    (function () {
      const pal = [0xd9c9a3, 0xb8794a, 0x3d6f9e, 0xe6e0d0, 0x8c3b2a, 0x6b8a4e];
      for (let i = 0; i < NF; i++) fT.setColorAt(i, _c.setHex(pal[i % pal.length]));
      for (let i = 0; i < NF * 2; i++) fL.setColorAt(i, _c.setHex(i % 2 ? 0x5b4a36 : 0x6b5a42));
      fT.instanceColor.needsUpdate = true; fL.instanceColor.needsUpdate = true;
    })();
    const _fR = new THREE.Matrix4(), _fA = new THREE.Matrix4(), _fB = new THREE.Matrix4(), _fE = new THREE.Euler();
    const _fq = new THREE.Quaternion(), _fp = new THREE.Vector3();
    let fSc = 1;   // escala global de la figura (0.0001 = oculta)
    function figRoot(x, y, z, hd) { _fp.set(x, y, z); _fq.setFromAxisAngle(_yAxis, hd); _fR.compose(_fp, _fq, _ONE); }
    function figPart(im, idx, px, py, pz, rx, rz, ox, oy, oz, sx, sy, sz) {
      _fA.makeTranslation(px, py, pz);
      _fE.set(rx, 0, rz, 'XYZ'); _fB.makeRotationFromEuler(_fE); _fA.multiply(_fB);
      _fB.makeTranslation(ox, oy, oz); _fA.multiply(_fB);
      _fB.makeScale(sx * fSc, sy * fSc, sz * fSc); _fA.multiply(_fB);
      _fB.multiplyMatrices(_fR, _fA);
      im.setMatrixAt(idx, _fB);
    }
    const PF = { ll: 0, lr: 0, al: 0, ar: 0, lean: 0, tool: 0 };
    function drawFig(i) {
      figPart(fT, i, 0, 1.25, 0, PF.lean, 0, 0, 0, 0, 1, 1, 1);
      figPart(fH, i, 0, 1.25, 0, PF.lean, 0, 0, 0.45, 0, 1, 1, 1);
      figPart(fL, 2 * i, -0.11, 0.9, 0, PF.ll, 0, 0, -0.45, 0, 1, 1, 1);
      figPart(fL, 2 * i + 1, 0.11, 0.9, 0, PF.lr, 0, 0, -0.45, 0, 1, 1, 1);
      figPart(fA, 2 * i, -0.27, 1.5, 0, PF.al, 0, 0, -0.33, 0, 1, 1, 1);
      figPart(fA, 2 * i + 1, 0.27, 1.5, 0, PF.ar, 0, 0, -0.33, 0, 1, 1, 1);
      figPart(fTool, i, 0.27, 1.5, 0, PF.ar, 0, 0, -0.72, 0.1, PF.tool ? 1 : 0, PF.tool ? 1 : 0, PF.tool ? 1 : 0);
    }
    function setPose(ll, lr, al, ar, lean, tool) { PF.ll = ll; PF.lr = lr; PF.al = al; PF.ar = ar; PF.lean = lean; PF.tool = tool; }
    function flushFigs() { FIGS.forEach(function (im) { im.instanceMatrix.needsUpdate = true; }); }

    // =====================================================================
    // 1. CANTERA en SITE.quarry: frentes escalonados blancos, bloques y tambores, obreros con picos
    // =====================================================================
    const QX = SITE.quarry.x, QZ = SITE.quarry.z, QHW = 70, QHD = 45;
    const quarryG = new THREE.Group(); root.add(quarryG);
    const qmb = MB();
    const cCut = new THREE.Color(0xefe6d6), cRock = new THREE.Color(0xd8c9ad), cFloor = new THREE.Color(0xb9a88a);
    const cGroove = new THREE.Color(0x9c8c6c), cChisel = new THREE.Color(0xfbf6ec);
    function ringPlate(lo, hi, y0, y1, c) {
      const th = hi - lo, h = y1 - y0, yc = (y0 + y1) / 2, mid = (lo + hi) / 2;
      const outerX = QHW - lo, innerZ = QHD - hi;
      mbBox(qmb, QX, yc, QZ - (QHD - mid), 2 * outerX, h, th, c);
      mbBox(qmb, QX, yc, QZ + (QHD - mid), 2 * outerX, h, th, c);
      mbBox(qmb, QX - (QHW - mid), yc, QZ, th, h, 2 * innerZ, c);
      mbBox(qmb, QX + (QHW - mid), yc, QZ, th, h, 2 * innerZ, c);
    }
    // ranuras verticales y marcas de cincel en las caras de un nivel (pared en inset P)
    function grooves(P, y0, y1) {
      const h = (y1 - y0) * 0.7, yc = (y0 + y1) / 2;
      const zN = QZ - (QHD - P), zS = QZ + (QHD - P), xW = QX - (QHW - P), xE = QX + (QHW - P);
      for (let x = -QHW + P + 1.5; x < QHW - P - 1; x += 3.0) {
        mbBox(qmb, QX + x, yc, zN + 0.03, 0.14, h, 0.1, cGroove);
        mbBox(qmb, QX + x, yc, zS - 0.03, 0.14, h, 0.1, cGroove);
      }
      for (let z = -QHD + P + 1.5; z < QHD - P - 1; z += 3.0) {
        mbBox(qmb, xW + 0.03, yc, QZ + z, 0.1, h, 0.14, cGroove);
        mbBox(qmb, xE - 0.03, yc, QZ + z, 0.1, h, 0.14, cGroove);
      }
      for (let yy = y0 + 0.3; yy < y1 - 0.1; yy += 0.45) {
        mbBox(qmb, QX, yy, zN + 0.04, 2 * (QHW - P) - 2, 0.07, 0.06, cChisel);
        mbBox(qmb, QX, yy, zS - 0.04, 2 * (QHW - P) - 2, 0.07, 0.06, cChisel);
        mbBox(qmb, xW + 0.04, yy, QZ, 0.06, 0.07, 2 * (QHD - P) - 2, cChisel);
        mbBox(qmb, xE - 0.04, yy, QZ, 0.06, 0.07, 2 * (QHD - P) - 2, cChisel);
      }
    }
    mbBox(qmb, QX, -12.25, QZ, 2 * QHW - 4, 0.5, 2 * QHD - 4, cFloor);
    ringPlate(11.4, 12, -12, -8, cCut);   // pared inferior
    ringPlate(6, 12, -8.4, -8, cRock);    // banqueta 1
    ringPlate(5.4, 6, -8, -4, cCut);      // pared media
    ringPlate(0, 6, -4.4, -4, cRock);     // banqueta 2
    ringPlate(-0.6, 0, -4, 0, cCut);      // borde superior
    grooves(12, -12, -8); grooves(6, -8, -4); grooves(0, -4, 0);
    const quarryMesh = new THREE.Mesh(mbGeo(qmb), MAT.marbleVC);
    quarryMesh.castShadow = true; quarryMesh.receiveShadow = true; quarryMesh.frustumCulled = false;
    quarryG.add(quarryMesh);

    // bloques de sillar y tambores ya cortados, esparcidos por el suelo de la cantera
    const NBLK = 36, NQD = 8;
    const blockIM = mkIM(new THREE.BoxGeometry(2.4, 1.2, 1.2), MAT.marble, NBLK, true);
    const qDrumIM = mkIM((function () { const g = new THREE.CylinderGeometry(0.9, 0.9, 2.0, 20, 1); g.rotateZ(Math.PI / 2); return g; })(), MAT.marble, NQD, true);
    quarryG.add(blockIM, qDrumIM);
    for (let i = 0; i < NBLK; i++) {
      const x = QX + (hash(i + 10) * 2 - 1) * 50, z = QZ + (hash(i + 30) * 2 - 1) * 28;
      setInst(blockIM, i, x, -11.4 + (i % 4 === 0 ? 1.2 : 0), z, hash(i + 90) * 0.6 - 0.3);
    }
    for (let i = 0; i < NQD; i++) {
      const x = QX + (hash(i + 110) * 2 - 1) * 46, z = QZ + (hash(i + 130) * 2 - 1) * 26;
      setInst(qDrumIM, i, x, -11.1, z, hash(i + 150) * Math.PI);
    }
    blockIM.instanceMatrix.needsUpdate = true; qDrumIM.instanceMatrix.needsUpdate = true;

    // =====================================================================
    // 2. RUEDAS DE QUERSIFRÓN: 6 equipos. Tambor de mármol (1.8 m de diámetro, 2 m de largo) con ejes
    //    de hierro en un bastidor de madera, tirado por dos yuntas de bueyes; boyero junto a cada equipo.
    //    Posición = f(fract(t/22 + i/6)) sobre SITE.route; el tambor gira según la distancia recorrida.
    // =====================================================================
    const NT = 6, TEAM_PERIOD = 22;
    const ROUTE = polyline(SITE.route), RL = ROUTE.L;
    function comp(x, y, z, ax, ay, az, ang) {
      return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(ax, ay, az), ang || 0), _ONE);
    }
    // bastidor (en coordenadas del equipo: adelante = +X, eje del tambor = Z, arriba = +Y)
    const frameG = (function () {
      const mb = MB(), cW = new THREE.Color(0x7a5230), cD = new THREE.Color(0x4a3018), cI = new THREE.Color(0x2b2a29);
      mbBox(mb, 0, 0.1, -1.6, 4.4, 0.2, 0.3, cW);       // largueros (patines)
      mbBox(mb, 0, 0.1, 1.6, 4.4, 0.2, 0.3, cW);
      mbBox(mb, 2.0, 0.6, 0, 0.3, 0.3, 3.5, cD);        // travesaños
      mbBox(mb, -2.0, 0.6, 0, 0.3, 0.3, 3.5, cD);
      mbBox(mb, 0, 0.9, -1.6, 0.25, 1.8, 0.25, cW);     // montantes con el eje de hierro
      mbBox(mb, 0, 0.9, 1.6, 0.25, 1.8, 0.25, cW);
      mbAdd(mb, new THREE.CylinderGeometry(0.07, 0.07, 3.4, 6), comp(0, 0.9, 0, 1, 0, 0, Math.PI / 2), cI);
      return mbGeo(mb);
    })();
    const frameIM = mkIM(frameG, MAT.woodVC, NT, true);
    // tambor: eje Z; marcas de cincel que giran con él
    const drumG = (function () {
      const mb = MB(), cM = new THREE.Color(0xefe6d6), cK = new THREE.Color(0x6a5a44);
      mbAdd(mb, new THREE.CylinderGeometry(0.9, 0.9, 2.0, 20, 1).rotateX(Math.PI / 2), new THREE.Matrix4(), cM);
      for (let k = 0; k < 4; k++) {
        const a = k * Math.PI / 2;
        mbAdd(mb, new THREE.BoxGeometry(0.25, 0.25, 2.02), comp(Math.cos(a) * 0.9, Math.sin(a) * 0.9, 0, 0, 0, 1, a), cK);
      }
      return mbGeo(mb);
    })();
    const drumIM = mkIM(drumG, MAT.marbleVC, NT, true);
    // bueyes: 2 yuntas por equipo (4 bueyes), cuerpo, cabeza, cuernos, patas, cola
    const oxBodyIM = mkIM(new THREE.BoxGeometry(2.0, 0.8, 0.7), MAT.ox, NT * 4, true);
    const oxHeadIM = mkIM(new THREE.BoxGeometry(0.7, 0.6, 0.5), MAT.ox, NT * 4, true);
    const oxHornIM = mkIM(new THREE.CylinderGeometry(0.05, 0.03, 0.45, 5), MAT.horn, NT * 8, false);
    const oxLegIM = mkIM(new THREE.BoxGeometry(0.18, 0.9, 0.18), MAT.ox, NT * 16, true);
    const oxTailIM = mkIM(new THREE.BoxGeometry(0.08, 0.7, 0.08), MAT.ox, NT * 4, false);
    const yokeIM = mkIM(new THREE.BoxGeometry(0.14, 0.14, 1.5), MAT.wood, NT * 2, true);
    const ropeIM = mkIM(new THREE.BoxGeometry(2.0, 0.05, 0.05), MAT.rope, NT, false);
    const oxGroup = new THREE.Group();
    root.add(oxGroup);
    oxGroup.add(frameIM, drumIM, oxBodyIM, oxHeadIM, oxHornIM, oxLegIM, oxTailIM, yokeIM, ropeIM);
    // surcos en el camino (dos rodadas por segmento de la ruta)
    const rutMesh = (function () {
      const mb = MB(), cR = new THREE.Color(0x6a4a2a);
      const N = 48;
      for (let k = 0; k < N; k++) {
        const A = ROUTE.at(k / N), B = ROUTE.at((k + 1) / N);
        const mx = (A[0] + B[0]) / 2, mz = (A[1] + B[1]) / 2, len = Math.hypot(B[0] - A[0], B[1] - A[1]) + 0.2;
        const hd = headingOf(A[2], A[3]);
        for (let sd = -1; sd <= 1; sd += 2) {
          mbBox(mb, mx - A[3] * sd * 1.6, 0.02, mz + A[2] * sd * 1.6, len, 0.04, 0.5, cR, hd);
        }
      }
      const m = new THREE.Mesh(mbGeo(mb), MAT.rut);
      m.receiveShadow = true; m.frustumCulled = false;
      return m;
    })();
    root.add(rutMesh);

    // escena local por equipo: matrices de trabajo reutilizadas (sin crear geometría por frame)
    const _TM = new THREE.Matrix4(), _base = new THREE.Matrix4(), _loc = new THREE.Matrix4(), _tmp = new THREE.Matrix4(), _rot = new THREE.Matrix4();
    const _pp = new THREE.Vector3(), _qq = new THREE.Quaternion(), _ss = new THREE.Vector3();
    const L_BODY = new THREE.Matrix4().makeTranslation(0, 1.4, 0);
    const L_HEAD = new THREE.Matrix4().makeTranslation(1.25, 1.5, 0);
    const L_TAIL = comp(-1.1, 1.6, 0, 0, 0, 1, 0.5);
    const L_HORN = [comp(1.3, 1.9, -0.22, 1, 0, 0, -0.4), comp(1.3, 1.9, 0.22, 1, 0, 0, 0.4)];
    const L_YOKE = new THREE.Matrix4().makeTranslation(1.2, 1.1, 0);
    const OX_X = [3.2, 5.8], OX_Z = [-0.6, 0.6];
    function put(im, idx, base, loc) { _tmp.multiplyMatrices(base, loc); im.setMatrixAt(idx, _tmp); }

    function updateOxen(s, t, W) {
      const on = V(s.oxen) > 0.02;
      for (let i = 0; i < NT; i++) {
        const u = frac(t / TEAM_PERIOD + i / NT);
        const P = ROUTE.at(u);
        // se desvanece en los extremos del ciclo (salto de vuelta y paso por la cantera)
        const fade = sstep((u - 0.08) / 0.04) * sstep((0.98 - u) / 0.04);
        const sc = on ? Math.max(0.0001, fade) : 0.0001;
        const hd = headingOf(P[2], P[3]);
        _TM.compose(_pp.set(P[0], 0, P[1]), _qq.setFromAxisAngle(_yAxis_, hd), _ss.set(sc, sc, sc));
        // el tambor rueda sin deslizar: giro = distancia / radio
        const spin = -(u * RL) / 0.9;
        frameIM.setMatrixAt(i, _TM);
        _loc.makeTranslation(0, 0.9, 0); _rot.makeRotationZ(spin); _loc.multiply(_rot);
        put(drumIM, i, _TM, _loc);
        // yuntas: la cuerda del bastidor a la primera yunta
        put(ropeIM, i, _TM, new THREE.Matrix4().makeTranslation(3.1, 1.0, 0));
        for (let y = 0; y < 2; y++) {
          const ox = OX_X[y];
          put(yokeIM, i * 2 + y, _TM, new THREE.Matrix4().makeTranslation(ox + 1.2, 1.1, 0));
          for (let o = 0; o < 2; o++) {
            const k = (i * 2 + y) * 2 + o;          // índice del buey (0..NT*4-1)
            _base.multiplyMatrices(_TM, _tmp.makeTranslation(ox, 0, OX_Z[o]));
            put(oxBodyIM, k, _base, L_BODY);
            put(oxHeadIM, k, _base, L_HEAD);
            put(oxTailIM, k, _base, L_TAIL);
            put(oxHornIM, k * 2, _base, L_HORN[0]);
            put(oxHornIM, k * 2 + 1, _base, L_HORN[1]);
            for (let l = 0; l < 4; l++) {
              const lx = l < 2 ? 0.7 : -0.7, lz = l % 2 ? 0.22 : -0.22;
              const sw = 0.25 * Math.sin(W * 5 + k * 0.7 + (l % 2) * Math.PI);
              // pata: pivote en la cadera (0.9 m) con balanceo
              _loc.makeTranslation(lx, 0.9, lz);
              _tmp.makeRotationZ(sw); _loc.multiply(_tmp);
              _tmp.makeTranslation(0, -0.45, 0); _loc.multiply(_tmp);
              put(oxLegIM, k * 4 + l, _base, _loc);
            }
          }
        }
      }
      frameIM.instanceMatrix.needsUpdate = true; drumIM.instanceMatrix.needsUpdate = true;
      ropeIM.instanceMatrix.needsUpdate = true; yokeIM.instanceMatrix.needsUpdate = true;
      oxBodyIM.instanceMatrix.needsUpdate = true; oxHeadIM.instanceMatrix.needsUpdate = true;
      oxHornIM.instanceMatrix.needsUpdate = true; oxLegIM.instanceMatrix.needsUpdate = true;
      oxTailIM.instanceMatrix.needsUpdate = true;
      // boyeros: caminan junto a la yunta de cada equipo
      fSc = 1;
      for (let i = 0; i < NT; i++) {
        const u = frac(t / TEAM_PERIOD + i / NT);
        const fade = sstep((u - 0.08) / 0.04) * sstep((0.98 - u) / 0.04);
        const sc = on ? Math.max(0.0001, fade) : 0.0001;
        const P = ROUTE.at(u);
        _TM.compose(_pp.set(P[0], 0, P[1]), _qq.setFromAxisAngle(_yAxis_, headingOf(P[2], P[3])), _ss.set(sc, sc, sc));
        const bw = _pp.set(4.2, 0, 2.4).applyMatrix4(_TM);
        fSc = sc;
        const sway = 0.4 * Math.sin(W * 4 + i);
        setPose(sway, -sway, -0.2, 0.2, 0.05, 0);
        figRoot(bw.x, 0, bw.z, headingOf(P[2], P[3]));
        drawFig(58 + i);
      }
      rutMesh.visible = on;
      fSc = 1;
    }
    // =====================================================================
    // 3. OBREROS: 0-13 cantera (con picos), 14-35 plataforma del estilóbato,
    //    36-49 obra en la fila de columnas (siguen el frente oeste→este según s.columns)
    // =====================================================================
    function updateWorkers(s, W, yT, c) {
      const qOn = V(s.quarry) > 0.02;
      fSc = qOn ? 1 : 0.0001;
      for (let i = 0; i < 14; i++) {
        const h1 = hash(i + 500), h2 = hash(i + 600);
        figRoot(QX + (h1 * 2 - 1) * 48, -12.0, QZ + (h2 * 2 - 1) * 30, h1 * TAU);
        const sw = Math.sin(W * 2.2 + i);
        setPose(0.08, -0.08, -0.3, -1.0 + 0.9 * sw, 0.35, 1);
        drawFig(i);
      }
      // plataforma: caminan de un lado a otro del estilóbato (y = 3)
      const pOn = V(s.workers) > 0.02 && V(s.platform) > 0.98;
      fSc = pOn ? 1 : 0.0001;
      for (let j = 0; j < 22; j++) {
        const i = 14 + j, h1 = hash(i + 500);
        const d = W * (0.8 + 0.4 * h1) + h1 * 120;
        const f = pingPong(d, 45);
        const dirX = frac(d / 90) < 0.5 ? 1 : -1;
        const z = (j % 2 ? 1 : -1) * (5 + (j % 7) * 2);
        figRoot(-45 + 90 * f, 3, z, headingOf(dirX, 0));
        const sw = Math.sin(W * 5 + h1 * TAU);
        const carry = j % 3 === 0;
        setPose(0.4 * sw, -0.4 * sw, carry ? -1.0 : -0.2 * sw, carry ? -1.0 : 0.2 * sw, carry ? 0.12 : 0.04, 0);
        drawFig(i);
      }
      // obra en la columna del frente: de pie sobre los andamios, a la altura yT
      const cOn = c > 0.02 && c < 0.98;
      fSc = cOn ? 1 : 0.0001;
      const xf = -55 + 110 * c;
      for (let j = 0; j < 14; j++) {
        const i = 36 + j, h1 = hash(i + 500);
        const z = -22 + (j / 13) * 44 + (h1 - 0.5) * 2;
        figRoot(clamp(xf - 1.2, -55, 55), yT + 1.2, z, 0);
        setPose(0.05, -0.05, -0.2, -1.1 + 0.8 * Math.cos(W * 3 + i), 0.35, 1);
        drawFig(i);
      }
      fSc = 1;
    }

    // =====================================================================
    // 4. GRÚAS DE MADERA con rueda de pisar (cuatro hombres dentro) y polipasto, al sur del templo
    // =====================================================================
    const craneFrameG = (function () {
      const mb = MB(), cW = new THREE.Color(0x6e4a2a), cDk = new THREE.Color(0x3a2a1a);
      mbBox(mb, 0, 0.3, 0, 3.6, 0.6, 2.4, cW);          // plataforma
      mbBox(mb, 0, 7.0, 0, 0.45, 13.0, 0.45, cW);       // mástil
      mbBox(mb, 9.0, 12.6, 0, 18.0, 0.3, 0.3, cW);      // pluma (18 m)
      mbBox(mb, -3.5, 12.3, 0, 6.0, 0.25, 0.25, cW);    // contrapluma
      mbBox(mb, -6.2, 11.8, 0, 1.6, 1.2, 1.2, cDk);     // contrapeso
      mbBox(mb, 0, 13.8, 0, 1.0, 0.6, 0.9, cW);         // cabeza del mástil
      mbBox(mb, -2.0, 1.8, 1.4, 0.3, 3.6, 0.3, cW);     // soporte del eje de la rueda
      return mbGeo(mb);
    })();
    const wheelG = (function () {
      const mb = MB(), cW = new THREE.Color(0x6e4a2a);
      mbAdd(mb, new THREE.TorusGeometry(2.4, 0.2, 6, 20), new THREE.Matrix4(), cW);
      for (let k = 0; k < 6; k++) mbAdd(mb, new THREE.BoxGeometry(4.8, 0.12, 0.12), new THREE.Matrix4().makeRotationZ(k * Math.PI / 3), cW);
      return mbGeo(mb);
    })();
    const NC = 2;
    const cFrameIM = mkIM(craneFrameG, MAT.woodVC, NC, true);
    const cWheelIM = mkIM(wheelG, MAT.woodVC, NC, true);
    const cRopeIM = mkIM(new THREE.BoxGeometry(0.05, 1, 0.05), MAT.rope, NC, false);
    const cHookIM = mkIM(new THREE.BoxGeometry(2.4, 1.2, 1.2), MAT.marble, NC, true);
    const cMenT = mkIM(new THREE.BoxGeometry(0.34, 0.6, 0.24), MAT.cloth, NC * 4, false);
    const cMenH = mkIM(new THREE.SphereGeometry(0.13, 6, 4), MAT.skin, NC * 4, false);
    const craneG = new THREE.Group(); root.add(craneG);
    craneG.add(cFrameIM, cWheelIM, cRopeIM, cHookIM, cMenT, cMenH);
    (function () { for (let i = 0; i < NC * 4; i++) cMenT.setColorAt(i, _c.setHex(i % 2 ? 0x3d6f9e : 0xd9c9a3)); cMenT.instanceColor.needsUpdate = true; })();
    const CRANE_AT = [[10, 40], [-34, 40]];
    const _rr = new THREE.Matrix4(), _wb = new THREE.Matrix4(), _hk = new THREE.Matrix4();
    const Q_ID = new THREE.Quaternion();
    function updateCranes(s, W) {
      const cr = V(s.cranes);
      for (let k = 0; k < NC; k++) {
        const sc = cr > 0.002 ? Math.max(0.0001, cr) : 0.0001;
        _TM.compose(_pp.set(CRANE_AT[k][0], 0, CRANE_AT[k][1]), Q_ID, _ss.set(sc, sc, sc));
        cFrameIM.setMatrixAt(k, _TM);
        // rueda de pisar: gira con los cuatro hombres dentro
        const wa = W * 0.9 * (k === 0 ? 1 : -1);
        _wb.multiplyMatrices(_TM, _rr.makeTranslation(-2.0, 3.6, 1.4)); _wb.multiply(_rot.makeRotationZ(wa));
        cWheelIM.setMatrixAt(k, _wb);
        for (let m = 0; m < 4; m++) {
          const th = m * Math.PI / 2;
          _loc.makeTranslation(Math.cos(th) * 2.1, Math.sin(th) * 2.1, 0);
          _rot.makeRotationZ(th + Math.PI / 2); _loc.multiply(_rot);
          _tmp.multiplyMatrices(_wb, _loc);
          cMenT.setMatrixAt(k * 4 + m, _tmp);
          _loc.makeTranslation(0, 0.45, 0);
          _tmp.multiply(_loc);
          cMenH.setMatrixAt(k * 4 + m, _tmp);
        }
        // polipasto: el cable baja y sube con el bloque de mármol
        const ropeLen = 3 + 2.0 * (0.5 + 0.5 * Math.sin(W * 0.5 + k));
        _loc.compose(_pp.set(17, 12.6 - ropeLen / 2, 0), Q_ID, _ss.set(1, ropeLen, 1));
        _tmp.multiplyMatrices(_TM, _loc); cRopeIM.setMatrixAt(k, _tmp);
        _loc.makeTranslation(17, 12.6 - ropeLen - 0.6, 0);
        _tmp.multiplyMatrices(_TM, _loc); cHookIM.setMatrixAt(k, _tmp);
      }
      cFrameIM.instanceMatrix.needsUpdate = true; cWheelIM.instanceMatrix.needsUpdate = true;
      cRopeIM.instanceMatrix.needsUpdate = true; cHookIM.instanceMatrix.needsUpdate = true;
      cMenT.instanceMatrix.needsUpdate = true; cMenH.instanceMatrix.needsUpdate = true;
    }

    // andamios rectangulares alrededor de las columnas en obra: torres en el frente (x = xf)
    const NPOST = 16, NBRD = 32;
    const postIM = mkIM(new THREE.BoxGeometry(0.2, 1, 0.2), MAT.wood, NPOST, true);
    const boardIM = mkIM(new THREE.BoxGeometry(1, 0.14, 0.5), MAT.wood, NBRD, true);
    root.add(postIM, boardIM);
    const _ax = new THREE.Quaternion().setFromAxisAngle(_yAxis, Math.PI / 2);
    function updateScaffold(c, yT) {
      const on = c > 0.02 && c < 0.98;
      const xf = -55 + 110 * c, h = 2.2, hT = yT + 1.5;
      let pi = 0, bi = 0;
      for (let j = 0; j < 4; j++) {
        const tz = [-25, 25, -19, 19][j];
        const tx = clamp(xf, -55, 55);
        for (let sx = -1; sx <= 1; sx += 2) for (let sz = -1; sz <= 1; sz += 2) {
          if (on) { _pp.set(tx + sx * h, hT / 2, tz + sz * h); _ss.set(1, hT, 1); _m.compose(_pp, Q_ID, _ss); }
          else _m.copy(ZERO);
          postIM.setMatrixAt(pi++, _m);
        }
        for (const y of [hT * 0.5, hT - 0.3]) {
          // lados paralelos a X (en z = tz ± h) y a Z (en x = tx ± h)
          for (let sd = -1; sd <= 1; sd += 2) {
            if (on) { _pp.set(tx, y, tz + sd * h); _ss.set(4.6, 1, 1); _m.compose(_pp, Q_ID, _ss); } else _m.copy(ZERO);
            boardIM.setMatrixAt(bi++, _m);
            if (on) { _pp.set(tx + sd * h, y, tz); _ss.set(4.6, 1, 1); _m.compose(_pp, _ax, _ss); } else _m.copy(ZERO);
            boardIM.setMatrixAt(bi++, _m);
          }
        }
      }
      postIM.instanceMatrix.needsUpdate = true; boardIM.instanceMatrix.needsUpdate = true;
    }

    // @@REST
    // @@END
  };
})();
