// Interior de la Gran Pirámide: esquema holográfico de rayos X + conductos hacia las estrellas.
(function () {
  'use strict';
  const G = window.GIZA;

  G.createInterior = function (ctx) {
    const THREE = ctx.THREE, scene = ctx.scene, camera = ctx.camera;
    const I = G.INTERIOR, PYR = G.PYR;
    const DEG = Math.PI / 180;
    const H = PYR.height;
    const SRGB = THREE.sRGBEncoding;
    // Ventana del camino guiado (segundos del vídeo): entrada -> inicio de galería -> cámara del Rey
    const T_E = 88, T_G = 96, T_K = 104;

    const root = new THREE.Group(); scene.add(root);
    const interiorGroup = new THREE.Group(); // volúmenes, etiquetas secuenciales, explorador (xray)
    const conduitGroup = new THREE.Group();  // conductos y puertas: max(xray, shafts)
    const rayGroup = new THREE.Group();      // rayos a las estrellas (shafts)
    root.add(interiorGroup, conduitGroup, rayGroup);

    const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
    const clamp01 = (x) => clamp(x, 0, 1);
    const smooth = (x) => x * x * (3 - 2 * x);
    const V = (x, y, z) => new THREE.Vector3(x, y, z);

    // ---------- materiales compartidos (opacidad se fija en update) ----------
    const ADD = THREE.AdditiveBlending;
    const lineMat = (color) => new THREE.LineBasicMaterial({ color: color, transparent: true, opacity: 0, blending: ADD, depthWrite: false });
    const solidMat = (color) => new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
    const ptsMat = (color, size) => new THREE.PointsMaterial({ color: color, size: size, sizeAttenuation: true, transparent: true, opacity: 0, blending: ADD, depthWrite: false });
    const M = {
      caliza: solidMat(0xd9c48a),
      granito: solidMat(0x8a2d22),
      cian: solidMat(0x3fdcff),
      cobre: new THREE.MeshBasicMaterial({ color: 0xd9793a, transparent: true, opacity: 0, depthWrite: false }),
      dorado: lineMat(0xffc65a),
      rojo: lineMat(0xff4a3d),
      cianL: lineMat(0x7ff7ff),
      cianTenue: lineMat(0x2fb8d6),
      rayo: lineMat(0xa8fbff),
      rejilla: lineMat(0xff6a5a),
      vacioS: solidMat(0x9d6bff),
      vacioL: lineMat(0xc8a2ff),
      estela: lineMat(0xfff0c0),
      polvo: ptsMat(0xffd9a0, 0.35),
      pulso: ptsMat(0xffd27a, 2.4),
      explorador: ptsMat(0xffffff, 4)
    };

    // ---------- utilidades de geometría (todo horneado en coordenadas de mundo) ----------
    function frameFor(a) {
      const up = V(0, 1, 0).addScaledVector(a, -a.y).normalize();
      const side = new THREE.Vector3().crossVectors(up, a).normalize();
      return { side: side, up: up, a: a };
    }
    // Extruye un perfil cerrado [side, up] (relativo a p0) desde p0 hasta p1.
    function profileGeom(pts, p0, p1) {
      const a = p1.clone().sub(p0);
      const L = a.length(); a.normalize();
      const f = frameFor(a);
      const shape = new THREE.Shape();
      shape.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i][0], pts[i][1]);
      shape.closePath();
      const g = new THREE.ExtrudeGeometry(shape, { depth: L, bevelEnabled: false, steps: 1 });
      const m = new THREE.Matrix4().makeBasis(f.side, f.up, f.a);
      m.setPosition(p0);
      g.applyMatrix4(m);
      return g;
    }
    const rectPts = (w, h) => [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]];
    const tubeGeom = (p0, p1, w, h) => profileGeom(rectPts(w, h), p0, p1);
    const boxGeom = (cx, cy, cz, sx, sy, sz) => new THREE.BoxGeometry(sx, sy, sz).translate(cx, cy, cz);

    function addLine(group, p0, p1, mat) {
      const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([p0, p1]), mat);
      group.add(l);
      return l;
    }

    // Partes: relleno + aristas; se ocultan según la altura construida (t < 130).
    const parts = [];
    function addPart(group, geom, fillMat, edgeMat) {
      geom.computeBoundingBox();
      const p = new THREE.Group();
      if (fillMat) p.add(new THREE.Mesh(geom, fillMat));
      p.add(new THREE.LineSegments(new THREE.EdgesGeometry(geom), edgeMat));
      group.add(p);
      parts.push({ obj: p, top: geom.boundingBox.max.y });
      return p;
    }

    // Rejilla de líneas (bloques de granito) en un rectángulo: o + u*x y o + v*y
    const gridSeg = [];
    function gridQuad(o, u, v, uLen, vLen, su, sv) {
      for (let x = 0; x <= uLen + 1e-6; x += su) {
        const a = o.clone().addScaledVector(u, x), b = a.clone().addScaledVector(v, vLen);
        gridSeg.push(a.x, a.y, a.z, b.x, b.y, b.z);
      }
      for (let y = 0; y <= vLen + 1e-6; y += sv) {
        const a = o.clone().addScaledVector(v, y), b = a.clone().addScaledVector(u, uLen);
        gridSeg.push(a.x, a.y, a.z, b.x, b.y, b.z);
      }
    }

    // ---------- 1. ENTRADA NORTE Y VIGAS EN CHEVRÓN ----------
    const E = V(I.entrance.x, I.entrance.y, I.entrance.z);
    const GOLD = '#ffc65a', RED = '#ff6a5a', CYAN = '#7ff7ff', AMBER = '#ffb35a', VIOLET = '#c8a2ff';
    const upFace = V(0, H, PYR.half).normalize();
    const nOut = V(0, PYR.half, -H).normalize();
    const chevBase = V(I.entrance.x, 19, -PYR.halfAt(19));
    [-1, 1].forEach(function (sx) {
      const d = V(sx * 0.5, 0, 0).addScaledVector(upFace, 0.866).normalize();
      const p0 = chevBase.clone().addScaledVector(nOut, 0.3);
      const p1 = p0.clone().addScaledVector(d, 9);
      addPart(interiorGroup, profileGeom(rectPts(1.0, 0.6), p0, p1), M.caliza, M.dorado);
    });

    // ---------- 2. PASAJES Y CÁMARAS ----------
    const PW = 1.05, PH = 1.2;
    const cDesc = 1 / Math.tan(26.5 * DEG);
    const cAsc = 1 / Math.tan(26 * DEG);

    // Pasaje descendente
    const yBottom = I.subterranean.y;
    const Dn = V(I.subterranean.x, yBottom, E.z + (E.y - yBottom) * cDesc);
    addPart(interiorGroup, tubeGeom(E, Dn, PW, PH), M.caliza, M.dorado);

    // Túnel de Al-Mamún (entrada forzada, cara norte -> pasaje descendente)
    const TUN_P0 = V(-2, 10, -PYR.halfAt(10));
    const TUN_P1 = V(I.subterranean.x, -2, E.z + (E.y + 2) * cDesc);
    addPart(interiorGroup, tubeGeom(TUN_P0, TUN_P1, 1.6, 1.6), M.caliza, M.dorado);

    // Cámara subterránea (inacabada)
    const S = I.subterranean;
    addPart(interiorGroup, boxGeom(S.x, S.y, S.z, S.w, S.h, S.d), M.caliza, M.dorado);

    // Gran Galería
    const G0 = V(0, I.gallery.yStart, I.gallery.zStart);
    const G1 = V(0, I.gallery.yEnd, I.gallery.zEnd);
    const gA = G1.clone().sub(G0).normalize();
    const gF = frameFor(gA);
    const gL = G0.distanceTo(G1);
    const gMid = G0.clone().add(G1).multiplyScalar(0.5);

    // Pasaje ascendente: se separa del descendente en J
    const yJ = (E.z + E.y * cDesc - G0.z + G0.y * cAsc) / (cDesc + cAsc);
    const J = V(I.subterranean.x, yJ, E.z + (E.y - yJ) * cDesc);
    addPart(interiorGroup, tubeGeom(J, G0, PW, PH), M.caliza, M.dorado);

    // Pozo del servicio: une el inicio de la galería con el pasaje descendente
    const yWell = E.y - (G0.z - E.z) * cDesc;
    const Wd = V(I.subterranean.x, yWell, G0.z);
    addPart(interiorGroup, tubeGeom(G0, Wd, 1.1, 1.1), M.caliza, M.dorado);

    // Gran Galería: bóveda en ménsula, 7 escalones que se estrechan hacia arriba
    const gHalf = I.gallery.width / 2, nSteps = 7, bh = I.gallery.height / nSteps;
    const hw = [];
    for (let j = 0; j < nSteps; j++) hw.push(gHalf - j * 0.078);
    const gp = [[-hw[0], 0], [hw[0], 0]];
    for (let j = 0; j < nSteps; j++) {
      gp.push([hw[j], (j + 1) * bh]);
      if (j < nSteps - 1) gp.push([hw[j + 1], (j + 1) * bh]);
    }
    gp.push([-hw[nSteps - 1], nSteps * bh]);
    for (let j = nSteps - 1; j >= 0; j--) {
      gp.push([-hw[j], j * bh]);
      if (j > 0) gp.push([-hw[j - 1], j * bh]);
    }
    gp.pop();
    addPart(interiorGroup, profileGeom(gp, G0, G1), M.caliza, M.dorado);

    // Pasaje horizontal a la cámara de la Reina
    const Q = I.queens;
    const yH = 22.6;
    addPart(interiorGroup, tubeGeom(V(0, yH, G0.z), V(0, yH, Q.z - Q.d / 2), PW, PH), M.caliza, M.dorado);
    addPart(interiorGroup, boxGeom(Q.x, Q.y, Q.z, Q.w, Q.h, Q.d), M.caliza, M.dorado);
    const nicheX = Q.x + Q.w / 2 + 0.35;
    addPart(interiorGroup, boxGeom(nicheX, Q.y - 0.2, 0, 0.7, 1.4, 1.2), M.caliza, M.dorado);

    // Antecámara con 3 rastrillos de granito
    addPart(interiorGroup, boxGeom(0, 44.2, 6.2, 3.0, 5.0, 4.0), M.caliza, M.dorado);
    [4.5, 5.4, 6.3].forEach(function (z) {
      addPart(interiorGroup, boxGeom(0, 44.2, z, 2.6, 4.6, 0.35), M.granito, M.rojo);
    });

    // Cámara del Rey (granito rojo oscuro)
    const K = I.kings;
    const kTop = K.y + K.h / 2;
    const kFloor = K.y - K.h / 2;
    const kx0 = K.x - K.w / 2, kx1 = K.x + K.w / 2, kz0 = K.z - K.d / 2, kz1 = K.z + K.d / 2;
    addPart(interiorGroup, boxGeom(K.x, K.y, K.z, K.w, K.h, K.d), M.granito, M.rojo);

    // Rejilla de bloques de granito (suelo, techo y paredes)
    const X = V(1, 0, 0), Yv = V(0, 1, 0), Zv = V(0, 0, 1);
    gridQuad(V(kx0, kFloor, kz0), X, Zv, K.w, K.d, 1.25, 1.3);
    gridQuad(V(kx0, kTop, kz0), X, Zv, K.w, K.d, 1.25, 1.3);
    gridQuad(V(kx0, kFloor, kz0), Zv, Yv, K.d, K.h, 1.3, 1.2);
    gridQuad(V(kx1, kFloor, kz0), Zv, Yv, K.d, K.h, 1.3, 1.2);
    gridQuad(V(kx0, kFloor, kz0), X, Yv, K.w, K.h, 1.25, 1.2);
    gridQuad(V(kx0, kFloor, kz1), X, Yv, K.w, K.h, 1.25, 1.2);
    const gridGeo = new THREE.BufferGeometry();
    gridGeo.setAttribute('position', new THREE.Float32BufferAttribute(gridSeg, 3));
    const gridObj = new THREE.LineSegments(gridGeo, M.rejilla);
    interiorGroup.add(gridObj);
    parts.push({ obj: gridObj, top: kTop });

    // Grieta en el techo (zigzag plano sobre la cámara)
    const crackPts = [[-2.2, 0], [-1.1, 0.22], [-0.5, -0.08], [0.3, 0.2], [1.0, -0.05], [2.2, 0.1], [2.2, -0.1], [1.0, -0.2], [0.3, 0.05], [-0.5, -0.25], [-1.1, -0.05], [-2.2, -0.2]];
    addPart(interiorGroup, profileGeom(crackPts, V(kx0 + 0.8, kTop, K.z), V(kx1 - 0.8, kTop, K.z)), M.granito, M.rojo);

    // Sarcófago de granito sin tapa (sección en U)
    const sarcoU = [[-0.52, 0], [0.52, 0], [0.52, 1.0], [0.40, 1.0], [0.40, 0.12], [-0.40, 0.12], [-0.40, 1.0], [-0.52, 1.0]];
    const sarcoX = -2.0;
    addPart(interiorGroup, profileGeom(sarcoU, V(sarcoX - 1.145, kFloor, K.z), V(sarcoX + 1.145, kFloor, K.z)), M.granito, M.rojo);

    // Cámaras de descarga: 5 niveles de 2.8 m (cámara 1.6 m + techo a dos aguas 1.2 m)
    for (let i = 0; i < 5; i++) {
      const y0 = I.relieving.yFrom + i * 2.8;
      addPart(interiorGroup, boxGeom(K.x, y0 + 0.8, K.z, K.w, 1.6, K.d), M.granito, M.rojo);
      const gable = [[-K.d / 2, 0], [K.d / 2, 0], [0, 1.2]];
      addPart(interiorGroup, profileGeom(gable, V(kx0, y0 + 1.6, K.z), V(kx1, y0 + 1.6, K.z)), M.granito, M.rojo);
    }

    // Gran Vacío (muones, 2017): volumen sobre la galería, sin filtro de construcción
    const voidC = gMid.clone().addScaledVector(gF.up, I.gallery.height + 2.5);
    const voidGeom = profileGeom(rectPts(6, 4), voidC.clone().addScaledVector(gA, -14), voidC.clone().addScaledVector(gA, 14));
    interiorGroup.add(new THREE.Mesh(voidGeom, M.vacioS));
    interiorGroup.add(new THREE.LineSegments(new THREE.EdgesGeometry(voidGeom), M.vacioL));

    // Resplandor rojizo en la cámara del Rey
    const glowCv = document.createElement('canvas');
    glowCv.width = glowCv.height = 128;
    const gc = glowCv.getContext('2d');
    const gr = gc.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,70,50,1)');
    gr.addColorStop(0.35, 'rgba(255,40,30,0.35)');
    gr.addColorStop(1, 'rgba(255,20,10,0)');
    gc.fillStyle = gr; gc.fillRect(0, 0, 128, 128);
    const glowTex = new THREE.CanvasTexture(glowCv);
    glowTex.encoding = SRGB;
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, opacity: 0, blending: ADD, depthWrite: false, depthTest: false }));
    glow.position.set(K.x, K.y, K.z);
    glow.scale.set(16, 16, 1);
    interiorGroup.add(glow);

    // Polvo flotando en la Gran Galería (posiciones base sembradas)
    const DUST_N = 220;
    let seed = 7;
    const rnd = function () { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const dustBase = new Float32Array(DUST_N * 3), dustLive = new Float32Array(DUST_N * 3), dustPhase = new Float32Array(DUST_N);
    for (let i = 0; i < DUST_N; i++) {
      const u = rnd(), hgt = rnd() * (I.gallery.height - 0.6);
      const hwAt = hw[Math.min(nSteps - 1, Math.floor(hgt / bh))] - 0.12;
      const lat = (rnd() * 2 - 1) * hwAt;
      const p = G0.clone().addScaledVector(gA, u * gL).addScaledVector(gF.side, lat).addScaledVector(gF.up, hgt);
      dustBase[i * 3] = p.x; dustBase[i * 3 + 1] = p.y; dustBase[i * 3 + 2] = p.z;
      dustLive[i * 3] = p.x; dustLive[i * 3 + 1] = p.y; dustLive[i * 3 + 2] = p.z;
      dustPhase[i] = rnd() * 6.2832;
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustLive, 3));
    interiorGroup.add(new THREE.Points(dustGeo, M.polvo));

    // ---------- camino guiado: ruta entrada -> galería -> cámara del Rey ----------
    const A_ANTE = V(0, 44.2, 6.2);
    const K_C = V(K.x, K.y, K.z);
    const PATH = [E, Dn, J, G0, G1, A_ANTE, K_C];
    const cum = [0];
    for (let i = 1; i < PATH.length; i++) cum.push(cum[i - 1] + PATH[i].distanceTo(PATH[i - 1]));
    const TOTAL = cum[cum.length - 1];
    const L1 = cum[3]; // distancia hasta el inicio de la galería
    const tmpP = new THREE.Vector3();
    function pathAt(d, out) {
      d = clamp(d, 0, TOTAL);
      let i = 0;
      while (i < PATH.length - 2 && d > cum[i + 1]) i++;
      const u = (d - cum[i]) / Math.max(1e-6, cum[i + 1] - cum[i]);
      return out.copy(PATH[i]).lerp(PATH[i + 1], u);
    }
    function distOfT(t) {
      if (t <= T_E) return 0;
      if (t <= T_G) return L1 * (t - T_E) / (T_G - T_E);
      if (t <= T_K) return L1 + (TOTAL - L1) * (t - T_G) / (T_K - T_G);
      return TOTAL;
    }
    function tOfDist(d) {
      if (d <= L1) return T_E + (T_G - T_E) * d / L1;
      return T_G + (T_K - T_G) * (d - L1) / (TOTAL - L1);
    }

    // Estela persistente: muestras equiespaciadas en distancia; drawRange según el avance
    const STELA_N = 180;
    const stepS = TOTAL / (STELA_N - 1);
    const stelaPos = new Float32Array(STELA_N * 3);
    for (let i = 0; i < STELA_N; i++) {
      pathAt(i * stepS, tmpP);
      stelaPos[i * 3] = tmpP.x; stelaPos[i * 3 + 1] = tmpP.y; stelaPos[i * 3 + 2] = tmpP.z;
    }
    const stelaGeo = new THREE.BufferGeometry();
    stelaGeo.setAttribute('position', new THREE.BufferAttribute(stelaPos, 3));
    stelaGeo.setDrawRange(0, 0);
    interiorGroup.add(new THREE.Line(stelaGeo, M.estela));

    // Explorador: cabeza brillante + rastro de partículas
    const TRAIL = 14;
    const pulsePos = new Float32Array(TRAIL * 3);
    const pulseGeo = new THREE.BufferGeometry();
    pulseGeo.setAttribute('position', new THREE.BufferAttribute(pulsePos, 3));
    interiorGroup.add(new THREE.Points(pulseGeo, M.pulso));
    const headPos = new Float32Array(3);
    const headGeo = new THREE.BufferGeometry();
    headGeo.setAttribute('position', new THREE.BufferAttribute(headPos, 3));
    interiorGroup.add(new THREE.Points(headGeo, M.explorador));

    // Tiempo de revelación de una etiqueta: cuando el explorador pasa por su punto más cercano
    function revealTime(anchor) {
      let best = 0, bd = Infinity;
      for (let i = 0; i < STELA_N; i++) {
        const dx = stelaPos[i * 3] - anchor.x, dy = stelaPos[i * 3 + 1] - anchor.y, dz = stelaPos[i * 3 + 2] - anchor.z;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 < bd) { bd = d2; best = i; }
      }
      return tOfDist(best * stepS);
    }

    // ---------- conductos ----------
    function dirOf(deg, sz) { return V(0, Math.sin(deg * DEG), sz * Math.cos(deg * DEG)).normalize(); }
    function exitOf(start, dir) {
      const sgn = dir.z > 0 ? 1 : -1;
      const f = function (s) {
        const y = start.y + dir.y * s, z = start.z + dir.z * s;
        return sgn * z - PYR.halfAt(y);
      };
      let lo = 0, hi = (H - start.y) / dir.y;
      for (let i = 0; i < 60; i++) {
        const m = (lo + hi) / 2;
        if (f(m) < 0) lo = m; else hi = m;
      }
      const s = (lo + hi) / 2;
      return { s: s, p: start.clone().addScaledVector(dir, s) };
    }
    const kN = { start: V(0, K.y, kz0), dir: dirOf(I.shaftsKings.northDeg, -1) };
    const kS = { start: V(0, K.y, kz1), dir: dirOf(I.shaftsKings.southDeg, 1) };
    const qN = { start: V(0, Q.y, Q.z - Q.d / 2), dir: dirOf(I.shaftsQueens.northDeg, -1) };
    const qS = { start: V(0, Q.y, Q.z + Q.d / 2), dir: dirOf(I.shaftsQueens.southDeg, 1) };
    [kN, kS, qN, qS].forEach(function (c) { c.exit = exitOf(c.start, c.dir); });

    [kN, kS].forEach(function (c) {
      addPart(conduitGroup, tubeGeom(c.start, c.exit.p, 0.9, 0.9), M.cian, M.cianL);
    });

    const DOOR_S = 62;
    const doors = {};
    [qN, qS].forEach(function (c, idx) {
      const door = c.start.clone().addScaledVector(c.dir, DOOR_S);
      doors[idx ? 'S' : 'N'] = door;
      addPart(conduitGroup, tubeGeom(c.start, door, 0.9, 0.9), M.cian, M.cianL);
      addLine(conduitGroup, door, c.exit.p, M.cianTenue);
      const p0 = door.clone().addScaledVector(c.dir, -0.25), p1 = door.clone().addScaledVector(c.dir, 0.25);
      addPart(conduitGroup, profileGeom(rectPts(1.1, 1.1), p0, p1), M.cobre, M.dorado);
    });
    {
      const fr = frameFor(qS.dir), door = doors.S;
      [-0.24, 0.24].forEach(function (off) {
        const g = new THREE.TorusGeometry(0.2, 0.05, 6, 14);
        const m = new THREE.Matrix4().makeBasis(fr.side, fr.up, fr.a);
        m.setPosition(door.clone().addScaledVector(fr.a, 0.32).addScaledVector(fr.side, off));
        g.applyMatrix4(m);
        conduitGroup.add(new THREE.Mesh(g, M.cobre));
      });
    }

    // ---------- rayos hacia las estrellas ----------
    const RAY_LEN = 6000;
    function addRays(c) {
      const fr = frameFor(c.dir);
      [-0.45, 0.45].forEach(function (off) {
        const p0 = c.exit.p.clone().addScaledVector(fr.side, off);
        const p1 = p0.clone().addScaledVector(c.dir, RAY_LEN);
        addLine(rayGroup, p0, p1, M.rayo);
      });
    }
    addRays(kN);
    addRays(kS);

    // ---------- etiquetas ----------
    const labels = [];
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
    // key: 'seq' (secuencial con el explorador), 'conduit' o 'ray'
    function label(group, key, text, sub, color, anchor, off, opts) {
      const cv = makeCanvas(text, sub, color);
      const mat = new THREE.SpriteMaterial({ map: cv.tex, transparent: true, opacity: 0, depthTest: false, depthWrite: false });
      const sprite = new THREE.Sprite(mat);
      const target = off ? anchor.clone().add(off) : anchor.clone();
      sprite.position.copy(target);
      group.add(sprite);
      let lm = null, ln = null;
      if (off) {
        lm = lineMat(color); lm.depthTest = false;
        ln = addLine(group, anchor, target, lm);
      }
      const L = { sprite: sprite, mat: mat, lineMat: lm, line: ln, aspect: cv.aspect, key: key, at: 0, big: !!(opts && opts.big), fade: !!(opts && opts.fade), anchor: anchor.clone(), base: target.clone() };
      if (key === 'seq') L.at = (opts && opts.at !== undefined) ? opts.at : revealTime(anchor);
      labels.push(L);
    }

    const tunMid = TUN_P0.clone().add(TUN_P1).multiplyScalar(0.5);
    const wellMid = G0.clone().add(Wd).multiplyScalar(0.5);
    const crackC = V(K.x, kTop, K.z);

    label(interiorGroup, 'seq', 'ENTRADA NORTE', '17 m SOBRE EL SUELO', GOLD, E, V(-16, 12, -10));
    label(interiorGroup, 'seq', 'TÚNEL DE AL-MAMÚN (820 d.C.)', 'ENTRADA FORZADA', AMBER, tunMid, V(-24, 10, -12));
    label(interiorGroup, 'seq', 'CÁMARA SUBTERRÁNEA', 'INACABADA · BAJO TIERRA', GOLD, V(S.x, S.y, S.z), V(-22, 8, -6));
    label(interiorGroup, 'seq', 'POZO DEL SERVICIO', 'GALERÍA → PASAJE DESCENDENTE', GOLD, wellMid, V(-14, 4, -14));
    label(interiorGroup, 'seq', 'GRAN GALERÍA', '46.7 m · 26°', GOLD, gMid, V(-22, 12, 0));
    label(interiorGroup, 'seq', 'VACÍO DESCONOCIDO · 2017 · MUONES', null, VIOLET, voidC, V(-16, 12, 10), { at: 99, big: true, fade: true });
    label(interiorGroup, 'seq', 'CÁMARA DE LA REINA', 'NICHO AL ESTE', GOLD, V(Q.x, Q.y, Q.z), V(-18, 12, -8));
    label(interiorGroup, 'seq', 'ANTECÁMARA', '3 RASTRILLOS DE GRANITO', GOLD, A_ANTE, V(-20, 14, -6));
    label(interiorGroup, 'seq', 'CÁMARA DEL REY', 'GRANITO ROJO OSCURO', RED, K_C, V(18, 26, 6));
    label(interiorGroup, 'seq', 'GRIETA EN EL TECHO', 'CÁMARA DEL REY', RED, crackC, V(12, 12, -6));
    label(interiorGroup, 'seq', 'SARCÓFAGO', 'GRANITO · SIN TAPA', RED, V(sarcoX, kFloor + 0.5, K.z), V(-12, 10, 10));
    label(interiorGroup, 'seq', 'CÁMARAS DE DESCARGA', '5 CÁMARAS · VIGAS A DOS AGUAS', RED, V(0, 59, K.z), V(-26, 20, -4));
    label(interiorGroup, 'seq', '80 TONELADAS DE GRANITO', 'SOBRE LA CÁMARA DEL REY', RED, V(0, 66, K.z), V(20, 26, 0));

    label(conduitGroup, 'conduit', '¿QUÉ HAY DETRÁS?', 'PUERTA DE GANTENBRINK (SUR)', CYAN, doors.S, V(16, 10, 4));
    label(rayGroup, 'ray', '→ THUBAN (DRACO)', 'CONDUCTO NORTE · 32.5°', CYAN, kN.exit.p.clone().addScaledVector(kN.dir, 350));
    label(rayGroup, 'ray', '→ ALNITAK (ORIÓN) · OSIRIS', 'CONDUCTO SUR · 45°', CYAN, kS.exit.p.clone().addScaledVector(kS.dir, 350));

    // ---------- update ----------
    const _camP = camera.position;
    const _pv = new THREE.Vector3();
    const _worldUp = new THREE.Vector3(0, 1, 0);
    const kTopY = kTop;
    const pathHead = new THREE.Vector3();
    function update(s) {
      const t = s.t;
      const xa = clamp01(s.xray), sa = clamp01(s.shafts), A = Math.max(xa, sa);
      root.visible = A > 0.001;
      if (!root.visible) return;

      interiorGroup.visible = xa > 0.001;
      conduitGroup.visible = true;
      rayGroup.visible = sa > 0.001;

      const pl = 0.5 + 0.5 * Math.sin(s.wall * 3.2);
      const vf = smooth(clamp01((t - 98) / 3));
      const ex = (t >= T_E && t <= T_K + 1) ? 1 : 0;

      // Opacidades (la pirámide pasa a solo aristas: el interior va más marcado)
      // Capítulo de las estrellas (t>=130): las salas se atenúan al 40% para no competir con los conductos
      const dim = t >= 130 ? 0.4 : 1;
      M.caliza.opacity = 0.26 * xa * dim;
      M.granito.opacity = 0.34 * xa * dim;
      M.dorado.opacity = 0.95 * xa * dim;
      M.rojo.opacity = 0.95 * xa * dim;
      M.rejilla.opacity = 0.45 * xa * dim;
      M.vacioS.opacity = xa * vf * (0.12 + 0.16 * pl) * dim;
      M.vacioL.opacity = xa * vf * (0.45 + 0.5 * pl) * dim;
      M.polvo.opacity = xa * 0.6;
      M.estela.opacity = xa * 0.9;
      M.pulso.opacity = xa * ex * 0.85;
      M.explorador.opacity = xa * ex;
      M.cian.opacity = A * (0.22 + 0.4 * sa);
      M.cianL.opacity = Math.min(1, A * (0.7 + 0.3 * sa));
      M.cianTenue.opacity = A * 0.45;
      M.cobre.opacity = A * 0.95;
      M.rayo.opacity = sa * (0.8 + 0.2 * Math.sin(s.wall * 2.3));

      // Construcción: al subir las hiladas solo aparece lo que ya está por debajo de la cota construida
      const showAll = t >= 130;
      const buildH = s.build * H + 3;
      for (let i = 0; i < parts.length; i++) {
        parts[i].obj.visible = showAll || parts[i].top <= buildH;
      }

      // Resplandor de la cámara del Rey
      glow.visible = interiorGroup.visible && (showAll || kTopY <= buildH);
      glow.material.opacity = xa * (0.22 + 0.08 * Math.sin(s.wall * 1.7));

      // Explorador y rastro (sincronizados con s.t)
      const headD = distOfT(t);
      if (xa > 0.001 && ex > 0) {
        for (let k = 0; k < TRAIL; k++) {
          pathAt(headD - k * 2.2, tmpP);
          pulsePos[k * 3] = tmpP.x; pulsePos[k * 3 + 1] = tmpP.y; pulsePos[k * 3 + 2] = tmpP.z;
        }
        pulseGeo.attributes.position.needsUpdate = true;
        pathAt(headD, pathHead);
        headPos[0] = pathHead.x; headPos[1] = pathHead.y; headPos[2] = pathHead.z;
        headGeo.attributes.position.needsUpdate = true;
      }
      // Estela: crece con el explorador y queda visible al terminar el recorrido
      const cnt = t < T_E ? 0 : Math.min(STELA_N, Math.floor(headD / stepS) + 1);
      stelaGeo.setDrawRange(0, cnt);

      // Polvo de la galería (deriva ambiental)
      if (xa > 0.001) {
        for (let i = 0; i < DUST_N; i++) {
          const ph = dustPhase[i], o = i * 3;
          dustLive[o] = dustBase[o] + Math.sin(s.wall * 0.4 + ph) * 0.35;
          dustLive[o + 1] = dustBase[o + 1] + Math.sin(s.wall * 0.25 + ph * 1.7) * 0.25;
          dustLive[o + 2] = dustBase[o + 2] + Math.cos(s.wall * 0.33 + ph) * 0.35;
        }
        dustGeo.attributes.position.needsUpdate = true;
      }

      // Etiquetas: secuenciales (escala + fade al pasar el explorador; visitadas al 50%)
      for (let i = 0; i < labels.length; i++) {
        const L = labels[i];
        let lvl, sc = 1;
        if (L.key === 'seq') {
          // t>=130: solo quedan las etiquetas de los conductos
          if (t < L.at || t >= 130) lvl = 0;
          else {
            const p = clamp01((t - L.at) / 0.8), e = smooth(p);
            if (p < 1) { lvl = xa * e; sc = 0.4 + 0.6 * e; }
            else lvl = xa * 0.5;
          }
          if (L.fade) lvl *= 1 - smooth(clamp01((t - 101.5) / 1.5)); // se retira antes de la cámara del Rey (t≈104)
        } else {
          lvl = L.key === 'conduit' ? A : sa;
        }
        L.mat.opacity = lvl;
        if (L.line) L.line.material.opacity = lvl * 0.8;
        if (lvl > 0.001) {
          const d = _camP.distanceTo(L.base);
          const halfTan = Math.tan(camera.fov * DEG / 2);
          let hgt = clamp(d * 0.06, 2, 14) * sc * (L.big ? 1.25 : 1);
          // ancho máximo: 25% del ancho de pantalla
          hgt = Math.min(hgt, 0.5 * d * halfTan * camera.aspect / L.aspect);
          L.sprite.scale.set(hgt * L.aspect, hgt, 1);
          // si queda pegada al borde superior, se desplaza hacia abajo
          _pv.copy(L.base).project(camera);
          const shift = _pv.y > 0.7 ? (_pv.y - 0.7) * d * halfTan : 0;
          L.sprite.position.copy(L.base).addScaledVector(_worldUp, -shift);
          if (L.line) {
            const arr = L.line.geometry.attributes.position.array;
            arr[3] = L.sprite.position.x; arr[4] = L.sprite.position.y; arr[5] = L.sprite.position.z;
            L.line.geometry.attributes.position.needsUpdate = true;
          }
        }
      }
    }

    return { update: update, group: root };
  };
})();
