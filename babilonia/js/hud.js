// HUD: portada, rótulos de capítulo, subtítulos, voz (speechSynthesis), audio generativo (WebAudio),
// panel de datos, controles, efectos de cine y final (Babilonia: modo hijaz, agua y horno de ladrillo). Todo por DOM + CSS inyectado. Sin recursos externos.
(function () {
  'use strict';
  const G = window.GIZA;

  const CSS = `
#hud{--bar:clamp(30px,7vh,70px);position:fixed;inset:0;z-index:10;pointer-events:none;font-family:Georgia,'Times New Roman',serif;color:#f2e6cf;overflow:hidden;user-select:none;-webkit-user-select:none}
#hud *{box-sizing:border-box}
#hud button{pointer-events:auto;cursor:pointer;font-family:inherit}
#hud .grain{position:absolute;inset:0;width:100%;height:100%;z-index:1;opacity:.025;mix-blend-mode:overlay;pointer-events:none}
#hud .vig{position:absolute;inset:0;z-index:2;pointer-events:none;background:radial-gradient(ellipse at center,rgba(0,0,0,0) 62%,rgba(0,0,0,.38) 100%)}
#hud .lb{position:absolute;left:0;right:0;height:var(--bar);background:#000;pointer-events:none;z-index:3}
#hud .lb-top{top:0;background:linear-gradient(#000 75%,rgba(0,0,0,.55))}
#hud .lb-bot{bottom:0;background:linear-gradient(rgba(0,0,0,.55),#000 25%)}
#hud .panel{position:absolute;top:14px;right:18px;z-index:4;min-width:min(221px,40vw);padding:6px 10px;font-family:Consolas,'Courier New',monospace;font-size:clamp(9.5px,1.15vw,12.75px);line-height:1.5;color:#d4a63c;text-shadow:0 0 6px rgba(212,166,60,.55);background:rgba(0,0,0,.45);border:1px solid rgba(212,166,60,.35);letter-spacing:.04em;transition:opacity .6s ease;pointer-events:none}
#hud .cover .keys{margin-top:14px;font-family:Consolas,'Courier New',monospace;font-size:13px;color:#9b8d6a;letter-spacing:.06em}
#hud .cover .foot{position:absolute;left:0;right:0;bottom:calc(var(--bar) + 10px);font-family:Georgia,'Times New Roman',serif;font-size:12px;color:#7d776b;letter-spacing:.03em}
#hud .panel .hd{color:#f0d28a;letter-spacing:.18em;font-size:.8em;border-bottom:1px dashed rgba(212,166,60,.4);margin-bottom:4px;padding-bottom:3px}
#hud .panel .r{display:flex;justify-content:space-between;gap:14px;white-space:nowrap}
#hud .panel .r span:last-child{color:#f3dca0}
#hud .facts{position:absolute;left:3vw;top:30%;z-index:4;width:min(320px,40vw);display:flex;flex-direction:column;gap:12px;pointer-events:none}
#hud .fact{font-size:clamp(13px,1.45vw,17px);line-height:1.4;color:#f3ead2;padding:7px 12px 7px 14px;border-left:2px solid #b98a45;background:linear-gradient(90deg,rgba(0,0,0,.72),rgba(0,0,0,0));text-shadow:0 2px 4px #000;animation:mHudIn .7s ease both}
@keyframes mHudIn{from{opacity:0;transform:translateX(-14px)}to{opacity:1;transform:none}}
#hud .ch{position:absolute;left:50%;top:40%;transform:translate(-50%,-50%);z-index:4;opacity:0;white-space:nowrap;text-shadow:0 2px 16px #000;pointer-events:none}
#hud .chrow{display:flex;align-items:center;gap:clamp(14px,2.4vw,34px)}
#hud .hg{width:clamp(30px,3.6vw,50px);height:auto;opacity:.85;filter:drop-shadow(0 0 6px rgba(185,138,69,.5))}
#hud .cbody{text-align:center}
#hud .ch .n{font-family:Consolas,'Courier New',monospace;font-size:clamp(10px,1.1vw,13px);letter-spacing:.5em;color:#b98a45}
#hud .ch .t{margin-top:6px;font-family:Georgia,'Times New Roman',serif;font-size:clamp(28px,5vw,68px);font-weight:normal;letter-spacing:.04em;color:#d4a63c}
#hud .ch .rule{height:2px;width:0;margin:10px auto 0;background:linear-gradient(90deg,transparent,#d4a63c,transparent)}
#hud .ch.cocido .t{color:#f2e6cf;text-shadow:0 0 4px #000,0 0 14px #000,0 0 28px rgba(0,0,0,.9),0 2px 16px #000}
#hud .ch.cocido .n{color:#e0b257;text-shadow:0 0 6px #000,0 0 12px #000}
#hud .ch.cocido{padding:22px 48px;background:radial-gradient(ellipse at center,rgba(36,18,8,.78),rgba(0,0,0,.45) 55%,rgba(0,0,0,0) 74%)}
#hud .ch.cocido .rule{background:linear-gradient(90deg,transparent,#b8794a,transparent)}
#hud .ch.duda .n{color:#ff3b30;text-shadow:0 0 8px rgba(255,59,48,.7),0 0 14px #000}
#hud .ch.duda .t{color:#ffb4a8;text-shadow:0 0 10px rgba(255,59,48,.55),0 2px 16px #000}
#hud .ch.duda .rule{background:linear-gradient(90deg,transparent,#ff3b30,transparent)}
#hud .ch.duda{padding:22px 48px;background:radial-gradient(ellipse at center,rgba(40,4,2,.8),rgba(0,0,0,.45) 55%,rgba(0,0,0,0) 74%)}
#hud .ch.azul .n{color:#6f9ee0;text-shadow:0 0 8px rgba(31,79,160,.9),0 0 14px #000}
#hud .ch.azul .t{color:#cfe0ff;text-shadow:0 0 10px rgba(31,79,160,.85),0 2px 16px #000}
#hud .ch.azul .rule{background:linear-gradient(90deg,transparent,#1f4fa0,transparent)}
#hud .ch.azul{padding:22px 48px;background:radial-gradient(ellipse at center,rgba(4,10,30,.8),rgba(0,0,0,.45) 55%,rgba(0,0,0,0) 74%)}
#hud .ch.verde .n{color:#8fc46a;text-shadow:0 0 8px rgba(63,122,50,.9),0 0 14px #000}
#hud .ch.verde .t{color:#d7efb0;text-shadow:0 0 10px rgba(63,122,50,.85),0 2px 16px #000}
#hud .ch.verde .rule{background:linear-gradient(90deg,transparent,#3f7a32,transparent)}
#hud .ch.verde{padding:22px 48px;background:radial-gradient(ellipse at center,rgba(8,20,4,.8),rgba(0,0,0,.45) 55%,rgba(0,0,0,0) 74%)}
#hud .sub{position:absolute;left:50%;bottom:calc(var(--bar) + 16px);transform:translateX(-50%);z-index:4;width:min(900px,90vw);padding:12px 20px;text-align:center;font-size:clamp(17px,2.1vw,27px);line-height:1.35;color:#f5efe0;text-shadow:0 2px 4px #000,0 0 12px #000;background:radial-gradient(ellipse at center,rgba(0,0,0,.62),rgba(0,0,0,0) 72%);opacity:0;transition:opacity .45s ease;pointer-events:none}
#hud .sub.on{opacity:1}
#hud .sub.mid{font-size:1.12em}
#hud .sub.big{color:#d4a63c;font-size:1.32em;font-weight:bold;text-shadow:0 0 16px rgba(212,166,60,.45),0 2px 4px #000}
#hud .sub .em{color:#d4a63c;font-weight:bold}
#hud .scan{position:absolute;inset:0;z-index:5;pointer-events:none;opacity:0;background:repeating-linear-gradient(to bottom,rgba(242,230,207,.16) 0 2px,rgba(0,0,0,0) 2px 6px);mix-blend-mode:screen;animation:mScanY .6s linear infinite}
#hud .scan::after{content:'';position:absolute;left:0;right:0;height:8%;top:0;background:linear-gradient(transparent,rgba(242,230,207,.28),transparent);animation:mSweep .6s linear infinite}
@keyframes mScanY{from{background-position:0 0}to{background-position:0 24px}}
@keyframes mSweep{from{top:-10%}to{top:110%}}
#hud .note{position:absolute;top:calc(var(--bar) + 10px);left:3vw;z-index:6;font-family:Consolas,'Courier New',monospace;font-size:12px;color:#b98a45;background:rgba(0,0,0,.6);padding:4px 8px;border:1px solid rgba(185,138,69,.3);opacity:0;transition:opacity .4s;pointer-events:none}
#hud .note.on{opacity:1}
#hud .ctrl{position:absolute;left:0;right:0;bottom:0;height:var(--bar);z-index:6;display:flex;align-items:center;gap:10px;padding:0 3vw;transition:opacity .5s ease;pointer-events:none}
#hud .ctrl.off{opacity:0}
#hud .ctrl.off *{pointer-events:none!important}
#hud .ctrl.on{opacity:1}
#hud .ctrl.on .bar{pointer-events:auto}
#hud .btn{padding:5px 10px;min-width:38px;font-family:Consolas,'Courier New',monospace;font-size:13px;letter-spacing:.06em;color:#d4a63c;background:rgba(0,0,0,.6);border:1px solid rgba(212,166,60,.5)}
#hud .btn:hover{background:rgba(212,166,60,.16)}
#hud .time{font-family:Consolas,'Courier New',monospace;font-size:13px;color:#f0d9a0;white-space:nowrap;text-shadow:0 1px 3px #000}
#hud .bar{position:relative;flex:1;height:22px;cursor:pointer;touch-action:none}
#hud .track{position:absolute;left:0;right:0;top:9px;height:4px;background:rgba(255,255,255,.2)}
#hud .fill{position:absolute;left:0;top:9px;height:4px;width:0;background:linear-gradient(90deg,#6b7a3a,#d4a63c)}
#hud .tick{position:absolute;top:0;width:9px;height:22px;margin-left:-4px;cursor:pointer}
#hud .tick::after{content:'';position:absolute;left:4px;top:4px;width:1px;height:14px;background:rgba(255,230,160,.7)}
#hud .tip{position:absolute;bottom:28px;transform:translateX(-50%);white-space:nowrap;font-family:Consolas,'Courier New',monospace;font-size:12px;color:#f0d9a0;background:rgba(0,0,0,.85);border:1px solid rgba(212,166,60,.4);padding:3px 8px;opacity:0;transition:opacity .15s;pointer-events:none}
#hud .tip.on{opacity:1}
#hud .head{position:absolute;top:4px;width:14px;height:14px;margin-left:-7px;border-radius:50%;background:#d4a63c;box-shadow:0 0 8px #d4a63c;left:0}
#hud .fade{position:absolute;inset:0;z-index:7;background:#000;opacity:0;pointer-events:none}
#hud .endtxt{position:absolute;left:50%;top:42%;transform:translate(-50%,-50%);z-index:8;text-align:center;opacity:0;white-space:nowrap;pointer-events:none}
#hud .endtxt h2{margin:0;font-weight:normal;font-size:clamp(34px,6vw,84px);letter-spacing:.08em;color:#d4a63c;text-shadow:0 0 24px rgba(212,166,60,.35),0 2px 12px #000}
#hud .endtxt p{text-shadow:0 0 6px #000,0 2px 10px #000;margin:14px 0 0;font-family:Consolas,'Courier New',monospace;font-size:clamp(11px,1.3vw,14px);letter-spacing:.12em;color:#9b8d6a}
#hud .again{position:absolute;left:50%;top:62%;transform:translate(-50%,-50%);z-index:9;padding:12px 26px;font-size:18px;letter-spacing:.14em;color:#d4a63c;background:rgba(0,0,0,.4);border:1px solid #d4a63c;opacity:0;pointer-events:none;transition:opacity .6s ease}
#hud .again.on{opacity:1;pointer-events:auto}
#hud .again:hover{background:rgba(212,166,60,.15)}
#hud .cover{position:absolute;inset:0;z-index:20;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:16px 16px calc(var(--bar) + 40px);text-align:center;background:#000;pointer-events:auto;transition:opacity 1.2s ease}
#hud .cover.gone{opacity:0;pointer-events:none}
#hud .cover svg{width:min(20vw,150px);height:auto;margin-bottom:12px;filter:drop-shadow(0 0 14px rgba(224,178,87,.25))}
#hud .cover h1{margin:0;font-weight:normal;font-size:clamp(24px,4.6vw,60px);line-height:1.15;letter-spacing:.1em;color:#e0b257;text-shadow:0 0 22px rgba(224,178,87,.25)}
#hud .cover .sub2{margin-top:10px;font-style:italic;font-size:clamp(14px,1.8vw,20px);color:#cdbd93;letter-spacing:.05em}
#hud .cover .play{margin-top:24px;padding:14px 46px;font-family:Georgia,'Times New Roman',serif;font-size:clamp(16px,2vw,24px);letter-spacing:.2em;color:#120a00;background:linear-gradient(#e0b257,#b8794a);border:0;box-shadow:0 0 30px rgba(224,178,87,.35)}
#hud .cover .play:hover{filter:brightness(1.08)}
#hud .cover label{margin-top:14px;font-family:Consolas,'Courier New',monospace;font-size:14px;color:#cdbd93;cursor:pointer}
#hud .cover input{accent-color:#b98a45;margin-right:6px;vertical-align:middle;width:16px;height:16px}
@media (max-width:600px){#hud .panel{font-size:10px;right:8px;top:8px}#hud .facts{width:52vw}#hud .ctrl .time{display:none}#hud .hg{display:none}}
`;

  const MASTER_VOL = 0.25;                      // volumen maestro base
  const DUCK_VOL = 0.07;                        // volumen maestro mientras habla la voz
  // modo hijaz (mesopotámico): RE-MI♭-FA♯-SOL-LA-SI♭-DO, octava central
  const PAD_FREQS = [146.83, 155.56, 185.00, 196.00, 220.00, 233.08, 261.63, 293.66];
  const PAD_PICK = [0, 0, 0, 3, 3, 4, 1, 2, 5, 6, 7, 0];
  const CHOIR = [146.83, 220.00, 311.13, 392.00]; // coro de Amitis: RE-LA-MI♭-SOL (quinta, tercera menor del hijaz)
  const BRIGHT = [293.66, 369.99, 440.00, 587.33, 739.99]; // RE mayor: acorde brillante cuando los jardines están completos
  // glifos decorativos: león de Ishtar estilizado (izquierda) y palmera datilera (derecha)
  const GLYPH_LEON = '<svg class="hg" viewBox="0 0 60 60" aria-hidden="true">' +
    '<circle cx="16" cy="24" r="11" fill="#b8794a" fill-opacity=".35" stroke="#e0b257" stroke-width="1.2"/>' +
    '<path d="M22 28 Q34 21 48 28 L52 32 Q50 37 45 36 L44 41 L44 50 L40 50 L40 41 L28 41 L28 50 L24 50 L24 38 Q20 36 22 28 Z" fill="#e0b257" fill-opacity=".9"/>' +
    '<path d="M50 30 Q58 26 56 18" fill="none" stroke="#e0b257" stroke-width="2" stroke-linecap="round"/>' +
    '<circle cx="16" cy="24" r="6" fill="#e0b257"/><circle cx="12" cy="23" r="1" fill="#1d1814"/>' +
    '<path d="M4 54 L56 54" stroke="#1f4fa0" stroke-width="2" stroke-linecap="round" opacity=".9"/></svg>';
  let PALMA_FRONDS = '';
  [-70, -40, -10, 20, 50, 80].forEach(function (a) {
    PALMA_FRONDS += '<path transform="rotate(' + a + ' 34 20)" d="M34 20 Q44 12 54 18" fill="none" stroke="#3f7a32" stroke-width="2.6" stroke-linecap="round"/>';
  });
  const GLYPH_PALMA = '<svg class="hg" viewBox="0 0 60 60" aria-hidden="true">' +
    '<path d="M30 56 Q26 36 34 22" fill="none" stroke="#b8794a" stroke-width="3" stroke-linecap="round"/>' +
    PALMA_FRONDS +
    '<circle cx="34" cy="21" r="2" fill="#e0b257"/><circle cx="31" cy="24" r="1.6" fill="#e0b257"/></svg>';
  // terrazas escalonadas (ziggurat de los jardines) con verdor en cada nivel, para la portada
  let TERRAZAS_SVG = '';
  const TIERS = [[40, 176, 120, 20], [52, 156, 96, 20], [64, 136, 72, 20], [76, 116, 48, 20], [88, 96, 24, 20]];
  TIERS.forEach(function (r, i) {
    TERRAZAS_SVG += '<rect x="' + r[0] + '" y="' + (r[1] - r[3]) + '" width="' + r[2] + '" height="' + r[3] + '" fill="#3f7a32" fill-opacity="' + (0.25 + i * 0.08).toFixed(2) + '" stroke="#e0b257" stroke-width="1.6"/>';
    for (let k = 0; k < 4; k++) {
      const x = r[0] + 10 + k * ((r[2] - 20) / 3);
      TERRAZAS_SVG += '<path d="M' + x.toFixed(1) + ' ' + (r[1] - 2) + ' Q' + (x + 3).toFixed(1) + ' ' + (r[1] - 10) + ' ' + (x + 6).toFixed(1) + ' ' + (r[1] - 2) + '" fill="none" stroke="#6aa84f" stroke-width="1.6" stroke-linecap="round"/>';
    }
  });
  TERRAZAS_SVG += '<circle cx="100" cy="84" r="3" fill="#1f4fa0" stroke="#e0b257" stroke-width="1"/>';
  const GLITCH_FRAMES = [
    { textShadow: '0 0 14px rgba(224,178,87,.9)', color: '#fff6d0' },
    { textShadow: '-3px 0 #e0b257, 3px 0 #e0b257', color: '#e0b257' },
    { textShadow: '2px 0 #e0b257, -2px 0 #e0b257', color: '#e0b257' },
    { textShadow: '-1px 0 #e0b257, 1px 0 #e0b257', color: '#e0b257' },
    { textShadow: '0 0 16px rgba(212,166,60,.45), 0 2px 4px #000', color: '#d4a63c' }
  ];
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function ramp(t, a, b) { return clamp((t - a) / (b - a), 0, 1); }
  function fmtTime(sec) {
    sec = Math.max(0, Math.floor(sec));
    const m = Math.floor(sec / 60), s = sec % 60;
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }
  function mk(tag, cls, txt) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }
  function setTxt(e, v) { if (e._v !== v) { e._v = v; e.textContent = v; } }
  function setOp(e, v) { v = Math.round(v * 100) / 100; if (e._o !== v) { e._o = v; e.style.opacity = String(v); } }
  function setDisp(e, on) { if (e._d !== on) { e._d = on; e.style.display = on ? '' : 'none'; } }
  function nowS() { return performance.now() / 1000; }
  // GIZA.SCRIPT puede no existir o estar vacío: se lee de forma perezosa y tolerante
  function getLines() { const S = G.SCRIPT; return S && Array.isArray(S.lines) ? S.lines : []; }
  function getFacts(id) { const S = G.SCRIPT; const f = S && S.facts && S.facts[id]; return Array.isArray(f) ? f : []; }
  // fecha que muestra el panel: época de la obra (c. 600 a.C.), la visita de Heródoto (c. 430 a.C.),
  // la excavación de Koldewey (1899) y HOY al final
  function fechaAt(t) {
    if (t < 18) return '—';
    if (t < 166) return 'c. 600 a.C.';
    if (t < 190) return 'c. 430 a.C. Heródoto';
    if (t < 224) return 'c. 600 a.C.';
    if (t < 234) return '1899 Koldewey';
    return 'HOY';
  }
  // número con separador de miles a la española (8.000)
  function miles(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }

  G.createHUD = function (ctx) {
    const timeline = ctx.timeline;
    const DUR = G.DURATION || timeline.duration || 245;
    const CHAPTERS = G.CHAPTERS || [];
    const idxOf = function (id) { for (let i = 0; i < CHAPTERS.length; i++) if (CHAPTERS[i].id === id) return i; return -1; };
    const ID_INTERIOR = ['boveda', 'agua'];  // dentro de la estructura (bóvedas y pozo de la noria): filtro del dron y eco de sala
    const ID_VERDE = 'jardin', ID_AZUL = 'final', ID_DUDA = 'ninive', ID_COCIDO = 'numeros';  // rótulos propios (jardin: verde; final: azul de Ishtar; ninive: rojo duda; numeros: ladrillo y oro)
    const ID_SCAN = ['ninive', 'final'];    // inicios con interferencia (duda y epílogo)

    // ---------- CSS y contenedor ----------
    if (!document.getElementById('babilonia-hud-css')) {
      const st = mk('style'); st.id = 'babilonia-hud-css'; st.textContent = CSS;
      document.head.appendChild(st);
    }
    let root = document.getElementById('hud');
    if (!root) { root = mk('div'); root.id = 'hud'; document.body.appendChild(root); }
    root.textContent = '';

    // ---------- estado de interfaz ----------
    let coverUp = true, voiceOn = true, dragging = false, ctrlOn = null, lastAct = nowS();
    let shownChapter = -1, prevChapter = -1, curLine = -1, prevT = 0;
    let chAnim = null, ruleAnim = null, factsSig = '', factEls = [], noteTimer = null, bannerEnd = 0;
    let droneFilt = null, roomSendG = null, choirBus = null, camState = false;
    let prevPlants = 0;
    let fireKickT = -99;

    // ---------- capas visuales ----------
    const grain = mk('canvas', 'grain');
    grain.width = 160; grain.height = 90;
    const gctx = grain.getContext('2d');
    const gimg = gctx ? gctx.createImageData(160, 90) : null;
    const g32 = gimg ? new Uint32Array(gimg.data.buffer) : null;
    function grainTick() {
      if (!gctx) return;
      for (let i = 0; i < g32.length; i++) {
        const v = (Math.random() * 255) | 0;
        g32[i] = 0xff000000 | (v << 16) | (v << 8) | v;
      }
      gctx.putImageData(gimg, 0, 0);
    }
    if (gctx) { grainTick(); setInterval(grainTick, 80); }

    const vig = mk('div', 'vig');
    const lbTop = mk('div', 'lb lb-top');
    const lbBot = mk('div', 'lb lb-bot');
    const scanEl = mk('div', 'scan');

    // ---------- portada ----------
    const cover = mk('div', 'cover');
    cover.innerHTML =
      '<svg viewBox="0 0 200 200" aria-hidden="true"><defs><linearGradient id="mHudGold" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="#f2e6cf"/><stop offset="1" stop-color="#b98a45"/></linearGradient></defs>' +
      '<g stroke-linejoin="round">' + TERRAZAS_SVG + '</g>' +
      '<path d="M22 180 L178 180" stroke="#1f4fa0" stroke-width="3" stroke-linecap="round" fill="none"/>' +
      '<line x1="24" y1="192" x2="176" y2="192" stroke="#3f7a32" stroke-width="4" stroke-linecap="round"/></svg>' +
      '<h1>LOS JARDINES COLGANTES DE BABILONIA</h1>' +
      '<div class="sub2">Lo que no te contaron</div>' +
      '<button class="play" type="button">▶ REPRODUCIR</button>' +
      '<label><input type="checkbox" checked> Voz narrada</label>' +
      '<div class="keys">Espacio: pausa · ←/→: ±5 s</div>' +
      '<div class="foot">Docuficción · Teorías alternativas presentadas como entretenimiento</div>';
    const coverPlay = cover.querySelector('.play');
    const coverVoice = cover.querySelector('input');

    // ---------- datos (panel terminal) ----------
    const panel = mk('div', 'panel');
    panel.appendChild(mk('div', 'hd', 'SISTEMA DE DATOS · BABILONIA'));
    function dataRow(label, initial) {
      const r = mk('div', 'r');
      const v = mk('span', null, initial);
      r.append(mk('span', null, label), v);
      panel.appendChild(r);
      return { row: r, val: v };
    }
    const rAlt = dataRow('ALTURA:', '0,0 m');
    const rTer = dataRow('TERRAZAS:', '0,0 de 5');
    const rAgua = dataRow('AGUA:', '0 L/h');
    const rVeg = dataRow('VEGETACIÓN:', '0 %');
    const rDate = dataRow('FECHA:', '—');

    // ---------- fichas, rótulo de capítulo, subtítulos ----------
    const factsEl = mk('div', 'facts');
    const chEl = mk('div', 'ch');
    const chRow = mk('div', 'chrow');
    const chBody = mk('div', 'cbody');
    chRow.innerHTML = GLYPH_LEON;
    const chNum = mk('div', 'n');
    const chTitle = mk('div', 't');
    const chRule = mk('div', 'rule');
    chBody.append(chNum, chTitle, chRule);
    chRow.appendChild(chBody);
    chRow.insertAdjacentHTML('beforeend', GLYPH_PALMA);
    chEl.appendChild(chRow);
    const subEl = mk('div', 'sub');
    const noteEl = mk('div', 'note');

    // ---------- controles ----------
    const ctrl = mk('div', 'ctrl off');
    const btnPlay = mk('button', 'btn', '▶');
    btnPlay.type = 'button';
    const btnVoice = mk('button', 'btn', 'VOZ ON');
    btnVoice.type = 'button';
    const bar = mk('div', 'bar');
    const track = mk('div', 'track');
    const fill = mk('div', 'fill');
    const head = mk('div', 'head');
    const tip = mk('div', 'tip');
    bar.append(track, fill, head);
    CHAPTERS.forEach(function (c, i) {
      if (i === 0) return;
      const tk = mk('div', 'tick');
      tk.style.left = (c.start / DUR * 100).toFixed(3) + '%';
      tk.addEventListener('pointerenter', function () {
        tip.textContent = c.title;
        tip.style.left = tk.style.left;
        tip.classList.add('on');
      });
      tk.addEventListener('pointerleave', function () { tip.classList.remove('on'); });
      bar.appendChild(tk);
    });
    bar.appendChild(tip);
    const timeEl = mk('div', 'time', '00:00 / ' + fmtTime(DUR));
    const btnFull = mk('button', 'btn', '⛶');
    btnFull.type = 'button';
    ctrl.append(btnPlay, btnVoice, bar, timeEl, btnFull);

    // ---------- cine: fundido final, texto y botón ----------
    const fadeEl = mk('div', 'fade');
    const endEl = mk('div', 'endtxt');
    endEl.innerHTML = '<h2>¿EXISTIERON?</h2><p>Hecho 100% con código · Three.js</p>';
    const againBtn = mk('button', 'again', '↺ Volver a ver');
    againBtn.type = 'button';

    root.append(grain, vig, lbTop, lbBot, factsEl, panel, chEl, subEl, scanEl, noteEl, fadeEl, endEl, againBtn, ctrl, cover);

    function showNote(msg) {
      noteEl.textContent = msg;
      noteEl.classList.add('on');
      clearTimeout(noteTimer);
      noteTimer = setTimeout(function () { noteEl.classList.remove('on'); }, 6000);
    }

    // ---------- pantalla completa ----------
    function toggleFullscreen() {
      try {
        let p = null;
        if (!document.fullscreenElement) {
          if (document.documentElement.requestFullscreen) p = document.documentElement.requestFullscreen();
        } else if (document.exitFullscreen) {
          p = document.exitFullscreen();
        }
        if (p && p.catch) p.catch(function () {});
      } catch (e) { /* sin permiso o no soportado */ }
    }

    // ---------- audio WebAudio (todo sintetizado) ----------
    let AC = null, master = null, drumBus = null, padBus = null, noiseBuf = null, padTimer = null;
    let fireBus = null, waterBus = null;

    function makeNoise(c, sec) {
      const n = Math.floor(c.sampleRate * sec);
      const b = c.createBuffer(1, n, c.sampleRate);
      const d = b.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      return b;
    }
    function makeIR(c, sec, decay) {
      const n = Math.floor(c.sampleRate * sec);
      const b = c.createBuffer(2, n, c.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const d = b.getChannelData(ch);
        for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay);
      }
      return b;
    }

    function buildAudio() {
      const c = AC;
      master = c.createGain();
      master.gain.value = MASTER_VOL;
      const comp = c.createDynamicsCompressor();
      comp.threshold.value = -20; comp.knee.value = 20; comp.ratio.value = 4;
      comp.attack.value = 0.01; comp.release.value = 0.3;
      master.connect(comp); comp.connect(c.destination);

      noiseBuf = makeNoise(c, 4);

      // dron grave: osciladores con detune + paso bajo con LFO
      const droneBus = c.createGain(); droneBus.gain.value = 0.35;
      const droneLP = c.createBiquadFilter();
      droneLP.type = 'lowpass'; droneLP.frequency.value = 150; droneLP.Q.value = 3;
      droneBus.connect(droneLP); droneLP.connect(master);
      droneFilt = droneLP;
      const lfo = c.createOscillator(); lfo.frequency.value = 0.05;
      const lfoAmt = c.createGain(); lfoAmt.gain.value = 45;
      lfo.connect(lfoAmt); lfoAmt.connect(droneLP.frequency); lfo.start();
      // [frecuencia, detune cents, tipo, ganancia]: D1, D1 desafinado, A1, D2 (tónica del modo hijaz)
      [[36.71, 0, 'sine', 1.0], [36.71, 8, 'sawtooth', 0.12], [55.00, -5, 'sine', 0.45], [73.42, 6, 'sine', 0.18]]
        .forEach(function (d) {
          const o = c.createOscillator();
          o.type = d[2]; o.frequency.value = d[0]; o.detune.value = d[1];
          const g = c.createGain(); g.gain.value = d[3];
          o.connect(g); g.connect(droneBus); o.start();
        });

      // eco de interior (capítulo de la cámara): retardo con realimentación + convolución generada
      roomSendG = c.createGain(); roomSendG.gain.value = 0;
      const roomDelay = c.createDelay(1.0); roomDelay.delayTime.value = 0.37;
      const roomFb = c.createGain(); roomFb.gain.value = 0.4;
      roomDelay.connect(roomFb); roomFb.connect(roomDelay);
      const roomConv = c.createConvolver(); roomConv.buffer = makeIR(c, 1.8, 3);
      const roomOut = c.createGain(); roomOut.gain.value = 0.9;
      droneLP.connect(roomSendG);
      roomSendG.connect(roomDelay); roomDelay.connect(roomConv);
      roomSendG.connect(roomConv); roomConv.connect(roomOut); roomOut.connect(master);

      // pad con reverb generada por código
      const verb = c.createConvolver(); verb.buffer = makeIR(c, 3.5, 2.8);
      const verbOut = c.createGain(); verbOut.gain.value = 0.7;
      verb.connect(verbOut); verbOut.connect(master);
      padBus = c.createGain(); padBus.gain.value = 0.12;
      const padLP = c.createBiquadFilter();
      padLP.type = 'lowpass'; padLP.frequency.value = 1000; padLP.Q.value = 0.7;
      padBus.connect(padLP); padLP.connect(master); padLP.connect(verb);

      // bus del coro y de los acordes brillantes
      choirBus = c.createGain(); choirBus.gain.value = 0.5;
      choirBus.connect(master); choirBus.connect(verb);

      // viento de la llanura mesopotámica: ruido filtrado con modulación lenta
      const wind = c.createBufferSource(); wind.buffer = noiseBuf; wind.loop = true;
      const windBP = c.createBiquadFilter();
      windBP.type = 'bandpass'; windBP.frequency.value = 420; windBP.Q.value = 0.6;
      const windG = c.createGain(); windG.gain.value = 0.05;
      wind.connect(windBP); windBP.connect(windG); windG.connect(master); wind.start();
      const wl = c.createOscillator(); wl.frequency.value = 0.07;
      const wlA = c.createGain(); wlA.gain.value = 260;
      wl.connect(wlA); wlA.connect(windBP.frequency); wl.start();
      const wg = c.createOscillator(); wg.frequency.value = 0.11;
      const wgA = c.createGain(); wgA.gain.value = 0.03;
      wg.connect(wgA); wgA.connect(windG.gain); wg.start();

      drumBus = c.createGain(); drumBus.gain.value = 0.6; drumBus.connect(master);

      // fuego de los hornos de ladrillo: ruido grave continuo bajo el crepitar; la envolvente la marca s.kilns
      const fireSrc = c.createBufferSource(); fireSrc.buffer = noiseBuf; fireSrc.loop = true;
      const fireLP = c.createBiquadFilter(); fireLP.type = 'lowpass'; fireLP.frequency.value = 280; fireLP.Q.value = 0.9;
      fireBus = c.createGain(); fireBus.gain.value = 0;
      fireSrc.connect(fireLP); fireLP.connect(fireBus); fireBus.connect(master); fireSrc.start();

      // agua: ruido filtrado (gorgoteo y espuma) de las cascadas y de los canales de riego; la marca s.cascades
      const waterSrc = c.createBufferSource(); waterSrc.buffer = noiseBuf; waterSrc.loop = true;
      const waterBP = c.createBiquadFilter(); waterBP.type = 'bandpass'; waterBP.frequency.value = 1100; waterBP.Q.value = 0.8;
      const waterHP = c.createBiquadFilter(); waterHP.type = 'highpass'; waterHP.frequency.value = 500;
      waterBus = c.createGain(); waterBus.gain.value = 0;
      const wbl = c.createOscillator(); wbl.frequency.value = 0.9;
      const wblA = c.createGain(); wblA.gain.value = 500;
      wbl.connect(wblA); wblA.connect(waterBP.frequency); wbl.start();
      waterSrc.connect(waterBP); waterBP.connect(waterHP); waterHP.connect(waterBus); waterBus.connect(master); waterSrc.start();

      padTimer = setInterval(padTick, 3800);
    }

    function ensureAudio() {
      if (!AC) {
        const Ctor = window.AudioContext || window.webkitAudioContext;
        if (!Ctor) return;
        try { AC = new Ctor(); } catch (e) { AC = null; return; }
        try { buildAudio(); } catch (e) { console.warn('[BABILONIA] audio no disponible', e); }
      }
      if (AC && AC.state !== 'running') {
        const p = AC.resume();
        if (p && p.catch) p.catch(function () {});
      }
    }

    function padNote(f, when, dur) {
      const c = AC, g = c.createGain();
      g.gain.setValueAtTime(0, when);
      g.gain.linearRampToValueAtTime(0.8, when + 2.4);
      g.gain.setValueAtTime(0.8, when + dur - 4);
      g.gain.linearRampToValueAtTime(0, when + dur);
      g.connect(padBus);
      [-6, 6].forEach(function (cents) {
        const o = c.createOscillator();
        o.type = 'triangle'; o.frequency.value = f; o.detune.value = cents;
        o.connect(g); o.start(when); o.stop(when + dur + 0.1);
      });
    }
    function padTick() {
      if (!AC || AC.state !== 'running' || !timeline.isPlaying()) return;
      const k = PAD_PICK[(Math.random() * PAD_PICK.length) | 0];
      padNote(PAD_FREQS[k], AC.currentTime + 0.05, 9);
    }

    // tono sostenido: varias senoidales con envolvente y vibrato opcional, al bus del coro
    function tone(freqs, when, dur, o) {
      if (!AC || AC.state !== 'running' || !choirBus) return;
      const c = AC, g = c.createGain();
      g.gain.setValueAtTime(0.0001, when);
      g.gain.linearRampToValueAtTime(o.peak, when + o.attack);
      g.gain.setValueAtTime(o.peak, when + Math.max(o.attack, dur - o.release));
      g.gain.linearRampToValueAtTime(0.0001, when + dur);
      g.connect(choirBus);
      freqs.forEach(function (f, i) {
        const osc = c.createOscillator();
        osc.type = o.type || 'sine';
        osc.frequency.value = f;
        osc.detune.value = i % 2 ? 5 : -5;
        osc.connect(g); osc.start(when); osc.stop(when + dur + 0.1);
        if (o.vib) {
          const l = c.createOscillator(); l.frequency.value = 5.2;
          const la = c.createGain(); la.gain.value = f * 0.006;
          l.connect(la); la.connect(osc.frequency);
          l.start(when); l.stop(when + dur + 0.1);
        }
      });
    }
    // coro etéreo al aparecer la reina (acordes solapados)
    function choirSwell() {
      if (!AC || AC.state !== 'running') return;
      const t0 = AC.currentTime + 0.05;
      [0, 9, 18].forEach(function (off) {
        tone(CHOIR, t0 + off, 11, { peak: 0.25, attack: 3, release: 3, vib: true, type: 'sine' });
      });
    }
    // acorde brillante al completarse el tejado
    function brightChord() {
      if (!AC || AC.state !== 'running') return;
      tone(BRIGHT, AC.currentTime + 0.05, 6, { peak: 0.35, attack: 0.05, release: 4, vib: false, type: 'triangle' });
    }
    // golpe grave y ruido bajo del derrumbe de las terrazas: caída de los montículos de ladrillo
    function quakeRumble() {
      if (!AC || AC.state !== 'running' || !noiseBuf) return;
      const c = AC, t0 = c.currentTime + 0.02;
      const o = c.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(55, t0);
      o.frequency.exponentialRampToValueAtTime(22, t0 + 2.5);
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.9, t0 + 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 3.0);
      o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + 3.1);
      const src = c.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 600; lp.Q.value = 0.8;
      const ng = c.createGain();
      ng.gain.setValueAtTime(0.0001, t0);
      ng.gain.exponentialRampToValueAtTime(0.35, t0 + 0.1);
      ng.gain.exponentialRampToValueAtTime(0.0001, t0 + 3.0);
      src.connect(lp); lp.connect(ng); ng.connect(master);
      src.start(t0); src.stop(t0 + 3.1);
    }

    // crepitar: chasquido corto de ruido agudo (la madera y el mármol que estallan)
    function crackle(amt) {
      if (!AC || AC.state !== 'running' || !noiseBuf || !drumBus) return;
      const c = AC, t0 = c.currentTime + 0.01;
      const d = 0.015 + Math.random() * 0.05;
      const src = c.createBufferSource(); src.buffer = noiseBuf;
      const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1800 + Math.random() * 2600;
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(Math.max(0.001, amt), t0 + 0.002);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
      src.connect(hp); hp.connect(g); g.connect(drumBus);
      src.start(t0, Math.random() * 3.5, d + 0.03); src.stop(t0 + d + 0.04);
    }

    function kick() {
      if (!AC || AC.state !== 'running') return;
      const c = AC, t0 = c.currentTime + 0.01;
      const o = c.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(120, t0);
      o.frequency.exponentialRampToValueAtTime(34, t0 + 0.35);
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(1.0, t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.1);
      o.connect(g); g.connect(drumBus);
      o.start(t0); o.stop(t0 + 1.15);
    }

    function riser(sec) {
      if (!AC || AC.state !== 'running') return;
      const c = AC, t0 = c.currentTime + 0.05, t1 = t0 + sec;
      const src = c.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass'; bp.Q.value = 1.4;
      bp.frequency.setValueAtTime(180, t0);
      bp.frequency.exponentialRampToValueAtTime(4200, t1);
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.3, t1 - 0.3);
      g.gain.linearRampToValueAtTime(0.0001, t1 + 0.2);
      src.connect(bp); bp.connect(g); g.connect(master);
      src.start(t0); src.stop(t1 + 0.3);
      const o = c.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(70, t0);
      o.frequency.exponentialRampToValueAtTime(520, t1);
      const og = c.createGain();
      og.gain.setValueAtTime(0.0001, t0);
      og.gain.exponentialRampToValueAtTime(0.12, t1 - 0.2);
      og.gain.linearRampToValueAtTime(0.0001, t1 + 0.1);
      o.connect(og); og.connect(master);
      o.start(t0); o.stop(t1 + 0.2);
    }

    function duck(on) {
      if (!AC || !master) return;
      master.gain.setTargetAtTime(on ? DUCK_VOL : MASTER_VOL, AC.currentTime, 0.12);
    }

    // ---------- voz (speechSynthesis) ----------
    const SpeechSynth = (window.speechSynthesis && window.SpeechSynthesisUtterance) ? window.speechSynthesis : null;
    let voice = null, speaking = false, uid = 0, speakGuard = null, currentUtt = null, noEsVoice = false;
    function pickVoice() {
      if (!SpeechSynth || !SpeechSynth.getVoices) return;
      const vs = SpeechSynth.getVoices() || [];
      let best = null, bestScore = 0;
      vs.forEach(function (v) {
        const l = String(v.lang || '').replace('_', '-').toLowerCase();
        let sc = 0;
        if (l === 'es-es') sc = 3;
        else if (l === 'es-mx') sc = 2;
        else if (l.indexOf('es') === 0) sc = 1;
        if (sc > bestScore) { best = v; bestScore = sc; }
      });
      voice = best;
      if (vs.length) {
        if (!best && !noEsVoice) {
          noEsVoice = true;
          setVoice(false);
          showNote('Sin voz en español en este navegador: narración desactivada');
        } else if (best && noEsVoice) {
          noEsVoice = false;
          setVoice(true);
        }
      }
    }
    if (SpeechSynth) {
      pickVoice();
      SpeechSynth.onvoiceschanged = pickVoice;
    }
    function setSpeaking(on) {
      if (speaking === on) return;
      speaking = on;
      duck(on);
    }
    function stopSpeech() {
      uid++;
      clearTimeout(speakGuard); speakGuard = null;
      if (SpeechSynth) { try { SpeechSynth.cancel(); } catch (e) { /* ignorar */ } }
      setSpeaking(false);
    }
    function speak(text) {
      if (!SpeechSynth || !voiceOn || noEsVoice || !text) return;
      stopSpeech();
      const id = ++uid;
      const str = String(text);
      const u = new window.SpeechSynthesisUtterance(str);
      u.lang = voice ? voice.lang : 'es-ES';
      if (voice) u.voice = voice;
      u.rate = 1.0; u.pitch = 0.85; u.volume = 1;
      const done = function () {
        if (id !== uid) return;
        clearTimeout(speakGuard); speakGuard = null;
        setSpeaking(false);
      };
      u.onend = done;
      u.onerror = done;
      currentUtt = u;
      speakGuard = setTimeout(done, 4000 + str.length * 120); // por si el motor no emite 'end'
      setSpeaking(true);
      try { SpeechSynth.speak(u); } catch (e) { done(); }
    }

    function setVoice(v) {
      voiceOn = !!v;
      coverVoice.checked = voiceOn;
      setTxt(btnVoice, voiceOn ? 'VOZ ON' : 'VOZ OFF');
      if (!voiceOn) stopSpeech();
    }

    // ---------- subtítulos ----------
    function showLine(L) {
      subEl.textContent = '';
      const txt = L.text == null ? '' : String(L.text);
      const em = L.emphasis;
      if (typeof em === 'string' && em) {
        txt.split(em).forEach(function (p, i) {
          if (i > 0) subEl.appendChild(mk('span', 'em', em));
          if (p) subEl.appendChild(document.createTextNode(p));
        });
      } else {
        subEl.appendChild(document.createTextNode(txt));
      }
      let cls = 'sub on';
      if (em === true || (typeof em === 'number' && em >= 2)) cls += ' big';
      else if (typeof em === 'number' && em > 0) cls += ' mid';
      subEl.className = cls;
      subEl.animate([
        { opacity: 0, transform: 'translate(-50%, 8px)' },
        { opacity: 1, transform: 'translate(-50%, 0)' }
      ], { duration: 380, easing: 'ease-out' });
      if (em) subEl.animate(GLITCH_FRAMES, { duration: 300, easing: 'steps(1, end)' }); // temblor dorado
    }
    function hideLine() { subEl.classList.remove('on'); }

    // ---------- rótulo de capítulo ----------
    function showBanner(ch) {
      if (chAnim) chAnim.cancel();
      if (ruleAnim) ruleAnim.cancel();
      chNum.textContent = /^[IVXL]+$/.test(ch.num) ? 'CAPÍTULO ' + ch.num : ch.num;
      chTitle.textContent = ch.title;
      chEl.classList.toggle('verde', ch.id === ID_VERDE);   // el jardín va en verde jardín
      chEl.classList.toggle('azul', ch.id === ID_AZUL);     // el epílogo va en azul de Ishtar
      chEl.classList.toggle('duda', ch.id === ID_DUDA);     // Nínive es una duda: rojo
      chEl.classList.toggle('cocido', ch.id === ID_COCIDO); // las cifras van en ladrillo y oro
      bannerEnd = nowS() + 3.5;
      chAnim = chEl.animate([
        { opacity: 0, filter: 'blur(6px)', transform: 'translate(-50%,-50%) scale(1.03)' },
        { opacity: 1, filter: 'blur(0px)', transform: 'translate(-50%,-50%) scale(1)', offset: 0.14 },
        { opacity: 1, filter: 'blur(0px)', transform: 'translate(-50%,-50%) scale(1)', offset: 0.8 },
        { opacity: 0, filter: 'blur(4px)', transform: 'translate(-50%,-50%) scale(0.985)' }
      ], { duration: 3500, easing: 'ease-in-out' });
      // subrayado dorado que se dibuja del centro hacia los extremos
      ruleAnim = chRule.animate([
        { width: '0px' },
        { width: '260px', offset: 0.3 },
        { width: '260px', offset: 0.8 },
        { width: '0px' }
      ], { duration: 3500, easing: 'ease-in-out' });
    }

    // ---------- fichas (datos del capítulo actual, una tras otra) ----------
    function syncFacts(ch) {
      const list = getFacts(ch.id);
      const sig = ch.id + '|' + list.length + '|' + (list.length ? String(list[0]) : '');
      if (sig === factsSig) return;
      factsSig = sig;
      factsEl.textContent = '';
      factEls = list.map(function (txt) {
        const e = mk('div', 'fact', String(txt));
        e.style.display = 'none';
        e._on = false;
        factsEl.appendChild(e);
        return e;
      });
    }
    function updateFacts(s, ch) {
      syncFacts(ch);
      const n = factEls.length;
      if (!n) return;
      const step = clamp((ch.end - ch.start - 4) / n, 4, 12);
      let count = 0;
      for (let k = 0; k < n; k++) if (s.t >= ch.start + 2 + k * step) count = k + 1;
      const first = Math.max(0, count - 3); // como máximo 3 fichas visibles
      for (let k = 0; k < n; k++) {
        const on = k >= first && k < count;
        const e = factEls[k];
        if (e._on !== on) { e._on = on; e.style.display = on ? '' : 'none'; }
      }
    }

    // ---------- portada / eventos de la línea de tiempo ----------
    function hideCover() {
      if (!coverUp) return;
      coverUp = false;
      cover.classList.add('gone');
    }

    coverPlay.addEventListener('click', function () {
      coverPlay.blur();
      timeline.play(); // el listener 'play' inicia el audio dentro del gesto
    });
    coverVoice.addEventListener('change', function () {
      setVoice(coverVoice.checked);
      coverVoice.blur();
    });
    btnPlay.addEventListener('click', function () { btnPlay.blur(); timeline.toggle(); });
    btnVoice.addEventListener('click', function () { btnVoice.blur(); setVoice(!voiceOn); });
    btnFull.addEventListener('click', function () { btnFull.blur(); toggleFullscreen(); });
    againBtn.addEventListener('click', function () {
      againBtn.blur();
      timeline.seek(0);
      timeline.play();
    });

    function seekAt(e) {
      const r = bar.getBoundingClientRect();
      if (r.width <= 0) return;
      timeline.seek(clamp((e.clientX - r.left) / r.width, 0, 1) * DUR);
    }
    bar.addEventListener('pointerdown', function (e) {
      dragging = true;
      try { bar.setPointerCapture(e.pointerId); } catch (err) { /* ignorar */ }
      seekAt(e);
      lastAct = nowS();
    });
    bar.addEventListener('pointermove', function (e) { if (dragging) seekAt(e); });
    const endDrag = function () { dragging = false; };
    bar.addEventListener('pointerup', endDrag);
    bar.addEventListener('pointercancel', endDrag);

    function activity() { lastAct = nowS(); }
    window.addEventListener('pointermove', activity);
    window.addEventListener('pointerdown', activity);
    window.addEventListener('keydown', activity);

    timeline.on(function (ev) {
      if (ev === 'play') {
        ensureAudio();
        hideCover();
        againBtn.classList.remove('on');
      } else if (ev === 'pause') {
        stopSpeech();
        if (AC && AC.state === 'running') {
          const p = AC.suspend();
          if (p && p.catch) p.catch(function () {});
        }
      } else if (ev === 'seek') {
        // salto: cortar voz, y que el rótulo y la línea del nuevo punto se rehagan en el siguiente frame
        stopSpeech();
        shownChapter = -1;
        curLine = -2;
        prevChapter = -1;
        if (fireBus && AC) fireBus.gain.setTargetAtTime(0, AC.currentTime, 0.05);
        if (waterBus && AC) waterBus.gain.setTargetAtTime(0, AC.currentTime, 0.05);
      } else if (ev === 'end') {
        againBtn.classList.add('on');
      }
    });

    // ---------- actualización por frame ----------
    function update(s) {
      const t = s.t;
      const tn = nowS();
      const live = !!s.playing && s.dt > 0;
      const ci = s.chapterIndex;
      const ch = CHAPTERS[ci];
      const dt = Math.min(s.realDt || 0.016, 0.1);

      // rótulo de capítulo (cuando la portada ya no tapa la pantalla)
      if (!coverUp && ch && ci !== shownChapter) { shownChapter = ci; showBanner(ch); }

      // cambio de capítulo mientras suena: tambor
      const changed = prevChapter >= 0 && ci !== prevChapter;
      if (changed && live) kick();
      prevChapter = ci;

      // audio de interior (bóvedas y pozo de la noria): filtro del dron bajo y eco
      const inCam = !!ch && ID_INTERIOR.indexOf(ch.id) >= 0;
      if (droneFilt && AC && inCam !== camState) {
        camState = inCam;
        droneFilt.frequency.setTargetAtTime(inCam ? 70 : 150, AC.currentTime, 0.8);
        roomSendG.gain.setTargetAtTime(inCam ? 0.55 : 0, AC.currentTime, 0.8);
      }

      // coro de la reina al levantarse las terrazas (82) y al aparecer Amitis (151); riser antes del
      // epílogo (208); golpe grave del derrumbe (216)
      const dtT = t - prevT;
      if (live && dtT > 0 && dtT < 0.5) {
        if (prevT < 82 && t >= 82) choirSwell();
        if (prevT < 151 && t >= 151) choirSwell();
        if (prevT < 208 && t >= 208) riser(3);
        if (prevT < 216 && t >= 216) quakeRumble();
      }
      // acorde brillante cuando los jardines quedan completos (plants llega a 1)
      const full = clamp(s.plants || 0, 0, 1);
      if (live && dtT > 0 && dtT < 0.5 && prevPlants < 0.999 && full >= 0.999) brightChord();
      prevPlants = full;
      prevT = t;

      // hornos de ladrillo (38-64): rugido grave que sigue s.kilns, crepitar aleatorio y percusión cada ~1,1 s
      if (fireBus && AC) {
        const fl = clamp(s.kilns || 0, 0, 1);
        fireBus.gain.setTargetAtTime(0.4 * fl, AC.currentTime, 0.25);
        if (live && fl > 0.05) {
          if (Math.random() < dt * 9 * fl) crackle(0.12 + 0.2 * Math.random());
          if (fl > 0.5 && (t - fireKickT >= 1.1 || fireKickT > t)) { kick(); fireKickT = t; }
        }
      }

      // agua: gorgoteo y espuma que siguen las cascadas (136-214) y el agua subiendo (110-116)
      if (waterBus && AC) {
        const wl = clamp(Math.max(s.cascades || 0, 0.4 * (s.water || 0)), 0, 1);
        waterBus.gain.setTargetAtTime(0.16 * wl, AC.currentTime, 0.3);
      }

      // efecto de interferencia (0.6 s) al inicio de Nínive (duda) y del epílogo
      let scanOp = 0;
      ID_SCAN.forEach(function (id) {
        const c = CHAPTERS.find(function (x) { return x.id === id; });
        const t0 = c ? c.start : -1;
        if (t0 == null || t0 < 0) return;
        const u = (t - t0) / 0.6;
        if (u >= 0 && u < 1) scanOp = Math.max(scanOp, 0.9 * Math.sin(Math.PI * u));
      });
      setOp(scanEl, scanOp);

      // subtítulos
      const lines = getLines();
      let idx = -1;
      for (let i = 0; i < lines.length; i++) {
        const L = lines[i];
        if (L && t >= L.start && t < L.end) { idx = i; break; }
      }
      if (idx !== curLine) {
        curLine = idx;
        if (idx >= 0) {
          showLine(lines[idx]);
          if (s.playing) speak(lines[idx].text);
        } else {
          hideLine();
        }
      }

      // fichas
      if (ch) {
        updateFacts(s, ch);
        // fichas: se desvanecen entre 3 s y 2 s antes del final del capítulo
        setOp(factsEl, (1 - ramp(t, ch.end - 3, ch.end - 2)) * (tn < bannerEnd ? 0 : 1)); // sin fichas mientras dura el rótulo
      }

      // panel de datos: altura construida (terraces * 25 m), terrazas (de 5), agua (L/h, 8.000 al final),
      // vegetación (%); con la ruina (decay > 0,5) las terrazas se dan por "EN RUINAS"
      const ter = clamp(s.terraces || 0, 0, 1);
      const wat = clamp(s.water || 0, 0, 1);
      const veg = clamp(s.plants || 0, 0, 1);
      const ruin = clamp(s.decay || 0, 0, 1) > 0.5;
      setTxt(rAlt.val, (ter * 25).toFixed(1).replace('.', ',') + ' m');
      setTxt(rTer.val, ruin ? 'EN RUINAS' : (ter * 5).toFixed(1).replace('.', ',') + ' de 5');
      setTxt(rAgua.val, miles(wat * 8000) + ' L/h');
      setTxt(rVeg.val, Math.round(veg * 100) + ' %');
      setTxt(rDate.val, fechaAt(t));
      // el panel se oculta suavemente mientras dura el rótulo de capítulo
      setOp(panel, tn < bannerEnd ? 0 : 1);

      // controles
      const pct = (clamp(t / DUR, 0, 1) * 100).toFixed(3) + '%';
      if (fill._w !== pct) { fill._w = pct; fill.style.width = pct; head.style.left = pct; }
      setTxt(timeEl, fmtTime(t) + ' / ' + fmtTime(DUR));
      setTxt(btnPlay, s.playing ? '❚❚' : '▶');
      const showC = dragging || (tn - lastAct) < 3;
      if (showC !== ctrlOn) {
        ctrlOn = showC;
        ctrl.classList.toggle('on', showC);
        ctrl.classList.toggle('off', !showC);
      }

      // cine: fundido a negro y texto final (el vídeo termina en DUR)
      setOp(fadeEl, ramp(t, DUR - 7, DUR));
      setOp(endEl, ramp(t, DUR - 4, DUR));
    }

    setVoice(!noEsVoice);
    return { update: update };
  };
})();
