// Entorno de Éfeso: cielo día/noche, marisma con charcas y juncos, río Caístro, colinas con olivos y
// pinos, cantera en la ladera, la ciudad de Éfeso (casas, murallas, teatro), el hueco del cimiento
// (sin geometría en x∈[-62,62], z∈[-32,32]) y la columna de hoy con su cigüeña.
// Todo procedural (geometría, shaders, CanvasTexture). THREE.ColorManagement.legacyMode=false:
// los THREE.Color(hex) son lineales y los shaders propios convierten a sRGB al final (toSRGB).
(function () {
  'use strict';
  const G = window.GIZA;

  // ---------- utilidades ----------
  const TAU = Math.PI * 2;
  function clamp01(x) { return x < 0 ? 0 : (x > 1 ? 1 : x); }
  function fract(x) { return x - Math.floor(x); }
  // smoothstep que admite e0 > e1 (rampa invertida)
  function sstep(e0, e1, x) { const t = clamp01((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); }

  // generador pseudoaleatorio determinista (cada carga genera lo mismo)
  let rngState = 90210;
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
  function dome(x, z, cx, cz, R) {
    const d = Math.hypot(x - cx, z - cz) / R;
    if (d >= 1) return 0;
    const q = 1 - d * d;
    return q * q;
  }

  // ---------- geografía (datos de SITE) ----------
  const SITE = G.SITE;
  const HOLE = { x0: -62, x1: 62, z0: -32, z1: 32 };      // hueco del cimiento: NADA de terreno aquí
  const MR = SITE.marsh.radius;                            // 450: radio de la marisma
  const WL = SITE.waterLevel;                              // -0.3: agua de las charcas
  const RIV = SITE.river;                                  // río Caístro: z 520, anchura 60
  const Q = SITE.quarry;                                   // cantera (ladera)
  const ROUTE = SITE.route;                                // ruta de los tambores
  const CITY = { x: SITE.city.x, z: SITE.city.z, r: SITE.city.radius };
  const CHILL = { x: CITY.x, z: CITY.z, r: 700, a: 60 };   // loma de la ciudad
  const QHILL = { x: -860, z: -680, r: 300, a: 60 };       // loma al pie de la cantera
  const HILL_R = [420, 380, 480, 440], HILL_A = [110, 90, 130, 100];
  const HILLS = SITE.hills.map(function (p, i) { return { x: p[0], z: p[1], r: HILL_R[i], a: HILL_A[i] }; });
  const WORLD = 1800;                                      // mitad del lado del terreno
  const GRID = 120;                                      // celdas por lado (antes de los cortes)
  const SHADOW_DIST = 1200;
  const SUN_ELEV = 62 * Math.PI / 180;
  const EY = Math.sin(SUN_ELEV), EZ = Math.cos(SUN_ELEV);
  const MOON_Y = 0.32;
  const TODAY = SITE.todayColumn;

  function inHole(x, z, m) {
    m = m || 0;
    return x > HOLE.x0 - m && x < HOLE.x1 + m && z > HOLE.z0 - m && z < HOLE.z1 + m;
  }
  function riverZ(x) { return RIV.z + 42 * Math.sin(x / 260) + 16 * Math.sin(x / 97 + 1.3); }
  function routeDist(x, z) {
    let best = 1e9;
    for (let i = 0; i < ROUTE.length - 1; i++) {
      const a = ROUTE[i], b = ROUTE[i + 1];
      const vx = b[0] - a[0], vz = b[1] - a[1];
      const t = clamp01(((x - a[0]) * vx + (z - a[1]) * vz) / (vx * vx + vz * vz));
      const dx = a[0] + vx * t - x, dz = a[1] + vz * t - z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d < best) best = d;
    }
    return best;
  }

  // charcas: las cuatro de la hoy-inundada (flood) junto al hueco, y el resto repartidas en la marisma
  const PONDS = [];
  [[-20, -75, 14], [30, -72, 12], [-95, -30, 13], [-100, -62, 12], [60, -60, 12]].forEach(function (f) {
    PONDS.push({ x: f[0], z: f[1], r: f[2], flood: 1, ph: rnd() * TAU });
  });
  (function () {
    let tries = 0;
    while (PONDS.length < 34 && tries < 8000) {
      tries++;
      const a = rnd() * TAU, rr = Math.sqrt(rnd()) * MR * 0.92;
      const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
      if (Math.abs(x) < 100 && Math.abs(z) < 64) continue;   // nada de agua junto al templo
      const r = 7 + rnd() * 20;
      let ok = true;
      for (let i = 0; i < PONDS.length; i++) {
        const p = PONDS[i];
        if (Math.hypot(p.x - x, p.z - z) < p.r + r + 18) { ok = false; break; }
      }
      if (ok) PONDS.push({ x: x, z: z, r: r, flood: 0, ph: rnd() * TAU });
    }
  })();

  // canales serpenteantes que unen charcas cercanas (segmentos a-b; el agua se pinta en la misma malla)
  const CHAN = [];
  (function () {
    const base = PONDS.filter(function (p) { return !p.flood; });
    base.forEach(function (p, i) {
      let best = null, bd = 1e9;
      base.forEach(function (q, j) {
        if (j === i) return;
        const d = Math.hypot(p.x - q.x, p.z - q.z);
        if (d < bd) { bd = d; best = q; }
      });
      if (!best || bd > 260 || rnd() > 0.6) return;
      const off = (rnd() < 0.5 ? -1 : 1) * 0.16 * bd;
      const nx = -(best.z - p.z) / bd, nz = (best.x - p.x) / bd;
      const N = 8, seg = [];
      let px = p.x, pz = p.z, bad = false;
      for (let k = 1; k <= N; k++) {
        const t = k / N;
        const env = Math.sin(Math.PI * t);
        const wob = (off * env + 12 * Math.sin(t * Math.PI * 3 + p.ph) * env);
        const cx = p.x + (best.x - p.x) * t + nx * wob;
        const cz = p.z + (best.z - p.z) * t + nz * wob;
        if ((Math.abs(cx) < 100 && Math.abs(cz) < 64) || inHoleRaw(cx, cz)) bad = true;
        seg.push({ ax: px, az: pz, bx: cx, bz: cz });
        px = cx; pz = cz;
      }
      if (!bad) seg.forEach(function (c) { CHAN.push(c); });
    });
  })();
  function inHoleRaw(x, z) { return x > -70 && x < 70 && z > -40 && z < 40; }
  function chanDist(x, z) {
    let best = 1e18;
    for (let i = 0; i < CHAN.length; i++) {
      const c = CHAN[i];
      const vx = c.bx - c.ax, vz = c.bz - c.az;
      const t = clamp01(((x - c.ax) * vx + (z - c.az) * vz) / (vx * vx + vz * vz + 1e-9));
      const dx = c.ax + vx * t - x, dz = c.az + vz * t - z;
      const d = dx * dx + dz * dz;
      if (d < best) best = d;
    }
    return Math.sqrt(best);
  }

  // ---------- altura del terreno y máscaras en (x,z); reutiliza un objeto ----------
  const tS = { h: 0, mud: 0, pond: 0, river: 0, quarry: 0, road: 0, city: 0, n: 0 };
  function sampleTerrain(x, z) {
    const r = Math.sqrt(x * x + z * z);
    const marshW = 1 - sstep(MR - 20, MR + 60, r);          // 1 en la marisma, 0 en tierra firme
    // marisma: llano casi a nivel del agua con ondulación de barro
    const hM = 0.05 + (fbm(x / 170, z / 170, 3, 9) - 0.5) * 0.9 + (vnoise(x / 25, z / 25, 4) - 0.5) * 0.18;
    // tierra firme: lomas suaves
    const hD = 2.5 + 9 * fbm(x / 330, z / 330, 4, 21) + 3 * ridged(x / 150, z / 150, 2, 33);
    let h = hM * marshW + hD * (1 - marshW);

    // colinas (olivos, pinos, roca)
    for (let i = 0; i < HILLS.length; i++) {
      const H = HILLS[i];
      const dd = dome(x, z, H.x, H.z, H.r);
      if (dd > 0) h += H.a * dd * (0.8 + 0.4 * ridged(x / 110, z / 110, 3, 50 + i));
    }
    h += CHILL.a * dome(x, z, CHILL.x, CHILL.z, CHILL.r);
    h += QHILL.a * dome(x, z, QHILL.x, QHILL.z, QHILL.r);

    // cantera: terrazas escalonadas que bajan hacia el centro
    const qdx = x - Q.x, qdz = z - Q.z;
    const qd = Math.sqrt(qdx * qdx + qdz * qdz);
    const qlvl = Math.min(4, -8 + 3 * Math.floor(qd / 14));
    const qW = sstep(64, 54, qd);
    h += (qlvl - h) * qW;
    // cantera rocosa: relieve de crestas dentro de los cortes
    h += qW * 2.2 * (ridged(x / 9, z / 9, 2, 77) - 0.35);

    // charcas: cuenca suave con el agua a WL, de borde irregular
    let pw = 0;
    for (let i = 0; i < PONDS.length; i++) {
      const P = PONDS[i];
      const dx = x - P.x, dz = z - P.z;
      const d2 = dx * dx + dz * dz;
      if (d2 > (P.r * 1.6) * (P.r * 1.6)) continue;
      const ang = Math.atan2(dz, dx);
      const dn = Math.sqrt(d2) / (P.r * (1 + 0.18 * Math.sin(ang * 3 + P.ph) + 0.08 * Math.sin(ang * 5 - 2 * P.ph)));
      const w = sstep(1.18, 0.82, dn);
      if (w > 0) {
        h += (Math.min(h, WL - 0.45) - h) * w;
        if (w > pw) pw = w;
      }
    }

    // río Caístro, serpenteante, al sur
    const dr = Math.abs(z - riverZ(x));
    const rW = sstep(RIV.width / 2 + 6, RIV.width / 2 - 6, dr);
    h += (-1.6 - h) * rW;

    // canales de las charcas: zanjas estrechas con el agua a WL
    if (CHAN.length) {
      const cw = sstep(4.2, 2.4, chanDist(x, z));
      if (cw > 0) h += (Math.min(h, WL - 0.4) - h) * cw;
    }

    // borde del hueco: suelo casi a nivel para que el piso del cimiento no deje escalón
    const hx = Math.max(HOLE.x0 - x, x - HOLE.x1, 0), hz = Math.max(HOLE.z0 - z, z - HOLE.z1, 0);
    const hd = Math.sqrt(hx * hx + hz * hz);
    h += (-0.05 - h) * (1 - sstep(0, 14, hd));

    // borde del mundo: se hunde para no mostrar un canto en el horizonte
    const edge = Math.max(Math.abs(x), Math.abs(z));
    h -= 150 * sstep(WORLD * 0.85, WORLD, edge);

    tS.h = h;
    tS.mud = marshW;
    tS.pond = pw;
    tS.river = rW;
    tS.quarry = qW;
    tS.road = 1 - sstep(4, 9, routeDist(x, z));
    tS.city = 1 - sstep(CITY.r * 0.9, CITY.r * 1.1, Math.hypot(x - CITY.x, z - CITY.z));
    tS.n = vnoise(x / 60, z / 60, 8);
    return tS;
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
    // calima: banda temblorosa cerca del horizonte
    '  float hzBand = exp(-h * h * 400.0) * uDay;',
    '  float wob = 0.5 + 0.5 * sin(d.x * 240.0 + uTime * 1.4) * sin(d.z * 200.0 - uTime * 1.1);',
    '  sky += vec3(0.012, 0.008, 0.0) * hzBand * wob;',
    // sol: disco + halo
    '  float sd = dot(d, uSunDir);',
    '  float sdc = max(sd, 0.0);',
    '  float cr = cos(uSunAng);',
    '  float disc = smoothstep(cr - 0.00003, cr + 0.00001, sd);',
    '  float halo = pow(sdc, 900.0) * 0.25 + pow(sdc, 60.0) * 0.06 + pow(sdc, 6.0) * 0.02;',
    '  sky += uSunCol * (disc * 3.0 + halo * (1.0 - 0.6 * uDusk)) * uSunVis;',
    // rayos crepusculares
    '  float ang = atan(dot(d, uSunT2), dot(d, uSunT1));',
    '  float rays = pow(0.5 + 0.5 * sin(ang * 23.0 + vnoise3(vec3(ang * 4.0, 0.5, 0.0)) * 7.0), 5.0);',
    '  rays *= 0.6 + 0.4 * vnoise3(vec3(ang * 11.0, 3.0, 1.0));',
    '  float fall = exp(-(1.0 - sdc) * 9.0);',
    '  sky += uSunCol * rays * fall * uDusk * 0.18 * smoothstep(-0.1, 0.25, h);',
    // luna creciente
    '  float md = dot(d, uMoonDir);',
    '  float mdisc = smoothstep(0.99978, 0.99990, md) * (1.0 - smoothstep(0.99978, 0.99990, dot(d, uMoonCut)));',
    '  sky += vec3(0.8, 0.86, 1.0) * mdisc * uMoonVis * 1.3;',
    '  sky += vec3(0.3, 0.36, 0.6) * (pow(max(md, 0.0), 260.0) * 0.35 + pow(max(md, 0.0), 40.0) * 0.04) * uMoonVis;',
    // estrellas
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
    '  sky += vec3(0.55, 0.6, 0.8) * mw * 0.22 * uNight * smoothstep(-0.05, 0.1, h);',
    '  gl_FragColor = vec4(toSRGB(sky), 1.0);',
    '}'
  ].join('\n');

  // agua: charcas y río. aC = (centro x, centro z, fase, marca de inundación)
  const WATER_VS = [
    'attribute vec4 aC;',
    'uniform float uFlood;',
    'varying vec3 vW; varying vec4 vC;',
    'void main() {',
    '  float g = mix(1.0, uFlood, aC.w);',
    '  vec3 p = position;',
    '  p.xz = aC.xy + (p.xz - aC.xy) * g;',
    '  vec4 w = modelMatrix * vec4(p, 1.0);',
    '  vW = w.xyz; vC = aC;',
    '  gl_Position = projectionMatrix * viewMatrix * w;',
    '}'
  ].join('\n');

  const WATER_FS = [
    'uniform float uTime; uniform vec3 uLightDir; uniform vec3 uLightCol; uniform float uLightI;',
    'uniform vec3 uHorizon; uniform vec3 uZenith; uniform vec3 uDeep;',
    'uniform float uQuake; uniform float uQT;',
    'varying vec3 vW; varying vec4 vC;',
    COMMON_GLSL,
    'void main() {',
    '  vec2 p = vW.xz;',
    // oleaje suave
    '  float a1 = p.x * 0.05 + uTime * 1.3;',
    '  float a2 = p.y * 0.031 - uTime * 0.9 + p.x * 0.02;',
    '  float a3 = (p.x + p.y) * 0.11 + uTime * 2.1;',
    '  float gx = 0.25 * 0.05 * cos(a1) + 0.18 * 0.02 * cos(a2) + 0.12 * 0.11 * cos(a3);',
    '  float gz = 0.18 * 0.031 * cos(a2) + 0.12 * 0.11 * cos(a3);',
    // temblor: anillos concéntricos que salen de cada charca (función de s.t)
    '  vec2 dv = p - vC.xy;',
    '  float d = length(dv) + 0.001;',
    '  vec2 dir = dv / d;',
    '  float front = max(uQT, 0.0) * 6.0;',
    '  float env = uQuake * clamp((front + 1.0 - d) / 13.0, 0.0, 1.0) * exp(-d * 0.03);',
    '  float ph = d * 0.9 - uQT * 5.0 + vC.z;',
    '  float dh = 0.12 * env * 0.9 * cos(ph);',
    '  gx += dh * dir.x; gz += dh * dir.y;',
    '  vec3 n = normalize(vec3(-gx, 1.0, -gz));',
    '  vec3 V = normalize(cameraPosition - vW);',
    '  vec3 L = normalize(uLightDir);',
    '  float ndv = max(dot(n, V), 0.0);',
    '  float fres = 0.04 + 0.96 * pow(1.0 - ndv, 5.0);',
    '  vec3 R = reflect(-V, n);',
    '  vec3 sky = mix(uHorizon, uZenith, smoothstep(0.0, 0.6, R.y));',
    '  vec3 col = mix(uDeep, sky, clamp(fres * 0.7 + 0.04, 0.0, 1.0));',
    '  float rl = max(dot(reflect(-L, n), V), 0.0);',
    '  float spec = pow(rl, 90.0) * 1.2 + pow(rl, 8.0) * 0.06;',
    '  col += uLightCol * spec * uLightI * 1.5;',
    '  gl_FragColor = vec4(toSRGB(col), 1.0);',
    '}'
  ].join('\n');

  // juncos y cañas: instancias con balanceo por viento (s.wall) y temblor (s.quakeDemo), y crecimiento
  // por invasión (aInv: umbral de s.today; 0 = siempre visible)
  const REED_VS = [
    'attribute float aInv;',
    'uniform float uWall; uniform float uQuake; uniform float uQT; uniform float uInvade;',
    'varying float vH; varying vec3 vN;',
    'void main() {',
    '  float h = uv.y;',
    '  vec4 base = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);',
    '  float grow = aInv <= 0.0 ? 1.0 : clamp((uInvade - aInv) * 12.0, 0.0, 1.0);',
    '  float ph = base.x * 0.13 + base.z * 0.09;',
    '  float wind = sin(uWall * 1.1 + ph) * 0.05 + 0.03 * sin(uWall * 2.9 + ph * 2.3);',
    '  float qk = uQuake * sin(uQT * 9.0 - base.x * 0.03 + base.z * 0.02) * 0.4;',
    '  vec3 p = position;',
    '  float bend = h * h;',
    '  p.x += (wind + qk) * bend;',
    '  p.z += (0.6 * wind - 0.5 * qk) * bend;',
    '  vec4 wp = instanceMatrix * vec4(p, 1.0);',
    '  wp.y = base.y + (wp.y - base.y) * grow;',
    '  vH = h;',
    '  vN = mat3(instanceMatrix) * vec3(0.0, 0.3, 1.0);',
    '  gl_Position = projectionMatrix * viewMatrix * modelMatrix * wp;',
    '}'
  ].join('\n');

  const REED_FS = [
    'uniform vec3 uC0; uniform vec3 uC1; uniform vec3 uSunDir; uniform vec3 uSunCol; uniform float uDayF;',
    'varying float vH; varying vec3 vN;',
    COMMON_GLSL,
    'void main() {',
    '  vec3 n = normalize(vN);',
    '  float dl = abs(dot(n, normalize(uSunDir)));',
    '  vec3 base = mix(uC0, uC1, vH);',
    '  vec3 light = mix(vec3(0.22, 0.27, 0.42), uSunCol, uDayF);',
    '  vec3 col = base * light * (0.4 + 0.6 * dl) * 1.1;',
    '  gl_FragColor = vec4(toSRGB(col), 1.0);',
    '}'
  ].join('\n');

  const POINT_VS = [
    'uniform float uTime; uniform float uNight; uniform float uPx;',
    'varying float vA;',
    'void main() {',
    '  vec4 mv = modelViewMatrix * vec4(position, 1.0);',
    '  gl_Position = projectionMatrix * mv;',
    '  gl_PointSize = clamp(uPx / -mv.z, 2.0, 14.0);',
    '  float tw = 0.75 + 0.25 * sin(uTime * 2.0 + position.x * 0.7 + position.z * 1.3);',
    '  vA = uNight * tw;',
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

  // ---------- texturas y geometría auxiliar ----------
  // suelo de marisma y tierra: moteado tileable dibujado por código
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
        const blot2 = 0.5 + 0.5 * Math.sin(TAU * (5 * x - 2 * y) / size + 2.1 * Math.cos(TAU * (4 * y + x) / size));
        const val = 228 + 26 * (grain - 0.5) + 14 * (blot - 0.5) + 10 * (blot2 - 0.5);
        d[i] = val; d[i + 1] = val * 0.97; d[i + 2] = val * 0.92;
        d[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.encoding = THREE.sRGBEncoding;
    return tex;
  }

  // roca: icosaedro con vértices desplazados por una función de posición
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

  // copa de olivo: icosaedro aplastado y con relieve (geometría fija, la instancia da la posición)
  function makeCanopyGeometry(THREE) {
    const g = new THREE.IcosahedronGeometry(2.2, 1);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const n = fract(Math.sin(x * 7.13 + y * 19.7 + z * 31.1) * 9311.7);
      const k = 0.85 + 0.3 * n;
      p.setXYZ(i, x * k, y * k * 0.7 + 4.2, z * k);     // copa a unos 4 m de altura, sobre el tronco
    }
    g.computeVertexNormals();
    return g;
  }

  // hojas (juncos/cañas): 2 hojas por mata, con la altura en uv.y (0 base, 1 punta)
  function makeReedGeometry(THREE, blades, hw) {
    const pos = [], uv = [], idx = [];
    let vo = 0;
    for (let b = 0; b < blades; b++) {
      const yaw = b * TAU / blades + 0.4;
      const cs = Math.cos(yaw), sn = Math.sin(yaw);
      const local = [[-hw, 0, 0, 0], [hw, 0, 0, 0], [-hw * 0.6, 0.5, 0.02, 0.5], [hw * 0.6, 0.5, 0.02, 0.5], [0, 1, 0.03, 1]];
      local.forEach(function (v) {
        const lx = v[0], lz = v[2];
        pos.push(lx * cs - lz * sn, v[1], lx * sn + lz * cs);
        uv.push(0, v[3]);
      });
      idx.push(vo, vo + 1, vo + 2, vo + 1, vo + 3, vo + 2, vo + 2, vo + 3, vo + 4);
      vo += 5;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    return g;
  }

  // transforma una geometría (posición, giro en Euler, escala) y la devuelve
  function xf(THREE, g, px, py, pz, rx, ry, rz, sx, sy, sz) {
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(px || 0, py || 0, pz || 0),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(rx || 0, ry || 0, rz || 0)),
      new THREE.Vector3(sx === undefined ? 1 : sx, sy === undefined ? 1 : sy, sz === undefined ? 1 : sz)
    );
    g.applyMatrix4(m);
    return g;
  }
  // pinta todos los vértices de una geometría con un color lineal
  function paint(THREE, g, c) {
    const n = g.attributes.position.count;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    return g;
  }
  // une geometrías (position, normal, color) en una sola
  function mergeGeos(THREE, list) {
    let nv = 0, ni = 0;
    list.forEach(function (g) {
      nv += g.attributes.position.count;
      ni += g.index ? g.index.count : g.attributes.position.count;
    });
    const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), col = new Float32Array(nv * 3);
    const idx = new Uint32Array(ni);
    let vo = 0, io = 0;
    list.forEach(function (g) {
      const p = g.attributes.position, n = g.attributes.normal, c = g.attributes.color;
      const cnt = p.count;
      for (let i = 0; i < cnt; i++) {
        pos[(vo + i) * 3] = p.getX(i); pos[(vo + i) * 3 + 1] = p.getY(i); pos[(vo + i) * 3 + 2] = p.getZ(i);
        if (n) { nor[(vo + i) * 3] = n.getX(i); nor[(vo + i) * 3 + 1] = n.getY(i); nor[(vo + i) * 3 + 2] = n.getZ(i); }
        if (c) { col[(vo + i) * 3] = c.getX(i); col[(vo + i) * 3 + 1] = c.getY(i); col[(vo + i) * 3 + 2] = c.getZ(i); }
        else { col[(vo + i) * 3] = 1; col[(vo + i) * 3 + 1] = 1; col[(vo + i) * 3 + 2] = 1; }
      }
      if (g.index) for (let i = 0; i < g.index.count; i++) idx[io++] = g.index.getX(i) + vo;
      else for (let i = 0; i < cnt; i++) idx[io++] = vo + i;
      vo += cnt;
    });
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    out.setAttribute('color', new THREE.BufferAttribute(col, 3));
    out.setIndex(new THREE.BufferAttribute(idx, 1));
    return out;
  }

  // paletas por hora (tod 0..1): cielo, color del sol, intensidad, hemisferio
  G.createEnvironment = function (ctx) {
    const THREE = ctx.THREE, scene = ctx.scene, camera = ctx.camera, renderer = ctx.renderer;
    const root = new THREE.Group(); scene.add(root);

    const MOON_COL = new THREE.Color('#6f8fe0');
    const DEEP_DAY = new THREE.Color('#2a4a4a'), DEEP_NIGHT = new THREE.Color('#081018');
    const FOG_DAY = new THREE.Color('#cfc7a8');
    const HEM_GROUND_DAY = new THREE.Color('#6d5a3a');
    const HEM_GROUND_NIGHT = new THREE.Color('#263046');
    const KEYS = [
      // t,    cenit,      horizonte,  color sol,  intensidad, hemisferio
      [0.00,  '#02040c', '#0b1426', '#6f8fe0', 0.0, '#1a2550'],   // medianoche
      [0.18,  '#02040c', '#0b1426', '#6f8fe0', 0.0, '#1d2a58'],
      [0.235, '#2b3c7a', '#ff8a7a', '#ffa070', 1.1, '#7a6a9a'],   // amanecer
      [0.30,  '#4f86c4', '#f1d2a8', '#ffd2a0', 1.9, '#b8c4d8'],
      [0.38,  '#3d7fc4', '#d9dcd0', '#fff0d6', 2.3, '#c9d8ea'],
      [0.50,  '#3b7cc0', '#cdd8d6', '#fff2dc', 2.5, '#d0dde8'],   // día luminoso
      [0.62,  '#3f7dc2', '#d6d6c4', '#ffe6b8', 2.3, '#c9d8ea'],
      [0.72,  '#34509a', '#ffb070', '#ffb050', 1.6, '#f0b880'],   // atardecer
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

    // niebla: muy suave, solo a partir de ~2 km
    scene.fog = new THREE.FogExp2(FOG_DAY.getHex(), 0.00002);

    // ---------- sol / luna: sombras ajustadas al templo (±85 m) ----------
    const sun = new THREE.DirectionalLight(0xffffff, 2);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 2048; sun.shadow.mapSize.height = 2048;
    const sc = sun.shadow.camera;
    sc.left = -120; sc.right = 120; sc.top = 120; sc.bottom = -120;
    sc.near = SHADOW_DIST - 150; sc.far = SHADOW_DIST + 150;   // profundidad alrededor del templo (alto ~35 m)
    sc.updateProjectionMatrix();
    sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.35;
    sun.target.position.set(0, 0, 0);
    root.add(sun); root.add(sun.target);

    const hemi = new THREE.HemisphereLight(0xd6e6ff, 0x6d5a3a, 0.6);
    root.add(hemi);

    // ---------- terreno: rejilla con cortes exactos en los bordes del hueco ----------
    const xsRaw = [], zsRaw = [];
    for (let i = 0; i <= GRID; i++) {
      const u = -1 + 2 * i / GRID;
      xsRaw.push(WORLD * u * Math.abs(u));       // más densidad cerca del centro (templo, marisma)
      zsRaw.push(WORLD * u * Math.abs(u));
    }
    function axis(raw, breaks) {
      const a = raw.concat(breaks).sort(function (p, q) { return p - q; });
      const out = [];
      a.forEach(function (v) { if (out.length === 0 || v - out[out.length - 1] > 1e-3) out.push(v); });
      return out;
    }
    const xs = axis(xsRaw, [HOLE.x0, HOLE.x1]);
    const zs = axis(zsRaw, [HOLE.z0, HOLE.z1]);
    const NX = xs.length, NZ = zs.length;
    const NV = NX * NZ;
    const tPos = new Float32Array(NV * 3);
    const tUv = new Float32Array(NV * 2);
    const tMask = new Float32Array(NV * 5);     // mud, pond, river, quarry, road
    const tCity = new Float32Array(NV);
    const tNoise = new Float32Array(NV);
    for (let j = 0; j < NZ; j++) {
      for (let i = 0; i < NX; i++) {
        const idx = j * NX + i;
        const x = xs[i], z = zs[j];
        const s = sampleTerrain(x, z);
        tPos[idx * 3] = x; tPos[idx * 3 + 1] = s.h; tPos[idx * 3 + 2] = z;
        tUv[idx * 2] = x / 40; tUv[idx * 2 + 1] = z / 40;
        tMask[idx * 5] = s.mud; tMask[idx * 5 + 1] = s.pond; tMask[idx * 5 + 2] = s.river;
        tMask[idx * 5 + 3] = s.quarry; tMask[idx * 5 + 4] = s.road;
        tCity[idx] = s.city; tNoise[idx] = s.n;
      }
    }
    const tIdx = [];
    for (let j = 0; j < NZ - 1; j++) {
      for (let i = 0; i < NX - 1; i++) {
        const cx = (xs[i] + xs[i + 1]) / 2, cz = (zs[j] + zs[j + 1]) / 2;
        if (inHole(cx, cz, 0)) continue;       // hueco del cimiento: ninguna celda
        const v00 = j * NX + i, v01 = (j + 1) * NX + i, v10 = j * NX + i + 1, v11 = (j + 1) * NX + i + 1;
        tIdx.push(v00, v01, v10, v01, v11, v10);
      }
    }
    const terGeo = new THREE.BufferGeometry();
    terGeo.setAttribute('position', new THREE.BufferAttribute(tPos, 3));
    terGeo.setAttribute('uv', new THREE.BufferAttribute(tUv, 2));
    terGeo.setIndex(tIdx);
    terGeo.computeVertexNormals();
    const nrm = terGeo.attributes.normal.array;

    // colores por vértice: marisma, tierra seca, olivar, roca de laderas, río, orillas, camino, piedra
    const cMud = new THREE.Color('#56592f'), cGreen = new THREE.Color('#6b7f3a');
    const cShore = new THREE.Color('#2b2618'), cDry = new THREE.Color('#a99c6c');
    const cOlive = new THREE.Color('#7a7c40'), cRock = new THREE.Color('#8b7f6c');
    const cRiver = new THREE.Color('#40382b'), cRoad = new THREE.Color('#d6b984');
    const cStone = new THREE.Color('#d9cdb3'), cPale = new THREE.Color('#e9e1cf');
    const tmpC = new THREE.Color(), tmpM = new THREE.Color();
    const tCol = new Float32Array(NV * 3);
    for (let k = 0; k < NV; k++) {
      const ny = nrm[k * 3 + 1];
      const mud = tMask[k * 5], pw = tMask[k * 5 + 1], rw = tMask[k * 5 + 2];
      const qw = tMask[k * 5 + 3], road = tMask[k * 5 + 4];
      const n = tNoise[k];
      tmpC.copy(cDry).lerp(cOlive, sstep(0.4, 0.7, n) * 0.7 * (1 - mud));
      tmpM.copy(cMud).lerp(cGreen, sstep(0.35, 0.75, n));
      tmpC.lerp(tmpM, mud);
      tmpC.lerp(cRock, clamp01((0.86 - ny) / 0.22) * (1 - mud) * 0.9);
      const shore = pw * (1 - pw) * 4;
      tmpC.lerp(cShore, clamp01(shore) * 0.9);
      tmpC.lerp(cRiver, rw * 0.9);
      tmpC.lerp(cRoad, road * 0.85);
      tmpC.lerp(cPale, qw * 0.95);
      tmpC.lerp(cStone, tCity[k] * 0.8);
      const shade = 0.72 + 0.28 * clamp01(ny);
      tCol[k * 3] = tmpC.r * shade; tCol[k * 3 + 1] = tmpC.g * shade; tCol[k * 3 + 2] = tmpC.b * shade;
    }
    terGeo.setAttribute('color', new THREE.BufferAttribute(tCol, 3));
    const groundTex = makeGroundTexture(THREE);
    const terMat = new THREE.MeshStandardMaterial({ vertexColors: true, map: groundTex, roughness: 0.97, metalness: 0 });
    const terrain = new THREE.Mesh(terGeo, terMat);
    terrain.receiveShadow = true;
    root.add(terrain);

    // ---------- agua: charcas (con inundación de hoy) y río ----------
    const waterU = {
      uTime: { value: 0 }, uLightDir: { value: new THREE.Vector3(0, 1, 0) },
      uLightCol: { value: sun.color }, uLightI: { value: 0 },
      uHorizon: { value: new THREE.Color() }, uZenith: { value: new THREE.Color() },
      uDeep: { value: new THREE.Color('#2a4a4a') },
      uQuake: { value: 0 }, uQT: { value: 0 }, uFlood: { value: 0 }
    };
    const waterMat = new THREE.ShaderMaterial({ uniforms: waterU, vertexShader: WATER_VS, fragmentShader: WATER_FS, side: THREE.DoubleSide });

    const wPos = [], wC = [];
    PONDS.forEach(function (P) {
      const seg = 32;
      const rAt = function (a) { return P.r * 1.06 * (1 + 0.18 * Math.sin(a * 3 + P.ph) + 0.08 * Math.sin(a * 5 - 2 * P.ph)); };
      for (let k = 0; k < seg; k++) {
        const a0 = k / seg * TAU, a1 = (k + 1) / seg * TAU;
        const r0 = rAt(a0), r1 = rAt(a1);
        wPos.push(P.x, WL, P.z,
          P.x + Math.cos(a1) * r1, WL, P.z + Math.sin(a1) * r1,
          P.x + Math.cos(a0) * r0, WL, P.z + Math.sin(a0) * r0);
        for (let v = 0; v < 3; v++) wC.push(P.x, P.z, P.ph, P.flood);
      }
    });
    // canales: cintas de agua a lo largo de cada segmento
    CHAN.forEach(function (c) {
      const vx = c.bx - c.ax, vz = c.bz - c.az, L = Math.hypot(vx, vz) || 1;
      const ox = -vz / L * 2.6, oz = vx / L * 2.6;
      const q = [[c.ax + ox, c.az + oz], [c.ax - ox, c.az - oz], [c.bx + ox, c.bz + oz], [c.bx - ox, c.bz - oz]];
      [q[0], q[1], q[2], q[1], q[3], q[2]].forEach(function (v) { wPos.push(v[0], WL, v[1]); wC.push(0, 0, 0, 0); });
    });
    const pondGeo = new THREE.BufferGeometry();
    pondGeo.setAttribute('position', new THREE.Float32BufferAttribute(wPos, 3));
    pondGeo.setAttribute('aC', new THREE.Float32BufferAttribute(wC, 4));
    const ponds = new THREE.Mesh(pondGeo, waterMat);
    ponds.frustumCulled = false;
    root.add(ponds);

    // río: cinta a lo largo de riverZ(x), a WL_R
    const WL_R = -1.0, NR = 180;
    const rPos = [], rC = [];
    for (let k = 0; k <= NR; k++) {
      const x = -WORLD + 2 * WORLD * k / NR;
      const z = riverZ(x);
      rPos.push(x, WL_R, z - 32, x, WL_R, z + 32);
      rC.push(0, 0, 0, 0, 0, 0, 0, 0);
    }
    const rIdx = [];
    for (let k = 0; k < NR; k++) {
      const a = 2 * k, b = 2 * k + 1, c = 2 * k + 2, d = 2 * k + 3;
      rIdx.push(a, b, c, b, d, c);
    }
    const riverGeo = new THREE.BufferGeometry();
    riverGeo.setAttribute('position', new THREE.Float32BufferAttribute(rPos, 3));
    riverGeo.setAttribute('aC', new THREE.Float32BufferAttribute(rC, 4));
    riverGeo.setIndex(rIdx);
    const river = new THREE.Mesh(riverGeo, waterMat);
    river.frustumCulled = false;
    root.add(river);

    // ---------- juncos y cañas (InstancedMesh) ----------
    const RU = {
      uWall: { value: 0 }, uQuake: { value: 0 }, uQT: { value: 0 }, uInvade: { value: 0 },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: new THREE.Color() }, uDayF: { value: 0 }
    };
    const junMat = new THREE.ShaderMaterial({
      uniforms: Object.assign({}, RU, { uC0: { value: new THREE.Color('#3f4a22') }, uC1: { value: new THREE.Color('#8f9a4e') } }),
      vertexShader: REED_VS, fragmentShader: REED_FS, side: THREE.DoubleSide
    });
    const canMat = new THREE.ShaderMaterial({
      uniforms: Object.assign({}, RU, { uC0: { value: new THREE.Color('#8a7a4c') }, uC1: { value: new THREE.Color('#d6c48e') } }),
      vertexShader: REED_VS, fragmentShader: REED_FS, side: THREE.DoubleSide
    });

    const junList = [], canList = [];
    const m4 = new THREE.Matrix4(), quat = new THREE.Quaternion(), vPos = new THREE.Vector3(), vSc = new THREE.Vector3();
    const yAxis = new THREE.Vector3(0, 1, 0);
    function placeOne(list, x, z, sc, inv) {
      list.push({ x: x, z: z, s: sc, inv: inv, y: sampleTerrain(x, z).h - 0.15, yaw: rnd() * TAU });
    }
    // juncos: sobre todo en las orillas de las charcas (densos) y algunos sueltos por la marisma
    let guard = 0;
    const nPonds = PONDS.filter(function (p) { return !p.flood; });
    while (junList.length < 5200 && guard < 200000) {
      guard++;
      let x, z;
      if (junList.length < 4300) {
        const P = nPonds[Math.floor(rnd() * nPonds.length)];
        const a = rnd() * TAU, rr = P.r * (0.9 + rnd() * 1.1);
        x = P.x + Math.cos(a) * rr; z = P.z + Math.sin(a) * rr;
      } else {
        const a = rnd() * TAU, rr = Math.sqrt(rnd()) * MR * 0.97;
        x = Math.cos(a) * rr; z = Math.sin(a) * rr;
      }
      if (inHole(x, z, 4)) continue;
      const s = sampleTerrain(x, z);
      if (s.h > 0.5 || s.quarry > 0.01) continue;
      placeOne(junList, x, z, 1.0 + rnd() * 1.2, 0);
    }
    // cañas: en los bordes de las charcas, de 2 a 3 m
    guard = 0;
    while (canList.length < 1200 && guard < 80000) {
      guard++;
      const P = nPonds[Math.floor(rnd() * nPonds.length)];
      const a = rnd() * TAU, rr = P.r * (0.9 + rnd() * 1.2);
      const x = P.x + Math.cos(a) * rr, z = P.z + Math.sin(a) * rr;
      if (inHole(x, z, 4)) continue;
      const s = sampleTerrain(x, z);
      if (s.h > 0.5) continue;
      placeOne(canList, x, z, 2.0 + rnd() * 1.2, 0);
    }
    // hierba alta: matas bajas y densas en toda la marisma
    const grassList = [];
    guard = 0;
    while (grassList.length < 3500 && guard < 60000) {
      guard++;
      const a = rnd() * TAU, rr = Math.sqrt(rnd()) * MR * 1.05;
      const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
      if (inHole(x, z, 3)) continue;
      const s = sampleTerrain(x, z);
      if (s.h > 1.5 || s.quarry > 0.01) continue;
      placeOne(grassList, x, z, 0.6 + rnd() * 0.8, 0);
    }
    // invasión: juncos que crecen alrededor de la columna de hoy (aparecen con s.today > 0.5)
    guard = 0; let inv = 0;
    while (inv < 450 && guard < 60000) {
      guard++;
      const a = rnd() * TAU, rr = 40 + rnd() * 110;
      const x = TODAY.x + Math.cos(a) * rr, z = TODAY.z + Math.sin(a) * rr;
      if (inHole(x, z, 4)) continue;
      const s = sampleTerrain(x, z);
      if (s.h > 0.6 || s.quarry > 0.01) continue;
      placeOne(junList, x, z, 1.0 + rnd() * 1.0, 0.5 + 0.45 * rnd());
      inv++;
    }

    function buildReedMesh(list, mat, geoBlades, hw, count) {
      const geo = makeReedGeometry(THREE, geoBlades, hw);
      const invArr = new Float32Array(list.length);
      for (let i = 0; i < list.length; i++) invArr[i] = list[i].inv;
      geo.setAttribute('aInv', new THREE.InstancedBufferAttribute(invArr, 1));
      const mesh = new THREE.InstancedMesh(geo, mat, list.length);
      for (let i = 0; i < list.length; i++) {
        const R = list[i];
        quat.setFromAxisAngle(yAxis, R.yaw);
        vSc.set(R.s, R.s, R.s);
        vPos.set(R.x, R.y, R.z);
        m4.compose(vPos, quat, vSc);
        mesh.setMatrixAt(i, m4);
      }
      mesh.instanceMatrix.needsUpdate = true;
      mesh.frustumCulled = false;
      root.add(mesh);
      return mesh;
    }
    const grassMat = new THREE.ShaderMaterial({
      uniforms: Object.assign({}, RU, { uC0: { value: new THREE.Color('#3b4a1e') }, uC1: { value: new THREE.Color('#9aa04a') } }),
      vertexShader: REED_VS, fragmentShader: REED_FS, side: THREE.DoubleSide
    });
    buildReedMesh(junList, junMat, 1, 0.13, junList.length);
    buildReedMesh(canList, canMat, 1, 0.16, canList.length);
    buildReedMesh(grassList, grassMat, 1, 0.11, grassList.length);

    // ---------- olivos, pinos y roca en las colinas y tierra seca ----------
    const trunkGeo = new THREE.CylinderGeometry(0.22, 0.4, 3.4, 6, 1, false).translate(0, 1.7, 0);
    const canopyGeo = makeCanopyGeometry(THREE);
    const oliveTrunk = new THREE.InstancedMesh(trunkGeo, new THREE.MeshStandardMaterial({ color: 0x6b5233, roughness: 0.95 }), 100);
    const oliveCanopy = new THREE.InstancedMesh(canopyGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, flatShading: true }), 100);
    const pineTrunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.2, 0.3, 4, 6).translate(0, 2, 0),
      new THREE.MeshStandardMaterial({ color: 0x5e4428, roughness: 0.95 }), 80);
    const pineCrown = new THREE.InstancedMesh(new THREE.ConeGeometry(2.4, 9, 7).translate(0, 8.5, 0),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, flatShading: true }), 80);
    const rockGeo = makeRockGeometry(THREE, 1);
    const rockMesh = new THREE.InstancedMesh(rockGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, flatShading: true }), 70);
    const cOliveA = new THREE.Color('#5f7035'), cOliveB = new THREE.Color('#84904a'), cPine = new THREE.Color('#2f4a2c');
    const cRockA = new THREE.Color('#8f836e'), cRockB = new THREE.Color('#6e6458');
    let nOlive = 0, nPine = 0, nRock = 0, gTree = 0;
    while ((nOlive < 100 || nPine < 80 || nRock < 70) && gTree < 60000) {
      gTree++;
      const x = (rnd() * 2 - 1) * 1500, z = (rnd() * 2 - 1) * 1500;
      if (Math.hypot(x, z) < 480 || inHole(x, z, 40)) continue;
      const s = sampleTerrain(x, z);
      if (s.quarry > 0.01 || s.river > 0.01 || s.city > 0.01 || s.pond > 0.0) continue;
      if (Math.abs(z - riverZ(x)) < 60) continue;
      if (Math.hypot(x - CITY.x, z - CITY.z) < CITY.r + 80) continue;
      const hgt = s.h;
      const e = 2;
      const slope = Math.abs(sampleTerrain(x + e, z).h - sampleTerrain(x - e, z).h) / (2 * e) +
                    Math.abs(sampleTerrain(x, z + e).h - sampleTerrain(x, z - e).h) / (2 * e);
      const sc = 0.85 + rnd() * 0.45;
      quat.setFromAxisAngle(yAxis, rnd() * TAU);
      if (hgt > 22 && slope > 0.25 && nRock < 70) {
        // roca en laderas empinadas
        vPos.set(x, hgt - 0.6, z);
        vSc.set(2.2 + rnd() * 3.5, 1.4 + rnd() * 2.2, 2.2 + rnd() * 3.5);
        m4.compose(vPos, quat, vSc);
        rockMesh.setMatrixAt(nRock, m4);
        rockMesh.setColorAt(nRock, rnd() < 0.5 ? cRockA : cRockB);
        nRock++;
      } else if (hgt > 22 && nPine < 80 && rnd() < 0.5) {
        // pino de las colinas
        vPos.set(x, hgt, z); vSc.set(sc, sc, sc);
        m4.compose(vPos, quat, vSc);
        pineTrunk.setMatrixAt(nPine, m4);
        pineCrown.setMatrixAt(nPine, m4);
        pineCrown.setColorAt(nPine, cPine);
        nPine++;
      } else if (hgt > 0.8 && hgt < 60 && nOlive < 100 && rnd() < 0.6) {
        // olivo en las laderas y la tierra seca
        vPos.set(x, hgt, z); vSc.set(sc, sc * (0.9 + rnd() * 0.3), sc);
        m4.compose(vPos, quat, vSc);
        oliveTrunk.setMatrixAt(nOlive, m4);
        oliveCanopy.setMatrixAt(nOlive, m4);
        oliveCanopy.setColorAt(nOlive, cOliveA.clone().lerp(cOliveB, rnd()));
        nOlive++;
      }
    }
    // los contadores parciales dejan instancias sin usar: se ocultan con count
    oliveTrunk.count = nOlive; oliveCanopy.count = nOlive;
    pineTrunk.count = nPine; pineCrown.count = nPine;
    rockMesh.count = nRock;
    [oliveTrunk, oliveCanopy, pineTrunk, pineCrown, rockMesh].forEach(function (mm) {
      mm.instanceMatrix.needsUpdate = true;
      if (mm.instanceColor) mm.instanceColor.needsUpdate = true;
      mm.frustumCulled = false;
      root.add(mm);
    });

    // ---------- cantera: cortes escalonados blancos en la ladera (el contenido lo hace construction) ----------
    const cutGeos = [];
    const cutCol = new THREE.Color('#d6cab2');
    const cutA = Math.atan2(500, 700);       // los cortes miran hacia el templo
    for (let k = 1; k <= 4; k++) {
      const R = 14 * k;
      const lvlIn = -8 + 3 * (k - 1), lvlOut = -8 + 3 * k;
      const steps = 40;
      for (let i = 0; i < steps; i++) {
        const th = cutA - 1.1 + 2.2 * i / (steps - 1);
        const cx = Q.x + Math.cos(th) * R, cz = Q.z + Math.sin(th) * R;
        const arc = R * (2.2 / (steps - 1)) * 1.15;      // longitud del segmento (con solape)
        const hgt = Math.max(0.6, lvlOut - lvlIn);
        const cy = lvlIn + hgt / 2 + 0.4;
        const g = new THREE.BoxGeometry(arc, hgt, 0.9);
        xf(THREE, g, cx, cy, cz, 0, -(th + Math.PI / 2), 0);
        cutGeos.push(paint(THREE, g, cutCol));
      }
    }
    const cutMesh = new THREE.Mesh(mergeGeos(THREE, cutGeos), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }));
    cutMesh.castShadow = false; cutMesh.receiveShadow = true;
    root.add(cutMesh);
    // bloques de mármol rodados en los escalones (rocosos y blancos)
    const qRocks = new THREE.InstancedMesh(makeRockGeometry(THREE, 0), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, flatShading: true }), 140);
    const cQA = new THREE.Color('#f2ece0'), cQB = new THREE.Color('#d6c9ae');
    for (let i = 0; i < 140; i++) {
      const k = 1 + Math.floor(rnd() * 4);
      const R = 14 * k + (rnd() - 0.5) * 6;
      const th = cutA - 1.15 + rnd() * 2.3;
      const sc = 1.2 + rnd() * 2.6;
      vPos.set(Q.x + Math.cos(th) * R, -8 + 3 * (k - 1) + sc * 0.2, Q.z + Math.sin(th) * R);
      vSc.set(sc, sc * 0.8, sc * (0.8 + rnd() * 0.4));
      quat.setFromAxisAngle(yAxis, rnd() * TAU);
      m4.compose(vPos, quat, vSc);
      qRocks.setMatrixAt(i, m4);
      qRocks.setColorAt(i, rnd() < 0.5 ? cQA : cQB);
    }
    qRocks.instanceMatrix.needsUpdate = true;
    qRocks.instanceColor.needsUpdate = true;
    qRocks.frustumCulled = false;
    root.add(qRocks);

    // ---------- Éfeso: casas, murallas, teatro ----------
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, flatShading: true });
    const houseMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, flatShading: true });
    const houseGeo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
    const houses = [];
    let gH = 0;
    while (houses.length < 260 && gH < 20000) {
      gH++;
      const a = rnd() * TAU, rr = Math.sqrt(rnd()) * (CITY.r - 60);
      const x = CITY.x + Math.cos(a) * rr, z = CITY.z + Math.sin(a) * rr;
      if (rr > CITY.r * 0.62 && rnd() < 0.6) continue;     // más densa en el centro
      const s = sampleTerrain(x, z);
      houses.push({ x: x, z: z, y: s.h - 0.3, w: 6 + rnd() * 6, d: 6 + rnd() * 6, h: 5 + rnd() * 7, ry: (rnd() - 0.5) * 0.3,
        col: [new THREE.Color('#e9dcc0'), new THREE.Color('#d7c6a3'), new THREE.Color('#c79a7c'), new THREE.Color('#f1ead9')][Math.floor(rnd() * 4)] });
    }
    const houseMesh = new THREE.InstancedMesh(houseGeo, houseMat, houses.length);
    const litPts = [];
    houses.forEach(function (H, i) {
      quat.setFromAxisAngle(yAxis, H.ry);
      vPos.set(H.x, H.y, H.z); vSc.set(H.w, H.h, H.d);
      m4.compose(vPos, quat, vSc);
      houseMesh.setMatrixAt(i, m4);
      houseMesh.setColorAt(i, H.col);
      if (rnd() < 0.5) litPts.push(H.x, H.y + H.h + 0.5, H.z);
    });
    houseMesh.instanceMatrix.needsUpdate = true;
    houseMesh.instanceColor.needsUpdate = true;
    houseMesh.frustumCulled = false;
    root.add(houseMesh);

    // murallas: anillo de bloques con cuatro puertas
    const stoneList = [];
    const WALL_N = 60, WALL_R = CITY.r - 30;
    for (let k = 0; k < WALL_N; k++) {
      const th = k / WALL_N * TAU;
      const near = [0, Math.PI / 2, Math.PI, Math.PI * 1.5].some(function (g) {
        let dd = Math.abs(((th - g) % TAU + TAU + Math.PI) % TAU - Math.PI); return dd < 0.09;
      });
      if (near) continue;
      const x = CITY.x + Math.cos(th) * WALL_R, z = CITY.z + Math.sin(th) * WALL_R;
      const s = sampleTerrain(x, z);
      const seg = TAU * WALL_R / WALL_N;
      stoneList.push({ x: x, y: s.h - 0.5, z: z, sx: seg + 1, sy: 8, sz: 3, ry: -(th + Math.PI / 2) });
    }
    // teatro: cávea en semicírculo sobre la pendiente y escena
    const TH = { x: CITY.x - 120, z: CITY.z - 150 };
    const thA = Math.atan2(-(TH.z - CITY.z), -(TH.x - CITY.x));
    for (let row = 0; row < 8; row++) {
      const R = 30 + row * 3.2;
      const n = Math.floor(Math.PI * R / 3.5);
      for (let i = 0; i < n; i++) {
        const th = thA - Math.PI / 2 + Math.PI * (i + 0.5) / n;
        const x = TH.x + Math.cos(th) * R, z = TH.z + Math.sin(th) * R;
        const s = sampleTerrain(x, z);
        stoneList.push({ x: x, y: s.h + row * 0.7 - 0.3, z: z, sx: Math.PI * R / n + 0.2, sy: 0.7, sz: 1.6, ry: -(th + Math.PI / 2) });
      }
    }
    const sts = sampleTerrain(TH.x, TH.z);
    stoneList.push({ x: TH.x, y: sts.h, z: TH.z, sx: 16, sy: 4, sz: 6, ry: -thA });   // escena
    const stoneMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), stoneMat, stoneList.length);
    const cWall = new THREE.Color('#d8ccb2'), cSeat = new THREE.Color('#e4d6b8');
    stoneList.forEach(function (B, i) {
      quat.setFromAxisAngle(yAxis, B.ry);
      vPos.set(B.x, B.y, B.z); vSc.set(B.sx, B.sy, B.sz);
      m4.compose(vPos, quat, vSc);
      stoneMesh.setMatrixAt(i, m4);
      stoneMesh.setColorAt(i, i < WALL_N ? cWall : cSeat);
    });
    stoneMesh.instanceMatrix.needsUpdate = true;
    stoneMesh.instanceColor.needsUpdate = true;
    stoneMesh.frustumCulled = false;
    root.add(stoneMesh);

    // luces de la ciudad de noche (puntos aditivos)
    const cityU = { uTime: { value: 0 }, uNight: { value: 0 }, uPx: { value: 90 }, uColor: { value: new THREE.Color('#ffc070') } };
    const cityLightGeo = new THREE.BufferGeometry();
    cityLightGeo.setAttribute('position', new THREE.Float32BufferAttribute(litPts, 3));
    const cityLights = new THREE.Points(cityLightGeo, new THREE.ShaderMaterial({
      uniforms: cityU, vertexShader: POINT_VS, fragmentShader: POINT_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
    }));
    cityLights.frustumCulled = false;
    root.add(cityLights);

    // ---------- hoy: columna reconstruida a trozos, nido y cigüeña, bloque suelto ----------
    const todayGroup = new THREE.Group();
    todayGroup.position.set(TODAY.x, 0, TODAY.z);
    root.add(todayGroup);
    const colGeos = [];
    const cBase = new THREE.Color('#cfc4ad');
    colGeos.push(paint(THREE, xf(THREE, new THREE.BoxGeometry(2.2, 0.6, 2.2), 0, 0.3, 0), cBase));
    const drumCols = ['#efe6d6', '#c9baa0', '#efe6d6', '#9a8c70', '#efe6d6', '#d8cdb6', '#a79a7e', '#efe6d6', '#cbbd9f'];
    for (let k = 0; k < 9; k++) {
      const y = 0.6 + 0.8 + 1.6 * k;
      const dx = (k === 5) ? 0.12 : 0;                      // un tambor desplazado: reconstrucción
      const g = new THREE.CylinderGeometry(0.82, 0.86, 1.6, 16, 1, false);
      colGeos.push(paint(THREE, xf(THREE, g, dx, y, 0), new THREE.Color(drumCols[k])));
    }
    const topY = 0.6 + 9 * 1.6;
    colGeos.push(paint(THREE, xf(THREE, new THREE.BoxGeometry(2.4, 0.5, 2.4), 0, topY + 0.25, 0), new THREE.Color('#e9dfcb')));
    colGeos.push(paint(THREE, xf(THREE, new THREE.BoxGeometry(2.7, 0.3, 2.7), 0, topY + 0.65, 0), new THREE.Color('#efe6d6')));
    const columnMesh = new THREE.Mesh(mergeGeos(THREE, colGeos), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }));
    columnMesh.castShadow = true; columnMesh.receiveShadow = true;
    todayGroup.add(columnMesh);

    // nido de cigüeña: palitos en anillo sobre el ábaco
    const stickGeo = new THREE.CylinderGeometry(0.035, 0.035, 1.3, 4, 1, false);
    stickGeo.rotateZ(Math.PI / 2);
    const nestMesh = new THREE.InstancedMesh(stickGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 }), 110);
    const cStick = new THREE.Color('#6b4b2c');
    const nestY = topY + 0.9;
    for (let i = 0; i < 110; i++) {
      const a = rnd() * TAU, rr = 0.2 + rnd() * 1.0;
      const hgt = (1 - Math.min(1, rr)) * 0.5 + rnd() * 0.2;
      quat.setFromEuler(new THREE.Euler(rnd() * 0.5 - 0.25, rnd() * TAU, rnd() * 0.5 - 0.25));
      vPos.set(Math.cos(a) * rr, nestY + hgt, Math.sin(a) * rr);
      vSc.set(1, 1, 1);
      m4.compose(vPos, quat, vSc);
      nestMesh.setMatrixAt(i, m4);
      nestMesh.setColorAt(i, cStick);
    }
    nestMesh.instanceMatrix.needsUpdate = true;
    nestMesh.instanceColor.needsUpdate = true;
    nestMesh.frustumCulled = false;
    todayGroup.add(nestMesh);

    // cigüeña (primitivas de escala uniforme)
    const storkGeos = [];
    const cWhite = new THREE.Color('#f2f1ec'), cBlack = new THREE.Color('#1e1e1e'), cBeak = new THREE.Color('#d24b2a'), cLeg = new THREE.Color('#c25a48');
    storkGeos.push(paint(THREE, xf(THREE, new THREE.CapsuleGeometry(0.3, 0.7, 4, 8), 0, 0.95, 0, 0, 0, Math.PI / 2), cWhite));
    storkGeos.push(paint(THREE, xf(THREE, new THREE.CylinderGeometry(0.06, 0.08, 0.9, 6), 0.35, 1.45, 0, 0, 0, -0.5), cWhite));
    storkGeos.push(paint(THREE, xf(THREE, new THREE.SphereGeometry(0.15, 8, 6), 0.55, 1.9, 0), cWhite));
    storkGeos.push(paint(THREE, xf(THREE, new THREE.ConeGeometry(0.05, 0.6, 6), 0.88, 1.86, 0, 0, 0, -Math.PI / 2), cBeak));
    storkGeos.push(paint(THREE, xf(THREE, new THREE.CylinderGeometry(0.04, 0.04, 1.2, 5), -0.05, 0.5, 0.12), cLeg));
    storkGeos.push(paint(THREE, xf(THREE, new THREE.CylinderGeometry(0.04, 0.04, 1.2, 5), -0.05, 0.5, -0.12), cLeg));
    storkGeos.push(paint(THREE, xf(THREE, new THREE.BoxGeometry(1.1, 0.08, 0.35), -0.2, 1.2, 0.28, 0.25, 0, 0.2), cBlack));
    storkGeos.push(paint(THREE, xf(THREE, new THREE.BoxGeometry(1.1, 0.08, 0.35), -0.2, 1.2, -0.28, -0.25, 0, -0.2), cBlack));
    const storkMesh = new THREE.Mesh(mergeGeos(THREE, storkGeos), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 }));
    storkMesh.position.set(0, nestY + 0.1, 0);
    storkMesh.castShadow = true;
    todayGroup.add(storkMesh);

    // bloque suelto junto a la columna (fuera del hueco)
    const bs = sampleTerrain(TODAY.x - 58, TODAY.z - 20);
    const blockGeo = paint(THREE, xf(THREE, new THREE.BoxGeometry(3.0, 1.4, 2.0), 0, 0.5, 0, 0, 0.4, 0), new THREE.Color('#c9b89a'));
    const blockMesh = new THREE.Mesh(blockGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }));
    blockMesh.position.set(TODAY.x - 58, bs.h, TODAY.z - 20);
    blockMesh.castShadow = true; blockMesh.receiveShadow = true;
    root.add(blockMesh);

    // ---------- actualización por frame (función del estado, sin acumulación) ----------
    function update(s) {
      const tod = fract(s.timeOfDay || 0);
      const wall = s.wall || 0;
      const t = s.t || 0;
      const today = clamp01(s.today || 0);
      const quake = clamp01(s.quakeDemo || 0);
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

      // luz principal: sol de día, luna de noche (baja y lateral)
      const lightDir = el >= 0 ? sunDir : moonDir;
      sun.position.copy(lightDir).multiplyScalar(SHADOW_DIST);
      sun.color.copy(MOON_COL).lerp(tSun, sunVis);
      sun.intensity = kSunI * sunVis * 1.25 + 0.6 * moonVis;
      tHemG.copy(HEM_GROUND_NIGHT).lerp(HEM_GROUND_DAY, dayF);
      hemi.color.copy(tHem);
      hemi.groundColor.copy(tHemG);
      hemi.intensity = 0.2 + 0.3 * dayF;
      renderer.toneMappingExposure = 0.8 + 0.1 * dayF;

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

      // niebla: muy suave, teñida del horizonte
      tFog.copy(tHor).lerp(FOG_DAY, 0.25 * dayF * (1.0 - 0.5 * dusk));
      scene.fog.color.copy(tFog);
      scene.fog.density = 0.00002 * (1 + 0.5 * moonVis) * (1 - 0.5 * dusk);
      skyU.uBelow.value.copy(tFog);

      // agua: reflejos, temblor (s.quakeDemo, fase s.t) e inundación de hoy
      waterU.uTime.value = wall;
      waterU.uLightDir.value.copy(lightDir);
      waterU.uLightI.value = sun.intensity;
      waterU.uHorizon.value.copy(tHor);
      waterU.uZenith.value.copy(tZen);
      waterU.uDeep.value.copy(DEEP_NIGHT).lerp(DEEP_DAY, dayF);
      waterU.uQuake.value = quake;
      waterU.uQT.value = t - 29;
      waterU.uFlood.value = sstep(0.2, 0.8, today);

      // juncos y cañas: viento, temblor e invasión
      RU.uWall.value = wall;
      RU.uQuake.value = quake;
      RU.uQT.value = t - 29;
      RU.uInvade.value = today;
      RU.uSunDir.value.copy(lightDir);
      RU.uSunCol.value.copy(sun.color);
      RU.uDayF.value = dayF;

      // ciudad de noche
      cityU.uTime.value = wall;
      cityU.uNight.value = moonVis;

      // hoy: aparece con s.today; la cigüeña llega al final
      todayGroup.visible = today > 0.01;
      storkMesh.visible = today > 0.55;
      blockMesh.visible = today > 0.05;
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
