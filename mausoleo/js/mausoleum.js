// Mausoleo de Halicarnaso: podio de sillares (hilada a hilada) con núcleo verdoso, 36 columnas jónicas
// con volutas, cella, entablamento, frisos en relieve (CanvasTexture + bump), estatuas con policromía,
// pirámide de 24 escalones, cuadriga, fantasma, rayos X, ruina y desmantelamiento.
// Todo procedural. El estado s es función pura (sin acumulación): se puede saltar en el tiempo.
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
  function makeCanvas(w, h) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; return c;
  }

  G.createMausoleum = function (ctx) {
    const THREE = ctx.THREE, scene = ctx.scene, renderer = ctx.renderer;
    const MA = G.MAUS, PD = MA.podium, CO = MA.colonnade, PY = MA.pyramid, QD = MA.quadriga, FR = MA.friezes;
    const EY = MA.entablature.y0;                 // 31 m: base del entablamento
    const UP = new THREE.Vector3(0, 1, 0);
    const root = new THREE.Group();               // estructura (tiembla con el terremoto)
    scene.add(root);
    const ghostRoot = new THREE.Group();          // fantasma (no tiembla)
    scene.add(ghostRoot);
    const rnd = makeRng(20231);

    // ---------- utilidades de matriz (solo se reescriben al cambiar el estado) ----------
    const _id = new THREE.Matrix4();
    const _p = new THREE.Vector3(), _s = new THREE.Vector3(), _m = new THREE.Matrix4();
    const _qI = new THREE.Quaternion();
    function put(inst, i, px, py, pz, q, sx, sy, sz) {
      _p.set(px, py, pz); _s.set(sx, sy, sz);
      _m.compose(_p, q || _qI, _s);
      inst.setMatrixAt(i, _m);
    }
    function hide(inst, i) { put(inst, i, 0, 0, 0, null, 0, 0, 0); }
    function yawQ(a) { return new THREE.Quaternion().setFromAxisAngle(UP, a); }
    function tm(x, y, z, rz, sx, sy, sz) {
      return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z),
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), rz || 0),
        new THREE.Vector3(sx === undefined ? 1 : sx, sy === undefined ? 1 : sy, sz === undefined ? 1 : sz));
    }
    function keepOf(d, thr) { return 1 - smooth(clamp01((d - thr) / 0.12)); }   // 1 = intacto, 0 = desmontado

    // fusiona piezas {g, m, paint}: guarda el color de mármol y el de policromía por vértice
    const MARBLE = new THREE.Color(0xefe9dd);
    function mergeGeos(list) {
      const pos = [], nor = [], uv = [], idx = [], cM = [], cP = [];
      const v = new THREE.Vector3(), nv = new THREE.Vector3(), nm = new THREE.Matrix3();
      let off = 0;
      list.forEach(function (it) {
        const g = it.g, Pa = g.attributes.position, Na = g.attributes.normal, Ua = g.attributes.uv;
        const count = Pa.count, m = it.m || _id, pc = it.paint || MARBLE;
        nm.getNormalMatrix(m);
        for (let i = 0; i < count; i++) {
          v.fromBufferAttribute(Pa, i).applyMatrix4(m);
          pos.push(v.x, v.y, v.z);
          if (Na) { nv.fromBufferAttribute(Na, i).applyMatrix3(nm).normalize(); nor.push(nv.x, nv.y, nv.z); } else nor.push(0, 1, 0);
          if (Ua) uv.push(Ua.getX(i), Ua.getY(i)); else uv.push(0, 0);
          cM.push(MARBLE.r, MARBLE.g, MARBLE.b); cP.push(pc.r, pc.g, pc.b);
        }
        if (g.index) { for (let i = 0; i < g.index.count; i++) idx.push(g.index.getX(i) + off); }
        else { for (let i = 0; i < count; i++) idx.push(i + off); }
        off += count;
      });
      const out = new THREE.BufferGeometry();
      out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
      out.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      out.setAttribute('color', new THREE.Float32BufferAttribute(cM.slice(), 3));
      out.userData.cM = new Float32Array(cM);
      out.userData.cP = new Float32Array(cP);
      out.setIndex(idx);
      return out;
    }
    // policromía: mezcla el color de mármol y el pintado por vértice (solo con p cambiado)
    function writePaint(geo, p) {
      const arr = geo.attributes.color.array, cM = geo.userData.cM, cP = geo.userData.cP;
      for (let i = 0; i < arr.length; i++) arr[i] = cM[i] + (cP[i] - cM[i]) * p;
      geo.attributes.color.needsUpdate = true;
    }
    function boxG(w, h, d) { return new THREE.BoxGeometry(w, h, d); }
    function lathe(pts, seg) {
      return new THREE.LatheGeometry(pts.map(function (p) { return new THREE.Vector2(p[0], p[1]); }), seg || 24);
    }
    // anillo de cajas (cuatro lados) centrado en el eje, con semiejes exteriores hx, hz
    function ringItems(hx, hz, y0, h, t, out) {
      const yc = y0 + h / 2;
      out.push({ g: boxG(t, h, 2 * hz), m: tm(hx - t / 2, yc, 0) });
      out.push({ g: boxG(t, h, 2 * hz), m: tm(-(hx - t / 2), yc, 0) });
      out.push({ g: boxG(2 * hx, h, t), m: tm(0, yc, -(hz - t / 2)) });
      out.push({ g: boxG(2 * hx, h, t), m: tm(0, yc, hz - t / 2) });
      return out;
    }

    // ---------- columna jónica: basa con toros, fuste de 24 estrías con entasis, equino, ábaco y volutas grandes ----------
    function columnGeo() {
      const shaft = [[0, 0], [0.8, 0], [0.8, 0.1], [0.66, 0.26], [0.6, 0.34]];
      for (let i = 1; i <= 4; i++) {
        const u = i / 4;
        shaft.push([0.6 - 0.1 * u + 0.025 * Math.sin(Math.PI * u), 0.34 + 10.26 * u]);
      }
      shaft.push([0.84, 10.7], [0.8, 10.98], [0, 10.98]);
      const sh = lathe(shaft, 48), Pa = sh.attributes.position;
      for (let i = 0; i < Pa.count; i++) {        // 24 estrías: surcos de radio variable con el ángulo
        const x = Pa.getX(i), y = Pa.getY(i), z = Pa.getZ(i), r = Math.hypot(x, z);
        if (y > 0.4 && y < 10.6 && r > 0.3) {
          const th = Math.atan2(z, x), k = 1 - 0.12 * (0.5 + 0.5 * Math.cos(24 * th));
          Pa.setXYZ(i, x * k, y, z * k);
        }
      }
      sh.computeVertexNormals();
      const ab = boxG(1.9, 0.36, 1.9); ab.translate(0, 11.16, 0);
      // volutas grandes (~1 m de diámetro) en las caras frontal y posterior, bajo el ábaco
      function volute(cx, sg) {
        const pts = [];
        for (let i = 0; i <= 30; i++) {
          const th = i / 30 * Math.PI * 2.6, r = 0.44 * Math.exp(-0.17 * th) + 0.05;
          pts.push(new THREE.Vector3(cx + sg * Math.cos(th) * r, 10.75 + Math.sin(th) * r, 0.98));
        }
        return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 20, 0.07, 4, false);
      }
      return mergeGeos([{ g: sh }, { g: ab }, { g: volute(-0.5, -1) }, { g: volute(0.5, 1) }]);
    }

    // ---------- estatua de pie con túnica (torso de revolución, cabeza, brazos); ropa roja y orla dorada ----------
    const RED = new THREE.Color(0xa8322a), GOLD = new THREE.Color(0xe0b257);
    function statueGeo() {
      const robe = [[0, 0], [0.36, 0], [0.4, 0.12], [0.3, 0.4], [0.27, 0.9], [0.22, 1.15], [0.3, 1.42], [0.12, 1.6], [0, 1.62]];
      const hemG = lathe([[0.36, 0.0], [0.42, 0.02], [0.43, 0.12], [0.4, 0.15], [0.36, 0.08]], 20);
      const headG = new THREE.SphereGeometry(0.13, 16, 12);
      const armG = new THREE.CylinderGeometry(0.06, 0.055, 0.66, 8);
      return mergeGeos([
        { g: lathe(robe, 20), m: new THREE.Matrix4().makeScale(1, 1, 0.72), paint: RED },
        { g: hemG, m: new THREE.Matrix4().makeScale(1, 1, 0.72), paint: GOLD },
        { g: headG, m: tm(0, 1.74, 0, 0) },
        { g: armG, m: tm(0.27, 1.22, 0, -0.22), paint: RED },
        { g: armG, m: tm(-0.27, 1.22, 0, 0.22), paint: RED }
      ]);
    }

    // ---------- caballo de la cuadriga: barril, cuello arqueado, cabeza con orejas y crin, patas articuladas, cola ----------
    function horseGeo(raised) {
      const L = [];
      L.push({ g: new THREE.SphereGeometry(1, 24, 18), m: tm(0, 1.6, 0, 0, 1.35, 0.78, 0.62) });      // barril
      const neck = new THREE.CatmullRomCurve3([new THREE.Vector3(0.9, 1.95, 0), new THREE.Vector3(1.3, 2.55, 0),
        new THREE.Vector3(1.75, 2.95, 0), new THREE.Vector3(2.0, 3.0, 0)]);
      L.push({ g: new THREE.TubeGeometry(neck, 14, 0.26, 10, false), m: _id });                         // cuello arqueado
      const mane = new THREE.CatmullRomCurve3([new THREE.Vector3(0.95, 2.25, 0), new THREE.Vector3(1.35, 2.9, 0),
        new THREE.Vector3(1.75, 3.25, 0), new THREE.Vector3(1.9, 3.2, 0)]);
      L.push({ g: new THREE.TubeGeometry(mane, 12, 0.09, 5, false), m: _id });                          // crin
      L.push({ g: new THREE.SphereGeometry(0.3, 14, 10), m: tm(2.15, 2.75, 0, -0.5, 1.9, 0.95, 0.9) }); // cabeza
      L.push({ g: new THREE.SphereGeometry(0.25, 12, 8), m: tm(2.5, 2.45, 0, -0.5, 1.0, 0.85, 0.85) }); // hocico
      L.push({ g: new THREE.ConeGeometry(0.07, 0.3, 6), m: tm(1.95, 3.25, 0.12, 0.2) });                 // orejas
      L.push({ g: new THREE.ConeGeometry(0.07, 0.3, 6), m: tm(1.95, 3.25, -0.12, 0.2) });
      const leg = function (x, z, fwd) {
        const c1 = new THREE.CylinderGeometry(0.13, 0.11, 0.75, 8), kn = new THREE.SphereGeometry(0.12, 10, 8);
        const c2 = new THREE.CylinderGeometry(0.09, 0.07, 0.75, 8), hf = boxG(0.2, 0.16, 0.22);
        if (!fwd) {
          L.push({ g: c1, m: tm(x, 1.2, z) }, { g: kn, m: tm(x, 0.8, z) }, { g: c2, m: tm(x, 0.42, z) }, { g: hf, m: tm(x, 0.08, z) });
        } else {                               // pata delantera levantada: antebrazo hacia delante, casco en el aire
          L.push({ g: c1, m: tm(x + 0.2, 1.3, z, -0.6) }, { g: kn, m: tm(x + 0.42, 1.1, z) },
            { g: c2, m: tm(x + 0.55, 0.8, z, -0.9) }, { g: hf, m: tm(x + 0.75, 0.62, z) });
        }
      };
      leg(0.9, 0.22, raised); leg(0.9, -0.22, raised);
      leg(-0.9, 0.22, false); leg(-0.9, -0.22, false);
      L.push({ g: new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(-1.15, 1.95, 0), new THREE.Vector3(-1.6, 1.7, 0),
        new THREE.Vector3(-1.85, 1.1, 0), new THREE.Vector3(-1.9, 0.45, 0)]), 10, 0.09, 6, false), m: _id });   // cola
      return mergeGeos(L);
    }
    // rueda de radios: aro, ocho radios y cubo (plano XY, eje Z)
    function wheelItems(z, out) {
      out.push({ g: new THREE.TorusGeometry(0.85, 0.08, 8, 24), m: tm(0, 3.25, z) });
      for (let k = 0; k < 8; k++) out.push({ g: boxG(0.07, 1.7, 0.07), m: tm(0, 3.25, z, k * Math.PI / 8) });
      out.push({ g: new THREE.SphereGeometry(0.15, 8, 6), m: tm(0, 3.25, z) });
      return out;
    }

    // ---------- textura de mármol: sillares finos con juntas, bisel, manchas y vetas suaves ----------
    function marbleCanvases() {
      const N = 512, c = makeCanvas(N, N), b = makeCanvas(N, N);
      const g = c.getContext('2d'), h = b.getContext('2d'), r = makeRng(77);
      g.fillStyle = '#c4baa3'; g.fillRect(0, 0, N, N);
      h.fillStyle = '#2a2a2a'; h.fillRect(0, 0, N, N);
      const rows = 2, cols = 2, rh = N / rows, cw = N / cols;
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const x = col * cw, y = row * rh, tone = 0.9 + 0.12 * r(), warm = 0.97 + 0.04 * r();
          g.fillStyle = 'rgb(' + Math.round(242 * tone) + ',' + Math.round(236 * tone * warm) + ',' + Math.round(224 * tone) + ')';
          g.fillRect(x + 2, y + 2, cw - 4, rh - 4);
          for (let m = 0; m < 4; m++) {           // manchas suaves de tono
            const mx = x + r() * cw, my = y + r() * rh, mr = 30 + r() * 60;
            const gr = g.createRadialGradient(mx, my, 0, mx, my, mr);
            gr.addColorStop(0, 'rgba(170,155,130,0.10)'); gr.addColorStop(1, 'rgba(170,155,130,0)');
            g.fillStyle = gr; g.fillRect(x + 2, y + 2, cw - 4, rh - 4);
          }
          h.fillStyle = '#b8b8b8'; h.fillRect(x + 2, y + 2, cw - 4, rh - 4);
          h.fillStyle = 'rgba(255,255,255,0.35)'; h.fillRect(x + 2, y + 2, cw - 4, 3); h.fillRect(x + 2, y + 2, 3, rh - 4);
          h.fillStyle = 'rgba(0,0,0,0.35)'; h.fillRect(x + 2, y + rh - 5, cw - 4, 3); h.fillRect(x + cw - 5, y + 2, 3, rh - 4);
          for (let v = 0; v < 4; v++) {           // vetas finas
            g.strokeStyle = 'rgba(' + Math.round(110 + 40 * r()) + ',100,88,' + (0.10 + 0.12 * r()).toFixed(2) + ')';
            g.lineWidth = 0.6 + r() * 1.6;
            const x0 = x + r() * cw, y0 = y + r() * rh;
            g.beginPath(); g.moveTo(x0, y0);
            g.bezierCurveTo(x0 + 20 + r() * 30, y0 - 10 + r() * 20, x0 + 40 + r() * 40, y0 + 10, x0 + 70 + r() * 60, y0 - 5 + r() * 30);
            g.stroke();
          }
        }
      }
      for (let i = 0; i < 600; i++) {
        g.fillStyle = 'rgba(150,140,120,' + (0.04 + 0.08 * r()).toFixed(2) + ')';
        g.fillRect(r() * N, r() * N, 1 + r() * 2, 1 + r() * 2);
      }
      return { map: c, bump: b };
    }
    function coreCanvases() {
      const N = 256, c = makeCanvas(N, N), b = makeCanvas(N, N);
      const g = c.getContext('2d'), h = b.getContext('2d'), r = makeRng(313);
      g.fillStyle = '#d8d8d0'; g.fillRect(0, 0, N, N);
      h.fillStyle = '#707070'; h.fillRect(0, 0, N, N);
      for (let i = 0; i < 2600; i++) {
        const x = r() * N, y = r() * N, sz = 1 + r() * 3, v = r();
        const gv = Math.round(150 + 105 * v);
        g.fillStyle = 'rgb(' + gv + ',' + gv + ',' + Math.round(gv * 0.95) + ')';
        g.fillRect(x, y, sz, sz);
        const hv = Math.round(60 + 170 * r());
        h.fillStyle = 'rgb(' + hv + ',' + hv + ',' + hv + ')';
        h.fillRect(x, y, sz, sz);
      }
      return { map: c, bump: b };
    }

    // ---------- frisos: escenas de amazonas, carros y guerreros (dibujadas por código) ----------
    const PAL = {
      marble: { bg: "#efe9dd", fig: "#d3c8b3", line: "#5f5644", acc: "#b5a88f" },
      paint:  { bg: "#1d4b96", fig: "#b8362b", line: "#4a1410", acc: "#e8b84a" },
      bump:   { bg: '#2e2e2e', fig: '#c8c8c8', line: '#101010', acc: '#e6e6e6' }
    };
    function drawWarrior(g, x, y, s, flip, c) {
      const d = flip ? -1 : 1;
      g.lineJoin = 'round'; g.lineCap = 'round';
      g.fillStyle = c.fig; g.strokeStyle = c.line; g.lineWidth = 2 * s;
      g.beginPath();
      g.moveTo(x - 9 * s, y - 42 * s); g.lineTo(x + 9 * s, y - 42 * s);
      g.lineTo(x + 6 * s, y - 16 * s); g.lineTo(x - 6 * s, y - 16 * s); g.closePath();
      g.fill(); g.stroke();
      g.beginPath(); g.arc(x, y - 50 * s, 6 * s, 0, Math.PI * 2); g.fill(); g.stroke();
      g.lineWidth = 4 * s;
      g.beginPath();
      g.moveTo(x - 4 * s, y - 17 * s); g.lineTo(x - 8 * s * d, y);
      g.moveTo(x + 4 * s, y - 17 * s); g.lineTo(x + 9 * s * d, y);
      g.moveTo(x - 6 * s * d, y - 38 * s); g.lineTo(x + 16 * s * d, y - 46 * s);
      g.stroke();
      g.fillStyle = c.acc; g.lineWidth = 1.5 * s;
      g.beginPath(); g.arc(x + 4 * s * d, y - 30 * s, 7 * s, 0, Math.PI * 2); g.fill(); g.stroke();
      g.beginPath(); g.moveTo(x + 16 * s * d, y - 46 * s); g.lineTo(x + 28 * s * d, y - 70 * s); g.stroke();
    }
    function drawHorse(g, x, y, s, flip, c) {
      const d = flip ? -1 : 1;
      g.lineCap = 'round'; g.fillStyle = c.fig; g.strokeStyle = c.line; g.lineWidth = 4 * s;
      [-14, -6, 8, 16].forEach(function (ox, k) {
        g.beginPath(); g.moveTo(x + ox * s * d, y - 22 * s);
        g.lineTo(x + (ox + (k % 2 ? 3 : -3)) * s * d, y); g.stroke();
      });
      g.lineWidth = 2 * s;
      g.beginPath(); g.ellipse(x, y - 30 * s, 26 * s, 12 * s, 0, 0, Math.PI * 2); g.fill(); g.stroke();
      g.beginPath();
      g.moveTo(x + 18 * s * d, y - 34 * s); g.lineTo(x + 34 * s * d, y - 64 * s);
      g.lineTo(x + 46 * s * d, y - 58 * s); g.lineTo(x + 30 * s * d, y - 24 * s); g.closePath();
      g.fill(); g.stroke();
      g.lineWidth = 3 * s;
      g.beginPath(); g.moveTo(x - 24 * s * d, y - 34 * s);
      g.quadraticCurveTo(x - 44 * s * d, y - 30 * s, x - 40 * s * d, y - 12 * s); g.stroke();
    }
    function drawRider(g, x, y, s, flip, c) {
      const d = flip ? -1 : 1;
      drawHorse(g, x, y, s, flip, c);
      drawWarrior(g, x - 2 * s * d, y - 36 * s, s * 0.72, flip, c);
    }
    function drawChariot(g, x, y, s, flip, c) {
      const d = flip ? -1 : 1;
      g.fillStyle = c.acc; g.strokeStyle = c.line; g.lineWidth = 3 * s;
      g.beginPath();
      g.moveTo(x - 22 * s * d, y - 52 * s); g.lineTo(x + 14 * s * d, y - 52 * s);
      g.lineTo(x + 8 * s * d, y - 30 * s); g.lineTo(x - 18 * s * d, y - 30 * s); g.closePath();
      g.fill(); g.stroke();
      g.beginPath(); g.arc(x - 6 * s * d, y - 16 * s, 14 * s, 0, Math.PI * 2); g.stroke();
      g.beginPath(); g.moveTo(x - 6 * s * d, y - 30 * s); g.lineTo(x - 6 * s * d, y - 2 * s); g.stroke();
      drawWarrior(g, x - 4 * s * d, y - 30 * s, s * 0.8, flip, c);
      drawHorse(g, x + 30 * s * d, y, s * 0.8, flip, c);
      drawHorse(g, x + 62 * s * d, y, s * 0.8, flip, c);
    }
    // 4 lados de 1024 px (E, N, S, O); cada lado, tres escenas
    function drawBand(g, c) {
      const SW = 1024;
      for (let side = 0; side < 4; side++) {
        const x0 = side * SW;
        g.save(); g.beginPath(); g.rect(x0, 0, SW, 256); g.clip();
        g.fillStyle = c.bg; g.fillRect(x0, 0, SW, 256);
        for (let j = 0; j < 3; j++) {
          const cx = x0 + 170 + j * 341, flip = ((side + j) % 2) === 1, kind = (side + j) % 3;
          if (kind === 0) drawRider(g, cx, 240, 2.9, flip, c);
          else if (kind === 1) { drawWarrior(g, cx - 64, 240, 2.9, false, c); drawWarrior(g, cx + 64, 240, 2.9, true, c); }
          else drawChariot(g, cx, 240, 2.6, flip, c);
        }
        g.restore();
      }
    }
    function bandCanvas(c) {
      const cv = makeCanvas(4096, 256);
      drawBand(cv.getContext('2d'), c);
      return cv;
    }

    // friso: 4 cuadriláteros (uno por lado) en una sola geometría; cada lado se "despliega" con reveal
    const FR_CK = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    function makeFrieze(yc, hh, hx, hz) {
      const NS = [[1, 0], [0, -1], [0, 1], [-1, 0]];      // E, N, S, O
      const info = NS.map(function (n) {
        const nx = n[0], nz = n[1], isX = nx !== 0;
        const d = (isX ? hx : hz) + 0.04;
        return { nx: nx, nz: nz, cx: nx * d, cz: nz * d, tx: -nz, tz: nx, L: isX ? hz : hx };
      });
      const P = new Float32Array(16 * 3), N = new Float32Array(16 * 3), U = new Float32Array(16 * 2), I = [];
      info.forEach(function (f, i) {
        for (let k = 0; k < 4; k++) {
          const c = FR_CK[k], vi = i * 4 + k;
          P[vi * 3] = f.cx + f.tx * c[0] * f.L;
          P[vi * 3 + 1] = yc + c[1] * hh / 2;
          P[vi * 3 + 2] = f.cz + f.tz * c[0] * f.L;
          N[vi * 3] = f.nx; N[vi * 3 + 1] = 0; N[vi * 3 + 2] = f.nz;
          U[vi * 2] = (i + (c[0] + 1) / 2) / 4;
          U[vi * 2 + 1] = (c[1] + 1) / 2;
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
        reveal: function (rev) {       // rev[i] 0..1: fracción desplegada de cada lado
          let dirty = false;
          for (let i = 0; i < 4; i++) {
            const r = rev[i];
            if (Math.abs(r - last[i]) < 0.002) continue;
            last[i] = r; dirty = true;
            const f = info[i];
            for (let k = 0; k < 4; k++) {
              const c = FR_CK[k], vi = i * 4 + k;
              P[vi * 3] = f.cx + f.tx * c[0] * f.L * r;
              P[vi * 3 + 2] = f.cz + f.tz * c[0] * f.L * r;
            }
          }
          if (dirty) pa.needsUpdate = true;
        }
      };
    }

    // ---------- entorno para mármol pulido: cielo degradado con sol (PMREM) ----------
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
    function canvasTex(cv, srgb) {
      const t = new THREE.CanvasTexture(cv);
      if (srgb) t.encoding = THREE.sRGBEncoding;
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = 8;
      return t;
    }
    function glowTex(c0, c1) {
      const cv = makeCanvas(128, 128), g = cv.getContext('2d');
      const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      gr.addColorStop(0, c0); gr.addColorStop(0.35, c1); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
      const t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding; return t;
    }

    // ---------- materiales ----------
    const env = skyEnv();
    const mC = marbleCanvases(), cC = coreCanvases();
    const marbleMat = new THREE.MeshStandardMaterial({
      map: canvasTex(mC.map, true), bumpMap: canvasTex(mC.bump, false), bumpScale: 0.35,
      roughness: 0.33, envMap: env || null, envMapIntensity: 0.6
    });
    const podMat = marbleMat.clone();              // fachada del podio (translúcida en rayos X)
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0x6f7a5e, map: canvasTex(cC.map, true), bumpMap: canvasTex(cC.bump, false), bumpScale: 1.2, roughness: 0.95
    });
    const coreMatX = coreMat.clone();              // núcleo del podio (translúcido en rayos X)
    const frMap = canvasTex(bandCanvas(PAL.marble), true);
    const frPaintMap = canvasTex(bandCanvas(PAL.paint), true);
    const frBumpMap = canvasTex(bandCanvas(PAL.bump), false);
    const frMat = new THREE.MeshStandardMaterial({ map: frMap, bumpMap: frBumpMap, bumpScale: 4, roughness: 0.62, side: THREE.DoubleSide });
    const frPaintMat = new THREE.MeshStandardMaterial({
      map: frPaintMap, emissiveMap: frPaintMap, emissive: 0xffffff, emissiveIntensity: 0.55, transparent: true, opacity: 0, depthWrite: false, roughness: 0.7, side: THREE.DoubleSide,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2
    });
    const podFrMat = frMat.clone();
    const podPaintMat = frPaintMat.clone();
    const statueMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, envMap: env || null, envMapIntensity: 0.3 });
    const unitBox = new THREE.BoxGeometry(1, 1, 1);

    // ---------- 1. PODIO: 19 hiladas de 1 m; tres escalones en la base; sillares finos (instanciados) ----------
    const NCP = Math.round(PD.y1 - PD.y0);
    const CUT = 1.4, LMAX = 2.4;
    function courseExtra(c) { return c === 0 ? 3 : (c === 1 ? 1.5 : (c === 2 ? 0.5 : 0)); }
    const SIDE_N = [[1, 0], [0, -1], [0, 1], [-1, 0]];   // E, N, S, O
    const blocks = [];
    for (let c = 0; c < NCP; c++) {
      const ex = courseExtra(c), hx = PD.halfX + ex, hz = PD.halfZ + ex * 0.84;
      for (let sd = 0; sd < 4; sd++) {
        const nx = SIDE_N[sd][0], nz = SIDE_N[sd][1], tx = -nz, tz = nx;
        const isX = nx !== 0, tH = isX ? hz : hx, d = isX ? hx : hz;
        const n = Math.max(2, Math.round(2 * tH / LMAX)), L = 2 * tH / n;
        for (let k = 0; k < n; k++) {
          const tau = -tH + (k + 0.5) * L, D = CUT * (0.96 + 0.08 * rnd());
          const rd = d - D / 2, yaw = Math.atan2(-tz, tx) + (rnd() - 0.5) * 0.01;
          blocks.push({
            c: c, x: nx * rd + tx * tau, z: nz * rd + tz * tau, L: L * 0.96, D: D,
            q: yawQ(yaw), delay: 0.5 * rnd(), thr: 0.88 * rnd(), tone: 0.84 + 0.2 * rnd()
          });
        }
      }
    }
    const podInst = new THREE.InstancedMesh(unitBox, podMat, blocks.length);
    podInst.castShadow = true; podInst.receiveShadow = true; podInst.frustumCulled = false;
    const tcol = new THREE.Color();
    blocks.forEach(function (b, i) { tcol.setScalar(b.tone); podInst.setColorAt(i, tcol); });
    podInst.instanceColor.needsUpdate = true;
    root.add(podInst);
    const coreMesh = new THREE.Mesh(unitBox, coreMatX);
    coreMesh.castShadow = true; coreMesh.receiveShadow = true;
    root.add(coreMesh);
    // molduras: base (bajo los escalones) y cornisa del podio (cubre el arranque de las columnas)
    const baseMold = new THREE.Mesh(boxG(2 * (PD.halfX + 3.3), 0.25, 2 * (PD.halfZ + 3.1)), podMat);
    baseMold.position.set(0, 0.12, 0); baseMold.receiveShadow = true;
    root.add(baseMold);
    const cornice = new THREE.Mesh(boxG(2 * (PD.halfX + 0.6), 0.5, 2 * (PD.halfZ + 0.6)), podMat);
    cornice.position.set(0, PD.y1, 0); cornice.castShadow = true; cornice.receiveShadow = true;
    root.add(cornice);
    // friso del podio (amazonomaquia): geometría de cuatro lados, relieve con marmol y policromía superpuesta
    const frPod = makeFrieze(FR.podiumY, FR.height, PD.halfX, PD.halfZ);
    const podFr = new THREE.Mesh(frPod.geo, podFrMat);
    const podFrP = new THREE.Mesh(frPod.geo, podPaintMat);
    podFr.frustumCulled = false; podFrP.frustumCulled = false;
    root.add(podFr); root.add(podFrP);
    // cimientos de piedra verdosa bajo el suelo (quedan al final del desmantelamiento)
    const fdnItems = ringItems(19.8, 16.8, -2.0, 2.0, 1.4, []);
    const fdn = new THREE.Mesh(mergeGeos(fdnItems), coreMat);
    fdn.visible = false; root.add(fdn);

    // ---------- 2. COLUMNAS (36 jónicas en el rectángulo del peristilo) y cella ----------
    const COLP = [];
    for (let i = 0; i < 11; i++) {
      const x = -CO.halfX + 2 * CO.halfX * i / 10;
      COLP.push([x, -CO.halfZ]); COLP.push([x, CO.halfZ]);
    }
    for (let k = 1; k <= 7; k++) {
      const z = -CO.halfZ + 2 * CO.halfZ * k / 8;
      COLP.push([CO.halfX, z]); COLP.push([-CO.halfX, z]);
    }
    const colG = columnGeo();
    const colInst = new THREE.InstancedMesh(colG, marbleMat, COLP.length);
    colInst.castShadow = true; colInst.receiveShadow = true; colInst.frustumCulled = false;
    root.add(colInst);
    const COLYQ = [], COLST = [], COLFALL = [], COLTHR = [];
    COLP.forEach(function (p, i) {
      COLYQ.push(yawQ(Math.atan2(p[0], p[1])));
      COLST.push(i / COLP.length * 0.3);
      COLFALL.push(0.1 + 0.4 * rnd());
      COLTHR.push(0.88 * rnd());
    });
    // cella: muro interior de la cámara de culto (cuatro muros que suben desde el podio)
    const CELLA = [
      { x: 0, z: -CO.halfZ + 4.0, sx: 28, sz: 1 }, { x: 0, z: CO.halfZ - 4.0, sx: 28, sz: 1 },
      { x: 13.5, z: 0, sx: 1, sz: 22 }, { x: -13.5, z: 0, sx: 1, sz: 22 }
    ];
    // pilastras de sillar que sobresalen de los muros hacia el interior
    [-10, -5, 5, 10].forEach(function (x) {
      CELLA.push({ x: x, z: -9.9, sx: 1.2, sz: 1.2 });
      CELLA.push({ x: x, z: 9.9, sx: 1.2, sz: 1.2 });
    });
    [-7, 7].forEach(function (z) { CELLA.push({ x: 12.9, z: z, sx: 1.2, sz: 1.2 }); CELLA.push({ x: -12.9, z: z, sx: 1.2, sz: 1.2 }); });
    const cellaInst = new THREE.InstancedMesh(unitBox, marbleMat, CELLA.length);
    cellaInst.castShadow = true; cellaInst.receiveShadow = true; cellaInst.frustumCulled = false;
    root.add(cellaInst);
    // puerta de la cella en el muro sur (hueco oscuro; su altura sigue a la cella)
    const cellaDoor = new THREE.Mesh(boxG(3.2, 1, 0.3), new THREE.MeshStandardMaterial({ color: 0x2a1e14, roughness: 0.9 }));
    cellaDoor.position.set(0, PD.y1 + 3, CO.halfZ - 3.5);
    root.add(cellaDoor);

    // ---------- 3. ENTABLAMENTO: arquitrabe en 3 fajas, friso, cornisa con dentículos (grupo con pivote) ----------
    const entabPivot = new THREE.Group();
    entabPivot.position.set(0, EY, 0);
    root.add(entabPivot);
    const A = [];
    ringItems(18.0, 15.0, 0.0, 0.3, 0.8, A);
    ringItems(18.2, 15.2, 0.3, 0.3, 0.8, A);
    ringItems(18.4, 15.4, 0.6, 0.3, 0.8, A);
    ringItems(19.4, 16.4, 1.9, 1.1, 1.2, A);
    const entabStone = new THREE.Mesh(mergeGeos(A), marbleMat);
    entabStone.castShadow = true; entabStone.receiveShadow = true;
    entabPivot.add(entabStone);
    const frEnt = makeFrieze(FR.entabY - EY, FR.height, 18.45, 15.45);
    const entFr = new THREE.Mesh(frEnt.geo, frMat);
    const entFrP = new THREE.Mesh(frEnt.geo, frPaintMat);
    entFr.frustumCulled = false; entFrP.frustumCulled = false;
    entabPivot.add(entFr); entabPivot.add(entFrP);
    // dentículos bajo la cornisa (instanciados)
    const DENT = [];
    for (let z = -15.9; z <= 15.9; z += 0.55) { DENT.push([19.0, z]); DENT.push([-19.0, z]); }
    for (let x = -18.9; x <= 18.9; x += 0.55) { DENT.push([x, 16.0]); DENT.push([x, -16.0]); }
    const dentInst = new THREE.InstancedMesh(boxG(0.3, 0.3, 0.3), marbleMat, DENT.length);
    dentInst.frustumCulled = false; dentInst.castShadow = true;
    DENT.forEach(function (p, i) { put(dentInst, i, p[0], 1.7, p[1], null, 1, 1, 1); });
    dentInst.instanceMatrix.needsUpdate = true;
    entabPivot.add(dentInst);
    // estatuas de pie entre las columnas (ocho: cuatro en cada lado largo, dentro del peristilo)
    const STAT = [];
    [-12.25, -5.25, 5.25, 12.25].forEach(function (x) {
      STAT.push({ x: x, z: -12.5, yaw: 0, side: 1 });
      STAT.push({ x: x, z: 12.5, yaw: Math.PI, side: 2 });
    });
    const statueInst = new THREE.InstancedMesh(statueGeo(), statueMat, STAT.length);
    statueInst.castShadow = true; statueInst.frustumCulled = false;
    root.add(statueInst);
    const STQ = STAT.map(function (s) { return yawQ(s.yaw); });

    // ---------- 4. PIRÁMIDE de 24 escalones (instanciada) ----------
    const pyrInst = new THREE.InstancedMesh(unitBox, marbleMat, PY.steps);
    pyrInst.castShadow = true; pyrInst.receiveShadow = true; pyrInst.frustumCulled = false;
    root.add(pyrInst);
    const PYRF = [], PYRT = [], PYRTQ = [];
    for (let k = 0; k < PY.steps; k++) {
      PYRF.push(0.5 * rnd());
      const a = rnd() * Math.PI * 2, r = 14 + 14 * rnd();
      PYRT.push({ x: Math.cos(a) * r, y: 0.55 + 0.2 * rnd(), z: Math.sin(a) * r });
      PYRTQ.push(new THREE.Quaternion().setFromEuler(new THREE.Euler(rnd() * 0.8, rnd() * 6.28, rnd() * 0.8)));
    }

    // ---------- 5. CUADRIGA: pedestal, carro con ruedas, cuatro caballos, Mausolo y Artemisia ----------
    const quadG = new THREE.Group();
    quadG.position.set(0, PY.y1, 0);
    root.add(quadG);
    const QA = [
      { g: boxG(9, 2, 7), m: tm(0, 1, 0) },                       // pedestal (0..2 m)
      { g: boxG(3.6, 0.4, 2.6), m: tm(0.2, 2.2, 0) },              // plataforma del carro
      { g: boxG(2.2, 1.0, 2.0), m: tm(-0.6, 2.9, 0) },             // caja del carro
      { g: boxG(2.6, 0.12, 0.12), m: tm(2.2, 2.6, 0) }             // timón
    ];
    wheelItems(1.35, QA); wheelItems(-1.35, QA);
    const quadMesh = new THREE.Mesh(mergeGeos(QA), marbleMat);
    quadMesh.castShadow = true; quadMesh.receiveShadow = true;
    quadG.add(quadMesh);
    const HZ = [-2.1, -0.7, 0.7, 2.1];                 // caballos 0 y 2: normales; 1 y 3: patas delanteras levantadas
    const horseA = new THREE.InstancedMesh(horseGeo(false), marbleMat, 2);
    const horseB = new THREE.InstancedMesh(horseGeo(true), marbleMat, 2);
    [horseA, horseB].forEach(function (h) { h.castShadow = true; h.frustumCulled = false; quadG.add(h); });
    const figInst = new THREE.InstancedMesh(statueGeo(), statueMat, 2);
    figInst.castShadow = true; figInst.frustumCulled = false;
    quadG.add(figInst);
    const QYQ = yawQ(Math.PI / 2);

    // ---------- 6. RUINA: sillares apilados por el suelo, tambores de columna y trozos de la cuadriga ----------
    const NR = 150, RUB = [];
    for (let i = 0; i < NR; i++) {
      const a = rnd() * Math.PI * 2, r = 9 + 30 * rnd();
      const sx = 1.2 + 1.8 * rnd(), sy = 0.8 + 0.8 * rnd(), sz = 1.0 + 1.6 * rnd();
      RUB.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, sx: sx, sy: sy, sz: sz, stack: (i % 4 === 0 && i > 0) ? 1 : 0,
        q: yawQ(rnd() * Math.PI), thr: 0.1 + 0.5 * rnd(), thr2: 0.4 + 0.5 * rnd() });
    }
    const rubInst = new THREE.InstancedMesh(unitBox, marbleMat, NR);
    rubInst.castShadow = true; rubInst.receiveShadow = true; rubInst.frustumCulled = false;
    root.add(rubInst);
    // cada columna caída se rompe en cuatro tambores tumbados a lo largo de su eje
    const DRM = [];
    COLP.forEach(function (p, i) {
      const dl = Math.hypot(p[0], p[1]), dx = p[0] / dl, dz = p[1] / dl;
      const qd = new THREE.Quaternion().setFromUnitVectors(UP, new THREE.Vector3(dx, 0, dz));
      for (let k = 0; k < 4; k++) {
        const along = 0.8 + 1.6 * k;
        DRM.push({ x: p[0] + dx * along, z: p[1] + dz * along, q: qd, thr: COLFALL[i] + 0.6, thr2: COLTHR[i] });
      }
    });
    const drumInst = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.6, 0.6, 0.9, 10), marbleMat, DRM.length);
    drumInst.castShadow = true; drumInst.frustumCulled = false;
    root.add(drumInst);
    // trozos de la cuadriga rota (un grupo que cae del suelo con la ruina)
    const chunkDefs = [
      { g: boxG(4.6, 2.0, 3.6), x: 8.2, y: 1.0, z: -4.5, q: yawQ(0.3) },
      { g: boxG(3.6, 0.4, 2.6), x: 11.5, y: 0.2, z: 2.5, q: yawQ(-0.5) },
      { g: boxG(2.2, 1.0, 2.0), x: 6.5, y: 0.5, z: 3.5, q: yawQ(0.8) },
      { g: new THREE.CylinderGeometry(0.85, 0.85, 0.2, 18), x: 9.0, y: 0.85, z: 6.0,
        q: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2) },
      { g: new THREE.CylinderGeometry(0.85, 0.85, 0.2, 18), x: 12.5, y: 0.85, z: -1.5,
        q: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2) },
      { g: boxG(1.8, 0.9, 0.9), x: 7.0, y: 0.45, z: -7.5, q: yawQ(0.2) },
      { g: boxG(1.8, 0.9, 0.9), x: 10.5, y: 0.45, z: 9.0, q: yawQ(-0.9) },
      { g: boxG(1.8, 0.9, 0.9), x: 13.0, y: 0.45, z: -6.0, q: yawQ(1.4) },
      { g: boxG(1.8, 0.9, 0.9), x: 5.0, y: 0.45, z: 8.0, q: yawQ(0.6) }
    ];
    const chunkMesh = new THREE.Mesh(mergeGeos(chunkDefs.map(function (c) {
      return { g: c.g, m: new THREE.Matrix4().compose(new THREE.Vector3(c.x, c.y, c.z), c.q, new THREE.Vector3(1, 1, 1)) };
    })), marbleMat);
    chunkMesh.castShadow = true; chunkMesh.receiveShadow = true; chunkMesh.frustumCulled = false;
    root.add(chunkMesh);

    // ---------- 7. FANTASMA: mausoleo completo translúcido con aristas (cian; cuadriga en dorado) ----------
    const cylG = new THREE.CylinderGeometry(0.6, 0.6, 12, 10);
    const shellList = [
      { g: boxG(2 * PD.halfX, PD.y1, 2 * PD.halfZ), m: tm(0, PD.y1 / 2, 0) },
      { g: boxG(2 * CO.halfX + 1.2, 3.0, 2 * CO.halfZ + 1.2), m: tm(0, 32.5, 0) },
      { g: new THREE.CylinderGeometry(5 * Math.SQRT2, 17 * Math.SQRT2, PY.y1 - PY.y0, 4, 1, false),
        m: new THREE.Matrix4().compose(new THREE.Vector3(0, (PY.y0 + PY.y1) / 2, 0), yawQ(Math.PI / 4), new THREE.Vector3(1, 1, 14 / 17)) }
    ];
    COLP.forEach(function (p) { shellList.push({ g: cylG, m: tm(p[0], CO.y0 + 6, p[1]) }); });
    const ghostShell = mergeGeos(shellList);
    const goldList = QA.map(function (it) {
      return { g: it.g, m: new THREE.Matrix4().makeTranslation(0, PY.y1, 0).multiply(it.m) };
    });
    HZ.forEach(function (z) { goldList.push({ g: horseGeo(), m: new THREE.Matrix4().makeTranslation(2.8, PY.y1 + 2.4, z) }); });
    const ghostGold = mergeGeos(goldList);
    const ghostG = new THREE.Group();
    const ghostMat = new THREE.MeshBasicMaterial({ color: 0x7fe3f0, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
    const ghostEdge = new THREE.LineBasicMaterial({ color: 0xd4fdff, transparent: true, opacity: 0, depthWrite: false });
    const goldMat = new THREE.MeshBasicMaterial({ color: 0xffc860, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
    const goldEdge = new THREE.LineBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0, depthWrite: false });
    ghostG.add(new THREE.Mesh(ghostShell, ghostMat));
    ghostG.add(new THREE.LineSegments(new THREE.EdgesGeometry(ghostShell, 30), ghostEdge));
    ghostG.add(new THREE.Mesh(ghostGold, goldMat));
    ghostG.add(new THREE.LineSegments(new THREE.EdgesGeometry(ghostGold, 30), goldEdge));
    const haloMat = new THREE.SpriteMaterial({
      map: glowTex('rgba(127,233,255,0.9)', 'rgba(63,230,245,0.25)'), color: 0xffffff,
      transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending
    });
    const halo = new THREE.Sprite(haloMat);
    halo.position.set(0, 50, 0); halo.scale.setScalar(130);
    ghostG.add(halo);
    ghostG.visible = false;
    ghostRoot.add(ghostG);

    // ---------- escritura por estado (solo cuando cambian las entradas) ----------
    function writePodium(f, dis, rr) {
      const fn = f * NCP;
      for (let i = 0; i < blocks.length; i++) {
        const b = blocks[i];
        const kp = keepOf(dis, b.thr);
        const loc = clamp01((fn - b.c - b.delay) / 0.5);
        const rt = 0.2 + 0.6 * (1 - b.c / NCP);     // las hiladas altas se desploman antes con la ruina
        const fall = smooth(clamp01((rr - rt) / 0.2));
        if (loc <= 0 || kp <= 0.001 || fall >= 0.999) { hide(podInst, i); continue; }
        const k = 1 - smooth(loc);                   // 1 = aún cayendo, 0 = asentado
        const ox = b.x * (1 + 0.8 * fall), oz = b.z * (1 + 0.8 * fall);
        const yy = b.c + CUT * 0.5 + k * 6 - fall * (b.c + 1.0);
        const kf = kp * (1 - 0.6 * fall);
        _p.set(ox, yy, oz);
        _s.set(b.L * kf, 0.96 * kf, b.D * kf);
        _m.compose(_p, b.q, _s);
        podInst.setMatrixAt(i, _m);
      }
      podInst.instanceMatrix.needsUpdate = true;
    }

    // columnas: suben desde dentro del podio; ruina: caen hacia fuera girando sobre la basa y se rompen en tambores
    function writeColumns(c, rr, dis) {
      for (let i = 0; i < COLP.length; i++) {
        const cx = COLP[i][0], cz = COLP[i][1];
        const u = clamp01((c - COLST[i]) / 0.7);
        const kp = keepOf(dis, COLTHR[i]);
        if (u <= 0 || kp <= 0.001 || rr > COLFALL[i] + 0.6) { hide(colInst, i); continue; }
        let py = PD.y1 - 12 * (1 - smooth(u)), q = COLYQ[i];
        if (rr > 0) {
          const e = smooth(clamp01((rr - COLFALL[i]) / 0.6));
          const dl = Math.hypot(cx, cz), dx = cx / dl, dz = cz / dl;
          py = PD.y1 + (0.5 - PD.y1) * e;
          const qf = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(dz, 0, -dx), e * Math.PI / 2);
          q = qf.multiply(COLYQ[i]);
        }
        put(colInst, i, cx, py, cz, q, kp, kp, kp);
      }
      colInst.instanceMatrix.needsUpdate = true;
    }
    function writeCella(c, rr, dis) {
      const cr = 1 - smooth(clamp01((rr - 0.15) / 0.3));
      const h = (CO.y1 - PD.y1) * c * cr * keepOf(dis, 0.1);
      for (let i = 0; i < CELLA.length; i++) {
        const w = CELLA[i];
        if (h <= 0.01) { hide(cellaInst, i); continue; }
        put(cellaInst, i, w.x, PD.y1 + h / 2, w.z, null, w.sx, h, w.sz);
      }
      cellaInst.instanceMatrix.needsUpdate = true;
    }
    function writePyramid(p, rr, dis) {
      for (let k = 0; k < PY.steps; k++) {
        const st = G.MAUS.stepAt(k);
        const loc = clamp01(p * PY.steps - k);
        const kp = keepOf(dis, 0.3 + 0.5 * PYRF[k]);
        if (loc <= 0 || kp <= 0.001) { hide(pyrInst, k); continue; }
        const e = rr > 0 ? smooth(clamp01((rr - PYRF[k]) / 0.5)) : 0;
        let px = 0, py = st.y + st.h / 2 + (1 - smooth(loc)) * 5, pz = 0;
        let sx = 2 * st.halfX, sy = st.h, sz = 2 * st.halfZ, q = null;
        if (e > 0) {                                  // los escalones se rompen en sillares sueltos
          const T = PYRT[k];
          px = T.x * e; py = py + (T.y - py) * e; pz = T.z * e;
          sx += (2.2 - sx) * e; sy += (1.1 - sy) * e; sz += (1.6 - sz) * e;
          q = new THREE.Quaternion().copy(PYRTQ[k]).slerp(_qI.set(0, 0, 0, 1), 1 - e);
        }
        put(pyrInst, k, px, py, pz, q, sx * kp, sy * kp, sz * kp);
      }
      pyrInst.instanceMatrix.needsUpdate = true;
    }
    function writeHorses(u3s) {
      [[horseA, [0, 2]], [horseB, [1, 3]]].forEach(function (pair) {
        const inst = pair[0], idx = pair[1];
        for (let j = 0; j < 2; j++) {
          const i = idx[j], u = clamp01(u3s - i * 0.05);
          if (u <= 0) { hide(inst, j); continue; }
          put(inst, j, 2.8, 2.4 + (1 - smooth(u)) * 6, HZ[i], null, 1, 1, 1);
        }
        inst.instanceMatrix.needsUpdate = true;
      });
    }
    function writeFigures(u4) {
      const Z = [-0.45, 0.45];
      for (let k = 0; k < 2; k++) {
        const u = clamp01(u4 - k * 0.1);
        if (u <= 0) { hide(figInst, k); continue; }
        put(figInst, k, -0.6, 3.4 + (1 - smooth(u)) * 4, Z[k], QYQ, 0.85, 0.85, 0.85);
      }
      figInst.instanceMatrix.needsUpdate = true;
    }
    function writeRubble(rr, dis) {
      for (let i = 0; i < NR; i++) {
        const r0 = RUB[i], base = r0.stack ? RUB[i - 1] : r0;   // los apilados van sobre el bloque anterior
        const loc = clamp01((rr - r0.thr) / 0.35), kp = keepOf(dis, r0.thr2);
        if (loc <= 0 || kp <= 0.001) { hide(rubInst, i); continue; }
        const drop = (1 - smooth(loc)) * 14;
        const y = r0.sy * 0.5 + r0.stack * base.sy + drop;
        put(rubInst, i, base.x, y, base.z, r0.q, r0.sx * kp, r0.sy * kp, r0.sz * kp);
      }
      rubInst.instanceMatrix.needsUpdate = true;
      for (let i = 0; i < DRM.length; i++) {
        const D0 = DRM[i];
        const loc = clamp01((rr - D0.thr) / 0.25), kp = keepOf(dis, D0.thr2);
        if (loc <= 0 || kp <= 0.001) { hide(drumInst, i); continue; }
        put(drumInst, i, D0.x, 0.6 + (1 - smooth(loc)) * 10, D0.z, D0.q, kp, kp, kp);
      }
      drumInst.instanceMatrix.needsUpdate = true;
    }

    // ---------- actualización: función pura del estado s ----------
    let lastF = -1, lastD = -1, lastP = -1, lastR = -1;
    function sideRev(fr, i) { return smooth(clamp01((fr - i * 0.18) / 0.4)); }

    function update(s) {
      const f = clamp01(s.podium || 0), c = clamp01(s.columns || 0), en = clamp01(s.entablature || 0);
      const fr = clamp01(s.friezes || 0), pa = clamp01(s.paint || 0), p = clamp01(s.pyramid || 0);
      const qd = clamp01(s.quadriga || 0), rr = clamp01(s.ruin || 0), dis = clamp01(s.dismantle || 0);
      const xr = clamp01(s.xray || 0), gh = clamp01(s.ghost || 0), qk = clamp01(s.quake || 0);
      const wall = s.wall || 0;
      const xOn = xr > 0.001;

      // terremoto: sacudida del conjunto
      const qx = Math.sin(wall * 17) * 0.1 * qk, qz = Math.cos(wall * 13) * 0.08 * qk;
      root.position.set(qx, 0, qz);

      // podio: hiladas, núcleo verdoso que se desmorona con la ruina
      if (f !== lastF || dis !== lastD || rr !== lastR) { lastF = f; lastD = dis; lastR = rr; writePodium(f, dis, rr); }
      const cK = keepOf(dis, 0.5), crumP = smooth(clamp01((rr - 0.2) / 0.6));
      const coreH = f * PD.y1 * cK * (1 - 0.6 * crumP);
      coreMesh.visible = coreH > 0.01;
      coreMesh.position.set(0, coreH / 2, 0);
      coreMesh.scale.set(2 * (PD.halfX - 1.6), Math.max(0.001, coreH), 2 * (PD.halfZ - 1.6));
      podInst.visible = f > 0.0001 && keepOf(dis, 0) > 0.001;
      baseMold.visible = f > 0.02 && dis < 0.9;
      cornice.visible = f > 0.999 && rr < 0.25 && keepOf(dis, 0.3) > 0.001;
      cornice.scale.setScalar(Math.max(0.001, keepOf(dis, 0.3)));

      // frisos: se despliegan lado a lado (E, N, S, O); la ruina los va cayendo
      const kf = keepOf(dis, 0.85) * (1 - 0.8 * smooth(clamp01((rr - 0.3) / 0.5)));
      const rev = [sideRev(fr, 0), sideRev(fr, 1), sideRev(fr, 2), sideRev(fr, 3)];
      frPod.reveal(rev.map(function (r) { return r * kf; }));
      frEnt.reveal(rev.map(function (r) { return r * kf; }));
      podFr.visible = fr > 0.001 && f > 0.5; podFrP.visible = podFr.visible && pa > 0.001;
      podPaintMat.opacity = pa * (xOn ? 0.12 : 1);
      podFrMat.opacity = 1;

      // columnas, cella y puerta
      writeColumns(c, rr, dis);
      writeCella(c, rr, dis);
      colInst.visible = c > 0.0001; cellaInst.visible = c > 0.0001;
      const doorH = 6 * c * keepOf(dis, 0.1) * (1 - smooth(clamp01((rr - 0.15) / 0.3)));
      cellaDoor.visible = doorH > 0.01;
      cellaDoor.scale.y = Math.max(0.001, doorH);
      cellaDoor.position.y = PD.y1 + doorH / 2;

      // entablamento: sube sobre las columnas; la ruina lo desmorona
      const crumble = smooth(clamp01((rr - 0.2) / 0.3));
      const eK = (1 - crumble) * keepOf(dis, 0);
      entabPivot.visible = en > 0.001 && eK > 0.001;
      entabPivot.position.set(0, EY - 3 * (1 - smooth(en)) - 2 * crumble, 0);
      entabPivot.scale.setScalar(Math.max(0.001, eK));
      entFrP.visible = pa > 0.001;
      frPaintMat.opacity = pa;

      // estatuas (aparecen con su lado) y su policromía
      if (pa !== lastP) {
        lastP = pa;
        writePaint(statueInst.geometry, pa);
        writePaint(figInst.geometry, pa);
      }
      const stK = smooth(clamp01((rr - 0.3) / 0.3));
      for (let i = 0; i < STAT.length; i++) {
        const st = STAT[i];
        const sc = sideRev(fr, st.side) * keepOf(dis, 0.2) * (1 - stK);
        if (sc <= 0.001) { hide(statueInst, i); continue; }
        put(statueInst, i, st.x, PD.y1, st.z, STQ[i], sc, sc, sc);
      }
      statueInst.instanceMatrix.needsUpdate = true;
      statueInst.visible = fr > 0.001;

      // pirámide de 24 escalones: aparecen uno a uno y la ruina los convierte en sillares
      writePyramid(p, rr, dis);
      pyrInst.visible = p > 0.0001 || rr > 0;

      // cuadriga: sube; con la ruina cae y se rompe en trozos; con el desmontaje se desvanece
      const qe = smooth(clamp01((rr - 0.25) / 0.5)), qK = keepOf(dis, 0);
      quadG.visible = qd > 0.001 && qK > 0.001 && qe < 0.5;
      quadG.position.set(qe * 3, PY.y1 - (1 - smooth(qd)) * 6 - (PY.y1 - 1.2) * qe, 0);
      quadG.rotation.set(0, 0, -qe * Math.PI / 2);
      quadG.scale.setScalar(Math.max(0.001, qK));
      writeHorses(clamp01(qd * 1.5 - 0.3));
      writeFigures(clamp01(qd * 1.4 - 0.4));
      chunkMesh.visible = qe >= 0.5 && dis < 0.5;
      chunkMesh.position.y = (1 - smooth(clamp01((qe - 0.5) / 0.5))) * 12;

      // ruina: sillares apilados, tambores
      writeRubble(rr, dis);
      rubInst.visible = rr > 0; drumInst.visible = rr > 0;

      // cimientos: quedan al final (se ven en el hueco del suelo)
      fdn.visible = rr > 0 || dis > 0;

      // rayos X: el podio casi invisible para ver la cámara subterránea (sin escribir profundidad)
      [podMat, podFrMat, coreMatX].forEach(function (m) {
        m.transparent = xOn; m.opacity = xOn ? 0.12 : 1; m.depthWrite = !xOn;
      });

      // fantasma (prólogo)
      ghostRoot.visible = gh > 0.001;
      ghostG.visible = gh > 0.001;
      ghostMat.opacity = 0.6 * gh;
      goldMat.opacity = 0.5 * gh;
      ghostEdge.opacity = Math.min(1, 1.5 * gh);
      goldEdge.opacity = Math.min(1, 1.5 * gh);
      haloMat.opacity = 0.3 * gh * (0.85 + 0.15 * Math.sin(wall * 1.7));
    }

    return { update: update, group: root };
  };
})();
