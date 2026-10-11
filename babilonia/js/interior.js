// Interior de Babilonia: bloque diagrama de la impermeabilización (sección elevada con capas de abajo
// arriba y etiquetas), noria de cangilones en el pozo con sakia de bueyes, cisterna con canales de riego,
// tornillos de Arquímedes de bronce en la cara norte y resaltado en cian del sistema de agua.
// Todo procedural: geometría fusionada, InstancedMesh, ShaderMaterial/CanvasTexture dibujadas por código.
(function () {
  'use strict';
  const G = window.GIZA;

  G.createInterior = function (ctx) {
    const THREE = ctx.THREE, scene = ctx.scene, camera = ctx.camera, renderer = ctx.renderer;
    const DEG = Math.PI / 180;
    const SRGB = THREE.sRGBEncoding;
    const ADD = THREE.AdditiveBlending;
    const UP = new THREE.Vector3(0, 1, 0);
    const ID = new THREE.Matrix4();
    const ONE = new THREE.Vector3(1, 1, 1);

    const clamp = function (x, a, b) { return Math.max(a, Math.min(b, x)); };
    const clamp01 = function (x) { return clamp(x, 0, 1); };
    const smooth = function (x) { x = clamp01(x); return x * x * (3 - 2 * x); };
    const num = function (v, d) { return (typeof v === 'number' && isFinite(v)) ? v : (d || 0); };
    const fract = function (x) { return x - Math.floor(x); };
    function rng(seed) { let a = seed; return function () { a = (a * 16807) % 2147483647; return a / 2147483647; }; }

    // ---------- datos compartidos (chapters.js), con valores por defecto ----------
    const GD = G.GARDENS || {}, SITE = G.SITE || {};
    const TIERS = GD.tiers || [[0, 5, 60], [5, 10, 50], [10, 15, 40], [15, 20, 30], [20, 25, 20]];
    const WP = GD.waterproof || [];
    const PS = GD.pumpShaft || { x: -56, z: 0, half: 3.5 };
    const CI = GD.cistern || { x: -12, z: 0, y: 25, half: 6 };
    const SCR = GD.screws || { z: -52, xFrom: -50, xTo: 40, count: 5 };
    const CAN = SITE.canal || { z: 0, x0: -115, x1: -62 };
    const TOPY = TIERS[TIERS.length - 1][1];
    const XC = PS.x, ZC = PS.z, HALF = PS.half;
    const CX = CI.x, CZ = CI.z, CH = CI.half, CY = (CI.y != null) ? CI.y : TOPY;
    const NSCR = Math.max(1, Math.min(SCR.count || 5, TIERS.length));

    // ---------- texturas procedurales ----------
    function canvasTex(w, h, paint) {
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      paint(cv.getContext('2d'), w, h);
      const tex = new THREE.CanvasTexture(cv);
      tex.encoding = SRGB;
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.anisotropy = 4;
      return tex;
    }
    // ladrillo sobre una baldosa de 1 m (8 hiladas de 12,5 cm, ladrillos de 25 cm)
    function paintBrick(mortar, tone) {
      return function (g, w, h) {
        const r = rng(7);
        g.fillStyle = mortar; g.fillRect(0, 0, w, h);
        const rows = 8, rh = h / rows, cols = 4, bw = w / cols;
        for (let row = 0; row < rows; row++) {
          const off = (row % 2) * bw / 2;
          for (let c = -1; c <= cols; c++) {
            const k = 0.86 + r() * 0.24;
            g.fillStyle = 'rgb(' + Math.round(tone[0] * k) + ',' + Math.round(tone[1] * k) + ',' + Math.round(tone[2] * k) + ')';
            g.fillRect(c * bw + off + 2, row * rh + 2, bw - 4, rh - 4);
          }
        }
        for (let i = 0; i < 500; i++) {
          g.fillStyle = r() < 0.5 ? 'rgba(60,40,20,0.18)' : 'rgba(255,240,215,0.14)';
          g.fillRect(r() * w, r() * h, 1 + r() * 2, 1);
        }
      };
    }
    function paintReed(g, w, h) {       // cañas entrelazadas con manchas de betún
      const r = rng(13);
      g.fillStyle = '#7a6a3a'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 90; i++) {
        g.strokeStyle = r() < 0.5 ? 'rgba(200,180,110,0.55)' : 'rgba(55,42,20,0.5)';
        g.lineWidth = 1 + r() * 2;
        const x0 = r() * w, y0 = r() * h;
        g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 + 40 + r() * 40, y0 + 90 + r() * 40); g.stroke();
      }
      for (let i = 0; i < 26; i++) {
        g.fillStyle = 'rgba(22,17,12,0.85)';
        g.beginPath(); g.ellipse(r() * w, r() * h, 4 + r() * 10, 2 + r() * 4, 0, 0, Math.PI * 2); g.fill();
      }
    }
    function paintSoil(g, w, h) {
      const r = rng(21);
      g.fillStyle = '#4b3621'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 900; i++) {
        g.fillStyle = r() < 0.5 ? 'rgba(20,12,6,0.45)' : 'rgba(150,118,80,0.35)';
        g.fillRect(r() * w, r() * h, 1 + r() * 3, 1 + r() * 2);
      }
    }
    function paintStone(g, w, h) {      // sillares de 50 x 25 cm
      const r = rng(5);
      g.fillStyle = '#8f8068'; g.fillRect(0, 0, w, h);
      const rows = 4, rh = h / rows, cols = 2, bw = w / cols;
      for (let row = 0; row < rows; row++) {
        const off = (row % 2) * bw / 2;
        for (let c = -1; c <= cols; c++) {
          const k = 0.9 + r() * 0.16;
          g.fillStyle = 'rgb(' + Math.round(205 * k) + ',' + Math.round(187 * k) + ',' + Math.round(147 * k) + ')';
          g.fillRect(c * bw + off + 3, row * rh + 3, bw - 6, rh - 6);
        }
      }
      for (let i = 0; i < 400; i++) {
        g.fillStyle = r() < 0.5 ? 'rgba(90,70,45,0.16)' : 'rgba(255,245,220,0.14)';
        g.fillRect(r() * w, r() * h, 1 + r() * 2, 1);
      }
    }

    // ---------- entorno para reflejos metálicos y agua (PMREM de un cielo degradado) ----------
    let envTex = null;
    try {
      const envScene = new THREE.Scene();
      const sg = new THREE.SphereGeometry(60, 32, 16);
      const pos = sg.attributes.position, cols = new Float32Array(pos.count * 3);
      for (let i = 0; i < pos.count; i++) {
        const y = pos.getY(i) / 60;
        let r, g, b;
        if (y >= 0) { const u = Math.pow(y, 0.6); r = 0.95 + (0.36 - 0.95) * u; g = 0.84 + (0.56 - 0.84) * u; b = 0.66 + (0.82 - 0.66) * u; }
        else { const u = Math.min(1, -y); r = 0.95 + (0.28 - 0.95) * u; g = 0.84 + (0.22 - 0.84) * u; b = 0.66 + (0.16 - 0.66) * u; }
        cols[i * 3] = r; cols[i * 3 + 1] = g; cols[i * 3 + 2] = b;
      }
      sg.setAttribute('color', new THREE.BufferAttribute(cols, 3));
      envScene.add(new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
      const sun = new THREE.Mesh(new THREE.SphereGeometry(5, 16, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 4.4, 3.4) }));
      sun.position.set(-30, 38, -36);
      envScene.add(sun);
      const pm = new THREE.PMREMGenerator(renderer);
      envTex = pm.fromScene(envScene, 0.02).texture;
      pm.dispose();
    } catch (e) { envTex = null; }

    // ---------- geometría fusionada (un material = una llamada de dibujo) ----------
    function Merge() { this.p = []; this.n = []; this.uv = []; this.c = []; this.ix = []; this.useC = false; }
    Merge.prototype.add = function (geom, m, color) {
      const pa = geom.attributes.position, na = geom.attributes.normal, ua = geom.attributes.uv;
      const base = this.p.length / 3, cnt = pa.count;
      const nm = new THREE.Matrix3().getNormalMatrix(m);
      const v = new THREE.Vector3(), n = new THREE.Vector3();
      for (let i = 0; i < cnt; i++) {
        v.fromBufferAttribute(pa, i).applyMatrix4(m);
        this.p.push(v.x, v.y, v.z);
        if (na) { n.fromBufferAttribute(na, i).applyMatrix3(nm).normalize(); this.n.push(n.x, n.y, n.z); }
        else this.n.push(0, 1, 0);
        if (ua) this.uv.push(ua.getX(i), ua.getY(i)); else this.uv.push(0, 0);
        if (color) { this.useC = true; this.c.push(color.r, color.g, color.b); }
        else this.c.push(1, 1, 1);
      }
      const flip = m.determinant() < 0;
      const idx = geom.index, n3 = idx ? idx.count : cnt;
      for (let i = 0; i < n3; i += 3) {
        const a = base + (idx ? idx.getX(i) : i), b = base + (idx ? idx.getX(i + 1) : i + 1), c = base + (idx ? idx.getX(i + 2) : i + 2);
        if (flip) this.ix.push(a, c, b); else this.ix.push(a, b, c);
      }
    };
    Merge.prototype.empty = function () { return this.ix.length === 0; };
    Merge.prototype.geometry = function () {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
      if (this.useC) g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
      g.setIndex(this.ix);
      g.computeBoundingSphere();
      return g;
    };
    // caja con UV en metros (baldosa de 1 m): la piedra no se estira en muros altos
    function boxW(sx, sy, sz, cx, cy, cz, mergeTo) {
      const g = new THREE.BoxGeometry(sx, sy, sz).translate(cx, cy, cz);
      const pa = g.attributes.position, na = g.attributes.normal, ua = g.attributes.uv;
      for (let i = 0; i < pa.count; i++) {
        const x = pa.getX(i), y = pa.getY(i), z = pa.getZ(i);
        const nx = Math.abs(na.getX(i)), ny = Math.abs(na.getY(i));
        if (nx > 0.5) ua.setXY(i, z, y);
        else if (ny > 0.5) ua.setXY(i, x, z);
        else ua.setXY(i, x, y);
      }
      mergeTo.add(g, ID);
      g.dispose();
    }
    function boxAt(mergeTo, sx, sy, sz, cx, cy, cz) {
      const g = new THREE.BoxGeometry(sx, sy, sz).translate(cx, cy, cz);
      mergeTo.add(g, ID);
      g.dispose();
    }
    function T(x, y, z) { return new THREE.Matrix4().makeTranslation(x, y, z); }
    function RX(a) { return new THREE.Matrix4().makeRotationX(a); }
    function RY(a) { return new THREE.Matrix4().makeRotationY(a); }
    function RZ(a) { return new THREE.Matrix4().makeRotationZ(a); }

    // ---------- materiales ----------
    const texBrick = canvasTex(256, 256, paintBrick('#cfc4ab', [184, 121, 74]));
    const texPlaster = canvasTex(256, 256, paintBrick('#ebe2cb', [170, 104, 62]));
    const texReed = canvasTex(256, 256, paintReed);
    const texSoil = canvasTex(256, 256, paintSoil);
    const texStone = canvasTex(256, 256, paintStone);

    const stoneM = new THREE.MeshStandardMaterial({ map: texStone, color: 0xe6d6b0, roughness: 0.9 });
    const clayM = new THREE.MeshStandardMaterial({ color: 0xb8794a, roughness: 0.8 });
    const woodM = new THREE.MeshStandardMaterial({ color: 0x7a4f2a, roughness: 0.85 });
    const bronzeM = new THREE.MeshStandardMaterial({ color: 0xa8662c, metalness: 1, roughness: 0.3, envMap: envTex, envMapIntensity: 1.1 });
    const waterM = new THREE.MeshStandardMaterial({ color: 0x4fa3b8, metalness: 0.1, roughness: 0.06, transparent: true, opacity: 0.85, envMap: envTex, envMapIntensity: 1.4, side: THREE.DoubleSide });
    const oxM = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
    const chainM = new THREE.LineBasicMaterial({ color: 0x5a4a36 });
    const cyanM = new THREE.LineBasicMaterial({ color: 0x7ff7ff, transparent: true, opacity: 0, blending: ADD, depthWrite: false });
    const dropM = new THREE.PointsMaterial({ color: 0x9fe6ff, size: 0.2, transparent: true, opacity: 0, depthWrite: false });

    // materiales del diagrama: se desvanecen al terminar el capítulo III
    const dMats = [];
    function dm(opts) {
      const m = new THREE.MeshStandardMaterial(Object.assign({ transparent: true, opacity: 0, side: THREE.DoubleSide }, opts));
      dMats.push(m); return m;
    }
    const dVault = dm({ map: texBrick, roughness: 0.92 });
    const dLayer = [
      dm({ map: texReed, roughness: 0.95 }),
      dm({ map: texPlaster, roughness: 0.9 }),
      dm({ color: '#c3cad2', metalness: 0.85, roughness: 0.25, envMap: envTex, envMapIntensity: 1.5 }),
      dm({ map: texSoil, roughness: 0.97 })
    ];
    const backM = new THREE.MeshBasicMaterial({ color: 0x140e09, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false });
    const outM = new THREE.LineBasicMaterial({ color: 0x7ff7ff, transparent: true, opacity: 0, depthWrite: false });

    // ---------- jerarquía ----------
    const root = new THREE.Group(); scene.add(root);
    const diagRoot = new THREE.Group(); root.add(diagRoot);
    const pumpRoot = new THREE.Group(); root.add(pumpRoot);
    const contourRoot = new THREE.Group(); root.add(contourRoot);
    const waterRoot = new THREE.Group(); root.add(waterRoot);
    const screwRoot = new THREE.Group(); root.add(screwRoot);

    // ---------- etiquetas (sprites fijos en pantalla + línea guía desde el ancla 3D) ----------
    const LAB_X = 0.58;                       // centro del tercio derecho de la pantalla
    const _ndc = new THREE.Vector3(), _dir = new THREE.Vector3();
    function labelTex(name, sub) {
      const c0 = document.createElement('canvas').getContext('2d');
      let fs = 40;
      c0.font = 'bold ' + fs + 'px Georgia, serif';
      let w1 = c0.measureText(name).width;
      if (w1 > 760) { fs = Math.max(24, Math.floor(40 * 760 / w1)); c0.font = 'bold ' + fs + 'px Georgia, serif'; w1 = c0.measureText(name).width; }
      c0.font = '22px "Courier New", monospace';
      const w2 = c0.measureText(sub).width;
      const cv = document.createElement('canvas');
      cv.width = Math.ceil(Math.max(w1, w2) + 60); cv.height = 104;
      const q = cv.getContext('2d');
      q.fillStyle = 'rgba(4,12,16,0.8)'; q.fillRect(0, 0, cv.width, cv.height);
      q.strokeStyle = '#7ff7ff'; q.lineWidth = 3; q.strokeRect(1.5, 1.5, cv.width - 3, cv.height - 3);
      q.textAlign = 'center'; q.textBaseline = 'middle';
      q.font = 'bold ' + fs + 'px Georgia, serif'; q.fillStyle = '#c4f7ff'; q.fillText(name, cv.width / 2, 38);
      q.font = '22px "Courier New", monospace'; q.fillStyle = 'rgba(230,240,245,0.9)'; q.fillText(sub, cv.width / 2, 76);
      const tex = new THREE.CanvasTexture(cv);
      tex.encoding = SRGB; tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false;
      return { tex: tex, aspect: cv.width / cv.height };
    }
    function LabelSet(n) {
      this.root = new THREE.Group();
      this.items = [];
      this.pos = new Float32Array(n * 6);
      this.geo = new THREE.BufferGeometry();
      this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
      this.mat = new THREE.LineBasicMaterial({ color: 0x7ff7ff, transparent: true, opacity: 0, depthTest: false, depthWrite: false });
      this.lead = new THREE.LineSegments(this.geo, this.mat);
      this.lead.frustumCulled = false; this.lead.renderOrder = 9;
      this.root.add(this.lead);
      root.add(this.root);
    }
    LabelSet.prototype.add = function (name, sub, anchor, yN) {
      const lt = labelTex(name, sub);
      const mat = new THREE.SpriteMaterial({ map: lt.tex, transparent: true, opacity: 0, depthTest: false, depthWrite: false });
      const sp = new THREE.Sprite(mat);
      sp.renderOrder = 10; sp.frustumCulled = false;
      this.root.add(sp);
      this.items.push({ sp: sp, mat: mat, aspect: lt.aspect, anchor: anchor.clone(), yN: yN });
    };
    LabelSet.prototype.update = function (ops, tanH) {
      const arr = this.pos;
      let top = 0;
      for (let i = 0; i < this.items.length; i++) {
        const L = this.items[i], op = clamp01(ops[i]);
        const k = i * 6;
        L.mat.opacity = op;
        L.sp.visible = op > 0.002;
        top = Math.max(top, op);
        if (!L.sp.visible) {
          arr[k] = arr[k + 3] = L.anchor.x; arr[k + 1] = arr[k + 4] = L.anchor.y; arr[k + 2] = arr[k + 5] = L.anchor.z;
          continue;
        }
        const d = Math.max(1, camera.position.distanceTo(L.anchor));
        _ndc.set(LAB_X, L.yN, 0.5).unproject(camera);
        _dir.copy(_ndc).sub(camera.position).normalize();
        L.sp.position.copy(camera.position).addScaledVector(_dir, d);
        const maxW = 0.24 * 2 * d * tanH * camera.aspect;     // ancho máximo: 24 % de la pantalla
        const hgt = Math.min(0.10 * d * tanH, maxW / L.aspect);
        L.sp.scale.set(hgt * L.aspect, hgt, 1);
        const p = L.sp.position;
        arr[k] = L.anchor.x; arr[k + 1] = L.anchor.y; arr[k + 2] = L.anchor.z;
        arr[k + 3] = p.x; arr[k + 4] = p.y; arr[k + 5] = p.z;
      }
      this.mat.opacity = 0.8 * top;
      this.geo.attributes.position.needsUpdate = true;
    };

    // ============ 1) BLOQUE DIAGRAMA: sección elevada junto a la cara norte de la terraza inferior ============
    const DZF = -65, DZB = -63, DW = DZB - DZF;     // slab de 2 m de fondo, a 1-3 m de la cara norte (z=-60)
    const DX0 = -20, DX1 = 20, DYB = 1, DS = 2;      // escala vertical x2 sobre los espesores reales
    function extr(pts) {                            // perfil XY extruido en Z (fondo DW)
      const sh = new THREE.Shape();
      sh.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) sh.lineTo(pts[i][0], pts[i][1]);
      sh.closePath();
      return new THREE.ExtrudeGeometry(sh, { depth: DW, bevelEnabled: false, steps: 1 }).translate(0, 0, DZF);
    }
    // bóveda de ladrillo: arco de cañón en sección (cámara bajo la terraza), coronación a 2.2 m
    const VAULT = [[-20, 0], [-14, 0]];
    for (let i = 1; i <= 16; i++) { const x = -14 + 28 * i / 16; VAULT.push([x, 1.4 * (1 - x * x / 196)]); }
    VAULT.push([20, 0], [20, 2.2], [-20, 2.2]);
    const vaultMesh = new THREE.Mesh(extr(VAULT), dVault);
    vaultMesh.position.set(0, DYB, 0);
    diagRoot.add(vaultMesh);

    // capas de GARDENS.waterproof, de abajo arriba, sobre la bóveda
    const layerMeshes = [], layerBase = [], layerH = [];
    {
      let yb = DYB + 2.2;
      for (let i = 0; i < WP.length && i < dLayer.length; i++) {
        const h = Math.max(0.05, WP[i].t) * DS;
        const rect = [[DX0, 0], [DX1, 0], [DX1, h], [DX0, h]];
        const mesh = new THREE.Mesh(extr(rect), dLayer[i]);
        mesh.position.set(0, yb, 0);
        diagRoot.add(mesh);
        layerMeshes.push(mesh); layerBase.push(yb); layerH.push(h);
        yb += h;
      }
    }
    // contorno cian (siempre, así se ven los huecos antes de rellenarse)
    const olP = [];
    function outline(pts, oy) {
      const n = pts.length;
      for (let i = 0; i < n; i++) {
        const a = pts[i], b = pts[(i + 1) % n];
        olP.push(a[0], a[1] + oy, DZF, b[0], b[1] + oy, DZF);
        olP.push(a[0], a[1] + oy, DZB, b[0], b[1] + oy, DZB);
        olP.push(a[0], a[1] + oy, DZF, a[0], a[1] + oy, DZB);
      }
    }
    outline(VAULT, DYB);
    for (let i = 0; i < layerMeshes.length; i++) {
      outline([[DX0, 0], [DX1, 0], [DX1, layerH[i]], [DX0, layerH[i]]], layerBase[i]);
    }
    const outGeo = new THREE.BufferGeometry();
    outGeo.setAttribute('position', new THREE.Float32BufferAttribute(olP, 3));
    const outline3 = new THREE.LineSegments(outGeo, outM);
    outline3.frustumCulled = false;
    diagRoot.add(outline3);
    // fondo oscuro detrás del corte (se ve por el hueco del arco) y dos puntales
    const backPlane = new THREE.Mesh(new THREE.PlaneGeometry(46, 8), backM);
    backPlane.position.set(0, 4.5, DZB + 0.25);
    diagRoot.add(backPlane);
    {
      const pm = new Merge();
      boxW(0.6, 1.2, 0.6, -18, 0.6, -64, pm);
      boxW(0.6, 1.2, 0.6, 18, 0.6, -64, pm);
      diagRoot.add(new THREE.Mesh(pm.geometry(), stoneM));
    }
    // etiquetas del diagrama, de abajo arriba en el tercio derecho
    const diagLabels = new LabelSet(5);
    const DIAG_LS = [0.04, 0.22, 0.42, 0.6, 0.8];   // umbral de aparición (fracción de la pista waterproof)
    diagLabels.add('BÓVEDA DE LADRILLO', 'ARCO DE CAÑÓN BAJO LA TERRAZA', new THREE.Vector3(DX1, DYB + 1.1, -64), -0.34);
    const LNAMES = ['CAÑAS CON BETÚN', 'LADRILLO CON YESO', 'LÁMINAS DE PLOMO', 'TIERRA FÉRTIL'];
    for (let i = 0; i < layerMeshes.length; i++) {
      diagLabels.add(LNAMES[i] || 'CAPA', 'ESPESOR REAL ' + WP[i].t.toFixed(2) + ' m',
        new THREE.Vector3(DX1, layerBase[i] + layerH[i] / 2, -64), -0.17 + i * 0.17);
    }

    // ============ 2) SISTEMA DE AGUA: pozo, noria de cangilones, sakia, cisterna, canales ============
    const RC = 2.2, YB = 2.3, YT = TOPY - 2.8;     // radio del cangilón, centros de las ruedas (22.2 m)
    const LS = YT - YB, ARC = Math.PI * RC, LOOP = 2 * LS + 2 * ARC, NB = 44;
    const _lp = new THREE.Vector3(), _ln = new THREE.Vector3();
    let _full = false;
    // punto de la cadena sin fin a la distancia d (plano x = XC); pone normal hacia fuera en _ln
    function loopAt(d) {
      d = fract(d / LOOP) * LOOP;
      let y, z, ny, nz, seg;
      if (d < LS) { seg = 0; y = YB + d; z = RC; ny = 0; nz = 1; }
      else if (d < LS + ARC) {
        seg = 1; const a = (d - LS) / RC;
        y = YT + RC * Math.sin(a); z = RC * Math.cos(a); ny = Math.sin(a); nz = Math.cos(a);
      }
      else if (d < 2 * LS + ARC) { seg = 2; y = YT - (d - LS - ARC); z = -RC; ny = 0; nz = -1; }
      else {
        seg = 3; const a = (d - 2 * LS - ARC) / RC;
        y = YB - RC * Math.sin(a); z = -RC * Math.cos(a); ny = -Math.sin(a); nz = -Math.cos(a);
      }
      // cangilón lleno: sube por el lado de fuera y se vacía tras el cenit
      _full = (seg === 0) || (seg === 1 && (d - LS) < ARC / 2);
      _lp.set(XC, y, ZC + z); _ln.set(0, ny, nz);
      return seg;
    }

    // pozo: muros de 0,8 m de piedra, de y=0 a y=25
    const pumpStoneM = new Merge();
    {
      const h = TOPY, ih = HALF + 0.4;
      // sin muro oeste: la cadena de cangilones se ve desde el lado de la sakia
      boxW(0.8, h, 2 * HALF + 1.6, XC + ih, h / 2, ZC, pumpStoneM);
      boxW(2 * HALF + 1.6, h, 0.8, XC, h / 2, ZC - ih, pumpStoneM);
      boxW(2 * HALF + 1.6, h, 0.8, XC, h / 2, ZC + ih, pumpStoneM);
    }
    // canal desde el río (SITE.canal) hasta el pie del pozo: cauce de piedra a nivel del suelo
    const CXA = CAN.x0, CXB = CAN.x1 + 2.5, CLEN = CXB - CXA, CCX = (CXA + CXB) / 2;
    boxW(CLEN, 1.1, 0.4, CCX, 0.05, ZC + 2.0, pumpStoneM);
    boxW(CLEN, 1.1, 0.4, CCX, 0.05, ZC - 2.0, pumpStoneM);
    boxW(CLEN, 0.2, 4.0, CCX, -0.8, ZC, pumpStoneM);
    const pumpStone = new THREE.Mesh(pumpStoneM.geometry(), stoneM);
    pumpRoot.add(pumpStone);

    // agua del pozo y del canal (la del canal llega hasta el muro del pozo)
    const pumpWaterM = new Merge();
    boxAt(pumpWaterM, CLEN, 0.4, 3.2, CCX, -0.5, ZC);
    boxAt(pumpWaterM, 2 * HALF - 0.2, 0.2, 2 * HALF - 0.2, XC, 0.5, ZC);
    pumpRoot.add(new THREE.Mesh(pumpWaterM.geometry(), waterM));

    // ruedas dentadas arriba y abajo (en el plano de la cadena) con su eje
    const gearM = new Merge();
    function addGear(yc) {
      gearM.add(new THREE.CylinderGeometry(2.0, 2.0, 0.5, 28), T(XC, yc, ZC).multiply(RZ(Math.PI / 2)));
      gearM.add(new THREE.CylinderGeometry(0.25, 0.25, HALF * 2 - 0.4, 8), T(XC, yc, ZC).multiply(RZ(Math.PI / 2)));
      for (let i = 0; i < 24; i++) {
        const ph = i / 24 * Math.PI * 2;
        const M = T(XC, yc, ZC).multiply(RX(ph)).multiply(T(0, RC, 0));
        gearM.add(new THREE.BoxGeometry(0.5, 0.4, 0.3), M);
      }
    }
    addGear(YT); addGear(YB);
    pumpRoot.add(new THREE.Mesh(gearM.geometry(), woodM));

    // cadena de cangilones: línea de la cadena y cubos de cerámica (InstancedMesh)
    const chainPts = [];
    for (let i = 0; i < 240; i++) { loopAt(i / 240 * LOOP); chainPts.push(_lp.x, _lp.y, _lp.z); }
    const chainGeo = new THREE.BufferGeometry();
    chainGeo.setAttribute('position', new THREE.Float32BufferAttribute(chainPts, 3));
    pumpRoot.add(new THREE.LineLoop(chainGeo, chainM));
    const bucketMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.3, 0.22, 0.46, 10), clayM, NB);
    bucketMesh.frustumCulled = false;
    const discMesh = new THREE.InstancedMesh(new THREE.CircleGeometry(0.26, 12).rotateX(-Math.PI / 2), waterM, NB);
    discMesh.frustumCulled = false;
    pumpRoot.add(bucketMesh, discMesh);

    // sakia: rueda horizontal con dientes, eje y brazo; dos bueyes caminan en círculo
    const SAK = { x: -70, z: 10, R: 6 };
    const sakiaG = new THREE.Group();
    sakiaG.position.set(SAK.x, 0, SAK.z);
    pumpRoot.add(sakiaG);
    {
      const sm = new Merge();
      sm.add(new THREE.CylinderGeometry(3, 3, 0.3, 28), T(0, 1.1, 0));
      for (let i = 0; i < 20; i++) {
        const th = i / 20 * Math.PI * 2;
        sm.add(new THREE.BoxGeometry(0.4, 0.3, 0.3), T(0, 1.25, 0).multiply(RY(-th)).multiply(T(3.1, 0, 0)));
      }
      sm.add(new THREE.CylinderGeometry(0.2, 0.2, 3.0, 8), T(0, 1.5, 0));
      sm.add(new THREE.BoxGeometry(5.8, 0.22, 0.22), T(3.0, 1.9, 0));
      sakiaG.add(new THREE.Mesh(sm.geometry(), woodM));
    }
    const oxMerge = new Merge();
    {
      const cOx = new THREE.Color(0x6f4a2c), cLeg = new THREE.Color(0x4f3420), cHorn = new THREE.Color(0xe9dcc0);
      oxMerge.add(new THREE.BoxGeometry(0.8, 0.85, 1.7), T(0, 1.15, 0), cOx);
      [[-0.25, -0.6], [0.25, -0.6], [-0.25, 0.6], [0.25, 0.6]].forEach(function (p) {
        oxMerge.add(new THREE.BoxGeometry(0.16, 1.0, 0.16), T(p[0], 0.5, p[1]), cLeg);
      });
      oxMerge.add(new THREE.BoxGeometry(0.36, 0.42, 0.5), T(0, 1.45, 1.0), cOx);
      oxMerge.add(new THREE.BoxGeometry(0.42, 0.08, 0.08), T(0, 1.7, 1.0), cHorn);
      oxMerge.add(new THREE.BoxGeometry(0.08, 0.5, 0.08), T(0, 1.05, -0.98), cLeg);
    }
    const oxMesh = new THREE.InstancedMesh(oxMerge.geometry(), oxM, 2);
    oxMesh.frustumCulled = false;
    pumpRoot.add(oxMesh);

    // cisterna superior: tanque de piedra sobre la terraza, con agua que sube
    const waterStoneM = new Merge();
    {
      const hH = 3.0, yc = CY + hH / 2;
      boxW(0.6, hH, 2 * CH + 1.2, CX - (CH + 0.3), yc, CZ, waterStoneM);
      boxW(0.6, hH, 2 * CH + 1.2, CX + (CH + 0.3), yc, CZ, waterStoneM);
      boxW(2 * CH + 1.2, hH, 0.6, CX, yc, CZ - (CH + 0.3), waterStoneM);
      boxW(2 * CH + 1.2, hH, 0.6, CX, yc, CZ + (CH + 0.3), waterStoneM);
      boxW(2 * CH + 0.6, 0.4, 2 * CH + 0.6, CX, CY - 0.1, CZ, waterStoneM);
    }
    // acueducto desde la cabeza del pozo hasta la cisterna, sobre pilares en las terrazas
    const AQ0 = XC + HALF, AQ1 = CX - CH - 0.3 + 0.6, AQL = AQ1 - AQ0, AQC = (AQ0 + AQ1) / 2;
    boxW(AQL, 0.4, 1.6, AQC, CY - 0.2, 0, waterStoneM);
    boxW(AQL, 0.8, 0.3, AQC, CY + 0.4, 0.75, waterStoneM);
    boxW(AQL, 0.8, 0.3, AQC, CY + 0.4, -0.75, waterStoneM);
    [[-47, 10], [-40, 15], [-30, 20], [-22, 20]].forEach(function (p) {
      const h = (CY - 0.4) - p[1];
      boxW(1.2, h, 1.2, p[0], p[1] + h / 2, 0, waterStoneM);
    });
    const waterStone = new THREE.Mesh(waterStoneM.geometry(), stoneM);
    waterRoot.add(waterStone);

    // agua estática: acueducto y canales de riego que bajan por las terrazas (oeste)
    const staticWaterM = new Merge();
    boxAt(staticWaterM, AQL, 0.3, 1.2, AQC, CY + 0.15, 0);
    const CHAN = [[-55, 5, [[-58, -6], [6, 58]]], [-45, 10, [[-48, 48]]], [-35, 15, [[-38, 38]]], [-25, 20, [[-28, 28]]]];
    CHAN.forEach(function (c) {
      c[2].forEach(function (seg) {
        const len = seg[1] - seg[0];
        boxAt(staticWaterM, 1.2, 0.25, len, c[0], c[1] + 0.125, (seg[0] + seg[1]) / 2);
      });
    });
    waterRoot.add(new THREE.Mesh(staticWaterM.geometry(), waterM));

    // agua de la cisterna: superficie que sube con la pista water
    const cisternWater = new THREE.Mesh(new THREE.PlaneGeometry(2 * CH - 0.4, 2 * CH - 0.4).rotateX(-Math.PI / 2), waterM);
    cisternWater.position.set(CX, CY + 0.3, CZ);
    waterRoot.add(cisternWater);

    // chorro del cangilón del cenit: gotas que van de la cadena al acueducto
    const ND = 34;
    const dropGeo = new THREE.BufferGeometry();
    const dropPos = new Float32Array(ND * 3);
    dropGeo.setAttribute('position', new THREE.BufferAttribute(dropPos, 3));
    const drops = new THREE.Points(dropGeo, dropM);
    drops.frustumCulled = false;
    waterRoot.add(drops);

    // tornillos de Arquímedes: hélice dentro de un cilindro abierto, inclinados escalón a escalón
    function helixGeo(L, turns, rin, rout, t0, t1, S) {
      const pos = [], ix = [];
      for (let i = 0; i <= S; i++) {
        const t = t0 + (t1 - t0) * i / S;
        const y = (t - 0.5) * L, th = 2 * Math.PI * turns * t;
        const c = Math.cos(th), s = Math.sin(th);
        pos.push(rin * c, y, rin * s, rout * c, y, rout * s);
      }
      for (let i = 0; i < S; i++) {
        const a = 2 * i, b = 2 * i + 1, c = 2 * (i + 1) + 1, d = 2 * (i + 1);
        ix.push(a, d, c, a, c, b);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setIndex(ix);
      g.computeVertexNormals();
      return g;
    }
    const SL = Math.hypot(5, 10);                  // cada tornillo sube 5 m sobre 10 m de terraza
    const bronzeScrM = new THREE.MeshStandardMaterial({ color: 0xa8662c, metalness: 1, roughness: 0.3, envMap: envTex, envMapIntensity: 1.1, side: THREE.DoubleSide, transparent: true, opacity: 0 });
    const waterScrM = new THREE.MeshStandardMaterial({ color: 0x4fa3b8, metalness: 0.1, roughness: 0.06, envMap: envTex, envMapIntensity: 1.4, side: THREE.DoubleSide, transparent: true, opacity: 0 });
    // tubo abierto: deja una ranura de 90 grados para ver la hélice
    const tubeI = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.95, 0.95, SL, 24, 1, true, 0, Math.PI * 1.5), bronzeScrM, NSCR);
    const bladeI = new THREE.InstancedMesh(helixGeo(SL, 5, 0.12, 0.8, 0, 1, 120), bronzeScrM, NSCR);
    const waterI = new THREE.InstancedMesh(helixGeo(SL, 5, 0.35, 0.8, 0, 0.5, 60), waterScrM, NSCR);
    tubeI.frustumCulled = bladeI.frustumCulled = waterI.frustumCulled = false;
    screwRoot.add(tubeI, bladeI, waterI);
    const scrBase = [], scrMid = [];
    {
      const P0 = new THREE.Vector3(), P1 = new THREE.Vector3(), Dd = new THREE.Vector3(), Qq = new THREE.Quaternion(), Mm = new THREE.Vector3();
      for (let k = 0; k < NSCR; k++) {
        const H = TIERS[k][2];
        const xk = NSCR > 1 ? (SCR.xFrom + (SCR.xTo - SCR.xFrom) * k / (NSCR - 1)) : SCR.xFrom;
        P0.set(xk, TIERS[k][0] + 0.5, -(H + 2.5));
        P1.set(xk, TIERS[k][1] + 0.5, -(H - 7.5));
        Mm.addVectors(P0, P1).multiplyScalar(0.5);
        Dd.subVectors(P1, P0).normalize();
        Qq.setFromUnitVectors(UP, Dd);
        const base = new THREE.Matrix4().compose(Mm.clone(), Qq.clone(), ONE);
        scrBase.push(base); scrMid.push(Mm.clone());
        tubeI.setMatrixAt(k, base);
      }
      tubeI.instanceMatrix.needsUpdate = true;
    }

    // contorno cian: pozo, cisterna y los dos discos de las ruedas
    const cw = [];
    function seg3(a, b) { cw.push(a[0], a[1], a[2], b[0], b[1], b[2]); }
    {
      const e = HALF + 0.4;
      [0, TOPY].forEach(function (y) {
        const c = [[XC - e, y, ZC - e], [XC + e, y, ZC - e], [XC + e, y, ZC + e], [XC - e, y, ZC + e]];
        for (let i = 0; i < 4; i++) seg3(c[i], c[(i + 1) % 4]);
      });
      [[XC - e, ZC - e], [XC + e, ZC - e], [XC + e, ZC + e], [XC - e, ZC + e]].forEach(function (p) { seg3([p[0], 0, p[1]], [p[0], TOPY, p[1]]); });
      const h = CH + 0.3, yA = CY, yB2 = CY + 3.0;
      const cc = [[CX - h, CZ - h], [CX + h, CZ - h], [CX + h, CZ + h], [CX - h, CZ + h]];
      [yA, yB2].forEach(function (y) { for (let i = 0; i < 4; i++) seg3([cc[i][0], y, cc[i][1]], [cc[(i + 1) % 4][0], y, cc[(i + 1) % 4][1]]); });
      cc.forEach(function (p) { seg3([p[0], yA, p[1]], [p[0], yB2, p[1]]); });
      [YT, YB].forEach(function (yc) {
        for (let i = 0; i < 28; i++) {
          const a0 = i / 28 * Math.PI * 2, a1 = (i + 1) / 28 * Math.PI * 2;
          [XC - 0.27, XC + 0.27].forEach(function (x) {
            seg3([x, yc + 2.0 * Math.cos(a0), ZC + 2.0 * Math.sin(a0)], [x, yc + 2.0 * Math.cos(a1), ZC + 2.0 * Math.sin(a1)]);
          });
        }
      });
    }
    const cwGeo = new THREE.BufferGeometry();
    cwGeo.setAttribute('position', new THREE.Float32BufferAttribute(cw, 3));
    const contour = new THREE.LineSegments(cwGeo, cyanM);
    contour.frustumCulled = false;
    contourRoot.add(contour);

    // ---------- etiquetas del sistema de agua ----------
    const pumpLabels = new LabelSet(4);
    pumpLabels.add('NORIA DE CANGILONES', 'CADENA SIN FIN · 25 m DE ALTURA', new THREE.Vector3(XC, 12, ZC), 0.36);
    pumpLabels.add('CISTERNA', 'RESERVA DE LA TERRAZA SUPERIOR', new THREE.Vector3(CX, CY + 2, CZ), 0.14);
    pumpLabels.add('CANAL DEL ÉUFRATES', 'DESDE EL RÍO HASTA EL POZO', new THREE.Vector3(CCX - 20, -0.4, ZC), -0.08);
    const screwMid2 = scrMid[Math.min(2, NSCR - 1)] || new THREE.Vector3(-5, 13, -27);
    pumpLabels.add('TEORÍA: TORNILLOS DE BRONCE (Senaquerib)', 'TORNILLOS INCLINADOS · ESCALÓN A ESCALÓN', screwMid2, -0.30);

    // ---------- actualización por fotograma ----------
    const _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _bm = new THREE.Matrix4(), _dm = new THREE.Matrix4();
    const _tmpT = new THREE.Matrix4(), _tmpS = new THREE.Matrix4(), _rm = new THREE.Matrix4(), _m = new THREE.Matrix4();
    const LS_W = [0.04, 0.22, 0.42, 0.6, 0.8];
    const REV = [[0, 0.14], [0.14, 0.34], [0.34, 0.56], [0.56, 0.74], [0.74, 1.0]];

    function update(s) {
      s = s || {};
      const t = num(s.t), wall = num(s.wall);
      const w = clamp01(num(s.waterproof)), xr = clamp01(num(s.xray));
      const pump = clamp01(num(s.pump)), water = clamp01(num(s.water));
      const screw = clamp01(num(s.screw)), dec = clamp01(num(s.decay));
      const ruin = dec > 0.5;                                  // la ruina oculta noria, tornillos y agua
      camera.updateMatrixWorld();
      const tanH = Math.tan(camera.fov * DEG * 0.5);

      // diagrama: aparece con la pista waterproof y se desvanece al cerrar el capítulo III
      const dfade = 1 - smooth(clamp01((t - 80.5) / 2));
      const dOn = w > 0.001 && dfade > 0.001;
      diagRoot.visible = dOn;
      diagLabels.root.visible = dOn;
      if (dOn) {
        for (let i = 0; i < dMats.length; i++) dMats[i].opacity = dfade;
        backM.opacity = 0.75 * dfade;
        outM.opacity = 0.8 * dfade;
        const rv = REV.map(function (r) { return smooth(clamp01((w - r[0]) / (r[1] - r[0]))); });
        vaultMesh.visible = rv[0] > 0.001;
        vaultMesh.scale.y = Math.max(0.001, rv[0]);
        for (let i = 0; i < layerMeshes.length; i++) {
          const r = rv[i + 1];
          layerMeshes[i].visible = r > 0.001;
          layerMeshes[i].scale.y = Math.max(0.001, r);
        }
        const ops = LS_W.map(function (ls) { return dfade * smooth(clamp01((w - ls) / 0.08)); });
        diagLabels.update(ops, tanH);
      }

      // pozo y noria: la sakia y el canal se construyen con la pista pump
      const pumpOn = pump > 0.001 && !ruin;
      pumpRoot.visible = pumpOn;
      contourRoot.visible = pumpOn && xr > 0.001;
      if (pumpOn) {
        const shift = wall * 0.02;
        for (let i = 0; i < NB; i++) {
          loopAt((i / NB + shift) * LOOP);
          _p.copy(_lp).addScaledVector(_ln, 0.55);
          _q.setFromUnitVectors(UP, _ln);
          _bm.compose(_p, _q, ONE);
          bucketMesh.setMatrixAt(i, _bm);
          const f = _full ? Math.max(0.001, smooth(water)) : 0.001;
          _dm.copy(_bm).multiply(_tmpT.makeTranslation(0, 0.22, 0)).multiply(_tmpS.makeScale(f, f, f));
          discMesh.setMatrixAt(i, _dm);
        }
        bucketMesh.instanceMatrix.needsUpdate = true;
        discMesh.instanceMatrix.needsUpdate = true;
        sakiaG.rotation.y = -wall * 0.24;
        for (let k = 0; k < 2; k++) {
          const th = wall * 0.12 + k * Math.PI;
          const x = SAK.x + SAK.R * Math.cos(th), z = SAK.z + SAK.R * Math.sin(th);
          const yaw = Math.atan2(-Math.sin(th), Math.cos(th));
          _m.makeRotationY(yaw);
          _m.setPosition(x, 0.04 * Math.abs(Math.sin(th * 12)), z);
          oxMesh.setMatrixAt(k, _m);
        }
        oxMesh.instanceMatrix.needsUpdate = true;
      }

      // agua: cisterna que se llena, gotas del chorro y canales
      const waterOn = water > 0.001 && !ruin;
      waterRoot.visible = waterOn;
      if (waterOn) {
        cisternWater.position.y = CY + 0.3 + 2.0 * water;
        const g = 0.9 * water;
        dropM.opacity = g;
        const x0 = XC, y0 = YT + RC + 0.1, z0 = ZC;
        const x1 = XC + HALF + 0.2, y1 = TOPY + 0.3, z1 = ZC;
        for (let i = 0; i < ND; i++) {
          const tau = fract(wall * 0.9 + i / ND);
          const arc = 0.9 * Math.sin(Math.PI * tau);
          dropPos[i * 3] = x0 + (x1 - x0) * tau;
          dropPos[i * 3 + 1] = y0 + (y1 - y0) * tau + arc;
          dropPos[i * 3 + 2] = z0 + (z1 - z0) * tau;
        }
        dropGeo.attributes.position.needsUpdate = true;
      }

      // tornillos de Arquímedes: aparecen con la pista screw; el agua gira con la hélice
      const scOn = screw > 0.01 && !ruin;
      screwRoot.visible = scOn;
      if (scOn) {
        bronzeScrM.opacity = screw;
        waterScrM.opacity = 0.85 * screw;
        for (let k = 0; k < NSCR; k++) {
          _rm.makeRotationY(wall * 1.2 + k * 0.9);
          _m.copy(scrBase[k]).multiply(_rm);
          bladeI.setMatrixAt(k, _m);
          waterI.setMatrixAt(k, _m);
        }
        bladeI.instanceMatrix.needsUpdate = true;
        waterI.instanceMatrix.needsUpdate = true;
      }

      // etiquetas del sistema de agua (cian, en el tercio derecho)
      const xrOp = pumpOn ? smooth(clamp01((xr - 0.25) / 0.4)) : 0;
      const scOp = scOn ? smooth(clamp01((screw - 0.45) / 0.3)) : 0;
      pumpLabels.root.visible = (pumpOn && xr > 0.001) || scOn;
      if (pumpLabels.root.visible) {
        pumpLabels.update([
          xrOp,
          xrOp * (water > 0.05 ? 1 : 0),
          xrOp,
          scOp
        ], tanH);
      }
    }

    return { update: update, group: root };
  };
})();
