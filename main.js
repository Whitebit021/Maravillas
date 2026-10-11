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
    timeOfDay: [[0, 0.0], [16, 0.1], [24, 0.26], [40, 0.38], [84, 0.45], [110, 0.5], [134, 0.66], [142, 0.86], [154, 0.98], [162, 1.24], [176, 1.32], [196, 1.45], [216, 1.68], [226, 1.76], [245, 1.95]],
    build:      [[62, 0], [84, 0.25], [110, 0.42], [134, 0.85], [156, 0.92], [168, 1.0]],
    capstone:   [[164, 0], [172, 1]],
    beam:       [[166, 0], [169, 1], [174, 0.35], [178, 0]],
    casing:     [[176, 0], [194, 1]],
    erosion:    [[228, 0], [242, 1]],
    xray:       [[84, 0], [88, 1], [106, 1], [110, 0], [136, 0], [140, 0.8], [152, 0.8], [156, 0]],
    ramp:       [[60, 0], [64, 1], [168, 1], [176, 0]],
    workers:    [[38, 0], [42, 1], [170, 1], [176, 0]],
    quarry:     [[36, 0], [40, 1], [62, 1], [70, 0.4], [176, 0.4], [180, 0]],
    boats:      [[40, 0], [44, 1], [60, 1], [64, 0.5], [170, 0.5], [176, 0]],
    siteGrid:   [[20, 0], [24, 1], [36, 1], [40, 0]],
    compass:    [[22, 0], [26, 1], [37, 1], [40, 0]],
    orion:      [[0, 0], [4, 0.45], [16, 0.45], [20, 0], [136, 0], [141, 1], [154, 1], [158, 0], [228, 0], [236, 1]],
    ghostPyramids: [[0, 0], [142, 0], [146, 1], [245, 1]],
    shafts:     [[136, 0], [141, 1], [152, 1], [156, 0]],
    piDiagram:  [[197, 0], [201, 1], [207, 1], [209, 0]],
    golden:     [[207, 0], [211, 1], [215, 1], [217, 0]],
    energy:     [[211, 0], [214, 1], [220, 0.6], [228, 0], [238, 0], [242, 0.5]]
  };

  // ---------- cámara: [t, posición, objetivo] ----------
  const CAM = [
    [0,   [0, 18, -950],      [0, 1150, 700]],
    [9,   [120, 30, -800],    [0, 900, 600]],
    [16,  [220, 70, -600],    [0, 20, 0]],
    [21,  [320, 160, -420],   [0, 0, 0]],
    [27,  [10, 720, 60],      [0, 0, 0]],
    [34,  [360, 320, 360],    [0, 0, 0]],
    [40,  [480, 130, 620],    [0, 10, 380]],
    [45,  [90, 45, 480],      [0, -4, 390]],
    [50,  [40, 14, 430],      [0, -6, 385]],
    [56,  [620, 130, 320],    [950, 0, 200]],
    [62,  [320, 110, 320],    [0, 10, 0]],
    [67,  [190, 45, 230],     [0, 10, 0]],
    [75,  [70, 16, 165],      [0, 6, 90]],
    [84,  [-250, 85, -250],   [0, 20, 0]],
    [89,  [-170, 65, -170],   [0, 25, 0]],
    [95,  [-70, 32, -50],     [0, 22, -10]],
    [100, [-38, 40, -30],     [0, 36, 0]],
    [105, [-26, 50, 26],      [0, 46, 11]],
    [110, [-260, 120, 190],   [0, 40, 0]],
    [116, [260, 110, 160],    [0, 50, 0]],
    [122, [210, 160, -230],   [0, 60, 0]],
    [128, [-210, 200, -210],  [0, 70, 0]],
    [134, [-300, 120, 260],   [0, 60, 0]],
    [140, [-130, 62, -45],    [0, 62, 30]],
    [146, [420, 900, -620],   [-300, 0, 420]],
    [152, [260, 90, -620],    [-200, 650, 800]],
    [156, [160, 170, -160],   [0, 130, 0]],
    [161, [65, 162, -65],     [0, 140, 0]],
    [166, [32, 153, 42],      [0, 147, 0]],
    [171, [95, 178, 95],      [0, 145, 0]],
    [176, [310, 125, -310],   [0, 60, 0]],
    [182, [360, 60, -150],    [0, 60, 0]],
    [189, [390, 42, 290],     [0, 70, 0]],
    [196, [0, 32, -490],      [0, 70, 0]],
    [202, [0, 80, -530],      [0, 70, 0]],
    [210, [430, 260, -430],   [0, 50, 0]],
    [216, [520, 520, 520],    [0, 0, 0]],
    [221, [620, 160, -320],   [0, 40, 0]],
    [228, [-820, 320, -820],  [-300, 60, 420]],
    [237, [720, 95, -920],    [0, 80, 0]],
    [245, [1400, 320, -1650], [0, 200, 0]]
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
  const factories = ['createEnvironment', 'createPyramid', 'createInterior', 'createConstruction', 'createCosmic', 'createHUD'];
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
    const name = opt.name || 'piramide_giza_' + H + 'p.mp4';
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
