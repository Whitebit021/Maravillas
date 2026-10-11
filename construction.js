// Obra de construcción: cantera, obreros, trineos, rampa, barcazas, campamento.
// Todo generado por código. Función pura del estado s (t, wall, build, ...).
(function () {
  'use strict';
  const G = window.GIZA;

  G.createConstruction = function (ctx) {
    const THREE = ctx.THREE, scene = ctx.scene, renderer = ctx.renderer;
    const root = new THREE.Group();
    scene.add(root);

    const PYR = G.PYR, Q = G.SITE.quarry;
    const H = PYR.height;
    const CX = Q.x, CZ = Q.z, QHW = Q.w / 2, QHD = Q.d / 2, QDEP = Q.depth;
    const TAU = Math.PI * 2;
    // Espiral de pendiente constante (~12%): dy/dθ = k·w(y), w = radio del centro de la rampa.
    // Así la rampa nunca se vuelve casi vertical cerca de la cúspide y termina en y=H.
    const RAMP_K = 0.12;
    const RT_Y = [0], RT_TH = [0];
    (function buildSpiral() {
      let th = 0, y = 0;
      const dth = 0.002;
      while (y < H && th < 400) {
        const w = Math.max(0, PYR.halfAt(y)) + 4.3;
        y += RAMP_K * w * dth;
        th += dth;
        RT_Y.push(Math.min(y, H)); RT_TH.push(th);
      }
    })();
    // ángulo de la espiral a una altura y (interpolado sobre la tabla)
    function thetaAtY(y) {
      if (y <= 0) return 0;
      const n = RT_Y.length - 1;
      if (y >= RT_Y[n]) return RT_TH[n];
      let lo = 0, hi = n;
      while (hi - lo > 1) { const m = (lo + hi) >> 1; if (RT_Y[m] <= y) lo = m; else hi = m; }
      const a = (y - RT_Y[lo]) / Math.max(1e-9, RT_Y[hi] - RT_Y[lo]);
      return RT_TH[lo] + (RT_TH[hi] - RT_TH[lo]) * a;
    }
    const PERIOD = 220;      // ciclo de un trineo (s de video)
    renderer.localClippingEnabled = true;

    // ---------- utilidades ----------
    function hash(n) { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
    function clamp(x, a, b) { return x < a ? a : (x > b ? b : x); }
    function frac(x) { return x - Math.floor(x); }
    function sstep(x) { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); }
    function sqDir(th) { const s = Math.sin(th), c = Math.cos(th); const m = Math.max(Math.abs(s), Math.abs(c)); return [s / m, c / m]; }

    // ---------- materiales ----------
    const MAT = {
      rock:   new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }),
      stone:  new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, flatShading: true }),
      wood:   new THREE.MeshStandardMaterial({ color: 0x7a5230, roughness: 0.9 }),
      woodVC: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true, side: THREE.DoubleSide }),
      ramp:   new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide }),
      skin:   new THREE.MeshStandardMaterial({ color: 0x8c5a3a, roughness: 0.8, flatShading: true }),
      skirt:  new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, flatShading: true }),
      hair:   new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, flatShading: true }),
      iron:   new THREE.MeshStandardMaterial({ color: 0x2b2a29, roughness: 0.7, metalness: 0.1 }),
      copper: new THREE.MeshStandardMaterial({ color: 0xb87333, roughness: 0.4, metalness: 0.6 }),
      wake:   new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false }),
      banner: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, side: THREE.DoubleSide }),
      rope:   new THREE.LineBasicMaterial({ color: 0xd9c58a }),
      water:  new THREE.LineBasicMaterial({ color: 0x8fe0ff, transparent: true, opacity: 0.8 }),
      dust:   new THREE.PointsMaterial({ color: 0xd8c08a, size: 2.4, transparent: true, opacity: 0.45, depthWrite: false }),
      smoke:  new THREE.PointsMaterial({ color: 0xd8d2c4, size: 7.0, transparent: true, opacity: 0.5, depthWrite: false }),
      sail:   new THREE.MeshStandardMaterial({ color: 0xf2ecdc, roughness: 0.95, side: THREE.DoubleSide }),
      adobe:  new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true }),
      roof:   new THREE.MeshStandardMaterial({ color: 0x7d5c3b, roughness: 1 }),
      water2: new THREE.MeshStandardMaterial({ color: 0x1d4a5e, roughness: 0.4, metalness: 0.1 }),
      granite:new THREE.MeshStandardMaterial({ color: 0xd9978a, roughness: 0.7, flatShading: true })
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
    function mbBox(mb, x, y, z, sx, sy, sz, c, ry, rx) {
      const g = new THREE.BoxGeometry(sx, sy, sz);
      const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx || 0, ry || 0, 0, 'YXZ'));
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

    // ---------- helpers de instancias estáticas ----------
    const _m4 = new THREE.Matrix4(), _q4 = new THREE.Quaternion(), _p3 = new THREE.Vector3();
    const _s3 = new THREE.Vector3(1, 1, 1), _e3 = new THREE.Euler(), _c3 = new THREE.Color();
    const _t4 = new THREE.Matrix4(), _bm = new THREE.Matrix4(), _sc4 = new THREE.Matrix4();
    function setInst(im, idx, x, y, z, ry, sc) {
      _p3.set(x, y, z);
      _q4.setFromEuler(_e3.set(0, ry || 0, 0, 'XYZ'));
      const k = sc === undefined ? 1 : sc;
      _s3.set(k, k, k);
      _m4.compose(_p3, _q4, _s3);
      im.setMatrixAt(idx, _m4);
    }

    // =====================================================================
    // 1. CANTERA  (centro (0,400), 160x90, depresión 12 m)
    // =====================================================================
    const quarryG = new THREE.Group();
    root.add(quarryG);
    const qmb = MB();
    const cRock = new THREE.Color(0xc0844a), cCut = new THREE.Color(0xe0a862);
    const cFloor = new THREE.Color(0x94693c), cGroove = new THREE.Color(0x3a2112);
    const cChisel = new THREE.Color(0xf2d49a), cWood = new THREE.Color(0x7a5230), cRoad = new THREE.Color(0xc29a5e);

    // Banda de roca entre inset lo (exterior) e inset hi (interior), entre y0 y y1.
    function ringPlate(lo, hi, y0, y1, c) {
      const th = hi - lo, h = y1 - y0, yc = (y0 + y1) / 2, mid = (lo + hi) / 2;
      const outerX = QHW - lo, innerZ = QHD - hi;
      mbBox(qmb, CX, yc, CZ - (QHD - mid), 2 * outerX, h, th, c);
      mbBox(qmb, CX, yc, CZ + (QHD - mid), 2 * outerX, h, th, c);
      mbBox(qmb, CX - (QHW - mid), yc, CZ, th, h, 2 * innerZ, c);
      mbBox(qmb, CX + (QHW - mid), yc, CZ, th, h, 2 * innerZ, c);
    }
    // Ranuras verticales cada 3 m sobre las caras de un nivel de pared (pared en inset P).
    function grooves(P, y0, y1) {
      const h = (y1 - y0) * 0.7, yc = (y0 + y1) / 2;
      const zN = CZ - (QHD - P), zS = CZ + (QHD - P), xW = CX - (QHW - P), xE = CX + (QHW - P);
      for (let x = -QHW + P + 1.5; x < QHW - P - 1; x += 3.0) {
        mbBox(qmb, x, yc, zN + 0.03, 0.14, h, 0.1, cGroove);
        mbBox(qmb, x, yc, zS - 0.03, 0.14, h, 0.1, cGroove);
      }
      for (let z = zN + 1.5; z < zS - 1; z += 3.0) {
        mbBox(qmb, xW + 0.03, yc, z, 0.1, h, 0.14, cGroove);
        mbBox(qmb, xE - 0.03, yc, z, 0.1, h, 0.14, cGroove);
      }
      // Franjas de marcas de cincel (horizontales, claras) cada 0.45 m
      for (let yy = y0 + 0.3; yy < y1 - 0.1; yy += 0.45) {
        mbBox(qmb, CX, yy, zN + 0.04, 2 * (QHW - P) - 2, 0.07, 0.06, cChisel);
        mbBox(qmb, CX, yy, zS - 0.04, 2 * (QHW - P) - 2, 0.07, 0.06, cChisel);
        mbBox(qmb, CX - (QHW - P) + 0.04, yy, CZ, 0.06, 0.07, 2 * (QHD - P) - 2, cChisel);
        mbBox(qmb, CX + (QHW - P) - 0.04, yy, CZ, 0.06, 0.07, 2 * (QHD - P) - 2, cChisel);
      }
    }
    // Suelo de la cantera
    mbBox(qmb, CX, -12.25, CZ, 136, 0.5, 66, cFloor);
    // Niveles escalonados (paredes y banquetas)
    ringPlate(11.4, 12, -12, -8, cCut);     // pared inferior
    ringPlate(6, 12, -8.4, -8, cRock);      // banqueta 1
    ringPlate(5.4, 6, -8, -4, cCut);        // pared media
    ringPlate(0, 6, -4.4, -4, cRock);       // banqueta 2
    ringPlate(-0.6, 0, -4, 0, cCut);        // borde superior
    grooves(12, -12, -8);
    grooves(6, -8, -4);
    grooves(0, -4, 0);
    // Rampa de acceso (cortada en la pared norte) desde el suelo de la cantera al llano
    mbBox(qmb, 0, -6, 368, 6, 0.6, 34.2, cRoad, 0, 0.35);
    // Andamio de madera sobre el borde norte
    [[40, 348], [60, 348], [40, 351], [60, 351]].forEach(function (p) { mbBox(qmb, p[0], 3.5, p[1], 0.25, 7, 0.25, cWood); });
    mbBox(qmb, 50, 2.2, 349.5, 21, 0.12, 2.2, cWood);
    mbBox(qmb, 50, 5.0, 349.5, 21, 0.12, 2.2, cWood);

    const quarryMesh = new THREE.Mesh(mbGeo(qmb), MAT.rock);
    quarryMesh.castShadow = true; quarryMesh.receiveShadow = true;
    quarryMesh.frustumCulled = false;
    quarryG.add(quarryMesh);

    // Herramientas en el suelo: cinceles de cobre, escuadras y plomadas de madera
    const toolMB = MB();
    for (let i = 0; i < 14; i++) {
      const x = -58 + hash(i + 2000) * 116, z = 382 + hash(i + 2100) * 40;
      mbBox(toolMB, x, -11.9, z, 0.1, 0.1, 0.9, new THREE.Color(0xb87333), hash(i + 2200) * 3);
    }
    for (let i = 0; i < 4; i++) {
      const x = -40 + i * 26, z = 386 + (i % 2) * 14;
      mbBox(toolMB, x, -11.9, z, 1.4, 0.06, 0.12, cWood);
      mbBox(toolMB, x - 0.64, -11.9, z + 0.5, 0.12, 0.06, 1.0, cWood);   // escuadra
      mbBox(toolMB, x + 2.2, -11.9, z, 0.05, 0.05, 1.6, cWood);          // plomada: cuerda
      mbBox(toolMB, x + 2.2, -11.9, z + 0.85, 0.12, 0.12, 0.12, new THREE.Color(0x3a2a1a));
    }
    [-42, 42].forEach(function (x) {
      mbBox(toolMB, x - 2.6, 3.5, 349.2, 0.2, 7, 0.2, cWood);
      mbBox(toolMB, x + 2.6, 3.5, 349.2, 0.2, 7, 0.2, cWood);
    });
    const toolMesh = new THREE.Mesh(mbGeo(toolMB), MAT.woodVC);
    toolMesh.frustumCulled = false;
    quarryG.add(toolMesh);

    // Estandartes de cuadrilla "Amigos de Keops" en los postes del borde norte
    function makeBannerTex() {
      const cv = document.createElement('canvas');
      cv.width = 512; cv.height = 160;
      const g = cv.getContext('2d');
      g.fillStyle = '#5a2a14'; g.fillRect(0, 0, 512, 160);
      g.strokeStyle = '#e0b34a'; g.lineWidth = 6; g.strokeRect(10, 10, 492, 140);
      g.strokeStyle = '#e0b34a'; g.lineWidth = 5;
      // glifos estilizados: ojo, cruz ankh y onda de agua
      g.beginPath(); g.ellipse(70, 80, 26, 14, 0, 0, Math.PI * 2); g.stroke();
      g.beginPath(); g.arc(70, 80, 5, 0, Math.PI * 2); g.stroke();
      g.beginPath(); g.ellipse(442, 80, 14, 26, 0, 0, Math.PI * 2); g.stroke();
      g.beginPath(); g.moveTo(430, 110); g.lineTo(454, 110); g.moveTo(442, 110); g.lineTo(442, 60); g.stroke();
      g.fillStyle = '#e0b34a'; g.font = 'bold 44px Georgia, serif';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('AMIGOS DE KEOPS', 256, 82);
      const tex = new THREE.CanvasTexture(cv);
      tex.encoding = THREE.sRGBEncoding;
      return tex;
    }
    const bannerTex = makeBannerTex();
    const bannerMat = new THREE.MeshStandardMaterial({ map: bannerTex, roughness: 0.9, side: THREE.DoubleSide });
    const bannerGeo = new THREE.PlaneGeometry(5, 1.6);
    [-42, 42].forEach(function (x) {
      const bn = new THREE.Mesh(bannerGeo, bannerMat);
      bn.position.set(x, 5.6, 349.2);
      bn.frustumCulled = false;
      quarryG.add(bn);
    });

    // Bloques: 3 montones terminados (27) + 28 a medio extraer en las paredes sur-norte inferiores
    const stoneIM = new THREE.InstancedMesh(new THREE.BoxGeometry(2.4, 1.2, 1.2), MAT.stone, 55);
    stoneIM.frustumCulled = false; stoneIM.castShadow = true; stoneIM.receiveShadow = true;
    const wedgeIM = new THREE.InstancedMesh(new THREE.BoxGeometry(0.22, 0.2, 0.5), MAT.wood, 56);
    wedgeIM.frustumCulled = false;
    quarryG.add(stoneIM, wedgeIM);

    let si = 0;
    const stoneCols = [0xd9c69a, 0xe6d6ac, 0xcdb88c];
    [[-54, 412], [50, 414], [6, 426]].forEach(function (p, pi) {
      for (let l = 0; l < 3; l++) for (let k = -1; k <= 1; k++) {
        const y = -12 + 0.6 + l * 1.2;
        if (l % 2 === 0) setInst(stoneIM, si, p[0], y, p[1] + k * 1.25, 0);
        else setInst(stoneIM, si, p[0] + k * 1.25, y, p[1], Math.PI / 2);
        stoneIM.setColorAt(si, _c3.setHex(stoneCols[(pi + si) % 3]));
        si++;
      }
    });
    let wi = 0;
    // Bloques a medio extraer: pared norte (zb=367, pit hacia +z) y sur (zb=433, pit hacia -z)
    [[367, 1], [433, -1]].forEach(function (b) {
      const zb = b[0], inward = b[1];
      for (let i = 0; i < 14; i++) {
        const x = -60 + i * 9.2;
        setInst(stoneIM, si, x, -10, zb + inward * 0.6, 0);
        stoneIM.setColorAt(si, _c3.setHex(0xdccb9b));
        si++;
        mbBox(qmb, x, -10.75, zb + inward * 0.04, 2.5, 0.12, 0.1, cGroove);
        mbBox(qmb, x, -9.25, zb + inward * 0.04, 2.5, 0.12, 0.1, cGroove);
        setInst(wedgeIM, wi++, x, -10.75, zb + inward * 0.2, 0);
        setInst(wedgeIM, wi++, x, -9.25, zb + inward * 0.2, 0);
      }
    });
    stoneIM.instanceMatrix.needsUpdate = true;
    wedgeIM.instanceMatrix.needsUpdate = true;
    stoneIM.instanceColor.needsUpdate = true;

    // =====================================================================
    // 4. RAMPA en espiral (geometría completa, recortada por plano y=top)
    // =====================================================================
    const rampG = new THREE.Group();
    root.add(rampG);
    const clipPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);
    MAT.ramp.clippingPlanes = [clipPlane];
    // Cinta de 8 m (sin relleno): cara superior, cara exterior y cara inferior de 1.2 m de grosor.
    // La cara interna queda dentro de la piedra (pegada a la cara de la pirámide).
    const NR = 480;
    const cTop = new THREE.Color(0xa86e3c), cSide = new THREE.Color(0x6e4726);
    const rpos = [], rcol = [], ridx = [];
    let rv = 0;
    function rPush(r, y, d, c) {
      rpos.push(d[0] * r, y, d[1] * r);
      rcol.push(c.r, c.g, c.b);
      return rv++;
    }
    const iIT = [], iOT = [], iOB = [], iIB = [];
    for (let i = 0; i <= NR; i++) {
      const u = i / NR, y = u * H, d = sqDir(thetaAtY(y));
      const hh = Math.max(0, PYR.halfAt(y));
      const ri = hh + 0.3, ro = hh + 8.3;
      iIT[i] = rPush(ri, y, d, cTop);
      iOT[i] = rPush(ro, y, d, cTop);
      iOB[i] = rPush(ro, y - 1.2, d, cSide);
      iIB[i] = rPush(ri, y - 1.2, d, cSide);
    }
    for (let i = 0; i < NR; i++) {
      // cara superior
      ridx.push(iIT[i], iOT[i], iIT[i + 1], iOT[i], iOT[i + 1], iIT[i + 1]);
      // cara exterior
      ridx.push(iOT[i], iOB[i], iOT[i + 1], iOB[i], iOB[i + 1], iOT[i + 1]);
      // cara inferior
      ridx.push(iOB[i], iIB[i], iOB[i + 1], iIB[i], iIB[i + 1], iOB[i + 1]);
    }
    const rampGeo = new THREE.BufferGeometry();
    rampGeo.setAttribute('position', new THREE.Float32BufferAttribute(rpos, 3));
    rampGeo.setAttribute('color', new THREE.Float32BufferAttribute(rcol, 3));
    rampGeo.setIndex(ridx);
    rampGeo.computeVertexNormals();
    const rampMesh = new THREE.Mesh(rampGeo, MAT.ramp);
    rampMesh.castShadow = true; rampMesh.receiveShadow = true; rampMesh.frustumCulled = false;
    rampG.add(rampMesh);

    // Maderos y palancas en la parte alta (se colocan en función del tope)
    const logIM = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.15, 0.15, 3.0, 6), MAT.wood, 8);
    const leverIM = new THREE.InstancedMesh(new THREE.BoxGeometry(0.3, 0.3, 3.0), MAT.wood, 3);
    const liftIM = new THREE.InstancedMesh(new THREE.BoxGeometry(2.4, 1.2, 1.2), MAT.stone, 1);
    logIM.frustumCulled = false; leverIM.frustumCulled = false; liftIM.frustumCulled = false;
    liftIM.castShadow = true;
    rampG.add(logIM, leverIM, liftIM);
    const _up = new THREE.Vector3(0, 1, 0), _dv = new THREE.Vector3();
    function updateRampProps(topY, W) {
      // las piezas nunca suben por encima de la cúspide (H)
      const topC = Math.min(topY, H - 3);
      const th = thetaAtY(topC);
      const on = topY > 2 ? 1 : 0;
      const hh = Math.max(0, PYR.halfAt(topC));
      // bloque en la cima (2.4 m), levantado por las palancas (sube y baja con el reloj)
      const dl = sqDir(th);
      const lift = 0.3 + 0.5 * (0.5 + 0.5 * Math.sin(W * 0.7));
      _p3.set(dl[0] * (hh + 4.3), topC + lift, dl[1] * (hh + 4.3));
      _q4.setFromEuler(_e3.set(0, th + Math.PI / 2, 0, 'XYZ'));
      _s3.set(on, on, on);
      _m4.compose(_p3, _q4, _s3);
      liftIM.setMatrixAt(0, _m4);
      liftIM.instanceMatrix.needsUpdate = true;
      for (let k = 0; k < 8; k++) {
        const d = sqDir(th + (k - 3.5) * 0.12);
        const r = hh + 4.3;
        _p3.set(d[0] * r, topC + 0.15, d[1] * r);
        _dv.set(d[0], 0, d[1]).normalize();
        _q4.setFromUnitVectors(_up, _dv);
        _s3.set(on, on, on);
        _m4.compose(_p3, _q4, _s3);
        logIM.setMatrixAt(k, _m4);
      }
      for (let k = 0; k < 3; k++) {
        const d = sqDir(th + (k - 1) * 0.3);
        const ro = hh + 8.5;
        // palanca: pivota en el borde exterior y se inclina hacia fuera (3 m, a escala humana)
        _dv.set(d[0], 0, d[1]).normalize().multiplyScalar(0.8).add(new THREE.Vector3(0, 0.6, 0)).normalize();
        _q4.setFromUnitVectors(_up, _dv);
        _p3.set(d[0] * ro + _dv.x * 1.5, topC + 0.1 + _dv.y * 1.5, d[1] * ro + _dv.z * 1.5);
        _s3.set(on, on, on);
        _m4.compose(_p3, _q4, _s3);
        leverIM.setMatrixAt(k, _m4);
      }
      logIM.instanceMatrix.needsUpdate = true;
      leverIM.instanceMatrix.needsUpdate = true;
    }

    // =====================================================================
    // 3. TRINEOS: trayectoria cantera -> base de la rampa -> espiral
    // =====================================================================
    const pathPts = [
      [0, -12, 430], [0, -12, 400], [0, -12, 384], [0, -6, 368], [0, -1.1, 355],
      [0, 0, 340], [0, 0, 300], [0, 0, 230], [0, 0, 170]
    ].map(function (p) { return new THREE.Vector3(p[0], p[1], p[2]); });
    const RP = 600;
    for (let k = 0; k <= RP; k++) {
      const u = k / RP, y = u * H;
      const r = Math.max(0, PYR.halfAt(y)) + 4.3;   // centro del ancho de la rampa (0.3..8.3)
      const d = sqDir(thetaAtY(y));
      pathPts.push(new THREE.Vector3(d[0] * r, y, d[1] * r));
    }
    const path = new THREE.CatmullRomCurve3(pathPts, false, 'centripetal');
    path.arcLengthDivisions = 2000;
    const LEN = path.getLength();

    // Tabla y(f) para saber hasta qué fracción del camino llega el tope construido
    const TB_N = 1500, tbF = new Float32Array(TB_N + 1), tbY = new Float32Array(TB_N + 1);
    for (let k = 0; k <= TB_N; k++) {
      tbF[k] = k / TB_N;
      tbY[k] = path.getPointAt(k / TB_N).y;
    }
    function fracForTop(top) {
      if (tbY[0] > top) return 0;
      let lo = 0, hi = TB_N;
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (tbY[mid] <= top) lo = mid; else hi = mid - 1;
      }
      return tbF[lo];
    }

    const NS = 6;
    const SL = [];
    for (let k = 0; k < NS; k++) SL.push({ x: 0, y: 0, z: 0, tx: 0, tz: 1, sg: 1, f: 0, mf: 0, loaded: false, hd: 0, pitch: 0 });

    function updateSledges(t, topY) {
      const mf = fracForTop(topY);
      for (let k = 0; k < NS; k++) {
        const sk = SL[k];
        const c = frac(t / PERIOD + k / NS);
        let f, sg = 1;
        if (c < 0.62) { f = (c / 0.62) * mf; sk.loaded = true; }        // cargado, sube
        else if (c < 0.70) { f = mf; sk.loaded = false; }               // descarga arriba
        else { f = (1 - (c - 0.70) / 0.30) * mf; sk.loaded = false; sg = -1; } // vuelve vacío
        f = clamp(f, 0, 1);
        sk.f = f; sk.mf = mf; sk.sg = sg;
        const P = path.getPointAt(f), T = path.getTangentAt(f);
        sk.x = P.x; sk.y = P.y; sk.z = P.z;
        sk.tx = T.x * sg; sk.tz = T.z * sg;
        sk.hd = Math.atan2(sk.tx, sk.tz);
        sk.pitch = -Math.asin(clamp(T.y * sg, -1, 1));
      }
    }

    const sledgeG = new THREE.Group();
    root.add(sledgeG);
    const sledgeIM = new THREE.InstancedMesh(new THREE.BoxGeometry(1.8, 0.35, 4.4), MAT.wood, NS);
    const loadIM = new THREE.InstancedMesh(new THREE.BoxGeometry(1.2, 1.2, 2.4), MAT.stone, NS * 2);
    sledgeIM.frustumCulled = false; loadIM.frustumCulled = false;
    sledgeIM.castShadow = true; loadIM.castShadow = true;
    sledgeG.add(sledgeIM, loadIM);

    // Camino de tablones sobre el tramo de llano (z 120..340, x=0)
    const plankN = 490;
    const plankIM = new THREE.InstancedMesh(new THREE.BoxGeometry(3.4, 0.08, 0.3), MAT.wood, plankN);
    plankIM.frustumCulled = false; plankIM.receiveShadow = true;
    for (let i = 0; i < plankN; i++) {
      setInst(plankIM, i, 0, 0.04, 120 + i * 0.45, 0);
      plankIM.setColorAt(i, _c3.setHex(i % 2 ? 0xc89460 : 0xb27c4a));
    }
    plankIM.instanceMatrix.needsUpdate = true;
    plankIM.instanceColor.needsUpdate = true;
    sledgeG.add(plankIM);

    // Trineo del escaparate (con 2 bloques)
    const showSledIM = new THREE.InstancedMesh(new THREE.BoxGeometry(1.8, 0.35, 4.4), MAT.wood, 1);
    const showLoadIM = new THREE.InstancedMesh(new THREE.BoxGeometry(1.2, 1.2, 2.4), MAT.stone, 2);
    showSledIM.frustumCulled = false; showLoadIM.frustumCulled = false;
    showSledIM.castShadow = true; showLoadIM.castShadow = true;
    sledgeG.add(showSledIM, showLoadIM);

    // Polvo de la cantera (cortadores golpeando)
    const NQD = 160, qdPos = new Float32Array(NQD * 3), qdA = [], qdB = [];
    for (let i = 0; i < NQD; i++) { qdA.push(hash(i + 3000)); qdB.push(hash(i + 3100)); }
    const qdGeo = new THREE.BufferGeometry();
    qdGeo.setAttribute('position', new THREE.BufferAttribute(qdPos, 3));
    const quarryDust = new THREE.Points(qdGeo, MAT.dust);
    quarryDust.frustumCulled = false;
    quarryG.add(quarryDust);
    function updateQuarryDust(W) {
      for (let i = 0; i < NQD; i++) {
        const age = frac(W * 0.5 + qdA[i]);
        qdPos[i * 3] = -66 + qdB[i] * 132;
        qdPos[i * 3 + 1] = -11 + age * 4.5;
        qdPos[i * 3 + 2] = 370 + hash(i + 3200) * 6 + age * 2;
      }
      qdGeo.attributes.position.needsUpdate = true;
    }

    const _sm = new THREE.Matrix4(), _lm = new THREE.Matrix4();
    function drawSledges() {
      for (let k = 0; k < NS; k++) {
        const sk = SL[k];
        _p3.set(sk.x, sk.y + 0.5, sk.z);
        _q4.setFromEuler(_e3.set(sk.pitch, sk.hd, 0, 'YXZ'));
        _s3.set(1, 1, 1);
        _sm.compose(_p3, _q4, _s3);
        sledgeIM.setMatrixAt(k, _sm);
        for (let b = 0; b < 2; b++) {
          const lz = b === 0 ? -1.0 : 1.0;
          _t4.makeTranslation(0, 0.78, lz);
          _lm.multiplyMatrices(_sm, _t4);
          const sc = sk.loaded ? 1 : 0;
          _sc4.makeScale(sc, sc, sc);
          _lm.multiply(_sc4);
          loadIM.setMatrixAt(k * 2 + b, _lm);
        }
      }
      sledgeIM.instanceMatrix.needsUpdate = true;
      loadIM.instanceMatrix.needsUpdate = true;
    }

    // =====================================================================
    // 2. OBREROS (316): 120 cortadores, 60 tiradores, 6 aguadores, 10 capataces, 120 caminantes
    // =====================================================================
    // 120 cortadores (0-119), 120 tiradores (120-239), 6 aguadores (240-245),
    // 10 capataces (246-255), 120 caminantes (256-375)
    // 376-395 equipo de escaparate (20 tiradores), 396 aguador, 397 capataz del escaparate
    const NW = 398;
    const workersG = new THREE.Group();
    root.add(workersG);
    const headIM = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 7, 5), MAT.skin, NW);
    const hairIM = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), MAT.hair, NW);
    const torsoIM = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), MAT.skin, NW);
    const skirtIM = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.5, 0.6, 1, 7), MAT.skirt, NW);
    const legIM = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), MAT.skin, NW * 2);
    const armIM = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), MAT.skin, NW * 2);
    const stickIM = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), MAT.wood, NW);
    const malletIM = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), MAT.iron, NW);
    const WIMS = [headIM, hairIM, torsoIM, skirtIM, legIM, armIM, stickIM, malletIM];
    WIMS.forEach(function (im) { im.frustumCulled = false; workersG.add(im); });
    torsoIM.castShadow = true; legIM.castShadow = true; headIM.castShadow = true;
    // Pañuelos de colores contrastados en la cabeza
    const scarfPal = [0xd62828, 0xf7c600, 0x1d8fd6, 0x2bb673, 0xffffff, 0xf26b1d];
    for (let i = 0; i < NW; i++) hairIM.setColorAt(i, _c3.setHex(scarfPal[i % scarfPal.length]));
    hairIM.instanceColor.needsUpdate = true;

    const _rootM = new THREE.Matrix4(), _rq = new THREE.Quaternion(), _rp = new THREE.Vector3(), _rs = new THREE.Vector3();
    const _yAxis = new THREE.Vector3(0, 1, 0);
    const _W1 = new THREE.Matrix4(), _W2 = new THREE.Matrix4(), _W3 = new THREE.Matrix4(), _E4 = new THREE.Euler();
    function setRoot(x, y, z, hd, a) {
      _rp.set(x, y, z); _rq.setFromAxisAngle(_yAxis, hd); _rs.set(a, a, a);
      _rootM.compose(_rp, _rq, _rs);
    }
    // Coloca una pieza: pivote (px,py,pz) -> rot X/Z -> offset (ox,oy,oz) -> escala
    function placeW(im, idx, px, py, pz, rx, rz, ox, oy, oz, sx, sy, sz) {
      _W1.makeTranslation(px, py, pz);
      _E4.set(rx, 0, rz, 'XYZ');
      _W2.makeRotationFromEuler(_E4);
      _W1.multiply(_W2);
      _W2.makeTranslation(ox, oy, oz);
      _W1.multiply(_W2);
      _W2.makeScale(sx, sy, sz);
      _W1.multiply(_W2);
      _W3.multiplyMatrices(_rootM, _W1);
      im.setMatrixAt(idx, _W3);
    }
    const PS = { ll: 0, lr: 0, al: 0, ar: 0, lean: 0, cut: false };
    function drawWorker(i) {
      placeW(torsoIM, i, 0, 1.25, 0, PS.lean, 0, 0, 0, 0, 0.42, 0.66, 0.24);
      placeW(headIM, i, 0, 1.25, 0, PS.lean, 0, 0, 0.43, 0, 0.14, 0.14, 0.14);
      placeW(hairIM, i, 0, 1.25, 0, PS.lean, 0, 0, 0.52, -0.01, 0.36, 0.16, 0.36);
      placeW(skirtIM, i, 0, 0.9, 0, 0, 0, 0, 0, 0, 0.6, 0.32, 0.6);
      placeW(legIM, 2 * i, -0.11, 0.9, 0, PS.ll, 0, 0, -0.45, 0, 0.19, 0.9, 0.2);
      placeW(legIM, 2 * i + 1, 0.11, 0.9, 0, PS.lr, 0, 0, -0.45, 0, 0.19, 0.9, 0.2);
      placeW(armIM, 2 * i, -0.27, 1.5, 0, PS.al, 0, 0, -0.33, 0, 0.13, 0.66, 0.13);
      placeW(armIM, 2 * i + 1, 0.27, 1.5, 0, PS.ar, 0, 0, -0.33, 0, 0.13, 0.66, 0.13);
      const cs = PS.cut ? 1 : 0;
      const staff = ((i >= 246 && i < 256) || i === 397) ? 1 : 0;   // capataces llevan bastón
      const ss = (PS.cut || staff) ? 1 : 0;
      placeW(stickIM, i, 0.27, 1.5, 0, PS.ar, 0, 0, -0.45, 0, 0.05 * ss, (staff ? 1.5 : 0.9) * ss, 0.05 * ss);
      placeW(malletIM, i, 0.27, 1.5, 0, PS.ar, 0, 0, -0.92, 0, 0.16 * cs, 0.14 * cs, 0.24 * cs);
    }

    // Posiciones de cuerdas y agua (se rellenan en updateWorkers)
    const NPULL = 120, NPOUR = 6;
    const ropePos = new Float32Array((NPULL + 20) * 2 * 3);
    const ropeGeo = new THREE.BufferGeometry();
    ropeGeo.setAttribute('position', new THREE.BufferAttribute(ropePos, 3));
    const ropes = new THREE.LineSegments(ropeGeo, MAT.rope);
    ropes.frustumCulled = false;
    const waterPos = new Float32Array((NPOUR + 1) * 2 * 3);
    const waterGeo = new THREE.BufferGeometry();
    waterGeo.setAttribute('position', new THREE.BufferAttribute(waterPos, 3));
    const waterLines = new THREE.LineSegments(waterGeo, MAT.water);
    waterLines.frustumCulled = false;
    sledgeG.add(ropes, waterLines);

    // Polvo de los trineos
    const ND = 360;
    const dA = [], dB = [], dC = [], dD = [];
    for (let i = 0; i < ND; i++) { dA.push(hash(i + 1)); dB.push(hash(i + 201)); dC.push(hash(i + 401)); dD.push(hash(i + 601)); }
    const dustPos = new Float32Array(ND * 3);
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
    const dust = new THREE.Points(dustGeo, MAT.dust);
    dust.frustumCulled = false;
    sledgeG.add(dust);

    // Trayectoria de los caminantes: campamento -> cantera
    const walkPath = new THREE.CatmullRomCurve3([
      [280, 0, 252], [200, 0, 285], [120, 0, 320], [60, 0, 345], [30, 0, 352]
    ].map(function (p) { return new THREE.Vector3(p[0], p[1], p[2]); }), false, 'catmullrom');
    walkPath.arcLengthDivisions = 400;

    const handP = new Float32Array((NPULL + 20) * 3);       // manos de tiradores (+20 del escaparate)
    const pourHand = new Float32Array((NPOUR + 1) * 3), pourGround = new Float32Array((NPOUR + 1) * 3);
    const FORE = [];
    for (let i = 0; i < 10; i++) FORE.push({ x: (i % 2 ? 1 : -1) * 7, z: 130 + Math.floor(i / 2) * 22, idx: i });

    function updateWorkers(s) {
      const W = s.wall, t = s.t;
      const aQ = clamp(s.quarry * 2, 0, 1), aW = clamp(s.workers * 2, 0, 1);

      // Cortadores: 3 filas de 40 frente a la pared norte del fondo, golpeando con mazos
      for (let i = 0; i < 120; i++) {
        const row = Math.floor(i / 40), slot = i % 40;
        const x = -66 + slot * (132 / 39), z = 369.5 + row * 2.4;
        const cyc = frac(W * 0.85 + hash(i));
        PS.ar = 1.5 + 1.4 * Math.cos(TAU * cyc);
        PS.al = -0.5 + 0.12 * Math.sin(W * 2 + i);
        PS.ll = -0.12; PS.lr = 0.18; PS.lean = 0.3; PS.cut = true;
        setRoot(x, -12, z, Math.PI, aQ);
        drawWorker(i);
      }

      // Tiradores: detrás de la cuerda, delante del trineo
      for (let j = 0; j < NPULL; j++) {
        const k = Math.floor(j / 20), q = j % 20, colI = Math.floor(q / 2), side = (q % 2) ? 1 : -1;
        const sk = SL[k], sg = sk.sg;
        const fp = clamp(sk.f + sg * (1.6 + 1.1 * colI) / LEN, 0, sk.mf);
        const P = path.getPointAt(fp), T = path.getTangentAt(fp);
        const tx = T.x * sg, tz = T.z * sg;
        const hd = Math.atan2(tx, tz);
        const px = P.x + tz * side * 1.1, pz = P.z - tx * side * 1.1;
        const fx = Math.sin(hd), fz = Math.cos(hd);
        handP[j * 3] = px + fx * 0.59; handP[j * 3 + 1] = P.y + 1.2; handP[j * 3 + 2] = pz + fz * 0.59;
        const ph = W * 4.0 + j;
        PS.al = -1.1 + 0.12 * Math.sin(ph); PS.ar = -1.1 + 0.12 * Math.cos(ph);
        PS.ll = 0.3 * Math.sin(ph); PS.lr = -0.3 * Math.sin(ph);
        PS.lean = 0.3; PS.cut = false;
        setRoot(px, P.y, pz, hd, aW);
        drawWorker(120 + j);
      }

      // Aguadores: echan agua delante del trineo (arena mojada)
      for (let k = 0; k < NPOUR; k++) {
        const sk = SL[k], sg = sk.sg;
        const fp = clamp(sk.f + sg * 9 / LEN, 0, sk.mf);
        const P = path.getPointAt(fp), T = path.getTangentAt(fp);
        const tx = T.x * sg, tz = T.z * sg, hd = Math.atan2(tx, tz);
        const fx = Math.sin(hd), fz = Math.cos(hd);
        pourHand[k * 3] = P.x + fx * 0.51; pourHand[k * 3 + 1] = P.y + 1.09; pourHand[k * 3 + 2] = P.z + fz * 0.51;
        pourGround[k * 3] = P.x + fx * 1.4; pourGround[k * 3 + 1] = P.y + 0.02; pourGround[k * 3 + 2] = P.z + fz * 1.4;
        PS.ar = -0.9 + 0.1 * Math.sin(W * 3 + k); PS.al = 0.25;
        PS.ll = 0.05; PS.lr = -0.05; PS.lean = 0.15; PS.cut = false;
        setRoot(P.x, P.y, P.z, hd, aW);
        drawWorker(240 + k);
      }

      // Capataces: de pie junto al camino, señalando
      for (let f = 0; f < 10; f++) {
        const F = FORE[f];
        const hd = -Math.sign(F.x) * Math.PI / 2;
        PS.ar = -2.0 + 0.3 * Math.sin(W * 1.2 + f); PS.al = 0.15;
        PS.ll = 0; PS.lr = 0; PS.lean = 0.03; PS.cut = false;
        setRoot(F.x, 0, F.z, hd, aW);
        drawWorker(246 + f);
      }

      // Caminantes: ida y vuelta (ping-pong) por el camino campamento-cantera
      for (let w = 0; w < 120; w++) {
        const fr = frac(t / (360 + 120 * hash(w + 700)) + hash(w + 500));
        const q = 1 - Math.abs(2 * fr - 1);
        const sg = fr < 0.5 ? 1 : -1;
        const P = walkPath.getPointAt(q), T = walkPath.getTangentAt(q);
        const tx = T.x * sg, tz = T.z * sg, hd = Math.atan2(tx, tz);
        const off = (hash(w + 900) - 0.5) * 3.0;
        const sw = Math.sin(W * 5 + hash(w) * TAU);
        PS.ll = 0.42 * sw; PS.lr = -0.42 * sw; PS.al = -0.35 * sw; PS.ar = 0.35 * sw;
        PS.lean = 0.03; PS.cut = false;
        setRoot(P.x + tz * off, P.y, P.z - tx * off, hd, aW);
        drawWorker(256 + w);
      }

      // Escaparate (t≈58-90): trineo con bloque, 20 tiradores, aguador y capataz
      // cruzan el encuadre de la cámara (70,16,165) por z≈140-152 hacia la base de la rampa (x 62 -> 8)
      const aS = sstep((t - 58) / 4) * (1 - sstep((t - 88) / 4));
      const pS = sstep((t - 62) / 24);
      const sx = 62 + (8 - 62) * pS, sz = 152 + (142 - 152) * pS;
      const dXs = -54, dZs = -10, dLs = Math.hypot(dXs, dZs);
      const fwX = dXs / dLs, fwZ = dZs / dLs;     // dirección de viaje
      const latX = fwZ, latZ = -fwX;              // lateral
      const hdS = Math.atan2(fwX, fwZ);
      _p3.set(sx, 0.5, sz);
      _q4.setFromEuler(_e3.set(0, hdS, 0, 'YXZ'));
      _s3.set(aS, aS, aS);
      _sm.compose(_p3, _q4, _s3);
      showSledIM.setMatrixAt(0, _sm);
      for (let b = 0; b < 2; b++) {
        _t4.makeTranslation(0, 0.78, b === 0 ? -1.0 : 1.0);
        _lm.multiplyMatrices(_sm, _t4);
        showLoadIM.setMatrixAt(b, _lm);
      }
      showSledIM.instanceMatrix.needsUpdate = true;
      showLoadIM.instanceMatrix.needsUpdate = true;
      const frontX = sx + fwX * 2.2, frontZ = sz + fwZ * 2.2;
      for (let q = 0; q < 20; q++) {
        const colI = Math.floor(q / 2), side = (q % 2) ? 1 : -1;
        const d = 3.0 + 1.5 * colI;
        const px = sx + fwX * d + latX * side * 1.2, pz = sz + fwZ * d + latZ * side * 1.2;
        const j = NPULL + q;
        handP[j * 3] = px + fwX * 0.59; handP[j * 3 + 1] = 1.2; handP[j * 3 + 2] = pz + fwZ * 0.59;
        const ph = W * 4.0 + q;
        PS.al = -1.1 + 0.12 * Math.sin(ph); PS.ar = -1.1 + 0.12 * Math.cos(ph);
        PS.ll = 0.3 * Math.sin(ph); PS.lr = -0.3 * Math.sin(ph);
        PS.lean = 0.3; PS.cut = false;
        setRoot(px, 0, pz, hdS, aS);
        drawWorker(376 + q);
      }
      // aguador delante del equipo
      {
        const px = sx + fwX * 18, pz = sz + fwZ * 18;
        pourHand[NPOUR * 3] = px + fwX * 0.51; pourHand[NPOUR * 3 + 1] = 1.09; pourHand[NPOUR * 3 + 2] = pz + fwZ * 0.51;
        pourGround[NPOUR * 3] = px + fwX * 1.4; pourGround[NPOUR * 3 + 1] = 0.02; pourGround[NPOUR * 3 + 2] = pz + fwZ * 1.4;
        PS.ar = -0.9 + 0.1 * Math.sin(W * 3); PS.al = 0.25;
        PS.ll = 0.05; PS.lr = -0.05; PS.lean = 0.15; PS.cut = false;
        setRoot(px, 0, pz, hdS, aS);
        drawWorker(396);
      }
      // capataz al costado del trineo, mirando al equipo
      {
        const px = sx - latX * 6 - fwX * 2, pz = sz - latZ * 6 - fwZ * 2;
        PS.ar = -2.0 + 0.3 * Math.sin(W * 1.2); PS.al = 0.15;
        PS.ll = 0; PS.lr = 0; PS.lean = 0.03; PS.cut = false;
        setRoot(px, 0, pz, Math.atan2(latX, latZ), aS);
        drawWorker(397);
      }
      // cuerdas tensas: rectas desde el frente del trineo a cada tirador
      for (let q = 0; q < 20; q++) {
        const j = NPULL + q, o = j * 6;
        ropePos[o] = frontX; ropePos[o + 1] = 0.7; ropePos[o + 2] = frontZ;
        if (aS > 0.01) { ropePos[o + 3] = handP[j * 3]; ropePos[o + 4] = handP[j * 3 + 1]; ropePos[o + 5] = handP[j * 3 + 2]; }
        else { ropePos[o + 3] = frontX; ropePos[o + 4] = 0.7; ropePos[o + 5] = frontZ; }
      }

      WIMS.forEach(function (im) { im.instanceMatrix.needsUpdate = true; });

      // Cuerdas: del frente de cada trineo a las manos de cada tirador
      for (let k = 0; k < NS; k++) {
        const sk = SL[k];
        const fx = sk.x + sk.tx * 2.2, fy = sk.y + 0.7, fz = sk.z + sk.tz * 2.2;
        for (let q = 0; q < 20; q++) {
          const j = k * 20 + q;
          const o = j * 6;
          ropePos[o] = fx; ropePos[o + 1] = fy; ropePos[o + 2] = fz;
          ropePos[o + 3] = handP[j * 3]; ropePos[o + 4] = handP[j * 3 + 1]; ropePos[o + 5] = handP[j * 3 + 2];
        }
      }
      ropeGeo.attributes.position.needsUpdate = true;
      for (let k = 0; k < NPOUR + 1; k++) {
        const o = k * 6;
        waterPos[o] = pourHand[k * 3]; waterPos[o + 1] = pourHand[k * 3 + 1]; waterPos[o + 2] = pourHand[k * 3 + 2];
        waterPos[o + 3] = pourGround[k * 3]; waterPos[o + 4] = pourGround[k * 3 + 1]; waterPos[o + 5] = pourGround[k * 3 + 2];
      }
      waterGeo.attributes.position.needsUpdate = true;
    }

    function updateDust(t) {
      for (let i = 0; i < ND; i++) {
        const sk = SL[i % NS];
        const age = frac(t * 0.3 + dA[i]);
        const back = -(1 + dB[i] * 2.5);
        dustPos[i * 3] = sk.x + sk.tx * back + (dC[i] - 0.5) * age * 5;
        dustPos[i * 3 + 1] = sk.y + 0.4 + age * 3.2;
        dustPos[i * 3 + 2] = sk.z + sk.tz * back + (dD[i] - 0.5) * age * 5;
      }
      dustGeo.attributes.position.needsUpdate = true;
    }

    // =====================================================================
    // 5. BARCAZAS (Nilo x~950 y canal x~600..820, z~150) y muelle
    // =====================================================================
    const boatsG = new THREE.Group();
    root.add(boatsG);
    const hullMB = MB();
    const cHull = new THREE.Color(0x6e4a2a), cHull2 = new THREE.Color(0x5a3b21), cMast = new THREE.Color(0x8a6440);
    const hullTop = [[0, 7.5], [2.3, 1.5], [2.4, -5.5], [-2.4, -5.5], [-2.3, 1.5]];
    const hullIn = [0, 0.7, 0];
    const topV = hullTop.map(function (p) { return [p[0], 1.2, p[1]]; });
    const botV = hullTop.map(function (p) { return [p[0] * 0.55, 0.25, p[1] * 0.55]; });
    for (let i = 1; i < 4; i++) {
      mbTri(hullMB, topV[0], topV[i], topV[i + 1], cHull, hullIn);
      mbTri(hullMB, botV[0], botV[i], botV[i + 1], cHull2, hullIn);
    }
    for (let i = 0; i < 5; i++) {
      const j = (i + 1) % 5;
      mbTri(hullMB, topV[i], topV[j], botV[j], cHull, hullIn);
      mbTri(hullMB, topV[i], botV[j], botV[i], cHull, hullIn);
    }
    mbBox(hullMB, 0, 6.2, 0, 0.14, 10.6, 0.14, cMast);
    const NB = 5;
    const hullIM = new THREE.InstancedMesh(mbGeo(hullMB), MAT.woodVC, NB);
    // Vela trapezoidal con leve abombado (malla 5x5, bulto hacia +X)
    const sailGeo = new THREE.BufferGeometry();
    const sailP = [], sailI = [];
    const SG = 4;
    for (let vi = 0; vi <= SG; vi++) {
      for (let ui = 0; ui <= SG; ui++) {
        const v = vi / SG, u = ui / SG;
        // interpolación bilineal de las 4 esquinas: abajo-izq, abajo-der, arriba-der, arriba-izq
        const zb = -2.8 + (2.2 + 2.8) * u, zt = -0.4 + (0.8 + 0.4) * u;
        const z = zb + (zt - zb) * v;
        const y = 1.6 + (10.8 - 1.6) * v;
        const x = 0.9 * Math.sin(Math.PI * u) * Math.sin(Math.PI * v);
        sailP.push(x, y, z);
      }
    }
    for (let vi = 0; vi < SG; vi++) for (let ui = 0; ui < SG; ui++) {
      const a = vi * (SG + 1) + ui, b = a + 1, c = a + (SG + 1), d = c + 1;
      sailI.push(a, b, d, a, d, c);
    }
    sailGeo.setAttribute('position', new THREE.Float32BufferAttribute(sailP, 3));
    sailGeo.setIndex(sailI);
    sailGeo.computeVertexNormals();
    const sailIM = new THREE.InstancedMesh(sailGeo, MAT.sail, NB);
    // Escala de eslora: el casco base mide ~15 m, aquí ~36 m
    const BS = 2.4;
    // Bloques de granito rosado (en coordenadas locales del casco, sin escalar)
    const CARGO = [[-0.45, 1.4, -2.8], [0.45, 1.4, -2.8], [-0.45, 1.4, -0.6], [0.45, 1.4, -0.6], [-0.45, 1.4, 1.6], [0.45, 1.4, 1.6]];
    const cargoIM = new THREE.InstancedMesh(new THREE.BoxGeometry(0.6, 0.4, 0.85), MAT.granite, NB * 6);
    // Remeros (torso + cabeza) y remos a ambos costados
    const rowTorsoIM = new THREE.InstancedMesh(new THREE.BoxGeometry(0.4, 0.5, 0.25), MAT.skirt, NB * 6);
    const rowHeadIM = new THREE.InstancedMesh(new THREE.SphereGeometry(0.16, 6, 4), MAT.skin, NB * 6);
    const oarIM = new THREE.InstancedMesh(new THREE.BoxGeometry(4.5, 0.1, 0.1), MAT.wood, NB * 6);
    // Estela blanca a popa
    const wakeIM = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), MAT.wake, NB);
    [cargoIM, rowTorsoIM, rowHeadIM, oarIM, wakeIM].forEach(function (im) { im.frustumCulled = false; boatsG.add(im); });
    hullIM.frustumCulled = false; sailIM.frustumCulled = false;
    boatsG.add(hullIM, sailIM);

    // Nilo: 3 barcazas (una en el encuadre t~56: z~200, ~120, ~280). Canal: 1 barcaza.
    const BOATS = [
      { kind: 'nile', x: 936, dir: 1, ph: 0.065 },
      { kind: 'nile', x: 956, dir: -1, ph: 0.87 },
      { kind: 'nile', x: 972, dir: 1, ph: 0.176 },
      { kind: 'canal', z: 150, dir: -1, ph: 0.20 },
      { kind: 'nile', x: 944, dir: -1, ph: 0.52 }
    ];
    const _bE = new THREE.Euler();
    function updateBoats(s) {
      const t = s.t, W = s.wall;
      for (let b = 0; b < NB; b++) {
        const B = BOATS[b];
        let x, z, hd, fr;
        if (B.kind === 'nile') {
          fr = frac(t * 0.0105 + B.ph);
          if (B.dir > 0) { z = -270 + 720 * fr; hd = 0; } else { z = 450 - 720 * fr; hd = Math.PI; }
          x = B.x;
        } else {
          fr = frac(t * 0.016 + B.ph);
          if (B.dir < 0) { x = 800 - 190 * fr; hd = -Math.PI / 2; } else { x = 610 + 190 * fr; hd = Math.PI / 2; }
          z = B.z;
        }
        const a = sstep(Math.min(fr, 1 - fr) * 14);
        // quilla (local y=0.25·BS≈0.6) queda ~0.15 m bajo la superficie del agua (y=0)
        const y = -0.75 + 0.03 * Math.sin(W * 1.3 + B.ph * TAU);
        const pitch = 0.008 * Math.sin(W * 0.9 + B.ph * 7), roll = 0.015 * Math.sin(W * 1.1 + B.ph * 5);
        _p3.set(x, y, z);
        _q4.setFromEuler(_bE.set(pitch, hd, roll, 'YXZ'));
        _s3.set(a * BS, a * BS, a * BS);
        _rootM.compose(_p3, _q4, _s3);
        hullIM.setMatrixAt(b, _rootM);
        sailIM.setMatrixAt(b, _rootM);
        for (let c = 0; c < 6; c++) {
          _t4.makeTranslation(CARGO[c][0], CARGO[c][1], CARGO[c][2]);
          _lm.multiplyMatrices(_rootM, _t4);
          cargoIM.setMatrixAt(b * 6 + c, _lm);
        }
        // Remeros: 3 por costado, moviéndose con un vaivén de remada
        for (let r = 0; r < 6; r++) {
          const side = r < 3 ? -1 : 1, zr = -3.6 + (r % 3) * 3.4;
          const stroke = 0.45 * Math.sin(W * 2.2 + b * 1.3 + r * 0.7);
          _t4.makeTranslation(side * 1.5, 1.45, zr);
          _lm.multiplyMatrices(_rootM, _t4);
          rowTorsoIM.setMatrixAt(b * 6 + r, _lm);
          _t4.makeTranslation(side * 1.5, 1.95, zr);
          _lm.multiplyMatrices(_rootM, _t4);
          rowHeadIM.setMatrixAt(b * 6 + r, _lm);
          // remo: sale del costado y oscila alrededor del eje vertical
          _bE.set(0, stroke, 0, 'XYZ');
          _t4.makeRotationFromEuler(_bE);
          _sc4.makeTranslation(side * 3.6, 1.45, zr);
          _t4.premultiply(_sc4);
          _lm.multiplyMatrices(_rootM, _t4);
          oarIM.setMatrixAt(b * 6 + r, _lm);
        }
        // Estela blanca detrás de la popa (en coordenadas locales)
        _t4.makeTranslation(0, 0.05, -13);
        _sc4.makeScale(2.2, 1, 14);
        _t4.multiply(_sc4);
        _lm.multiplyMatrices(_rootM, _t4);
        wakeIM.setMatrixAt(b, _lm);
      }
      hullIM.instanceMatrix.needsUpdate = true;
      sailIM.instanceMatrix.needsUpdate = true;
      cargoIM.instanceMatrix.needsUpdate = true;
      rowTorsoIM.instanceMatrix.needsUpdate = true;
      rowHeadIM.instanceMatrix.needsUpdate = true;
      oarIM.instanceMatrix.needsUpdate = true;
      wakeIM.instanceMatrix.needsUpdate = true;
    }

    // Muelle de madera y canal
    const harborG = new THREE.Group();
    root.add(harborG);
    const pierMB = MB();
    const cPier = new THREE.Color(0x8a6440), cPost = new THREE.Color(0x5a3b21);
    mbBox(pierMB, 605, 1.1, 150, 40, 0.3, 4.4, cPier);
    for (let i = 0; i < 5; i++) mbBox(pierMB, 591 + i * 7 , 1.4, 146.4 + (i % 2) * 7.2, 0.4, 0.3, 0.4, cPier);
    [[590, 146], [600, 146], [610, 146], [620, 146], [590, 154], [600, 154], [610, 154], [620, 154]].forEach(function (p) {
      mbBox(pierMB, p[0], -1.2, p[1], 0.5, 4.8, 0.5, cPost);
    });
    const pierMesh = new THREE.Mesh(mbGeo(pierMB), MAT.woodVC);
    pierMesh.castShadow = true; pierMesh.frustumCulled = false;
    const canal = new THREE.Mesh(new THREE.BoxGeometry(220, 0.2, 20), MAT.water2);
    canal.position.set(710, -0.05, 150);
    canal.receiveShadow = true;
    harborG.add(pierMesh, canal);

    // =====================================================================
    // 6. CAMPAMENTO (x~300, z~250): casitas de adobe, hornos, humo
    // =====================================================================
    const campG = new THREE.Group();
    root.add(campG);
    const houseIM = new THREE.InstancedMesh(new THREE.BoxGeometry(6, 3.2, 6), MAT.adobe, 9);
    const roofIM = new THREE.InstancedMesh(new THREE.BoxGeometry(6.6, 0.4, 6.6), MAT.roof, 9);
    const ovenIM = new THREE.InstancedMesh(new THREE.CylinderGeometry(1.2, 1.3, 2.0, 8), MAT.adobe, 4);
    const domeIM = new THREE.InstancedMesh(new THREE.SphereGeometry(1.2, 8, 4, 0, TAU, 0, Math.PI / 2), MAT.adobe, 4);
    houseIM.frustumCulled = false; roofIM.frustumCulled = false; ovenIM.frustumCulled = false; domeIM.frustumCulled = false;
    houseIM.castShadow = true; houseIM.receiveShadow = true;
    campG.add(houseIM, roofIM, ovenIM, domeIM);
    const houseCols = [0xc69a6a, 0xd2a878, 0xb88a5e];
    let hI = 0;
    for (let ix = 0; ix < 3; ix++) for (let iz = 0; iz < 3; iz++) {
      const x = 300 + (ix - 1) * 9, z = 250 + (iz - 1) * 9;
      setInst(houseIM, hI, x, 1.6, z, 0);
      houseIM.setColorAt(hI, _c3.setHex(houseCols[hI % 3]));
      setInst(roofIM, hI, x, 3.4, z, 0);
      hI++;
    }
    const OVENS = [[282, 280], [293, 285], [304, 280], [315, 285]];
    OVENS.forEach(function (o, i) {
      setInst(ovenIM, i, o[0], 1.0, o[1], 0);
      setInst(domeIM, i, o[0], 2.0, o[1], 0);
    });
    houseIM.instanceMatrix.needsUpdate = true;
    houseIM.instanceColor.needsUpdate = true;
    roofIM.instanceMatrix.needsUpdate = true;
    ovenIM.instanceMatrix.needsUpdate = true;
    domeIM.instanceMatrix.needsUpdate = true;

    // Humo de los hornos
    const NSM = 60, smokePos = new Float32Array(NSM * 3), hA = [], hB = [], hC = [];
    for (let i = 0; i < NSM; i++) { hA.push(hash(i + 1000)); hB.push(hash(i + 1100)); hC.push(hash(i + 1200)); }
    const smokeGeo = new THREE.BufferGeometry();
    smokeGeo.setAttribute('position', new THREE.BufferAttribute(smokePos, 3));
    const smoke = new THREE.Points(smokeGeo, MAT.smoke);
    smoke.frustumCulled = false;
    campG.add(smoke);
    function updateSmoke(W) {
      for (let i = 0; i < NSM; i++) {
        const ov = OVENS[i % 4];
        const age = frac(W * 0.09 + hA[i]);
        smokePos[i * 3] = ov[0] + (hB[i] - 0.5) * 1.2 + age * 1.6;
        smokePos[i * 3 + 1] = 2.9 + age * 7;
        smokePos[i * 3 + 2] = ov[1] + (hC[i] - 0.5) * 1.2 + age * 0.8;
      }
      smokeGeo.attributes.position.needsUpdate = true;
    }

    // =====================================================================
    // Bucle por frame
    // =====================================================================
    function update(s) {
      const t = s.t, W = s.wall;
      const topY = clamp(s.build, 0, 1) * H;
      const qOn = s.quarry > 0.002, wOn = s.workers > 0.002, bOn = s.boats > 0.002;

      quarryG.visible = qOn;
      rampG.visible = s.ramp > 0.002 && topY > 0.05;
      clipPlane.constant = topY + 0.02;
      sledgeG.visible = wOn;
      campG.visible = wOn;
      workersG.visible = wOn || qOn;
      boatsG.visible = bOn;
      harborG.visible = bOn;

      if (rampG.visible) updateRampProps(topY, W);
      if (wOn || qOn) {
        updateSledges(t, topY);
        drawSledges();
        updateWorkers(s);
      }
      if (wOn) {
        updateDust(t);
        updateSmoke(W);
      }
      if (qOn) updateQuarryDust(W);
      if (bOn) updateBoats(s);
    }

    return { update: update, group: root };
  };
})();
