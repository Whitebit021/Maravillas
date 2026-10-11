// Obra y asedio: Helépolis abandonada, flota de Demetrio, montón de armas, hornos de
// fundición, barcos del puerto, obreros instanciados, terraplén en espiral, vertido de bronce,
// grúas y caravana de camellos. Todo procedural. Función pura del estado s.
(function () {
  'use strict';
  const G = window.GIZA;

  G.createConstruction = function (ctx) {
    const THREE = ctx.THREE, scene = ctx.scene;
    const root = new THREE.Group();
    scene.add(root);

    const SITE = G.SITE, COL = G.COL;
    const TAU = Math.PI * 2;

    // ---------- utilidades ----------
    function hash(n) { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
    function clamp(x, a, b) { return x < a ? a : (x > b ? b : x); }
    function frac(x) { return x - Math.floor(x); }
    function sstep(x) { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); }

    // ---------- materiales ----------
    const MAT = {
      iron:    new THREE.MeshStandardMaterial({ color: 0x3a3a3c, roughness: 0.6, metalness: 0.5 }),
      ironPl:  new THREE.MeshStandardMaterial({ color: 0x55575a, roughness: 0.55, metalness: 0.45, flatShading: true }),
      wood:    new THREE.MeshStandardMaterial({ color: 0x7a5230, roughness: 0.9 }),
      woodVC:  new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true, side: THREE.DoubleSide }),
      vc:      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, metalness: 0.2, flatShading: true }),
      bronze:  new THREE.MeshStandardMaterial({ color: 0xb07a3c, roughness: 0.35, metalness: 0.7 }),
      stone:   new THREE.MeshStandardMaterial({ color: 0xd8cfbd, roughness: 0.9, flatShading: true }),
      brick:   new THREE.MeshStandardMaterial({ color: 0x9a4a2e, roughness: 0.95, flatShading: true }),
      sail:    new THREE.MeshStandardMaterial({ color: 0xf2ecdc, roughness: 0.95, side: THREE.DoubleSide }),
      hull:    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true }),
      skin:    new THREE.MeshStandardMaterial({ color: 0x8c5a3a, roughness: 0.8, flatShading: true }),
      cloth:   new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, flatShading: true }),
      wake:    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4, depthWrite: false }),
      water:   new THREE.LineBasicMaterial({ color: 0x8fe0ff, transparent: true, opacity: 0.7 }),
      rope:    new THREE.LineBasicMaterial({ color: 0xd9c58a }),
      smoke:   new THREE.PointsMaterial({ color: 0xcfc8ba, size: 6.0, transparent: true, opacity: 0.45, depthWrite: false }),
      dust:    new THREE.PointsMaterial({ color: 0xd8c08a, size: 2.2, transparent: true, opacity: 0.4, depthWrite: false }),
      spark:   new THREE.PointsMaterial({ color: 0xffc070, size: 1.6, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }),
      molten:  new THREE.MeshBasicMaterial({ color: 0xff8a2a }),
      bronzeShine: new THREE.MeshStandardMaterial({ color: 0xe0a255, roughness: 0.25, metalness: 0.8, emissive: 0x3a2008, emissiveIntensity: 1 }),
      glow:    new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }),
      clay:    new THREE.MeshStandardMaterial({ color: 0xb9835a, roughness: 1, flatShading: true }),
      rubble:  new THREE.MeshStandardMaterial({ color: 0x8a7a64, roughness: 1, flatShading: true }),
      mound:   null, // se crea abajo con textura procedural
      camel:   new THREE.MeshStandardMaterial({ color: 0xc6a06a, roughness: 0.9, flatShading: true }),
      camelD:  new THREE.MeshStandardMaterial({ color: 0x8a6440, roughness: 0.9, flatShading: true })
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
    // caja con rotación (ry, rx) y centro (x,y,z)
    function mbBox(mb, x, y, z, sx, sy, sz, c, ry, rx, rz) {
      const g = new THREE.BoxGeometry(sx, sy, sz);
      const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx || 0, ry || 0, rz || 0, 'YXZ'));
      m.setPosition(x, y, z);
      g.applyMatrix4(m);
      mbAppend(mb, g, c);
    }
    // geometría genérica (cualquier BufferGeometry) con matriz
    function mbGeom(mb, geo, m, c) {
      const g = geo.clone().applyMatrix4(m);
      if (!g.index) { const n = g.attributes.position.count; const idx = []; for (let i = 0; i < n; i++) idx.push(i); g.setIndex(idx); }
      if (!g.attributes.normal) g.computeVertexNormals();
      mbAppend(mb, g, c);
      g.dispose();
    }
    function mbGeo(mb) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(mb.p, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(mb.n, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(mb.c, 3));
      g.setIndex(mb.i);
      return g;
    }
    const _m4 = new THREE.Matrix4(), _q4 = new THREE.Quaternion(), _p3 = new THREE.Vector3();
    const _s3 = new THREE.Vector3(1, 1, 1), _e3 = new THREE.Euler(), _c3 = new THREE.Color();
    const _t4 = new THREE.Matrix4(), _lm = new THREE.Matrix4(), _sc4 = new THREE.Matrix4();
    function setInst(im, idx, x, y, z, ry, sc) {
      _p3.set(x, y, z);
      _q4.setFromEuler(_e3.set(0, ry || 0, 0, 'XYZ'));
      const k = sc === undefined ? 1 : sc;
      _s3.set(k, k, k);
      _m4.compose(_p3, _q4, _s3);
      im.setMatrixAt(idx, _m4);
    }
    function mkIM(geo, mat, n, shadow) {
      const im = new THREE.InstancedMesh(geo, mat, n);
      im.frustumCulled = false;
      if (shadow) { im.castShadow = true; im.receiveShadow = true; }
      return im;
    }
    // canvas de textura procedural sRGB
    function canvasTex(w, h, paint) {
      const cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      paint(cv.getContext('2d'), w, h);
      const tex = new THREE.CanvasTexture(cv);
      tex.encoding = THREE.sRGBEncoding;
      return tex;
    }

    // =====================================================================
    // 1. HELÉPOLIS (torre de asedio abandonada) en SITE.helepolis
    //    40 m de alto, base 22 m, 9 pisos, troneras, chapas de hierro, 8 ruedas.
    //    Geometría estática fusionada: se construye en coordenadas locales (base en y=0)
    //    y se coloca en el mundo con un solo grupo.
    // =====================================================================
    const HP = SITE.helepolis;
    const heleG = new THREE.Group();
    heleG.position.set(HP.x, 0, HP.z);
    heleG.rotation.y = -0.35;   // abandonada en diagonal, mirando a la muralla
    root.add(heleG);

    const heleMB = MB();
    const cWoodH = new THREE.Color(0x6e4a2a), cWoodD = new THREE.Color(0x4f3420), cIron = new THREE.Color(0x4a4c4f);
    const cRust = new THREE.Color(0x7a4a2a), cTrim = new THREE.Color(0x2e2f31);
    const HB = HP.base, HH = HP.height, FL = 9, FH = HH / FL;
    // torre: 4 montantes inclinados que se estrechan hacia arriba (base 22 -> 14 en cima)
    const topHalf = 7;
    for (let c = 0; c < 4; c++) {
      const sx = c % 2 ? 1 : -1, sz = c < 2 ? 1 : -1;
      for (let i = 0; i < 9; i++) {
        const y = (i + 0.5) * FH;
        const h = (HB / 2) - (HB / 2 - topHalf) * (y / HH);
        mbBox(heleMB, sx * h, y, sz * h, 0.9, FH + 0.05, 0.9, cWoodH);
      }
    }
    // pisos (vigas horizontales en cada nivel) y tablones de cada cara
    for (let i = 0; i <= FL; i++) {
      const y = i * FH;
      const h = (HB / 2) - (HB / 2 - topHalf) * (y / HH);
      mbBox(heleMB, 0, y, h, 2 * h + 0.9, 0.5, 0.5, cWoodD);
      mbBox(heleMB, 0, y, -h, 2 * h + 0.9, 0.5, 0.5, cWoodD);
      mbBox(heleMB, h, y, 0, 0.5, 0.5, 2 * h + 0.9, cWoodD);
      mbBox(heleMB, -h, y, 0, 0.5, 0.5, 2 * h + 0.9, cWoodD);
    }
    // diagonales de arriostramiento en cada cara lateral
    for (let i = 0; i < FL; i++) {
      const y0 = i * FH, y1 = (i + 1) * FH, ym = (y0 + y1) / 2;
      const h = (HB / 2) - (HB / 2 - topHalf) * (ym / HH);
      for (const side of [0, 1]) {
        const ang = Math.atan2(FH, 2 * h) * (side ? -1 : 1);
        mbBox(heleMB, 0, ym, h, 0.25, Math.hypot(FH, 2 * h), 0.25, cWoodD, 0, 0, Math.PI / 2 - ang);
        mbBox(heleMB, h, ym, 0, 0.25, Math.hypot(FH, 2 * h), 0.25, cWoodD, Math.PI / 2, 0, Math.PI / 2 - ang);
      }
    }
    // chapas de hierro: placas en la cara frontal y en los pisos bajos (las 4 caras)
    for (let i = 0; i < FL; i++) {
      if (i > 5) continue;
      const y = (i + 0.5) * FH, h = (HB / 2) - (HB / 2 - topHalf) * (y / HH) + 0.05;
      for (let f = 0; f < 4; f++) {
        const ry = f * Math.PI / 2;
        // placas de hierro por cara (franjas) con remaches
        mbBox(heleMB, Math.sin(ry) * h, y, Math.cos(ry) * h, 2 * h - 1, FH - 0.4, 0.14, f === 0 ? cRust : cIron, ry);
      }
    }
    // troneras: huecos oscuros en la cara frontal (+Z local) de cada piso
    for (let i = 0; i < FL; i++) {
      const y = (i + 0.5) * FH, h = (HB / 2) - (HB / 2 - topHalf) * (y / HH);
      for (let k = -2; k <= 2; k++) {
        mbBox(heleMB, k * (h * 0.35), y + 0.1, h + 0.12, 0.45, 1.1, 0.12, cTrim);
      }
    }
    // puente levadizo (rampa) de la cara que mira a la muralla
    mbBox(heleMB, 0, FH * 4.4, HB / 2 + 2.8, 3.6, 0.5, 6.8, cWoodD, 0, -0.52);
    // cubierta superior y almenas (plataforma de tiro)
    mbBox(heleMB, 0, HH + 0.4, 0, topHalf * 2 + 1.5, 0.8, topHalf * 2 + 1.5, cWoodD);
    for (let k = 0; k < 8; k++) {
      const a = k / 8 * TAU, r = topHalf + 0.5;
      mbBox(heleMB, Math.cos(a) * r, HH + 1.3, Math.sin(a) * r, 1.0, 1.2, 1.0, cIron);
    }
    // escalera interior de la torre (rampas de tablón por la cara trasera)
    mbBox(heleMB, 0, HH / 2, -HB / 2 + 1.5, 1.8, HH * 0.95, 0.2, cWoodD, 0, 0.08);
    // travesaño de carga y cabrestante de cuerda
    mbBox(heleMB, 0, 1.2, 0, HB + 1.5, 0.8, 3.0, cWoodD);

    // 8 ruedas enormes (diámetro 6 m, ancho 1.3 m), 4 por costado; la mitad hundidas en el terreno
    const WHEEL_D = 6.0, WHEEL_W = 1.3;
    const wheelMB = MB();
    const wheelGeo = new THREE.TorusGeometry(WHEEL_D / 2 - 0.25, 0.25, 6, 14);
    const hubGeo = new THREE.CylinderGeometry(0.5, 0.5, WHEEL_W + 0.4, 8);
    const spokeGeo = new THREE.BoxGeometry(WHEEL_D - 1.0, 0.18, 0.18);
    const cWheel = new THREE.Color(0x5a3c22);
    for (let w = 0; w < 8; w++) {
      const sx = (w % 4 < 2) ? -1 : 1;
      const zz = (w % 2 ? 1 : -1) * (HB / 2 - 1.5) + (w >= 4 ? 0 : 0);
      const xx = sx * (HB / 2 + 0.3);
      const zPos = (w < 4) ? (w % 2 ? 1 : -1) * (HB / 2 - 2.5) : (w % 2 ? 1 : -1) * (HB / 2 - 2.5);
      for (let k = 0; k < 2; k++) {
        const ax = xx + (sx > 0 ? 0 : 0);
        const ww = w * 2 + k;
        const pz = zPos + (k ? 0.5 : -0.5) * 0;
        const m = new THREE.Matrix4().makeRotationY(Math.PI / 2 * 0);
        // rueda: plano YZ, centro a altura WHEEL_D/2 - 0.8 (una parte hundida)
        const cy = WHEEL_D / 2 - 0.8;
        const pw = new THREE.Matrix4().makeRotationY(Math.PI / 2);
        pw.setPosition(xx + (k ? 0.45 : -0.45) * sx, cy, pz + 0 * ww);
        mbGeom(wheelMB, wheelGeo, pw, cWheel);
        mbGeom(wheelMB, hubGeo, new THREE.Matrix4().makeRotationX(Math.PI / 2).setPosition(xx + (k ? 0.45 : -0.45) * sx, cy, pz), cWoodH);
        for (let sp = 0; sp < 4; sp++) {
          const a = sp * Math.PI / 4;
          const sm = new THREE.Matrix4().makeRotationY(Math.PI / 2);
          sm.multiply(new THREE.Matrix4().makeRotationX(a));
          sm.setPosition(xx + (k ? 0.45 : -0.45) * sx, cy, pz);
          mbGeom(wheelMB, spokeGeo, sm, cWheel);
        }
      }
    }
    const heleMesh = new THREE.Mesh(mbGeo(heleMB), MAT.woodVC);
    heleMesh.castShadow = true; heleMesh.receiveShadow = true; heleMesh.frustumCulled = false;
    heleG.add(heleMesh);
    const wheelMesh = new THREE.Mesh(mbGeo(wheelMB), MAT.woodVC);
    wheelMesh.castShadow = true; wheelMesh.frustumCulled = false;
    heleG.add(wheelMesh);

    // ---------- flota de Demetrio (25 galeras con remos y velas, alejándose al NE) ----------
    const FLEET_N = 25;
    const FL_ = SITE.siegeFleet;
    const fleetG = new THREE.Group();
    root.add(fleetG);
    const galleyGeo = (function () {
      // casco de galera: 30 m, proa afilada, eslora local ±15, altura 1.2..3.2
      const mb = MB();
      const sec = [[0, 0], [5, 2.6], [12, 3.6], [15, 0.0], [-15, 0.0], [-12, 3.2], [-5, 3.0]];
      const hullTop = [[-15, 1.2, 0], [-10, 2.2, 3.0], [0, 2.2, 3.6], [10, 2.2, 3.0], [15, 1.2, 0], [10, 2.2, -3.0], [0, 2.2, -3.6], [-10, 2.2, -3.0]];
      const hullBot = hullTop.map(function (p) { return [p[0] * 0.8, 0.0, p[2] * 0.6]; });
      const cH = new THREE.Color(0x6e4a2a), cB = new THREE.Color(0x3c2716);
      // tapa superior en abanico
      for (let i = 1; i < hullTop.length - 1; i++) mbTriLocal(mb, hullTop[0], hullTop[i], hullTop[i + 1], cH);
      // cuerpo: franjas entre arriba y abajo
      for (let i = 0; i < hullTop.length; i++) {
        const j = (i + 1) % hullTop.length;
        mbTriLocal(mb, hullTop[i], hullTop[j], hullBot[j], cH);
        mbTriLocal(mb, hullTop[i], hullBot[j], hullBot[i], cB);
      }
      // espolón de bronce en proa
      mbBox(mb, 0, 1.2, 16.2, 0.5, 0.5, 2.6, new THREE.Color(0xb07a3c), 0);
      return mbGeo(mb);
    })();
    function mbTriLocal(mb, a, b, c, col) {
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
      const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const L = Math.hypot(nx, ny, nz) || 1; nx /= L; ny /= L; nz /= L;
      const cx = (a[0] + b[0] + c[0]) / 3, cy = (a[1] + b[1] + c[1]) / 3, cz = (a[2] + b[2] + c[2]) / 3;
      if (nx * cx + ny * cy + nz * cz < 0) { nx = -nx; ny = -ny; nz = -nz; }
      const base = mb.p.length / 3;
      [a, b, c].forEach(function (v) { mb.p.push(v[0], v[1], v[2]); mb.n.push(nx, ny, nz); mb.c.push(col.r, col.g, col.b); });
      mb.i.push(base, base + 1, base + 2);
    }
    const galleyIM = mkIM(galleyGeo, MAT.hull, FLEET_N, true);
    // velas: un plano trapezoidal abombado, una por galera, en el mástil (mirando +X local)
    const gSailGeo = (function () {
      const g = new THREE.PlaneGeometry(9, 8, 4, 4);
      g.translate(4.5, 0, 0);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) { const x = p.getX(i); p.setZ(i, 0.9 * Math.sin(Math.PI * (x / 9))); }
      g.computeVertexNormals();
      return g;
    })();
    const sailIM = mkIM(gSailGeo, MAT.sail, FLEET_N, true);
    const oarIM = mkIM(new THREE.BoxGeometry(4.0, 0.08, 0.08), MAT.wood, FLEET_N * 14, false);
    const mastIM = mkIM(new THREE.CylinderGeometry(0.12, 0.12, 13, 5), MAT.wood, FLEET_N, false);
    fleetG.add(galleyIM, sailIM, oarIM, mastIM);
    const wakeIM = mkIM(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), MAT.wake, FLEET_N, false);
    fleetG.add(wakeIM);
    // rumbo y fase de cada galera (repartidas en abanico, alejándose de la costa)
    const FLEET = [];
    for (let i = 0; i < FLEET_N; i++) {
      const a = hash(i + 40) * TAU;
      const r = FL_.radius * (0.25 + 0.75 * hash(i + 50));
      FLEET.push({ x: FL_.x + Math.cos(a) * r, z: FL_.z + Math.sin(a) * r, hd: -0.6 + hash(i + 60) * 0.4, sp: 0.5 + hash(i + 70) * 0.5, ph: hash(i + 80) });
    }
    const _gE = new THREE.Euler();
    function updateFleet(s) {
      const t = s.t, W = s.wall, a = s.siege;
      for (let i = 0; i < FLEET_N; i++) {
        const F = FLEET[i];
        // se aleja hacia el NE, en ciclo lento y suave
        const d = (t * 0.6 * F.sp + F.ph * 40) % 80;
        const x = F.x + Math.cos(F.hd) * d * 1.6 + Math.sin(W * 0.3 + i) * 2;
        const z = F.z + Math.sin(F.hd) * d * 1.6 - (-Math.sin(F.hd)) * 0;
        const y = -0.6 + 0.12 * Math.sin(W * 1.1 + i);
        _p3.set(x, y, z);
        _q4.setFromEuler(_gE.set(0.01 * Math.sin(W + i), F.hd, 0.02 * Math.sin(W * 0.8 + i), 'YXZ'));
        _s3.set(a, a, a);
        _m4.compose(_p3, _q4, _s3);
        galleyIM.setMatrixAt(i, _m4);
        // mástil y vela
        _p3.set(x, y + 13 * 0.5 * a, z);
        _s3.set(a, a, a);
        _m4.compose(_p3, _q4, _s3);
        mastIM.setMatrixAt(i, _m4);
        _p3.set(x, y + 8, z);
        _q4.setFromEuler(_gE.set(0, F.hd + Math.PI / 2, 0.0, 'YXZ'));
        _m4.compose(_p3, _q4, _s3);
        sailIM.setMatrixAt(i, _m4);
        // estela blanca a popa
        _p3.set(x - Math.cos(F.hd) * 16 * a, 0.05, z - Math.sin(F.hd) * 16 * a);
        _q4.setFromEuler(_gE.set(0, F.hd, 0, 'YXZ'));
        _s3.set(4 * a, 1, 26 * a);
        _m4.compose(_p3, _q4, _s3);
        wakeIM.setMatrixAt(i, _m4);
        // remos: 14 por galera (7 por costado), vaivén
        for (let r = 0; r < 14; r++) {
          const side = r < 7 ? -1 : 1, zr = -12 + (r % 7) * 3.8;
          const stroke = 0.5 * Math.sin(W * 1.6 + i * 0.7 + r * 0.4);
          _gE.set(0, stroke, 0, 'XYZ');
          _t4.makeRotationFromEuler(_gE);
          _sc4.makeTranslation(side * 2.2, 1.6, zr);
          _t4.premultiply(_sc4);
          _lm.makeRotationY(F.hd);
          _lm.setPosition(x, y, z);
          _lm.multiply(_t4);
          _lm.multiply(new THREE.Matrix4().makeScale(a, a, a));
          oarIM.setMatrixAt(i * 14 + r, _lm);
        }
      }
      galleyIM.instanceMatrix.needsUpdate = true;
      sailIM.instanceMatrix.needsUpdate = true;
      oarIM.instanceMatrix.needsUpdate = true;
      mastIM.instanceMatrix.needsUpdate = true;
      wakeIM.instanceMatrix.needsUpdate = true;
    }

    // =====================================================================
    // 2. MONTÓN DE ARMAS abandonadas en SITE.weapons (radio 22, ~15 m de alto)
    //    Catapultas rotas, lanzas, escudos, cascos y placas. Al bajar la pista
    //    (s.weapons 1 -> 0) el montón se hunde y se tiñe de naranja incandescente.
    // =====================================================================
    const WP = SITE.weapons;
    const weaponsG = new THREE.Group();
    weaponsG.position.set(WP.x, 0, WP.z);
    root.add(weaponsG);
    // catapulta rota (fusionada): marco, brazo partido, cuchara y ruedas
    const catMB = MB();
    const cCat = new THREE.Color(0x6b4a2c), cCatI = new THREE.Color(0x3c3d40);
    mbBox(catMB, 0, 0.5, 0, 3.6, 0.3, 1.0, cCat, 0.3);
    mbBox(catMB, -1.2, 0.9, 0.2, 0.2, 1.4, 0.2, cCat, 0.3, 0.5);
    mbBox(catMB, 1.2, 0.8, -0.2, 0.2, 1.2, 0.2, cCat, 0.3, -0.7);
    mbBox(catMB, 0.4, 1.4, 0.0, 2.6, 0.18, 0.18, cCat, 0.3, 0.9);
    mbBox(catMB, -0.6, 1.1, -0.9, 1.0, 1.0, 0.25, cCatI, 0.4, 0.2);   // cuchara
    mbBox(catMB, 0.0, 0.5, 0.3, 0.6, 0.6, 0.6, cCatI, 0.1);
    mbBox(catMB, 0.9, 0.3, 0.9, 1.4, 0.2, 0.25, cCat, 1.1, 0.2);
    const catIM = mkIM(mbGeo(catMB), MAT.vc, 6, true);
    // lanza: asta de madera + punta de hierro fusionadas
    const spMB = MB();
    mbGeom(spMB, new THREE.CylinderGeometry(0.05, 0.05, 2.6, 5), new THREE.Matrix4(), new THREE.Color(0x8a6440));
    mbGeom(spMB, new THREE.ConeGeometry(0.1, 0.45, 5), new THREE.Matrix4().makeTranslation(0, 1.5, 0), new THREE.Color(0xb8b8c0));
    const spearIM = mkIM(mbGeo(spMB), MAT.vc, 150, true);
    const shieldIM = mkIM(new THREE.CylinderGeometry(0.42, 0.42, 0.06, 14), MAT.ironPl, 70, true);
    const helmIM = mkIM(new THREE.SphereGeometry(0.3, 8, 5, 0, TAU, 0, Math.PI / 2), MAT.ironPl, 40, true);
    const plateIM = mkIM(new THREE.BoxGeometry(0.7, 0.04, 0.5), MAT.bronze, 70, true);
    const PILE_IMS = [catIM, spearIM, shieldIM, helmIM, plateIM];
    const PILE_N = [6, 150, 70, 40, 70];
    const PILE_SC = [2.4, 1.4, 1.8, 1.5, 1.5];
    weaponsG.add(catIM, spearIM, shieldIM, helmIM, plateIM);
    const PILE = [];   // {im, idx, x, y, z, rx, ry, rz, sc, c, seed}
    (function buildPile() {
      const cols = [0xc8c8cc, 0xffffff, 0xb07a3c, 0x9a9ea6, 0xb87a3c];
      let seed = 0;
      for (let k = 0; k < PILE_IMS.length; k++) {
        for (let i = 0; i < PILE_N[k]; i++) {
          seed += 1;
          const a = hash(seed * 3.1 + k) * TAU, u = Math.sqrt(hash(seed * 1.7 + k));
          const r = u * WP.radius * 0.9;
          // montón cónico: ~15 m en el centro
          const hgt = 15 * Math.pow(Math.max(0, 1 - r / WP.radius), 1.2) * (0.35 + 0.65 * hash(seed * 2.3 + k));
          PILE.push({
            im: PILE_IMS[k], idx: i,
            x: Math.cos(a) * r, y: 0.3 + hgt * 0.9 + hash(seed * 5.9) * 1.0, z: Math.sin(a) * r,
            rx: (hash(seed * 7.1) - 0.5) * 1.4, ry: hash(seed * 9.3) * TAU, rz: (hash(seed * 4.4) - 0.5) * 1.4,
            sc: PILE_SC[k] * (0.85 + 0.3 * hash(seed * 6.6)), c: new THREE.Color(cols[k]), seed: seed
          });
        }
      }
      PILE.forEach(function (P) { P.im.setColorAt(P.idx, P.c); });
      PILE_IMS.forEach(function (im) { im.instanceColor.needsUpdate = true; });
    })();
    const _pe = new THREE.Euler();
    const _pc = new THREE.Color(), _pOr = new THREE.Color(0xff6a1a);
    function updatePile(s) {
      const m = clamp(1 - s.weapons, 0, 1);   // 0 = intacto, 1 = fundido
      weaponsG.visible = s.weapons > 0.002;
      if (!weaponsG.visible) return;
      const sink = m * 3.0;
      for (let n = 0; n < PILE.length; n++) {
        const P = PILE[n];
        _p3.set(P.x, P.y - sink * (0.6 + 0.4 * hash(P.seed)), P.z);
        _q4.setFromEuler(_pe.set(P.rx, P.ry, P.rz, 'XYZ'));
        _s3.set(P.sc, P.sc, P.sc);
        _m4.compose(_p3, _q4, _s3);
        P.im.setMatrixAt(P.idx, _m4);
        // tinte naranja incandescente al fundirse
        _pc.copy(P.c).lerp(_pOr, clamp(m * 1.3, 0, 1));
        P.im.setColorAt(P.idx, _pc);
      }
      PILE_IMS.forEach(function (im) {
        im.instanceMatrix.needsUpdate = true;
        if (im.instanceColor) im.instanceColor.needsUpdate = true;
      });
    }

    // =====================================================================
    // 3. HORNOS DE FUNDICIÓN (4) en SITE.furnaces, con fuelles, crisoles, humo y lingotes
    // =====================================================================
    const FURN = SITE.furnaces;
    const foundryG = new THREE.Group();
    root.add(foundryG);
    const furnBodyMB = MB(), furnCrMB = MB(), furnIngMB = MB();
    const cBrick = new THREE.Color(0x9a4a2e), cBrickD = new THREE.Color(0x6e3320), cCruc = new THREE.Color(0x3b3a38);
    const cBell = new THREE.Color(0x7a5230), cIngot = new THREE.Color(0xb07a3c);
    // Geometría de un horno en local: frente en +Z (la boca mira al centro del pedestal)
    mbBox(furnBodyMB, 0, 2.0, 0, 4.2, 4.0, 4.2, cBrick);           // cuerpo
    mbBox(furnBodyMB, 0, 4.4, 0, 3.6, 0.5, 3.6, cBrickD);          // cornisa
    mbBox(furnBodyMB, 0, 7.5, -1.2, 1.2, 6.5, 1.2, cBrickD);       // chimenea
    mbBox(furnBodyMB, 0, 0.5, 2.5, 2.6, 1.0, 1.4, cBrickD);        // banco de carga
    mbBox(furnBodyMB, 0, 1.8, 2.15, 1.4, 1.6, 0.25, cBrickD);      // marco de la boca
    mbBox(furnBodyMB, -2.4, 0.7, 0.5, 0.5, 1.4, 1.0, cBrickD);     // contrafuertes
    mbBox(furnBodyMB, 2.4, 0.7, 0.5, 0.5, 1.4, 1.0, cBrickD);
    // fuelle de cuero: caja de madera con prisma inclinado (lado derecho, ~fuera del paso)
    mbBox(furnBodyMB, -3.4, 1.0, -0.6, 1.8, 1.8, 1.4, cBell, 0.3);
    // crisol (cuenco) junto a la boca: cilindro con borde
    mbBox(furnCrMB, 0, 0.5, 4.2, 0.1, 0.1, 0.1, cCruc);           // (ancla de posición)
    // lingotes apilados junto al horno
    for (let i = 0; i < 9; i++) {
      const xx = -2.6 + (i % 3) * 1.1, zz = -2.6 + Math.floor(i / 3) * 0.6;
      mbBox(furnIngMB, xx + 0.0, 0.25 + Math.floor(i / 6) * 0.45, zz + 3.0, 0.9, 0.4, 0.5, cIngot);
    }
    const furnBodyGeo = mbGeo(furnBodyMB), furnIngGeo = mbGeo(furnIngMB);
    const furnMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true });
    const furnBodyMesh = new THREE.Mesh(furnBodyGeo, furnMat);
    furnBodyMesh.castShadow = true; furnBodyMesh.receiveShadow = true; furnBodyMesh.frustumCulled = false;
    const furnIngMesh = new THREE.Mesh(furnIngGeo, furnMat);
    furnIngMesh.frustumCulled = false;
    // Instancias de los 4 hornos: cuerpo/ingots fusionados y colocados por matriz
    const furnaceNodes = [];
    FURN.forEach(function (p, i) {
      const g = new THREE.Group();
      g.position.set(p[0], 0, p[1]);
      g.rotation.y = Math.atan2(-p[0], -p[1]);   // frente hacia el pedestal (origen)
      g.add(furnBodyMesh.clone(), furnIngMesh.clone());
      foundryG.add(g);
      furnaceNodes.push(g);
    });
    // Bocas incandescentes (disco naranja) en el frente de cada horno
    const mouthGeo = new THREE.CircleGeometry(0.85, 10);
    const mouthMat = new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
    const mouthIM = mkIM(mouthGeo, mouthMat, FURN.length, false);
    foundryG.add(mouthIM);
    // Crisoles con metal fundido (cilindro)
    const crucIM = mkIM(new THREE.CylinderGeometry(0.55, 0.4, 0.7, 8), MAT.molten, FURN.length, false);
    foundryG.add(crucIM);
    // Fuelles: dos placas que bombean (oscilan en X)
    const bellIM = mkIM(new THREE.BoxGeometry(1.4, 0.2, 1.4), MAT.wood, FURN.length * 2, false);
    foundryG.add(bellIM);
    // Humo de las chimeneas (partículas)
    const NSM = 90, smokePos = new Float32Array(NSM * 3), smokeHA = [], smokeHB = [];
    for (let i = 0; i < NSM; i++) { smokeHA.push(hash(i + 1000)); smokeHB.push(hash(i + 1100)); }
    const smokeGeo = new THREE.BufferGeometry();
    smokeGeo.setAttribute('position', new THREE.BufferAttribute(smokePos, 3));
    const smokePts = new THREE.Points(smokeGeo, MAT.smoke);
    smokePts.frustumCulled = false;
    foundryG.add(smokePts);
    // Luces de fundición: 2 PointLights (máx. 3 por módulo) en las bocas de los hornos más cercanos al puerto
    const furnLights = [];
    [FURN[0], FURN[1]].forEach(function (p) {
      const L = new THREE.PointLight(0xff8a3a, 0, 60, 1.6);
      const dx = -p[0], dz = -p[1], dl = Math.hypot(dx, dz) || 1;
      L.position.set(p[0] + dx / dl * 2.6, 2.2, p[1] + dz / dl * 2.6);
      foundryG.add(L);
      furnLights.push(L);
    });
    // Posición en mundo de la chimenea de cada horno (para el humo)
    const CHIM = FURN.map(function (p) {
      const th = Math.atan2(-p[0], -p[1]);
      return { x: p[0] - Math.sin(th) * 1.2, z: p[1] - Math.cos(th) * 1.2 };
    });
    const _fO = new THREE.Vector3();
    function updateFoundry(s) {
      const f = clamp(s.foundry, 0, 1), W = s.wall;
      // con el terraplén por encima de 0.4 los hornos quedan ocultos (los crisoles pasan a la cima)
      foundryG.visible = f > 0.002 && s.mound <= 0.4;
      // apaga/enciende el brillo con la pista
      furnLights.forEach(function (L, i) { L.intensity = 2.2 * f * (0.85 + 0.15 * Math.sin(W * 7 + i * 2)); L.visible = f > 0.002; });
      mouthMat.opacity = 0.35 + 0.6 * f * (0.85 + 0.15 * Math.sin(W * 9));
      for (let i = 0; i < FURN.length; i++) {
        const p = FURN[i], th = Math.atan2(-p[0], -p[1]);
        const ca = Math.cos(th), sa = Math.sin(th);
        // boca: disco en el frente (+Z local)
        _p3.set(p[0] + sa * 2.12, 1.8, p[1] + ca * 2.12);
        _q4.setFromEuler(_e3.set(0, th, 0, 'XYZ'));
        _m4.compose(_p3, _q4, _s3.set(1, 1, 1));
        mouthIM.setMatrixAt(i, _m4);
        // crisol: en el banco de carga, con vuelco que cambia con el reloj
        const tilt = 0.4 * Math.max(0, Math.sin(W * 0.5 + i));
        _p3.set(p[0] + sa * 3.5, 1.05, p[1] + ca * 3.5);
        _q4.setFromEuler(_e3.set(tilt, th, 0, 'XYZ'));
        _m4.compose(_p3, _q4, _s3.set(f, f, f));
        crucIM.setMatrixAt(i, _m4);
        // fuelles: dos placas que se abren y cierran (vaivén)
        for (let b = 0; b < 2; b++) {
          const open = 0.5 + 0.5 * Math.sin(W * 2.2 + i * 1.7 + b * Math.PI);
          const lx = -3.4 + (b ? 0.5 : -0.5) * open * 0.6;
          _t4.makeTranslation(lx, 1.9, -0.6);
          _lm.makeRotationY(th);
          _lm.setPosition(p[0], 0, p[1]);
          _lm.multiply(_t4);
          _lm.multiply(new THREE.Matrix4().makeScale(f, f, f));
          bellIM.setMatrixAt(i * 2 + b, _lm);
        }
      }
      mouthIM.instanceMatrix.needsUpdate = true;
      crucIM.instanceMatrix.needsUpdate = true;
      bellIM.instanceMatrix.needsUpdate = true;
      // humo: parte de las chimeneas y sube
      for (let i = 0; i < NSM; i++) {
        const c = CHIM[i % FURN.length];
        const age = frac(W * 0.12 + smokeHA[i]);
        smokePos[i * 3] = c.x + (smokeHB[i] - 0.5) * 1.2 + age * 3.0;
        smokePos[i * 3 + 1] = 10.5 + age * 16;
        smokePos[i * 3 + 2] = c.z + (smokeHB[i] - 0.5) * 1.0 + age * 1.2;
      }
      smokeGeo.attributes.position.needsUpdate = true;
      smokeGeo.setDrawRange(0, Math.round(NSM * f));
      smokePts.visible = f > 0.002;
    }

    // =====================================================================
    // 4. BARCOS MERCANTES en el puerto (dentro de los espigones de SITE)
    //    cargando mármol (bloques) y lingotes (cajas de bronce). Algunos con vela.
    // =====================================================================
    const boatsG = new THREE.Group();
    root.add(boatsG);
    const NB = 6;
    // casco mercante: eslora 24 m (local X), manga 7 m (local Z), quilla en y=0
    const merchMB = MB();
    (function buildHull() {
      const cH = new THREE.Color(0x5b3d24), cB = new THREE.Color(0x2e1f12), cRail = new THREE.Color(0x7a5230);
      const top = [[-12, 1.8, 0], [-10, 2.6, 3.0], [-2, 2.6, 3.4], [6, 2.6, 3.4], [11, 2.4, 2.0], [13, 2.2, 0], [11, 2.4, -2.0], [6, 2.6, -3.4], [-2, 2.6, -3.4], [-10, 2.6, -3.0]];
      const bot = top.map(function (p) { return [p[0] * 0.75, 0.2, p[2] * 0.55]; });
      for (let i = 1; i < top.length - 1; i++) mbTriLocal(merchMB, top[0], top[i], top[i + 1], cH);
      for (let i = 0; i < top.length; i++) {
        const j = (i + 1) % top.length;
        mbTriLocal(merchMB, top[i], top[j], bot[j], cH);
        mbTriLocal(merchMB, top[i], bot[j], bot[i], cB);
      }
      // castillo de popa y mástil
      mbBox(merchMB, -9.0, 4.0, 0, 4.0, 2.4, 5.6, cRail);
      mbBox(merchMB, 0, 6.0, 0, 0.3, 11.0, 0.3, cRail);
      mbBox(merchMB, 0, 8.4, 0, 0.12, 0.12, 9.0, cRail, 0, 0, Math.PI / 2); // verga
    })();
    const merchIM = mkIM(mbGeo(merchMB), MAT.hull, NB, true);
    const sailMerchIM = mkIM((function () {
      // vela cuadra: plano athwartship (YZ), con abombado hacia +X
      const g = new THREE.PlaneGeometry(8.5, 8, 4, 4);
      g.translate(0, 4.0, 0);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) { const v = p.getY(i) / 8; p.setZ(i, 0.8 * Math.sin(Math.PI * v) * Math.sin(Math.PI * (p.getX(i) / 8.5 + 0.5))); }
      g.rotateY(Math.PI / 2);
      g.computeVertexNormals();
      return g;
    })(), MAT.sail, NB, true);
    // carga: bloques de mármol (lado de estribor) y lingotes de bronce (bodega)
    const marbleIM = mkIM(new THREE.BoxGeometry(1.4, 0.9, 1.0), MAT.stone, NB * 8, true);
    const ingotIM = mkIM(new THREE.BoxGeometry(0.9, 0.35, 0.6), MAT.bronze, NB * 6, false);
    boatsG.add(merchIM, sailMerchIM, marbleIM, ingotIM);
    // atraque: 6 barcos a lo largo de los espigones, dentro de la bocana, proa al mar (+Z=popa)
    const BERTHS = [];
    for (let i = 0; i < NB; i++) {
      const side = i % 2 ? 1 : -1, slot = Math.floor(i / 2);
      BERTHS.push({ x: side * (42 + slot * 2), z: -110 - slot * 44 - (side > 0 ? 6 : 0), hd: side > 0 ? Math.PI * 0.5 : -Math.PI * 0.5, sail: i % 3 === 0 ? 1 : 0, ph: hash(i + 300) });
    }
    const _hm = new THREE.Matrix4();
    function updateBoats(s) {
      const b = clamp(s.boats, 0, 1), W = s.wall, t = s.t;
      boatsG.visible = b > 0.002;
      for (let i = 0; i < NB; i++) {
        const B = BERTHS[i];
        const bob = 0.06 * Math.sin(W * 0.9 + B.ph * TAU), roll = 0.02 * Math.sin(W * 0.7 + B.ph * 5);
        // quilla casi en el agua (mar en y=-1.5): base del casco a y ~ -1.3 + bob
        _p3.set(B.x, SITE.seaLevel + 0.2 + bob, B.z);
        _q4.setFromEuler(_e3.set(0, B.hd, roll, 'YXZ'));
        _s3.set(1, 1, 1);
        _hm.compose(_p3, _q4, _s3);
        merchIM.setMatrixAt(i, _hm);
        // vela: sólo en los barcos con vela, desplegada según s.boats
        const sc = B.sail ? b : 0;
        _s3.set(sc, sc, sc);
        _m4.compose(_p3, _q4, _s3);
        sailMerchIM.setMatrixAt(i, _m4);
        // carga de mármol: 8 bloques en la cubierta (se van cargando con t)
        for (let c = 0; c < 8; c++) {
          const load = clamp((t - 2 * c - B.ph * 6) / 3, 0, 1) * b;
          _t4.makeTranslation(-4 + (c % 4) * 1.6, 3.2 + Math.floor(c / 4) * 0.95, (c < 4 ? -1 : 1) * 1.2);
          _lm.copy(_hm).multiply(_t4);
          _lm.multiply(new THREE.Matrix4().makeScale(load, load, load));
          marbleIM.setMatrixAt(i * 8 + c, _lm);
        }
        // lingotes: 6 en la bodega, uno a uno
        for (let c = 0; c < 6; c++) {
          const load = clamp((t - 3 * c - B.ph * 8) / 2, 0, 1) * b;
          _t4.makeTranslation(-1 + (c % 3) * 1.2, 1.4 + Math.floor(c / 3) * 0.4, 0);
          _lm.copy(_hm).multiply(_t4);
          _lm.multiply(new THREE.Matrix4().makeScale(load, load, load));
          ingotIM.setMatrixAt(i * 6 + c, _lm);
        }
      }
      merchIM.instanceMatrix.needsUpdate = true;
      sailMerchIM.instanceMatrix.needsUpdate = true;
      marbleIM.instanceMatrix.needsUpdate = true;
      ingotIM.instanceMatrix.needsUpdate = true;
    }

    // =====================================================================
    // 5. TERRAPLÉN en espiral (mound). Superficie de revolución con hueco central
    //    (radio = halfWidthAt(altura)+1) para que emerja la estatua.
    //    cima en y = 15 + m*33 - 1; radio base = 25 + 55*m. Se recalcula sólo si cambia m.
    // =====================================================================
    const moundG = new THREE.Group();
    root.add(moundG);
    const NA = 96;          // segmentos angulares
    const NH_O = 48;        // filas de la superficie exterior
    const NH_I = 20;        // filas de la pared interior (y 15..cima)
    const MO_ROWS = NH_O + 1 + NH_I + 1 + 2; // exterior + interior + 2 filas de cima
    const moundPos = new Float32Array(MO_ROWS * (NA + 1) * 3);
    const moundUV = new Float32Array(MO_ROWS * (NA + 1) * 2);
    const moundIdx = [];
    function gridIdx(r0, rows, cols, flip) {
      for (let r = 0; r < rows - 1; r++) for (let c = 0; c < cols - 1; c++) {
        const a = (r0 + r) * cols + c, b = a + 1, d = a + cols, e = d + 1;
        if (flip) moundIdx.push(a, d, b, b, d, e); else moundIdx.push(a, b, d, b, e, d);
      }
    }
    const COLS = NA + 1;
    gridIdx(0, NH_O + 1, COLS, false);
    gridIdx(NH_O + 1, NH_I + 1, COLS, true);
    // anillo de cima: 2 filas (interior y exterior) -> 1 banda
    gridIdx(NH_O + 1 + NH_I + 1, 2, COLS, false);
    const moundGeo = new THREE.BufferGeometry();
    moundGeo.setAttribute('position', new THREE.BufferAttribute(moundPos, 3));
    moundGeo.setAttribute('uv', new THREE.BufferAttribute(moundUV, 2));
    moundGeo.setIndex(moundIdx);
    // textura de tierra procedural (manchas, grano y surcos)
    const earthTex = canvasTex(256, 256, function (g, w, h) {
      g.fillStyle = '#7a5a36'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 2400; i++) {
        const v = hash(i + 7) * 0.5;
        const c = v < 0.33 ? '#6a4a2a' : (v < 0.66 ? '#8e6a42' : '#a88558');
        g.fillStyle = c; g.globalAlpha = 0.35 + hash(i + 8) * 0.4;
        g.beginPath(); g.arc(hash(i + 9) * w, hash(i + 10) * h, 0.8 + hash(i + 11) * 2.4, 0, TAU); g.fill();
      }
      g.globalAlpha = 0.5; g.strokeStyle = '#4e3620'; g.lineWidth = 1;
      for (let i = 0; i < 60; i++) {
        const x = hash(i + 50) * w, y = hash(i + 60) * h;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + (hash(i + 70) - 0.5) * 30, y + 6 + hash(i + 80) * 10); g.stroke();
      }
      // surcos de arado: curvas oscuras paralelas
      g.globalAlpha = 0.45; g.strokeStyle = '#3e2a16'; g.lineWidth = 2;
      for (let y = 0; y < h; y += 16) {
        g.beginPath();
        for (let x = 0; x <= w; x += 8) g.lineTo(x, y + Math.sin(x * 0.05 + y) * 2.5);
        g.stroke();
      }
      // piedras: guijarros grises con brillo
      for (let i = 0; i < 110; i++) {
        const x = hash(i + 300) * w, y = hash(i + 400) * h, r = 1.5 + hash(i + 500) * 3.5;
        g.globalAlpha = 0.8;
        g.fillStyle = '#8f8a80'; g.beginPath(); g.ellipse(x, y, r, r * 0.7, 0, 0, TAU); g.fill();
        g.fillStyle = '#c9c4b8'; g.beginPath(); g.ellipse(x - r * 0.3, y - r * 0.3, r * 0.4, r * 0.25, 0, 0, TAU); g.fill();
      }
      g.globalAlpha = 1;
    });
    earthTex.wrapS = THREE.RepeatWrapping; earthTex.wrapT = THREE.RepeatWrapping;
    earthTex.repeat.set(6, 3);
    MAT.mound = new THREE.MeshStandardMaterial({ map: earthTex, roughness: 1, flatShading: false, side: THREE.DoubleSide });
    const moundMesh = new THREE.Mesh(moundGeo, MAT.mound);
    moundMesh.castShadow = true; moundMesh.receiveShadow = true; moundMesh.frustumCulled = false;
    moundG.add(moundMesh);

    const MD = { ytop: 0, Rb: 0, Rtop: 0, lastM: -1 };
    function innerR(h) { return COL.halfWidthAt(Math.max(0, h - COL.baseY)) + 1; }
    function outerR(h, yt, Rb, Rtop) { const u = clamp(h / yt, 0, 1); return Rb * (1 - u) + Rtop * u; }
    function setMoundGeometry(m) {
      const yt = 15 + m * COL.height - 5;          // cima: 5 m bajo el bronce ya fundido
      const Rb = 25 + 70 * m;
      const Ri_top = innerR(yt);
      const Rtop = Ri_top + 7;
      MD.ytop = yt; MD.Rb = Rb; MD.Rtop = Rtop;
      let k = 0;
      function put(r, y, a, u, v) {
        moundPos[k * 3] = Math.cos(a) * r; moundPos[k * 3 + 1] = y; moundPos[k * 3 + 2] = Math.sin(a) * r;
        moundUV[k * 2] = u; moundUV[k * 2 + 1] = v; k++;
      }
      // exterior: desde el suelo (y=0) hasta la cima
      for (let i = 0; i <= NH_O; i++) {
        const h = yt * i / NH_O;
        const r = outerR(h, yt, Rb, Rtop);
        for (let j = 0; j <= NA; j++) { const a = TAU * j / NA; put(r, h, a, j / NA * 4, h / yt * 2); }
      }
      // pared interior: desde la altura 15 (pedestal) hasta la cima, alrededor de la estatua
      for (let i = 0; i <= NH_I; i++) {
        const h = 15 + (yt - 15) * i / NH_I;
        const r = innerR(h);
        for (let j = 0; j <= NA; j++) { const a = TAU * j / NA; put(r, h, a, j / NA * 4, h / yt * 2); }
      }
      // anillo de cima: interior y exterior a la altura de la cima
      for (let j = 0; j <= NA; j++) { const a = TAU * j / NA; put(Ri_top, yt, a, j / NA * 4, 0.98); }
      for (let j = 0; j <= NA; j++) { const a = TAU * j / NA; put(Rtop, yt, a, j / NA * 4, 1.0); }
      moundGeo.attributes.position.needsUpdate = true;
      moundGeo.attributes.uv.needsUpdate = true;
      moundGeo.computeVertexNormals();
      moundGeo.computeBoundingSphere();
      MD.lastM = m;
    }
    // ----- rampa en espiral: planchas que siguen la superficie exterior -----
    const RAMP_K = 2.4, RAMP_TH0 = 0.8;   // vueltas de la espiral y ángulo de inicio
    const NPL = 420;                      // planchas de la rampa
    const plankIM = mkIM(new THREE.BoxGeometry(3.6, 0.35, 1.7), MAT.stone, NPL, true);
    moundG.add(plankIM);
    const _dummy = new THREE.Object3D();
    const _rA = new THREE.Vector3(), _rB = new THREE.Vector3();
    // punto de la espiral en u∈[0,1] (0 = base, 1 = cima), justo sobre la superficie exterior
    function rampPt(u, out) {
      const h = clamp(u, 0, 1) * MD.ytop;
      const th = RAMP_TH0 + TAU * RAMP_K * clamp(u, 0, 1);
      const r = outerR(h, MD.ytop, MD.Rb, MD.Rtop) + 0.2;
      return out.set(Math.cos(th) * r, h + 0.2, Math.sin(th) * r);
    }
    function placeOnRamp(im, idx, u, lift, sc) {
      rampPt(u, _rA); rampPt(Math.min(1, u + 0.004), _rB);
      _dummy.position.copy(_rA).add(new THREE.Vector3(0, lift || 0, 0));
      _dummy.lookAt(_rB.x, _rB.y + (lift || 0), _rB.z);
      _dummy.scale.set(sc, sc, sc);
      _dummy.updateMatrix();
      im.setMatrixAt(idx, _dummy.matrix);
    }
    // piedras de la rampa: tono de tierra y mampostería
    (function () {
      // losas de piedra clara con juntas oscuras: la espiral se lee desde lejos
      for (let i = 0; i < NPL; i++) plankIM.setColorAt(i, _c3.setHex(i % 3 === 0 ? 0xd6c39a : (i % 3 === 1 ? 0xb89c6c : 0xc9b080)));
      plankIM.instanceColor.needsUpdate = true;
    })();

    // ----- carros con bueyes que suben la rampa -----
    const NC = 6;
    const cartBodyIM = mkIM(new THREE.BoxGeometry(2.6, 0.7, 1.8), MAT.wood, NC, true);
    const cartWheelIM = mkIM(new THREE.CylinderGeometry(0.75, 0.75, 0.22, 10).rotateZ(Math.PI / 2), MAT.wood, NC * 2, true);
    const oxBodyIM = mkIM(new THREE.BoxGeometry(1.5, 1.2, 0.9), MAT.stone, NC * 2, true);
    const oxHeadIM = mkIM(new THREE.BoxGeometry(0.6, 0.55, 0.7), MAT.wood, NC * 2, false);
    moundG.add(cartBodyIM, cartWheelIM, oxBodyIM, oxHeadIM);
    const _cm = new THREE.Matrix4(), _cq = new THREE.Quaternion();
    function updateCarts(s) {
      const m = s.mound;
      const on = m > 0.3;
      cartBodyIM.visible = cartWheelIM.visible = oxBodyIM.visible = oxHeadIM.visible = on;
      if (!on) return;
      for (let k = 0; k < NC; k++) {
        const u = frac(s.t / 34 + k / NC) * 0.96;
        rampPt(u, _rA); rampPt(Math.min(1, u + 0.004), _rB);
        _dummy.position.copy(_rA).add(new THREE.Vector3(0, 1.0, 0));
        _dummy.lookAt(_rB.x, _rB.y + 1.0, _rB.z);
        _dummy.updateMatrix();
        _cm.copy(_dummy.matrix);
        cartBodyIM.setMatrixAt(k, _cm);
        for (let w = 0; w < 2; w++) {
          _t4.makeTranslation((w ? 1.35 : -1.35), -0.4, 0);
          _lm.multiplyMatrices(_cm, _t4);
          cartWheelIM.setMatrixAt(k * 2 + w, _lm);
        }
        for (let o = 0; o < 2; o++) {
          _t4.makeTranslation((o ? 0.5 : -0.5), 0.5, 2.6);
          _lm.multiplyMatrices(_cm, _t4);
          oxBodyIM.setMatrixAt(k * 2 + o, _lm);
          _t4.makeTranslation((o ? 0.5 : -0.5), 1.05, 3.4);
          _lm.multiplyMatrices(_cm, _t4);
          oxHeadIM.setMatrixAt(k * 2 + o, _lm);
        }
      }
      cartBodyIM.instanceMatrix.needsUpdate = true;
      cartWheelIM.instanceMatrix.needsUpdate = true;
      oxBodyIM.instanceMatrix.needsUpdate = true;
      oxHeadIM.instanceMatrix.needsUpdate = true;
    }

    // ----- actualiza terraplén y rampa cuando cambia m -----
    function updateMound(s) {
      const m = clamp(s.mound, 0, 1);
      moundG.visible = m > 0.002;
      if (!moundG.visible) return;
      if (Math.abs(m - MD.lastM) > 1e-4) {
        setMoundGeometry(m);
        for (let i = 0; i < NPL; i++) placeOnRamp(plankIM, i, (i + 0.5) / NPL, 0.15, 1);
        plankIM.instanceMatrix.needsUpdate = true;
      }
      updateCarts(s);
    }

    // =====================================================================
    // 6. OBREROS (InstancedMesh: torso, cabeza, piernas, brazos, herramienta)
    //    - 90 martilleando en el suelo alrededor del pedestal (o en la base del terraplén)
    //    - 40 caminando en círculo por la obra
    //    - 50 subiendo la rampa, 30 en la cima (a la altura actual del terraplén)
    // =====================================================================
    const workersG = new THREE.Group();
    root.add(workersG);
    const NWK = 210;
    const wTorso = mkIM(new THREE.BoxGeometry(0.42, 0.66, 0.24), MAT.cloth, NWK, true);
    const wHead = mkIM(new THREE.SphereGeometry(0.14, 6, 4), MAT.skin, NWK, false);
    const wLeg = mkIM(new THREE.BoxGeometry(0.19, 0.9, 0.2), MAT.cloth, NWK * 2, true);
    const wArm = mkIM(new THREE.BoxGeometry(0.13, 0.66, 0.13), MAT.skin, NWK * 2, false);
    const wTool = mkIM(new THREE.BoxGeometry(0.16, 0.12, 0.26), MAT.iron, NWK, false);
    const WIMS = [wTorso, wHead, wLeg, wArm, wTool];
    WIMS.forEach(function (im) { workersG.add(im); });
    // ropa de colores (túnicas ocres, blancas y azules) y tono de piel
    (function () {
      const pal = [0xd9c9a3, 0xb8794a, 0x3d6f9e, 0xe6e0d0, 0x8c3b2a];
      for (let i = 0; i < NWK; i++) wTorso.setColorAt(i, _c3.setHex(pal[i % pal.length]));
      for (let i = 0; i < NWK * 2; i++) wLeg.setColorAt(i, _c3.setHex(i % 2 ? 0x5b4a36 : 0x6b5a42));
      wTorso.instanceColor.needsUpdate = true;
      wLeg.instanceColor.needsUpdate = true;
    })();
    const _wR = new THREE.Matrix4(), _wq = new THREE.Quaternion(), _wp = new THREE.Vector3(), _wsc = new THREE.Vector3();
    const _wA = new THREE.Matrix4(), _wB = new THREE.Matrix4(), _wE = new THREE.Euler();
    function wRoot(x, y, z, hd) { _wp.set(x, y, z); _wq.setFromAxisAngle(_yAxisW, hd); _wsc.set(1, 1, 1); _wR.compose(_wp, _wq, _wsc); }
    const _yAxisW = new THREE.Vector3(0, 1, 0);
    // pieza: M = root * T(p) * R(rx,rz) * T(off) * S(size)
    function wPart(im, idx, px, py, pz, rx, rz, ox, oy, oz, sx, sy, sz) {
      _wA.makeTranslation(px, py, pz);
      _wE.set(rx, 0, rz, 'XYZ'); _wB.makeRotationFromEuler(_wE); _wA.multiply(_wB);
      _wB.makeTranslation(ox, oy, oz); _wA.multiply(_wB);
      _wB.makeScale(sx, sy, sz); _wA.multiply(_wB);
      _wB.multiplyMatrices(_wR, _wA);
      im.setMatrixAt(idx, _wB);
    }
    // postura de un obrero: ll/lr piernas (balanceo), al/ar brazos, tool: 1 = martillo, lean = inclinación
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
    // índices: 0-89 martilleo suelo, 90-129 caminantes, 130-179 rampa, 180-209 cima
    const HAMMER_N = 90, WALK_N = 40, RAMP_W_N = 50, TOP_N = 30;
    const WORK_CYC = [];
    for (let i = 0; i < NWK; i++) WORK_CYC.push({ h1: hash(i + 500), h2: hash(i + 600), h3: hash(i + 700) });
    function updateWorkers(s) {
      const W = s.wall, w = clamp(s.workers, 0, 1), m = clamp(s.mound, 0, 1);
      workersG.visible = w > 0.002;
      if (!workersG.visible) return;
      const Rb = MD.Rb || 25;
      // 1) martilleo en el suelo, alrededor del pedestal (o al pie del terraplén si ya existe)
      for (let i = 0; i < HAMMER_N; i++) {
        const C = WORK_CYC[i];
        const a = C.h1 * TAU;
        const r = m > 0.002 ? Rb + 2 + C.h2 * 8 : 12 + C.h2 * 12;
        const x = Math.cos(a) * r, z = Math.sin(a) * r;
        const hd = Math.atan2(-x, -z) + (C.h3 - 0.5) * 0.4;
        wRoot(x, 0, z, hd);
        const ph = W * 3.2 + i;
        PW.ar = -1.2 + 0.9 * Math.cos(ph); PW.al = -0.3; PW.ll = 0.08; PW.lr = -0.08; PW.lean = 0.35; PW.tool = 1;
        drawWorker(i, PW);
      }
      // 2) caminantes: círculo alrededor de la obra, con paso
      for (let j = 0; j < WALK_N; j++) {
        const i = HAMMER_N + j, C = WORK_CYC[i];
        const r = 34 + C.h2 * 16 + (m > 0.002 ? Rb * 0.5 : 0);
        const dir = C.h3 > 0.5 ? 1 : -1;
        const a = dir * (s.t * 0.035 + C.h1 * TAU);
        const x = Math.cos(a) * r, z = Math.sin(a) * r;
        const hd = Math.atan2(-Math.sin(a) * dir, Math.cos(a) * dir);
        wRoot(x, 0, z, hd);
        const sw = Math.sin(W * 5 + C.h1 * TAU);
        PW.ll = 0.4 * sw; PW.lr = -0.4 * sw; PW.al = -0.35 * sw; PW.ar = 0.35 * sw; PW.lean = 0.04; PW.tool = 0;
        drawWorker(i, PW);
      }
      // 3) rampa: suben el terraplén cargando piedras
      for (let j = 0; j < RAMP_W_N; j++) {
        const i = HAMMER_N + WALK_N + j, C = WORK_CYC[i];
        const hiddenRamp = m < 0.3;
        const u = clamp((j + 0.5) / RAMP_W_N * 0.94 + 0.02, 0.02, 0.97);
        rampPt(u, _rA); rampPt(Math.min(1, u + 0.01), _rB);
        const hd = Math.atan2(_rB.x - _rA.x, _rB.z - _rA.z);
        const lat = (j % 2 ? 1 : -1) * 1.2;
        const px = _rA.x + Math.cos(hd) * lat * -1, pz = _rA.z + Math.sin(hd) * lat;
        if (hiddenRamp) { wRoot(0, -50, 0, 0); } else wRoot(px, _rA.y - 0.2, pz, hd);
        const ph = W * 2.6 + C.h1 * TAU;
        PW.ll = 0.35 * Math.sin(ph); PW.lr = -0.35 * Math.sin(ph); PW.al = -0.9; PW.ar = -0.9 + 0.1 * Math.sin(ph); PW.lean = 0.28; PW.tool = 0;
        drawWorker(i, PW);
      }
      // 4) cima: de pie junto al borde (a la altura actual), con martillo
      for (let j = 0; j < TOP_N; j++) {
        const i = HAMMER_N + WALK_N + RAMP_W_N + j, C = WORK_CYC[i];
        const yt = MD.ytop || 15;
        // sólo en el arco opuesto a la cámara de t=130-136 (no tapan la corona)
        const a = 1.2 + (j / TOP_N) * 3.0 + C.h1 * 0.2;
        const active = MD.ytop > 0 && m > 0.3;
        const r = active ? (innerR(yt) + 2.5 + C.h2 * 2.5) : 0;
        const x = Math.cos(a) * r, z = Math.sin(a) * r;
        const hd = Math.atan2(-x, -z);
        if (active) wRoot(x, yt, z, hd); else wRoot(0, -50, 0, 0);
        PW.ar = -1.0 + 0.8 * Math.cos(W * 3 + i); PW.al = -0.2; PW.ll = 0; PW.lr = 0; PW.lean = 0.25; PW.tool = 1;
        drawWorker(i, PW);
      }
      WIMS.forEach(function (im) { im.instanceMatrix.needsUpdate = true; });
    }

    // =====================================================================
    // 7. VERTIDO de bronce fundido (s.pour): crisoles volcándose sobre andamios en la cima
    //    del terraplén, a la altura de la construcción (yp = 15 + build*33). Chorro grueso,
    //    resplandor aditivo, chispas y moldes de arcilla.
    // =====================================================================
    const pourG = new THREE.Group();
    root.add(pourG);
    const NCR = 3, NSTR = 8;
    const crucibleIM = mkIM(new THREE.CylinderGeometry(1.0, 0.7, 1.2, 10, 1, true), MAT.iron, NCR, true);
    const crucLiqIM = mkIM(new THREE.CircleGeometry(0.9, 10).rotateX(-Math.PI / 2), MAT.molten, NCR, false);
    const scafIM = mkIM(new THREE.BoxGeometry(0.35, 1, 0.35), MAT.wood, NCR * 4, true);
    const streamIM = mkIM(new THREE.CylinderGeometry(0.24, 0.18, 1, 8).rotateX(Math.PI / 2), MAT.molten, NCR * NSTR, false);
    const streamGlowIM = mkIM(new THREE.CylinderGeometry(0.6, 0.45, 1, 8).rotateX(Math.PI / 2), MAT.glow, NCR * NSTR, false);
    const moldIM = mkIM(new THREE.BoxGeometry(1.6, 0.9, 1.0), MAT.clay, 6, true);
    const moltenRing = new THREE.Mesh(new THREE.RingGeometry(0.4, 3.2, 24).rotateX(-Math.PI / 2), MAT.glow);
    moltenRing.frustumCulled = false;
    const NSP = 160, sparkPos = new Float32Array(NSP * 3), sparkA = [], sparkB = [];
    for (let i = 0; i < NSP; i++) { sparkA.push(hash(i + 2000)); sparkB.push(hash(i + 2100)); }
    const sparkGeo = new THREE.BufferGeometry();
    sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
    const sparks = new THREE.Points(sparkGeo, MAT.spark);
    sparks.frustumCulled = false;
    pourG.add(crucibleIM, crucLiqIM, scafIM, streamIM, streamGlowIM, moldIM, moltenRing, sparks);
    const _pd = new THREE.Object3D();
    const _pmat = new THREE.Matrix4();
    const _tgt = [];
    for (let k = 0; k < NCR; k++) _tgt.push({ x: 0, y: 0, z: 0 });
    const POUR_ANG = [0.55, 0.85, 1.15];
    function updatePour(s) {
      const p = clamp(s.pour, 0, 1), W = s.wall, b = clamp(s.build, 0, 1);
      pourG.visible = p > 0.002 && MD.ytop > 0;
      if (!pourG.visible) return;
      const yt = MD.ytop;
      const yp = 15 + b * COL.height;               // superficie del bronce fundido
      const yc = yp + 2.2;                           // labios de los crisoles, por encima del bronce
      const yl = clamp(yp - COL.baseY, 0.5, COL.height - 0.5);
      const hw = COL.halfWidthAt(yl);
      const Rc = innerR(yt) + 2.4;                   // crisoles sobre el borde del hueco
      MAT.glow.opacity = 0.35 + 0.5 * p * (0.9 + 0.1 * Math.sin(W * 6));
      for (let k = 0; k < NCR; k++) {
        const a = POUR_ANG[k];
        const cx = Math.cos(a) * Rc, cz = Math.sin(a) * Rc;
        const dx = -Math.cos(a), dz = -Math.sin(a);   // dirección hacia el centro
        const yaw = Math.atan2(-dz, dx);
        const tilt = (k === 0 ? p : 0.6 * p) * 0.9 * (0.9 + 0.1 * Math.sin(W * 4 + k));
        // andamio: 4 postes desde la cima hasta el labio del crisol
        for (let q = 0; q < 4; q++) {
          const y0 = yt - 0.5;
          _pd.position.set(cx + ((q & 1) ? 0.9 : -0.9), (y0 + yc) / 2, cz + ((q & 2) ? 0.9 : -0.9));
          _pd.rotation.set(0, 0, 0); _pd.scale.set(1, yc - y0, 1);
          _pd.updateMatrix();
          scafIM.setMatrixAt(k * 4 + q, _pd.matrix);
        }
        // crisol: cuenco volcándose hacia el centro
        _pd.position.set(cx, yc, cz);
        _pd.rotation.set(0, yaw, -tilt, 'YXZ'); _pd.scale.set(1, 1, 1);
        _pd.updateMatrix();
        crucibleIM.setMatrixAt(k, _pd.matrix);
        _pmat.makeTranslation(0, 0.45, 0).premultiply(_pd.matrix);
        crucLiqIM.setMatrixAt(k, _pmat);
        // chorro: desde el labio hasta el borde del bronce
        const sx = cx + dx * 1.0, sy = yc - 0.5, sz = cz + dz * 1.0;
        const tr = hw * 0.55;
        const tx = Math.cos(a) * tr, ty = yp, tz = Math.sin(a) * tr;
        _tgt[k].x = tx; _tgt[k].y = ty; _tgt[k].z = tz;
        for (let j = 0; j < NSTR; j++) {
          const f0 = j / NSTR, f1 = (j + 1) / NSTR;
          const x0 = sx + (tx - sx) * f0, y0 = sy + (ty - sy) * f0, z0 = sz + (tz - sz) * f0;
          const x1 = sx + (tx - sx) * f1, y1 = sy + (ty - sy) * f1, z1 = sz + (tz - sz) * f1;
          const len = Math.hypot(x1 - x0, y1 - y0, z1 - z0) + 0.02;
          _pd.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
          _pd.lookAt(x1, y1, z1);
          const pk = p * (k === 0 ? 1 : 0.8);
          _pd.scale.set(Math.max(pk, 0.0001), Math.max(pk, 0.0001), Math.max(len * pk, 0.0001));
          _pd.updateMatrix();
          streamIM.setMatrixAt(k * NSTR + j, _pd.matrix);
          _pd.scale.set(Math.max(pk * 2.4, 0.0001), Math.max(pk * 2.4, 0.0001), Math.max(len * pk, 0.0001));
          _pd.updateMatrix();
          streamGlowIM.setMatrixAt(k * NSTR + j, _pd.matrix);
        }
      }
      scafIM.instanceMatrix.needsUpdate = true;
      crucibleIM.instanceMatrix.needsUpdate = true;
      crucLiqIM.instanceMatrix.needsUpdate = true;
      streamIM.instanceMatrix.needsUpdate = true;
      streamGlowIM.instanceMatrix.needsUpdate = true;
      // anillo incandescente en la superficie del bronce
      moltenRing.position.set(0, yp + 0.05, 0);
      moltenRing.scale.set(hw / 3.2, 1, hw / 3.2);
      // moldes de arcilla en la cima, fuera del hueco
      for (let k = 0; k < 6; k++) {
        const a = k / 6 * TAU + 0.3;
        _pd.position.set(Math.cos(a) * (Rc + 1.5), yt + 0.45, Math.sin(a) * (Rc + 1.5));
        _pd.rotation.set(0, a, 0); _pd.scale.set(p, p, p);
        _pd.updateMatrix();
        moldIM.setMatrixAt(k, _pd.matrix);
      }
      moldIM.instanceMatrix.needsUpdate = true;
      // chispas: nacen en el impacto y caen
      for (let i = 0; i < NSP; i++) {
        const age = frac(W * 1.6 + sparkA[i]);
        const T = _tgt[i % NCR];
        const ang2 = sparkB[i] * TAU;
        const rr = (sparkA[i] - 0.5) * 3.0 * age;
        sparkPos[i * 3] = T.x + Math.cos(ang2) * rr;
        sparkPos[i * 3 + 1] = T.y + age * 4.0 - 6.0 * age * age;
        sparkPos[i * 3 + 2] = T.z + Math.sin(ang2) * rr;
      }
      sparkGeo.attributes.position.needsUpdate = true;
      sparks.visible = p > 0.05;
      MAT.spark.opacity = 0.95 * p;
    }

    // =====================================================================
    // 8. GRÚAS / POLIPASTOS de madera: 2 en la cima del terraplén, 2 junto al pedestal
    //    (izan sillares de mármol mientras s.pedestal sube)
    // =====================================================================
    const CRANE_H = 18;
    const craneMB = MB();
    const cW = new THREE.Color(0x6e4a2a);
    mbBox(craneMB, 0, CRANE_H / 2, 0, 0.45, CRANE_H, 0.45, cW);             // mástil
    mbBox(craneMB, 0, CRANE_H * 0.55, 0.9, 0.12, 0.12, 0.12, cW);            // travesaños del mástil
    mbBox(craneMB, 0, CRANE_H * 0.36, 0.9, 0.12, 0.12, 0.12, cW);
    mbBox(craneMB, 4.6, CRANE_H - 0.6, 0, 9.5, 0.3, 0.3, cW);               // pluma (jib)
    mbBox(craneMB, -1.8, CRANE_H - 1.6, 0, 3.8, 0.25, 0.25, cW, 0, 0, -0.5); // contrapeso brazo
    mbBox(craneMB, -3.6, CRANE_H - 2.0, 0, 1.2, 1.0, 1.0, new THREE.Color(0x3a2a1a)); // contrapeso
    mbBox(craneMB, 0, CRANE_H - 0.3, 0, 1.0, 0.6, 0.9, cW);                 // cabeza del mástil
    const craneIM = mkIM(mbGeo(craneMB), MAT.wood, 4, true);
    const ropeIM = mkIM(new THREE.BoxGeometry(0.06, 1, 0.06), MAT.rope, 4, false);
    const sillarIM = mkIM(new THREE.BoxGeometry(2.4, 1.2, 1.2), MAT.stone, 2, true);
    const plateIM2 = mkIM(new THREE.BoxGeometry(1.4, 0.2, 1.4), MAT.bronze, 2, false);
    const cranesG = new THREE.Group();
    root.add(cranesG);
    cranesG.add(craneIM, ropeIM, sillarIM, plateIM2);
    // posiciones: 0-1 pedestal (suelo), 2-3 cima del terraplén
    const CR = [
      { kind: 'ped', a: 0.9, r: 17, yaw: 0.9 + Math.PI * 0.5 },
      { kind: 'ped', a: 3.9, r: 17, yaw: 3.9 + Math.PI * 0.5 },
      { kind: 'top', a: 2.0, r: 0, yaw: 0 },
      { kind: 'top', a: 5.0, r: 0, yaw: 0 }
    ];
    const _cr = new THREE.Matrix4(), _crq = new THREE.Quaternion();
    function updateCranes(s) {
      const W = s.wall, pd = clamp(s.pedestal, 0, 1), m = clamp(s.mound, 0, 1);
      const pedOn = s.pedestal > 0.002 && s.pedestal < 1.0001;
      cranesG.visible = pedOn || (m > 0.3 && MD.ytop > 0);
      if (!cranesG.visible) return;
      for (let k = 0; k < 4; k++) {
        const C = CR[k];
        const isTop = C.kind === 'top';
        const on = isTop ? (m > 0.3 && MD.ytop > 0) : pedOn;
        // base: suelo (pedestal) o cima del terraplén
        const baseY = isTop ? (MD.ytop || 15) : 0;
        const rr = isTop ? innerR(MD.ytop || 15) + 4 : C.r;
        const bx = Math.cos(C.a) * rr, bz = Math.sin(C.a) * rr;
        const yaw = C.yaw + 0.25 * Math.sin(W * 0.3 + k);
        const sy = isTop ? 0.7 : 1.0;
        _p3.set(on ? bx : 0, on ? baseY : -60, on ? bz : 0);
        _q4.setFromEuler(_e3.set(0, -yaw, 0, 'XYZ'));
        _cr.compose(_p3, _q4, _s3.set(1, sy, 1));
        craneIM.setMatrixAt(k, _cr);
        // punta de la pluma en mundo
        const tipX = bx + Math.cos(-yaw) * 9.4 * 1.0, tipZ = bz + Math.sin(-yaw) * 9.4;
        const jibY = baseY + (CRANE_H - 0.6) * sy;
        // bloque (pedestal) o placa (cima) colgado de la pluma
        const hookY = isTop ? baseY + 4.5 : Math.max(baseY + 3, 2 + pd * 14 + 0.6);
        const ropeLen = Math.max(0.2, jibY - hookY);
        _p3.set(tipX, (jibY + hookY) / 2, tipZ);
        _q4.setFromEuler(_e3.set(0, -yaw, 0, 'XYZ'));
        _cr.compose(_p3, _q4, _s3.set(1, ropeLen, 1));
        ropeIM.setMatrixAt(k, _cr);
        if (!isTop) {
          const idx = k;
          _p3.set(tipX, hookY, tipZ);
          _cr.compose(_p3, _q4, _s3.set(on ? 1 : 0, on ? 1 : 0, on ? 1 : 0));
          sillarIM.setMatrixAt(idx, _cr);
        } else {
          _p3.set(tipX, hookY, tipZ);
          _cr.compose(_p3, _q4, _s3.set(on ? 1 : 0, on ? 1 : 0, on ? 1 : 0));
          plateIM2.setMatrixAt(k - 2, _cr);
        }
      }
      craneIM.instanceMatrix.needsUpdate = true;
      ropeIM.instanceMatrix.needsUpdate = true;
      sillarIM.instanceMatrix.needsUpdate = true;
      plateIM2.instanceMatrix.needsUpdate = true;
    }

    // =====================================================================
    // 9. CARAVANA DE CAMELLOS (654 d.C.) por SITE.caravan. 60 camellos = 900 (representación),
    //    a 1.5x, en fila, con fardos de bronce brillante y arrieros. Posición en función de s.t.
    //    El primer camello pasa por (120,250) hacia t=227 (fracción de ruta 0.302).
    // =====================================================================
    const NCM = 60, CARAVAN_LEAD_F = 0.302, CAMEL_SPACING_F = 0.0026;
    const camelRoute = new THREE.CatmullRomCurve3(SITE.caravan.map(function (p) { return new THREE.Vector3(p[0], 0, p[1]); }), false, 'catmullrom');
    camelRoute.arcLengthDivisions = 400;
    const camelBodyMB = MB();
    const cCam = new THREE.Color(0xc6a06a), cCamD = new THREE.Color(0x8a6440);
    mbBox(camelBodyMB, 0, 1.6, 0, 1.0, 1.1, 2.2, cCam);
    mbBox(camelBodyMB, 0, 2.3, 0.2, 0.8, 0.6, 0.8, cCam);                  // joroba
    mbBox(camelBodyMB, 0, 2.1, 1.1, 0.35, 1.0, 0.35, cCam, 0, 0.5);       // cuello
    mbBox(camelBodyMB, 0, 2.6, 1.6, 0.4, 0.4, 0.6, cCamD);                // cabeza
    const camelBodyIM = mkIM(mbGeo(camelBodyMB), MAT.camel, NCM, true);
    const camelLegIM = mkIM(new THREE.BoxGeometry(0.25, 1.2, 0.25), MAT.camelD, NCM * 4, true);
    const camelLoadIM = mkIM(new THREE.BoxGeometry(0.9, 0.7, 0.8), MAT.bronzeShine, NCM * 2, true);
    const NDRV = 20;   // arrieros: uno de cada tres camellos
    const drvTorsoIM = mkIM(new THREE.BoxGeometry(0.42, 0.7, 0.26), MAT.cloth, NDRV, true);
    const drvHeadIM = mkIM(new THREE.SphereGeometry(0.17, 6, 4), MAT.skin, NDRV, false);
    const camelsG = new THREE.Group();
    root.add(camelsG);
    camelsG.add(camelBodyIM, camelLegIM, camelLoadIM, drvTorsoIM, drvHeadIM);
    const CAM = [];
    for (let i = 0; i < NCM; i++) CAM.push({ off: i * CAMEL_SPACING_F, ph: hash(i + 910) });
    const _cmM = new THREE.Matrix4(), _rr4 = new THREE.Matrix4();
    const _cdir = new THREE.Vector3(), _cpos = new THREE.Vector3();
    function updateCamels(s) {
      const A = clamp(s.camels, 0, 1);
      camelsG.visible = A > 0.002;
      if (!camelsG.visible) return;
      let nd = 0;
      for (let i = 0; i < NCM; i++) {
        const C = CAM[i];
        // progreso en fila: el primero pasa por (120,250) en t=227 y llega al final hacia t=237
        const q = clamp(CARAVAN_LEAD_F * (s.t - 223) / 4 - C.off, 0, 1);
        camelRoute.getPointAt(q, _cpos);
        camelRoute.getTangentAt(q, _cdir);
        const hd = Math.atan2(_cdir.x, _cdir.z);
        const vis = A * (q > 0.001 && q < 0.999 ? 1 : 0);
        const cs = vis * 1.5;                       // camellos a 1.5x
        _s3.set(cs, cs, cs);
        _q4.setFromEuler(_e3.set(0, hd, 0, 'YXZ'));
        _cmM.compose(_cpos.clone().setY(0), _q4, _s3);
        camelBodyIM.setMatrixAt(i, _cmM);
        const step = Math.sin(s.wall * 3.2 + C.ph * TAU);
        for (let L = 0; L < 4; L++) {
          const lx = (L % 2 ? 0.35 : -0.35), lz = (L < 2 ? 0.8 : -0.8);
          const sw = (L % 3 === 0 ? 1 : -1) * 0.35 * step;
          _t4.makeTranslation(lx, 0.6, lz);
          _rr4.makeRotationX(sw);
          _lm.copy(_cmM).multiply(_t4).multiply(_rr4);
          camelLegIM.setMatrixAt(i * 4 + L, _lm);
        }
        // fardos de bronce brillante, uno a cada lado de la joroba
        for (let L = 0; L < 2; L++) {
          _t4.makeTranslation(L ? 0.55 : -0.55, 3.0, -0.2);
          _lm.copy(_cmM).multiply(_t4);
          camelLoadIM.setMatrixAt(i * 2 + L, _lm);
        }
        // arriero sobre cada tercer camello
        if (i % 3 === 0) {
          _t4.makeTranslation(0, 3.2, -0.3);
          _lm.copy(_cmM).multiply(_t4);
          drvTorsoIM.setMatrixAt(nd, _lm);
          _t4.makeTranslation(0, 3.95, -0.3);
          _lm.copy(_cmM).multiply(_t4);
          drvHeadIM.setMatrixAt(nd, _lm);
          nd++;
        }
      }
      camelBodyIM.instanceMatrix.needsUpdate = true;
      camelLegIM.instanceMatrix.needsUpdate = true;
      camelLoadIM.instanceMatrix.needsUpdate = true;
      drvTorsoIM.instanceMatrix.needsUpdate = true;
      drvHeadIM.instanceMatrix.needsUpdate = true;
    }

    // =====================================================================
    // Bucle por frame
    // =====================================================================
    function update(s) {
      const a = clamp(s.siege, 0, 1);
      heleG.visible = a > 0.002;
      fleetG.visible = a > 0.002;
      if (a > 0.002) updateFleet(s);
      updatePile(s);
      updateFoundry(s);
      updateBoats(s);
      updateMound(s);
      updatePour(s);
      updateCranes(s);
      updateWorkers(s);
      updateCamels(s);
    }

    return { update: update, group: root };
  };
})();
