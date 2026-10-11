// Entorno: cielo procedural (sol, luna creciente, estrellas, rayos crepusculares), niebla, terreno con
// dunas y cantera, el Nilo con palmeras, rocas sobre la meseta, polvo flotante y luciérnagas.
// Todo generado por código (sin texturas ni modelos externos).
// Nota: THREE.ColorManagement.legacyMode=false, así que THREE.Color(hex) ya es lineal; los shaders
// propios trabajan en lineal y convierten a sRGB al final (toSRGB).
(function () {
  'use strict';
  const G = window.GIZA;

  // ---------- utilidades ----------
  const TAU = Math.PI * 2;
  function clamp01(x) { return x < 0 ? 0 : (x > 1 ? 1 : x); }
  function fract(x) { return x - Math.floor(x); }
  // smoothstep que admite e0 > e1 (rampa invertida)
  function sstep(e0, e1, x) { const t = clamp01((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); }

  // generador pseudoaleatorio determinista (para que cada carga sea igual)
  let rngState = 12345;
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

  // ---------- geometría del mundo ----------
  const SITE = G.SITE;
  const Q = SITE.quarry;                       // cantera al sur: x, z, w, d, depth
  const NILE_X = SITE.nileX;                   // eje del Nilo (corre en Z)
  const PLAT = { x: -200, z: 400, r0: 1200, r1: 1700 }; // meseta plana (y=0) y transición a dunas
  const CANAL = { xc: 715, halfLen: 115, z: 150 };      // canal hacia el puerto (x 600..830)
  const TER_N = 250, TER_EXT = 8000;           // malla del terreno: 250 segmentos por lado
  const WATER_Y = -1;
  const SHADOW_DIST = 1200;
  const SUN_ELEV = 62 * Math.PI / 180;         // altura máxima del sol al mediodía
  const EY = Math.sin(SUN_ELEV), EZ = Math.cos(SUN_ELEV);
  const MOON_Y = 0.32;                         // luna baja y lateral: sombras largas

  // altura del terreno y máscaras en (x,z); reutiliza un objeto para no crear basura
  const tS = { h: 0, flood: 0, chan: 0, qT: 0, plat: 0, n: 0 };
  function sampleTerrain(x, z) {
    const dxp = x - PLAT.x, dzp = z - PLAT.z;
    const dP = Math.sqrt(dxp * dxp + dzp * dzp);
    const dunesW = sstep(PLAT.r0, PLAT.r1, dP);          // 0 en la meseta, 1 en el desierto abierto
    const n = fbm(x / 240, z / 240, 3, 23);
    // dunas con crestas marcadas (ridged) + ondulación suave
    const ridge = ridged(x / 600, z / 600, 4, 11);
    const w = fbm(x / 140, z / 140, 2, 5);
    const dune = 62 * Math.max(0, ridge - 0.12) + 4 * w;
    let h = dune * dunesW;

    // llanura de inundación del Nilo (verde) y cauce (agua a y=-1)
    const dn = Math.abs(x - NILE_X);
    const flood = sstep(340, 260, dn);
    const floodH = 0.6 + 0.8 * vnoise(x / 90, z / 90, 3);
    h += (floodH - h) * flood;
    const chan = sstep(150, 125, dn);
    h += (-3 - h) * chan;

    // canal del puerto
    const cx = Math.abs(x - CANAL.xc), cz = Math.abs(z - CANAL.z);
    const canal = sstep(CANAL.halfLen + 12, CANAL.halfLen, cx) * sstep(24, 16, cz);
    h += (-2.2 - h) * canal;

    // cantera rectangular (distancia tipo SDF: negativa dentro)
    const sd = Math.max(Math.abs(x - Q.x) - Q.w / 2, Math.abs(z - Q.z) - Q.d / 2);
    const qT = sstep(8, -4, sd);
    h += (-Q.depth - h) * qT;

    // borde del mundo: el terreno se hunde para que no quede una franja visible en el horizonte
    h -= 70 * sstep(6200, 7800, Math.max(Math.abs(x), Math.abs(z)));
    tS.h = h; tS.flood = flood; tS.chan = Math.max(chan, canal); tS.qT = qT;
    tS.plat = 1 - dunesW; tS.n = n; tS.sd = sd;
    return tS;
  }

  // ---------- GLSL ----------
  const COMMON_GLSL = [
    'vec3 toSRGB(vec3 c) { return pow(max(c, vec3(0.0)), vec3(1.0 / 2.2)); }'
  ].join('\n');

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
    '  vec3 below = uBelow;',
    '  vec3 sky = mix(below, up, smoothstep(-0.02, 0.02, h));',
    // calima: banda temblorosa cerca del horizonte (espejismo leve)
    '  float hzBand = exp(-h * h * 400.0) * uDay;',
    '  float wob = 0.5 + 0.5 * sin(d.x * 240.0 + uTime * 1.4) * sin(d.z * 200.0 - uTime * 1.1);',
    '  sky += vec3(0.012, 0.008, 0.0) * hzBand * wob;',
    // sol: disco (más grande cerca del horizonte) + halo
    '  float sd = dot(d, uSunDir);',
    '  float sdc = max(sd, 0.0);',
    '  float cr = cos(uSunAng);',
    '  float disc = smoothstep(cr - 0.00003, cr + 0.00001, sd);',
    '  float halo = pow(sdc, 900.0) * 0.9 + pow(sdc, 60.0) * 0.35 + pow(sdc, 6.0) * 0.12;',
    '  sky += uSunCol * (disc * 5.0 + halo) * uSunVis;',
    // rayos crepusculares (haces desde el sol)
    '  float ang = atan(dot(d, uSunT2), dot(d, uSunT1));',
    '  float rays = pow(0.5 + 0.5 * sin(ang * 23.0 + vnoise3(vec3(ang * 4.0, 0.5, 0.0)) * 7.0), 5.0);',
    '  rays *= 0.6 + 0.4 * vnoise3(vec3(ang * 11.0, 3.0, 1.0));',
    '  float fall = exp(-(1.0 - sdc) * 9.0);',
    '  sky += uSunCol * rays * fall * uDusk * 0.45 * smoothstep(-0.1, 0.25, h);',
    // luna creciente (disco menos un disco desplazado)
    '  float md = dot(d, uMoonDir);',
    '  float mdisc = smoothstep(0.99978, 0.99990, md) * (1.0 - smoothstep(0.99978, 0.99990, dot(d, uMoonCut)));',
    '  sky += vec3(0.8, 0.86, 1.0) * mdisc * uMoonVis * 1.3;',
    '  sky += vec3(0.3, 0.36, 0.6) * (pow(max(md, 0.0), 260.0) * 0.35 + pow(max(md, 0.0), 40.0) * 0.04) * uMoonVis;',
    // estrellas nítidas y numerosas, con parpadeo y colores (azuladas / anaranjadas / blancas)
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
    // olas: derivadas analíticas de h = 0.25 sin(a1) + 0.18 sin(a2) + 0.12 sin(a3)
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

  const MOTE_VS = [
    'uniform float uTime; uniform float uNight; uniform float uPx;',
    'varying float vA;',
    'void main() {',
    '  float ph = fract(sin(dot(position.xz, vec2(12.9898, 78.233))) * 43758.5453) * 6.2831;',
    '  vec3 p = position + vec3(sin(uTime * 0.35 + ph * 6.0) * 3.0,',
    '                           sin(uTime * 0.6 + ph * 9.0) * 1.6 + 1.0,',
    '                           cos(uTime * 0.3 + ph * 5.0) * 3.0);',
    '  vec4 mv = modelViewMatrix * vec4(p, 1.0);',
    '  gl_Position = projectionMatrix * mv;',
    '  gl_PointSize = clamp(uPx / -mv.z, 2.0, 12.0);',
    '  float tw = 0.5 + 0.5 * sin(uTime * (1.5 + ph * 0.5) + ph * 40.0);',
    '  vA = uNight * tw;',
    '}'
  ].join('\n');

  // textura de arena (tileable): grano + manchas + rizaduras de viento
  function makeSandTexture(THREE) {
    const size = 512;
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
        // rizaduras: 20 crestas por tile (tile = 40 m, cresta cada ~2 m)
        const u = x / size, v = y / size;
        let rip = 0.5 + 0.5 * Math.sin(TAU * (20 * u + 0.8 * Math.sin(TAU * 3 * v)));
        rip = rip * rip * rip;
        const val = 232 + 30 * (grain - 0.5) + 12 * (blot - 0.5) + 18 * (rip - 0.5);
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

  // roca / piedra: icosaedro con vértices desplazados por una función de posición (sin grietas)
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

  // paletas por hora (tod 0..1): cielo cenit/horizonte, color del sol, intensidad, hemisferio
  G.createEnvironment = function (ctx) {
    const THREE = ctx.THREE, scene = ctx.scene, camera = ctx.camera, renderer = ctx.renderer;
    const root = new THREE.Group(); scene.add(root);

    const MOON_COL = new THREE.Color('#6f8fe0');
    const DEEP_DAY = new THREE.Color('#2f5f5a'), DEEP_NIGHT = new THREE.Color('#081018');
    const FOG_DAY = new THREE.Color('#d9c4a0');
    const HEM_GROUND_DAY = new THREE.Color('#8a6a44');
    const HEM_GROUND_NIGHT = new THREE.Color('#2a3050');
    const KEYS = [
      // t,    cenit,      horizonte,  color sol,  intensidad, hemisferio
      [0.00,  '#02040c', '#0b1426', '#6f8fe0', 0.0, '#1a2550'],   // medianoche
      [0.18,  '#02040c', '#0b1426', '#6f8fe0', 0.0, '#1d2a58'],
      [0.235, '#2b3c7a', '#ff8a7a', '#ffa070', 1.1, '#7a6a9a'],   // amanecer naranja/rosa
      [0.30,  '#4f86c4', '#f4cfa6', '#ffd2a0', 1.9, '#b8c4d8'],
      [0.38,  '#3d7fc4', '#d9dcd8', '#fff0d6', 2.3, '#c9d8ea'],
      [0.50,  '#3d7fc4', '#cfd9df', '#fff2dc', 2.5, '#d0dde8'],   // día azul desértico
      [0.62,  '#3f7dc2', '#d6d6cc', '#ffe6b8', 2.3, '#c9d8ea'],
      [0.72,  '#34509a', '#ffb070', '#ffb050', 1.6, '#f0b880'],   // atardecer dorado intenso
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

    // ---------- niebla (ligera, teñida de arena) ----------
    scene.fog = new THREE.FogExp2(FOG_DAY.getHex(), 0.00009);

    // ---------- sol / luna ----------
    const sun = new THREE.DirectionalLight(0xffffff, 2);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 2048; sun.shadow.mapSize.height = 2048;
    const sc = sun.shadow.camera;
    sc.left = -450; sc.right = 450; sc.top = 450; sc.bottom = -450; sc.near = 300; sc.far = 2100;
    sc.updateProjectionMatrix();
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.6;
    sun.target.position.set(0, 0, 0);
    root.add(sun); root.add(sun.target);

    const hemi = new THREE.HemisphereLight(0xd6e6ff, 0x8a6a44, 0.6);
    root.add(hemi);

    // ---------- terreno ----------
    const NV = TER_N + 1;
    const tPos = new Float32Array(NV * NV * 3);
    const tCol = new Float32Array(NV * NV * 3);
    const tUv = new Float32Array(NV * NV * 2);
    const xs = new Float64Array(NV);
    for (let i = 0; i < NV; i++) {
      const u = -1 + 2 * i / TER_N;
      xs[i] = TER_EXT * u * Math.abs(u); // más densidad de vértices cerca del centro (cantera, Nilo)
    }
    const cSandA = new THREE.Color('#c9995c'), cSandB = new THREE.Color('#a8743f');
    const cPale = new THREE.Color('#dcb67a'), cGreen = new THREE.Color('#5d7535');
    const cWet = new THREE.Color('#5a4630'), cQuarry = new THREE.Color('#8f6c45');
    const tmpC = new THREE.Color();
    for (let j = 0; j < NV; j++) {
      for (let i = 0; i < NV; i++) {
        const idx = j * NV + i;
        const x = xs[i], z = xs[j];
        const s = sampleTerrain(x, z);
        tPos[idx * 3] = x; tPos[idx * 3 + 1] = s.h; tPos[idx * 3 + 2] = z;
        tUv[idx * 2] = x / 40; tUv[idx * 2 + 1] = z / 40;
        tmpC.copy(cSandB).lerp(cSandA, s.n);
        tmpC.lerp(cPale, s.plat * 0.3);
        tmpC.lerp(cGreen, s.flood * (0.5 + 0.4 * s.n));
        tmpC.lerp(cWet, s.chan * 0.8);
        tmpC.lerp(cQuarry, s.qT);
        tCol[idx * 3] = tmpC.r; tCol[idx * 3 + 1] = tmpC.g; tCol[idx * 3 + 2] = tmpC.b;
      }
    }
    const tIdx = new Uint32Array(TER_N * TER_N * 6);
    let p = 0;
    for (let j = 0; j < TER_N; j++) {
      for (let i = 0; i < TER_N; i++) {
        const v00 = j * NV + i, v01 = (j + 1) * NV + i, v10 = j * NV + i + 1, v11 = (j + 1) * NV + i + 1;
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
    // sombreado extra por pendiente (laderas más oscuras) sobre el color por vértice
    const nrm = terGeo.attributes.normal.array;
    for (let k = 0; k < NV * NV; k++) {
      const shade = 0.7 + 0.3 * clamp01(nrm[k * 3 + 1]);
      tCol[k * 3] *= shade; tCol[k * 3 + 1] *= shade; tCol[k * 3 + 2] *= shade;
    }
    const sandTex = makeSandTexture(THREE);
    const terMat = new THREE.MeshStandardMaterial({ vertexColors: true, map: sandTex, roughness: 0.97, metalness: 0 });
    const terrain = new THREE.Mesh(terGeo, terMat);
    terrain.receiveShadow = true;
    root.add(terrain);

    // ---------- agua del Nilo y del canal ----------
    const waterU = {
      uTime: { value: 0 }, uLightDir: { value: new THREE.Vector3(0, 1, 0) },
      uLightCol: { value: sun.color }, uLightI: { value: 0 },
      uHorizon: { value: new THREE.Color() }, uZenith: { value: new THREE.Color() },
      uDeep: { value: new THREE.Color('#2f5f5a') }
    };
    const waterMat = new THREE.ShaderMaterial({ uniforms: waterU, vertexShader: WATER_VS, fragmentShader: WATER_FS });
    const nileGeo = new THREE.PlaneGeometry(300, 12000, 1, 1);
    nileGeo.rotateX(-Math.PI / 2); nileGeo.translate(NILE_X, WATER_Y, 0);
    const nile = new THREE.Mesh(nileGeo, waterMat);
    const canalGeo = new THREE.PlaneGeometry(CANAL.halfLen * 2, 40, 1, 1);
    canalGeo.rotateX(-Math.PI / 2); canalGeo.translate(CANAL.xc, WATER_Y, CANAL.z);
    const canal = new THREE.Mesh(canalGeo, waterMat);
    root.add(nile); root.add(canal);

    // ---------- palmeras (InstancedMesh) ----------
    const PALMS = 300;
    const trunkGeo = new THREE.CylinderGeometry(0.28, 0.42, 9, 6, 1, true);
    trunkGeo.translate(0, 4.5, 0);
    const leafGeo = buildPalmLeaves(THREE);
    const trunkMesh = new THREE.InstancedMesh(trunkGeo, new THREE.MeshStandardMaterial({ color: 0x6b4f2e, roughness: 0.9 }), PALMS);
    const crownMesh = new THREE.InstancedMesh(leafGeo, new THREE.MeshStandardMaterial({ color: 0x3f7a33, roughness: 0.8, side: THREE.DoubleSide }), PALMS);
    const m4 = new THREE.Matrix4(), quat = new THREE.Quaternion(), vPos = new THREE.Vector3(), vSc = new THREE.Vector3();
    const yAxis = new THREE.Vector3(0, 1, 0);
    for (let k = 0; k < PALMS; k++) {
      const side = rnd() < 0.5 ? -1 : 1;
      const x = NILE_X + side * (150 + rnd() * 90);
      const z = -5800 + rnd() * 11600;
      const y = sampleTerrain(x, z).h;
      const sc1 = 0.8 + rnd() * 0.5;
      quat.setFromAxisAngle(yAxis, rnd() * TAU);
      vSc.set(sc1, sc1, sc1);
      vPos.set(x, y, z);
      m4.compose(vPos, quat, vSc);
      trunkMesh.setMatrixAt(k, m4);
      vPos.set(x, y + 9 * sc1, z);
      m4.compose(vPos, quat, vSc);
      crownMesh.setMatrixAt(k, m4);
    }
    trunkMesh.instanceMatrix.needsUpdate = true;
    crownMesh.instanceMatrix.needsUpdate = true;
    trunkMesh.castShadow = true; crownMesh.castShadow = true;
    trunkMesh.frustumCulled = false; crownMesh.frustumCulled = false;
    root.add(trunkMesh); root.add(crownMesh);

    // ---------- rocas y piedras sobre la meseta (<= 2000 instancias) ----------
    // fuera de |x|,|z| < 140 (pirámide), de Kefrén/Micerino y de la cantera
    const ROCKS = 500, PEBBLES = 1500;
    const rockMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, metalness: 0, flatShading: true });
    const rockMesh = new THREE.InstancedMesh(makeRockGeometry(THREE, 0), rockMat, ROCKS);
    const pebbleMesh = new THREE.InstancedMesh(makeRockGeometry(THREE, 0), rockMat, PEBBLES);
    const rockCols = ['#8f7a5e', '#6e6258', '#a68f6c', '#5f5a52', '#b09670'].map(function (c) { return new THREE.Color(c); });
    const KHAFRE = SITE.khafre, MENKAURE = SITE.menkaure;
    function scatter(mesh, count, rMin, rMax, castSh) {
      let placed = 0, tries = 0;
      while (placed < count && tries < count * 20) {
        tries++;
        const ang = rnd() * TAU, rad = Math.sqrt(rnd()) * 1100;
        const x = PLAT.x + Math.cos(ang) * rad, z = PLAT.z + Math.sin(ang) * rad;
        if (Math.abs(x) < 140 && Math.abs(z) < 140) continue;
        if (Math.hypot(x - KHAFRE.x, z - KHAFRE.z) < 170) continue;
        if (Math.hypot(x - MENKAURE.x, z - MENKAURE.z) < 110) continue;
        const sd = sampleTerrain(x, z).sd;
        if (sd < 12) continue;                       // no dentro ni al borde de la cantera
        const r = rMin + (rMax - rMin) * rnd();
        vSc.set(r * (0.8 + 0.4 * rnd()), r * 0.6, r * (0.8 + 0.4 * rnd()));
        quat.setFromAxisAngle(yAxis, rnd() * TAU);
        vPos.set(x, sampleTerrain(x, z).h - r * 0.25, z);
        m4.compose(vPos, quat, vSc);
        mesh.setMatrixAt(placed, m4);
        mesh.setColorAt(placed, rockCols[Math.floor(rnd() * rockCols.length)]);
        placed++;
      }
      mesh.count = placed;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.castShadow = castSh; mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      root.add(mesh);
    }
    scatter(rockMesh, ROCKS, 0.6, 3.0, true);
    scatter(pebbleMesh, PEBBLES, 0.08, 0.35, false);

    // ---------- polvo flotante cerca de la cámara ----------
    const DUST = 1500;
    const dustPos = new Float32Array(DUST * 3);
    for (let k = 0; k < DUST * 3; k++) dustPos[k] = rnd();
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
    const dustU = {
      uTime: { value: 0 }, uCenter: { value: new THREE.Vector3() }, uPx: { value: 60 },
      uAlpha: { value: 0.3 }, uColor: { value: new THREE.Color('#e6c28a') }
    };
    const dustMat = new THREE.ShaderMaterial({
      uniforms: dustU, vertexShader: DUST_VS, fragmentShader: POINT_FS,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
    });
    const dust = new THREE.Points(dustGeo, dustMat);
    dust.frustumCulled = false;
    root.add(dust);

    // ---------- luciérnagas / motas doradas de noche ----------
    const MOTES = 360;
    const motePos = new Float32Array(MOTES * 3);
    for (let k = 0; k < MOTES; k++) {
      const x = -700 + rnd() * 1400, z = -700 + rnd() * 1400;
      motePos[k * 3] = x;
      motePos[k * 3 + 1] = sampleTerrain(x, z).h + 1.5 + rnd() * 6;
      motePos[k * 3 + 2] = z;
    }
    const moteGeo = new THREE.BufferGeometry();
    moteGeo.setAttribute('position', new THREE.BufferAttribute(motePos, 3));
    const moteU = { uTime: { value: 0 }, uNight: { value: 0 }, uPx: { value: 40 }, uColor: { value: new THREE.Color('#ffc857') } };
    const moteMat = new THREE.ShaderMaterial({
      uniforms: moteU, vertexShader: MOTE_VS, fragmentShader: POINT_FS,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
    });
    const motes = new THREE.Points(moteGeo, moteMat);
    motes.frustumCulled = false;
    root.add(motes);

    // ---------- actualización por frame (función del estado, sin acumulación) ----------
    function update(s) {
      const tod = fract(s.timeOfDay || 0);
      const wall = s.wall || 0;
      // el sol nace por el este (+X), sube hacia el sur (+Z) y se pone por el oeste (-X)
      const a = (tod - 0.25) * TAU;
      sunDir.set(Math.cos(a), Math.sin(a) * EY, Math.sin(a) * EZ);
      // luna: opuesta en azimut, pero baja (sombras largas y laterales)
      moonDir.set(-sunDir.x, MOON_Y, -sunDir.z).normalize();
      // creciente: el disco "recortado" se desplaza en sentido contrario al sol
      tmpV.copy(sunDir).addScaledVector(moonDir, -sunDir.dot(moonDir)).normalize();
      moonCut.copy(moonDir).addScaledVector(tmpV, -0.012).normalize();
      // base para rayos crepusculares alrededor del sol
      sunT1.crossVectors(sunDir, upV).normalize();
      sunT2.crossVectors(sunDir, sunT1).normalize();

      const el = sunDir.y;
      const sunVis = sstep(0.0, 0.12, el);      // 1 de día, 0 de noche
      const moonVis = sstep(0.0, -0.12, el);    // 1 de noche
      const dayF = sstep(-0.05, 0.3, el);
      const dusk = sunVis * (1 - sstep(0.1, 0.5, el)); // sol bajo: amanecer / atardecer

      keyAt(tod);

      // luz principal: sol de día, luna de noche (baja y lateral)
      const lightDir = el >= 0 ? sunDir : moonDir;
      sun.position.copy(lightDir).multiplyScalar(SHADOW_DIST);
      sun.color.copy(MOON_COL).lerp(tSun, sunVis);
      sun.intensity = kSunI * sunVis + 0.6 * moonVis;
      tHemG.copy(HEM_GROUND_NIGHT).lerp(HEM_GROUND_DAY, dayF);
      hemi.color.copy(tHem);
      hemi.groundColor.copy(tHemG);
      hemi.intensity = 0.25 + 0.6 * dayF;                  // noche ~0.25 azulada
      renderer.toneMappingExposure = 0.8 + 0.1 * dayF;     // ~0.9 de día, ~0.8 de noche

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
      skyU.uSunAng.value = 0.0047 * (1 + 2.5 * dusk);  // sol más grande al amanecer/atardecer
      skyU.uTime.value = wall;

      // niebla: horizonte teñido, en día arena cálida
      tFog.copy(tHor).lerp(FOG_DAY, 0.7 * dayF);
      scene.fog.color.copy(tFog);
      scene.fog.density = 0.00009 * (1 - 0.7 * moonVis);  // niebla nocturna mínima
      skyU.uBelow.value.copy(tFog);

      // agua
      waterU.uTime.value = wall;
      waterU.uLightDir.value.copy(lightDir);
      waterU.uLightI.value = sun.intensity;
      waterU.uHorizon.value.copy(tHor);
      waterU.uZenith.value.copy(tZen);
      waterU.uDeep.value.copy(DEEP_NIGHT).lerp(DEEP_DAY, dayF);  // agua oscura de noche

      // polvo y motas
      dustU.uTime.value = wall;
      dustU.uCenter.value.copy(camera.position);
      dustU.uAlpha.value = 0.18 + 0.22 * dayF;
      moteU.uTime.value = wall;
      moteU.uNight.value = moonVis;
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
