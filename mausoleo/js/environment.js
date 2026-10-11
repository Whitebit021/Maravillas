// Entorno del Mausoleo: cielo con sol, luna y estrellas; bahía con olas; península de Salmakis con el
// palacio; islote del SE para el castillo; ciudad en anfiteatro (casas en terrazas, calles, teatro
// excavado en la ladera norte, templos, murallas en lo alto, olivos y cipreses, luces de noche);
// recinto sagrado con propileo y el hueco de la fosa en el suelo; polvo del terremoto; y el recinto
// arqueológico moderno con el pueblo de Bodrum (casas blancas) que sustituye parte de la ciudad.
// Todo procedural (geometría, shaders, CanvasTexture dibujada por código).
(function () {
  'use strict';
  const G = window.GIZA;
  const TAU = Math.PI * 2;

  // ---------- utilidades ----------
  function clamp01(x) { return x < 0 ? 0 : (x > 1 ? 1 : x); }
  function fract(x) { return x - Math.floor(x); }
  function sstep(e0, e1, x) { const t = clamp01((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); }
  let rngState = 4711;
  function rnd() { rngState = (rngState * 16807) % 2147483647; return rngState / 2147483647; }
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

  // ---------- geografía (SITE de chapters.js) ----------
  const SITE = G.SITE;
  const SEA_Y = SITE.seaLevel;                       // -1.5
  const PER_HX = SITE.peribolos.halfX, PER_HZ = SITE.peribolos.halfZ;   // 52, 121
  const HOLE = { x0: -30, x1: 20, z0: -18, z1: 18 }; // abertura fija del suelo (la fosa la pone interior)
  const THEA = SITE.theatre, PAL = SITE.palace, CAS = SITE.castle, CITY = SITE.city;
  const PEN = { x: -510, z: 235, rx: 180, rz: 75 };  // península de Salmakis
  const TW_X = 120, TW_Z = 185;                      // llano central alrededor del recinto
  const FENCE_X = 86, FENCE_Z = 150;                 // vallas del recinto moderno
  const TEMPLES = [{ x: 230, z: -300 }, { x: -330, z: -190 }, { x: 560, z: -150 }, { x: -640, z: -420 }];
  const ZONE_B = { x0: 150, x1: 620, z0: 30, z1: 215 }; // barrio que el pueblo moderno sustituye
  const GRID_L = 1800;
  const SHADOW_DIST = 400;
  const MOON_Y = 0.32, SUN_ELEV = 62 * Math.PI / 180;
  const EY = Math.sin(SUN_ELEV), EZ = Math.cos(SUN_ELEV);
  let THEA_YO = 25;                                  // altura de la orquesta del teatro

  function coastZ(x) { const u = x / 900; return 232 + 40 * u * u; }   // bahía en arco

  // terreno sin el teatro ni la península: colinas al norte, llano junto al recinto
  function baseLand(x, z) {
    const d = Math.max(0, -z - 260);
    const span = 0.7 + 0.3 * (1 - sstep(300, 1200, Math.abs(x)));
    const hill = 150 * (1 - Math.exp(-d / 380)) * span;
    const lump = 70 * (fbm(x / 260, z / 260, 4, 7) - 0.45) * sstep(0, 200, d);
    const ridge = 45 * ridged(x / 420, z / 420, 3, 19) * sstep(60, 400, d);
    const low = 0.8 + 3 * fbm(x / 180, z / 180, 3, 3);
    let h = low + hill + lump + ridge;
    const tw = 1 - sstep(0, 40, Math.max(Math.abs(x) - TW_X, Math.abs(z) - TW_Z));
    h += (-1.2 - h) * tw;
    return h;
  }

  // altura del suelo en (x,z): mar, península, islote, teatro excavado, borde del mundo, terraza y hueco
  function H(x, z) {
    let h = baseLand(x, z);
    const cd = z - coastZ(x);
    const S = sstep(-6, 6, cd);
    const seaF = -2.5 - 9 * sstep(0, 260, cd);
    h += (seaF - h) * S;
    const pq = Math.hypot((x - PEN.x) / PEN.rx, (z - PEN.z) / PEN.rz);
    const Pm = 1 - sstep(0.85, 1.0, pq);
    const pel = 5.5 + 1.5 * (1 - pq) + 0.6 * (fbm(x / 60, z / 60, 2, 41) - 0.5);
    h += (pel - h) * Pm;
    // islote SE del castillo: meseta firme y plana (y≈1) de radio ~85 m, unida a la costa por un istmo
    const cq = Math.hypot((x - CAS.x) / 85, (z - CAS.z) / 85);
    const Im = 1 - sstep(0.85, 1.0, cq);
    const isl = 1.0 + 0.25 * (fbm(x / 22, z / 22, 2, 53) - 0.5);
    h += (isl - h) * Im;
    const band = sstep(236, 244, z) * (1 - sstep(292, 300, z));
    const Ist = (1 - sstep(8, 14, Math.abs(x - CAS.x))) * band;
    h += (1.0 - h) * Ist;
    // teatro: cavidad semicircular en la ladera norte con gradas escalonadas
    const tdx = x - THEA.x, tdz = z - THEA.z;
    if (tdz < 4) {
      const rT = Math.hypot(tdx, tdz);
      if (rT < 12) h = THEA_YO - 0.1;
      else if (rT < 74) {
        const k = Math.min(13, Math.floor((rT - 12) / 4.2));
        h = THEA_YO + 0.5 * (k + 1) - 0.2;
      }
    }
    // el mundo se hunde en los bordes para no mostrar un corte en el horizonte
    const fe = Math.max(sstep(1450, 1790, Math.abs(x)), sstep(1450, 1790, Math.abs(z)));
    h += (-12 - h) * fe;
    return h;
  }
  function slopeAt(x, z) {
    return Math.hypot(H(x + 2, z) - H(x - 2, z), H(x, z + 2) - H(x, z - 2)) / 4;
  }
  function nearPt(x, z, p, r) { return Math.hypot(x - p.x, z - p.z) < r; }
  // zonas donde no hay casas
  function houseExcluded(x, z) {
    if (Math.abs(x) < TW_X + 10 && z > -TW_Z - 25 && z < TW_Z + 10) return true;
    if (nearPt(x, z, THEA, 92)) return true;
    if (nearPt(x, z, PAL, 115)) return true;
    if (nearPt(x, z, CAS, 100)) return true;
    for (let i = 0; i < TEMPLES.length; i++) if (nearPt(x, z, TEMPLES[i], 40)) return true;
    if (z > coastZ(x) - 18) return true;
    return false;
  }
  function inZoneB(x, z) { return x > ZONE_B.x0 && x < ZONE_B.x1 && z > ZONE_B.z0 && z < ZONE_B.z1; }
  // ejes de la malla: fino (4 m) junto al recinto, grueso en los bordes; con los cortes exactos
  function stepAt(a) { return a <= 90 ? 4 : (a <= 400 ? 12 : (a <= 1000 ? 30 : 100)); }
  function axisCoords() {
    const vals = [];
    let v = -GRID_L;
    while (v < GRID_L - 1e-6) { vals.push(v); v += stepAt(Math.abs(v)); }
    vals.push(GRID_L);
    const extra = [-HOLE.x0, HOLE.x0, HOLE.x1, -HOLE.x1, HOLE.z0, HOLE.z1, -HOLE.z0, -HOLE.z1,
      PER_HX, -PER_HX, PER_HZ, -PER_HZ, TW_X, -TW_X, TW_Z, -TW_Z];
    for (let i = 0; i < extra.length; i++) vals.push(extra[i]);
    vals.sort(function (a, b) { return a - b; });
    const out = [];
    for (let i = 0; i < vals.length; i++) if (!out.length || vals[i] - out[out.length - 1] > 0.05) out.push(vals[i]);
    return out;
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
    '  sky += vec3(0.012, 0.008, 0.0) * hzBand * wob;',
    '  float sd = dot(d, uSunDir);',
    '  float sdc = max(sd, 0.0);',
    '  float cr = cos(uSunAng);',
    '  float disc = smoothstep(cr - 0.00003, cr + 0.00001, sd);',
    '  float halo = pow(sdc, 900.0) * 0.9 + pow(sdc, 60.0) * 0.35 + pow(sdc, 6.0) * 0.12;',
    '  sky += uSunCol * (disc * 5.0 + halo) * uSunVis;',
    '  float ang = atan(dot(d, uSunT2), dot(d, uSunT1));',
    '  float rays = pow(0.5 + 0.5 * sin(ang * 23.0 + vnoise3(vec3(ang * 4.0, 0.5, 0.0)) * 7.0), 5.0);',
    '  rays *= 0.6 + 0.4 * vnoise3(vec3(ang * 11.0, 3.0, 1.0));',
    '  float fall = exp(-(1.0 - sdc) * 9.0);',
    '  sky += uSunCol * rays * fall * uDusk * 0.45 * smoothstep(-0.1, 0.25, h);',
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
    '  if (vW.x > -30.0 && vW.x < 20.0 && vW.z > -18.0 && vW.z < 18.0) discard;',
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
    '  vec3 col = mix(uDeep, sky, clamp(fres * 1.3, 0.0, 1.0));',
    '  float rl = max(dot(reflect(-L, n), V), 0.0);',
    '  float spec = pow(rl, 90.0) * 1.2 + pow(rl, 8.0) * 0.06;',
    '  col += uLightCol * spec * uLightI * 1.5;',
    '  gl_FragColor = vec4(toSRGB(col), 1.0);',
    '}'
  ].join('\n');
  const DUST_VS = [
    'uniform float uTime; uniform vec3 uCenter; uniform float uPx; uniform float uAlpha;',
    'varying float vA;',
    'void main() {',
    '  vec3 drift = vec3(uTime * 1.4, uTime * 0.18, uTime * 0.6);',
    '  vec3 q = position * 120.0 + drift - uCenter + 60.0;',
    '  vec3 off = mod(q, 120.0) - 60.0;',
    '  vec3 wp = uCenter + off;',
    '  vec4 mv = viewMatrix * vec4(wp, 1.0);',
    '  gl_Position = projectionMatrix * mv;',
    '  gl_PointSize = clamp(uPx / -mv.z, 1.0, 10.0);',
    '  vA = uAlpha * (1.0 - smoothstep(20.0, 60.0, length(off))) * (0.6 + 0.4 * sin(uTime * 0.8 + position.x * 40.0));',
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
  // luces de las casas de noche
  const LIGHT_VS = [
    'uniform float uTime; uniform float uNight; uniform float uPx;',
    'varying float vA;',
    'void main() {',
    '  vec4 mv = modelViewMatrix * vec4(position, 1.0);',
    '  gl_Position = projectionMatrix * mv;',
    '  gl_PointSize = clamp(uPx / -mv.z, 1.5, 9.0);',
    '  float fl = 0.8 + 0.2 * sin(uTime * 2.0 + position.x * 0.37 + position.z * 0.21);',
    '  vA = uNight * fl;',
    '}'
  ].join('\n');
  // polvo del terremoto: nubes bajas que derivan
  const QUAKE_VS = [
    'uniform float uTime; uniform float uPx; uniform float uAlpha;',
    'varying float vA;',
    'void main() {',
    '  float ph = fract(sin(dot(position.xz, vec2(12.9898, 78.233))) * 43758.5453) * 6.2831;',
    '  vec3 p = position + vec3(sin(uTime * 0.4 + ph) * 12.0, sin(uTime * 0.7 + ph * 1.3) * 3.0, cos(uTime * 0.3 + ph * 0.7) * 12.0);',
    '  vec4 mv = modelViewMatrix * vec4(p, 1.0);',
    '  gl_Position = projectionMatrix * mv;',
    '  gl_PointSize = clamp(uPx / -mv.z, 3.0, 70.0);',
    '  vA = uAlpha * (0.55 + 0.45 * sin(uTime * 1.3 + ph * 3.0));',
    '}'
  ].join('\n');
  const ENV_VS = 'varying vec3 vD; void main() { vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
  const ENV_FS = 'varying vec3 vD; void main() { float h = normalize(vD).y; gl_FragColor = vec4(mix(vec3(0.62, 0.52, 0.40), vec3(0.45, 0.62, 0.86), smoothstep(-0.1, 0.6, h)), 1.0); }';

  // ---------- texturas dibujadas por código ----------
  function makeEarthTexture(THREE) {
    // manchas de tierra, caliza, hierba seca y matorral verde mediterráneo (tile de 16 m)
    const S = 512;
    const cv = document.createElement('canvas'); cv.width = cv.height = S;
    const g = cv.getContext('2d');
    g.fillStyle = '#a08a62'; g.fillRect(0, 0, S, S);
    const cols = ['#c9b48a', '#d8c79b', '#8f9a58', '#7f8a4e', '#8c6d4c', '#6a7d45', '#b8a078', '#9aa266'];
    for (let k = 0; k < 900; k++) {
      const x = rnd() * S, y = rnd() * S, r = 4 + rnd() * 26;
      g.globalAlpha = 0.35 + 0.4 * rnd();
      g.fillStyle = cols[Math.floor(rnd() * cols.length)];
      g.beginPath(); g.ellipse(x, y, r, r * (0.5 + 0.5 * rnd()), rnd() * 3, 0, TAU); g.fill();
      // repetición en los bordes para que el tile no tenga costuras
      if (x < 30) { g.beginPath(); g.ellipse(x + S, y, r, r * 0.7, 0, 0, TAU); g.fill(); }
      if (y < 30) { g.beginPath(); g.ellipse(x, y + S, r, r * 0.7, 0, 0, TAU); g.fill(); }
    }
    g.globalAlpha = 1;
    const img = g.getImageData(0, 0, S, S), d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const n = (rnd() - 0.5) * 26;
      d[i] += n; d[i + 1] += n; d[i + 2] += n * 0.8;
    }
    g.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.encoding = THREE.sRGBEncoding;
    return tex;
  }
  function makeStoneTexture(THREE) {
    // sillares de 1 m (64 px = 4 m / 4 sillares), juntas más oscuras y hiladas alternas
    const S = 256;
    const cv = document.createElement('canvas'); cv.width = cv.height = S;
    const g = cv.getContext('2d');
    const img = g.createImageData(S, S), d = img.data;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const i = (y * S + x) * 4;
      const off = (Math.floor(y / 64) % 2) * 32;
      const jx = (x + off) % 64, jy = y % 64;
      const joint = (jx < 2.5 || jy < 2.5);
      const v = joint ? 150 + 10 * rnd() : 208 + 24 * (rnd() - 0.5);
      d[i] = v; d[i + 1] = v * 0.96; d[i + 2] = v * 0.86; d[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(4, 4);                 // uv = x/16 -> 4 m por repetición
    tex.encoding = THREE.sRGBEncoding;
    return tex;
  }
  function makeSignTexture(THREE) {
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 160;
    const g = cv.getContext('2d');
    g.fillStyle = '#e9dfc7'; g.fillRect(0, 0, 512, 160);
    g.strokeStyle = '#5b4426'; g.lineWidth = 10; g.strokeRect(5, 5, 502, 150);
    g.fillStyle = '#3b2c18';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = 'bold 46px Arial, sans-serif';
    g.fillText('ZONA ARQUEOLÓGICA', 256, 56);
    g.font = 'bold 30px Arial, sans-serif';
    g.fillText('Recinto del Mausoleo · Halicarnaso', 256, 98);
    g.font = '24px Arial, sans-serif';
    g.fillStyle = '#7a1f1a';
    g.fillText('Prohibido pisar la excavación', 256, 134);
    const tex = new THREE.CanvasTexture(cv);
    tex.encoding = THREE.sRGBEncoding;
    return tex;
  }

  // ---------- geometría fusionada ----------
  function Merger(THREE, base) {
    this.T = THREE; this.B = base;
    this.P = []; this.N = []; this.C = [];
    this.m = new THREE.Matrix4(); this.n3 = new THREE.Matrix3();
    this.v = new THREE.Vector3(); this.q = new THREE.Quaternion(); this.e = new THREE.Euler();
    this.p = new THREE.Vector3(); this.s = new THREE.Vector3();
  }
  Merger.prototype.add = function (geo, x, y, z, rx, ry, rz, sx, sy, sz, col) {
    this.p.set(x, y, z); this.e.set(rx || 0, ry || 0, rz || 0); this.q.setFromEuler(this.e);
    this.s.set(sx, sy, sz); this.m.compose(this.p, this.q, this.s); this.n3.getNormalMatrix(this.m);
    const pa = geo.attributes.position.array, na = geo.attributes.normal.array;
    const r = col.r, g = col.g, b = col.b, v = this.v;
    for (let i = 0; i < pa.length; i += 3) {
      v.set(pa[i], pa[i + 1], pa[i + 2]).applyMatrix4(this.m); this.P.push(v.x, v.y, v.z);
      v.set(na[i], na[i + 1], na[i + 2]).applyMatrix3(this.n3).normalize(); this.N.push(v.x, v.y, v.z);
      this.C.push(r, g, b);
    }
  };
  Merger.prototype.box = function (cx, cy, cz, w, h, d, col, ry) { this.add(this.B.box, cx, cy, cz, 0, ry || 0, 0, w, h, d, col); };
  Merger.prototype.boxR = function (cx, cy, cz, w, h, d, rx, ry, col) { this.add(this.B.box, cx, cy, cz, rx, ry || 0, 0, w, h, d, col); };
  Merger.prototype.cyl = function (cx, y0, cz, r, h, col) { this.add(this.B.cyl, cx, y0 + h / 2, cz, 0, 0, 0, r, h, r, col); };
  Merger.prototype.lying = function (cx, cy, cz, r, len, ry, col) { this.add(this.B.cyl, cx, cy, cz, Math.PI / 2, ry, 0, r, len, r, col); };
  // cara plana con normal explícita (dos triángulos); a, b, c, d en orden
  Merger.prototype.quad = function (a, b, c, d, col, nx, ny, nz) {
    const pts = [a, b, c, a, c, d];
    for (let i = 0; i < 6; i++) {
      const p = pts[i];
      this.P.push(p[0], p[1], p[2]); this.N.push(nx, ny, nz); this.C.push(col.r, col.g, col.b);
    }
  };
  Merger.prototype.build = function () {
    const T = this.T, g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(this.P, 3));
    g.setAttribute('normal', new T.Float32BufferAttribute(this.N, 3));
    g.setAttribute('color', new T.Float32BufferAttribute(this.C, 3));
    return g;
  };

  function instMesh(THREE, geo, mat, items, parent) {
    const mesh = new THREE.InstancedMesh(geo, mat, Math.max(1, items.length));
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      q.setFromAxisAngle(up, it.ry || 0); p.set(it.x, it.y, it.z); s.set(it.w, it.h, it.d);
      m.compose(p, q, s); mesh.setMatrixAt(i, m);
      if (it.col) mesh.setColorAt(i, it.col);
    }
    mesh.count = items.length;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.frustumCulled = false;
    parent.add(mesh);
    return mesh;
  }
  function pointsGeo(THREE, arr) {
    const g = new THREE.BufferGeometry();
    const a = arr.length ? arr : [0, -5000, 0];   // lista vacía: un punto lejano y oculto
    g.setAttribute('position', new THREE.Float32BufferAttribute(a, 3));
    return g;
  }

  // ---------- terreno: una malla con grupos (suelo / terraza de piedra) y el hueco de la fosa ----------
  function buildTerrain(THREE) {
    const xs = axisCoords(), zs = axisCoords();
    const NX = xs.length, NZ = zs.length, N = NX * NZ;
    const P = new Float32Array(N * 3), C = new Float32Array(N * 3), U = new Float32Array(N * 2);
    const cDry = new THREE.Color('#8f9064'), cYel = new THREE.Color('#b59a68');
    const cRock = new THREE.Color('#7b6d5b'), cSea = new THREE.Color('#4f6058');
    const cStone = new THREE.Color('#d9cdb0'), tc = new THREE.Color();
    const cGreen = new THREE.Color('#7d8c4a'), cPale = new THREE.Color('#c9b98f');
    for (let j = 0; j < NZ; j++) {
      for (let i = 0; i < NX; i++) {
        const x = xs[i], z = zs[j], idx = j * NX + i;
        const h = H(x, z), sl = slopeAt(x, z);
        P[idx * 3] = x; P[idx * 3 + 1] = h; P[idx * 3 + 2] = z;
        U[idx * 2] = x / 16; U[idx * 2 + 1] = z / 16;
        tc.copy(cDry).lerp(cYel, clamp01(fbm(x / 60, z / 60, 3, 91) * 1.4 - 0.2));
        tc.lerp(cGreen, sstep(0.55, 0.8, fbm(x / 90, z / 90, 3, 61)) * sstep(60, 20, h) * 0.75);
        // terrazas de cultivo en las laderas: bandas claras cada ~2.4 m de altura
        tc.lerp(cPale, sstep(0.12, 0.22, sl) * (1 - sstep(0.4, 0.5, sl)) * (fract(h / 2.4) < 0.45 ? 1 : 0) * 0.5);
        tc.lerp(cRock, Math.max(sstep(0.35, 0.75, sl), sstep(60, 110, h) * 0.7));
        if (h < 0) tc.lerp(cSea, clamp01(-h / 6));
        if (Math.abs(x) < PER_HX && Math.abs(z) < PER_HZ) tc.copy(cStone);
        C[idx * 3] = tc.r; C[idx * 3 + 1] = tc.g; C[idx * 3 + 2] = tc.b;
      }
    }
    const ground = [], stone = [];
    for (let j = 0; j < NZ - 1; j++) {
      for (let i = 0; i < NX - 1; i++) {
        const cx = (xs[i] + xs[i + 1]) / 2, cz = (zs[j] + zs[j + 1]) / 2;
        if (cx > HOLE.x0 && cx < HOLE.x1 && cz > HOLE.z0 && cz < HOLE.z1) continue;   // hueco: sin suelo
        const a = j * NX + i, b = (j + 1) * NX + i, c = j * NX + i + 1, d = (j + 1) * NX + i + 1;
        const tgt = (Math.abs(cx) < PER_HX && Math.abs(cz) < PER_HZ) ? stone : ground;
        tgt.push(a, b, c, b, d, c);
      }
    }
    const idxArr = new Uint32Array(ground.length + stone.length);
    idxArr.set(ground, 0); idxArr.set(stone, ground.length);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(P, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(C, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(U, 2));
    geo.setIndex(new THREE.BufferAttribute(idxArr, 1));
    geo.addGroup(0, ground.length, 0);
    geo.addGroup(ground.length, stone.length, 1);
    geo.computeVertexNormals();
    return geo;
  }

  // ---------- ciudad: trama de calles (cintas) ----------
  function ribbon(M, pts, hw, col) {
    for (let k = 0; k < pts.length - 1; k++) {
      const a = pts[k], b = pts[k + 1];
      const dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz);
      if (len < 0.01) continue;
      const px = -dz / len * hw, pz = dx / len * hw;
      const y1 = a[2] + 0.3, y2 = b[2] + 0.3;
      M.quad([a[0] + px, y1, a[1] + pz], [a[0] - px, y1, a[1] - pz],
        [b[0] - px, y2, b[1] - pz], [b[0] + px, y2, b[1] + pz], col, 0, 1, 0);
    }
  }

  // ---------- recinto: vallas de hoy, pasarela de madera ----------
  function fenceCoords() {
    // puntos a lo largo del perímetro de la valla (cada 8 m), con hueco en la puerta sur
    const pts = [];
    const add = function (x, z) { pts.push([x, z]); };
    const sides = [
      [[-FENCE_X, -FENCE_Z], [FENCE_X, -FENCE_Z]],
      [[FENCE_X, -FENCE_Z], [FENCE_X, FENCE_Z]],
      [[FENCE_X, FENCE_Z], [8, FENCE_Z]],
      [[-8, FENCE_Z], [-FENCE_X, FENCE_Z]],
      [[-FENCE_X, FENCE_Z], [-FENCE_X, -FENCE_Z]]
    ];
    for (let s = 0; s < sides.length; s++) {
      const a = sides[s][0], b = sides[s][1];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const n = Math.max(1, Math.round(len / 8));
      for (let k = 0; k < n; k++) { const u = k / n; add(a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u); }
    }
    return pts;
  }

  // ---------- textura de los olivos y cipreses ----------
  function treeGeoms(THREE) {
    const trunk = new THREE.CylinderGeometry(0.22, 0.34, 2.6, 6); trunk.translate(0, 1.3, 0);
    const canopy = new THREE.IcosahedronGeometry(1.7, 0);
    const p = canopy.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const k = 0.8 + 0.4 * fract(Math.sin(x * 12.9 + y * 78.2 + z * 37.7) * 43758.5);
      p.setXYZ(i, x * k, y * k * 0.8, z * k);
    }
    canopy.translate(0, 3.6, 0); canopy.computeVertexNormals();
    const cyp = new THREE.ConeGeometry(0.9, 8.5, 7); cyp.translate(0, 4.25, 0);
    return { trunk: trunk, canopy: canopy, cyp: cyp };
  }

  // ---------- componente principal ----------
  G.createEnvironment = function (ctx) {
    const THREE = ctx.THREE, scene = ctx.scene, camera = ctx.camera, renderer = ctx.renderer;
    const root = new THREE.Group(); scene.add(root);
    THEA_YO = baseLand(THEA.x, THEA.z);
    const col = function (hex) { return new THREE.Color(hex); };

    // ---------- paleta por hora (tod 0..1) ----------
    const MOON_COL = col('#6f8fe0');
    const DEEP_DAY = col('#2f5f5a'), DEEP_NIGHT = col('#081018');
    const FOG_DAY = col('#d9c4a0'), DUST_FOG = col('#a68660');
    const NIGHT_ZEN = col('#02040c'), NIGHT_HOR = col('#0b1426');
    const HEM_GROUND_DAY = col('#8a6a44'), HEM_GROUND_NIGHT = col('#2a3050');
    const KEYS = [
      [0.00, '#02040c', '#0b1426', '#6f8fe0', 0.0, '#1a2550'],
      [0.18, '#02040c', '#0b1426', '#6f8fe0', 0.0, '#1d2a58'],
      [0.235, '#2b3c7a', '#ff8a7a', '#ffa070', 1.43, '#7a6a9a'],
      [0.30, '#4f86c4', '#f4cfa6', '#ffd2a0', 2.47, '#b8c4d8'],
      [0.38, '#2a6fd6', '#d9dcd8', '#fff0d6', 2.99, '#c9d8ea'],
      [0.50, '#2a6fd6', '#bcd8ee', '#fff2dc', 3.25, '#d0dde8'],
      [0.62, '#3f7dc2', '#d6d6cc', '#ffe6b8', 2.99, '#c9d8ea'],
      [0.72, '#34509a', '#ffb070', '#ffb050', 2.08, '#f0b880'],
      [0.765, '#3a3a7a', '#ff9a2a', '#ffa040', 1.17, '#c07a6a'],
      [0.80, '#1c2050', '#c0583a', '#ff7a3a', 0.195, '#6a4a5a'],
      [0.86, '#02040c', '#0b1426', '#6f8fe0', 0.0, '#1f2a55'],
      [1.00, '#02040c', '#0b1426', '#6f8fe0', 0.0, '#1a2550']
    ].map(function (k) {
      return { t: k[0], zen: col(k[1]), hor: col(k[2]), sun: col(k[3]), sI: k[4], hem: col(k[5]) };
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

    // niebla muy suave (solo a partir de ~2 km)
    scene.fog = new THREE.FogExp2(FOG_DAY.getHex(), 0.00006);

    // ---------- sol / luna con sombras ajustadas al mausoleo (±65 m) ----------
    const sun = new THREE.DirectionalLight(0xffffff, 2);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 2048; sun.shadow.mapSize.height = 2048;
    const sc = sun.shadow.camera;
    sc.left = -65; sc.right = 65; sc.top = 65; sc.bottom = -65; sc.near = 150; sc.far = 650;
    sc.updateProjectionMatrix();
    sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.15;
    sun.target.position.set(0, 0, 0);
    root.add(sun); root.add(sun.target);
    const hemi = new THREE.HemisphereLight(0xc4dcff, 0x7a6244, 0.4);
    root.add(hemi);

    // mapa de entorno (cielo degradado) para el mármol pulido
    const envScene = new THREE.Scene();
    envScene.add(new THREE.Mesh(new THREE.SphereGeometry(100, 16, 8),
      new THREE.ShaderMaterial({ side: THREE.BackSide, vertexShader: ENV_VS, fragmentShader: ENV_FS })));
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envRT = pmrem.fromScene(envScene, 0.04);
    pmrem.dispose();

    // ---------- materiales ----------
    const earthTex = makeEarthTexture(THREE), stoneTex = makeStoneTexture(THREE), signTex = makeSignTexture(THREE);
    const matGround = new THREE.MeshStandardMaterial({ vertexColors: true, map: earthTex, roughness: 0.97, metalness: 0 });
    const matTerrace = new THREE.MeshStandardMaterial({ vertexColors: true, map: stoneTex, roughness: 0.9, metalness: 0 });
    const matMarble = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.42, metalness: 0, envMap: envRT.texture, envMapIntensity: 0.45, side: THREE.DoubleSide });
    const matBuild = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0, side: THREE.DoubleSide });
    const matRoad = new THREE.MeshStandardMaterial({ color: col('#b9a886'), roughness: 0.95, side: THREE.DoubleSide });
    const matHouse = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
    const matModern = new THREE.MeshStandardMaterial({ color: col('#f5f4ee'), roughness: 0.8 });
    const matTree = new THREE.MeshStandardMaterial({ color: col('#6f7f4c'), roughness: 0.9, flatShading: true });
    const matTrunk = new THREE.MeshStandardMaterial({ color: col('#6b5238'), roughness: 0.95 });
    const matCypress = new THREE.MeshStandardMaterial({ color: col('#2f4d2e'), roughness: 0.9, flatShading: true });
    const matSign = new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.7, side: THREE.DoubleSide });

    // ---------- terreno y mar ----------
    const terGeo = buildTerrain(THREE);
    const terrain = new THREE.Mesh(terGeo, [matGround, matTerrace]);
    terrain.receiveShadow = true;
    root.add(terrain);

    const waterU = {
      uTime: { value: 0 }, uLightDir: { value: new THREE.Vector3(0, 1, 0) },
      uLightCol: { value: sun.color }, uLightI: { value: 0 },
      uHorizon: { value: new THREE.Color() }, uZenith: { value: new THREE.Color() },
      uDeep: { value: new THREE.Color('#2f5f5a') }
    };
    const waterMat = new THREE.ShaderMaterial({ uniforms: waterU, vertexShader: WATER_VS, fragmentShader: WATER_FS });
    const seaGeo = new THREE.PlaneGeometry(9000, 9000, 1, 1);
    seaGeo.rotateX(-Math.PI / 2); seaGeo.translate(0, SEA_Y, 0);
    const sea = new THREE.Mesh(seaGeo, waterMat);
    root.add(sea);
    // fondo oscuro bajo el hueco de la fosa (el agua no se ve por la abertura)
    const pitFloor = new THREE.Mesh(new THREE.PlaneGeometry(58, 44), new THREE.MeshStandardMaterial({ color: col('#2d241b'), roughness: 1 }));
    pitFloor.rotation.x = -Math.PI / 2; pitFloor.position.set(-5, -12, 0);
    pitFloor.receiveShadow = true;
    root.add(pitFloor);

    // ---------- geometría de piedra: recinto, propileo, murallas, templos, palacio, teatro ----------
    const BASE = {
      box: new THREE.BoxGeometry(1, 1, 1).toNonIndexed(),
      cyl: new THREE.CylinderGeometry(1, 1, 1, 10, 1, false).toNonIndexed()
    };
    const C_WALL = col('#d6cbb0'), C_CREST = col('#b8ad8e'), C_THEA = col('#d9ccab');
    const C_MARBLE = col('#efe9dd'), C_MARBLE2 = col('#e6dfcc'), C_ROOF = col('#b5573a');
    const C_PAL = col('#e2d6bb'), C_DARK = col('#8d8270'), C_METAL = col('#6d7177'), C_WOOD = col('#8a6038');
    const C_ROAD = col('#b9a886');
    const SB = new Merger(THREE, BASE);     // piedra general (muros, teatro, calles de madera...)
    const MB = new Merger(THREE, BASE);     // mármol pulido (templos, palacio, propileo)
    const RD = new Merger(THREE, BASE);     // calles
    const TD = new Merger(THREE, BASE);     // hoy: vallas, pasarela, columnas tumbadas, postes

    // recinto sagrado: muro bajo con hueco al sur
    const hx = PER_HX, hz = PER_HZ, wt = 1.4, wh = 1.6;
    SB.box(0, wh / 2, -hz, 2 * hx + wt, wh, wt, C_WALL);
    SB.box(-(hx + 6) / 2, wh / 2, hz, hx - 6, wh, wt, C_WALL);
    SB.box((hx + 6) / 2, wh / 2, hz, hx - 6, wh, wt, C_WALL);
    SB.box(hx, wh / 2, 0, wt, wh, 2 * hz, C_WALL);
    SB.box(-hx, wh / 2, 0, wt, wh, 2 * hz, C_WALL);
    // propileo de entrada: dos filas de columnas y un techo
    for (const cz of [GATE_ROW_A(), GATE_ROW_B()]) {
      for (const cx of [-12, -8, 8, 12]) MB.cyl(cx, 0, cz, 0.5, 5.5, C_MARBLE);
      MB.box(0, 5.9, cz, 26, 0.8, 1.6, C_MARBLE2);
      for (const cx of [-12, -8, 8, 12]) MB.box(cx, 6.5, cz, 1.2, 0.5, 1.2, C_MARBLE2);
    }
    MB.box(0, 6.8, (GATE_ROW_A() + GATE_ROW_B()) / 2, 27, 0.8, 12.5, C_MARBLE2);

    // murallas en lo alto de la ladera (crestería norte)
    const wz = function (x) { return -600 + 30 * Math.sin(x / 180); };
    for (let x = -900; x <= 900; x += 6) {
      const Hc = H(x, wz(x));
      SB.box(x, Hc - 0.5, wz(x), 6.1, 11, 4, C_CREST);
    }
    for (let x = -900; x <= 900; x += 90) {
      const Hc = H(x, wz(x));
      SB.box(x, Hc + 2, wz(x), 7.5, 14, 7.5, C_CREST);
    }

    // teatro: gradas semicirculares excavadas en la ladera norte (orquesta a THEA_YO)
    const TH_N = 52, TH_R0 = 12, TH_STEP = 4.2, TH_K = 14;
    for (let k = 0; k < TH_K; k++) {
      const ri = TH_R0 + k * TH_STEP, ro = ri + TH_STEP;
      const yk = THEA_YO + 0.5 * (k + 1), ykm = THEA_YO + 0.5 * k;
      for (let a = 0; a < TH_N; a++) {
        const t0 = Math.PI + a * Math.PI / TH_N, t1 = Math.PI + (a + 1) * Math.PI / TH_N;
        const c0 = Math.cos(t0), s0 = Math.sin(t0), c1 = Math.cos(t1), s1 = Math.sin(t1);
        const pt = function (r, c, s, y) { return [THEA.x + r * c, y, THEA.z + r * s]; };
        SB.quad(pt(ri, c0, s0, yk), pt(ro, c0, s0, yk), pt(ro, c1, s1, yk), pt(ri, c1, s1, yk), C_THEA, 0, 1, 0);
        if (k > 0) {
          // contrahuella: cara hacia la orquesta
          SB.quad(pt(ri, c0, s0, ykm), pt(ri, c0, s0, yk), pt(ri, c1, s1, yk), pt(ri, c1, s1, ykm), C_THEA, -(c0 + c1) / 2, 0, -(s0 + s1) / 2);
        }
      }
    }

    // templos de la ciudad: basamento, 12 columnas, arquitrabe y tejado a dos aguas
    for (const T of TEMPLES) {
      const yb = H(T.x, T.z) - 4;
      const top = yb + 3.6;
      MB.box(T.x, (yb + top) / 2, T.z, 24, top - yb, 12, C_MARBLE2);
      for (let i = 0; i < 6; i++) {
        const cx = T.x - 10.5 + i * 4.2;
        MB.cyl(cx, top, T.z - 4.4, 0.7, 8, C_MARBLE);
        MB.cyl(cx, top, T.z + 4.4, 0.7, 8, C_MARBLE);
      }
      MB.box(T.x, top + 8.4, T.z, 24.6, 1.4, 12.6, C_MARBLE2);
      const ang = Math.atan(3.2 / 6.3);
      MB.boxR(T.x, top + 9.8, T.z - 3.1, 24.8, 0.6, 7.4, ang, 0, C_ROOF);
      MB.boxR(T.x, top + 9.8, T.z + 3.1, 24.8, 0.6, 7.4, -ang, 0, C_ROOF);
    }

    // palacio de Mausolo en la península de Salmakis
    {
      const yb = H(PAL.x, PAL.z) - 2.5;
      MB.box(PAL.x, yb + 1.5, PAL.z, 92, 3, 48, C_PAL);
      for (let i = 0; i < 10; i++) {
        const cx = PAL.x - 40 + i * 8.9;
        MB.cyl(cx, yb + 3, PAL.z - 20, 0.9, 9, C_MARBLE);
        MB.cyl(cx, yb + 3, PAL.z + 20, 0.9, 9, C_MARBLE);
      }
      MB.box(PAL.x, yb + 12.9, PAL.z, 92, 1.8, 46, C_PAL);
      MB.box(PAL.x, yb + 7.5, PAL.z, 64, 9, 26, C_PAL);
      MB.box(PAL.x, yb + 13.8, PAL.z, 70, 1.2, 32, C_ROOF);
    }

    // recinto moderno (hoy): vallas, pasarela de madera, columnas tumbadas y el letrero
    const fp = fenceCoords();
    for (let i = 0; i < fp.length; i += 1) {
      const x = fp[i][0], z = fp[i][1];
      TD.box(x, H(x, z) + 0.9, z, 0.12, 1.8, 0.12, C_METAL);
    }
    for (let i = 0; i < fp.length - 1; i++) {
      const ax = fp[i][0], az = fp[i][1], bx = fp[i + 1][0], bz = fp[i + 1][1];
      const len = Math.hypot(bx - ax, bz - az);
      if (len < 0.5 || len > 12) continue;
      const ry = Math.atan2(-(bz - az), bx - ax);
      const mx = (ax + bx) / 2, mz = (az + bz) / 2;
      TD.add(BASE.box, mx, H(mx, mz) + 0.9, mz, 0, ry, 0, len, 0.06, 0.06, C_METAL);
      TD.add(BASE.box, mx, H(mx, mz) + 1.5, mz, 0, ry, 0, len, 0.05, 0.05, C_METAL);
    }
    // pasarela: desde la puerta sur hasta un anillo alrededor de la fosa (nunca en |x|<25, |z|<20)
    const plank = function (x0, z0, x1, z1) {
      const len = Math.hypot(x1 - x0, z1 - z0);
      const ry = Math.atan2(-(z1 - z0), x1 - x0);
      TD.add(BASE.box, (x0 + x1) / 2, 0.06, (z0 + z1) / 2, 0, ry, 0, len, 0.12, 2.2, C_WOOD);
    };
    plank(0, GATE_ROW_A() - 6, 0, 30);
    plank(-42, 30, 32, 30); plank(-42, -30, 32, -30);
    plank(-42, -30, -42, 30); plank(32, -30, 32, 30);
    // columnas tumbadas del recinto
    const lyingAt = [[-40, -75], [42, -40], [-60, 40], [60, 70], [-35, 95], [46, -100]];
    for (let i = 0; i < lyingAt.length; i++) {
      TD.lying(lyingAt[i][0], 0.9, lyingAt[i][1], 0.9, 6, i * 0.7, C_MARBLE2);
    }
    // letrero
    TD.box(-44 - 3.4, 1.8, 134, 0.2, 3.6, 0.2, C_METAL);
    TD.box(-44 + 3.4, 1.8, 134, 0.2, 3.6, 0.2, C_METAL);

    // islote SE: bloques sueltos en el borde (vacío, sin construcciones)
    const rockGeo = new THREE.IcosahedronGeometry(1, 1);
    {
      const rp = rockGeo.attributes.position;
      for (let i = 0; i < rp.count; i++) {
        const x = rp.getX(i), y = rp.getY(i), z = rp.getZ(i);
        const k = 0.75 + 0.45 * fract(Math.sin(x * 12.9 + y * 78.2 + z * 37.7) * 43758.5);
        rp.setXYZ(i, x * k, y * k * 0.7, z * k);
      }
      rockGeo.computeVertexNormals();
    }
    const rockItems = [];
    for (let k = 0; k < 46; k++) {
      const ang = rnd() * TAU, rr = (0.8 + 0.22 * rnd()) * 85;
      const x = CAS.x + Math.cos(ang) * rr, z = CAS.z + Math.sin(ang) * rr;
      const r = 2 + rnd() * 4.5;
      rockItems.push({ x: x, y: H(x, z) + r * 0.1, z: z, w: r, h: r * 0.8, d: r, ry: rnd() * TAU, col: col(rnd() < 0.5 ? '#7b6d5b' : '#8f7a5e') });
    }
    const rockMesh = instMesh(THREE, rockGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, flatShading: true }), rockItems, root);
    rockMesh.castShadow = true;

    // ---------- calles de la ciudad ----------
    function streetPts(points) {
      // devuelve tramos [x,z,h] válidos (sin recinto, sin teatro, sin mar, pendiente suave)
      const out = [];
      let run = [];
      for (let i = 0; i < points.length; i++) {
        const x = points[i][0], z = points[i][1];
        const ok = !(Math.abs(x) < TW_X + 10 && z > -TW_Z - 25 && z < TW_Z + 10) && !nearPt(x, z, THEA, 80) &&
          z < coastZ(x) - 6 && slopeAt(x, z) < 0.45 && H(x, z) > 0.8;
        if (ok) run.push([x, z, H(x, z)]);
        else { if (run.length > 1) out.push(run); run = []; }
      }
      if (run.length > 1) out.push(run);
      return out;
    }
    const streetLines = [];
    const ewZ = [-225, -265, -305, -400, -450, -500, -550, 170, 205];
    for (let k = 0; k < ewZ.length; k++) {
      const pts = [];
      for (let x = -900; x <= 900; x += 16) pts.push([x, ewZ[k]]);
      streetLines.push(streetPts(pts));
    }
    for (let x = -800; x <= 800; x += 80) {
      const pts = [];
      for (let z = -700; z <= 230; z += 14) pts.push([x, z]);
      streetLines.push(streetPts(pts));
    }
    for (const group of streetLines) for (const run of group) ribbon(RD, run, 1.8, C_ROAD);

    // ---------- casas en manzanas (encaladas y ocres con tejado de teja); barrio moderno en la zona B ----------
    const NS_X = [], EW_Z = [-225, -265, -305, -400, -450, -500, -550, 170, 205];
    for (let x = -800; x <= 800; x += 80) NS_X.push(x);
    const nearLine = function (v, arr) { for (let i = 0; i < arr.length; i++) if (Math.abs(v - arr[i]) < 4.5) return true; return false; };
    const inAgora = function (x, z) { return Math.abs(x - 160) < 40 && Math.abs(z + 150) < 28; };
    const occ = {};
    const occKey = function (x, z) { return Math.floor(x / 12) + ',' + Math.floor(z / 12); };
    const PITCH = 12;
    const houses = [];
    for (let gz = CITY.zMin; gz < CITY.zMax; gz += PITCH) {
      for (let gx = CITY.xMin; gx < CITY.xMax; gx += PITCH) {
        const x = gx + PITCH / 2, z = gz + PITCH / 2;
        if (nearLine(x, NS_X) || nearLine(z, EW_Z)) continue;     // calles entre manzanas
        if (rnd() > 0.85) continue;
        if (houseExcluded(x, z) || inAgora(x, z)) continue;
        const h0 = H(x, z);
        if (h0 < 1.2 || slopeAt(x, z) > 0.4) continue;
        houses.push({ x: x, z: z, y: h0 - 0.8, w: 6.8 + rnd() * 1.2, d: 6.8 + rnd() * 1.2, h: 3 + rnd() * 3.2,
          zoneB: inZoneB(x, z), c: rnd() });
        occ[occKey(x, z)] = true;
      }
    }
    const ANC_COLS = ['#f2ebdc', '#ece4d0', '#e8dcc0', '#d2a777', '#c28f5e', '#e4cfa6'].map(col);
    const ROOF_COLS = ['#a8694a', '#9a5b40', '#b07050', '#8c5a44'].map(col);
    const itemsA = [], itemsB = [], roofA = [], roofB = [], itemsM = [];
    const nightA = [], nightB = [], nightM = [];
    for (let i = 0; i < houses.length; i++) {
      const hs = houses[i];
      const yTop = hs.y + hs.h + 0.8;
      const item = { x: hs.x, y: hs.y, z: hs.z, w: hs.w, h: hs.h + 0.8, d: hs.d, ry: 0, col: ANC_COLS[Math.floor(hs.c * ANC_COLS.length)] };
      const roof = { x: hs.x, y: yTop - 0.2, z: hs.z, w: hs.w + 0.5, h: 0.9, d: hs.d + 0.5, ry: 0,
        col: ROOF_COLS[Math.floor(fract(hs.c * 7.3) * ROOF_COLS.length)] };
      (hs.zoneB ? itemsB : itemsA).push(item);
      (hs.zoneB ? roofB : roofA).push(roof);
      if (rnd() < 0.4) (hs.zoneB ? nightB : nightA).push(hs.x, yTop + 0.6, hs.z);
    }
    // barrio moderno: cubos blancos apiñados sobre la zona B
    for (let gz = ZONE_B.z0; gz < ZONE_B.z1; gz += PITCH) {
      for (let gx = ZONE_B.x0; gx < ZONE_B.x1; gx += PITCH) {
        const x = gx + PITCH / 2, z = gz + PITCH / 2;
        if (rnd() > 0.8) continue;
        if (houseExcluded(x, z) || inAgora(x, z)) continue;
        const h0 = H(x, z);
        if (h0 < 1.2 || slopeAt(x, z) > 0.45) continue;
        const mh = 3 + rnd() * 3.5;
        itemsM.push({ x: x, y: h0 - 0.8, z: z, w: 7.2, h: mh + 0.8, d: 7.2, ry: 0, col: col(rnd() < 0.85 ? '#f6f5ef' : '#eef3f7') });
        if (rnd() < 0.4) nightM.push(x, h0 + mh + 0.8, z);
      }
    }
    const houseGeo = new THREE.BoxGeometry(1, 1, 1); houseGeo.translate(0, 0.5, 0);
    const matRoof = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85 });
    const houseA = instMesh(THREE, houseGeo, matHouse, itemsA, root);
    const houseB = instMesh(THREE, houseGeo, matHouse, itemsB, root);
    const roofAm = instMesh(THREE, houseGeo, matRoof, roofA, root);
    const roofBm = instMesh(THREE, houseGeo, matRoof, roofB, root);
    const modern = instMesh(THREE, houseGeo, matModern, itemsM, root);
    houseA.receiveShadow = true; houseB.receiveShadow = true; modern.receiveShadow = true;
    roofAm.receiveShadow = true; roofBm.receiveShadow = true;

    // ---------- vegetación densa: olivos, cipreses, pinos y matorral ----------
    const TG = treeGeoms(THREE);
    const pineGeo = new THREE.ConeGeometry(2.6, 9, 7); pineGeo.translate(0, 8.5, 0);
    const pineTrunk = new THREE.CylinderGeometry(0.22, 0.3, 7, 6); pineTrunk.translate(0, 3.5, 0);
    const bushGeo = new THREE.IcosahedronGeometry(1, 0); bushGeo.translate(0, 0.5, 0);
    const matBush = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, flatShading: true });
    const matPine = new THREE.MeshStandardMaterial({ color: col('#3d5a2f'), roughness: 0.9, flatShading: true });
    const oliveCols = ['#6f7f4c', '#7a8a58', '#637349'].map(col);
    const bushCols = ['#5f7a3c', '#6d8a45', '#4f6b35', '#8a8f55', '#7a8a4a'].map(col);
    const freeAt = function (x, z) {
      return !houseExcluded(x, z) && !inAgora(x, z) && !occ[occKey(x, z)] && !(Math.abs(x) < 62 && Math.abs(z) < 126);
    };
    const oliveItems = [], oliveCanopy = [], pineItems = [], pineCanopy = [], cypItems = [], bushItems = [];
    for (let k = 0; k < 6000 && oliveItems.length < 420; k++) {
      const x = -1000 + rnd() * 2000, z = -1200 + rnd() * 1450;
      if (z > coastZ(x) - 6 || !freeAt(x, z)) continue;
      const h0 = H(x, z);
      if (h0 < 1.5 || slopeAt(x, z) > 0.5) continue;
      const s = 0.8 + rnd() * 0.5, ry = rnd() * TAU;
      oliveItems.push({ x: x, y: h0 - 0.2, z: z, w: s, h: s, d: s, ry: ry });
      oliveCanopy.push({ x: x, y: h0 - 0.2, z: z, w: s, h: s, d: s, ry: ry, col: oliveCols[Math.floor(rnd() * oliveCols.length)] });
    }
    for (let k = 0; k < 6000 && pineItems.length < 240; k++) {
      const x = -1000 + rnd() * 2000, z = -1300 + rnd() * 1100;
      if (!freeAt(x, z)) continue;
      const h0 = H(x, z);
      if (h0 < 10 || slopeAt(x, z) > 0.9) continue;
      const s = 0.9 + rnd() * 0.6;
      pineItems.push({ x: x, y: h0 - 0.3, z: z, w: s, h: s, d: s, ry: rnd() * TAU });
      pineCanopy.push({ x: x, y: h0 - 0.3, z: z, w: s, h: s, d: s, ry: 0, col: col('#3d5a2f') });
    }
    for (let k = 0; k < 6000 && cypItems.length < 150; k++) {
      let x, z;
      if (k % 2 === 0) { x = (rnd() < 0.5 ? -1 : 1) * (56 + rnd() * 14); z = (rnd() * 2 - 1) * 140; }
      else { x = -900 + rnd() * 1800; z = -700 + rnd() * 900; }
      if (k % 2 === 1 && !freeAt(x, z)) continue;
      const h0 = H(x, z);
      if (h0 < 0.5 || slopeAt(x, z) > 0.8) continue;
      const s = 0.8 + rnd() * 0.5;
      cypItems.push({ x: x, y: h0 - 0.2, z: z, w: s, h: s, d: s, ry: 0 });
    }
    for (let k = 0; k < 9000 && bushItems.length < 900; k++) {
      const x = -1100 + rnd() * 2200, z = -1250 + rnd() * 1500;
      if (z > coastZ(x) - 4 || !freeAt(x, z)) continue;
      const h0 = H(x, z);
      if (h0 < 0.8 || slopeAt(x, z) > 0.7) continue;
      const s = 1.2 + rnd() * 1.8;
      bushItems.push({ x: x, y: h0 - 0.3, z: z, w: s, h: s * 0.8, d: s, ry: rnd() * TAU, col: bushCols[Math.floor(rnd() * bushCols.length)] });
    }
    instMesh(THREE, TG.trunk, matTrunk, oliveItems, root);
    instMesh(THREE, TG.canopy, matTree, oliveCanopy, root);
    instMesh(THREE, pineTrunk, matTrunk, pineItems, root);
    instMesh(THREE, pineGeo, matPine, pineCanopy, root);
    instMesh(THREE, TG.cyp, matCypress, cypItems, root);
    instMesh(THREE, bushGeo, matBush, bushItems, root);

    // ---------- ágora: plaza de piedra con pórticos en dos lados ----------
    {
      const ah = H(160, -150);
      MB.box(160, ah - 1.2, -150, 62, 2.4, 42, C_PAL);
      for (let i = 0; i < 9; i++) {
        const cx = 160 - 26 + i * 6.5;
        MB.cyl(cx, ah, -169, 0.45, 5, C_MARBLE);
        MB.cyl(cx, ah, -131, 0.45, 5, C_MARBLE);
      }
      MB.box(160, ah + 5.4, -169, 62, 0.8, 2.2, C_MARBLE2);
      MB.box(160, ah + 5.4, -131, 62, 0.8, 2.2, C_MARBLE2);
    }

    // ---------- piedra y mármol fusionados ----------
    const stoneMesh = new THREE.Mesh(SB.build(), matBuild);
    stoneMesh.castShadow = true; stoneMesh.receiveShadow = true; stoneMesh.frustumCulled = false;
    root.add(stoneMesh);
    const marbleMesh = new THREE.Mesh(MB.build(), matMarble);
    marbleMesh.castShadow = true; marbleMesh.receiveShadow = true; marbleMesh.frustumCulled = false;
    root.add(marbleMesh);
    const roadMesh = new THREE.Mesh(RD.build(), matRoad);
    roadMesh.receiveShadow = true; roadMesh.frustumCulled = false;
    root.add(roadMesh);
    const todayMesh = new THREE.Mesh(TD.build(), matBuild);
    todayMesh.castShadow = true; todayMesh.receiveShadow = true; todayMesh.frustumCulled = false;
    todayMesh.visible = false;
    root.add(todayMesh);
    const signMesh = new THREE.Mesh(new THREE.PlaneGeometry(7.6, 2.4), matSign);
    signMesh.position.set(-44, 3.4, 134);
    signMesh.frustumCulled = false; signMesh.visible = false;
    root.add(signMesh);

    // ---------- luces de noche ----------
    const nightU = { uTime: { value: 0 }, uNight: { value: 0 }, uPx: { value: 70 }, uColor: { value: col('#ffb45c') } };
    const nightMat = new THREE.ShaderMaterial({
      uniforms: nightU, vertexShader: LIGHT_VS, fragmentShader: POINT_FS,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
    });
    const nightPtsA = new THREE.Points(pointsGeo(THREE, new Float32Array(nightA)), nightMat);
    const nightPtsB = new THREE.Points(pointsGeo(THREE, new Float32Array(nightB)), nightMat);
    const nightPtsM = new THREE.Points(pointsGeo(THREE, new Float32Array(nightM)), nightMat);
    [nightPtsA, nightPtsB, nightPtsM].forEach(function (p) { p.frustumCulled = false; root.add(p); });

    // ---------- polvo del terremoto (fuera del hueco) ----------
    const QN = 1600;
    const qPos = new Float32Array(QN * 3);
    for (let k = 0; k < QN; k++) {
      let x, z;
      do { x = (rnd() * 2 - 1) * 340; z = -320 + rnd() * 580; } while (Math.abs(x) < 34 && Math.abs(z) < 34);
      qPos[k * 3] = x; qPos[k * 3 + 1] = 2 + rnd() * 26; qPos[k * 3 + 2] = z;
    }
    const quakeU = { uTime: { value: 0 }, uPx: { value: 1500 }, uAlpha: { value: 0 }, uColor: { value: col('#c7a77a') } };
    const quakeMat = new THREE.ShaderMaterial({
      uniforms: quakeU, vertexShader: QUAKE_VS, fragmentShader: POINT_FS,
      transparent: true, depthWrite: false
    });
    const quakeMesh = new THREE.Points(pointsGeo(THREE, qPos), quakeMat);
    quakeMesh.frustumCulled = false; quakeMesh.visible = false;
    root.add(quakeMesh);

    // ---------- motas de polvo flotante cerca de la cámara ----------
    const DUST = 1200;
    const dustPos = new Float32Array(DUST * 3);
    for (let k = 0; k < DUST * 3; k++) dustPos[k] = rnd();
    const dustU = {
      uTime: { value: 0 }, uCenter: { value: new THREE.Vector3() }, uPx: { value: 60 },
      uAlpha: { value: 0.3 }, uColor: { value: col('#e6c28a') }
    };
    const dustMat = new THREE.ShaderMaterial({
      uniforms: dustU, vertexShader: DUST_VS, fragmentShader: POINT_FS,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
    });
    const dust = new THREE.Points(pointsGeo(THREE, dustPos), dustMat);
    dust.frustumCulled = false;
    root.add(dust);

    // ---------- agua y clima: nivel del mar en el horizonte ----------
    const DEEP = DEEP_DAY;

    // ---------- actualización por frame (función del estado, sin acumulación) ----------
    function update(s) {
      const tod = fract(s.timeOfDay || 0);
      const wall = s.wall || 0;
      const quake = clamp01(s.quake || 0);
      const today = clamp01(s.today || 0);
      // noche de las cenizas (t 41-58): cielo estrellado con luna, aunque el ciclo marque atardecer
      const Nt = sstep(41, 44, s.t || 0) * (1 - sstep(55, 58, s.t || 0));
      const a = (tod - 0.25) * TAU;
      sunDir.set(Math.cos(a), Math.sin(a) * EY, Math.sin(a) * EZ);
      moonDir.set(-sunDir.x, MOON_Y, -sunDir.z).normalize();
      tmpV.copy(sunDir).addScaledVector(moonDir, -sunDir.dot(moonDir)).normalize();
      moonCut.copy(moonDir).addScaledVector(tmpV, -0.012).normalize();
      sunT1.crossVectors(sunDir, upV).normalize();
      sunT2.crossVectors(sunDir, sunT1).normalize();
      const el = sunDir.y;
      const sunVis = sstep(0.0, 0.12, el) * (1 - Nt);
      const moonVis = Math.max(sstep(0.0, -0.12, el), Nt);
      const dayF = sstep(-0.05, 0.3, el) * (1 - Nt);
      const dusk = sunVis * (1 - sstep(0.1, 0.5, el));
      keyAt(tod);
      if (Nt > 0) { tZen.lerp(NIGHT_ZEN, Nt); tHor.lerp(NIGHT_HOR, Nt); }
      const lightDir = (el >= 0 && Nt < 0.5) ? sunDir : moonDir;
      sun.position.copy(lightDir).multiplyScalar(SHADOW_DIST);
      sun.color.copy(MOON_COL).lerp(tSun, sunVis);
      sun.intensity = kSunI * sunVis + 0.6 * moonVis;
      tHemG.copy(HEM_GROUND_NIGHT).lerp(HEM_GROUND_DAY, dayF);
      hemi.color.copy(tHem);
      hemi.groundColor.copy(tHemG);
      hemi.intensity = 0.22 + 0.35 * dayF;
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

      // niebla mínima; el terremoto la tiñe de polvo
      tFog.copy(tHor).lerp(FOG_DAY, 0.2 * dayF);
      tFog.lerp(DUST_FOG, 0.55 * quake);
      scene.fog.color.copy(tFog);
      scene.fog.density = 0.00004 * (1 - 0.3 * moonVis) + 0.00026 * quake;
      skyU.uBelow.value.copy(tFog);

      waterU.uTime.value = wall;
      waterU.uLightDir.value.copy(lightDir);
      waterU.uLightI.value = sun.intensity;
      waterU.uHorizon.value.copy(tHor);
      waterU.uZenith.value.copy(tZen);
      waterU.uDeep.value.copy(DEEP_NIGHT).lerp(DEEP, dayF);

      // ciudad: barrio antiguo o barrio moderno en la zona B
      const modernOn = today > 0.5;
      houseB.visible = !modernOn;
      roofBm.visible = !modernOn;
      nightPtsB.visible = !modernOn;
      modern.visible = modernOn;
      nightPtsM.visible = modernOn;
      nightU.uNight.value = moonVis * 0.9;
      nightU.uTime.value = wall;

      todayMesh.visible = today > 0.001;
      signMesh.visible = today > 0.001;

      quakeMesh.visible = quake > 0.001;
      quakeU.uAlpha.value = quake * 0.8;
      quakeU.uTime.value = wall;

      dustU.uTime.value = wall;
      dustU.uCenter.value.copy(camera.position);
      dustU.uAlpha.value = 0.12 + 0.12 * dayF;
    }

    return {
      update: update,
      sunDirection: sunDir,
      sunLight: sun,
      hemiLight: hemi,
      sky: sky
    };
  };

  // filas del propileo (muro sur del recinto)
  function GATE_ROW_A() { return PER_HZ - 5; }
  function GATE_ROW_B() { return PER_HZ + 5; }
})();
