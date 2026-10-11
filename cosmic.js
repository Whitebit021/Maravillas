// Superposiciones "conspiranoicas" (agente cósmico). Todo por código: geometría, shaders y CanvasTexture.
// Todas las CanvasTexture usan encoding sRGB (main.js desactiva legacyMode).
(function () {
  'use strict';
  const G = window.GIZA;

  const TAU = Math.PI * 2;
  const DEG = Math.PI / 180;
  const PHI = (1 + Math.sqrt(5)) / 2;
  const GOLD = 0xffc24a, GOLD_HI = 0xffe9a8, CYAN = 0x3ff6ff, BLUE = 0x3aa8ff, STAR = 0xbfe6ff;
  const CALIZA = 0xc8a878, CALIZA_TOP = 0xf2ead6;
  const GROUND = 0.4; // separación del suelo (evita z-fighting con near = 0.5)

  function clamp01(x) { return x < 0 ? 0 : (x > 1 ? 1 : x); }
  function ss(x) { x = clamp01(x); return x * x * (3 - 2 * x); }
  function ramp(x, a, b) { return clamp01((x - a) / (b - a)); }
  // desvanecimiento de etiquetas cuando la pista del efecto baja de 0.6
  function fo(p) { return ramp(p, 0, 0.6); }
  function seeded(seed) {
    let s = seed >>> 0;
    return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }

  // Contorno cerrado de puntos [x,y,z] con n subdivisiones por lado (el último repite el primero).
  function loopPts(P, n) {
    const out = [];
    for (let e = 0; e < P.length; e++) {
      const a = P[e], b = P[(e + 1) % P.length];
      for (let i = 0; i < n; i++) {
        const u = i / n;
        out.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u]);
      }
    }
    out.push([P[0][0], P[0][1], P[0][2]]);
    return out;
  }
  function squarePts(half, y, n) {
    return loopPts([[-half, y, -half], [half, y, -half], [half, y, half], [-half, y, half]], n);
  }
  function ringGround(r, n, y) {
    const out = [];
    for (let i = 0; i <= n; i++) { const t = i / n * TAU; out.push([r * Math.sin(t), y, -r * Math.cos(t)]); }
    return out;
  }
  // circunferencia en el plano z = cz (vertical), centro (cx, cy)
  function circleVert(cx, cy, cz, R, n) {
    const out = [];
    for (let i = 0; i <= n; i++) { const t = i / n * TAU; out.push([cx + R * Math.cos(t), cy + R * Math.sin(t), cz]); }
    return out;
  }
  function linePts(a, b, n) {
    const out = [];
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      out.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u]);
    }
    return out;
  }
  function push3(arr, p, q, r) {
    arr.push(p[0], p[1], p[2], q[0], q[1], q[2], r[0], r[1], r[2]);
    return arr;
  }

  // ---------- dibujos de canvas ----------
  // Ojo de Horus (sutil, sobre la cúspide al final)
  function eyeCanvas() {
    const cv = document.createElement('canvas');
    cv.width = 512; cv.height = 256;
    const g = cv.getContext('2d');
    g.strokeStyle = '#ffd27a'; g.fillStyle = '#ffd27a'; g.lineWidth = 10;
    g.shadowColor = '#ffd27a'; g.shadowBlur = 18;
    g.beginPath(); g.moveTo(60, 140); g.quadraticCurveTo(256, 40, 452, 140); g.quadraticCurveTo(256, 220, 60, 140); g.stroke();
    g.beginPath(); g.arc(256, 130, 40, 0, TAU); g.stroke();
    g.beginPath(); g.arc(256, 130, 14, 0, TAU); g.fill();
    g.beginPath(); g.moveTo(40, 95); g.quadraticCurveTo(256, -10, 470, 95); g.stroke();
    g.beginPath(); g.moveTo(256, 180); g.quadraticCurveTo(230, 230, 190, 220); g.stroke();
    g.beginPath(); g.moveTo(130, 190); g.quadraticCurveTo(170, 250, 260, 230); g.stroke();
    return cv;
  }
  // Anillo de jeroglíficos dibujados por código (símbolos simples)
  function glyphRingCanvas() {
    const W = 2048, Hc = 128;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = Hc;
    const g = cv.getContext('2d');
    g.strokeStyle = '#ffd27a'; g.fillStyle = '#ffd27a'; g.lineWidth = 4;
    g.shadowColor = '#ffd27a'; g.shadowBlur = 8;
    g.beginPath(); g.moveTo(0, 6); g.lineTo(W, 6); g.moveTo(0, Hc - 6); g.lineTo(W, Hc - 6); g.stroke();
    const N = 32, cell = W / N;
    for (let i = 0; i < N; i++) {
      g.save();
      g.translate(i * cell + cell / 2, Hc / 2);
      switch (i % 8) {
        case 0: g.beginPath(); g.arc(0, 0, 22, 0, TAU); g.stroke(); g.beginPath(); g.arc(0, 0, 5, 0, TAU); g.fill(); break;
        case 1: g.beginPath(); g.ellipse(0, -22, 12, 16, 0, 0, TAU); g.stroke(); g.beginPath(); g.moveTo(0, -6); g.lineTo(0, 44); g.moveTo(-18, 14); g.lineTo(18, 14); g.stroke(); break;
        case 2: g.beginPath(); for (let x = -26; x <= 26; x += 2) { const y = Math.sin(x * 0.5) * 8; if (x === -26) g.moveTo(x, y); else g.lineTo(x, y); } g.stroke(); break;
        case 3: g.beginPath(); g.moveTo(-26, 0); g.quadraticCurveTo(0, -26, 26, 0); g.quadraticCurveTo(0, 26, -26, 0); g.stroke(); g.beginPath(); g.arc(0, 0, 6, 0, TAU); g.fill(); break;
        case 4: g.beginPath(); g.moveTo(-6, -30); g.lineTo(-6, 30); g.moveTo(6, -30); g.lineTo(6, 30); g.stroke(); break;
        case 5: g.beginPath(); g.moveTo(0, -34); g.lineTo(0, 34); g.moveTo(0, -34); g.quadraticCurveTo(18, -10, 0, 20); g.stroke(); break;
        case 6: g.strokeRect(-20, -18, 40, 36); g.strokeRect(-10, -28, 20, 10); break;
        case 7: g.beginPath(); g.moveTo(-24, -6); g.lineTo(0, 10); g.lineTo(24, -6); g.stroke(); g.beginPath(); g.arc(0, -14, 6, 0, TAU); g.fill(); break;
      }
      g.restore();
    }
    return cv;
  }

  G.createCosmic = function (ctx) {
    const THREE = ctx.THREE, scene = ctx.scene;
    const root = new THREE.Group();
    scene.add(root);

    const PYR = G.PYR, SITE = G.SITE, HALF = PYR.half, H = PYR.height;
    const KEF = SITE.khafre, MIC = SITE.menkaure;
    const flows = []; // ShaderMaterials que necesitan uTime

    // ---------- utilidades de geometría / material ----------
    function lineMat(color, opacity, through) {
      return new THREE.LineBasicMaterial({
        color: color, transparent: true, opacity: opacity,
        blending: THREE.AdditiveBlending, depthWrite: false, depthTest: !through
      });
    }
    function posGeo(pts) {
      const a = new Float32Array(pts.length * 3);
      for (let i = 0; i < pts.length; i++) { a[i * 3] = pts[i][0]; a[i * 3 + 1] = pts[i][1]; a[i * 3 + 2] = pts[i][2]; }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(a, 3));
      return g;
    }
    function floatGeo(arr) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
      return g;
    }
    // polilíneas -> pares de vértices (LineSegments). Cada punto puede llevar un 4º valor "along".
    function segGeo(polys) {
      const pos = [], al = [];
      for (let k = 0; k < polys.length; k++) {
        const pl = polys[k];
        for (let i = 0; i < pl.length - 1; i++) {
          const p = pl[i], q = pl[i + 1];
          pos.push(p[0], p[1], p[2], q[0], q[1], q[2]);
          al.push(p[3] || 0, q[3] || 0);
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('along', new THREE.Float32BufferAttribute(al, 1));
      return g;
    }
    // progreso de dibujado: strip (Line) y segmentos (LineSegments), en vértices
    function drawStrip(obj, f) {
      const n = obj.geometry.attributes.position.count;
      obj.geometry.setDrawRange(0, Math.round(clamp01(f) * n));
    }
    function drawSegs(obj, f) {
      const n = obj.geometry.attributes.position.count;
      obj.geometry.setDrawRange(0, 2 * Math.floor(clamp01(f) * n / 2));
    }

    // Línea de energía: se "dibuja" con uProgress (descarte por along) y pulsos que viajan.
    // uSpeed > 0: pulsos hacia along menor (hacia la pirámide); < 0: hacia la cúspide.
    const FLOW_VS = 'attribute float along; varying float vA;\n' +
      'void main(){ vA = along; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
    const FLOW_FS = 'uniform vec3 uColor; uniform float uOpacity; uniform float uProgress; uniform float uPulse; uniform float uTime; uniform float uSpeed; varying float vA;\n' +
      'void main(){\n' +
      '  if (vA > uProgress) discard;\n' +
      '  float p = fract(vA * 3.0 + uTime * uSpeed);\n' +
      '  float pulse = smoothstep(0.0, 0.12, p) * (1.0 - smoothstep(0.12, 0.45, p));\n' +
      '  float a = mix(1.0, 0.3 + 0.9 * pulse, uPulse) * uOpacity;\n' +
      '  gl_FragColor = vec4(uColor, a);\n' +
      '}';
    function flowMat(hex, opacity, pulse, speed) {
      const m = new THREE.ShaderMaterial({
        uniforms: {
          uColor: { value: new THREE.Color(hex) },
          uOpacity: { value: opacity },
          uProgress: { value: 1 },
          uPulse: { value: pulse ? 1 : 0 },
          uTime: { value: 0 },
          uSpeed: { value: speed || 1 }
        },
        vertexShader: FLOW_VS,
        fragmentShader: FLOW_FS,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      });
      flows.push(m);
      return m;
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
      g.fillStyle = gr;
      g.fillRect(0, 0, 128, 128);
      const t = new THREE.CanvasTexture(cv);
      t.encoding = THREE.sRGBEncoding;
      glowCache[rgb] = t;
      return t;
    }
    function glowSprite(rgb, size, pos) {
      const mat = new THREE.SpriteMaterial({
        map: glowTex(rgb), transparent: true, depthWrite: false,
        blending: THREE.AdditiveBlending, opacity: 0
      });
      const sp = new THREE.Sprite(mat);
      sp.scale.set(size, size, 1);
      sp.userData.base = size;
      sp.position.set(pos[0], pos[1], pos[2]);
      return sp;
    }

    // Etiquetas: Sprite con CanvasTexture (texto en español, aditivo, sin fondo). '\n' = nueva línea.
    function setText(L, text) {
      if (text === L.last) return;
      L.last = text;
      const g = L.g, lines = text.split('\n'), n = lines.length;
      g.clearRect(0, 0, L.W, L.H);
      g.font = L.font;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillStyle = L.color;
      g.shadowColor = L.color;
      g.shadowBlur = 24;
      for (let i = 0; i < n; i++) g.fillText(lines[i], L.W / 2, L.H * (i + 1) / (n + 1));
      g.shadowBlur = 0;
      for (let i = 0; i < n; i++) g.fillText(lines[i], L.W / 2, L.H * (i + 1) / (n + 1));
      L.tex.needsUpdate = true;
    }
    function label(text, o) {
      const W = o.cw || 1024, Hc = o.ch || 160;
      const cv = document.createElement('canvas');
      cv.width = W; cv.height = Hc;
      const tex = new THREE.CanvasTexture(cv);
      tex.encoding = THREE.sRGBEncoding;
      const mat = new THREE.SpriteMaterial({
        map: tex, transparent: true, depthWrite: false,
        depthTest: o.depthTest !== false, blending: THREE.AdditiveBlending, opacity: 1
      });
      const sp = new THREE.Sprite(mat);
      const w = o.w || 200;
      sp.scale.set(w, w * Hc / W, 1);
      sp.position.set(o.pos[0], o.pos[1], o.pos[2]);
      const L = {
        sprite: sp, mat: mat, tex: tex, g: cv.getContext('2d'),
        W: W, H: Hc, color: o.color || '#ffd27a',
        font: o.font || 'bold 64px Georgia, serif', last: null
      };
      setText(L, text);
      return L;
    }
    // Escritura letra a letra; solo redibuja cuando cambia el número de letras o el cursor
    function typed(L, full, frac, wall) {
      const n = Math.round(full.length * clamp01(frac));
      if (n <= 0) { setText(L, ''); return; }
      const cursor = (n < full.length && Math.floor(wall * 3) % 2 === 0) ? '_' : '';
      setText(L, full.slice(0, n) + cursor);
    }

    // ---------- pirámides: hiladas escalonadas + cúpula lisa opcional ----------
    // Escalones: cada hilada es una caja con su semibase y un reborde horizontal hasta la siguiente.
    function steppedTris(half, h, cx, cz, yTop, courses, arr) {
      const dy = yTop / courses;
      const K = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
      for (let i = 0; i < courses; i++) {
        const y0 = i * dy, y1 = (i + 1) * dy;
        const hb = half * (1 - y0 / h), ht = half * (1 - y1 / h);
        for (let e = 0; e < 4; e++) {
          const A = K[e], B = K[(e + 1) % 4];
          const a0 = [cx + A[0] * hb, y0, cz + A[1] * hb], b0 = [cx + B[0] * hb, y0, cz + B[1] * hb];
          const a1 = [cx + A[0] * hb, y1, cz + A[1] * hb], b1 = [cx + B[0] * hb, y1, cz + B[1] * hb];
          const ai = [cx + A[0] * ht, y1, cz + A[1] * ht], bi = [cx + B[0] * ht, y1, cz + B[1] * ht];
          push3(arr, a0, b1, b0); push3(arr, a0, a1, b1);   // cara vertical
          push3(arr, a1, bi, b1); push3(arr, a1, ai, bi);   // reborde superior
        }
      }
      return arr;
    }
    // Pirámide lisa (cúpula) desde y0 hasta y0+h, semibase half en y0
    function pyrTris(half, h, cx, cz, arr, y0) {
      const c = [[cx - half, cz - half], [cx + half, cz - half], [cx + half, cz + half], [cx - half, cz + half]];
      for (let i = 0; i < 4; i++) {
        const A = c[i], B = c[(i + 1) % 4];
        arr.push(A[0], y0, A[1], cx, y0 + h, cz, B[0], y0, B[1]);
      }
      return arr;
    }
    function pyrEdges(half, h, cx, cz, arr) {
      const c = [[cx - half, cz - half], [cx + half, cz - half], [cx + half, cz + half], [cx - half, cz + half]];
      for (let i = 0; i < 4; i++) {
        const A = c[i], B = c[(i + 1) % 4];
        arr.push(A[0], 0, A[1], B[0], 0, B[1]);   // base
        arr.push(A[0], 0, A[1], cx, h, cz);       // arista lateral
      }
      return arr;
    }

    // ================= 1. siteGrid: rejilla de nivelación =================
    const gSite = new THREE.Group();
    root.add(gSite);

    const gridPolys = [];
    for (let j = 0; j <= 13; j++) {
      const k = -130 + j * 20, a = [], b = [];
      for (let i = -65; i <= 65; i++) {
        const v = i * 2, r = Math.abs(v) / 130;   // along = distancia normalizada al centro
        a.push([k, GROUND, v, r]);
        b.push([v, GROUND, k, r]);
      }
      gridPolys.push(a, b);
    }
    const gridMat = flowMat(GOLD, 0.35, false);
    gSite.add(new THREE.LineSegments(segGeo(gridPolys), gridMat));

    const sqLine = new THREE.Line(posGeo(squarePts(HALF, GROUND, 100)), lineMat(GOLD_HI, 0.95));
    gSite.add(sqLine);

    const trenchGeo = segGeo([squarePts(150, GROUND, 60), squarePts(178, GROUND, 60)]);
    const trenchMat = lineMat(BLUE, 0.9);
    const trench = new THREE.LineSegments(trenchGeo, trenchMat);
    gSite.add(trench);

    // estacas en las esquinas y cuerdas tensadas entre ellas
    const stakePolys = [];
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(function (c) {
      stakePolys.push([[c[0] * HALF, GROUND, c[1] * HALF], [c[0] * HALF, 12, c[1] * HALF]]);
    });
    const stakes = new THREE.LineSegments(segGeo(stakePolys), lineMat(GOLD_HI, 0.9));
    const cords = new THREE.Line(posGeo(squarePts(HALF, 12, 100)), lineMat(GOLD_HI, 0.8));
    gSite.add(stakes, cords);

    // sacerdote-astrónomo con merkhet (plomada), dibujado en planta sobre el suelo
    const FX = -215, FZ = -40;
    const P2 = function (u, v) { return [FX + u, GROUND, FZ + v]; };
    const figPolys = [];
    const headPts = [];
    for (let i = 0; i <= 24; i++) { const t = i / 24 * TAU; headPts.push(P2(6 * Math.cos(t), 52 + 6 * Math.sin(t))); }
    figPolys.push(headPts);
    figPolys.push(loopPts([P2(-8, 44), P2(8, 44), P2(7, 20), P2(-7, 20)], 1));  // torso
    figPolys.push([P2(-5, 20), P2(-6, 0)], [P2(5, 20), P2(6, 0)]);               // piernas
    figPolys.push([P2(7, 42), P2(22, 58)]);                                       // brazo
    figPolys.push([P2(22, 58), P2(44, 74)]);                                      // merkhet
    figPolys.push([P2(30, 68), P2(30, 58)]);                                      // plomada
    const figure = new THREE.LineSegments(segGeo(figPolys), lineMat(GOLD_HI, 0.85));
    gSite.add(figure);

    const COORD_TXT = '29.9792° N  ↔  c = 299.792.458 m/s';
    const coordL = label('', { cw: 2048, ch: 160, w: 460, pos: [0, 30, 0], color: '#9fe9ff', font: 'bold 72px Georgia, serif', depthTest: false });
    const errL = label('ERROR DE NIVELACIÓN: 2,1 cm', { cw: 2048, ch: 160, w: 340, pos: [-120, 26, -215], color: '#ff9a5a', font: 'bold 72px Georgia, serif' });
    gSite.add(coordL.sprite, errL.sprite);

    function updSite(s) {
      const p = s.siteGrid;
      gSite.visible = p > 0.001;
      if (!gSite.visible) return;
      gridMat.uniforms.uProgress.value = p * 1.001;          // crece desde el centro
      drawStrip(sqLine, ramp(p, 0.35, 0.85));                 // cuadrado de la base trazándose
      drawSegs(stakes, ramp(p, 0.45, 0.6));                   // estacas
      drawStrip(cords, ramp(p, 0.6, 0.85));                   // cuerdas tensadas
      drawSegs(figure, ramp(p, 0.6, 0.9));                    // sacerdote
      drawSegs(trench, ramp(p, 0.7, 1));                      // zanjas con agua
      trenchMat.opacity = 0.55 + 0.4 * Math.sin(s.wall * 2.2);
      typed(coordL, COORD_TXT, ramp(p, 0.5, 1), s.wall);
      coordL.mat.opacity = fo(p);
      errL.mat.opacity = ramp(p, 0.8, 1) * fo(p);
    }

    // ================= 2. compass: rosa de los vientos y norte verdadero =================
    const gComp = new THREE.Group();
    root.add(gComp);

    const rosePolys = [ringGround(110, 120, GROUND), ringGround(240, 160, GROUND)];
    for (let k = 0; k < 8; k++) {       // 8 rumbos (N = -Z, E = +X)
      const t = k * Math.PI / 4;
      rosePolys.push([[12 * Math.sin(t), GROUND, -12 * Math.cos(t)], [260 * Math.sin(t), GROUND, -260 * Math.cos(t)]]);
    }
    for (let k = 0; k < 36; k++) {      // marcas cada 10°
      const t = k * 10 * DEG;
      rosePolys.push([[240 * Math.sin(t), GROUND, -240 * Math.cos(t)], [252 * Math.sin(t), GROUND, -252 * Math.cos(t)]]);
    }
    const rose = new THREE.LineSegments(segGeo(rosePolys), lineMat(GOLD, 0.9));
    gComp.add(rose);

    const trueN = new THREE.Line(posGeo(linePts([0, GROUND, 0], [0, GROUND, -300], 80)), lineMat(GOLD_HI, 1));
    const d05 = 0.05 * DEG;             // 3/60 de grado
    const measN = new THREE.Line(posGeo(linePts([0, GROUND, 0], [300 * Math.sin(d05), GROUND, -300 * Math.cos(d05)], 80)), lineMat(CYAN, 0.9));
    gComp.add(trueN, measN);

    const THUBAN_END = [0, 2500, -4590];   // 30° de elevación desde (0, -260) hacia el norte
    const thuban = new THREE.Line(posGeo(linePts([0, GROUND, -260], THUBAN_END, 90)), lineMat(CYAN, 0.9));
    const thubanGlow = glowSprite('170,230,255', 520, THUBAN_END);
    gComp.add(thuban, thubanGlow);

    const cardL = [['N', 0, -300], ['S', 0, 300], ['E', 300, 0], ['O', -300, 0]].map(function (c) {
      const L = label(c[0], { cw: 256, ch: 256, w: 60, pos: [c[1], 16, c[2]], color: '#ffd27a', font: 'bold 120px Georgia, serif' });
      gComp.add(L.sprite);
      return L;
    });
    const devL = label('DESVIACIÓN: 3/60 DE GRADO', { cw: 2048, ch: 160, w: 312, pos: [190, 10, 60], color: '#7ff7ff', font: 'bold 88px Georgia, serif' });
    const thubanL = label('THUBAN · estrella polar de la época', { cw: 2048, ch: 160, w: 900, pos: [0, 2700, -4590], color: '#bff4ff', font: 'bold 80px Georgia, serif' });
    gComp.add(devL.sprite, thubanL.sprite);

    function updComp(s) {
      const p = s.compass;
      gComp.visible = p > 0.001;
      if (!gComp.visible) return;
      drawSegs(rose, p);
      drawStrip(trueN, ramp(p, 0.15, 0.5));
      drawStrip(measN, ramp(p, 0.2, 0.55));
      drawStrip(thuban, ramp(p, 0.5, 1));
      thubanGlow.material.opacity = ramp(p, 0.6, 1) * fo(p);
      thubanL.mat.opacity = ramp(p, 0.6, 1) * fo(p);
      for (let i = 0; i < cardL.length; i++) cardL[i].mat.opacity = ramp(p, 0.2, 0.45) * fo(p);
      devL.mat.opacity = ramp(p, 0.55, 0.85) * fo(p);
    }

    // ================= 3. orion: cinturón de Orión y correlación con las pirámides =================
    const gOri = new THREE.Group();
    root.add(gOri);

    const SKY = 9000;
    // az: desvío desde el sur (+Z) hacia el este (+X), en grados; alt: elevación en grados
    function sky(az, alt) {
      const a = az * DEG, e = alt * DEG;
      return [SKY * Math.sin(a) * Math.cos(e), SKY * Math.sin(e), SKY * Math.cos(a) * Math.cos(e)];
    }
    const ST = {
      alnitak:    { az: 4.5,  alt: 49, belt: true },
      alnilam:    { az: 0,    alt: 50, belt: true },
      mintaka:    { az: -4.5, alt: 51, belt: true },
      betelgeuse: { az: 7.5,  alt: 63, belt: false },
      bellatrix:  { az: -7.5, alt: 61, belt: false },
      saiph:      { az: 6.5,  alt: 37, belt: false },
      rigel:      { az: -7,   alt: 36, belt: false }
    };
    const POS = {}, starSprites = {}, starKeys = Object.keys(ST), coreSprites = [];
    starKeys.forEach(function (k) {
      POS[k] = sky(ST[k].az, ST[k].alt);
      const sp = glowSprite(ST[k].belt ? '255,214,150' : '170,225,255', ST[k].belt ? 1000 : 420, POS[k]);
      gOri.add(sp);
      starSprites[k] = sp;
      if (ST[k].belt) {   // núcleo blanco brillante para el cinturón
        const core = glowSprite('255,255,255', 380, POS[k]);
        gOri.add(core);
        coreSprites.push(core);
      }
    });

    const CONS = [['betelgeuse', 'bellatrix'], ['betelgeuse', 'alnitak'], ['bellatrix', 'mintaka'], ['alnitak', 'alnilam'],
      ['alnilam', 'mintaka'], ['alnitak', 'saiph'], ['mintaka', 'rigel'], ['saiph', 'rigel']];
    const cons = new THREE.LineSegments(segGeo(CONS.map(function (c) { return [POS[c[0]], POS[c[1]]]; })), lineMat(STAR, 0.7));
    gOri.add(cons);

    const nameL = [['ALNITAK', 'alnitak'], ['ALNILAM', 'alnilam'], ['MINTAKA', 'mintaka']].map(function (c) {
      const P = POS[c[1]];
      const L = label(c[0], { cw: 1024, ch: 160, w: 360, pos: [P[0], P[1] - 650, P[2]], color: '#ffd98a' });
      gOri.add(L.sprite);
      return L;
    });

    // Correlación (solo con ghostPyramids): cada línea estrella -> cúspide se traza por turnos
    const CORR_KEYS = ['alnitak', 'alnilam', 'mintaka'];
    const APEX = {
      alnitak: [0, H, 0],
      alnilam: [KEF.x, KEF.height, KEF.z],
      mintaka: [MIC.x, MIC.height, MIC.z]
    };
    const gCorr = new THREE.Group();
    gOri.add(gCorr);
    const corrObjs = CORR_KEYS.map(function (k) {
      const o = new THREE.LineSegments(segGeo([linePts(POS[k], APEX[k], 60)]), lineMat(GOLD_HI, 0.8));
      gCorr.add(o);
      return o;
    });
    const flash = glowSprite('255,230,170', 380, APEX.alnitak);
    flash.material.depthWrite = false;
    gCorr.add(flash);
    const corrTitle = label('CORRELACIÓN DE ORIÓN', { cw: 2048, ch: 160, w: 1000, pos: [POS.alnilam[0], POS.alnilam[1] + 900, POS.alnilam[2]], color: '#ffe08a', font: 'bold 96px Georgia, serif' });
    const mintNote = label('MINTAKA DESPLAZADA: como Micerino', { cw: 2048, ch: 160, w: 900, pos: [POS.mintaka[0], POS.mintaka[1] - 1100, POS.mintaka[2]], color: '#9fe9ff', font: 'bold 60px Georgia, serif' });
    gCorr.add(corrTitle.sprite, mintNote.sprite);
    corrTitle.mat.opacity = 0;
    mintNote.mat.opacity = 0;

    function updOri(s) {
      const o = s.orion;
      gOri.visible = o > 0.001;
      if (!gOri.visible) return;
      for (let i = 0; i < starKeys.length; i++) {
        const k = starKeys[i], sp = starSprites[k], belt = ST[k].belt;
        const pulse = 0.5 + 0.5 * Math.sin(s.wall * 2.0 + i * 1.3);   // halo pulsante
        sp.material.opacity = (belt ? 1 : 0.75) * o * (0.7 + 0.3 * pulse);
        const sc = sp.userData.base * (belt ? 1 + 0.15 * pulse : 1);
        sp.scale.set(sc, sc, 1);
      }
      for (let i = 0; i < coreSprites.length; i++) {
        coreSprites[i].material.opacity = o * (0.85 + 0.15 * Math.sin(s.wall * 2.0 + i * 1.3));
      }
      drawSegs(cons, o);
      for (let i = 0; i < nameL.length; i++) nameL[i].mat.opacity = o;
      const g = s.ghostPyramids;
      gCorr.visible = g > 0.001;
      if (gCorr.visible) {
        const t = s.t;
        for (let i = 0; i < corrObjs.length; i++) drawSegs(corrObjs[i], ramp(t, 146 + 3 * i, 149 + 3 * i));
        // destello al llegar a cada cúspide (146-149, 149-152, 152-155)
        const kf = Math.max(0, Math.min(2, Math.round((t - 149) / 3)));
        const bump = clamp01(1 - Math.abs(t - (149 + 3 * kf)) / 0.9);
        flash.position.set(APEX[CORR_KEYS[kf]][0], APEX[CORR_KEYS[kf]][1], APEX[CORR_KEYS[kf]][2]);
        flash.material.opacity = 0.9 * bump * ramp(t, 146, 147);
        const c = ramp(g, 0.5, 1);
        corrTitle.mat.opacity = c;
        mintNote.mat.opacity = c;
      }
    }

    // ================= 4. ghostPyramids: Kefrén, Micerino y pirámides de las reinas =================
    const gGhost = new THREE.Group();
    root.add(gGhost);

    // Piedra opaca (caliza) y remate liso y claro
    const solidMat = new THREE.MeshStandardMaterial({ color: CALIZA, roughness: 0.9, metalness: 0 });
    const capMat = new THREE.MeshStandardMaterial({ color: CALIZA_TOP, roughness: 0.35, metalness: 0 });

    // Grupo de pirámide (coordenadas absolutas). El grupo escala en Y para "aparecer desde el suelo".
    function pyrGroup(list) {
      const tris = [], capTris = [], edg = [];
      for (let i = 0; i < list.length; i++) {
        const q = list[i];
        const yTop = q.cap ? q.h * 2 / 3 : q.h;
        steppedTris(q.half, q.h, q.x, q.z, yTop, q.courses, tris);
        if (q.cap) pyrTris(q.half * (1 - yTop / q.h), q.h - yTop, q.x, q.z, capTris, yTop);
        pyrEdges(q.half, q.h, q.x, q.z, edg);
      }
      const g = new THREE.Group();
      const tg = floatGeo(tris);
      tg.computeVertexNormals();
      const body = new THREE.Mesh(tg, solidMat);
      body.castShadow = true;
      body.receiveShadow = true;
      g.add(body);
      if (capTris.length) {
        const cg = floatGeo(capTris);
        cg.computeVertexNormals();
        const cap = new THREE.Mesh(cg, capMat);
        cap.castShadow = true;
        cap.receiveShadow = true;
        g.add(cap);
      }
      const edges = new THREE.LineSegments(floatGeo(edg), lineMat(CYAN, 0.9));
      g.add(edges);
      gGhost.add(g);
      return { g: g, edges: edges };
    }

    const kefG = pyrGroup([{ x: KEF.x, z: KEF.z, half: KEF.half, h: KEF.height, cap: true, courses: 26 }]);
    const micG = pyrGroup([{ x: MIC.x, z: MIC.z, half: MIC.half, h: MIC.height, courses: 18 }]);
    const queenG = pyrGroup([
      { x: 150, z: -50, half: 10, h: 7, courses: 3 },
      { x: 150, z: 5, half: 10, h: 7, courses: 3 },
      { x: 150, z: 60, half: 10, h: 7, courses: 3 }
    ]);
    const ghostGroups = [kefG, micG, queenG];

    // anillo holográfico que sube mientras la pirámide aparece
    const unitSquare = posGeo(squarePts(1, 0, 4));
    function holoRing() {
      const r = new THREE.Line(unitSquare, lineMat(CYAN, 0.9, true));
      gGhost.add(r);
      return r;
    }
    const ringK = holoRing(), ringM = holoRing();
    function placeRing(r, P, y) {
      r.position.set(P.x, y, P.z);
      const k = P.half * (1 - y / P.height) + 1.5;
      r.scale.set(k, 1, k);
    }

    const labKef = label('KEFRÉN · fantasma', { cw: 2048, ch: 160, w: 420, pos: [KEF.x, KEF.height + 40, KEF.z], color: '#ffd27a', font: 'bold 72px Georgia, serif' });
    const labMic = label('MICERINO', { cw: 1024, ch: 160, w: 300, pos: [MIC.x, MIC.height + 26, MIC.z], color: '#ffd27a', font: 'bold 72px Georgia, serif' });
    const labQueens = label('PIRÁMIDES DE LAS REINAS', { cw: 2048, ch: 160, w: 460, pos: [150, 26, 5], color: '#ffd27a', font: 'bold 60px Georgia, serif' });
    gGhost.add(labKef.sprite, labMic.sprite, labQueens.sprite);
    labKef.mat.opacity = 0; labMic.mat.opacity = 0; labQueens.mat.opacity = 0;

    function updGhost(s) {
      const p = s.ghostPyramids;
      gGhost.visible = p > 0.001;
      if (!gGhost.visible) return;
      const grow = Math.max(0.002, ss(p));
      for (let i = 0; i < ghostGroups.length; i++) {
        ghostGroups[i].g.scale.y = grow;
        ghostGroups[i].edges.visible = p < 0.999;                // borde holográfico solo durante la aparición
        ghostGroups[i].edges.material.opacity = 0.95 * (1 - ss(p));
      }
      ringK.visible = ringM.visible = p < 0.999;
      placeRing(ringK, KEF, grow * KEF.height);
      placeRing(ringM, MIC, grow * MIC.height);
      ringK.material.opacity = 0.9 * (1 - p);
      ringM.material.opacity = 0.9 * (1 - p);
      // nombres de pirámides solo entre t 142-156
      const nameT = ramp(s.t, 142, 144) * (1 - ramp(s.t, 154, 156));
      labKef.mat.opacity = nameT;
      labMic.mat.opacity = nameT;
      labQueens.mat.opacity = nameT;
    }

    // ================= 5. piDiagram: perímetro ÷ altura = 2π =================
    const gPi = new THREE.Group();
    root.add(gPi);

    const piHGeo = posGeo([[0, 0, 0], [0, 0, 0]]);       // la altura crece desde la base
    const piH = new THREE.Line(piHGeo, lineMat(GOLD_HI, 1, true));
    const perL = new THREE.Line(posGeo(squarePts(HALF, 0.8, 100)), lineMat(GOLD_HI, 1, true));
    const circ = new THREE.Line(posGeo(circleVert(0, H, 60, H, 180)), lineMat(CYAN, 1, true)); // radio = altura, circunferencia = perímetro
    gPi.add(piH, perL, circ);

    const PI_TXT = 'PERÍMETRO ÷ ALTURA\n921,5 ÷ 146,6 = 6,2858\n≈ 2π';
    // una sola fórmula (3 líneas) a la izquierda de la pirámide en pantalla (cámara mirando a +Z)
    const piEq = label('', { cw: 1024, ch: 512, w: 150, pos: [215, 110, -60], color: '#ffe08a', font: 'bold 72px Georgia, serif', depthTest: false });
    const piHL = label('ALTURA 146,6 m', { cw: 512, ch: 64, w: 40, pos: [-24, H * 0.5, 0], color: '#ffd27a', font: 'bold 48px Georgia, serif', depthTest: false });
    const piBL = label('BASE 230,3 m', { cw: 512, ch: 64, w: 40, pos: [0, 4, -HALF - 14], color: '#ffd27a', font: 'bold 48px Georgia, serif', depthTest: false });
    gPi.add(piEq.sprite, piHL.sprite, piBL.sprite);
    piHL.mat.opacity = 0; piBL.mat.opacity = 0;

    function updPi(s) {
      const p = s.piDiagram;
      gPi.visible = p > 0.001;
      if (!gPi.visible) return;
      const pa = piHGeo.attributes.position;
      pa.setXYZ(1, 0, H * ramp(p, 0, 0.5), 0);
      pa.needsUpdate = true;
      drawStrip(perL, ramp(p, 0.3, 0.7));
      drawStrip(circ, ramp(p, 0.6, 1));
      typed(piEq, PI_TXT, ramp(p, 0.45, 1), s.wall);
      piEq.mat.opacity = fo(p);
      piHL.mat.opacity = ramp(p, 0.1, 0.4) * fo(p);
      piBL.mat.opacity = ramp(p, 0.3, 0.6) * fo(p);
    }

    // ================= 6. golden: sección triangular y φ = 1,618 =================
    const gGold = new THREE.Group();
    root.add(gGold);

    const triOutline = new THREE.Line(posGeo(loopPts([[0, 0, -HALF], [0, H, 0], [0, 0, HALF]], 60)), lineMat(GOLD_HI, 1, true));
    const triFill = new THREE.Mesh(floatGeo([0, 0, -HALF, 0, H, 0, 0, 0, HALF]), new THREE.MeshBasicMaterial({
      color: GOLD, transparent: true, opacity: 0, blending: THREE.AdditiveBlending,
      depthWrite: false, depthTest: true, side: THREE.DoubleSide   // oculto por las caras de Keops (sin velo sobre la piedra)
    }));
    // espiral áurea: cada cuarto de vuelta multiplica el radio por φ
    const SPN = 360, spPts = [];
    for (let i = 0; i <= SPN; i++) {
      const t = i / SPN * 3 * Math.PI;
      const r = 6 * Math.pow(PHI, 2 * t / Math.PI);
      spPts.push([0, r * Math.sin(t), r * Math.cos(t)]);
    }
    const spiral = new THREE.Line(posGeo(spPts), lineMat(GOLD, 1, true));
    gGold.add(triFill, triOutline, spiral);

    const phiL = label('φ = 1,618', { cw: 1024, ch: 160, w: 280, pos: [60, H + 28, 0], color: '#ffe08a', font: 'bold 96px Georgia, serif', depthTest: false });
    const apoL = label('APOTEMA 186,4', { cw: 1024, ch: 160, w: 300, pos: [70, 84, 60], color: '#ffd27a', font: 'bold 56px Georgia, serif', depthTest: false });
    const semiL = label('SEMIBASE 115,15', { cw: 1024, ch: 160, w: 300, pos: [70, 10, HALF + 20], color: '#ffd27a', font: 'bold 56px Georgia, serif', depthTest: false });
    gGold.add(phiL.sprite, apoL.sprite, semiL.sprite);
    phiL.mat.opacity = 0; apoL.mat.opacity = 0; semiL.mat.opacity = 0;

    function updGold(s) {
      const p = s.golden;
      gGold.visible = p > 0.001;
      if (!gGold.visible) return;
      drawStrip(triOutline, ramp(p, 0, 0.6));
      triFill.material.opacity = 0.22 * ramp(p, 0.4, 1) * fo(p);
      drawStrip(spiral, ramp(p, 0.3, 1));
      phiL.mat.opacity = ramp(p, 0.5, 0.8) * fo(p);
      apoL.mat.opacity = ramp(p, 0.6, 0.9) * fo(p);
      semiL.mat.opacity = ramp(p, 0.6, 0.9) * fo(p);
    }

    // ================= 7. energy: teoría de la central de energía =================
    const gEn = new THREE.Group();
    root.add(gEn);

    // rejilla tenue: radiales y anillos de suelo que fluyen hacia la pirámide
    const enPolys = [];
    for (let k = 0; k < 16; k++) {     // along 0 = junto a la pirámide, 1 = lejos
      const t = k * TAU / 16, pts = [];
      for (let i = 0; i <= 24; i++) {
        const u = i / 24, r = HALF + 10 + u * 540;
        pts.push([r * Math.sin(t), GROUND, -r * Math.cos(t), u]);
      }
      enPolys.push(pts);
    }
    [180, 300, 420].forEach(function (R) {
      const ring = loopPts([[-R, GROUND, -R], [R, GROUND, -R], [R, GROUND, R], [-R, GROUND, R]], 24);
      ring.forEach(function (q, i) { q.push(i / (ring.length - 1)); });
      enPolys.push(ring);
    });
    const enMat = flowMat(CYAN, 0.35, true, 1);
    gEn.add(new THREE.LineSegments(segGeo(enPolys), enMat));

    // rayos que suben por las cuatro aristas hasta la cúspide
    const rayPolys = [];
    [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(function (c) {
      const pts = [];
      for (let i = 0; i <= 40; i++) {
        const u = i / 40, y = GROUND + u * (H - GROUND), r = PYR.halfAt(y) + 1.2;
        pts.push([c[0] * r, y, c[1] * r, u]);
      }
      rayPolys.push(pts);
    });
    const rayMat = flowMat(CYAN, 0.9, true, -1);
    gEn.add(new THREE.LineSegments(segGeo(rayPolys), rayMat));

    // anillos que suben por las caras
    const rising = [];
    for (let i = 0; i < 4; i++) {
      const r = new THREE.Line(unitSquare, lineMat(CYAN, 0.8));
      gEn.add(r);
      rising.push(r);
    }

    // anillo de jeroglíficos girando alrededor de la cima
    const glyphTex = new THREE.CanvasTexture(glyphRingCanvas());
    glyphTex.encoding = THREE.sRGBEncoding;
    const glyphRing = new THREE.Mesh(new THREE.CylinderGeometry(13, 13, 12, 96, 1, true), new THREE.MeshBasicMaterial({
      map: glyphTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending,
      depthWrite: false, side: THREE.DoubleSide
    }));
    glyphRing.position.set(0, H + 12, 0);
    gEn.add(glyphRing);

    // vórtice de ~2000 partículas sobre la cúspide
    const rnd = seeded(7);
    const VN = 2000;
    const vp = new Float32Array(VN * 3);
    for (let i = 0; i < VN; i++) {
      const u = rnd();
      const y = H + 2 + u * u * 70;
      const rad = 3 + (y - H) * 0.35 + rnd() * 4;
      const ang = rnd() * TAU;
      vp[i * 3] = rad * Math.cos(ang);
      vp[i * 3 + 1] = y;
      vp[i * 3 + 2] = rad * Math.sin(ang);
    }
    const vGeo = new THREE.BufferGeometry();
    vGeo.setAttribute('position', new THREE.BufferAttribute(vp, 3));
    const vMat = new THREE.PointsMaterial({
      color: CYAN, size: 2.4, sizeAttenuation: true, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    const vortex = new THREE.Points(vGeo, vMat);
    gEn.add(vortex);

    // título arriba y más pequeño
    const enL = label('TEORÍA DE LA CENTRAL DE ENERGÍA', { cw: 2048, ch: 160, w: 380, pos: [0, H + 175, 0], color: '#7ff7ff', font: 'bold 64px Georgia, serif' });
    gEn.add(enL.sprite);
    enL.mat.opacity = 0;

    // ojo de Horus muy sutil sobre la cúspide (t 237-245)
    const eyeMat = new THREE.SpriteMaterial({
      map: (function () { const t = new THREE.CanvasTexture(eyeCanvas()); t.encoding = THREE.sRGBEncoding; return t; })(),
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0
    });
    const eyeS = new THREE.Sprite(eyeMat);
    eyeS.scale.set(140, 70, 1);
    eyeS.position.set(0, H + 55, 0);
    root.add(eyeS);

    function updEnergy(s) {
      const e = s.energy;
      gEn.visible = e > 0.001;
      if (gEn.visible) {
        enMat.uniforms.uProgress.value = clamp01(e) * 1.001;
        enMat.uniforms.uOpacity.value = 0.35 * clamp01(e * 1.5);
        rayMat.uniforms.uProgress.value = clamp01(e) * 1.001;
        for (let i = 0; i < rising.length; i++) {
          const f = (s.wall * 0.12 + i / rising.length) % 1;
          const y = f * H;
          const k = PYR.halfAt(y) + 1.5;
          const r = rising[i];
          r.position.set(0, y, 0);
          r.scale.set(k, 1, k);
          r.material.opacity = 0.85 * Math.sin(f * Math.PI) * e;
        }
        glyphRing.rotation.y = s.wall * 0.4;
        glyphRing.material.opacity = 0.8 * clamp01(e * 1.5) * fo(e);
        vortex.rotation.y = s.wall * 0.9;
        vMat.opacity = 0.9 * e;
        enL.mat.opacity = ramp(e, 0.2, 0.8) * fo(e);
      }
      eyeS.visible = s.t >= 236.5;
      eyeMat.opacity = 0.6 * ramp(s.t, 236.5, 243) * (0.9 + 0.1 * Math.sin(s.wall * 1.3));
    }

    // ---------- bucle ----------
    function update(s) {
      const tt = s.wall * 0.35;
      for (let i = 0; i < flows.length; i++) flows[i].uniforms.uTime.value = tt;
      updSite(s);
      updComp(s);
      updOri(s);
      updGhost(s);
      updPi(s);
      updGold(s);
      updEnergy(s);
    }

    return { update: update, group: root };
  };
})();
