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
    timeOfDay: [[0, 0.2], [14, 0.25], [18, 0.3], [40, 0.38], [62, 0.44], [106, 0.52], [130, 0.6], [150, 0.68], [162, 0.73], [170, 0.77], [176, 0.9], [190, 1.0], [194, 1.28], [212, 1.42], [222, 1.55], [232, 1.7], [240, 1.76]],
    siege:      [[16, 0], [20, 1], [38, 1], [42, 0]],                  // torre Helépolis + flota de Demetrio
    weapons:    [[24, 0], [28, 1], [46, 1], [56, 0]],                  // montón de armas abandonadas (se funden)
    foundry:    [[38, 0], [42, 1], [146, 1], [150, 0]],                // hornos encendidos
    boats:      [[0, 0.3], [18, 1], [60, 1], [64, 0.5], [146, 0.5], [150, 0.25], [212, 0.25], [214, 0]],
    workers:    [[38, 0], [42, 1], [146, 1], [152, 0]],
    pedestal:   [[62, 0], [78, 1]],                                     // pedestal de mármol subiendo (0..1 de 15 m)
    columns:    [[84, 0], [98, 0.65], [130, 1]],                      // columnas de piedra internas (fracción de 33 m)
    frame:      [[84, 0], [100, 0.6], [132, 1]],                      // armazón de hierro (fracción de 33 m)
    build:      [[96, 0], [104, 0.3], [130, 0.86], [140, 1]],          // piel de bronce (fracción de 33 m)
    mound:      [[100, 0], [104, 0.3], [130, 0.86], [140, 1], [146, 1], [156, 0]], // terraplén de tierra
    pour:       [[106, 0], [110, 1], [138, 1], [142, 0]],              // vertido de bronce fundido in situ
    xray:       [[86, 0], [90, 0.85], [102, 0.85], [106, 0], [116, 0], [119, 0.6], [124, 0.6], [127, 0]],
    crown:      [[138, 0], [145, 1]],                                   // rayos de la corona solar
    shine:      [[146, 0], [156, 1], [212, 1], [222, 0.3]],            // bronce pulido brillando
    myth:       [[0, 0.55], [13, 0.55], [17, 0], [170, 0], [174, 1], [190, 1], [192, 0]], // fantasma "piernas abiertas"
    mythCross:  [[183, 0], [185, 1], [190, 1], [192, 0]],              // aspa roja sobre el mito
    realSpot:   [[184, 0], [187, 1], [191, 1], [193, 0]],              // marcador del emplazamiento real
    measure:    [[192, 0], [195, 1], [210, 1], [212, 0]],              // regla de 33 m y cotas
    compare:    [[198, 0], [201, 1], [208, 1], [210, 0]],              // silueta de comparación (46 m, 'Nuevo Coloso')
    sunLines:   [[203, 0], [206, 1], [210, 1], [212, 0]],              // líneas solares de Helios (teoría)
    quake:      [[213, 0], [214, 1], [219, 1], [221, 0]],              // temblor del terremoto del 226 a.C.
    fall:       [[214.5, 0], [219, 1]],                                 // 0 en pie → 1 caído (quebrado por las rodillas)
    ruins:      [[219, 0], [220, 1], [229, 1], [232, 0]],              // restos en el suelo; desaparecen (camellos)
    camels:     [[223, 0], [226, 1], [234, 1], [237, 0]],
    today:      [[230, 0], [234, 1]]                                    // hoy: bocana con columnas de ciervos
  };

  // ---------- cámara: [t, posición, objetivo] ----------
  const CAM = [
    // prólogo: amanecer sobre el mar, la imagen del mito
    [0,   [0, 6, -640],        [0, 40, -260]],
    [8,   [150, 22, -540],     [0, 48, -260]],
    [14,  [270, 60, -380],     [0, 30, -100]],
    // asedio
    [18,  [560, 130, -80],     [400, 20, 140]],
    [24,  [570, 55, 250],      [430, 26, 140]],
    [30,  [310, 42, 210],      [100, 5, 75]],
    [35,  [170, 18, 120],      [95, 3, 75]],
    // bronce
    [40,  [125, 32, -40],      [44, 3, 30]],
    [45,  [74, 9, 54],         [44, 2, 36]],
    [51,  [-86, 22, 92],       [-42, 3, 34]],
    [56,  [-260, 70, -320],    [-40, 0, -150]],
    // pedestal
    [62,  [72, 46, 72],        [0, 5, 0]],
    [68,  [40, 18, 46],        [0, 6, 0]],
    [74,  [-52, 28, 40],       [0, 10, 0]],
    [79,  [-58, 40, -52],      [0, 15, 0]],
    // armazón
    [82,  [42, 32, -42],       [0, 21, 0]],
    [88,  [24, 22, 22],        [0, 21, 0]],
    [94,  [14, 26, -14],       [0, 24, 0]],
    [100, [-28, 34, 28],       [0, 26, 0]],
    // terraplén
    [106, [125, 62, 105],      [0, 22, 0]],
    [112, [62, 36, 62],        [0, 26, 0]],
    [118, [30, 42, -30],       [0, 33, 0]],
    [124, [-82, 62, 42],       [0, 36, 0]],
    [128, [-42, 57, -62],      [0, 41, 0]],
    // cabeza y corona
    [130, [26, 53, -26],       [0, 44, 0]],
    [136, [11, 47, -15],       [0, 45.5, 0]],
    [142, [-15, 51, -17],      [0, 46.5, 0]],
    [146, [72, 42, 82],        [0, 28, 0]],
    // esplendor
    [150, [0, 10, -210],       [0, 34, 0]],
    [156, [-125, 18, -155],    [0, 34, 0]],
    [162, [14, 52, 16],        [0, 30, -160]],
    [166, [185, 8, -85],       [0, 32, 0]],
    // el mito
    [170, [0, 40, -720],       [0, 40, -260]],
    [176, [-270, 32, -430],    [0, 34, -260]],
    [182, [0, 8, -360],        [0, 34, -260]],
    [187, [320, 210, -520],    [0, 0, -170]],
    // números
    [192, [62, 30, -62],       [0, 31, 0]],
    [198, [84, 26, 4],         [0, 29, 0]],
    [204, [-30, 34, -120],     [-8, 26, 0]],
    [209, [42, 62, 92],        [0, 30, 0]],
    // final: terremoto, caída, camellos, hoy
    [212, [92, 30, -72],       [0, 30, 0]],
    [216, [112, 26, -42],      [10, 16, 0]],
    [221, [72, 18, 52],        [24, 3, 0]],
    [227, [210, 52, 255],      [120, 0, 250]],
    [233, [-10, 14, -345],     [-70, 11, -262]],
    [240, [-310, 85, -720],    [0, 20, -120]]
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
  const factories = ['createEnvironment', 'createColossus', 'createInterior', 'createConstruction', 'createMystery', 'createHUD'];
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
    const name = opt.name || 'coloso_rodas_' + H + 'p.mp4';
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
