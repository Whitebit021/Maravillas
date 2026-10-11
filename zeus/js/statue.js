// Estatua de Zeus en Olimpia (criselefantina): figura sentada de superficies continuas (tubos, lofts y
// superelipsoides), piel de marfil con corte por plano, manto y pelo de oro con PMREM, trono de ebano con
// incrustaciones, Nike y cetro con aguila, brillo, rayos X, incendio y fusion del oro. Todo procedural.
// Coordenadas LOCALES (origen = centro de la basa, y=0 en su cara superior); root esta en ZEUS.origin.
// Estado s = funcion pura (sin acumulacion).
(function () {
  'use strict';
  const G = window.GIZA;

  const clamp01 = function (x) { return x < 0 ? 0 : (x > 1 ? 1 : x); };
  const smooth = function (x) { x = clamp01(x); return x * x * (3 - 2 * x); };
  const gss = function (v) { return Math.exp(-v * v); };
  const lerp = function (a, b, t) { return a + (b - a) * t; };
  const fract = function (x) { return x - Math.floor(x); };
  const num = function (v) { return (typeof v === 'number' && isFinite(v)) ? v : 0; };
  function rng(seed) {
    return function () {
      seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  G.createStatue = function (ctx) {
    const THREE = ctx.THREE, scene = ctx.scene, renderer = ctx.renderer, camera = ctx.camera;
    const Z = G.ZEUS;
    const O = Z.origin;
    const rnd = rng(4242);
    const M = new THREE.Matrix4(), P = new THREE.Vector3(), S = new THREE.Vector3(), Q = new THREE.Quaternion();
    const ZS = new THREE.Vector3(0, 0, 0), IDM = new THREE.Matrix4(), Q0 = new THREE.Quaternion();
    const UP = new THREE.Vector3(0, 1, 0), ZAX = new THREE.Vector3(0, 0, 1), XAX = new THREE.Vector3(1, 0, 0);
    const HX = Z.joints.head[0], HY = Z.joints.head[1], HZ = Z.joints.head[2];
    const HR = 2.1;                       // radio de referencia de la cabeza (unidades relativas)
    const HK = Z.radii.head / HR;         // relativo -> metros
    const CREAM = new THREE.Color(0xf2e6cf), ASH = new THREE.Color(0x1c1814);
    const GOLD = new THREE.Color(0xd4a63c), MOLTEN = new THREE.Color(0xff8a2a);
    const EBONY = new THREE.Color(0x2a1d14), CHAR = new THREE.Color(0x0d0a08);

    if (renderer) renderer.localClippingEnabled = true;

    const root = new THREE.Group();
    root.position.set(O[0], O[1], O[2]);
    scene.add(root);
    const statueG = new THREE.Group(), throneG = new THREE.Group(), baseG = new THREE.Group(), attrG = new THREE.Group();
    root.add(statueG); root.add(throneG); root.add(baseG); root.add(attrG);

    // ---------- texturas ----------
    function mkCanvas(w, h, draw) {
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      draw(c.getContext('2d'), w, h);
      return c;
    }
    function texOf(c, srgb) {
      const t = new THREE.CanvasTexture(c);
      if (srgb) t.encoding = THREE.sRGBEncoding;
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      return t;
    }
    // marfil: placas con juntas finas (color claro, la misma imagen sirve de relieve)
    const ivoryCanvas = mkCanvas(512, 512, function (g, w, h) {
      const r = rng(5);
      g.fillStyle = '#f6f2e8'; g.fillRect(0, 0, w, h);
      const rows = 5, ph = h / rows;                                  // placas irregulares por hileras
      for (let j = 0; j < rows; j++) {
        const y = j * ph, off = r() * w;
        let x = off - w * 0.5;
        while (x < w * 1.5) {
          const pw = w * (0.12 + r() * 0.12);
          g.fillStyle = 'rgba(' + (246 - (r() * 10 | 0)) + ',' + (240 - (r() * 12 | 0)) + ',' + (226 - (r() * 14 | 0)) + ',1)';
          g.fillRect(x + 1.5, y + 1.5, pw - 3, ph - 3);
          g.strokeStyle = 'rgba(150,122,90,0.22)'; g.lineWidth = 1.5; g.strokeRect(x, y, pw, ph);
          x += pw;
        }
      }
      for (let i = 0; i < 2400; i++) {
        g.fillStyle = r() > 0.5 ? 'rgba(255,255,255,0.08)' : 'rgba(120,96,60,0.06)';
        g.fillRect(r() * w, r() * h, 2, 2);
      }
    });
    // oro del manto: lirios y pequenas figuritas (color multiplica al oro; el relieve usa la misma imagen)
    const lilyCanvas = mkCanvas(512, 512, function (g, w, h) {
      const r = rng(12);
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
      const lily = function (x, y, s) {
        g.fillStyle = 'rgba(170,120,40,0.4)';
        for (let k = 0; k < 6; k++) {
          const a = k * Math.PI / 3;
          g.beginPath(); g.ellipse(x + Math.cos(a) * s * 0.5, y + Math.sin(a) * s * 0.5, s * 0.52, s * 0.2, a, 0, Math.PI * 2); g.fill();
        }
        g.fillStyle = 'rgba(245,215,130,0.5)'; g.beginPath(); g.arc(x, y, s * 0.14, 0, Math.PI * 2); g.fill();
      };
      for (let gy = 0; gy < 6; gy++) for (let gx = 0; gx < 6; gx++) {
        lily((gx + 0.5 + (gy % 2) * 0.5) * w / 6, (gy + 0.5) * h / 6, 22);
      }
      for (let i = 0; i < 180; i++) {
        g.fillStyle = 'rgba(120,80,20,0.55)';
        g.beginPath(); g.arc(r() * w, r() * h, 2 + r() * 2, 0, Math.PI * 2); g.fill();
      }
      g.strokeStyle = 'rgba(110,70,15,0.7)'; g.lineWidth = 5; g.strokeRect(0, 0, w, h);   // franja del pliegue
    });
    const ebonyTex = texOf(mkCanvas(256, 256, function (g, w, h) {
      g.fillStyle = '#2a1d14'; g.fillRect(0, 0, w, h);
      const r = rng(77);
      for (let i = 0; i < 70; i++) {
        g.strokeStyle = r() > 0.5 ? 'rgba(0,0,0,0.35)' : 'rgba(120,85,50,0.18)';
        g.lineWidth = 0.6 + r() * 1.6;
        const y0 = r() * h;
        g.beginPath(); g.moveTo(0, y0);
        for (let x = 0; x <= w; x += 32) g.lineTo(x, y0 + Math.sin(x * 0.03 + i) * 6 + (r() - 0.5) * 3);
        g.stroke();
      }
    }), true);
    const stoneTex = texOf(mkCanvas(256, 256, function (g, w, h) {
      g.fillStyle = '#1d1d21'; g.fillRect(0, 0, w, h);
      const r = rng(8);
      for (let i = 0; i < 900; i++) {
        g.fillStyle = r() > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.3)';
        g.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2);
      }
      for (let i = 0; i < 8; i++) {
        g.strokeStyle = 'rgba(190,190,205,0.09)'; g.lineWidth = 1 + r();
        g.beginPath(); g.moveTo(r() * w, r() * h);
        g.bezierCurveTo(r() * w, r() * h, r() * w, r() * h, r() * w, r() * h); g.stroke();
      }
    }), true);
    const glowTex = texOf(mkCanvas(256, 256, function (g, w, h) {
      const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      gr.addColorStop(0, 'rgba(255,240,190,1)'); gr.addColorStop(0.25, 'rgba(255,205,110,0.55)');
      gr.addColorStop(1, 'rgba(255,190,80,0)');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    }), true);
    const flameTex = texOf(mkCanvas(128, 256, function (g, w, h) {
      const gr = g.createRadialGradient(w / 2, h * 0.7, 0, w / 2, h * 0.7, h * 0.7);
      gr.addColorStop(0, 'rgba(255,235,170,1)'); gr.addColorStop(0.35, 'rgba(255,150,50,0.7)');
      gr.addColorStop(1, 'rgba(200,60,0,0)');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      const r = rng(3);
      for (let i = 0; i < 14; i++) {
        g.fillStyle = 'rgba(255,170,60,0.22)';
        g.beginPath(); g.ellipse(w / 2 + (r() - 0.5) * w * 0.4, h * (0.3 + r() * 0.5), 6 + r() * 12, 20 + r() * 40, 0, 0, Math.PI * 2); g.fill();
      }
    }), true);
    const smokeTex = texOf(mkCanvas(128, 128, function (g, w, h) {
      const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      gr.addColorStop(0, 'rgba(90,80,72,0.8)'); gr.addColorStop(0.6, 'rgba(60,52,46,0.35)');
      gr.addColorStop(1, 'rgba(40,34,30,0)');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    }), true);
    const ivoryTex = texOf(ivoryCanvas, true);
    const ivoryBump = texOf(ivoryCanvas, false);
    const lilyTex = texOf(lilyCanvas, true);
    const lilyBump = texOf(lilyCanvas, false);

    // ---------- entorno PMREM: interior calido con lamparas (el oro necesita reflejos) ----------
    let envTex = null;
    try {
      const envScene = new THREE.Scene();
      const skyTex = texOf(mkCanvas(512, 256, function (g, w, h) {
        const gr = g.createLinearGradient(0, 0, 0, h);
        gr.addColorStop(0, '#4a3d2a'); gr.addColorStop(0.45, '#8a7452'); gr.addColorStop(0.5, '#d8c08a');
        gr.addColorStop(0.56, '#3a2a18'); gr.addColorStop(1, '#120c07');
        g.fillStyle = gr; g.fillRect(0, 0, w, h);
      }), true);
      envScene.add(new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16),
        new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide })));
      const lampMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 3.8, 2.0), side: THREE.DoubleSide });
      [[-30, 22, 20], [30, 18, -18], [0, 30, 0]].forEach(function (p) {
        const pl = new THREE.Mesh(new THREE.PlaneGeometry(9, 6), lampMat);
        pl.position.set(p[0], p[1], p[2]); pl.lookAt(0, 0, 0); envScene.add(pl);
      });
      const pm = new THREE.PMREMGenerator(renderer);
      envTex = pm.fromScene(envScene, 0.03).texture;
      pm.dispose();
    } catch (e) { envTex = null; }

    // ---------- materiales ----------
    const cutIvory = new THREE.Plane(new THREE.Vector3(0, -1, 0), 1e5);   // conserva y <= constante (mundo)
    const cutGold = new THREE.Plane(new THREE.Vector3(0, -1, 0), 1e5);
    const cutThrone = new THREE.Plane(new THREE.Vector3(0, -1, 0), 1e5);
    const glowList = [];
    // borde incandescente en el plano de corte (como el bronce del coloso)
    function glowShader(mat, plane, color, strength) {
      const u = { uCut: { value: 1e5 }, uHot: { value: 0 } };
      mat.onBeforeCompile = function (sh) {
        sh.uniforms.uCut = u.uCut; sh.uniforms.uHot = u.uHot;
        sh.vertexShader = 'varying float vWY;\n' + sh.vertexShader.replace('#include <project_vertex>',
          '#include <project_vertex>\n  { vec4 wpi = vec4(transformed, 1.0);\n#ifdef USE_INSTANCING\n    wpi = instanceMatrix * wpi;\n#endif\n    vWY = (modelMatrix * wpi).y; }');
        sh.fragmentShader = 'uniform float uCut; uniform float uHot;\nvarying float vWY;\n' +
          sh.fragmentShader.replace('#include <emissivemap_fragment>',
            '#include <emissivemap_fragment>\n  { float eb = (1.0 - smoothstep(0.0, 0.3, abs(vWY - uCut))) * uHot;\n' +
            '    totalEmissiveRadiance += ' + color + ' * eb * ' + strength + '; }');
      };
      glowList.push({ u: u, plane: plane });
    }

    const ivoryMat = new THREE.MeshStandardMaterial({
      color: 0xf2e6cf, map: ivoryTex, bumpMap: ivoryBump, bumpScale: 0.12, roughness: 0.42, metalness: 0,
      vertexColors: true, side: THREE.DoubleSide, transparent: true,
      clippingPlanes: [cutIvory], clipShadows: true
    });
    glowShader(ivoryMat, cutIvory, 'vec3(1.0, 0.72, 0.38)', '0.22');

    function goldMaterial(map, bump, plane, glow) {
      const o = { color: 0xd4a63c, metalness: 1.0, roughness: 0.24, envMap: envTex, envMapIntensity: 1.0,
        side: THREE.DoubleSide, transparent: true };
      if (map) o.map = map;
      if (bump) { o.bumpMap = bump; o.bumpScale = 0.9; }
      if (plane) { o.clippingPlanes = [plane]; o.clipShadows = true; }
      const m = new THREE.MeshStandardMaterial(o);
      if (glow) glowShader(m, plane, 'vec3(1.0, 0.6, 0.25)', '0.25');
      return m;
    }
    const goldMantle = goldMaterial(lilyTex, lilyBump, cutGold, true);
    const goldStat = goldMaterial(null, null, cutGold, true);      // pelo, barba, corona, sandalias
    const goldFree = goldMaterial(null, null, null, false);        // Nike, cetro y aguila (sin corte)
    const goldThrone = goldMaterial(null, null, cutThrone, false);
    const goldBase = goldMaterial(null, null, null, false);
    const ebonyMat = new THREE.MeshStandardMaterial({ color: 0x2a1d14, map: ebonyTex, roughness: 0.5, metalness: 0.05,
      envMap: envTex, envMapIntensity: 0.6, transparent: true, clippingPlanes: [cutThrone], clipShadows: true });
    const throneIvory = new THREE.MeshStandardMaterial({ color: 0xf2e6cf, roughness: 0.4, transparent: true,
      clippingPlanes: [cutThrone], clipShadows: true });
    const nikeIvory = new THREE.MeshStandardMaterial({ color: 0xf2e6cf, map: ivoryTex, roughness: 0.42, transparent: true, side: THREE.DoubleSide });
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x1b1b1e, map: stoneTex, roughness: 0.28, metalness: 0.0,
      envMap: envTex, envMapIntensity: 0.7 });
    const gemMatThrone = new THREE.MeshBasicMaterial({ color: 0xffffff, clippingPlanes: [cutThrone], clipShadows: false });
    const gemMatFree = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const glintMat = new THREE.MeshBasicMaterial({ map: glowTex, color: 0xfff0c0, transparent: true, opacity: 1,
      depthWrite: false, blending: THREE.AdditiveBlending });
    const dropMat = new THREE.MeshBasicMaterial({ color: 0xffc070, transparent: true, opacity: 0.95 });
    const flameMat = new THREE.MeshBasicMaterial({ map: flameTex, color: 0xffa040, transparent: true, opacity: 0.85,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const smokeMat = new THREE.MeshBasicMaterial({ map: smokeTex, color: 0x2a211c, transparent: true, opacity: 0.5,
      depthWrite: false, side: THREE.DoubleSide });

    // ---------- utilidades de geometria ----------
    function Acc() { this.p = []; this.n = []; this.u = []; this.c = []; this.i = []; this.nv = 0; }
    Acc.prototype.add = function (geo, m, tint) {
      const Pa = geo.attributes.position, Na = geo.attributes.normal, Ua = geo.attributes.uv, Ca = geo.attributes.color;
      const nm = new THREE.Matrix3().getNormalMatrix(m);
      const v = new THREE.Vector3(), w = new THREE.Vector3();
      const cnt = Pa.count, t = tint || [1, 1, 1];
      for (let k = 0; k < cnt; k++) {
        v.fromBufferAttribute(Pa, k).applyMatrix4(m);
        this.p.push(v.x, v.y, v.z);
        if (Na) { w.fromBufferAttribute(Na, k).applyMatrix3(nm).normalize(); this.n.push(w.x, w.y, w.z); }
        else this.n.push(0, 1, 0);
        if (Ua) this.u.push(Ua.getX(k), Ua.getY(k)); else this.u.push(0, 0);
        if (Ca) this.c.push(Ca.getX(k) * t[0], Ca.getY(k) * t[1], Ca.getZ(k) * t[2]);
        else this.c.push(t[0], t[1], t[2]);
      }
      if (geo.index) { const I = geo.index; for (let k = 0; k < I.count; k++) this.i.push(I.getX(k) + this.nv); }
      else for (let k = 0; k < cnt; k++) this.i.push(k + this.nv);
      this.nv += cnt;
    };
    Acc.prototype.geometry = function () {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(this.u, 2));
      g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
      g.setIndex(new THREE.Uint32BufferAttribute(this.i, 1));
      return g;
    };
    function gridIdx(R, C, wrap) {
      const idx = [], jm = wrap ? C : C - 1;
      for (let i = 0; i < R - 1; i++) {
        for (let j = 0; j < jm; j++) {
          const a = i * C + j, b = i * C + (j + 1) % C, c = (i + 1) * C + j, d = (i + 1) * C + (j + 1) % C;
          idx.push(a, c, b, b, c, d);
        }
      }
      return idx;
    }
    function buildGeo(pos, uv, idx, col) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      if (col) g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      g.setIndex(idx);
      g.computeVertexNormals();
      return g;
    }
    function crRad(rads, k) {
      const n = rads.length, i = Math.min(n - 2, Math.floor(k)), u = k - i;
      const p0 = rads[Math.max(0, i - 1)], p1 = rads[i], p2 = rads[i + 1], p3 = rads[Math.min(n - 1, i + 2)];
      return 0.5 * ((2 * p1) + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u + (-p0 + 3 * p1 - 3 * p2 + p3) * u * u * u);
    }
    // pliegues: surcos profundos que recorren el tubo (periodicos en el angulo)
    function pleat(a, u) {
      const c = 0.5 + 0.5 * Math.cos(9 * a + 6.2832 * 3 * u);
      return -0.55 * Math.pow(c, 2.4) + 0.2 * Math.sin(3 * a - 6.2832 * 2 * u);
    }
    // un miembro = UN tubo continuo con muchos segmentos y radio suave
    function tubeGeo(pts, rads, seg, R, uk, vl, fold) {
      const curve = new THREE.CatmullRomCurve3(pts.map(function (p) { return new THREE.Vector3(p[0], p[1], p[2]); }));
      const pos = [], uv = [];
      const T = new THREE.Vector3(), Nn = new THREE.Vector3(), B = new THREE.Vector3(), Pp = new THREE.Vector3(), ref = new THREE.Vector3();
      let len = 0, prev = null;
      for (let i = 0; i <= seg; i++) {
        const u = i / seg;
        curve.getPoint(u, Pp); curve.getTangent(u, T);
        const r0 = crRad(rads, u * (rads.length - 1));
        if (prev) len += Pp.distanceTo(prev);
        prev = Pp.clone();
        if (Math.abs(T.y) > 0.9) ref.set(1, 0, 0); else ref.set(0, 1, 0);
        Nn.crossVectors(T, ref).normalize(); B.crossVectors(Nn, T).normalize();
        for (let j = 0; j < R; j++) {
          const a = 2 * Math.PI * j / R;
          const r = fold ? r0 * (1 + fold * pleat(a, u)) : r0;
          const ca = Math.cos(a) * r, sa = Math.sin(a) * r;
          pos.push(Pp.x + Nn.x * ca + B.x * sa, Pp.y + Nn.y * ca + B.y * sa, Pp.z + Nn.z * ca + B.z * sa);
          uv.push(j / R * uk, len / vl);
        }
      }
      return buildGeo(pos, uv, gridIdx(seg + 1, R, true));
    }
    // superficie de revolucion alrededor del eje Y: filas [y, cx, a (frente-atras), b (lateral)]
    function rowAt(rows, y) {
      if (y <= rows[0][0]) return rows[0].slice(1);
      for (let i = 1; i < rows.length; i++) {
        if (y <= rows[i][0]) {
          const A = rows[i - 1], B = rows[i], u = smooth((y - A[0]) / (B[0] - A[0]));
          return [lerp(A[1], B[1], u), lerp(A[2], B[2], u), lerp(A[3], B[3], u)];
        }
      }
      return rows[rows.length - 1].slice(1);
    }
    function loft(rows, y0, y1, n, segs, def, uk, vl) {
      const pos = [], uv = [];
      for (let i = 0; i < n; i++) {
        const y = lerp(y0, y1, i / (n - 1));
        const q = rowAt(rows, y), cx = q[0], a = q[1], b = q[2];
        for (let j = 0; j < segs; j++) {
          const th = 2 * Math.PI * j / segs, c = Math.cos(th), s = Math.sin(th);
          const z = b * s;
          const x = cx + a * c + (def ? def(c, y, z) : 0);
          pos.push(x, y, z);
          uv.push(j / segs * uk, y / vl);
        }
      }
      return buildGeo(pos, uv, gridIdx(n, segs, true));
    }
    // esfera parametrica (polos incluidos); colorFn opcional -> [r,g,b] por vertice
    function sphereGrid(R, C, fn, colorFn, uU, uV) {
      const pos = [], uv = [], col = colorFn ? [] : null;
      for (let i = 0; i < R; i++) {
        const th = Math.PI * i / (R - 1), st = Math.sin(th), ct = Math.cos(th);
        for (let j = 0; j < C; j++) {
          const ph = 2 * Math.PI * j / C;
          const ux = st * Math.cos(ph), uy = ct, uz = st * Math.sin(ph);
          const p = fn(ux, uy, uz);
          pos.push(p[0], p[1], p[2]);
          uv.push(j / C * (uU || 1), i / (R - 1) * (uV || 1));
          if (col) { const c = colorFn(ux, uy, uz); col.push(c[0], c[1], c[2]); }
        }
      }
      const g = buildGeo(pos, uv, gridIdx(R, C, true), col);
      const N = g.attributes.normal;
      for (let j = 0; j < C; j++) {
        N.setXYZ(j, 0, 1, 0);
        N.setXYZ((R - 1) * C + j, 0, -1, 0);
      }
      N.needsUpdate = true;
      return g;
    }
    // superelipsoide redondeada (bloques, sillas, columnas) de superficie continua
    function superGeo(c, h, e, R, C) {
      const pe = function (v) { return (v < 0 ? -1 : 1) * Math.pow(Math.abs(v), e); };
      return sphereGrid(R, C, function (ux, uy, uz) {
        return [c[0] + h[0] * pe(ux), c[1] + h[1] * pe(uy), c[2] + h[2] * pe(uz)];
      });
    }
    // lazo cerrado de rectangulo redondeado en el plano x = X0 (para aros de oro)
    function rrLoop(X0, yc, zc, hy, hz, p, n) {
      const pts = [];
      for (let k = 0; k <= n; k++) {
        const t = 2 * Math.PI * k / n, c = Math.cos(t), s = Math.sin(t);
        pts.push([X0, yc + hy * Math.sign(c) * Math.pow(Math.abs(c), p), zc + hz * Math.sign(s) * Math.pow(Math.abs(s), p)]);
      }
      return pts;
    }
    // ala: lamina curvada con plumas en el borde (root: base, d: envergadura, cd: cuerda hacia atras)
    function wingGeo(root, dir, L, chord, cdv, R, C) {
      const pos = [], uv = [];
      const d = new THREE.Vector3(dir[0], dir[1], dir[2]).normalize();
      const cd = new THREE.Vector3(cdv[0], cdv[1], cdv[2]).normalize();
      const nrm = new THREE.Vector3().crossVectors(d, cd).normalize();
      for (let i = 0; i < R; i++) {
        const u = i / (R - 1);
        const cl = chord * (0.45 + 0.55 * Math.sin(Math.PI * (0.15 + 0.85 * u)));
        for (let j = 0; j < C; j++) {
          const v = j / (C - 1);
          const bx = root[0] + d.x * L * u, by = root[1] + d.y * L * u + 0.25 * L * u * u, bz = root[2] + d.z * L * u;
          const bulge = 0.09 * Math.sin(Math.PI * v) * (1 - 0.5 * u);
          const scallop = (v > 0.85) ? 0.04 * Math.abs(Math.sin(u * Math.PI * 14)) * (v - 0.85) / 0.15 : 0;
          const ch = cl * (v + scallop);
          pos.push(bx + cd.x * ch + nrm.x * bulge, by + cd.y * ch + nrm.y * bulge, bz + cd.z * ch + nrm.z * bulge);
          uv.push(u * 2, v * 2);
        }
      }
      return buildGeo(pos, uv, gridIdx(R, C, false));
    }

    // ---------- ensamblado: primitivas y tubos sobre el acumulador ----------
    const SPH = new THREE.SphereGeometry(1, 24, 16);
    const SPHB = new THREE.SphereGeometry(1, 36, 24);
    const DARK_EYE = [0.25, 0.18, 0.12];
    function ell(acc, c, s, tint, geo) {
      M.compose(P.set(c[0], c[1], c[2]), Q0, S.set(s[0], s[1], s[2]));
      acc.add(geo || SPH, M, tint);
    }
    function place(acc, geo, c, q, s, tint) {
      M.compose(P.set(c[0], c[1], c[2]), q, S.set(s[0], s[1], s[2]));
      acc.add(geo, M, tint);
    }
    function TUBE(acc, pts, rads, seg, R, uk, fold, vl) {
      acc.add(tubeGeo(pts, rads, seg, R, uk || 1, vl || 3.2, fold || 0), IDM);
    }
    function ellRing(cx, y, a, b, n) {                       // anillo horizontal (cintura del manto)
      const pts = [];
      for (let k = 0; k <= n; k++) {
        const th = 2 * Math.PI * k / n;
        pts.push([cx + a * Math.cos(th), y, b * Math.sin(th)]);
      }
      return pts;
    }
    // Victoria pequena sobre una pata: cuerpo, cabeza y alas (sx = +1 mira a +X, -1 a -X)
    function victoria(acc, x, z, sx) {
      TUBE(acc, [[x, 2.6, z], [x + sx * 0.05, 1.9, z], [x + sx * 0.1, 1.2, z]], [0.16, 0.2, 0.17], 12, 14, 1);
      ell(acc, [x + sx * 0.04, 2.85, z], [0.13, 0.14, 0.13]);
      ell(acc, [x - sx * 0.14, 2.5, z + 0.24], [0.06, 0.42, 0.24]);
      ell(acc, [x - sx * 0.14, 2.5, z - 0.24], [0.06, 0.42, 0.24]);
    }

    // ---------- cabeza: superficie continua con rasgos (sereno, nariz recta, ojos, barba) ----------
    // coordenadas relativas (HR = 2.1), frente = -z (se mapea a +X), lateral = x (se mapea a Z)
    function hd(x, y, z) { return [HX - z * HK, HY + y * HK, HZ + x * HK]; }
    function skullRel(ux, uy, uz) {
      const px = ux * HR, py = uy * HR, pz = uz * HR;
      let x = px, y = py * 1.08, z = pz * 1.04;
      const nx = x / HR, ny = y / HR, nz = z / HR;
      const front = Math.max(0, -nz);
      const low = smooth((0.05 - ny) / 0.9);
      x *= 1 - 0.18 * low;                                                                   // mandibula
      z -= 0.1 * low * front;
      z -= 0.2 * gss(nx / 0.33) * gss((ny + 0.82) / 0.25) * front;                           // menton
      z -= 0.1 * gss((ny - 0.4) / 0.14) * front * (1 - 0.4 * Math.abs(nx));                  // arcada
      z -= 0.22 * gss(nx / 0.1) * gss((ny - 0.08) / 0.32) * front;                           // nariz recta
      x += 0.1 * Math.sign(nx) * gss((ny + 0.08) / 0.22) * gss((Math.abs(nx) - 0.72) / 0.22) * front; // pomulos
      z += 0.05 * gss((ny - 0.12) / 0.14) * gss((Math.abs(nx) - 0.4) / 0.18) * front;        // cuencas
      z += 0.03 * gss((ny + 0.3) / 0.12) * gss(nx / 0.22) * front;                           // surco labial
      return [x, y, z];
    }
    const EYES = [[0.72, 0.28, -1.9], [-0.72, 0.28, -1.9]];
    function skullColor(ux, uy, uz) {
      const hx = ux * HR, hy = uy * HR * 1.08, hz = uz * HR * 1.04;
      let de = 9;
      for (let k = 0; k < 2; k++) de = Math.min(de, Math.hypot(hx - EYES[k][0], hy - EYES[k][1], hz - EYES[k][2]));
      const front = uz < 0 ? 1 : 0;
      const dark = 0.5 * gss(de / 0.42) * front;
      const lip = 0.4 * gss((hy + 1.0) / 0.1) * gss(hx / 0.45) * front;
      const k = 1 - Math.min(0.85, dark + lip);
      return [k, k * 0.92, k * 0.85];
    }
    function hairVis(uy, uz) {
      const top = smooth((uy - 0.25) / 0.3), front = smooth((-uz - 0.25) / 0.45), low = smooth((uy + 0.42) / 0.3);
      return Math.max(top, 1 - front) * low;
    }
    function hairRel(ux, uy, uz) {
      const r = lerp(1.9, 2.5, hairVis(uy, uz));
      return [ux * r, uy * r * 1.08, uz * r * 1.04];
    }
    function beardMask(uy, uz) {
      return smooth((-0.62 - uy) / 0.18) * smooth((-uz - 0.1) / 0.3) * (1 - smooth((-uy - 1.0) / 0.1));
    }
    function beardRel(ux, uy, uz) {
      const b = skullRel(ux, uy, uz), s = 0.9 + 0.42 * beardMask(uy, uz);
      return [b[0] * s, b[1] * s, b[2] * s];
    }

    // ---------- piezas de marfil (piel) ----------
    const ivA = new Acc();
    ivA.add(sphereGrid(40, 48, function (a, b, c) { const p = skullRel(a, b, c); return hd(p[0], p[1], p[2]); }, skullColor, 4, 2), IDM);
    [-1, 1].forEach(function (sg) {
      ell(ivA, hd(sg * 1.95, -0.1, 0.1), [0.1, 0.22, 0.13]);                               // orejas
      ell(ivA, hd(sg * 0.72, 0.28, -2.12), [0.07, 0.055, 0.13], DARK_EYE);                  // ojos (oscuros, serenos)
    });
    TUBE(ivA, [[-1.0, 9.9, 0], [-0.95, 10.5, 0], [-0.9, 10.9, 0]], [0.72, 0.6, 0.66], 16, 20);   // cuello

    const TORSO_ROWS = [[5.6, -0.6, 1.2, 1.85], [6.6, -0.6, 1.15, 1.7], [7.6, -0.65, 1.3, 1.85],
      [8.6, -0.7, 1.45, 2.1], [9.4, -0.75, 1.35, 2.25], [10.1, -0.8, 0.95, 1.2]];
    function torsoDef(c, y, z) {                                                         // pectorales, abdomen, esternon
      const front = Math.max(0, c), lat = Math.abs(z);
      let d = 0;
      d -= 0.32 * gss((y - 8.4) / 0.7) * gss((lat - 1.05) / 0.65) * Math.pow(front, 0.7);
      d += 0.1 * gss(lat / 0.14) * gss((y - 8.2) / 1.4) * front;
      d -= 0.12 * gss((lat - 1.5) / 0.35) * gss((y - 6.9) / 0.9) * Math.pow(front, 0.6);
      let ab = 0; const YC = [6.3, 7.0, 7.7];
      for (let k = 0; k < 3; k++) ab += gss((y - YC[k]) / 0.3);
      d -= 0.14 * Math.min(1, ab) * gss((lat - 0.42) / 0.3) * gss((y - 7.0) / 1.6) * Math.pow(front, 0.5);
      d += 0.04 * gss(lat / 0.1) * gss((y - 7.0) / 1.6) * front;
      d -= 0.06 * gss((lat - 1.2) / 0.4) * gss((y - 9.6) / 0.25) * front;
      return d;
    }
    ivA.add(loft(TORSO_ROWS, 5.6, 10.1, 36, 48, torsoDef, 3, 3.2), IDM);

    // brazo izquierdo (sostiene el cetro) y derecho (sostiene a Nike)
    TUBE(ivA, [[-1.0, 9.6, -2.0], [-0.6, 9.0, -2.8], [0.4, 10.0, -2.6]], [0.65, 0.5, 0.42], 30, 22, 3);
    ell(ivA, [0.4, 10.0, -2.6], [0.36, 0.32, 0.34]);                                       // puno del cetro
    TUBE(ivA, [[-1.0, 9.6, 2.0], [0.4, 7.6, 2.4], [2.2, 7.45, 2.2]], [0.65, 0.5, 0.4], 30, 22, 3);
    ell(ivA, [2.5, 7.45, 2.2], [0.46, 0.17, 0.42]);                                        // palma (sobre ella, Nike)
    ell(ivA, [2.15, 7.5, 2.0], [0.2, 0.14, 0.18]);                                         // pulgar
    // piernas (bajo el manto)
    [-1, 1].forEach(function (s) {
      TUBE(ivA, [[-0.5, 5.2, s * 1.4], [2.6, 5.4, s * 1.5]], [1.0, 0.9], 20, 22, 3);
      TUBE(ivA, [[2.6, 5.4, s * 1.5], [2.8, 3.0, s * 1.45], [2.9, 0.9, s * 1.4]], [0.75, 0.65, 0.45], 24, 22, 3);
      TUBE(ivA, [[2.9, 0.9, s * 1.4], [3.7, 0.85, s * 1.4]], [0.42, 0.32], 8, 14, 1);     // pie
    });

    // ---------- manto de oro: lap, pliegues en las piernas y banda sobre el hombro izquierdo ----------
    const manA = new Acc();
    const LAP_ROWS = [[4.5, -0.25, 1.75, 2.55], [5.6, -0.25, 1.85, 2.65], [6.6, -0.4, 1.5, 2.15]];
    manA.add(loft(LAP_ROWS, 4.5, 6.6, 14, 48, null, 2.5, 3.2), IDM);
    TUBE(manA, ellRing(-0.4, 6.6, 1.55, 2.2, 28), [0.2], 60, 10, 1, 0, 3.2);             // ribete de cintura
    [-1, 1].forEach(function (s) {
      TUBE(manA, [[-0.5, 5.2, s * 1.4], [2.6, 5.4, s * 1.5], [2.8, 3.0, s * 1.45], [2.9, 0.8, s * 1.4]],
        [1.25, 1.2, 1.0, 0.8], 40, 32, 2.5, 0.09, 3.2);                                    // manto sobre cada pierna (pliegues)
    });
    TUBE(manA, [[-2.6, 8.8, -2.0], [-1.4, 10.6, -2.3], [-0.2, 10.1, -2.9], [0.1, 8.6, -3.0], [-0.2, 7.4, -2.8]],
      [0.5, 0.55, 0.55, 0.5, 0.45], 36, 20, 1.5, 0.06, 3.2);                                // sobre el hombro izquierdo

    // ---------- oro del cuerpo: pelo, barba, corona de olivo, sandalias ----------
    const goA = new Acc();
    goA.add(sphereGrid(44, 56, function (a, b, c) { const p = hairRel(a, b, c); return hd(p[0], p[1], p[2]); }, null, 3, 2), IDM);
    goA.add(sphereGrid(40, 48, function (a, b, c) { const p = beardRel(a, b, c); return hd(p[0], p[1], p[2]); }, null, 2, 2), IDM);
    // corona de olivo: aro sobre el pelo y hojas
    const crownM = new THREE.Matrix4().compose(P.set(HX, HY + 0.5, HZ), Q.setFromAxisAngle(XAX, Math.PI / 2), S.set(1, 1, 1));
    const crownGeo = new THREE.TorusGeometry(0.84, 0.05, 8, 40);
    goA.add(crownGeo, crownM);
    const leafGeo = new THREE.SphereGeometry(1, 8, 6);
    for (let k = 0; k < 28; k++) {
      const a = 2 * Math.PI * k / 28;
      const qy = new THREE.Quaternion().setFromAxisAngle(UP, -a);
      const qz = new THREE.Quaternion().setFromAxisAngle(ZAX, 0.5 + 0.25 * rnd());
      place(goA, leafGeo, [HX + Math.cos(a) * 0.9, HY + 0.6 + rnd() * 0.05, HZ + Math.sin(a) * 0.9], qy.multiply(qz),
        [0.2, 0.04, 0.075]);
    }
    // sandalias: suela y correas sobre el escabel
    [-1, 1].forEach(function (s) {
      goA.add(superGeo([3.05, 0.6, s * 1.4], [0.8, 0.12, 0.45], 0.3, 12, 16), IDM);
      TUBE(goA, [[2.55, 0.92, s * 0.95], [2.95, 1.12, s * 1.4], [3.45, 0.92, s * 0.95]], [0.09, 0.1, 0.09], 14, 10, 1);
    });

    // ---------- curls (rizos de oro, instanciados sobre el pelo y la barba) ----------
    const curlPos = [], curlNrm = [], curlSz = [];
    {
      const N = 2600, MAXH = 220, MAXB = 110;
      let nh = 0, nb = 0;
      for (let i = 0; i < N; i++) {
        const y = 1 - 2 * (i + 0.5) / N, r = Math.sqrt(Math.max(0, 1 - y * y)), ph = i * 2.39996;
        const ux = r * Math.cos(ph), uy = y, uz = r * Math.sin(ph);
        let rel = null, sz = 0;
        if (uy > 0.3 && hairVis(uy, uz) >= 0.85 && nh < MAXH) { rel = hairRel(ux, uy, uz); sz = 0.085; nh++; }
        else if (beardMask(uy, uz) > 0.6 && nb < MAXB) { rel = beardRel(ux, uy, uz); sz = 0.075; nb++; }
        if (!rel) continue;
        const cx = HX - rel[2] * HK, cy = HY + rel[1] * HK, cz = HZ + rel[0] * HK;
        const nx = -rel[2] * HK, ny = rel[1] * HK, nz = rel[0] * HK;
        const nl = Math.hypot(nx, ny, nz) || 1;
        curlPos.push([cx + nx / nl * 0.04, cy + ny / nl * 0.04, cz + nz / nl * 0.04]);
        curlNrm.push([nx / nl, ny / nl, nz / nl]);
        curlSz.push(sz * (0.85 + 0.3 * rnd()));
      }
    }
    const curlCount = curlPos.length;
    const curlMesh = new THREE.InstancedMesh(new THREE.TorusGeometry(1, 0.3, 4, 6), goldStat, Math.max(1, curlCount));
    for (let i = 0; i < curlCount; i++) {
      const n = new THREE.Vector3().fromArray(curlNrm[i]);
      Q.setFromUnitVectors(ZAX, n);
      M.compose(P.fromArray(curlPos[i]), Q, S.setScalar(curlSz[i]));
      curlMesh.setMatrixAt(i, M);
    }
    curlMesh.instanceMatrix.needsUpdate = true;
    curlMesh.castShadow = true; curlMesh.frustumCulled = false;

    // ---------- trono: ebano, oro, marfil y gemas ----------
    const thW = new Acc(), thG = new Acc(), thI = new Acc();
    const gemP = [];
    thW.add(superGeo([-0.2, 0.25, 0], [2.4, 0.25, 2.85], 0.2, 14, 22), IDM);                 // plinto
    thW.add(superGeo([3.05, 0.25, 0], [0.85, 0.25, 2.2], 0.25, 14, 22), IDM);                // escabel
    thG.add(superGeo([3.05, 0.52, 0], [0.9, 0.04, 2.25], 0.4, 12, 18), IDM);
    const LEGS = [[1.2, 2.0, 1], [1.2, -2.0, 1], [-1.8, 2.0, -1], [-1.8, -2.0, -1]];   // x, z, sentido
    LEGS.forEach(function (L) {
      thW.add(superGeo([L[0], 1.95, L[1]], [0.5, 1.45, 0.5], 0.3, 16, 24), IDM);
      victoria(thG, L[0] + L[2] * 0.52, L[1], L[2]);                                    // Victoria en cada pata
    });
    [1.2, -1.8].forEach(function (x) {                                                 // travesanos
      [1.2, 2.5].forEach(function (y) {
        thW.add(superGeo([x, y, 0], [0.16, 0.16, 2.0], 0.4, 10, 18), IDM);
        ell(thG, [x + (x > 0 ? 0.16 : -0.16), y, 0], [0.06, 0.2, 0.2]);
      });
    });
    [-1, 1].forEach(function (s) {
      [1.2, 2.5].forEach(function (y) {
        thW.add(superGeo([-0.3, y, s * 2.0], [1.5, 0.16, 0.16], 0.4, 10, 18), IDM);
      });
    });
    thW.add(superGeo([-0.2, 4.0, 0], [2.0, 0.6, 2.45], 0.3, 18, 28), IDM);                     // asiento
    thG.add(superGeo([-0.2, 4.56, 0], [2.04, 0.08, 2.5], 0.4, 14, 26), IDM);                   // lamina de oro del asiento
    thW.add(superGeo([-2.3, 8.05, 0], [0.3, 3.45, 2.45], 0.25, 20, 30), IDM);                  // respaldo
    thG.add(superGeo([-2.3, 11.6, 0], [0.22, 0.3, 0.8], 0.3, 10, 16), IDM);                    // cresta dorada
    const backLoop = rrLoop(-1.97, 8.05, 0, 3.1, 2.1, 0.25, 72);
    TUBE(thG, backLoop, [0.07], 160, 6, 1, 0, 3.2);
    TUBE(thG, rrLoop(-1.96, 8.05, 0, 2.7, 1.75, 0.3, 72), [0.04], 120, 6, 1, 0, 3.2);
    for (let k = 0; k < 72; k += 6) gemP.push(backLoop[k]);
    thI.add(superGeo([-1.95, 8.1, 0], [0.05, 1.15, 0.95], 0.35, 14, 22), IDM);                 // medallon de marfil
    [-1, 1].forEach(function (sg) {
      const z = sg * 2.35;
      thW.add(superGeo([-1.0, 6.0, z], [1.0, 0.4, 0.45], 0.3, 14, 22), IDM);                  // reposabrazos
      thW.add(superGeo([-0.3, 5.3, z], [0.35, 0.8, 0.35], 0.3, 12, 18), IDM);                 // soporte frontal
      // esfinge en el frente del reposabrazos
      thG.add(superGeo([-0.75, 6.85, z], [0.85, 0.35, 0.38], 0.35, 14, 22), IDM);
      ell(thG, [-0.1, 7.25, z], [0.34, 0.4, 0.32]);
      thG.add(superGeo([-0.14, 7.6, z], [0.28, 0.3, 0.38], 0.3, 10, 16), IDM);              // nemes
      gemP.push([-0.5, 6.42, z], [-1.4, 6.42, z]);
    });
    gemP.push([3.25, 0.56, 1.0], [2.85, 0.56, -1.0]);                                          // escabel

    // ---------- Nike (de pie sobre la palma derecha) y cetro con aguila ----------
    const nkI = new Acc(), nkG = new Acc(), scG = new Acc();
    nkG.add(loft([[0.03, 0, 0.13, 0.16], [0.5, 0, 0.11, 0.14], [0.95, 0, 0.1, 0.13], [1.2, 0, 0.12, 0.15], [1.28, 0, 0.11, 0.12]],
      0.03, 1.28, 22, 32, function (c, y, z) { return 0.02 * Math.sin(z * 38) * Math.abs(c); }, 2, 1), IDM);   // quitón plegado
    TUBE(nkI, [[0, 1.25, 0], [0.0, 1.38, 0]], [0.05, 0.04], 6, 12, 1);                    // cuello
    ell(nkI, [0.01, 1.47, 0], [0.09, 0.1, 0.08]);                                           // cabeza
    TUBE(nkI, [[0, 1.24, 0.14], [0.1, 1.1, 0.2], [0.22, 1.18, 0.22]], [0.05, 0.04, 0.035], 12, 12, 1);   // brazo que ofrece la corona
    TUBE(nkI, [[0, 1.24, -0.14], [0.03, 1.0, -0.2], [0.08, 0.88, -0.18]], [0.05, 0.04, 0.035], 12, 12, 1);
    const wreathM = new THREE.Matrix4().compose(P.set(0.3, 1.22, 0.2), Q.setFromAxisAngle(UP, Math.PI / 2), S.set(1, 1, 1));
    nkG.add(new THREE.TorusGeometry(0.1, 0.015, 6, 20), wreathM);
    nkG.add(wingGeo([-0.04, 1.3, 0.12], [-0.1, 0.3, 1.0], 1.05, 0.5, [-0.55, 0.85, 0], 16, 10), IDM);
    nkG.add(wingGeo([-0.04, 1.3, -0.12], [-0.1, 0.3, -1.0], 1.05, 0.5, [-0.55, 0.85, 0], 16, 10), IDM);

    // cetro (ZEUS.scepter): asta con nudos, capitel y aguila de alas abiertas
    const SC = Z.scepter;
    TUBE(scG, [[SC.x, SC.y0, SC.z], [SC.x, 4.0, SC.z], [SC.x, 8.0, SC.z], [SC.x, SC.y1, SC.z]], [0.13, 0.14, 0.14, 0.12], 40, 12, 1, 0, 3.2);
    const knobs = [2.0, 4.6, 8.4, 11.6];
    knobs.forEach(function (y) { ell(scG, [SC.x, y, SC.z], [0.24, 0.24, 0.24]); });
    ell(scG, [SC.x, 12.3, SC.z], [0.3, 0.22, 0.3]);
    ell(scG, [SC.x, 0.7, SC.z], [0.32, 0.22, 0.32]);                                        // pie
    ell(scG, [SC.x, 12.85, SC.z], [0.2, 0.32, 0.2]);                                        // cuerpo del aguila
    ell(scG, [SC.x + 0.12, 13.25, SC.z], [0.13, 0.13, 0.12]);                               // cabeza
    TUBE(scG, [[SC.x + 0.22, 13.22, SC.z], [SC.x + 0.36, 13.1, SC.z]], [0.07, 0.02], 6, 8, 1);   // pico
    scG.add(wingGeo([SC.x, 12.9, -0.1 + SC.z], [0, 0.25, 1], 0.95, 0.42, [-1, 0.2, 0], 16, 10), IDM);
    scG.add(wingGeo([SC.x, 12.9, 0.1 + SC.z], [0, 0.25, -1], 0.95, 0.42, [-1, 0.2, 0], 16, 10), IDM);
    const gemScepP = [[SC.x, 2.0, SC.z - 0.24], [SC.x, 4.6, SC.z - 0.24], [SC.x, 8.4, SC.z - 0.24], [SC.x, 11.6, SC.z - 0.24]];

    // ---------- base de piedra negra con relieves dorados en el frente ----------
    const bsG = new Acc();
    [-2.2, 0, 2.2].forEach(function (z) {
      bsG.add(superGeo([5.0, -0.5, z], [0.06, 0.38, 0.7], 0.3, 10, 16), IDM);
      TUBE(bsG, rrLoop(5.09, -0.5, z, 0.42, 0.78, 0.25, 48), [0.04], 96, 6, 1, 0, 3.2);
    });
    TUBE(bsG, [[5.1, -0.05, 0], [5.14, -0.3, 0], [5.13, -0.62, 0]], [0.1, 0.11, 0.09], 16, 10, 1);   // figura central
    ell(bsG, [5.12, 0.18, 0], [0.07, 0.11, 0.09]);
    TUBE(bsG, [[5.1, 0.05, -0.16], [5.12, 0.15, 0.0], [5.1, 0.05, 0.16]], [0.03, 0.03, 0.03], 8, 8, 1);
    const baseGeo = new THREE.BoxGeometry(10, 1, 6.5);
    baseGeo.translate(0, -0.5, 0);

    // ---------- piezas de piel, manto y oro ----------
    function meshFrom(acc, mat, cast) {
      if (!acc.nv) return null;
      const m = new THREE.Mesh(acc.geometry(), mat);
      m.castShadow = !!cast; m.receiveShadow = true; m.frustumCulled = false;
      return m;
    }
    const ivoryMesh = meshFrom(ivA, ivoryMat, true);
    const mantleMesh = meshFrom(manA, goldMantle, true);
    const statGoldMesh = meshFrom(goA, goldStat, true);
    const thWoodMesh = meshFrom(thW, ebonyMat, true);
    const thGoldMesh = meshFrom(thG, goldThrone, true);
    const thIvoryMesh = meshFrom(thI, throneIvory, false);
    const nkIvoryMesh = meshFrom(nkI, nikeIvory, false);
    const nkGoldMesh = meshFrom(nkG, goldFree, false);
    const scMesh = meshFrom(scG, goldFree, false);
    const bsGoldMesh = meshFrom(bsG, goldBase, false);
    [ivoryMesh, mantleMesh, statGoldMesh].forEach(function (m) { if (m) statueG.add(m); });
    statueG.add(curlMesh);
    [thWoodMesh, thGoldMesh, thIvoryMesh].forEach(function (m) { if (m) throneG.add(m); });
    if (bsGoldMesh) baseG.add(bsGoldMesh);
    baseG.add(new THREE.Mesh(baseGeo, stoneMat));
    baseG.children[baseG.children.length - 1].receiveShadow = true;

    // gemas (puntos de colores suaves) en el trono y en el cetro
    const GEMC = ['#d7263d', '#2e86de', '#1e9e5a', '#f4d35e', '#8e44ad'].map(function (c) { return new THREE.Color(c); });
    function gemMesh(pts, mat, parent) {
      if (!pts.length) return;
      const gm = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.09, 0), mat, pts.length);
      for (let i = 0; i < pts.length; i++) {
        M.compose(P.fromArray(pts[i]), Q0, S.setScalar(0.8 + rnd() * 0.5));
        gm.setMatrixAt(i, M);
        gm.setColorAt(i, GEMC[(rnd() * GEMC.length) | 0].clone().multiplyScalar(0.9));
      }
      gm.instanceMatrix.needsUpdate = true;
      if (gm.instanceColor) gm.instanceColor.needsUpdate = true;
      gm.frustumCulled = false;
      parent.add(gm);
    }
    gemMesh(gemP, gemMatThrone, throneG);
    gemMesh(gemScepP, gemMatFree, attrG);

    // Nike y cetro: grupo que crece al aparecer (origen en la palma y en el suelo)
    const nikeG = new THREE.Group();
    nikeG.position.set(2.5, 7.64, 2.2);
    if (nkIvoryMesh) nikeG.add(nkIvoryMesh);
    if (nkGoldMesh) nikeG.add(nkGoldMesh);
    const scepG = new THREE.Group();
    if (scMesh) scepG.add(scMesh);
    attrG.add(nikeG); attrG.add(scepG);

    // ---------- destellos, gotas de oro fundido, llamas y humo ----------
    const GL = 36;
    const glintMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), glintMat, GL);
    glintMesh.frustumCulled = false;
    statueG.add(glintMesh);
    const glintP = [], glintPh = [];
    for (let i = 0; i < GL; i++) {
      const src = (i % 3 === 0 && goA.p.length) ? goA.p : manA.p;
      const k = (rnd() * (src.length / 3)) | 0;
      glintP.push(new THREE.Vector3(src[3 * k], src[3 * k + 1], src[3 * k + 2]));
      glintPh.push(rnd() * 6.28);
    }
    const DR = 40;
    const dropMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 6, 4), dropMat, DR);
    dropMesh.frustumCulled = false;
    statueG.add(dropMesh);
    const dropSrc = [], dropPh = [], dropSz = [];
    for (let i = 0; i < DR; i++) {
      const useHair = i % 2 === 1;
      const src = useHair ? goA.p : manA.p;
      let k = 0, tries = 0;
      do { k = (rnd() * (src.length / 3)) | 0; tries++; }
      while (tries < 40 && (useHair ? src[3 * k + 1] < 9.0 : src[3 * k + 1] > 3.6));
      dropSrc.push(new THREE.Vector3(src[3 * k], src[3 * k + 1], src[3 * k + 2]));
      dropPh.push(rnd());
      dropSz.push(0.7 + rnd() * 0.6);
    }
    const FL = 48, SM = 24;
    const flameMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), flameMat, FL);
    const smokeMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), smokeMat, SM);
    flameMesh.frustumCulled = false; smokeMesh.frustumCulled = false;
    root.add(flameMesh); root.add(smokeMesh);
    const flames = [], smokes = [];
    for (let i = 0; i < FL; i++) flames.push({ a: i * 2.39996, r: 1.4 + rnd() * 2.2, y: rnd() * 11.0, ph: rnd() });
    for (let i = 0; i < SM; i++) smokes.push({ a: i * 2.1, r: 1.0 + rnd() * 2.5, ph: rnd() });

    // ---------- actualizacion por fotograma (funcion pura del estado) ----------
    const hideM = new THREE.Matrix4().compose(ZS, Q0, ZS);
    function setHidden(mesh, i) { mesh.setMatrixAt(i, hideM); }

    function update(s) {
      const t = num(s.t), wall = num(s.wall);
      const ivory = clamp01(num(s.ivory)), gold = clamp01(num(s.gold)), thr = clamp01(num(s.throne));
      const attr = clamp01(num(s.attributes)), shine = clamp01(num(s.shine)), xray = clamp01(num(s.xray));
      const fire = clamp01(num(s.fire)), burn = clamp01(num(s.burn));
      const vanish = clamp01((burn - 0.95) / 0.05), fade = 1 - vanish, bsm = smooth(burn);

      // base de piedra: siempre en la cella cuando ya se construye
      baseG.visible = t >= 81.5;
      const figure = (ivory > 0.001 || gold > 0.001) && burn < 0.999;
      statueG.visible = figure;
      throneG.visible = thr > 0.001 && burn < 0.999;
      attrG.visible = attr > 0.001 && burn < 0.999;
      if (!figure && !throneG.visible && !attrG.visible) return;

      // piel de marfil: corte de abajo arriba (0..1) y ennegrecimiento al quemarse
      cutIvory.constant = ivory >= 0.999 ? 1e5 : O[1] - 1.0 + ivory * 13.6;
      ivoryMat.color.copy(CREAM).lerp(ASH, bsm * 0.9);
      ivoryMat.opacity = (1 - 0.8 * xray) * fade;
      ivoryMat.depthWrite = xray < 0.05;

      // oro: corte de abajo arriba; se funde y brilla al arder
      cutGold.constant = gold >= 0.999 ? 1e5 : O[1] - 1.0 + gold * 13.6;
      [goldMantle, goldStat].forEach(function (m) {
        m.color.copy(GOLD).lerp(MOLTEN, bsm * 0.6);
        m.emissive.setRGB(1.0, 0.42, 0.1);
        m.emissiveIntensity = 0.35 * bsm;
        m.roughness = 0.24 + 0.4 * bsm;
        m.envMapIntensity = 0.9 + 0.5 * shine;
        m.opacity = (1 - 0.3 * xray) * fade;
        m.depthWrite = xray < 0.05;
      });
      goldFree.opacity = fade;
      nikeIvory.opacity = fade;
      stoneMat.opacity = 1;

      // trono: sube desde la basa; se ennegrece
      cutThrone.constant = thr >= 0.999 ? 1e5 : O[1] - 0.6 + thr * 12.8;
      ebonyMat.color.copy(EBONY).lerp(CHAR, bsm);
      ebonyMat.opacity = fade;
      throneIvory.opacity = fade;
      goldThrone.color.copy(GOLD).lerp(MOLTEN, bsm * 0.6);
      goldThrone.emissive.setRGB(1.0, 0.42, 0.1);
      goldThrone.emissiveIntensity = 0.35 * bsm;
      goldThrone.opacity = fade;

      // bordes incandescentes del corte
      for (let k = 0; k < glowList.length; k++) {
        const g = glowList[k];
        g.u.uCut.value = g.plane.constant;
        g.u.uHot.value = (ivory > 0.001 && ivory < 0.999) || (gold > 0.001 && gold < 0.999) ? 1 : 0;
      }

      // Nike crece sobre la palma; el cetro sube desde el suelo
      const ne = Math.max(0.001, smooth(attr));
      nikeG.scale.setScalar(ne);
      scepG.scale.set(1, ne, 1);
      nikeG.visible = attr > 0.001;
      scepG.visible = attr > 0.001;

      // brillo: destellos aditivos pequenos sobre el oro
      for (let i = 0; i < GL; i++) {
        if (shine < 0.01) { setHidden(glintMesh, i); continue; }
        const w = Math.max(0, Math.sin(wall * 4.7 + glintPh[i]) * Math.sin(wall * 2.3 + glintPh[i] * 1.7));
        const sz = 0.7 * shine * w * w * w;
        if (sz < 0.01) { setHidden(glintMesh, i); continue; }
        M.compose(glintP[i], camera.quaternion, S.set(sz, sz, 1));
        glintMesh.setMatrixAt(i, M);
      }
      glintMesh.instanceMatrix.needsUpdate = true;

      // gotas de oro fundido que caen (durante la fusion)
      const dr = clamp01((burn - 0.12) / 0.3) * fade;
      for (let i = 0; i < DR; i++) {
        if (dr < 0.01 || burn < 0.12) { setHidden(dropMesh, i); continue; }
        const src = dropSrc[i];
        const f = fract(wall * 0.5 + dropPh[i]);
        const y = src.y - f * (src.y - 0.7);
        const sz = dropSz[i] * dr;
        P.set(src.x + 0.12, y, src.z);
        M.compose(P, Q0, S.set(0.035 * sz, 0.09 * sz, 0.035 * sz));
        dropMesh.setMatrixAt(i, M);
      }
      dropMesh.instanceMatrix.needsUpdate = true;

      // llamas y humo que envuelven la estatua durante el incendio
      const fe = fire * fade * (1 - smooth((burn - 0.8) / 0.2));
      flameMat.opacity = 0.85 * (fe > 0.001 ? 1 : 0);
      for (let i = 0; i < FL; i++) {
        const f = flames[i];
        if (fe <= 0.001) { setHidden(flameMesh, i); continue; }
        const k = fract(wall * 0.9 + f.ph);
        const y = f.y * 0.6 + k * 3.0;
        const sc = fe * (0.9 + 0.5 * Math.sin(wall * 7 + f.ph * 5));
        P.set(-0.2 + Math.cos(f.a) * f.r, y, Math.sin(f.a) * f.r);
        M.compose(P, camera.quaternion, S.set(1.9 * sc * (1 - k * 0.4), 2.8 * sc, 1));
        flameMesh.setMatrixAt(i, M);
      }
      flameMesh.instanceMatrix.needsUpdate = true;
      smokeMat.opacity = 0.5 * fe;
      for (let i = 0; i < SM; i++) {
        const sm = smokes[i];
        if (fe <= 0.001) { setHidden(smokeMesh, i); continue; }
        const k = fract(wall * 0.25 + sm.ph);
        P.set(-0.2 + Math.cos(sm.a) * sm.r, 4.0 + k * 13.0, Math.sin(sm.a) * sm.r);
        const sc = 2.5 + 3.5 * k;
        M.compose(P, camera.quaternion, S.set(sc, sc * 0.8, 1));
        smokeMesh.setMatrixAt(i, M);
      }
      smokeMesh.instanceMatrix.needsUpdate = true;
      flameMesh.visible = fe > 0.001;
      smokeMesh.visible = fe > 0.001;
    }

    return { update: update, root: root };
  };

})();
