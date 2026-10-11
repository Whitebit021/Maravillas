// Templo de Artemisa en Éfeso: plataforma de gradas, 127 columnas jónicas estriadas (basa, tres tambores,
// capitel con volutas; las 36 caelatae con tambor inferior esculpido), arquitrabes, friso de caza, frontones
// con relieve, tejado de tejas con la cella hipetra abierta, policromía, fantasma de prólogo, incendio,
// daño, saqueo godo y desmantelamiento. Todo procedural. El estado s es función pura (sin acumulación).
(function () {
  'use strict';
  const G = window.GIZA;

  function clamp01(x) { return x < 0 ? 0 : (x > 1 ? 1 : x); }
  function smooth(x) { return x * x * (3 - 2 * x); }
  function makeRng(seed) {
    let s = seed | 0;
    return function () {
      s = (s + 0x6D2B79F5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

  G.createTemple = function (ctx) {
    const THREE = ctx.THREE, scene = ctx.scene, renderer = ctx.renderer;
    const TP = G.TEMPLE, COLS = TP.columns;
    const HX = TP.halfX, HZ = TP.halfZ, EAVE = TP.entabY1, RIDGE = TP.ridgeY;
    const K = (RIDGE - EAVE) / HZ;                 // pendiente del tejado (~0.236)
    const CH = TP.cella.halfX, CHZ = TP.cella.halfZ; // cella 40 x 12
    const NC = COLS.length;                        // 127
    const root = new THREE.Group();
    scene.add(root);
    const rnd = makeRng(4242);
    const UP = new THREE.Vector3(0, 1, 0), AX = new THREE.Vector3(1, 0, 0), ZA = new THREE.Vector3(0, 0, 1);
    const ZERO_M = new THREE.Matrix4().makeScale(0, 0, 0);
    const _p = new THREE.Vector3(), _s = new THREE.Vector3(), _m = new THREE.Matrix4(), _qI = new THREE.Quaternion();
    const MIN_S = 0.002;

    function roofY(z) { return EAVE + (HZ - Math.abs(z)) * K; }
    function T(x, y, z) { return new THREE.Matrix4().makeTranslation(x, y, z); }
    function yawQ(a) { return new THREE.Quaternion().setFromAxisAngle(UP, a); }
    function keepOf(d, thr) { return 1 - smooth(clamp01((d - thr) / 0.12)); }
    function put(inst, i, px, py, pz, q, sx, sy, sz) {
      if (!(sx > MIN_S && sy > MIN_S && sz > MIN_S)) { inst.setMatrixAt(i, ZERO_M); return; }
      _p.set(px, py, pz); _s.set(sx, sy, sz);
      _m.compose(_p, q || _qI, _s);
      inst.setMatrixAt(i, _m);
    }
    function hide(inst, i) { inst.setMatrixAt(i, ZERO_M); }
    function flush(inst) { inst.instanceMatrix.needsUpdate = true; }

    // fusiona geometrías {g, m, c}: m = matriz opcional, c = color opcional (vértices)
    function mergeGeos(list) {
      const pos = [], nor = [], uv = [], col = [], idx = [];
      const v = new THREE.Vector3(), nv = new THREE.Vector3(), nm = new THREE.Matrix3();
      let off = 0;
      list.forEach(function (it) {
        const g = it.g, Pa = g.attributes.position, Na = g.attributes.normal, Ua = g.attributes.uv;
        const m = it.m || null, count = Pa.count, c = it.c || null;
        if (m) nm.getNormalMatrix(m);
        for (let i = 0; i < count; i++) {
          v.fromBufferAttribute(Pa, i); if (m) v.applyMatrix4(m);
          pos.push(v.x, v.y, v.z);
          if (Na) { nv.fromBufferAttribute(Na, i); if (m) nv.applyMatrix3(nm); nv.normalize(); nor.push(nv.x, nv.y, nv.z); }
          else nor.push(0, 1, 0);
          if (Ua) uv.push(Ua.getX(i), Ua.getY(i)); else uv.push(0, 0);
          if (c) col.push(c.r, c.g, c.b); else col.push(1, 1, 1);
        }
        if (g.index) { for (let i = 0; i < g.index.count; i++) idx.push(g.index.getX(i) + off); }
        else { for (let i = 0; i < count; i++) idx.push(i + off); }
        off += count;
      });
      const out = new THREE.BufferGeometry();
      out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
      out.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      out.setIndex(idx);
      return out;
    }
    // caja con UV en unidades de mundo / tile (la textura de sillares no se estira)
    function tiledBox(w, h, d, tile) {
      const g = new THREE.BoxGeometry(w, h, d);
      const pos = g.attributes.position, uv = g.attributes.uv, nrm = g.attributes.normal;
      for (let i = 0; i < pos.count; i++) {
        const nx = Math.abs(nrm.getX(i)), ny = Math.abs(nrm.getY(i));
        let a, b;
        if (nx > 0.5) { a = pos.getZ(i); b = pos.getY(i); }
        else if (ny > 0.5) { a = pos.getX(i); b = pos.getZ(i); }
        else { a = pos.getX(i); b = pos.getY(i); }
        uv.setXY(i, a / tile, b / tile);
      }
      return g;
    }
    // polígono convexo (abanico) con normal fija y UV por función
    function polyGeo(pts, n, uvf) {
      const pos = [], nor = [], uv = [], idx = [];
      pts.forEach(function (p) {
        pos.push(p[0], p[1], p[2]); nor.push(n[0], n[1], n[2]);
        const t = uvf(p); uv.push(t[0], t[1]);
      });
      for (let i = 1; i < pts.length - 1; i++) idx.push(0, i, i + 1);
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.setIndex(idx);
      return g;
    }
    function ringGeo(hx, hz, y0, h, t) {
      const yc = y0 + h / 2;
      return mergeGeos([
        { g: tiledBox(t, h, 2 * hz, 4), m: T(hx - t / 2, yc, 0) },
        { g: tiledBox(t, h, 2 * hz, 4), m: T(-(hx - t / 2), yc, 0) },
        { g: tiledBox(2 * hx, h, t, 4), m: T(0, yc, -(hz - t / 2)) },
        { g: tiledBox(2 * hx, h, t, 4), m: T(0, yc, hz - t / 2) }
      ]);
    }
    function canvasTex(cv, srgb) {
      const t = new THREE.CanvasTexture(cv);
      if (srgb) t.encoding = THREE.sRGBEncoding;
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = 8;
      return t;
    }

    // ---------- entorno PMREM: cielo degradado (para mármol pulido) ----------
    function skyEnv() {
      try {
        const sc = new THREE.Scene();
        const sky = new THREE.ShaderMaterial({
          side: THREE.BackSide, depthWrite: false,
          vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
          fragmentShader: 'varying vec3 vP; void main(){ float h = vP.y; vec3 top = vec3(0.30,0.50,0.76); vec3 hor = vec3(0.95,0.82,0.62); vec3 gnd = vec3(0.22,0.17,0.12); vec3 c = h > 0.0 ? mix(hor, top, smoothstep(0.0, 0.6, h)) : mix(hor, gnd, smoothstep(0.0, -0.3, h)); float sun = pow(max(dot(normalize(vP), normalize(vec3(0.4,0.5,-0.6))), 0.0), 60.0); c += vec3(1.0,0.85,0.5) * sun * 2.0; gl_FragColor = vec4(c, 1.0); }'
        });
        sc.add(new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), sky));
        const pm = new THREE.PMREMGenerator(renderer);
        return pm.fromScene(sc, 0.04).texture;
      } catch (e) { return null; }
    }

    // ---------- texturas dibujadas por código ----------
    function sillarCanvases() {
      const N = 512, c = makeCanvas(N, N), b = makeCanvas(N, N);
      const g = c.getContext('2d'), h = b.getContext('2d'), r = makeRng(77);
      g.fillStyle = '#8f8472'; g.fillRect(0, 0, N, N);
      h.fillStyle = '#1e1e1e'; h.fillRect(0, 0, N, N);
      const rows = 2, cols = 2, rh = N / rows, cw = N / cols, J = 5;
      for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
        const x = col * cw, y = row * rh, tone = 0.93 + 0.1 * r(), warm = 0.98 + 0.03 * r();
        g.fillStyle = 'rgb(' + Math.round(239 * tone) + ',' + Math.round(230 * tone * warm) + ',' + Math.round(214 * tone) + ')';
        g.fillRect(x + J, y + J, cw - 2 * J, rh - 2 * J);
        for (let m = 0; m < 4; m++) {
          const mx = x + r() * cw, my = y + r() * rh, mr = 30 + r() * 60;
          const gr = g.createRadialGradient(mx, my, 0, mx, my, mr);
          gr.addColorStop(0, 'rgba(170,150,120,0.10)'); gr.addColorStop(1, 'rgba(170,150,120,0)');
          g.fillStyle = gr; g.fillRect(x + J, y + J, cw - 2 * J, rh - 2 * J);
        }
        h.fillStyle = '#b8b8b8'; h.fillRect(x + J, y + J, cw - 2 * J, rh - 2 * J);
        h.fillStyle = 'rgba(255,255,255,0.35)'; h.fillRect(x + J, y + J, cw - 2 * J, 3); h.fillRect(x + J, y + J, 3, rh - 2 * J);
        h.fillStyle = 'rgba(0,0,0,0.35)'; h.fillRect(x + J, y + rh - J - 3, cw - 2 * J, 3); h.fillRect(x + cw - J - 3, y + J, 3, rh - 2 * J);
        for (let v = 0; v < 4; v++) {
          g.strokeStyle = 'rgba(' + Math.round(120 + 40 * r()) + ',105,88,' + (0.10 + 0.12 * r()).toFixed(2) + ')';
          g.lineWidth = 0.6 + r() * 1.6;
          const x0 = x + r() * cw, y0 = y + r() * rh;
          g.beginPath(); g.moveTo(x0, y0);
          g.bezierCurveTo(x0 + 20 + r() * 30, y0 - 10 + r() * 20, x0 + 40 + r() * 40, y0 + 10, x0 + 70 + r() * 60, y0 - 5 + r() * 30);
          g.stroke();
        }
      }
      return { map: c, bump: b };
    }
    function smoothMarble() {
      const N = 512, c = makeCanvas(N, N), b = makeCanvas(N, N);
      const g = c.getContext('2d'), h = b.getContext('2d'), r = makeRng(91);
      g.fillStyle = '#efe6d6'; g.fillRect(0, 0, N, N);
      h.fillStyle = '#808080'; h.fillRect(0, 0, N, N);
      for (let i = 0; i < 26; i++) {
        const x0 = r() * N, y0 = r() * N;
        g.strokeStyle = 'rgba(' + Math.round(140 + 40 * r()) + ',120,96,' + (0.08 + 0.14 * r()).toFixed(2) + ')';
        g.lineWidth = 0.8 + r() * 2.4;
        g.beginPath(); g.moveTo(x0, y0);
        g.bezierCurveTo(x0 + 60 * r(), y0 + 40 * (r() - 0.5), x0 + 140 * r(), y0 + 80 * (r() - 0.5), x0 + 200 * (r() - 0.5), y0 + 160 * (r() - 0.5));
        g.stroke();
      }
      for (let i = 0; i < 900; i++) { g.fillStyle = 'rgba(150,130,100,' + (0.03 + 0.06 * r()).toFixed(3) + ')'; g.fillRect(r() * N, r() * N, 1 + r() * 3, 1 + r() * 3); }
      for (let i = 0; i < 500; i++) { const v = Math.round(110 + 50 * r()); h.fillStyle = 'rgb(' + v + ',' + v + ',' + v + ')'; h.fillRect(r() * N, r() * N, 2 + r() * 3, 2 + r() * 3); }
      return { map: c, bump: b };
    }
    function drawWoman(g, cx, yb, h, fill, line) {
      const s = h / 400;
      g.fillStyle = fill; g.strokeStyle = line; g.lineWidth = 2.5 * s; g.lineJoin = 'round';
      g.beginPath();                                       // chitón hasta los pies
      g.moveTo(cx - 34 * s, yb - 200 * s); g.lineTo(cx + 34 * s, yb - 200 * s);
      g.lineTo(cx + 58 * s, yb); g.lineTo(cx - 58 * s, yb); g.closePath(); g.fill(); g.stroke();
      g.beginPath();                                       // busto
      g.moveTo(cx - 30 * s, yb - 300 * s); g.lineTo(cx + 30 * s, yb - 300 * s);
      g.lineTo(cx + 34 * s, yb - 200 * s); g.lineTo(cx - 34 * s, yb - 200 * s); g.closePath(); g.fill(); g.stroke();
      g.lineWidth = 16 * s; g.lineCap = 'round'; g.strokeStyle = fill;   // brazos
      g.beginPath(); g.moveTo(cx - 28 * s, yb - 290 * s); g.lineTo(cx - 50 * s, yb - 210 * s); g.lineTo(cx - 46 * s, yb - 150 * s); g.stroke();
      g.beginPath(); g.moveTo(cx + 28 * s, yb - 290 * s); g.lineTo(cx + 50 * s, yb - 210 * s); g.lineTo(cx + 40 * s, yb - 170 * s); g.stroke();
      g.lineCap = 'butt'; g.strokeStyle = line; g.lineWidth = 2.5 * s; g.fillStyle = fill;
      g.beginPath(); g.ellipse(cx, yb - 340 * s, 20 * s, 24 * s, 0, 0, Math.PI * 2); g.fill(); g.stroke();
      g.lineWidth = 1.8 * s;                               // pliegues
      for (let k = -2; k <= 2; k++) { g.beginPath(); g.moveTo(cx + k * 12 * s, yb - 190 * s); g.lineTo(cx + k * 20 * s, yb - 10 * s); g.stroke(); }
    }
    // tambor inferior con figuras en relieve (color y bump)
    function caelataCanvases() {
      const W = 1024, H = 512, c = makeCanvas(W, H), b = makeCanvas(W, H);
      const g = c.getContext('2d'), h = b.getContext('2d'), r = makeRng(555);
      g.fillStyle = '#efe6d6'; g.fillRect(0, 0, W, H);
      h.fillStyle = '#404040'; h.fillRect(0, 0, W, H);
      for (let i = 0; i < 30; i++) {
        g.strokeStyle = 'rgba(160,140,110,' + (0.08 + 0.1 * r()).toFixed(2) + ')'; g.lineWidth = 1 + 2 * r();
        g.beginPath(); g.moveTo(r() * W, r() * H); g.lineTo(r() * W, r() * H); g.stroke();
      }
      const N = 8, step = W / N;
      for (let k = 0; k < N; k++) {
        const cx = (k + 0.5) * step, hgt = 400 + 30 * r(), yb = H - 30;
        drawWoman(g, cx, yb, hgt, '#e2d6bd', '#6f604a');
        drawWoman(h, cx, yb, hgt, '#d6d6d6', '#9a9a9a');
      }
      return { map: c, bump: b };
    }
    // siluetas de caza para el friso y el frontón
    const PAL = {
      marble: { bg: '#efe9dd', fig: '#d3c8b3', line: '#5f5644', acc: '#b5a88f' },
      paint: { bg: '#1d4b96', fig: '#b8362b', line: '#3a1210', acc: '#e8b84a' },
      bump: { bg: '#2e2e2e', fig: '#c8c8c8', line: '#101010', acc: '#e6e6e6' }
    };
    function drawHunter(g, x, y, s, flip, c) {
      const d = flip ? -1 : 1;
      g.lineJoin = 'round'; g.lineCap = 'round';
      g.fillStyle = c.fig; g.strokeStyle = c.line; g.lineWidth = 2 * s;
      g.beginPath();
      g.moveTo(x - 9 * s, y - 42 * s); g.lineTo(x + 9 * s, y - 42 * s);
      g.lineTo(x + 6 * s, y - 16 * s); g.lineTo(x - 6 * s, y - 16 * s); g.closePath(); g.fill(); g.stroke();
      g.beginPath(); g.arc(x, y - 50 * s, 6 * s, 0, Math.PI * 2); g.fill(); g.stroke();
      g.lineWidth = 4 * s;
      g.beginPath();
      g.moveTo(x - 4 * s, y - 17 * s); g.lineTo(x - 8 * s * d, y);
      g.moveTo(x + 4 * s, y - 17 * s); g.lineTo(x + 9 * s * d, y);
      g.moveTo(x - 6 * s * d, y - 38 * s); g.lineTo(x + 16 * s * d, y - 44 * s);
      g.stroke();
      g.lineWidth = 1.6 * s;                               // arco y flecha
      g.beginPath(); g.arc(x + 18 * s * d, y - 44 * s, 14 * s, d > 0 ? -1.3 : Math.PI - 1.3, d > 0 ? 1.3 : Math.PI + 1.3); g.stroke();
      g.beginPath(); g.moveTo(x + (18 + 14 * Math.cos(-1.3)) * s * d, y - 44 * s + 14 * Math.sin(-1.3) * s);
      g.lineTo(x + (18 + 14 * Math.cos(1.3)) * s * d, y - 44 * s + 14 * Math.sin(1.3) * s); g.stroke();
      g.beginPath(); g.moveTo(x + 18 * s * d, y - 44 * s); g.lineTo(x + 46 * s * d, y - 44 * s); g.stroke();
    }
    function drawDeer(g, x, y, s, flip, c) {
      const d = flip ? -1 : 1;
      g.lineCap = 'round'; g.fillStyle = c.fig; g.strokeStyle = c.line; g.lineWidth = 4 * s;
      [-14, -6, 8, 16].forEach(function (ox, k) {
        g.beginPath(); g.moveTo(x + ox * s * d, y - 22 * s);
        g.lineTo(x + (ox + (k % 2 ? 3 : -3)) * s * d, y); g.stroke();
      });
      g.lineWidth = 2 * s;
      g.beginPath(); g.ellipse(x, y - 30 * s, 26 * s, 12 * s, 0, 0, Math.PI * 2); g.fill(); g.stroke();
      g.lineWidth = 6 * s; g.beginPath(); g.moveTo(x + 20 * s * d, y - 34 * s); g.quadraticCurveTo(x + 30 * s * d, y - 46 * s, x + 36 * s * d, y - 60 * s); g.stroke();
      g.lineWidth = 2 * s;
      g.beginPath(); g.ellipse(x + 38 * s * d, y - 62 * s, 8 * s, 5 * s, -0.4 * d, 0, Math.PI * 2); g.fill(); g.stroke();
      g.lineWidth = 2 * s;                                 // cornamenta
      g.beginPath(); g.moveTo(x + 36 * s * d, y - 66 * s); g.lineTo(x + 30 * s * d, y - 80 * s);
      g.moveTo(x + 34 * s * d, y - 70 * s); g.lineTo(x + 44 * s * d, y - 82 * s); g.stroke();
    }
    function drawDog(g, x, y, s, flip, c) {
      const d = flip ? -1 : 1;
      g.fillStyle = c.fig; g.strokeStyle = c.line; g.lineWidth = 2 * s;
      g.beginPath(); g.ellipse(x, y - 12 * s, 14 * s, 6 * s, 0, 0, Math.PI * 2); g.fill(); g.stroke();
      g.beginPath(); g.arc(x + 14 * s * d, y - 18 * s, 5 * s, 0, Math.PI * 2); g.fill(); g.stroke();
      g.lineWidth = 2 * s;
      g.beginPath(); g.moveTo(x - 8 * s, y - 8 * s); g.lineTo(x - 9 * s, y); g.moveTo(x + 8 * s, y - 8 * s); g.lineTo(x + 9 * s, y);
      g.moveTo(x - 14 * s * d, y - 14 * s); g.lineTo(x - 22 * s * d, y - 20 * s); g.stroke();
    }
    function friezeCanvas(c) {
      const cv = makeCanvas(4096, 256), g = cv.getContext('2d'), SW = 1024;
      for (let side = 0; side < 4; side++) {
        const x0 = side * SW;
        g.save(); g.beginPath(); g.rect(x0, 0, SW, 256); g.clip();
        g.fillStyle = c.bg; g.fillRect(x0, 0, SW, 256);
        for (let j = 0; j < 3; j++) {
          const cx = x0 + 170 + j * 341, kind = (side + j) % 3;
          if (kind === 0) { drawHunter(g, cx - 40, 240, 2.8, false, c); drawDeer(g, cx + 40, 240, 2.8, true, c); }
          else if (kind === 1) { drawHunter(g, cx - 60, 240, 2.8, false, c); drawHunter(g, cx + 60, 240, 2.8, true, c); }
          else { drawDeer(g, cx - 50, 240, 2.6, false, c); drawDog(g, cx + 10, 240, 2.8, false, c); drawDeer(g, cx + 70, 240, 2.6, true, c); }
        }
        g.restore();
      }
      return cv;
    }
    const PEDB = { bg: '#1d4b96', fig: '#ece3cf', hi: '#fbf6ea', shade: '#6b604d', line: '#2a2118' };
    const PEDBUMP = { bg: '#202020', fig: '#d8d8d8', hi: '#ffffff', shade: '#505050', line: '#000000' };
    function pedimentCanvas(c, shaded) {
      const W = 1024, H = 360, cv = makeCanvas(W, H), g = cv.getContext('2d');
      g.fillStyle = c.bg; g.fillRect(0, 0, W, H);
      const cc = { bg: c.bg, fig: c.fig, line: c.line, acc: c.acc };
      if (shaded) {                                        // sombreado de volumen: luz desde arriba a la izquierda
        const gr = g.createLinearGradient(0, 0, W * 0.5, H);
        gr.addColorStop(0, c.hi); gr.addColorStop(0.55, c.fig); gr.addColorStop(1, c.shade);
        cc.fig = gr;
      }
      drawHunter(g, 88, 340, 3.6, false, cc);
      drawDeer(g, 262, 330, 3.2, false, cc);
      drawWoman(g, 512, 340, 340, cc.fig, cc.line);       // Artemisa en el centro
      drawDeer(g, 762, 330, 3.2, true, cc);
      drawHunter(g, 936, 340, 3.6, true, cc);
      return cv;
    }

    function tileCanvases() {
      const N = 256, c = makeCanvas(N, N), b = makeCanvas(N, N), r = makeRng(808);
      const g = c.getContext('2d'), h = b.getContext('2d');
      g.fillStyle = '#e4dac6'; g.fillRect(0, 0, N, N);
      h.fillStyle = '#303030'; h.fillRect(0, 0, N, N);
      const rowH = N / 4, colW = N / 4;
      for (let row = 0; row < 4; row++) for (let col = -1; col < 4; col++) {
        const x = col * colW + (row % 2) * colW / 2, y = row * rowH;
        const tone = 0.9 + 0.1 * r();
        g.beginPath(); g.arc(x, y + rowH, colW * 0.55, Math.PI, 0); g.closePath();
        g.fillStyle = 'rgb(' + Math.round(228 * tone) + ',' + Math.round(218 * tone) + ',' + Math.round(196 * tone) + ')';
        g.fill(); g.strokeStyle = 'rgba(90,70,50,0.5)'; g.lineWidth = 2; g.stroke();
        h.beginPath(); h.arc(x, y + rowH, colW * 0.55, Math.PI, 0); h.closePath();
        h.fillStyle = '#c4c4c4'; h.fill(); h.strokeStyle = '#202020'; h.lineWidth = 2; h.stroke();
      }
      return { map: c, bump: b };
    }

    // ---------- materiales ----------
    const env = skyEnv();
    const SIL = sillarCanvases(), SMO = smoothMarble(), CAE = caelataCanvases(), TIL = tileCanvases();
    const FRC = { marble: friezeCanvas(PAL.marble), paint: friezeCanvas(PAL.paint), bump: friezeCanvas(PAL.bump) };
    const PDC = { marble: pedimentCanvas(PEDB, true), paint: pedimentCanvas(PAL.paint, false), bump: pedimentCanvas(PEDBUMP, true) };
    const sillarMat = new THREE.MeshStandardMaterial({ map: canvasTex(SIL.map, true), bumpMap: canvasTex(SIL.bump, false), bumpScale: 0.4, roughness: 0.33, envMap: env, envMapIntensity: 0.6 });
    const colMat = new THREE.MeshStandardMaterial({ map: canvasTex(SMO.map, true), bumpMap: canvasTex(SMO.bump, false), bumpScale: 0.05, roughness: 0.3, envMap: env, envMapIntensity: 0.7 });
    const caelMat = new THREE.MeshStandardMaterial({ map: canvasTex(CAE.map, true), bumpMap: canvasTex(CAE.bump, false), bumpScale: 0, roughness: 0.3, envMap: env, envMapIntensity: 0.7 });
    const capPaintMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const frMat = new THREE.MeshStandardMaterial({ map: canvasTex(FRC.marble, true), bumpMap: canvasTex(FRC.bump, false), bumpScale: 3, roughness: 0.6, side: THREE.DoubleSide });
    const frPaintMat = new THREE.MeshStandardMaterial({ map: canvasTex(FRC.paint, true), transparent: true, opacity: 0, depthWrite: false, roughness: 0.7, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const pedMat = new THREE.MeshStandardMaterial({ map: canvasTex(PDC.marble, true), bumpMap: canvasTex(PDC.bump, false), bumpScale: 3, roughness: 0.5, side: THREE.DoubleSide });
    const pedPaintMat = new THREE.MeshStandardMaterial({ map: canvasTex(PDC.paint, true), transparent: true, opacity: 0, depthWrite: false, roughness: 0.6, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const roofMat = new THREE.MeshStandardMaterial({ map: canvasTex(TIL.map, true), bumpMap: canvasTex(TIL.bump, false), bumpScale: 2.5, roughness: 0.7, side: THREE.DoubleSide });
    const cedarMat = new THREE.MeshStandardMaterial({ color: 0x8a5a2b, roughness: 0.8 });
    const puddleMat = new THREE.MeshStandardMaterial({ color: 0x3b3326, roughness: 0.05, transparent: true, opacity: 0, depthWrite: false, envMap: env, envMapIntensity: 1.2 });
    const ghostMat = new THREE.MeshBasicMaterial({ color: 0xffc860, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
    const ghostEdgeMat = new THREE.LineBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0, depthWrite: false });
    const smokeMat = new THREE.PointsMaterial({ color: 0x1b1915, size: 36, sizeAttenuation: true, map: null, transparent: true, opacity: 0, depthWrite: false });
    const sparkMat = new THREE.PointsMaterial({ color: 0xffb347, size: 1.8, sizeAttenuation: true, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
    const flameMat = new THREE.ShaderMaterial({
      uniforms: { uT: { value: 0 }, uI: { value: 0 }, uPh: { value: 0 } },
      vertexShader: [
        'varying vec2 vUv; varying float vId;',
        'void main() {',
        '  vUv = uv; vId = 0.0;',
        '  vec4 p = vec4(position, 1.0);',
        '#ifdef USE_INSTANCING',
        '  p = instanceMatrix * p;',
        '  vId = fract(sin(dot(instanceMatrix[3].xz, vec2(12.9898, 78.233))) * 43758.5453);',
        '#endif',
        '  gl_Position = projectionMatrix * modelViewMatrix * p;',
        '}'
      ].join('\n'),
      fragmentShader: [
        'uniform float uT; uniform float uI; uniform float uPh;',
        'varying vec2 vUv; varying float vId;',
        'float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }',
        'float noise(vec2 p){ vec2 i = floor(p); vec2 f = fract(p); f = f*f*(3.0-2.0*f);',
        '  return mix(mix(hash(i), hash(i+vec2(1.0,0.0)), f.x), mix(hash(i+vec2(0.0,1.0)), hash(i+vec2(1.0,1.0)), f.x), f.y); }',
        'void main() {',
        '  float t = uT * 2.2 + vId * 17.0;',
        '  vec2 q = vUv;',
        '  float n = noise(vec2(q.x * 3.0 + vId * 9.0, q.y * 3.5 - t * 1.6));',
        '  float w = mix(0.5, 0.06, q.y);',
        '  float x = (q.x - 0.5) + (n - 0.5) * 0.35 * q.y;',
        '  float shape = 1.0 - smoothstep(w * 0.55, w, abs(x));',
        '  shape *= smoothstep(0.0, 0.08, q.y) * (1.0 - smoothstep(0.7, 1.0, q.y + (n - 0.5) * 0.25));',
        '  float core = (1.0 - smoothstep(0.0, w * 0.45, abs(x))) * (1.0 - q.y * 0.9);',
        '  vec3 outer = mix(vec3(1.0, 0.42, 0.06), vec3(0.45, 0.04, 0.0), q.y);',
        '  vec3 col = mix(outer, vec3(1.0, 0.92, 0.6), core);',
        '  col = mix(col, vec3(1.0, 0.84, 0.45), uPh);',
        '  float a = shape * uI * (0.75 + 0.25 * n);',
        '  gl_FragColor = vec4(col * 0.85, a);',
        '}'
      ].join('\n'),
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide
    });

    // ---------- 1. PLATAFORMA: 10 gradas (la última es el estilóbato a y=3), una sola malla con vértices animados ----------
    const stepDefs = [];
    const stepParts = [];
    for (let i = 0; i < TP.steps; i++) {
      const hx = HX + 4.5 - 0.5 * i, hz = HZ + 4.5 - 0.5 * i, y0 = i * TP.stepH, h = TP.stepH;
      stepDefs.push({ cy: y0 + h / 2 });
      stepParts.push({ g: tiledBox(2 * hx, h, 2 * hz, 4), m: T(0, y0 + h / 2, 0) });
    }
    const stepGeo = mergeGeos(stepParts);
    const stepBase = Float32Array.from(stepGeo.attributes.position.array);
    const stepMesh = new THREE.Mesh(stepGeo, sillarMat);
    stepMesh.castShadow = true; stepMesh.receiveShadow = true; stepMesh.frustumCulled = false;
    root.add(stepMesh);
    const stepLift = new Float32Array(TP.steps), stepKeep = new Float32Array(TP.steps);
    function writeSteps(pf, dis) {
      for (let k = 0; k < TP.steps; k++) {
        const u = clamp01((pf - 0.03 * k) / 0.6);
        stepLift[k] = -(1 - smooth(u)) * 3.4;             // suben desde bajo el suelo
        stepKeep[k] = keepOf(dis, 0.1 + 0.07 * (TP.steps - 1 - k)); // desmontaje: arriba primero
      }
      const out = stepGeo.attributes.position.array, nV = stepBase.length / 3;
      for (let v = 0; v < nV; v++) {
        const k = Math.floor(v / 24), kp = stepKeep[k], cy = stepDefs[k].cy;
        out[3 * v] = stepBase[3 * v] * kp;
        out[3 * v + 1] = cy + (stepBase[3 * v + 1] - cy) * kp + stepLift[k];
        out[3 * v + 2] = stepBase[3 * v + 2] * kp;
      }
      stepGeo.attributes.position.needsUpdate = true;
    }

    // ---------- 2. COLUMNAS: basa, tres tambores estriados, capitel jónico ----------
    const baseGeo = new THREE.LatheGeometry([[0, 0], [1.06, 0], [1.0, 0.16], [0.92, 0.3], [0.9, 0.48], [0.92, 0.7], [0.92, 0.9]].map(function (p) { return new THREE.Vector2(p[0], p[1]); }), 24);
    const drumGeo = new THREE.CylinderGeometry(0.9, 0.9, 1, 48, 1, true);
    drumGeo.translate(0, 0.5, 0);
    (function () {                                          // 24 estrías por desplazamiento radial
      const P = drumGeo.attributes.position;
      for (let i = 0; i < P.count; i++) {
        const th = Math.atan2(P.getX(i), P.getZ(i));
        const f = Math.pow(0.5 + 0.5 * Math.cos(24 * th), 0.6);
        const k = 1 - 0.1 * (1 - f);
        P.setXYZ(i, Math.sin(th) * 0.9 * k, P.getY(i), Math.cos(th) * 0.9 * k);
      }
      drumGeo.computeVertexNormals();
    })();
    const caelGeo = new THREE.CylinderGeometry(0.9, 1.0, 1, 48, 1, true);  // tambor inferior ensanchado
    caelGeo.translate(0, 0.5, 0);
    function voluteGeo(zc) {
      const pts = [];
      for (let i = 0; i <= 36; i++) {
        const th = i / 36 * Math.PI * 2.7, r = 0.4 * Math.exp(-0.16 * th) + 0.07;
        pts.push(new THREE.Vector3(r * Math.cos(th), 1.02 + r * Math.sin(th), zc));
      }
      return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 10, 0.07, 3, false);
    }
    const ECH = [[0.9, 0], [1.2, 0.1], [1.36, 0.34], [1.24, 0.56], [1.08, 0.7], [0.92, 0.72]];
    function echinusGeo(sc) { return new THREE.LatheGeometry(ECH.map(function (p) { return new THREE.Vector2(p[0] * sc, p[1]); }), 12); }
    const RED = new THREE.Color(0xa8322a), BLUE = new THREE.Color(0x2a4d8f), WHITE = new THREE.Color(1, 1, 1);
    const capGeo = mergeGeos([
      { g: echinusGeo(1) },
      { g: new THREE.BoxGeometry(1.9, 0.56, 1.9).translate(0, 1.02, 0) },
      { g: new THREE.BoxGeometry(2.2, 0.4, 2.2).translate(0, 1.5, 0) },
      { g: voluteGeo(0.98) }, { g: voluteGeo(-0.98) }
    ]);
    const capPaintGeo = mergeGeos([
      { g: echinusGeo(1.02), c: RED },
      { g: new THREE.BoxGeometry(2.24, 0.42, 2.24).translate(0, 1.5, 0), c: BLUE }
    ]);
    const PYB = [3.0, 3.9, 9.1, 14.2, 19.3];              // origen (base) de cada pieza en y
    const PHH = [0.9, 5.2, 5.1, 5.1, 1.7];                // altura de cada pieza

    const colD = [];
    let caelCount = 0;
    COLS.forEach(function (c, i) {
      const len = Math.hypot(c.x, c.z) || 1;
      const dx = c.x / len, dz = c.z / len, yaw = Math.atan2(-c.z, c.x);
      const ys = [];
      for (let m = 0; m < 5; m++) {
        const hxF = c.x + dx * (PYB[m] - 3 + PHH[m] * 0.5), hzF = c.z + dz * (PYB[m] - 3 + PHH[m] * 0.5);
        ys.push((Math.abs(hxF) <= HX && Math.abs(hzF) <= HZ) ? TP.stylobateY : 0);
      }
      colD.push({ x: c.x, z: c.z, dx: dx, dz: dz, qy: yawQ(yaw), caelIdx: c.caelata ? caelCount++ : -1,
        st: 0, fT: 0.05 + 0.45 * rnd(), thr: 0.88 * rnd(), ys: ys, broken: rnd() < 0.3 });
    });
    // orden de subida: de oeste (x negativa) a este
    colD.map(function (_, i) { return i; }).sort(function (a, b) { return COLS[a].x - COLS[b].x; })
      .forEach(function (idx, rank) { colD[idx].st = rank / NC * 0.3; });
    const EXTRA = 40;                                     // tambores caídos extra (ruina)
    const baseInst = new THREE.InstancedMesh(baseGeo, colMat, NC);
    const drumInst = new THREE.InstancedMesh(drumGeo, colMat, NC * 3 + EXTRA);
    const caelInst = new THREE.InstancedMesh(caelGeo, caelMat, Math.max(1, caelCount));
    const capInst = new THREE.InstancedMesh(capGeo, colMat, NC);
    const capPaintInst = new THREE.InstancedMesh(capPaintGeo, capPaintMat, NC);
    const colInsts = [baseInst, drumInst, caelInst, capInst];
    colInsts.forEach(function (m) {
      m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; root.add(m);
    });
    capPaintInst.frustumCulled = false; root.add(capPaintInst);
    colInsts.concat([capPaintInst]).forEach(function (m) {
      for (let i = 0; i < m.count; i++) { hide(m, i); m.setColorAt(i, WHITE); }
      m.instanceColor.needsUpdate = true;
    });
    colD.forEach(function (K0, i) { if (K0.caelIdx >= 0) hide(drumInst, i * 3); });  // la plana no se usa

    function setSoot(b) {
      const f = 1 - 0.82 * b, g2 = 1 - 0.84 * b, h2 = 1 - 0.86 * b;
      [baseInst, drumInst, caelInst, capInst].forEach(function (m) {
        for (let i = 0; i < m.count; i++) m.setColorAt(i, _tc.setRGB(f, g2, h2));
        m.instanceColor.needsUpdate = true;
      });
    }
    const _tc = new THREE.Color();
    const _T = new THREE.Vector3(), _R = new THREE.Quaternion(), _QL = new THREE.Quaternion(), _QP = new THREE.Quaternion();
    const _up = new THREE.Vector3(), _lp = new THREE.Vector3();
    const RS = [0, 0.9, 6.1, 11.2, 16.3];   // inicio radial de cada pieza tumbada (la columna yace de 0 a 18 m)
    function writeColumns(c, rr, dis) {
      for (let i = 0; i < NC; i++) {
        const K0 = colD[i];
        const keep = keepOf(dis, K0.thr);
        const eCol = smooth(clamp01((rr - K0.fT) / 0.45));     // cae hacia fuera girando sobre la basa
        const bb = smooth(clamp01((rr - K0.fT - 0.3) / 0.4));  // se rompe en tambores al tocar el suelo
        _T.set(K0.dz, 0, -K0.dx);
        _R.setFromAxisAngle(_T, Math.PI / 2);
        _QL.copy(_R).multiply(K0.qy);
        for (let m = 0; m < 5; m++) {
          const u = clamp01((c - (K0.st + m * 0.1)) / 0.28);
          const e = (K0.broken && m < 2) ? 0 : eCol;           // fuste roto: base y primer tambor quedan de pie
          const dy = (1 - smooth(u)) * 7;
          const show = u > 0 && keep > 0.001;
          const sp = bb * e * (m - 2) * 0.7;
          _up.set(K0.x, PYB[m] + dy, K0.z);
          _lp.set(K0.x + K0.dx * (RS[m] + sp), K0.ys[m] + 0.9, K0.z + K0.dz * (RS[m] + sp));
          _up.lerp(_lp, e);
          _QP.copy(K0.qy).slerp(_QL, e);
          const sy = (m === 0 || m === 4) ? keep : PHH[m] * keep;
          if (m === 1 && K0.caelIdx >= 0) {
            if (show) put(caelInst, K0.caelIdx, _up.x, _up.y, _up.z, _QP, keep, sy, keep); else hide(caelInst, K0.caelIdx);
          } else if (m === 0) {
            if (show) put(baseInst, i, _up.x, _up.y, _up.z, _QP, keep, keep, keep); else hide(baseInst, i);
          } else if (m === 4) {
            if (show) { put(capInst, i, _up.x, _up.y, _up.z, _QP, keep, keep, keep); put(capPaintInst, i, _up.x, _up.y, _up.z, _QP, keep, keep, keep); }
            else { hide(capInst, i); hide(capPaintInst, i); }
          } else {
            if (show) put(drumInst, i * 3 + (m - 1), _up.x, _up.y, _up.z, _QP, keep, sy, keep); else hide(drumInst, i * 3 + (m - 1));
          }
        }
      }
      [baseInst, drumInst, caelInst, capInst, capPaintInst].forEach(flush);
    }

    // ---------- 3. ARQUITRABES: un bloque sobre cada vano entre columnas (peristilo exterior e interior) ----------
    const beams = [];
    function span(ax, az, bx, bz) {
      const dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz), yaw = Math.atan2(-dz, dx);
      const S = clamp01((((ax + bx) / 2) + 58) / 116) * 0.8;     // orden oeste -> este
      beams.push({ x: (ax + bx) / 2, z: (az + bz) / 2, L: L + 1.9, qy: yawQ(yaw), S: S, TB: 0.02 + 0.45 * S, TD: 0.3 + 0.5 * S });
    }
    for (let i = 0; i < 20; i++) { span(-55 + 5.5 * i, -25, -55 + 5.5 * (i + 1), -25); span(-55 + 5.5 * i, 25, -55 + 5.5 * (i + 1), 25); }
    for (let k = 0; k < 7; k++) { const z0 = -25 + 50 * k / 7, z1 = -25 + 50 * (k + 1) / 7; span(-55, z0, -55, z1); span(55, z0, 55, z1); }
    for (let i = 0; i < 18; i++) { span(-49.5 + 5.5 * i, -19, -49.5 + 5.5 * (i + 1), -19); span(-49.5 + 5.5 * i, 19, -49.5 + 5.5 * (i + 1), 19); }
    for (let k = 0; k < 5; k++) { const z0 = -19 + 38 * k / 5, z1 = -19 + 38 * (k + 1) / 5; span(-49.5, z0, -49.5, z1); span(49.5, z0, 49.5, z1); }
    const NB = beams.length;
    const beamMat = new THREE.MeshStandardMaterial({ color: 0xefe6d6, roughness: 0.45, envMap: env, envMapIntensity: 0.5 });
    const beamInst = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), beamMat, NB);
    beamInst.castShadow = true; beamInst.receiveShadow = true; beamInst.frustumCulled = false;
    root.add(beamInst);
    for (let j = 0; j < NB; j++) hide(beamInst, j);
    const _bq = new THREE.Quaternion(), _roll = new THREE.Quaternion();
    function writeBeams(ar, rr, dis) {
      for (let j = 0; j < NB; j++) {
        const B = beams[j];
        const u = clamp01((ar - B.S) / 0.18);
        const dy = (1 - smooth(u)) * 2.5;                           // bajan sobre las columnas
        const e = smooth(clamp01((rr - B.TB) / 0.25));              // la ruina las tira al suelo
        const keep = keepOf(dis, B.TD);
        if (u <= 0 || keep <= 0.001) { hide(beamInst, j); continue; }
        _roll.setFromAxisAngle(AX, e * 1.1);
        _bq.copy(B.qy).multiply(_roll);
        put(beamInst, j, B.x, 21.6 + dy - e * 20.6, B.z, _bq, B.L * keep, 1.2 * keep, 1.7 * keep);
      }
      flush(beamInst);
    }

    // ---------- 4. CELLA: muros de sillares (una malla, escala vertical), puerta al oeste, pilastras ----------
    const cellaGeo = (function () {
      const H = TP.cella.wallH, L = [];
      const add = function (w, h, d, x, y, z) { L.push({ g: tiledBox(w, h, d, 4), m: T(x, y, z) }); };
      add(2 * (CH + 1.5), H, 1.5, 0, H / 2, -CHZ - 0.75);             // muro norte
      add(2 * (CH + 1.5), H, 1.5, 0, H / 2, CHZ + 0.75);              // muro sur
      add(1.5, H, 2 * CHZ, CH + 0.75, H / 2, 0);                      // muro este
      add(1.5, H, CHZ - 2, -(CH + 0.75), H / 2, -(CHZ + 2) / 2 - 0.0); // oeste, tramo norte
      add(1.5, H, CHZ - 2, -(CH + 0.75), H / 2, (CHZ + 2) / 2);       // oeste, tramo sur
      add(1.5, H - 7, 4, -(CH + 0.75), (7 + H) / 2, 0);               // dintel de la puerta (y 0..7 abierto)
      for (let x = -36; x <= 36; x += 6) {                             // pilastras interiores
        add(1.4, H, 1.0, x, H / 2, -CHZ + 0.5);
        add(1.4, H, 1.0, x, H / 2, CHZ - 0.5);
      }
      return mergeGeos(L);
    })();
    const cellaMesh = new THREE.Mesh(cellaGeo, sillarMat);
    cellaMesh.position.set(0, TP.stylobateY, 0);
    cellaMesh.castShadow = true; cellaMesh.receiveShadow = true; cellaMesh.frustumCulled = false;
    cellaMesh.visible = false;
    root.add(cellaMesh);

    // ---------- 5. TEJADO (pivote de caída > grupo con hijos en coordenadas de diseño) ----------
    const rfPivot = new THREE.Group(), rfG = new THREE.Group();
    rfPivot.position.set(0, EAVE, 0); rfPivot.add(rfG); rfG.position.set(0, -EAVE, 0);
    root.add(rfPivot);
    // faldones: centrales (hasta z=±12, cella abierta) y pórticos (hasta la cumbrera z=0, y=31)
    const roofParts = [];
    [1, -1].forEach(function (sg) {
      const n = [0, 1, sg * K];
      const nl = Math.hypot(n[0], n[1], n[2]); const nn = [n[0] / nl, n[1] / nl, n[2] / nl];
      const uvf = function (p) { return [p[0] / 4, (HZ - Math.abs(p[2])) / 4]; };
      function quad(x0, zA, x1, zB) {
        return [[x0, roofY(zA), zA], [x1, roofY(zA), zA], [x1, roofY(zB), zB], [x0, roofY(zB), zB]];
      }
      roofParts.push({ g: polyGeo(quad(-CH, sg * HZ, CH, sg * CHZ), nn, uvf) });
      roofParts.push({ g: polyGeo(quad(CH, sg * HZ, HX + 0.5, 0), nn, uvf) });
      roofParts.push({ g: polyGeo(quad(-HX - 0.5, sg * HZ, -CH, 0), nn, uvf) });
      // borde interior de la cella (faldón hacia dentro)
      const zI = sg * CHZ, yI = roofY(zI);
      roofParts.push({ g: polyGeo([[-CH, yI, zI], [CH, yI, zI], [CH, yI - 1.6, zI], [-CH, yI - 1.6, zI]], [0, 0, -sg], function (p) { return [p[0] / 4, p[1] / 4]; }) });
    });
    const roofGeo = mergeGeos(roofParts);
    const roofMesh = new THREE.Mesh(roofGeo, roofMat);
    roofMesh.castShadow = true; roofMesh.receiveShadow = true; roofMesh.frustumCulled = false;
    rfG.add(roofMesh);
    // hastiales interiores de los pórticos (x = ±40)
    const gableParts = [];
    [1, -1].forEach(function (sx) {
      const x = sx * CH, yI = roofY(CHZ);
      gableParts.push({ g: polyGeo([[x, EAVE, -CHZ], [x, EAVE, CHZ], [x, yI, CHZ], [x, RIDGE, 0], [x, yI, -CHZ]], [sx, 0, 0], function (p) { return [p[2] / 4, p[1] / 4]; }) });
    });
    const gableMesh = new THREE.Mesh(mergeGeos(gableParts), sillarMat);
    gableMesh.castShadow = true; gableMesh.receiveShadow = true; gableMesh.frustumCulled = false;
    rfG.add(gableMesh);
    // friso de caza (cuatro lados), con despliegue lado a lado
    const FR = (function makeFrieze(yc, hh, hx, hz) {
      const NS = [[1, 0], [0, -1], [0, 1], [-1, 0]], CKS = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
      const info = NS.map(function (n) {
        const nx = n[0], nz = n[1], isX = nx !== 0, d = (isX ? hx : hz) + 0.04;
        return { nx: nx, nz: nz, cx: nx * d, cz: nz * d, tx: -nz, tz: nx, L: isX ? hz : hx };
      });
      const P = new Float32Array(48), N = new Float32Array(48), U = new Float32Array(32), I = [];
      info.forEach(function (f, i) {
        for (let k = 0; k < 4; k++) {
          const c = CKS[k], vi = i * 4 + k;
          P[vi * 3] = f.cx + f.tx * c[0] * f.L; P[vi * 3 + 1] = yc + c[1] * hh / 2; P[vi * 3 + 2] = f.cz + f.tz * c[0] * f.L;
          N[vi * 3] = f.nx; N[vi * 3 + 1] = 0; N[vi * 3 + 2] = f.nz;
          U[vi * 2] = (i + (c[0] + 1) / 2) / 4; U[vi * 2 + 1] = (c[1] + 1) / 2;
        }
        const b = i * 4; I.push(b, b + 1, b + 2, b, b + 2, b + 3);
      });
      const geo = new THREE.BufferGeometry();
      const pa = new THREE.BufferAttribute(P, 3);
      geo.setAttribute('position', pa);
      geo.setAttribute('normal', new THREE.BufferAttribute(N, 3));
      geo.setAttribute('uv', new THREE.BufferAttribute(U, 2));
      geo.setIndex(I);
      const last = [-1, -1, -1, -1];
      return {
        geo: geo,
        reveal: function (rev) {
          let dirty = false;
          for (let i = 0; i < 4; i++) {
            const r = rev[i];
            if (Math.abs(r - last[i]) < 0.002) continue;
            last[i] = r; dirty = true;
            const f = info[i];
            for (let k = 0; k < 4; k++) {
              const c = CKS[k], vi = i * 4 + k;
              P[vi * 3] = f.cx + f.tx * c[0] * f.L * r; P[vi * 3 + 2] = f.cz + f.tz * c[0] * f.L * r;
            }
          }
          if (dirty) pa.needsUpdate = true;
        }
      };
    })(22.8, 1.2, 56.3, 26.3);
    const frieze = new THREE.Mesh(FR.geo, frMat);
    const friezeP = new THREE.Mesh(FR.geo, frPaintMat);
    frieze.frustumCulled = false; friezeP.frustumCulled = false;
    rfG.add(frieze); rfG.add(friezeP);
    // cornisa y dentellones bajo ella
    const cornice = new THREE.Mesh(ringGeo(HX, HZ, EAVE - 0.9, 0.9, 1.2), sillarMat);
    cornice.castShadow = true; cornice.receiveShadow = true; cornice.frustumCulled = false;
    rfG.add(cornice);
    const DEN = [];
    for (let x = -56.6; x <= 56.6; x += 0.6) { DEN.push([x, EAVE - 1.08, -26.6]); DEN.push([x, EAVE - 1.08, 26.6]); }
    for (let z = -25.8; z <= 25.8; z += 0.6) { DEN.push([-56.6, EAVE - 1.08, z]); DEN.push([56.6, EAVE - 1.08, z]); }
    const denInst = new THREE.InstancedMesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), colMat, DEN.length);
    denInst.frustumCulled = false; denInst.castShadow = true;
    DEN.forEach(function (p, i) { put(denInst, i, p[0], p[1], p[2], null, 1, 1, 1); });
    flush(denInst);
    rfG.add(denInst);
    // vigas de cedro bajo los faldones
    const RAF = [];
    for (let xi = -55; xi <= 55.01; xi += 1.1) {
      [1, -1].forEach(function (sg) {
        const zB = Math.abs(xi) < CH ? sg * CHZ : 0;
        RAF.push({ x: xi, zA: sg * HZ, zB: zB });
      });
    }
    const rafInst = new THREE.InstancedMesh(new THREE.BoxGeometry(0.22, 0.28, 1), cedarMat, RAF.length);
    rafInst.frustumCulled = false; rafInst.castShadow = true;
    const _dir = new THREE.Vector3(), _mid = new THREE.Vector3();
    RAF.forEach(function (R, i) {
      const yA = roofY(R.zA), yB = roofY(R.zB);
      _dir.set(0, yB - yA, R.zB - R.zA);
      const L = _dir.length(); _dir.normalize();
      _mid.set(R.x, (yA + yB) / 2 - 0.3, (R.zA + R.zB) / 2);
      const q = new THREE.Quaternion().setFromUnitVectors(ZA, _dir);
      put(rafInst, i, _mid.x, _mid.y, _mid.z, q, 1, 1, L);
    });
    flush(rafInst);
    rfG.add(rafInst);
    // frontones con relieve (en x = ±57.6) y cornisas rampantes y acróteras
    const pedParts = [];
    [1, -1].forEach(function (sx) {
      const x = sx * (HX + 0.1);
      pedParts.push({ g: polyGeo([[x, EAVE, -HZ], [x, EAVE, HZ], [x, RIDGE, 0]], [sx, 0, 0], function (p) { return [(p[2] + HZ) / (2 * HZ), (p[1] - EAVE) / (RIDGE - EAVE)]; }) });
    });
    const pedGeo = mergeGeos(pedParts);
    const pedimentMesh = new THREE.Mesh(pedGeo, pedMat);
    const pedimentP = new THREE.Mesh(pedGeo, pedPaintMat);
    pedimentMesh.frustumCulled = false; pedimentP.frustumCulled = false;
    rfG.add(pedimentMesh); rfG.add(pedimentP);
    const rakeParts = [], acroParts = [];
    const cone = function (x, y, z) { acroParts.push({ g: new THREE.ConeGeometry(0.5, 1.6, 10), m: T(x, y, z) }); };
    [1, -1].forEach(function (sx) {
      cone(sx * HX, RIDGE + 0.8, 0); cone(sx * HX, EAVE + 0.8, HZ); cone(sx * HX, EAVE + 0.8, -HZ);
      [1, -1].forEach(function (sg) {
        const dir = new THREE.Vector3(0, RIDGE - EAVE, -sg * HZ).normalize();
        const L = Math.hypot(HZ, RIDGE - EAVE);
        const q = new THREE.Quaternion().setFromUnitVectors(ZA, dir);
        const mm = new THREE.Matrix4().compose(new THREE.Vector3(sx * (HX + 0.1), (EAVE + RIDGE) / 2 + 0.3, sg * HZ / 2), q, new THREE.Vector3(1, 1, 1));
        rakeParts.push({ g: tiledBox(1.2, 0.9, L + 0.4, 4), m: mm });
      });
    });
    const rake = new THREE.Mesh(mergeGeos(rakeParts), colMat);
    const acro = new THREE.Mesh(mergeGeos(acroParts), colMat);
    rake.castShadow = true; acro.castShadow = true; rake.frustumCulled = false; acro.frustumCulled = false;
    rfG.add(rake); rfG.add(acro);

    // ---------- 6. PLANTILLA DE RUINA: cimientos y charcas (solo al desmontar) ----------
    const ruinStoneMat = new THREE.MeshStandardMaterial({ color: 0x8e8270, roughness: 0.95 });
    const fdnMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), ruinStoneMat, 90);
    fdnMesh.castShadow = true; fdnMesh.receiveShadow = true; fdnMesh.frustumCulled = false; fdnMesh.visible = false;
    for (let i = 0; i < 90; i++) {
      const sx = 1.6 + 2.6 * rnd(), sy = 0.5 + 0.5 * rnd(), sz = 1.2 + 2.2 * rnd();
      put(fdnMesh, i, (rnd() * 2 - 1) * 60, 0.05 + 0.2 * rnd(), (rnd() * 2 - 1) * 31, yawQ(rnd() * Math.PI), sx, sy, sz);
    }
    flush(fdnMesh);
    root.add(fdnMesh);
    const grassMat = new THREE.MeshStandardMaterial({ color: 0x5f7a34, roughness: 0.9 });
    const grassInst = new THREE.InstancedMesh(new THREE.ConeGeometry(0.12, 0.55, 3).translate(0, 0.275, 0), grassMat, 320);
    grassInst.frustumCulled = false; grassInst.visible = false;
    for (let i = 0; i < 320; i++) put(grassInst, i, (rnd() * 2 - 1) * 60, 0.0, (rnd() * 2 - 1) * 31, yawQ(rnd() * Math.PI), 1, 0.8 + 0.6 * rnd(), 1);
    flush(grassInst);
    root.add(grassInst);
    const puddle = new THREE.Mesh(new THREE.PlaneGeometry(120.4, 60.4).rotateX(-Math.PI / 2), puddleMat);
    puddle.position.y = 0.22; puddle.visible = false; puddle.frustumCulled = false;
    root.add(puddle);

    // ---------- 7. FUEGO: llamas en tejado y vigas (tarjetas con shader), humo negro, chispas, luz naranja ----------
    const flameGeo = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);
    const FL = 56, flameSpec = [];
    for (let k = 0; k < FL; k++) {
      const x = (rnd() * 2 - 1) * 54;
      const zc = Math.abs(x) < CH ? CHZ + rnd() * 15 : rnd() * HZ;
      const z = (k % 2 ? 1 : -1) * zc;
      flameSpec.push({ x: x, z: z, thr: rnd() * 0.6, w: 3.5 + rnd() * 2.5, h: 6 + rnd() * 7, ph: rnd() * 6, q: yawQ(rnd() * Math.PI) });
    }
    const flameInst = new THREE.InstancedMesh(flameGeo, flameMat, FL);
    flameInst.frustumCulled = false;
    for (let k = 0; k < FL; k++) hide(flameInst, k);
    flush(flameInst);
    const flameG = new THREE.Group();
    flameG.add(flameInst); root.add(flameG);
    flameG.visible = false;

    const SN = 90, SM = [];
    for (let k = 0; k < SN; k++) SM.push({ x: (rnd() * 2 - 1) * 40, z: (rnd() * 2 - 1) * 18 });
    const smokeGeo = new THREE.BufferGeometry();
    const smokeArr = new Float32Array(SN * 3);
    smokeGeo.setAttribute('position', new THREE.BufferAttribute(smokeArr, 3));
    const smokePts = new THREE.Points(smokeGeo, smokeMat);
    smokePts.frustumCulled = false; smokePts.visible = false; root.add(smokePts);
    const SP = 110, sparkArr = new Float32Array(SP * 3), sparkSeed = [];
    for (let k = 0; k < SP; k++) sparkSeed.push({ x: (rnd() * 2 - 1) * 36, z: (rnd() * 2 - 1) * 16, p: rnd() });
    const sparkGeo = new THREE.BufferGeometry();
    sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkArr, 3));
    const sparks = new THREE.Points(sparkGeo, sparkMat);
    sparks.frustumCulled = false; sparks.visible = false; root.add(sparks);
    const fireLights = [];
    [[-30, 27, 14], [30, 27, -14], [0, 29, 0]].forEach(function (p) {
      const L = new THREE.PointLight(0xff8a2a, 0, 70, 1.6);
      L.position.set(p[0], p[1], p[2]); root.add(L); fireLights.push(L);
    });

    // ---------- 8. FANTASMA DE PRÓLOGO: templo completo translúcido dorado con aristas ----------
    const ghostParts = [];
    COLS.forEach(function (c) { ghostParts.push({ g: new THREE.CylinderGeometry(0.9, 0.9, 18, 8, 1, false), m: T(c.x, 12, c.z) }); });
    ghostParts.push({ g: ringGeo(HX, HZ, 21.0, 3.5, 1.5) });
    ghostParts.push({ g: roofGeo });
    ghostParts.push({ g: gableParts[0].g }); ghostParts.push({ g: gableParts[1].g });
    ghostParts.push({ g: pedGeo });
    const ghostShell = mergeGeos(ghostParts);
    const ghostG = new THREE.Group();
    ghostG.add(new THREE.Mesh(ghostShell, ghostMat));
    ghostG.add(new THREE.LineSegments(new THREE.EdgesGeometry(ghostShell, 30), ghostEdgeMat));
    ghostG.visible = false;
    root.add(ghostG);

    // ---------- 9. RUINA: bloques y tambores sólidos caídos por el suelo ----------
    const NRB = 60, RUB = [];
    for (let i = 0; i < NRB; i++) {
      const a = rnd() * Math.PI * 2, r = 14 + 50 * rnd();
      RUB.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, sx: 1.2 + 1.8 * rnd(), sy: 0.8 + 0.6 * rnd(), sz: 1 + 1.4 * rnd(),
        q: yawQ(rnd() * Math.PI), thr: 0.05 + 0.6 * rnd(), thrD: 0.3 + 0.6 * rnd() });
    }
    const rubInst = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), sillarMat, NRB);
    rubInst.castShadow = true; rubInst.receiveShadow = true; rubInst.frustumCulled = false;
    root.add(rubInst);
    for (let i = 0; i < NRB; i++) hide(rubInst, i);
    const RUBD = [];
    for (let j = 0; j < EXTRA; j++) {
      const a = rnd() * Math.PI * 2, r = 16 + 46 * rnd();
      RUBD.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, q: yawQ(rnd() * Math.PI), thr: 0.1 + 0.6 * rnd(), thrD: 0.3 + 0.6 * rnd() });
    }
    const _lq = new THREE.Quaternion().setFromAxisAngle(ZA, Math.PI / 2);
    const _rq = new THREE.Quaternion();
    function writeRubble(rr, dis) {
      for (let i = 0; i < NRB; i++) {
        const R0 = RUB[i];
        const loc = clamp01((rr - R0.thr) / 0.3), kp = keepOf(dis, R0.thrD);
        if (loc <= 0 || kp <= 0.001) { hide(rubInst, i); continue; }
        put(rubInst, i, R0.x, R0.sy * 0.5 * kp + (1 - smooth(loc)) * 14, R0.z, R0.q, R0.sx * kp, R0.sy * kp, R0.sz * kp);
      }
      flush(rubInst);
      for (let j = 0; j < EXTRA; j++) {
        const D0 = RUBD[j], idx = NC * 3 + j;
        const loc = clamp01((rr - D0.thr) / 0.25), kp = keepOf(dis, D0.thrD);
        if (loc <= 0 || kp <= 0.001) { hide(drumInst, idx); continue; }
        _rq.copy(D0.q).multiply(_lq);
        put(drumInst, idx, D0.x, 0.9 + (1 - smooth(loc)) * 14, D0.z, _rq, kp, 1.6 * kp, kp);
      }
      flush(drumInst);
    }

    // piezas del tejado y de los frontones que caen al suelo al romperse (sustituyen al tejado en la ruina)
    const RRN = 50, RRB = [];
    for (let i = 0; i < RRN; i++) {
      const a = rnd() * Math.PI * 2, r = 4 + 52 * rnd();
      RRB.push({ x: Math.cos(a) * r, z: Math.sin(a) * r * 0.6, sx: 1.5 + 2.5 * rnd(), sy: 0.35 + 0.5 * rnd(), sz: 1.5 + 2.5 * rnd(),
        q: yawQ(rnd() * Math.PI), thr: 0.4 + 0.45 * rnd(), thrD: 0.3 + 0.6 * rnd() });
    }
    const roofRubInst = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), roofMat, RRN);
    roofRubInst.castShadow = true; roofRubInst.receiveShadow = true; roofRubInst.frustumCulled = false;
    for (let i = 0; i < RRN; i++) hide(roofRubInst, i);
    root.add(roofRubInst);
    function writeRoofRub(rr, dis) {
      for (let i = 0; i < RRN; i++) {
        const B0 = RRB[i];
        const loc = clamp01((rr - B0.thr) / 0.3), kp = keepOf(dis, B0.thrD);
        if (loc <= 0 || kp <= 0.001) { hide(roofRubInst, i); continue; }
        put(roofRubInst, i, B0.x, B0.sy * 0.5 * kp + (1 - smooth(loc)) * 20, B0.z, B0.q, B0.sx * kp, B0.sy * kp, B0.sz * kp);
      }
      flush(roofRubInst);
    }

    // ---------- estado por fotograma ----------
    let lastPf = -1, lastDis = -1, lastBu = -1;
    const SKY = { y0: EAVE, pv: 0 };
    function writeFire(fi, gh, bu, wall, rr) {
      const sag = 4 * bu;
      flameG.visible = fi > 0.001 || gh > 0.001;
      flameG.position.y = -sag;
      flameMat.uniforms.uT.value = wall;
      flameMat.uniforms.uI.value = Math.max(fi, gh * 0.9);
      flameMat.uniforms.uPh.value = 1 - clamp01(fi * 4);
      for (let k = 0; k < FL; k++) {
        const F = flameSpec[k];
        const f = Math.max(smooth(clamp01((fi - F.thr) / 0.25)), gh * 0.9);
        if (f <= 0.001) { hide(flameInst, k); continue; }
        const flick = 0.85 + 0.15 * Math.sin(wall * 9 + F.ph);
        put(flameInst, k, F.x, roofY(F.z) + 0.2, F.z, F.q, F.w * f, F.h * f * flick, 1);
      }
      flush(flameInst);
      smokeMat.opacity = 0.85 * fi; smokePts.visible = fi > 0.01;
      sparkMat.opacity = fi; sparks.visible = fi > 0.2;
      if (fi > 0.01) {
        for (let k = 0; k < SN; k++) {
          const a = (wall * 0.08 + k / SN) % 1;
          smokeArr[3 * k] = SM[k].x + Math.sin(a * 5 + k) * 2.5 + a * 10;
          smokeArr[3 * k + 1] = 28 + a * 130;
          smokeArr[3 * k + 2] = SM[k].z - a * 6;
        }
        smokeGeo.attributes.position.needsUpdate = true;
      }
      if (fi > 0.2) {
        for (let k = 0; k < SP; k++) {
          const sd = sparkSeed[k], a = (wall * 0.6 + sd.p) % 1;
          sparkArr[3 * k] = sd.x + Math.sin(a * 7 + k) * 3;
          sparkArr[3 * k + 1] = 27 + a * 40;
          sparkArr[3 * k + 2] = sd.z;
        }
        sparkGeo.attributes.position.needsUpdate = true;
      }
      for (let k = 0; k < 3; k++) fireLights[k].intensity = 3.0 * fi * (0.85 + 0.15 * Math.sin(wall * 9 + k * 2)) * (1 - 0.5 * rr);
    }

    function update(s) {
      const gh = clamp01(s.ghost || 0), pf = clamp01(s.platform || 0), c = clamp01(s.columns || 0);
      const ca = clamp01(s.caelatae || 0), ar = clamp01(s.architrave || 0), rf = clamp01(s.roof || 0);
      const pa = clamp01(s.paint || 0), fi = clamp01(s.fire || 0), bu = clamp01(s.burned || 0);
      const rr = clamp01(s.goths || 0), dis = clamp01(s.dismantle || 0), wall = s.wall || 0;

      // plataforma
      if (pf !== lastPf || dis !== lastDis) { lastPf = pf; lastDis = dis; writeSteps(pf, dis); }
      stepMesh.visible = pf > 0.0001;
      fdnMesh.visible = dis > 0.001; grassInst.visible = dis > 0.001;
      puddle.visible = dis > 0.001;
      puddleMat.opacity = 0.9 * smooth(clamp01((dis - 0.3) / 0.6));

      // columnas, caelatae (relieves), arquitrabes y cella
      if (bu !== lastBu) { lastBu = bu; setSoot(bu); }
      writeColumns(c, rr, dis);
      caelMat.bumpScale = 2.6 * ca;
      writeBeams(ar, rr, dis);
      const kc = keepOf(dis, 0.2);
      const cellaF = ar * (1 - 0.8 * smooth(clamp01((rr - 0.1) / 0.5))) * kc;
      cellaMesh.visible = cellaF > 0.002;
      cellaMesh.scale.set(Math.max(0.001, kc), Math.max(0.001, cellaF), Math.max(0.001, kc));

      // tejado: sube con grúas, se hunde con el incendio y cae con el saqueo
      const kr = keepOf(dis, 0.05);
      const sr = smooth(clamp01(rr / 0.45));
      rfPivot.position.set(0, EAVE + (1 - smooth(rf)) * 2 - 2 * bu - sr * 16, 0);
      rfPivot.rotation.x = 0.8 * sr;
      rfPivot.scale.setScalar(Math.max(0.001, kr));
      rfPivot.visible = rf > 0.001 && kr > 0.001 && rr < 0.45;
      roofMat.color.setScalar(1 - 0.5 * bu);
      cedarMat.color.setRGB(0.54 - 0.4 * bu, 0.35 - 0.25 * bu, 0.17 - 0.12 * bu);
      FR.reveal([0, 1, 2, 3].map(function (i) { return smooth(clamp01((rf - i * 0.18) / 0.4)); }));
      frieze.visible = rf > 0.001;
      const paintOn = pa > 0.001;
      frPaintMat.opacity = pa; friezeP.visible = paintOn;
      pedPaintMat.opacity = pa; pedimentP.visible = paintOn;
      capPaintMat.opacity = pa; capPaintInst.visible = paintOn && rr < 0.02;

      // incendio y fantasma (las llamas van con el tejado hundido)
      writeFire(fi, gh, bu, wall, rr);

      // prólogo fantasma
      ghostG.visible = gh > 0.001;
      ghostMat.opacity = 0.42 * gh;
      ghostEdgeMat.opacity = 0.9 * gh;

      // ruina y desmontaje
      writeRubble(rr, dis);
      writeRoofRub(rr, dis);
    }

    [baseInst, drumInst, caelInst, capInst, capPaintInst, beamInst, denInst, rafInst, flameInst, rubInst].forEach(function (m) { m.visible = true; });
    return { update: update, group: root };
  };
})();
