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
    timeOfDay: [[0, 0.2], [18, 0.3], [38, 0.36], [60, 0.42], [104, 0.5], [146, 0.62], [166, 0.7], [188, 0.74], [210, 0.78], [218, 0.9], [224, 1.25], [240, 1.4]],
    temple:     [[0, 1], [17, 1], [18, 0], [38, 0], [58, 1]],          // templo construido (fracción)
    cutaway:    [[0, 1], [14, 1], [18, 0], [80, 0], [82, 1], [160, 1], [162, 0], [186, 0], [188, 1], [214, 1], [220, 0]], // tejado y muro sur translúcidos
    games:      [[18, 0], [22, 1], [36, 1], [40, 0]],                  // atletas y público en el estadio
    workers:    [[38, 0], [42, 1], [140, 1], [144, 0]],
    workshop:   [[58, 0], [62, 1], [126, 1], [130, 0]],                // actividad en el taller de Fidias
    cup:        [[70, 0], [72, 1], [78, 1], [80, 0]],                  // la taza "Pertenezco a Fidias"
    core:       [[82, 0], [100, 1]],                                    // núcleo de madera subiendo
    scaffold:   [[82, 0], [84, 1], [140, 1], [144, 0]],                // andamios dentro de la cella
    xray:       [[100, 0], [104, 0.7], [112, 0.7], [116, 0], [188, 0], [192, 0.7], [200, 0.7], [204, 0]],
    ivory:      [[104, 0], [120, 1]],                                   // placas de marfil (piel)
    gold:       [[108, 0], [124, 1]],                                   // láminas de oro (manto, sandalias, pelo)
    throne:     [[124, 0], [136, 1]],                                   // trono decorado (ébano, oro, gemas)
    attributes: [[130, 0], [140, 1]],                                   // Nike en la mano derecha, cetro con águila
    shine:      [[146, 0], [152, 1], [210, 1], [212, 0]],              // brillo del oro y el marfil
    standup:    [[154, 0], [157, 1], [161, 1], [163, 0]],              // fantasma de Zeus de pie atravesando el techo
    pilgrims:   [[146, 0], [150, 1], [186, 1], [190, 0]],              // peregrinos y lámparas
    oil:        [[164, 0], [170, 1], [212, 1], [214, 0]],              // estanque de aceite lleno
    caligula:   [[176, 0], [178, 1], [183, 1], [185, 0]],              // andamio de Calígula que se derrumba
    measure:    [[190, 0], [193, 1], [206, 1], [209, 0]],
    fire:       [[212, 0], [214, 1], [218, 1], [220, 0]],              // incendio (Constantinopla, 475)
    burn:       [[213, 0], [219, 1]],                                   // la estatua se consume y desaparece
    quake:      [[220, 0], [221, 1], [224, 1], [225, 0]],
    ruin:       [[221, 0], [226, 1]],                                   // el templo se derrumba (columnas en hilera)
    silt:       [[226, 0], [232, 1]],                                   // el limo del río lo entierra
    today:      [[232, 0], [236, 1]]                                    // hoy: ruinas excavadas, una columna en pie
  };

  // ---------- cámara: [t, posición, objetivo] ----------
  const CAM = [
    // prólogo: el templo en corte, la estatua dentro
    [0,   [110, 8, 30],        [0, 10, 0]],
    [7,   [60, 14, 40],        [-14, 9, 0]],
    [13,  [22, 11, 12],        [-14, 10, 0]],
    // Olimpia
    [18,  [500, 250, 500],     [0, 0, 0]],
    [24,  [250, 90, -300],     [0, 0, 0]],
    [29,  [140, 22, -60],      [215, 3, -128]],
    [34,  [120, 20, -80],      [0, 8, 0]],
    // el templo
    [38,  [140, 60, 120],      [0, 8, 0]],
    [44,  [70, 20, 60],        [0, 8, 0]],
    [50,  [-80, 30, -60],      [0, 10, 0]],
    [55,  [60, 40, -70],       [0, 14, 0]],
    // el taller de Fidias
    [60,  [-60, 40, -60],      [-95, 7, 6]],
    [66,  [-76, 9, -16],       [-95, 5, 6]],
    [72,  [-86, 5, -4],        [-96, 3.6, 4]],
    [77,  [-91, 3.2, -1],      [-96, 3.4, 4]],
    // núcleo de madera
    [82,  [10, 30, 30],        [-14, 7, 0]],
    [88,  [4, 5, 2.5],         [-14, 7, 0]],
    [94,  [-4, 11, 2.5],       [-14, 10, 0]],
    [99,  [-5, 4, -2.5],        [-14, 6, 0]],
    // marfil y oro
    [104, [0, 8, 2.5],         [-14, 8, 0]],
    [110, [-7, 12, 2],         [-14.5, 13, 0]],
    [116, [-5, 5, -2.5],        [-12, 7.5, 0]],
    [121, [-83, 6, -8],        [-95, 3, 6]],
    // el trono, Nike y el cetro
    [126, [2, 6, -2.5],         [-14, 6, 0]],
    [131, [-7, 10, 3],         [-11.6, 10, 2.2]],
    [136, [-8, 13, -3],        [-13.5, 14, -2.6]],
    [141, [0, 9, 0],           [-14, 10, 0]],
    // esplendor
    [146, [8, 4, 0],           [-14, 10, 0]],
    [152, [-4, 12, 3],         [-14, 11, 0]],
    [158, [30, 25, 40],        [-14, 9, 0]],
    [162, [150, 30, 60],       [0, 10, 0]],
    // el estanque de aceite y Calígula
    [166, [-2, 3, -3],         [-6, 1.6, 0]],
    [172, [-4, 6, 2.5],         [-14, 9, 0]],
    [178, [0, 4.5, 0],         [-14, 8, 0]],
    [183, [6, 9, -2.5],         [-14, 7, 0]],
    // números
    [188, [25, 30, 35],        [-14, 8, 0]],
    [194, [2, 7, -3],          [-14, 8, 0]],
    [200, [60, 40, 60],        [-14, 8, 0]],
    [205, [-4, 13, -3],        [-14, 12, 0]],
    // final: fuego, terremoto, limo, hoy
    [210, [60, 25, 50],        [-14, 8, 0]],
    [215, [2, 8, 2.5],          [-14, 9, 0]],
    [221, [80, 30, 60],        [0, 8, 0]],
    [227, [60, 12, -40],       [0, 3, 0]],
    [233, [-40, 8, -30],       [0, 4, 0]],
    [240, [300, 90, 250],      [0, 5, 0]]
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
  const factories = ['createEnvironment', 'createStatue', 'createInterior', 'createConstruction', 'createMystery', 'createHUD'];
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
    const name = opt.name || 'estatua_zeus_' + H + 'p.mp4';
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
