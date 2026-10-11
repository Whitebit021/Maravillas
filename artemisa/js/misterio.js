// Misterio (capa conspiranoica del Templo de Artemisa): la cazadora fantasma con su ciervo (leyenda del
// arquitrabe), Eróstrato con la antorcha, la línea dorada hacia Pella, el letrero prohibido, las cotas del
// templo y el Partenón fantasma para comparar. Todo por código: geometría fusionada (lofting, cajas y tubos),
// shader de borde (fresnel), puntos aditivos, sprites de halo, una PointLight para la antorcha y etiquetas
// CanvasTexture (sRGB) con placa oscura. Todo es función del estado s (no acumulativo).
(function () {
  'use strict';
  const G = window.GIZA;
  const THREE = window.THREE;

  const TAU = Math.PI * 2;
  const GOLD = 0xffd27a, GOLD_HI = 0xffe9a8, CYAN = 0x7fe3f0, SILVER = 0xe4f6ff, RED = 0xff3b30, STONE = 0xefe6d6;
  const GOLD_C = [1, 0.82, 0.48], GOLDHI_C = [1, 0.91, 0.66], CYAN_C = [0.5, 0.9, 0.94], SIL_C = [0.9, 0.97, 1];
  const RED_C = [1, 0.3, 0.25];
  const GROUND = 0.4;   // separación del suelo (evita z-fighting con near = 0.5)

  const SITE = G.SITE, TEMPLE = G.TEMPLE;
  const HX = TEMPLE.halfX, HZ = TEMPLE.halfZ;      // 57.5 x 27.5 (estilóbato)
  const ST_Y = TEMPLE.stylobateY;                  // 3
  const TOP_Y = TEMPLE.entabY0;                    // 21: capitel bajo el arquitrabe
  const RIDGE_Y = TEMPLE.ridgeY;                   // 31
  const DREAM = { x: -65, z: -35, yaw: -Math.PI / 4 };     // la figura mira al SE (hacia el templo)
  const HERO = { x: -70, z: -10, yaw: 0 };                 // mira al E (fachada oeste)
  const SIGN = { x: -84, z: 4, yaw: -3 * Math.PI / 4 };    // el letrero se lee desde el NO
  const ARCH = { x: -55, y: 22.75, z: -25 };               // arquitrabe "torcido" (sandramp)
  const ALEX = { x: -38, y: 26, z: -18 };                  // origen de la línea (sobre el templo)
  const ALEX_L = 1100;                                     // longitud de la línea hacia Pella
  const PX = 34.5, PZ = 15.5;                              // Partenón fantasma: medio largo y medio ancho
  const PAR = SITE.parthenonGhost;

  function clamp01(x) { return x < 0 ? 0 : (x > 1 ? 1 : x); }
  function ramp(x, a, b) { return clamp01((x - a) / (b - a)); }
  function ss(x) { x = clamp01(x); return x * x * (3 - 2 * x); }
  function num(v) { return (typeof v === 'number' && isFinite(v)) ? v : 0; }
  function norm(v) { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
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
  // punto local (yaw en Y, origen F) -> mundo; y su inversa
  function toW(F, yaw, lx, ly, lz) {
    const c = Math.cos(yaw), s = Math.sin(yaw);
    return [F.x + lx * c + lz * s, ly, F.z - lx * s + lz * c];
  }
  function toL(F, yaw, wx, wy, wz) {
    const a = -yaw, c = Math.cos(a), s = Math.sin(a), dx = wx - F.x, dz = wz - F.z;
    return [dx * c + dz * s, wy, -dx * s + dz * c];
  }

  // ---------- generación de mallas (listas planas -> BufferGeometry) ----------
  function newB() { return { P: [], I: [], LI: [] }; }
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
  function triB(B, a, b, c) {
    const base = B.P.length / 3;
    B.P.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    B.I.push(base, base + 1, base + 2);
  }
  function quadB(B, a, b, c, d) { triB(B, a, b, c); triB(B, a, c, d); }
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
  function rectSeg(S, hx, hz, y, c) {
    seg(S, [-hx, y, -hz], [hx, y, -hz], c); seg(S, [hx, y, -hz], [hx, y, hz], c);
    seg(S, [hx, y, hz], [-hx, y, hz], c); seg(S, [-hx, y, hz], [-hx, y, -hz], c);
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

  // ---------- etiquetas: Sprite + CanvasTexture + placa oscura ----------
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
  // lh = altura de la letra (m) a escala 1; el ancho sale del texto
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
      depthTest: false, blending: THREE.AdditiveBlending, opacity: 0
    });
    const sp = new THREE.Sprite(mat);
    const w = o.lh * CW / px, h = w * CH / CW;
    sp.scale.set(w, h, 1);
    sp.visible = false;
    sp.renderOrder = 2;
    const pm = new THREE.SpriteMaterial({ map: plateTex(), transparent: true, depthWrite: false, depthTest: false, fog: false, opacity: 0 });
    const pl = new THREE.Sprite(pm);
    pl.renderOrder = 1; pl.visible = false;
    const tw = g.measureText(text).width * o.lh / px;
    return {
      sprite: sp, mat: mat, plate: pl, w: w, h: h, lh: o.lh, tw: tw,
      p: new THREE.Vector3(o.pos[0], o.pos[1], o.pos[2]), fmax: o.fmax || 20
    };
  }
  // escala la etiqueta con la distancia de la cámara (tamaño aparente casi constante) y fija su opacidad
  function setLab(L, camera, op) {
    op = clamp01(op);
    if (op <= 0.001) { L.sprite.visible = false; L.plate.visible = false; return; }
    const d = camera.position.distanceTo(L.p);
    const f = Math.max(0.4, Math.min(L.fmax, d / 28));
    L.sprite.position.copy(L.p); L.plate.position.copy(L.p);
    L.sprite.scale.set(L.w * f, L.h * f, 1);
    L.plate.scale.set((L.tw + L.lh * 0.5) * f, L.lh * 1.45 * f, 1);
    L.mat.opacity = op; L.sprite.visible = true;
    L.plate.material.opacity = op * 0.6; L.plate.visible = true;
  }

  // ---------- figuras ----------
  // Artemisa cazadora: túnica corta, torso, cabeza con moño, arco, carcaj y ciervo al lado
  const DR_D = [[5.6, 1.5], [6.6, 1.42], [7.8, 1.25], [9.0, 1.38], [10.0, 1.3], [10.8, 1.05], [11.3, 0.62]];
  const DR_W = [[5.6, 2.4], [6.6, 2.3], [7.8, 2.0], [9.0, 2.1], [10.0, 2.2], [10.8, 2.2], [11.3, 1.2]];
  function dreamRobe(u, w) {
    const y = 5.6 + u * 5.7, th = w * TAU;
    const pl = 1 + (0.035 * Math.sin(8 * th + 0.5 * Math.sin(0.7 * y)) + 0.02 * Math.sin(17 * th + 1.7 * y)) * (1.2 - u);
    return [Math.cos(th) * tab(DR_D, y) * pl, y, Math.sin(th) * tab(DR_W, y) * pl];
  }
  function headFn(cx, cy, cz, rx, ry, rz, k) {
    return function (u, w) {
      const ph = u * Math.PI, th = w * TAU, s = Math.sin(ph), c = Math.cos(ph);
      return [cx + rx * k * s * Math.cos(th), cy + ry * k * c, cz + rz * k * s * Math.sin(th)];
    };
  }
  // casquete de pelo: solo la mitad superior de la cabeza, un poco mayor
  function capFn(cx, cy, cz, rx, ry, rz, k) {
    const f = headFn(cx, cy, cz, rx, ry, rz, k);
    return function (u, w) { return f(u * 0.5, w); };
  }
  // deja bien definido el punto de referencia del ciervo: su posición local a la figura
  const DEER = { x: -1.0, z: -8.5 };
  const ARCH_L = toL(DREAM, DREAM.yaw, ARCH.x, ARCH.y, ARCH.z);   // arquitrabe en coordenadas locales

  // Eróstrato: túnica corta, cabello, antorcha en la mano derecha; ~6 m
  const HR_D = [[2.4, 0.95], [3.0, 0.9], [3.8, 0.8], [4.4, 0.95], [4.8, 0.85], [5.05, 0.6]];
  const HR_W = [[2.4, 1.35], [3.0, 1.25], [3.8, 1.22], [4.4, 1.38], [4.8, 1.3], [5.05, 0.95]];
  function heroRobe(u, w) {
    const y = 2.4 + u * 2.65, th = w * TAU;
    const pl = 1 + (0.04 * Math.sin(7 * th + 0.4 * y) + 0.02 * Math.sin(13 * th)) * (1.1 - u);
    return [Math.cos(th) * tab(HR_D, y) * pl, y, Math.sin(th) * tab(HR_W, y) * pl];
  }

  // ---------- letras de piedra (trazos de cajas) ----------
  const LW = 4.2, LH = 6.2, LT = 0.95, LGAP = 1.2;
  const SIGN_Y0 = 12.6, SIGN_ZC = 1.3, SIGN_HZ = 0.4;
  function glyphRects(ch) {
    const w = LW, h = LH, t = LT, R = [];
    const diag = function (x0, y0, x1, y1, n) {
      for (let i = 0; i <= n; i++) {
        const u = i / n, x = x0 + (x1 - x0) * u, y = y0 + (y1 - y0) * u;
        R.push([x - t * 0.55, y - t * 0.55, x + t * 0.55, y + t * 0.55]);
      }
    };
    const ring = function (cx, cy, rx, ry, n) {
      for (let i = 0; i < n; i++) {
        const a = i / n * TAU, x = cx + rx * Math.cos(a), y = cy + ry * Math.sin(a);
        R.push([x - t * 0.5, y - t * 0.5, x + t * 0.5, y + t * 0.5]);
      }
    };
    switch (ch) {
      case 'E': R.push([0, 0, t, h], [0, h - t, w, h], [0, h / 2 - t / 2, w * 0.85, h / 2 + t / 2], [0, 0, w, t]); break;
      case 'R': R.push([0, 0, t, h], [0, h - t, w - 0.7, h], [w - t, h / 2, w, h], [0, h / 2 - t / 2, w - 0.7, h / 2 + t / 2]); diag(w * 0.5, h / 2, w, 0, 8); break;
      case 'Ó': ring(w / 2, h / 2, (w - t) / 2, (h - t) / 2, 20); diag(w * 0.3, h + 0.5, w * 0.62, h + 1.4, 3); break;
      case 'S': R.push([0, h - t, w, h], [0, h / 2, t, h], [0, h / 2 - t / 2, w, h / 2 + t / 2], [w - t, 0, w, h / 2], [0, 0, w, t]); break;
      case 'T': R.push([0, h - t, w, h], [w / 2 - t / 2, 0, w / 2 + t / 2, h]); break;
      case 'A': diag(0, 0, w / 2, h, 12); diag(w, 0, w / 2, h, 12); R.push([w * 0.25, h * 0.34, w * 0.75, h * 0.34 + t * 0.8]); break;
      case 'O': ring(w / 2, h / 2, (w - t) / 2, (h - t) / 2, 20); break;
      default: break;
    }
    return R;
  }

  G.createMystery = function (ctx) {
    const scene = ctx.scene, camera = ctx.camera;
    const root = new THREE.Group();
    scene.add(root);

    // ================= 1. dream: Artemisa fantasma junto a la esquina NO =================
    const dreamG = new THREE.Group();
    dreamG.position.set(DREAM.x, 0, DREAM.z);
    dreamG.rotation.y = DREAM.yaw;
    root.add(dreamG);
    const DB = newB(), DE = { P: [], C: [] };
    grid(DB, 28, 44, dreamRobe);                                                      // túnica corta
    grid(DB, 16, 28, headFn(0, 12.45, 0, 0.8, 0.98, 0.72, 1));                        // cabeza
    grid(DB, 8, 24, capFn(0, 12.45, 0, 0.8, 0.98, 0.72, 1.06));                       // pelo recogido
    ball(DB, [-0.85, 12.1, 0], 0.62, 12);                                             // moño
    limb(DB, [0, 11.1, 0], [0.05, 11.9, 0], 0.5, 0.42, 12, 3);                        // cuello
    // brazo derecho (+Z) señalando el arquitrabe
    const SR = [0, 10.7, 2.1], ER = [2.1, 12.5, 2.1], HR = [4.9, 14.2, 1.4];
    limb(DB, SR, ER, 0.5, 0.42, 12, 3); limb(DB, ER, HR, 0.42, 0.3, 12, 3); ball(DB, HR, 0.34, 10);
    // brazo izquierdo sosteniendo el arco
    const SL = [0, 10.7, -2.1], EL = [1.5, 9.5, -2.5], HL = [5.0, 9.6, -1.6];
    limb(DB, SL, EL, 0.5, 0.42, 12, 3); limb(DB, EL, HL, 0.42, 0.3, 12, 3); ball(DB, HL, 0.32, 10);
    // arco (arco largo en el plano vertical, la panza hacia delante)
    const BC = [1.1, 9.6, -1.6], BR = 3.9, bowS = [];
    for (let i = 0; i <= 24; i++) {
      const a = (-72 + 144 * i / 24) * Math.PI / 180;
      bowS.push([BC[0] + BR * Math.cos(a), BC[1] + BR * Math.sin(a), BC[2], 0.14, 0.14]);
    }
    loft(DB, bowS, 6, false, 0);
    seg(DE, bowS[0], bowS[24], SIL_C);                                                // cuerda
    // piernas bajo la túnica y pies
    [1.05, -1.05].forEach(function (z) {
      limb(DB, [0, 6.0, z], [0.2, 3.0, z], 0.8, 0.52, 12, 3);
      limb(DB, [0.2, 3.0, z], [0.1, 0.9, z], 0.52, 0.32, 10, 3);
      limb(DB, [-0.25, 0.4, z], [0.95, 0.35, z], 0.34, 0.3, 10, 2);
    });
    // carcaj a la espalda, con flechas
    const QT = [-1.5, 14.2, 1.2];
    limb(DB, [-1.0, 6.9, 0.9], QT, 0.5, 0.46, 12, 3);
    [-1, 0, 1].forEach(function (i) { seg(DE, QT, [QT[0] - 0.5, QT[1] + 2.2, QT[2] + i * 0.35], SIL_C); });
    // diadema con creciente en la frente
    for (let i = 0; i < 8; i++) {
      const a = (200 + 140 * i / 7) * Math.PI / 180, b = (200 + 140 * (i + 1) / 7) * Math.PI / 180;
      seg(DE, [0.62 + 0.45 * Math.cos(a), 13.0 + 0.45 * Math.sin(a), 0], [0.62 + 0.45 * Math.cos(b), 13.0 + 0.45 * Math.sin(b), 0], GOLDHI_C);
    }
    // línea de señalización: de la mano al arquitrabe
    seg(DE, HR, [ARCH_L[0], ARCH_L[1], ARCH_L[2]], CYAN_C);
    // ciervo a su lado (cuerpo, cuello, cabeza, cornamenta, patas), mira al SE
    const dp = function (x, y, z) { return [x + DEER.x, y, z + DEER.z]; };
    loft(DB, [
      [DEER.x - 3.4, 4.5, DEER.z, 0.8, 0.9], [DEER.x - 1.8, 4.6, DEER.z, 1.0, 1.1],
      [DEER.x + 0.2, 4.4, DEER.z, 1.05, 1.15], [DEER.x + 2.0, 4.2, DEER.z, 0.8, 0.9],
      [DEER.x + 2.8, 4.0, DEER.z, 0.5, 0.6]
    ], 14, false, 0);
    limb(DB, dp(-2.4, 3.8, 0.55), dp(-2.6, 0.1, 0.55), 0.26, 0.14, 8, 2);
    limb(DB, dp(-2.4, 3.8, -0.55), dp(-2.6, 0.1, -0.55), 0.26, 0.14, 8, 2);
    limb(DB, dp(2.0, 3.6, 0.5), dp(2.2, 0.1, 0.5), 0.24, 0.13, 8, 2);
    limb(DB, dp(2.0, 3.6, -0.5), dp(2.2, 0.1, -0.5), 0.24, 0.13, 8, 2);
    limb(DB, dp(2.4, 4.9, 0), dp(3.4, 6.8, 0), 0.55, 0.42, 10, 2);
    limb(DB, dp(3.4, 6.8, 0), dp(4.7, 7.4, 0), 0.42, 0.26, 10, 2);
    limb(DB, dp(-3.5, 4.9, 0), dp(-4.0, 4.2, 0), 0.25, 0.1, 6, 2);
    [1, -1].forEach(function (s) {
      limb(DB, dp(3.7, 7.6, s * 0.3), dp(3.9, 9.9, s * 1.1), 0.13, 0.08, 6, 2);
      limb(DB, dp(3.9, 9.1, s * 0.8), dp(4.5, 10.3, s * 1.5), 0.1, 0.05, 6, 2);
    });
    const dreamMat = ghostMat(CYAN, SILVER, 0.16, 0.85);
    dreamG.add(new THREE.Mesh(fillGeo(DB), dreamMat));
    const dreamEdges = new THREE.LineSegments(segGeo(DE), vlineMat(0));
    dreamG.add(dreamEdges);
    const dreamHalo = glowSprite('150,230,255', 30, [0, 12.2, 0]);
    dreamG.add(dreamHalo);
    const dreamLab = label('LA LEYENDA: Artemisa lo colocó en sueños', { lh: 1.0, color: '#bff4ff', pos: toW(DREAM, DREAM.yaw, 0, 18.4, 0), fmax: 20 });
    root.add(dreamLab.sprite, dreamLab.plate);

    // ================= 2. herostratus: Eróstrato con la antorcha, junto a la fachada oeste =================
    const heroG = new THREE.Group();
    heroG.position.set(HERO.x, 0, HERO.z);
    heroG.rotation.y = HERO.yaw;
    root.add(heroG);
    const HB = newB();
    grid(HB, 24, 40, heroRobe);                                                         // túnica
    grid(HB, 16, 24, headFn(0, 5.35, 0, 0.5, 0.66, 0.48, 1));                           // cabeza
    grid(HB, 8, 24, capFn(0, 5.35, 0, 0.5, 0.66, 0.48, 1.05));                          // cabello corto
    limb(HB, [0, 4.85, 0], [0.05, 5.05, 0], 0.36, 0.3, 12, 3);                          // cuello
    limb(HB, [0, 4.6, 1.3], [0.9, 3.8, 1.6], 0.4, 0.34, 12, 3);                         // brazo derecho con antorcha
    limb(HB, [0.9, 3.8, 1.6], [1.8, 4.4, 1.5], 0.34, 0.28, 12, 3); ball(HB, [1.8, 4.4, 1.5], 0.3, 10);
    limb(HB, [0, 4.6, -1.3], [0.15, 3.3, -1.5], 0.4, 0.34, 12, 3);                      // brazo izquierdo caído
    limb(HB, [0.15, 3.3, -1.5], [0.2, 2.2, -1.6], 0.34, 0.27, 12, 3);
    [0.55, -0.55].forEach(function (z) {                                                // piernas y pies
      limb(HB, [0, 3.0, z], [0.15, 1.6, z], 0.55, 0.36, 12, 3);
      limb(HB, [0.15, 1.6, z], [0.05, 0.45, z], 0.36, 0.26, 10, 3);
      limb(HB, [-0.15, 0.25, z], [0.6, 0.22, z], 0.28, 0.22, 10, 2);
    });
    limb(HB, [1.8, 4.4, 1.5], [2.6, 6.6, 1.6], 0.1, 0.09, 8, 2);                        // mango
    ball(HB, [2.6, 6.7, 1.6], 0.22, 8);                                                 // cazoleta
    const heroMat = ghostMat(0x8a1e12, 0xff6a3a, 0.16, 0.85);
    const heroBody = new THREE.Mesh(fillGeo(HB), heroMat);
    heroG.add(heroBody);
    const FLAME = [2.7, 7.1, 1.6];
    const flameSp = glowSprite('255,140,50', 5.2, FLAME);
    const coreSp = glowSprite('255,240,200', 1.9, FLAME);
    heroG.add(flameSp, coreSp);
    const torch = new THREE.PointLight(0xff8c3c, 0, 60, 2);
    torch.position.set(FLAME[0], FLAME[1], FLAME[2]);
    heroG.add(torch);
    const heroLab = label('356 a.C. · quería ser famoso', { lh: 0.9, color: '#ff9a6a', pos: toW(HERO, HERO.yaw, 0, 9.0, 0), fmax: 20 });
    root.add(heroLab.sprite, heroLab.plate);

    // ================= 3. alexander: línea dorada del templo hacia Pella (NO) =================
    const alexG = new THREE.Group();
    root.add(alexG);
    const dx = SITE.pella.dirX, dz = SITE.pella.dirZ;
    const AE = [ALEX.x + dx * ALEX_L, 10, ALEX.z + dz * ALEX_L];
    const lineArr = [];
    for (let i = 0; i <= 120; i++) {
      const u = i / 120;
      lineArr.push(ALEX.x + (AE[0] - ALEX.x) * u, ALEX.y + (AE[1] - ALEX.y) * u, ALEX.z + (AE[2] - ALEX.z) * u);
    }
    const alexLine = new THREE.Line(posGeo(lineArr), lineMat(GOLD_HI, 0.95));
    alexG.add(alexLine);
    // cuentas luminosas a lo largo de la línea (puntos con halo, un solo objeto)
    const rnd = seeded(7), beadArr = [];
    for (let i = 0; i < 130; i++) {
      const u = (i + 0.5) / 130;
      beadArr.push(
        ALEX.x + (AE[0] - ALEX.x) * u + (rnd() - 0.5) * 2,
        ALEX.y + (AE[1] - ALEX.y) * u + (rnd() - 0.5) * 2,
        ALEX.z + (AE[2] - ALEX.z) * u + (rnd() - 0.5) * 2
      );
    }
    const beadMat = new THREE.PointsMaterial({
      map: glowTex('255,210,120'), color: GOLD, size: 18, sizeAttenuation: true, transparent: true,
      opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false
    });
    const beads = new THREE.Points(posGeo(beadArr), beadMat);
    alexG.add(beads);
    const starSp = glowSprite('255,224,160', 70, AE);
    const starCore = glowSprite('255,255,255', 22, AE);
    alexG.add(starSp, starCore);
    const PL = 0.3;   // a mitad del recorrido ya dibujado en el plano 177 (cámara mirando al NO)
    const alexLab = label('PELLA · nace Alejandro Magno · LA MISMA NOCHE', { lh: 1.2, color: '#ffd27a', pos: [ALEX.x + (AE[0] - ALEX.x) * PL, 10, ALEX.z + (AE[2] - ALEX.z) * PL], fmax: 20 });
    root.add(alexLab.sprite, alexLab.plate);

    // ================= 4. nameBan: "ERÓSTRATO" en piedra, tachado en rojo =================
    const signG = new THREE.Group();
    signG.position.set(SIGN.x, 0, SIGN.z);
    signG.rotation.y = SIGN.yaw;
    root.add(signG);
    const PANEL = newB(), LETT = newB();
    boxB(PANEL, [0, 15.75, 0], 26, 5.25, 0.9);                                           // panel oscuro
    boxB(PANEL, [-23.5, 5.25, 0], 1.2, 5.25, 1.0);                                       // soportes
    boxB(PANEL, [23.5, 5.25, 0], 1.2, 5.25, 1.0);
    const WORD = 'ERÓSTRATO';
    let ox = -(WORD.length * LW + (WORD.length - 1) * LGAP) / 2;
    for (let c = 0; c < WORD.length; c++) {                                              // letras de piedra en relieve
      glyphRects(WORD.charAt(c)).forEach(function (r) {
        boxB(LETT, [ox + (r[0] + r[2]) / 2, SIGN_Y0 + (r[1] + r[3]) / 2, SIGN_ZC], (r[2] - r[0]) / 2, (r[3] - r[1]) / 2, SIGN_HZ);
      });
      ox += LW + LGAP;
    }
    const signMat = new THREE.MeshStandardMaterial({ color: 0x2b2620, roughness: 0.9, metalness: 0 });
    const letMat = new THREE.MeshStandardMaterial({ color: STONE, roughness: 0.7, metalness: 0, emissive: 0x9a6424, emissiveIntensity: 0.8 });
    signG.add(new THREE.Mesh(fillGeo(PANEL), signMat));
    signG.add(new THREE.Mesh(fillGeo(LETT), letMat));
    // tachón rojo que cruza el letrero
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1).translate(0.5, 0, 0), new THREE.MeshBasicMaterial({ color: RED }));
    bar.position.set(-23.5, 15.8, 1.9);
    bar.rotation.z = -0.07;
    bar.scale.set(0.001, 1.2, 0.6);
    signG.add(bar);
    const signHalo = glowSprite('255,205,130', 80, [0, 15.75, -2]);
    signG.add(signHalo);
    const banLab = label('NOMBRE PROHIBIDO BAJO PENA DE MUERTE', { lh: 0.8, color: '#ff6b5a', pos: toW(SIGN, SIGN.yaw, 0, 8.4, 2.2), fmax: 20 });
    root.add(banLab.sprite, banLab.plate);

    // ================= 5. measure: cotas del templo =================
    const MS = { P: [], C: [] };
    const zD = -HZ - 8, GD = 0.6, xD = HX + 8, xH = HX + 3;
    seg(MS, [-HX, GD, zD], [HX, GD, zD], GOLD_C);                                        // largo 115 m
    seg(MS, [-HX, GD, -HZ - 0.6], [-HX, GD, zD - 1.5], GOLD_C);
    seg(MS, [HX, GD, -HZ - 0.6], [HX, GD, zD - 1.5], GOLD_C);
    seg(MS, [-HX - 0.8, GD, zD - 0.8], [-HX + 0.8, GD, zD + 0.8], GOLDHI_C);
    seg(MS, [HX - 0.8, GD, zD - 0.8], [HX + 0.8, GD, zD + 0.8], GOLDHI_C);
    seg(MS, [xD, GD, -HZ], [xD, GD, HZ], GOLD_C);                                        // ancho 55 m
    seg(MS, [HX + 0.6, GD, -HZ], [xD + 1.5, GD, -HZ], GOLD_C);
    seg(MS, [HX + 0.6, GD, HZ], [xD + 1.5, GD, HZ], GOLD_C);
    seg(MS, [xD - 0.8, GD, -HZ - 0.8], [xD + 0.8, GD, -HZ + 0.8], GOLDHI_C);
    seg(MS, [xD - 0.8, GD, HZ - 0.8], [xD + 0.8, GD, HZ + 0.8], GOLDHI_C);
    seg(MS, [xH, ST_Y, zD], [xH, TOP_Y, zD], CYAN_C);                                    // altura 18 m
    seg(MS, [xH - 0.8, ST_Y, zD - 0.8], [xH + 0.8, ST_Y, zD + 0.8], CYAN_C);
    seg(MS, [xH - 0.8, TOP_Y, zD - 0.8], [xH + 0.8, TOP_Y, zD + 0.8], CYAN_C);
    seg(MS, [HX - 1.5, TOP_Y, -HZ + 1.5], [xH + 1, TOP_Y, zD], CYAN_C);
    seg(MS, [HX - 1.5, ST_Y, -HZ + 1.5], [xH + 1, ST_Y, zD], CYAN_C);
    const measG = new THREE.LineSegments(segGeo(MS), vlineMat(0));
    root.add(measG);
    const m115 = label('115 m', { lh: 1.6, color: '#ffd27a', pos: [0, GD + 1.8, zD - 3.5], fmax: 12 });
    const m55 = label('55 m', { lh: 1.6, color: '#ffd27a', pos: [xD + 6, GD + 1.8, 0], fmax: 12 });
    const m18 = label('18 m', { lh: 1.4, color: '#9fe9ff', pos: [xH - 6, 12, zD - 2], fmax: 12 });
    const m127 = label('127 COLUMNAS', { lh: 1.4, color: '#ffe9a8', pos: [30, 40, -55], fmax: 14 });
    [m115, m55, m18, m127].forEach(function (L) { root.add(L.sprite, L.plate); });

    // ================= 6. compare: Partenón fantasma cian (69 x 31 m, 8 x 17 columnas) =================
    const parG = new THREE.Group();
    parG.position.set(PAR.x, 0, PAR.z);
    root.add(parG);
    const PB = newB(), PE = { P: [], C: [] };
    boxB(PB, [0, 1.0, 0], PX + 2.4, 1.0, PZ + 2.4);                                      // estilóbato
    boxB(PB, [0, 0.3, 0], PX + 3.8, 0.3, PZ + 3.8);                                      // grada
    function colLoft(x, z) {
      loft(PB, [
        [x, 2.0, z, 1.02, 1.02], [x, 2.6, z, 0.98, 0.98], [x, 6.0, z, 0.9, 0.9], [x, 10.0, z, 0.84, 0.84],
        [x, 11.6, z, 0.84, 0.84], [x, 12.1, z, 0.92, 0.92], [x, 12.4, z, 1.12, 1.12], [x, 12.5, z, 1.18, 1.18]
      ], 14, false, 0);
      seg(PE, [x, 2.0, z], [x, 12.5, z], CYAN_C);
    }
    for (let i = 0; i < 8; i++) {                                                         // frentes: 8 columnas
      const z = -(PZ - 1.5) + i * 2 * (PZ - 1.5) / 7;
      colLoft(-(PX - 1.5), z); colLoft(PX - 1.5, z);
    }
    for (let i = 1; i < 16; i++) {                                                        // flancos: 15 por lado
      const x = -(PX - 1.5) + i * 2 * (PX - 1.5) / 16;
      colLoft(x, -(PZ - 1.5)); colLoft(x, PZ - 1.5);
    }
    boxB(PB, [0, 13.0, 0], PX + 0.4, 0.5, PZ + 0.4);                                     // arquitrabe
    boxB(PB, [0, 14.2, 0], PX + 0.9, 0.9, PZ + 0.9);                                     // friso y cornisa
    quadB(PB, [-PX, 15.1, -PZ], [PX, 15.1, -PZ], [PX, RIDGE_Y - 10, 0], [-PX, RIDGE_Y - 10, 0]);  // faldones
    quadB(PB, [-PX, 15.1, PZ], [PX, 15.1, PZ], [PX, RIDGE_Y - 10, 0], [-PX, RIDGE_Y - 10, 0]);
    [-1, 1].forEach(function (sx) {                                                       // frontones
      const x = sx * (PX + 0.4);
      triB(PB, [x, 15.1, -PZ], [x, 15.1, PZ], [x, RIDGE_Y - 10, 0]);
      seg(PE, [x, 15.1, -PZ], [x, RIDGE_Y - 10, 0], CYAN_C);
      seg(PE, [x, 15.1, PZ], [x, RIDGE_Y - 10, 0], CYAN_C);
      seg(PE, [x, 15.1, -PZ], [x, 15.1, PZ], CYAN_C);
    });
    rectSeg(PE, PX + 2.4, PZ + 2.4, 2.0, CYAN_C);
    rectSeg(PE, PX + 0.9, PZ + 0.9, 12.5, CYAN_C);
    rectSeg(PE, PX + 0.9, PZ + 0.9, 15.1, CYAN_C);
    seg(PE, [-PX, RIDGE_Y - 10, 0], [PX, RIDGE_Y - 10, 0], SIL_C);
    const parMat = ghostMat(CYAN, SILVER, 0.1, 0.6);
    const parBody = new THREE.Mesh(fillGeo(PB), parMat);
    parG.add(parBody);
    const parEdges = new THREE.LineSegments(segGeo(PE), vlineMat(0));
    parG.add(parEdges);
    const parLab = label('PARTENÓN · 4 veces más pequeño', { lh: 1.2, color: '#9fe9ff', pos: [100, 4, -86], fmax: 20 });
    root.add(parLab.sprite, parLab.plate);

    // ---------- actualización (solo uniforms, visibilidad, escalas y opacidades) ----------
    function update(s) {
      const wall = num(s.wall), tt = num(s.t), cam = camera;

      // Artemisa fantasma
      const pd = num(s.dream);
      dreamG.visible = pd > 0.001;
      if (dreamG.visible) {
        dreamMat.uniforms.uOp.value = 0.7 * ss(pd) * (0.92 + 0.08 * Math.sin(wall * 1.7));
        dreamEdges.material.opacity = 0.9 * ss(pd);
        dreamHalo.material.opacity = 0.35 * ss(pd);
      }
      setLab(dreamLab, cam, ramp(pd, 0.6, 1));

      // Eróstrato con antorcha
      const ph = num(s.herostratus);
      heroG.visible = ph > 0.001;
      if (heroG.visible) {
        const flick = 0.85 + 0.15 * Math.sin(wall * 13.1) * Math.sin(wall * 5.3 + 1.0);
        heroMat.uniforms.uOp.value = 0.85 * ss(ph);
        flameSp.material.opacity = ss(ph) * flick;
        flameSp.scale.set(5.2 * (0.9 + 0.12 * Math.sin(wall * 9.0)), 5.2 * (1.0 + 0.2 * Math.sin(wall * 11.0)), 1);
        coreSp.material.opacity = ss(ph) * (0.8 + 0.2 * flick);
        flameSp.visible = true; coreSp.visible = true;
        torch.intensity = 14 * ss(ph) * flick;
      }
      setLab(heroLab, cam, ramp(ph, 0.6, 1));

      // línea hacia Pella: crece desde el templo; cuentas y estrella al final
      const pa = num(s.alexander);
      alexG.visible = pa > 0.001;
      if (alexG.visible) {
        drawN(alexLine, pa);
        beads.geometry.setDrawRange(0, Math.round(clamp01(pa) * 130));
        beadMat.opacity = 0.9 * ramp(pa, 0.1, 0.5);
        starSp.material.opacity = ramp(pa, 0.8, 1) * (0.85 + 0.15 * Math.sin(wall * 2.4));
        starCore.material.opacity = ramp(pa, 0.8, 1);
        starSp.visible = starCore.visible = true;
        alexLine.material.opacity = 0.95 * ramp(pa, 0.0, 0.2);
      }
      setLab(alexLab, cam, ramp(tt, 175.5, 177.5) * (1 - ramp(tt, 180.5, 182)));

      // letrero: se levanta desde el suelo y se tacha
      const pn = num(s.nameBan);
      signG.visible = pn > 0.001;
      if (signG.visible) {
        signG.scale.y = Math.max(0.02, ss(pn));
        bar.scale.x = Math.max(0.001, 47 * ramp(pn, 0.3, 0.95));
        bar.visible = pn > 0.3;
        signHalo.material.opacity = 0.6 * ss(pn);
        signHalo.visible = true;
      }
      setLab(banLab, cam, ramp(pn, 0.7, 1));

      // cotas
      const pm = num(s.measure);
      measG.visible = pm > 0.001;
      if (measG.visible) {
        measG.material.opacity = 0.95 * ramp(pm, 0.0, 0.5);
      }
      const lm = ramp(pm, 0.4, 1);
      setLab(m115, cam, lm); setLab(m55, cam, lm); setLab(m18, cam, lm); setLab(m127, cam, lm);

      // Partenón fantasma
      const pc = num(s.compare);
      parG.visible = pc > 0.001;
      if (parG.visible) {
        parG.scale.y = Math.max(0.02, ss(pc));
        parMat.uniforms.uOp.value = 0.85 * ss(pc);
        parEdges.material.opacity = 0.9 * ss(pc);
      }
      setLab(parLab, cam, ramp(pc, 0.6, 1));
    }

    return { update: update };
  };
})();
