// Misterio de la estatua de Zeus (capa conspiranoica): la taza de Fidias ampliada (holograma), Zeus de pie
// fantasma que atraviesa el techo (Estrabón), el andamio de Calígula que se derrumba con la "carcajada",
// las cotas de la estatua (12 m, techo, basa, escala humana) y la línea hacia Constantinopla (475 d.C.).
// Todo por código: geometría fusionada (lofting, cajas, tubos), torno para la taza con UV propias,
// shader de borde (fresnel), puntos y sprites de halo, InstancedMesh para las piezas que caen, un PMREM
// de cielo degradado para el vidriado de la taza y etiquetas CanvasTexture (sRGB) con placa oscura.
// Todo es función del estado s (no acumulativo): si el tiempo retrocede o salta, la escena se ve bien.
(function () {
  'use strict';
  const G = window.GIZA;
  const THREE = window.THREE;

  const TAU = Math.PI * 2;
  const GOLD = 0xffd27a, GOLD_HI = 0xffe9a8, CYAN = 0x7fe3f0, SILVER = 0xe4f6ff;
  const GOLD_C = [1, 0.82, 0.48], GOLDHI_C = [1, 0.91, 0.66], CYAN_C = [0.5, 0.9, 0.94], SIL_C = [0.9, 0.97, 1];
  const RED_C = [1, 0.3, 0.25];

  const SITE = G.SITE, TEMPLE = G.TEMPLE, ZEUS = G.ZEUS;
  const ZX = ZEUS.origin[0], ZY = ZEUS.origin[1], ZZ = ZEUS.origin[2];   // pies de la estatua (mundo)
  const FLOOR = 1.5;                        // suelo de la cella (sobre el estilóbato)
  const CUP = SITE.cupSpot;                 // mesa de la taza real (y = 1.0)
  const CUP_BASE_Y = 3.4;                   // base del holograma (la taza ampliada queda a ~4 m)
  const CAL = { x0: -19.5, x1: -8.5, z0: -5, z1: 5 };   // andamio alrededor de la estatua
  const CAL_HEAD = [ZX - 0.9, ZY + 11.0, 0];  // cabeza de la estatua (mundo): joints.head = (-0.9, 11, 0)
  const RX = -6.0, RZ = -7.2;               // regla de medir (junto a la estatua, lado -Z)
  const GRAV = 6.0;                         // gravedad estilizada de las piezas que caen (m/s^2)

  function clamp01(x) { return x < 0 ? 0 : (x > 1 ? 1 : x); }
  function ramp(x, a, b) { return clamp01((x - a) / (b - a)); }
  function ss(x) { x = clamp01(x); return x * x * (3 - 2 * x); }
  function num(v) { return (typeof v === 'number' && isFinite(v)) ? v : 0; }
  function fract(x) { return x - Math.floor(x); }
  function seeded(seed) {
    let s = seed >>> 0;
    return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }
  // interpolación lineal en una tabla [y, valor] con y creciente
  function tab(K, y) {
    if (y <= K[0][0]) return K[0][1];
    for (let i = 1; i < K.length; i++) {
      if (y <= K[i][0]) { const a = K[i - 1], b = K[i]; return a[1] + (b[1] - a[1]) * (y - a[0]) / Math.max(1e-6, b[0] - a[0]); }
    }
    return K[K.length - 1][1];
  }

  // ---------- generación de mallas (listas planas -> BufferGeometry) ----------
  function newB() { return { P: [], I: [], LI: [] }; }
  function norm(v) { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  // lofting: secciones [x, y, z, rx, rz] a lo largo de la cadena; cada sección es una elipse
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
  // rejilla paramétrica fn(u, w) -> [x,y,z] cerrada en w
  function grid(B, rows, cols, fn) {
    const base = B.P.length / 3;
    for (let i = 0; i <= rows; i++) for (let j = 0; j < cols; j++) {
      const p = fn(i / rows, j / cols); B.P.push(p[0], p[1], p[2]);
    }
    for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
      const a = base + i * cols + j, b = base + i * cols + (j + 1) % cols, c = a + cols, d = b + cols;
      B.I.push(a, c, b, b, c, d);
    }
  }
  // miembro: tubo entre dos articulaciones con un abultamiento suave
  function limb(B, a, b, ra, rb, sides, meridians) {
    const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], rm = (ra + rb) * 0.55;
    loft(B, [[a[0], a[1], a[2], ra, ra], [m[0], m[1], m[2], rm, rm], [b[0], b[1], b[2], rb, rb]], sides, false, meridians);
  }
  // articulación esférica
  function ball(B, c, r, sides) {
    const N = 6, secs = [];
    for (let k = 0; k < N; k++) {
      const ph = Math.PI * (k + 0.5) / N, rr = r * Math.sin(ph);
      secs.push([c[0], c[1] - r * Math.cos(ph), c[2], rr, rr]);
    }
    loft(B, secs, sides, false, 0);
  }
  // caja maciza (8 vértices, 12 triángulos)
  function boxB(B, c, hx, hy, hz) {
    const base = B.P.length / 3;
    const v = [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]];
    for (let i = 0; i < 8; i++) B.P.push(c[0] + v[i][0] * hx, c[1] + v[i][1] * hy, c[2] + v[i][2] * hz);
    const f = [0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5, 2, 3, 7, 2, 7, 6, 3, 0, 4, 3, 4, 7];
    for (let i = 0; i < f.length; i++) B.I.push(base + f[i]);
  }
  // copia una malla local (T) en B, girada yaw alrededor de Y y trasladada a (ox, oy, oz)
  function placeB(B, T, yaw, ox, oy, oz) {
    const base = B.P.length / 3, c = Math.cos(yaw), s = Math.sin(yaw);
    for (let i = 0; i < T.P.length; i += 3) {
      const x = T.P[i], y = T.P[i + 1], z = T.P[i + 2];
      B.P.push(ox + x * c + z * s, oy + y, oz - x * s + z * c);
    }
    for (let i = 0; i < T.I.length; i++) B.I.push(T.I[i] + base);
  }
  function fillGeo(B) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(B.P, 3));
    g.setIndex(B.I);
    g.computeVertexNormals();
    return g;
  }
  function posGeo(arr) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
    return g;
  }
  // segmentos sueltos (pares de puntos) con color por vértice
  function seg(S, a, b, c) {
    S.P.push(a[0], a[1], a[2], b[0], b[1], b[2]);
    const cc = c || [1, 1, 1];
    S.C.push(cc[0], cc[1], cc[2], cc[0], cc[1], cc[2]);
  }
  function segGeo(S) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(S.P, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(S.C, 3));
    return g;
  }
  // aristas de una caja (centro c, semiejes h)
  function boxEdges(S, c, hx, hy, hz, col) {
    const v = [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1], [-1, 1, -1], [1, 1, -1], [1, 1, 1], [-1, 1, 1]];
    const p = v.map(function (q) { return [c[0] + q[0] * hx, c[1] + q[1] * hy, c[2] + q[2] * hz]; });
    const E = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
    E.forEach(function (e) { seg(S, p[e[0]], p[e[1]], col); });
  }
  // progreso de dibujado (en vértices) para Line y LineSegments
  function drawN(obj, f) {
    const n = obj.geometry.attributes.position.count;
    obj.geometry.setDrawRange(0, Math.round(clamp01(f) * n));
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
  // lh = altura de la letra (m) a escala 1; el ancho sale del texto. Admite varias líneas separadas por \n
  function label(text, o) {
    const fam = 'Georgia, "Times New Roman", serif';
    const lines = text.split('\n');
    const m = document.createElement('canvas').getContext('2d');
    m.font = 'bold 100px ' + fam;
    let k = 0;
    lines.forEach(function (l) { k = Math.max(k, m.measureText(l).width / 100); });   // ancho máximo en em
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
    const mpp = o.lh / px;                                   // metros por píxel del lienzo
    sp.visible = false;
    sp.renderOrder = 3;
    return {
      sprite: sp, mat: mat, w: W * mpp, h: H * mpp, lh: o.lh,
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

  // ---------- entorno para reflejos (PMREM de un cielo degradado: vidriado y metal pulido) ----------
  function makeEnv(renderer) {
    try {
      const cv = document.createElement('canvas'); cv.width = 512; cv.height = 256;
      const g = cv.getContext('2d');
      const gr = g.createLinearGradient(0, 0, 0, 256);
      gr.addColorStop(0, '#e8f4ff'); gr.addColorStop(0.45, '#8f9aa8');
      gr.addColorStop(0.55, '#4a3b2c'); gr.addColorStop(1, '#120d09');
      g.fillStyle = gr; g.fillRect(0, 0, 512, 256);
      g.fillStyle = 'rgba(255,240,210,0.9)';
      g.beginPath(); g.ellipse(300, 60, 40, 22, 0, 0, TAU); g.fill();
      const t = new THREE.CanvasTexture(cv);
      t.mapping = THREE.EquirectangularReflectionMapping;
      t.encoding = THREE.sRGBEncoding;
      const pm = new THREE.PMREMGenerator(renderer);
      const rt = pm.fromEquirectangular(t);
      pm.dispose();
      return rt.texture;
    } catch (e) { return null; }
  }

  // ---------- 1. cup: la taza de Fidias (torno con UV propias) ----------
  // Perfil (r, y) de la taza: pie, cuerpo abombado, borde; luego el interior hasta el fondo.
  const CUP_PROF = [[0.0, 0.0], [0.34, 0.0], [0.40, 0.03], [0.38, 0.075], [0.24, 0.12], [0.17, 0.17],
    [0.22, 0.25], [0.40, 0.36], [0.62, 0.6], [0.82, 0.86], [0.94, 1.04], [0.99, 1.17], [1.0, 1.25],
    [0.97, 1.28], [0.91, 1.28], [0.9, 1.22], [0.8, 0.96], [0.62, 0.72], [0.36, 0.6], [0.0, 0.58]];
  // lathe propio: u = ángulo (0..1), v = longitud de arco del perfil normalizada
  function lathe(prof, seg) {
    const n = prof.length, cum = [0];
    for (let i = 1; i < n; i++) cum.push(cum[i - 1] + Math.hypot(prof[i][0] - prof[i - 1][0], prof[i][1] - prof[i - 1][1]));
    const L = cum[n - 1] || 1;
    const P = [], UV = [], I = [];
    for (let i = 0; i < n; i++) for (let j = 0; j <= seg; j++) {
      const th = TAU * j / seg, r = prof[i][0];
      P.push(r * Math.cos(th), prof[i][1], r * Math.sin(th));
      UV.push(1 - j / seg, cum[i] / L);   // u invertida: el texto se lee de frente desde fuera
    }
    for (let i = 0; i < n - 1; i++) for (let j = 0; j < seg; j++) {
      const a = i * (seg + 1) + j, b = a + 1, c = a + seg + 1, d = c + 1;
      I.push(a, c, b, b, c, d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
    g.setIndex(I);
    g.computeVertexNormals();
    return { g: g, cum: cum, L: L };
  }
  // radio exterior de la taza a la altura y (para los anillos de escaneo)
  function cupOuterR(y) {
    for (let i = 0; i < 12; i++) {
      const a = CUP_PROF[i], b = CUP_PROF[i + 1];
      const lo = Math.min(a[1], b[1]), hi = Math.max(a[1], b[1]);
      if (y >= lo && y <= hi) { const u = hi - lo < 1e-6 ? 0 : (y - a[1]) / (b[1] - a[1]); return a[0] + (b[0] - a[0]) * u; }
    }
    return 0.2;
  }
  // mapas de color y de relieve: vidriado negro con la inscripción ΦΕΙΔΙΟ ΕΙΜΙ grabada dos veces
  function cupTextures(CL) {
    const W = 2048, H = 1024, TXT = 'ΦΕΙΔΙΟ ΕΙΜΙ';
    const pxH = CL.L / H;                  // metros por fila de textura
    const pxW = TAU * 0.95 / W;            // metros por columna (circunferencia media)
    const sx = pxH / pxW;                  // corrige la proporción: letras sin estirar
    const P = Math.round(0.34 / pxH);      // altura de letra ~34 cm
    const vA = CL.cum[8] / CL.L, vB = CL.cum[11] / CL.L;   // franja: cuerpo abombado
    const rTop = (1 - vB) * H, rBot = (1 - vA) * H, rMid = (rTop + rBot) / 2;   // flipY: v=1 arriba
    const cm = document.createElement('canvas'); cm.width = W; cm.height = H;
    const cb = document.createElement('canvas'); cb.width = W; cb.height = H;
    const g = cm.getContext('2d'), b = cb.getContext('2d');
    g.fillStyle = '#16110c'; g.fillRect(0, 0, W, H);
    b.fillStyle = '#808080'; b.fillRect(0, 0, W, H);
    const rnd = seeded(99991);
    for (let i = 0; i < 2600; i++) {               // vidriado irregular
      const x = rnd() * W, y = rnd() * H, r = 1 + rnd() * 3;
      g.fillStyle = rnd() < 0.5 ? 'rgba(70,50,34,0.35)' : 'rgba(0,0,0,0.4)';
      g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    }
    // franja: líneas doradas, puntos y placa rebajada
    g.fillStyle = 'rgba(160,120,60,0.22)'; g.fillRect(0, rTop, W, rBot - rTop);
    g.strokeStyle = 'rgba(214,170,90,0.85)'; g.lineWidth = 4;
    [rTop + 8, rBot - 8].forEach(function (y) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); });
    g.fillStyle = 'rgba(214,170,90,0.8)';
    for (let x = 0; x < W; x += 24) {
      g.beginPath(); g.arc(x, rTop + 18, 3, 0, TAU); g.fill();
      g.beginPath(); g.arc(x, rBot - 18, 3, 0, TAU); g.fill();
    }
    b.fillStyle = '#6e6e6e'; b.fillRect(0, rTop, W, rBot - rTop);
    b.strokeStyle = '#303030'; b.lineWidth = 6;
    [rTop + 8, rBot - 8].forEach(function (y) { b.beginPath(); b.moveTo(0, y); b.lineTo(W, y); b.stroke(); });
    // inscripción grabada (relieve rebajado) y dorada en el color
    g.font = b.font = 'bold ' + P + 'px Georgia, "Times New Roman", serif';
    g.textAlign = b.textAlign = 'center'; g.textBaseline = b.textBaseline = 'middle';
    [0.25, 0.75].forEach(function (u) {
      const cx = u * W;
      g.save(); g.translate(cx, rMid); g.scale(sx, 1);
      g.fillStyle = 'rgba(0,0,0,0.8)'; g.fillText(TXT, 2, 3);       // sombra del grabado
      g.fillStyle = 'rgba(244,206,120,1)'; g.fillText(TXT, 0, 0);
      g.restore();
      b.save(); b.translate(cx, rMid); b.scale(sx, 1);
      b.fillStyle = '#1c1c1c'; b.fillText(TXT, 0, 0);
      b.restore();
    });
    const map = new THREE.CanvasTexture(cm);
    map.encoding = THREE.sRGBEncoding;
    const bump = new THREE.CanvasTexture(cb);
    return { map: map, bump: bump };
  }
  // asa: tubo sobre una curva cúbica en el plano x=0 (sg = +1 / -1 lado Z)
  function handleB(B, sg) {
    const P0 = [0.9, 1.14], P1 = [1.46, 1.3], P2 = [1.56, 0.8], P3 = [0.8, 0.7];
    const secs = [];
    for (let i = 0; i <= 14; i++) {
      const t = i / 14, a = (1 - t) * (1 - t) * (1 - t), b = 3 * (1 - t) * (1 - t) * t,
        c = 3 * (1 - t) * t * t, d = t * t * t;
      const s = a * P0[0] + b * P1[0] + c * P2[0] + d * P3[0];
      const y = a * P0[1] + b * P1[1] + c * P2[1] + d * P3[1];
      secs.push([0, y, sg * s, 0.062, 0.062]);
    }
    loft(B, secs, 10, false, 0);
  }

  // ---------- 2. standup: Zeus de pie (≈17 m + corona de olivo) ----------
  // Coordenadas locales: origen en los pies, +X = frente (la estatua mira al este), +Z = derecha de Zeus.
  const SU_RX = [[0.4, 0.85], [3, 0.95], [5.5, 1.1], [8.4, 1.25], [10.2, 1.2], [11.5, 1.1], [13.0, 1.2], [14.2, 1.0], [14.4, 0.5]];
  const SU_RZ = [[0.4, 1.45], [3, 1.7], [5.5, 1.85], [8.4, 2.0], [10.2, 1.9], [11.5, 2.05], [13.0, 2.35], [14.2, 2.3], [14.4, 0.8]];
  function suBody(y, w) {
    const th = w * TAU;
    const pl = 1 + (0.03 * Math.sin(6 * th + 0.45 * y) + 0.018 * Math.sin(13 * th + 1.1 * y)) * (y < 10.2 ? 1.0 : 0.5);
    return [Math.cos(th) * tab(SU_RX, y) * pl, y, Math.sin(th) * tab(SU_RZ, y) * pl];
  }
  function suBodyFn(u, w) { return suBody(0.4 + u * 14.0, w); }
  const HEAD_ARGS = [0.1, 15.9, 0, 0.9, 1.1, 0.72];   // cabeza: cx, cy, cz, rx, ry, rz

  // ---------- 3. caligula: andamio, soldados y piezas ----------
  // Soldado romano fantasma (≈1,8 m), local: pies en 0, frente +X
  function soldierB(T, gear) {
    [0.12, -0.12].forEach(function (z) {
      limb(T, [0, 0.9, z], [0.02, 0.5, z], 0.11, 0.08, 8, 2);
      limb(T, [0.02, 0.5, z], [0.0, 0.07, z], 0.08, 0.06, 8, 2);
      boxB(T, [0.12, 0.05, z], 0.14, 0.05, 0.07);
    });
    grid(T, 10, 18, function (u, w) {                    // faldellín
      const y = 0.55 + u * 0.5, th = w * TAU, pl = 1 + 0.05 * Math.sin(9 * th + y * 4);
      return [Math.cos(th) * 0.15 * pl, y, Math.sin(th) * 0.22 * pl];
    });
    grid(T, 10, 18, function (u, w) {                    // coraza
      const y = 1.05 + u * 0.4, th = w * TAU;
      return [Math.cos(th) * 0.14, y, Math.sin(th) * 0.2];
    });
    limb(T, [0, 1.4, 0], [0, 1.5, 0], 0.05, 0.05, 8, 2);
    grid(T, 12, 20, headFnLocal(0, 1.6, 0, 0.1, 0.12, 0.09));
    if (gear) {
      grid(T, 6, 16, capFnLocal(0, 1.6, 0, 0.11, 0.13, 0.1));
      boxB(T, [0, 1.78, 0], 0.03, 0.09, 0.14);           // cresta
    }
    limb(T, [0, 1.36, 0.2], [0.06, 1.0, 0.26], 0.07, 0.055, 8, 2);
    limb(T, [0.06, 1.0, 0.26], [0.2, 0.9, 0.22], 0.055, 0.045, 8, 2);
    limb(T, [0, 1.36, -0.2], [0.1, 1.0, -0.26], 0.07, 0.055, 8, 2);
    if (gear) {
      boxB(T, [0.16, 1.0, -0.3], 0.03, 0.26, 0.19);      // escudo
      limb(T, [0.2, 0.0, 0.22], [0.2, 2.1, 0.22], 0.02, 0.02, 4, 0);   // lanza
    }
  }
  function headFnLocal(cx, cy, cz, rx, ry, rz) {
    return function (u, w) {
      const ph = u * Math.PI, th = w * TAU, s = Math.sin(ph), c = Math.cos(ph);
      return [cx + rx * s * Math.cos(th), cy + ry * c, cz + rz * s * Math.sin(th)];
    };
  }
  function capFnLocal(cx, cy, cz, rx, ry, rz) {
    const f = headFnLocal(cx, cy, cz, rx, ry, rz);
    return function (u, w) { return f(u * 0.5, w); };
  }
  // Cabeza de la estatua en mundo
  function headFnWorld(cx, cy, cz, rx, ry, rz, k) {
    return function (u, w) {
      const ph = u * Math.PI, th = w * TAU, s = Math.sin(ph), c = Math.cos(ph);
      return [cx + rx * k * s * Math.cos(th), cy + ry * k * c, cz + rz * k * s * Math.sin(th)];
    };
  }
  function capFnWorld(cx, cy, cz, rx, ry, rz, k) {
    const f = headFnWorld(cx, cy, cz, rx, ry, rz, k);
    return function (u, w) { return f(u * 0.5, w); };
  }

  // ---------- 5. fire: línea hacia Constantinopla ----------
  const CONST_DIR = (function () {
    const c = SITE.constantinople, l = Math.hypot(c.dirX, c.dirZ) || 1;
    return [c.dirX / l, c.dirZ / l];
  })();

  G.createMystery = function (ctx) {
    const scene = ctx.scene, camera = ctx.camera, renderer = ctx.renderer;
    const root = new THREE.Group();
    scene.add(root);
    const env = makeEnv(renderer);
    const tq = new THREE.Quaternion(), tm = new THREE.Matrix4(), tp = new THREE.Vector3(), ts = new THREE.Vector3();
    const axV = new THREE.Vector3();

    // ================= 1. cup: taza de Fidias ampliada (holograma x40) sobre el taller =================
    const CL = lathe(CUP_PROF, 44);
    const CT = cupTextures(CL);
    const cupMat = new THREE.MeshStandardMaterial({
      map: CT.map, bumpMap: CT.bump, bumpScale: 0.012,
      color: 0xffffff, roughness: 0.36, metalness: 0.1,
      envMap: env, envMapIntensity: 0.9,
      emissive: 0x0b3a44, emissiveIntensity: 0.45,
      transparent: true, opacity: 0, side: THREE.DoubleSide
    });
    // luz propia del holograma (el taller puede estar a oscuras): una PointLight fría por encima y delante
    const cupLight = new THREE.PointLight(0xe8fbff, 0, 14, 2);
    cupLight.position.set(CUP.x - 2.2, CUP_BASE_Y + 2.2, CUP.z - 1.6);
    root.add(cupLight);
    const cupG = new THREE.Group();
    cupG.position.set(CUP.x, CUP_BASE_Y, CUP.z);
    root.add(cupG);
    cupG.add(new THREE.Mesh(CL.g, cupMat));
    const shellMat = ghostMat(CYAN, SILVER, 0.06, 0.9);
    const shell = new THREE.Mesh(CL.g, shellMat);
    shell.scale.setScalar(1.012);
    cupG.add(shell);
    const HB = newB();
    handleB(HB, 1); handleB(HB, -1);
    cupG.add(new THREE.Mesh(fillGeo(HB), cupMat));
    // anillos de escaneo que suben por la taza (siguen el perfil exterior)
    const scanRings = [0, 1].map(function () {
      const m = new THREE.MeshBasicMaterial({
        color: CYAN, transparent: true, opacity: 0, blending: THREE.AdditiveBlending,
        depthWrite: false, side: THREE.DoubleSide, fog: false
      });
      const r = new THREE.Mesh(new THREE.RingGeometry(0.96, 1.0, 72), m);
      r.rotation.x = -Math.PI / 2;
      cupG.add(r);
      return r;
    });
    const cupHalo = glowSprite('127,227,240', 7.5, [0, 0.7, 0]);
    cupG.add(cupHalo);
    // haz de proyección desde la mesa hasta el holograma y el punto de luz sobre la mesa
    const beamMat = new THREE.MeshBasicMaterial({
      color: CYAN, transparent: true, opacity: 0, blending: THREE.AdditiveBlending,
      depthWrite: false, side: THREE.DoubleSide, fog: false
    });
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.5, CUP_BASE_Y - CUP.y, 32, 1, true), beamMat);
    beam.position.set(CUP.x, CUP.y + (CUP_BASE_Y - CUP.y) / 2, CUP.z);
    root.add(beam);
    const tableGlow = glowSprite('127,227,240', 4.2, [CUP.x, CUP.y + 0.06, CUP.z]);
    root.add(tableGlow);
    const cupLab = label('«Pertenezco a Fidias»', { lh: 0.9, color: '#9ff3ff', pos: [CUP.x - 1.5, 3.6, CUP.z - 2.1] });
    root.add(cupLab.sprite);

    // ================= 2. standup: Zeus de pie atravesando el techo del templo =================
    const standG = new THREE.Group();
    standG.position.set(ZX, ZY, ZZ);
    root.add(standG);
    const SU = newB(), SUE = { P: [], C: [] };
    grid(SU, 40, 48, suBodyFn);                                                      // túnica/cuerpo
    limb(SU, [0.02, 14.0, 0], [0.1, 14.9, 0], 0.5, 0.45, 12, 3);                     // cuello
    grid(SU, 16, 28, headFnWorld(HEAD_ARGS[0], HEAD_ARGS[1], HEAD_ARGS[2], HEAD_ARGS[3], HEAD_ARGS[4], HEAD_ARGS[5], 1));
    grid(SU, 8, 28, capFnWorld(0.1, 15.9, 0, 0.95, 1.16, 0.78, 1.05));              // cabello
    loft(SU, [[0.45, 14.85, 0, 0.5, 0.6], [0.55, 14.0, 0, 0.5, 0.58], [0.42, 13.1, 0, 0.3, 0.4], [0.25, 12.5, 0, 0.1, 0.12]], 14, false, 0);  // barba
    limb(SU, [0, 13.9, 2.1], [0.45, 16.2, 2.7], 0.62, 0.5, 14, 3);                  // brazo derecho alzado
    limb(SU, [0.45, 16.2, 2.7], [0.2, 18.6, 2.6], 0.5, 0.36, 14, 3);
    ball(SU, [0.2, 18.9, 2.6], 0.4, 12);
    limb(SU, [0, 13.9, -2.1], [0.7, 11.3, -2.6], 0.62, 0.5, 14, 3);                 // brazo izquierdo con cetro
    limb(SU, [0.7, 11.3, -2.6], [1.0, 9.6, -2.8], 0.5, 0.38, 14, 3);
    ball(SU, [1.0, 9.5, -2.8], 0.4, 12);
    limb(SU, [1.0, 9.5, -2.8], [0.45, 18.0, -2.5], 0.14, 0.14, 8, 2);                // cetro
    ball(SU, [0.45, 18.2, -2.5], 0.3, 10);                                           // águila
    loft(SU, [[0.1, 14.1, -1.9, 0.45, 0.6], [0.5, 12.0, -2.0, 0.6, 0.85], [0.7, 9.5, -1.9, 0.7, 0.95], [0.9, 6.5, -1.6, 0.8, 1.0]], 14, false, 0); // manto
    boxB(SU, [0.3, 0.2, 0.9], 0.6, 0.2, 0.25);                                       // sandalias
    boxB(SU, [0.3, 0.2, -0.9], 0.6, 0.2, 0.25);
    for (let i = 0; i < 14; i++) {                                                   // corona de olivo sobre la cabeza
      const a = TAU * i / 14;
      ball(SU, [0.1 + 0.85 * Math.cos(a), 17.5 + 0.12 * Math.sin(2 * a), 0.85 * Math.sin(a) * 0.9], 0.22, 8);
    }
    // contornos: anillos del cuerpo y meridianos (líneas cian)
    const suSeg = function (fn, n, col) { for (let j = 0; j < n; j++) seg(SUE, fn(j / n), fn((j + 1) / n), col); };
    [1.5, 3.5, 5.5, 7.5, 9.5, 11.5, 13.2].forEach(function (y) { suSeg(function (w) { return suBody(y, w); }, 36, CYAN_C); });
    for (let m = 0; m < 8; m++) {
      const w = m / 8;
      for (let y = 0.4; y < 14.3; y += 1.0) seg(SUE, suBody(y, w), suBody(y + 1.0, w), CYAN_C);
    }
    [0.35, 0.5, 0.65].forEach(function (u) { suSeg(function (w) { return headFnWorld(0.1, 15.9, 0, 0.9, 1.1, 0.72, 1)(u, w); }, 24, SIL_C); });
    const suMat = ghostMat(CYAN, SILVER, 0.13, 0.85);
    suMat.depthTest = false;      // fantasma: se ve entero aunque el tejado del templo lo cubra
    standG.add(new THREE.Mesh(fillGeo(SU), suMat));
    const suEdges = new THREE.LineSegments(segGeo(SUE), vlineMat(0));
    suEdges.material.depthTest = false;
    standG.add(suEdges);
    const suHalo = glowSprite('127,227,240', 16, [0.1, 16.6, 0]);
    standG.add(suHalo);
    // rayo en la mano derecha: sube por encima de la cumbrera del templo (20,3 m)
    const BOLT = [[0.2, 18.9, 2.6], [0.7, 19.6, 2.6], [0.1, 20.3, 2.6], [0.9, 21.0, 2.6], [0.35, 21.7, 2.6]];
    const boltArr = [];
    for (let i = 0; i < BOLT.length - 1; i++) boltArr.push(BOLT[i][0], BOLT[i][1], BOLT[i][2], BOLT[i + 1][0], BOLT[i + 1][1], BOLT[i + 1][2]);
    const boltLine = new THREE.LineSegments(posGeo(boltArr), lineMat(0xfff0b0, 0));
    standG.add(boltLine);
    const boltGlow = glowSprite('255,240,190', 4.5, BOLT[BOLT.length - 1]);
    standG.add(boltGlow);
    const suLab = label('Estrabón:\n«si se levantara, rompería el techo»', { lh: 0.95, color: '#9ff3ff', pos: [ZX - 3.5, ZY + 1.2, ZZ - 5.0] });
    root.add(suLab.sprite);

    // ================= 3. caligula: andamio fantasma que se derrumba, soldados y "carcajada" =================
    const scafG = new THREE.Group();
    root.add(scafG);
    const SC = newB(), SCE = { P: [], C: [] };
    const yB = FLOOR, yT = 15.2, yM = (yB + yT) / 2, hH = (yT - yB) / 2;
    const LV = [3.0, 6.6, 10.2, 13.6];
    boxB(SC, [CAL.x0, yM, CAL.z0], 0.2, hH, 0.2);  boxB(SC, [CAL.x0, yM, CAL.z1], 0.2, hH, 0.2);
    boxB(SC, [CAL.x0, yM, 0], 0.2, hH, 0.2);
    boxB(SC, [CAL.x1, yM, CAL.z0], 0.2, hH, 0.2);  boxB(SC, [CAL.x1, yM, CAL.z1], 0.2, hH, 0.2);
    boxB(SC, [CAL.x1, yM, 0], 0.2, hH, 0.2);
    const xm = (CAL.x0 + CAL.x1) / 2, zm = 0;
    LV.forEach(function (h) {
      boxB(SC, [CAL.x0, h, zm], 0.12, 0.12, 5);                               // largueros a lo largo de Z
      boxB(SC, [CAL.x1, h, zm], 0.12, 0.12, 5);
      [CAL.z0, zm, CAL.z1].forEach(function (z) { boxB(SC, [xm, h, z], 5.5, 0.12, 0.12); });   // a lo largo de X
    });
    // riostras diagonales
    limb(SC, [CAL.x0, 3.0, CAL.z0], [CAL.x0, 10.2, CAL.z1], 0.1, 0.1, 6, 0);
    limb(SC, [CAL.x1, 6.6, CAL.z1], [CAL.x1, 13.6, CAL.z0], 0.1, 0.1, 6, 0);
    limb(SC, [CAL.x0, 6.6, CAL.z1], [xm, 13.6, CAL.z0], 0.1, 0.1, 6, 0);
    const scafMat = ghostMat(0xff3b30, 0xff9a6a, 0.08, 0.7);
    scafG.add(new THREE.Mesh(fillGeo(SC), scafMat));
    [[CAL.x0, yM, CAL.z0, 0.2, hH, 0.2], [CAL.x1, yM, CAL.z1, 0.2, hH, 0.2]].forEach(function (q) {
      boxEdges(SCE, [q[0], q[1], q[2]], q[3], q[4], q[5], RED_C);
    });
    LV.forEach(function (h) {
      boxEdges(SCE, [CAL.x0, h, zm], 0.12, 0.12, 5, RED_C);
      boxEdges(SCE, [CAL.x1, h, zm], 0.12, 0.12, 5, RED_C);
    });
    const scafEdges = new THREE.LineSegments(segGeo(SCE), vlineMat(0));
    scafG.add(scafEdges);
    // piezas que caen (tablones de las plataformas): se mueven con la pista, sin acumular
    const GRAV_PIECES = [
      { x: -14.0, y: 10.2, z: -4.0, s: [11, 0.16, 0.5], t0: 177.0, ax: [0, 0, 1], ang: 0.35, rest: 2.7 },
      { x: -14.0, y: 10.2, z: -1.0, s: [11, 0.16, 0.5], t0: 178.0, ax: [1, 0, 0], ang: -0.25, rest: 2.7 },
      { x: -14.0, y: 10.2, z: 2.0, s: [11, 0.16, 0.5], t0: 178.9, ax: [0, 0, 1], ang: -0.4, rest: 2.7 },
      { x: -14.0, y: 6.6, z: 4.4, s: [11, 0.16, 0.5], t0: 180.1, ax: [1, 0, 0], ang: 0.3, rest: 2.7 },
      { x: -14.0, y: 6.6, z: -3.4, s: [11, 0.16, 0.5], t0: 180.9, ax: [0, 0, 1], ang: 0.45, rest: 2.7 }
    ];
    const fallMat = new THREE.MeshStandardMaterial({
      color: 0xff6a4a, emissive: 0x4a0c04, emissiveIntensity: 0.8, roughness: 0.7, metalness: 0,
      transparent: true, opacity: 0, depthWrite: false
    });
    const fallMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), fallMat, GRAV_PIECES.length);
    fallMesh.frustumCulled = false;
    root.add(fallMesh);
    GRAV_PIECES.forEach(function (P) { P.axV = new THREE.Vector3(P.ax[0], P.ax[1], P.ax[2]); });
    // soldados romanos fantasma, de pie frente a la estatua (miran al oeste)
    const SOL = newB(), SOLT = newB();
    soldierB(SOLT, true);
    placeB(SOL, SOLT, Math.PI, -5.0, FLOOR, -3.3);
    placeB(SOL, SOLT, Math.PI, -5.6, FLOOR, 0.2);
    placeB(SOL, SOLT, Math.PI, -4.8, FLOOR, 3.6);
    const solMat = ghostMat(0xff3b30, 0xffb08a, 0.14, 0.85);
    const solMesh = new THREE.Mesh(fillGeo(SOL), solMat);
    root.add(solMesh);
    // anillos dorados que salen de la cabeza ("la carcajada"): miran a la cámara
    const laughRings = [0, 1, 2].map(function () {
      const m = new THREE.MeshBasicMaterial({
        color: GOLD_HI, transparent: true, opacity: 0, blending: THREE.AdditiveBlending,
        depthWrite: false, side: THREE.DoubleSide, fog: false
      });
      const r = new THREE.Mesh(new THREE.RingGeometry(0.94, 1.0, 72), m);
      r.position.set(CAL_HEAD[0], CAL_HEAD[1], CAL_HEAD[2]);
      r.visible = false;
      root.add(r);
      return r;
    });
    const laughHalo = glowSprite('255,210,120', 5.5, CAL_HEAD);
    root.add(laughHalo);
    const calLab = label('CUENTAN QUE LA ESTATUA SE RIÓ\n(Suetonio)', { lh: 0.8, color: '#ff8a7a', pos: [ZX - 1.0, ZY + 1.6, ZZ + 5.0] });
    root.add(calLab.sprite);

    // ================= 4. measure: regla de 12 m, cota del techo, basa de 6,5 m y escala humana =================
    const MS = { P: [], C: [] };
    const YB = ZY, YT = ZY + 12, YC = TEMPLE.ceilingY;     // regla desde la basa hasta 12 m
    seg(MS, [RX, YB, RZ], [RX, YT, RZ], GOLD_C);
    seg(MS, [RX + 0.25, YB, RZ], [RX + 0.25, YT, RZ], GOLD_C);
    for (let m = 0; m <= 12; m++) {
      const y = YB + m, len = (m % 3 === 0) ? 1.0 : 0.5;
      seg(MS, [RX, y, RZ], [RX + len, y, RZ], GOLDHI_C);
    }
    // techo: cota horizontal a la altura de la cella (≈13 m)
    seg(MS, [RX, YC, RZ], [-18.5, YC, RZ], CYAN_C);
    seg(MS, [RX, YC - 0.5, RZ], [RX, YC + 0.5, RZ], CYAN_C);
    seg(MS, [-18.5, YC - 0.5, RZ], [-18.5, YC + 0.5, RZ], CYAN_C);
    // basa: 6,5 m de fondo (eje Z), delante de la basa
    const BX = ZEUS.base.x1 + 0.8, BY = ZEUS.base.y1 + 0.1;
    seg(MS, [BX, BY, -ZEUS.base.halfZ * 1], [BX, BY, ZEUS.base.halfZ], CYAN_C);
    seg(MS, [BX - 0.5, BY, -ZEUS.base.halfZ], [BX + 0.5, BY, -ZEUS.base.halfZ], CYAN_C);
    seg(MS, [BX - 0.5, BY, ZEUS.base.halfZ], [BX + 0.5, BY, ZEUS.base.halfZ], CYAN_C);
    const measG = new THREE.LineSegments(segGeo(MS), vlineMat(0));
    root.add(measG);
    // regla: barra luminosa de 12 m con marcas de metro (más visible que las líneas de 1 px)
    const RB = newB();
    boxB(RB, [RX, YB + 6, RZ], 0.07, 6, 0.07);
    for (let m = 0; m <= 12; m += (m % 3 === 0 ? 3 : 1)) boxB(RB, [RX + 0.35, YB + m, RZ], 0.45, 0.04, 0.05);
    const rulerMat = new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0, depthWrite: false, fog: false });
    const rulerMesh = new THREE.Mesh(fillGeo(RB), rulerMat);
    root.add(rulerMesh);
    // silueta humana de 1,8 m para la escala
    const HUM = newB(), HUMT = newB();
    soldierB(HUMT, false);
    placeB(HUM, HUMT, 0, -4.0, FLOOR, 6.0);
    const humMat = ghostMat(CYAN, SILVER, 0.16, 0.8);
    const humMesh = new THREE.Mesh(fillGeo(HUM), humMat);
    root.add(humMesh);
    const m12 = label('12 m', { lh: 0.7, color: '#ffd27a', pos: [RX - 1.2, YB + 11.0, RZ], fmax: 8 });
    const mCeil = label('13 m · techo', { lh: 0.6, color: '#9fe9ff', pos: [-11.5, YC + 0.7, RZ], fmax: 8 });
    const mBase = label('6,5 m de basa', { lh: 0.6, color: '#9fe9ff', pos: [BX + 1.0, BY + 0.7, 0.4], fmax: 8 });
    const mHum = label('×6,7 un humano', { lh: 0.55, color: '#ffd27a', pos: [-2.0, FLOOR + 2.4, 7.4], fmax: 8 });
    [m12, mCeil, mBase, mHum].forEach(function (L) { root.add(L.sprite); });

    // ================= 5. fire: línea luminosa hacia Constantinopla =================
    const FS = [ZX, 15.5, ZZ], FLEN = 900;
    const fireArr = [];
    for (let i = 0; i <= 200; i++) {
      const u = i / 200;
      fireArr.push(FS[0] + CONST_DIR[0] * FLEN * u, FS[1], FS[2] + CONST_DIR[1] * FLEN * u);
    }
    const fireLine = new THREE.Line(posGeo(fireArr), lineMat(0xffb36a, 0));
    fireLine.material.depthTest = false;
    root.add(fireLine);
    const rndF = seeded(7), beadArr = [];
    for (let i = 0; i < 160; i++) {
      const u = (i + 0.5) / 160;
      beadArr.push(
        FS[0] + CONST_DIR[0] * FLEN * u + (rndF() - 0.5) * 3,
        FS[1] + (rndF() - 0.5) * 3,
        FS[2] + CONST_DIR[1] * FLEN * u + (rndF() - 0.5) * 3
      );
    }
    const beadMat = new THREE.PointsMaterial({
      map: glowTex('255,190,110'), color: 0xffc27a, size: 14, sizeAttenuation: true, transparent: true,
      opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false
    });
    const fireBeads = new THREE.Points(posGeo(beadArr), beadMat);
    root.add(fireBeads);
    const END = [FS[0] + CONST_DIR[0] * FLEN, FS[1], FS[2] + CONST_DIR[1] * FLEN];
    const starSp = glowSprite('255,190,110', 90, END);
    const starCore = glowSprite('255,240,200', 26, END);
    root.add(starSp, starCore);
    const fireLab = label('CONSTANTINOPLA\n475 d.C.', { lh: 1.6, color: '#ffb36a', pos: [ZX + 1.5, ZY + 5.5, ZZ - 4.5], fmax: 24 });
    root.add(fireLab.sprite);

    // ---------- actualización (solo transformaciones, visibilidad, uniforms y opacidades) ----------
    function update(s) {
      const wall = num(s.wall), tt = num(s.t), cam = camera;

      // taza de Fidias: holograma que gira lentamente sobre el taller
      const pc = num(s.cup);
      cupG.visible = beam.visible = tableGlow.visible = pc > 0.001;
      if (cupG.visible) {
        const e = ss(pc);
        cupG.position.y = CUP_BASE_Y + 0.08 * Math.sin(wall * 0.9);
        cupG.rotation.y = wall * 0.22;
        cupMat.opacity = 0.92 * e;
        shellMat.uniforms.uOp.value = 0.8 * e;
        beamMat.opacity = 0.05 * e;
        cupLight.intensity = 26 * e;
        tableGlow.material.opacity = 0.6 * e;
        cupHalo.material.opacity = 0.35 * e;
        scanRings.forEach(function (r, k) {
          const yy = 0.1 + fract(wall * 0.16 + k * 0.5) * 1.2;
          const rr = cupOuterR(yy) + 0.04;
          r.position.y = yy;
          r.scale.set(rr, rr, 1);
          r.material.opacity = 0.5 * e * (1 - fract(wall * 0.16 + k * 0.5));
        });
      } else {
        cupLight.intensity = 0;
      }
      setLab(cupLab, cam, ramp(pc, 0.6, 1) * (1 - ramp(tt, 81.5, 83)));

      // Zeus de pie fantasma: se levanta desde la basa y atraviesa el techo
      const pu = num(s.standup);
      standG.visible = pu > 0.001;
      if (standG.visible) {
        const e = ss(pu);
        standG.position.y = ZY - 6 * (1 - e);
        suMat.uniforms.uOp.value = 0.85 * e;
        suEdges.material.opacity = 0.9 * e;
        suHalo.material.opacity = 0.4 * e;
        boltLine.material.opacity = 0.95 * e * (0.8 + 0.2 * Math.sin(wall * 17.0));
        boltGlow.material.opacity = 0.8 * e;
      }
      setLab(suLab, cam, ramp(pu, 0.7, 1) * (1 - ramp(tt, 161.5, 163)));

      // andamio fantasma, piezas que caen y soldados
      const pg = num(s.caligula);
      const cal = (1 - 0.6 * ramp(tt, 181.5, 185));
      scafG.visible = pg > 0.001;
      if (scafG.visible) {
        const e = ss(pg) * cal;
        scafMat.uniforms.uOp.value = 0.5 * e;
        scafEdges.material.opacity = 0.45 * e;
      }
      fallMesh.visible = pg > 0.001;
      solMesh.visible = pg > 0.001;
      if (fallMesh.visible) {
        for (let i = 0; i < GRAV_PIECES.length; i++) {
          const P = GRAV_PIECES[i];
          const fallT = Math.sqrt(2 * (P.y - P.rest) / GRAV);
          const tau = tt - P.t0;
          let y = P.y, ang = 0;
          if (tau > 0) {
            const u = clamp01(tau / fallT);
            y = Math.max(P.rest, P.y - 0.5 * GRAV * tau * tau);
            ang = P.ang * ss(u);
          }
          tq.setFromAxisAngle(P.axV, ang);
          tp.set(P.x, y, P.z);
          ts.set(P.s[0], P.s[1], P.s[2]);
          tm.compose(tp, tq, ts);
          fallMesh.setMatrixAt(i, tm);
        }
        fallMesh.instanceMatrix.needsUpdate = true;
        fallMat.opacity = 0.85 * ss(pg) * cal;
        solMesh.material.uniforms.uOp.value = 0.8 * ss(pg) * cal;
      }
      // "carcajada": anillos que se expanden desde la cabeza de la estatua
      const showRing = ramp(tt, 178, 178.6) * (1 - ramp(tt, 183, 185.5)) * ramp(pg, 0.5, 1);
      laughRings.forEach(function (r, k) {
        const ph = fract((tt - 178) / 1.6 + k / 3);
        const rad = 0.6 + 6.5 * ph;
        r.visible = showRing > 0.001;
        if (r.visible) {
          r.scale.set(rad, rad, 1);
          r.lookAt(cam.position);
          r.material.opacity = 0.9 * (1 - ph) * showRing;
        }
      });
      laughHalo.material.opacity = 0.6 * showRing;
      setLab(calLab, cam, ramp(pg, 0.6, 1) * (1 - ramp(tt, 184.5, 186)));

      // cotas: regla, techo, basa y escala humana
      const pm = num(s.measure);
      measG.visible = humMesh.visible = rulerMesh.visible = pm > 0.001;
      if (measG.visible) {
        measG.material.opacity = 0.95 * ramp(pm, 0.0, 0.5);
        rulerMat.opacity = 0.85 * ramp(pm, 0.0, 0.5);
        humMat.uniforms.uOp.value = 0.8 * ss(pm);
      }
      const lm = ramp(pm, 0.5, 1);
      setLab(m12, cam, lm); setLab(mCeil, cam, lm); setLab(mBase, cam, lm); setLab(mHum, cam, lm);

      // línea hacia Constantinopla (475 d.C.): crece desde la estatua y se apaga
      const pf = num(s.fire);
      fireLine.visible = fireBeads.visible = starSp.visible = starCore.visible = pf > 0.001;
      if (fireLine.visible) {
        drawN(fireLine, pf);
        fireLine.material.opacity = 0.95 * ramp(pf, 0.0, 0.25);
        fireBeads.geometry.setDrawRange(0, Math.round(clamp01(pf) * 160));
        beadMat.opacity = 0.9 * ramp(pf, 0.1, 0.5);
        const twinkle = 0.85 + 0.15 * Math.sin(wall * 2.4);
        starSp.material.opacity = ramp(pf, 0.8, 1) * twinkle;
        starCore.material.opacity = ramp(pf, 0.8, 1);
      }
      setLab(fireLab, cam, ramp(pf, 0.6, 1));
    }

    return { update: update };
  };
})();
