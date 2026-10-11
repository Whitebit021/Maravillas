// Interior de la torre: rampa en espiral con muretes y bóvedas, pozo central con montacargas,
// burros con leña, escalera de caracol, hoguera y espejo de bronce en la linterna.
// Todo procedural: geometría fusionada, InstancedMesh, ShaderMaterial y CanvasTexture dibujadas por código.
(function () {
  'use strict';
  const G = window.GIZA;

  G.createInterior = function (ctx) {
    const THREE = ctx.THREE, scene = ctx.scene, camera = ctx.camera, renderer = ctx.renderer;
    const T = G.TOWER, RP = T.ramp, MIR = T.mirror;
    const DEG = Math.PI / 180;
    const SRGB = THREE.sRGBEncoding;
    const ADD = THREE.AdditiveBlending;
    const UP = new THREE.Vector3(0, 1, 0);

    const clamp = function (x, a, b) { return Math.max(a, Math.min(b, x)); };
    const clamp01 = function (x) { return clamp(x, 0, 1); };
    const smooth = function (x) { x = clamp01(x); return x * x * (3 - 2 * x); };
    const num = function (v, d) { return (typeof v === 'number' && isFinite(v)) ? v : (d || 0); };
    const fract = function (x) { return x - Math.floor(x); };

    // ---------- dimensiones derivadas de GIZA.TOWER ----------
    const Y0 = T.tier1.y0, Y1 = T.tier1.y1;                       // 6 .. 66
    const SIDES = Math.round((Y1 - Y0) / RP.rise) * 4;            // 10 vueltas x 4 lados = 40 lados
    const RISE = RP.rise / 4;                                     // 1.5 m por lado
    const HC = (RP.innerHalf + RP.outerHalf) / 2;                 // 8.0: eje del carril
    const LANE = RP.width / 2;                                    // 1.3: semiancho del carril
    const HIN = RP.innerHalf, HOUT = RP.outerHalf;                // 4.2 / 11.8
    const DECK = (HOUT - HIN) / 2;                                // 3.8: semiancho de la losa
    const SH = T.shaft.half;                                      // 3.2: hueco del pozo
    const PART = HIN - SH;                                        // 1.0: tabique del pozo
    const CORN = [[-1, -1], [1, -1], [1, 1], [-1, 1]];            // esquinas del cuadrado (unitario)
    const OUTN = [[0, -1], [1, 0], [0, 1], [-1, 0]];              // normales exteriores por lado
    const FOCAL = 1.5;                                            // distancia focal del espejo
    const DISH_R = MIR.radius;                                    // 2.6
    const DISH_D = DISH_R * DISH_R / (4 * FOCAL);                 // profundidad del paraboloide
    const FOCUS = new THREE.Vector3(0, MIR.y, -3.7);   // foco desplazado al norte de la linterna (lejos de la cámara de t171)              // foco = centro de la hoguera
    const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
    const NB = 20;                                                // burros
    const BURRO_S = 1.6;                                          // escala de los burros
    const PLAT_MIN = 7, PLAT_MAX = 60;

    function yOf(q) { return Y0 + q * RISE; }

    // punto del cuadrado de semilado H en la coordenada q (lado j, fracción f); out.y = 0
    const _cA = new THREE.Vector3(), _cB = new THREE.Vector3(), _cP = new THREE.Vector3();
    function sqPt(q, H, out) {
      q = clamp(q, 0, SIDES);
      const j = Math.min(Math.floor(q), SIDES - 1), f = q - j, k = j % 4;
      const a = CORN[k], b = CORN[(k + 1) % 4];
      out.set(H * (a[0] + (b[0] - a[0]) * f), 0, H * (a[1] + (b[1] - a[1]) * f));
      return out;
    }

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
    const ID = new THREE.Matrix4();
    function boxM(sx, sy, sz, cx, cy, cz, m, mergeTo) {
      const g = new THREE.BoxGeometry(sx, sy, sz);
      const mm = new THREE.Matrix4().makeTranslation(cx, cy, cz);
      if (m) mm.premultiply(m);
      mergeTo.add(g, mm);
      g.dispose();
    }

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
    function paintStone(g, w, h) {
      let seed = 11;
      const rnd = function () { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
      g.fillStyle = '#c9b68f'; g.fillRect(0, 0, w, h);
      const rows = 4, rh = h / rows, cols = 2, bw = w / cols;
      for (let r = 0; r < rows; r++) {
        const off = (r % 2) * bw / 2;
        for (let c = -1; c <= cols; c++) {
          for (let wrap = -1; wrap <= 1; wrap++) {
            const x = c * bw + off + wrap * w, y = r * rh;
            const tone = 0.9 + rnd() * 0.16;
            g.fillStyle = 'rgb(' + Math.round(201 * tone) + ',' + Math.round(182 * tone) + ',' + Math.round(143 * tone) + ')';
            g.fillRect(x + 2, y + 2, bw - 4, rh - 4);
          }
        }
      }
      for (let i = 0; i < 700; i++) {
        g.fillStyle = rnd() < 0.5 ? 'rgba(90,70,45,0.18)' : 'rgba(255,245,220,0.16)';
        g.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2, 1);
      }
    }
    function paintWood(g, w, h) {
      let seed = 5;
      const rnd = function () { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
      g.fillStyle = '#6f4726'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 46; i++) {
        const x0 = rnd() * w, amp = 1 + rnd() * 3, ph = rnd() * 6.28;
        g.strokeStyle = rnd() < 0.5 ? 'rgba(40,22,10,0.35)' : 'rgba(170,120,70,0.22)';
        g.lineWidth = 1 + rnd() * 2;
        g.beginPath();
        for (let y = 0; y <= h; y += 8) {
          const x = x0 + Math.sin(y * 0.05 + ph) * amp;
          if (y === 0) g.moveTo(x, y); else g.lineTo(x, y);
        }
        g.stroke();
      }
    }

    // ---------- entorno para reflejos metálicos (PMREM de un cielo degradado) ----------
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

    // ---------- materiales ----------
    const stoneTex = canvasTex(256, 256, paintStone);
    const woodTex = canvasTex(128, 256, paintWood);
    const rampMats = [];
    function fadeMat(m) { m.transparent = true; m.opacity = 0; rampMats.push(m); return m; }
    const stoneR = fadeMat(new THREE.MeshStandardMaterial({ map: stoneTex, color: 0xf2e6c8, roughness: 0.93, metalness: 0, side: THREE.DoubleSide }));
    const woodR = fadeMat(new THREE.MeshStandardMaterial({ map: woodTex, color: 0xffffff, roughness: 0.88, side: THREE.DoubleSide }));
    const ironR = fadeMat(new THREE.MeshStandardMaterial({ color: 0x4d4d55, metalness: 0.7, roughness: 0.45 }));
    const ropeR = fadeMat(new THREE.MeshStandardMaterial({ color: 0xbfa77a, roughness: 0.95 }));
    const winR = fadeMat(new THREE.MeshBasicMaterial({ color: 0x9fdcff, side: THREE.DoubleSide }));
    const figR = fadeMat(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }));
    const stairM = new THREE.MeshStandardMaterial({ map: stoneTex, color: 0xf0e2bf, roughness: 0.92 });
    const fireWoodM = new THREE.MeshStandardMaterial({ map: woodTex, color: 0x8a5a33, roughness: 0.85, emissive: 0xff5a1a, emissiveIntensity: 0 });
    const hearthIronM = new THREE.MeshStandardMaterial({ color: 0x2c2a2a, metalness: 0.6, roughness: 0.6 });
    const bronzeM = new THREE.MeshStandardMaterial({ color: 0xa8662c, metalness: 1, roughness: 0.3, envMap: envTex, envMapIntensity: 1.1, side: THREE.DoubleSide });
    const bronzeRimM = new THREE.MeshStandardMaterial({ color: 0x9a6230, metalness: 1, roughness: 0.3, envMap: envTex, envMapIntensity: 1.0 });
    const contourM = new THREE.LineBasicMaterial({ color: 0x7ff7ff, transparent: true, opacity: 0, blending: ADD, depthWrite: false });
    const labelLineBase = { transparent: true, opacity: 0, depthWrite: false, depthTest: false };

    const root = new THREE.Group(); scene.add(root);
    const rampRoot = new THREE.Group(); root.add(rampRoot);
    const stairRoot = new THREE.Group(); root.add(stairRoot);
    const fireRoot = new THREE.Group(); root.add(fireRoot);
    const mirrorRoot = new THREE.Group(); root.add(mirrorRoot);
    const labelRoot = new THREE.Group(); root.add(labelRoot);

    // ---------- muestras de la espiral ----------
    const QS = [];
    for (let j = 0; j < SIDES; j++) for (let i = 0; i < 8; i++) QS.push(j + i / 8);
    QS.push(SIDES);
    const _tmp = new THREE.Vector3();

    // barrido de un perfil [lateral, altura sobre el carril, u] a lo largo de la espiral
    function sweep(profile, closed) {
      const A = QS.length, P = profile.length;
      const pos = new Float32Array(A * P * 3), uv = new Float32Array(A * P * 2);
      for (let a = 0; a < A; a++) {
        const q = QS[a];
        for (let p = 0; p < P; p++) {
          const pr = profile[p];
          sqPt(q, HC + pr[0], _tmp);
          const o = a * P + p;
          pos[o * 3] = _tmp.x; pos[o * 3 + 1] = yOf(q) + pr[1]; pos[o * 3 + 2] = _tmp.z;
          uv[o * 2] = pr[2]; uv[o * 2 + 1] = q * 8;
        }
      }
      const ix = [], PE = closed ? P : P - 1;
      for (let a = 0; a < A - 1; a++) for (let p = 0; p < PE; p++) {
        const p2 = (p + 1) % P;
        const i00 = a * P + p, i10 = (a + 1) * P + p, i11 = (a + 1) * P + p2, i01 = a * P + p2;
        ix.push(i00, i10, i11, i00, i11, i01);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      g.setIndex(ix);
      g.computeVertexNormals();
      return g;
    }

    // ---------- rampa: losas, muretes, bóvedas, tabiques, pisos y ventanas (piedra) ----------
    const stoneMerge = new Merge();
    stoneMerge.add(sweep([[-LANE, 0, 0], [LANE, 0, 1]], false), ID);     // losa del carril (solo la rampa)
    stoneMerge.add(sweep([[LANE, -0.5, 1], [-LANE, -0.5, 0]], false), ID); // cara inferior del carril
    // bóveda de cañón rebajada sobre el carril (con sus muretes): semitransparente con xray
    const vaultMerge = new Merge();
    vaultMerge.add(sweep([[-LANE - 0.2, 0, 0], [-LANE + 0.2, 0, 0.5], [-LANE + 0.2, 1.0, 0.5], [-LANE - 0.2, 1.0, 0]], true), ID);
    vaultMerge.add(sweep([[LANE - 0.2, 0, 0], [LANE + 0.2, 0, 0.2], [LANE + 0.2, 1.0, 0.2], [LANE - 0.2, 1.0, 0]], true), ID);
    const vaultP = [];
    for (let i = 0; i <= 9; i++) {
      const th = Math.PI * i / 9;
      vaultP.push([-LANE * Math.cos(th), 1.0 + 2.4 * Math.sin(th), i / 9]);
    }
    vaultMerge.add(sweep(vaultP, false), ID);

    // tabiques del pozo (1 m de grosor) y pisos de la planta baja y de la cima
    const shaftH = Y1 - Y0, shaftMid = (Y0 + Y1) / 2;
    boxM(PART, shaftH, 2 * SH + 2 * PART, SH + PART / 2, shaftMid, 0, null, stoneMerge);
    boxM(PART, shaftH, 2 * SH + 2 * PART, -(SH + PART / 2), shaftMid, 0, null, stoneMerge);
    boxM(2 * SH + 2 * PART, shaftH, PART, 0, shaftMid, SH + PART / 2, null, stoneMerge);
    boxM(2 * SH + 2 * PART, shaftH, PART, 0, shaftMid, -(SH + PART / 2), null, stoneMerge);
    function floorRing(yTop) {
      const cy = yTop - 0.1, th = 0.2;
      boxM(2 * HOUT, th, HOUT - HIN, 0, cy, -(HOUT + HIN) / 2, null, stoneMerge);
      boxM(2 * HOUT, th, HOUT - HIN, 0, cy, (HOUT + HIN) / 2, null, stoneMerge);
      boxM(HOUT - HIN, th, 2 * HIN, -(HOUT + HIN) / 2, cy, 0, null, stoneMerge);
      boxM(HOUT - HIN, th, 2 * HIN, (HOUT + HIN) / 2, cy, 0, null, stoneMerge);
    }

    // ventanas en el muro exterior (una por lado y vuelta) con dintel y alféizar
    const winMerge = new Merge();
    const _wm = new THREE.Matrix4(), _wt = new THREE.Vector3(), _wi = new THREE.Vector3(), _wp = new THREE.Vector3();
    const planeW = new THREE.PlaneGeometry(1.4, 1.4);
    const boxSill = new THREE.BoxGeometry(1.8, 0.12, 0.5);
    for (let j = 0; j < SIDES; j++) {
      const k = j % 4, a = CORN[k], b = CORN[(k + 1) % 4];
      _wt.set(b[0] - a[0], 0, b[1] - a[1]).normalize();
      _wi.set(-OUTN[k][0], 0, -OUTN[k][1]);                          // hacia el interior
      const q = j + 0.5, yq = yOf(q);
      sqPt(q, HOUT - 0.12, _wp);
      _wm.makeBasis(_wt, UP, _wi);
      const mW = _wm.clone().setPosition(_wp.x, yq + 2.0, _wp.z);
      winMerge.add(planeW, mW);
      const mS = _wm.clone().setPosition(_wp.x + _wi.x * 0.25, yq + 1.26, _wp.z + _wi.z * 0.25);
      stoneMerge.add(boxSill, mS);
      const mL = _wm.clone().setPosition(_wp.x + _wi.x * 0.2, yq + 2.76, _wp.z + _wi.z * 0.2);
      stoneMerge.add(new THREE.BoxGeometry(1.8, 0.12, 0.4), mL);
    }

    // madera del pozo fija: postes, viga y cuerda
    const woodMerge = new Merge();
    boxM(0.3, 3.8, 0.3, -3.7, 67.9, 0, null, woodMerge);
    boxM(0.3, 3.8, 0.3, 3.7, 67.9, 0, null, woodMerge);
    boxM(7.7, 0.4, 0.4, 0, 69.8, 0, null, woodMerge);
    const ironMerge = new Merge();
    {
      const wheel = new THREE.CylinderGeometry(0.55, 0.55, 0.3, 18).rotateX(Math.PI / 2);
      ironMerge.add(wheel, new THREE.Matrix4().makeTranslation(0, 68.9, 0));
      const axle = new THREE.CylinderGeometry(0.08, 0.08, 0.5, 8).rotateZ(Math.PI / 2);
      ironMerge.add(axle, new THREE.Matrix4().makeTranslation(0, 68.9, 0));
    }

    // plataforma del montacargas (se mueve; sus troncos van dentro del grupo)
    const platform = new THREE.Group();
    const platMerge = new Merge();
    boxM(2.6, 0.25, 2.6, 0, 0.125, 0, null, platMerge);
    for (let L = 0; L < 2; L++) {
      for (let c = -1; c <= 1; c++) {
        const lg = new THREE.CylinderGeometry(0.18, 0.18, 2.4, 10).rotateZ(Math.PI / 2);
        platMerge.add(lg, new THREE.Matrix4().makeTranslation(0, 0.25 + 0.18 + L * 0.34, c * 0.72));
      }
    }
    platform.add(new THREE.Mesh(platMerge.geometry(), woodR));
    platform.add(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(2.9, 2.6, 2.9)).translate(0, 1.3, 0), contourM));
    const ropeGeo = new THREE.BoxGeometry(0.07, 1, 0.07).translate(0, 0.5, 0);
    const rope = new THREE.Mesh(ropeGeo, ropeR);
    const rampStatic = new THREE.Group();
    rampStatic.add(new THREE.Mesh(stoneMerge.geometry(), stoneR));
    rampStatic.add(new THREE.Mesh(winMerge.geometry(), winR));
    rampStatic.add(new THREE.Mesh(woodMerge.geometry(), woodR));
    rampStatic.add(new THREE.Mesh(ironMerge.geometry(), ironR));
    const vaultR = new THREE.MeshStandardMaterial({ map: stoneTex, color: 0xf2e6c8, roughness: 0.93, side: THREE.DoubleSide, transparent: true, opacity: 0, depthWrite: false });
    const vaultMesh = new THREE.Mesh(vaultMerge.geometry(), vaultR);
    rampRoot.add(rampStatic, vaultMesh, platform, rope);
    rope.frustumCulled = false;

    // ---------- contornos cian de la rampa y del pozo ----------
    const cPts = [];
    const _cq = new THREE.Vector3(), _cprev = new THREE.Vector3();
    function polyline(H, dy) {
      let has = false;
      for (let a = 0; a < QS.length; a++) {
        sqPt(QS[a], H, _cq);
        const x = _cq.x, y = yOf(QS[a]) + dy, z = _cq.z;
        if (has) cPts.push(_cprev.x, _cprev.y, _cprev.z, x, y, z);
        _cprev.set(x, y, z); has = true;
      }
    }
    polyline(HC - LANE, 0); polyline(HC + LANE, 0);
    polyline(HC - LANE, 1.0); polyline(HC + LANE, 1.0); polyline(HC, 3.4); polyline(HC, 0);
    {
      const s = SH, ys = [Y0, Y1];
      for (let c = 0; c < 4; c++) {
        const sx = (c % 2 ? 1 : -1) * s, sz = (c < 2 ? -1 : 1) * s;
        cPts.push(sx, Y0, sz, sx, Y1, sz);
      }
      ys.forEach(function (y) {
        const cs = [[-s, -s], [s, -s], [s, s], [-s, s]];
        for (let i = 0; i < 4; i++) {
          const a = cs[i], b = cs[(i + 1) % 4];
          cPts.push(a[0], y, a[1], b[0], y, b[1]);
        }
      });
    }
    const contourGeo = new THREE.BufferGeometry();
    contourGeo.setAttribute('position', new THREE.Float32BufferAttribute(cPts, 3));
    const contour = new THREE.LineSegments(contourGeo, contourM);
    contour.frustumCulled = false;
    rampRoot.add(contour);

    // ---------- burros y conductores (InstancedMesh con colores por vértice) ----------
    const burroMerge = new Merge();
    const cBurro = new THREE.Color(0x6f4a2c), cLeg = new THREE.Color(0x4f3420), cLog = new THREE.Color(0xb07b43), cHead = new THREE.Color(0x5a3a22);
    burroMerge.add(new THREE.BoxGeometry(0.55, 0.5, 1.15), new THREE.Matrix4().makeTranslation(0, 0.85, 0), cBurro);
    [[-0.2, -0.42], [0.2, -0.42], [-0.2, 0.42], [0.2, 0.42]].forEach(function (p) {
      burroMerge.add(new THREE.BoxGeometry(0.14, 0.7, 0.14), new THREE.Matrix4().makeTranslation(p[0], 0.35, p[1]), cLeg);
    });
    burroMerge.add(new THREE.BoxGeometry(0.22, 0.5, 0.32), new THREE.Matrix4().makeRotationX(-0.4).setPosition(0, 1.05, 0.66), cBurro);
    burroMerge.add(new THREE.BoxGeometry(0.26, 0.3, 0.46), new THREE.Matrix4().makeTranslation(0, 1.22, 0.92), cHead);
    // carga de leña: troncos sobre el lomo
    const logPos = [[-0.2, 1.22, 0], [0, 1.22, 0], [0.2, 1.22, 0], [-0.1, 1.42, 0], [0.1, 1.42, 0]];
    logPos.forEach(function (p, i) {
      const lg = new THREE.CylinderGeometry(0.11, 0.11, 1.5, 8).rotateX(Math.PI / 2);
      burroMerge.add(lg, new THREE.Matrix4().makeTranslation(p[0], p[1], p[2]), i % 2 ? cLog : new THREE.Color(0x9a6a3a));
    });
    const burroGeo = burroMerge.geometry();
    const burroMesh = new THREE.InstancedMesh(burroGeo, figR, NB);
    burroMesh.frustumCulled = false;
    burroMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    const condMerge = new Merge();
    const cTunic = new THREE.Color(0x8c6a48), cSkin = new THREE.Color(0xd6a27a), cHat = new THREE.Color(0x3a2a1c);
    condMerge.add(new THREE.CylinderGeometry(0.17, 0.2, 1.1, 10), new THREE.Matrix4().makeTranslation(0, 0.55, 0), cTunic);
    condMerge.add(new THREE.SphereGeometry(0.13, 12, 10), new THREE.Matrix4().makeTranslation(0, 1.3, 0), cSkin);
    condMerge.add(new THREE.CylinderGeometry(0.17, 0.17, 0.05, 12), new THREE.Matrix4().makeTranslation(0, 1.42, 0), cHat);
    const condMesh = new THREE.InstancedMesh(condMerge.geometry(), figR, NB);
    condMesh.frustumCulled = false;
    condMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    rampRoot.add(burroMesh, condMesh);

    const Q0 = [];
    for (let i = 0; i < NB; i++) Q0.push((i + 0.5) * SIDES / NB);

    // ---------- escalera de caracol (InstancedMesh: escalones y núcleos por tramos) ----------
    const stairTops = [], stairBase = [];
    function stairInst(top, m) { stairBase.push(m); stairTops.push(top); }
    function addStep(rMin, rMax, tw, top, h, theta) {
      const L = rMax - rMin, rMid = (rMin + rMax) / 2;
      const m = new THREE.Matrix4().makeRotationY(-theta);
      m.setPosition(rMid * Math.cos(theta), top - h / 2, rMid * Math.sin(theta));
      m.multiply(new THREE.Matrix4().makeScale(L, h, tw));
      stairInst(top, m);
    }
    function addCore(rad, y0, y1) {
      const h = y1 - y0, m = new THREE.Matrix4().makeTranslation(0, y0 + h / 2, 0);
      m.multiply(new THREE.Matrix4().makeScale(2 * rad, h, 2 * rad));
      stairInst(y1, m);
    }
    // octógono: 120 escalones (20 por vuelta, 6 vueltas) de 66 a 96 m, núcleo de 1.2 m
    for (let i = 0; i < 120; i++) addStep(1.2, 6.0, 1.1, 66 + 0.25 * (i + 1), 0.25, i * 18 * DEG);
    for (let c = 0; c < 6; c++) addCore(1.2, 66 + 5 * c, 66 + 5 * (c + 1));
    // cilindro: 60 escalones (12 por vuelta, 5 vueltas) de 96 a 111 m, núcleo de 0.8 m
    for (let i = 0; i < 60; i++) addStep(0.8, 3.9, 1.15, 96 + 0.25 * (i + 1), 0.25, i * 30 * DEG);
    for (let c = 0; c < 5; c++) addCore(0.8, 96 + 3 * c, 96 + 3 * (c + 1));
    const stairMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), stairM, stairTops.length);
    stairMesh.frustumCulled = false;
    const stairState = new Uint8Array(stairTops.length).fill(255);
    stairRoot.add(stairMesh);
    // pisos de la octogonal y del cilindro (a 96 m), con su anillo
    const floorMerge = new Merge();
    floorMerge.add(new THREE.RingGeometry(4.6, 8.4, 48).rotateX(-Math.PI / 2), new THREE.Matrix4().makeTranslation(0, 96.02, 0));
    floorMerge.add(new THREE.CircleGeometry(4.0, 32).rotateX(-Math.PI / 2), new THREE.Matrix4().makeTranslation(0, 96.02, 0));
    const floorMesh = new THREE.Mesh(floorMerge.geometry(), stairM);
    stairRoot.add(floorMesh);

    // ---------- hoguera: parrilla, leños, llamas (shader), chispas y humo ----------
    const hearth = new Merge();
    hearth.add(new THREE.BoxGeometry(2.2, 0.12, 2.2), new THREE.Matrix4().makeTranslation(FOCUS.x, 111.36, FOCUS.z));
    fireRoot.add(new THREE.Mesh(hearth.geometry(), hearthIronM));
    const logs = new Merge();
    for (let i = 0; i < 6; i++) {
      const lg = new THREE.CylinderGeometry(0.16, 0.16, 1.8, 8);
      const m = new THREE.Matrix4();
      if (i % 2) m.makeRotationX(Math.PI / 2); else m.makeRotationZ(Math.PI / 2);
      m.setPosition(FOCUS.x + (i % 2 ? 0 : (i - 2.5) * 0.12), 111.6 + Math.floor(i / 3) * 0.32 + 0.16 + (i % 2 ? 0.05 : 0), FOCUS.z + (i % 2 ? (i - 2.5) * 0.14 : 0));
      logs.add(lg, m);
    }
    fireRoot.add(new THREE.Mesh(logs.geometry(), fireWoodM));

    const flameVS = [
      'varying vec2 vUv;',
      'void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }'
    ].join('\n');
    const flameFS = [
      'uniform float uTime; uniform float uI; uniform float uCore;',
      'varying vec2 vUv;',
      'void main(){',
      '  float h = vUv.y;',
      '  float x = (vUv.x - 0.5) * 2.0;',
      '  float n1 = sin(h * 7.0 - uTime * 9.0 + vUv.x * 6.0) * 0.5 + 0.5;',
      '  float n2 = sin(h * 15.0 - uTime * 13.0 + vUv.x * 11.0) * 0.5 + 0.5;',
      '  float wob = (n1 * 0.22 + n2 * 0.10) * (0.4 + h);',
      '  float w = (1.0 - h * 0.9) * (0.5 + uCore * 0.12);',
      '  float edge = 1.0 - smoothstep(w + wob - 0.35, w + wob + 0.05, abs(x));',
      '  float tip = 1.0 - smoothstep(0.25, 1.0, h + n2 * 0.12);',
      '  float base = smoothstep(0.0, 0.08, h);',
      '  float a = edge * tip * base * uI;',
      '  vec3 hot = vec3(1.0, 0.8, 0.44);',
      '  vec3 mid = vec3(0.95, 0.42, 0.1);',
      '  vec3 low = vec3(0.7, 0.18, 0.04);',
      '  vec3 col = mix(hot, mid, smoothstep(0.0, 0.5, h + n1 * 0.1));',
      '  col = mix(col, low, smoothstep(0.5, 1.0, h));',
      '  gl_FragColor = vec4(col, a);',
      '}'
    ].join('\n');
    function flameMat(core) {
      return new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uI: { value: 0 }, uCore: { value: core ? 1 : 0 } },
        vertexShader: flameVS, fragmentShader: flameFS,
        transparent: true, depthWrite: false, blending: ADD, side: THREE.DoubleSide
      });
    }
    const flameOuter = new Merge(), flameInner = new Merge();
    for (let i = 0; i < 4; i++) {
      const ang = i * 45 * DEG;
      const mR = new THREE.Matrix4().makeRotationY(ang);
      const mo = mR.clone().premultiply(new THREE.Matrix4().makeTranslation(FOCUS.x, FOCUS.y - 2.2, FOCUS.z));
      flameOuter.add(new THREE.PlaneGeometry(2.8, 4.4).translate(0, 2.2, 0), mo);
      const mi = new THREE.Matrix4().makeRotationY(ang + 22 * DEG).premultiply(new THREE.Matrix4().makeTranslation(FOCUS.x, FOCUS.y - 2.2, FOCUS.z));
      flameInner.add(new THREE.PlaneGeometry(1.5, 3.0).translate(0, 1.6, 0), mi);
    }
    const flameMatO = flameMat(false), flameMatI = flameMat(true);
    fireRoot.add(new THREE.Mesh(flameOuter.geometry(), flameMatO));
    fireRoot.add(new THREE.Mesh(flameInner.geometry(), flameMatI));

    const ptVS = [
      'attribute float aSize; attribute float aAlpha;',
      'uniform float uScale;',
      'varying float vA;',
      'void main(){',
      '  vec4 mv = modelViewMatrix * vec4(position, 1.0);',
      '  gl_PointSize = aSize * uScale / max(0.1, -mv.z);',
      '  vA = aAlpha;',
      '  gl_Position = projectionMatrix * mv;',
      '}'
    ].join('\n');
    const ptFS = [
      'uniform vec3 uColor; uniform float uOpacity;',
      'varying float vA;',
      'void main(){',
      '  vec2 c = gl_PointCoord - 0.5;',
      '  float d = length(c) * 2.0;',
      '  float a = (1.0 - smoothstep(0.0, 1.0, d)) * vA * uOpacity;',
      '  gl_FragColor = vec4(uColor, a);',
      '}'
    ].join('\n');
    function makePoints(n, color, additive) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
      geo.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(n), 1));
      geo.setAttribute('aAlpha', new THREE.BufferAttribute(new Float32Array(n), 1));
      const mat = new THREE.ShaderMaterial({
        uniforms: { uScale: { value: 300 }, uColor: { value: new THREE.Color(color) }, uOpacity: { value: 0 } },
        vertexShader: ptVS, fragmentShader: ptFS,
        transparent: true, depthWrite: false, blending: additive ? ADD : THREE.NormalBlending
      });
      const p = new THREE.Points(geo, mat);
      p.frustumCulled = false;
      return p;
    }
    const SPARKS = 90, SMOKE = 36;
    let pseed = 3;
    const prnd = function () { pseed = (pseed * 16807) % 2147483647; return pseed / 2147483647; };
    const sparkPh = new Float32Array(SPARKS), sparkDx = new Float32Array(SPARKS), sparkDz = new Float32Array(SPARKS);
    for (let i = 0; i < SPARKS; i++) { sparkPh[i] = prnd(); sparkDx[i] = (prnd() * 2 - 1) * 0.6; sparkDz[i] = (prnd() * 2 - 1) * 0.6; }
    const smokePh = new Float32Array(SMOKE), smokeDx = new Float32Array(SMOKE), smokeDz = new Float32Array(SMOKE);
    for (let i = 0; i < SMOKE; i++) { smokePh[i] = prnd(); smokeDx[i] = (prnd() * 2 - 1) * 0.8; smokeDz[i] = (prnd() * 2 - 1) * 0.8; }
    const sparks = makePoints(SPARKS, 0xffb35a, true);
    const smoke = makePoints(SMOKE, 0x6c6660, false);
    fireRoot.add(sparks, smoke);

    const glowCv = document.createElement('canvas'); glowCv.width = glowCv.height = 128;
    {
      const gc = glowCv.getContext('2d');
      const gr = gc.createRadialGradient(64, 64, 0, 64, 64, 64);
      gr.addColorStop(0, 'rgba(255,190,110,1)');
      gr.addColorStop(0.25, 'rgba(255,120,40,0.55)');
      gr.addColorStop(1, 'rgba(255,80,20,0)');
      gc.fillStyle = gr; gc.fillRect(0, 0, 128, 128);
    }
    const glowTex = new THREE.CanvasTexture(glowCv);
    glowTex.encoding = SRGB;
    const glowMat = new THREE.SpriteMaterial({ map: glowTex, transparent: true, opacity: 0, blending: ADD, depthWrite: false });
    const glow = new THREE.Sprite(glowMat);
    glow.position.copy(FOCUS);
    glow.scale.set(16, 16, 1);
    glow.frustumCulled = false;
    fireRoot.add(glow);

    // una PointLight naranja (siempre en escena; su intensidad se anula cuando no hay fuego)
    const fireLight = new THREE.PointLight(0xff8a2a, 0, 70, 2);
    fireLight.position.set(FOCUS.x, FOCUS.y - 0.5, FOCUS.z);
    fireRoot.add(fireLight);

    // ---------- espejo de bronce cóncavo (pivote en el foco; mira al mar, −Z) ----------
    const mirrorPivot = new THREE.Group();
    mirrorPivot.position.copy(FOCUS);
    mirrorRoot.add(mirrorPivot);
    {
      const NR = 14, NT = 64;
      const pos = [], ix = [];
      for (let i = 0; i <= NR; i++) {
        const r = DISH_R * i / NR;
        for (let j = 0; j < NT; j++) {
          const th = 2 * Math.PI * j / NT;
          // vértice en z = FOCAL (lado +Z), borde en z = FOCAL − profundidad; abre hacia −Z
          pos.push(r * Math.cos(th), r * Math.sin(th), FOCAL - DISH_D * (r / DISH_R) * (r / DISH_R));
        }
      }
      for (let i = 0; i < NR; i++) for (let j = 0; j < NT; j++) {
        const a = i * NT + j, b = i * NT + (j + 1) % NT, c = (i + 1) * NT + (j + 1) % NT, d = (i + 1) * NT + j;
        ix.push(a, b, c, a, c, d);
      }
      const dg = new THREE.BufferGeometry();
      dg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      dg.setIndex(ix);
      dg.computeVertexNormals();
      mirrorPivot.add(new THREE.Mesh(dg, bronzeM));
      const rim = new THREE.Mesh(new THREE.TorusGeometry(DISH_R, 0.09, 10, 72), bronzeRimM);
      rim.position.z = FOCAL - DISH_D;
      mirrorPivot.add(rim);
      const hub = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 10), bronzeRimM);
      hub.position.z = FOCAL;
      mirrorPivot.add(hub);
    }

    // ---------- etiquetas 3D (xray) fuera de las zonas del HUD ----------
    const labels = [];
    function makeLabelTex(text, sub, color) {
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
      const tex = new THREE.CanvasTexture(cv);
      tex.encoding = SRGB;
      tex.minFilter = THREE.LinearFilter;
      tex.generateMipmaps = false;
      return { tex: tex, aspect: cv.width / cv.height };
    }
    function addLabel(text, sub, anchor, slot) {
      const cv = makeLabelTex(text, sub, '#7ff7ff');
      const mat = new THREE.SpriteMaterial({ map: cv.tex, transparent: true, opacity: 0, depthTest: false, depthWrite: false });
      const sp = new THREE.Sprite(mat);
      sp.frustumCulled = false;
      const lm = new THREE.LineBasicMaterial(Object.assign({ color: 0x7ff7ff }, labelLineBase));
      const lpos = new Float32Array(6);
      const lg = new THREE.BufferGeometry();
      lg.setAttribute('position', new THREE.BufferAttribute(lpos, 3));
      const ln = new THREE.Line(lg, lm);
      ln.frustumCulled = false;
      labelRoot.add(sp, ln);
      labels.push({ sp: sp, mat: mat, ln: ln, lm: lm, lpos: lpos, anchor: anchor.clone(), aspect: cv.aspect, slot: slot });
    }
    // anclajes: rampa (lado este, q=21.5), pozo (centro), burros (lado sur, q=6.5); cada rótulo en su franja vertical
    sqPt(21.5, HC, _cP); addLabel('RAMPA EN ESPIRAL', '10 VUELTAS · 6 m POR VUELTA', new THREE.Vector3(_cP.x, yOf(21.5), _cP.z), -0.03);
    addLabel('POZO CENTRAL · MONTACARGAS', 'CUERDA, POLEA Y PLATAFORMA DE LEÑA', new THREE.Vector3(0, 44, 0), 0.23);
    sqPt(6.5, HC, _cP); addLabel('BURROS CON LEÑA', 'SUBEN HASTA LA ALTURA CONSTRUIDA', new THREE.Vector3(_cP.x, yOf(6.5) + 1.5, _cP.z), -0.28);

    const BOX = { x0: -0.42, x1: 0.72, y0: -0.45, y1: 0.3 };   // zona libre del HUD (NDC)
    const _ndc = new THREE.Vector3(), _lb = new THREE.Vector3(); const _dir = new THREE.Vector3();
    const DEG_HALF = Math.tan(camera.fov * DEG / 2);
    function labelUpdate(L, alpha) {
      L.mat.opacity = alpha; L.lm.opacity = alpha * 0.7;
      if (alpha < 0.002) return;
      _ndc.copy(L.anchor).project(camera);
      if (_ndc.z > 1) { L.mat.opacity = 0; L.lm.opacity = 0; return; }
      const cx = clamp(_ndc.x, BOX.x0, BOX.x1), cy = clamp(L.slot, BOX.y0, BOX.y1);
      // punto por rayo a la distancia real del anclaje (evita la imprecisión de unproject con profundidad ~1)
      const dA = Math.max(1, camera.position.distanceTo(L.anchor));
      _dir.set(cx, cy, 0.5).unproject(camera).sub(camera.position).normalize();
      _lb.copy(camera.position).addScaledVector(_dir, dA);
      const d = dA;
      let hgt = clamp(d * 0.045, 1.5, 9);
      hgt = Math.min(hgt, 0.5 * d * DEG_HALF * camera.aspect / L.aspect);
      L.sp.scale.set(hgt * L.aspect, hgt, 1);
      L.sp.position.copy(_lb);
      const arr = L.lpos;
      arr[0] = L.anchor.x; arr[1] = L.anchor.y; arr[2] = L.anchor.z;
      arr[3] = _lb.x; arr[4] = _lb.y; arr[5] = _lb.z;
      L.ln.geometry.attributes.position.needsUpdate = true;
    }

    // ---------- actualizaciones por fotograma ----------
    const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _f = new THREE.Vector3(), _x = new THREE.Vector3();
    const _p = new THREE.Vector3(), _m = new THREE.Matrix4(), _sc = new THREE.Matrix4(), _cm = new THREE.Matrix4(), _ct = new THREE.Matrix4();
    _ct.makeTranslation(0.55, 0, 1.5);

    function updateFigures(wall, buildH) {
      for (let i = 0; i < NB; i++) {
        const q = fract((Q0[i] + wall * 0.06) / SIDES) * SIDES;
        const yy = yOf(q);
        const vis = yy + 1.6 <= buildH + 0.5;
        const fade = smooth(Math.min(q / 1.5, 1)) * smooth(Math.min((SIDES - q) / 1.5, 1));
        if (!vis || fade < 0.01) {
          burroMesh.setMatrixAt(i, ZERO); condMesh.setMatrixAt(i, ZERO);
          continue;
        }
        sqPt(q + 0.05, HC, _a); sqPt(q - 0.05, HC, _b);
        _f.subVectors(_a, _b); _f.y = 0; _f.normalize();
        _x.crossVectors(UP, _f);
        sqPt(q, HC, _p); _p.y = yy;
        _m.makeBasis(_x, UP, _f);
        _m.setPosition(_p.x, _p.y, _p.z);
        _sc.makeScale(fade * BURRO_S, fade * BURRO_S, fade * BURRO_S);
        _cm.copy(_m).multiply(_ct).multiply(new THREE.Matrix4().makeScale(fade, fade, fade));
        _m.multiply(_sc);
        burroMesh.setMatrixAt(i, _m);
        condMesh.setMatrixAt(i, _cm);
      }
      burroMesh.instanceMatrix.needsUpdate = true;
      condMesh.instanceMatrix.needsUpdate = true;
    }

    function updateStairs(buildH) {
      let dirty = false;
      for (let i = 0; i < stairTops.length; i++) {
        const want = stairTops[i] <= buildH + 0.01 ? 1 : 0;
        if (stairState[i] === want) continue;
        stairState[i] = want;
        stairMesh.setMatrixAt(i, want ? stairBase[i] : ZERO);
        dirty = true;
      }
      if (dirty) stairMesh.instanceMatrix.needsUpdate = true;
    }

    function updateParticles(wall, fire) {
      const sp = sparks.geometry.attributes, sa = sp.position.array, sz = sp.aSize.array, sal = sp.aAlpha.array;
      for (let i = 0; i < SPARKS; i++) {
        const p = fract(wall * 0.65 + sparkPh[i]);
        sa[i * 3] = sparkDx[i] + Math.sin(wall * 3 + sparkPh[i] * 9) * 0.5 * p;
        sa[i * 3 + 1] = FOCUS.y - 2.0 + p * 8.0;
        sa[i * 3 + 2] = FOCUS.z + sparkDz[i] + Math.cos(wall * 2.7 + sparkPh[i] * 5) * 0.4 * p;
        sz[i] = 0.07 + 0.06 * (1 - p);
        sal[i] = (1 - p) * (1 - p) * (p > 0.03 ? 1 : 0);
      }
      sp.position.needsUpdate = true; sp.aSize.needsUpdate = true; sp.aAlpha.needsUpdate = true;
      const sm = smoke.geometry.attributes, ma = sm.position.array, msz = sm.aSize.array, mal = sm.aAlpha.array;
      for (let i = 0; i < SMOKE; i++) {
        const p = fract(wall * 0.045 + smokePh[i]);
        const spread = 0.6 + 3 * p;
        ma[i * 3] = FOCUS.x + smokeDx[i] + Math.sin(wall * 0.5 + smokePh[i] * 7) * spread;
        ma[i * 3 + 1] = FOCUS.y + 1.5 + p * 11;
        ma[i * 3 + 2] = FOCUS.z + smokeDz[i] + Math.cos(wall * 0.4 + smokePh[i] * 5) * spread;
        msz[i] = 1.0 + 6 * p;
        mal[i] = Math.sin(p * Math.PI) * 0.4;
      }
      sm.position.needsUpdate = true; sm.aSize.needsUpdate = true; sm.aAlpha.needsUpdate = true;
      sparks.material.uniforms.uOpacity.value = fire;
      smoke.material.uniforms.uOpacity.value = fire;
    }

    function update(s) {
      const wall = num(s.wall), ramp = clamp01(num(s.ramp)), xray = clamp01(num(s.xray));
      const fire = clamp01(num(s.fire)), mir = clamp01(num(s.mirror)), beam = clamp01(num(s.beam));
      const buildH = num(s.build, 0) * T.H;
      const collapsed = num(s.collapse) > 0.3, gone = num(s.citadel) > 0.5;
      const rampA = smooth(ramp);
      const scaleBase = renderer.domElement.height * 0.5 / Math.tan(camera.fov * DEG * 0.5);
      sparks.material.uniforms.uScale.value = scaleBase;
      smoke.material.uniforms.uScale.value = scaleBase;

      // rampa, pozo, burros, conductores
      rampRoot.visible = ramp > 0.001 && !gone;
      if (rampRoot.visible) {
        for (let i = 0; i < rampMats.length; i++) rampMats[i].opacity = rampA;
        winR.opacity = rampA * 0.9;
        vaultR.opacity = rampA * (0.85 - 0.6 * xray);   // la bóveda se vuelve translúcida con xray: se ven los burros
        contourM.opacity = rampA * 0.9 * (0.4 + 0.6 * xray);
        const platY = PLAT_MIN + (PLAT_MAX - PLAT_MIN) * 0.5 * (1 - Math.cos(wall * 0.25));
        platform.position.y = platY;
        const top = 68.35, bottom = platY + 0.3;
        rope.position.set(0, bottom, 0);
        rope.scale.set(1, Math.max(0.01, top - bottom), 1);
        updateFigures(wall, buildH);
      }
      labelRoot.visible = ramp > 0.001 && !gone && !collapsed;
      if (labelRoot.visible) {
        const la = rampA * smooth(xray / 0.6);
        for (let i = 0; i < labels.length; i++) labelUpdate(labels[i], la);
      }

      // escalera de caracol: cada tramo aparece al alcanzar su altura construida
      stairRoot.visible = !collapsed && !gone;
      if (stairRoot.visible) {
        updateStairs(buildH);
        floorMesh.visible = buildH >= 96 - 0.01;
      }

      // hoguera y espejo
      fireRoot.visible = fire > 0.001 && !collapsed && !gone;
      if (fireRoot.visible) {
        const flick = 0.92 + 0.08 * Math.sin(wall * 19.0) + 0.04 * Math.sin(wall * 5.3);
        flameMatO.uniforms.uTime.value = wall;
        flameMatI.uniforms.uTime.value = wall;
        flameMatO.uniforms.uI.value = fire * 0.8 * flick;
        flameMatI.uniforms.uI.value = fire * 0.7 * flick;
        fireWoodM.emissiveIntensity = fire * 0.55 * flick;
        fireLight.intensity = fire * 90 * flick;
        glowMat.opacity = fire * (0.3 + 0.06 * Math.sin(wall * 6.3));
        updateParticles(wall, fire);
      } else {
        fireLight.intensity = 0;
      }
      mirrorRoot.visible = mir > 0.001 && !collapsed && !gone;
      if (mirrorRoot.visible) {
        mirrorPivot.scale.setScalar(Math.max(0.001, smooth(mir)));
        mirrorPivot.rotation.y = 0.3 * Math.sin(wall * 0.18) * smooth(beam);
      }
    }

    return { update: update, group: root };
  };
})();
