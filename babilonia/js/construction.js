// Obra de Babilonia: ladrillar (hornos abovedados, moldes, campos de secado, ladrillo con sello),
// calderos de betún, barcas de juncos y guffas en el Éufrates, obreros, rampa en zigzag con
// andamios y la excavación de Koldewey. Todo procedural; función pura del estado s (t, wall y pistas).
(function () {
  'use strict';
  const G = window.GIZA;

  G.createConstruction = function (ctx) {
    const THREE = ctx.THREE, scene = ctx.scene, renderer = ctx.renderer;
    const root = new THREE.Group();
    scene.add(root);

    const SITE = G.SITE, GARD = G.GARDENS;
    const TAU = Math.PI * 2;
    const WATER_Y = SITE.river.waterY;
    const TIERS = GARD.tiers;                      // [yBase, yTop, semilado]
    const TH = TIERS.map(function (T) { return T[2]; });
    renderer.localClippingEnabled = true;

    // ---------- utilidades ----------
    function hash(n) { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
    function clamp(x, a, b) { return x < a ? a : (x > b ? b : x); }
    function frac(x) { return x - Math.floor(x); }
    function sstep(x) { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); }
    function tri(x) { return 1 - Math.abs(2 * frac(x) - 1); }     // ida y vuelta 0..1..0
    const UP = new THREE.Vector3(0, 1, 0);
    const IMS = [];                                                  // instanced meshes (para needsUpdate)

    // ---------- texturas dibujadas por código ----------
    function canvasTex(w, h, draw) {
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      draw(cv.getContext('2d'), w, h);
      const tex = new THREE.CanvasTexture(cv);
      tex.encoding = THREE.sRGBEncoding;
      return tex;
    }
    const glowTex = canvasTex(128, 128, function (g) {
      const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      gr.addColorStop(0, 'rgba(255,200,120,1)'); gr.addColorStop(0.3, 'rgba(255,120,40,0.6)'); gr.addColorStop(1, 'rgba(255,80,20,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    });
    const softTex = canvasTex(64, 64, function (g) {
      const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, 'rgba(255,255,255,0.85)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    });
    // cuña de escritura cuneiforme: triángulo alargado desde (x,y)
    function wedge(g, x, y, ang, len, w) {
      const dx = Math.cos(ang), dy = Math.sin(ang), px = -dy * w, py = dx * w;
      g.beginPath();
      g.moveTo(x + px, y + py); g.lineTo(x - px, y - py); g.lineTo(x + dx * len, y + dy * len);
      g.closePath(); g.fill();
    }
    // sello del rey: campo de signos cuneiformes con marco; el resto del ladrillo muestrea una franja lisa
    const sealTex = canvasTex(512, 512, function (g, W, H) {
      g.fillStyle = '#d6a66c'; g.fillRect(0, 0, W, H);
      g.strokeStyle = '#4a2a12'; g.lineWidth = 14; g.strokeRect(78, 78, W - 156, H - 156);
      g.lineWidth = 6; g.strokeRect(98, 98, W - 196, H - 196);
      g.fillStyle = '#2a160a';
      const angs = [0, Math.PI / 2, Math.PI / 4, -Math.PI / 5, Math.PI];
      for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) {
        const cx = 150 + c * 70, cy = 160 + r * 84, seed = r * 11 + c * 5 + 1;
        const nw = 2 + Math.floor(hash(seed) * 3);
        for (let k = 0; k < nw; k++) {
          const ang = angs[Math.floor(hash(seed + k * 3 + 7) * angs.length)];
          wedge(g, cx - 22 + hash(seed + k + 20) * 16, cy - 26 + k * 17 + hash(seed + k + 40) * 4, ang, 36 + hash(seed + k + 50) * 8, 7.5);
        }
      }
    });

    // ---------- materiales ----------
    // cielo degradado para reflejos del betún y del bronce (PMREM)
    let envTex = null;
    try {
      const es = new THREE.Scene();
      const eg = new THREE.SphereGeometry(200, 24, 12);
      const pos = eg.attributes.position, cols = [];
      const top = new THREE.Color(0xe8eef5), hor = new THREE.Color(0xd9b98a), bot = new THREE.Color(0x3b2e22);
      for (let i = 0; i < pos.count; i++) {
        const y = pos.getY(i) / 200;
        const c = y > 0 ? hor.clone().lerp(top, Math.min(1, y * 1.6)) : hor.clone().lerp(bot, Math.min(1, -y * 2.5));
        cols.push(c.r, c.g, c.b);
      }
      eg.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
      es.add(new THREE.Mesh(eg, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
      const pm = new THREE.PMREMGenerator(renderer);
      envTex = pm.fromScene(es, 0.02).texture;
      pm.dispose(); eg.dispose();
    } catch (e) { envTex = null; }

    const MAT = {
      adobe:  new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }),
      woodVC: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true, side: THREE.DoubleSide }),
      reed:   new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, side: THREE.DoubleSide }),
      ramp:   new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true, side: THREE.DoubleSide }),
      ironVC: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.7, envMap: envTex, side: THREE.DoubleSide }),
      pith:   new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, flatShading: true }),
      brick:  new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, flatShading: true }),
      seal:   new THREE.MeshStandardMaterial({ map: sealTex, roughness: 0.95 }),
      wicker: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, side: THREE.DoubleSide }),
      wood:   new THREE.MeshStandardMaterial({ color: 0x7a5230, roughness: 0.9 }),
      skin:   new THREE.MeshStandardMaterial({ color: 0x8c5a3a, roughness: 0.8, flatShading: true }),
      skirt:  new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, flatShading: true }),
      hair:   new THREE.MeshStandardMaterial({ color: 0x1e1612, roughness: 0.9, flatShading: true }),
      iron:   new THREE.MeshStandardMaterial({ color: 0x3a3836, roughness: 0.35, metalness: 0.6, envMap: envTex }),
      bitumen:new THREE.MeshStandardMaterial({ color: 0x0c0a08, roughness: 0.12, metalness: 0.15, envMap: envTex, envMapIntensity: 1.2 }),
      fire:   new THREE.MeshBasicMaterial({ color: 0xd9561c, side: THREE.DoubleSide }),
      flame:  new THREE.MeshBasicMaterial({ color: 0xe0701f, transparent: true, opacity: 0.85 }),
      glow:   new THREE.PointsMaterial({ map: glowTex, color: 0xffa460, size: 7, sizeAttenuation: true, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }),
      glowB:  new THREE.PointsMaterial({ map: glowTex, color: 0xff8a40, size: 4, sizeAttenuation: true, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }),
      smoke:  new THREE.PointsMaterial({ map: softTex, color: 0xd6cfc2, size: 5, sizeAttenuation: true, transparent: true, opacity: 0.32, depthWrite: false }),
      smokeD: new THREE.PointsMaterial({ map: softTex, color: 0x2a2520, size: 3.2, sizeAttenuation: true, transparent: true, opacity: 0.4, depthWrite: false })
    };

    // ---------- geometría fusionada con colores de vértice ----------
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
    function mbBox(mb, x, y, z, sx, sy, sz, c, ry) {
      const g = new THREE.BoxGeometry(sx, sy, sz);
      if (ry) g.rotateY(ry);
      g.translate(x, y, z);
      mbAppend(mb, g, c);
    }
    function mbCyl(mb, x, y0, z, r0, r1, h, c, seg) {
      const g = new THREE.CylinderGeometry(r0, r1, h, seg || 8);
      g.translate(x, y0 + h / 2, z);
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
    // barra orientada de A a B (ancho horizontal, grosor hacia arriba; su cara superior pasa por la línea A-B)
    function mbSlab(mb, A, B, width, thick, c) {
      const dx = B[0] - A[0], dy = B[1] - A[1], dz = B[2] - A[2];
      const L = Math.hypot(dx, dy, dz) || 1e-6;
      const d = new THREE.Vector3(dx / L, dy / L, dz / L);
      const w = new THREE.Vector3().crossVectors(UP, d).normalize();
      const y = new THREE.Vector3().crossVectors(d, w).normalize();
      if (y.y < 0) { w.negate(); y.negate(); }
      const g = new THREE.BoxGeometry(width, thick, L);
      const m = new THREE.Matrix4().makeBasis(w, y, d);
      m.setPosition((A[0] + B[0]) / 2 - y.x * thick / 2, (A[1] + B[1]) / 2 - y.y * thick / 2, (A[2] + B[2]) / 2 - y.z * thick / 2);
      g.applyMatrix4(m);
      mbAppend(mb, g, c);
    }
    function mbGeo(mb) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(mb.p, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(mb.n, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(mb.c, 3));
      g.setIndex(mb.i);
      return g;
    }
    function tentMB(mb, cx, cz, col) {
      const A = [cx, 2.2, cz];
      const C = [[cx - 1.7, 0, cz - 1.3], [cx + 1.7, 0, cz - 1.3], [cx + 1.7, 0, cz + 1.3], [cx - 1.7, 0, cz + 1.3]];
      for (let k = 0; k < 4; k++) mbTri(mb, C[k], C[(k + 1) % 4], A, col, [cx, 0.8, cz]);
    }
    function moundMB(mb, cx, cz, rx, rz, h, col) {
      const C = [[cx - rx, 0, cz - rz], [cx + rx, 0, cz - rz], [cx + rx, 0, cz + rz], [cx - rx, 0, cz + rz]];
      const A = [cx, h, cz];
      for (let k = 0; k < 4; k++) mbTri(mb, C[k], C[(k + 1) % 4], A, col, [cx, h * 0.3, cz]);
    }
    // casco por secciones: eslora en Z, sección semielíptica; los extremos suben (junco) o es redondo (guffa)
    function hullGeo(L, Wd, Hd, rise, base, seed) {
      const N = 16, M = 8, pos = [], col = [], idx = [];
      const cA = new THREE.Color(base), cB = new THREE.Color(0x8a6b3e);
      for (let i = 0; i <= N; i++) {
        const u = i / N, e = Math.sin(Math.PI * u);
        const hw = Wd / 2 * Math.pow(e, 0.6);
        const top = 0.35 + rise * Math.pow(Math.abs(2 * u - 1), 2.2);
        const dep = Hd * Math.pow(e, 0.45);
        for (let j = 0; j <= M; j++) {
          const a = Math.PI * j / M;
          pos.push(hw * Math.cos(a), top - dep * Math.sin(a), (u - 0.5) * L);
          const k = clamp(hash(seed + i * 3.1 + j * 1.7) * 0.3 + (i % 2 ? 0.12 : 0), 0, 1);
          const c = cA.clone().lerp(cB, k);
          col.push(c.r, c.g, c.b);
        }
      }
      for (let i = 0; i < N; i++) for (let j = 0; j < M; j++) {
        const a = i * (M + 1) + j, b = a + 1, c = a + (M + 1), d = c + 1;
        idx.push(a, c, d, a, d, b);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      g.setIndex(idx); g.computeVertexNormals();
      return g;
    }
    function instMesh(geo, mat, n) {
      const im = new THREE.InstancedMesh(geo, mat, n);
      im.frustumCulled = false;
      IMS.push(im);
      return im;
    }

    // ---------- helpers de instancias ----------
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

    // =====================================================================
    // 1. LADRILLAR (SITE.brickyard): hornos, moldes, campos de secado, ladrillo con sello
    // =====================================================================
    const BX = SITE.brickyard.x, BZ = SITE.brickyard.z;     // (0, -140)
    const KZ = BZ + 16;                                      // fila de hornos
    const KX = [BX - 18, BX - 6, BX + 6, BX + 18];
    const TX1 = BX - 20, TX2 = BX - 30, TZ = BZ + 4;         // mesas de moldeado

    const yardG = new THREE.Group(); root.add(yardG);
    const yardMB = MB();
    const cAdobe = new THREE.Color(0xc9a477), cAdobeD = new THREE.Color(0xa9824f), cDark = new THREE.Color(0x2a1a10),
      cWood = new THREE.Color(0x7a5230), cWoodL = new THREE.Color(0x9c6e3f), cClay = new THREE.Color(0xb88a5e),
      cSoil = new THREE.Color(0x4a3420), cSpoil = new THREE.Color(0x9a7a50), cCanvas = new THREE.Color(0xf1e6cc),
      cBrick = new THREE.Color(0xb8794a), cIron = new THREE.Color(0x3a3836), cCane = new THREE.Color(0xc8a86a),
      cPalm = new THREE.Color(0x8a6a44);

    // mesa de moldeado con moldes de madera y barro
    function moldTable(tx, tz) {
      mbBox(yardMB, tx, 0.84, tz, 6.4, 0.12, 1.3, cWoodL);
      [[-2.9, -0.5], [2.9, -0.5], [-2.9, 0.5], [2.9, 0.5]].forEach(function (p) { mbBox(yardMB, tx + p[0], 0.4, tz + p[1], 0.14, 0.8, 0.14, cWood); });
      for (let k = -1; k <= 1; k++) {
        const mx = tx + k * 2.2, s = 0.5;
        mbBox(yardMB, mx, 0.92, tz - s / 2, s + 0.16, 0.14, 0.08, cWood);
        mbBox(yardMB, mx, 0.92, tz + s / 2, s + 0.16, 0.14, 0.08, cWood);
        mbBox(yardMB, mx - s / 2, 0.92, tz, 0.08, 0.14, s, cWood);
        mbBox(yardMB, mx + s / 2, 0.92, tz, 0.08, 0.14, s, cWood);
        mbBox(yardMB, mx, 0.9, tz, s, 0.1, s, cClay);
      }
      mbBox(yardMB, tx - 3.6, 0.95, tz + 0.1, 1.2, 0.3, 0.9, cClay);
      mbBox(yardMB, tx + 3.6, 0.95, tz - 0.1, 1.2, 0.3, 0.9, cClay);
    }
    moldTable(TX1, TZ);
    moldTable(TX2, TZ);

    // hornos abovedados de adobe con boca de fuego
    KX.forEach(function (kx) {
      mbCyl(yardMB, kx, 0, KZ, 3.7, 3.7, 0.6, cAdobeD, 14);
      mbCyl(yardMB, kx, 0.6, KZ, 3.3, 3.3, 1.8, cAdobe, 14);
      const dome = new THREE.SphereGeometry(3.3, 14, 8, 0, TAU, 0, Math.PI / 2);
      dome.translate(kx, 2.4, KZ);
      mbAppend(yardMB, dome, cAdobe);
      mbCyl(yardMB, kx, 5.5, KZ, 0.7, 0.8, 0.25, cDark, 10);       // boca de humo
      mbBox(yardMB, kx, 0.8, KZ - 3.33, 1.7, 1.6, 0.2, cDark);     // boca de fuego (oscura)
      // leña apilada junto al horno
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
        mbBox(yardMB, kx + 5.9, 0.22 + r * 0.3, KZ + 0.6 + c * 0.42, 2.4, 0.26, 0.26, cWood);
      }
    });

    // mojones y muros bajos de los campos de secado (límites de adobe)
    mbBox(yardMB, BX - 31.5, 0.12, BZ - 5.5, 0.6, 0.24, 20, cAdobeD);
    mbBox(yardMB, BX + 27.5, 0.12, BZ - 6, 0.6, 0.24, 14, cAdobeD);

    // cestas de caña de la zona (estáticas)
    const yardBasketPos = [[BX - 27, BZ + 17], [BX - 25, BZ + 17], [BX - 23, BZ + 17], [BX - 27, BZ + 19], [BX - 25, BZ + 19], [BX - 23, BZ + 19]];

    const yardStatic = new THREE.Mesh(mbGeo(yardMB), MAT.adobe);
    yardStatic.castShadow = true; yardStatic.receiveShadow = true; yardStatic.frustumCulled = false;
    yardG.add(yardStatic);

    // ladrillos crudos (campos de secado) y cocidos (pilas): un solo InstancedMesh
    const brickGeo = new THREE.BoxGeometry(0.36, 0.1, 0.36);
    const brickXf = [], brickCol = [];
    function addBrick(x, y, z, ry, hex) { brickXf.push([x, y, z, ry]); brickCol.push(hex); }
    const RAW = [0xd7b78a, 0xcfa978, 0xdcc096, 0xc89d6c], FIRED = [0xb8794a, 0xa4643c, 0xc98a5a, 0x9c5a36];
    // campo A (oeste, entre mesas y el canal de paso)
    for (let i = 0; i < 52; i++) for (let j = 0; j < 21; j++) {
      addBrick(BX - 33.8 + i * 0.42, 0.05, BZ - 9.8 + j * 0.42, (hash(i * 31 + j * 7) - 0.5) * 0.25, RAW[(i + j) % 4]);
    }
    // campo B (al norte de la zona de hornos)
    for (let i = 0; i < 74; i++) for (let j = 0; j < 14; j++) {
      addBrick(BX - 5.8 + i * 0.42, 0.05, BZ - 5.8 + j * 0.42, (hash(i * 17 + j * 3 + 5) - 0.5) * 0.25, RAW[(i * 2 + j) % 4]);
    }
    // pilas de ladrillo cocido
    [[BX + 27, BZ - 6], [BX + 31, BZ + 2], [BX + 27, BZ + 9]].forEach(function (st, si) {
      for (let l = 0; l < 4; l++) for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) {
        addBrick(st[0] + (i - 1.5) * 0.4, 0.05 + l * 0.1, st[1] + (j - 1) * 0.4, (l % 2) * Math.PI / 2, FIRED[(si + i + j) % 4]);
      }
    });
    const brickIM = instMesh(brickGeo, MAT.brick, brickXf.length);
    brickXf.forEach(function (b, i) { setInst(brickIM, i, b[0], b[1], b[2], b[3]); brickIM.setColorAt(i, _c3.setHex(brickCol[i])); });
    brickIM.instanceMatrix.needsUpdate = true; brickIM.instanceColor.needsUpdate = true;
    yardG.add(brickIM);

    // ladrillo grande en primer plano con el sello cuneiforme del rey (solo la cara superior lleva el sello)
    const sealGeo = new THREE.BoxGeometry(1.3, 0.28, 1.3);
    {
      const uv = sealGeo.attributes.uv, nrm = sealGeo.attributes.normal;
      for (let i = 0; i < uv.count; i++) if (nrm.getY(i) < 0.5) uv.setXY(i, 0.03, 0.03);
      uv.needsUpdate = true;
    }
    const sealBrick = new THREE.Mesh(sealGeo, MAT.seal);
    sealBrick.position.set(BX + 12, 0.14, BZ - 10); sealBrick.rotation.y = 0.2;
    sealBrick.castShadow = true; sealBrick.receiveShadow = true; sealBrick.frustumCulled = false;
    yardG.add(sealBrick);

    // bocas de fuego y resplandor
    const fireGeo = new THREE.PlaneGeometry(1.1, 1.2).rotateY(Math.PI);
    const fireIM = instMesh(fireGeo, MAT.fire, 4);
    yardG.add(fireIM);
    const kilnGlowGeo = new THREE.BufferGeometry();
    const kilnGlowPos = new Float32Array(4 * 3);
    KX.forEach(function (kx, k) { kilnGlowPos[k * 3] = kx; kilnGlowPos[k * 3 + 1] = 1.1; kilnGlowPos[k * 3 + 2] = KZ - 4.2; });
    kilnGlowGeo.setAttribute('position', new THREE.BufferAttribute(kilnGlowPos, 3));
    const kilnGlow = new THREE.Points(kilnGlowGeo, MAT.glow);
    kilnGlow.frustumCulled = false;
    yardG.add(kilnGlow);

    // humo de los hornos
    const NSM = 90, kSmokePos = new Float32Array(NSM * 3), kA = [], kB = [], kC = [];
    for (let i = 0; i < NSM; i++) { kA.push(hash(i + 1000)); kB.push(hash(i + 1100)); kC.push(hash(i + 1200)); }
    const kSmokeGeo = new THREE.BufferGeometry();
    kSmokeGeo.setAttribute('position', new THREE.BufferAttribute(kSmokePos, 3));
    const kilnSmoke = new THREE.Points(kSmokeGeo, MAT.smoke);
    kilnSmoke.frustumCulled = false;
    yardG.add(kilnSmoke);

    // ---------- obreros del ladrillar y del resto (poses de giza) ----------
    const NW = 110;
    const workersG = new THREE.Group(); root.add(workersG);
    const headIM = instMesh(new THREE.SphereGeometry(1, 7, 5), MAT.skin, NW);
    const hairIM = instMesh(new THREE.BoxGeometry(1, 1, 1), MAT.hair, NW);
    const torsoIM = instMesh(new THREE.BoxGeometry(1, 1, 1), MAT.skin, NW);
    const skirtIM = instMesh(new THREE.CylinderGeometry(0.5, 0.6, 1, 7), MAT.skirt, NW);
    const legIM = instMesh(new THREE.BoxGeometry(1, 1, 1), MAT.skin, NW * 2);
    const armIM = instMesh(new THREE.BoxGeometry(1, 1, 1), MAT.skin, NW * 2);
    const stickIM = instMesh(new THREE.BoxGeometry(1, 1, 1), MAT.wood, NW);
    const malletIM = instMesh(new THREE.BoxGeometry(1, 1, 1), MAT.iron, NW);
    const helmMB = MB();
    mbAppend(helmMB, new THREE.SphereGeometry(1, 10, 5, 0, TAU, 0, Math.PI / 2), cCanvas);
    { const br = new THREE.CylinderGeometry(1.8, 1.8, 0.12, 12); br.translate(0, 0.02, 0); mbAppend(helmMB, br, cCanvas); }
    const helmIM = instMesh(mbGeo(helmMB), MAT.pith, NW);
    const WIMS = [headIM, hairIM, torsoIM, skirtIM, legIM, armIM, stickIM, malletIM, helmIM];
    WIMS.forEach(function (im) { workersG.add(im); });
    torsoIM.castShadow = true; legIM.castShadow = true; headIM.castShadow = true;
    const tunic = [0xe9dcc0, 0xc9b28a, 0x4f6f98, 0x9b3d2e, 0xd9c08a, 0x7f9a62, 0xb5d0e0, 0xf1e6cc];
    for (let i = 0; i < NW; i++) {
      skirtIM.setColorAt(i, _c3.setHex(tunic[Math.floor(hash(i * 3 + 9) * tunic.length)]));
      hairIM.setColorAt(i, _c3.setHex(hash(i * 5 + 2) < 0.2 ? 0x8a7a6a : 0x1e1612));
    }
    skirtIM.instanceColor.needsUpdate = true; hairIM.instanceColor.needsUpdate = true;

    const _rootM = new THREE.Matrix4(), _rq = new THREE.Quaternion(), _rp = new THREE.Vector3(), _rs = new THREE.Vector3();
    const _yAxis = new THREE.Vector3(0, 1, 0);
    const _W1 = new THREE.Matrix4(), _W2 = new THREE.Matrix4(), _W3 = new THREE.Matrix4(), _E4 = new THREE.Euler();
    function setRoot(x, y, z, hd, a) {
      _rp.set(x, y, z); _rq.setFromAxisAngle(_yAxis, hd); _rs.set(a, a, a);
      _rootM.compose(_rp, _rq, _rs);
    }
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
    const PS = { ll: 0, lr: 0, al: 0, ar: 0, lean: 0, cut: false, stick: false, staff: false, helmet: false };
    function pose(ll, lr, al, ar, lean, cut, stick, helmet, staff) {
      PS.ll = ll; PS.lr = lr; PS.al = al; PS.ar = ar; PS.lean = lean;
      PS.cut = !!cut; PS.stick = !!stick; PS.helmet = !!helmet; PS.staff = !!staff;
    }
    function drawWorker(i) {
      placeW(torsoIM, i, 0, 1.25, 0, PS.lean, 0, 0, 0, 0, 0.42, 0.66, 0.24);
      placeW(headIM, i, 0, 1.25, 0, PS.lean, 0, 0, 0.43, 0, 0.14, 0.14, 0.14);
      placeW(hairIM, i, 0, 1.25, 0, PS.lean, 0, 0, 0.52, -0.01, 0.36, 0.16, 0.36);
      placeW(skirtIM, i, 0, 0.9, 0, 0, 0, 0, 0, 0, 0.6, 0.32, 0.6);
      placeW(legIM, 2 * i, -0.11, 0.9, 0, PS.ll, 0, 0, -0.45, 0, 0.19, 0.9, 0.2);
      placeW(legIM, 2 * i + 1, 0.11, 0.9, 0, PS.lr, 0, 0, -0.45, 0, 0.19, 0.9, 0.2);
      placeW(armIM, 2 * i, -0.27, 1.5, 0, PS.al, 0, 0, -0.33, 0, 0.13, 0.66, 0.13);
      placeW(armIM, 2 * i + 1, 0.27, 1.5, 0, PS.ar, 0, 0, -0.33, 0, 0.13, 0.66, 0.13);
      const st = PS.stick ? 1 : 0;
      placeW(stickIM, i, 0.27, 1.5, 0, PS.ar, 0, 0, -0.45, 0, 0.05 * st, (PS.staff ? 1.5 : 0.9) * st, 0.05 * st);
      const cs = PS.cut ? 1 : 0;
      placeW(malletIM, i, 0.27, 1.5, 0, PS.ar, 0, 0, -0.92, 0, 0.16 * cs, 0.14 * cs, 0.24 * cs);
      const hs = PS.helmet ? 0.2 : 0;
      placeW(helmIM, i, 0, 1.25, 0, PS.lean, 0, 0, 0.56, 0, hs, hs, hs);
    }
    function worker(i, x, y, z, hd, a) { setRoot(x, y, z, hd, a); drawWorker(i); }

    // ---------- cestas (carga de ladrillo y betún) ----------
    const basketGeo = new THREE.CylinderGeometry(0.3, 0.22, 0.32, 10, 1, true);
    basketGeo.translate(0, 0.16, 0);
    const NBK = 42;
    const basketIM = instMesh(basketGeo, MAT.wicker, NBK);
    for (let i = 0; i < NBK; i++) basketIM.setColorAt(i, _c3.setHex(i < 24 ? 0xd2b07a : 0xc4a06a));
    basketIM.instanceColor.needsUpdate = true;
    root.add(basketIM);
    const bitBasketPos = [[SITE.bitumen.x - 14, SITE.bitumen.z - 6], [SITE.bitumen.x - 11, SITE.bitumen.z - 7], [SITE.bitumen.x - 8, SITE.bitumen.z - 6],
      [SITE.bitumen.x + 9, SITE.bitumen.z - 8], [SITE.bitumen.x + 12, SITE.bitumen.z - 7], [SITE.bitumen.x + 15, SITE.bitumen.z - 8]];

    // =====================================================================
    // 2. BETÚN (SITE.bitumen): calderos sobre hogares, betún negro, humo
    // =====================================================================
    const bitG = new THREE.Group(); root.add(bitG);
    const HX = [-72, -64, -56, -48], HZ = SITE.bitumen.z;
    const bitMB = MB(), cauldronMB = MB();
    HX.forEach(function (hx) {
      mbBox(bitMB, hx, 0.45, HZ, 3.2, 0.9, 3.2, cAdobe);             // hogar de adobe
      mbBox(bitMB, hx, 0.3, HZ + 1.65, 1.3, 0.55, 0.2, cDark);       // boca del fuego
      const cg = new THREE.CylinderGeometry(1.5, 1.3, 1.1, 16, 1, true);
      cg.translate(hx, 1.45, HZ);
      mbAppend(cauldronMB, cg, cIron);
      const rim = new THREE.TorusGeometry(1.5, 0.07, 6, 18).rotateX(Math.PI / 2);
      rim.translate(hx, 2.0, HZ);
      mbAppend(cauldronMB, rim, cIron);
    });
    const bitStatic = new THREE.Mesh(mbGeo(bitMB), MAT.adobe);
    bitStatic.castShadow = true; bitStatic.receiveShadow = true; bitStatic.frustumCulled = false;
    const cauldrons = new THREE.Mesh(mbGeo(cauldronMB), MAT.ironVC);
    cauldrons.castShadow = true; cauldrons.frustumCulled = false;
    bitG.add(bitStatic, cauldrons);
    const discIM = instMesh(new THREE.CircleGeometry(1.36, 20).rotateX(-Math.PI / 2), MAT.bitumen, 4);
    bitG.add(discIM);
    HX.forEach(function (hx, k) { setInst(discIM, k, hx, 1.86, HZ, 0, 1); });
    discIM.instanceMatrix.needsUpdate = true;
    const bubbleIM = instMesh(new THREE.SphereGeometry(0.12, 8, 6), MAT.bitumen, 24);
    bitG.add(bubbleIM);
    const flameIM = instMesh(new THREE.ConeGeometry(0.35, 0.9, 6).translate(0, 0.45, 0), MAT.flame, 4);
    bitG.add(flameIM);
    const bitGlowPos = new Float32Array(4 * 3);
    HX.forEach(function (hx, k) { bitGlowPos[k * 3] = hx; bitGlowPos[k * 3 + 1] = 1.0; bitGlowPos[k * 3 + 2] = HZ + 2.0; });
    const bitGlowGeo = new THREE.BufferGeometry();
    bitGlowGeo.setAttribute('position', new THREE.BufferAttribute(bitGlowPos, 3));
    const bitGlow = new THREE.Points(bitGlowGeo, MAT.glowB);
    bitGlow.frustumCulled = false;
    bitG.add(bitGlow);
    const NBS = 60, bSmokePos = new Float32Array(NBS * 3), bA = [], bB = [];
    for (let i = 0; i < NBS; i++) { bA.push(hash(i + 2000)); bB.push(hash(i + 2100)); }
    const bSmokeGeo = new THREE.BufferGeometry();
    bSmokeGeo.setAttribute('position', new THREE.BufferAttribute(bSmokePos, 3));
    const bitSmoke = new THREE.Points(bSmokeGeo, MAT.smokeD);
    bitSmoke.frustumCulled = false;
    bitG.add(bitSmoke);

    // =====================================================================
    // 3. BARCAS EN EL ÉUFRATES (x ≈ -190) y pequeño muelle
    // =====================================================================
    const boatsG = new THREE.Group(); root.add(boatsG);
    const RIVER_X = SITE.river.x, LZ = 360, RZ_A = -200;
    const juncoGeo = hullGeo(11, 2.4, 0.65, 1.1, 0xb9a06a, 11);
    const guffaGeo = hullGeo(3.8, 3.6, 0.9, 0.12, 0x8f7048, 37);
    const juncoIM = instMesh(juncoGeo, MAT.reed, 3);
    const guffaIM = instMesh(guffaGeo, MAT.reed, 2);
    const cargoIM = instMesh(brickGeo, MAT.brick, 70);
    const jarGeo = new THREE.CylinderGeometry(0.2, 0.25, 0.42, 8).translate(0, 0.21, 0);
    const jarIM = instMesh(jarGeo, MAT.bitumen, 70);
    cargoIM.frustumCulled = false;
    for (let i = 0; i < 70; i++) cargoIM.setColorAt(i, _c3.setHex(RAW[i % 4]));
    cargoIM.instanceColor.needsUpdate = true;
    boatsG.add(juncoIM, guffaIM, cargoIM, jarIM);
    const pierMB = MB();
    mbBox(pierMB, -122, 0.3, -24, 22, 0.25, 3.2, cWoodL);
    for (let i = 0; i < 5; i++) for (let j = 0; j < 2; j++) {
      mbCyl(pierMB, -112 - i * 5.5, -2.0, -25.2 + j * 2.4, 0.22, 0.2, 2.3, cWood, 6);
    }
    const pier = new THREE.Mesh(mbGeo(pierMB), MAT.woodVC);
    pier.castShadow = true; pier.frustumCulled = false;
    boatsG.add(pier);

    // [tipo, índice de instancia, carga, x de la vía, fase, velocidad (m/s)]
    const BOATS = [
      { k: 'junco', i: 0, load: 'brick',   x: RIVER_X - 8,  ph: 0.05, sp: 0.9 },
      { k: 'junco', i: 1, load: 'brick',   x: RIVER_X + 6,  ph: 0.42, sp: 0.7 },
      { k: 'junco', i: 2, load: 'bitumen', x: RIVER_X - 1,  ph: 0.73, sp: 0.8 },
      { k: 'guffa', i: 0, load: 'bitumen', x: RIVER_X - 16, ph: 0.20, sp: 0.6 },
      { k: 'guffa', i: 1, load: 'none',    x: RIVER_X + 12, ph: 0.90, sp: 0.5 }
    ];
    const BP = BOATS.map(function () { return { x: 0, y: 0, z: 0, hd: 0, a: 0 }; });
    const _boatM = new THREE.Matrix4(), _bq = new THREE.Quaternion(), _bp = new THREE.Vector3(), _bs = new THREE.Vector3();
    const _bE = new THREE.Euler();
    const CARGO_BRICK = [], CARGO_JAR = [];
    for (let q = 0; q < 14; q++) CARGO_BRICK.push([-0.55 + (q % 2) * 1.1, 0.42, -3.2 + Math.floor(q / 2) * 1.07]);
    for (let q = 0; q < 6; q++) CARGO_JAR.push([-0.5 + (q % 2) * 1.0, 0.36, -2.2 + Math.floor(q / 2) * 1.2]);
    const CREW = [[-0.6, -1.0], [0.6, 1.0]];

    function updateBoats(s, W, a) {
      const t = s.t;
      for (let b = 0; b < BOATS.length; b++) {
        const B = BOATS[b], P = BP[b];
        const u = B.ph + t * B.sp / (2 * LZ);
        const z = RZ_A + LZ * tri(u);
        const hd = frac(u) < 0.5 ? 0 : Math.PI;
        P.x = B.x + 1.5 * Math.sin(W * 0.2 + b);
        P.y = WATER_Y + 0.02 * Math.sin(W * 1.3 + b);
        P.z = z; P.hd = hd; P.a = a;
        const roll = 0.02 * Math.sin(W * 1.1 + b * 2.1), pitch = 0.012 * Math.sin(W * 0.8 + b);
        _bp.set(P.x, P.y, P.z);
        _bq.setFromEuler(_bE.set(pitch, hd, roll, 'YXZ'));
        _bs.set(a, a, a);
        _boatM.compose(_bp, _bq, _bs);
        if (B.k === 'junco') juncoIM.setMatrixAt(B.i, _boatM); else guffaIM.setMatrixAt(B.i, _boatM);
        // carga: ladrillos (14) o jarras de betún (6)
        for (let q = 0; q < 14; q++) {
          const L = CARGO_BRICK[q], on = B.load === 'brick' ? a : 0;
          _t4.makeTranslation(L[0], L[1], L[2]); _sc4.makeScale(on, on, on); _t4.multiply(_sc4);
          _lm.multiplyMatrices(_boatM, _t4); cargoIM.setMatrixAt(b * 14 + q, _lm);
        }
        for (let q = 0; q < 6; q++) {
          const L = CARGO_JAR[q], on = B.load === 'bitumen' ? a : 0;
          _t4.makeTranslation(L[0], L[1], L[2]); _sc4.makeScale(on, on, on); _t4.multiply(_sc4);
          _lm.multiplyMatrices(_boatM, _t4); jarIM.setMatrixAt(b * 6 + q, _lm);
        }
      }
      // remeros: dos por barca, en coordenadas locales rotadas con el rumbo
      for (let b = 0; b < BOATS.length; b++) {
        const P = BP[b], c0 = Math.cos(P.hd), s0 = Math.sin(P.hd);
        for (let c = 0; c < 2; c++) {
          const lx = CREW[c][0], lz = CREW[c][1];
          const wx = P.x + lx * c0 + lz * s0, wz = P.z - lx * s0 + lz * c0;
          const i = 28 + b * 2 + c, ph = W * 2.2 + b * 1.7 + c * 3.1;
          pose(0.1, -0.1, -1.0 + 0.4 * Math.sin(ph), -1.0 - 0.4 * Math.sin(ph), 0.25, false, false, false, false);
          worker(i, wx, P.y + 0.35, wz, P.hd, a);
        }
      }
      juncoIM.instanceMatrix.needsUpdate = true; guffaIM.instanceMatrix.needsUpdate = true;
      cargoIM.instanceMatrix.needsUpdate = true; jarIM.instanceMatrix.needsUpdate = true;
    }

    // =====================================================================
    // 4. RAMPA EN ZIGZAG (cara este, esquina NE) con andamios y escaleras de mano
    // =====================================================================
    const rampG = new THREE.Group(); root.add(rampG);
    const clipPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);
    MAT.ramp.clippingPlanes = [clipPlane];
    const RZ0 = -30, RUN = 12, RISE = 2.5, RW = 4.0;
    // ruta: [x, y, z] de cada vértice; tramo de subida (RUN, RISE), giro en la plataforma de cada terraza
    const route = [];
    for (let i = 0; i < TIERS.length; i++) {
      const X = TH[i] + 4, yb = TIERS[i][0];
      route.push([X, yb, RZ0], [X, yb + RISE, RZ0 + RUN], [X, TIERS[i][1], RZ0]);
    }
    const rcum = [0];
    for (let k = 1; k < route.length; k++) {
      const a = route[k - 1], b = route[k];
      rcum.push(rcum[k - 1] + Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]));
    }
    const rampMB = MB();
    const cRamp = new THREE.Color(0xc9a477), cRampD = new THREE.Color(0xb08a58);
    for (let k = 0; k < route.length - 1; k++) mbSlab(rampMB, route[k], route[k + 1], RW, 0.7, cRamp);
    // muretes de adobe a los lados de cada tramo
    for (let k = 0; k < route.length - 1; k++) {
      const A = route[k], B = route[k + 1];
      if (Math.abs(A[1] - B[1]) < 1e-6) continue;             // solo tramos inclinados
      mbSlab(rampMB, [A[0] + 2.0, A[1] + 0.05, A[2]], [B[0] + 2.0, B[1] + 0.05, B[2]], 0.5, 0.9, cRampD);
    }
    // andamios: postes de palmera, travesaños y riostras a cada altura de terraza
    for (let i = 0; i < TIERS.length; i++) {
      const X = TH[i] + 4 + 2.8, yb = TIERS[i][0], yt = TIERS[i][1] + 1.4;
      [RZ0 - 1.6, RZ0 + RUN + 1.6].forEach(function (z) { mbCyl(rampMB, X, yb, z, 0.16, 0.14, yt - yb, cPalm, 6); });
      mbSlab(rampMB, [X, yb + 0.2, RZ0 - 1.6], [X, yt - 0.2, RZ0 + RUN + 1.6], 0.14, 0.14, cWoodL);
      mbBox(rampMB, X, yt - 0.9, RZ0 + RUN / 2, 0.16, 0.16, RUN + 3.2, cWoodL);
    }
    // escaleras de mano junto a la cara este (z = 30), una por terraza
    for (let i = 0; i < TIERS.length; i++) {
      const yb = TIERS[i][0], yt = TIERS[i][1], hx = TH[i];
      const x0 = hx + 1.4, x1 = hx + 0.25;
      [29.6, 30.4].forEach(function (z) { mbSlab(rampMB, [x0, yb, z], [x1, yt, z], 0.12, 0.12, cWood); });
      for (let r = 1; r < 5; r++) {
        const f = r / 5, px = x0 + (x1 - x0) * f, py = yb + (yt - yb) * f;
        mbSlab(rampMB, [px, py, 29.6], [px, py, 30.4], 0.1, 0.08, cWood);
      }
    }
    const rampMesh = new THREE.Mesh(mbGeo(rampMB), MAT.ramp);
    rampMesh.castShadow = true; rampMesh.receiveShadow = true; rampMesh.frustumCulled = false;
    rampG.add(rampMesh);

    function routeDistAtY(y) {
      if (y <= route[0][1]) return 0;
      for (let k = 1; k < route.length; k++) {
        if (route[k][1] >= y) {
          const a = route[k - 1], b = route[k], dy = b[1] - a[1];
          const u = dy > 1e-6 ? clamp((y - a[1]) / dy, 0, 1) : 1;
          return rcum[k - 1] + (rcum[k] - rcum[k - 1]) * u;
        }
      }
      return rcum[rcum.length - 1];
    }
    const RP = { x: 0, y: 0, z: 0, dx: 0, dy: 0, dz: 0 };
    function routeAt(d) {
      d = clamp(d, 0, rcum[rcum.length - 1]);
      let k = 1;
      while (k < rcum.length - 1 && rcum[k] < d) k++;
      const a = route[k - 1], b = route[k];
      const L = Math.max(1e-6, rcum[k] - rcum[k - 1]);
      const u = clamp((d - rcum[k - 1]) / L, 0, 1);
      RP.x = a[0] + (b[0] - a[0]) * u; RP.y = a[1] + (b[1] - a[1]) * u; RP.z = a[2] + (b[2] - a[2]) * u;
      RP.dx = (b[0] - a[0]) / L; RP.dy = (b[1] - a[1]) / L; RP.dz = (b[2] - a[2]) / L;
      return RP;
    }
    // ring de una terraza: punto en el perímetro del cuadrado de semilado h
    const SQ = { x: 0, z: 0, tx: 1, tz: 0 };
    function squarePt(h, f) {
      let p = frac(f) * 8 * h, x, z, tx, tz;
      if (p < 2 * h)          { x = -h + p;     z = -h;         tx = 1;  tz = 0; }
      else if ((p -= 2 * h) < 2 * h) { x = h;   z = -h + p;     tx = 0;  tz = 1; }
      else if ((p -= 2 * h) < 2 * h) { x = h - p; z = h;        tx = -1; tz = 0; }
      else { p -= 2 * h;  x = -h;       z = h - p;      tx = 0;  tz = -1; }
      SQ.x = x; SQ.z = z; SQ.tx = tx; SQ.tz = tz;
      return SQ;
    }

    // cestas de los acarreadores de la rampa (24)
    // (las cestas 0..23 de basketIM son de la rampa; se colocan en updateWorkers)

    // =====================================================================
    // 5. EXCAVACIÓN DE KOLDEWEY (SITE.excavation): zanjas, bóvedas, tiendas, vía y vagonetas
    // =====================================================================
    const digG = new THREE.Group(); root.add(digG);
    const digMB = MB();
    const EX = SITE.excavation.x;
    const PITS = [{ x: EX - 18, z: -79, sx: 12, sz: 6 }, { x: EX, z: -74, sx: 9, sz: 5 }, { x: EX + 14, z: -82, sx: 8, sz: 6 }];
    const RAILZ = -66;
    PITS.forEach(function (p) {
      mbBox(digMB, p.x, 0.03, p.z, p.sx, 0.06, p.sz, cSoil);                       // suelo de la zanja
      mbBox(digMB, p.x, 0.16, p.z - p.sz / 2 - 0.6, p.sx + 1.6, 0.32, 1.2, cSpoil); // bermas de tierra
      mbBox(digMB, p.x, 0.16, p.z + p.sz / 2 + 0.6, p.sx + 1.6, 0.32, 1.2, cSpoil);
      mbBox(digMB, p.x - p.sx / 2 - 0.6, 0.16, p.z, 1.2, 0.32, p.sz, cSpoil);
      mbBox(digMB, p.x + p.sx / 2 + 0.6, 0.16, p.z, 1.2, 0.32, p.sz, cSpoil);
      [-0.25, 0.25].forEach(function (f) {                                          // bóvedas descubiertas
        const g = new THREE.CylinderGeometry(1.1, 1.1, p.sx - 2.4, 12, 1, true, 0, Math.PI);
        g.rotateZ(Math.PI / 2);
        g.translate(p.x, 0.04, p.z + f * p.sz);
        mbAppend(digMB, g, cBrick);
      });
      mbBox(digMB, p.x - p.sx / 2 + 0.8, 0.5, p.z - p.sz / 2 + 0.2, 1.4, 1.0, 0.5, cBrick); // muro expuesto
    });
    moundMB(digMB, 2, -89, 6, 2.5, 1.3, cSpoil);
    moundMB(digMB, EX, -68.5, 4, 1.2, 0.9, cSpoil);
    moundMB(digMB, 36, -92, 5, 2.5, 1.4, cSpoil);
    tentMB(digMB, -8, -70, cCanvas);
    tentMB(digMB, -6, -93, cCanvas);
    tentMB(digMB, 48, -88, cCanvas);
    for (let x = -10; x < 46; x += 1.2) mbBox(digMB, x, 0.06, RAILZ, 0.18, 0.1, 1.9, cWood);     // traviesas
    [-0.6, 0.6].forEach(function (dz) { mbBox(digMB, 18, 0.13, RAILZ + dz, 56, 0.1, 0.08, cIron); }); // rieles
    const digStatic = new THREE.Mesh(mbGeo(digMB), MAT.woodVC);
    digStatic.castShadow = true; digStatic.receiveShadow = true; digStatic.frustumCulled = false;
    digG.add(digStatic);
    // vagonetas sobre raíles y carretillas
    const cartMB = MB();
    mbBox(cartMB, 0, 0.62, 0, 1.0, 0.7, 1.5, cWoodL);
    mbBox(cartMB, 0, 0.3, 0, 1.1, 0.1, 1.7, cWood);
    [[-0.56, -0.55], [0.56, -0.55], [-0.56, 0.55], [0.56, 0.55]].forEach(function (p) {
      const wg = new THREE.CylinderGeometry(0.24, 0.24, 0.1, 8).rotateZ(Math.PI / 2);
      wg.translate(p[0], 0.24, p[1]);
      mbAppend(cartMB, wg, cIron);
    });
    const cartIM = instMesh(mbGeo(cartMB), MAT.woodVC, 2);
    digG.add(cartIM);
    const barMB = MB();
    mbBox(barMB, 0, 0.42, 0.1, 0.7, 0.3, 0.9, cWoodL);
    mbBox(barMB, -0.3, 0.6, -0.65, 0.07, 0.07, 0.9, cWood);
    mbBox(barMB, 0.3, 0.6, -0.65, 0.07, 0.07, 0.9, cWood);
    { const wg = new THREE.CylinderGeometry(0.24, 0.24, 0.08, 8).rotateZ(Math.PI / 2); wg.translate(0, 0.24, 0.55); mbAppend(barMB, wg, cIron); }
    const barIM = instMesh(mbGeo(barMB), MAT.woodVC, 4);
    digG.add(barIM);
    // recorrido de las carretillas: de cada zanja a su montón
    const BARROW = [
      { a: [PITS[0].x, PITS[0].z + 2.5], b: [2, -89] },
      { a: [PITS[1].x, PITS[1].z + 2.0], b: [EX, -68.5] },
      { a: [PITS[2].x, PITS[2].z + 2.5], b: [36, -92] },
      { a: [PITS[0].x - 3, PITS[0].z - 2.0], b: [2, -89] }
    ];
    // zona de excavación para arqueólogos y peones
    const ARCH_C = [PITS[0], PITS[1], PITS[2]];

    // =====================================================================
    // 6. ACTUALIZACIÓN POR FOTOGRAMA
    // =====================================================================
    function v(s, k) { const x = s[k]; return typeof x === 'number' && isFinite(x) ? x : 0; }

    function updateWorkers(s, W, t, topY, caA, gA, yardA, bitA, digA) {
      // -- ladrillar: 10 moldeadores en las mesas, 6 acarreadores, 4 hogareros, 2 apiladores
      const moldPos = [];
      [TX1, TX2].forEach(function (tx) {
        [-2, 0, 2].forEach(function (dx) { moldPos.push([tx + dx, TZ + 1.5, Math.PI]); });  // sur de la mesa, mirando al norte
        [-1, 1].forEach(function (dx) { moldPos.push([tx + dx, TZ - 1.5, 0]); });           // norte, mirando al sur
      });
      moldPos.forEach(function (m, i) {
        pose(0.1, -0.1, -0.9 + 0.18 * Math.sin(W * 2.2 + i), -0.9 + 0.18 * Math.cos(W * 2.2 + i * 1.3), 0.5, false, false, false, false);
        worker(i, m[0], 0, m[1], m[2], yardA);
      });
      // acarreadores de barro seco: del moldeado al campo B (paso entre campos)
      const P0x = BX - 16, P0z = BZ + 3.5, P1x = BX - 9, P1z = BZ - 3.5;
      const hdC = Math.atan2(P1x - P0x, P1z - P0z);
      for (let c = 0; c < 6; c++) {
        const ph = hash(c * 5 + 1), u = W * 0.03 + ph;
        const up = frac(u) < 0.5, f = tri(u);
        const off = (c % 2 ? 0.5 : -0.5);
        const x = P0x + (P1x - P0x) * f + off * 0.3, z = P0z + (P1z - P0z) * f;
        const hd = up ? hdC : hdC + Math.PI;
        const sw = Math.sin(W * 5 + c);
        if (up) pose(0.4 * sw, -0.4 * sw, -1.0, -1.0, 0.2, false, false, false, false);
        else pose(0.4 * sw, -0.4 * sw, 0.3 * sw, -0.3 * sw, 0.2, false, false, false, false);
        worker(10 + c, x, 0, z, hd, yardA);
        setInst(basketIM, 24 + c, x + Math.sin(hd) * 0.5, 1.3, z + Math.cos(hd) * 0.5, 0, up ? yardA : 0);
      }
      // hogareros: alimentan cada boca con leña
      for (let k = 0; k < 4; k++) {
        pose(0.1, -0.1, -0.9 + 0.5 * Math.sin(W * 1.8 + k), -0.6 + 0.4 * Math.cos(W * 1.8 + k), 0.5, false, true, false, false);
        worker(16 + k, KX[k] + 0.4, 0, KZ - 6.3, 0, yardA);
      }
      // apiladores de ladrillo cocido
      for (let k = 0; k < 2; k++) {
        pose(0.05, -0.05, -1.0 + 0.2 * Math.sin(W * 1.4 + k), -1.0 + 0.2 * Math.cos(W * 1.4 + k), 0.3, false, false, false, false);
        worker(20 + k, BX + 23.5, 0, BZ + 3 + k * 8, Math.PI / 2, yardA);
      }

      // -- betún: 6 remeros de cucharón junto a los calderos
      for (let k = 0; k < 6; k++) {
        const c = [0, 1, 2, 3, 0, 2][k];
        const sx = HX[c] + (k < 4 ? -0.6 : 0.6), sz = HZ - 2.6;
        pose(0.1, -0.1, -1.0 + 0.25 * Math.sin(W * 2 + k), -1.0 + 0.25 * Math.cos(W * 2 + k), 0.4, true, true, false, true);
        worker(22 + k, sx, 0, sz, 0, bitA);
      }
      // cestas de caña: en el ladrillar (30..35) y junto al betún (36..41), solo visibles con su zona
      for (let k = 0; k < 6; k++) {
        const p = yardBasketPos[k];
        setInst(basketIM, 30 + k, p[0], 0, p[1], k * 0.5, yardA);
      }
      for (let k = 0; k < 6; k++) {
        const p = bitBasketPos[k];
        setInst(basketIM, 36 + k, p[0], 0, p[1], k * 0.9, bitA);
      }

      // -- barcas: 10 remeros en 5 barcas (se posicionan en updateBoats)

      // -- rampa en zigzag: 24 acarreadores que suben cargando cestas y bajan vacíos
      const dTop = routeDistAtY(topY);
      for (let c = 0; c < 24; c++) {
        const ph = hash(c * 13.7 + 3);
        const u = W * 0.004 * (0.8 + 0.4 * ph) + ph;
        const up = frac(u) < 0.5;
        const Pt = routeAt(dTop * tri(u));
        const sg = up ? 1 : -1;
        const hx = -Pt.dz, hz = Pt.dx, hl = Math.hypot(hx, hz) || 1;
        const off = (ph - 0.5) * 2.4;
        const px = Pt.x + hx / hl * off, pz = Pt.z + hz / hl * off, py = Pt.y;
        const hd = Math.atan2(Pt.dx * sg, Pt.dz * sg);
        const sw = Math.sin(W * 5 + c * 1.7);
        if (up) pose(0.4 * sw, -0.4 * sw, -1.1, -1.1, 0.3, false, false, false, false);
        else pose(0.4 * sw, -0.4 * sw, 0.35 * sw, -0.35 * sw, 0.15, false, false, false, false);
        worker(38 + c, px, py, pz, hd, caA);
        setInst(basketIM, c, px + Math.sin(hd) * 0.5, py + 1.3, pz + Math.cos(hd) * 0.5, 0, up ? caA : 0);
      }

      // -- albañiles sobre la cima en construcción: 10, circulando por el borde
      const topHalf = Math.max(4, GARD.halfAt(Math.max(0.01, topY - 0.02)));
      for (let k = 0; k < 10; k++) {
        const Q = squarePt(topHalf - 3, k / 10 + W * 0.0015);
        const hd = Math.atan2(-Q.x, -Q.z);
        pose(0.15 * Math.sin(W * 3 + k), -0.15 * Math.sin(W * 3 + k), -0.9 + 0.35 * Math.sin(W * 3 + k), -0.9 + 0.35 * Math.cos(W * 3 + k), 0.35, false, false, false, false);
        worker(62 + k, Q.x, topY + 0.1, Q.z, hd, caA);
      }

      // -- jardineros plantando en los anillos de cada terraza (t 128-146)
      const gTier = [0, 0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4];
      for (let k = 0; k < 14; k++) {
        const tg = gTier[k];
        const rho = tg < 4 ? TH[tg] - 5 : TH[4] - 8;
        const Q = squarePt(rho, (k % 3) / 3 + k * 0.11 + W * 0.0008);
        const hd = Math.atan2(Q.tx, Q.tz);
        pose(0.25 * Math.sin(W * 2 + k), -0.25 * Math.sin(W * 2 + k), -0.6 + 0.3 * Math.sin(W * 2.2 + k), -0.9 + 0.3 * Math.cos(W * 2.2 + k), 0.7, false, false, false, false);
        worker(72 + k, Q.x, TIERS[tg][1] + 0.1, Q.z, hd, gA);
      }

      // -- arqueólogos con salacot, rodeando las zanjas
      for (let k = 0; k < 12; k++) {
        const C = ARCH_C[k % 3];
        const th = k * 0.9 + W * 0.05 + k;
        const r = 5.5 + (k % 4) * 0.8;
        const x = C.x + Math.cos(th) * r, z = C.z + Math.sin(th) * r;
        const hd = Math.atan2(C.x - x, C.z - z);
        pose(0.1, -0.1, -0.2 + 0.2 * Math.sin(W * 1.1 + k), -0.4 + 0.2 * Math.cos(W * 1.1 + k), 0.3, false, false, true, false);
        worker(86 + k, x, 0, z, hd, digA);
      }
      // -- peones con palas en el borde de las zanjas
      for (let k = 0; k < 8; k++) {
        const C = PITS[k % 3];
        const side = (k % 2) ? 1 : -1;
        const x = C.x + side * (C.sx / 2 + 0.9), z = C.z + (hash(k + 40) - 0.5) * C.sz * 0.6;
        const hd = Math.atan2(C.x - x, C.z - z);
        pose(0.2, -0.2, -0.7 + 0.6 * Math.sin(W * 2.4 + k), -0.6 + 0.6 * Math.cos(W * 2.4 + k), 0.5, true, true, false, false);
        worker(98 + k, x, 0, z, hd, digA);
      }
      // -- empujadores de carretillas
      for (let k = 0; k < 4; k++) {
        const B = BARROW[k], u = W * 0.02 + hash(k) * 3, f = tri(u), fwd = frac(u) < 0.5 ? 1 : -1;
        const dx = B.b[0] - B.a[0], dz = B.b[1] - B.a[1], L = Math.hypot(dx, dz) || 1;
        const bx = B.a[0] + dx * f, bz = B.a[1] + dz * f;
        const ux = dx / L * fwd, uz = dz / L * fwd, hd = Math.atan2(ux, uz);
        setInst(barIM, k, bx, 0, bz, hd, digA);
        pose(0.25 * Math.sin(W * 3 + k), -0.25 * Math.sin(W * 3 + k), -0.85, -0.85, 0.4, false, false, false, false);
        worker(106 + k, bx - ux * 1.5, 0, bz - uz * 1.5, hd, digA);
      }
      // vagonetas sobre la vía
      for (let k = 0; k < 2; k++) {
        const u = t * 0.03 + k * 0.5, f = tri(u);
        const x = -8 + 54 * f, ry = frac(u) < 0.5 ? Math.PI / 2 : -Math.PI / 2;
        setInst(cartIM, k, x, 0.12, RAILZ, ry, digA);
      }
    }
    function update(s) {
      const t = v(s, 't'), W = v(s, 'wall');
      const kOn = v(s, 'kilns') > 0.002, bOn = v(s, 'bitumen') > 0.002, boOn = v(s, 'boats') > 0.002,
        cOn = v(s, 'cranes') > 0.002, dOn = v(s, 'dig') > 0.002;
      const topY = clamp(v(s, 'terraces'), 0, 1) * 25;
      const gA = sstep((t - 127) / 3) * (1 - sstep((t - 145) / 3));
      const caA = clamp(v(s, 'cranes') * 3, 0, 1) * (topY > 0.5 ? 1 : 0);
      const yardA = clamp(v(s, 'kilns') * 2, 0, 1), bitA = clamp(v(s, 'bitumen') * 2, 0, 1);
      const crewA = clamp(v(s, 'boats') * 1.6, 0, 1), digA = clamp(v(s, 'dig') * 2, 0, 1);

      yardG.visible = kOn; bitG.visible = bOn; boatsG.visible = boOn; digG.visible = dOn;
      rampG.visible = cOn && topY > 0.05;
      clipPlane.constant = topY + 0.02;
      workersG.visible = kOn || bOn || boOn || cOn || dOn || gA > 0.01;

      if (kOn) {
        // hornos: fuego, resplandor y humo
        KX.forEach(function (kx, k) {
          const fl = 1 + 0.08 * Math.sin(W * 9 + k * 2) + 0.05 * Math.sin(W * 17 + k);
          setInst(fireIM, k, kx, 0.75, KZ - 3.5, 0, fl);
        });
        fireIM.instanceMatrix.needsUpdate = true;
        MAT.glow.opacity = 0.5 + 0.2 * Math.sin(W * 7.3);
        for (let i = 0; i < NSM; i++) {
          const k = i % 4, age = frac(W * 0.07 + kA[i]);
          kSmokePos[i * 3] = KX[k] + (kB[i] - 0.5) * 1.0 + age * 2.2;
          kSmokePos[i * 3 + 1] = 5.8 + age * 9;
          kSmokePos[i * 3 + 2] = KZ + (kC[i] - 0.5) * 1.0 - age * 0.8;
        }
        kSmokeGeo.attributes.position.needsUpdate = true;
      }
      if (bOn) {
        // calderos: burbujas, llamas y humo negro
        for (let m = 0; m < 24; m++) {
          const c = m % 4, ang = hash(m) * TAU, rad = hash(m + 9) * 1.05;
          const ph = frac(W * 0.5 + hash(m + 3));
          const sc = ph < 0.85 ? bitA * (0.6 + 0.4 * Math.sin(ph * 6)) : 0;
          setInst(bubbleIM, m, HX[c] + Math.cos(ang) * rad, 1.9 + ph * 0.06, HZ + Math.sin(ang) * rad, 0, Math.max(0, sc));
        }
        bubbleIM.instanceMatrix.needsUpdate = true;
        HX.forEach(function (hx, c) {
          const fl = 0.85 + 0.25 * Math.sin(W * 9 + c * 1.9);
          setInst(flameIM, c, hx, 0.1, HZ + 1.95, 0, fl * bitA);
        });
        flameIM.instanceMatrix.needsUpdate = true;
        MAT.glowB.opacity = 0.45 + 0.2 * Math.sin(W * 6.1);
        for (let i = 0; i < NBS; i++) {
          const c = i % 4, age = frac(W * 0.09 + bA[i]);
          bSmokePos[i * 3] = HX[c] + (bB[i] - 0.5) * 1.2 + age * 2.0;
          bSmokePos[i * 3 + 1] = 2.2 + age * 11;
          bSmokePos[i * 3 + 2] = HZ + (bB[i] - 0.5) * 1.0 - age * 0.5;
        }
        bSmokeGeo.attributes.position.needsUpdate = true;
      }
      // barcas y remeros: siempre se reescriben (con escala 0 si no hay barcas) para no dejar ranuras antiguas
      updateBoats(s, W, crewA);

      // obreros: todas las ranuras se reescriben cada fotograma (activas o con escala 0)
      updateWorkers(s, W, t, topY, caA, gA, yardA, bitA, digA);
      WIMS.forEach(function (im) { im.instanceMatrix.needsUpdate = true; });
      basketIM.instanceMatrix.needsUpdate = true;
      barIM.instanceMatrix.needsUpdate = true;
      cartIM.instanceMatrix.needsUpdate = true;
    }

    return { update: update, group: root };
  };
})();
