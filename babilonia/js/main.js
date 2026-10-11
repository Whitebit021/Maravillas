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
    timeOfDay: [[0, 0.85], [14, 0.95], [18, 1.27], [38, 1.35], [82, 1.45], [128, 1.55], [148, 1.68], [160, 1.74], [166, 1.82], [176, 1.98], [190, 2.2], [194, 2.3], [210, 2.45], [226, 2.6], [240, 2.75]],
    ghost:      [[0, 0.6], [14, 0.6], [18, 0]],                        // jardines completos fantasma (prólogo)
    boats:      [[0, 0.3], [18, 1], [146, 1], [150, 0.5], [212, 0.5], [216, 0]],
    workers:    [[38, 0], [42, 1], [146, 1], [150, 0]],
    kilns:      [[38, 0], [42, 1], [60, 1], [64, 0]],                  // hornos de ladrillo, moldes, ladrillos con sello
    bitumen:    [[46, 0], [50, 1], [60, 1], [64, 0]],                  // calderos de betún humeante
    vaults:     [[60, 0], [78, 1]],                                     // bóvedas de la primera terraza
    waterproof: [[66, 0], [78, 1]],                                     // capas: cañas+betún, ladrillo, plomo, tierra
    xray:       [[66, 0], [70, 0.8], [80, 0.8], [82, 0], [106, 0], [110, 0.8], [124, 0.8], [128, 0]],
    terraces:   [[60, 0], [78, 0.2], [104, 1]],                         // altura construida (fracción de 25 m)
    cranes:     [[60, 0], [64, 1], [104, 1], [108, 0]],                 // rampas de adobe y andamios
    pump:       [[104, 0], [110, 1]],                                   // noria de cangilones construida
    water:      [[110, 0], [116, 1]],                                   // agua subiendo: cangilones, cisterna, canales
    screw:      [[116, 0], [120, 1], [126, 1], [128, 0.3], [166, 0.3], [180, 1], [188, 1], [190, 0]], // tornillos (teoría)
    soil:       [[128, 0], [132, 1]],                                   // tierra fértil en las terrazas
    plants:     [[130, 0], [144, 1]],                                   // palmeras, cipreses, enredaderas creciendo
    cascades:   [[136, 0], [142, 1], [210, 1], [214, 0]],
    amytis:     [[151, 0], [154, 1], [162, 1], [165, 0]],              // la reina Amitis fantasma mirando al norte
    herodotus:  [[168, 0], [171, 1], [176, 1], [178, 0]],              // pergamino de Heródoto con un hueco
    map:        [[176, 0], [180, 1], [188, 1], [190, 0]],              // mapa: Babilonia → Nínive (450 km)
    measure:    [[192, 0], [195, 1], [206, 1], [209, 0]],
    decay:      [[212, 0], [222, 1]],                                   // se secan las plantas, se derrumban terrazas
    riverShift: [[214, 0], [224, 1]],                                   // el Éufrates se desplaza al oeste
    dig:        [[224, 0], [228, 1], [234, 1], [236, 0]],              // excavación de Koldewey (1899)
    today:      [[230, 0], [235, 1]]                                    // hoy: montículos de ladrillo y reconstrucción
  };

  // ---------- cámara: [t, posición, objetivo] ----------
  const CAM = [
    // prólogo: los jardines fantasma al amanecer
    [0,   [0, 15, -300],       [0, 25, 0]],
    [7,   [-200, 30, -200],    [0, 25, 0]],
    [13,  [150, 80, -150],     [0, 20, 0]],
    // Babilonia y el Éufrates
    [18,  [600, 400, -600],    [0, 0, 0]],
    [24,  [-400, 60, -200],    [-190, 0, 0]],
    [29,  [150, 60, 250],      [320, 45, 520]],
    [34,  [250, 25, -200],     [200, 12, -300]],
    // ladrillo y betún
    [38,  [60, 40, -200],      [0, 2, -140]],
    [44,  [22, 8, -165],       [5, 2, -140]],
    [50,  [-82, 10, -152],     [-60, 2, -130]],
    [55,  [-270, 30, -60],     [-190, 0, 0]],
    // bóvedas
    [60,  [120, 50, -120],     [0, 5, 0]],
    [66,  [40, 8, -78],        [0, 4, -60]],
    [72,  [10, 4.5, -68],      [0, 3, -40]],
    [77,  [-40, 20, -82],      [0, 5, -40]],
    // terrazas
    [82,  [180, 60, -180],     [0, 10, 0]],
    [88,  [100, 30, -100],     [0, 12, 0]],
    [94,  [-120, 50, -60],     [0, 18, 0]],
    [99,  [60, 45, 60],        [0, 22, 0]],
    // agua cuesta arriba (rayos X)
    [104, [-150, 30, -60],     [-60, 12, 0]],
    [110, [-92, 8, -20],       [-58, 10, 0]],
    [116, [-76, 26, -12],      [-56, 18, 0]],
    [121, [-40, 36, -82],      [0, 26, -50]],
    [125, [-32, 40, -32],      [-10, 26, 0]],
    // el jardín
    [128, [120, 60, 120],      [0, 20, 0]],
    [134, [42, 42, 42],        [0, 28, 0]],
    [139, [24, 33, -24],       [0, 28, 0]],
    [144, [82, 20, -40],       [40, 12, -30]],
    // esplendor y Amitis
    [148, [-300, 20, -100],    [0, 20, 0]],
    [154, [20, 33, 22],        [0, 33, -10]],
    [160, [200, 15, 200],      [0, 20, 0]],
    // ¿Nínive?
    [166, [0, 40, -150],       [0, 20, 0]],
    [171, [18, 42, -10],       [0, 40, -48]],
    [176, [0, 180, 250],       [0, 0, -150]],
    [182, [0, 260, 150],       [0, 0, -260]],
    [187, [150, 120, -480],    [-40, 0, -540]],
    // números
    [190, [150, 60, -150],     [0, 15, 0]],
    [196, [-120, 40, -120],    [0, 15, 0]],
    [202, [0, 120, -160],      [0, 0, 0]],
    [207, [90, 30, 90],        [0, 15, 0]],
    // final: ruina, el río se aleja, excavación, hoy
    [210, [160, 50, -160],     [0, 15, 0]],
    [216, [100, 30, -100],     [0, 10, 0]],
    [222, [-300, 80, -200],    [-200, 0, 0]],
    [228, [60, 15, -95],       [20, 2, -60]],
    [234, [150, 40, 150],      [0, 5, 0]],
    [240, [500, 150, -500],    [0, 10, 0]]
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
  const factories = ['createEnvironment', 'createGardens', 'createInterior', 'createConstruction', 'createMystery', 'createHUD'];
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
    const name = opt.name || 'jardines_babilonia_' + H + 'p.mp4';
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
