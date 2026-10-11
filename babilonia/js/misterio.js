// Misterio de Babilonia (capa conspiranoica): la reina Amitis fantasma mirando a las montañas de Media,
// el pergamino holográfico de Heródoto con su hueco, el gran mapa Babilonia-Nínive (≈450 km) con unos jardines
// fantasma en miniatura en Nínive y las cotas del monumento (120 m de lado, 25 m de alto, 5 terrazas y un
// caudalímetro de ≈ 8.000 L/hora junto a la cisterna).
// Todo por código: geometría fusionada (lofting, rejillas, tiras), shader de borde (fresnel), sprites de halo,
// CanvasTexture (sRGB) para el pergamino, el mapa y las etiquetas con placa oscura.
// Todo es función del estado s (no acumulativo): si el tiempo retrocede o salta, la escena se recompone bien.
(function () {
  'use strict';
  const G = window.GIZA;
  const THREE = window.THREE;

  const TAU = Math.PI * 2;
  const GOLD = 0xffd27a, GOLD_HI = 0xffe9a8, CYAN = 0x7fe3f0, MINT = 0xb8f0a0;

  function clamp01(x) { return x < 0 ? 0 : (x > 1 ? 1 : x); }
  function ramp(x, a, b) { return clamp01((x - a) / (b - a)); }
  function smooth(x) { x = clamp01(x); return x * x * (3 - 2 * x); }
  function num(v) { return (typeof v === 'number' && isFinite(v)) ? v : 0; }

  const SITE = G.SITE, GARD = G.GARDENS;
  const TOP_Y = GARD.tiers[GARD.tiers.length - 1][1];                 // 25 m: terraza superior
  const AMY = [0, TOP_Y, 0];                                          // pies de la reina Amitis
  const HER = SITE.herodotus || { x: 0, y: 40, z: -48 };
  const MAP = SITE.map || { cx: 0, cz: -330, y: 1.5, babylon: [0, -100], nineveh: [-40, -560] };
  const CIS = GARD.cistern || { x: -12, z: 0, y: 25, half: 6 };
  const HALF = GARD.tiers[0][2];                                      // semilado de la base: 60 m (120 m de lado)
  const MAPW = 300, MAPL = 500, MPX = 4;                              // mapa 300 x 500 m, 4 px por metro
  const MAP_Z0 = MAP.cz - MAPL / 2;                                   // borde norte del mapa (z = -580)
  const DZ = -HALF - 10;                                              // línea de cota norte (z = -70)

  // ---------- utilidades de malla ----------
  function newB() { return { P: [], I: [] }; }
  function norm(v) { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  // lofting: secciones [x, y, z, rx, rz] a lo largo de la cadena; cada sección es una elipse
  function loft(B, secs, sides) {
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
    for (let i = 0; i < n - 1; i++) for (let j = 0; j < sides; j++) {
      const a = base + i * sides + j, b = base + i * sides + (j + 1) % sides, c = a + sides, d = b + sides;
      B.I.push(a, c, b, b, c, d);
    }
  }
  // rejilla paramétrica fn(u, w) -> [x,y,z]; open = superficie abierta (sin cerrar en w)
  function grid(B, rows, cols, fn, open) {
    const nc = open ? cols + 1 : cols, base = B.P.length / 3;
    for (let i = 0; i <= rows; i++) for (let j = 0; j < nc; j++) {
      const p = fn(i / rows, j / cols); B.P.push(p[0], p[1], p[2]);
    }
    for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
      const a = base + i * nc + j, b = base + i * nc + ((j + 1) % nc), c = a + nc, d = b + nc;
      B.I.push(a, c, b, b, c, d);
    }
  }
  function limb(B, a, b, ra, rb, sides) {
    const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], rm = (ra + rb) * 0.55;
    loft(B, [[a[0], a[1], a[2], ra, ra], [m[0], m[1], m[2], rm, rm], [b[0], b[1], b[2], rb, rb]], sides);
  }
  function ball(B, c, r, sides) {
    const N = 6, secs = [];
    for (let k = 0; k < N; k++) {
      const ph = Math.PI * (k + 0.5) / N, rr = r * Math.sin(ph);
      secs.push([c[0], c[1] - r * Math.cos(ph), c[2], rr, rr]);
    }
    loft(B, secs, sides);
  }
  function boxB(B, c, hx, hy, hz) {
    const base = B.P.length / 3;
    const v = [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]];
    for (let i = 0; i < 8; i++) B.P.push(c[0] + v[i][0] * hx, c[1] + v[i][1] * hy, c[2] + v[i][2] * hz);
    const f = [0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5, 2, 3, 7, 2, 7, 6, 3, 0, 4, 3, 4, 7];
    for (let i = 0; i < f.length; i++) B.I.push(base + f[i]);
  }
  function fillGeo(B) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(B.P, 3));
    g.setIndex(B.I);
    g.computeVertexNormals();
    return g;
  }
  // segmentos sueltos (pares de puntos)
  function seg(S, a, b) { S.P.push(a[0], a[1], a[2], b[0], b[1], b[2]); }
  function segGeo(S) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(S.P, 3));
    return g;
  }
  function boxEdges(S, c, hx, hy, hz) {
    const v = [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1], [-1, 1, -1], [1, 1, -1], [1, 1, 1], [-1, 1, 1]];
    const p = v.map(function (q) { return [c[0] + q[0] * hx, c[1] + q[1] * hy, c[2] + q[2] * hz]; });
    [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]]
      .forEach(function (e) { seg(S, p[e[0]], p[e[1]]); });
  }
  // líneas de una rejilla cerrada (isolíneas cada rowEvery filas y colEvery columnas)
  function gridLines(S, fn, rows, cols, rowEvery, colEvery) {
    for (let i = 0; i <= rows; i += rowEvery) for (let j = 0; j < cols; j++) seg(S, fn(i / rows, j / cols), fn(i / rows, (j + 1) / cols));
    for (let j = 0; j < cols; j += colEvery) for (let i = 0; i < rows; i++) seg(S, fn(i / rows, j / cols), fn((i + 1) / rows, j / cols));
  }
  // círculo en el plano horizontal (y constante)
  function circleSeg(S, cx, y, cz, r, n) {
    for (let j = 0; j < n; j++) {
      const a = TAU * j / n, b = TAU * (j + 1) / n;
      seg(S, [cx + r * Math.cos(a), y, cz + r * Math.sin(a)], [cx + r * Math.cos(b), y, cz + r * Math.sin(b)]);
    }
  }
  // progreso de dibujado de un LineSegments (par de vértices)
  function drawN(obj, f) {
    const n = obj.geometry.attributes.position.count;
    obj.geometry.setDrawRange(0, 2 * Math.floor(clamp01(f) * n / 2));
  }

  // ---------- materiales ----------
  // Fantasma: relleno translúcido que se ilumina hacia el borde (fresnel)
  const GH_VS = 'varying vec3 vN; varying vec3 vV;\n' +
    'void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0);\n' +
    '  vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);\n' +
    '  gl_Position = projectionMatrix * mv; }';
  const GH_FS = 'uniform vec3 uA; uniform vec3 uB; uniform float uOp; uniform float uBase; uniform float uEdge; varying vec3 vN; varying vec3 vV;\n' +
    'void main(){\n' +
    '  float f = 1.0 - abs(dot(normalize(vN), normalize(vV)));\n' +
    '  float a = uOp * (uBase + uEdge * pow(f, 2.0));\n' +
    '  vec3 c = mix(uA, uB, pow(f, 1.4));\n' +
    '  gl_FragColor = vec4(c, a); }';
  function ghostMat(colA, colB, base, edge) {
    return new THREE.ShaderMaterial({
      uniforms: {
        uA: { value: new THREE.Color(colA) }, uB: { value: new THREE.Color(colB) },
        uOp: { value: 0 }, uBase: { value: base }, uEdge: { value: edge }
      },
      vertexShader: GH_VS, fragmentShader: GH_FS,
      transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending
    });
  }
  function lineMat(hex) {
    return new THREE.LineBasicMaterial({
      color: hex, transparent: true, opacity: 0, fog: false,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
  }
  // Textura radial (halo) dibujada por código
  const glowCache = {};
  function glowTex(rgbStr) {
    if (glowCache[rgbStr]) return glowCache[rgbStr];
    const cv = document.createElement('canvas');
    cv.width = 128; cv.height = 128;
    const g = cv.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.12, 'rgba(' + rgbStr + ',0.95)');
    gr.addColorStop(0.35, 'rgba(' + rgbStr + ',0.28)');
    gr.addColorStop(1, 'rgba(' + rgbStr + ',0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(cv);
    t.encoding = THREE.sRGBEncoding;
    glowCache[rgbStr] = t;
    return t;
  }
  function glowSprite(rgbStr, size, pos) {
    const mat = new THREE.SpriteMaterial({
      map: glowTex(rgbStr), transparent: true, depthWrite: false, fog: false,
      blending: THREE.AdditiveBlending, opacity: 0
    });
    const sp = new THREE.Sprite(mat);
    sp.scale.set(size, size, 1);
    sp.position.set(pos[0], pos[1], pos[2]);
    sp.visible = false;
    return sp;
  }

  // ---------- etiquetas: Sprite + CanvasTexture con placa oscura dentro del mismo lienzo ----------
  function roundRect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r);
    g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r);
    g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y); g.closePath();
  }
  // lh = altura de la letra (m) a escala 1 (a 28 m de la cámara); admite varias líneas separadas por \n
  function label(text, o) {
    const fam = 'Georgia, "Times New Roman", serif';
    const lines = text.split('\n');
    const m = document.createElement('canvas').getContext('2d');
    m.font = 'bold 100px ' + fam;
    let k = 0;
    lines.forEach(function (l) { k = Math.max(k, m.measureText(l).width / 100); });
    const px = Math.max(36, Math.min(150, Math.floor(1700 / k)));
    const pad = Math.round(px * 0.6);
    const W = Math.min(2048, Math.ceil(k * px + pad * 2));
    const lineH = px * 1.3;
    const H = Math.ceil(px * 0.9 + lineH * lines.length);
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const g = cv.getContext('2d');
    roundRect(g, 3, 3, W - 6, H - 6, Math.round(Math.min(H, px * 1.2) * 0.35));
    g.fillStyle = 'rgba(8,6,16,0.68)'; g.fill();
    g.font = 'bold ' + px + 'px ' + fam;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = o.color; g.shadowColor = o.color; g.shadowBlur = Math.round(px * 0.22);
    lines.forEach(function (l, i) {
      const y = H / 2 + (i - (lines.length - 1) / 2) * lineH;
      g.fillText(l, W / 2, y); g.fillText(l, W / 2, y);
    });
    g.shadowBlur = 0;
    lines.forEach(function (l, i) {
      g.fillText(l, W / 2, H / 2 + (i - (lines.length - 1) / 2) * lineH);
    });
    const tex = new THREE.CanvasTexture(cv);
    tex.encoding = THREE.sRGBEncoding;
    const mat = new THREE.SpriteMaterial({
      map: tex, transparent: true, depthWrite: false, depthTest: false, fog: false, opacity: 0
    });
    const sp = new THREE.Sprite(mat);
    const mpp = o.lh / px;
    sp.visible = false;
    sp.renderOrder = 3;
    return {
      sprite: sp, mat: mat, w: W * mpp, h: H * mpp,
      p: new THREE.Vector3(o.pos[0], o.pos[1], o.pos[2]), fmax: o.fmax || 20
    };
  }
  // escala la etiqueta con la distancia de la cámara (tamaño aparente casi constante) y fija su opacidad
  function setLab(L, camera, op) {
    op = clamp01(op);
    if (op <= 0.001) { L.sprite.visible = false; return; }
    const d = camera.position.distanceTo(L.p);
    const f = Math.max(0.3, Math.min(L.fmax, d / 28));
    L.sprite.position.copy(L.p);
    L.sprite.scale.set(L.w * f, L.h * f, 1);
    L.mat.opacity = op;
    L.sprite.visible = true;
  }
  // Colocación de etiquetas: se busca una posición de pantalla sin solaparse con el HUD (rótulo central,
  // subtítulos, panel superior derecho, fichas de la izquierda) ni con otras etiquetas ya colocadas.
  // Las coordenadas de pantalla son fracciones (0..1) con origen arriba a la izquierda.
  const HUD_ZONES = [[0.2, 0.25, 0.8, 0.5], [0, 0.82, 1, 1], [0.8, 0, 1, 0.3], [0, 0.18, 0.2, 0.82]];
  const _v = new THREE.Vector3(), _r = new THREE.Vector3(), _u = new THREE.Vector3(), _ndc = new THREE.Vector3();
  const _m = new THREE.Matrix4();
  function rectHit(a, b) { return a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1]; }
  function layoutLabels(items, camera) {
    const tanF = Math.tan(camera.fov * Math.PI / 360);
    const placed = [];
    camera.updateMatrixWorld();
    _m.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    _r.set(1, 0, 0).applyQuaternion(camera.quaternion);
    _u.set(0, 1, 0).applyQuaternion(camera.quaternion);
    items.forEach(function (it) {
      const L = it.L;
      if (it.op <= 0.001) return;
      const A = _v.set(it.a[0], it.a[1], it.a[2]);
      const d = Math.max(0.1, camera.position.distanceTo(A));
      const hh = 2 * d * tanF, ww = hh * camera.aspect;
      const f = Math.max(0.3, Math.min(L.fmax, d / 28));
      const lw = L.w * f / ww, lh = L.h * f / hh;
      _ndc.copy(A).applyMatrix4(_m);
      const sx = _ndc.x * 0.5 + 0.5, sy = 0.5 - _ndc.y * 0.5;
      // candidatos: sobre el ancla y, si choca, apiladas arriba o abajo
      const cands = [[sx, sy]];
      for (let k = 1; k <= 14; k++) { cands.push([sx, sy - k * (lh + 0.015)]); cands.push([sx, sy + k * (lh + 0.015)]); }
      let best = null;
      for (let i = 0; i < cands.length && !best; i++) {
        const c = cands[i];
        const r = [c[0] - lw / 2, c[1] - lh / 2, c[0] + lw / 2, c[1] + lh / 2];
        if (r[0] < 0.01 || r[2] > 0.99 || r[1] < 0.01 || r[3] > 0.99) continue;
        if (HUD_ZONES.some(function (z) { return rectHit(r, z); })) continue;
        if (placed.some(function (p) { return rectHit(r, p); })) continue;
        best = c;
        placed.push(r);
      }
      if (!best) { best = [sx, sy]; placed.push([sx - lw / 2, sy - lh / 2, sx + lw / 2, sy + lh / 2]); }
      // desplazamiento de pantalla -> mundo, a la distancia del ancla
      L.p.copy(A).addScaledVector(_r, (best[0] - sx) * ww).addScaledVector(_u, (sy - best[1]) * hh);
    });
  }
  function wrapText(g, text, maxW) {
    const words = text.split(' '), out = [];
    let cur = '';
    words.forEach(function (w) {
      const t = cur ? cur + ' ' + w : w;
      if (cur && g.measureText(t).width > maxW) { out.push(cur); cur = w; } else cur = t;
    });
    if (cur) out.push(cur);
    return out;
  }

  // ---------- 1. Amitis: figura fantasma (≈ 10 m), túnica con pliegues, velo y tiara ----------
  // perfil de la túnica [y, rx, rz] (Catmull-Rom); la reina mira a -Z (norte); su derecha es +X
  const ROBE = [[0, 4.2, 3.5], [0.6, 3.6, 2.9], [2.0, 2.8, 2.3], [4.0, 2.3, 1.95], [6.0, 2.0, 1.6],
    [7.6, 2.0, 1.45], [8.7, 2.25, 1.5], [9.5, 1.85, 1.15], [10.0, 1.1, 0.85], [10.3, 0.62, 0.58]];
  function keyAt(K, y, c) {
    if (y <= K[0][0]) return K[0][c];
    const n = K.length;
    for (let i = 0; i < n - 1; i++) {
      if (y <= K[i + 1][0]) {
        const p1 = K[i], p2 = K[i + 1];
        const p0 = K[Math.max(0, i - 1)], p3 = K[Math.min(n - 1, i + 2)];
        const u = (y - p1[0]) / Math.max(1e-6, p2[0] - p1[0]);
        const u2 = u * u, u3 = u2 * u;
        return 0.5 * ((2 * p1[c]) + (-p0[c] + p2[c]) * u + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * u2 + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * u3);
      }
    }
    return K[n - 1][c];
  }
  function robePoint(u, w) {
    const y = u * 10.3, th = w * TAU;
    const rx = keyAt(ROBE, y, 1), rz = keyAt(ROBE, y, 2);
    // pliegues: más marcados en la falda, suaves hacia el busto
    const amp = 0.25 + 0.75 * (1 - smooth((y - 3) / 4));
    const pl = 1 + amp * (0.05 * Math.sin(7 * th + 0.6 * Math.sin(0.4 * y)) + 0.02 * Math.sin(15 * th + 1.3 * y));
    return [Math.cos(th) * rx * pl, y, Math.sin(th) * rz * pl];
  }
  function headPoint(u, w) {
    const ph = u * Math.PI, th = w * TAU, c = Math.cos(ph), s = Math.sin(ph);
    const jaw = 1 - 0.12 * smooth(-c);                         // mandíbula algo más estrecha
    return [0.72 * s * Math.cos(th) * jaw, 11.2 + 0.86 * c, 0.8 * s * Math.sin(th) * jaw];
  }
  // velo: cae desde la diadema por la espalda hasta la cintura (superficie abierta)
  function veilPoint(u, w) {
    const v = u, sx = w * 2 - 1, y = 11.95 - 6.2 * v;
    const rz = keyAt(ROBE, Math.max(0, Math.min(10.3, y)), 2);
    const halfW = 0.85 + 0.75 * v;
    const z = Math.max(0.85 + 0.2 * v, rz + 0.22) + 0.1 * (1 - sx * sx);
    return [sx * halfW + 0.07 * Math.sin(v * 9 + sx * 2.5), y, z + 0.05 * Math.sin(v * 7 - sx * 3)];
  }
  function buildAmitis() {
    const B = newB(), K = newB(), L = { P: [] };
    grid(B, 40, 56, robePoint, false);                         // túnica con pliegues
    grid(K, 20, 32, headPoint, false);                         // cabeza (elipsoide suave)
    grid(B, 14, 16, veilPoint, true);                          // velo
    loft(K, [[0, 9.9, 0, 0.5, 0.46], [0, 10.6, 0, 0.43, 0.4], [0, 11.1, 0, 0.4, 0.38]], 24);   // cuello
    // brazo derecho (+X) caído, brazo izquierdo (−X) señalando el norte, hacia Media
    const S = [1.55, 9.1, -0.2], E = [1.95, 7.1, -0.5], Wr = [1.85, 5.2, -0.7], Hd = [1.8, 4.7, -0.75];
    ball(B, S, 0.6, 16);
    limb(B, S, E, 0.46, 0.4, 14);
    limb(B, E, Wr, 0.4, 0.3, 12);
    ball(K, Hd, 0.26, 12);
    const S2 = [-1.55, 9.1, -0.2], E2 = [-1.9, 8.5, -1.3], W2 = [-1.75, 8.8, -2.5], Hd2 = [-1.7, 8.9, -2.95];
    ball(B, S2, 0.6, 16);
    limb(B, S2, E2, 0.46, 0.4, 14);
    limb(B, E2, W2, 0.4, 0.3, 12);
    ball(K, Hd2, 0.26, 12);
    // diadema con picos y gema en la frente
    loft(B, [[0, 11.55, 0, 0.77, 0.8], [0, 11.62, 0, 0.8, 0.83], [0, 11.7, 0, 0.77, 0.8]], 40);
    for (let k = 0; k < 7; k++) {
      const a = -Math.PI / 2 + (k - 3) * 0.34;
      const bx = 0.8 * Math.cos(a), bz = 0.8 * Math.sin(a);
      loft(B, [[bx, 11.7, bz, 0.07, 0.07], [bx * 1.05, 12.2, bz * 1.05, 0.01, 0.01]], 8);
    }
    ball(B, [0, 11.62, -0.84], 0.12, 8);
    // collar de cuentas en el escote
    for (let k = 0; k < 16; k++) {
      const a = TAU * k / 16;
      ball(B, [0.95 * Math.cos(a), 9.95, 0.85 * Math.sin(a) - 0.05], 0.09, 6);
    }
    // contorno: isolíneas de la túnica, de la cabeza y del velo
    L.P = [];
    gridLines(L, robePoint, 40, 56, 4, 8);
    gridLines(L, headPoint, 20, 32, 4, 8);
    return { B: B, K: K, L: L };
  }

  // ---------- montañas de Media (siluetas fantasma al norte) ----------
  function mountains(B, S, z, sc, ph) {
    const N = 240, X0 = -1500, X1 = 1500, base = B.P.length / 3;
    const H = [];
    for (let i = 0; i <= N; i++) {
      const x = X0 + (X1 - X0) * i / N;
      H.push(Math.max(8, sc * (90 + 60 * Math.abs(Math.sin(x * 0.011 + ph)) + 35 * Math.abs(Math.sin(x * 0.029 + 2 * ph)) + 14 * Math.sin(x * 0.13 + ph))));
    }
    for (let i = 0; i <= N; i++) {
      const x = X0 + (X1 - X0) * i / N;
      B.P.push(x, H[i], z, x, -2, z);
    }
    for (let i = 0; i < N; i++) {
      const a = base + 2 * i, b = a + 2, c = a + 1, d = b + 1;
      B.I.push(a, c, b, b, c, d);
    }
    for (let i = 0; i < N; i++) {
      const xa = X0 + (X1 - X0) * i / N, xb = X0 + (X1 - X0) * (i + 1) / N;
      seg(S, [xa, H[i], z], [xb, H[i + 1], z]);
    }
  }

  // ---------- 2. Heródoto: pergamino holográfico con texto griego y un hueco brillante ----------
  const HERO_TXT = 'Ἡροδότου Ἁλικαρνησσέος ἱστορίης ἀπόδεξις ἥδε, ὡς μήτε τὰ γενόμενα ἐξ ἀνθρώπων τῷ χρόνῳ ἐξίτηλα γένηται, μήτε ἔργα μεγάλα τε καὶ θωμαστά, τὰ μὲν Ἕλλησι τὰ δὲ βαρβάροισι ἀποδεχθέντα, ἀκλεᾶ γένηται, τά τε ἄλλα καὶ δι᾽ ἥν αἰτίην ἐπολέμησαν ἀλλήλοισι.';
  function scrollTex() {
    const W = 2048, H = 1280;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const g = cv.getContext('2d');
    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, 'rgba(34,26,44,0.94)'); bg.addColorStop(1, 'rgba(14,10,24,0.94)');
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(255,210,122,0.9)'; g.lineWidth = 12; g.strokeRect(40, 40, W - 80, H - 80);
    g.strokeStyle = 'rgba(127,227,240,0.5)'; g.lineWidth = 3; g.strokeRect(70, 70, W - 140, H - 140);
    g.textBaseline = 'middle';
    g.textAlign = 'center';
    g.fillStyle = '#ffd27a'; g.font = 'bold 60px Georgia, "Times New Roman", serif';
    g.fillText('ΗΡΟΔΟΤΟΥ ἱστορίη', W / 2, 165);
    // dos columnas de texto (la misma frase tres veces, como un pergamino copiado)
    g.font = '40px Georgia, "Times New Roman", serif';
    g.fillStyle = 'rgba(243,227,181,0.95)';
    g.textAlign = 'left';
    const lines = wrapText(g, [HERO_TXT, HERO_TXT, HERO_TXT].join('  ·  '), 780);
    const cols = [150, 1110], lineH = 58, y0 = 262, yMax = H - 130;
    let li = 0;
    cols.forEach(function (cx) {
      for (let y = y0; y <= yMax && li < lines.length; y += lineH, li++) g.fillText(lines[li], cx, y);
    });
    // hueco: tinta borrada en el centro y, dentro, un resplandor rojo
    g.fillStyle = 'rgba(10,8,16,1)';
    g.beginPath(); g.arc(W / 2, H / 2, 118, 0, TAU); g.fill();
    const hg = g.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, 240);
    hg.addColorStop(0, 'rgba(255,250,240,1)');
    hg.addColorStop(0.12, 'rgba(255,80,60,0.95)');
    hg.addColorStop(0.4, 'rgba(255,59,48,0.35)');
    hg.addColorStop(1, 'rgba(255,59,48,0)');
    g.fillStyle = hg;
    g.beginPath(); g.arc(W / 2, H / 2, 240, 0, TAU); g.fill();
    const tex = new THREE.CanvasTexture(cv);
    tex.encoding = THREE.sRGBEncoding;
    return tex;
  }

  // ---------- 3. Mapa holográfico: Éufrates, Tigris, Babilonia y Nínive ----------
  function mapTex() {
    const W = Math.round(MAPW * MPX), H = Math.round(MAPL * MPX);
    const px = function (x) { return (x - MAP.cx + MAPW / 2) * MPX; };
    const py = function (z) { return (z - MAP_Z0) * MPX; };
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const g = cv.getContext('2d');
    g.fillStyle = 'rgba(6,14,28,0.86)'; g.fillRect(0, 0, W, H);
    // cuadrícula cada 50 m
    g.strokeStyle = 'rgba(127,227,240,0.16)'; g.lineWidth = 2;
    for (let x = -150; x <= 150; x += 50) { g.beginPath(); g.moveTo(px(x), 0); g.lineTo(px(x), H); g.stroke(); }
    for (let z = -550; z <= -100; z += 50) { g.beginPath(); g.moveTo(0, py(z)); g.lineTo(W, py(z)); g.stroke(); }
    function river(pts) {
      g.beginPath();
      pts.forEach(function (p, i) { if (i === 0) g.moveTo(px(p[0]), py(p[1])); else g.lineTo(px(p[0]), py(p[1])); });
      g.lineCap = 'round'; g.lineJoin = 'round';
      g.strokeStyle = 'rgba(63,182,255,0.45)'; g.lineWidth = 22; g.shadowColor = '#3fb6ff'; g.shadowBlur = 36; g.stroke();
      g.shadowBlur = 0;
      g.strokeStyle = '#d6f4ff'; g.lineWidth = 5; g.stroke();
    }
    // Éufrates (pasa junto a Babilonia) y Tigris (pasa junto a Nínive)
    river([[-78, -600], [-66, -520], [-50, -440], [-30, -350], [-14, -260], [-6, -180], [-3, -120], [0, -95], [8, -60], [18, -20]]);
    river([[-34, -600], [-18, -530], [6, -450], [30, -370], [52, -290], [66, -210], [80, -140], [92, -80]]);
    g.shadowBlur = 0;
    // marco y rótulo de norte
    g.strokeStyle = 'rgba(127,227,240,0.9)'; g.lineWidth = 8; g.strokeRect(4, 4, W - 8, H - 8);
    g.fillStyle = 'rgba(127,227,240,0.9)'; g.font = 'bold 44px Georgia, serif'; g.textAlign = 'right'; g.textBaseline = 'top';
    g.fillText('N ▲', W - 24, 24);
    const tex = new THREE.CanvasTexture(cv);
    tex.encoding = THREE.sRGBEncoding;
    return tex;
  }
  // ruta discontinua animada entre dos puntos (tira con uv.x = distancia en metros)
  const ROUTE_VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
  const ROUTE_FS = 'uniform float uT; uniform float uOp; varying vec2 vUv;\n' +
    'void main(){\n' +
    '  float d = fract(vUv.x / 18.0 - uT);\n' +
    '  float dash = step(d, 0.55);\n' +
    '  float edge = smoothstep(0.0, 0.2, vUv.y) * smoothstep(1.0, 0.8, vUv.y);\n' +
    '  gl_FragColor = vec4(vec3(0.5, 0.9, 0.95), uOp * dash * edge * 0.85); }';
  function routeGeo(A, Bp, hw, y) {
    const dx = Bp[0] - A[0], dz = Bp[1] - A[1], L = Math.hypot(dx, dz) || 1;
    const nx = -dz / L * hw, nz = dx / L * hw;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([
      A[0] - nx, y, A[1] - nz, A[0] + nx, y, A[1] + nz, Bp[0] - nx, y, Bp[1] - nz, Bp[0] + nx, y, Bp[1] + nz
    ], 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 0, 1, L, 0, L, 1], 2));
    g.setIndex([0, 2, 1, 1, 2, 3]);
    return g;
  }

  // ---------- 4. cotas del monumento ----------
  function buildMeasure() {
    const S = { P: [] };
    // 120 m de lado, a lo largo de la cara norte (z = -60)
    seg(S, [-HALF, 0.5, DZ], [HALF, 0.5, DZ]);
    seg(S, [-HALF, 0.5, DZ - 2.5], [-HALF, 0.5, DZ + 2.5]);
    seg(S, [HALF, 0.5, DZ - 2.5], [HALF, 0.5, DZ + 2.5]);
    seg(S, [-HALF, 0.5, -HALF - 1], [-HALF, 0.5, DZ - 3]);
    seg(S, [HALF, 0.5, -HALF - 1], [HALF, 0.5, DZ - 3]);
    // 25 m de alto, con una marca por cada una de las 5 terrazas
    const VX = -HALF - 14, VZ = DZ - 4;
    seg(S, [VX, 0.5, VZ], [VX, TOP_Y, VZ]);
    [0, 5, 10, 15, 20, 25].forEach(function (y) { seg(S, [VX - 1.8, y, VZ], [VX + 1.8, y, VZ]); });
    // caudalímetro junto a la cisterna: tubería, pie y esfera con su aguja
    const GX = CIS.x - CIS.half - 3, GY = CIS.y;
    seg(S, [CIS.x - CIS.half, GY + 1.0, 0], [GX, GY + 1.0, 0]);
    seg(S, [GX, GY, 0], [GX, GY + 3.5, 0]);
    const dy = GY + 4.6, R = 1.0;
    for (let k = 0; k < 12; k++) {
      const a = TAU * k / 12, r0 = R * 0.82;
      seg(S, [GX, dy + r0 * Math.cos(a), r0 * Math.sin(a)], [GX, dy + R * Math.cos(a), R * Math.sin(a)]);
    }
    seg(S, [GX, dy, 0], [GX, dy + 0.75, 0.25]);
    const dimLines = new THREE.LineSegments(segGeo(S), lineMat(CYAN));
    dimLines.renderOrder = 2;
    // esfera del caudalímetro (anillo y disco oscuro), en el plano YZ (mira a -X)
    const ring = new THREE.Mesh(new THREE.RingGeometry(R * 0.95, R, 48), new THREE.MeshBasicMaterial({
      color: CYAN, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false
    }));
    ring.rotation.y = Math.PI / 2; ring.position.set(GX, dy, 0);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(R * 0.95, 40), new THREE.MeshBasicMaterial({
      color: 0x0a0814, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, fog: false
    }));
    disc.rotation.y = Math.PI / 2; disc.position.set(GX - 0.02, dy, 0);
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, CIS.x - CIS.half - GX, 14), new THREE.MeshBasicMaterial({
      color: 0xc9a477, transparent: true, opacity: 0, depthWrite: false, fog: false
    }));
    pipe.rotation.z = Math.PI / 2; pipe.position.set((CIS.x - CIS.half + GX) / 2, GY + 1.0, 0);
    return { S: S, dimLines: dimLines, ring: ring, disc: disc, pipe: pipe, gauge: { x: GX, y: dy } };
  }

  G.createMystery = function (ctx) {
    const scene = ctx.scene, camera = ctx.camera;
    const root = new THREE.Group();
    scene.add(root);

    // ================= 1. Amitis =================
    const queenG = new THREE.Group();
    queenG.position.set(AMY[0], AMY[1], AMY[2]);
    root.add(queenG);
    queenG.visible = false;
    const QF = buildAmitis();
    const bodyMat = ghostMat(0xffe0a0, 0x7fe3f0, 0.4, 0.35);      // relleno ≈ 0.4 con rim cian
    const skinMat = ghostMat(0xfff1d6, 0xbfe9ff, 0.3, 0.3);
    const veilMat = ghostMat(0xf0e6ff, 0x9fe3ff, 0.2, 0.4);
    // la figura se mezcla por opacidad (no aditiva): legible sobre el cielo claro y sobre la noche
    bodyMat.blending = THREE.NormalBlending; skinMat.blending = THREE.NormalBlending; veilMat.blending = THREE.NormalBlending;
    const bodyM = new THREE.Mesh(fillGeo(QF.B), bodyMat);
    const skinM = new THREE.Mesh(fillGeo(QF.K), skinMat);
    bodyM.frustumCulled = false; skinM.frustumCulled = false;
    queenG.add(bodyM); queenG.add(skinM);
    const figLines = new THREE.LineSegments(segGeo(QF.L), lineMat(GOLD_HI));
    queenG.add(figLines);
    const haloQ = glowSprite('255,220,160', 22, [0, 6.5, 2.5]);
    queenG.add(haloQ);
    const ringQ = new THREE.LineSegments(segGeo((function () { const S = { P: [] }; circleSeg(S, 0, 0.3, 0, 4.4, 72); return S; })()), lineMat(CYAN));
    queenG.add(ringQ);
    // fantasma: se ve también a través de las terrazas y las casas (sin prueba de profundidad)
    queenG.traverse(function (o) { if (o.material) { o.material.depthTest = false; o.renderOrder = 5; } });
    const labQ = label('AMITIS · añoraba las montañas\nde Media (leyenda)', { lh: 0.6, color: '#ffd27a', pos: [5.2, TOP_Y + 8.6, -1.0] });
    const anchQ = [AMY[0] + 5.2, TOP_Y + 8.6, AMY[2] - 1.0];
    root.add(labQ.sprite);

    // montañas de Media: siluetas verdes fantasma al norte (solo durante la escena de Amitis)
    const mtnG = new THREE.Group();
    root.add(mtnG);
    mtnG.visible = false;
    const MB = newB(), MS = { P: [] };
    mountains(MB, MS, -760, 1.0, 0.4);
    mountains(MB, MS, -980, 1.4, 1.9);
    mountains(MB, MS, -1250, 1.9, 3.1);
    const mtnMat = ghostMat(0x3f7a32, 0x9be3a0, 0.14, 0.55);
    const mtnM = new THREE.Mesh(fillGeo(MB), mtnMat);
    mtnM.frustumCulled = false;
    mtnG.add(mtnM);
    const mtnLines = new THREE.LineSegments(segGeo(MS), lineMat(MINT));
    mtnG.add(mtnLines);

    // ================= 2. Heródoto =================
    const herG = new THREE.Group();
    herG.position.set(HER.x, HER.y, HER.z);
    root.add(herG);
    herG.visible = false;
    const scrollMat = new THREE.MeshBasicMaterial({
      map: scrollTex(), transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, fog: false
    });
    const scroll = new THREE.Mesh(new THREE.PlaneGeometry(16, 10), scrollMat);
    herG.add(scroll);
    const rollMat = new THREE.MeshBasicMaterial({ color: 0xc9a477, transparent: true, opacity: 0, fog: false });
    [5.2, -5.2].forEach(function (y) {
      const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 16.6, 20), rollMat);
      roll.rotation.z = Math.PI / 2; roll.position.set(0, y, 0);
      herG.add(roll);
    });
    const holeMat = new THREE.SpriteMaterial({
      map: glowTex('255,59,48'), transparent: true, depthWrite: false, fog: false,
      blending: THREE.AdditiveBlending, opacity: 0
    });
    const hole = new THREE.Sprite(holeMat);
    hole.scale.set(9, 9, 1); hole.position.set(0, 0, 0.4);
    hole.renderOrder = 2;
    herG.add(hole);
    const anchH = [HER.x, HER.y - 6.8, HER.z + 1];
    const labH = label('HERÓDOTO:\nni una palabra sobre los jardines', { lh: 0.8, color: '#ff9a8a', pos: anchH });
    root.add(labH.sprite);

    // ================= 3. Mapa =================
    const mapG = new THREE.Group();
    root.add(mapG);
    mapG.visible = false;
    const mapMat = new THREE.MeshBasicMaterial({
      map: mapTex(), transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, fog: false
    });
    const mapPlane = new THREE.Mesh(new THREE.PlaneGeometry(MAPW, MAPL), mapMat);
    mapPlane.rotation.x = -Math.PI / 2;
    mapPlane.position.set(MAP.cx, MAP.y, MAP.cz);
    mapG.add(mapPlane);
    // ruta discontinua animada Babilonia → Nínive
    const B0 = MAP.babylon, N0 = MAP.nineveh, Y0 = MAP.y + 0.6;
    const routeMat = new THREE.ShaderMaterial({
      uniforms: { uT: { value: 0 }, uOp: { value: 0 } }, vertexShader: ROUTE_VS, fragmentShader: ROUTE_FS,
      transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending
    });
    const route = new THREE.Mesh(routeGeo(B0, N0, 1.4, Y0), routeMat);
    route.frustumCulled = false;
    mapG.add(route);
    // marcadores: columnas de luz con halo, en Babilonia (dorado) y en Nínive (rojo: "¿aquí?")
    const pillarB = new THREE.MeshBasicMaterial({ color: GOLD, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
    const pillarN = new THREE.MeshBasicMaterial({ color: 0xff7a66, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
    const pb = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 12, 10, 1, true), pillarB);
    pb.position.set(B0[0], MAP.y + 6, B0[1]);
    const pn = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 12, 10, 1, true), pillarN);
    pn.position.set(N0[0], MAP.y + 6, N0[1]);
    mapG.add(pb); mapG.add(pn);
    const haloB = glowSprite('255,220,160', 18, [B0[0], MAP.y + 2.5, B0[1]]);
    const haloN = glowSprite('255,120,100', 18, [N0[0], MAP.y + 2.5, N0[1]]);
    mapG.add(haloB); mapG.add(haloN);
    const ringsS = { P: [] };
    circleSeg(ringsS, B0[0], MAP.y + 0.2, B0[1], 6, 40);
    circleSeg(ringsS, N0[0], MAP.y + 0.2, N0[1], 6, 40);
    const ringsLines = new THREE.LineSegments(segGeo(ringsS), lineMat(GOLD_HI));
    mapG.add(ringsLines);
    // jardines fantasma en miniatura en Nínive: pirámide verde escalonada
    const PB = newB(), PS = { P: [] };
    const tiers = [9, 7.2, 5.4, 3.6, 1.8];
    tiers.forEach(function (hx, k) {
      const c = [N0[0], MAP.y + 0.7 + 1.4 * k, N0[1]];
      boxB(PB, c, hx, 0.7, hx);
      boxEdges(PS, c, hx, 0.7, hx);
    });
    const pyrMat = ghostMat(0x6aa84f, 0xb8f0a0, 0.35, 0.6);
    const pyr = new THREE.Mesh(fillGeo(PB), pyrMat);
    pyr.frustumCulled = false;
    mapG.add(pyr);
    const pyrLines = new THREE.LineSegments(segGeo(PS), lineMat(MINT));
    mapG.add(pyrLines);
    // etiquetas del mapa
    const anchBab = [B0[0], MAP.y + 15, B0[1]], anchNin = [N0[0], MAP.y + 22, N0[1]], anchAqui = [N0[0], MAP.y + 11, N0[1]];
    const anchKm = [30, MAP.y + 6, -210], anchEuf = [-68, MAP.y + 4, -150], anchTig = [78, MAP.y + 4, -300];
    const labBab = label('BABILONIA', { lh: 1.2, color: '#ffd27a', pos: anchBab, fmax: 60 });
    const labNin = label('NÍNIVE', { lh: 1.2, color: '#ff9a8a', pos: anchNin, fmax: 60 });
    const labAqui = label('¿AQUÍ? · SENAQUERIB\n(teoría de S. Dalley)', { lh: 0.6, color: '#ffb3a8', pos: anchAqui, fmax: 60 });
    const labKm = label('≈ 450 km', { lh: 1.0, color: '#9ff3ff', pos: anchKm, fmax: 60 });
    const labEuf = label('ÉUFRATES', { lh: 0.6, color: '#9fe9ff', pos: anchEuf, fmax: 60 });
    const labTig = label('TIGRIS', { lh: 0.6, color: '#9fe9ff', pos: anchTig, fmax: 60 });
    const mapItems = [
      { L: labBab, a: anchBab }, { L: labNin, a: anchNin }, { L: labAqui, a: anchAqui },
      { L: labKm, a: anchKm }, { L: labEuf, a: anchEuf }, { L: labTig, a: anchTig }
    ];
    const mapLabs = mapItems.map(function (it) { return it.L; });
    mapLabs.forEach(function (L) { root.add(L.sprite); });

    // el holograma del mapa se proyecta por encima de las casas (no se oculta tras ellas)
    mapG.traverse(function (o) { if (o.material) { o.material.depthTest = false; o.renderOrder = 2; } });

    // ================= 4. Cotas =================
    const measG = new THREE.Group();
    root.add(measG);
    measG.visible = false;
    const M = buildMeasure();
    measG.add(M.dimLines); measG.add(M.ring); measG.add(M.disc); measG.add(M.pipe);
    const anchL = [0, 3.4, DZ], anchH25 = [-HALF - 22, 12.5, DZ - 4], anchTer = [-HALF - 22, TOP_Y + 4.5, DZ - 4];
    const anchCau = [M.gauge.x - 1.5, M.gauge.y + 6.2, 0];
    const labL = label('120 m', { lh: 1.0, color: '#ffd27a', pos: anchL, fmax: 40 });
    const labH25 = label('25 m', { lh: 1.0, color: '#ffd27a', pos: anchH25, fmax: 40 });
    const labTer = label('5 TERRAZAS', { lh: 0.9, color: '#ffd27a', pos: anchTer, fmax: 40 });
    const labCau = label('≈ 8.000 L/hora (estimación)', { lh: 0.7, color: '#9ff3ff', pos: anchCau, fmax: 40 });
    const measItems = [
      { L: labL, a: anchL }, { L: labH25, a: anchH25 }, { L: labTer, a: anchTer }, { L: labCau, a: anchCau }
    ];
    const measLabs = measItems.map(function (it) { return it.L; });
    measLabs.forEach(function (L) { root.add(L.sprite); });

    // ---------- actualización por fotograma ----------
    function update(s) {
      const wall = num(s.wall);

      // Amitis
      const ua = clamp01(num(s.amytis));
      queenG.visible = ua > 0.001;
      mtnG.visible = ua > 0.001;
      if (queenG.visible) {
        bodyMat.uniforms.uOp.value = ua;
        skinMat.uniforms.uOp.value = ua;
        veilMat.uniforms.uOp.value = ua;
        figLines.material.opacity = 0.6 * ua;
        haloQ.material.opacity = (0.32 + 0.06 * Math.sin(wall * 1.3)) * ua;
        ringQ.material.opacity = 0.7 * ua;
        mtnMat.uniforms.uOp.value = 0.9 * ua;
        mtnLines.material.opacity = 0.5 * ua;
      }
      const items = [{ L: labQ, a: anchQ, op: ua }];

      // Heródoto
      const hh = clamp01(num(s.herodotus));
      items.push({ L: labH, a: anchH, op: hh });
      herG.visible = hh > 0.001;
      if (herG.visible) {
        herG.scale.y = 0.12 + 0.88 * smooth(hh);                 // se despliega
        scrollMat.opacity = hh;
        rollMat.opacity = 0.9 * hh;
        holeMat.opacity = hh * (0.8 + 0.2 * Math.sin(wall * 3.1));
      }

      // mapa
      const mp = clamp01(num(s.map));
      mapG.visible = mp > 0.001;
      if (mapG.visible) {
        mapMat.opacity = 0.92 * mp;
        routeMat.uniforms.uOp.value = mp;
        routeMat.uniforms.uT.value = wall * 0.6;
        pillarB.opacity = 0.45 * mp;
        pillarN.opacity = 0.45 * mp * (0.8 + 0.2 * Math.sin(wall * 2.4));   // parpadeo: "¿aquí?"
        haloB.material.opacity = 0.8 * mp;
        haloN.material.opacity = (0.6 + 0.2 * Math.sin(wall * 2.4)) * mp;
        ringsLines.material.opacity = 0.8 * mp;
        pyrMat.uniforms.uOp.value = mp;
        pyrLines.material.opacity = 0.8 * mp;
      }
      mapItems.forEach(function (it) { items.push({ L: it.L, a: it.a, op: mp }); });

      // cotas
      const ms = clamp01(num(s.measure));
      measG.visible = ms > 0.001;
      if (measG.visible) {
        drawN(M.dimLines, ramp(ms, 0, 0.6));                      // las cotas se trazan
        M.dimLines.material.opacity = 0.9 * ms;
        M.ring.material.opacity = 0.9 * ms;
        M.disc.material.opacity = 0.55 * ms;
        M.pipe.material.opacity = 0.7 * ms;
      }
      const mo = ramp(ms, 0.2, 0.7);
      measItems.forEach(function (it) { items.push({ L: it.L, a: it.a, op: mo }); });

      // colocación sin solapes y fuera del HUD, y después escalado/opacidad de cada etiqueta
      layoutLabels(items, camera);
      items.forEach(function (it) { setLab(it.L, camera, it.op); });
    }

    return { update: update };
  };
})();
