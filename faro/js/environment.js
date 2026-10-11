// Entorno de Alejandría (~290 a.C.) para "El Faro de Alejandría: Lo que no te contaron".
// Cielo shader día/noche (noche estrellada con luna en el prólogo y en el capítulo del fuego, día luminoso
// en el espejo y en la firma, atardecer final), sol/luna con sombras ajustadas a la torre, hemisférica y
// niebla suave. Mar Mediterráneo con olas por shader y opacidad variable: agua clara junto a la isla (se ve
// el fondo y los bloques hundidos), espuma en escollos y costas. Isla de Faros con su islote rocoso bajo el
// faro, Heptastadion (calzada de piedra), Alejandría (casas blancas, templos, palacio en el cabo Loquias,
// Puerto Grande con muelles y palmeras, luces de noche). Polvo y olas en los terremotos.
// Todo procedural (sin texturas ni modelos externos). Técnicas tomadas de giza/js/environment.js y
// coloso/js/environment.js. THREE.ColorManagement.legacyMode=false: THREE.Color(hex) ya es lineal; los
// shaders propios trabajan en lineal y convierten a sRGB al final (toSRGB).
(function () {
  'use strict';
  const G = window.GIZA;
  const SITE = G.SITE;
  const TAU = Math.PI * 2;
  const SEA_Y = SITE.seaLevel;                       // -1.5
  const SUN_ELEV = 60 * Math.PI / 180;               // altura del sol al mediodía
  const EY = Math.sin(SUN_ELEV), EZ = Math.cos(SUN_ELEV);
  const MOON_Y = 0.16;                               // luna baja (dentro del encuadre del prólogo)
  const SHADOW_DIST = 500;
  const SUN_TARGET = { x: 0, y: 50, z: 0 };          // centro de la torre: sombras de ±90 m, alto 130 m
  const SEA_HALF = 6000;

  // dominio del mapa de fondo del mar (profundidad y espuma) y de la rejilla del terreno
  const HX0 = -2800, HX1 = 1800, HZ0 = -1100, HZ1 = 2800;
  const HW = 640, HH = 544;

  const CZ = SITE.cityCoastZ;                        // costa de la ciudad (z 1260)
  const CITY = SITE.city;
  const HEP = SITE.heptastadion;                     // calzada x=-700, z 120..1260, ancho 22
  const HARB = SITE.greatHarbor;                     // Puerto Grande (200, 700)
  const LOCH = SITE.lochias;                         // cabo Loquias (900, 1100)
  const REEFS = SITE.reefs;
  const RR = 15;                                     // radio de los escollos (m)
  const CAPE = { ax: 830, az: 1290, bx: 940, bz: 1130, r: 90 };   // promontorio del palacio
  const AG = { x: -200, z: 1480, r: 60 };            // ágora
  const MOLE_E = 440, MOLE_N = 640, MOLE_W = -150;   // malecón del Puerto Grande (bocana al oeste)

  // ---------- utilidades ----------
  function clamp01(x) { return x < 0 ? 0 : (x > 1 ? 1 : x); }
  function fract(x) { return x - Math.floor(x); }
  // smoothstep que admite e0 > e1 (rampa invertida)
  function sstep(e0, e1, x) { const t = clamp01((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); }
  function smin(a, b, k) { const h = clamp01(0.5 + 0.5 * (b - a) / k); return b + (a - b) * h - k * h * (1 - h); }
  // caja redondeada con signo (negativa dentro)
  function sdRoundBox(px, pz, cx, cz, hx, hz, r) {
    const qx = Math.abs(px - cx) - hx + r, qz = Math.abs(pz - cz) - hz + r;
    return Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - r;
  }
  // distancia a un segmento
  function sdSeg(px, pz, ax, az, bx, bz) {
    const vx = bx - ax, vz = bz - az;
    const t = clamp01(((px - ax) * vx + (pz - az) * vz) / (vx * vx + vz * vz));
    return Math.hypot(px - ax - vx * t, pz - az - vz * t);
  }

  let rngState = 9001;
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

  // ---------- relieve del mundo (función pura de x,z) ----------
  // GX guarda, tras cada llamada a groundH, la distancia con signo a tierra, la distancia a la costa y la espuma
  const GX = { landD: 1e4, dd: 1e4, foam: 0 };
  function coastZ(x) { return CZ + 14 * (2 * vnoise(x / 110, 0.37, 41) - 1) + 6 * (2 * vnoise(x / 38, 1.9, 43) - 1); }
  // isla de Faros: franja de este a oeste (x -1500..70, z -70..130) + pasarela de la stoneYard al muelle sur
  function islandSD(x, z) {
    const body = sdRoundBox(x, z, -715, 30, 785, 100, 70);
    const yard = sdSeg(x, z, 30, 60, 70, 140) - 22;
    const d = smin(body, yard, 20);
    return d + 12 * (2 * vnoise(x / 170, z / 170, 7) - 1) + 4 * (2 * vnoise(x / 45, z / 45, 9) - 1);
  }

  // altura del terreno (tierra, costa y fondo marino) + escollos; deja en GX la distancia a tierra y la espuma
  function groundH(x, z) {
    const r = Math.sqrt(x * x + z * z);
    const dIsl = smin(islandSD(x, z), r - 40 + 3 * (2 * vnoise(x / 20, z / 20, 13) - 1), 20);   // isla + islote
    const dCape = sdSeg(x, z, CAPE.ax, CAPE.az, CAPE.bx, CAPE.bz) - CAPE.r + 10 * (2 * vnoise(x / 70, z / 70, 17) - 1);
    const dCity = Math.min(coastZ(x) - z, dCape);
    const landD = Math.min(dIsl, dCity);
    let top;
    if (dIsl <= dCity) {
      // isla de Faros: franja baja y rocosa, plana hacia la punta este (bajo el faro)
      const tipK = sstep(-60, -260, x);
      top = 0.2 + tipK * (2.0 + 1.6 * fbm(x / 260, z / 260, 3, 31) + 2.2 * ridged(x / 90, z / 90, 3, 37));
    } else {
      // Alejandría: llano que sube ligeramente tierra adentro
      top = 2.4 + 0.5 * fbm(x / 200, z / 200, 3, 53) + 0.004 * Math.min(Math.max(-landD, 0), 400);
    }
    const shoreW = sstep(14, -14, landD);            // 1 tierra adentro, 0 en el mar
    const dd = Math.max(landD, 0);
    const floor = SEA_Y - 2.0 - 5.0 * sstep(0, 140, dd) - 2.5 * sstep(140, 1500, dd);
    let h = floor + (top - floor) * shoreW;
    // islote bajo el faro: plataforma plana (y=0) en r<30 y laderas que caen al mar
    const wI = 1 - sstep(30, 40, r);
    h += (0 - h) * wI;
    // nada por encima de y=0 en |x|,|z|<30 (es de la torre)
    const cheb = Math.max(Math.abs(x), Math.abs(z));
    h -= Math.max(h, 0) * (1 - sstep(27, 31, cheb));
    // escollos: rocas que asoman o quedan a flor de agua
    let reefP = 0;
    for (let k = 0; k < REEFS.length; k++) {
      const R = REEFS[k];
      const d0 = Math.hypot(x - R[0], z - R[1]);
      if (d0 > RR + 14) continue;
      const d = d0 + 4 * (2 * vnoise(x / 8, z / 8, 61 + k) - 1);
      const b = 0.9 - 6.9 * sstep(RR * 0.5, RR, d);
      if (b > h) h = b;
      const pr = sstep(RR + 6, RR - 2, d);
      if (pr > reefP) reefP = pr;
    }
    GX.landD = landD; GX.dd = dd;
    GX.foam = sstep(1.6, 0.25, Math.abs(h - SEA_Y)) * Math.max(sstep(14, 3, dd), reefP);
    return h;
  }
  function slopeAt(x, z) {
    const dx = (groundH(x + 3, z) - groundH(x - 3, z)) / 6;
    const dz = (groundH(x, z + 3) - groundH(x, z - 3)) / 6;
    return Math.sqrt(dx * dx + dz * dz);
  }
  // rejilla con tramos finos (4-8 m) donde hay detalle y gruesos (80-100 m) en el resto
  function gridAxis(a, b, fines, coarse) {
    const out = [];
    let cur = a;
    function seg(p, q, step) {
      const n = Math.max(1, Math.round((q - p) / step));
      for (let i = 0; i < n; i++) out.push(p + (q - p) * i / n);
    }
    for (let k = 0; k < fines.length; k++) {
      const f = fines[k];
      if (f[0] > cur) { seg(cur, f[0], coarse); cur = f[0]; }
      seg(cur, f[1], f[2]); cur = f[1];
    }
    seg(cur, b, coarse);
    out.push(b);
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
    '  vec3 up = mix(uHorizon, uZenith, pow(clamp(h, 0.0, 1.0), 0.45));',
    '  vec3 sky = mix(uBelow, up, smoothstep(-0.02, 0.02, h));',
    // sol: disco (más grande al amanecer y al atardecer) + halo
    '  float sd = dot(d, uSunDir);',
    '  float sdc = max(sd, 0.0);',
    '  float cr = cos(uSunAng);',
    '  float disc = smoothstep(cr - 0.00003, cr + 0.00001, sd);',
    '  float halo = pow(sdc, 900.0) * 0.9 + pow(sdc, 60.0) * 0.35 + pow(sdc, 6.0) * 0.12;',
    '  sky += uSunCol * (disc * 3.6 + halo) * uSunVis;',
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
    '  sky += vec3(0.55, 0.6, 0.8) * mw * 0.1 * uNight * smoothstep(-0.05, 0.1, h);',
    '  gl_FragColor = vec4(toSRGB(sky), 1.0);',
    '}'
  ].join('\n');

  // mar: olas por vértice (grandes, crecen con el terremoto) + olas finas por pixel; color por profundidad
  // (mapa de fondo en textura: R = altura del fondo, G = espuma). Opacidad: clara sobre fondo somero,
  // opaca en mar abierto y lejos de la isla.
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
    'uniform vec3 uFoam; uniform sampler2D uHeight; uniform vec4 uHRect; uniform float uMoonF; uniform float uSeaY;',
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
    '  vec4 hm = texture2D(uHeight, (q - uHRect.xy) / uHRect.zw);',
    '  float hb = hm.r * 24.0 - 12.0;',
    '  float foam = hm.g;',
    '  float dep = max(uSeaY - hb, 0.0);',
    '  float dT = clamp(dep / 6.0, 0.0, 1.0);',
    '  vec3 body = mix(uShallow, uDeep, smoothstep(0.0, 1.0, dT));',
    '  float fn = 0.5 + 0.5 * sin(q.x * 0.55 + t * 1.6) * sin(q.y * 0.43 - t * 1.1);',
    '  float fm = clamp(foam * (0.45 + 0.55 * fn) * (0.6 + 0.8 * uQuake), 0.0, 1.0);',
    '  body = mix(body, uFoam, fm * 0.85);',
    '  vec3 R = reflect(-V, n);',
    '  vec3 sky = mix(uHorizon, uZenith, smoothstep(0.0, 0.5, R.y));',
    '  vec3 col = mix(body, sky, clamp(fres * 1.2, 0.0, 1.0));',
    '  float ndl = max(dot(n, L), 0.0);',
    '  col *= 0.85 + 0.15 * ndl;',
    '  float rl = max(dot(reflect(-L, n), V), 0.0);',
    '  float spec = pow(rl, 120.0) * 1.2 + pow(rl, 12.0) * 0.05;',
    '  col += uLightCol * spec * clamp(uLightI, 0.0, 2.5) * 0.35;',
    '  col += uLightCol * pow(rl, 40.0) * 0.6 * uMoonF;',
    '  float dist = length(vW - cameraPosition);',
    '  col = mix(col, uFogC, smoothstep(2500.0, 6500.0, dist));',
    // opacidad: 0.85 en mar profundo; sobre fondo somero se ve el lecho (agua clara); lejos, opaca
    '  float aD = mix(0.40, 0.86, smoothstep(0.8, 5.0, dep));',
    '  float aF = mix(aD, 1.0, smoothstep(900.0, 1700.0, length(q)));',
    '  float a = max(aF, fm * 0.9);',
    '  a = max(a, fres * 0.9);',
    '  gl_FragColor = vec4(toSRGB(col), clamp(a, 0.0, 1.0));',
    '}'
  ].join('\n');

  // polvo del terremoto: partículas que suben desde la base de la torre
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
    '  gl_PointSize = clamp(uPx / -mv.z, 6.0, 30.0);',
    '  vA = uQuake * (0.9 - ph) * smoothstep(0.0, 0.15, ph) * 0.9;',
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

  // ventanas, farolas y hogueras de la ciudad: puntos cálidos que se encienden de noche
  const WIN_VS = [
    'uniform float uTime; uniform float uNight; uniform float uPx;',
    'attribute float aSeed;',
    'varying float vA;',
    'void main() {',
    '  vec4 mv = modelViewMatrix * vec4(position, 1.0);',
    '  gl_Position = projectionMatrix * mv;',
    '  gl_PointSize = clamp(uPx / -mv.z, 4.0, 14.0);',
    '  float tw = 0.8 + 0.2 * sin(uTime * (1.0 + aSeed * 2.0) + aSeed * 40.0);',
    '  float on = step(0.3, fract(aSeed * 5.7));',
    '  vA = uNight * tw * on;',
    '}'
  ].join('\n');

  // ---------- geometrías y texturas auxiliares ----------
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
  // prisma triangular: base y=0..1 (ancho 1 en x), cumbre en y=1, extruido en z (±0.5); tejados a dos aguas
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
  // hojas de palmera (5 hojas en estrella) como geometría única, para InstancedMesh
  function buildPalmLeaves(THREE) {
    const pos = [];
    for (let k = 0; k < 5; k++) {
      const a = k * TAU / 5 + 0.3;
      const ca = Math.cos(a), sa = Math.sin(a);
      const B = [0, 0.2, 0];
      const M = [ca * 2.6, 0.9, sa * 2.6];
      const T = [ca * 5.0, -1.6, sa * 5.0];
      const wx = -sa * 0.7, wz = ca * 0.7;
      const Mp = [M[0] + wx, M[1], M[2] + wz], Mm = [M[0] - wx, M[1], M[2] - wz];
      pos.push(B[0], B[1], B[2], Mp[0], Mp[1], Mp[2], Mm[0], Mm[1], Mm[2]);
      pos.push(Mp[0], Mp[1], Mp[2], T[0], T[1], T[2], Mm[0], Mm[1], Mm[2]);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.computeVertexNormals();
    return geo;
  }
  // suelo tileable: grano y manchas (sRGB)
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
    const DEEP_DAY = col('#1b5e86'), DEEP_NIGHT = col('#06141f');
    const SHALLOW_DAY = col('#3fb7b5'), SHALLOW_NIGHT = col('#0f3440');
    const HEM_GROUND_DAY = col('#bfa27a'), HEM_GROUND_NIGHT = col('#1a2540');
    const LAMP_DAY = col('#e8d8b0'), LAMP_NIGHT = col('#ffd27a');
    const KEYS = [
      // t,    cenit,      horizonte,  color sol,  intensidad, hemisferio
      [0.00,  '#02050f', '#0a1830', '#6f8fe0', 0.0, '#1a2a50'],   // medianoche estrellada
      [0.18,  '#02050f', '#0a1830', '#6f8fe0', 0.0, '#1d2c5a'],
      [0.235, '#2a3f8a', '#ff8f86', '#ffa27a', 1.0, '#8a6fa0'],   // amanecer rosado-dorado
      [0.30,  '#3f7fd0', '#ffc8a0', '#ffd9a8', 1.7, '#c3c8d8'],
      [0.38,  '#2f73c8', '#bfe0ec', '#fff3dc', 2.1, '#bcd8e8'],
      [0.50,  '#1f5fb8', '#a9d6e8', '#fff6e6', 2.2, '#c6e0ee'],   // mediodía azul mediterráneo
      [0.62,  '#2f6fc0', '#bfe0ea', '#ffebc6', 2.1, '#bcd8e8'],
      [0.72,  '#3a4fa0', '#ffb070', '#ffa050', 1.6, '#f0a878'],   // atardecer naranja
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
    const tmpV = new THREE.Vector3(), upV = new THREE.Vector3(0, 1, 0), tmpP = new THREE.Vector3();
    const skyMat = new THREE.ShaderMaterial({
      uniforms: skyU, vertexShader: SKY_VS, fragmentShader: SKY_FS,
      side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false
    });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(20000, 32, 16), skyMat);
    sky.renderOrder = -1000; sky.frustumCulled = false;
    root.add(sky);

    // ---------- niebla suave (la ciudad a 1300-2500 m se intuye) ----------
    scene.fog = new THREE.FogExp2(0xa9d6e8, 0.0001);

    // ---------- sol / luna con sombras ajustadas a la torre (±90 m) ----------
    const sun = new THREE.DirectionalLight(0xffffff, 2);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 2048; sun.shadow.mapSize.height = 2048;
    const sc = sun.shadow.camera;
    sc.left = -90; sc.right = 90; sc.top = 90; sc.bottom = -90; sc.near = 250; sc.far = 800;
    sc.updateProjectionMatrix();
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.12;
    sun.target.position.set(SUN_TARGET.x, SUN_TARGET.y, SUN_TARGET.z);
    root.add(sun); root.add(sun.target);

    const hemi = new THREE.HemisphereLight(0xd6e6ff, 0xbfa27a, 0.5);
    root.add(hemi);

    // ---------- terreno: rejilla con detalle en la isla, el faro y la costa de la ciudad ----------
    const XS = gridAxis(HX0, HX1, [[-1000, -760, 20], [-760, -640, 4], [-640, -350, 20], [-350, 350, 10]], 160);
    const ZS = gridAxis(HZ0, HZ1, [[-350, 350, 10], [1150, 1400, 8]], 160);
    const NX = XS.length, NZ = ZS.length;
    const tPos = new Float32Array(NX * NZ * 3);
    const tCol = new Float32Array(NX * NZ * 3);
    const tUv = new Float32Array(NX * NZ * 2);
    const tmpC = col();
    const cSand = col('#d7b97f'), cPale = col('#e6d6a6'), cScrub = col('#7f8a4c');
    const cRock = col('#a39a86'), cBeach = col('#ead9ae'), cStreet = col('#c9ad80'), cLot = col('#e8dcc0');
    const cIslet = col('#c8bda5');
    const cSeabed = col('#cfbb8c'), cSeabedDark = col('#a99a72'), cAlgae = col('#6f8060');
    function groundColor(x, z, h, slope, ld, out) {
      const n1 = vnoise(x / 60, z / 60, 21), n2 = vnoise(x / 18, z / 18, 23);
      if (h < SEA_Y) {                                   // fondo marino: arena clara, algas y roca
        out.copy(cSeabed).lerp(cSeabedDark, n1 * 0.7);
        out.lerp(cAlgae, sstep(0.55, 0.75, n2) * 0.55);
        out.lerp(cRock, sstep(0.18, 0.4, slope));
      } else {
        out.copy(cSand).lerp(cPale, n1);
        out.lerp(cScrub, sstep(3, 9, h) * (1 - sstep(0.25, 0.45, slope)) * 0.6);
        out.lerp(cRock, sstep(0.2, 0.42, slope));
        out.lerp(cBeach, (1 - sstep(0.6, 2.2, h)) * sstep(-1.0, 0.0, h) * 0.8);
        if (ld < 0 && z > CZ - 40 && x > CITY.xMin && x < CITY.xMax) {      // trama de la ciudad
          const ux = ((x - CITY.xMin) % 52 + 52) % 52, uz = ((z - CITY.zMin) % 52 + 52) % 52;
          out.lerp((ux > 40 || uz > 40) ? cStreet : cLot, 0.85);
        }
      }
      const rr = Math.hypot(x, z);
      if (rr < 46) out.lerp(cIslet, (1 - sstep(36, 46, rr)) * (0.75 + 0.25 * n2));   // islote rocoso bajo el faro
      return out;
    }
    for (let j = 0; j < NZ; j++) {
      for (let i = 0; i < NX; i++) {
        const x = XS[i], z = ZS[j], idx = j * NX + i;
        const h = groundH(x, z);
        const ld = GX.landD;
        tPos[idx * 3] = x; tPos[idx * 3 + 1] = h; tPos[idx * 3 + 2] = z;
        tUv[idx * 2] = x / 40; tUv[idx * 2 + 1] = z / 40;
        const sl = slopeAt(x, z);
        groundColor(x, z, h, sl, ld, tmpC);
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

    // ---------- mapa de fondo del mar: R = altura del fondo (-12..12 m), G = espuma ----------
    const hmData = new Uint8Array(HW * HH * 4);
    for (let j = 0; j < HH; j++) {
      for (let i = 0; i < HW; i++) {
        const x = HX0 + (i + 0.5) * (HX1 - HX0) / HW;
        const z = HZ0 + (j + 0.5) * (HZ1 - HZ0) / HH;
        const h = groundH(x, z);
        const k = (j * HW + i) * 4;
        hmData[k] = clamp01((h + 12) / 24) * 255;
        hmData[k + 1] = clamp01(GX.foam) * 255;
        hmData[k + 2] = 0; hmData[k + 3] = 255;
      }
    }
    const hmTex = new THREE.DataTexture(hmData, HW, HH, THREE.RGBAFormat, THREE.UnsignedByteType);
    hmTex.magFilter = THREE.LinearFilter; hmTex.minFilter = THREE.LinearFilter;
    hmTex.wrapS = hmTex.wrapT = THREE.ClampToEdgeWrapping;
    hmTex.needsUpdate = true;

    // ---------- mar Mediterráneo ----------
    const seaGeo = new THREE.PlaneGeometry(SEA_HALF * 2, SEA_HALF * 2, 64, 64);
    seaGeo.rotateX(-Math.PI / 2);
    seaGeo.translate(0, SEA_Y, 0);
    const waterU = {
      uTime: { value: 0 }, uQuake: { value: 0 },
      uLightDir: { value: new THREE.Vector3(0, 1, 0) }, uLightCol: { value: sun.color }, uLightI: { value: 0 },
      uHorizon: { value: col() }, uZenith: { value: col() }, uFogC: { value: col() },
      uDeep: { value: col() }, uShallow: { value: col() }, uFoam: { value: col('#f2f6f4') },
      uHeight: { value: hmTex }, uHRect: { value: new THREE.Vector4(HX0, HZ0, HX1 - HX0, HZ1 - HZ0) },
      uMoonF: { value: 0 }, uSeaY: { value: SEA_Y }
    };
    const waterMat = new THREE.ShaderMaterial({
      uniforms: waterU, vertexShader: WATER_VS, fragmentShader: WATER_FS,
      transparent: true, depthWrite: true
    });
    const sea = new THREE.Mesh(seaGeo, waterMat);
    sea.frustumCulled = false;
    root.add(sea);

    // ---------- constructor de geometría fusionada (una sola malla con colores por vértice) ----------
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

    // ---------- piedra: malecón, calzada, templos, ágora, palacio ----------
    const SB = makeBuilder();
    const C_STONE = col('#cdb88f'), C_MOLE = col('#b3a282'), C_MARBLE = col('#ece6da');
    const C_CELLA = col('#d6c8a8'), C_ROOF = col('#b5573a'), C_QUAY = col('#c4b08a');

    // Heptastadion: calzada de piedra recta desde la isla hasta la ciudad (sobre el fondo, con muros laterales)
    const HEP_TOP = 1.6, HEP_LEN = HEP.zTo - HEP.zFrom, HEP_Z = (HEP.zTo + HEP.zFrom) / 2;
    addBox(SB, C_STONE, HEP.x, (HEP_TOP - 10) / 2, HEP_Z, HEP.width, HEP_TOP + 10, HEP_LEN, 0);
    for (const sx of [-1, 1]) addBox(SB, C_MARBLE, HEP.x + sx * (HEP.width / 2 + 0.4), HEP_TOP + 0.5, HEP_Z, 0.9, 1.6, HEP_LEN, 0);
    for (let z = HEP.zFrom + 60; z < HEP.zTo - 40; z += 70) {
      for (const sx of [-1, 1]) addBox(SB, C_MARBLE, HEP.x + sx * (HEP.width / 2 - 0.8), HEP_TOP + 2.0, z, 0.5, 4, 0.5, 0);
    }

    // malecón del Puerto Grande: brazo este, brazo norte y muelle de la costa
    const MOLE_TOP = 2.2, MOLE_BOT = -6;
    addBox(SB, C_MOLE, MOLE_E, (MOLE_TOP + MOLE_BOT) / 2, (CZ + MOLE_N) / 2, 18, MOLE_TOP - MOLE_BOT, CZ - MOLE_N, 0);
    addBox(SB, C_MOLE, (MOLE_E + MOLE_W) / 2, (MOLE_TOP + MOLE_BOT) / 2, MOLE_N, MOLE_E - MOLE_W + 18, MOLE_TOP - MOLE_BOT, 18, 0);
    addBox(SB, C_QUAY, (MOLE_W + MOLE_E) / 2, (1.3 - 6) / 2, CZ - 12, MOLE_E - MOLE_W, 1.3 + 6, 22, 0);
    // espigones (muelles) que entran en el Puerto Grande desde la costa
    for (const px of [0, 120, 240, 340]) {
      addBox(SB, C_QUAY, px, (0.8 - 4) / 2, 1124, 14, 0.8 + 4, 248, 0);
    }

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
      addPrism(B, C_ROOF, cx, entY + 0.8, cz, W + 1.6, W * 0.2, L + 1.2, Math.PI / 2);
    }
    // pórtico (stoa) de columnas con arquitrabe y techo plano
    function stoa(B, x0, z, n, sp, baseY, colH) {
      for (let i = 0; i < n; i++) addCyl(B, C_MARBLE, x0 + i * sp, baseY, z, 0.5, colH);
      const len = (n - 1) * sp;
      addBox(B, C_MARBLE, x0 + len / 2, baseY + colH + 0.5, z, len + 2, 1.0, 3.2, 0);
      addBox(B, C_CELLA, x0 + len / 2, baseY + colH + 1.3, z, len + 2.4, 0.6, 4.0, 0);
    }
    function avgH(x, z, L, W) {
      return (groundH(x - L / 2, z - W / 2) + groundH(x + L / 2, z - W / 2) +
        groundH(x - L / 2, z + W / 2) + groundH(x + L / 2, z + W / 2)) / 4;
    }
    const TEMPLES = [
      { x: -430, z: 1720, L: 40, W: 20, colH: 9, nL: 10, nS: 5 },
      { x: 380, z: 1560, L: 36, W: 18, colH: 8, nL: 9, nS: 5 },
      { x: -1250, z: 1950, L: 44, W: 22, colH: 9, nL: 10, nS: 5 },
      { x: 1060, z: 1820, L: 38, W: 20, colH: 9, nL: 10, nS: 5 }
    ];
    const RES = [];   // zonas sin casas
    for (const T of TEMPLES) {
      temple(SB, T.x, avgH(T.x, T.z, T.L, T.W), T.z, T.L, T.W, T.colH, T.nL, T.nS);
      RES.push({ x: T.x, z: T.z, hx: T.L / 2 + 12, hz: T.W / 2 + 12 });
    }
    // ágora: pórticos a dos lados de una plaza
    const agH = groundH(AG.x, AG.z);
    stoa(SB, AG.x - 44, AG.z - 52, 12, 8, agH, 5.5);
    stoa(SB, AG.x - 44, AG.z + 52, 12, 8, agH, 5.5);
    // palacio de los Ptolomeos en el cabo Loquias: sala central con pórticos
    const PAL = { x: 905, z: 1195 };
    const palH = avgH(PAL.x, PAL.z, 40, 22);
    temple(SB, PAL.x, palH, PAL.z, 40, 22, 8, 10, 5);
    stoa(SB, 862, 1158, 7, 7, palH, 6);
    stoa(SB, 862, 1232, 7, 7, palH, 6);
    RES.push({ x: PAL.x, z: PAL.z, hx: 40, hz: 30 });
    RES.push({ x: HEP.x, z: 1400, hx: 30, hz: 170 });

    // farolas de la calzada y del muelle (la luz se pinta como puntos en la capa de ventanas)
    const LAMPS = [];
    for (let z = HEP.zFrom + 30; z < HEP.zTo - 20; z += 70) {
      for (const sx of [-1, 1]) {
        addBox(SB, C_MARBLE, HEP.x + sx * (HEP.width / 2 - 0.6), HEP_TOP + 2.6, z, 0.4, 5.2, 0.4, 0);
        LAMPS.push(HEP.x + sx * (HEP.width / 2 - 0.6), HEP_TOP + 5.4, z);
      }
    }
    for (let x = -140; x <= 430; x += 40) LAMPS.push(x, 3.0, CZ - 6);
    LAMPS.push(MOLE_E, 4.0, MOLE_N + 6, MOLE_W + 6, 4.0, MOLE_N, MOLE_E, 4.0, CZ - 40);

    const stoneMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0 });
    const stoneMesh = new THREE.Mesh(SB.geometry(), stoneMat);
    stoneMesh.castShadow = true; stoneMesh.receiveShadow = true;
    stoneMesh.frustumCulled = false;
    root.add(stoneMesh);

    // ---------- ciudad: casas cúbicas con tejados, en la trama hipodámica ----------
    const HOUSE_COLS = ['#f4efe6', '#f1ead9', '#ece6da', '#f7f2e8', '#e8dcc4', '#d9a35a', '#c98a55', '#d6b98a'].map(col);
    const ROOF_COLS = ['#b5573a', '#a64d32', '#c0603f', '#9c4a30', '#8a4a36'].map(col);
    function inRes(x, z) {
      for (let i = 0; i < RES.length; i++) {
        const R = RES[i];
        if (Math.abs(x - R.x) < R.hx && Math.abs(z - R.z) < R.hz) return true;
      }
      return false;
    }
    function buildable(x, z) {
      if (z < CZ - 40 || x < CITY.xMin + 20 || x > CITY.xMax - 20 || z > CITY.zMax - 20) return false;
      const h = groundH(x, z);
      const ld = GX.landD;
      if (ld > -12) return false;                                              // lejos de la costa
      if (x > MOLE_W - 30 && x < MOLE_E + 30 && ld > -30) return false;        // paseo del puerto
      if (Math.abs(x - HEP.x) < 28 && z < 1400) return false;                  // calzada
      if (sdSeg(x, z, CAPE.ax, CAPE.az, CAPE.bx, CAPE.bz) < CAPE.r + 25) return false;
      if (Math.hypot(x - AG.x, z - AG.z) < AG.r + 6) return false;
      if (inRes(x, z)) return false;
      if (h < 0.5 || h > 12) return false;
      return slopeAt(x, z) < 0.15;
    }
    const houses = [];
    for (let bx = CITY.xMin; bx < CITY.xMax; bx += 52) {
      for (let bz = CITY.zMin; bz < CITY.zMax; bz += 52) {
        // densidad: núcleo urbano denso junto al puerto, casas dispersas hacia el oeste y el sur
        const dc = Math.hypot((bx - 200) / 800, (bz - 1500) / 600);
        const dens = 0.5 * (1 - sstep(0.8, 1.9, dc)) + 0.03;
        const brot = rnd() < 0.35 ? (rnd() - 0.5) * 0.5 : 0;
        const bcx = bx + 20, bcz = bz + 20;
        for (let i = 0; i < 2; i++) {
          for (let j = 0; j < 2; j++) {
            if (rnd() > dens) continue;
            const pl = rot2(i * 20 - 10 + (rnd() - 0.5) * 2, j * 20 - 10 + (rnd() - 0.5) * 2, brot);
            const cx = bcx + pl[0];
            const cz = bcz + pl[1];
            if (!buildable(cx, cz)) continue;
            houses.push({
              x: cx, z: cz, y: groundH(cx, cz), ry: brot, tint: 0.9 + rnd() * 0.14,
              w: 9 + rnd() * 5, d: 9 + rnd() * 5, H: 3.5 + rnd() * 8,
              col: HOUSE_COLS[Math.floor(rnd() * HOUSE_COLS.length)],
              roof: rnd() < 0.45, rh: 2.4 + rnd() * 2.0,
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
      if (rnd() < 0.2) {
        const ww = 6 + rnd() * 5, wd = 6 + rnd() * 4, wh = h.H * (0.45 + rnd() * 0.4);
        const sgn = rnd() < 0.5 ? -1 : 1;
        const wp = rot2(sgn * (h.w / 2 + ww / 2 - 1.5), (rnd() - 0.5) * (h.d - wd) * 0.6, h.ry);
        extraBoxes.push({ x: h.x + wp[0], y: h.y - 1.5, z: h.z + wp[1], sx: ww, sy: wh + 1.5, sz: wd, c: h.col, ry: h.ry });
      }
      if (rnd() < 0.08) extraBoxes.push({ x: h.x, y: h.y + 0.05, z: h.z, sx: h.w + 6, sy: 0.5, sz: h.d + 6, c: patioCol, ry: h.ry });
    }
    const houseMesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }), houses.length + extraBoxes.length);
    const roofs = houses.filter(function (h) { return h.roof; });
    const roofMesh = new THREE.InstancedMesh(UPRISM, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 }), roofs.length);
    const winPos = new Float32Array((houses.length * 2 + LAMPS.length / 3) * 3);
    const winSeed = new Float32Array(houses.length * 2 + LAMPS.length / 3);
    for (let k = 0; k < houses.length; k++) {
      const h = houses[k];
      houseMesh.setMatrixAt(k, xf(h.x, h.y - 1.5, h.z, h.w, h.H + 1.5, h.d, h.ry));
      houseMesh.setColorAt(k, col().copy(h.col).multiplyScalar(h.tint));
      for (let q = 0; q < 2; q++) {
        const wi = (k * 2 + q) * 3;
        const side = Math.floor(rnd() * 4);
        let lx = 0, lz = 0;
        if (side === 0) { lx = (rnd() - 0.5) * h.w * 0.7; lz = -h.d / 2 - 0.12; }
        else if (side === 1) { lx = h.w / 2 + 0.12; lz = (rnd() - 0.5) * h.d * 0.7; }
        else if (side === 2) { lx = (rnd() - 0.5) * h.w * 0.7; lz = h.d / 2 + 0.12; }
        else { lx = -h.w / 2 - 0.12; lz = (rnd() - 0.5) * h.d * 0.7; }
        const wpos = rot2(lx, lz, h.ry);
        winPos[wi] = h.x + wpos[0]; winPos[wi + 1] = h.y + 1.2 + rnd() * Math.max(0.5, h.H - 1.5); winPos[wi + 2] = h.z + wpos[1];
        winSeed[k * 2 + q] = rnd();
      }
    }
    // farolas y luces del puerto: puntos cálidos fijos (aSeed 0.5 = siempre encendidos)
    const nLamp = LAMPS.length / 3;
    for (let l = 0; l < nLamp; l++) {
      const wi = (houses.length * 2 + l) * 3;
      winPos[wi] = LAMPS[l * 3]; winPos[wi + 1] = LAMPS[l * 3 + 1]; winPos[wi + 2] = LAMPS[l * 3 + 2];
      winSeed[houses.length * 2 + l] = 0.5;
    }
    for (let e = 0; e < extraBoxes.length; e++) {
      const b = extraBoxes[e];
      houseMesh.setMatrixAt(houses.length + e, xf(b.x, b.y, b.z, b.sx, b.sy, b.sz, b.ry));
      houseMesh.setColorAt(houses.length + e, b.c);
    }
    for (let r = 0; r < roofs.length; r++) {
      const h = roofs[r];
      roofMesh.setMatrixAt(r, xf(h.x, h.y + h.H - 0.1, h.z, h.w + 0.8, h.rh, h.d + 0.8, h.ry));
      roofMesh.setColorAt(r, h.rc);
    }
    houseMesh.castShadow = true; houseMesh.receiveShadow = true;
    roofMesh.castShadow = true; roofMesh.receiveShadow = true;
    houseMesh.frustumCulled = false; roofMesh.frustumCulled = false;
    houseMesh.count = houses.length + extraBoxes.length;
    roofMesh.count = roofs.length;
    houseMesh.instanceMatrix.needsUpdate = true; roofMesh.instanceMatrix.needsUpdate = true;
    if (houseMesh.instanceColor) houseMesh.instanceColor.needsUpdate = true;
    if (roofMesh.instanceColor) roofMesh.instanceColor.needsUpdate = true;
    root.add(houseMesh); root.add(roofMesh);

    // ventanas y farolas encendidas (solo de noche)
    const winGeo = new THREE.BufferGeometry();
    winGeo.setAttribute('position', new THREE.BufferAttribute(winPos, 3));
    winGeo.setAttribute('aSeed', new THREE.BufferAttribute(winSeed, 1));
    const winU = { uTime: { value: 0 }, uNight: { value: 0 }, uPx: { value: 260 }, uColor: { value: col('#ffd27a') } };
    const winMat = new THREE.ShaderMaterial({
      uniforms: winU, vertexShader: WIN_VS, fragmentShader: POINT_FS,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
    });
    const windows = new THREE.Points(winGeo, winMat);
    windows.frustumCulled = false;
    root.add(windows);

    // ---------- palmeras (InstancedMesh): esquinas de la trama, quay y la isla ----------
    const PALMS = 150;
    const trunkGeo = new THREE.CylinderGeometry(0.28, 0.42, 9, 6, 1, true).translate(0, 4.5, 0);
    const leafGeo = buildPalmLeaves(THREE);
    const trunkMesh = new THREE.InstancedMesh(trunkGeo, new THREE.MeshStandardMaterial({ color: 0x6b4f2e, roughness: 0.9 }), PALMS);
    const crownMesh = new THREE.InstancedMesh(leafGeo, new THREE.MeshStandardMaterial({ color: 0x3f7a33, roughness: 0.8, side: THREE.DoubleSide }), PALMS);
    const m4 = new THREE.Matrix4(), quat = new THREE.Quaternion(), vPos = new THREE.Vector3(), vSc = new THREE.Vector3();
    const yAxis = new THREE.Vector3(0, 1, 0);
    let nPalm = 0;
    function placePalm(x, z) {
      if (nPalm >= PALMS) return;
      const h = groundH(x, z);
      if (h < 0.8 || h > 10 || GX.landD > -4) return;
      const sc1 = 0.8 + rnd() * 0.5;
      quat.setFromAxisAngle(yAxis, rnd() * TAU);
      vSc.set(sc1, sc1, sc1);
      vPos.set(x, h, z);
      m4.compose(vPos, quat, vSc);
      trunkMesh.setMatrixAt(nPalm, m4);
      vPos.set(x, h + 9 * sc1, z);
      m4.compose(vPos, quat, vSc);
      crownMesh.setMatrixAt(nPalm, m4);
      nPalm++;
    }
    // esquinas de manzanas (fuera de las casas) y frente al puerto
    for (let bx = CITY.xMin; bx < CITY.xMax && nPalm < PALMS; bx += 52) {
      for (let bz = CITY.zMin + 4; bz < CITY.zMax && nPalm < PALMS; bz += 52) {
        const dc = Math.hypot((bx - 200) / 800, (bz - 1500) / 600);
        if (rnd() < 0.5 * (1 - sstep(1.0, 2.4, dc)) + 0.05) placePalm(bx, bz);
      }
    }
    for (let x = -120; x <= 420; x += 46) placePalm(x, CZ - 30);
    for (let k = 0; k < 40; k++) placePalm(-900 + rnd() * 500, 40 + rnd() * 80);   // palmas de la isla
    trunkMesh.count = nPalm; crownMesh.count = nPalm;
    trunkMesh.castShadow = true; crownMesh.castShadow = true;
    trunkMesh.frustumCulled = false; crownMesh.frustumCulled = false;
    trunkMesh.instanceMatrix.needsUpdate = true; crownMesh.instanceMatrix.needsUpdate = true;
    root.add(trunkMesh); root.add(crownMesh);

    // ---------- cipreses y matorral de la isla (InstancedMesh) ----------
    const cypGeo = new THREE.ConeGeometry(1.5, 9, 8).translate(0, 4.5, 0);
    const CYP = 110;
    const cypMesh = new THREE.InstancedMesh(cypGeo, new THREE.MeshStandardMaterial({ color: 0x2f4d33, roughness: 0.9 }), CYP);
    const bushGeo = makeRockGeometry(THREE, 0).translate(0, 0.6, 0);
    const BUSH = 220;
    const bushMesh = new THREE.InstancedMesh(bushGeo, new THREE.MeshStandardMaterial({ color: 0x6f7f4a, roughness: 0.95, flatShading: true }), BUSH);
    const _c = col();
    function islandSpot(x, z) {
      if (Math.max(Math.abs(x), Math.abs(z)) < 40) return false;
      if (islandSD(x, z) > -25) return false;                                  // lejos de la costa
      if (Math.abs(x - HEP.x) < 30 && z > 100) return false;                  // calzada
      return true;
    }
    let nCyp = 0, tries = 0;
    while (nCyp < CYP && tries < CYP * 40) {
      tries++;
      const x = -1400 + rnd() * 1250, z = -60 + rnd() * 180;
      if (!islandSpot(x, z) || groundH(x, z) < 0.6 || slopeAt(x, z) > 0.35) continue;
      const sc1 = 0.8 + rnd() * 0.6;
      cypMesh.setMatrixAt(nCyp, xf(x, groundH(x, z) - 0.3, z, sc1, sc1 * (0.9 + rnd() * 0.4), sc1, rnd() * TAU));
      nCyp++;
    }
    cypMesh.count = nCyp;
    let nBush = 0; tries = 0;
    while (nBush < BUSH && tries < BUSH * 40) {
      tries++;
      const x = -1400 + rnd() * 1300, z = -70 + rnd() * 210;
      if (!islandSpot(x, z) || groundH(x, z) < 0.4 || slopeAt(x, z) > 0.45) continue;
      const sc1 = 1.2 + rnd() * 1.2;
      bushMesh.setMatrixAt(nBush, xf(x, groundH(x, z) - 0.2, z, sc1, sc1 * 0.7, sc1, rnd() * TAU));
      bushMesh.setColorAt(nBush, _c.set(['#6f7f4a', '#7d8c52', '#5e7044'][Math.floor(rnd() * 3)]));
      nBush++;
    }
    bushMesh.count = nBush;
    cypMesh.castShadow = true; bushMesh.castShadow = false;
    cypMesh.frustumCulled = false; bushMesh.frustumCulled = false;
    cypMesh.instanceMatrix.needsUpdate = true; bushMesh.instanceMatrix.needsUpdate = true;
    if (bushMesh.instanceColor) bushMesh.instanceColor.needsUpdate = true;
    root.add(cypMesh); root.add(bushMesh);

    // ---------- bloques de roca en la orilla, el islote y los escollos (InstancedMesh) ----------
    const ROCKS = 220;
    const rockMesh = new THREE.InstancedMesh(makeRockGeometry(THREE, 0),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, flatShading: true }), ROCKS);
    const rockCols = ['#8f8a80', '#7d786f', '#a29d92', '#6e6258', '#a68f6c'];
    let nRock = 0; tries = 0;
    while (nRock < ROCKS && tries < 60000) {
      tries++;
      const x = -1500 + rnd() * 3000, z = -400 + rnd() * 1700;
      if (Math.max(Math.abs(x), Math.abs(z)) < 32) continue;                   // nada encima de la torre
      if (Math.abs(x - HEP.x) < 20 && z > 100 && z < 1270) continue;           // no en la calzada
      const h = groundH(x, z);
      if (GX.dd > 6 || h < -2.8 || h > 2.5) continue;
      const r = 1.2 + rnd() * 2.6;
      rockMesh.setMatrixAt(nRock, xf(x, h - r * 0.25, z, r * (0.8 + 0.4 * rnd()), r * 0.6, r * (0.8 + 0.4 * rnd()), rnd() * TAU));
      rockMesh.setColorAt(nRock, _c.set(rockCols[Math.floor(rnd() * rockCols.length)]));
      nRock++;
    }
    // escollos: bloques sobre cada roca que asoma
    for (let k = 0; k < REEFS.length; k++) {
      for (let q = 0; q < 6 && nRock < ROCKS; q++) {
        const a = rnd() * TAU, rad = rnd() * RR * 0.6;
        const x = REEFS[k][0] + Math.cos(a) * rad, z = REEFS[k][1] + Math.sin(a) * rad;
        const r = 1.5 + rnd() * 2.0;
        rockMesh.setMatrixAt(nRock, xf(x, 0.3, z, r, r * 0.55, r * 1.1, rnd() * TAU));
        rockMesh.setColorAt(nRock, _c.set(rockCols[Math.floor(rnd() * rockCols.length)]));
        nRock++;
      }
    }
    rockMesh.count = nRock;
    rockMesh.castShadow = true; rockMesh.receiveShadow = true;
    rockMesh.frustumCulled = false;
    rockMesh.instanceMatrix.needsUpdate = true;
    if (rockMesh.instanceColor) rockMesh.instanceColor.needsUpdate = true;
    root.add(rockMesh);

    // ---------- polvo del terremoto alrededor de la torre (solo durante las sacudidas) ----------
    const DUST = 1100;
    const dustPos = new Float32Array(DUST * 3), dustSeed = new Float32Array(DUST);
    for (let k = 0; k < DUST; k++) {
      let ang = rnd() * TAU, rad = 42 + Math.sqrt(rnd()) * 80;
      dustPos[k * 3] = Math.cos(ang) * rad;
      dustPos[k * 3 + 1] = 0.5 + rnd() * 1.5;
      dustPos[k * 3 + 2] = Math.sin(ang) * rad;
      dustSeed[k] = rnd();
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
    dustGeo.setAttribute('aSeed', new THREE.BufferAttribute(dustSeed, 1));
    const dustU = { uTime: { value: 0 }, uQuake: { value: 0 }, uPx: { value: 320 }, uColor: { value: col('#c8a77a') } };
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
      const quake = clamp01(Math.max(s.quake1 || 0, s.quake2 || 0));
      // el sol nace por el este (+X), sube hacia el sur (+Z) y se pone por el oeste (-X)
      const a = (tod - 0.25) * TAU;
      sunDir.set(Math.cos(a), Math.sin(a) * EY, Math.sin(a) * EZ);
      // luna: opuesta en azimut, pero baja (sombras largas y laterales)
      moonDir.set(-sunDir.x, MOON_Y, -sunDir.z).normalize();
      // creciente: el disco recortado se desplaza en sentido contrario al sol
      tmpV.copy(sunDir).addScaledVector(moonDir, -sunDir.dot(moonDir)).normalize();
      moonCut.copy(moonDir).addScaledVector(tmpV, -0.012).normalize();
      // base para rayos crepusculares
      sunT1.crossVectors(sunDir, upV).normalize();
      sunT2.crossVectors(sunDir, sunT1).normalize();

      const el = sunDir.y;
      const sunVis = sstep(0.0, 0.12, el);          // 1 de día
      const moonVis = sstep(0.0, -0.12, el);        // 1 de noche
      const dayF = sstep(-0.05, 0.3, el);
      const dusk = sunVis * (1 - sstep(0.1, 0.5, el));
      const nightL = sstep(0.12, -0.05, el);        // ventanas y farolas encendidas

      keyAt(tod);

      // luz principal: sol de día, luna de noche; sombras sobre la torre
      const lightDir = el >= 0 ? sunDir : moonDir;
      tmpP.copy(lightDir).multiplyScalar(SHADOW_DIST);
      sun.position.set(SUN_TARGET.x + tmpP.x, SUN_TARGET.y + tmpP.y, SUN_TARGET.z + tmpP.z);
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

      // niebla: del color del horizonte; casi nula cerca, suave a 2 km
      scene.fog.color.copy(tHor);
      scene.fog.density = 0.0001 * (1 - 0.5 * moonVis);

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

      // terremoto: polvo que se levanta
      dust.visible = quake > 0.001;
      dustU.uTime.value = wall;
      dustU.uQuake.value = quake;
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

  // rotación alrededor de Y (misma convención que las matrices de xf)
  function rot2(lx, lz, a) {
    const c = Math.cos(a), s = Math.sin(a);
    return [lx * c + lz * s, -lx * s + lz * c];
  }
})();
