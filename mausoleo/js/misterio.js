// Misterio (capa conspiranoica del Mausoleo): nivelación de la terraza (estacas, cuerdas, rejilla, canalillos
// de agua y la planta de 38 x 32 m), la reina Artemisia II como figura fantasma con la copa de cenizas, los
// nombres de los cuatro escultores y la regla de 46 m con las proporciones.
// Todo por código: geometría fusionada (lofting y rejillas paramétricas), shader de borde (fresnel), puntos
// aditivos para las cenizas, InstancedMesh para las estacas y CanvasTexture (sRGB) para las etiquetas.
// Todo es función del estado s (no acumulativo): si el tiempo retrocede, la escena se recompone bien.
(function () {
  'use strict';
  const G = window.GIZA;
  const THREE = window.THREE;

  const TAU = Math.PI * 2;
  const GOLD = 0xffd27a, GOLD_HI = 0xffe9a8, CYAN = 0x7fe3f0, PURPLE = 0x7a3e8e, LILAC = 0xc9a0e8;
  const GROUND = 0.4;   // separación del suelo (evita z-fighting con near = 0.5)

  const SITE = G.SITE, MAUS = G.MAUS;
  const HX = MAUS.podium.halfX, HZ = MAUS.podium.halfZ;            // 19 x 16 (38 x 32 m)
  const CHX = MAUS.colonnade.halfX, CHZ = MAUS.colonnade.halfZ;    // 17.5 x 14.5 (eje de columnas)
  const LHX = MAUS.cella.halfX, LHZ = MAUS.cella.halfZ;            // 13.5 x 10.5 (cella)
  const PHX = SITE.peribolos.halfX, PHZ = SITE.peribolos.halfZ;    // recinto 104 x 242 m
  const H = MAUS.height;                                           // 46 m
  const ASH = SITE.ashes;                                          // origen de la escena de Artemisia
  const RX = HX + 4, RZ = -10;                                     // regla junto a la esquina NE
  const CUP = [0.55, 10.9, -1.45];                                 // borde de la copa (local a la reina)
  const SIDES = MAUS.sides || {};

  function clamp01(x) { return x < 0 ? 0 : (x > 1 ? 1 : x); }
  function ramp(x, a, b) { return clamp01((x - a) / (b - a)); }
  function smooth(x) { x = clamp01(x); return x * x * (3 - 2 * x); }
  function num(v) { return (typeof v === 'number' && isFinite(v)) ? v : 0; }
  function norm(v) { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function seeded(seed) {
    let s = seed >>> 0;
    return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }
  // color [r,g,b] (valores tipo sRGB, como en el resto de módulos) desde hex con factor de brillo k
  function rgb(hex, k) { k = k === undefined ? 1 : k; return [((hex >> 16) & 255) / 255 * k, ((hex >> 8) & 255) / 255 * k, (hex & 255) / 255 * k]; }

  // ---------- generación de mallas (listas planas -> BufferGeometry) ----------
  function newB() { return { P: [], I: [], LI: [], C: [] }; }
  function pv(B, p) { B.P.push(p[0], p[1], p[2]); return B.P.length / 3 - 1; }
  // Lofting: secciones [x, y, z, rx, rz] a lo largo de la cadena; cada sección es una elipse.
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
    if (rings) for (let i = 0; i < n; i++) for (let j = 0; j < sides; j++) B.LI.push(base + i * sides + j, base + i * sides + (j + 1) % sides);
    for (let m = 0; m < meridians; m++) {
      const j = Math.floor(m * sides / meridians);
      for (let i = 0; i < n - 1; i++) B.LI.push(base + i * sides + j, base + (i + 1) * sides + j);
    }
  }
  // Rejilla paramétrica fn(u, w) -> [x,y,z]; open = columnas sin cerrar (velo)
  function grid(B, rows, cols, fn, open, meridEvery, ringEvery) {
    const nc = open ? cols + 1 : cols, base = B.P.length / 3;
    for (let i = 0; i <= rows; i++) for (let j = 0; j < nc; j++) {
      const p = fn(i / rows, j / cols); B.P.push(p[0], p[1], p[2]);
    }
    for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
      const a = base + i * nc + j, b = base + i * nc + (open ? j + 1 : (j + 1) % cols), c = a + nc, d = b + nc;
      B.I.push(a, c, b, b, c, d);
    }
    if (meridEvery) for (let j = 0; j < cols; j += meridEvery) for (let i = 0; i < rows; i++) B.LI.push(base + i * nc + j, base + (i + 1) * nc + j);
    if (ringEvery) for (let i = 0; i <= rows; i += ringEvery) for (let j = 0; j < cols; j++) B.LI.push(base + i * nc + j, base + i * nc + (open ? j + 1 : (j + 1) % cols));
  }
  // Miembro: tubo entre dos articulaciones con un abultamiento suave en el centro
  function limb(B, a, b, ra, rb, sides, meridians) {
    const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], rm = (ra + rb) * 0.55;
    loft(B, [[a[0], a[1], a[2], ra, ra], [m[0], m[1], m[2], rm, rm], [b[0], b[1], b[2], rb, rb]], sides, true, meridians);
  }
  // Articulación esférica (anillos verticales)
  function ball(B, c, r, sides) {
    const N = 6, secs = [];
    for (let k = 0; k < N; k++) {
      const ph = Math.PI * (k + 0.5) / N, rr = r * Math.sin(ph);
      secs.push([c[0], c[1] - r * Math.cos(ph), c[2], rr, rr]);
    }
    loft(B, secs, sides, false, 4);
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
  // pares [a, b] de puntos -> segmentos; c opcional = color por segmento (líneas con vertexColors)
  function segGeo(S) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(S.P, 3));
    if (S.C.length) g.setAttribute('color', new THREE.Float32BufferAttribute(S.C, 3));
    return g;
  }
  function seg(S, a, b, c) {
    S.P.push(a[0], a[1], a[2], b[0], b[1], b[2]);
    const cc = c || [1, 1, 1];
    S.C.push(cc[0], cc[1], cc[2], cc[0], cc[1], cc[2]);
  }
  function rectSeg(S, hx, hz, y, c) {
    seg(S, [-hx, y, -hz], [hx, y, -hz], c); seg(S, [hx, y, -hz], [hx, y, hz], c);
    seg(S, [hx, y, hz], [-hx, y, hz], c); seg(S, [-hx, y, hz], [-hx, y, -hz], c);
  }
  function circleSeg(S, cx, cz, y, r, n, c) {
    for (let i = 0; i < n; i++) {
      const a = i / n * TAU, b = (i + 1) / n * TAU;
      seg(S, [cx + r * Math.cos(a), y, cz + r * Math.sin(a)], [cx + r * Math.cos(b), y, cz + r * Math.sin(b)], c);
    }
  }
  function polyGeo(pts) {
    const a = new Float32Array(pts.length * 3);
    for (let i = 0; i < pts.length; i++) { a[i * 3] = pts[i][0]; a[i * 3 + 1] = pts[i][1]; a[i * 3 + 2] = pts[i][2]; }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(a, 3));
    return g;
  }
  function circleGround(cx, cy, cz, r, n) {
    const out = [];
    for (let i = 0; i <= n; i++) { const t = i / n * TAU; out.push([cx + r * Math.cos(t), cy, cz + r * Math.sin(t)]); }
    return out;
  }
  // progreso de dibujado (en segmentos) para LineSegments
  function drawSegs(obj, f) {
    const n = obj.geometry.attributes.position.count;
    obj.geometry.setDrawRange(0, 2 * Math.floor(clamp01(f) * n / 2));
  }

  // ---------- materiales ----------
  // Fantasma dorado-púrpura: relleno translúcido que se ilumina hacia el borde (fresnel)
  const ASH_VS = 'varying vec3 vN; varying vec3 vV;\n' +
    'void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0);\n' +
    '  vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);\n' +
    '  gl_Position = projectionMatrix * mv; }';
  const ASH_FS = 'uniform vec3 uA; uniform vec3 uB; uniform float uOp; uniform float uBase; uniform float uEdge; varying vec3 vN; varying vec3 vV;\n' +
    'void main(){\n' +
    '  float f = 1.0 - abs(dot(normalize(vN), normalize(vV)));\n' +
    '  float a = uOp * (uBase + uEdge * pow(f, 2.0));\n' +
    '  vec3 c = mix(uA, uB, pow(f, 1.4));\n' +
    '  gl_FragColor = vec4(c, a); }';
  function ashMat(base, edge) {
    return new THREE.ShaderMaterial({
      uniforms: {
        uA: { value: new THREE.Color(PURPLE) }, uB: { value: new THREE.Color(GOLD) },
        uOp: { value: 0 }, uBase: { value: base }, uEdge: { value: edge }
      },
      vertexShader: ASH_VS, fragmentShader: ASH_FS,
      transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending
    });
  }
  function lineMat(hex, op) {
    return new THREE.LineBasicMaterial({
      color: hex, transparent: true, opacity: op || 0, fog: false,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
  }
  function vlineMat(op) {
    return new THREE.LineBasicMaterial({
      vertexColors: true, transparent: true, opacity: op || 0, fog: false,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
  }
  // Cenizas: puntos aditivos en espiral que suben desde la copa (movimiento en el vértice)
  const ASHP_VS = 'attribute float aSeed; attribute float aSize;\n' +
    'uniform float uTime; uniform float uPx; uniform float uRate; uniform float uHeight; uniform float uRad;\n' +
    'uniform vec3 uOrigin; uniform float uI; uniform float uAlpha;\n' +
    'varying float vA; varying float vP;\n' +
    'void main(){\n' +
    '  float p = fract(uTime * uRate + aSeed);\n' +
    '  float ang = aSeed * 43.98 + p * 18.85;\n' +
    '  float rad = 0.3 + uRad * p;\n' +
    '  vec3 q = uOrigin + vec3(cos(ang) * rad, p * uHeight, sin(ang) * rad);\n' +
    '  vec4 mv = modelViewMatrix * vec4(q, 1.0);\n' +
    '  gl_Position = projectionMatrix * mv;\n' +
    '  gl_PointSize = aSize * (0.5 + 0.7 * sin(3.14159 * p)) * uPx / max(0.1, -mv.z);\n' +
    '  vA = pow(sin(3.14159 * p), 0.8) * uI * uAlpha;\n' +
    '  vP = p;\n' +
    '}';
  const ASHP_FS = 'uniform sampler2D uMap; uniform vec3 uColA; uniform vec3 uColB; varying float vA; varying float vP;\n' +
    'void main(){ float a = texture2D(uMap, gl_PointCoord).a * vA; if (a < 0.002) discard;\n' +
    '  gl_FragColor = vec4(mix(uColA, uColB, vP), a); }';

  // Textura radial (alfa) para puntos
  let softCache = null;
  function softTex() {
    if (softCache) return softCache;
    const cv = document.createElement('canvas');
    cv.width = 64; cv.height = 64;
    const g = cv.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.35, 'rgba(255,255,255,0.45)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(cv);
    t.encoding = THREE.sRGBEncoding;
    softCache = t;
    return t;
  }
  // Halo radial (CanvasTexture dibujada por código)
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

  // Etiqueta 3D: Sprite + CanvasTexture. lh = altura de la letra (em) en metros; el ancho sale del texto.
  function label(text, o) {
    const CW = 2048;
    const cv = document.createElement('canvas');
    const g0 = cv.getContext('2d');
    const fam = o.mono ? "'Courier New', monospace" : 'Georgia, serif';
    g0.font = 'bold 100px ' + fam;
    const k = g0.measureText(text).width / 100;
    const px = Math.max(40, Math.min(170, Math.floor(CW * 0.92 / k)));
    const CH = Math.ceil(px * 1.7);
    cv.width = CW; cv.height = CH;
    const g = cv.getContext('2d');
    g.font = 'bold ' + px + 'px ' + fam;
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
      map: tex, transparent: true, depthWrite: false, fog: false,
      depthTest: o.depthTest !== false, blending: THREE.AdditiveBlending, opacity: 0
    });
    const sp = new THREE.Sprite(mat);
    const w = o.lh * CW / px, h = w * CH / CW;
    sp.scale.set(w, h, 1);
    sp.position.set(o.pos[0], o.pos[1], o.pos[2]);
    sp.visible = false;
    if (o.depthTest === false) sp.renderOrder = 2;
    // ancho real del texto en metros (la caja del sprite es mayor)
    const tw = g.measureText(text).width * o.lh / px;
    const L = { sprite: sp, mat: mat, w: w, h: h, lh: o.lh, tw: tw, plate: null };
    if (o.plate) {
      // placa oscura detrás del texto para leerlo con el cielo claro (mezcla normal)
      const pm = new THREE.SpriteMaterial({ map: plateTex(), transparent: true, depthWrite: false, depthTest: false, fog: false, opacity: 0 });
      const pl = new THREE.Sprite(pm);
      pl.renderOrder = 1; pl.visible = false;
      L.plate = pl;
    }
    return L;
  }
  // añade la etiqueta (y su placa) a un grupo
  function addLab(parent, L) { parent.add(L.sprite); if (L.plate) parent.add(L.plate); }
  // coloca la etiqueta centrada en (x,y,z) con factor de escala f (texto y placa juntos)
  function placeLab(L, x, y, z, f) {
    f = f || 1;
    L.sprite.position.set(x, y, z);
    L.sprite.scale.set(L.w * f, L.h * f, 1);
    if (L.plate) {
      L.plate.position.set(x, y, z);
      L.plate.scale.set((L.tw + L.lh * 0.5) * f, L.lh * 1.45 * f, 1);
    }
  }
  function setOp(L, op) {
    L.mat.opacity = op; L.sprite.visible = op > 0.001;
    if (L.plate) { L.plate.material.opacity = op * 0.6; L.plate.visible = op > 0.001; }
  }
  let plateCache = null;
  function plateTex() {
    if (plateCache) return plateCache;
    const cv = document.createElement('canvas');
    cv.width = 128; cv.height = 64;
    const g = cv.getContext('2d');
    const r = 26;
    g.beginPath();
    g.moveTo(r, 0); g.lineTo(128 - r, 0); g.arcTo(128, 0, 128, r, r); g.lineTo(128, 64 - r);
    g.arcTo(128, 64, 128 - r, 64, r); g.lineTo(r, 64); g.arcTo(0, 64, 0, 64 - r, r); g.lineTo(0, r);
    g.arcTo(0, 0, r, 0, r); g.closePath();
    g.fillStyle = 'rgba(8,6,16,1)';
    g.fill();
    const t = new THREE.CanvasTexture(cv);
    t.encoding = THREE.sRGBEncoding;
    plateCache = t;
    return t;
  }

  // ---------- figura de Artemisia II (local: de pie, mira a -Z; su derecha es +X) ----------
  // perfil de la túnica [y, rx, rz] (interpolación Catmull-Rom)
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
    const jaw = 1 - 0.12 * smooth(-c);          // mandíbula algo más estrecha
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
  function buildArtemisia() {
    const B = newB();
    grid(B, 40, 56, robePoint, false, 8, 8);                    // túnica con pliegues
    grid(B, 20, 32, headPoint, false, 8, 4);                    // cabeza (elipsoide suave)
    grid(B, 14, 16, veilPoint, true, 4, 0);                     // velo
    loft(B, [[0, 9.9, 0, 0.5, 0.46], [0, 10.6, 0, 0.43, 0.4], [0, 11.1, 0, 0.4, 0.38]], 24, false, 4); // cuello
    // brazo derecho (+X) levantando la copa hasta la boca
    const S = [1.55, 9.1, -0.2], E = [2.6, 7.0, -0.9], Wr = [1.15, 9.5, -1.35], Hd = [0.9, 9.9, -1.5];
    ball(B, S, 0.62, 16);
    limb(B, S, E, 0.5, 0.42, 14, 4);
    limb(B, E, Wr, 0.42, 0.3, 12, 3);
    ball(B, Hd, 0.42, 12);
    // brazo izquierdo caído
    const S2 = [-1.55, 9.1, -0.2], E2 = [-2.2, 6.6, -0.6], W2 = [-2.3, 4.7, -0.9], Hd2 = [-2.35, 4.45, -1.0];
    ball(B, S2, 0.6, 16);
    limb(B, S2, E2, 0.46, 0.4, 14, 4);
    limb(B, E2, W2, 0.4, 0.3, 12, 3);
    ball(B, Hd2, 0.4, 12);
    // copa (pie, fuste, cuenco abierto)
    const cx = CUP[0], cz = CUP[2];
    loft(B, [
      [cx, 9.85, cz, 0.16, 0.16], [cx, 9.98, cz, 0.12, 0.12], [cx, 10.1, cz, 0.42, 0.42],
      [cx, 10.3, cz, 0.55, 0.55], [cx, 10.6, cz, 0.6, 0.6], [cx, CUP[1], cz, 0.62, 0.62]
    ], 28, true, 6);
    // diadema y gema en la frente
    loft(B, [[0, 11.55, 0, 0.77, 0.8], [0, 11.62, 0, 0.8, 0.83], [0, 11.7, 0, 0.77, 0.8]], 40, true, 0);
    ball(B, [0, 11.62, -0.84], 0.12, 8);
    return B;
  }

  G.createMystery = function (ctx) {
    const scene = ctx.scene, camera = ctx.camera, renderer = ctx.renderer;
    const root = new THREE.Group();
    scene.add(root);
    const tmpV = new THREE.Vector3();
    // distancia cámara -> punto (para escalar etiquetas y que sean legibles desde los planos lejanos)
    function distTo(x, y, z) { return camera.position.distanceTo(tmpV.set(x, y, z)); }
    function fitScale(lab, x, y, z, k, max, base) {
      const f = Math.max(1, Math.min(max, distTo(x, y, z) / k));
      const bw = base === undefined ? 1 : base;
      lab.sprite.scale.set(lab.w * f * bw, lab.h * f * bw, 1);
      return f;
    }

    // ================= 1. survey: nivelación de la terraza =================
    const surveyG = new THREE.Group();
    root.add(surveyG);
    const SV = { P: [], C: [] };
    const GRIDC = rgb(CYAN, 0.42), BOUNDC = rgb(CYAN, 0.95), PLANC = rgb(GOLD_HI, 1.0), DIMC = rgb(GOLD, 1.0), CANC = rgb(CYAN, 0.9);
    // rejilla luminosa sobre el recinto (8 m)
    for (let x = -48; x <= 48; x += 8) seg(SV, [x, GROUND, -PHZ], [x, GROUND, PHZ], GRIDC);
    for (let z = -120; z <= 120; z += 8) seg(SV, [-PHX, GROUND, z], [PHX, GROUND, z], GRIDC);
    rectSeg(SV, PHX, PHZ, GROUND, BOUNDC);
    // planta del futuro mausoleo: 38 x 32 m, escalones de la base, cella, eje de columnas y 36 columnas
    rectSeg(SV, HX, HZ, GROUND + 0.1, PLANC);
    for (let k = 1; k <= 3; k++) rectSeg(SV, HX + 0.6 * k, HZ + 0.6 * k, GROUND + 0.1, rgb(GOLD, 0.7));
    rectSeg(SV, CHX, CHZ, GROUND + 0.1, rgb(LILAC, 0.8));
    rectSeg(SV, LHX, LHZ, GROUND + 0.1, rgb(LILAC, 0.6));
    seg(SV, [-HX, GROUND + 0.1, -HZ], [HX, GROUND + 0.1, HZ], rgb(GOLD, 0.35));
    seg(SV, [HX, GROUND + 0.1, -HZ], [-HX, GROUND + 0.1, HZ], rgb(GOLD, 0.35));
    for (let i = 0; i < 11; i++) {          // 11 por cada lado largo (incluye esquinas)
      const x = -CHX + i * (2 * CHX / 10);
      circleSeg(SV, x, -CHZ, GROUND + 0.1, 0.6, 10, PLANC);
      circleSeg(SV, x, CHZ, GROUND + 0.1, 0.6, 10, PLANC);
    }
    for (let i = 1; i < 9; i++) {           // 9 por cada lado corto (sin esquinas)
      const z = -CHZ + i * (2 * CHZ / 8);
      circleSeg(SV, -CHX, z, GROUND + 0.1, 0.6, 10, PLANC);
      circleSeg(SV, CHX, z, GROUND + 0.1, 0.6, 10, PLANC);
    }
    // cotas de la planta: 38 m (norte) y 32 m (oeste), con líneas de referencia y marcas
    const DZ = -HZ - 6, DX = -HX - 6;
    seg(SV, [-HX, GROUND, DZ], [HX, GROUND, DZ], DIMC);
    seg(SV, [-HX, GROUND, -HZ - 0.5], [-HX, GROUND, DZ - 0.8], DIMC);
    seg(SV, [HX, GROUND, -HZ - 0.5], [HX, GROUND, DZ - 0.8], DIMC);
    seg(SV, [-HX, GROUND, DZ - 0.8], [-HX, GROUND, DZ + 0.8], DIMC);
    seg(SV, [HX, GROUND, DZ - 0.8], [HX, GROUND, DZ + 0.8], DIMC);
    seg(SV, [DX, GROUND, -HZ], [DX, GROUND, HZ], DIMC);
    seg(SV, [-HX - 0.5, GROUND, -HZ], [DX - 0.8, GROUND, -HZ], DIMC);
    seg(SV, [-HX - 0.5, GROUND, HZ], [DX - 0.8, GROUND, HZ], DIMC);
    seg(SV, [DX - 0.8, GROUND, -HZ], [DX + 0.8, GROUND, -HZ], DIMC);
    seg(SV, [DX - 0.8, GROUND, HZ], [DX + 0.8, GROUND, HZ], DIMC);
    // canalillos de nivel de agua (dos, a ambos lados del recinto) con miras graduadas
    const CANALS = [-96, 96];
    CANALS.forEach(function (z0) {
      rectSeg(SV, 44, 0.8, 0.2, CANC);
      [-44, 44].forEach(function (x) {
        seg(SV, [x, 0, z0], [x, 3.0, z0], rgb(GOLD_HI, 0.9));
        for (let m = 0; m <= 6; m++) {
          const yk = m * 0.5, l = m % 2 === 0 ? 0.9 : 0.5;
          seg(SV, [x - l, yk, z0], [x + l, yk, z0], rgb(GOLD_HI, 0.9));
        }
      });
    });
    const surveyLines = new THREE.LineSegments(segGeo(SV), vlineMat(0));
    surveyLines.frustumCulled = false;
    surveyG.add(surveyLines);
    // relleno suave de la planta (la huella de 38 x 32 m se lee aunque la cámara esté lejos)
    const planFillGeo = new THREE.BufferGeometry();
    planFillGeo.setAttribute('position', new THREE.Float32BufferAttribute([-HX, GROUND, -HZ, HX, GROUND, -HZ, HX, GROUND, HZ, -HX, GROUND, HZ], 3));
    planFillGeo.setIndex([0, 2, 1, 0, 3, 2]);
    const planFillMat = new THREE.MeshBasicMaterial({
      color: GOLD, transparent: true, opacity: 0, side: THREE.DoubleSide, fog: false,
      depthWrite: false, blending: THREE.AdditiveBlending
    });
    const planFill = new THREE.Mesh(planFillGeo, planFillMat);
    planFill.frustumCulled = false;
    surveyG.add(planFill);

    // agua de los canalillos (un solo mallado con dos franjas)
    const WB = newB();
    CANALS.forEach(function (z0) {
      const b0 = WB.P.length / 3;
      WB.P.push(-44, 0.12, z0 - 0.75, 44, 0.12, z0 - 0.75, 44, 0.12, z0 + 0.75, -44, 0.12, z0 + 0.75);
      WB.I.push(b0, b0 + 2, b0 + 1, b0, b0 + 3, b0 + 2);
    });
    const waterGeo = new THREE.BufferGeometry();
    waterGeo.setAttribute('position', new THREE.Float32BufferAttribute(WB.P, 3));
    waterGeo.setIndex(WB.I);
    const waterMat = new THREE.MeshBasicMaterial({
      color: CYAN, transparent: true, opacity: 0, side: THREE.DoubleSide, fog: false,
      depthWrite: false, blending: THREE.AdditiveBlending
    });
    const water = new THREE.Mesh(waterGeo, waterMat);
    water.frustumCulled = false;
    surveyG.add(water);

    // estacas (InstancedMesh) y sus puntas luminosas
    const stakeGeo = new THREE.CylinderGeometry(0.11, 0.11, 1.3, 6);
    stakeGeo.translate(0, 0.65, 0);
    const stakeMat = new THREE.MeshBasicMaterial({ color: 0xb89a6a, transparent: true, opacity: 0, fog: false });
    const STAKES = [];
    [[-HX, -HZ, 1.3], [HX, -HZ, 1.3], [-HX, HZ, 1.3], [HX, HZ, 1.3], [0, -HZ, 1.3], [0, HZ, 1.3], [-HX, 0, 1.3], [HX, 0, 1.3],
      [-CHX, -CHZ, 1.3], [CHX, -CHZ, 1.3], [-CHX, CHZ, 1.3], [CHX, CHZ, 1.3],
      [-PHX, -PHZ, 2.6], [PHX, -PHZ, 2.6], [-PHX, PHZ, 2.6], [PHX, PHZ, 2.6]].forEach(function (p) { STAKES.push(p); });
    const stakes = new THREE.InstancedMesh(stakeGeo, stakeMat, STAKES.length);
    const mtx = new THREE.Matrix4(), tops = [];
    STAKES.forEach(function (p, i) {
      const sc = p[2] / 1.3;
      mtx.compose(new THREE.Vector3(p[0], 0, p[1]), new THREE.Quaternion(), new THREE.Vector3(1, sc, 1));
      stakes.setMatrixAt(i, mtx);
      tops.push(p[0], p[2] + 0.05, p[1]);
    });
    stakes.instanceMatrix.needsUpdate = true;
    stakes.frustumCulled = false;
    surveyG.add(stakes);
    const topGeo = new THREE.BufferGeometry();
    topGeo.setAttribute('position', new THREE.Float32BufferAttribute(tops, 3));
    const topMat = new THREE.PointsMaterial({
      map: softTex(), color: 0xbff7ff, size: 2.4, sizeAttenuation: true,
      transparent: true, opacity: 0, depthWrite: false, fog: false, blending: THREE.AdditiveBlending
    });
    const topPts = new THREE.Points(topGeo, topMat);
    topPts.frustumCulled = false;
    surveyG.add(topPts);

    // cuerdas tensas entre las puntas de las estacas (rectángulo y diagonales: se comprueba que sean iguales)
    const RP = { P: [], C: [] };
    const ROPEC = rgb(GOLD_HI, 1.0);
    const ropeY = 1.3;
    seg(RP, [-HX, ropeY, -HZ], [HX, ropeY, -HZ], ROPEC); seg(RP, [HX, ropeY, -HZ], [HX, ropeY, HZ], ROPEC);
    seg(RP, [HX, ropeY, HZ], [-HX, ropeY, HZ], ROPEC); seg(RP, [-HX, ropeY, HZ], [-HX, ropeY, -HZ], ROPEC);
    seg(RP, [-HX, ropeY, -HZ], [HX, ropeY, HZ], rgb(CYAN, 1.0));
    seg(RP, [HX, ropeY, -HZ], [-HX, ropeY, HZ], rgb(CYAN, 1.0));
    const ropes = new THREE.LineSegments(segGeo(RP), vlineMat(0));
    ropes.frustumCulled = false;
    surveyG.add(ropes);

    // etiquetas de la terraza
    // cotas de la planta (más cerca de la cámara, quedan por debajo del rótulo del capítulo)
    const lab38 = label('38 m', { lh: 2.2, color: '#ffe9a8', pos: [0, 2.2, -36] });
    const lab32 = label('32 m', { lh: 2.2, color: '#ffe9a8', pos: [-30, 2.2, -22] });
    const labNivel = [
      label('NIVEL ±0', { lh: 2.4, color: '#9fe9ff', pos: [12, 3.4, CANALS[0]] }),
      label('NIVEL ±0', { lh: 2.4, color: '#9fe9ff', pos: [12, 3.4, CANALS[1]] })
    ];
    const surveyLabs = [lab38, lab32, labNivel[0], labNivel[1]];
    surveyLabs.forEach(function (L) { surveyG.add(L.sprite); });

    // ================= 2. ashes: Artemisia II, la reina que bebía cenizas =================
    const ashG = new THREE.Group();
    ashG.position.set(ASH.x, 0, ASH.z);
    root.add(ashG);
    const FB = buildArtemisia();
    const bodyMat = ashMat(0.14, 0.7);
    const body = new THREE.Mesh(fillGeo(FB), bodyMat);
    body.frustumCulled = false;
    ashG.add(body);
    const figLines = new THREE.LineSegments(lineGeo(FB), lineMat(GOLD_HI, 0));
    ashG.add(figLines);
    // círculo de luz en el suelo bajo la reina
    const ringLine = new THREE.Line(polyGeo(circleGround(0, GROUND + 0.05, 0, 4.4, 72)), lineMat(LILAC, 0));
    ashG.add(ringLine);
    const cupGlow = glowSprite('255,220,160', 7, CUP);
    ashG.add(cupGlow);
    // cenizas: 260 puntos aditivos que suben en espiral desde el borde de la copa
    const aRnd = seeded(211);
    const NA = 260;
    const aBase = new Float32Array(NA * 3), aSeed = new Float32Array(NA), aSize = new Float32Array(NA);
    for (let i = 0; i < NA; i++) {
      aSeed[i] = aRnd();
      aSize[i] = 0.22 + 0.25 * aRnd();
    }
    const ashGeo = new THREE.BufferGeometry();
    ashGeo.setAttribute('position', new THREE.BufferAttribute(aBase, 3));
    ashGeo.setAttribute('aSeed', new THREE.BufferAttribute(aSeed, 1));
    ashGeo.setAttribute('aSize', new THREE.BufferAttribute(aSize, 1));
    const ashMatP = new THREE.ShaderMaterial({
      uniforms: {
        uMap: { value: softTex() }, uColA: { value: new THREE.Color(0xffe3a8) }, uColB: { value: new THREE.Color(0xd9a6ff) },
        uTime: { value: 0 }, uPx: { value: 500 }, uRate: { value: 0.09 }, uHeight: { value: 7.5 }, uRad: { value: 2.6 },
        uOrigin: { value: new THREE.Vector3(CUP[0], CUP[1], CUP[2]) }, uI: { value: 0 }, uAlpha: { value: 0.7 }
      },
      vertexShader: ASHP_VS, fragmentShader: ASHP_FS,
      transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending
    });
    const ashPts = new THREE.Points(ashGeo, ashMatP);
    ashPts.renderOrder = 3;
    ashPts.frustumCulled = false;
    ashG.add(ashPts);
    // etiquetas: nombre y leyenda, a los pies de la reina (fuera de la franja del rótulo del capítulo)
    // (en el lado de la figura, a la altura del torso: fuera del rótulo del capítulo y de los subtítulos)
    const labAsh = label('ARTEMISIA II', { lh: 1.8, color: '#ffd27a', pos: [0, 6.1, 0], depthTest: false });
    const labAshTag = label('bebía las cenizas de Mausolo (dicen)', { lh: 0.95, color: '#d9b3ff', pos: [0, 4.3, 0], depthTest: false });
    addLab(ashG, labAsh); addLab(ashG, labAshTag);

    // ================= 3. sculptors: un nombre por lado =================
    const scG = new THREE.Group();
    root.add(scG);
    const SIDE_DEF = [
      { key: 'N', name: SIDES.N || 'Briaxis', face: [0, 22, -CHZ - 0.6], at: [0, 24.6, -HZ - 10], cap: 'LADO NORTE' },
      // (los nombres van por encima del centro del lado: quedan lejos de los subtítulos inferiores)
      { key: 'E', name: SIDES.E || 'Escopas', face: [CHX + 0.6, 22, 0], at: [HX + 10, 24.6, 0], cap: 'LADO ESTE' },
      { key: 'S', name: SIDES.S || 'Timoteo', face: [0, 22, CHZ + 0.6], at: [0, 24.6, HZ + 10], cap: 'LADO SUR' },
      { key: 'O', name: SIDES.O || 'Leócares', face: [-CHX - 0.6, 22, 0], at: [-HX - 10, 24.6, 0], cap: 'LADO OESTE' }
    ];
    // cada escultor aparece en su plano (124 N, 129 E, 134 S, 139 O): ventana temporal propia
    // para que los nombres no se solapen desde cada cámara
    const scLabs = [];
    SIDE_DEF.forEach(function (d, i) {
      const nm = label(d.name.toUpperCase(), { lh: 2.2, color: '#ffd27a', pos: [0, 0, 0], depthTest: false, plate: true });
      const cp = label(d.cap, { lh: 0.9, color: '#9fe9ff', pos: [0, 0, 0], depthTest: false, plate: true });
      placeLab(nm, d.at[0], d.at[1], d.at[2], 1);
      placeLab(cp, d.at[0], d.at[1] - 1.8, d.at[2], 1);
      addLab(scG, nm); addLab(scG, cp);
      // línea que señala el lado: desde la fachada hasta la etiqueta
      const sl = { P: [], C: [] };
      seg(sl, d.face, [d.at[0], d.at[1] + 0.2, d.at[2]], rgb(GOLD, 1.0));
      const line = new THREE.LineSegments(segGeo(sl), vlineMat(0));
      line.frustumCulled = false;
      scG.add(line);
      scLabs.push({ nm: nm, cp: cp, line: line, c: [124, 129, 134, 139][i] });
    });

    // ================= 4. measure: regla de 0 a 46 m y proporciones =================
    const meG = new THREE.Group();
    root.add(meG);
    const MS = { P: [], C: [] };
    const RULERC = rgb(GOLD_HI, 1.0), CYANC = rgb(CYAN, 1.0), PROPC = rgb(LILAC, 1.0), FACEC = rgb(GOLD, 0.9);
    // regla: eje y marcas (1 m, 5 m, 10 m) hacia el mausoleo
    seg(MS, [RX, 0, RZ], [RX, H, RZ], RULERC);
    for (let m = 0; m <= H; m++) {
      const len = m % 10 === 0 ? 2.6 : (m % 5 === 0 ? 1.6 : 0.7);
      seg(MS, [RX, m, RZ], [RX - len, m, RZ], m % 10 === 0 ? RULERC : CYANC);
    }
    // fachadas (norte y este): rectángulo 38 x 46, cuadrado 38 x 38, rectángulo áureo y diagonales
    const FN = -HZ - 0.6, FE = HX + 0.6;
    seg(MS, [-HX, 0, FN], [HX, 0, FN], FACEC); seg(MS, [HX, 0, FN], [HX, H, FN], FACEC);
    seg(MS, [HX, H, FN], [-HX, H, FN], FACEC); seg(MS, [-HX, H, FN], [-HX, 0, FN], FACEC);
    seg(MS, [-HX, 2 * HX, FN], [HX, 2 * HX, FN], CYANC);
    const GW = H / ((1 + Math.sqrt(5)) / 2);     // ancho del rectángulo áureo (28.4 m)
    seg(MS, [-GW / 2, 0, FN], [-GW / 2, H, FN], PROPC); seg(MS, [GW / 2, 0, FN], [GW / 2, H, FN], PROPC);
    seg(MS, [-HX, GW, FN], [HX, GW, FN], PROPC);
    seg(MS, [-HX, 0, FN], [HX, H, FN], PROPC); seg(MS, [HX, 0, FN], [-HX, H, FN], PROPC);
    seg(MS, [-HX, 0, FN], [HX, 2 * HX, FN], CYANC);
    // fachada este: contorno, cuadrado (32 m) y diagonales
    seg(MS, [FE, 0, -HZ], [FE, H, -HZ], FACEC); seg(MS, [FE, H, -HZ], [FE, H, HZ], FACEC);
    seg(MS, [FE, H, HZ], [FE, 0, HZ], FACEC); seg(MS, [FE, 0, HZ], [FE, 0, -HZ], FACEC);
    seg(MS, [FE, 2 * HZ, -HZ], [FE, 2 * HZ, HZ], CYANC);
    seg(MS, [FE, 0, -HZ], [FE, H, HZ], PROPC); seg(MS, [FE, 0, HZ], [FE, H, -HZ], PROPC);
    const measLines = new THREE.LineSegments(segGeo(MS), vlineMat(0));
    measLines.frustumCulled = false;
    meG.add(measLines);
    // cotas por nivel (a la derecha de la regla) y recuentos
    const MEAS = [
      { txt: '0 m', lh: 1.3, y: 0.6, c: '#9fe9ff' },
      // (las cotas se separan de la banda del rótulo del capítulo, que tapa ~24-32 m desde la cámara de 186)
      { txt: '19 m · PODIO', lh: 1.5, y: 18.0, c: '#ffd27a' },
      { txt: '12 m · COLUMNATA', lh: 1.5, y: 25, c: '#ffd27a' },
      { txt: '36 COLUMNAS', lh: 1.3, y: 20.6, c: '#9fe9ff' },
      { txt: '7 m · PIRÁMIDE', lh: 1.5, y: 36.0, c: '#ffd27a' },
      { txt: '24 ESCALONES', lh: 1.3, y: 38.6, c: '#9fe9ff' },
      { txt: '5 m · CUADRIGA', lh: 1.5, y: 43.5, c: '#ffd27a' },
      { txt: '46 m', lh: 1.6, y: 46, c: '#9fe9ff' }
    ].map(function (c, i) {
      const L = label(c.txt, { lh: c.lh, color: c.c, pos: [RX, c.y, RZ], mono: true, depthTest: false, plate: true });
      L.y = c.y; L.idx = i;
      addLab(meG, L);
      return L;
    });
    // título de la regla (bajo la base de la regla)
    const labRule = label('REGLA · 0 a 46 m', { lh: 1.6, color: '#9fe9ff', pos: [RX, -2.2, RZ], mono: true, depthTest: false, plate: true });
    addLab(meG, labRule);

    // ================= actualización (solo transformaciones, visibilidad, uniforms y opacidades) =================
    function update(s) {
      const wall = num(s.wall);
      const sv = clamp01(num(s.survey));
      const ash = clamp01(num(s.ashes));
      const t = num(s.t);
      const ms = clamp01(num(s.measure));

      // 1. terraza
      surveyG.visible = sv > 0.001;
      if (surveyG.visible) {
        surveyLines.material.opacity = 0.9 * sv;
        planFillMat.opacity = 0.16 * sv;
        waterMat.opacity = (0.28 + 0.08 * Math.sin(wall * 2.1)) * sv;
        stakeMat.opacity = 0.9 * ramp(sv, 0, 0.3);
        topMat.opacity = 0.9 * ramp(sv, 0.1, 0.5);
        ropes.visible = sv > 0.25;
        if (ropes.visible) {
          drawSegs(ropes, ramp(sv, 0.25, 0.7));
          ropes.material.opacity = 0.9 * ramp(sv, 0.25, 0.5);
        }
        for (let i = 0; i < surveyLabs.length; i++) {
          const L = surveyLabs[i];
          const op = ramp(sv, 0.35 + 0.05 * i, 0.75 + 0.05 * i);
          L.mat.opacity = op;
          L.sprite.visible = op > 0.001;
          if (L.sprite.visible) fitScale(L, L.sprite.position.x, L.sprite.position.y, L.sprite.position.z, 45, 12);
        }
      }

      // 2. cenizas: la reina fantasma con la copa
      ashG.visible = ash > 0.001;
      if (ashG.visible) {
        bodyMat.uniforms.uOp.value = 0.72 * ash;
        figLines.material.opacity = 0.35 * ash;
        ringLine.material.opacity = (0.45 + 0.2 * Math.sin(wall * 1.7)) * ash;
        cupGlow.visible = ash > 0.001;
        cupGlow.material.opacity = (0.5 + 0.15 * Math.sin(wall * 2.3)) * ash;
        ashMatP.uniforms.uTime.value = wall;
        ashMatP.uniforms.uI.value = ramp(ash, 0.4, 1) * 0.8;
        ashMatP.uniforms.uPx.value = renderer.domElement.height / (2 * Math.tan(camera.fov * Math.PI / 360));
        const la = ramp(ash, 0.3, 0.8);
        // a la izquierda de la pantalla (lado -X de la reina visto desde el norte): f crece con la distancia
        const fa = Math.max(0.7, Math.min(2.5, distTo(-8.5, 5.2, 0) / 30));
        placeLab(labAsh, -8.5, 6.1, 0, fa); labAsh.mat.opacity = la; labAsh.sprite.visible = la > 0.001;
        placeLab(labAshTag, -8.5, 4.3, 0, fa); labAshTag.mat.opacity = la * 0.95; labAshTag.sprite.visible = la > 0.001;
      }

      // 3. escultores: un nombre por lado (legible desde los planos de 124 a 139)
      // ventana de cada escultor: plena a ±1.2 s de su plano, con fundidos de 1 s
      scG.visible = t > 121.5 && t < 142.5;
      if (scG.visible) {
        for (let i = 0; i < scLabs.length; i++) {
          const L = scLabs[i];
          const win = ramp(t, L.c - 2.6, L.c - 1.2) * (1 - ramp(t, L.c + 1.2, L.c + 2.6));
          setOp(L.nm, win);
          setOp(L.cp, win * 0.9);
          L.line.material.opacity = 0.9 * win;
          L.line.visible = win > 0.001;
        }
      }

      // 4. regla y proporciones
      meG.visible = ms > 0.001;
      if (meG.visible) {
        measLines.material.opacity = 0.9 * ms;
        const fr = Math.max(1, Math.min(3, distTo(RX, 23, RZ) / 110));
        for (let i = 0; i < MEAS.length; i++) {
          const L = MEAS[i];
          placeLab(L, RX + (2.6 + L.tw / 2) * fr, L.y, RZ, fr);
          setOp(L, ramp(ms, 0.15 + 0.04 * i, 0.55 + 0.04 * i));
        }
        placeLab(labRule, RX + labRule.tw * fr / 2, -2.2 * fr, RZ, fr);
        setOp(labRule, ramp(ms, 0.5, 1));
      }
    }

    return { update: update };
  };
})();
