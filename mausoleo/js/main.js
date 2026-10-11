// Motor: renderer, línea de tiempo, pistas de estado y cámara cinematográfica.
(function () {
  'use strict';
  const G = window.GIZA;
  const THREE = window.THREE;
  const DURATION = G.DURATION;

  // gestión de color correcta: los colores hex se interpretan en sRGB (evita la imagen lavada)
  if (THREE.ColorManagement) THREE.ColorManagement.legacyMode = false;

  // ---------- renderer / escena ----------
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  document.body.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.5, 40000);
  camera.position.set(0, 20, -900);

  // ---------- línea de tiempo ----------
  const timeline = {
    t: 0,
    playing: false,
    speed: 1,
    duration: DURATION,
    listeners: [],
    play: function () { if (this.t >= DURATION) this.t = 0; this.playing = true; this._emit('play'); },
    pause: function () { this.playing = false; this._emit('pause'); },
    toggle: function () { this.playing ? this.pause() : this.play(); },
    seek: function (t) { this.t = Math.max(0, Math.min(DURATION, t)); this._emit('seek'); },
    isPlaying: function () { return this.playing; },
    on: function (fn) { this.listeners.push(fn); },
    _emit: function (ev) { this.listeners.forEach(function (fn) { try { fn(ev, timeline.t); } catch (e) { console.error(e); } }); }
  };
  G.timeline = timeline;

  // ---------- pistas de estado (t, valor) con interpolación suave ----------
  function smooth(x) { return x * x * (3 - 2 * x); }
  function sample(keys, t) {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      if (t <= keys[i][0]) {
        const a = keys[i - 1], b = keys[i];
        const u = (t - a[0]) / Math.max(1e-6, b[0] - a[0]);
        return a[1] + (b[1] - a[1]) * smooth(u);
      }
    }
    return keys[keys.length - 1][1];
  }

  const TRACKS = {
    // 0 medianoche, .25 amanecer, .5 mediodía, .75 atardecer, 1 medianoche (los módulos usan fract)
    timeOfDay: [[0, 0.82], [14, 0.9], [18, 1.27], [38, 1.36], [42, 1.72], [56, 1.8], [60, 2.28], [80, 2.36], [124, 2.48], [144, 2.56], [162, 2.62], [180, 2.72], [192, 2.76], [206, 2.82], [216, 3.3], [230, 3.45], [240, 3.62]],
    ghost:      [[0, 0.6], [14, 0.6], [18, 0]],                        // mausoleo completo fantasma (prólogo)
    survey:     [[21, 0], [25, 1], [34, 1], [38, 0]],                  // nivelación de la terraza: cuerdas, estacas, rejilla
    ashes:      [[39, 0], [42, 1], [54, 1], [57, 0]],                  // Artemisia fantasma con la copa y cenizas
    pyre:       [[38, 0], [40, 1], [47, 1], [50, 0]],                  // pira funeraria de Mausolo ardiendo
    excavation: [[58, 0], [65, 1], [82, 1], [84, 0]],                  // fosa abierta en la roca (se cubre con el podio)
    chamber:    [[62, 0], [70, 1]],                                     // cámara, escalera y bloque de sellado construidos
    sacrifice:  [[72, 0], [74, 1], [78, 1], [80, 0]],                  // ofrendas en la escalera (bueyes, corderos, vasijas)
    xray:       [[66, 0], [69, 1], [79, 1], [81, 0], [195, 0], [197, 0.85], [204, 0.85], [206, 0]],
    boats:      [[0, 0.3], [18, 0.6], [80, 1], [102, 1], [106, 0.5], [180, 0.5], [206, 0.3]],
    workers:    [[58, 0], [62, 1], [176, 1], [180, 0]],
    cranes:     [[80, 0], [84, 1], [168, 1], [172, 0]],
    podium:     [[80, 0], [100, 1]],                                    // podio subiendo (0..1 de 19 m)
    columns:    [[102, 0], [116, 1]],                                   // 36 columnas + cella subiendo
    entablature:[[114, 0], [123, 1]],
    friezes:    [[124, 0], [136, 1]],                                   // frisos y estatuas apareciendo lado a lado
    paint:      [[132, 0], [143, 1]],                                   // policromía (azules, rojos, oro)
    sculptors:  [[125, 0], [128, 1], [141, 1], [144, 0]],              // nombres de los 4 escultores por lado
    pyramid:    [[144, 0], [160, 1]],                                   // 24 escalones (0..1)
    quadriga:   [[162, 0], [170, 1]],
    measure:    [[181, 0], [184, 1], [193, 1], [195, 0]],              // cotas: 45 m, 24, 36, proporciones
    treasure:   [[195, 0], [197, 1], [201, 1], [204, 0]],              // el tesoro en la cámara se desvanece
    quake:      [[206, 0], [207, 1], [210, 1], [211, 0]],
    ruin:       [[207, 0], [213, 1]],                                   // caen cuadriga, pirámide y columnas
    dismantle:  [[214, 0], [228, 1]],                                   // los caballeros se llevan las piedras
    castle:     [[214, 0], [228, 1]],                                   // castillo de San Pedro creciendo
    today:      [[229, 0], [233, 1]]                                    // hoy: hueco con cimientos y columnas sueltas
  };

  // ---------- cámara: [t, posición, objetivo] ----------
  const CAM = [
    // prólogo: crepúsculo, el mausoleo fantasma
    [0,   [0, 10, -260],       [0, 30, 0]],
    [7,   [140, 30, -200],     [0, 30, 0]],
    [13,  [180, 90, 120],      [0, 20, 0]],
    // Halicarnaso
    [18,  [600, 300, 700],     [0, 0, 0]],
    [24,  [300, 160, -300],    [0, 0, 0]],
    [29,  [80, 42, -80],       [0, 0, 0]],
    [34,  [-120, 30, 60],      [0, 2, 0]],
    // cenizas
    [38,  [30, 12, -40],       [0, 7, 0]],
    [44,  [13, 10, -17],       [0, 9, 0]],
    [50,  [-20, 14, -22],      [0, 8, 0]],
    [55,  [60, 30, -70],       [0, 5, 0]],
    // la cámara
    [58,  [70, 40, 70],        [0, -3, 0]],
    [63,  [30, 15, 30],        [0, -4, 0]],
    [69,  [18, 5, -14],        [0, -4, 0]],
    [74,  [-22, 6, 12],        [-8, -4, 0]],
    // podio
    [80,  [140, 50, -140],     [0, 5, 0]],
    [86,  [150, 24, 330],      [80, 2, 245]],
    [92,  [60, 20, -60],       [0, 10, 0]],
    [97,  [-50, 30, 50],       [0, 15, 0]],
    // columnas
    [102, [80, 40, -80],       [0, 22, 0]],
    [108, [30, 26, -30],       [0, 24, 0]],
    [114, [26, 24, 0],         [0, 25, 0]],
    [120, [-60, 40, -50],      [0, 28, 0]],
    // escultores (un lado por plano)
    [124, [0, 24, -42],        [0, 26, -16]],
    [129, [42, 22, -8],        [19, 24, 0]],
    [134, [0, 30, 46],         [0, 26, 16]],
    [139, [-46, 28, 6],        [-19, 26, 0]],
    // pirámide
    [144, [90, 60, -90],       [0, 34, 0]],
    [150, [40, 47, -30],       [0, 38, 0]],
    [156, [-30, 53, 30],       [0, 40, 0]],
    // cuadriga y esplendor
    [162, [15, 49, -15],       [0, 43, 0]],
    [167, [8, 46, -10],        [0, 44, 0]],
    [172, [-60, 30, -80],      [0, 30, 0]],
    [176, [200, 22, 300],      [0, 30, 0]],
    // números y el tesoro
    [180, [120, 40, -120],     [0, 25, 0]],
    [186, [70, 30, 0],         [0, 23, 0]],
    [192, [-70, 50, -70],      [0, 23, 0]],
    [197, [26, 6, -24],        [0, -3, 0]],
    [202, [-20, 5, 18],        [0, -4, 0]],
    // final: terremoto, castillo, hoy
    [206, [100, 50, -100],     [0, 25, 0]],
    [211, [80, 30, 60],        [0, 15, 0]],
    [217, [250, 60, 200],      [400, 10, 380]],
    [223, [540, 40, 250],      [420, 15, 380]],
    [229, [60, 30, -60],       [0, 0, 0]],
    [235, [150, 70, 150],      [0, 0, 0]],
    [240, [500, 180, 600],     [200, 0, 200]]
  ];

  const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3();
  function catmull(p0, p1, p2, p3, u, out) {
    const u2 = u * u, u3 = u2 * u;
    for (let k = 0; k < 3; k++) {
      out[k] = 0.5 * ((2 * p1[k]) + (-p0[k] + p2[k]) * u + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * u2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * u3);
    }
    return out;
  }
  const posOut = [0, 0, 0], tgtOut = [0, 0, 0];
  function updateCamera(t, wall) {
    let i = 1;
    while (i < CAM.length - 1 && t > CAM[i][0]) i++;
    const a = CAM[i - 1], b = CAM[i];
    const p = CAM[Math.max(0, i - 2)], n = CAM[Math.min(CAM.length - 1, i + 1)];
    let u = (t - a[0]) / Math.max(1e-6, b[0] - a[0]);
    u = Math.max(0, Math.min(1, u));
    u = u * 0.75 + smooth(u) * 0.25; // ligera desaceleración en cada plano
    catmull(p[1], a[1], b[1], n[1], u, posOut);
    catmull(p[2], a[2], b[2], n[2], u, tgtOut);
    // cámara en mano sutil
    const sh = 0.35;
    tmpA.set(posOut[0] + Math.sin(wall * 0.7) * sh, Math.max(1.5, posOut[1] + Math.sin(wall * 0.9 + 1) * sh), posOut[2] + Math.cos(wall * 0.6) * sh);
    tmpB.set(tgtOut[0], tgtOut[1], tgtOut[2]);
    camera.position.copy(tmpA);
    camera.lookAt(tmpB);
  }

  // ---------- estado ----------
  const state = { t: 0, dt: 0, wall: 0, chapter: 'intro', chapterIndex: 0, chapterProgress: 0, duration: DURATION, playing: false };
  function computeState(t, dt, wall) {
    state.t = t; state.dt = dt; state.wall = wall; state.playing = timeline.playing;
    for (const k in TRACKS) state[k] = sample(TRACKS[k], t);
    let ci = 0;
    for (let i = 0; i < G.CHAPTERS.length; i++) if (t >= G.CHAPTERS[i].start) ci = i;
    const ch = G.CHAPTERS[ci];
    state.chapter = ch.id; state.chapterIndex = ci;
    state.chapterProgress = Math.max(0, Math.min(1, (t - ch.start) / (ch.end - ch.start)));
    return state;
  }
  G.state = state;

  // ---------- módulos ----------
  const ctx = { THREE: THREE, scene: scene, camera: camera, renderer: renderer, timeline: timeline, state: state };
  G.ctx = ctx;
  const factories = ['createEnvironment', 'createMausoleum', 'createInterior', 'createConstruction', 'createMystery', 'createHUD'];
  const modules = [];
  factories.forEach(function (name) {
    if (typeof G[name] !== 'function') { console.warn('[GIZA] falta módulo', name); return; }
    try {
      const m = G[name](ctx);
      if (m) { m.__name = name; modules.push(m); G[name.replace('create', '').toLowerCase()] = m; }
    } catch (e) { console.error('[GIZA] error creando', name, e); }
  });

  // ---------- bucle ----------
  let last = performance.now(), wall = 0, exporting = false;
  const failed = {};
  function frame(now) {
    if (exporting) { requestAnimationFrame(frame); return; }
    const dt = Math.min(0.1, (now - last) / 1000); last = now; wall += dt;
    if (timeline.playing) {
      timeline.t += dt * timeline.speed;
      if (timeline.t >= DURATION) { timeline.t = DURATION; timeline.pause(); timeline._emit('end'); }
    }
    const s = computeState(timeline.t, timeline.playing ? dt * timeline.speed : 0, wall);
    s.realDt = dt;
    updateCamera(s.t, wall);
    for (let i = 0; i < modules.length; i++) {
      const m = modules[i];
      if (failed[m.__name] || typeof m.update !== 'function') continue;
      try { m.update(s); } catch (e) { failed[m.__name] = true; console.error('[GIZA] error en update de', m.__name, e); }
    }
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }

  // depuración: renderiza un fotograma concreto sin depender de requestAnimationFrame
  G.renderAt = function (t, steps) {
    timeline.pause(); timeline.seek(t);
    for (let k = 0; k < (steps || 3); k++) {
      wall += 0.05;
      const s = computeState(timeline.t, 0.016, wall);
      s.realDt = 0.016;
      updateCamera(s.t, wall);
      modules.forEach(function (m) { if (!failed[m.__name] && m.update) { try { m.update(s); } catch (e) { failed[m.__name] = true; console.error(e); } } });
      renderer.render(scene, camera);
    }
    return { calls: renderer.info.render.calls, tris: renderer.info.render.triangles, failed: Object.keys(failed) };
  };

  // ---------- exportación a video (fotograma a fotograma, determinista) ----------
  // Uso (con tools/rec_server.py sirviendo la página): GIZA.exportVideo({ fps: 30, w: 1920, h: 1080 })
  G.exportVideo = async function (opt) {
    opt = opt || {};
    const fps = opt.fps || 30, W = opt.w || 1920, H = opt.h || 1080;
    const from = opt.from || 0, to = Math.min(DURATION, opt.to || DURATION);
    const name = opt.name || 'mausoleo_halicarnaso_' + H + 'p.mp4';
    const quality = opt.quality || 0.95;
    timeline.pause();
    const hud = document.getElementById('hud'); if (hud) hud.style.display = 'none';
    exporting = true;
    renderer.setPixelRatio(1);
    renderer.setSize(W, H, false);
    camera.aspect = W / H; camera.updateProjectionMatrix();
    const canvas = renderer.domElement;
    const total = Math.round((to - from) * fps);
    G.exportProgress = { frame: 0, total: total, done: false, error: null };
    await fetch('/start?name=' + encodeURIComponent(name) + '&fps=' + fps, { method: 'POST' });
    try {
      for (let i = 0; i < total; i++) {
        const t = from + i / fps;
        timeline.t = t;
        const s = computeState(t, 1 / fps, t);
        s.realDt = 1 / fps; s.playing = true;
        updateCamera(t, t);
        for (let k = 0; k < modules.length; k++) {
          const m = modules[k];
          if (m.__name === 'createHUD' || failed[m.__name] || typeof m.update !== 'function') continue;
          try { m.update(s); } catch (e) { failed[m.__name] = true; console.error(e); }
        }
        renderer.render(scene, camera);
        const blob = await new Promise(function (res) { canvas.toBlob(res, 'image/jpeg', quality); });
        await fetch('/frame?i=' + i, { method: 'POST', body: blob });
        G.exportProgress.frame = i + 1;
        if (G.exportLog && i % 30 === 0) G.exportLog('frame ' + i + ' t=' + t.toFixed(2));
      }
      const r = await fetch('/end', { method: 'POST' });
      G.exportProgress.result = await r.text();
    } catch (e) { G.exportProgress.error = String(e); }
    G.exportProgress.done = true;
    exporting = false;
    return G.exportProgress;
  };

  window.addEventListener('resize', function () {
    if (exporting) return;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
  window.addEventListener('keydown', function (e) {
    if (e.code === 'Space') { e.preventDefault(); timeline.toggle(); }
    if (e.code === 'ArrowRight') timeline.seek(timeline.t + 5);
    if (e.code === 'ArrowLeft') timeline.seek(timeline.t - 5);
  });

  // ?t=120 para saltar directamente (útil para revisar)
  const qt = parseFloat(new URLSearchParams(location.search).get('t'));
  if (!isNaN(qt)) timeline.seek(qt);
  if (!G.hud) document.addEventListener('click', function () { timeline.toggle(); });

  // ?export=1&from=0&to=15&name=parte.mp4 → exporta ese tramo automáticamente (render headless)
  const qp = new URLSearchParams(location.search);
  if (qp.get('export')) {
    const rlog = function (m) { try { fetch('/log', { method: 'POST', body: String(m) }); } catch (e) { /* nada */ } };
    window.addEventListener('error', function (e) { rlog('ERR ' + e.message + ' @' + e.filename + ':' + e.lineno); });
    const ce = console.error;
    console.error = function () { rlog('CE ' + Array.prototype.join.call(arguments, ' ')); ce.apply(console, arguments); };
    rlog('loaded modules=' + modules.map(function (m) { return m.__name; }).join(','));
    G.exportLog = rlog;
    renderer.domElement.addEventListener('webglcontextlost', function () { rlog('WEBGL CONTEXT LOST'); });
    setTimeout(function () {
      G.exportVideo({
        from: parseFloat(qp.get('from')) || 0, to: parseFloat(qp.get('to')) || DURATION,
        fps: parseInt(qp.get('fps'), 10) || 30, name: qp.get('name') || undefined
      });
    }, 1500);
  }

  requestAnimationFrame(frame);
})();
