// Entorno de Babilonia: cielo de Mesopotamia (sol fuerte, calima leve, noche estrellada con luna),
// llanura aluvial con campos y palmerales junto al Éufrates, río y canal con agua (y un cauce seco de barro
// agrietado cuando el río se desplaza), ciudad (palacio sur, puerta de Ishtar, zigurat, murallas dobles,
// casas de adobe) y las ruinas de hoy. Todo procedural: geometría, shaders y CanvasTexture dibujadas por código.
(function () {
  'use strict';
  const G = window.GIZA;

  // ---------- utilidades ----------
  const TAU = Math.PI * 2;
  function clamp01(x) { return x < 0 ? 0 : (x > 1 ? 1 : x); }
  function fract(x) { return x - Math.floor(x); }
  function sstep(e0, e1, x) { const t = clamp01((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); }

  let rngState = 4242;
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
    for (let i = 0; i < oct; i++) { s += amp * vnoise(x * f, z * f, sd + i * 17); norm += amp; amp *= 0.5; f *= 2.03; }
    return s / norm;
  }

  // ---------- geometría del mundo ----------
  const SITE = G.SITE;
  const RIV_X = SITE.river.x;            // -190: Éufrates (corre en Z)
  const RIV_HW = 97;                      // semiancho del hueco del cauce (lecho + orillas)
  const RIV_FHW = 75;                     // semiancho del fondo del cauce (150 m)
  const RIV_FLOOR = -2.9;
  const RIV_LEN = 2950;
  const WATER_Y = SITE.river.waterY;      // -1
  const SHIFT_X = -250;                   // desplazamiento hacia el oeste (riverShift)
  const NEW_X = RIV_X + SHIFT_X;          // -440: nuevo cauce
  const EXT = 6000, SEG = 96;            // terreno (±3 km)
  const GROUND_PX = 1024;
  const WALL_R = SITE.walls.radius, WALL_IN = WALL_R - 38;
  const PAL = SITE.palace, ZIG = SITE.ziggurat, ISH = SITE.ishtar;
  const CAN = SITE.canal;                 // canal de x0 a x1 en z = 0
  const CAN_HW = 16, CAN_FHW = 8, CAN_FLOOR = -2.2;
  const MOON_Y = 0.32;
  const SUN_ELEV = 62 * Math.PI / 180;
  const EY = Math.sin(SUN_ELEV), EZ = Math.cos(SUN_ELEV);
  const HOLE = { value: 0 };              // 1 cuando el río se ha desplazado: se abre el hueco del nuevo cauce

  // ---------- texturas (dibujadas por código) ----------
  function paint(size, fn) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = size;
    const g = cv.getContext('2d');
    const img = g.createImageData(size, size);
    const d = img.data, o = [0, 0, 0];
    for (let py = 0; py < size; py++) {
      for (let px = 0; px < size; px++) {
        fn(px, py, o);
        const i = (py * size + px) * 4;
        d[i] = o[0]; d[i + 1] = o[1]; d[i + 2] = o[2]; d[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    return cv;
  }
  function makeTex(THREE, cv, wrap) {
    const t = new THREE.CanvasTexture(cv);
    if (wrap) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.encoding = THREE.sRGBEncoding;
    return t;
  }
  // suelo: ocre con manchas, campos verdes con surcos junto al río, acequias
  function groundPaint(px, py, o) {
    const X = (px + 0.5) / GROUND_PX * EXT - EXT / 2;
    const Z = (py + 0.5) / GROUND_PX * EXT - EXT / 2;
    const n = fbm(X / 170, Z / 170, 3, 7);
    const dR = Math.abs(X - RIV_X);
    let r = 201 + (176 - 201) * n, g = 160 + (132 - 160) * n, b = 106 + (82 - 106) * n;
    const wet = sstep(150, 100, dR) * 0.12;
    r *= 1 - wet; g *= 1 - wet; b *= 1 - wet;
    const fz = sstep(560, 360, dR);
    const cx = Math.floor(X / 64), cz = Math.floor(Z / 64);
    const isF = hash2(cx, cz, 9) > 0.28 ? 1 : 0;
    const fu = 0.5 + 0.5 * Math.sin(Z * 0.8 + hash2(cx, cz, 4) * 6);
    const fa = fz * isF * 0.9;
    r += (96 + 22 * fu - r) * fa; g += (128 + 16 * fu - g) * fa; b += (52 + 8 * fu - b) * fa;
    const ditch = (fract(X / 64) < 0.03 || fract(Z / 64) < 0.03) ? fz : 0;
    r += (92 - r) * ditch * 0.6; g += (72 - g) * ditch * 0.6; b += (44 - b) * ditch * 0.6;
    o[0] = r; o[1] = g; o[2] = b;
  }
  // barro agrietado (periódico, tileable)
  function mudPaint(px, py, o) {
    const u = px / 256, v = py / 256;
    const a = fract(4 * u + 0.25 * Math.sin(TAU * 2 * v));
    const b = fract(4 * v + 0.25 * Math.sin(TAU * 2 * u));
    const gr = (hash2(px, py, 3) - 0.5) * 18;
    if (a < 0.045 || b < 0.045) { o[0] = 66 + gr; o[1] = 47 + gr; o[2] = 30 + gr; }
    else { o[0] = 150 + gr; o[1] = 116 + gr; o[2] = 80 + gr; }
  }
  // ladrillo cocido con llagas (tile de 4 x 8 ladrillos)
  function brickPaint(px, py, o) {
    const row = Math.floor(py / 32);
    const xo = (px + (row & 1) * 32) % 256;
    const col = Math.floor(xo / 64);
    if (py % 32 < 3 || xo % 64 < 3) { o[0] = 214; o[1] = 200; o[2] = 170; return; }
    const hv = hash2(col, row, 5), gr = (hash2(px, py, 7) - 0.5) * 16;
    const k = 0.84 + 0.3 * hv;
    o[0] = 184 * k + gr; o[1] = 121 * k + gr * 0.7; o[2] = 74 * k + gr * 0.5;
  }
  // ladrillo vidriado azul (tile de 6 m con toro y dragón en relieve dorado)
  function glazedPaint(px, py, o) {
    const row = Math.floor(py / 64);
    const xo = (px + (row & 1) * 64) % 512;
    const col = Math.floor(xo / 128);
    if (py % 64 < 4 || xo % 128 < 4) { o[0] = 40; o[1] = 38; o[2] = 62; return; }
    const hv = hash2(col, row, 11), gr = (hash2(px, py, 13) - 0.5) * 10;
    const k = 0.85 + 0.25 * hv;
    o[0] = 31 * k + gr; o[1] = 80 * k + gr; o[2] = 160 * k + gr;
  }
  function drawBull(g, cx, cy, s) {
    g.save();
    g.fillStyle = '#e0b257'; g.strokeStyle = '#3a2a10'; g.lineWidth = 2.5 * s;
    g.beginPath(); g.ellipse(cx, cy, 70 * s, 34 * s, 0, 0, TAU); g.fill(); g.stroke();
    g.beginPath(); g.ellipse(cx + 72 * s, cy - 16 * s, 26 * s, 22 * s, 0, 0, TAU); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(cx + 80 * s, cy - 36 * s); g.quadraticCurveTo(cx + 100 * s, cy - 66 * s, cx + 112 * s, cy - 50 * s); g.stroke();
    g.beginPath(); g.moveTo(cx - 68 * s, cy - 6 * s); g.quadraticCurveTo(cx - 100 * s, cy - 32 * s, cx - 92 * s, cy + 18 * s); g.stroke();
    for (const dx of [-48, -22, 22, 46]) g.fillRect(cx + dx * s - 6 * s, cy + 22 * s, 12 * s, 46 * s);
    for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(cx + 60 * s - i * 9 * s, cy - 4 * s, 9 * s, 0, TAU); g.stroke(); }
    g.restore();
  }
  function drawDragon(g, cx, cy, s) {
    const path = function () {
      g.beginPath();
      for (let i = 0; i <= 40; i++) {
        const x = cx - 90 * s + i * 4.5 * s, y = cy + 22 * s * Math.sin(i * 0.35);
        if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
    };
    g.save(); g.lineCap = 'round';
    g.strokeStyle = '#8a5a14'; g.lineWidth = 18 * s; path(); g.stroke();
    g.strokeStyle = '#e0b257'; g.lineWidth = 11 * s; path(); g.stroke();
    g.fillStyle = '#e0b257';
    for (let i = 2; i < 40; i += 4) {
      const x = cx - 90 * s + i * 4.5 * s, y = cy + 22 * s * Math.sin(i * 0.35);
      g.beginPath(); g.moveTo(x - 4 * s, y - 8 * s); g.lineTo(x + 2 * s, y - 24 * s); g.lineTo(x + 5 * s, y - 7 * s); g.fill();
    }
    const hx = cx + 94 * s, hy = cy + 22 * s * Math.sin(40 * 0.35);
    g.beginPath(); g.ellipse(hx, hy, 16 * s, 11 * s, 0, 0, TAU); g.fill();
    g.restore();
  }
  function glazedCanvas() {
    const cv = paint(512, glazedPaint);
    const g = cv.getContext('2d');
    drawBull(g, 150, 256, 0.9);
    drawDragon(g, 380, 256, 0.85);
    return cv;
  }
  // adobe: barro claro con manchas
  function adobePaint(px, py, o) {
    const k = 0.88 + 0.22 * hash2(px, py, 21) + 0.1 * (vnoise(px / 14, py / 14, 5) - 0.5);
    o[0] = 201 * k; o[1] = 164 * k; o[2] = 119 * k;
  }

  // ---------- geometría fusionada (cajas con uv planares en metros) ----------
  function MB(THREE) { this.THREE = THREE; this.p = []; }
  MB.prototype.box = function (x, y, z, sx, sy, sz, ry) {
    const g = new this.THREE.BoxGeometry(sx, sy, sz).toNonIndexed();
    g.applyMatrix4(new this.THREE.Matrix4().makeRotationY(ry || 0).setPosition(x, y, z));
    const a = g.attributes.position.array;
    for (let i = 0; i < a.length; i++) this.p.push(a[i]);
    g.dispose();
    return this;
  };
  MB.prototype.tri = function (a, b, c) {
    const p = this.p;
    p.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
  };
  MB.prototype.build = function (tile) {
    const THREE = this.THREE, pa = this.p, n = pa.length / 3;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pa, 3));
    g.computeVertexNormals();
    const nr = g.attributes.normal.array, uv = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) {
      const x = pa[i * 3], y = pa[i * 3 + 1], z = pa[i * 3 + 2];
      const ax = Math.abs(nr[i * 3]), ay = Math.abs(nr[i * 3 + 1]), az = Math.abs(nr[i * 3 + 2]);
      let u, v;
      if (ay >= ax && ay >= az) { u = x; v = z; } else if (ax >= az) { u = z; v = y; } else { u = x; v = y; }
      uv[i * 2] = u / tile; uv[i * 2 + 1] = v / tile;
    }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    return g;
  };

  // cauce (fondo plano + orillas en pendiente) a lo largo de Z o de X, como tira de malla
  function channelGeo(THREE, alongZ, c, a0, a1, hw, fhw, floorY, topY) {
    const P = [[-hw, topY], [-fhw, floorY], [fhw, floorY], [hw, topY]];
    const n = 8, pos = [], uv = [], idx = [];
    for (let i = 0; i <= n; i++) {
      const a = a0 + (a1 - a0) * i / n;
      for (let j = 0; j < 4; j++) {
        const cr = c + P[j][0], y = P[j][1];
        if (alongZ) { pos.push(cr, y, a); uv.push(cr / 8, a / 8); }
        else { pos.push(a, y, cr); uv.push(a / 8, cr / 8); }
      }
    }
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < 3; j++) {
        const A = i * 4 + j, B = A + 1, C = (i + 1) * 4 + j + 1, D = (i + 1) * 4 + j;
        idx.push(A, D, B, B, D, C);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }

  // el terreno y el suelo lejano se recortan donde hay cauces (fragmento exacto, sin huecos en la malla)
  function patchChannels(mat) {
    mat.onBeforeCompile = function (shader) {
      shader.uniforms.uNewHole = HOLE;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWp;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWp = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWp;\nuniform float uNewHole;')
        .replace('void main() {', 'void main() {\n' +
          '  if (abs(vWp.z) < 2950.0 && (abs(vWp.x + 190.0) < 97.0 || (uNewHole > 0.5 && abs(vWp.x + 440.0) < 97.0))) discard;\n' +
          '  if (abs(vWp.z) < 16.0 && vWp.x > -115.0 && vWp.x < -62.0) discard;');
    };
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
    // calima muy leve: banda temblorosa junto al horizonte
    '  float hzBand = exp(-h * h * 400.0) * uDay;',
    '  float wob = 0.5 + 0.5 * sin(d.x * 240.0 + uTime * 1.4) * sin(d.z * 200.0 - uTime * 1.1);',
    '  sky += vec3(0.007, 0.005, 0.0) * hzBand * wob;',
    // sol: disco + halo
    '  float sd = dot(d, uSunDir);',
    '  float sdc = max(sd, 0.0);',
    '  float cr = cos(uSunAng);',
    '  float disc = smoothstep(cr - 0.00003, cr + 0.00001, sd);',
    '  float halo = pow(sdc, 900.0) * 0.9 + pow(sdc, 60.0) * 0.35 + pow(sdc, 6.0) * 0.12;',
    '  sky += uSunCol * (disc * 5.0 + halo) * uSunVis;',
    // rayos crepusculares
    '  float ang = atan(dot(d, uSunT2), dot(d, uSunT1));',
    '  float rays = pow(0.5 + 0.5 * sin(ang * 23.0 + vnoise3(vec3(ang * 4.0, 0.5, 0.0)) * 7.0), 5.0);',
    '  rays *= 0.6 + 0.4 * vnoise3(vec3(ang * 11.0, 3.0, 1.0));',
    '  float fall = exp(-(1.0 - sdc) * 9.0);',
    '  sky += uSunCol * rays * fall * uDusk * 0.45 * smoothstep(-0.1, 0.25, h);',
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
    // Vía Láctea
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

  // agua marrón-verdosa con corriente hacia el sur (+Z), reflejos del cielo y brillo del sol
  const WATER_FS = [
    'uniform float uTime; uniform vec3 uLightDir; uniform vec3 uLightCol; uniform float uLightI;',
    'uniform vec3 uHorizon; uniform vec3 uZenith; uniform vec3 uDeep;',
    'varying vec3 vW;',
    COMMON_GLSL,
    'void main() {',
    '  vec2 p = vW.xz;',
    '  float ph = p.y - 7.0 * uTime;',
    '  float f1 = ph * 0.045 + p.x * 0.03;',
    '  float f2 = ph * 0.11 + p.x * 0.12;',
    '  float f3 = p.x * 0.23 + uTime * 1.7;',
    '  float gx = 0.22 * 0.03 * cos(f1) + 0.10 * 0.12 * cos(f2) + 0.05 * 0.23 * cos(f3);',
    '  float gz = 0.22 * 0.045 * cos(f1) + 0.10 * 0.11 * cos(f2);',
    '  vec3 n = normalize(vec3(-gx, 1.0, -gz));',
    '  vec3 V = normalize(cameraPosition - vW);',
    '  vec3 L = normalize(uLightDir);',
    '  float ndv = max(dot(n, V), 0.0);',
    '  float fres = 0.04 + 0.96 * pow(1.0 - ndv, 5.0);',
    '  vec3 R = reflect(-V, n);',
    '  vec3 sky = mix(uHorizon, uZenith, smoothstep(0.0, 0.6, R.y));',
    '  vec3 col = mix(uDeep, sky, clamp(fres * 0.5, 0.0, 0.55));',
    '  col = mix(col, uDeep * vec3(1.15, 1.0, 0.6), 0.3);',
    '  float st = 0.5 + 0.5 * sin(f2 * 1.3 + sin(p.x * 0.4) * 1.5);',
    '  col += vec3(0.06, 0.055, 0.03) * st * (1.0 - ndv) * 0.8;',
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

  // paletas por hora (tod 0..1)
  const KEYS = [
    [0.00,  '#02040c', '#0b1426', '#6f8fe0', 0.0, '#1a2550'],
    [0.18,  '#02040c', '#0b1426', '#6f8fe0', 0.0, '#1d2a58'],
    [0.235, '#2b3c7a', '#ff8a7a', '#ffa070', 1.1, '#7a6a9a'],
    [0.30,  '#4f86c4', '#f4cfa6', '#ffd2a0', 1.9, '#b8c4d8'],
    [0.38,  '#3d7fc4', '#d9dcd8', '#fff0d6', 2.3, '#c9d8ea'],
    [0.50,  '#3d7fc4', '#cfd9df', '#fff2dc', 2.5, '#d0dde8'],
    [0.62,  '#3f7dc2', '#d6d6cc', '#ffe6b8', 2.3, '#c9d8ea'],
    [0.72,  '#34509a', '#ffb070', '#ffb050', 1.6, '#f0b880'],
    [0.765, '#3a3a7a', '#ff9a2a', '#ffa040', 0.9, '#c07a6a'],
    [0.80,  '#1c2050', '#c0583a', '#ff7a3a', 0.15, '#6a4a5a'],
    [0.86,  '#02040c', '#0b1426', '#6f8fe0', 0.0, '#1f2a55'],
    [1.00,  '#02040c', '#0b1426', '#6f8fe0', 0.0, '#1a2550']
  ];

  // ---------- palmera datilera: tronco anillado y copa de hojas arqueadas ----------
  function palmTrunkGeo(THREE) {
    const g = new THREE.CylinderGeometry(0.2, 0.36, 12, 5, 6, true).translate(0, 6, 0);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const f = 1 + 0.05 * Math.sin(p.getY(i) * 2.6);
      p.setX(i, p.getX(i) * f); p.setZ(i, p.getZ(i) * f);
    }
    p.needsUpdate = true;
    g.computeVertexNormals();
    return g;
  }
  function palmCrownGeo(THREE) {
    const mb = new MB(THREE);
    const L = 7.5, S = 6;
    for (let k = 0; k < 6; k++) {
      const a = k * TAU / 6 + (rnd() - 0.5) * 0.3;
      const ca = Math.cos(a), sa = Math.sin(a);
      const pr = [-sa, 0, ca];
      const P = function (t) { return [ca * L * t, 1.3 * t - 2.1 * t * t, sa * L * t]; };
      const W = function (t) { return 1.2 * (1 - t) * (0.45 + 0.55 * Math.sin(Math.PI * Math.min(1, t * 1.1))) + 0.1; };
      for (let i = 0; i < S; i++) {
        const t0 = i / S, t1 = (i + 1) / S;
        const p0 = P(t0), p1 = P(t1), w0 = W(t0), w1 = W(t1);
        const L0 = [p0[0] + pr[0] * w0, p0[1], p0[2] + pr[2] * w0], R0 = [p0[0] - pr[0] * w0, p0[1], p0[2] - pr[2] * w0];
        const L1 = [p1[0] + pr[0] * w1, p1[1], p1[2] + pr[2] * w1], R1 = [p1[0] - pr[0] * w1, p1[1], p1[2] - pr[2] * w1];
        mb.tri(L0, R0, L1); mb.tri(R0, R1, L1);
      }
    }
    return mb.build(1);
  }

  // ---------- entorno ----------
  G.createEnvironment = function (ctx) {
    const THREE = ctx.THREE, scene = ctx.scene, camera = ctx.camera, renderer = ctx.renderer;
    const root = new THREE.Group(); scene.add(root);
    const cityGroup = new THREE.Group(); root.add(cityGroup);     // la ciudad antigua (oculta cuando today > 0.5)
    const ruinGroup = new THREE.Group(); ruinGroup.visible = false; root.add(ruinGroup);

    // ---------- paleta / cielo ----------
    const MOON_COL = new THREE.Color('#6f8fe0');
    const DEEP_DAY = new THREE.Color('#8a7a4a'), DEEP_NIGHT = new THREE.Color('#0e1012');
    const FOG_DAY = new THREE.Color('#d9c4a0');
    const HEM_GROUND_DAY = new THREE.Color('#8a6a44');
    const HEM_GROUND_NIGHT = new THREE.Color('#2a3050');
    const K = KEYS.map(function (k) {
      return { t: k[0], zen: new THREE.Color(k[1]), hor: new THREE.Color(k[2]), sun: new THREE.Color(k[3]), sI: k[4], hem: new THREE.Color(k[5]) };
    });
    const tZen = new THREE.Color(), tHor = new THREE.Color(), tSun = new THREE.Color(), tHem = new THREE.Color();
    const tFog = new THREE.Color(), tHemG = new THREE.Color();
    let kSunI = 0;
    function keyAt(tod) {
      let i = 0;
      while (i < K.length - 2 && tod > K[i + 1].t) i++;
      const A = K[i], B = K[i + 1];
      const u = clamp01((tod - A.t) / (B.t - A.t));
      tZen.copy(A.zen).lerp(B.zen, u);
      tHor.copy(A.hor).lerp(B.hor, u);
      tSun.copy(A.sun).lerp(B.sun, u);
      tHem.copy(A.hem).lerp(B.hem, u);
      kSunI = A.sI + (B.sI - A.sI) * u;
    }
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

    scene.fog = new THREE.FogExp2(FOG_DAY.getHex(), 0.00009);

    // ---------- sol / luna con sombras ajustadas a los jardines (±110 m) ----------
    const sun = new THREE.DirectionalLight(0xffffff, 2);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 2048; sun.shadow.mapSize.height = 2048;
    const sc = sun.shadow.camera;
    sc.left = -110; sc.right = 110; sc.top = 110; sc.bottom = -110; sc.near = 150; sc.far = 650;
    sc.updateProjectionMatrix();
    sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.4;
    sun.target.position.set(0, 0, 0);
    root.add(sun); root.add(sun.target);
    const hemi = new THREE.HemisphereLight(0xd6e6ff, 0x8a6a44, 0.6);
    root.add(hemi);

    // luces de la ciudad de noche (cálidas, tenues)
    const lamps = [
      new THREE.PointLight(0xffb060, 0, 240, 2), new THREE.PointLight(0xffb060, 0, 240, 2), new THREE.PointLight(0xffb060, 0, 240, 2)
    ];
    lamps[0].position.set(ISH.x, 14, ISH.z);
    lamps[1].position.set(PAL.x, 14, PAL.z);
    lamps[2].position.set(ZIG.x, 30, ZIG.z);
    lamps.forEach(function (l) { root.add(l); });

    // ---------- terreno: llanura aluvial con campos, cauces recortados ----------
    const groundTex = makeTex(THREE, paint(GROUND_PX, groundPaint), false);
    const terMat = new THREE.MeshStandardMaterial({ map: groundTex, roughness: 0.98, metalness: 0 });
    patchChannels(terMat);
    const terrain = new THREE.Mesh(new THREE.PlaneGeometry(EXT, EXT, SEG, SEG).rotateX(-Math.PI / 2), terMat);
    terrain.receiveShadow = true;
    root.add(terrain);
    const farMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#c09460'), roughness: 0.98, metalness: 0 });
    patchChannels(farMat);
    const far = new THREE.Mesh(new THREE.PlaneGeometry(40000, 40000).rotateX(-Math.PI / 2), farMat);
    far.position.y = -0.3; far.receiveShadow = true;
    root.add(far);

    // ---------- cauces: lecho de barro agrietado, Éufrates (agua con corriente), canal ----------
    const mudTex = makeTex(THREE, paint(256, mudPaint), true);
    const mudMat = new THREE.MeshStandardMaterial({ map: mudTex, roughness: 0.98, metalness: 0, side: THREE.DoubleSide });
    const riverBed = new THREE.Mesh(channelGeo(THREE, true, RIV_X, -RIV_LEN, RIV_LEN, RIV_HW, RIV_FHW, RIV_FLOOR, 0.1), mudMat);
    const newBed = new THREE.Mesh(channelGeo(THREE, true, NEW_X, -RIV_LEN, RIV_LEN, RIV_HW, RIV_FHW, RIV_FLOOR, 0.1), mudMat);
    newBed.visible = false;
    const canalBed = new THREE.Mesh(channelGeo(THREE, false, 0, CAN.x0, CAN.x1, CAN_HW, CAN_FHW, CAN_FLOOR, 0.1), mudMat);
    root.add(riverBed); root.add(newBed); root.add(canalBed);

    const waterU = {
      uTime: { value: 0 }, uLightDir: { value: new THREE.Vector3(0, 1, 0) },
      uLightCol: { value: sun.color }, uLightI: { value: 0 },
      uHorizon: { value: new THREE.Color() }, uZenith: { value: new THREE.Color() },
      uDeep: { value: new THREE.Color() }
    };
    const waterMat = new THREE.ShaderMaterial({ uniforms: waterU, vertexShader: WATER_VS, fragmentShader: WATER_FS });
    const riverWater = new THREE.Mesh(
      new THREE.PlaneGeometry(2 * (RIV_HW - 5), 2 * RIV_LEN).rotateX(-Math.PI / 2).translate(RIV_X, WATER_Y, 0), waterMat);
    const canalWater = new THREE.Mesh(
      new THREE.PlaneGeometry(CAN.x1 - CAN.x0, 2 * (CAN_HW - 3)).rotateX(-Math.PI / 2).translate((CAN.x0 + CAN.x1) / 2, WATER_Y, 0), waterMat);
    root.add(riverWater); root.add(canalWater);

    // ---------- juncos en las orillas (InstancedMesh) ----------
    const REEDS = 420;
    const reedMesh = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.03, 0.07, 3, 4, 1).translate(0, 1.5, 0),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }), REEDS);
    const reedCols = ['#8a9a4a', '#6f8040', '#a0a456', '#5e6e2e'].map(function (c) { return new THREE.Color(c); });
    const m4 = new THREE.Matrix4(), quat = new THREE.Quaternion(), vPos = new THREE.Vector3(), vSc = new THREE.Vector3();
    const yAxis = new THREE.Vector3(0, 1, 0);
    for (let k = 0; k < REEDS; k++) {
      const side = k % 2 === 0 ? -1 : 1;
      const dR = RIV_HW + 3 + rnd() * 14;
      const x = RIV_X + side * dR, z = (rnd() * 2 - 1) * (RIV_LEN - 60);
      const s = 0.7 + rnd() * 0.6;
      quat.setFromAxisAngle(yAxis, rnd() * TAU);
      vSc.set(s, s * (0.8 + rnd() * 0.4), s);
      vPos.set(x, 0, z);
      m4.compose(vPos, quat, vSc);
      reedMesh.setMatrixAt(k, m4);
      reedMesh.setColorAt(k, reedCols[Math.floor(rnd() * reedCols.length)]);
    }
    reedMesh.instanceMatrix.needsUpdate = true;
    if (reedMesh.instanceColor) reedMesh.instanceColor.needsUpdate = true;
    reedMesh.castShadow = false;
    root.add(reedMesh);

    // ---------- palmerales (grupos densos fuera de la ciudad, a lo largo del río) ----------
    const palms = [];
    // grupos a lo largo de ambas orillas, fuera de las murallas (cinturón continuo de palmeras)
    for (let zc = -2700; zc <= 2700; zc += 230) {
      const side = (Math.round((zc + 2700) / 230) % 2 === 0) ? -1 : 1;
      const gx = RIV_X + side * (175 + rnd() * 50);
      const gz = zc + (rnd() - 0.5) * 80;
      if (Math.hypot(gx, gz) < WALL_R + 70) continue;
      if (Math.abs(gx) < 130 && Math.abs(gz) < 130) continue;
      const n = 11 + Math.floor(rnd() * 6);
      for (let j = 0; j < n; j++) {
        const ang = rnd() * TAU, rr = Math.sqrt(rnd()) * 26;
        palms.push({ x: gx + Math.cos(ang) * rr, z: gz + Math.sin(ang) * rr, ry: rnd() * TAU, sc: 1.05 + rnd() * 0.45, rank: rnd() });
      }
    }
    const trunkMesh = new THREE.InstancedMesh(palmTrunkGeo(THREE),
      new THREE.MeshStandardMaterial({ color: 0x6b4f2e, roughness: 0.9 }), palms.length);
    const crownMesh = new THREE.InstancedMesh(palmCrownGeo(THREE),
      new THREE.MeshStandardMaterial({ color: 0x3f7a33, roughness: 0.8, side: THREE.DoubleSide }), palms.length);
    trunkMesh.castShadow = true; crownMesh.castShadow = true;
    trunkMesh.frustumCulled = false; crownMesh.frustumCulled = false;
    root.add(trunkMesh); root.add(crownMesh);
    let palmKey = -1;
    function applyPalms(today) {
      for (let i = 0; i < palms.length; i++) {
        const P = palms[i];
        const keep = P.rank < 1 - 0.8 * today;     // hoy quedan palmeras dispersas
        const s = keep ? P.sc : 0;
        quat.setFromAxisAngle(yAxis, P.ry);
        vSc.set(s, s, s);
        vPos.set(P.x, 0, P.z);
        m4.compose(vPos, quat, vSc);
        trunkMesh.setMatrixAt(i, m4);
        vPos.set(P.x, 12 * s, P.z);
        m4.compose(vPos, quat, vSc);
        crownMesh.setMatrixAt(i, m4);
      }
      trunkMesh.instanceMatrix.needsUpdate = true;
      crownMesh.instanceMatrix.needsUpdate = true;
    }
    applyPalms(0);
    palmKey = 0;

    // ---------- materiales de la ciudad ----------
    const brickTex = makeTex(THREE, paint(256, brickPaint), true);
    const brickMat = new THREE.MeshStandardMaterial({ map: brickTex, roughness: 0.92, metalness: 0 });
    const glazedTex = makeTex(THREE, glazedCanvas(), true);
    const glazedMat = new THREE.MeshStandardMaterial({ map: glazedTex, roughness: 0.4, metalness: 0 });
    const roadMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#bfa878'), roughness: 0.95 });
    const adobeTex = makeTex(THREE, paint(128, adobePaint), false);
    const adobeMat = new THREE.MeshStandardMaterial({ map: adobeTex, roughness: 0.95, metalness: 0 });
    const ruinMat = new THREE.MeshStandardMaterial({ map: brickTex, color: new THREE.Color('#9a7656'), roughness: 0.98 });
    const modernMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#d7cbb2'), roughness: 0.85 });

    // ---------- murallas dobles con torres y almenas, palacio sur, zigurat ----------
    const bm = new MB(THREE);
    const NW = 160;
    for (let k = 0; k < NW; k++) {
      const th = k / NW * TAU;
      const ry = -(th + Math.PI / 2);
      const cO = Math.cos(th), sO = Math.sin(th);
      const Lo = TAU * WALL_R / NW + 1.5, Li = TAU * WALL_IN / NW + 1.5;
      bm.box(WALL_R * cO, 8, WALL_R * sO, Lo, 16, 9, ry);
      bm.box(WALL_IN * cO, 5.5, WALL_IN * sO, Li, 11, 7, ry);
      if (k % 8 === 0) bm.box((WALL_R + 2) * cO, 13, (WALL_R + 2) * sO, 16, 26, 16, ry);   // torres
    }
    const NM = Math.floor(TAU * WALL_R / 9);                                                // almenas
    for (let k = 0; k < NM; k++) {
      const th = k / NM * TAU;
      bm.box(WALL_R * Math.cos(th), 17.2, WALL_R * Math.sin(th), 4.5, 2.4, 8, -(th + Math.PI / 2));
    }
    // palacio sur de Nabucodonosor: muros, patios, almenas escalonadas, torres de esquina
    const px0 = PAL.x - PAL.halfX, px1 = PAL.x + PAL.halfX, pz0 = PAL.z - PAL.halfZ, pz1 = PAL.z + PAL.halfZ;
    bm.box(px0 + 3.5, 9, PAL.z, 7, 18, PAL.halfZ * 2);
    bm.box(px1 - 3.5, 9, PAL.z, 7, 18, PAL.halfZ * 2);
    bm.box(PAL.x, 9, pz0 + 3.5, PAL.halfX * 2, 18, 7);
    bm.box(PAL.x, 9, pz1 - 3.5, PAL.halfX * 2, 18, 7);
    bm.box(97.5, 6, PAL.z, 41, 12, 5);
    bm.box(162.5, 6, PAL.z, 41, 12, 5);
    [[px0 + 6, pz0 + 6], [px1 - 6, pz0 + 6], [px0 + 6, pz1 - 6], [px1 - 6, pz1 - 6]].forEach(function (c) {
      bm.box(c[0], 12, c[1], 12, 24, 12);
    });
    for (let x = px0 + 4; x < px1 - 4; x += 4) {
      bm.box(x, 18.8, pz0 + 3.5, 2.4, 1.6, 7); bm.box(x, 20.4, pz0 + 3.5, 1.2, 1.6, 7);
      bm.box(x, 18.8, pz1 - 3.5, 2.4, 1.6, 7); bm.box(x, 20.4, pz1 - 3.5, 1.2, 1.6, 7);
    }
    for (let z = pz0 + 4; z < pz1 - 4; z += 4) {
      bm.box(px0 + 3.5, 18.8, z, 7, 1.6, 2.4); bm.box(px0 + 3.5, 20.4, z, 7, 1.6, 1.2);
      bm.box(px1 - 3.5, 18.8, z, 7, 1.6, 2.4); bm.box(px1 - 3.5, 20.4, z, 7, 1.6, 1.2);
    }
    // zigurat Etemenanki: 7 niveles de 11 m, escalinata en la cara norte, templo azul arriba
    const ZL = 11;
    for (let i = 0; i < 7; i++) {
      const half = ZIG.half - 6.2 * i, yb = ZL * i;
      bm.box(ZIG.x, yb + ZL / 2, ZIG.z, half * 2, ZL, half * 2);
      for (let k = 0; k < 6; k++) {
        const hk = (k + 1) * ZL / 6;
        const outer = half + 6.2 * (6 - k) / 6, inner = half + 6.2 * (5 - k) / 6;
        bm.box(ZIG.x, yb + hk / 2, ZIG.z - (outer + inner) / 2, 9, hk, outer - inner);
      }
    }
    const brickGeo = bm.build(2.4);
    const brickMesh = new THREE.Mesh(brickGeo, brickMat);
    brickMesh.castShadow = true; brickMesh.receiveShadow = true;
    cityGroup.add(brickMesh);

    // puerta de Ishtar (ladrillo vidriado azul con toros y dragones) y templo azul del zigurat
    const bl = new MB(THREE);
    bl.box(ISH.x - 20, 12, ISH.z, 18, 24, 26);
    bl.box(ISH.x + 20, 12, ISH.z, 18, 24, 26);
    bl.box(ISH.x, 19, ISH.z, 22, 8, 26);
    bl.box(ZIG.x, 77 + 7, ZIG.z, 13, 14, 13);
    const blueMesh = new THREE.Mesh(bl.build(6), glazedMat);
    blueMesh.castShadow = true; blueMesh.receiveShadow = true;
    cityGroup.add(blueMesh);

    // vía procesional: losa de piedra con bordillos
    const rd = new MB(THREE);
    rd.box(ISH.x, 0.04, -500, 20, 0.08, 400);
    rd.box(ISH.x - 11, 0.8, -500, 1.6, 1.6, 400);
    rd.box(ISH.x + 11, 0.8, -500, 1.6, 1.6, 400);
    const roadMesh = new THREE.Mesh(rd.build(4), roadMat);
    roadMesh.receiveShadow = true;
    cityGroup.add(roadMesh);

    // casas de adobe con azoteas en manzanas densas
    const houses = [];
    const excl = function (x, z) {
      if (Math.hypot(x, z) > WALL_IN - 20) return true;
      if (Math.abs(x) < 80 && Math.abs(z) < 80) return true;                       // jardines
      if (Math.abs(x - RIV_X) < 140) return true;                                   // río y orillas
      if (Math.abs(x - PAL.x) < PAL.halfX + 14 && Math.abs(z - PAL.z) < PAL.halfZ + 14) return true;
      if (Math.abs(x - ISH.x) < 30 && z < ISH.z + 30 && z > -720) return true;      // vía procesional
      if (Math.abs(x - ZIG.x) < ZIG.half + 25 && Math.abs(z - ZIG.z) < ZIG.half + 25) return true;
      if (Math.hypot(x - SITE.brickyard.x, z - SITE.brickyard.z) < 60) return true;
      if (Math.hypot(x - SITE.bitumen.x, z - SITE.bitumen.z) < 35) return true;
      if (Math.hypot(x - SITE.excavation.x, z - SITE.excavation.z) < 35) return true;
      if (Math.abs(x - SITE.map.cx) < 90 && Math.abs(z - SITE.map.cz) < 90) return true;
      return false;
    };
    for (let gx = -WALL_IN; gx < WALL_IN; gx += 26) {
      for (let gz = -WALL_IN; gz < WALL_IN; gz += 26) {
        if (rnd() > 0.62) continue;
        const x = gx + 13 + (rnd() - 0.5) * 5, z = gz + 13 + (rnd() - 0.5) * 5;
        if (excl(x, z)) continue;
        const w = 9 + rnd() * 3, d = 9 + rnd() * 3;
        const h = rnd() < 0.2 ? 7 + rnd() * 2 : 3.5 + rnd() * 2.5;
        houses.push({ x: x, z: z, w: w, d: d, h: h });
      }
    }
    const houseGeo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
    const houseMesh = new THREE.InstancedMesh(houseGeo, adobeMat, houses.length);
    const houseCols = ['#d2b07f', '#c09a6c', '#b88f60', '#d8bd92'].map(function (c) { return new THREE.Color(c); });
    for (let i = 0; i < houses.length; i++) {
      const H = houses[i];
      vSc.set(H.w, H.h, H.d); vPos.set(H.x, 0, H.z); quat.set(0, 0, 0, 1);
      m4.compose(vPos, quat, vSc);
      houseMesh.setMatrixAt(i, m4);
      houseMesh.setColorAt(i, houseCols[Math.floor(rnd() * houseCols.length)]);
    }
    houseMesh.instanceMatrix.needsUpdate = true;
    if (houseMesh.instanceColor) houseMesh.instanceColor.needsUpdate = true;
    houseMesh.castShadow = true; houseMesh.receiveShadow = true;
    houseMesh.frustumCulled = false;
    cityGroup.add(houseMesh);

    // ---------- hoy: montículos de ladrillo, ruinas de muralla, muro reconstruido ----------
    const MOUNDS = 40;
    const moundGeo = new THREE.IcosahedronGeometry(1, 1);
    {
      const p = moundGeo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        const q = fract(Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453);
        const r = 0.8 + 0.35 * q;
        p.setXYZ(i, x * r, y * r * 0.55, z * r);
      }
      p.needsUpdate = true;
      moundGeo.computeVertexNormals();
    }
    const moundMesh = new THREE.InstancedMesh(moundGeo, ruinMat, MOUNDS);
    const mounds = [];
    while (mounds.length < MOUNDS) {
      const a = rnd() * TAU, r = 120 + Math.sqrt(rnd()) * 720;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (Math.abs(x) < 110 && Math.abs(z) < 110) continue;
      mounds.push({ x: x, z: z, size: 10 + rnd() * 18 });
    }
    let moundKey = -1;
    function applyMounds(today) {
      const k = sstep(0.5, 0.95, today);
      for (let i = 0; i < mounds.length; i++) {
        const M = mounds[i], sz = M.size * k;
        vSc.set(sz * 1.4, sz * 0.55, sz * 1.4); vPos.set(M.x, -0.2, M.z); quat.set(0, 0, 0, 1);
        m4.compose(vPos, quat, vSc);
        moundMesh.setMatrixAt(i, m4);
      }
      moundMesh.instanceMatrix.needsUpdate = true;
    }
    moundMesh.castShadow = false; moundMesh.receiveShadow = true;
    ruinGroup.add(moundMesh);

    const RUINS = 300;
    const ruinGeo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
    const ruinMesh = new THREE.InstancedMesh(ruinGeo, ruinMat, RUINS);
    for (let i = 0; i < RUINS; i++) {
      let x, z, sx, sy, sz, ry;
      if (i < 200) {                                  // fragmentos de la muralla
        const th = rnd() * TAU, R = (rnd() < 0.5 ? WALL_IN : WALL_R) + (rnd() - 0.5) * 6;
        x = R * Math.cos(th); z = R * Math.sin(th);
        sx = 8 + rnd() * 14; sy = 2 + rnd() * 9; sz = 6 + rnd() * 3;
        ry = -(th + Math.PI / 2) + (rnd() - 0.5) * 0.25;
      } else {                                        // escombros dispersos
        const th = rnd() * TAU, R = 120 + Math.sqrt(rnd()) * 700;
        x = R * Math.cos(th); z = R * Math.sin(th);
        sx = 2 + rnd() * 5; sy = 0.6 + rnd() * 2.2; sz = 2 + rnd() * 4;
        ry = rnd() * TAU;
      }
      if (Math.abs(x) < 80 && Math.abs(z) < 80) { x += 120; }
      vSc.set(sx, sy, sz); vPos.set(x, 0, z); quat.setFromAxisAngle(yAxis, ry);
      m4.compose(vPos, quat, vSc);
      ruinMesh.setMatrixAt(i, m4);
    }
    ruinMesh.instanceMatrix.needsUpdate = true;
    ruinMesh.castShadow = true; ruinMesh.receiveShadow = true;
    ruinGroup.add(ruinMesh);

    const modern = new MB(THREE);
    modern.box(90, 2.6, 245, 100, 5.2, 2.2);
    modern.box(90, 5.45, 245, 100, 0.5, 3.0);
    const modernMesh = new THREE.Mesh(modern.build(1), modernMat);
    modernMesh.castShadow = true; modernMesh.receiveShadow = true;
    modernMesh.visible = false;
    root.add(modernMesh);

    // ---------- polvo y calima leve ----------
    const DUST = 1200;
    const dustPos = new Float32Array(DUST * 3);
    for (let k = 0; k < DUST * 3; k++) dustPos[k] = rnd();
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
    const dustU = {
      uTime: { value: 0 }, uCenter: { value: new THREE.Vector3() }, uPx: { value: 60 },
      uAlpha: { value: 0.12 }, uColor: { value: new THREE.Color('#e6c28a') }
    };
    const dustMat = new THREE.ShaderMaterial({
      uniforms: dustU, vertexShader: DUST_VS, fragmentShader: POINT_FS,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
    });
    const dust = new THREE.Points(dustGeo, dustMat);
    dust.frustumCulled = false;
    root.add(dust);

    // ---------- actualización por frame (función del estado, sin acumulación) ----------
    function update(s) {
      const tod = fract(s.timeOfDay || 0);
      const wall = s.wall || 0;
      const today = clamp01(s.today || 0);
      const rs = clamp01(s.riverShift || 0);

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
      sun.position.copy(lightDir).multiplyScalar(400);
      sun.color.copy(MOON_COL).lerp(tSun, sunVis);
      sun.intensity = kSunI * sunVis + 0.6 * moonVis;
      tHemG.copy(HEM_GROUND_NIGHT).lerp(HEM_GROUND_DAY, dayF);
      hemi.color.copy(tHem);
      hemi.groundColor.copy(tHemG);
      hemi.intensity = 0.25 + 0.6 * dayF;
      renderer.toneMappingExposure = 0.8 + 0.1 * dayF;

      const cityVis = today < 0.5 ? 1 : 0;
      lamps.forEach(function (l) { l.intensity = 1.6 * moonVis * cityVis; });

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

      tFog.copy(tHor).lerp(FOG_DAY, 0.7 * dayF);
      scene.fog.color.copy(tFog);
      scene.fog.density = 0.00009 * (1 - 0.7 * moonVis);
      skyU.uBelow.value.copy(tFog);

      // agua: el Éufrates se desplaza al oeste; el hueco del nuevo cauce se abre cuando empieza
      HOLE.value = rs > 0.0005 ? 1 : 0;
      newBed.visible = rs > 0.0005;
      riverWater.position.x = SHIFT_X * rs;
      waterU.uTime.value = wall;
      waterU.uLightDir.value.copy(lightDir);
      waterU.uLightI.value = sun.intensity;
      waterU.uHorizon.value.copy(tHor);
      waterU.uZenith.value.copy(tZen);
      waterU.uDeep.value.copy(DEEP_NIGHT).lerp(DEEP_DAY, dayF);

      // ciudad antigua y ruinas de hoy
      cityGroup.visible = cityVis === 1;
      ruinGroup.visible = today > 0.5;
      modernMesh.visible = today > 0.6;
      const tk = Math.round(today * 100);
      if (tk !== palmKey) { palmKey = tk; applyPalms(today); }
      if (today > 0.5 && tk !== moundKey) { moundKey = tk; applyMounds(today); }

      dustU.uTime.value = wall;
      dustU.uCenter.value.copy(camera.position);
      dustU.uAlpha.value = 0.08 + 0.12 * dayF;
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
