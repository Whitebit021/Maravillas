// Interior del Coloso: fustes de sillares de caliza, armazón de hierro, lastre de piedras y etiquetas.
// Coordenadas locales de la estatua (y=0 en la cara del pedestal); el grupo sube COL.baseY metros.
(function () {
  'use strict';
  const G = window.GIZA;

  G.createInterior = function (ctx) {
    const THREE = ctx.THREE, scene = ctx.scene, camera = ctx.camera;
    const COL = G.COL;
    const BASE = COL.baseY;   // local y=0 -> mundo y=15
    const HT = COL.height;    // 33 m
    const DEG = Math.PI / 180;
    const SRGB = THREE.sRGBEncoding;
    const ADD = THREE.AdditiveBlending;
    const CYAN = '#7fe3f0';

    const root = new THREE.Group();
    root.position.set(0, BASE, 0);
    scene.add(root);

    const clamp = function (x, a, b) { return Math.max(a, Math.min(b, x)); };
    const clamp01 = function (x) { return clamp(x, 0, 1); };
    const V = function (x, y, z) { return new THREE.Vector3(x, y, z); };
    const Vj = function (a) { return V(a[0], a[1], a[2]); };
    const UP = V(0, 1, 0);
    const IDQ = new THREE.Quaternion();
    const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
    const rnd = (function () { let seed = 19; return function () { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }; })();
    const pick = function (arr) { return arr[Math.floor(rnd() * arr.length) % arr.length]; };

    // ---------- materiales ----------
    // El emisivo cian se controla con xray (resalte de rayos X). Colores por instancia (óxido, variación de caliza).
    const ironMat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.7, roughness: 0.6, emissive: new THREE.Color(CYAN), emissiveIntensity: 0 });
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0, roughness: 0.92, emissive: new THREE.Color(CYAN), emissiveIntensity: 0 });
    const jointMat = new THREE.MeshStandardMaterial({ color: 0x2f2d2a, metalness: 0, roughness: 1 });
    const IRON_PAL = [0x3f3d3a, 0x4a4742, 0x35332f, 0x46423c];
    const RUST_PAL = [0x7a4426, 0x6b3a22, 0x8c5330];
    const STONE_PAL = [0xb9b4a6, 0xa9a494, 0xbdb8aa, 0x9f9a8c];
    const BALLAST_PAL = [0x8e897c, 0x7d786d, 0x968f80];

    // ---------- geometrías base (una sola vez) ----------
    const CYL = new THREE.CylinderGeometry(1, 1, 1, 6, 1, false);            // barras: base y=-0.5..0.5, se orientan por instancia
    const TOR = new THREE.TorusGeometry(1, 0.035, 4, 16); TOR.rotateX(Math.PI / 2); // aros horizontales (plano XZ)
    const PLATE = new THREE.BoxGeometry(0.36, 0.2, 0.1);                       // placas en los cruces (grosor en Z)
    const RIVET = new THREE.CylinderGeometry(0.035, 0.035, 0.03, 5, 1, false); RIVET.rotateX(Math.PI / 2);
    const DRUM = new THREE.CylinderGeometry(1, 1, 1, 12, 1, false);            // sillares (fuste)
    const JOINT = new THREE.CylinderGeometry(1, 1, 1, 12, 1, false);           // juntas entre sillares
    const BLOCK = new THREE.BoxGeometry(1, 1, 1);                              // piedras de lastre

    function mesh(geo, mat, count, pal, rustChance) {
      const m = new THREE.InstancedMesh(geo, mat, count);
      m.frustumCulled = false;
      if (pal) {
        for (let i = 0; i < count; i++) {
          const c = (rustChance && rnd() < rustChance) ? pick(RUST_PAL) : pick(pal);
          m.setColorAt(i, new THREE.Color(c));
        }
        m.instanceColor.needsUpdate = true;
      }
      root.add(m);
      return m;
    }

    // Temporales reutilizables (sin crear objetos por frame)
    const _p = V(0, 0, 0), _sc = V(0, 0, 0), _dir = V(0, 0, 0), _mid = V(0, 0, 0);
    const _quat = new THREE.Quaternion(), _mat = new THREE.Matrix4();
    const _clipLo = V(0, 0, 0), _clipHi = V(0, 0, 0);

    // Recorta un segmento a la altura visible H (solo la parte por debajo de H). Devuelve false si no queda nada.
    function clipSeg(a, b, H) {
      let lo = a, hi = b;
      if (lo.y > hi.y) { lo = b; hi = a; }
      if (lo.y > H) return false;
      _clipLo.copy(lo);
      if (hi.y <= H) _clipHi.copy(hi);
      else _clipHi.copy(lo).lerp(hi, (H - lo.y) / (hi.y - lo.y));
      return true;
    }
    function setBarFromClip(m, i, r) {
      _dir.subVectors(_clipHi, _clipLo);
      const len = _dir.length();
      if (len < 1e-3) { m.setMatrixAt(i, ZERO); return; }
      _dir.multiplyScalar(1 / len);
      _mid.addVectors(_clipLo, _clipHi).multiplyScalar(0.5);
      _quat.setFromUnitVectors(UP, _dir);
      _sc.set(r, len, r);
      _mat.compose(_mid, _quat, _sc);
      m.setMatrixAt(i, _mat);
    }

    // ================= 1. ARMAZÓN DE HIERRO =================
    // Estaciones (aros) cada ~1.5 m a lo largo de cada miembro; 6 nodos por aro; barras verticales entre
    // aros y tirantes en diagonal. Radio interior = radio de la piel - 0.45 m.
    const NA = 6;
    const RINGS = [];   // {c, rx, rz, nodes[], nrm[], M}
    const RODS = [];    // {a, b, r}: barras y tirantes (se recortan por altura)
    function ringAt(c, rx, rz) {
      for (let i = 0; i < RINGS.length; i++) if (RINGS[i].c.distanceTo(c) < 0.05) return i;
      const nodes = [], nrm = [];
      for (let j = 0; j < NA; j++) {
        const th = j * Math.PI / 3, cs = Math.cos(th), sn = Math.sin(th);
        nodes.push(V(c.x + rx * cs, c.y, c.z + rz * sn));
        nrm.push(V(cs / rx, 0, sn / rz).normalize());
      }
      const M = new THREE.Matrix4().compose(c, IDQ, V(rx, 1, rz));
      RINGS.push({ c: c.clone(), rx: rx, rz: rz, nodes: nodes, nrm: nrm, M: M });
      return RINGS.length - 1;
    }
    function rod(a, b, r) { RODS.push({ a: a, b: b, r: r }); }

    // Miembro entre A y B; radfn(u) -> [rx, rz] interiores. Devuelve los índices de sus aros.
    function member(A, B, radfn) {
      const n = Math.max(1, Math.round(A.distanceTo(B) / 1.5));
      const ids = [];
      for (let k = 0; k <= n; k++) {
        const u = k / n, rr = radfn(u);
        ids.push(ringAt(A.clone().lerp(B, u), rr[0], rr[1]));
      }
      for (let k = 0; k < n; k++) {
        const r0 = RINGS[ids[k]], r1 = RINGS[ids[k + 1]];
        for (let j = 0; j < NA; j++) {
          rod(r0.nodes[j], r1.nodes[j], 0.1);                              // barra vertical
          if (j % 2 === 0) rod(r0.nodes[j], r1.nodes[(j + 1) % NA], 0.07); // tirante en X
        }
      }
      return ids;
    }
    function limb(A, B, rA, rB) {
      return member(A, B, function (u) { const r = rA + (rB - rA) * u - 0.45; return [r, r]; });
    }

    const J = COL.joints, R = COL.radii, TT = COL.torso;

    // piernas: muslo, espinilla, pie
    ['l', 'r'].forEach(function (sd) {
      const hip = Vj(J[sd + 'Hip']), knee = Vj(J[sd + 'Knee']), ankle = Vj(J[sd + 'Ankle']), foot = Vj(J[sd + 'Foot']);
      limb(hip, knee, R.thigh, R.knee);
      limb(knee, ankle, R.knee, R.ankle);
      limb(ankle, foot, R.ankle, R.ankle * 0.9);
    });

    // brazos: brazo superior y antebrazo (la mano queda en el extremo)
    ['l', 'r'].forEach(function (sd) {
      const sh = Vj(J[sd + 'Shoulder']), el = Vj(J[sd + 'Elbow']), hd = Vj(J[sd + 'Hand']);
      limb(sh, el, R.upperArm, R.upperArm);
      limb(el, hd, R.forearm, R.hand);
    });

    // torso: radios interpolados de la tabla de secciones
    function torsoRad(y) {
      for (let i = 1; i < TT.length; i++) {
        if (y <= TT[i][0] || i === TT.length - 1) {
          const a = TT[i - 1], b = TT[i], u = clamp01((y - a[0]) / (b[0] - a[0]));
          return [a[1] + (b[1] - a[1]) * u - 0.5, a[2] + (b[2] - a[2]) * u - 0.45];
        }
      }
      return [1, 1];
    }
    const torsoIds = member(V(0, TT[0][0], 0), V(0, TT[TT.length - 1][0], 0), function (u) {
      return torsoRad(TT[0][0] + (TT[TT.length - 1][0] - TT[0][0]) * u);
    });
    // cruces horizontales dentro del torso (tirantes opuestos)
    torsoIds.forEach(function (id) {
      const nd = RINGS[id].nodes;
      for (let j = 0; j < 3; j++) rod(nd[j], nd[j + 3], 0.07);
    });

    // cuello y cabeza (esfera): aros en tres alturas, meridianos entre ellos
    const NECK_R = R.neck - 0.45;
    member(Vj(J.neck), V(0, 29.4, -0.2), function () { return [NECK_R, NECK_R]; });
    const HC = Vj(J.head), HR = R.head;
    const headIds = [29.4, 30.9, 32.3].map(function (y) {
      const dy = y - HC.y, rr = Math.sqrt(Math.max(0, HR * HR - dy * dy)) - 0.45;
      return ringAt(V(HC.x, y, HC.z), rr, rr);
    });
    for (let k = 0; k < headIds.length - 1; k++) {
      const r0 = RINGS[headIds[k]], r1 = RINGS[headIds[k + 1]];
      for (let j = 0; j < NA; j++) rod(r0.nodes[j], r1.nodes[j], 0.07);
    }

    // nodos de todos los aros (para anclar los tirantes de las columnas y colocar placas)
    const NODES = []; // {p, n, y}
    RINGS.forEach(function (Rg) {
      for (let j = 0; j < NA; j++) NODES.push({ p: Rg.nodes[j], n: Rg.nrm[j], y: Rg.nodes[j].y });
    });

    // tirantes diagonales desde cada columna hasta el nodo más cercano, cada ~2.5 m
    const COLS = COL.columns;
    COLS.forEach(function (c) {
      const x = c[0], z = c[1], y0 = c[2], y1 = Math.min(c[3], 30);
      for (let y = y0 + 1.5; y < y1; y += 2.5) {
        const P = V(x, y, z);
        let best = null, bd = Infinity;
        for (let i = 0; i < NODES.length; i++) {
          const q = NODES[i].p;
          if (q.y < y - 0.2 || q.y > y + 2.5) continue;
          const d = P.distanceTo(q) + 0.6 * Math.abs(q.y - (y + 1.25));
          if (d < bd) { bd = d; best = q; }
        }
        if (best) rod(P, best.clone(), 0.07);
      }
    });

    // placas y remaches en los cruces (dos remaches por placa)
    const PLATE_M = [], RIVET_M = [];
    NODES.forEach(function (nd) {
      const Zd = nd.n;
      const X = new THREE.Vector3().crossVectors(UP, Zd).normalize();
      const pl = new THREE.Matrix4().makeBasis(X, UP, Zd);
      pl.setPosition(nd.p.clone().addScaledVector(Zd, 0.05));
      PLATE_M.push(pl);
      [-0.1, 0.1].forEach(function (off) {
        const rv = new THREE.Matrix4().makeBasis(X, UP, Zd);
        rv.setPosition(nd.p.clone().addScaledVector(Zd, 0.115).addScaledVector(X, off));
        RIVET_M.push(rv);
      });
    });

    // Matrices estáticas de aros
    const barMesh = mesh(CYL, ironMat, RODS.length, IRON_PAL, 0.3);
    const ringMesh = mesh(TOR, ironMat, RINGS.length, IRON_PAL, 0.2);
    const plateMesh = mesh(PLATE, ironMat, NODES.length, IRON_PAL, 0.35);
    const rivetMesh = mesh(RIVET, ironMat, NODES.length * 2, IRON_PAL, 0.15);
    const FRAME_MESHES = [barMesh, ringMesh, plateMesh, rivetMesh];
    RINGS.forEach(function (Rg, i) { ringMesh.setMatrixAt(i, Rg.M); });
    ringMesh.instanceMatrix.needsUpdate = true;

    let lastHf = -1;
    function setFrame(H) {
      for (let i = 0; i < RODS.length; i++) {
        const b = RODS[i];
        if (clipSeg(b.a, b.b, H)) setBarFromClip(barMesh, i, b.r);
        else barMesh.setMatrixAt(i, ZERO);
      }
      barMesh.instanceMatrix.needsUpdate = true;
      for (let i = 0; i < RINGS.length; i++) ringMesh.setMatrixAt(i, RINGS[i].c.y <= H ? RINGS[i].M : ZERO);
      ringMesh.instanceMatrix.needsUpdate = true;
      for (let i = 0; i < NODES.length; i++) {
        const vis = NODES[i].y <= H;
        plateMesh.setMatrixAt(i, vis ? PLATE_M[i] : ZERO);
        rivetMesh.setMatrixAt(2 * i, vis ? RIVET_M[2 * i] : ZERO);
        rivetMesh.setMatrixAt(2 * i + 1, vis ? RIVET_M[2 * i + 1] : ZERO);
      }
      plateMesh.instanceMatrix.needsUpdate = true;
      rivetMesh.instanceMatrix.needsUpdate = true;
    }

    // ================= 2. COLUMNAS DE SILLARES + LASTRE =================
    const DRUMS = [], JOINTS = [];
    COLS.forEach(function (c) {
      const x = c[0], z = c[1], y0 = c[2], y1 = c[3], r = c[4];
      const n = Math.max(1, Math.ceil((y1 - y0) / 1.2)), h = (y1 - y0) / n;
      for (let k = 0; k < n; k++) {
        DRUMS.push({ x: x, z: z, y0: y0 + k * h, y1: y0 + (k + 1) * h, r: r * (0.955 + 0.02 * rnd()) });
        if (k > 0) JOINTS.push({ x: x, y: y0 + k * h, z: z, r: r });
      }
    });
    // lastre: bloques entre las dos columnas de las piernas, en capas de 1.1 m hasta ~8 m
    const STONES = [];
    for (let k = 0; k < 7; k++) {
      [-0.6, 0.6].forEach(function (sx) {
        [-0.45, 0.65].forEach(function (sz) {
          const q = new THREE.Quaternion().setFromAxisAngle(UP, (rnd() - 0.5) * 0.2);
          STONES.push({
            x: sx + (rnd() - 0.5) * 0.06, z: sz, y0: k * 1.1,
            w: 0.98 + 0.08 * rnd(), d: 1.0 + 0.1 * rnd(), h: 1.05 + 0.06 * rnd(), q: q
          });
        });
      });
    }
    const drumMesh = mesh(DRUM, stoneMat, DRUMS.length, STONE_PAL, 0);
    const jointMesh = mesh(JOINT, jointMat, JOINTS.length, null, 0);
    const stoneMesh = mesh(BLOCK, stoneMat, STONES.length, BALLAST_PAL, 0);
    const COL_MESHES = [drumMesh, jointMesh, stoneMesh];
    const JOINT_M = JOINTS.map(function (j) {
      return new THREE.Matrix4().compose(V(j.x, j.y, j.z), IDQ, V(j.r * 1.02, 0.07, j.r * 1.02));
    });
    JOINT_M.forEach(function (m, i) { jointMesh.setMatrixAt(i, m); });
    jointMesh.instanceMatrix.needsUpdate = true;

    let lastHc = -1;
    function setColumns(H) {
      for (let i = 0; i < DRUMS.length; i++) {
        const d = DRUMS[i];
        const top = Math.min(d.y1, H);
        if (top <= d.y0 + 1e-4) { drumMesh.setMatrixAt(i, ZERO); continue; }
        const hh = top - d.y0;
        _mat.compose(_p.set(d.x, d.y0 + hh / 2, d.z), IDQ, _sc.set(d.r, hh, d.r));
        drumMesh.setMatrixAt(i, _mat);
      }
      drumMesh.instanceMatrix.needsUpdate = true;
      for (let i = 0; i < JOINTS.length; i++) jointMesh.setMatrixAt(i, JOINTS[i].y <= H ? JOINT_M[i] : ZERO);
      jointMesh.instanceMatrix.needsUpdate = true;
      for (let i = 0; i < STONES.length; i++) {
        const b = STONES[i];
        const top = Math.min(b.y0 + b.h, H);
        if (top <= b.y0 + 1e-4) { stoneMesh.setMatrixAt(i, ZERO); continue; }
        const hh = top - b.y0;
        _mat.compose(_p.set(b.x, b.y0 + hh / 2, b.z), b.q, _sc.set(b.w, hh, b.d));
        stoneMesh.setMatrixAt(i, _mat);
      }
      stoneMesh.instanceMatrix.needsUpdate = true;
    }

    // ================= 3. ETIQUETAS (Sprite + CanvasTexture, en español) =================
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
      const tex = new THREE.CanvasTexture(cv);
      tex.encoding = SRGB;
      tex.minFilter = THREE.LinearFilter;
      tex.generateMipmaps = false;
      return { tex: tex, aspect: cv.width / cv.height };
    }
    const labels = [];
    function label(text, sub, anchor, off) {
      const cv = makeCanvas(text, sub, CYAN);
      const mat = new THREE.SpriteMaterial({ map: cv.tex, transparent: true, opacity: 0, depthTest: false, depthWrite: false });
      const sprite = new THREE.Sprite(mat);
      sprite.renderOrder = 5;
      const base = anchor.clone().add(off);
      sprite.position.copy(base);
      root.add(sprite);
      const lm = new THREE.LineBasicMaterial({ color: CYAN, transparent: true, opacity: 0, depthTest: false, depthWrite: false, blending: ADD });
      const geo = new THREE.BufferGeometry().setFromPoints([anchor.clone(), base.clone()]);
      const line = new THREE.Line(geo, lm);
      root.add(line);
      labels.push({ sprite: sprite, mat: mat, line: line, lm: lm, geo: geo, aspect: cv.aspect, anchor: anchor.clone(), base: base });
    }
    label('ARMAZÓN DE HIERRO · ' + COL.ironTons.toFixed(1).replace('.', ',') + ' t', 'SEGÚN FILÓN · 300 TALENTOS',
      V(-3.05, 9, -0.2), V(-14, 6, -4));
    label('COLUMNAS DE PIEDRA', 'FUSTES DE CALIZA · SILLARES',
      V(0, 22, 0.2), V(13, 9, -6));
    label('LASTRE DE PIEDRAS', 'PESO BAJO LAS PIERNAS',
      V(0, 4, 0), V(-13, -2, 10));

    const _cp = camera.position, _wp = V(0, 0, 0), _nd = V(0, 0, 0);
    function updateLabels(xa) {
      camera.updateMatrixWorld();
      const halfTan = Math.tan(camera.fov * DEG / 2);
      const placed = [];
      for (let i = 0; i < labels.length; i++) {
        const L = labels[i];
        const lvl = xa;
        L.mat.opacity = lvl * 0.95;
        L.lm.opacity = lvl * 0.8;
        L.sprite.visible = lvl > 0.001;
        L.line.visible = lvl > 0.001;
        if (lvl <= 0.001) continue;
        _wp.set(L.base.x, L.base.y + BASE, L.base.z);
        const d = Math.max(1, _cp.distanceTo(_wp));
        let hgt = clamp(d * 0.06, 2, 10);
        hgt = Math.min(hgt, 0.5 * d * halfTan * camera.aspect / L.aspect); // ancho máximo: 25% de la pantalla
        const hh = (hgt / 2) / (d * halfTan);
        const hw = (hgt * L.aspect / 2) / (d * halfTan * camera.aspect);
        let dy = 0;
        _nd.copy(_wp).project(camera);
        // evita solapes en pantalla: si choca con una etiqueta ya colocada, baja lo necesario
        for (let k = 0; k < placed.length; k++) {
          const q = placed[k];
          const ox = hw + q.hw - Math.abs(_nd.x - q.x), oy = hh + q.hh - Math.abs(_nd.y - q.y);
          if (ox > 0 && oy > 0) {
            const shiftNdc = oy + 0.02;
            dy -= shiftNdc * d * halfTan;
            _nd.y -= shiftNdc;
          }
        }
        placed.push({ x: _nd.x, y: _nd.y, hw: hw, hh: hh });
        L.sprite.position.set(L.base.x, L.base.y + dy, L.base.z);
        L.sprite.scale.set(hgt * L.aspect, hgt, 1);
        const arr = L.geo.attributes.position.array;
        arr[0] = L.anchor.x; arr[1] = L.anchor.y; arr[2] = L.anchor.z;
        arr[3] = L.sprite.position.x; arr[4] = L.sprite.position.y; arr[5] = L.sprite.position.z;
        L.geo.attributes.position.needsUpdate = true;
      }
    }

    // ---------- update ----------
    function update(s) {
      const xa = clamp01(s.xray || 0);
      // oculto: la estatua caída la gestiona otro módulo; y con la piel terminada y sin rayos X no se ve
      const hide = (s.fall || 0) > 0.02 || (s.ruins || 0) > 0.02 || ((s.build || 0) >= 1 && xa <= 0.001);
      root.visible = !hide;
      if (hide) return;

      const Hf = clamp01(s.frame || 0) * HT;
      const Hc = clamp01(s.columns || 0) * HT;
      const frameOn = Hf > 0.01, colOn = Hc > 0.01;
      for (let i = 0; i < FRAME_MESHES.length; i++) FRAME_MESHES[i].visible = frameOn;
      for (let i = 0; i < COL_MESHES.length; i++) COL_MESHES[i].visible = colOn;

      if (Math.abs(Hf - lastHf) > 0.004) { lastHf = Hf; setFrame(Hf); }
      if (Math.abs(Hc - lastHc) > 0.004) { lastHc = Hc; setColumns(Hc); }

      // resalte cian con rayos X (suave, con una leve pulsación)
      const pulse = 0.9 + 0.1 * Math.sin((s.wall || 0) * 2.1);
      ironMat.emissiveIntensity = xa * 0.28 * pulse;
      stoneMat.emissiveIntensity = xa * 0.06 * pulse;

      updateLabels(xa);
    }

    return { update: update, group: root };
  };
})();
