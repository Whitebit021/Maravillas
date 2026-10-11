// Entorno de Olimpia (exterior): cielo día/atardecer/noche con sol de sombras ajustadas al templo, valle con
// olivos, pinos y plátanos, colina de Cronos, ríos Alfeo y Cládeo, recinto del Altis con muro bajo, templo de
// Hera, estadio con taludes, palestra porticada, tesoros y altares. Y el TEMPLO DE ZEUS por fuera: crepidoma
// de 3 gradas, 34 columnas dóricas estriadas (InstancedMesh), entablamento con triglifos, frontones con figuras,
// tejado de tejas de mármol y acróteras doradas. Ruina (columnas en hileras de tambores), limo que sube y
// excavación de hoy. Todo procedural. El estado s es función pura (sin acumulación).
// Nota: THREE.ColorManagement.legacyMode=false, así que THREE.Color(hex) ya es lineal; los shaders propios
// trabajan en lineal y convierten a sRGB al final (toSRGB).
(function () {
  'use strict';
  const G = window.GIZA;

  // ---------- utilidades ----------
  const TAU = Math.PI * 2;
  function clamp01(x) { return x < 0 ? 0 : (x > 1 ? 1 : x); }
  function fract(x) { return x - Math.floor(x); }
  function sstep(e0, e1, x) { const t = clamp01((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); }
  function smooth(x) { return x * x * (3 - 2 * x); }
  let rngState = 90210;
  function rnd() { rngState = (rngState * 16807) % 2147483647; return rngState / 2147483647; }
  function makeRng(seed) {
    let s = seed | 0;
    return function () {
      s = (s + 0x6D2B79F5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hash2(ix, iz, sd) {
    let h = Math.imul(ix, 374761393) ^ Math.imul(iz + sd * 1013, 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967295;
  }
  function vnoise(x, z, sd) {
    const ix = Math.floor(x), iz = Math.floor(z);
    const fx = x - ix, fz = z - iz;
    const ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz);
    const a = hash2(ix, iz, sd), b = hash2(ix + 1, iz, sd);
    const c = hash2(ix, iz + 1, sd), d = hash2(ix + 1, iz + 1, sd);
    return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
  }
  function fbm(x, z, oct, sd) {
    let s = 0, amp = 0.5, f = 1, norm = 0;
    for (let i = 0; i < oct; i++) { s += amp * vnoise(x * f, z * f, sd + i * 17); norm += amp; amp *= 0.5; f *= 2.03; }
    return s / norm;
  }
  function ridged(x, z, oct, sd) {
    let s = 0, amp = 0.5, f = 1, norm = 0;
    for (let i = 0; i < oct; i++) {
      const n = 1 - Math.abs(2 * vnoise(x * f, z * f, sd + i * 17) - 1);
      s += amp * n * n; norm += amp; amp *= 0.5; f *= 2.03;
    }
    return s / norm;
  }
  function dome(x, z, cx, cz, R) {
    const d = Math.hypot(x - cx, z - cz) / R;
    if (d >= 1) return 0;
    const q = 1 - d * d;
    return q * q;
  }

  // ---------- geografía (datos de SITE y TEMPLE) ----------
  const SITE = G.SITE, TP = G.TEMPLE;
  const ALT = SITE.altis;                   // halfX 110, halfZ 100: recinto del Altis
  const HERA = SITE.heraion;                // templo de Hera: x, z, halfX 25, halfZ 9
  const STAD = SITE.stadium;                // estadio: x, z, length 192, width 30
  const PALX = SITE.palaestra.x, PALZ = SITE.palaestra.z;
  const KRO = SITE.kronos;                  // colina de Cronos: x, z, radius 220, height 120
  const ALPH_Z = SITE.alpheus.z;            // río Alfeo (corre en X)
  const KLAD_X = SITE.kladeos.x;            // río Cládeo (corre en Z)
  const WATER_Y = -0.6;
  const HX = TP.halfX, HZ = TP.halfZ, SY = TP.stylobateY, EAVE = TP.entabY1, ENT0 = TP.entabY0, RIDGE = TP.ridgeY;
  const CX0 = TP.cella.x0, CX1 = TP.cella.x1, CHZ = TP.cella.halfZ;
  const CEIL_Y = TP.ceilingY;               // 15.4: cara inferior del techo de la cella (sin vigas bajas)
  const WALLTOP = CEIL_Y;                   // coronación de los muros laterales = arranque del techo
  const CXI = 29.8, CZI = 11.6;             // ejes de las columnas del peristilo
  const KSL = (RIDGE - EAVE) / HZ;          // pendiente del tejado
  function roofY(z) { return EAVE + (HZ - Math.abs(z)) * KSL; }
  const SILT_H = 2.4;                       // altura máxima del limo sobre el Altis
  const SILT_COL = new (window.THREE.Color)('#7d6a4c');
  const SHADOW_DIST = 1200;
  const SUN_ELEV = 62 * Math.PI / 180;
  const EY = Math.sin(SUN_ELEV), EZ = Math.cos(SUN_ELEV);
  const MOON_Y = 0.32;

  function riverZ(x) { return ALPH_Z + 30 * Math.sin(x / 520) + 12 * Math.sin(x / 210 + 1.1); }
  function kladX(z) { return KLAD_X + 10 * Math.sin(z / 260); }

  // altura del terreno y máscaras en (x,z); reutiliza un objeto para no crear basura
  const tS = { h: 0, dS: 1e4, dP: 1e4, dA: 1e4, dK: 1e4, fAlt: 0 };
  function sampleTerrain(x, z) {
    // valle: ondulación suave
    let h = 3.0 * (fbm(x / 380, z / 380, 3, 7) - 0.5) * 2 + 1.5 * (fbm(x / 90, z / 90, 2, 9) - 0.5);
    // colina de Cronos (boscosa) y lomas del horizonte
    h += KRO.height * dome(x, z, KRO.x, KRO.z, KRO.radius) * (0.85 + 0.3 * ridged(x / 120, z / 120, 3, 41));
    h += 34 * dome(x, z, 620, -330, 300) * (0.8 + 0.4 * ridged(x / 160, z / 160, 2, 52));
    h += 48 * dome(x, z, -640, 300, 340) * (0.8 + 0.4 * ridged(x / 160, z / 160, 2, 53));
    h += 60 * dome(x, z, 240, 760, 360);
    const r = Math.sqrt(x * x + z * z);
    h += 70 * sstep(1150, 1700, r) * ridged(x / 420, z / 420, 3, 31);
    // el Altis y su entorno inmediato: llano a nivel 0
    const dAlt = Math.max(Math.abs(x) - ALT.halfX, Math.abs(z) - ALT.halfZ);
    const fAlt = 1 - sstep(0, 70, dAlt);
    h += (0 - h) * fAlt;
    // palestra: patio llano a nivel 0
    const dP = Math.max(Math.abs(x - PALX), Math.abs(z - PALZ)) - 28;
    h += (0 - h) * (1 - sstep(0, 16, dP));
    // estadio: pista llana (y=0) y taludes de hierba a ambos lados
    const dS = Math.max(Math.abs(x - STAD.x) - STAD.length / 2, Math.abs(z - STAD.z) - STAD.width / 2);
    const hS = dS <= 0 ? 0 : (0.3 * sstep(0, 3, dS) + 3.3 * sstep(3, 14, dS) + 0.8 * sstep(14, 34, dS));
    h += (hS - h) * (1 - sstep(36, 50, dS));
    // río Alfeo (lecho bajo el agua) y río Cládeo
    const dA = z - riverZ(x);
    h += (-2.6 - h) * (1 - sstep(34, 46, Math.abs(dA)));
    const dK = x - kladX(z);
    h += (-1.8 - h) * (1 - sstep(12, 20, Math.abs(dK)));
    tS.h = h; tS.dS = dS; tS.dP = dP; tS.dA = dA; tS.dK = dK; tS.fAlt = fAlt;
    return tS;
  }
  // zonas donde no crecen árboles ni se levantan cosas altas
  function treeFree(x, z) {
    if (Math.abs(x) < 134 && Math.abs(z) < 122) return false;
    if (Math.abs(x - STAD.x) < 118 && Math.abs(z - STAD.z) < 34) return false;
    if (Math.abs(x - PALX) < 50 && Math.abs(z - PALZ) < 50) return false;
    if (Math.abs(z - riverZ(x)) < 54) return false;
    if (Math.abs(x - kladX(z)) < 24) return false;
    return true;
  }

  // ---------- GLSL ----------
  const COMMON_GLSL = 'vec3 toSRGB(vec3 c) { return pow(max(c, vec3(0.0)), vec3(1.0 / 2.2)); }';

  const SKY_VS = [
    'varying vec3 vDir;',
    'void main() {',
    '  vDir = position;',
    '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
    '}'
  ].join('\n');

  const SKY_FS = [
    'uniform vec3 uZenith; uniform vec3 uHorizon; uniform vec3 uSunDir; uniform vec3 uSunCol;',
    'uniform vec3 uMoonDir; uniform vec3 uMoonCut; uniform vec3 uSunT1; uniform vec3 uSunT2;',
    'uniform float uSunVis; uniform float uMoonVis; uniform float uNight; uniform float uTime;',
    'uniform float uDusk; uniform float uDay; uniform float uSunAng; uniform vec3 uBelow;',
    'varying vec3 vDir;',
    COMMON_GLSL,
    'float hash13(vec3 p3) { p3 = fract(p3 * 0.1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }',
    'float vnoise3(vec3 x) {',
    '  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);',
    '  float n000 = hash13(i), n100 = hash13(i + vec3(1.0, 0.0, 0.0));',
    '  float n010 = hash13(i + vec3(0.0, 1.0, 0.0)), n110 = hash13(i + vec3(1.0, 1.0, 0.0));',
    '  float n001 = hash13(i + vec3(0.0, 0.0, 1.0)), n101 = hash13(i + vec3(1.0, 0.0, 1.0));',
    '  float n011 = hash13(i + vec3(0.0, 1.0, 1.0)), n111 = hash13(i + vec3(1.0, 1.0, 1.0));',
    '  return mix(mix(mix(n000, n100, f.x), mix(n010, n110, f.x), f.y),',
    '             mix(mix(n001, n101, f.x), mix(n011, n111, f.x), f.y), f.z);',
    '}',
    'void main() {',
    '  vec3 d = normalize(vDir);',
    '  float h = d.y;',
    '  vec3 up = mix(uHorizon, uZenith, pow(clamp(h, 0.0, 1.0), 0.6));',
    '  vec3 sky = mix(uBelow, up, smoothstep(-0.02, 0.02, h));',
    '  float hzBand = exp(-h * h * 400.0) * uDay;',
    '  float wob = 0.5 + 0.5 * sin(d.x * 240.0 + uTime * 1.4) * sin(d.z * 200.0 - uTime * 1.1);',
    '  sky += vec3(0.006, 0.005, 0.0) * hzBand * wob;',
    '  float sd = dot(d, uSunDir);',
    '  float sdc = max(sd, 0.0);',
    '  float cr = cos(uSunAng);',
    '  float disc = smoothstep(cr - 0.00003, cr + 0.00001, sd);',
    '  float halo = pow(sdc, 900.0) * 0.5 + pow(sdc, 60.0) * 0.14 + pow(sdc, 6.0) * 0.05;',
    '  sky += uSunCol * (disc * 4.0 + halo * (1.0 - 0.5 * uDusk)) * uSunVis;',
    '  float ang = atan(dot(d, uSunT2), dot(d, uSunT1));',
    '  float rays = pow(0.5 + 0.5 * sin(ang * 23.0 + vnoise3(vec3(ang * 4.0, 0.5, 0.0)) * 7.0), 5.0);',
    '  rays *= 0.6 + 0.4 * vnoise3(vec3(ang * 11.0, 3.0, 1.0));',
    '  float fall = exp(-(1.0 - sdc) * 9.0);',
    '  sky += uSunCol * rays * fall * uDusk * 0.25 * smoothstep(-0.1, 0.25, h);',
    '  float md = dot(d, uMoonDir);',
    '  float mdisc = smoothstep(0.99978, 0.99990, md) * (1.0 - smoothstep(0.99978, 0.99990, dot(d, uMoonCut)));',
    '  sky += vec3(0.8, 0.86, 1.0) * mdisc * uMoonVis * 1.3;',
    '  sky += vec3(0.3, 0.36, 0.6) * (pow(max(md, 0.0), 260.0) * 0.35 + pow(max(md, 0.0), 40.0) * 0.04) * uMoonVis;',
    '  vec3 g = d * 260.0; vec3 cell = floor(g); float hs = hash13(cell);',
    '  float star = step(0.9935, hs) * (1.0 - smoothstep(0.0, 0.3, length(fract(g) - 0.5)));',
    '  float tw = 0.75 + 0.25 * sin(uTime * (1.2 + 3.0 * hash13(cell + 7.1)) + hs * 90.0);',
    '  float br = 0.6 + 0.4 * hash13(cell + 3.7);',
    '  float kc = hash13(cell + 11.0);',
    '  vec3 scol = kc < 0.35 ? vec3(0.45, 0.65, 1.0) : (kc > 0.8 ? vec3(1.0, 0.55, 0.3) : vec3(0.95, 0.97, 1.0));',
    '  sky += scol * star * tw * br * uNight * smoothstep(-0.02, 0.08, h);',
    '  vec3 gn = normalize(vec3(0.42, 0.78, -0.46));',
    '  float band = exp(-pow(dot(d, gn) / 0.07, 2.0));',
    '  float cloud = vnoise3(d * 7.0) * 0.6 + vnoise3(d * 16.0) * 0.4;',
    '  float mw = band * (0.25 + 0.75 * cloud);',
    '  sky += vec3(0.55, 0.6, 0.8) * mw * 0.22 * uNight * smoothstep(-0.05, 0.1, h);',
    '  gl_FragColor = vec4(toSRGB(sky), 1.0);',
    '}'
  ].join('\n');

  const WATER_VS = [
    'varying vec3 vW;',
    'void main() {',
    '  vec4 w = modelMatrix * vec4(position, 1.0);',
    '  vW = w.xyz;',
    '  gl_Position = projectionMatrix * viewMatrix * w;',
    '}'
  ].join('\n');

  const WATER_FS = [
    'uniform float uTime; uniform vec3 uLightDir; uniform vec3 uLightCol; uniform float uLightI;',
    'uniform vec3 uHorizon; uniform vec3 uZenith; uniform vec3 uDeep;',
    'varying vec3 vW;',
    COMMON_GLSL,
    'void main() {',
    '  vec2 p = vW.xz;',
    '  float a1 = p.x * 0.05 + uTime * 1.3;',
    '  float a2 = p.y * 0.031 - uTime * 0.9 + p.x * 0.02;',
    '  float a3 = (p.x + p.y) * 0.11 + uTime * 2.1;',
    '  float gx = 0.25 * 0.05 * cos(a1) + 0.18 * 0.02 * cos(a2) + 0.12 * 0.11 * cos(a3);',
    '  float gz = 0.18 * 0.031 * cos(a2) + 0.12 * 0.11 * cos(a3);',
    '  vec3 n = normalize(vec3(-gx, 1.0, -gz));',
    '  vec3 V = normalize(cameraPosition - vW);',
    '  vec3 L = normalize(uLightDir);',
    '  float ndv = max(dot(n, V), 0.0);',
    '  float fres = 0.04 + 0.96 * pow(1.0 - ndv, 5.0);',
    '  vec3 R = reflect(-V, n);',
    '  vec3 sky = mix(uHorizon, uZenith, smoothstep(0.0, 0.6, R.y));',
    '  vec3 col = mix(uDeep, sky, clamp(fres * 0.5 + 0.03, 0.0, 1.0));',
    '  float rl = max(dot(reflect(-L, n), V), 0.0);',
    '  float spec = pow(rl, 90.0) * 1.2 + pow(rl, 8.0) * 0.06;',
    '  col += uLightCol * spec * uLightI * 1.5;',
    '  gl_FragColor = vec4(toSRGB(col), 1.0);',
    '}'
  ].join('\n');

  const POINT_VS = [
    'uniform float uPx;',
    'varying float vA;',
    'attribute float aA;',
    'void main() {',
    '  vec4 mv = modelViewMatrix * vec4(position, 1.0);',
    '  gl_Position = projectionMatrix * mv;',
    '  gl_PointSize = clamp(uPx / -mv.z, 1.0, 12.0);',
    '  vA = aA;',
    '}'
  ].join('\n');

  const POINT_FS = [
    'uniform vec3 uColor; varying float vA;',
    COMMON_GLSL,
    'void main() {',
    '  vec2 c = gl_PointCoord - 0.5;',
    '  float d = length(c);',
    '  if (d > 0.5) discard;',
    '  float a = 1.0 - d * 2.0; a *= a;',
    '  gl_FragColor = vec4(toSRGB(uColor), a * vA);',
    '}'
  ].join('\n');

  // ---------- geometría auxiliar (funciones puras, reciben THREE) ----------
  // une geometrías {g, m: matriz opcional, c: color opcional} en una sola
  function mergeGeos(THREE, list) {
    let nv = 0, ni = 0;
    list.forEach(function (it) {
      nv += it.g.attributes.position.count;
      ni += it.g.index ? it.g.index.count : it.g.attributes.position.count;
    });
    const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), col = new Float32Array(nv * 3).fill(1);
    const idx = new Uint32Array(ni);
    const v = new THREE.Vector3(), w = new THREE.Vector3(), nm = new THREE.Matrix3();
    let vo = 0, io = 0;
    list.forEach(function (it) {
      const g = it.g, P = g.attributes.position, N = g.attributes.normal, M = it.m || null, C = it.c || null;
      const cnt = P.count;
      if (M) nm.getNormalMatrix(M);
      for (let i = 0; i < cnt; i++) {
        v.fromBufferAttribute(P, i); if (M) v.applyMatrix4(M);
        const o = (vo + i) * 3;
        pos[o] = v.x; pos[o + 1] = v.y; pos[o + 2] = v.z;
        if (N) {
          w.fromBufferAttribute(N, i); if (M) w.applyMatrix3(nm); w.normalize();
          nor[o] = w.x; nor[o + 1] = w.y; nor[o + 2] = w.z;
        }
        if (C) { col[o] = C.r; col[o + 1] = C.g; col[o + 2] = C.b; }
      }
      if (g.index) { for (let i = 0; i < g.index.count; i++) idx[io++] = g.index.getX(i) + vo; }
      else { for (let i = 0; i < cnt; i++) idx[io++] = vo + i; }
      vo += cnt;
    });
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    out.setAttribute('color', new THREE.BufferAttribute(col, 3));
    out.setIndex(new THREE.BufferAttribute(idx, 1));
    return out;
  }
  // caja con UV en unidades de mundo / tile (la textura de sillares no se estira)
  function tiledBox(THREE, w, h, d, tile) {
    const g = new THREE.BoxGeometry(w, h, d);
    const pos = g.attributes.position, uv = g.attributes.uv, nrm = g.attributes.normal;
    for (let i = 0; i < pos.count; i++) {
      const nx = Math.abs(nrm.getX(i)), ny = Math.abs(nrm.getY(i));
      let a, b;
      if (nx > 0.5) { a = pos.getZ(i); b = pos.getY(i); }
      else if (ny > 0.5) { a = pos.getX(i); b = pos.getZ(i); }
      else { a = pos.getX(i); b = pos.getY(i); }
      uv.setXY(i, a / tile, b / tile);
    }
    return g;
  }
  // polígono convexo (abanico) con normal fija y UV por función
  function polyGeo(THREE, pts, n, uvf) {
    const pos = [], nor = [], uv = [], idx = [];
    pts.forEach(function (p) {
      pos.push(p[0], p[1], p[2]); nor.push(n[0], n[1], n[2]);
      const t = uvf ? uvf(p) : [0, 0]; uv.push(t[0], t[1]);
    });
    for (let i = 1; i < pts.length - 1; i++) idx.push(0, i, i + 1);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    return g;
  }
  // plano de cuatro puntos con normal calculada (para tejados de piezas estáticas)
  function quadGeo(THREE, p) {
    const a = new THREE.Vector3(p[0][0], p[0][1], p[0][2]), b = new THREE.Vector3(p[1][0], p[1][1], p[1][2]);
    const c = new THREE.Vector3(p[2][0], p[2][1], p[2][2]);
    const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).normalize();
    return polyGeo(THREE, p, [n.x, n.y, n.z], null);
  }
  // anillo de vigas (cornisa) de halfX x halfZ, espesor t, de y0 a y0+h
  function boxRing(THREE, hx, hz, y0, h, t) {
    const yc = y0 + h / 2, L = [];
    const M = function (w, d, x, z) { return new THREE.Matrix4().makeTranslation(x, yc, z); };
    L.push({ g: new THREE.BoxGeometry(t, h, 2 * hz), m: M(0, 0, hx - t / 2, 0) });
    L.push({ g: new THREE.BoxGeometry(t, h, 2 * hz), m: M(0, 0, -(hx - t / 2), 0) });
    L.push({ g: new THREE.BoxGeometry(2 * hx, h, t), m: M(0, 0, 0, -(hz - t / 2)) });
    L.push({ g: new THREE.BoxGeometry(2 * hx, h, t), m: M(0, 0, 0, hz - t / 2) });
    return L;
  }
  // estriado: desplaza radialmente la superficie para hacer nF acanaladuras
  // (las normales se fijan radiales a mano: computeVertexNormals dejaba los fustes oscuros)
  function fluted(geo, nF, depth) {
    const P = geo.attributes.position, N = geo.attributes.normal;
    for (let i = 0; i < P.count; i++) {
      const x = P.getX(i), z = P.getZ(i), th = Math.atan2(x, z);
      const f = Math.pow(0.5 + 0.5 * Math.cos(nF * th), 0.6);
      const k = 1 - depth * (1 - f);
      P.setXYZ(i, x * k, P.getY(i), z * k);
      const r = Math.hypot(x, z) || 1;
      N.setXYZ(i, x / r, 0, z / r);
    }
    return geo;
  }
  function makeRockGeometry(THREE, detail) {
    const g = new THREE.IcosahedronGeometry(1, detail);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const n = fract(Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453);
      const k = 0.78 + 0.45 * n;
      p.setXYZ(i, x * k, y * k * 0.7, z * k);
    }
    g.computeVertexNormals();
    return g;
  }
  // copa de olivo: icosaedro irregular, la copa a unos 3,5 m sobre el tronco (escala y posición en la instancia)
  function makeCanopyGeometry(THREE) {
    const g = new THREE.IcosahedronGeometry(2.0, 1);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const n = fract(Math.sin(x * 7.13 + y * 19.7 + z * 31.1) * 9311.7);
      const k = 0.85 + 0.3 * n;
      p.setXYZ(i, x * k, y * k * 0.72 + 3.6, z * k);
    }
    g.computeVertexNormals();
    return g;
  }
  // figura humana de altura unitaria (túnica lisa + cabeza + brazos), con superficies continuas
  function figureGeo(THREE) {
    const pts = [[0, 0], [0.15, 0], [0.17, 0.06], [0.155, 0.22], [0.16, 0.42], [0.17, 0.6], [0.15, 0.74], [0.1, 0.82], [0.05, 0.86], [0, 0.88]]
      .map(function (p) { return new THREE.Vector2(p[0], p[1]); });
    const body = new THREE.LatheGeometry(pts, 12);
    const head = new THREE.SphereGeometry(0.075, 10, 8).translate(0, 0.95, 0);
    const neck = new THREE.CylinderGeometry(0.035, 0.04, 0.08, 10).translate(0, 0.88, 0);
    const armL = new THREE.CylinderGeometry(0.04, 0.034, 0.3, 6).rotateZ(0.25).translate(-0.17, 0.66, 0);
    const armR = new THREE.CylinderGeometry(0.04, 0.034, 0.3, 6).rotateZ(-0.25).translate(0.17, 0.66, 0);
    return mergeGeos(THREE, [{ g: body }, { g: head }, { g: neck }, { g: armL }, { g: armR }]);
  }

  // ---------- paletas por hora (tod 0..1): cielo cenit/horizonte, color del sol, intensidad, hemisferio ----------
  G.createEnvironment = function (ctx) {
    const THREE = ctx.THREE, scene = ctx.scene, camera = ctx.camera, renderer = ctx.renderer;
    const root = new THREE.Group(); scene.add(root);
    const UP = new THREE.Vector3(0, 1, 0), AX = new THREE.Vector3(1, 0, 0), ZA = new THREE.Vector3(0, 0, 1);
    const ZERO_M = new THREE.Matrix4().makeScale(0, 0, 0);
    const _I = new THREE.Quaternion();

    const MOON_COL = new THREE.Color('#6f8fe0');
    const DEEP_DAY = new THREE.Color('#2a5a5a'), DEEP_NIGHT = new THREE.Color('#081018');
    const FOG_DAY = new THREE.Color('#d6dcd0');
    const HEM_GROUND_DAY = new THREE.Color('#6d5a3a');
    const HEM_GROUND_NIGHT = new THREE.Color('#263046');
    const KEYS = [
      // t,    cenit,      horizonte,  color sol,  intensidad, hemisferio
      [0.00,  '#02040c', '#0b1426', '#6f8fe0', 0.0, '#1a2550'],
      [0.18,  '#02040c', '#14183a', '#6f8fe0', 0.0, '#1d2a58'],
      [0.235, '#3a4f8a', '#e0a25a', '#ffc070', 1.1, '#9a7a6a'],
      [0.30,  '#3f80d0', '#f6d6aa', '#ffd2a0', 1.9, '#b8c4d8'],
      [0.38,  '#2d74cc', '#dfe6e0', '#fff0d6', 2.4, '#c9d8ea'],
      [0.50,  '#2a6fd0', '#cfe2ea', '#fff4e0', 2.6, '#d0dde8'],
      [0.62,  '#2d74cc', '#e0e0cc', '#ffe6b8', 2.4, '#c9d8ea'],
      [0.72,  '#2f4f9e', '#ffb070', '#ffb050', 1.6, '#f0b880'],
      [0.765, '#3a3a7a', '#ff9a2a', '#ffa040', 0.9, '#c07a6a'],
      [0.80,  '#1c2050', '#c0583a', '#ff7a3a', 0.15, '#6a4a5a'],
      [0.86,  '#02040c', '#0b1426', '#6f8fe0', 0.0, '#1f2a55'],
      [1.00,  '#02040c', '#0b1426', '#6f8fe0', 0.0, '#1a2550']
    ].map(function (k) {
      return { t: k[0], zen: new THREE.Color(k[1]), hor: new THREE.Color(k[2]), sun: new THREE.Color(k[3]), sI: k[4], hem: new THREE.Color(k[5]) };
    });
    const tZen = new THREE.Color(), tHor = new THREE.Color(), tSun = new THREE.Color(), tHem = new THREE.Color();
    const tFog = new THREE.Color(), tHemG = new THREE.Color();
    let kSunI = 0;
    function keyAt(tod) {
      let i = 0;
      while (i < KEYS.length - 2 && tod > KEYS[i + 1].t) i++;
      const A = KEYS[i], B = KEYS[i + 1];
      const u = clamp01((tod - A.t) / (B.t - A.t));
      tZen.copy(A.zen).lerp(B.zen, u);
      tHor.copy(A.hor).lerp(B.hor, u);
      tSun.copy(A.sun).lerp(B.sun, u);
      tHem.copy(A.hem).lerp(B.hem, u);
      kSunI = A.sI + (B.sI - A.sI) * u;
    }

    // ---------- cielo ----------
    const skyU = {
      uZenith: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: new THREE.Color() },
      uMoonDir: { value: new THREE.Vector3(0, 1, 0) }, uMoonCut: { value: new THREE.Vector3(0, 1, 0) },
      uSunT1: { value: new THREE.Vector3(1, 0, 0) }, uSunT2: { value: new THREE.Vector3(0, 0, 1) },
      uSunVis: { value: 0 }, uMoonVis: { value: 0 }, uNight: { value: 0 }, uTime: { value: 0 },
      uDusk: { value: 0 }, uDay: { value: 0 }, uSunAng: { value: 0.0047 }, uBelow: { value: new THREE.Color() }
    };
    const sunDir = skyU.uSunDir.value, moonDir = skyU.uMoonDir.value, moonCut = skyU.uMoonCut.value;
    const sunT1 = skyU.uSunT1.value, sunT2 = skyU.uSunT2.value;
    const tmpV = new THREE.Vector3(), upV = new THREE.Vector3(0, 1, 0);
    const skyMat = new THREE.ShaderMaterial({
      uniforms: skyU, vertexShader: SKY_VS, fragmentShader: SKY_FS,
      side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false
    });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(20000, 32, 16), skyMat);
    sky.renderOrder = -1000; sky.frustumCulled = false;
    root.add(sky);

    // niebla: muy suave, solo a partir de ~2 km
    scene.fog = new THREE.FogExp2(FOG_DAY.getHex(), 0.00002);

    // ---------- sol / luna: sombras ajustadas al templo (±60 m) ----------
    const sun = new THREE.DirectionalLight(0xffffff, 2);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 2048; sun.shadow.mapSize.height = 2048;
    const sc = sun.shadow.camera;
    sc.left = -60; sc.right = 60; sc.top = 60; sc.bottom = -60;
    sc.near = SHADOW_DIST - 200; sc.far = SHADOW_DIST + 200;
    sc.updateProjectionMatrix();
    sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.3;
    sun.target.position.set(0, 0, 0);
    root.add(sun); root.add(sun.target);

    const hemi = new THREE.HemisphereLight(0xd6e6ff, 0x6d5a3a, 0.6);
    root.add(hemi);
    // relleno sin sombras desde el lado opuesto al sol: ilumina las fachadas que el sol no toca
    const fill = new THREE.DirectionalLight(0xfff0dc, 0.5);
    root.add(fill); root.add(fill.target);

    // ---------- terreno: rejilla con paso fino cerca del centro (Altis, templo, estadio) y grueso al horizonte ----------
    const axis = [];
    {
      let v = -1800;
      while (v < 1800 - 1e-6) {
        axis.push(v);
        const a = Math.abs(v + 0.1);
        v = Math.min(1800, v + (a < 320 ? 12 : (a < 900 ? 30 : 60)));
      }
      axis.push(1800);
    }
    const xs = axis, zs = axis;
    const NX = xs.length, NZ = zs.length, NV = NX * NZ;
    const tPos = new Float32Array(NV * 3);
    const baseY = new Float32Array(NV);
    const smask = new Float32Array(NV);          // zona cubierta por el limo (Altis y su entorno)
    const colBase = new Float32Array(NV * 3);
    const tCol = new Float32Array(NV * 3);
    const tIdx = new Uint32Array((NX - 1) * (NZ - 1) * 6);
    for (let j = 0; j < NZ; j++) {
      for (let i = 0; i < NX; i++) {
        const k = j * NX + i, x = xs[i], z = zs[j];
        const s = sampleTerrain(x, z);
        tPos[k * 3] = x; tPos[k * 3 + 1] = s.h; tPos[k * 3 + 2] = z;
        baseY[k] = s.h;
        smask[k] = (1 - sstep(104, 114, Math.abs(x))) * (1 - sstep(94, 102, Math.abs(z)));
      }
    }
    let ti = 0;
    for (let j = 0; j < NZ - 1; j++) {
      for (let i = 0; i < NX - 1; i++) {
        const v00 = j * NX + i, v01 = (j + 1) * NX + i, v10 = j * NX + i + 1, v11 = (j + 1) * NX + i + 1;
        tIdx[ti++] = v00; tIdx[ti++] = v01; tIdx[ti++] = v10;
        tIdx[ti++] = v01; tIdx[ti++] = v11; tIdx[ti++] = v10;
      }
    }
    const terGeo = new THREE.BufferGeometry();
    const posAttr = new THREE.BufferAttribute(tPos, 3);
    terGeo.setAttribute('position', posAttr);
    terGeo.setIndex(new THREE.BufferAttribute(tIdx, 1));
    terGeo.computeVertexNormals();
    const nrm = terGeo.attributes.normal.array;

    // colores por vértice: valle verde, tierra seca, lecho húmedo, ocre de la pista, arena de la palestra, roca
    const cGrass = new THREE.Color('#6d7c39'), cDry = new THREE.Color('#9d8f5c'), cDark = new THREE.Color('#3e4f2b');
    const cWet = new THREE.Color('#4b4a2c'), cTrack = new THREE.Color('#b48a58'), cSand = new THREE.Color('#cdb585');
    const cRock = new THREE.Color('#8d8270'), cAltis = new THREE.Color('#7b8a40'), cBank = new THREE.Color('#6f8a3c');
    const tmpC = new THREE.Color();
    for (let k = 0; k < NV; k++) {
      const x = tPos[k * 3], z = tPos[k * 3 + 2], h = tPos[k * 3 + 1], ny = nrm[k * 3 + 1];
      const s = sampleTerrain(x, z);
      const n = vnoise(x / 60, z / 60, 8);
      tmpC.copy(cDry).lerp(cGrass, sstep(-0.5, 2.5, h) * (0.55 + 0.45 * sstep(0.35, 0.7, n)));
      tmpC.lerp(cDark, sstep(14, 38, h) * 0.85);
      tmpC.lerp(cAltis, s.fAlt * 0.6);
      tmpC.lerp(cWet, (1 - sstep(30, 46, Math.abs(s.dA))) * 0.8);
      tmpC.lerp(cWet, (1 - sstep(12, 20, Math.abs(s.dK))) * 0.8);
      tmpC.lerp(cBank, sstep(-2, 3, s.dS) * 0.0);
      tmpC.lerp(cTrack, 1 - sstep(-1.5, 0.5, s.dS));
      tmpC.lerp(cSand, 1 - sstep(0, 6, s.dP));
      tmpC.lerp(cRock, clamp01((0.8 - ny) / 0.25) * 0.85);
      const shade = 0.72 + 0.28 * clamp01(ny);
      colBase[k * 3] = tmpC.r * shade; colBase[k * 3 + 1] = tmpC.g * shade; colBase[k * 3 + 2] = tmpC.b * shade;
    }
    tCol.set(colBase);
    terGeo.setAttribute('color', new THREE.BufferAttribute(tCol, 3));
    const groundTex = groundTexture();
    const terMat = new THREE.MeshStandardMaterial({ vertexColors: true, map: groundTex, roughness: 0.97, metalness: 0 });
    const terrain = new THREE.Mesh(terGeo, terMat);
    terrain.receiveShadow = true;
    root.add(terrain);

    let lastSilt = -1;
    const SILT_RGB = [SILT_COL.r, SILT_COL.g, SILT_COL.b];
    // el limo sube sobre el Altis según la fracción se (0..1) y el color se mezcla con el barro
    function applySilt(se) {
      for (let k = 0; k < NV; k++) {
        const m = smask[k] * se;
        tPos[k * 3 + 1] = baseY[k] + SILT_H * m;
        const q = clamp01(m * 0.9);
        tCol[k * 3] = colBase[k * 3] + (SILT_RGB[0] - colBase[k * 3]) * q;
        tCol[k * 3 + 1] = colBase[k * 3 + 1] + (SILT_RGB[1] - colBase[k * 3 + 1]) * q;
        tCol[k * 3 + 2] = colBase[k * 3 + 2] + (SILT_RGB[2] - colBase[k * 3 + 2]) * q;
      }
      posAttr.needsUpdate = true;
      terGeo.attributes.color.needsUpdate = true;
      terGeo.computeVertexNormals();
    }

    // ---------- agua: Alfeo (al sur, corre en X) y Cládeo (al oeste, corre en Z) ----------
    const waterU = {
      uTime: { value: 0 }, uLightDir: { value: new THREE.Vector3(0, 1, 0) },
      uLightCol: { value: sun.color }, uLightI: { value: 0 },
      uHorizon: { value: new THREE.Color() }, uZenith: { value: new THREE.Color() },
      uDeep: { value: new THREE.Color('#2a5a5a') }
    };
    const waterMat = new THREE.ShaderMaterial({ uniforms: waterU, vertexShader: WATER_VS, fragmentShader: WATER_FS, side: THREE.DoubleSide });
    const wPos = [], wIdx = [];
    (function () {
      const N = 90;
      let base = 0;
      for (let k = 0; k <= N; k++) {
        const x = -1800 + 3600 * k / N, zc = riverZ(x);
        wPos.push(x, WATER_Y, zc - 46, x, WATER_Y, zc + 46);
      }
      for (let k = 0; k < N; k++) { const a = 2 * k, b = a + 1, c = a + 2, d = a + 3; wIdx.push(a, b, c, b, d, c); }
      base = (N + 1) * 2;
      for (let k = 0; k <= N; k++) {
        const z = -1800 + 3600 * k / N, xc = kladX(z);
        wPos.push(xc - 16, WATER_Y, z, xc + 16, WATER_Y, z);
      }
      for (let k = 0; k < N; k++) { const a = base + 2 * k, b = a + 1, c = a + 2, d = a + 3; wIdx.push(a, b, c, b, d, c); }
    })();
    const waterGeo = new THREE.BufferGeometry();
    waterGeo.setAttribute('position', new THREE.Float32BufferAttribute(wPos, 3));
    waterGeo.setIndex(wIdx);
    const water = new THREE.Mesh(waterGeo, waterMat);
    water.frustumCulled = false;
    root.add(water);

    // ---------- árboles: olivos, pinos (colinas) y plátanos (orillas) ----------
    const oTrunkGeo = new THREE.CylinderGeometry(0.2, 0.36, 3.4, 6, 1, false).translate(0, 1.7, 0);
    const oCanGeo = makeCanopyGeometry(THREE);
    const pTrunkGeo = new THREE.CylinderGeometry(0.2, 0.3, 4, 6).translate(0, 2, 0);
    const pCrownGeo = new THREE.ConeGeometry(2.4, 9, 7).translate(0, 8.5, 0);
    const plTrunkGeo = new THREE.CylinderGeometry(0.28, 0.44, 6.5, 7, 1, false).translate(0, 3.25, 0);
    const plCanGeo = new THREE.IcosahedronGeometry(3.4, 1).translate(0, 8.4, 0);
    const oliveT = [], oliveC = [], pineT = [], pineC = [], planeT = [], planeC = [];
    const m4 = new THREE.Matrix4(), quat = new THREE.Quaternion(), vPos = new THREE.Vector3(), vSc = new THREE.Vector3();
    const yAxis = new THREE.Vector3(0, 1, 0);
    function put4(list, x, y, z, sx, sy, sz, yaw, col) { list.push({ x: x, y: y, z: z, sx: sx, sy: sy, sz: sz, yaw: yaw, col: col }); }
    // olivos en la valle y laderas bajas
    let guard = 0;
    while (oliveT.length < 170 && guard < 60000) {
      guard++;
      const x = (rnd() * 2 - 1) * 1000, z = (rnd() * 2 - 1) * 1000;
      if (!treeFree(x, z)) continue;
      const s = sampleTerrain(x, z);
      if (s.h < 0.3 || s.h > 40 || s.dS < 45 || s.dP < 14) continue;
      const sc = 0.8 + rnd() * 0.5;
      put4(oliveT, x, s.h - 0.1, z, sc, sc * (0.9 + 0.3 * rnd()), sc, rnd() * TAU, null);
      const cc = new THREE.Color().setHSL(0.22 + 0.04 * rnd(), 0.22, 0.42 + 0.08 * rnd());
      put4(oliveC, x, s.h - 0.1, z, sc, sc, sc, rnd() * TAU, cc);
    }
    // pinos: la colina de Cronos (boscosa) y otras lomas
    guard = 0;
    while (pineT.length < 340 && guard < 80000) {
      guard++;
      let x, z;
      if (pineT.length < 260) {
        const a = rnd() * TAU, rr = Math.sqrt(rnd()) * KRO.radius * 0.95;
        x = KRO.x + Math.cos(a) * rr; z = KRO.z + Math.sin(a) * rr;
      } else { x = (rnd() * 2 - 1) * 1100; z = (rnd() * 2 - 1) * 1100; }
      if (!treeFree(x, z)) continue;
      const s = sampleTerrain(x, z);
      if (s.h < 7 || s.dS < 45) continue;
      const sc = 1.0 + rnd() * 0.6;
      put4(pineT, x, s.h - 0.2, z, sc, sc, sc, rnd() * TAU, null);
      const cc = new THREE.Color().setHSL(0.3 + 0.02 * rnd(), 0.4, 0.14 + 0.04 * rnd());
      put4(pineC, x, s.h - 0.2, z, sc, sc, sc, rnd() * TAU, cc);
    }
    // plátanos a lo largo de los ríos
    guard = 0;
    while (planeT.length < 110 && guard < 30000) {
      guard++;
      let x, z;
      if (rnd() < 0.6) { x = (rnd() * 2 - 1) * 900; z = riverZ(x) + (rnd() < 0.5 ? -1 : 1) * (52 + 18 * rnd()); }
      else { z = (rnd() * 2 - 1) * 900; x = kladX(z) + (rnd() < 0.5 ? -1 : 1) * (24 + 12 * rnd()); }
      const s = sampleTerrain(x, z);
      if (s.h < -0.3 || s.h > 6) continue;
      const sc = 0.85 + rnd() * 0.4;
      put4(planeT, x, s.h - 0.1, z, sc, sc, sc, rnd() * TAU, null);
      const cc = new THREE.Color().setHSL(0.2 + 0.03 * rnd(), 0.5, 0.42 + 0.06 * rnd());
      put4(planeC, x, s.h - 0.1, z, sc, sc, sc, rnd() * TAU, cc);
    }
    // olivos del renacer (dentro del Altis, aparecen con la excavación de hoy)
    const regrowN = 40;
    const regrowT = [], regrowC = [];
    guard = 0;
    while (regrowT.length < regrowN && guard < 20000) {
      guard++;
      const a = rnd() * TAU, rr = 45 + rnd() * 60;
      const x = Math.cos(a) * rr * 1.2, z = Math.sin(a) * rr * 0.9;
      if (Math.abs(x) < 46 && Math.abs(z) < 24) continue;
      if (Math.abs(x) > 104 || Math.abs(z) > 94) continue;
      const sc = 0.9 + rnd() * 0.4;
      regrowT.push({ x: x, z: z, sc: sc, yaw: rnd() * TAU });
    }

    function mkInst(geo, mat, list, colored) {
      const inst = new THREE.InstancedMesh(geo, mat, list.length);
      for (let i = 0; i < list.length; i++) {
        const R = list[i];
        quat.setFromAxisAngle(yAxis, R.yaw);
        vPos.set(R.x, R.y, R.z); vSc.set(R.sx, R.sy, R.sz);
        m4.compose(vPos, quat, vSc);
        inst.setMatrixAt(i, m4);
        if (colored && R.col) inst.setColorAt(i, R.col);
      }
      inst.instanceMatrix.needsUpdate = true;
      if (colored && inst.instanceColor) inst.instanceColor.needsUpdate = true;
      inst.frustumCulled = false; inst.castShadow = true; inst.receiveShadow = true;
      root.add(inst);
      return inst;
    }
    const oTrunkMat = new THREE.MeshStandardMaterial({ color: 0x6b5233, roughness: 0.95 });
    const oCanMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, flatShading: true });
    const pTrunkMat = new THREE.MeshStandardMaterial({ color: 0x5e4428, roughness: 0.95 });
    const pCrownMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, flatShading: true });
    const plTrunkMat = new THREE.MeshStandardMaterial({ color: 0xbfb296, roughness: 0.9 });
    const plCanMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, flatShading: true });
    // los olivos del renacer van al final del InstancedMesh de olivos: su matriz se pone a cero hasta hoy
    const oliveTrunk = mkInst(oTrunkGeo, oTrunkMat, oliveT.concat(regrowT.map(function (r) { return { x: r.x, y: 0, z: r.z, sx: r.sc, sy: r.sc, sz: r.sc, yaw: r.yaw }; })), false);
    const oliveCanopy = mkInst(oCanGeo, oCanMat, oliveC.concat(regrowT.map(function (r) { return { x: r.x, y: 0, z: r.z, sx: r.sc, sy: r.sc, sz: r.sc, yaw: r.yaw, col: new THREE.Color().setHSL(0.22, 0.22, 0.46) }; })), true);
    const oliveMatsT = [], oliveMatsC = [];
    for (let i = 0; i < oliveTrunk.count; i++) { const m = new THREE.Matrix4(); oliveTrunk.getMatrixAt(i, m); oliveMatsT.push(m); }
    for (let i = 0; i < oliveCanopy.count; i++) { const m = new THREE.Matrix4(); oliveCanopy.getMatrixAt(i, m); oliveMatsC.push(m); }
    const oliveBase = oliveT.length;
    const pineTrunk = mkInst(pTrunkGeo, pTrunkMat, pineT, false);
    const pineCrown = mkInst(pCrownGeo, pCrownMat, pineC, true);
    const planeTrunk = mkInst(plTrunkGeo, plTrunkMat, planeT, false);
    const planeCanopy = mkInst(plCanGeo, plCanMat, planeC, true);
    // rocas de la colina
    const rockList = [];
    guard = 0;
    while (rockList.length < 60 && guard < 30000) {
      guard++;
      const a = rnd() * TAU, rr = Math.sqrt(rnd()) * KRO.radius * 1.05;
      const x = KRO.x + Math.cos(a) * rr, z = KRO.z + Math.sin(a) * rr;
      const s = sampleTerrain(x, z);
      if (s.h < 12 || s.dS < 45) continue;
      const sc = 2 + rnd() * 3.5;
      rockList.push({ x: x, y: s.h - 0.5, z: z, sx: sc * (0.9 + 0.4 * rnd()), sy: sc * 0.7, sz: sc * (0.9 + 0.4 * rnd()), yaw: rnd() * TAU });
    }
    const rockInst = mkInst(makeRockGeometry(THREE, 1), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, flatShading: true }), rockList, false);
    // hierba baja: matas dispersas en el valle (la tapa el limo)
    const grassList = [];
    guard = 0;
    while (grassList.length < 2400 && guard < 60000) {
      guard++;
      const x = (rnd() * 2 - 1) * 800, z = (rnd() * 2 - 1) * 800;
      const s = sampleTerrain(x, z);
      if (s.h < -0.2 || s.h > 4 || s.dS < 30 || s.dP < 6 || Math.abs(z - riverZ(x)) < 44 || Math.abs(x - kladX(z)) < 18) continue;
      const sc = 0.7 + rnd() * 0.8;
      grassList.push({ x: x, y: s.h - 0.05, z: z, sx: sc, sy: sc, sz: sc, yaw: rnd() * TAU });
    }
    const grassInst = mkInst(new THREE.ConeGeometry(0.14, 0.6, 3, 1, true).translate(0, 0.3, 0),
      new THREE.MeshStandardMaterial({ color: 0x6f8a38, roughness: 0.9 }), grassList, false);

    // ---------- estáticos del sitio: templo de Hera, muro del Altis, tesoros, altares, palestra ----------
    const statics = [];
    const cLime = new THREE.Color('#e0d2ae'), cLime2 = new THREE.Color('#d6c59c'), cMarb = new THREE.Color('#efe6d6');
    const cRoofT = new THREE.Color('#b5703f'), cRoofS = new THREE.Color('#d8c8a0');
    const cAsh = new THREE.Color('#5e5950'), cStone = new THREE.Color('#8a8070'), cWood = new THREE.Color('#8a6a44');
    function addBox(w, h, d, x, y, z, c, yaw) {
      statics.push({ g: new THREE.BoxGeometry(w, h, d), m: new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(UP, yaw || 0), new THREE.Vector3(1, 1, 1)), c: c });
    }
    // Templo de Hera (dórico, más pequeño): 6 x 16 columnas, cella, tejado a dos aguas
    {
      const cx = HERA.x, cz = HERA.z, hx = HERA.halfX, hz = HERA.halfZ;
      addBox(2 * hx + 2, 0.9, 2 * hz + 2, cx, 0.45, cz, cLime2);
      const shaft = new THREE.CylinderGeometry(0.68, 0.8, 6.4, 14).translate(0, 3.2, 0);
      const capG = new THREE.BoxGeometry(1.9, 0.45, 1.9);
      const colsH = [];
      for (let k = 0; k < 16; k++) { const x = cx - 21 + k * 2.8; colsH.push([x, cz - 7.1]); colsH.push([x, cz + 7.1]); }
      for (let j = 1; j <= 4; j++) { const z = cz - 7.1 + j * 14.2 / 5; colsH.push([cx - 21, z]); colsH.push([cx + 21, z]); }
      colsH.forEach(function (p) {
        statics.push({ g: shaft, m: new THREE.Matrix4().makeTranslation(p[0], SY * 0 + 0.9, p[1]), c: cLime });
        statics.push({ g: capG, m: new THREE.Matrix4().makeTranslation(p[0], 7.5, p[1]), c: cLime });
      });
      addBox(2 * 21 + 3, 6.4, 2 * 6, cx, 4.1, cz, cLime2);            // cella (bloque)
      addBox(2 * 21 + 5, 0.5, 2 * 9 + 2, cx, 7.6, cz, cLime);          // cornisa
      statics.push({ g: quadGeo(THREE, [[cx - 23, 7.9, cz - 9.5], [cx + 23, 7.9, cz - 9.5], [cx + 23, 11.0, cz], [cx - 23, 11.0, cz]]), m: null, c: cRoofT });
      statics.push({ g: quadGeo(THREE, [[cx - 23, 11.0, cz], [cx + 23, 11.0, cz], [cx + 23, 7.9, cz + 9.5], [cx - 23, 7.9, cz + 9.5]]), m: null, c: cRoofT });
      [-1, 1].forEach(function (sx) {
        statics.push({ g: polyGeo(THREE, [[cx + sx * 23, 7.9, cz - 9.5], [cx + sx * 23, 7.9, cz + 9.5], [cx + sx * 23, 11.0, cz]], [sx, 0, 0], null), m: null, c: cLime });
      });
    }
    // Muro bajo del Altis (con puertas al este y al oeste)
    addBox(2 * ALT.halfX + 2.2, 1.4, 2.2, 0, 0.7, -ALT.halfZ, cLime2);
    addBox(2 * ALT.halfX + 2.2, 1.4, 2.2, 0, 0.7, ALT.halfZ, cLime2);
    addBox(2.2, 1.4, 90, ALT.halfX, 0.7, -55, cLime2); addBox(2.2, 1.4, 90, ALT.halfX, 0.7, 55, cLime2);
    addBox(2.2, 1.4, 88, -ALT.halfX, 0.7, -56, cLime2); addBox(2.2, 1.4, 88, -ALT.halfX, 0.7, 56, cLime2);
    // Tesoros: seis casitas dóricas en el lado norte del Altis
    for (let k = 0; k < 6; k++) {
      const tx = -30 + k * 22, tz = -70, c = (k % 2) ? cMarb : cLime;
      addBox(9.6, 0.8, 6.4, tx, 0.4, tz, cLime2);
      for (let q = 0; q < 4; q++) {
        statics.push({ g: new THREE.CylinderGeometry(0.36, 0.42, 3.6, 12).translate(0, 1.8, 0), m: new THREE.Matrix4().makeTranslation(tx - 3.6 + q * 2.4, 0.8, tz + 2.6), c: c });
        statics.push({ g: new THREE.BoxGeometry(0.9, 0.3, 0.9), m: new THREE.Matrix4().makeTranslation(tx - 3.6 + q * 2.4, 4.25, tz + 2.6), c: c });
      }
      addBox(9.6, 0.5, 5.6, tx, 4.5, tz + 0.4, c);
      addBox(8, 3.4, 5.4, tx, 2.5, tz - 0.2, c);
      statics.push({ g: quadGeo(THREE, [[tx - 5, 4.8, tz - 3.6], [tx + 5, 4.8, tz - 3.6], [tx + 5, 6.4, tz - 0.2], [tx - 5, 6.4, tz - 0.2]]), m: null, c: cRoofS });
      statics.push({ g: quadGeo(THREE, [[tx - 5, 6.4, tz - 0.2], [tx + 5, 6.4, tz - 0.2], [tx + 5, 4.8, tz + 3.2], [tx - 5, 4.8, tz + 3.2]]), m: null, c: cRoofT });
    }
    // Altar de Zeus (ceniza de los sacrificios) y altar de Hera
    addBox(16, 1.2, 8, 60, 0.6, 0, cStone);
    statics.push({ g: new THREE.SphereGeometry(4.6, 16, 10).scale(1, 0.32, 1), m: new THREE.Matrix4().makeTranslation(60, 1.2, 0), c: cAsh });
    addBox(5, 1.0, 3, -40, 0.5, -90, cStone);
    // Palestra: patio porticado de 52 m con veinte columnas, cubierta en anillo
    {
      const P = 26;
      addBox(2 * P + 3, 0.6, 6, PALX, 0.3, PALZ - P + 3, cLime2);
      addBox(2 * P + 3, 0.6, 6, PALX, 0.3, PALZ + P - 3, cLime2);
      addBox(6, 0.6, 2 * P - 6, PALX - P + 3, 0.3, PALZ, cLime2);
      addBox(6, 0.6, 2 * P - 6, PALX + P - 3, 0.3, PALZ, cLime2);
      const colsP = [];
      for (let k = 0; k < 6; k++) { const x = PALX - 24.5 + k * 9.8; colsP.push([x, PALZ - 24.5]); colsP.push([x, PALZ + 24.5]); }
      for (let j = 1; j <= 4; j++) { const z = PALZ - 24.5 + j * 9.8; colsP.push([PALX - 24.5, z]); colsP.push([PALX + 24.5, z]); }
      colsP.forEach(function (p) {
        statics.push({ g: new THREE.CylinderGeometry(0.45, 0.5, 4.2, 12).translate(0, 2.1, 0), m: new THREE.Matrix4().makeTranslation(p[0], 0.6, p[1]), c: cLime });
      });
      addBox(2 * P + 2, 0.5, 6, PALX, 5.0, PALZ - P + 3, cLime2);
      addBox(2 * P + 2, 0.5, 6, PALX, 5.0, PALZ + P - 3, cLime2);
      addBox(6, 0.5, 2 * P - 6, PALX - P + 3, 5.0, PALZ, cLime2);
      addBox(6, 0.5, 2 * P - 6, PALX + P - 3, 5.0, PALZ, cLime2);
    }
    const staticGeo = mergeGeos(THREE, statics.map(function (it) {
      return { g: it.g, m: it.m, c: it.c };
    }));
    const staticMesh = new THREE.Mesh(staticGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, side: THREE.DoubleSide }));
    staticMesh.castShadow = true; staticMesh.receiveShadow = true; staticMesh.frustumCulled = false;
    root.add(staticMesh);

    // pasarelas de madera y turistas (aparecen con la excavación)
    const boardMats = [], boardGeo = new THREE.BoxGeometry(1.7, 0.14, 1.6);
    for (let k = 0; k < 11; k++) boardMats.push(new THREE.Matrix4().compose(new THREE.Vector3(36 + k * 2, 0.22, 0), _I, new THREE.Vector3(1, 1, 1)));
    for (let k = 0; k < 20; k++) {
      const x = -40 + k * 4.0;
      boardMats.push(new THREE.Matrix4().compose(new THREE.Vector3(x, 0.22, -20), _I, new THREE.Vector3(1, 1, 1)));
      boardMats.push(new THREE.Matrix4().compose(new THREE.Vector3(x, 0.22, 20), _I, new THREE.Vector3(1, 1, 1)));
    }
    for (let k = 0; k < 18; k++) {
      const z = -18 + k * 2.0;
      const yaw = Math.PI / 2;
      boardMats.push(new THREE.Matrix4().compose(new THREE.Vector3(-45, 0.22, z), new THREE.Quaternion().setFromAxisAngle(UP, yaw), new THREE.Vector3(1, 1, 1)));
      boardMats.push(new THREE.Matrix4().compose(new THREE.Vector3(45, 0.22, z), new THREE.Quaternion().setFromAxisAngle(UP, yaw), new THREE.Vector3(1, 1, 1)));
    }
    const boardInst = new THREE.InstancedMesh(boardGeo, new THREE.MeshStandardMaterial({ color: 0x8a6a44, roughness: 0.9 }), boardMats.length);
    boardInst.frustumCulled = false; boardInst.castShadow = true; boardInst.receiveShadow = true;
    root.add(boardInst);
    const touristMats = [], touristCols = [];
    const tc = [new THREE.Color('#e8e2d6'), new THREE.Color('#2a4d8f'), new THREE.Color('#c2a46e'), new THREE.Color('#a8322a'), new THREE.Color('#f0eee8')];
    for (let k = 0; k < 9; k++) {
      const x = -20 + k * 6, z = (k % 2 ? 22 : -22) + (k % 3) * 0.5;
      touristMats.push(new THREE.Matrix4().compose(new THREE.Vector3(x, 0.22, z), _I, new THREE.Vector3(1.9, 1.9, 1.9)));
      touristCols.push(tc[k % tc.length]);
    }
    const touristInst = new THREE.InstancedMesh(figureGeo(THREE), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 }), touristMats.length);
    touristMats.forEach(function (m, i) { touristInst.setColorAt(i, touristCols[i]); });
    touristInst.instanceColor.needsUpdate = true;
    touristInst.frustumCulled = false;
    root.add(touristInst);
    let todayOn = null;
    function setDisplay(inst, mats, on) {
      for (let i = 0; i < mats.length; i++) inst.setMatrixAt(i, on ? mats[i] : ZERO_M);
      inst.instanceMatrix.needsUpdate = true;
    }
    function setRegrow(on) {
      for (let i = 0; i < regrowT.length; i++) {
        const k = oliveBase + i;
        if (on) { oliveTrunk.setMatrixAt(k, oliveMatsT[k]); oliveCanopy.setMatrixAt(k, oliveMatsC[k]); }
        else { oliveTrunk.setMatrixAt(k, ZERO_M); oliveCanopy.setMatrixAt(k, ZERO_M); }
      }
      oliveTrunk.instanceMatrix.needsUpdate = true; oliveCanopy.instanceMatrix.needsUpdate = true;
    }
    // al inicio, todo lo de hoy oculto
    setRegrow(false);
    setDisplay(boardInst, boardMats, false);
    setDisplay(touristInst, touristMats, false);

    // polvo del terremoto y de la ruina (puntos que suben alrededor del templo)
    const DUSTN = 260;
    const dustPos = new Float32Array(DUSTN * 3), dustA = new Float32Array(DUSTN), dustBase = new Float32Array(DUSTN * 3);
    const dr = makeRng(3131);
    for (let k = 0; k < DUSTN; k++) {
      const a = dr() * TAU, rr = 10 + 50 * dr();
      dustBase[k * 3] = Math.cos(a) * rr; dustBase[k * 3 + 1] = 0; dustBase[k * 3 + 2] = Math.sin(a) * rr * 0.6;
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
    dustGeo.setAttribute('aA', new THREE.BufferAttribute(dustA, 1));
    const dustMat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color('#cdb88e') }, uPx: { value: 900 } },
      vertexShader: POINT_VS, fragmentShader: POINT_FS, transparent: true, depthWrite: false
    });
    const dust = new THREE.Points(dustGeo, dustMat);
    dust.frustumCulled = false; dust.visible = false;
    root.add(dust);

    // ---------- TEMPLO DE ZEUS (exterior) ----------
    const templeGroup = new THREE.Group();
    root.add(templeGroup);

    function cvs(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
    function canvasTex(cv, srgb) {
      const t = new THREE.CanvasTexture(cv);
      if (srgb) t.encoding = THREE.sRGBEncoding;
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = 8;
      return t;
    }
    // entorno PMREM: cielo degradado (para mármol pulido y oro)
    function skyEnv() {
      try {
        const sc2 = new THREE.Scene();
        const skyM = new THREE.ShaderMaterial({
          side: THREE.BackSide, depthWrite: false,
          vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
          fragmentShader: 'varying vec3 vP; void main(){ float h = vP.y; vec3 top = vec3(0.30,0.50,0.76); vec3 hor = vec3(0.95,0.88,0.72); vec3 gnd = vec3(0.22,0.19,0.13); vec3 c = h > 0.0 ? mix(hor, top, smoothstep(0.0, 0.6, h)) : mix(hor, gnd, smoothstep(0.0, -0.3, h)); float sun = pow(max(dot(normalize(vP), normalize(vec3(0.4,0.5,-0.6))), 0.0), 60.0); c += vec3(1.0,0.85,0.5) * sun * 2.0; gl_FragColor = vec4(c, 1.0); }'
        });
        sc2.add(new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), skyM));
        const pm = new THREE.PMREMGenerator(renderer);
        return pm.fromScene(sc2, 0.04).texture;
      } catch (e) { return null; }
    }
    const env = skyEnv();
    // texturas dibujadas por código
    function sillarCanvases() {
      const N = 512, c = cvs(N, N), b = cvs(N, N);
      const g = c.getContext('2d'), h = b.getContext('2d'), r = makeRng(77);
      g.fillStyle = '#8f8472'; g.fillRect(0, 0, N, N);
      h.fillStyle = '#1e1e1e'; h.fillRect(0, 0, N, N);
      const rows = 2, cols = 2, rh = N / rows, cw = N / cols, J = 5;
      for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
        const x = col * cw, y = row * rh, tone = 0.93 + 0.1 * r(), warm = 0.98 + 0.03 * r();
        g.fillStyle = 'rgb(' + Math.round(239 * tone) + ',' + Math.round(230 * tone * warm) + ',' + Math.round(214 * tone) + ')';
        g.fillRect(x + J, y + J, cw - 2 * J, rh - 2 * J);
        for (let m = 0; m < 4; m++) {
          const mx = x + r() * cw, my = y + r() * rh, mr = 30 + r() * 60;
          const gr = g.createRadialGradient(mx, my, 0, mx, my, mr);
          gr.addColorStop(0, 'rgba(170,150,120,0.10)'); gr.addColorStop(1, 'rgba(170,150,120,0)');
          g.fillStyle = gr; g.fillRect(x + J, y + J, cw - 2 * J, rh - 2 * J);
        }
        h.fillStyle = '#b8b8b8'; h.fillRect(x + J, y + J, cw - 2 * J, rh - 2 * J);
        h.fillStyle = 'rgba(255,255,255,0.35)'; h.fillRect(x + J, y + J, cw - 2 * J, 3); h.fillRect(x + J, y + J, 3, rh - 2 * J);
        h.fillStyle = 'rgba(0,0,0,0.35)'; h.fillRect(x + J, y + rh - J - 3, cw - 2 * J, 3); h.fillRect(x + cw - J - 3, y + J, 3, rh - 2 * J);
        for (let v = 0; v < 4; v++) {
          g.strokeStyle = 'rgba(' + Math.round(120 + 40 * r()) + ',105,88,' + (0.10 + 0.12 * r()).toFixed(2) + ')';
          g.lineWidth = 0.6 + r() * 1.6;
          const x0 = x + r() * cw, y0 = y + r() * rh;
          g.beginPath(); g.moveTo(x0, y0);
          g.bezierCurveTo(x0 + 20 + r() * 30, y0 - 10 + r() * 20, x0 + 40 + r() * 40, y0 + 10, x0 + 70 + r() * 60, y0 - 5 + r() * 30);
          g.stroke();
        }
      }
      return { map: c, bump: b };
    }
    function smoothMarble() {
      const N = 512, c = cvs(N, N), b = cvs(N, N);
      const g = c.getContext('2d'), h = b.getContext('2d'), r = makeRng(91);
      g.fillStyle = '#efe6d6'; g.fillRect(0, 0, N, N);
      h.fillStyle = '#808080'; h.fillRect(0, 0, N, N);
      for (let i = 0; i < 26; i++) {
        const x0 = r() * N, y0 = r() * N;
        g.strokeStyle = 'rgba(' + Math.round(140 + 40 * r()) + ',120,96,' + (0.08 + 0.14 * r()).toFixed(2) + ')';
        g.lineWidth = 0.8 + r() * 2.4;
        g.beginPath(); g.moveTo(x0, y0);
        g.bezierCurveTo(x0 + 60 * r(), y0 + 40 * (r() - 0.5), x0 + 140 * r(), y0 + 80 * (r() - 0.5), x0 + 200 * (r() - 0.5), y0 + 160 * (r() - 0.5));
        g.stroke();
      }
      for (let i = 0; i < 900; i++) { g.fillStyle = 'rgba(150,130,100,' + (0.03 + 0.06 * r()).toFixed(3) + ')'; g.fillRect(r() * N, r() * N, 1 + r() * 3, 1 + r() * 3); }
      for (let i = 0; i < 500; i++) { const v = Math.round(110 + 50 * r()); h.fillStyle = 'rgb(' + v + ',' + v + ',' + v + ')'; h.fillRect(r() * N, r() * N, 2 + r() * 3, 2 + r() * 3); }
      return { map: c, bump: b };
    }
    function tileCanvases() {
      const N = 256, c = cvs(N, N), b = cvs(N, N), r = makeRng(808);
      const g = c.getContext('2d'), h = b.getContext('2d');
      g.fillStyle = '#e4dac6'; g.fillRect(0, 0, N, N);
      h.fillStyle = '#303030'; h.fillRect(0, 0, N, N);
      const rowH = N / 4, colW = N / 4;
      for (let row = 0; row < 4; row++) for (let col = -1; col < 4; col++) {
        const x = col * colW + (row % 2) * colW / 2, y = row * rowH;
        const tone = 0.9 + 0.1 * r();
        g.beginPath(); g.arc(x, y + rowH, colW * 0.55, Math.PI, 0); g.closePath();
        g.fillStyle = 'rgb(' + Math.round(228 * tone) + ',' + Math.round(218 * tone) + ',' + Math.round(196 * tone) + ')';
        g.fill(); g.strokeStyle = 'rgba(90,70,50,0.5)'; g.lineWidth = 2; g.stroke();
        h.beginPath(); h.arc(x, y + rowH, colW * 0.55, Math.PI, 0); h.closePath();
        h.fillStyle = '#c4c4c4'; h.fill(); h.strokeStyle = '#202020'; h.lineWidth = 2; h.stroke();
      }
      return { map: c, bump: b };
    }
    function coffersCanvas() {
      const N = 256, c = cvs(N, N), g = c.getContext('2d');
      g.fillStyle = '#eee4cc'; g.fillRect(0, 0, N, N);
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
        g.fillStyle = 'rgba(160,140,105,0.35)'; g.fillRect(i * 64 + 6, j * 64 + 6, 52, 52);
        g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(i * 64 + 6, j * 64 + 6, 52, 3);
      }
      return c;
    }
    function groundTexture() {
      const N = 256, c = cvs(N, N), g = c.getContext('2d'), img = g.createImageData(N, N), d = img.data, r = makeRng(55);
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const i = (y * N + x) * 4;
        const grain = r();
        const blot = 0.5 + 0.5 * Math.sin(TAU * (2 * x + 3 * y) / N + 1.7 * Math.sin(TAU * (3 * y - x) / N));
        const val = 228 + 26 * (grain - 0.5) + 14 * (blot - 0.5);
        d[i] = val * 0.9; d[i + 1] = val; d[i + 2] = val * 0.82; d[i + 3] = 255;
      }
      g.putImageData(img, 0, 0);
      const t = new THREE.CanvasTexture(c);
      t.wrapS = t.wrapT = THREE.RepeatWrapping; t.encoding = THREE.sRGBEncoding;
      return t;
    }

    const SIL = sillarCanvases(), SMO = smoothMarble(), TIL = tileCanvases();
    const sillarMat = new THREE.MeshStandardMaterial({ map: canvasTex(SIL.map, true), bumpMap: canvasTex(SIL.bump, false), bumpScale: 0.4, roughness: 0.33, envMap: env, envMapIntensity: 0.6 });
    const colMat = new THREE.MeshStandardMaterial({ map: canvasTex(SMO.map, true), bumpMap: canvasTex(SMO.bump, false), bumpScale: 0.05, roughness: 0.3, envMap: env, envMapIntensity: 0.7 });
    const stuccoMat = new THREE.MeshStandardMaterial({ color: 0xeee3cc, roughness: 0.85 });
    const roofMat = new THREE.MeshStandardMaterial({ map: canvasTex(TIL.map, true), bumpMap: canvasTex(TIL.bump, false), bumpScale: 2.5, roughness: 0.7, side: THREE.DoubleSide, transparent: true, opacity: 1 });
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xd4a63c, metalness: 0.7, roughness: 0.3, envMap: env, envMapIntensity: 0.9 });
    const ceilMat = new THREE.MeshStandardMaterial({ map: canvasTex(coffersCanvas(), true), roughness: 0.85, side: THREE.DoubleSide, transparent: true, opacity: 1 });
    // muro sur de la cella: copias translúcidas (comparten texturas)
    const sillarS = sillarMat.clone(), stuccoS = stuccoMat.clone();
    sillarS.transparent = true; stuccoS.transparent = true;
    const cutMats = [roofMat, ceilMat, sillarS, stuccoS];

    // 1. plataforma: tres gradas (la última es el estilóbato, y=1.5), cada una un bloque
    const steps = [];
    for (let i = 0; i < 3; i++) {
      const top = (i + 1) * TP.stylobateY / 3;
      const hx = HX + 1.5 * (2 - i), hz = HZ + 1.5 * (2 - i);
      const mesh = new THREE.Mesh(tiledBox(THREE, 2 * hx, top, 2 * hz, 4), sillarMat);
      mesh.position.set(0, top / 2, 0);
      mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false;
      templeGroup.add(mesh);
      steps.push(mesh);
    }

    // 2. columnas: 34 del peristilo + 2 in antis del pronaos; basa, tres tambores estriados, capitel dórico
    const COLPOS = [];
    for (let i = 0; i < 13; i++) { const x = -CXI + i * 2 * CXI / 12; COLPOS.push([x, -CZI]); COLPOS.push([x, CZI]); }
    for (let j = 1; j <= 4; j++) { const z = -CZI + j * 2 * CZI / 5; COLPOS.push([-CXI, z]); COLPOS.push([CXI, z]); }
    COLPOS.push([25.5, -3.6, 'noFall']); COLPOS.push([25.5, 3.6, 'noFall']);
    const NC = COLPOS.length;                    // 36
    const SE_IDX = COLPOS.findIndex(function (c) { return Math.abs(c[0] - CXI) < 1e-6 && Math.abs(c[1] - CZI) < 1e-6; });
    const baseGeo = new THREE.CylinderGeometry(0.98, 1.12, 0.5, 18, 1, false).translate(0, 0.25, 0);
    const drumGeo = fluted(new THREE.CylinderGeometry(0.9, 1.0, 3.0, 22, 1, true).translate(0, 1.5, 0), 24, 0.07);
    const capGeo = mergeGeos(THREE, [
      { g: new THREE.CylinderGeometry(0.92, 1.3, 0.56, 16, 1, false).translate(0, 0.28, 0) },
      { g: new THREE.BoxGeometry(2.6, 0.34, 2.6).translate(0, 0.73, 0) }
    ]);
    const colD = COLPOS.map(function (c, i) {
      const len = Math.hypot(c[0], c[1]) || 1;
      const dx = c[0] / len, dz = c[1] / len, yaw = Math.atan2(-c[1], c[0]);
      return { x: c[0], z: c[1], dx: dx, dz: dz, qy: new THREE.Quaternion().setFromAxisAngle(UP, yaw), st: 0,
        fT: 0.05 + 0.45 * rnd(), broken: rnd() < 0.3, noFall: c[2] === 'noFall' };
    });
    colD.map(function (_, i) { return i; }).sort(function (a, b) { return COLPOS[a][0] - COLPOS[b][0]; })
      .forEach(function (idx, rank) { colD[idx].st = rank / NC * 0.3; });
    const colInstMat = colMat.clone(); colInstMat.side = THREE.DoubleSide;
    const baseInst = new THREE.InstancedMesh(baseGeo, colInstMat, NC + 1);
    const drumInst = new THREE.InstancedMesh(drumGeo, colInstMat, NC * 3 + 3 + 40);
    const capInst = new THREE.InstancedMesh(capGeo, colInstMat, NC + 1);
    [baseInst, drumInst, capInst].forEach(function (m) {
      m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false;
      templeGroup.add(m);
    });
    const RS = [0, 1.0, 4.5, 8.0, 11.6];         // posición radial de cada pieza al caer
    const PO = [0, 0.5, 3.5, 6.5, 9.5];          // altura de cada pieza en pie
    const MIN_S = 0.002;
    const _p = new THREE.Vector3(), _s = new THREE.Vector3(), _m = new THREE.Matrix4();
    function put(inst, i, px, py, pz, q, sx, sy, sz) {
      if (!(sx > MIN_S && sy > MIN_S && sz > MIN_S)) { inst.setMatrixAt(i, ZERO_M); return; }
      _p.set(px, py, pz); _s.set(sx, sy, sz);
      _m.compose(_p, q || _I, _s);
      inst.setMatrixAt(i, _m);
    }
    function hide(inst, i) { inst.setMatrixAt(i, ZERO_M); }
    const _T = new THREE.Vector3(), _R = new THREE.Quaternion(), _QL = new THREE.Quaternion(), _QP = new THREE.Quaternion();
    const _up = new THREE.Vector3(), _lp = new THREE.Vector3();
    function writeColumns(c, rr, hideSE) {
      for (let i = 0; i < NC; i++) {
        const K0 = colD[i];
        const eCol = K0.noFall ? 0 : smooth(clamp01((rr - K0.fT) / 0.45));  // cae hacia fuera girando sobre la basa
        const bb = K0.noFall ? 0 : smooth(clamp01((rr - K0.fT - 0.3) / 0.4)); // se rompe en tambores al tocar el suelo
        _T.set(K0.dz, 0, -K0.dx);
        _R.setFromAxisAngle(_T, Math.PI / 2);
        _QL.copy(_R).multiply(K0.qy);
        const gone = (i === SE_IDX) && hideSE;
        for (let m = 0; m < 5; m++) {
          const u = clamp01((c - (K0.st + m * 0.1)) / 0.28);
          const e = (K0.broken && m < 2) ? 0 : eCol;
          const dy = (1 - smooth(u)) * 7;
          const show = u > 0 && !gone;
          const sp = bb * e * (m - 2) * 0.7;
          const lx = K0.x + K0.dx * (RS[m] + sp), lz = K0.z + K0.dz * (RS[m] + sp);
          const land = (Math.abs(lx) < HX && Math.abs(lz) < HZ) ? SY : 0;   // sobre el estilóbato o sobre el suelo
          _up.set(K0.x, SY + PO[m] + dy, K0.z);
          _lp.set(lx, land + 1.05, lz);
          _up.lerp(_lp, e);
          _QP.copy(K0.qy).slerp(_QL, e);
          if (m === 0) { if (show) put(baseInst, i, _up.x, _up.y, _up.z, _QP, 1, 1, 1); else hide(baseInst, i); }
          else if (m === 4) { if (show) put(capInst, i, _up.x, _up.y, _up.z, _QP, 1, 1, 1); else hide(capInst, i); }
          else { const di = i * 3 + (m - 1); if (show) put(drumInst, di, _up.x, _up.y, _up.z, _QP, 1, 1, 1); else hide(drumInst, di); }
        }
      }
      // columna re-erigida en la esquina SE (instancia NC): aparece cuando se excava
      for (let m = 0; m < 5; m++) {
        const q = _I;
        const y = SY + PO[m];
        if (hideSE) {
          if (m === 0) put(baseInst, NC, CXI, y, CZI, q, 1, 1, 1);
          else if (m === 4) put(capInst, NC, CXI, y, CZI, q, 1, 1, 1);
          else put(drumInst, NC * 3 + (m - 1), CXI, y, CZI, q, 1, 1, 1);
        } else {
          if (m === 0) hide(baseInst, NC); else if (m === 4) hide(capInst, NC); else hide(drumInst, NC * 3 + (m - 1));
        }
      }
      baseInst.instanceMatrix.needsUpdate = true; drumInst.instanceMatrix.needsUpdate = true; capInst.instanceMatrix.needsUpdate = true;
    }

    // 3. entablamento: un bloque sobre cada vano (34 vanos), con triglifos sobre cada columna
    const SPANS = [];
    function addSpan(ax, az, bx, bz) {
      const dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz), yaw = Math.atan2(-dz, dx);
      const cx = (ax + bx) / 2, cz = (az + bz) / 2;
      const lzx = -dz / L, lzz = dx / L;                       // eje local Z (perpendicular)
      const outS = (cx * lzx + cz * lzz) >= 0 ? 1 : -1;
      SPANS.push({ x: cx, z: cz, Ls: L, L: L + 1.9, qy: new THREE.Quaternion().setFromAxisAngle(UP, yaw),
        S: clamp01((cx + 40) / 80) * 0.8, TB: 0.02, out: outS });
    }
    for (let i = 0; i < 12; i++) {
      const xa = -CXI + i * 2 * CXI / 12, xb = -CXI + (i + 1) * 2 * CXI / 12;
      addSpan(xa, -CZI, xb, -CZI); addSpan(xa, CZI, xb, CZI);
    }
    for (let j = 0; j < 5; j++) {
      const za = -CZI + j * 2 * CZI / 5, zb = -CZI + (j + 1) * 2 * CZI / 5;
      addSpan(-CXI, za, -CXI, zb); addSpan(CXI, za, CXI, zb);
    }
    SPANS.forEach(function (B) { B.TB = 0.02 + 0.45 * B.S; });
    const NB = SPANS.length;                     // 34
    const ENT_Y = (ENT0 + EAVE) / 2;             // centro del entablamento (13.55)
    const ENT_H = EAVE - ENT0;                   // 3.3
    const entInst = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), sillarMat, NB);
    const trigInst = new THREE.InstancedMesh(new THREE.BoxGeometry(0.62, 1.9, 0.22), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 }), NB * 2);
    entInst.castShadow = true; entInst.receiveShadow = true; entInst.frustumCulled = false;
    trigInst.castShadow = true; trigInst.receiveShadow = true; trigInst.frustumCulled = false;
    templeGroup.add(entInst); templeGroup.add(trigInst);
    const trigCol = new THREE.Color('#33465f');
    for (let k = 0; k < NB * 2; k++) trigInst.setColorAt(k, trigCol);
    trigInst.instanceColor.needsUpdate = true;
    const _bq = new THREE.Quaternion(), _roll = new THREE.Quaternion(), _o = new THREE.Vector3(), _w = new THREE.Vector3();
    function writeEnt(ar, rr) {
      for (let j = 0; j < NB; j++) {
        const B = SPANS[j];
        const u = clamp01((ar - B.S) / 0.18);
        if (u <= 0) { hide(entInst, j); hide(trigInst, 2 * j); hide(trigInst, 2 * j + 1); continue; }
        const dy = (1 - smooth(u)) * 2.5;
        const e = smooth(clamp01((rr - B.TB) / 0.25));
        _roll.setFromAxisAngle(AX, e * 1.1);
        _bq.copy(B.qy).multiply(_roll);
        const yc = ENT_Y + dy - e * (ENT_Y - 1.0);
        put(entInst, j, B.x, yc, B.z, _bq, B.L, ENT_H, 1.9);
        for (let k = 0; k < 2; k++) {
          _o.set((k === 0 ? -1 : 1) * B.Ls / 2, 13.4 - ENT_Y, B.out * 1.07).applyQuaternion(_bq);
          _w.set(B.x + _o.x, yc + _o.y, B.z + _o.z);
          put(trigInst, 2 * j + k, _w.x, _w.y, _w.z, _bq, 1, 1, 1);
        }
      }
      entInst.instanceMatrix.needsUpdate = true; trigInst.instanceMatrix.needsUpdate = true;
    }

    // 4. cella: muros exteriores con su cara interior estucada; muros N y S siguen hasta el tejado.
    //    Cada muro cuelga de su base exterior (pivote) para poder caer hacia fuera en la ruina.
    const xNc = (CX0 - 0.5 + 26.0) / 2, xNlen = 26.0 - (CX0 - 0.5);
    const zOut = CHZ + 0.75;                    // cara exterior de los muros N y S (z = ±8.95)
    const HNS = roofY(zOut) - SY;               // altura de los muros N y S hasta el tejado
    const HEW = WALLTOP - SY;                   // altura de los muros E y W (13.6)
    const wallN = new THREE.Group(), wallS = new THREE.Group(), wallW = new THREE.Group(), wallE = new THREE.Group();
    wallN.position.set(xNc, SY, -zOut); wallS.position.set(xNc, SY, zOut);
    wallW.position.set(CX0 - 0.75, SY, 0); wallE.position.set(CX1 + 0.75, SY, 0);
    [wallN, wallS, wallW, wallE].forEach(function (g) { templeGroup.add(g); });
    const plain = sillarMat;
    const mkWallN = new THREE.Mesh(new THREE.BoxGeometry(xNlen, HNS, 1.5), [plain, plain, plain, plain, stuccoMat, plain]);
    mkWallN.position.set(0, HNS / 2, 0.75); wallN.add(mkWallN);
    const mkWallS = new THREE.Mesh(new THREE.BoxGeometry(xNlen, HNS, 1.5), [plain, plain, plain, plain, plain, stuccoS]);
    mkWallS.position.set(0, HNS / 2, -0.75); wallS.add(mkWallS);
    const mkWallW = new THREE.Mesh(new THREE.BoxGeometry(1.5, HEW, 2 * CHZ), [stuccoMat, plain, plain, plain, plain, plain]);
    mkWallW.position.set(0.75, HEW / 2, 0); wallW.add(mkWallW);
    // muro E con la puerta (y 1.5..11.6, z ±2.6) y su dintel
    const eGeo = mergeGeos(THREE, [
      { g: new THREE.BoxGeometry(1.5, HEW, CHZ - 2.6), m: new THREE.Matrix4().makeTranslation(-0.75, HEW / 2, -(CHZ + 2.6) / 2) },
      { g: new THREE.BoxGeometry(1.5, HEW, CHZ - 2.6), m: new THREE.Matrix4().makeTranslation(-0.75, HEW / 2, (CHZ + 2.6) / 2) },
      { g: new THREE.BoxGeometry(1.5, WALLTOP - (SY + 10.1), 5.2), m: new THREE.Matrix4().makeTranslation(-0.75, (SY + 10.1 + WALLTOP) / 2 - SY, 0) }
    ]);
    const mkWallE = new THREE.Mesh(eGeo, sillarMat);
    mkWallE.castShadow = true; mkWallE.receiveShadow = true; wallE.add(mkWallE);
    [mkWallN, mkWallS, mkWallW, mkWallE].forEach(function (m) { m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; });

    // 5. tejado (pivote en la cumbrera), techo de la cella, frontones con figuras, acróteras
    const rfPivot = new THREE.Group(), rfG = new THREE.Group();
    rfPivot.position.set(0, RIDGE, 0); rfPivot.add(rfG); rfG.position.set(0, -RIDGE, 0);
    templeGroup.add(rfPivot);
    const roofParts = [];
    [1, -1].forEach(function (sg) {
      const n = [0, 1, sg * KSL];
      const nl = Math.hypot(n[0], n[1], n[2]); const nn = [n[0] / nl, n[1] / nl, n[2] / nl];
      const uvf = function (p) { return [p[0] / 4, (HZ - Math.abs(p[2])) / 4]; };
      roofParts.push({ g: polyGeo(THREE, [[-HX - 0.5, RIDGE, 0], [HX + 0.5, RIDGE, 0], [HX + 0.5, EAVE, sg * HZ], [-HX - 0.5, EAVE, sg * HZ]], nn, uvf) });
    });
    const roofMesh = new THREE.Mesh(mergeGeos(THREE, roofParts), roofMat);
    roofMesh.castShadow = false; roofMesh.receiveShadow = true; roofMesh.frustumCulled = false;   // el tejado no proyecta sombras
    rfG.add(roofMesh);
    const ceilMesh = new THREE.Mesh(new THREE.BoxGeometry(CX1 - CX0, 0.3, 2 * CHZ), ceilMat);
    ceilMesh.position.set((CX0 + CX1) / 2, CEIL_Y + 0.15, 0);
    ceilMesh.castShadow = false; ceilMesh.receiveShadow = true; ceilMesh.frustumCulled = false;
    rfG.add(ceilMesh);
    // hastiales de la cella (W y E): cierran el triángulo bajo el tejado
    const gableParts = [];
    [CX0, CX1].forEach(function (x) {
      const yI = roofY(CHZ);
      gableParts.push({ g: polyGeo(THREE, [[x, WALLTOP, -CHZ], [x, WALLTOP, CHZ], [x, yI, CHZ], [x, RIDGE, 0], [x, yI, -CHZ]], [x < 0 ? -1 : 1, 0, 0], function (p) { return [p[2] / 4, p[1] / 4]; }) });
    });
    const gableMesh = new THREE.Mesh(mergeGeos(THREE, gableParts), sillarMat);
    gableMesh.castShadow = true; gableMesh.receiveShadow = true; gableMesh.frustumCulled = false;
    rfG.add(gableMesh);
    // cornisa y fascia del entablamento (anillo exterior)
    const cornice = new THREE.Mesh(mergeGeos(THREE, boxRing(THREE, HX, HZ, EAVE - 1.0, 1.0, 1.0)), sillarMat);
    cornice.castShadow = true; cornice.receiveShadow = true; cornice.frustumCulled = false;
    rfG.add(cornice);
    // frontones: fondo de piedra en x = ±31 y bajo el tejado, con esculturas (figuras volumétricas)
    const pedParts = [];
    [1, -1].forEach(function (sx) {
      const x = sx * (HX - 1.0);
      pedParts.push({ g: polyGeo(THREE, [[x, EAVE, -HZ], [x, EAVE, HZ], [x, RIDGE - 0.35, 0]], [sx, 0, 0], function (p) { return [(p[2] + HZ) / (2 * HZ), (p[1] - EAVE) / (RIDGE - EAVE)]; }) });
    });
    const pedMesh = new THREE.Mesh(mergeGeos(THREE, pedParts), colMat);
    pedMesh.frustumCulled = false; pedMesh.castShadow = false;
    rfG.add(pedMesh);
    // cornisas rampantes y acróteras doradas
    const rakeParts = [], acroParts = [];
    const cone = function (x, y, z, r, h) { acroParts.push({ g: new THREE.ConeGeometry(r, h, 10), m: new THREE.Matrix4().makeTranslation(x, y, z) }); };
    [1, -1].forEach(function (sx) {
      cone(sx * (HX + 0.2), RIDGE + 0.9, 0, 0.55, 1.8);
      cone(sx * (HX + 0.2), EAVE + 0.8, HZ, 0.5, 1.6); cone(sx * (HX + 0.2), EAVE + 0.8, -HZ, 0.5, 1.6);
      [1, -1].forEach(function (sg) {
        const dir = new THREE.Vector3(0, RIDGE - EAVE, -sg * HZ).normalize();
        const L = Math.hypot(HZ, RIDGE - EAVE);
        const q = new THREE.Quaternion().setFromUnitVectors(ZA, dir);
        const mm = new THREE.Matrix4().compose(new THREE.Vector3(sx * (HX + 0.1), (EAVE + RIDGE) / 2 + 0.3, sg * HZ / 2), q, new THREE.Vector3(1, 1, 1));
        rakeParts.push({ g: tiledBox(THREE, 1.2, 0.9, L + 0.4, 4), m: mm });
      });
    });
    const rakeMesh = new THREE.Mesh(mergeGeos(THREE, rakeParts), colMat);
    const acroMesh = new THREE.Mesh(mergeGeos(THREE, acroParts), goldMat);
    rakeMesh.castShadow = true; acroMesh.castShadow = true; rakeMesh.frustumCulled = false; acroMesh.frustumCulled = false;
    rfG.add(rakeMesh); rfG.add(acroMesh);
    // figuras de los frontones: 7 por lado, altura según la pendiente del tímpano
    const figGeo = figureGeo(THREE);
    const FIG_Z = [0, 3.4, -3.4, 6.9, -6.9, 10.3, -10.3];
    const FIG_H = [4.2, 3.2, 3.2, 2.1, 2.1, 0.9, 0.9];
    const figInst = new THREE.InstancedMesh(figGeo, colMat, 14);
    figInst.castShadow = true; figInst.receiveShadow = true; figInst.frustumCulled = false;
    rfG.add(figInst);
    const figTone = [new THREE.Color('#efe6d6'), new THREE.Color('#e6dcc6'), new THREE.Color('#f4eee2')];
    const figs = [];
    [1, -1].forEach(function (sx) {
      FIG_Z.forEach(function (z, k) {
        figs.push({ x: sx * (CXI), z: z, H: FIG_H[k], yaw: sx > 0 ? -Math.PI / 2 : Math.PI / 2, lean: (k % 2 ? 0.06 : -0.05), col: figTone[k % 3] });
      });
    });
    figs.forEach(function (F, i) { figInst.setColorAt(i, F.col); });
    figInst.instanceColor.needsUpdate = true;
    const _fq = new THREE.Quaternion(), _fe = new THREE.Euler();

    // 6. ruina: cascotes de muro, de tejado y tambores sueltos
    const NRB = 60, RUB = [];
    for (let i = 0; i < NRB; i++) {
      const a = rnd() * Math.PI * 2, r = 14 + 50 * rnd();
      RUB.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, sx: 1.2 + 1.8 * rnd(), sy: 0.8 + 0.6 * rnd(), sz: 1 + 1.4 * rnd(),
        q: new THREE.Quaternion().setFromAxisAngle(UP, rnd() * Math.PI), thr: 0.05 + 0.6 * rnd(), thrD: 0.3 + 0.6 * rnd() });
    }
    const rubInst = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), sillarMat, NRB);
    rubInst.castShadow = true; rubInst.receiveShadow = true; rubInst.frustumCulled = false;
    templeGroup.add(rubInst);
    const RUBD = [];
    for (let j = 0; j < 40; j++) {
      const a = rnd() * Math.PI * 2, r = 16 + 46 * rnd();
      RUBD.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, q: new THREE.Quaternion().setFromAxisAngle(UP, rnd() * Math.PI), thr: 0.1 + 0.6 * rnd(), thrD: 0.3 + 0.6 * rnd() });
    }
    const _lq = new THREE.Quaternion().setFromAxisAngle(ZA, Math.PI / 2), _rq = new THREE.Quaternion();
    function writeRubble(rr) {
      for (let i = 0; i < NRB; i++) {
        const R0 = RUB[i];
        const loc = clamp01((rr - R0.thr) / 0.3);
        if (loc <= 0) { hide(rubInst, i); continue; }
        put(rubInst, i, R0.x, R0.sy * 0.5 + (1 - smooth(loc)) * 14, R0.z, R0.q, R0.sx, R0.sy, R0.sz);
      }
      rubInst.instanceMatrix.needsUpdate = true;
      for (let j = 0; j < 40; j++) {
        const D0 = RUBD[j], idx = NC * 3 + 3 + j;
        const loc = clamp01((rr - D0.thr) / 0.25);
        if (loc <= 0) { hide(drumInst, idx); continue; }
        _rq.copy(D0.q).multiply(_lq);
        put(drumInst, idx, D0.x, 0.9 + (1 - smooth(loc)) * 14, D0.z, _rq, 1, 1, 1);
      }
      drumInst.instanceMatrix.needsUpdate = true;
    }
    const RRN = 50, RRB = [];
    for (let i = 0; i < RRN; i++) {
      const a = rnd() * Math.PI * 2, r = 4 + 52 * rnd();
      RRB.push({ x: Math.cos(a) * r, z: Math.sin(a) * r * 0.6, sx: 1.5 + 2.5 * rnd(), sy: 0.35 + 0.5 * rnd(), sz: 1.5 + 2.5 * rnd(),
        q: new THREE.Quaternion().setFromAxisAngle(UP, rnd() * Math.PI), thr: 0.4 + 0.45 * rnd(), thrD: 0.3 + 0.6 * rnd() });
    }
    const roofRubInst = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), roofMat, RRN);
    roofRubInst.castShadow = true; roofRubInst.receiveShadow = true; roofRubInst.frustumCulled = false;
    templeGroup.add(roofRubInst);
    function writeRoofRub(rr) {
      for (let i = 0; i < RRN; i++) {
        const B0 = RRB[i];
        const loc = clamp01((rr - B0.thr) / 0.3);
        if (loc <= 0) { hide(roofRubInst, i); continue; }
        put(roofRubInst, i, B0.x, B0.sy * 0.5 + (1 - smooth(loc)) * 20, B0.z, B0.q, B0.sx, B0.sy, B0.sz);
      }
      roofRubInst.instanceMatrix.needsUpdate = true;
    }

    // ---------- actualización por fotograma (función pura del estado) ----------
    function writeTemple(temple, ar, cc, rr, rf, wall, today, quake) {
      // plataforma (crepidoma): cada grada sube desde bajo el suelo
      const pf = clamp01(temple / 0.25);
      for (let k = 0; k < 3; k++) {
        const u = clamp01((pf - 0.03 * k) / 0.6);
        steps[k].visible = pf > 0.0001;
        steps[k].position.y = ((k + 1) * SY / 3) / 2 - (1 - smooth(u)) * 3.4;
      }
      writeColumns(cc, rr, today > 0.5);
      writeEnt(ar, rr);
      // cella: los muros suben con el entablamento; en la ruina caen hacia fuera
      const gr = smooth(clamp01((ar - 0.1) / 0.7));
      const fall = smooth(clamp01((rr - 0.05) / 0.5));
      const cellaOn = gr > 0.001;
      [wallN, wallS, wallW, wallE].forEach(function (g) { g.visible = cellaOn; });
      wallN.rotation.x = -fall * 0.85; wallS.rotation.x = fall * 0.85;
      wallW.rotation.z = fall * 0.9; wallE.rotation.z = -fall * 0.9;
      const sy = Math.max(0.001, gr * (1 - 0.35 * fall));
      wallN.scale.set(1, sy, 1); wallS.scale.set(1, sy, 1);
      wallW.scale.set(1, sy, 1); wallE.scale.set(1, sy, 1);
      wallN.position.y = SY - fall * 0.5; wallS.position.y = SY - fall * 0.5;
      wallW.position.y = SY - fall * 0.5; wallE.position.y = SY - fall * 0.5;
      // tejado: sube con las grúas, se hunde y se inclina con la ruina
      const sr = smooth(clamp01(rr / 0.5));
      rfPivot.position.set(0, RIDGE + (1 - smooth(rf)) * 3 - sr * 6, 0);
      rfPivot.rotation.x = 0.3 * sr;
      rfPivot.visible = rf > 0.001 && rr < 0.6;
      // figuras de los frontones (base sobre el entablamento, a 15,2 m)
      for (let i = 0; i < figs.length; i++) {
        const F = figs[i];
        const sway = F.lean;
        _fe.set(0, F.yaw, sway);
        _fq.setFromEuler(_fe);
        put(figInst, i, F.x, EAVE + (1 - smooth(rf)) * 2, F.z, _fq, F.H, F.H, F.H);
      }
      figInst.instanceMatrix.needsUpdate = true;
      writeRubble(rr);
      writeRoofRub(rr);
    }

    // ---------- actualización del entorno ----------
    const quakeDustPos = dustPos, quakeDustA = dustA;
    function update(s) {
      // (el resto del estado se lee abajo)
      const tod = fract(s.timeOfDay || 0);
      const wall = s.wall || 0;
      const today = clamp01(s.today || 0);
      const quake = clamp01(s.quake || 0);
      const ruin = clamp01(s.ruin || 0);
      const silt = clamp01(s.silt || 0);
      const temple = clamp01(s.temple || 0);
      const cut = clamp01(s.cutaway || 0);
      // el sol nace por el este (+X), sube hacia el sur (+Z) y se pone por el oeste (-X)
      const a = (tod - 0.25) * TAU;
      sunDir.set(Math.cos(a), Math.sin(a) * EY, Math.sin(a) * EZ);
      moonDir.set(-sunDir.x, MOON_Y, -sunDir.z).normalize();
      tmpV.copy(sunDir).addScaledVector(moonDir, -sunDir.dot(moonDir)).normalize();
      moonCut.copy(moonDir).addScaledVector(tmpV, -0.012).normalize();
      sunT1.crossVectors(sunDir, upV).normalize();
      sunT2.crossVectors(sunDir, sunT1).normalize();

      const el = sunDir.y;
      const sunVis = sstep(0.0, 0.12, el);
      const moonVis = sstep(0.0, -0.12, el);
      const dayF = sstep(-0.05, 0.3, el);
      const dusk = sunVis * (1 - sstep(0.1, 0.5, el));
      keyAt(tod);

      const lightDir = el >= 0 ? sunDir : moonDir;
      sun.position.copy(lightDir).multiplyScalar(SHADOW_DIST);
      sun.color.copy(MOON_COL).lerp(tSun, sunVis);
      sun.intensity = kSunI * sunVis * 1.2 + 0.6 * moonVis;
      tHemG.copy(HEM_GROUND_NIGHT).lerp(HEM_GROUND_DAY, dayF);
      hemi.color.copy(tHem);
      hemi.groundColor.copy(tHemG);
      hemi.intensity = 0.45 + 0.55 * dayF;                  // hemisférica fuerte de día
      fill.position.set(-sunDir.x, 0.45, -sunDir.z).normalize().multiplyScalar(SHADOW_DIST);
      fill.color.copy(MOON_COL).lerp(tSun, 0.6 * dayF);
      fill.intensity = 0.2 + 0.6 * dayF;
      renderer.toneMappingExposure = 0.8 + 0.1 * dayF;

      sky.position.copy(camera.position);
      skyU.uZenith.value.copy(tZen);
      skyU.uHorizon.value.copy(tHor);
      skyU.uSunCol.value.copy(tSun);
      skyU.uSunVis.value = sunVis;
      skyU.uMoonVis.value = moonVis;
      skyU.uNight.value = moonVis;
      skyU.uDusk.value = dusk;
      skyU.uDay.value = dayF;
      skyU.uSunAng.value = 0.0047 * (1 + 2.5 * dusk);
      skyU.uTime.value = wall;

      // niebla: muy suave, sólo a partir de ~2 km
      tFog.copy(tHor).lerp(FOG_DAY, 0.25 * dayF * (1.0 - 0.5 * dusk));
      scene.fog.color.copy(tFog);
      scene.fog.density = 0.00002 * (1 + 0.5 * moonVis) * (1 - 0.5 * dusk);
      skyU.uBelow.value.copy(tFog);

      waterU.uTime.value = wall;
      waterU.uLightDir.value.copy(lightDir);
      waterU.uLightI.value = sun.intensity;
      waterU.uHorizon.value.copy(tHor);
      waterU.uZenith.value.copy(tZen);
      waterU.uDeep.value.copy(DEEP_NIGHT).lerp(DEEP_DAY, dayF);

      // limo: sube sobre el Altis y se retira con la excavación (fracción silt*(1-today))
      const siltE = silt * (1 - today);
      if (Math.abs(siltE - lastSilt) > 0.002) { lastSilt = siltE; applySilt(siltE); }

      // olivos del renacer y pasarelas/turistas: aparecen al final de la excavación
      const on = today > 0.92;
      if (on !== todayOn) {
        todayOn = on;
        setRegrow(on);
        setDisplay(boardInst, boardMats, on);
        setDisplay(touristInst, touristMats, on);
      }

      // templo: se sacude con el terremoto; sus fases dependen de s.temple
      templeGroup.visible = temple > 0.001;
      if (templeGroup.visible) {
        templeGroup.position.set(0.2 * quake * Math.sin(wall * 19.0), 0, 0.14 * quake * Math.cos(wall * 15.0));
        const pc = clamp01((temple - 0.25) / 0.25);     // columnas
        const pa = clamp01((temple - 0.5) / 0.25);      // entablamento y cella
        const pr = clamp01((temple - 0.75) / 0.25);     // tejado
        writeTemple(temple, pa, pc, ruin, pr, wall, today, quake);
      }

      // polvo: sube alrededor del templo mientras tiembla o cae
      const dustK = Math.max(quake, ruin * (1 - today) * 0.6);
      dust.visible = dustK > 0.01;
      if (dust.visible) {
        for (let k = 0; k < DUSTN; k++) {
          const ph = fract(wall * 0.35 + k / DUSTN);
          quakeDustPos[k * 3] = dustBase[k * 3] + Math.sin(wall + k) * 2;
          quakeDustPos[k * 3 + 1] = 1 + ph * 26;
          quakeDustPos[k * 3 + 2] = dustBase[k * 3 + 2] + Math.cos(wall * 0.8 + k) * 2;
          quakeDustA[k] = dustK * (1 - ph) * 0.8;
        }
        dustGeo.attributes.position.needsUpdate = true;
        dustGeo.attributes.aA.needsUpdate = true;
      }
      // cutaway: tejado, techo y muro sur translúcidos (opacidad ~0,15, sin escribir profundidad)
      const op = 1 - 0.85 * cut;
      cutMats.forEach(function (m) { m.opacity = op; m.depthWrite = cut < 0.5; });
      ceilMat.opacity = op;
    }

    return {
      update: update,
      sunDirection: sunDir,
      sunLight: sun,
      hemiLight: hemi,
      sky: sky
    };
  };
})();
