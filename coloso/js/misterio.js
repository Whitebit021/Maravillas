// Misterio (capa conspiranoica del Coloso): el mito de las piernas sobre la bocana, el barco fantasma,
// la regla de 48 m, la silueta de comparación, el emplazamiento "real" y las líneas solares.
// Todo por código: geometría fusionada (lofting), shader de borde (fresnel) para el holograma,
// líneas aditivas y CanvasTexture para las etiquetas. Todas las CanvasTexture usan encoding sRGB.
(function () {
  'use strict';
  const G = window.GIZA;
  const THREE = window.THREE;

  const TAU = Math.PI * 2;
  const GOLD = 0xffcf6a, GOLD_HI = 0xffe9a8, CYAN = 0x7fe3f0, RED = 0xff3b30, SHIP = 0xd8f2ff;
  const GROUND = 0.4; // separación del suelo (evita z-fighting con near = 0.5)

  const CZ = G.SITE.harborMouth.z;                 // -260: plano de la bocana
  const TX = Math.abs(G.SITE.moleWest[2][0]);      // 80: x de la punta de cada espigón
  const FX = TX - 1.5;                             // x de los pies (encima de cada punta)

  function clamp01(x) { return x < 0 ? 0 : (x > 1 ? 1 : x); }
  function ramp(x, a, b) { return clamp01((x - a) / (b - a)); }
  function num(v) { return (typeof v === 'number' && isFinite(v)) ? v : 0; }
  function norm(v) { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }

  // ---------- generación de mallas (listas planas, luego BufferGeometry) ----------
  function newB() { return { P: [], I: [], LI: [] }; }

  // Lofting: secciones [x, y, z, rx, rz]. El eje sigue la dirección de la cadena; cada sección es una elipse.
  // rings: añade los anillos como líneas (grabado); meridians: nº de líneas longitudinales.
  function loft(B, secs, sides, rings, meridians) {
    const n = secs.length, base = B.P.length / 3;
    for (let i = 0; i < n; i++) {
      const a = secs[Math.max(0, i - 1)], b = secs[Math.min(n - 1, i + 1)], c = secs[i];
      const d = norm([b[0] - a[0], b[1] - a[1], b[2] - a[2]]);
      const ref = Math.abs(d[0]) > 0.9 ? [0, 0, 1] : [1, 0, 0];
      const k = ref[0] * d[0] + ref[1] * d[1] + ref[2] * d[2];
      const u = norm([ref[0] - d[0] * k, ref[1] - d[1] * k, ref[2] - d[2] * k]);
      const v = cross(d, u);
      for (let j = 0; j < sides; j++) {
        const th = TAU * j / sides, cs = Math.cos(th) * c[3], sn = Math.sin(th) * c[4];
        B.P.push(c[0] + u[0] * cs + v[0] * sn, c[1] + u[1] * cs + v[1] * sn, c[2] + u[2] * cs + v[2] * sn);
      }
    }
    for (let i = 0; i < n - 1; i++) {
      for (let j = 0; j < sides; j++) {
        const a = base + i * sides + j, b = base + i * sides + (j + 1) % sides, c = a + sides, d = b + sides;
        B.I.push(a, c, b, b, c, d);
      }
    }
    if (rings) {
      for (let i = 0; i < n; i++) for (let j = 0; j < sides; j++) B.LI.push(base + i * sides + j, base + i * sides + (j + 1) % sides);
    }
    for (let m = 0; m < meridians; m++) {
      const j = Math.floor(m * sides / meridians);
      for (let i = 0; i < n - 1; i++) B.LI.push(base + i * sides + j, base + (i + 1) * sides + j);
    }
  }
  // Miembro: tubo entre dos articulaciones con un abultamiento suave en el centro
  function limb(B, a, b, ra, rb, sides, meridians) {
    const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], rm = (ra + rb) * 0.55;
    loft(B, [[a[0], a[1], a[2], ra, ra], [m[0], m[1], m[2], rm, rm], [b[0], b[1], b[2], rb, rb]], sides, true, meridians);
  }
  // Articulación esférica (aproximada con anillos verticales)
  function ball(B, c, r, sides) {
    const N = 6, secs = [];
    for (let k = 0; k < N; k++) {
      const ph = Math.PI * (k + 0.5) / N, rr = r * Math.sin(ph);
      secs.push([c[0], c[1] - r * Math.cos(ph), c[2], rr, rr]);
    }
    loft(B, secs, sides, false, 4);
  }
  // Cuadrilátero plano (barra de la aspa)
  function bar(B, c, d, n, H, T) {
    const b0 = B.P.length / 3;
    const p = function (s, w) { return [c[0] + d[0] * s * H + n[0] * w * T, c[1] + d[1] * s * H + n[1] * w * T, c[2]]; };
    [p(-1, -1), p(1, -1), p(1, 1), p(-1, 1)].forEach(function (q) { B.P.push(q[0], q[1], q[2]); });
    B.I.push(b0, b0 + 1, b0 + 2, b0, b0 + 2, b0 + 3);
  }
  function fillGeo(B) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(B.P, 3));
    g.setIndex(B.I);
    g.computeVertexNormals();
    return g;
  }
  function lineGeo(B) {
    const a = new Float32Array(B.LI.length * 3);
    for (let i = 0; i < B.LI.length; i++) {
      const p = B.LI[i] * 3;
      a[i * 3] = B.P[p]; a[i * 3 + 1] = B.P[p + 1]; a[i * 3 + 2] = B.P[p + 2];
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(a, 3));
    return g;
  }
  function polyGeo(pts) {
    const a = new Float32Array(pts.length * 3);
    for (let i = 0; i < pts.length; i++) { a[i * 3] = pts[i][0]; a[i * 3 + 1] = pts[i][1]; a[i * 3 + 2] = pts[i][2]; }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(a, 3));
    return g;
  }
  // pares de puntos [a, b] -> LineSegments (cada par es un segmento)
  function pairsGeo(pairs) {
    const pos = [];
    for (let i = 0; i < pairs.length; i++) {
      const a = pairs[i][0], b = pairs[i][1];
      pos.push(a[0], a[1], a[2], b[0], b[1], b[2]);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    return g;
  }
  function circleGround(cx, cy, cz, r, n) {
    const out = [];
    for (let i = 0; i <= n; i++) { const t = i / n * TAU; out.push([cx + r * Math.cos(t), cy, cz + r * Math.sin(t)]); }
    return out;
  }
  // progreso de dibujado (en vértices): strip (Line) y segmentos (LineSegments)
  function drawStrip(obj, f) {
    const n = obj.geometry.attributes.position.count;
    obj.geometry.setDrawRange(0, Math.round(clamp01(f) * n));
  }
  function drawSegs(obj, f) {
    const n = obj.geometry.attributes.position.count;
    obj.geometry.setDrawRange(0, 2 * Math.floor(clamp01(f) * n / 2));
  }

  // ---------- materiales ----------
  // Fantasma: relleno translúcido que se ilumina en el borde (fresnel) => contorno brillante de grabado
  const GHOST_VS = 'varying vec3 vN; varying vec3 vV;\n' +
    'void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0);\n' +
    '  vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);\n' +
    '  gl_Position = projectionMatrix * mv; }';
  const GHOST_FS = 'uniform vec3 uColor; uniform float uOp; uniform float uBase; uniform float uEdge; varying vec3 vN; varying vec3 vV;\n' +
    'void main(){\n' +
    '  float f = 1.0 - abs(dot(normalize(vN), normalize(vV)));\n' +
    '  float a = uOp * (uBase + uEdge * pow(f, 2.2));\n' +
    '  gl_FragColor = vec4(uColor, a); }';
  function ghostMat(hex, base, edge) {
    return new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(hex) }, uOp: { value: 0 },
        uBase: { value: base }, uEdge: { value: edge }
      },
      vertexShader: GHOST_VS, fragmentShader: GHOST_FS,
      transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending
    });
  }
  function lineMat(hex, op) {
    return new THREE.LineBasicMaterial({
      color: hex, transparent: true, opacity: op || 0,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
  }

  // Halo radial (CanvasTexture dibujada por código)
  const glowCache = {};
  function glowTex(rgb) {
    if (glowCache[rgb]) return glowCache[rgb];
    const cv = document.createElement('canvas');
    cv.width = 128; cv.height = 128;
    const g = cv.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.12, 'rgba(' + rgb + ',0.95)');
    gr.addColorStop(0.35, 'rgba(' + rgb + ',0.28)');
    gr.addColorStop(1, 'rgba(' + rgb + ',0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(cv);
    t.encoding = THREE.sRGBEncoding;
    glowCache[rgb] = t;
    return t;
  }
  function glowSprite(rgb, size, pos) {
    const mat = new THREE.SpriteMaterial({
      map: glowTex(rgb), transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, opacity: 0
    });
    const sp = new THREE.Sprite(mat);
    sp.scale.set(size, size, 1);
    sp.position.set(pos[0], pos[1], pos[2]);
    return sp;
  }
  // Columna de luz: gradiente vertical (alfa) dibujado por código
  function columnTex() {
    const cv = document.createElement('canvas');
    cv.width = 64; cv.height = 256;
    const g = cv.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, 'rgba(127,227,240,0)');
    gr.addColorStop(0.2, 'rgba(127,227,240,0.9)');
    gr.addColorStop(0.6, 'rgba(127,227,240,0.35)');
    gr.addColorStop(1, 'rgba(127,227,240,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 256);
    const t = new THREE.CanvasTexture(cv);
    t.encoding = THREE.sRGBEncoding;
    return t;
  }

  // Etiqueta 3D: Sprite + CanvasTexture. lh = altura de letra en metros; el tamaño se ajusta al texto.
  function label(text, o) {
    const CW = 2048;
    const cv = document.createElement('canvas');
    const g0 = cv.getContext('2d');
    g0.font = 'bold 100px Georgia, serif';
    const k = g0.measureText(text).width / 100;               // ancho del texto por px de fuente
    const px = Math.max(40, Math.min(o.maxPx || 170, Math.floor(CW * 0.92 / k)));
    const CH = Math.ceil(px * 1.7);
    cv.width = CW; cv.height = CH;
    const g = cv.getContext('2d');
    g.font = 'bold ' + px + 'px Georgia, serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = o.color;
    g.shadowColor = o.color;
    g.shadowBlur = Math.round(px * 0.22);
    g.fillText(text, CW / 2, CH / 2);
    g.fillText(text, CW / 2, CH / 2);
    g.shadowBlur = 0;
    g.fillText(text, CW / 2, CH / 2);
    const tex = new THREE.CanvasTexture(cv);
    tex.encoding = THREE.sRGBEncoding;
    const mat = new THREE.SpriteMaterial({
      map: tex, transparent: true, depthWrite: false,
      depthTest: o.depthTest !== false, blending: THREE.AdditiveBlending, opacity: 0
    });
    const sp = new THREE.Sprite(mat);
    const w = o.lh * CW / px;
    sp.scale.set(w, w * CH / CW, 1);
    sp.position.set(o.pos[0], o.pos[1], o.pos[2]);
    return { sprite: sp, mat: mat };
  }

  // ---------- figuras ----------
  // El mito: figura de ~100 m con piernas abiertas, un pie sobre cada punta de espigón; antorcha en alto.
  function mythBuild() {
    const B = newB();
    // torso y cuello (secciones [x, y, z, rx, rz]); pelvis a y=46, pecho a y=80, cuello a y=92
    loft(B, [
      [0, 46, CZ, 10, 6.5], [0, 52, CZ, 11.5, 7.5], [0, 58, CZ, 10.5, 7], [0, 66, CZ, 9.5, 6.8],
      [0, 74, CZ, 12.5, 7.8], [0, 80, CZ, 13.2, 7.8], [0, 85, CZ, 9.5, 6], [0, 89, CZ, 4.8, 4.4], [0, 92.5, CZ, 3.5, 3.4]
    ], 16, true, 8);
    ball(B, [0, 95.5, CZ - 0.5], 6.2, 16);                    // cabeza (coronilla ~ 101.5 m)

    for (let i = 0; i < 2; i++) {
      const s = i === 0 ? -1 : 1;
      // piernas abiertas: cadera -> rodilla (alejada) -> tobillo sobre la punta del espigón
      const hip = [s * 9.5, 52, CZ], knee = [s * 43, 28, CZ - 1], ankle = [s * FX, 6, CZ];
      ball(B, hip, 7.2, 16);
      limb(B, hip, knee, 6.4, 4.4, 14, 4);
      ball(B, knee, 4.4, 14);
      limb(B, knee, ankle, 4.6, 2.8, 14, 4);
      ball(B, ankle, 2.6, 12);
      // pie: plano, alargado hacia el norte (-Z), apoyado en el espigón
      loft(B, [
        [s * FX, 3.2, CZ + 5, 4.0, 2.0], [s * FX, 3.0, CZ - 1, 4.2, 2.2],
        [s * FX, 2.8, CZ - 6, 3.6, 1.8], [s * FX, 2.6, CZ - 10, 2.0, 1.2]
      ], 12, true, 3);
      ball(B, [s * 11.5, 82, CZ], 4.4, 12);                   // hombro
    }
    // brazo derecho (+X) en alto con la antorcha
    limb(B, [11.5, 82, CZ], [21, 91, CZ - 1], 4.2, 3.2, 12, 3);
    limb(B, [21, 91, CZ - 1], [23, 101, CZ - 1], 3.0, 2.4, 12, 3);
    ball(B, [23.2, 102.6, CZ - 1], 2.8, 12);
    limb(B, [23.2, 103.5, CZ - 1], [23.2, 111, CZ - 1], 0.7, 0.6, 8, 2);   // mango de la antorcha
    loft(B, [
      [23.2, 111, CZ - 1, 1.0, 1.0], [23.2, 113.5, CZ - 1, 1.9, 1.9],
      [23.2, 115.5, CZ - 1, 1.5, 1.5], [23.2, 117.5, CZ - 1, 0.4, 0.4]
    ], 10, false, 2);                                       // llama
    // brazo izquierdo (-X) caído, con la mano a la altura de la cadera
    limb(B, [-11.5, 82, CZ], [-17, 68, CZ - 1], 4.2, 3.2, 12, 3);
    limb(B, [-17, 68, CZ - 1], [-18.5, 56, CZ - 1], 3.0, 2.4, 12, 3);
    ball(B, [-18.5, 54.2, CZ - 1], 2.8, 12);
    return B;
  }
  // Barco fantasma: casco alargado en Z, mástil y vela (rectángulo)
  function shipBuild() {
    const B = newB();
    loft(B, [
      [0, 0.9, -14, 0.6, 1.0], [0, 0.6, -9, 3.6, 2.0], [0, 0.4, -3, 4.6, 2.4],
      [0, 0.4, 3, 4.6, 2.4], [0, 0.6, 9, 3.6, 2.0], [0, 0.9, 14, 0.6, 1.0]
    ], 12, true, 6);
    loft(B, [[0, 0.5, 0, 0.45, 0.45], [0, 12, 0, 0.4, 0.4], [0, 22, 0, 0.3, 0.3]], 8, true, 4);
    const b0 = B.P.length / 3;
    B.P.push(-7, 12, -0.1, 7, 12, -0.1, 7, 21, -0.1, -7, 21, -0.1, -7, 12, 0.1, 7, 12, 0.1, 7, 21, 0.1, -7, 21, 0.1);
    B.I.push(b0, b0 + 1, b0 + 2, b0, b0 + 2, b0 + 3, b0 + 4, b0 + 6, b0 + 5, b0 + 4, b0 + 7, b0 + 6);
    B.LI.push(b0, b0 + 1, b0 + 1, b0 + 2, b0 + 2, b0 + 3, b0 + 3, b0);
    return B;
  }
  // Silueta de comparación: estatua moderna genérica de 46 m (túnica, antorcha en alto)
  function compareBuild(cx, cz) {
    const B = newB();
    loft(B, [
      [cx, 0, cz, 6.5, 5.6], [cx, 6, cz, 5.2, 4.4], [cx, 14, cz, 4.2, 3.5], [cx, 22, cz, 4.6, 3.6],
      [cx, 28, cz, 4.0, 3.0], [cx, 34, cz, 4.9, 3.5], [cx, 38, cz, 5.2, 3.6], [cx, 40, cz, 1.8, 1.7],
      [cx, 41.5, cz, 1.4, 1.4]
    ], 16, true, 6);
    ball(B, [cx, 43.5, cz], 2.7, 12);                        // cabeza (coronilla ~ 46 m)
    // brazo derecho en alto (-X) con la antorcha
    limb(B, [cx - 4.6, 37.5, cz], [cx - 7.5, 41.6, cz], 1.6, 1.3, 10, 2);
    limb(B, [cx - 7.5, 41.6, cz], [cx - 6.2, 43.0, cz], 1.2, 0.9, 10, 2);
    limb(B, [cx - 6.2, 43.0, cz], [cx - 6.2, 44.8, cz], 0.5, 0.45, 6, 1);
    loft(B, [[cx - 6.2, 44.8, cz, 0.9, 0.9], [cx - 6.2, 45.8, cz, 1.1, 1.1], [cx - 6.2, 46.4, cz, 0.3, 0.3]], 8, false, 2);
    // brazo izquierdo (+X) caído
    limb(B, [cx + 4.6, 37.5, cz], [cx + 5.2, 29.5, cz], 1.5, 1.1, 10, 2);
    limb(B, [cx + 5.2, 29.5, cz], [cx + 4.4, 22.8, cz], 1.0, 0.8, 10, 2);
    ball(B, [cx + 4.2, 22.2, cz], 0.9, 8);
    ball(B, [cx + 4.6, 37.5, cz], 1.6, 10);
    ball(B, [cx - 4.6, 37.5, cz], 1.6, 10);
    return B;
  }

  G.createMystery = function (ctx) {
    const THREE = ctx.THREE, scene = ctx.scene;
    const root = new THREE.Group();
    scene.add(root);

    // ================= 1. myth: el coloso del mito =================
    const figG = new THREE.Group();
    root.add(figG);
    const mB = mythBuild();
    const mythFill = ghostMat(GOLD, 0.10, 0.9);
    figG.add(new THREE.Mesh(fillGeo(mB), mythFill));
    const mythLines = new THREE.LineSegments(lineGeo(mB), lineMat(GOLD_HI, 0));
    figG.add(mythLines);

    // barco fantasma que pasa entre las piernas (de z=-350 a z=-170, bajo la entrepierna en z=-260)
    const shipG = new THREE.Group();
    shipG.position.y = G.SITE.seaLevel;
    root.add(shipG);
    const sB = shipBuild();
    const shipFill = ghostMat(SHIP, 0.12, 0.8);
    shipG.add(new THREE.Mesh(fillGeo(sB), shipFill));
    const shipLines = new THREE.LineSegments(lineGeo(sB), lineMat(SHIP, 0));
    shipG.add(shipLines);

    // ================= 2. mythCross: aspa roja + etiquetas del mito =================
    const crossG = new THREE.Group();
    root.add(crossG);
    const xB = newB();
    const XC = [0, 66, CZ - 4], DIAG_A = [0.7071, 0.7071, 0], DIAG_B = [0.7071, -0.7071, 0];
    bar(xB, XC, DIAG_A, [-0.7071, 0.7071, 0], 75, 4.2);
    bar(xB, XC, DIAG_B, [0.7071, 0.7071, 0], 75, 4.2);
    const xg = new THREE.BufferGeometry();
    xg.setAttribute('position', new THREE.Float32BufferAttribute(xB.P, 3));
    xg.setIndex(xB.I);
    const crossMat = new THREE.MeshBasicMaterial({
      color: RED, transparent: true, opacity: 0, depthTest: false, depthWrite: false, side: THREE.DoubleSide
    });
    const cross = new THREE.Mesh(xg, crossMat);
    cross.renderOrder = 4;
    crossG.add(cross);
    const labMito = label('MITO · grabado del siglo XVI', { lh: 9, color: '#ff8a7a', pos: [0, 132, CZ - 2] });
    // anotación sobre la bocana: siempre visible (no la tapan las piernas ni el barco)
    const labBocana = label('160 m de bocana: el bronce se partiría', { lh: 9, color: '#ffd27a', pos: [0, 16, CZ - 2], depthTest: false });
    crossG.add(labMito.sprite, labBocana.sprite);

    // ================= 3. realSpot: el emplazamiento real (origen) =================
    const rsG = new THREE.Group();
    root.add(rsG);
    const RS_Y = 15.25;
    const rsRings = [9, 13, 18].map(function (r) {
      const ring = new THREE.Line(polyGeo(circleGround(0, 0, 0, r, 96)), lineMat(CYAN, 0));
      ring.position.set(0, RS_Y, 0);
      rsG.add(ring);
      return ring;
    });
    const colMat = new THREE.MeshBasicMaterial({
      map: columnTex(), transparent: true, opacity: 0, depthWrite: false,
      side: THREE.DoubleSide, blending: THREE.AdditiveBlending
    });
    const col = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.4, 60, 24, 1, true), colMat);
    col.position.set(0, RS_Y + 30, 0);
    rsG.add(col);
    const rsGlow = glowSprite('127,227,240', 46, [0, RS_Y + 0.5, 0]);
    rsG.add(rsGlow);
    // línea curva (cuadrática) desde la bocana hasta el origen
    const arcPts = [];
    const A0 = [0, 2.5, CZ], A1 = [0, 120, -130], A2 = [0, RS_Y, 0];
    for (let i = 0; i <= 80; i++) {
      const u = i / 80, a = (1 - u) * (1 - u), b = 2 * (1 - u) * u, c = u * u;
      arcPts.push([a * A0[0] + b * A1[0] + c * A2[0], a * A0[1] + b * A1[1] + c * A2[1], a * A0[2] + b * A1[2] + c * A2[2]]);
    }
    const arc = new THREE.Line(polyGeo(arcPts), lineMat(CYAN, 0));
    rsG.add(arc);
    const travel = glowSprite('170,240,255', 24, arcPts[0]);
    rsG.add(travel);
    const labReal = label('AQUÍ ESTABA (probablemente)', { lh: 12, color: '#9fe9ff', pos: [-60, 40, 0] });
    rsG.add(labReal.sprite);

    // ================= 4. measure: regla de 0 a 48 m junto a la estatua =================
    const rulerG = new THREE.Group();
    root.add(rulerG);
    const RX = 14, RZ = 6;
    const rPos = [], rCol = [];
    function rseg(a, b, c) {
      rPos.push(a[0], a[1], a[2], b[0], b[1], b[2]);
      rCol.push(c[0], c[1], c[2], c[0], c[1], c[2]);
    }
    const cyanC = [0.5, 0.89, 0.94], goldC = [1.0, 0.81, 0.42];
    rseg([RX, 0, RZ], [RX, 15, RZ], cyanC);
    rseg([RX, 15, RZ], [RX, 48, RZ], goldC);
    for (let m = 0; m <= 48; m++) {
      const len = m % 10 === 0 ? 4.2 : (m % 5 === 0 ? 2.6 : 1.2);
      const c = m <= 15 ? cyanC : goldC;
      rseg([RX, m, RZ], [RX + len, m, RZ], c);
    }
    const rGeo = new THREE.BufferGeometry();
    rGeo.setAttribute('position', new THREE.Float32BufferAttribute(rPos, 3));
    rGeo.setAttribute('color', new THREE.Float32BufferAttribute(rCol, 3));
    const rulerMat = new THREE.LineBasicMaterial({
      vertexColors: true, transparent: true, opacity: 0.95,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    const ruler = new THREE.LineSegments(rGeo, rulerMat);
    rulerG.add(ruler);
    const labPed = label('PEDESTAL 15 m', { lh: 3.2, color: '#9fe9ff', pos: [0, 7.5, RZ] });
    const labEst = label('ESTATUA 33 m = 70 codos', { lh: 3.2, color: '#ffd27a', pos: [0, 31.5, RZ] });
    const labTot = label('TOTAL ~48 m', { lh: 3.2, color: '#ffe9a8', pos: [0, 50, RZ] });
    labPed.sprite.position.x = RX + 5 + labPed.sprite.scale.x / 2;
    labEst.sprite.position.x = RX + 6 + labEst.sprite.scale.x / 2;
    labTot.sprite.position.x = RX + 4 + labTot.sprite.scale.x / 2;
    rulerG.add(labPed.sprite, labEst.sprite, labTot.sprite);

    // ================= 5. compare: silueta moderna de 46 m (cian) =================
    const compG = new THREE.Group();
    root.add(compG);
    const CMX = -30, CMZ = 40;
    const cB = compareBuild(CMX, CMZ);
    const compFill = ghostMat(CYAN, 0.10, 0.9);
    compG.add(new THREE.Mesh(fillGeo(cB), compFill));
    const compLines = new THREE.LineSegments(lineGeo(cB), lineMat(CYAN, 0));
    compG.add(compLines);
    const labComp = label('EL NUEVO COLOSO · 46 m', { lh: 4, color: '#9fe9ff', pos: [CMX, 58, CMZ] });
    compG.add(labComp.sprite);

    // ================= 6. sunLines: rayos de la corona hacia el este y círculo de grados =================
    const sunG = new THREE.Group();
    root.add(sunG);
    const CROWN = [0, 46, 0];
    const rayPairs = [];
    for (let k = 0; k < 12; k++) {
      const th = TAU * k / 12;
      const S = [CROWN[0] + 2.3 * Math.cos(th), CROWN[1] + 2.3 * Math.sin(th), CROWN[2]];
      const E = [900, 0.5, 100 * Math.sin(th)];
      rayPairs.push([S, E]);
    }
    const rays = new THREE.LineSegments(pairsGeo(rayPairs), lineMat(GOLD, 0));
    sunG.add(rays);
    const ringSun = new THREE.Line(polyGeo(circleGround(0, GROUND + 0.2, 0, 150, 160)), lineMat(GOLD_HI, 0));
    sunG.add(ringSun);
    const tickPairs = [];
    for (let k = 0; k < 72; k++) {
      const a = k * 5 * Math.PI / 180;
      const major = k % 6 === 0;
      const r0 = major ? 136 : 146, r1 = 154;
      tickPairs.push([[r0 * Math.cos(a), GROUND, r0 * Math.sin(a)], [r1 * Math.cos(a), GROUND, r1 * Math.sin(a)]]);
    }
    // marca de 0° (este, salida del sol) en cian
    const ticks = new THREE.LineSegments(pairsGeo(tickPairs), lineMat(GOLD_HI, 0));
    sunG.add(ticks);
    const labSun = label('¿Alineado con el sol? (teoría)', { lh: 4, color: '#ffe08a', pos: [120, 60, 0] });
    sunG.add(labSun.sprite);

    // ---------- actualización (solo transformaciones, visibilidad, uniforms y opacidades) ----------
    function update(s) {
      const t = num(s.t), wall = num(s.wall);
      const myth = clamp01(num(s.myth));
      const mc = clamp01(num(s.mythCross));
      const rs = clamp01(num(s.realSpot));
      const me = clamp01(num(s.measure));
      const co = clamp01(num(s.compare));
      const sl = clamp01(num(s.sunLines));

      // el mito: en el prólogo (myth ~0.55, amanecer) se atenúa para no sobreexponer
      figG.visible = myth > 0.001;
      if (figG.visible) {
        const shimmer = 1 + 0.05 * Math.sin(wall * 1.3);
        mythFill.uniforms.uOp.value = 0.75 * myth * shimmer;
        mythLines.material.opacity = 0.7 * myth;
      }
      // barco fantasma: solo durante el mito (t >= 165)
      const shipK = t >= 165 ? myth : 0;
      shipG.visible = shipK > 0.001;
      if (shipG.visible) {
        shipG.position.z = -350 + 180 * ramp(t, 174, 190);
        shipFill.uniforms.uOp.value = 0.6 * shipK;
        shipLines.material.opacity = 0.7 * shipK;
      }

      // aspa roja y etiquetas del mito
      crossG.visible = mc > 0.001;
      if (crossG.visible) {
        crossMat.opacity = 0.9 * mc;
        labMito.mat.opacity = mc;
        labBocana.mat.opacity = mc;
      }

      // emplazamiento real
      rsG.visible = rs > 0.001;
      if (rsG.visible) {
        for (let i = 0; i < rsRings.length; i++) {
          const k = 1 + 0.12 * Math.sin(wall * 1.5 + i * 2.1);
          rsRings[i].scale.set(k, 1, k);
          rsRings[i].material.opacity = rs * (0.55 + 0.45 * Math.sin(wall * 3 + i));
        }
        colMat.opacity = 0.5 * rs;
        rsGlow.material.opacity = rs * (0.7 + 0.3 * Math.sin(wall * 2.2));
        drawStrip(arc, rs);
        arc.material.opacity = 0.85 * rs;
        const idx = Math.floor(((wall * 0.25) % 1 + 1) % 1 * (arcPts.length - 1));
        travel.position.set(arcPts[idx][0], arcPts[idx][1], arcPts[idx][2]);
        travel.material.opacity = 0.9 * rs;
        labReal.mat.opacity = rs;
      }

      // regla de 48 m: se dibuja de abajo arriba
      rulerG.visible = me > 0.001;
      if (rulerG.visible) {
        drawSegs(ruler, me);
        labPed.mat.opacity = me;
        labEst.mat.opacity = me;
        labTot.mat.opacity = me;
      }

      // silueta de comparación
      compG.visible = co > 0.001;
      if (compG.visible) {
        compFill.uniforms.uOp.value = 0.7 * co * (1 + 0.04 * Math.sin(wall * 1.1));
        compLines.material.opacity = 0.75 * co;
        labComp.mat.opacity = co;
      }

      // líneas solares y círculo de alineación
      sunG.visible = sl > 0.001;
      if (sunG.visible) {
        drawSegs(rays, ramp(sl, 0, 0.6));
        rays.material.opacity = 0.8 * sl;
        drawStrip(ringSun, ramp(sl, 0.2, 0.6));
        ringSun.material.opacity = 0.9 * sl;
        drawSegs(ticks, ramp(sl, 0.4, 0.9));
        ticks.material.opacity = 0.9 * sl;
        labSun.mat.opacity = ramp(sl, 0.6, 1);
      }
    }

    return { update: update };
  };
})();
