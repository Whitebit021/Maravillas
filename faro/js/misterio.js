// Misterio del faro (capa conspiranoica): escollos y naufragios, el haz de la linterna que barre el mar,
// el mito del espejo que incendia una flota romana fantasma, el aspa roja y la regla de 124 m con el
// "alcance de 50 km". Todo por código: geometría fusionada, shaders de borde (fresnel), puntos aditivos
// para llamas y humo, y CanvasTexture (sRGB) para las etiquetas. Todo es función del estado s.
(function () {
  'use strict';
  const G = window.GIZA;
  const THREE = window.THREE;

  const TAU = Math.PI * 2;
  const GOLD = 0xffcf6a, GOLD_HI = 0xffe9a8, CYAN = 0x7fe3f0, RED = 0xff3b30, SHIP = 0xd8f2ff, FIRE = 0xff8a2a;
  const SEA = G.SITE.seaLevel;
  const TOP = G.TOWER.mirror.y;                 // 114: linterna (espejo de bronce)
  const BURN = G.SITE.burnTarget;               // (0, -700): flota romana
  const BEAM_R = 2000;                          // alcance del haz sobre el mar (~2 km)
  const RULER_X = 30;                           // regla junto a la torre
  const RING_R = 37000;                         // anillo de "visible a 50 km" (la cámara ve hasta 40 km)

  function clamp01(x) { return x < 0 ? 0 : (x > 1 ? 1 : x); }
  function ramp(x, a, b) { return clamp01((x - a) / (b - a)); }
  function num(v) { return (typeof v === 'number' && isFinite(v)) ? v : 0; }
  function norm(v) { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }
  function seeded(seed) {
    let s = seed >>> 0;
    return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }

  // ---------- generación de mallas (listas planas -> BufferGeometry) ----------
  function newB() { return { P: [], I: [], LI: [] }; }
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
      const v = [d[1] * u[2] - d[2] * u[1], d[2] * u[0] - d[0] * u[2], d[0] * u[1] - d[1] * u[0]];
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
    if (rings) {
      for (let i = 0; i < n; i++) for (let j = 0; j < sides; j++) B.LI.push(base + i * sides + j, base + i * sides + (j + 1) % sides);
    }
    for (let m = 0; m < meridians; m++) {
      const j = Math.floor(m * sides / meridians);
      for (let i = 0; i < n - 1; i++) B.LI.push(base + i * sides + j, base + (i + 1) * sides + j);
    }
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
  function polyGeo(pts) {
    const a = new Float32Array(pts.length * 3);
    for (let i = 0; i < pts.length; i++) { a[i * 3] = pts[i][0]; a[i * 3 + 1] = pts[i][1]; a[i * 3 + 2] = pts[i][2]; }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(a, 3));
    return g;
  }
  function pairsGeo(pairs) {
    const pos = [];
    for (let i = 0; i < pairs.length; i++) {
      const a = pairs[i][0], b = pairs[i][1];
      pos.push(a[0], a[1], a[2], b[0], b[1], b[2]);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    return g;
  }
  function circleGround(cx, cy, cz, r, n) {
    const out = [];
    for (let i = 0; i <= n; i++) { const t = i / n * TAU; out.push([cx + r * Math.cos(t), cy, cz + r * Math.sin(t)]); }
    return out;
  }
  // progreso de dibujado (en vértices): strip (Line) y segmentos (LineSegments)
  function drawStrip(obj, f) {
    const n = obj.geometry.attributes.position.count;
    obj.geometry.setDrawRange(0, Math.round(clamp01(f) * n));
  }
  function drawSegs(obj, f) {
    const n = obj.geometry.attributes.position.count;
    obj.geometry.setDrawRange(0, 2 * Math.floor(clamp01(f) * n / 2));
  }

  // ---------- materiales ----------
  // Fantasma: relleno translúcido que se ilumina en el borde (fresnel), como en el módulo del Coloso
  const GHOST_VS = 'varying vec3 vN; varying vec3 vV;\n' +
    'void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0);\n' +
    '  vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);\n' +
    '  gl_Position = projectionMatrix * mv; }';
  const GHOST_FS = 'uniform vec3 uColor; uniform float uOp; uniform float uBase; uniform float uEdge; varying vec3 vN; varying vec3 vV;\n' +
    'void main(){\n' +
    '  float f = 1.0 - abs(dot(normalize(vN), normalize(vV)));\n' +
    '  float a = uOp * (uBase + uEdge * pow(f, 2.2));\n' +
    '  gl_FragColor = vec4(uColor, a); }';
  function ghostMat(hex, base, edge) {
    return new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(hex) }, uOp: { value: 0 }, uBase: { value: base }, uEdge: { value: edge } },
      vertexShader: GHOST_VS, fragmentShader: GHOST_FS,
      transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending
    });
  }
  function lineMat(hex, op) {
    return new THREE.LineBasicMaterial({
      color: hex, transparent: true, opacity: op || 0, fog: false,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
  }

  // Haz de cono / tubo (aditivo): el apex está en y=0 y el extremo en y=-L (geometría trasladada).
  // Brillo por fresnel (más intenso de frente) y atenuación hacia el extremo si uTaper > 0.
  const BEAM_VS = 'varying vec3 vN; varying vec3 vV; varying float vY;\n' +
    'void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0);\n' +
    '  vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); vY = position.y;\n' +
    '  gl_Position = projectionMatrix * mv; }';
  const BEAM_FS = 'uniform vec3 uColor; uniform float uOp; uniform float uLen; uniform float uTaper; uniform float uCore; varying vec3 vN; varying vec3 vV; varying float vY;\n' +
    'void main(){\n' +
    '  float f = abs(dot(normalize(vN), normalize(vV)));\n' +
    '  float along = clamp(1.0 + vY / uLen, 0.0, 1.0);\n' +
    '  float a = uOp * pow(max(along, 0.001), uTaper) * (uCore + (1.0 - uCore) * pow(f, 1.3));\n' +
    '  gl_FragColor = vec4(uColor, a); }';
  function beamMat(hex, len, taper, core) {
    return new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(hex) }, uOp: { value: 0 }, uLen: { value: len },
        uTaper: { value: taper }, uCore: { value: core }
      },
      vertexShader: BEAM_VS, fragmentShader: BEAM_FS,
      transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false
    });
  }

  // Arrecifes y pecio: cuadrados con anillo rojo fijo + anillo que se expande (pulsa), en una sola malla
  const REEF_VS = 'attribute float aSeed; attribute float aKind; varying vec2 vU; varying float vSeed; varying float vKind;\n' +
    'void main(){ vU = uv * 2.0 - 1.0; vSeed = aSeed; vKind = aKind;\n' +
    '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
  const REEF_FS = 'uniform float uWall; uniform float uOp; varying vec2 vU; varying float vSeed; varying float vKind;\n' +
    'void main(){\n' +
    '  float d = length(vU);\n' +
    '  if (d > 1.0) discard;\n' +
    '  float ph = fract(uWall * 0.32 + vSeed);\n' +
    '  float rr = 0.12 + 0.88 * ph;\n' +
    '  float pulse = (1.0 - smoothstep(0.0, 0.06, abs(d - rr))) * (1.0 - ph);\n' +
    '  float ring = (1.0 - smoothstep(0.0, 0.05, abs(d - 0.5))) * (0.6 + 0.4 * sin(uWall * 2.2 + vSeed * 6.28));\n' +
    '  float core = (1.0 - smoothstep(0.0, 0.5, d)) * 0.16;\n' +
    '  float a = (ring + pulse * 0.8 + core) * uOp;\n' +
    '  vec3 col = mix(vec3(1.0, 0.23, 0.19), vec3(1.0, 0.81, 0.42), vKind);\n' +
    '  gl_FragColor = vec4(col, a); }';

  // Partículas aditivas (llamas y humo): el movimiento se calcula en el vértice; un solo draw call por grupo
  const PART_VS = 'attribute float aSeed; attribute float aSize; attribute vec3 aBase;\n' +
    'uniform float uTime; uniform float uPx; uniform float uRise; uniform float uDrift; uniform float uHeight; uniform float uI; uniform float uAlpha;\n' +
    'varying float vA;\n' +
    'void main(){\n' +
    '  float p = fract(uTime * uRise + aSeed);\n' +
    '  vec3 q = aBase + vec3(sin(uTime * 2.3 + aSeed * 37.0) * uDrift * p, p * uHeight, cos(uTime * 1.9 + aSeed * 53.0) * uDrift * p);\n' +
    '  vec4 mv = modelViewMatrix * vec4(q, 1.0);\n' +
    '  gl_Position = projectionMatrix * mv;\n' +
    '  gl_PointSize = aSize * (0.55 + 0.6 * p) * uPx / max(0.1, -mv.z);\n' +
    '  float flick = 0.7 + 0.3 * sin(uTime * 13.0 + aSeed * 90.0);\n' +
    '  vA = sin(3.14159 * p) * flick * uI * uAlpha;\n' +
    '}';
  const PART_FS = 'uniform sampler2D uMap; uniform vec3 uColor; varying float vA;\n' +
    'void main(){ float a = texture2D(uMap, gl_PointCoord).a * vA; if (a < 0.002) discard; gl_FragColor = vec4(uColor, a); }';

  // Textura radial (alfa) para puntos y para el reflejo en el agua
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
  // Reflejo elíptico en el agua (estela del haz): gradiente radial estirado
  function streakTex() {
    const cv = document.createElement('canvas');
    cv.width = 128; cv.height = 256;
    const g = cv.getContext('2d');
    g.save();
    g.translate(64, 128); g.scale(0.5, 1);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, 128);
    gr.addColorStop(0, 'rgba(255,240,200,0.9)');
    gr.addColorStop(0.4, 'rgba(255,210,140,0.3)');
    gr.addColorStop(1, 'rgba(255,200,120,0)');
    g.fillStyle = gr; g.fillRect(-128, -128, 256, 256);
    g.restore();
    const t = new THREE.CanvasTexture(cv);
    t.encoding = THREE.sRGBEncoding;
    return t;
  }
  // Halo radial (CanvasTexture dibujada por código)
  const glowCache = {};
  function glowTex(rgb) {
    if (glowCache[rgb]) return glowCache[rgb];
    const cv = document.createElement('canvas');
    cv.width = 128; cv.height = 128;
    const g = cv.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.12, 'rgba(' + rgb + ',0.95)');
    gr.addColorStop(0.35, 'rgba(' + rgb + ',0.28)');
    gr.addColorStop(1, 'rgba(' + rgb + ',0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(cv);
    t.encoding = THREE.sRGBEncoding;
    glowCache[rgb] = t;
    return t;
  }
  function glowSprite(rgb, size, pos) {
    const mat = new THREE.SpriteMaterial({
      map: glowTex(rgb), transparent: true, depthWrite: false, fog: false,
      blending: THREE.AdditiveBlending, opacity: 0
    });
    const sp = new THREE.Sprite(mat);
    sp.scale.set(size, size, 1);
    sp.position.set(pos[0], pos[1], pos[2]);
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
    const w = o.lh * CW / px;
    sp.scale.set(w, w * CH / CW, 1);
    sp.position.set(o.pos[0], o.pos[1], o.pos[2]);
    return { sprite: sp, mat: mat, w: w, h: w * CH / CW };
  }

  // ---------- figuras ----------
  // Galera romana de ~36 m (proa al norte): casco lofteado, mástil, vela cuadrada y remos (líneas)
  function galleyPush(B, ox, oz) {
    loft(B, [
      [ox, 0.6, oz - 18, 0.6, 1.0], [ox, 0.2, oz - 12, 3.4, 1.8], [ox, 0.0, oz - 4, 4.5, 2.3],
      [ox, 0.0, oz + 6, 4.5, 2.3], [ox, 0.3, oz + 14, 3.2, 1.8], [ox, 1.0, oz + 18, 1.0, 1.2]
    ], 12, true, 5);
    loft(B, [[ox, 1.0, oz + 2, 0.4, 0.4], [ox, 14, oz + 2, 0.35, 0.35], [ox, 25, oz + 2, 0.25, 0.25]], 8, true, 2);
    const z = oz + 2.2;
    const q0 = pv(B, [ox - 8, 14, z]), q1 = pv(B, [ox + 8, 14, z]), q2 = pv(B, [ox + 8, 24, z]), q3 = pv(B, [ox - 8, 24, z]);
    B.I.push(q0, q1, q2, q0, q2, q3);
    B.LI.push(q0, q1, q1, q2, q2, q3, q3, q0);
    for (let k = 0; k < 5; k++) {
      const zr = oz - 10 + k * 5;
      for (let sd = -1; sd <= 1; sd += 2) {
        const a = pv(B, [ox + sd * 4.2, 1.6, zr]), b = pv(B, [ox + sd * 9, -0.8, zr - 0.4]);
        B.LI.push(a, b);
      }
    }
  }

  G.createMystery = function (ctx) {
    const scene = ctx.scene, camera = ctx.camera, renderer = ctx.renderer;
    const root = new THREE.Group();
    scene.add(root);
    const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), tmpU = new THREE.Vector3();
    const segD = new THREE.Vector3(), segP = new THREE.Vector3(), segQ = new THREE.Vector3();
    const DOWN = new THREE.Vector3(0, -1, 0);

    // distancia de un punto p al segmento a-b (para desvanecer los haces si la cámara queda dentro)
    function distToSeg(p, a, b) {
      segD.copy(b).sub(a);
      const L2 = Math.max(1e-6, segD.lengthSq());
      segP.copy(p).sub(a);
      const u = clamp01(segP.dot(segD) / L2);
      segQ.copy(a).addScaledVector(segD, u);
      return segQ.distanceTo(p);
    }

    // ================= 1. reefs: escollos y naufragios (anillos rojos pulsantes) =================
    const reefG = new THREE.Group();
    root.add(reefG);
    const rPos = [], rUv = [], rSeed = [], rKind = [], rIdx = [];
    const rr = seeded(7);
    const reefList = G.SITE.reefs.map(function (p) { return { x: p[0], z: p[1], kind: 0 }; });
    reefList.push({ x: G.SITE.wreck.x, z: G.SITE.wreck.z, kind: 1 });
    const QH = 40;   // semilado del cuadrado de cada anillo (m)
    reefList.forEach(function (r) {
      const b0 = rPos.length / 3;
      [[-1, -1, 0, 0], [1, -1, 1, 0], [1, 1, 1, 1], [-1, 1, 0, 1]].forEach(function (c) {
        rPos.push(r.x + c[0] * QH, SEA + 0.8, r.z + c[1] * QH);
        rUv.push(c[2], c[3]);
        rSeed.push(rr());
        rKind.push(r.kind);
      });
      rIdx.push(b0, b0 + 1, b0 + 2, b0, b0 + 2, b0 + 3);
    });
    const reefGeo = new THREE.BufferGeometry();
    reefGeo.setAttribute('position', new THREE.Float32BufferAttribute(rPos, 3));
    reefGeo.setAttribute('uv', new THREE.Float32BufferAttribute(rUv, 2));
    reefGeo.setAttribute('aSeed', new THREE.Float32BufferAttribute(rSeed, 1));
    reefGeo.setAttribute('aKind', new THREE.Float32BufferAttribute(rKind, 1));
    reefGeo.setIndex(rIdx);
    const reefMat = new THREE.ShaderMaterial({
      uniforms: { uWall: { value: 0 }, uOp: { value: 0 } },
      vertexShader: REEF_VS, fragmentShader: REEF_FS,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false
    });
    const reefMesh = new THREE.Mesh(reefGeo, reefMat);
    reefG.add(reefMesh);
    const labReef = label('ESCOLLOS', { lh: 6, color: '#ff8a7a', pos: [84, SEA + 2, -152] });
    const labWreck = label('NAUFRAGIOS', { lh: 4.5, color: '#ffd27a', pos: [G.SITE.wreck.x + 4, SEA + 2, G.SITE.wreck.z - 6] });
    reefG.add(labReef.sprite, labWreck.sprite);

    // ================= 2. beam: haz de la linterna que barre el mar =================
    const beamG = new THREE.Group();
    root.add(beamG);
    const beamLen = Math.hypot(BEAM_R, TOP - SEA);
    // cono: apex en y=0 (linterna), base en y=-L (sobre el mar)
    const coneGeo = new THREE.CylinderGeometry(0.5, Math.tan(1.2 * Math.PI / 180) * beamLen, beamLen, 28, 1, true);
    coneGeo.translate(0, -beamLen / 2, 0);
    const beamMatM = beamMat(0xbfeaff, beamLen, 1.6, 0.25);
    const cone = new THREE.Mesh(coneGeo, beamMatM);
    cone.frustumCulled = false;
    beamG.add(cone);
    // reflejo en el agua: estela elíptica bajo el punto donde cae el haz
    const streakMat = new THREE.MeshBasicMaterial({
      map: streakTex(), transparent: true, opacity: 0, depthWrite: false, fog: false, blending: THREE.AdditiveBlending
    });
    const streakGeo = new THREE.PlaneGeometry(70, 520);
    streakGeo.rotateX(-Math.PI / 2);
    const streak = new THREE.Mesh(streakGeo, streakMat);
    streak.renderOrder = 2;
    beamG.add(streak);
    const beamGlow = glowSprite('255,236,190', 90, [0, SEA, 0]);
    beamG.add(beamGlow);

    // ================= 3. burn: MITO del espejo que incendia la flota =================
    const burnG = new THREE.Group();
    root.add(burnG);
    // rayo de sol concentrado: tubo grueso dorado desde el espejo hasta la galera principal
    const rayDir = new THREE.Vector3(BURN.x - 0, SEA + 0.8 - TOP, BURN.z - 0);
    const rayLen = rayDir.length();
    const rayGeo = new THREE.CylinderGeometry(1.1, 1.1, rayLen, 14, 1, true);
    rayGeo.translate(0, -rayLen / 2, 0);
    const rayMat = beamMat(0xffb050, rayLen, 0, 0.5);
    const ray = new THREE.Mesh(rayGeo, rayMat);
    ray.quaternion.setFromUnitVectors(DOWN, rayDir.clone().normalize());
    ray.position.set(0, TOP, 0);
    ray.frustumCulled = false;
    burnG.add(ray);
    const mirrorGlow = glowSprite('255,207,106', 46, [0, TOP, 0]);
    burnG.add(mirrorGlow);

    // flota romana fantasma: galera principal (que arde) + 4 galeras en formación
    const fleetG = new THREE.Group();
    root.add(fleetG);
    const mainB = newB();
    galleyPush(mainB, BURN.x, BURN.z);
    const mainFill = ghostMat(SHIP, 0.12, 0.8);
    const mainLines = lineMat(SHIP, 0);
    fleetG.add(new THREE.Mesh(fillGeo(mainB), mainFill));
    fleetG.add(new THREE.LineSegments(lineGeo(mainB), mainLines));
    const restB = newB();
    [[-125, -712], [-62, -688], [62, -712], [125, -688]].forEach(function (o) { galleyPush(restB, o[0], o[1]); });
    const restFill = ghostMat(SHIP, 0.12, 0.8);
    const restLines = lineMat(SHIP, 0);
    fleetG.add(new THREE.Mesh(fillGeo(restB), restFill));
    fleetG.add(new THREE.LineSegments(lineGeo(restB), restLines));
    // la galera del fuego: la base de la hoguera a la altura de cubierta
    const deckY = SEA + 3.5;

    // llamas (puntos aditivos, 1 draw call) y humo (puntos aditivos más lentos)
    const flameRnd = seeded(91), smokeRnd = seeded(173);
    function pointGeo(n, rnd, spread, baseY) {
      const base = new Float32Array(n * 3), seed = new Float32Array(n), size = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        base[i * 3] = BURN.x + (rnd() - 0.5) * spread;
        base[i * 3 + 1] = baseY + rnd() * 2;
        base[i * 3 + 2] = BURN.z + (rnd() - 0.5) * spread * 2.4;   // alargado a lo largo de la galera
        seed[i] = rnd();
        size[i] = 0;
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(base.slice(), 3));
      g.setAttribute('aBase', new THREE.BufferAttribute(base, 3));
      g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
      g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
      return g;
    }
    const flameGeo = pointGeo(90, flameRnd, 22, deckY);
    const sf = flameGeo.attributes.aSize.array;
    for (let i = 0; i < sf.length; i++) sf[i] = 5 + 6 * flameRnd();
    const smokeGeo = pointGeo(44, smokeRnd, 26, deckY + 2);
    const ss = smokeGeo.attributes.aSize.array;
    for (let i = 0; i < ss.length; i++) ss[i] = 14 + 18 * smokeRnd();
    function partMat(rise, drift, height, color, alpha) {
      return new THREE.ShaderMaterial({
        uniforms: {
          uMap: { value: softTex() }, uColor: { value: new THREE.Color(color) },
          uTime: { value: 0 }, uPx: { value: 1000 }, uRise: { value: rise }, uDrift: { value: drift },
          uHeight: { value: height }, uI: { value: 0 }, uAlpha: { value: alpha }
        },
        vertexShader: PART_VS, fragmentShader: PART_FS,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false
      });
    }
    const flameMat = partMat(0.95, 1.1, 13, FIRE, 0.9);
    const smokeMat = partMat(0.07, 5, 95, 0xc9b8a0, 0.2);
    const flames = new THREE.Points(flameGeo, flameMat);
    const smoke = new THREE.Points(smokeGeo, smokeMat);
    flames.frustumCulled = false; smoke.frustumCulled = false;
    burnG.add(smoke, flames);
    const fireGlow = glowSprite('255,138,42', 80, [BURN.x, deckY + 4, BURN.z]);
    burnG.add(fireGlow);

    // ¿UN ARMA DE LUZ? / Dicen: Arquímedes, Siracusa
    const labArma = label('¿UN ARMA DE LUZ?', { lh: 7, color: '#ffd27a', pos: [-150, SEA + 3, BURN.z + 30] });
    const labDicen = label('Dicen: Arquímedes, Siracusa', { lh: 3.6, color: '#ffe9a8', pos: [-150, SEA + 0.5, BURN.z + 30] });
    burnG.add(labArma.sprite, labDicen.sprite);

    // ================= 4. mythCross: aspa roja y etiqueta "¿MITO?" =================
    const crossG = new THREE.Group();
    root.add(crossG);
    const xB = newB();
    const DIAG_A = [0.7071, 0.7071, 0], DIAG_B = [0.7071, -0.7071, 0];
    const C0 = [0, 0, 0];
    (function bar(c, d, n, H, T) {
      const b0 = xB.P.length / 3;
      const p = function (s, w) { return [c[0] + d[0] * s * H + n[0] * w * T, c[1] + d[1] * s * H + n[1] * w * T, 0]; };
      [p(-1, -1), p(1, -1), p(1, 1), p(-1, 1)].forEach(function (q) { xB.P.push(q[0], q[1], q[2]); });
      xB.I.push(b0, b0 + 1, b0 + 2, b0, b0 + 2, b0 + 3);
    })(C0, DIAG_A, [-0.7071, 0.7071, 0], 46, 4.2);
    (function bar(c, d, n, H, T) {
      const b0 = xB.P.length / 3;
      const p = function (s, w) { return [c[0] + d[0] * s * H + n[0] * w * T, c[1] + d[1] * s * H + n[1] * w * T, 0]; };
      [p(-1, -1), p(1, -1), p(1, 1), p(-1, 1)].forEach(function (q) { xB.P.push(q[0], q[1], q[2]); });
      xB.I.push(b0, b0 + 1, b0 + 2, b0, b0 + 2, b0 + 3);
    })(C0, DIAG_B, [0.7071, 0.7071, 0], 46, 4.2);
    const crossGeo = new THREE.BufferGeometry();
    crossGeo.setAttribute('position', new THREE.Float32BufferAttribute(xB.P, 3));
    crossGeo.setIndex(xB.I);
    const crossMat = new THREE.MeshBasicMaterial({
      color: RED, transparent: true, opacity: 0, depthTest: false, depthWrite: false, side: THREE.DoubleSide, fog: false
    });
    const cross = new THREE.Mesh(crossGeo, crossMat);
    cross.renderOrder = 5;
    crossG.position.set(BURN.x, 100, BURN.z);
    crossG.add(cross);
    const labMito = label('¿MITO? · 700 m · ningún espejo de bronce lo consigue', { lh: 5.5, color: '#ff8a7a', pos: [BURN.x, 150, BURN.z] });
    crossG.add(labMito.sprite);

    // ================= 5. measure: regla de 0 a 124 m junto a la torre + anillo de 50 km =================
    const rulerG = new THREE.Group();
    root.add(rulerG);
    const rPos2 = [], rCol = [];
    function rseg(a, b, c) {
      rPos2.push(a[0], a[1], a[2], b[0], b[1], b[2]);
      rCol.push(c[0], c[1], c[2], c[0], c[1], c[2]);
    }
    const cyanC = [0.5, 0.89, 0.94], goldC = [1.0, 0.81, 0.42];
    const TH = G.TOWER.height;                 // 124
    rseg([RULER_X, 0, 0], [RULER_X, TH, 0], goldC);
    for (let m = 0; m <= TH; m++) {
      const len = m % 10 === 0 ? 4.5 : (m % 5 === 0 ? 2.6 : 1.2);
      const c = m <= 6 ? cyanC : goldC;
      rseg([RULER_X, m, 0], [RULER_X + len, m, 0], c);
    }
    const rGeo = new THREE.BufferGeometry();
    rGeo.setAttribute('position', new THREE.Float32BufferAttribute(rPos2, 3));
    rGeo.setAttribute('color', new THREE.Float32BufferAttribute(rCol, 3));
    const rulerMat = new THREE.LineBasicMaterial({
      vertexColors: true, transparent: true, opacity: 0.95, fog: false,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    const ruler = new THREE.LineSegments(rGeo, rulerMat);
    rulerG.add(ruler);
    // cotas por cuerpo (a la derecha de la regla)
    const cotas = [
      { txt: '0 m', lh: 3.2, y: 0 },
      { txt: '60 m', lh: 4.6, y: 36 },
      { txt: '30 m', lh: 4.6, y: 81 },
      { txt: '15 m', lh: 4.6, y: 103.5 },
      { txt: 'LINTERNA 6 m', lh: 3.4, y: 112.5 },
      { txt: 'ESTATUA 7 m', lh: 3.4, y: 121 },
      { txt: '124 m', lh: 4.6, y: 129.5 }
    ].map(function (c) {
      const L = label(c.txt, { lh: c.lh, color: c.y > 110 ? '#ffe9a8' : '#9fe9ff', pos: [0, c.y, 0], mono: true });
      L.y = c.y;
      rulerG.add(L.sprite);
      return L;
    });
    // ruido de la regla: el título (encima) cuando se completa
    const labRuler = label('MEDIDA DE LA TORRE', { lh: 3.6, color: '#9fe9ff', pos: [RULER_X, -8, 0], mono: true });
    rulerG.add(labRuler.sprite);

    // anillo enorme en el mar (radio = RING_R; la cámara alta de t=207 llega hasta 40 km)
    const ringG = new THREE.Group();
    root.add(ringG);
    const ringGeo = new THREE.RingGeometry(RING_R - 160, RING_R + 160, 220, 1);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: CYAN, transparent: true, opacity: 0, fog: false, depthWrite: false,
      depthTest: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.position.y = SEA + 0.5;
    ringMesh.renderOrder = 6;
    ringG.add(ringMesh);
    // sobre el anillo, en el sector que mira la cámara alta (dirección -X, +Z)
    const ringDir = norm([-0.836, 0, 0.548]);
    const labRing = label('VISIBLE A 50 km (crónicas)', {
      lh: 900, color: '#9fe9ff', pos: [ringDir[0] * RING_R, 1400, ringDir[2] * RING_R], depthTest: false
    });
    ringG.add(labRing.sprite);

    // ---------- actualización (solo transformaciones, visibilidad, uniforms y opacidades) ----------
    const FIRE_C = new THREE.Color(FIRE), SHIP_C = new THREE.Color(SHIP), FIRE_LINE = new THREE.Color(0xffb35a);
    const tmpColor = new THREE.Color();
    function update(s) {
      const wall = num(s.wall);
      const rf = clamp01(num(s.reefs));
      const bm = clamp01(num(s.beam));
      const bu = clamp01(num(s.burn));
      const mc = clamp01(num(s.mythCross));
      const ms = clamp01(num(s.measure));
      const camP = camera.position;
      const t = num(s.t);

      // escollos y pecio
      reefG.visible = rf > 0.001;
      if (reefG.visible) {
        reefMat.uniforms.uWall.value = wall;
        reefMat.uniforms.uOp.value = 0.85 * rf;
        labReef.mat.opacity = rf;
        labWreck.mat.opacity = rf;
      }

      // haz de la linterna que barre el mar (círculo de 2 km)
      beamG.visible = bm > 0.001;
      if (beamG.visible) {
        const a = wall * 0.22;
        const tx = BEAM_R * Math.cos(a), tz = BEAM_R * Math.sin(a);
        tmpA.set(0, TOP, 0);
        tmpB.set(tx, SEA, tz);
        const dirB = tmpU.copy(tmpB).sub(tmpA).normalize();
        cone.quaternion.setFromUnitVectors(DOWN, dirB);
        cone.position.copy(tmpA);
        // se desvanece si la cámara está dentro del haz (no tapar la imagen)
        const fade = ramp(distToSeg(camP, tmpA, tmpB), 6, 40);
        beamMatM.uniforms.uOp.value = 0.6 * bm * fade;
        streak.position.set(tx, SEA + 0.4, tz);
        streak.rotation.set(0, Math.PI / 2 - a, 0);
        streakMat.opacity = 0.42 * bm * fade;
        beamGlow.position.set(tx, SEA + 2, tz);
        beamGlow.material.opacity = 0.7 * bm * fade;
      }

      // mito: rayo del espejo, flota fantasma y fuego
      burnG.visible = bu > 0.001;
      if (burnG.visible) {
        const grow = ramp(bu, 0, 0.5);
        ray.scale.y = Math.max(0.001, grow);
        rayMat.uniforms.uOp.value = 0.7 * ramp(bu, 0, 0.35);
        mirrorGlow.material.opacity = 0.85 * ramp(bu, 0, 0.35);
        fireGlow.material.opacity = 0.7 * ramp(bu, 0.4, 0.9);
        const fire = ramp(bu, 0.45, 1);
        flameMat.uniforms.uTime.value = wall;
        flameMat.uniforms.uI.value = fire;
        flameMat.uniforms.uPx.value = renderer.domElement.height / (2 * Math.tan(camera.fov * Math.PI / 360));
        smokeMat.uniforms.uTime.value = wall;
        smokeMat.uniforms.uI.value = ramp(bu, 0.55, 1);
        smokeMat.uniforms.uPx.value = flameMat.uniforms.uPx.value;
        labArma.mat.opacity = ramp(bu, 0.2, 0.7);
        labDicen.mat.opacity = ramp(bu, 0.35, 0.85);
      }
      fleetG.visible = bu > 0.001;
      if (fleetG.visible) {
        const fk = clamp01(bu * 1.2);
        mainFill.uniforms.uOp.value = 0.7 * fk;
        mainFill.uniforms.uColor.value.copy(tmpColor.copy(SHIP_C).lerp(FIRE_C, ramp(bu, 0.45, 1)));
        mainLines.color.copy(tmpColor.copy(SHIP_C).lerp(FIRE_LINE, ramp(bu, 0.45, 1)));
        mainLines.opacity = 0.75 * fk;
        restFill.uniforms.uOp.value = 0.55 * fk;
        restLines.opacity = 0.6 * fk;
      }

      // aspa roja y etiqueta del mito (la aspa siempre mira a cámara)
      crossG.visible = mc > 0.001;
      if (crossG.visible) {
        crossG.quaternion.copy(camera.quaternion);
        crossMat.opacity = 0.9 * mc;
        labMito.mat.opacity = mc;
      }

      // regla de 124 m, de abajo arriba
      rulerG.visible = ms > 0.001;
      if (rulerG.visible) {
        drawSegs(ruler, ramp(ms, 0, 0.6));
        rulerMat.opacity = 0.95 * ms;
        // las cotas crecen con la distancia (1x cerca, hasta 2.4x desde la cámara alta) para seguir legibles
        tmpA.set(RULER_X, 60, 0);
        const fr = Math.max(1, Math.min(2.4, camP.distanceTo(tmpA) / 300));
        for (let i = 0; i < cotas.length; i++) {
          const L = cotas[i];
          L.sprite.scale.set(L.w * fr, L.h * fr, 1);
          L.sprite.position.set(RULER_X + 4 * fr + L.w * fr / 2, L.y, 0);
          L.mat.opacity = ramp(ms, 0.2 + 0.05 * i, 0.6 + 0.05 * i);
        }
        labRuler.sprite.scale.set(labRuler.w * fr, labRuler.h * fr, 1);
        labRuler.sprite.position.set(RULER_X + labRuler.w * fr / 2, -8 * fr, 0);
        labRuler.mat.opacity = ramp(ms, 0.5, 1);
      }

      // anillo de 50 km (crónicas)
      ringG.visible = ms > 0.001;
      if (ringG.visible) {
        ringMat.opacity = 0.55 * ramp(ms, 0.2, 0.7);
        labRing.mat.opacity = ramp(ms, 0.4, 1) * ramp(t, 205, 207);
      }
    }

    return { update: update };
  };
})();
