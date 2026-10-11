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
    timeOfDay: [[0, 0.9], [14, 0.97], [18, 1.27], [38, 1.36], [82, 1.45], [128, 1.55], [148, 1.66], [160, 1.74], [166, 1.8], [172, 1.95], [188, 2.05], [192, 2.3], [210, 2.45], [226, 2.62], [240, 2.74]],
    ghost:      [[0, 0.65], [14, 0.65], [18, 0]],                       // templo fantasma ardiendo (prólogo)
    quakeDemo:  [[29, 0], [30, 1], [34, 1], [35, 0]],                   // temblor: la marisma amortigua
    pit:        [[38, 0], [41, 1], [58, 1], [62, 0]],                   // excavación del cimiento
    layers:     [[40, 0], [56, 1]],                                      // capas: arcilla, carbón, lana, carbón, losas
    xray:       [[40, 0], [43, 0.9], [58, 0.9], [62, 0]],               // corte en sección del cimiento
    platform:   [[56, 0], [66, 1]],                                      // gradas y estilóbato
    quarry:     [[58, 0], [62, 1], [80, 1], [84, 0]],
    oxen:       [[60, 0], [63, 1], [80, 1], [84, 0]],                   // tambores rodados como rodillos por bueyes
    workers:    [[38, 0], [42, 1], [146, 1], [150, 0]],
    cranes:     [[82, 0], [86, 1], [144, 1], [148, 0]],
    columns:    [[82, 0], [104, 1]],                                     // columnas subiendo tambor a tambor
    caelatae:   [[92, 0], [100, 1]],                                     // relieves de los tambores inferiores
    sandramp:   [[106, 0], [110, 1], [124, 1], [128, 0]],               // rampa de sacos de arena
    architrave: [[108, 0], [126, 1]],                                    // arquitrabes colocados (fracción)
    dream:      [[117, 0], [119, 1], [123, 1], [125, 0]],               // Artemisa se aparece en sueños
    roof:       [[128, 0], [142, 1]],                                    // frontones, vigas y tejas
    statue:     [[138, 0], [145, 1]],                                    // naiskos y estatua de culto
    paint:      [[142, 0], [150, 1]],                                    // policromía
    pilgrims:   [[148, 0], [152, 1], [164, 1], [168, 0]],
    herostratus:[[166, 0], [169, 1], [174, 1], [176, 0]],               // Eróstrato con la antorcha
    fire:       [[170, 0], [174, 1], [184, 1], [188, 0]],               // el templo arde
    burned:     [[174, 0], [186, 1], [189, 1], [192, 0]],               // daño: techo caído, ennegrecido (luego reconstruido)
    alexander:  [[176, 0], [179, 1], [186, 1], [188, 0]],               // línea hacia Pella: nace Alejandro
    nameBan:    [[180, 0], [182, 1], [188, 1], [190, 0]],               // el nombre prohibido, tachado
    measure:    [[192, 0], [195, 1], [206, 1], [209, 0]],
    compare:    [[198, 0], [201, 1], [206, 1], [208, 0]],               // Partenón fantasma al lado
    goths:      [[212, 0], [220, 1]],                                    // saqueo godo (262 d.C.): ruina
    dismantle:  [[220, 0], [228, 1]],                                    // se llevan las piedras
    today:      [[228, 0], [232, 1]]                                     // una columna con nido de cigüeña
  };

  // ---------- cámara: [t, posición, objetivo] ----------
  const CAM = [
    // prólogo: de noche, el templo fantasma en llamas
    [0,   [-260, 12, 0],       [0, 15, 0]],
    [7,   [-200, 30, -150],    [0, 15, 0]],
    [13,  [-100, 60, 160],     [0, 10, 0]],
    // la marisma
    [18,  [-500, 200, -400],   [0, 0, 0]],
    [24,  [-150, 22, -120],    [0, 0, 0]],
    [30,  [80, 14, -80],       [0, 0, 0]],
    [35,  [200, 60, 100],      [0, 0, 0]],
    // cimientos (corte en sección)
    [38,  [-120, 60, -90],     [0, -2, 0]],
    [44,  [-50, 10, -60],      [0, -3, -20]],
    [50,  [0, 5, -62],         [0, -3, -26]],
    [55,  [60, 20, -60],       [0, -1, 0]],
    // mármol: la cantera y las ruedas de Quersifrón
    [60,  [-780, 80, -400],    [-700, 10, -500]],
    [66,  [-430, 18, -270],    [-380, 3, -220]],
    [72,  [-260, 10, -180],    [-230, 3, -150]],
    [77,  [-120, 30, -90],     [-60, 2, -30]],
    // columnas
    [82,  [-150, 40, -100],    [0, 10, 0]],
    [88,  [-78, 14, -42],      [-52, 10, -25]],
    [94,  [-64, 4, -31],       [-55, 4, -25]],
    [100, [0, 30, -72],        [0, 12, 0]],
    // la rampa de arena
    [106, [-110, 35, -60],     [-55, 18, -25]],
    [112, [-76, 22, -46],      [-55, 20, -25]],
    [118, [-98, 22, 6],        [-60, 14, -30]],
    [123, [-40, 40, -62],      [-30, 20, -25]],
    // el templo completo
    [128, [-180, 60, -120],    [0, 15, 0]],
    [134, [-100, 30, 0],       [-57, 25, 0]],
    [139, [-30, 40, 0],        [12, 10, 0]],
    [143, [2, 12, 0],          [25, 9, 0]],
    // esplendor
    [148, [-260, 20, -60],     [0, 15, 0]],
    [154, [-200, 8, 50],       [0, 18, 0]],
    [160, [150, 40, -150],     [0, 15, 0]],
    // Eróstrato (de noche)
    [166, [-92, 10, -40],      [-60, 8, 0]],
    [171, [-110, 30, -70],     [0, 15, 0]],
    [177, [150, 70, 150],      [-200, 30, -250]],
    [183, [-62, 20, -60],      [-57, 15, 0]],
    [187, [-160, 50, -160],    [0, 10, 0]],
    // números y Alejandro
    [190, [-150, 60, -150],    [0, 15, 0]],
    [196, [0, 120, -200],      [0, 0, 0]],
    [202, [200, 90, -160],     [50, 0, -50]],
    [207, [-100, 50, 100],     [0, 15, 0]],
    // final: godos, expolio, la columna solitaria
    [210, [-150, 50, -100],    [0, 15, 0]],
    [216, [-80, 25, -60],      [0, 8, 0]],
    [222, [100, 40, 100],      [0, 5, 0]],
    [228, [-42, 8, -32],       [-20, 9, -20]],
    [234, [-82, 15, -62],      [-20, 10, -20]],
    [240, [-300, 60, -250],    [0, 5, 0]]
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
  const factories = ['createEnvironment', 'createTemple', 'createInterior', 'createConstruction', 'createMystery', 'createHUD'];
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
    const name = opt.name || 'templo_artemisa_' + H + 'p.mp4';
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
