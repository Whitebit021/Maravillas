// Coloso de Rodas (Helios): pedestal de marmol por hiladas + estatua de bronce en piezas.
// Superficies continuas (tubos y mallas de secciones), bronce con envMap PMREM, placas solo como bump.
// Piel con corte por plano (borde incandescente), rayos X, corona, pulido, temblor, caida y ruinas.
// Todo procedural. Estado s = funcion pura (sin acumulacion).
(function () {
  'use strict';
  const G = window.GIZA;

  const clamp01 = function (x) { return x < 0 ? 0 : (x > 1 ? 1 : x); };
  const smooth = function (x) { x = clamp01(x); return x * x * (3 - 2 * x); };
  const gss = function (v) { return Math.exp(-v * v); };
  const lerp = function (a, b, t) { return a + (b - a) * t; };
  const num = function (v) { return (typeof v === 'number' && isFinite(v)) ? v : 0; };
  function rng(seed) {
    return function () {
      seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  G.createColossus = function (ctx) {
    const THREE = ctx.THREE, scene = ctx.scene, renderer = ctx.renderer;
    const COL = G.COL, PED = G.PEDESTAL;
    const BASE = COL.baseY;        // 15: cara superior del pedestal (y mundo)
    const GROUND = -BASE;          // suelo en coordenadas locales de la estatua
    const HEIGHT = COL.height;     // 33 m
    const rnd = rng(77123);
    const IDM = new THREE.Matrix4();
    const Q0 = new THREE.Quaternion();
    const UP = new THREE.Vector3(0, 1, 0);
    const DARK = [0.16, 0.12, 0.09];

    if (renderer) renderer.localClippingEnabled = true;

    // ---------- texturas ----------
    function canvasTex(w, h, draw, srgb) {
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      draw(c.getContext('2d'), w, h);
      const t = new THREE.CanvasTexture(c);
      if (srgb) t.encoding = THREE.sRGBEncoding;
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      return t;
    }

    const marbleMap = canvasTex(512, 512, function (g, w, h) {
      g.fillStyle = '#efeadf'; g.fillRect(0, 0, w, h);
      const r = rng(5);
      for (let i = 0; i < 18; i++) {                       // vetas
        const x = r() * w, y = r() * h;
        g.beginPath(); g.moveTo(x, y);
        g.bezierCurveTo(x + (r() - 0.5) * 260, y + (r() - 0.5) * 260, x + (r() - 0.5) * 260, y + (r() - 0.5) * 260, x + (r() - 0.5) * 420, y + (r() - 0.5) * 420);
        g.strokeStyle = 'rgba(' + (120 + (r() * 40 | 0)) + ',' + (112 + (r() * 30 | 0)) + ',' + (98 + (r() * 25 | 0)) + ',' + (0.12 + r() * 0.22).toFixed(3) + ')';
        g.lineWidth = 1 + r() * 3; g.stroke();
      }
      for (let i = 0; i < 1400; i++) {                     // grano
        g.fillStyle = 'rgba(90,80,70,' + (r() * 0.06).toFixed(3) + ')';
        g.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2);
      }
      g.strokeStyle = '#8a8377'; g.lineWidth = 7; g.strokeRect(0, 0, w, h);   // junta del sillar
    }, true);

    // pátina: manchas verdeazuladas y oscuras muy suaves (solo color, multiplica al bronce)
    const patinaMap = canvasTex(512, 512, function (g, w, h) {
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
      const r = rng(31);
      for (let i = 0; i < 60; i++) {
        g.fillStyle = 'rgba(120,170,150,' + (0.03 + r() * 0.06).toFixed(3) + ')';
        g.beginPath(); g.ellipse(r() * w, r() * h, 20 + r() * 80, 10 + r() * 40, r() * 3, 0, Math.PI * 2); g.fill();
      }
      for (let i = 0; i < 80; i++) {
        g.fillStyle = 'rgba(70,45,22,' + (0.03 + r() * 0.05).toFixed(3) + ')';
        g.beginPath(); g.ellipse(r() * w, r() * h, 10 + r() * 30, 8 + r() * 20, r() * 3, 0, Math.PI * 2); g.fill();
      }
    }, true);

    // placas finas y remaches pequenos, solo como bumpMap (sin geometria)
    const plateBump = canvasTex(512, 512, function (g, w, h) {
      const r = rng(9);
      g.fillStyle = '#7c7c7c'; g.fillRect(0, 0, w, h);
      const rows = 4, cols = 4, ph = h / rows, pw = w / cols;
      for (let j = 0; j < rows; j++) {
        const off = (j % 2) * pw * 0.5;
        for (let i = -1; i <= cols; i++) {
          const x = i * pw + off, y = j * ph;
          g.strokeStyle = '#2a2a2a'; g.lineWidth = 2;
          g.strokeRect(x, y, pw, ph);
          const px = [x + 14, x + pw - 14], py = [y + 14, y + ph - 14];
          for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) {
            g.beginPath(); g.arc(px[a], py[b], 2.4, 0, Math.PI * 2);
            g.fillStyle = '#e8e8e8'; g.fill();
          }
        }
      }
      for (let i = 0; i < 260; i++) {
        g.fillStyle = r() > 0.5 ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)';
        g.fillRect(r() * w, r() * h, 3, 3);
      }
    }, false);

    const plaqueMap = canvasTex(1024, 320, function (g, w, h) {
      g.fillStyle = '#3b2716'; g.fillRect(0, 0, w, h);
      g.strokeStyle = '#8c6236'; g.lineWidth = 14; g.strokeRect(14, 14, w - 28, h - 28);
      g.fillStyle = '#f0cf8a'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = 'bold 92px Georgia, serif'; g.fillText('ΤΩΙ ΗΛΙΩΙ', w / 2, h * 0.40);
      g.font = 'bold 60px Georgia, serif'; g.fillText('Ο ΔΑΜΟΣ ΤΩΝ ΡΟΔΙΩΝ', w / 2, h * 0.70);
      g.font = '28px Georgia, serif'; g.fillStyle = '#c9a46a';
      g.fillText('DEDICATORIA (RECONSTRUCCIÓN)', w / 2, h * 0.88);
    }, true);

    const glowMap = canvasTex(256, 256, function (g, w, h) {
      const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      gr.addColorStop(0, 'rgba(255,240,190,1)');
      gr.addColorStop(0.25, 'rgba(255,205,110,0.55)');
      gr.addColorStop(1, 'rgba(255,190,80,0)');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    }, true);

    // ---------- entorno PMREM: cielo degradado con contraste (el bronce necesita oscuros y brillos) ----------
    let envTex = null;
    try {
      const envScene = new THREE.Scene();
      const skyTex = canvasTex(512, 256, function (g, w, h) {
        const gr = g.createLinearGradient(0, 0, 0, h);
        gr.addColorStop(0, '#3f6fa8'); gr.addColorStop(0.44, '#a9c6e4');
        gr.addColorStop(0.5, '#f4e3c0'); gr.addColorStop(0.56, '#6a5034');
        gr.addColorStop(1, '#1d160f');
        g.fillStyle = gr; g.fillRect(0, 0, w, h);
      }, true);
      envScene.add(new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16),
        new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide })));
      const sun = new THREE.Mesh(new THREE.PlaneGeometry(10, 7),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(9, 7.5, 4.5), side: THREE.DoubleSide }));
      sun.position.set(-30, 32, 22); sun.lookAt(0, 0, 0); envScene.add(sun);
      const rim = new THREE.Mesh(new THREE.PlaneGeometry(40, 5),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 2.0, 1.7), side: THREE.DoubleSide }));
      rim.position.set(38, 14, -20); rim.lookAt(0, 0, 0); envScene.add(rim);
      const pm = new THREE.PMREMGenerator(renderer);
      envTex = pm.fromScene(envScene, 0.03).texture;
      pm.dispose();
    } catch (e) { envTex = null; }

    // ---------- materiales ----------
    const cutPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 1e5);   // conserva y <= constante
    const cutU = { value: -1e5 }, hotU = { value: 0 };
    const bronze = new THREE.MeshStandardMaterial({
      color: 0x9a6430, vertexColors: true, metalness: 0.9, roughness: 0.36,
      map: patinaMap, bumpMap: plateBump, bumpScale: 0.5,
      envMap: envTex, envMapIntensity: 1.1,
      emissive: new THREE.Color(0xffb24a), emissiveIntensity: 0,
      side: THREE.DoubleSide, transparent: true, depthWrite: true,
      clippingPlanes: [cutPlane], clipShadows: true
    });
    bronze.onBeforeCompile = function (sh) {
      sh.uniforms.uCut = cutU; sh.uniforms.uHot = hotU;
      sh.vertexShader = 'varying float vWY;\n' + sh.vertexShader.replace('#include <project_vertex>',
        '#include <project_vertex>\n  { vec4 wpi = vec4(transformed, 1.0);\n#ifdef USE_INSTANCING\n    wpi = instanceMatrix * wpi;\n#endif\n    vWY = (modelMatrix * wpi).y; }');
      sh.fragmentShader = 'uniform float uCut; uniform float uHot;\nvarying float vWY;\n' +
        sh.fragmentShader.replace('#include <color_fragment>',
          '#include <color_fragment>\n  if (!gl_FrontFacing) diffuseColor.rgb *= vec3(0.32, 0.24, 0.18);').replace('#include <emissivemap_fragment>',
          '#include <emissivemap_fragment>\n  { float eb = (1.0 - smoothstep(0.0, 0.45, abs(vWY - uCut))) * uHot;' +
          ' totalEmissiveRadiance += vec3(1.0, 0.45, 0.12) * eb * 1.1; }');
    };
    const marble = new THREE.MeshStandardMaterial({ color: 0xffffff, map: marbleMap, roughness: 0.42, metalness: 0 });
    const coreMat = new THREE.MeshStandardMaterial({ color: 0x8f8373, roughness: 0.95 });
    const goldMat = new THREE.MeshBasicMaterial({ color: 0xffd36a, transparent: true, opacity: 0.95 });

    // ---------- PEDESTAL: hiladas de 1 m como InstancedMesh ----------
    const pedRoot = new THREE.Group(); scene.add(pedRoot);
    const blockBox = new THREE.BoxGeometry(1, 1, 1);
    const blocks = [];
    const cores = [];
    PED.tiers.forEach(function (tr) {
      const yb = tr[0], yt = tr[1], sm = tr[2];
      const cnt = Math.max(2, Math.round(2 * sm / 2.2));
      for (let y = yb; y < yt - 1e-6; y += 1) {
        const hRow = Math.min(1, yt - y);
        for (let side = 0; side < 4; side++) {            // 0 N, 1 E, 2 S, 3 O
          const ws = []; let tot = 0;
          for (let k = 0; k < cnt; k++) { const w = 0.8 + rnd() * 0.6; ws.push(w); tot += w; }
          let a = -sm;
          for (let k = 0; k < cnt; k++) {
            const L = ws[k] / tot * 2 * sm, mid = a + L / 2; a += L;
            const T = 1.6;
            let cx, cz, dx, dz;
            if (side === 0 || side === 2) { dx = L * 0.985; dz = T; cx = mid; cz = (side === 0 ? -1 : 1) * (sm - T / 2); }
            else { dx = T; dz = L * 0.985; cz = mid; cx = (side === 1 ? 1 : -1) * (sm - T / 2); }
            blocks.push({ base: y, h: hRow, cx: cx, cz: cz, dx: dx, dz: dz, tint: 0.93 + rnd() * 0.08 });
          }
        }
      }
      cores.push({ yb: yb, yt: yt, sm: sm });
    });
    const blockMesh = new THREE.InstancedMesh(blockBox, marble, blocks.length);
    blocks.forEach(function (b, i) { blockMesh.setColorAt(i, new THREE.Color().setRGB(b.tint, b.tint, b.tint * 0.98)); });
    if (blockMesh.instanceColor) blockMesh.instanceColor.needsUpdate = true;
    blockMesh.castShadow = true; blockMesh.receiveShadow = true; blockMesh.frustumCulled = false;
    pedRoot.add(blockMesh);

    const coreMesh = new THREE.InstancedMesh(blockBox, coreMat, cores.length);
    coreMesh.receiveShadow = true; coreMesh.frustumCulled = false;
    pedRoot.add(coreMesh);

    // molduras: basa, entre cuerpos y cornisa (salen del paramento)
    const MOLD = [
      { y: 0.0, semi: 11.5, h: 0.8 }, { y: 4.0, semi: 9.6, h: 0.7 },
      { y: 11.0, semi: 8.1, h: 0.7 }, { y: 14.2, semi: 8.15, h: 0.8 }
    ];
    const moldMesh = new THREE.InstancedMesh(blockBox, marble, MOLD.length);
    moldMesh.castShadow = true; moldMesh.receiveShadow = false; moldMesh.frustumCulled = false;
    for (let i = 0; i < MOLD.length; i++) moldMesh.setColorAt(i, new THREE.Color(1, 1, 1));
    pedRoot.add(moldMesh);

    const plaque = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 1.4),
      new THREE.MeshStandardMaterial({ map: plaqueMap, roughness: 0.55, metalness: 0.2 }));
    plaque.position.set(0, 7.5, -9.08); plaque.rotation.y = Math.PI;
    pedRoot.add(plaque);

    const M = new THREE.Matrix4(), S = new THREE.Vector3(), P = new THREE.Vector3(), ZS = new THREE.Vector3(0, 0, 0);
    const Q = new THREE.Quaternion();
    let lastH = -1;
    function updatePedestal(H) {
      if (Math.abs(H - lastH) < 1e-4) return;
      lastH = H;
      for (let i = 0; i < blocks.length; i++) {
        const b = blocks[i];
        let hh = 0;
        if (H >= b.base + b.h - 1e-3) hh = b.h;          // hilada completa
        else if (H > b.base) hh = H - b.base;            // hilada en curso
        if (hh <= 0.001) { M.compose(ZS, Q0, ZS); }
        else {
          const hs = hh * 0.975;
          M.compose(P.set(b.cx, b.base + hs / 2, b.cz), Q0, S.set(b.dx, hs, b.dz));
        }
        blockMesh.setMatrixAt(i, M);
      }
      blockMesh.instanceMatrix.needsUpdate = true;
      for (let i = 0; i < cores.length; i++) {
        const c = cores[i];
        const top = Math.min(H, c.yt), hh = top - c.yb;
        if (hh <= 0.001) M.compose(ZS, Q0, ZS);
        else M.compose(P.set(0, c.yb + hh / 2, 0), Q0, S.set(c.sm * 2 - 1.2, hh, c.sm * 2 - 1.2));
        coreMesh.setMatrixAt(i, M);
      }
      coreMesh.instanceMatrix.needsUpdate = true;
      for (let i = 0; i < MOLD.length; i++) {
        const m = MOLD[i];
        if (H >= m.y + m.h * 0.5) M.compose(P.set(0, m.y + m.h / 2, 0), Q0, S.set(m.semi * 2, m.h, m.semi * 2));
        else M.compose(ZS, Q0, ZS);
        moldMesh.setMatrixAt(i, M);
      }
      moldMesh.instanceMatrix.needsUpdate = true;
      plaque.visible = H >= 8.0;
    }

    // ---------- geometria: utilidades ----------
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

    // Catmull-Rom 1D para radios (continuo entre articulaciones)
    function crRad(rads, k) {
      const n = rads.length, i = Math.min(n - 2, Math.floor(k)), u = k - i;
      const p0 = rads[Math.max(0, i - 1)], p1 = rads[i], p2 = rads[i + 1], p3 = rads[Math.min(n - 1, i + 2)];
      return 0.5 * ((2 * p1) + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u + (-p0 + 3 * p1 - 3 * p2 + p3) * u * u * u);
    }

    // un miembro = UN tubo continuo con muchos segmentos y radio suave
    function tubeGeo(pts, rads, seg, R, uk) {
      const curve = new THREE.CatmullRomCurve3(pts.map(function (p) { return new THREE.Vector3(p[0], p[1], p[2]); }));
      const pos = [], uv = [];
      const T = new THREE.Vector3(), Nn = new THREE.Vector3(), B = new THREE.Vector3(), Pp = new THREE.Vector3(), ref = new THREE.Vector3();
      let len = 0, prev = null;
      for (let i = 0; i <= seg; i++) {
        const u = i / seg;
        curve.getPoint(u, Pp);
        curve.getTangent(u, T);
        const r = crRad(rads, u * (rads.length - 1));
        if (prev) len += Pp.distanceTo(prev);
        prev = Pp.clone();
        if (Math.abs(T.y) > 0.9) ref.set(1, 0, 0); else ref.set(0, 1, 0);
        Nn.crossVectors(T, ref).normalize();
        B.crossVectors(Nn, T).normalize();
        for (let j = 0; j < R; j++) {
          const a = 2 * Math.PI * j / R, ca = Math.cos(a) * r, sa = Math.sin(a) * r;
          pos.push(Pp.x + Nn.x * ca + B.x * sa, Pp.y + Nn.y * ca + B.y * sa, Pp.z + Nn.z * ca + B.z * sa);
          uv.push(j / R * uk, len / 9.6);
        }
      }
      return buildGeo(pos, uv, gridIdx(seg + 1, R, true));
    }

    // torso: secciones elipticas interpoladas desde COL.torso + deformacion muscular suave
    function torsoSemi(y) {
      const T = [[14.6, 2.9, 2.0]].concat(COL.torso);
      if (y <= T[0][0]) return [T[0][1], T[0][2]];
      for (let i = 1; i < T.length; i++) {
        if (y <= T[i][0]) {
          const a = T[i - 1], b = T[i], u = smooth((y - a[0]) / (b[0] - a[0]));
          return [lerp(a[1], b[1], u), lerp(a[2], b[2], u)];
        }
      }
      const L = T[T.length - 1]; return [L[1], L[2]];
    }
    function torsoDeform(x, y, z, sz) {
      const uz = z / sz;                        // -1 frente (pecho), +1 espalda
      const front = Math.max(0, -uz);
      const ax = Math.abs(x);
      let d = 0;
      d -= 0.6 * gss((y - 24.2) / 1.6) * gss((ax - 2.0) / 1.5) * Math.pow(front, 0.7);       // pectorales
      d += 0.24 * gss(ax / 0.3) * gss((y - 23.8) / 3.0) * front;                              // surco esternal
      d -= 0.22 * gss((ax - 2.9) / 0.7) * gss((y - 20.0) / 2.4) * Math.pow(front, 0.6);       // oblicuos/serrato
      let ab = 0; const YC = [18.0, 19.8, 21.6];
      for (let k = 0; k < 3; k++) ab += gss((y - YC[k]) / 0.75);
      d -= 0.3 * Math.min(1, ab) * gss((ax - 0.62) / 0.5) * gss((y - 19.8) / 3.6) * Math.pow(front, 0.5);   // abdominales
      d += 0.12 * gss(ax / 0.16) * gss((y - 19.8) / 3.6) * front;                             // linea alba
      d -= 0.16 * gss((ax - 2.6) / 1.0) * gss((y - 27.0) / 0.9) * front;                      // clavicula
      if (uz > 0) {                                                                           // espalda
        d += 0.2 * gss((ax - 1.4) / 1.0) * gss((y - 23.0) / 2.6) * uz;                        // escapulas
        d += 0.1 * gss(ax / 0.3) * gss((y - 22.0) / 5.0) * uz;                                // columna
      }
      return d;
    }
    function loft(y0, y1, rows, segs) {
      const pos = [], uv = [];
      for (let i = 0; i < rows; i++) {
        const y = lerp(y0, y1, i / (rows - 1));
        const sm = torsoSemi(y), sx = sm[0], sz = sm[1];
        for (let j = 0; j < segs; j++) {
          const th = 2 * Math.PI * j / segs, ux = Math.cos(th), uz = Math.sin(th);
          const x = sx * ux;
          const z0 = sz * uz;
          const z = z0 + torsoDeform(x, y, z0, sz);
          pos.push(x, y, z);
          uv.push(j / segs * 1.2, y / 9.6);
        }
      }
      return buildGeo(pos, uv, gridIdx(rows, segs, true));
    }

    // esfera parametrica (polos incluidos); colorFn opcional -> [r,g,b] por vertice
    function sphereGrid(R, C, fn, colorFn) {
      const pos = [], uv = [], col = colorFn ? [] : null;
      for (let i = 0; i < R; i++) {
        const th = Math.PI * i / (R - 1), st = Math.sin(th), ct = Math.cos(th);
        for (let j = 0; j < C; j++) {
          const ph = 2 * Math.PI * j / C;
          const ux = st * Math.cos(ph), uy = ct, uz = st * Math.sin(ph);
          const p = fn(ux, uy, uz);
          pos.push(p[0], p[1], p[2]);
          uv.push(j / C, i / (R - 1));
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

    // ---------- cabeza ----------
    const HX = 0, HY = 30.7, HZ = -0.2, HR = 2.1;
    const EYE_L = [0.72, 30.98, -2.1], EYE_R = [-0.72, 30.98, -2.1];
    function skullPt(ux, uy, uz) {
      const px = ux * HR, py = uy * HR, pz = uz * HR;
      let x = px, y = py * 1.08, z = pz * 1.04;
      const nx = x / HR, ny = y / HR, nz = z / HR;
      const front = Math.max(0, -nz);
      const low = smooth((0.05 - ny) / 0.9);
      x *= 1 - 0.18 * low;                                                                  // mandibula
      z -= 0.1 * low * front;
      z -= 0.2 * gss(nx / 0.33) * gss((ny + 0.82) / 0.25) * front;                          // menton
      z -= 0.1 * gss((ny - 0.4) / 0.14) * front * (1 - 0.4 * Math.abs(nx));                 // arcada
      z -= 0.22 * gss(nx / 0.1) * gss((ny - 0.08) / 0.32) * front;                          // nariz
      x += 0.1 * Math.sign(nx) * gss((ny + 0.08) / 0.22) * gss((Math.abs(nx) - 0.72) / 0.22) * front; // pomulos
      z += 0.05 * gss((ny - 0.12) / 0.14) * gss((Math.abs(nx) - 0.4) / 0.18) * front;       // cuencas
      z += 0.03 * gss((ny + 0.3) / 0.12) * gss(nx / 0.22) * front;                          // surco labial
      return [x + HX, y + HY, z + HZ];
    }
    function skullColor(ux, uy, uz) {
      const hx = (ux * HR), hy = uy * HR * 1.08, hz = uz * HR * 1.04;
      const dl = Math.hypot(hx - EYE_L[0], hy - (EYE_L[1] - HY), hz - (EYE_L[2] - HZ));
      const dr = Math.hypot(hx + 0.72, hy - (EYE_R[1] - HY), hz - (EYE_R[2] - HZ));
      const de = Math.min(dl, dr);
      const dark = 0.5 * gss(de / 0.42) * (uz < 0 ? 1 : 0);
      const lip = 0.45 * gss((hy + 0.9) / 0.1) * gss(hx / 0.5) * (uz < 0 ? 1 : 0);
      const k = 1 - Math.min(0.85, dark + lip);
      return [k, k * 0.92, k * 0.85];
    }
    function hairVis(uy, uz) {
      const top = smooth((uy - 0.25) / 0.3), front = smooth((-uz - 0.25) / 0.45), low = smooth((uy + 0.42) / 0.3);
      return Math.max(top, 1 - front) * low;
    }
    function hairPt(ux, uy, uz) {
      const vis = hairVis(uy, uz);
      const r = lerp(1.9, 2.22, vis);
      return [ux * r + HX, uy * r * 1.08 + HY, uz * r * 1.04 + HZ];
    }

    // ---------- ensamblado de piezas ----------
    const SPH = new THREE.SphereGeometry(1, 24, 16);
    const SPHB = new THREE.SphereGeometry(1, 40, 28);
    function ell(acc, c, s, tint, geo) {
      M.compose(P.set(c[0], c[1], c[2]), Q0, S.set(s[0], s[1], s[2]));
      acc.add(geo || SPH, M, tint);
    }
    const TUBE = function (acc, pts, rads, seg, R, uk) { acc.add(tubeGeo(pts, rads, seg, R, uk), IDM); };

    // manto con pliegues reales (superficie ondulada) desde el antebrazo izquierdo al pedestal
    function drapeGeo() {
      const R = 40, C = 56, pos = [], uv = [];
      const TOP = [-7.6, 18.8, 0.3], BOT = [-5.6, 0.05, 1.6];
      for (let i = 0; i < R; i++) {
        const v = i / (R - 1);
        for (let j = 0; j < C; j++) {
          const u = j / (C - 1);
          const W = 2.8 * (0.7 + 0.6 * v);
          let x = lerp(TOP[0], BOT[0], v) - 0.7 * Math.sin(Math.PI * v);
          let y = lerp(TOP[1], BOT[1], v);
          const z = lerp(TOP[2], BOT[2], v) + (u - 0.5) * W;
          // pliegues: ondas verticales que se separan hacia el suelo
          const amp = 0.25 + 0.55 * v;
          x -= amp * (0.6 * Math.sin((u * 4.0 + 0.4 * Math.sin(v * 3.0)) * Math.PI * 2.0) +
                      0.25 * Math.sin((u * 7.0 - v * 1.5) * Math.PI * 2.0));
          // remate ondulado en el borde inferior
          if (v > 0.9) y += 0.14 * Math.sin(u * Math.PI * 6) * ((v - 0.9) / 0.1);
          pos.push(x, y, z); uv.push(u, v * 2.0);
        }
      }
      return buildGeo(pos, uv, gridIdx(R, C, false));
    }

    // ---- piezas estaticas: espinillas, tobillos y pies (sobre el pedestal) ----
    const aLow = new Acc();
    [-1, 1].forEach(function (s) {
      TUBE(aLow, [[s * 2.0, 9.0, -0.2], [s * 1.97, 6.6, 0.1], [s * 1.95, 4.0, 0.3], [s * 1.92, 2.0, 0.1], [s * 1.9, 1.5, 0.0]],
        [1.5, 1.72, 1.76, 1.3, 1.0], 24, 24, 1.2);                              // gemelo y espinilla
      TUBE(aLow, [[s * 1.9, 1.5, 0.0], [s * 1.9, 0.95, -1.0], [s * 1.9, 0.75, -2.4], [s * 1.9, 0.62, -3.2]],
        [1.0, 0.98, 0.86, 0.6], 12, 20, 1.0);                                    // pie
      for (let k = 0; k < 4; k++) ell(aLow, [s * (1.9 + (k - 1.5) * 0.42), 0.55, -3.45 + (k === 0 ? 0.05 : 0)], [0.2, 0.2, 0.22] ? [0.22, 0.2, 0.22] : null);  // dedos
      ell(aLow, [s * 2.0, 9.0, -0.95], [1.25, 1.3, 0.75], undefined, SPHB);    // rotula
    });

    // ---- pelvis y muslos (pivote: rodillas) ----
    const aPel = new Acc();
    [-1, 1].forEach(function (s) {
      TUBE(aPel, [[s * 2.25, 16.6, 0.0], [s * 2.25, 14.0, -0.1], [s * 2.15, 11.4, -0.3], [s * 2.0, 9.0, -0.2]],
        [2.1, 2.2, 2.05, 1.5], 24, 24, 1.2);                                    // muslo
      ell(aPel, [s * 2.2, 16.0, 0.0], [2.3, 2.3, 2.3], undefined, SPHB);       // cadera
    });
    aPel.add(loft(14.6, 19.5, 24, 48), IDM);

    // ---- torso (pivote: cintura) ----
    const aTor = new Acc();
    aTor.add(loft(19.5, 28.6, 36, 48), IDM);
    [-1, 1].forEach(function (s) {
      TUBE(aTor, [[0, 27.6, -1.2], [s * 2.8, 27.5, -1.45], [s * 4.4, 27.0, -0.9]], [0.42, 0.4, 0.5], 10, 10, 1);   // clavicula
    });

    // ---- cabeza, cuello y pelo (pivote: base del cuello) ----
    const aHead = new Acc();
    aHead.add(sphereGrid(48, 60, skullPt, skullColor), IDM);
    aHead.add(sphereGrid(44, 56, hairPt), IDM);
    TUBE(aHead, [[0, 27.3, 0], [0, 28.9, -0.1], [0, 30.2, -0.2]], [1.55, 1.25, 1.3], 12, 16, 1);   // cuello

    // rizos: esferas pequenas instanciadas sobre el craneo (en el rig de la cabeza)
    const CURLS = 170;
    const curlGeo = new THREE.SphereGeometry(1, 10, 8);
    const curlMesh = new THREE.InstancedMesh(curlGeo, bronze, CURLS);
    curlMesh.castShadow = true; curlMesh.receiveShadow = true; curlMesh.frustumCulled = false;
    {
      let n = 0;
      for (let i = 0; i < 600 && n < CURLS; i++) {
        const y = 1 - 2 * (i + 0.5) / 600, r = Math.sqrt(Math.max(0, 1 - y * y)), ph = i * 2.39996;
        const ux = r * Math.cos(ph), uy = y, uz = r * Math.sin(ph);
        if (hairVis(uy, uz) < 0.7) continue;
        const rad = 0.2 + rnd() * 0.12;
        const sx = ux * (HR + 0.1 + rad * 0.5), sy = uy * (HR + 0.1 + rad * 0.5) * 1.08, sz = uz * (HR + 0.1 + rad * 0.5) * 1.04;
        M.compose(P.set(sx + HX, sy + HY, sz + HZ), Q0, S.set(rad, rad * 1.1, rad));
        curlMesh.setMatrixAt(n, M);
        curlMesh.setColorAt(n, new THREE.Color(1, 1, 1));
        n++;
      }
      for (let k = n; k < CURLS; k++) { M.compose(ZS, Q0, ZS); curlMesh.setMatrixAt(k, M); curlMesh.setColorAt(k, new THREE.Color(1, 1, 1)); }
      curlMesh.instanceMatrix.needsUpdate = true;
      if (curlMesh.instanceColor) curlMesh.instanceColor.needsUpdate = true;
    }

    // ---- brazo izquierdo caido (pivote: hombro izquierdo) ----
    const aArmL = new Acc();
    ell(aArmL, [-4.5, 26.8, 0], [2.15, 2.15, 2.1], undefined, SPHB);     // hombro redondeado
    TUBE(aArmL, [[-4.5, 26.9, 0], [-5.6, 24.3, 0.05], [-6.0, 21.5, 0.4], [-6.2, 19.0, 0.1], [-6.4, 16.6, -0.4]],
      [1.5, 1.62, 1.2, 1.3, 0.85], 28, 24, 1.2);                          // brazo: bicep, codo, antebrazo
    TUBE(aArmL, [[-6.4, 16.5, -0.4], [-6.5, 15.4, -0.45], [-6.5, 14.7, -0.4]], [0.85, 0.92, 0.8], 6, 16, 1);   // palma
    for (let k = 0; k < 4; k++) {
      const z = -0.4 + [-0.62, -0.2, 0.22, 0.64][k];
      TUBE(aArmL, [[-6.5, 14.9, z], [-6.5, 14.2, z - 0.12], [-6.5, 13.6, z - 0.3]], [0.2, 0.19, 0.15], 6, 10, 1);   // dedos
    }
    TUBE(aArmL, [[-6.1, 15.8, -1.0], [-6.3, 15.0, -1.2], [-6.4, 14.5, -1.1]], [0.24, 0.22, 0.18], 6, 10, 1);       // pulgar
    aArmL.add(drapeGeo(), IDM, [0.93, 0.98, 0.95]);

    // ---- brazo derecho en visera (pivote: hombro derecho) ----
    const aArmR = new Acc();
    ell(aArmR, [4.5, 26.8, 0], [2.15, 2.15, 2.1], undefined, SPHB);      // hombro redondeado
    TUBE(aArmR, [[4.5, 26.9, 0], [5.7, 28.2, -0.6], [7.0, 29.6, -1.4], [4.8, 30.6, -2.0], [2.6, 31.3, -2.4]],
      [1.5, 1.6, 1.2, 1.3, 0.85], 28, 24, 1.2);
    TUBE(aArmR, [[2.6, 31.3, -2.4], [2.0, 31.5, -2.5], [1.4, 31.6, -2.55]], [0.8, 0.85, 0.8], 6, 16, 1);       // palma en visera
    [0.14, 0.05, -0.05, -0.14].forEach(function (dy) {                       // dedos hacia la frente
      TUBE(aArmR, [[1.5, 31.6 + dy, -2.55], [0.9, 31.62 + dy, -2.55], [0.25, 31.6 + dy, -2.5]], [0.22, 0.21, 0.18], 6, 10, 1);
    });

    // ---------- rigs con pivote y pose de reposo (caida hacia +X, de espaldas) ----------
    const statue = new THREE.Group();
    statue.position.set(0, BASE, 0);
    scene.add(statue);

    const lowerRig = new THREE.Group();
    const lowerMesh = new THREE.Mesh(aLow.geometry(), bronze);
    lowerMesh.castShadow = true; lowerMesh.receiveShadow = true;
    lowerRig.add(lowerMesh);
    statue.add(lowerRig);

    // base de la caida: local X -> -Z, local Y -> +X (de espaldas, cabeza hacia el este)
    const BASIS_BACK = new THREE.Quaternion().setFromRotationMatrix(
      new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 0, -1), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, -1, 0)));
    const QYAW = new THREE.Quaternion().setFromAxisAngle(UP, 0.5);

    function restPose(geo, q, tx, tz) {
      const Pa = geo.attributes.position, v = new THREE.Vector3();
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, z0 = Infinity, z1 = -Infinity;
      for (let k = 0; k < Pa.count; k++) {
        v.fromBufferAttribute(Pa, k).applyQuaternion(q);
        if (v.x < x0) x0 = v.x; if (v.x > x1) x1 = v.x;
        if (v.y < y0) y0 = v.y;
        if (v.z < z0) z0 = v.z; if (v.z > z1) z1 = v.z;
      }
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      return { q: q.clone(), pos: new THREE.Vector3(tx - cx, GROUND - y0 + 0.25, tz - cz) };
    }

    const pieces = [];
    function addPiece(acc, pivot, q, target, delay, arcH, extra) {
      const geo = acc.geometry();
      geo.translate(-pivot[0], -pivot[1], -pivot[2]);
      const rest = restPose(geo, q, target[0], target[1]);
      const mesh = new THREE.Mesh(geo, bronze);
      mesh.castShadow = true; mesh.receiveShadow = true;
      const rig = new THREE.Group();
      rig.position.set(pivot[0], pivot[1], pivot[2]);
      rig.add(mesh);
      if (extra) extra(rig, pivot);
      statue.add(rig);
      const rec = { rig: rig, p0: new THREE.Vector3(pivot[0], pivot[1], pivot[2]), pos: rest.pos, q: rest.q, delay: delay, arcH: arcH };
      pieces.push(rec);
      return rec;
    }
    const pKnee = [0, 9.0, -0.2], pWaist = [0, 19.5, 0], pNeck = [0, 27.5, 0];
    const pShL = [-4.5, 26.9, 0], pShR = [4.5, 26.9, 0];
    addPiece(aPel, pKnee, BASIS_BACK, [16.6, -0.6], 0.0, 1.2);            // muslos y pelvis
    addPiece(aTor, pWaist, BASIS_BACK, [28.4, 0.6], 0.08, 2.0);           // torso
    const headRec = addPiece(aHead, pNeck, QYAW.clone().multiply(BASIS_BACK), [38.6, 3.0], 0.18, 3.0,
      function (rig) { rig.add(curlMesh); });                              // cabeza con rizos
    addPiece(aArmL, pShL, BASIS_BACK, [21.6, -9.6], 0.12, 2.0);           // brazo izquierdo y manto
    addPiece(aArmR, pShR, BASIS_BACK, [33.5, -11.0], 0.2, 2.5);           // brazo derecho

    // ---- corona solar: 12 rayos en abanico sobre la cabeza (en el rig de la cabeza) ----
    const rayG = new THREE.Group();
    rayG.position.set(HX, HY - pNeck[1], HZ);
    headRec.rig.add(rayG);
    const RAYS = 12, RAY_LEN = 2.4, RAY_R = 2.3;
    const coneGeo = new THREE.ConeGeometry(0.34, 1, 6, 1);
    coneGeo.translate(0, 0.5, 0);
    const rays = new THREE.InstancedMesh(coneGeo, goldMat, RAYS);
    rays.frustumCulled = false;
    rayG.add(rays);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowMap, color: 0xffd98a, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending
    }));
    glow.scale.set(9, 9, 1);
    rayG.add(glow);

    // ---- fragmentos de marmol de la rodilla rota (ruinas) ----
    const rubbleG = new THREE.Group();
    statue.add(rubbleG);
    const rubble = new THREE.InstancedMesh(blockBox, marble, 8);
    rubble.castShadow = true; rubble.receiveShadow = true; rubble.frustumCulled = false;
    rubbleG.add(rubble);
    for (let i = 0; i < 8; i++) {
      const sx = 0.8 + rnd() * 1.4, sy = 0.5 + rnd() * 0.8, sz = 0.8 + rnd() * 1.4;
      const qr = new THREE.Quaternion().setFromEuler(new THREE.Euler(rnd() * 0.6, rnd() * 3, rnd() * 0.6));
      M.compose(P.set(10 + rnd() * 12, GROUND + sy / 2 - 0.1, -6 + rnd() * 12), qr, S.set(sx, sy, sz));
      rubble.setMatrixAt(i, M);
    }
    rubble.instanceMatrix.needsUpdate = true;

    // ---------- actualizacion por fotograma (funcion pura del estado) ----------
    const IDQ = new THREE.Quaternion();
    const RAY_Q = [];
    for (let k = 0; k < RAYS; k++) {
      const th = Math.PI * k / (RAYS - 1);
      const dir = new THREE.Vector3(Math.cos(th), Math.sin(th), 0);
      RAY_Q.push({ base: dir.clone().multiplyScalar(RAY_R), q: new THREE.Quaternion().setFromUnitVectors(UP, dir) });
    }

    function update(s) {
      const t = num(s.t), wall = num(s.wall);
      const build = clamp01(num(s.build)), fall = clamp01(num(s.fall)), ruins = clamp01(num(s.ruins));
      const xray = clamp01(num(s.xray)), crown = clamp01(num(s.crown)), shine = clamp01(num(s.shine));
      const quake = clamp01(num(s.quake)), pedestal = clamp01(num(s.pedestal));

      // pedestal (altura construida en metros)
      const H = pedestal * PED.height;
      pedRoot.visible = H > 0.01;
      if (pedRoot.visible) updatePedestal(H);

      statue.visible = build > 0.001 || fall > 0.001;
      if (!statue.visible) return;

      // temblor (vibracion pequena, amplitud funcion de quake)
      const sh = quake * 0.09;
      statue.position.set(sh * (Math.sin(wall * 41.0) + 0.6 * Math.sin(wall * 23.3)),
        BASE + sh * 0.5 * Math.sin(wall * 37.0), sh * Math.cos(wall * 33.0));
      statue.rotation.z = quake * 0.006 * Math.sin(wall * 29.0);

      // piel de bronce: corte horizontal en build*33 y borde incandescente
      if (build >= 0.999) { cutPlane.constant = 1e5; cutU.value = -1e5; hotU.value = 0; }
      else {
        const cutW = BASE + build * HEIGHT;
        cutPlane.constant = cutW; cutU.value = cutW; hotU.value = build > 0.001 ? 1 : 0;
      }

      // caida y ruinas
      const keep = (fall < 0.999 || t < 225) ? 1 : ruins;
      const sink = (1 - keep) * 2.4;
      for (let i = 0; i < pieces.length; i++) {
        const p = pieces[i];
        const f = clamp01((fall - p.delay) / (1 - p.delay + 1e-6));
        const e = f * f;                                              // acelera como la gravedad
        p.rig.position.lerpVectors(p.p0, p.pos, e);
        p.rig.position.y += Math.sin(Math.PI * e) * p.arcH - sink;
        p.rig.quaternion.copy(IDQ).slerp(p.q, e);
        p.rig.visible = keep > 0.001;
      }
      lowerRig.position.y = -sink;
      lowerRig.visible = keep > 0.001;
      rubbleG.position.y = -sink;
      rubbleG.visible = fall > 0.9 && keep > 0.001;

      // opacidad, rayos X y brillo del bronce
      bronze.opacity = keep * (1 - 0.8 * xray);
      bronze.depthWrite = xray < 0.05;
      bronze.envMapIntensity = 0.9 + 0.5 * shine;
      bronze.emissiveIntensity = 0.05 * shine;

      // corona: rayos que aparecen uno a uno
      for (let k = 0; k < RAYS; k++) {
        const pk = smooth(crown * RAYS - k);
        if (pk <= 0.001) { M.compose(ZS, Q0, ZS); }
        else {
          const L = RAY_LEN * pk;
          M.compose(RAY_Q[k].base, RAY_Q[k].q, S.set(1, L, 1));
        }
        rays.setMatrixAt(k, M);
      }
      rays.instanceMatrix.needsUpdate = true;
      glow.material.opacity = crown * 0.55;
      glow.visible = crown > 0.001;
    }

    return { update: update, root: statue };
  };
})();
