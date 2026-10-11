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
    timeOfDay: [[0, 0.95], [14, 1.02], [18, 1.27], [38, 1.36], [80, 1.44], [126, 1.55], [146, 1.7], [152, 1.78], [164, 1.9], [170, 2.3], [188, 2.45], [210, 2.55], [226, 2.7], [240, 2.8]],
    ghost:      [[0, 0.6], [14, 0.6], [18, 0], [234, 0], [238, 0.5], [240, 0.5]], // faro fantasma completo (cian)
    reefs:      [[18, 0], [22, 1], [35, 1], [39, 0]],                  // escollos y pecios resaltados
    boats:      [[0, 0.3], [18, 1], [146, 1], [150, 0.6], [212, 0.6], [214, 0.3]],
    barges:     [[38, 0], [42, 1], [60, 1], [64, 0.4], [146, 0.4], [150, 0]], // barcazas de granito de Asuán
    workers:    [[38, 0], [42, 1], [146, 1], [150, 0]],
    cranes:     [[60, 0], [64, 1], [144, 1], [148, 0]],                // grúas de rueda de madera
    foundation: [[60, 0], [78, 1]],                                     // podio de bloques (0..1 de 6 m)
    lead:       [[66, 0], [69, 1], [74, 1], [77, 0]],                  // plomo fundido entre bloques
    build:      [[78, 0.054], [102, 0.595], [106, 0.595], [126, 0.62], [136, 0.865], [146, 1]], // altura/111 m
    xray:       [[104, 0], [108, 0.85], [122, 0.85], [126, 0]],
    ramp:       [[104, 0], [108, 1], [124, 1], [128, 0]],              // rampa interior con burros subiendo
    lantern:    [[144, 0], [150, 1]],                                   // linterna + estatua colocadas
    fire:       [[150, 0], [154, 1], [166, 1], [170, 0.25], [212, 0.25], [214, 0]],
    mirror:     [[148, 0], [152, 1], [212, 1], [214, 0]],
    beam:       [[154, 0], [158, 1], [166, 1], [169, 0]],              // haz reflejado barriendo el mar
    burn:       [[172, 0], [176, 1], [184, 1], [188, 0]],              // rayo del espejo incendiando un barco (mito)
    mythCross:  [[182, 0], [184, 1], [187, 1], [188, 0]],              // "¿MITO?" sobre el rayo
    plaster:    [[190, 0], [199, 1], [240, 1]],              // el yeso cae y aparece Sóstrato
    measure:    [[200, 0], [202, 1], [208, 1], [210, 0]],              // regla de 124 m y radio de 50 km
    quake1:     [[212, 0], [213, 1], [216, 1], [217, 0]],              // terremoto de 1303
    quake2:     [[221, 0], [222, 1], [224, 1], [225, 0]],              // terremoto de 1323
    collapse:   [[213, 0], [217, 0.6], [222, 0.6], [225, 1]],          // 0 intacto, .6 caen los cuerpos altos, 1 muñón
    sunken:     [[216, 0], [219, 1], [240, 1]],                         // bloques hundidos en el mar
    citadel:    [[226, 0], [233, 1], [240, 1]]                          // fortaleza de Qaitbey con sus piedras
  };

  // ---------- cámara: [t, posición, objetivo] ----------
  const CAM = [
    // prólogo: de noche, el faro fantasma
    [0,   [0, 8, -900],        [0, 60, 0]],
    [8,   [-250, 30, -600],    [0, 80, 0]],
    [14,  [300, 140, -300],    [0, 60, 0]],
    // la isla
    [18,  [600, 400, -800],    [-400, 0, 300]],
    [24,  [-200, 260, -520],   [-500, 0, 100]],
    [30,  [210, 22, -250],     [80, 0, -90]],
    [35,  [-1000, 140, 620],   [-700, 0, 700]],
    // piedra
    [38,  [420, 45, 620],      [200, 0, 420]],
    [44,  [170, 12, 300],      [110, 2, 240]],
    [50,  [95, 22, 125],       [28, 2, 58]],
    [55,  [44, 8, 74],         [26, 2, 56]],
    // cimientos
    [60,  [120, 70, -120],     [0, 0, 0]],
    [66,  [52, 20, -52],       [0, 3, 0]],
    [71,  [26, 10, -32],       [6, 5, -12]],
    [76,  [-80, 40, 60],       [0, 5, 0]],
    // torre cuadrada
    [80,  [160, 50, -160],     [0, 20, 0]],
    [86,  [90, 40, 90],        [0, 35, 0]],
    [92,  [-110, 70, -60],     [0, 50, 0]],
    [98,  [40, 76, -40],       [0, 63, 0]],
    // rampa (rayos X)
    [104, [120, 60, -120],     [0, 40, 0]],
    [109, [45, 24, -45],       [0, 20, 0]],
    [115, [30, 45, 30],        [0, 40, 0]],
    [121, [-35, 62, -25],      [0, 56, 0]],
    // octógono y cilindro
    [126, [150, 90, 150],      [0, 70, 0]],
    [131, [60, 82, -60],       [0, 80, 0]],
    [137, [-55, 106, 40],      [0, 95, 0]],
    [142, [30, 116, -30],      [0, 106, 0]],
    // fuego y espejo (anochece)
    [146, [26, 121, 26],       [0, 113, 0]],
    [151, [13, 117, -12],      [0, 115, 0]],
    [156, [-200, 90, -300],    [0, 110, 0]],
    [161, [0, 30, -900],       [0, 100, 0]],
    // el espejo que quemaba barcos (día)
    [166, [60, 122, -60],      [0, 114, 0]],
    [171, [10, 119, 12],       [0, 100, -300]],
    [177, [200, 60, -500],     [0, 15, -700]],
    [183, [260, 130, -240],    [0, 40, -560]],
    // la firma escondida y los números
    [188, [0, 16, -72],        [0, 12, -16]],
    [193, [0, 11, -44],        [0, 12.5, -15.5]],
    [199, [-12, 12, -40],      [0, 13, -15.5]],
    [203, [250, 90, -250],     [0, 60, 0]],
    [207, [600, 300, -900],    [0, 60, 0]],
    // final: terremotos, ruinas, fortaleza
    [210, [180, 80, -180],     [0, 60, 0]],
    [215, [120, 60, -150],     [0, 50, 0]],
    [220, [80, 25, -120],      [10, 0, -40]],
    [226, [60, 7, -92],        [0, 2, -40]],
    [231, [200, 40, 200],      [0, 10, 0]],
    [236, [350, 90, -350],     [0, 30, 0]],
    [240, [700, 160, -900],    [0, 60, 0]]
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
  const factories = ['createEnvironment', 'createPharos', 'createInterior', 'createConstruction', 'createMystery', 'createHUD'];
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
    const name = opt.name || 'faro_alejandria_' + H + 'p.mp4';
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
