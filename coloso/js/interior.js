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
    // Hierro oscuro (metalness 0.7, roughness 0.6) con óxido por instancia. Caliza clara. Juntas oscuras.
    const ironMat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.7, roughness: 0.6, emissive: new THREE.Color(CYAN), emissiveIntensity: 0 });
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0, roughness: 0.92, emissive: new THREE.Color(CYAN), emissiveIntensity: 0 });
    // argamasa: junta clara entre sillares
    const jointMat = new THREE.MeshStandardMaterial({ color: 0x8f897b, metalness: 0, roughness: 1 });
    const contourMat = new THREE.LineBasicMaterial({ color: CYAN, transparent: true, opacity: 0, blending: ADD, depthWrite: false });
    const IRON_PAL = [0x2e2c2a, 0x3a3733, 0x33302d, 0x3f3b36];
    const RUST_PAL = [0x8a3f22, 0x7a3a20, 0x9a4a28];
    const STONE_PAL = [0xcfc6b4, 0xc6bdab, 0xd6cdbb];
    const BALLAST_PAL = [0x7f786b, 0x6e685c, 0x8a8375];

    // ---------- geometrías base (una sola vez) ----------
    const CYL = new THREE.CylinderGeometry(1, 1, 1, 6, 1, false);            // barras: altura 1 centrada, se orientan por instancia
    const TOR = new THREE.TorusGeometry(1, 0.05, 4, 16); TOR.rotateX(Math.PI / 2); // aros horizontales (plano XZ)
    const PLATE = new THREE.BoxGeometry(0.4, 0.22, 0.1);                       // placas en los cruces (grosor en Z)
    const RIVET = new THREE.CylinderGeometry(0.04, 0.04, 0.03, 5, 1, false); RIVET.rotateX(Math.PI / 2);
    const DRUM = new THREE.CylinderGeometry(1, 1, 1, 12, 1, false);            // sillares (fuste)
    const JOINT = new THREE.CylinderGeometry(1, 1, 1, 12, 1, false);           // juntas entre sillares
    // dodecaedro deformado (vértices con factor propio por posición: sin grietas)
    const DODEC = new THREE.DodecahedronGeometry(1, 0);
    {
      const pa = DODEC.attributes.position, jm = {};
      for (let i = 0; i < pa.count; i++) {
        const key = pa.getX(i).toFixed(3) + '|' + pa.getY(i).toFixed(3) + '|' + pa.getZ(i).toFixed(3);
        if (!jm[key]) jm[key] = [0.78 + 0.44 * rnd(), 0.78 + 0.44 * rnd(), 0.78 + 0.44 * rnd()];
        const f = jm[key];
        pa.setXYZ(i, pa.getX(i) * f[0], pa.getY(i) * f[1], pa.getZ(i) * f[2]);
      }
      DODEC.computeVertexNormals();
    }

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
    // Aros cada ~1,5 m a lo largo de cada miembro; 6 nodos por aro, de los que solo los pares llevan barra
    // vertical (3 barras separadas 120°) y los tirantes diagonales unen cada barra con el nodo vecino del siguiente aro.
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

    // Miembro entre A y B; radfn(u) -> [rx, rz] interiores; rr = radio de las barras principales.
    function member(A, B, radfn, rr) {
      const n = Math.max(1, Math.round(A.distanceTo(B) / 1.5));
      const ids = [];
      for (let k = 0; k <= n; k++) {
        const u = k / n, rad = radfn(u);
        ids.push(ringAt(A.clone().lerp(B, u), rad[0], rad[1]));
      }
      for (let k = 0; k < n; k++) {
        const r0 = RINGS[ids[k]], r1 = RINGS[ids[k + 1]];
        for (let j = 0; j < NA; j += 2) {
          rod(r0.nodes[j], r1.nodes[j], rr);                                  // barra vertical principal
          rod(r0.nodes[j], r1.nodes[(j + 1) % NA], rr * 0.6);                 // tirante diagonal
        }
      }
      return ids;
    }
    function limb(A, B, rA, rB) {
      return member(A, B, function (u) { const r = rA + (rB - rA) * u - 0.45; return [r, r]; }, 0.17);
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
    }, 0.2);
    // cruces horizontales dentro del torso (tirantes opuestos entre los nodos principales)
    torsoIds.forEach(function (id) {
      const nd = RINGS[id].nodes;
      rod(nd[0], nd[3], 0.12);
      rod(nd[2], nd[5], 0.12);
    });

    // cuello y cabeza (esfera): aros en tres alturas, meridianos entre ellos
    const NECK_R = R.neck - 0.45;
    member(Vj(J.neck), V(0, 29.4, -0.2), function () { return [NECK_R, NECK_R]; }, 0.12);
    const HC = Vj(J.head), HR = R.head;
    const headIds = [29.4, 30.9, 32.3].map(function (y) {
      const dy = y - HC.y, rr = Math.sqrt(Math.max(0, HR * HR - dy * dy)) - 0.45;
      return ringAt(V(HC.x, y, HC.z), rr, rr);
    });
    for (let k = 0; k < headIds.length - 1; k++) {
      const r0 = RINGS[headIds[k]], r1 = RINGS[headIds[k + 1]];
      for (let j = 0; j < NA; j += 2) rod(r0.nodes[j], r1.nodes[j], 0.12);
    }

    // nodos principales (pares) de todos los aros: anclajes de tirantes y placas
    const NODES = []; // {p, n, y}
    RINGS.forEach(function (Rg) {
      for (let j = 0; j < NA; j += 2) NODES.push({ p: Rg.nodes[j], n: Rg.nrm[j], y: Rg.nodes[j].y });
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
        if (best) rod(P, best.clone(), 0.1);
      }
    });

    // placas y remaches en los nodos principales (dos remaches por placa)
    const PLATE_M = [], RIVET_M = [];
    NODES.forEach(function (nd) {
      const Zd = nd.n;
      const X = new THREE.Vector3().crossVectors(UP, Zd).normalize();
      const pl = new THREE.Matrix4().makeBasis(X, UP, Zd);
      pl.setPosition(nd.p.clone().addScaledVector(Zd, 0.05));
      PLATE_M.push(pl);
      [-0.11, 0.11].forEach(function (off) {
        const rv = new THREE.Matrix4().makeBasis(X, UP, Zd);
        rv.setPosition(nd.p.clone().addScaledVector(Zd, 0.12).addScaledVector(X, off));
        RIVET_M.push(rv);
      });
    });

    // mallas instanciadas del armazón
    const barMesh = mesh(CYL, ironMat, RODS.length, IRON_PAL, 0.45);
    const ringMesh = mesh(TOR, ironMat, RINGS.length, IRON_PAL, 0.3);
    const plateMesh = mesh(PLATE, ironMat, NODES.length, IRON_PAL, 0.4);
    const rivetMesh = mesh(RIVET, ironMat, NODES.length * 2, IRON_PAL, 0.2);
    const FRAME_MESHES = [barMesh, ringMesh, plateMesh, rivetMesh];
    RINGS.forEach(function (Rg, i) { ringMesh.setMatrixAt(i, Rg.M); });
    ringMesh.instanceMatrix.needsUpdate = true;

    // contorno cian fino: líneas aditivas que siguen barras y aros (sin cubrir los materiales)
    const RING_SEG = 16;
    const ringStatic = new Float32Array(RINGS.length * RING_SEG * 6);
    RINGS.forEach(function (Rg, i) {
      for (let k = 0; k < RING_SEG; k++) {
        const a0 = k / RING_SEG * Math.PI * 2, a1 = (k + 1) / RING_SEG * Math.PI * 2;
        const o = (i * RING_SEG + k) * 6;
        const c = Rg.c;
        ringStatic.set([c.x + Rg.rx * Math.cos(a0), c.y, c.z + Rg.rz * Math.sin(a0), c.x + Rg.rx * Math.cos(a1), c.y, c.z + Rg.rz * Math.sin(a1)], o);
      }
    });
    const RING_OFF = RODS.length * 6;
    const contourPos = new Float32Array(RING_OFF + ringStatic.length);
    const contourGeo = new THREE.BufferGeometry();
    contourGeo.setAttribute('position', new THREE.BufferAttribute(contourPos, 3));
    const contour = new THREE.LineSegments(contourGeo, contourMat);
    contour.frustumCulled = false;
    root.add(contour);

    let lastHf = -1;
    function setFrame(H) {
      for (let i = 0; i < RODS.length; i++) {
        const b = RODS[i];
        if (clipSeg(b.a, b.b, H)) {
          setBarFromClip(barMesh, i, b.r);
          const o = i * 6;
          contourPos[o] = _clipLo.x; contourPos[o + 1] = _clipLo.y; contourPos[o + 2] = _clipLo.z;
          contourPos[o + 3] = _clipHi.x; contourPos[o + 4] = _clipHi.y; contourPos[o + 5] = _clipHi.z;
        } else {
          barMesh.setMatrixAt(i, ZERO);
          contourPos.fill(0, i * 6, i * 6 + 6);
        }
      }
      barMesh.instanceMatrix.needsUpdate = true;
      for (let i = 0; i < RINGS.length; i++) {
        const vis = RINGS[i].c.y <= H;
        ringMesh.setMatrixAt(i, vis ? RINGS[i].M : ZERO);
        const len = RING_SEG * 6, off = RING_OFF + i * len;
        if (vis) contourPos.set(ringStatic.subarray(i * len, i * len + len), off);
        else contourPos.fill(0, off, off + len);
      }
      ringMesh.instanceMatrix.needsUpdate = true;
      for (let i = 0; i < NODES.length; i++) {
        const vis = NODES[i].y <= H;
        plateMesh.setMatrixAt(i, vis ? PLATE_M[i] : ZERO);
        rivetMesh.setMatrixAt(2 * i, vis ? RIVET_M[2 * i] : ZERO);
        rivetMesh.setMatrixAt(2 * i + 1, vis ? RIVET_M[2 * i + 1] : ZERO);
      }
      plateMesh.instanceMatrix.needsUpdate = true;
      rivetMesh.instanceMatrix.needsUpdate = true;
      contourGeo.attributes.position.needsUpdate = true;
    }

    // ================= 2. COLUMNAS DE SILLARES + LASTRE =================
    const DRUMS = [], JOINTS = [];
    COLS.forEach(function (c) {
      const x = c[0], z = c[1], y0 = c[2], y1 = c[3], r = c[4];
      const n = Math.max(1, Math.ceil((y1 - y0) / 1.2)), h = (y1 - y0) / n;
      for (let k = 0; k < n; k++) {
        // sillares irregulares: cada tambor se desplaza un poco y varía de radio
        const jx = (rnd() - 0.5) * 0.12, jz = (rnd() - 0.5) * 0.12;
        DRUMS.push({ x: x + jx, z: z + jz, y0: y0 + k * h, y1: y0 + (k + 1) * h, r: r * (0.92 + 0.06 * rnd()) });
        if (k > 0) JOINTS.push({ x: x + jx, y: y0 + k * h, z: z + jz, r: r * (0.98 + 0.06 * rnd()) });
      }
    });
    // lastre: piedras irregulares amontonadas dentro de las piernas (entre y bajo las columnas)
    const STONES = [];
    for (let i = 0; i < 72; i++) {
      STONES.push({
        x: (rnd() * 2 - 1) * 1.0, z: -0.7 + rnd() * 1.6, y: 0.4 + rnd() * 7.6,
        r: 0.32 + 0.22 * rnd(),
        q: new THREE.Quaternion().setFromEuler(new THREE.Euler(rnd() * 6.28, rnd() * 6.28, rnd() * 6.28)),
        s: V(0.9 + 0.3 * rnd(), 0.7 + 0.4 * rnd(), 0.9 + 0.3 * rnd())
      });
    }
    const drumMesh = mesh(DRUM, stoneMat, DRUMS.length, STONE_PAL, 0);
    const jointMesh = mesh(JOINT, jointMat, JOINTS.length, null, 0);
    const stoneMesh = mesh(DODEC, stoneMat, STONES.length, BALLAST_PAL, 0);
    const JOINT_M = JOINTS.map(function (j) {
      return new THREE.Matrix4().compose(V(j.x, j.y, j.z), IDQ, V(j.r * 1.05, 0.1, j.r * 1.05));
    });
    JOINT_M.forEach(function (m, i) { jointMesh.setMatrixAt(i, m); });
    jointMesh.instanceMatrix.needsUpdate = true;

    // contorno cian de las columnas: 8 generatrices por fuste, hasta la altura visible
    const COL_SEG = 8;
    const colPos = new Float32Array(COLS.length * COL_SEG * 6);
    const colGeo = new THREE.BufferGeometry();
    colGeo.setAttribute('position', new THREE.BufferAttribute(colPos, 3));
    const colContour = new THREE.LineSegments(colGeo, contourMat);
    colContour.frustumCulled = false;
    root.add(colContour);

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
      // lastre: cada piedra crece al subir el nivel (escala 0..1 según su base y su altura)
      for (let i = 0; i < STONES.length; i++) {
        const b = STONES[i];
        const f = clamp01((H - (b.y - b.r)) / (2 * b.r));
        if (f <= 0.001) { stoneMesh.setMatrixAt(i, ZERO); continue; }
        _mat.compose(_p.set(b.x, b.y, b.z), b.q, _sc.set(b.s.x * b.r * f, b.s.y * b.r * f, b.s.z * b.r * f));
        stoneMesh.setMatrixAt(i, _mat);
      }
      stoneMesh.instanceMatrix.needsUpdate = true;
      // contorno de columnas
      for (let ci = 0; ci < COLS.length; ci++) {
        const c = COLS[ci], top = Math.min(c[3], H), rr = c[4] * 1.02;
        for (let k = 0; k < COL_SEG; k++) {
          const th = k / COL_SEG * Math.PI * 2, o = (ci * COL_SEG + k) * 6;
          if (top <= c[2]) { colPos.fill(0, o, o + 6); continue; }
          const px = c[0] + rr * Math.cos(th), pz = c[1] + rr * Math.sin(th);
          colPos[o] = px; colPos[o + 1] = c[2]; colPos[o + 2] = pz;
          colPos[o + 3] = px; colPos[o + 4] = top; colPos[o + 5] = pz;
        }
      }
      colGeo.attributes.position.needsUpdate = true;
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
    // ndc (opcional): posición fija en pantalla {x,y} en [-1,1]; la etiqueta se coloca a esa dirección
    function label(text, sub, anchor, off, ndc) {
      const cv = makeCanvas(text, sub, CYAN);
      const mat = new THREE.SpriteMaterial({ map: cv.tex, transparent: true, opacity: 0, depthTest: false, depthWrite: false });
      const sprite = new THREE.Sprite(mat);
      sprite.renderOrder = 5;
      const base = off ? anchor.clone().add(off) : anchor.clone();
      sprite.position.copy(base);
      root.add(sprite);
      const lm = new THREE.LineBasicMaterial({ color: CYAN, transparent: true, opacity: 0, depthTest: false, depthWrite: false, blending: ADD });
      const geo = new THREE.BufferGeometry().setFromPoints([anchor.clone(), base.clone()]);
      const line = new THREE.Line(geo, lm);
      root.add(line);
      labels.push({ sprite: sprite, mat: mat, line: line, lm: lm, geo: geo, aspect: cv.aspect, anchor: anchor.clone(), base: base, ndc: ndc || null });
    }
    label('ARMAZÓN DE HIERRO · ' + COL.ironTons.toFixed(1).replace('.', ',') + ' t', 'SEGÚN FILÓN · 300 TALENTOS',
      V(-3.05, 9, -0.2), null, { x: 0.6, y: -0.02 });
    label('COLUMNAS DE PIEDRA', 'FUSTES DE CALIZA · SILLARES',
      V(0, 22, 0.2), V(13, 9, -6));
    label('LASTRE DE PIEDRAS', 'PESO BAJO LAS PIERNAS',
      V(0, 4, 0), V(-13, -2, 10));

    const _cp = camera.position, _wp = V(0, 0, 0), _nd = V(0, 0, 0), _v = V(0, 0, 0), _cen = V(0, BASE + 16, 0);
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
        if (L.ndc) {
          // a media altura del armazón, en la dirección de pantalla indicada (a la derecha, fuera del rótulo central)
          const dF = Math.max(3, _cp.distanceTo(_cen));
          _v.set(L.ndc.x, L.ndc.y, 0.5).unproject(camera).sub(_cp).normalize().multiplyScalar(dF).add(_cp);
          L.base.set(_v.x, _v.y - BASE, _v.z);
        }
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
      contour.visible = frameOn;
      for (let i = 0; i < 3; i++) COL_MESHES[i].visible = colOn;
      colContour.visible = colOn;

      if (Math.abs(Hf - lastHf) > 0.004) { lastHf = Hf; setFrame(Hf); }
      if (Math.abs(Hc - lastHc) > 0.004) { lastHc = Hc; setColumns(Hc); }

      // resalte: el contorno cian es el protagonista; el emisivo del hierro apenas tiñe
      const pulse = 0.9 + 0.1 * Math.sin((s.wall || 0) * 2.1);
      ironMat.emissiveIntensity = xa * 0.08 * pulse;
      stoneMat.emissiveIntensity = xa * 0.03 * pulse;
      contourMat.opacity = xa * 0.75 * pulse;

      updateLabels(xa);
    }
    const COL_MESHES = [drumMesh, jointMesh, stoneMesh];

    return { update: update, group: root };
  };
})();
