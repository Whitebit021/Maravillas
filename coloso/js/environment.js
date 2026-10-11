// Entorno del puerto de Rodas (~280 a.C.) para "El Coloso de Rodas: Lo que no te contaron".
// Cielo shader día/noche (amanecer rosado, mediodía azul mediterráneo, atardecer naranja, noche con
// estrellas y luna), sol con sombras ajustadas a la estatua, mar Egeo con olas por vértice y shader,
// costa irregular con colinas y acrópolis, espigones de Mandraki, ciudad hipodámica con templos,
// muralla este, horizonte de Asia Menor y, en "hoy", columnas con ciervos y faro moderno.
// Todo procedural (sin texturas ni modelos externos). Técnicas tomadas de giza/js/environment.js.
// THREE.ColorManagement.legacyMode=false: THREE.Color(hex) ya es lineal; los shaders propios trabajan
// en lineal y convierten a sRGB al final (toSRGB).
(function () {
  'use strict';
  const G = window.GIZA;
  const SITE = G.SITE;
  const TAU = Math.PI * 2;
  const SEA_Y = SITE.seaLevel;                       // -1.5
  const SEA_HALF = 6000;                             // el mar ocupa un cuadrado de 12 km
  const SUN_ELEV = 70 * Math.PI / 180;               // altura del sol al mediodía
  const EY = Math.sin(SUN_ELEV), EZ = Math.cos(SUN_ELEV);
  const MOON_Y = 0.32;                               // luna baja: sombras largas
  const SHADOW_DIST = 500;
  const SUN_TARGET = { x: 0, y: 12, z: 0 };          // centro de la estatua (sombras ±80 m)

  // ---------- utilidades ----------
  function clamp01(x) { return x < 0 ? 0 : (x > 1 ? 1 : x); }
  function fract(x) { return x - Math.floor(x); }
  // smoothstep que admite e0 > e1 (rampa invertida)
  function sstep(e0, e1, x) { const t = clamp01((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); }

  let rngState = 4242;
  function rnd() { rngState = (rngState * 16807) % 2147483647; return rngState / 2147483647; }

  // ruido de valor 2D, fbm y fbm "ridged" (crestas), resultados aprox. en 0..1
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
    for (let i = 0; i < oct; i++) {
      s += amp * vnoise(x * f, z * f, sd + i * 17);
      norm += amp; amp *= 0.5; f *= 2.03;
    }
    return s / norm;
  }
  function ridged(x, z, oct, sd) {
    let s = 0, amp = 0.5, f = 1, norm = 0;
    for (let i = 0; i < oct; i++) {
      const n = 1 - Math.abs(2 * vnoise(x * f, z * f, sd + i * 17) - 1);
      s += amp * n * n;
      norm += amp; amp *= 0.5; f *= 2.03;
    }
    return s / norm;
  }
  // puntos de un eje: paso grueso fuera de [fa,fb], fino dentro
  function segs(a, b, step) {
    const n = Math.max(1, Math.round((b - a) / step)); const o = [];
    for (let i = 0; i < n; i++) o.push(a + (b - a) * i / n);
    return o;
  }
  function axis(a, b, fa, fb, fine, coarse) {
    return segs(a, fa, coarse).concat(segs(fa, fb, fine), segs(fb, b, coarse), [b]);
  }

  // ---------- relieve del mundo (función pura de x,z) ----------
  const CZ = SITE.coastZ, EX = SITE.eastCoastX, ACR = SITE.acropolis, CITY = SITE.city, HELE = SITE.helepolis;
  // línea de costa norte irregular (±~15 m) y costa oriental (±10 m)
  function coastZ(x) { return CZ + 13 * (2 * vnoise(x / 110, 0.37, 41) - 1) + 6 * (2 * vnoise(x / 38, 1.9, 43) - 1); }
  function eastX(z) { return EX + 10 * (2 * vnoise(z / 120, 3.1, 47) - 1); }
  // acrópolis (SO) y una loma junto a la ciudad: meseta a ACR_TOP, laderas en terrazas
  const ACR_TOP = 92;
  const LOMA = { x: -140, z: 640, R0: 125, H: 58, sd: 79 };
  // altura de la isla (tierra): llanura plana alrededor del origen, colinas al sur, lomas al SO
  function landE(x, z) {
    const dO = Math.sqrt(x * x + z * z);
    const flat = sstep(62, 160, dO);
    const rise = 26 * sstep(150, 1400, z);
    const nz = 9 * fbm(x / 230, z / 230, 4, 3) - 3.5;
    const e = (rise + nz) * flat;
    return Math.max(e, hillH(x, z, ACR.x, ACR.z, 165, ACR_TOP, 71),
      hillH(x, z, LOMA.x, LOMA.z, LOMA.R0, LOMA.H, LOMA.sd));
  }
  // loma rocosa irregular: contorno con ruido, meseta plana, laderas en escalones y crestas de roca
  function hillH(x, z, cx, cz, R0, H, sd) {
    const dx = x - cx, dz = z - cz;
    const dd = Math.sqrt(dx * dx + dz * dz);
    if (dd > R0 * 1.6) return 0;
    const ang = Math.atan2(dz, dx);
    const n = vnoise(Math.cos(ang) * 1.3 + 4, Math.sin(ang) * 1.3 + 4, sd);
    const R = R0 * (0.8 + 0.5 * n);
    const p = 1 - sstep(0.3, 1.0, dd / R);
    let h = H * Math.pow(p, 0.8);
    const terr = Math.floor(h / 9) * 9;
    h += (terr - h) * 0.5 * (1 - sstep(0.85, 0.97, p)) * sstep(0.05, 0.2, p);
    const rough = (ridged(x / 45, z / 45, 3, sd + 5) - 0.3) * 16;
    h += rough * sstep(0.0, 0.08, p) * (1 - sstep(0.75, 0.95, p));
    return h;
  }
  // altura del terreno: tierra (z>costa, x<costa este), mar con fondo suave, bajío junto a la muralla
  function groundH(x, z) {
    const dIn = Math.min(z - coastZ(x), eastX(z) - x);   // > 0 tierra adentro
    const Lm = sstep(-10, 12, dIn);
    const off = -4 - 0.012 * Math.min(Math.max(-dIn, 0), 250);
    let h = off * (1 - Lm) + landE(x, z) * Lm;
    // (la torre de asedio ya cae en tierra: no hace falta bajío)
    // bordes del mundo: se hunden para que no quede un escalón visible en el horizonte
    const fe = Math.max(sstep(-3300, -3800, x), sstep(3300, 3900, z), sstep(-900, -1000, z));
    return h + (-8 - h) * fe;
  }
  function slopeAt(x, z) {
    const dx = (groundH(x + 3, z) - groundH(x - 3, z)) / 6;
    const dz = (groundH(x, z + 3) - groundH(x, z - 3)) / 6;
    return Math.sqrt(dx * dx + dz * dz);
  }
  function inlandAt(x, z) { return Math.min(z - coastZ(x), eastX(z) - x); }

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
    '  vec3 up = mix(uHorizon, uZenith, pow(clamp(h, 0.0, 1.0), 0.45));',
    '  vec3 sky = mix(uBelow, up, smoothstep(-0.02, 0.02, h));',
    // sol: disco (más grande al amanecer/atardecer) + halo
    '  float sd = dot(d, uSunDir);',
    '  float sdc = max(sd, 0.0);',
    '  float cr = cos(uSunAng);',
    '  float disc = smoothstep(cr - 0.00003, cr + 0.00001, sd);',
    '  float halo = pow(sdc, 900.0) * 0.9 + pow(sdc, 60.0) * 0.35 + pow(sdc, 6.0) * 0.12;',
    '  sky += uSunCol * (disc * 4.0 + halo) * uSunVis;',
    // rayos crepusculares
    '  float ang = atan(dot(d, uSunT2), dot(d, uSunT1));',
    '  float rays = pow(0.5 + 0.5 * sin(ang * 23.0 + vnoise3(vec3(ang * 4.0, 0.5, 0.0)) * 7.0), 5.0);',
    '  rays *= 0.6 + 0.4 * vnoise3(vec3(ang * 11.0, 3.0, 1.0));',
    '  float fall = exp(-(1.0 - sdc) * 9.0);',
    '  sky += uSunCol * rays * fall * uDusk * 0.4 * smoothstep(-0.1, 0.25, h);',
    // luna creciente
    '  float md = dot(d, uMoonDir);',
    '  float mdisc = smoothstep(0.99978, 0.99990, md) * (1.0 - smoothstep(0.99978, 0.99990, dot(d, uMoonCut)));',
    '  sky += vec3(0.8, 0.86, 1.0) * mdisc * uMoonVis * 1.2;',
    '  sky += vec3(0.3, 0.36, 0.6) * (pow(max(md, 0.0), 260.0) * 0.35 + pow(max(md, 0.0), 40.0) * 0.04) * uMoonVis;',
    // estrellas nítidas con parpadeo y colores
    '  vec3 g = d * 260.0; vec3 cell = floor(g); float hs = hash13(cell);',
    '  float star = step(0.9935, hs) * (1.0 - smoothstep(0.0, 0.3, length(fract(g) - 0.5)));',
    '  float tw = 0.75 + 0.25 * sin(uTime * (1.2 + 3.0 * hash13(cell + 7.1)) + hs * 90.0);',
    '  float br = 0.6 + 0.4 * hash13(cell + 3.7);',
    '  float kc = hash13(cell + 11.0);',
    '  vec3 scol = kc < 0.35 ? vec3(0.45, 0.65, 1.0) : (kc > 0.8 ? vec3(1.0, 0.55, 0.3) : vec3(0.95, 0.97, 1.0));',
    '  sky += scol * star * tw * br * uNight * smoothstep(-0.02, 0.08, h);',
    // Vía Láctea tenue
    '  vec3 gn = normalize(vec3(0.42, 0.78, -0.46));',
    '  float band = exp(-pow(dot(d, gn) / 0.07, 2.0));',
    '  float cloud = vnoise3(d * 7.0) * 0.6 + vnoise3(d * 16.0) * 0.4;',
    '  float mw = band * (0.25 + 0.75 * cloud);',
    '  sky += vec3(0.55, 0.6, 0.8) * mw * 0.2 * uNight * smoothstep(-0.05, 0.1, h);',
    '  gl_FragColor = vec4(toSRGB(sky), 1.0);',
    '}'
  ].join('\n');

  // mar: olas por vértice (grandes) + olas finas por pixel; color por profundidad (textura de alturas)
  const WATER_VS = [
    'uniform float uTime; uniform float uQuake;',
    'varying vec3 vW;',
    'void main() {',
    '  vec3 p = position;',
    '  float amp = 1.0 + 3.0 * uQuake;',
    '  float w = 0.30 * sin(p.x * 0.021 + uTime * 0.9)',
    '          + 0.20 * sin(p.z * 0.017 - uTime * 0.7 + p.x * 0.010)',
    '          + 0.12 * sin((p.x + p.z) * 0.011 + uTime * 0.5);',
    '  p.y += w * amp;',
    '  vec4 wp = modelMatrix * vec4(p, 1.0);',
    '  vW = wp.xyz;',
    '  gl_Position = projectionMatrix * viewMatrix * wp;',
    '}'
  ].join('\n');

  const WATER_FS = [
    'uniform float uTime; uniform float uQuake; uniform vec3 uLightDir; uniform vec3 uLightCol; uniform float uLightI;',
    'uniform vec3 uHorizon; uniform vec3 uZenith; uniform vec3 uDeep; uniform vec3 uShallow; uniform vec3 uFogC;',
    'uniform vec3 uFoam; uniform sampler2D uHeight; uniform float uHalf; uniform float uMoonF;',
    'varying vec3 vW;',
    COMMON_GLSL,
    'void main() {',
    '  vec2 q = vW.xz;',
    '  float t = uTime;',
    '  float amp = 1.0 + 3.0 * uQuake;',
    '  float a1 = q.x * 0.021 + t * 0.9;',
    '  float a2 = q.y * 0.017 - t * 0.7 + q.x * 0.010;',
    '  float a3 = (q.x + q.y) * 0.011 + t * 0.5;',
    '  float gx = (0.30 * 0.021 * cos(a1) + 0.20 * 0.010 * cos(a2) + 0.12 * 0.011 * cos(a3)) * amp;',
    '  float gz = (0.20 * 0.017 * cos(a2) + 0.12 * 0.011 * cos(a3)) * amp;',
    '  float b1 = q.x * 0.21 + q.y * 0.05 + t * 2.2;',
    '  float b2 = q.x * -0.08 + q.y * 0.19 + t * 1.7;',
    '  float b3 = q.x * 0.33 + q.y * 0.27 - t * 3.0;',
    '  float fa = 1.0 + 2.0 * uQuake;',
    '  gx += fa * (0.04 * 0.21 * cos(b1) + 0.03 * -0.08 * cos(b2) + 0.02 * 0.33 * cos(b3));',
    '  gz += fa * (0.04 * 0.05 * cos(b1) + 0.03 * 0.19 * cos(b2) + 0.02 * 0.27 * cos(b3));',
    '  vec3 n = normalize(vec3(-gx, 1.0, -gz));',
    '  vec3 V = normalize(cameraPosition - vW);',
    '  vec3 L = normalize(uLightDir);',
    '  float ndv = max(dot(n, V), 0.0);',
    '  float fres = 0.02 + 0.98 * pow(1.0 - ndv, 5.0);',
    // profundidad: la textura guarda la altura del fondo en -8..8 m
    '  float hb = texture2D(uHeight, (q + uHalf) / (2.0 * uHalf)).r * 16.0 - 8.0;',
    '  float dT = clamp(-hb / 5.0, 0.0, 1.0);',
    '  vec3 body = mix(uShallow, uDeep, smoothstep(0.0, 1.0, dT));',
    // espuma en la línea de costa (donde el fondo cruza el nivel del mar)
    '  float band = 1.0 - smoothstep(0.0, 0.9, abs(hb + 1.5));',
    '  float fn = 0.5 + 0.5 * sin(q.x * 0.55 + t * 1.6) * sin(q.y * 0.43 - t * 1.1);',
    '  float foam = band * (0.45 + 0.55 * fn) * (0.6 + 0.8 * uQuake);',
    '  body = mix(body, uFoam, clamp(foam, 0.0, 1.0) * 0.8);',
    '  vec3 R = reflect(-V, n);',
    '  vec3 sky = mix(uHorizon, uZenith, smoothstep(0.0, 0.5, R.y));',
    '  vec3 col = mix(body, sky, clamp(fres * 1.2, 0.0, 1.0));',
    '  float ndl = max(dot(n, L), 0.0);',
    '  col *= 0.85 + 0.15 * ndl;',
    '  float rl = max(dot(reflect(-L, n), V), 0.0);',
    '  float spec = pow(rl, 120.0) * 1.2 + pow(rl, 12.0) * 0.05;',
    '  col += uLightCol * spec * clamp(uLightI, 0.0, 2.5) * 0.35;',
    // camino de la luna sobre el mar (solo de noche)
    '  col += uLightCol * pow(rl, 40.0) * 0.6 * uMoonF;',
    // niebla del horizonte para que el mar se funda con el cielo
    '  float dist = length(vW - cameraPosition);',
    '  col = mix(col, uFogC, smoothstep(2500.0, 6500.0, dist));',
    '  gl_FragColor = vec4(toSRGB(col), 1.0);',
    '}'
  ].join('\n');

  const DUST_VS = [
    'uniform float uTime; uniform float uQuake; uniform float uPx;',
    'attribute float aSeed;',
    'varying float vA;',
    'void main() {',
    '  float ph = fract(aSeed * 17.13 + uTime * 0.09 * (0.6 + aSeed));',
    '  vec3 p = position;',
    '  p.y += ph * 26.0 + 1.0;',
    '  p.x += sin(uTime * 0.7 + aSeed * 20.0) * 4.0 * ph;',
    '  p.z += cos(uTime * 0.6 + aSeed * 13.0) * 4.0 * ph;',
    '  vec4 mv = modelViewMatrix * vec4(p, 1.0);',
    '  gl_Position = projectionMatrix * mv;',
    '  gl_PointSize = clamp(uPx / -mv.z, 2.0, 22.0);',
    '  vA = uQuake * (0.9 - ph) * smoothstep(0.0, 0.15, ph) * 0.5;',
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

  // ventanas encendidas de noche: puntos cálidos con parpadeo leve
  const WIN_VS = [
    'uniform float uTime; uniform float uNight; uniform float uPx;',
    'attribute float aSeed;',
    'varying float vA;',
    'void main() {',
    '  vec4 mv = modelViewMatrix * vec4(position, 1.0);',
    '  gl_Position = projectionMatrix * mv;',
    '  gl_PointSize = clamp(uPx / -mv.z, 3.0, 12.0);',
    '  float tw = 0.8 + 0.2 * sin(uTime * (1.0 + aSeed * 2.0) + aSeed * 40.0);',
    '  float on = step(0.3, fract(aSeed * 5.7));',
    '  vA = uNight * tw * on;',
    '}'
  ].join('\n');

  // roca / piedra: icosaedro con vértices desplazados (sin grietas)
  function makeRockGeometry(THREE, detail) {
    const g = new THREE.IcosahedronGeometry(1, detail);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const n = fract(Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453);
      const k = 0.72 + 0.5 * n;
      p.setXYZ(i, x * k, y * k * 0.6, z * k);
    }
    g.computeVertexNormals();
    return g;
  }

  // prisma triangular: base y=0..1 (ancho 1 en x), cumbre en y=1, extruido en z (±0.5)
  function makePrismGeometry(THREE) {
    const V = [[-0.5, 0, -0.5], [0.5, 0, -0.5], [0, 1, -0.5], [-0.5, 0, 0.5], [0.5, 0, 0.5], [0, 1, 0.5]];
    const T = [[0, 2, 1], [3, 5, 4], [1, 5, 4], [1, 2, 5], [0, 3, 5], [0, 5, 2]];
    const pos = [];
    for (let t = 0; t < T.length; t++) for (let k = 0; k < 3; k++) pos.push.apply(pos, V[T[t][k]]);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    return g;
  }

  // textura de suelo (tileable): grano y manchas; sRGB
  function makeGroundTexture(THREE) {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const g = canvas.getContext('2d');
    const img = g.createImageData(size, size);
    const d = img.data;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 4;
        const grain = rnd();
        const blot = 0.5 + 0.5 * Math.sin(TAU * (2 * x + 3 * y) / size + 1.7 * Math.sin(TAU * (3 * y - x) / size));
        const val = 226 + 28 * (grain - 0.5) + 16 * (blot - 0.5);
        d[i] = d[i + 1] = d[i + 2] = val;
        d[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.encoding = THREE.sRGBEncoding;
    return tex;
  }

  // paletas por hora (tod 0..1): cielo cenit/horizonte, color del sol, intensidad, hemisferio
  G.createEnvironment = function (ctx) {
    const THREE = ctx.THREE, scene = ctx.scene, camera = ctx.camera, renderer = ctx.renderer;
    const root = new THREE.Group(); scene.add(root);
    const col = function (hex) { return new THREE.Color(hex); };

    // ---------- colores fijos ----------
    const MOON_COL = col('#6f8fe0');
    const DEEP_DAY = col('#1f5f8b'), DEEP_NIGHT = col('#06141f');
    const SHALLOW_DAY = col('#3fb7b5'), SHALLOW_NIGHT = col('#0f3440');
    const HEM_GROUND_DAY = col('#bfa27a'), HEM_GROUND_NIGHT = col('#1a2540');
    const LAMP_DAY = col('#e8d8b0'), LAMP_NIGHT = col('#ffd27a');
    const KEYS = [
      // t,    cenit,      horizonte,  color sol,  intensidad, hemisferio
      [0.00,  '#02050f', '#0a1830', '#6f8fe0', 0.0, '#1a2a50'],   // medianoche
      [0.18,  '#02050f', '#0a1830', '#6f8fe0', 0.0, '#1d2c5a'],
      [0.235, '#2a3f8a', '#ff8f86', '#ffa27a', 1.0, '#8a6fa0'],   // amanecer rosado-dorado
      [0.30,  '#3f7fd0', '#ffc8a0', '#ffd9a8', 1.7, '#c3c8d8'],
      [0.38,  '#2f73c8', '#bfe0ec', '#fff3dc', 2.1, '#bcd8e8'],
      [0.50,  '#1f5fb8', '#a9d6e8', '#fff6e6', 2.3, '#c6e0ee'],   // mediodía azul mediterráneo
      [0.62,  '#2f6fc0', '#bfe0ea', '#ffebc6', 2.1, '#bcd8e8'],
      [0.72,  '#3a4fa0', '#ffb070', '#ffa050', 1.6, '#f0a878'],   // atardecer naranja intenso
      [0.765, '#44407f', '#ff8a2a', '#ff9040', 0.9, '#c07a6a'],
      [0.80,  '#1f2352', '#d0583a', '#ff7a3a', 0.15, '#6a4a5a'],
      [0.86,  '#02050f', '#0a1830', '#6f8fe0', 0.0, '#1f2a55'],
      [1.00,  '#02050f', '#0a1830', '#6f8fe0', 0.0, '#1a2a50']
    ].map(function (k) {
      return { t: k[0], zen: col(k[1]), hor: col(k[2]), sun: col(k[3]), sI: k[4], hem: col(k[5]) };
    });
    const tZen = col(), tHor = col(), tSun = col(), tHem = col(), tHemG = col();
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
      uZenith: { value: col() }, uHorizon: { value: col() },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: col() },
      uMoonDir: { value: new THREE.Vector3(0, 1, 0) }, uMoonCut: { value: new THREE.Vector3(0, 1, 0) },
      uSunT1: { value: new THREE.Vector3(1, 0, 0) }, uSunT2: { value: new THREE.Vector3(0, 0, 1) },
      uSunVis: { value: 0 }, uMoonVis: { value: 0 }, uNight: { value: 0 }, uTime: { value: 0 },
      uDusk: { value: 0 }, uDay: { value: 0 }, uSunAng: { value: 0.0047 }, uBelow: { value: col() }
    };
    const sunDir = skyU.uSunDir.value;
    const moonDir = skyU.uMoonDir.value;
    const moonCut = skyU.uMoonCut.value;
    const sunT1 = skyU.uSunT1.value, sunT2 = skyU.uSunT2.value;
    const tmpV = new THREE.Vector3(), upV = new THREE.Vector3(0, 1, 0);
    const skyMat = new THREE.ShaderMaterial({
      uniforms: skyU, vertexShader: SKY_VS, fragmentShader: SKY_FS,
      side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false
    });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(20000, 32, 16), skyMat);
    sky.renderOrder = -1000; sky.frustumCulled = false;
    root.add(sky);

    // ---------- niebla (suave, del color del horizonte) ----------
    scene.fog = new THREE.FogExp2(0xa9d6e8, 0.00009);

    // ---------- sol / luna con sombras ajustadas a la estatua ----------
    const sun = new THREE.DirectionalLight(0xffffff, 2);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 2048; sun.shadow.mapSize.height = 2048;
    const sc = sun.shadow.camera;
    sc.left = -80; sc.right = 80; sc.top = 80; sc.bottom = -80; sc.near = 60; sc.far = 1100;
    sc.updateProjectionMatrix();
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.12;
    sun.target.position.set(SUN_TARGET.x, SUN_TARGET.y, SUN_TARGET.z);
    root.add(sun); root.add(sun.target);

    const hemi = new THREE.HemisphereLight(0xd6e6ff, 0xbfa27a, 0.5);
    root.add(hemi);

    // ---------- terreno: rejilla con más detalle en la ciudad y la costa ----------
    const XS = axis(-4000, 700, -900, 600, 12, 120);
    const ZS = axis(-1000, 4000, -200, 900, 12, 120);
    const NX = XS.length, NZ = ZS.length;
    const tPos = new Float32Array(NX * NZ * 3);
    const tCol = new Float32Array(NX * NZ * 3);
    const tUv = new Float32Array(NX * NZ * 2);
    const tmpC = col();
    const cSand = col('#d2b07a'), cPale = col('#e6d3a0'), cGreen = col('#7f8a4c');
    const cRock = col('#8f8a80'), cWet = col('#9a8160'), cStreet = col('#9c8056');
    const cLot = col('#dcc39b'), cBeach = col('#ead9ae');
    function groundColor(x, z, h, slope, out) {
      out.copy(cSand).lerp(cPale, vnoise(x / 60, z / 60, 21));
      out.lerp(cGreen, sstep(5, 20, h) * (1 - sstep(0.2, 0.4, slope)) * 0.7);   // colinas con maleza
      out.lerp(cRock, sstep(0.2, 0.42, slope));                                  // laderas rocosas
      out.lerp(cBeach, sstep(-2.5, -0.5, h) * (1 - sstep(0.6, 2.0, h)));         // playa
      if (h < -1.5) out.lerp(cWet, 0.8);                                         // fondo marino
      if (x > CITY.xMin && x < CITY.xMax && z > CITY.zMin && z < CITY.zMax && h < 40) {
        const ux = ((x - CITY.xMin) % 52 + 52) % 52, uz = ((z - CITY.zMin) % 52 + 52) % 52;
        const street = (ux > 40 || uz > 40);
        out.lerp(street ? cStreet : cLot, 0.85);                                 // manzanas y calles
      }
      return out;
    }
    for (let j = 0; j < NZ; j++) {
      for (let i = 0; i < NX; i++) {
        const x = XS[i], z = ZS[j], idx = j * NX + i;
        const h = groundH(x, z);
        tPos[idx * 3] = x; tPos[idx * 3 + 1] = h; tPos[idx * 3 + 2] = z;
        tUv[idx * 2] = x / 40; tUv[idx * 2 + 1] = z / 40;
        groundColor(x, z, h, slopeAt(x, z), tmpC);
        tCol[idx * 3] = tmpC.r; tCol[idx * 3 + 1] = tmpC.g; tCol[idx * 3 + 2] = tmpC.b;
      }
    }
    const tIdx = new Uint32Array((NX - 1) * (NZ - 1) * 6);
    let p = 0;
    for (let j = 0; j < NZ - 1; j++) {
      for (let i = 0; i < NX - 1; i++) {
        const v00 = j * NX + i, v01 = (j + 1) * NX + i, v10 = j * NX + i + 1, v11 = (j + 1) * NX + i + 1;
        tIdx[p++] = v00; tIdx[p++] = v01; tIdx[p++] = v10;
        tIdx[p++] = v01; tIdx[p++] = v11; tIdx[p++] = v10;
      }
    }
    const terGeo = new THREE.BufferGeometry();
    terGeo.setAttribute('position', new THREE.BufferAttribute(tPos, 3));
    terGeo.setAttribute('color', new THREE.BufferAttribute(tCol, 3));
    terGeo.setAttribute('uv', new THREE.BufferAttribute(tUv, 2));
    terGeo.setIndex(new THREE.BufferAttribute(tIdx, 1));
    terGeo.computeVertexNormals();
    // sombreado extra por inclinación sobre el color por vértice
    const nrm = terGeo.attributes.normal.array;
    for (let k = 0; k < NX * NZ; k++) {
      const shade = 0.8 + 0.2 * clamp01(nrm[k * 3 + 1]);
      tCol[k * 3] *= shade; tCol[k * 3 + 1] *= shade; tCol[k * 3 + 2] *= shade;
    }
    const groundTex = makeGroundTexture(THREE);
    const terMat = new THREE.MeshStandardMaterial({ vertexColors: true, map: groundTex, roughness: 0.95, metalness: 0 });
    const terrain = new THREE.Mesh(terGeo, terMat);
    terrain.receiveShadow = true;
    root.add(terrain);

    // ---------- altura del mar en textura (para color por profundidad y espuma) ----------
    const HM = 512;
    const hmData = new Uint8Array(HM * HM * 4);
    for (let j = 0; j < HM; j++) {
      for (let i = 0; i < HM; i++) {
        const x = -SEA_HALF + (i + 0.5) * (2 * SEA_HALF) / HM;
        const z = -SEA_HALF + (j + 0.5) * (2 * SEA_HALF) / HM;
        const v = clamp01((groundH(x, z) + 8) / 16) * 255;
        const k = (j * HM + i) * 4;
        hmData[k] = v; hmData[k + 1] = v; hmData[k + 2] = v; hmData[k + 3] = 255;
      }
    }
    const hmTex = new THREE.DataTexture(hmData, HM, HM, THREE.RGBAFormat, THREE.UnsignedByteType);
    hmTex.magFilter = THREE.LinearFilter; hmTex.minFilter = THREE.LinearFilter;
    hmTex.wrapS = hmTex.wrapT = THREE.ClampToEdgeWrapping;
    hmTex.needsUpdate = true;

    // ---------- mar Egeo ----------
    const seaGeo = new THREE.PlaneGeometry(SEA_HALF * 2, SEA_HALF * 2, 96, 96);
    seaGeo.rotateX(-Math.PI / 2);
    seaGeo.translate(0, SEA_Y, 0);
    const waterU = {
      uTime: { value: 0 }, uQuake: { value: 0 },
      uLightDir: { value: new THREE.Vector3(0, 1, 0) }, uLightCol: { value: sun.color }, uLightI: { value: 0 },
      uHorizon: { value: col() }, uZenith: { value: col() }, uFogC: { value: col() },
      uDeep: { value: col('#1f5f8b') }, uShallow: { value: col('#3fb7b5') }, uFoam: { value: col('#f2f6f4') },
      uHeight: { value: hmTex }, uHalf: { value: SEA_HALF }, uMoonF: { value: 0 }
    };
    const waterMat = new THREE.ShaderMaterial({ uniforms: waterU, vertexShader: WATER_VS, fragmentShader: WATER_FS });
    const sea = new THREE.Mesh(seaGeo, waterMat);
    sea.frustumCulled = false;
    root.add(sea);

    // ---------- constructor de geometría fusionada (una sola malla por grupo de materiales) ----------
    const UBOX = new THREE.BoxGeometry(1, 1, 1).toNonIndexed();
    const UCYL = new THREE.CylinderGeometry(1, 1, 1, 12, 1, false).toNonIndexed();
    const UPRISM = makePrismGeometry(THREE);
    const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
    const AXIS_Y = new THREE.Vector3(0, 1, 0);
    function xf(px, py, pz, sx, sy, sz, ry) {
      _p.set(px, py, pz); _s.set(sx, sy, sz); _q.setFromAxisAngle(AXIS_Y, ry || 0);
      return _m.compose(_p, _q, _s);
    }
    function makeBuilder() {
      const P = [], N = [], C = [];
      const v = new THREE.Vector3(), w = new THREE.Vector3(), nm = new THREE.Matrix3();
      return {
        add: function (geo, m, c) {
          const g = geo.index ? geo.toNonIndexed() : geo;
          if (!g.attributes.normal) g.computeVertexNormals();
          const pa = g.attributes.position.array, na = g.attributes.normal.array;
          nm.getNormalMatrix(m);
          for (let i = 0; i < pa.length; i += 3) {
            v.set(pa[i], pa[i + 1], pa[i + 2]).applyMatrix4(m); P.push(v.x, v.y, v.z);
            w.set(na[i], na[i + 1], na[i + 2]).applyMatrix3(nm).normalize(); N.push(w.x, w.y, w.z);
            C.push(c.r, c.g, c.b);
          }
        },
        geometry: function () {
          const g = new THREE.BufferGeometry();
          g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
          g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
          g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
          return g;
        }
      };
    }
    function addBox(B, c, cx, cy, cz, sx, sy, sz, ry) { B.add(UBOX, xf(cx, cy, cz, sx, sy, sz, ry), c); }
    function addCyl(B, c, x, y0, z, r, h) { B.add(UCYL, xf(x, y0 + h / 2, z, r, h, r, 0), c); }
    function addPrism(B, c, x, y0, z, w, h, d, ry) { B.add(UPRISM, xf(x, y0, z, w, h, d, ry), c); }

    // ---------- piedra antigua: espigones, torrecillas, muralla, templos, acrópolis ----------
    const SB = makeBuilder();
    const C_MOLE = col('#b3a282'), C_WALL = col('#cdb88f'), C_MARBLE = col('#ece6da');
    const C_CELLA = col('#d6c8a8'), C_ROOF = col('#b5573a');

    // espigones de Mandraki: bloques de piedra a lo largo de las polilíneas (ancho 18 m, cima 3 m sobre el mar)
    const MOLE_TOP = SEA_Y + 3, MOLE_BOT = -6;
    function moleLeg(poly) {
      for (let k = 0; k < poly.length - 1; k++) {
        const a = poly[k], b = poly[k + 1];
        const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz);
        addBox(SB, C_MOLE, (a[0] + b[0]) / 2, (MOLE_TOP + MOLE_BOT) / 2, (a[1] + b[1]) / 2,
          L + 0.5, MOLE_TOP - MOLE_BOT, 18, Math.atan2(-dz, dx));
      }
      for (let k = 1; k < poly.length - 1; k++) {
        addBox(SB, C_MOLE, poly[k][0], (MOLE_TOP + MOLE_BOT) / 2, poly[k][1], 18, MOLE_TOP - MOLE_BOT, 18, 0);
      }
    }
    moleLeg(SITE.moleWest);
    moleLeg(SITE.moleEast);
    // torrecillas en las puntas de la bocana (sobre ellas se alzan las columnas de "hoy")
    for (const d of SITE.deerColumns) {
      addBox(SB, C_MOLE, d[0], 5.5, d[1], 6.5, 8.4, 6.5, 0);
      addBox(SB, C_MOLE, d[0], 10.0, d[1], 7.2, 0.6, 7.2, 0);
    }

    // muralla este (x=330) con torres y almenas; su base se hunde en el fondo del mar
    const WX = SITE.walls.x, WZ0 = -40, WZ1 = 700;
    addBox(SB, C_WALL, WX, 2, (WZ0 + WZ1) / 2, 12, 16, WZ1 - WZ0, 0);
    for (let z = WZ0; z <= WZ1 + 0.1; z += 6) {
      addBox(SB, C_WALL, WX - 5, 11, z, 3, 2, 2.4, 0);
      addBox(SB, C_WALL, WX + 5, 11, z, 3, 2, 2.4, 0);
    }
    for (let z = WZ0; z <= WZ1 + 0.1; z += 70) addBox(SB, C_WALL, WX, 6, z, 16, 24, 16, 0);

    // templos dóricos: estilóbato, columnas con capitel, arquitrabe, naos y cubierta a dos aguas
    function temple(B, cx, baseY, cz, L, W, colH, nL, nS) {
      const top = baseY + 0.6;
      addBox(B, C_MARBLE, cx, (baseY - 3 + top) / 2, cz, L + 3, top - (baseY - 3), W + 3, 0);
      const cz0 = W / 2 - 1.3, cx0 = L / 2 - 1.3;
      const pts = [];
      for (let i = 0; i < nL; i++) {
        const x = cx - cx0 + i * (2 * cx0) / (nL - 1);
        pts.push([x, cz - cz0]); pts.push([x, cz + cz0]);
      }
      for (let j = 1; j < nS - 1; j++) {
        const z = cz - cz0 + j * (2 * cz0) / (nS - 1);
        pts.push([cx - cx0, z]); pts.push([cx + cx0, z]);
      }
      const colTop = top + colH;
      for (let k = 0; k < pts.length; k++) {
        addCyl(B, C_MARBLE, pts[k][0], top, pts[k][1], 0.9, colH);
        addBox(B, C_MARBLE, pts[k][0], colTop + 0.35, pts[k][1], 2.1, 0.7, 2.1, 0);
      }
      const entY = colTop + 0.7 + 0.8;
      addBox(B, C_MARBLE, cx, entY, cz, L + 1.2, 1.6, W + 1.2, 0);
      addBox(B, C_CELLA, cx, top + colH * 0.5, cz, L - 8, colH, W - 8, 0);
      // cubierta a dos aguas (los frontones son sus caras extremas)
      addPrism(B, C_ROOF, cx, entY + 0.8, cz, W + 1.6, W * 0.2, L + 1.2, Math.PI / 2);
    }
    function stoa(B, x0, z, n, sp, baseY, colH) {
      for (let i = 0; i < n; i++) {
        addCyl(B, C_MARBLE, x0 + i * sp, baseY, z - 1.2, 0.5, colH);
        addCyl(B, C_MARBLE, x0 + i * sp, baseY, z + 1.2, 0.5, colH);
      }
      const len = (n - 1) * sp;
      addBox(B, C_MARBLE, x0 + len / 2, baseY + colH + 0.5, z, len + 2, 1.0, 3.2, 0);
      addBox(B, C_CELLA, x0 + len / 2, baseY + colH + 1.3, z, len + 2.4, 0.6, 4.0, 0);
    }

    // ciudad: templos de la trama
    const TEMPLES = [
      { x: -250, z: 250, L: 40, W: 20, colH: 9, nL: 10, nS: 5 },
      { x: -60, z: 330, L: 36, W: 18, colH: 8, nL: 9, nS: 5 },
      { x: 110, z: 430, L: 38, W: 19, colH: 9, nL: 10, nS: 5 },
      { x: -520, z: 330, L: 34, W: 18, colH: 8, nL: 9, nS: 5 }
    ];
    for (const T of TEMPLES) {
      const h4 = (groundH(T.x - T.L / 2, T.z - T.W / 2) + groundH(T.x + T.L / 2, T.z - T.W / 2) +
        groundH(T.x - T.L / 2, T.z + T.W / 2) + groundH(T.x + T.L / 2, T.z + T.W / 2)) / 4;
      temple(SB, T.x, h4, T.z, T.L, T.W, T.colH, T.nL, T.nS);
    }
    // acrópolis (SO): plataforma a 110 m, templo mayor, muro circular y stoa
    temple(SB, ACR.x, ACR_TOP, ACR.z, 50, 24, 11, 12, 6);
    for (let k = 0; k < 24; k++) {
      const a = k * TAU / 24;
      addBox(SB, C_WALL, ACR.x + Math.cos(a) * 44, ACR_TOP + 1, ACR.z + Math.sin(a) * 44, 12.2, 8, 2.6, -a - Math.PI / 2);
    }
    stoa(SB, ACR.x - 30, ACR.z + 30, 8, 6.0, ACR_TOP, 6.5);

    // almacenes del puerto (tejado a dos aguas) y muelles de piedra que entran en la bocana
    const C_WARE = col('#d8c7a4'), C_ROOFW = col('#b5573a'), C_CONC2 = col('#9aa0a6');
    for (let wx = -200; wx <= 200; wx += 64) {
      const wz = coastZ(wx) + 16;
      if (inlandAt(wx, wz) < 8) continue;
      const gh = groundH(wx, wz), top = gh + 8;
      addBox(SB, C_WARE, wx, (gh - 1 + top) / 2, wz, 34, top - (gh - 1), 12, 0);
      addPrism(SB, C_ROOFW, wx, top, wz, 13.2, 3.0, 35, Math.PI / 2);
    }
    for (const px of [-150, -40, 60, 150]) addBox(SB, C_CONC2, px, -0.3, coastZ(px) - 13, 8, 3, 26, 0);

    const stoneMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0 });
    const stoneMesh = new THREE.Mesh(SB.geometry(), stoneMat);
    stoneMesh.castShadow = true; stoneMesh.receiveShadow = true;
    stoneMesh.frustumCulled = false;
    root.add(stoneMesh);

    // ---------- ciudad: casas cúbicas con tejados, en manzanas de la trama hipodámica ----------
    const HOUSE_COLS = ['#f4efe6', '#f1ead9', '#ece6da', '#f7f2e8', '#e8dcc4', '#d9a35a', '#c98a55', '#d6b98a'].map(col);
    const ROOF_COLS = ['#b5573a', '#a64d32', '#c0603f', '#9c4a30', '#8a4a36'].map(col);
    function buildable(x, z) {
      if (inlandAt(x, z) < 12) return false;
      for (const T of TEMPLES) {
        if (Math.abs(x - T.x) < T.L / 2 + 12 && Math.abs(z - T.z) < T.W / 2 + 12) return false;
      }
      if (Math.hypot(x - ACR.x, z - ACR.z) < 170) return false;
      if (groundH(x, z) > 30) return false;
      return slopeAt(x, z) < 0.18;
    }
    const houses = [];
    for (let bx = CITY.xMin; bx < CITY.xMax; bx += 52) {
      for (let bz = CITY.zMin; bz < CITY.zMax; bz += 52) {
        for (let i = 0; i < 2; i++) {
          for (let j = 0; j < 2; j++) {
            if (rnd() < 0.38) continue;
            const cx = bx + 10 + i * 20 + (rnd() - 0.5) * 2;
            const cz = bz + 10 + j * 20 + (rnd() - 0.5) * 2;
            if (cx > CITY.xMax || cz > CITY.zMax) continue;
            if (!buildable(cx, cz)) continue;
            houses.push({
              x: cx, z: cz, y: groundH(cx, cz),
              w: 10 + rnd() * 6, d: 10 + rnd() * 6, H: 3.5 + rnd() * 9,
              col: HOUSE_COLS[Math.floor(rnd() * HOUSE_COLS.length)],
              roof: rnd() < 0.6, rh: 2.4 + rnd() * 2.2,
              rc: ROOF_COLS[Math.floor(rnd() * ROOF_COLS.length)]
            });
          }
        }
      }
    }
    // variedad: alas laterales y patios enlosados junto a las casas
    const patioCol = col('#c9b48c');
    const extraBoxes = [];
    for (const h of houses) {
      if (rnd() < 0.45) {
        const ww = 6 + rnd() * 5, wd = 6 + rnd() * 4, wh = h.H * (0.45 + rnd() * 0.4);
        const sgn = rnd() < 0.5 ? -1 : 1;
        extraBoxes.push({ x: h.x + sgn * (h.w / 2 + ww / 2 - 1.5), y: h.y - 1.5, z: h.z + (rnd() - 0.5) * (h.d - wd) * 0.6,
          sx: ww, sy: wh + 1.5, sz: wd, c: h.col });
      }
      if (rnd() < 0.3) extraBoxes.push({ x: h.x, y: h.y + 0.05, z: h.z, sx: h.w + 6, sy: 0.5, sz: h.d + 6, c: patioCol });
    }
    const houseMesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }), houses.length + extraBoxes.length);
    const roofs = houses.filter(function (h) { return h.roof; });
    const roofMesh = new THREE.InstancedMesh(UPRISM, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 }), roofs.length);
    const winPos = new Float32Array(houses.length * 2 * 3), winSeed = new Float32Array(houses.length * 2);
    for (let k = 0; k < houses.length; k++) {
      const h = houses[k];
      houseMesh.setMatrixAt(k, xf(h.x, h.y - 1.5, h.z, h.w, h.H + 1.5, h.d, 0));
      houseMesh.setColorAt(k, h.col);
      for (let q = 0; q < 2; q++) {
        const wi = (k * 2 + q) * 3;
        const side = Math.floor(rnd() * 4);
        let wx = h.x, wz = h.z;
        if (side === 0) { wx += (rnd() - 0.5) * h.w * 0.7; wz -= h.d / 2 + 0.12; }
        else if (side === 1) { wx += h.w / 2 + 0.12; wz += (rnd() - 0.5) * h.d * 0.7; }
        else if (side === 2) { wx += (rnd() - 0.5) * h.w * 0.7; wz += h.d / 2 + 0.12; }
        else { wx -= h.w / 2 + 0.12; wz += (rnd() - 0.5) * h.d * 0.7; }
        winPos[wi] = wx; winPos[wi + 1] = h.y + 1.2 + rnd() * Math.max(0.5, h.H - 1.5); winPos[wi + 2] = wz;
        winSeed[k * 2 + q] = rnd();
      }
    }
    for (let e = 0; e < extraBoxes.length; e++) {
      const b = extraBoxes[e];
      houseMesh.setMatrixAt(houses.length + e, xf(b.x, b.y, b.z, b.sx, b.sy, b.sz, 0));
      houseMesh.setColorAt(houses.length + e, b.c);
    }
    for (let r = 0; r < roofs.length; r++) {
      const h = roofs[r];
      roofMesh.setMatrixAt(r, xf(h.x, h.y + h.H - 0.1, h.z, h.w + 0.8, h.rh, h.d + 0.8, 0));
      roofMesh.setColorAt(r, h.rc);
    }
    houseMesh.castShadow = true; houseMesh.receiveShadow = true;
    roofMesh.castShadow = true; roofMesh.receiveShadow = true;
    houseMesh.frustumCulled = false; roofMesh.frustumCulled = false;
    houseMesh.instanceMatrix.needsUpdate = true; roofMesh.instanceMatrix.needsUpdate = true;
    if (houseMesh.instanceColor) houseMesh.instanceColor.needsUpdate = true;
    if (roofMesh.instanceColor) roofMesh.instanceColor.needsUpdate = true;
    root.add(houseMesh); root.add(roofMesh);

    // ventanas encendidas (solo de noche)
    const winGeo = new THREE.BufferGeometry();
    winGeo.setAttribute('position', new THREE.BufferAttribute(winPos, 3));
    winGeo.setAttribute('aSeed', new THREE.BufferAttribute(winSeed, 1));
    const winU = { uTime: { value: 0 }, uNight: { value: 0 }, uPx: { value: 140 }, uColor: { value: col('#ffd27a') } };
    const winMat = new THREE.ShaderMaterial({
      uniforms: winU, vertexShader: WIN_VS, fragmentShader: POINT_FS,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
    });
    const windows = new THREE.Points(winGeo, winMat);
    windows.frustumCulled = false;
    root.add(windows);

    // ---------- cipreses y matorral (InstancedMesh) ----------
    const cypGeo = new THREE.ConeGeometry(1.5, 9, 8).translate(0, 4.5, 0);
    const CYP = 140;
    const cypMesh = new THREE.InstancedMesh(cypGeo, new THREE.MeshStandardMaterial({ color: 0x2f4d33, roughness: 0.9 }), CYP);
    const bushGeo = makeRockGeometry(THREE, 0).translate(0, 0.6, 0);
    const BUSH = 200;
    const bushMesh = new THREE.InstancedMesh(bushGeo, new THREE.MeshStandardMaterial({ color: 0x6f7f4a, roughness: 0.95, flatShading: true }), BUSH);
    const _c = col();
    let nCyp = 0, tries = 0;
    while (nCyp < CYP && tries < CYP * 40) {
      tries++;
      const x = -900 + rnd() * 1200, z = 0 + rnd() * 900;
      if (inlandAt(x, z) < 25 || groundH(x, z) > 30 || slopeAt(x, z) > 0.35) continue;
      const sc1 = 0.8 + rnd() * 0.6;
      cypMesh.setMatrixAt(nCyp, xf(x, groundH(x, z) - 0.3, z, sc1, sc1 * (0.9 + rnd() * 0.4), sc1, rnd() * TAU));
      nCyp++;
    }
    cypMesh.count = nCyp;
    let nBush = 0; tries = 0;
    while (nBush < BUSH && tries < BUSH * 40) {
      tries++;
      const x = -900 + rnd() * 1300, z = rnd() * 1100;
      if (inlandAt(x, z) < 25 || groundH(x, z) > 60 || slopeAt(x, z) > 0.45) continue;
      const sc1 = 1.2 + rnd() * 1.2;
      bushMesh.setMatrixAt(nBush, xf(x, groundH(x, z) - 0.2, z, sc1, sc1 * 0.7, sc1, rnd() * TAU));
      _c.set(['#6f7f4a', '#7d8c52', '#5e7044'][Math.floor(rnd() * 3)]);
      bushMesh.setColorAt(nBush, _c);
      nBush++;
    }
    bushMesh.count = nBush;
    cypMesh.castShadow = true; bushMesh.castShadow = false;
    cypMesh.frustumCulled = false; bushMesh.frustumCulled = false;
    cypMesh.instanceMatrix.needsUpdate = true; bushMesh.instanceMatrix.needsUpdate = true;
    if (bushMesh.instanceColor) bushMesh.instanceColor.needsUpdate = true;
    root.add(cypMesh); root.add(bushMesh);

    // ---------- olivos, pinos y roca gris en las lomas (InstancedMesh) ----------
    function scatterLand(count, hMin, hMax, slMin, slMax, fn) {
      let n = 0, t = 0;
      while (n < count && t < count * 40) {
        t++;
        const x = -900 + rnd() * 1300, z = rnd() * 1100;
        const h = groundH(x, z), sl = slopeAt(x, z);
        if (inlandAt(x, z) < 25 || h < hMin || h > hMax || sl < slMin || sl > slMax) continue;
        if (x > CITY.xMin && x < CITY.xMax && z > CITY.zMin && z < CITY.zMax) continue;
        fn(n, x, h, z); n++;
      }
      return n;
    }
    const OLIVE = 150, PINE = 70, OUTC = 90;
    const oTrunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.25, 0.4, 2.4, 6).translate(0, 1.2, 0),
      new THREE.MeshStandardMaterial({ color: 0x6b5a40, roughness: 0.95 }), OLIVE);
    const oCanopy = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0).translate(0, 2.8, 0),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, flatShading: true }), OLIVE);
    const pTrunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.2, 0.3, 8, 6).translate(0, 4, 0),
      new THREE.MeshStandardMaterial({ color: 0x7a5a3a, roughness: 0.95 }), PINE);
    const pCanopy = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0).translate(0, 9.2, 0),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, flatShading: true }), PINE);
    const rockOut = new THREE.InstancedMesh(makeRockGeometry(THREE, 0),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, flatShading: true }), OUTC);
    const oc = col();
    const nO = scatterLand(OLIVE, 3, 95, 0, 0.5, function (n, x, h, z) {
      const s = 1.0 + rnd() * 0.5;
      oTrunk.setMatrixAt(n, xf(x, h - 0.3, z, s, s, s, 0));
      oCanopy.setMatrixAt(n, xf(x, h - 0.3, z, s * 1.1, s * 0.9, s * 1.1, rnd() * TAU));
      oCanopy.setColorAt(n, oc.set(['#8a9a70', '#7d8f62', '#97a57a'][Math.floor(rnd() * 3)]));
    });
    const nP = scatterLand(PINE, 8, 120, 0, 0.4, function (n, x, h, z) {
      const s = 1.0 + rnd() * 0.4;
      pTrunk.setMatrixAt(n, xf(x, h - 0.3, z, s, s, s, 0));
      pCanopy.setMatrixAt(n, xf(x, h - 0.3, z, s * 1.5, s * 0.8, s * 1.5, 0));
      pCanopy.setColorAt(n, oc.set(['#3f6a3a', '#4a7340', '#36593a'][Math.floor(rnd() * 3)]));
    });
    const nR = scatterLand(OUTC, 5, 120, 0.25, 1.0, function (n, x, h, z) {
      const r = 2 + rnd() * 4;
      rockOut.setMatrixAt(n, xf(x, h - 0.5, z, r, r * 0.6, r * 1.2, rnd() * TAU));
      rockOut.setColorAt(n, oc.set(['#8f8a80', '#7d786f', '#a29d92'][Math.floor(rnd() * 3)]));
    });
    const treeMeshes = [[oTrunk, nO], [oCanopy, nO], [pTrunk, nP], [pCanopy, nP], [rockOut, nR]];
    for (const pair of treeMeshes) {
      const m = pair[0];
      m.count = pair[1];
      m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false;
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
      root.add(m);
    }

    // ---------- islotes en el mar (siluetas cercanas) ----------
    const ISLETS = 24;
    const isletMesh = new THREE.InstancedMesh(makeRockGeometry(THREE, 0),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, flatShading: true }), ISLETS);
    let nIs = 0; tries = 0;
    while (nIs < ISLETS && tries < ISLETS * 60) {
      tries++;
      const ang = rnd() * TAU, rad = 900 + rnd() * 3300;
      const x = Math.cos(ang) * rad, z = Math.sin(ang) * rad;
      if (groundH(x, z) > -4) continue;                  // sólo en el mar
      const r = 20 + rnd() * 70;
      _c.set('#a88c5e');
      isletMesh.setMatrixAt(nIs, xf(x, SEA_Y + r * 0.05, z, r * 1.1, r * 0.5, r * 1.1, rnd() * TAU));
      isletMesh.setColorAt(nIs, _c.set(['#8f7a5e', '#6e6258', '#a68f6c'][Math.floor(rnd() * 3)]));
      nIs++;
    }
    isletMesh.count = nIs;
    isletMesh.castShadow = false; isletMesh.receiveShadow = true;
    isletMesh.frustumCulled = false;
    isletMesh.instanceMatrix.needsUpdate = true;
    if (isletMesh.instanceColor) isletMesh.instanceColor.needsUpdate = true;
    root.add(isletMesh);

    // ---------- Asia Menor al norte: dos cordilleras lejanas (siluetas con niebla) ----------
    const MP = [], MC = [];
    const cNearTop = col('#6f7d92'), cNearBase = col('#4b5a6e');
    const cFarTop = col('#9aa8ba'), cFarBase = col('#7c8aa0');
    function ridgeRow(z, hFn, cTop, cBase) {
      const step = 70, n = 120;
      for (let k = 0; k < n; k++) {
        const x0 = -4200 + k * step, x1 = x0 + step;
        const t0 = hFn(x0), t1 = hFn(x1), b = SEA_Y - 8;
        MP.push(x0, b, z, x0, t0, z, x1, t1, z);
        MP.push(x0, b, z, x1, t1, z, x1, b, z);
        MC.push(cBase.r, cBase.g, cBase.b, cTop.r, cTop.g, cTop.b, cTop.r, cTop.g, cTop.b);
        MC.push(cBase.r, cBase.g, cBase.b, cTop.r, cTop.g, cTop.b, cBase.r, cBase.g, cBase.b);
      }
    }
    ridgeRow(-5200, function (x) {
      return 180 + 520 * Math.pow(ridged(x / 900, 0.6, 4, 61), 1.4) * sstep(4200, 2400, Math.abs(x));
    }, cNearTop, cNearBase);
    ridgeRow(-5900, function (x) {
      return 260 + 700 * Math.pow(ridged(x / 1300, 0.2, 4, 97), 1.3) * sstep(4200, 2400, Math.abs(x));
    }, cFarTop, cFarBase);
    const mtnGeo = new THREE.BufferGeometry();
    mtnGeo.setAttribute('position', new THREE.Float32BufferAttribute(MP, 3));
    mtnGeo.setAttribute('color', new THREE.Float32BufferAttribute(MC, 3));
    const mtnMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, fog: true });
    const mountains = new THREE.Mesh(mtnGeo, mtnMat);
    mountains.frustumCulled = false;
    root.add(mountains);

    // ---------- "hoy": muelle moderno, faro, y columnas con ciervos en la bocana ----------
    const TB = makeBuilder();                      // piedra y hormigón (muelle, faro, columnas)
    const DB = makeBuilder();                      // bronce (ciervos)
    addBox(TB, col('#9aa0a6'), -40, 0.6, -66, 120, 4, 12, 0);       // muelle moderno
    const LH = { x: 130, z: -160, base: SEA_Y + 3 };                 // faro sobre el codo del espigón este
    addCyl(TB, col('#f2efe8'), LH.x, LH.base, LH.z, 2.6, 20);
    addCyl(TB, col('#c0392b'), LH.x, LH.base + 8, LH.z, 2.7, 3.2);
    addCyl(TB, col('#2b2f36'), LH.x, LH.base + 20, LH.z, 2.2, 3.0);
    addCyl(TB, col('#c0392b'), LH.x, LH.base + 23, LH.z, 2.5, 1.0);
    const BRONZE = col('#c98a45');
    for (const d of SITE.deerColumns) {
      const x = d[0], z = d[1], y0 = 10.0 + 0.3;                    // sobre la torrecilla
      addBox(TB, C_MARBLE, x, y0 + 0.4, z, 2.6, 0.8, 2.6, 0);      // base de la columna
      addCyl(TB, C_MARBLE, x, y0 + 0.8, z, 0.75, 12);               // fuste
      addBox(TB, C_MARBLE, x, y0 + 13.2, z, 2.0, 0.8, 2.0, 0);     // capitel
      // ciervo estilizado de pie sobre el capitel (mirando al norte); medidas a escala K
      const yC = y0 + 13.6, K = 1.7;
      const dBox = function (ox, oy, oz, sx, sy, sz) {
        addBox(DB, BRONZE, x + ox * K, yC + oy * K, z + oz * K, sx * K, sy * K, sz * K, 0);
      };
      dBox(0, 2.35, 0, 1.2, 1.1, 2.6);                  // cuerpo
      dBox(0, 3.2, -1.1, 0.5, 1.4, 0.5);                // cuello
      dBox(0, 3.9, -1.8, 0.6, 0.6, 1.0);                // cabeza
      dBox(-0.25, 4.6, -1.8, 0.1, 0.9, 0.1);            // cornamenta
      dBox(0.25, 4.6, -1.8, 0.1, 0.9, 0.1);
      dBox(0, 2.8, 1.5, 0.25, 0.3, 0.5);                // cola
      for (const lx of [-0.42, 0.42]) for (const lz of [-0.95, 0.95]) dBox(lx, 0.95, lz, 0.25, 1.9, 0.25);
    }
    const todayStoneMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0, transparent: true, opacity: 0 });
    const todayStone = new THREE.Mesh(TB.geometry(), todayStoneMat);
    todayStone.castShadow = true; todayStone.receiveShadow = true;
    const bronzeMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.2, transparent: true, opacity: 0 });
    const bronze = new THREE.Mesh(DB.geometry(), bronzeMat);
    bronze.castShadow = true;
    const lampMat = new THREE.MeshBasicMaterial({ color: LAMP_DAY.clone(), transparent: true, opacity: 0 });
    const lamp = new THREE.Mesh(UCYL, lampMat);
    lamp.scale.set(1.6, 2.4, 1.6);
    lamp.position.set(LH.x, LH.base + 21.5, LH.z);
    const todayGroup = new THREE.Group();
    todayGroup.add(todayStone); todayGroup.add(bronze); todayGroup.add(lamp);
    todayGroup.visible = false;
    root.add(todayGroup);

    // ---------- polvo del terremoto alrededor del origen ----------
    const DUST = 900;
    const dustPos = new Float32Array(DUST * 3), dustSeed = new Float32Array(DUST);
    for (let k = 0; k < DUST; k++) {
      const ang = rnd() * TAU, rad = 8 + Math.sqrt(rnd()) * 90;
      dustPos[k * 3] = Math.cos(ang) * rad;
      dustPos[k * 3 + 1] = 0.5 + rnd() * 1.5;
      dustPos[k * 3 + 2] = Math.sin(ang) * rad;
      dustSeed[k] = rnd();
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
    dustGeo.setAttribute('aSeed', new THREE.BufferAttribute(dustSeed, 1));
    const dustU = { uTime: { value: 0 }, uQuake: { value: 0 }, uPx: { value: 70 }, uColor: { value: col('#c8a77a') } };
    const dustMat = new THREE.ShaderMaterial({
      uniforms: dustU, vertexShader: DUST_VS, fragmentShader: POINT_FS,
      transparent: true, depthWrite: false
    });
    const dust = new THREE.Points(dustGeo, dustMat);
    dust.frustumCulled = false;
    dust.visible = false;
    root.add(dust);

    // ---------- actualización por frame (función del estado, sin acumulación) ----------
    function update(s) {
      const tod = fract(s.timeOfDay || 0);
      const wall = s.wall || 0;
      const quake = clamp01(s.quake || 0);
      const today = clamp01(s.today || 0);
      // el sol nace por el este (+X), sube hacia el sur (+Z) y se pone por el oeste (-X)
      const a = (tod - 0.25) * TAU;
      sunDir.set(Math.cos(a), Math.sin(a) * EY, Math.sin(a) * EZ);
      // luna: opuesta en azimut, pero baja
      moonDir.set(-sunDir.x, MOON_Y, -sunDir.z).normalize();
      // creciente: el disco recortado se desplaza en sentido contrario al sol
      tmpV.copy(sunDir).addScaledVector(moonDir, -sunDir.dot(moonDir)).normalize();
      moonCut.copy(moonDir).addScaledVector(tmpV, -0.012).normalize();
      // base para rayos crepusculares
      sunT1.crossVectors(sunDir, upV).normalize();
      sunT2.crossVectors(sunDir, sunT1).normalize();

      const el = sunDir.y;
      const sunVis = sstep(0.0, 0.12, el);           // 1 de día
      const moonVis = sstep(0.0, -0.12, el);         // 1 de noche
      const dayF = sstep(-0.05, 0.3, el);
      const dusk = sunVis * (1 - sstep(0.1, 0.5, el));
      const nightL = sstep(0.12, -0.05, el);         // ventanas y faro encendidos

      keyAt(tod);

      // luz principal: sol de día, luna de noche; sombras sobre la zona de la estatua
      const lightDir = el >= 0 ? sunDir : moonDir;
      sun.position.copy(lightDir).multiplyScalar(SHADOW_DIST);
      sun.position.x += SUN_TARGET.x; sun.position.y += SUN_TARGET.y; sun.position.z += SUN_TARGET.z;
      sun.color.copy(MOON_COL).lerp(tSun, sunVis);
      sun.intensity = kSunI * sunVis + 0.5 * moonVis;
      tHemG.copy(HEM_GROUND_NIGHT).lerp(HEM_GROUND_DAY, dayF);
      hemi.color.copy(tHem);
      hemi.groundColor.copy(tHemG);
      hemi.intensity = 0.28 + 0.5 * dayF;
      renderer.toneMappingExposure = 0.82 + 0.08 * dayF;

      // cielo sigue a la cámara
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
      skyU.uBelow.value.copy(tHor);

      // niebla: del color del horizonte; casi nula a menos de 1.5 km
      scene.fog.color.copy(tHor);
      scene.fog.density = 0.00009 * (1 - 0.6 * moonVis);

      // mar
      waterU.uTime.value = wall;
      waterU.uQuake.value = quake;
      waterU.uMoonF.value = moonVis;
      waterU.uLightDir.value.copy(lightDir);
      waterU.uLightI.value = sun.intensity;
      waterU.uHorizon.value.copy(tHor);
      waterU.uZenith.value.copy(tZen);
      waterU.uFogC.value.copy(tHor);
      waterU.uDeep.value.copy(DEEP_NIGHT).lerp(DEEP_DAY, dayF);
      waterU.uShallow.value.copy(SHALLOW_NIGHT).lerp(SHALLOW_DAY, dayF);

      // ciudad de noche
      winU.uTime.value = wall;
      winU.uNight.value = nightL;
      lampMat.color.copy(LAMP_DAY).lerp(LAMP_NIGHT, nightL);

      // terremoto: polvo que se levanta
      dust.visible = quake > 0.001;
      dustU.uTime.value = wall;
      dustU.uQuake.value = quake;

      // "hoy": aparecen las columnas con ciervos, el muelle y el faro
      todayGroup.visible = today > 0.001;
      todayStoneMat.opacity = today;
      bronzeMat.opacity = today;
      lampMat.opacity = today;
    }

    return {
      update: update,
      sun: sun,
      sunLight: sun,
      sunDirection: sunDir,
      hemiLight: hemi,
      sky: sky
    };
  };
})();
