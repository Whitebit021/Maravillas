// Obra del Mausoleo: pira funeraria, barcos con mármol y grúa de descarga, carros con bueyes,
// obreros, grúas de madera con rueda de pisar, andamios rectangulares que siguen la planta
// y el castillo de San Pedro creciendo de abajo arriba (castle 0..1).
// Todo procedural. Función pura del estado s (t, wall, podium, columns, ...).
(function () {
  'use strict';
  const G = window.GIZA;

  G.createConstruction = function (ctx) {
    const THREE = ctx.THREE, scene = ctx.scene, renderer = ctx.renderer;
    const root = new THREE.Group();
    scene.add(root);
    renderer.localClippingEnabled = true;

    const SITE = G.SITE, MAUS = G.MAUS, CAST = G.CASTLE || {};
    const SEA = SITE.seaLevel;
    const TAU = Math.PI * 2;
    const WALL_H = CAST.wallH || 14;
    const CS = 54, WT = 3.6;                       // semilado del castillo y grosor de muro
    const CX = SITE.castle.x, CZ = SITE.castle.z;
    const PY = { x: 0, z: -40 };                   // pira en la terraza
    const QUAY = { x: 60, z: 249 };                // pivote de la grúa (extremo del pantalán)
    const DOCK = { x: 60, z: 262 }, DOCK_HD = Math.PI / 2;   // proa hacia el norte
    const UNLOAD_DT = 24;
    const _yAxis = new THREE.Vector3(0, 1, 0);
    const _ONE = new THREE.Vector3(1, 1, 1);

    // ---------- utilidades ----------
    function V(x) { return typeof x === 'number' && isFinite(x) ? x : 0; }
    function hash(n) { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
    function clamp(x, a, b) { return x < a ? a : (x > b ? b : x); }
    function frac(x) { return x - Math.floor(x); }
    function sstep(x) { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); }
    function pingPong(d, L) { const p = frac(d / (2 * L)); return p < 0.5 ? 2 * p : 2 - 2 * p; }
    // objeto con +X hacia (dx,dz) / figura con +Z hacia (dx,dz)
    function headingOf(dx, dz) { return Math.atan2(-dz, dx); }
    function faceHd(dx, dz) { return Math.atan2(dx, dz); }
    // polilínea con longitud acumulada: at(u) -> [x, z, dirx, dirz]
    function polyline(pts) {
      const cum = [0];
      for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
      const L = cum[cum.length - 1];
      return {
        L: L,
        at: function (u) {
          const d = clamp(u, 0, 1) * L;
          let i = 1;
          while (i < cum.length - 1 && cum[i] < d) i++;
          const a = pts[i - 1], b = pts[i], seg = Math.max(1e-6, cum[i] - cum[i - 1]);
          const f = clamp((d - cum[i - 1]) / seg, 0, 1);
          const dx = b[0] - a[0], dz = b[1] - a[1], dl = Math.hypot(dx, dz) || 1;
          return [a[0] + dx * f, a[1] + dz * f, dx / dl, dz / dl];
        }
      };
    }
    // semidimensiones de la planta del mausoleo a la altura y
    function outline(y) {
      const P = MAUS.podium, C = MAUS.colonnade, Pr = MAUS.pyramid;
      if (y <= P.y1) return { hx: P.halfX, hz: P.halfZ };
      if (y <= Pr.y0) return { hx: C.halfX, hz: C.halfZ };
      if (y <= Pr.y1) {
        const u = clamp((y - Pr.y0) / (Pr.y1 - Pr.y0), 0, 1);
        return { hx: Pr.halfX + (Pr.topHalfX - Pr.halfX) * u, hz: Pr.halfZ + (Pr.topHalfZ - Pr.halfZ) * u };
      }
      return { hx: Pr.topHalfX, hz: Pr.topHalfZ };
    }
    // punto del perímetro de un rectángulo (hx,hz) según u en [0,1)
    function ringPt(u, hx, hz) {
      const Ls = [2 * hx, 2 * hz, 2 * hx, 2 * hz];
      const C = [[-hx, -hz], [hx, -hz], [hx, hz], [-hx, hz]];
      let d = frac(u) * (Ls[0] + Ls[1] + Ls[2] + Ls[3]), e = 0;
      while (e < 3 && d > Ls[e]) { d -= Ls[e]; e++; }
      const t = clamp(d / Math.max(1e-6, Ls[e]), 0, 1), A = C[e], B = C[(e + 1) % 4];
      return [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t];
    }
    // altura de la obra: suma de los tramos (cada pista sube de 0 a 1)
    function topHeight(s) {
      return 19 * clamp(V(s.podium), 0, 1) + 12 * clamp(V(s.columns), 0, 1) + 3 * clamp(V(s.entablature), 0, 1)
        + 7 * clamp(V(s.pyramid), 0, 1) + 5 * clamp(V(s.quadriga), 0, 1);
    }

    // ---------- texturas (dibujadas por código) ----------
    function canvasTex(w, h, draw) {
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      draw(cv.getContext('2d'), w, h);
      const tex = new THREE.CanvasTexture(cv);
      tex.encoding = THREE.sRGBEncoding;
      return tex;
    }
    const dotTex = canvasTex(64, 64, function (g) {
      const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    });
    const flameTex = canvasTex(64, 128, function (g, w, h) {
      g.beginPath(); g.moveTo(w * 0.5, h);
      g.bezierCurveTo(w * 0.02, h * 0.8, w * 0.18, h * 0.42, w * 0.5, 0);
      g.bezierCurveTo(w * 0.82, h * 0.42, w * 0.98, h * 0.8, w * 0.5, h); g.closePath();
      const gv = g.createLinearGradient(0, h, 0, 0);
      gv.addColorStop(0, 'rgba(255,250,220,1)'); gv.addColorStop(0.4, 'rgba(255,190,70,0.95)');
      gv.addColorStop(0.8, 'rgba(255,80,20,0.4)'); gv.addColorStop(1, 'rgba(255,60,0,0)');
      g.fillStyle = gv; g.fill();
      g.globalCompositeOperation = 'destination-in';
      const gh = g.createLinearGradient(0, 0, w, 0);
      gh.addColorStop(0, 'rgba(0,0,0,0)'); gh.addColorStop(0.5, 'rgba(0,0,0,1)'); gh.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gh; g.fillRect(0, 0, w, h);
      g.globalCompositeOperation = 'source-over';
    });
    // estandarte de los Caballeros de San Juan: cruz blanca sobre paño rojo
    const bannerTex = canvasTex(256, 160, function (g, w, h) {
      g.fillStyle = '#b3201e'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#f4efe2';
      g.fillRect(w * 0.42, h * 0.1, w * 0.16, h * 0.8);
      g.fillRect(w * 0.14, h * 0.36, w * 0.72, h * 0.16);
      g.strokeStyle = '#f4efe2'; g.lineWidth = 4; g.strokeRect(6, 6, w - 12, h - 12);
    });

    // entorno para reflejos del mármol (cielo degradado, PMREM)
    const envTex = (function () {
      const pm = new THREE.PMREMGenerator(renderer);
      const es = new THREE.Scene();
      const geo = new THREE.SphereGeometry(100, 16, 10);
      const pos = geo.attributes.position, col = [];
      const top = new THREE.Color(0x8fbfe6), hor = new THREE.Color(0xf1e6cf), bot = new THREE.Color(0x2c4f5e);
      const c = new THREE.Color();
      for (let i = 0; i < pos.count; i++) {
        const y = pos.getY(i) / 100;
        if (y >= 0) c.copy(hor).lerp(top, Math.pow(y, 0.6)); else c.copy(hor).lerp(bot, Math.min(1, -y * 3));
        col.push(c.r, c.g, c.b);
      }
      geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      es.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
      const t = pm.fromScene(es, 0.04).texture;
      pm.dispose(); geo.dispose();
      return t;
    })();

    // plano de recorte del castillo (se sube con castle: crece de abajo arriba)
    const castleClip = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);

    // ---------- materiales ----------
    const MAT = {
      hull: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true }),
      woodVC: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true, side: THREE.DoubleSide }),
      wood: new THREE.MeshStandardMaterial({ color: 0x7a5230, roughness: 0.9 }),
      woodDk: new THREE.MeshStandardMaterial({ color: 0x4a3018, roughness: 0.95 }),
      sail: new THREE.MeshStandardMaterial({ color: 0xf2ecdc, roughness: 0.95, side: THREE.DoubleSide }),
      marble: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35, flatShading: true, envMap: envTex, envMapIntensity: 0.7 }),
      cloth: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true }),
      clothVC: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }),
      skin: new THREE.MeshStandardMaterial({ color: 0x8c5a3a, roughness: 0.8, flatShading: true }),
      ox: new THREE.MeshStandardMaterial({ color: 0x8c6a4a, roughness: 0.9, flatShading: true }),
      logs: new THREE.MeshStandardMaterial({ color: 0x4a2e16, roughness: 1, emissive: 0xff5a10, emissiveIntensity: 0 }),
      flame: new THREE.MeshBasicMaterial({ map: flameTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
      glow: new THREE.MeshBasicMaterial({ map: dotTex, color: 0xff7a2a, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }),
      smoke: new THREE.PointsMaterial({ color: 0x3a3530, map: dotTex, size: 9, transparent: true, opacity: 0.35, depthWrite: false }),
      spark: new THREE.PointsMaterial({ color: 0xffb050, map: dotTex, size: 1.4, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }),
      castle: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true, envMap: envTex, envMapIntensity: 0.4, clippingPlanes: [castleClip] }),
      merlon: new THREE.MeshStandardMaterial({ color: 0xe9e2cf, roughness: 0.9, flatShading: true, clippingPlanes: [castleClip] }),
      banner: new THREE.MeshStandardMaterial({ map: bannerTex, roughness: 0.9, side: THREE.DoubleSide })
    };

    // ---------- geometría fusionada con vertex colors ----------
    function MB() { return { p: [], n: [], c: [], i: [] }; }
    function mbAppend(mb, geo, c) {
      const pa = geo.attributes.position.array, na = geo.attributes.normal.array, ia = geo.index.array;
      const base = mb.p.length / 3;
      for (let k = 0; k < pa.length; k += 3) {
        mb.p.push(pa[k], pa[k + 1], pa[k + 2]);
        mb.n.push(na[k], na[k + 1], na[k + 2]);
        mb.c.push(c.r, c.g, c.b);
      }
      for (let k = 0; k < ia.length; k++) mb.i.push(ia[k] + base);
      geo.dispose();
    }
    function mbAdd(mb, geo, m, c) {
      const g = geo.clone(); g.applyMatrix4(m);
      if (!g.attributes.normal) g.computeVertexNormals();
      mbAppend(mb, g, c); g.dispose();
    }
    function mbBox(mb, x, y, z, sx, sy, sz, c, ry) {
      const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(_yAxis, ry || 0), _ONE);
      mbAdd(mb, new THREE.BoxGeometry(sx, sy, sz), m, c);
    }
    function mbCyl(mb, x, y, z, r, h, seg, c) {
      const m = new THREE.Matrix4().makeTranslation(x, y, z);
      mbAdd(mb, new THREE.CylinderGeometry(r * 0.97, r, h, seg, 1), m, c);
    }
    function mbGeo(mb) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(mb.p, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(mb.n, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(mb.c, 3));
      g.setIndex(mb.i);
      return g;
    }
    // triángulo plano con normal hacia fuera (para cascos)
    function mbTri(mb, a, b, c, col, inside) {
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
      const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const L = Math.hypot(nx, ny, nz) || 1; nx /= L; ny /= L; nz /= L;
      const cx = (a[0] + b[0] + c[0]) / 3 - inside[0], cy = (a[1] + b[1] + c[1]) / 3 - inside[1], cz = (a[2] + b[2] + c[2]) / 3 - inside[2];
      if (nx * cx + ny * cy + nz * cz < 0) { nx = -nx; ny = -ny; nz = -nz; }
      const base = mb.p.length / 3;
      [a, b, c].forEach(function (v) { mb.p.push(v[0], v[1], v[2]); mb.n.push(nx, ny, nz); mb.c.push(col.r, col.g, col.b); });
      mb.i.push(base, base + 1, base + 2);
    }
    function mkIM(geo, mat, n, shadow) {
      const im = new THREE.InstancedMesh(geo, mat, n);
      im.frustumCulled = false;
      if (shadow) { im.castShadow = true; im.receiveShadow = true; }
      return im;
    }

    // ---------- matrices auxiliares ----------
    const _P = new THREE.Vector3(), _Q = new THREE.Quaternion(), _S = new THREE.Vector3(), _EU = new THREE.Euler();
    const _m = new THREE.Matrix4(), _m2 = new THREE.Matrix4(), _m3 = new THREE.Matrix4(), _m4 = new THREE.Matrix4();
    const _c = new THREE.Color(), _v = new THREE.Vector3();
    // matriz TRS en un solo paso (rotación Euler YXZ)
    function TRS(m, x, y, z, rx, ry, rz, sx, sy, sz) {
      _P.set(x, y, z); _EU.set(rx || 0, ry || 0, rz || 0, 'YXZ'); _Q.setFromEuler(_EU);
      _S.set(sx === undefined ? 1 : sx, sy === undefined ? 1 : sy, sz === undefined ? 1 : sz);
      return m.compose(_P, _Q, _S);
    }
    function Tr(x, y, z) { return new THREE.Matrix4().makeTranslation(x, y, z); }
    function Ry(a) { return new THREE.Matrix4().makeRotationY(a); }
    function Rz(a) { return new THREE.Matrix4().makeRotationZ(a); }
    function Rx(a) { return new THREE.Matrix4().makeRotationX(a); }
    const ZERO = new THREE.Matrix4().makeScale(0.0001, 0.0001, 0.0001);

    // =====================================================================
    // 0. MUELLE (pantalán de madera en SITE.quay)
    // =====================================================================
    (function buildPier() {
      const mb = MB();
      const cDeck = new THREE.Color(0x8a6238), cPile = new THREE.Color(0x3a2612);
      mbBox(mb, 60, 1.2, 237, 18, 0.4, 26, cDeck);
      [52, 60, 68].forEach(function (x) { [226, 237, 249].forEach(function (z) { mbBox(mb, x, -0.3, z, 0.7, 3.4, 0.7, cPile); }); });
      const m = new THREE.Mesh(mbGeo(mb), MAT.woodVC);
      m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false;
      root.add(m);
    })();

    // =====================================================================
    // 1. BARCOS: tres mercantes con mármol (ruta SITE.marbleRoute) y dos fondeados en el puerto
    // =====================================================================
    const boatsG = new THREE.Group();
    root.add(boatsG);
    const NSH = 5;
    const hullMB = MB();
    (function buildHull() {
      const cH = new THREE.Color(0x5b3d24), cB = new THREE.Color(0x2e1f12), cRail = new THREE.Color(0x7a5230);
      const top = [[-12, 1.8, 0], [-10, 2.6, 3.0], [-2, 2.6, 3.4], [6, 2.6, 3.4], [11, 2.4, 2.0], [13, 2.2, 0], [11, 2.4, -2.0], [6, 2.6, -3.4], [-2, 2.6, -3.4], [-10, 2.6, -3.0]];
      const bot = top.map(function (p) { return [p[0] * 0.75, 0.2, p[2] * 0.55]; });
      const inside = [0, 1.0, 0];
      for (let i = 1; i < top.length - 1; i++) mbTri(hullMB, top[0], top[i], top[i + 1], cH, inside);
      for (let i = 0; i < top.length; i++) {
        const j = (i + 1) % top.length;
        mbTri(hullMB, top[i], top[j], bot[j], cH, inside);
        mbTri(hullMB, top[i], bot[j], bot[i], cB, inside);
      }
      mbBox(hullMB, -9.0, 4.0, 0, 4.0, 2.4, 5.6, cRail);       // castillo de popa
      mbBox(hullMB, 0, 6.0, 0, 0.3, 11.0, 0.3, cRail);         // mástil
      mbBox(hullMB, 0, 8.4, 0, 0.12, 0.12, 9.0, cRail, Math.PI / 2);   // verga
    })();
    const hullIM = mkIM(mbGeo(hullMB), MAT.hull, NSH, true);
    const sailIM = mkIM((function () {
      const g = new THREE.PlaneGeometry(8.5, 8, 4, 4);
      g.translate(0, 4.0, 0);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) { const v = p.getY(i) / 8; p.setZ(i, 0.8 * Math.sin(Math.PI * v) * Math.sin(Math.PI * (p.getX(i) / 8.5 + 0.5))); }
      g.rotateY(Math.PI / 2);
      g.computeVertexNormals();
      return g;
    })(), MAT.sail, NSH, true);
    // mármol: 6 bloques por barco (en cubierta, en el aire, o apilados en el pantalán)
    const marbleIM = mkIM(new THREE.BoxGeometry(2.4, 1.2, 1.2), MAT.marble, 18, true);
    boatsG.add(hullIM, sailIM, marbleIM);
    for (let i = 0; i < 18; i++) marbleIM.setColorAt(i, _c.setHex(0xefe9dd));
    marbleIM.instanceColor.needsUpdate = true;

    const SHIPS = [{ A: 72, v: 17 }, { A: 134, v: 17 }, { A: 168, v: 17 }];   // llegada al muelle (s de video)
    const OUT = polyline([[DOCK.x, DOCK.z], [200, 420], [700, 800], [1600, 1400]]);   // SITE.marbleRoute invertida
    const ANCH = [{ x: -150, z: 330, hd: 0.5 }, { x: -320, z: 420, hd: -0.6 }];
    const dockM = new THREE.Matrix4().compose(new THREE.Vector3(DOCK.x, SEA + 0.25, DOCK.z), new THREE.Quaternion().setFromAxisAngle(_yAxis, DOCK_HD), _ONE);
    const shipState = [];
    for (let i = 0; i < 3; i++) shipState.push({ x: 0, z: 0, hd: 0, f: 0 });
    function deckLocal(c) { return new THREE.Vector3(-4.5 + (c % 3) * 4.5, 3.2 + Math.floor(c / 3) * 1.2, 0); }
    function stackPos(i, c) { return [55.5 + (c % 3) * 2.6, 2.0 + Math.floor(c / 3) * 1.2, 236 + i * 2.2]; }
    let qAct = null;   // bloque que la grúa del muelle está moviendo ahora

    function updateShips(s, t, W) {
      boatsG.visible = V(s.boats) > 0.002;
      qAct = null;
      if (!boatsG.visible) return;
      for (let i = 0; i < SHIPS.length; i++) {
        const H = SHIPS[i], st = shipState[i];
        const d = t < H.A ? (H.A - t) * H.v : (t < H.A + UNLOAD_DT ? 0 : (t - H.A - UNLOAD_DT) * H.v);
        const P = OUT.at(clamp(d / OUT.L, 0, 1));
        let hd = DOCK_HD;
        if (t < H.A) hd = headingOf(-P[2], -P[3]);
        else if (t >= H.A + UNLOAD_DT) hd = headingOf(P[2], P[3]);
        const f = d >= OUT.L ? 0 : sstep((OUT.L - d) / 60);
        const fs = Math.max(f, 0.0001);
        const bob = 0.06 * Math.sin(W * 0.9 + i * 2.1);
        st.x = P[0]; st.z = P[1]; st.hd = hd; st.f = f;
        const y = SEA + 0.25 + bob;
        _P.set(st.x, y, st.z); _Q.setFromAxisAngle(_yAxis, hd); _S.set(fs, fs, fs);
        const hm = _m.compose(_P, _Q, _S).clone();
        const hmPos = new THREE.Matrix4().compose(_P, _Q, _ONE);
        hullIM.setMatrixAt(i, hm); sailIM.setMatrixAt(i, hm);
        // carga: sobre cubierta hasta que la grúa la toma, luego pasa al pantalán
        for (let c = 0; c < 6; c++) {
          const bi = i * 6 + c;
          const T0 = H.A + 1.5 + c * 3.6;
          const p = clamp((t - T0) / 3.4, 0, 1);
          let sc = t >= 214 ? 0 : 1;
          let mm;
          if (t < T0) {
            _v.copy(deckLocal(c)).applyMatrix4(hmPos);
            sc = t >= 214 ? 0 : fs;
            _P.copy(_v); _Q.setFromAxisAngle(_yAxis, hd); _S.set(sc, sc, sc);
            mm = _m2.compose(_P, _Q, _S);
          } else {
            const P0 = deckLocal(c).applyMatrix4(dockM);
            const P1 = stackPos(i, c), e = sstep(p);
            const x = P0.x + (P1[0] - P0.x) * e;
            const yy = P0.y + (P1[1] - P0.y) * e + 6.5 * Math.sin(Math.PI * p);
            const z = P0.z + (P1[2] - P0.z) * e;
            if (p > 0 && p < 1) qAct = { x: x, y: yy, z: z };
            _P.set(x, yy, z); _Q.set(0, 0, 0, 1); _S.set(sc, sc, sc);
            mm = _m2.compose(_P, _Q, _S);
          }
          marbleIM.setMatrixAt(bi, mm);
        }
      }
      // fondeados en el puerto
      for (let k = 0; k < ANCH.length; k++) {
        const A = ANCH[k], i = 3 + k;
        const bob = 0.07 * Math.sin(W * 0.9 + k * 2.1), roll = 0.025 * Math.sin(W * 0.7 + k * 1.3);
        _P.set(A.x, SEA + 0.25 + bob, A.z); _Q.setFromEuler(_EU.set(0, A.hd, roll, 'YXZ')); _S.set(1, 1, 1);
        const hm = _m.compose(_P, _Q, _S).clone();
        hullIM.setMatrixAt(i, hm); sailIM.setMatrixAt(i, hm);
      }
      hullIM.instanceMatrix.needsUpdate = true;
      sailIM.instanceMatrix.needsUpdate = true;
      marbleIM.instanceMatrix.needsUpdate = true;
    }
    // =====================================================================
    // 2. CARROS CON BUEYES (mármol desde el pantalán hasta la terraza; de vuelta al castillo)
    // =====================================================================
    const CART_ROUTE = polyline([[57, 236], [50, 160], [38, 110], [30, 50]]);
    const NCART = 6;
    const cartBedMB = MB();
    (function () {
      const cW = new THREE.Color(0x7a5230), cD = new THREE.Color(0x4a3018);
      mbBox(cartBedMB, 0, 1.0, 0, 2.6, 0.25, 1.6, cW);
      mbBox(cartBedMB, 0, 1.25, 0.8, 2.6, 0.5, 0.12, cW);
      mbBox(cartBedMB, 0, 1.25, -0.8, 2.6, 0.5, 0.12, cW);
      mbBox(cartBedMB, 2.3, 0.85, 0.45, 1.4, 0.12, 0.12, cD);
      mbBox(cartBedMB, 2.3, 0.85, -0.45, 1.4, 0.12, 0.12, cD);
    })();
    const cartBedIM = mkIM(mbGeo(cartBedMB), MAT.woodVC, NCART, true);
    const cartWheelIM = mkIM((function () {
      const g = new THREE.CylinderGeometry(0.7, 0.7, 0.18, 12, 1);
      g.rotateX(Math.PI / 2);   // eje en Z: el giro se aplica después
      return g;
    })(), MAT.wood, NCART * 2, true);
    const cartBlockIM = mkIM(new THREE.BoxGeometry(1.2, 0.6, 0.6), MAT.marble, NCART * 2, true);
    const oxBodyIM = mkIM(new THREE.BoxGeometry(1.8, 1.0, 0.8), MAT.ox, NCART, true);
    const oxHeadIM = mkIM(new THREE.BoxGeometry(0.6, 0.6, 0.6), MAT.ox, NCART, true);
    const oxLegIM = mkIM(new THREE.BoxGeometry(0.18, 0.9, 0.18), MAT.ox, NCART * 4, false);
    boatsG.add(cartBedIM, cartWheelIM, cartBlockIM, oxBodyIM, oxHeadIM, oxLegIM);
    for (let k = 0; k < NCART * 2; k++) {
      // carros del pantalán: mármol blanco; carros al castillo: verdes y blancos
      const castleCart = k >= 6;
      cartBlockIM.setColorAt(k, _c.setHex(castleCart && (k % 2) ? 0x6f7a5e : 0xefe9dd));
    }
    cartBlockIM.instanceColor.needsUpdate = true;
    const _cm = new THREE.Matrix4(), _cw = new THREE.Matrix4(), _cb = new THREE.Matrix4(), _co = new THREE.Matrix4();

    function updateCarts(s, t, W) {
      for (let k = 0; k < NCART; k++) {
        let f, x, z, dx, dz;
        if (k < 3) {
          // ida y vuelta entre el pantalán y la terraza (t 76-128)
          const d = t * 3.5 + k * 60;
          const p = frac(d / (2 * CART_ROUTE.L)), u = p < 0.5 ? 2 * p : 2 - 2 * p, dir = p < 0.5 ? 1 : -1;
          const P = CART_ROUTE.at(u);
          x = P[0]; z = P[1]; dx = P[2] * dir; dz = P[3] * dir;
          f = (t > 76 && t < 128) ? sstep((t - 76) / 2) * sstep((128 - t) / 2) : 0;
        } else {
          // castillo: de la terraza al pantalán con bloques verdes y blancos (t 206-226)
          const j = k - 3;
          const u = clamp((t - 206 - j * 2) / 16, 0, 1);
          const P = CART_ROUTE.at(1 - u);
          x = P[0]; z = P[1]; dx = -P[2]; dz = -P[3];
          f = (t > 205 && t < 226) ? sstep((t - 205) / 2) * (1 - sstep((t - 224) / 2)) : 0;
        }
        const fs = Math.max(f, 0.0001);
        const hd = headingOf(dx, dz);
        _P.set(x, 0, z); _Q.setFromAxisAngle(_yAxis, hd); _S.set(fs, fs, fs);
        const cm = _cm.compose(_P, _Q, _S).clone();
        cartBedIM.setMatrixAt(k, cm);
        const spin = W * 5 + k;
        for (let w = 0; w < 2; w++) {
          _cw.copy(cm).multiply(Tr(0, 0.75, w ? 0.95 : -0.95)).multiply(Rx(Math.PI / 2)).multiply(Ry(spin));
          cartWheelIM.setMatrixAt(k * 2 + w, _cw);
        }
        for (let b = 0; b < 2; b++) {
          _cb.copy(cm).multiply(Tr(-0.5 + b * 1.0, 1.4, 0));
          cartBlockIM.setMatrixAt(k * 2 + b, _cb);
        }
        // dos bueyes delante del carro, andando
        for (let o = 0; o < 2; o++) {
          const side = o ? 0.6 : -0.6;
          _co.copy(cm).multiply(Tr(3.9, 0, side));
          const om = _co.clone();
          oxBodyIM.setMatrixAt(k * 2 + o, om.clone().multiply(Tr(0, 1.4, 0)));
          oxHeadIM.setMatrixAt(k * 2 + o, om.clone().multiply(Tr(1.25, 1.85, 0)));
          for (let l = 0; l < 4; l++) {
            const lx = (l < 2 ? 0.6 : -0.6), lz = (l % 2 ? 0.22 : -0.22);
            const sw = 0.2 * Math.sin(W * 4 + o * 2 + l * Math.PI / 2);
            oxLegIM.setMatrixAt((k * 2 + o) * 4 + l, om.clone().multiply(Tr(lx, 0.45, lz)).multiply(Rz(sw)));
          }
        }
      }
      cartBedIM.instanceMatrix.needsUpdate = true;
      cartWheelIM.instanceMatrix.needsUpdate = true;
      cartBlockIM.instanceMatrix.needsUpdate = true;
      oxBodyIM.instanceMatrix.needsUpdate = true;
      oxHeadIM.instanceMatrix.needsUpdate = true;
      oxLegIM.instanceMatrix.needsUpdate = true;
    }

    // =====================================================================
    // 3. BARCAZAS DEL CASTILLO (verdes y blancos, t 208-232)
    // =====================================================================
    const BARGE_ROUTE = polyline([[62, 262], [150, 300], [260, 350], [352, 378]]);
    const bargeHullIM = mkIM((function () {
      const mb = MB(), cW = new THREE.Color(0x6e4a2a), cIn = new THREE.Color(0x4f3519);
      mbBox(mb, 0, 0.3, 0, 16, 0.6, 4.6, cW);
      mbBox(mb, 0, 0.95, 2.25, 16, 0.9, 0.3, cW);
      mbBox(mb, 0, 0.95, -2.25, 16, 0.9, 0.3, cW);
      mbBox(mb, 8.1, 0.95, 0, 0.3, 0.9, 4.6, cW);
      mbBox(mb, -8.1, 0.95, 0, 0.3, 0.9, 4.6, cW);
      mbBox(mb, 0, 0.1, 0, 15.2, 0.1, 4.0, cIn);
      return mbGeo(mb);
    })(), MAT.woodVC, 2, true);
    const bargeBlockIM = mkIM(new THREE.BoxGeometry(2.4, 1.2, 1.2), MAT.marble, 12, true);
    boatsG.add(bargeHullIM, bargeBlockIM);
    for (let k = 0; k < 12; k++) bargeBlockIM.setColorAt(k, _c.setHex(k % 2 ? 0x6f7a5e : 0xefe9dd));
    bargeBlockIM.instanceColor.needsUpdate = true;

    function updateBarges(s, t, W) {
      for (let k = 0; k < 2; k++) {
        const T0 = 208 + k * 6, D = 16;
        const u = clamp((t - T0) / D, 0, 1);
        const P = BARGE_ROUTE.at(u);
        const fade = (t > 206 && t < 232 ? 1 : 0) * (1 - sstep((t - 229) / 3));
        const fs = Math.max(fade, 0.0001);
        const bob = 0.08 * Math.sin(W * 1.2 + k * 2.0);
        _P.set(P[0], SEA + 0.3 + bob, P[1]); _Q.setFromAxisAngle(_yAxis, headingOf(P[2], P[3])); _S.set(fs, fs, fs);
        const bm = _m.compose(_P, _Q, _S).clone();
        bargeHullIM.setMatrixAt(k, bm);
        for (let c = 0; c < 6; c++) {
          const unloaded = t > T0 + D + c * 1.2;
          const lx = -5 + (c % 3) * 3.2, ly = 1.0 + Math.floor(c / 3) * 1.2;
          const bcm = _m2.copy(bm).multiply(Tr(lx, ly, 0));
          bargeBlockIM.setMatrixAt(k * 6 + c, unloaded ? ZERO : bcm);
        }
      }
      bargeHullIM.instanceMatrix.needsUpdate = true;
      bargeBlockIM.instanceMatrix.needsUpdate = true;
    }

    // =====================================================================
    // 4. OBREROS (InstancedMesh, animados con s.wall)
    //    0-11 cantera de la fosa, 12-27 terraza, 28-51 obra en la cima,
    //    52-61 muro del castillo, 62-63 pantalán
    // =====================================================================
    const NW = 64;
    const workersG = new THREE.Group();
    root.add(workersG);
    const wTorso = mkIM(new THREE.BoxGeometry(0.42, 0.66, 0.24), MAT.cloth, NW, true);
    const wHead = mkIM(new THREE.SphereGeometry(0.14, 6, 4), MAT.skin, NW, false);
    const wLeg = mkIM(new THREE.BoxGeometry(0.19, 0.9, 0.2), MAT.cloth, NW * 2, true);
    const wArm = mkIM(new THREE.BoxGeometry(0.13, 0.66, 0.13), MAT.skin, NW * 2, false);
    const wTool = mkIM((function () {
      const mb = MB();
      mbBox(mb, 0, 0, 0, 0.07, 0.9, 0.07, new THREE.Color(0x7a5230));
      mbBox(mb, 0, 0.42, 0, 0.22, 0.16, 0.16, new THREE.Color(0x4a3018));
      return mbGeo(mb);
    })(), MAT.clothVC, NW, false);
    const WIMS = [wTorso, wHead, wLeg, wArm, wTool];
    WIMS.forEach(function (im) { workersG.add(im); });
    (function () {
      const pal = [0xd9c9a3, 0xb8794a, 0x3d6f9e, 0xe6e0d0, 0x8c3b2a];
      for (let i = 0; i < NW; i++) wTorso.setColorAt(i, _c.setHex(pal[i % pal.length]));
      for (let i = 0; i < NW * 2; i++) wLeg.setColorAt(i, _c.setHex(i % 2 ? 0x5b4a36 : 0x6b5a42));
      wTorso.instanceColor.needsUpdate = true;
      wLeg.instanceColor.needsUpdate = true;
    })();
    const _wR = new THREE.Matrix4(), _wA = new THREE.Matrix4(), _wB = new THREE.Matrix4(), _wE = new THREE.Euler();
    const _wq = new THREE.Quaternion(), _wp = new THREE.Vector3();
    let wSc = 1;   // escala global de la figura (0.0001 = oculta)
    function wRoot(x, y, z, hd) { _wp.set(x, y, z); _wq.setFromAxisAngle(_yAxis, hd); _wR.compose(_wp, _wq, _ONE); }
    function wPart(im, idx, px, py, pz, rx, rz, ox, oy, oz, sx, sy, sz) {
      _wA.makeTranslation(px, py, pz);
      _wE.set(rx, 0, rz, 'XYZ'); _wB.makeRotationFromEuler(_wE); _wA.multiply(_wB);
      _wB.makeTranslation(ox, oy, oz); _wA.multiply(_wB);
      _wB.makeScale(sx * wSc, sy * wSc, sz * wSc); _wA.multiply(_wB);
      _wB.multiplyMatrices(_wR, _wA);
      im.setMatrixAt(idx, _wB);
    }
    function drawWorker(i, P) {
      wPart(wTorso, i, 0, 1.25, 0, P.lean, 0, 0, 0, 0, 1, 1, 1);
      wPart(wHead, i, 0, 1.25, 0, P.lean, 0, 0, 0.45, 0, 1, 1, 1);
      wPart(wLeg, 2 * i, -0.11, 0.9, 0, P.ll, 0, 0, -0.45, 0, 1, 1, 1);
      wPart(wLeg, 2 * i + 1, 0.11, 0.9, 0, P.lr, 0, 0, -0.45, 0, 1, 1, 1);
      wPart(wArm, 2 * i, -0.27, 1.5, 0, P.al, 0, 0, -0.33, 0, 1, 1, 1);
      wPart(wArm, 2 * i + 1, 0.27, 1.5, 0, P.ar, 0, 0, -0.33, 0, 1, 1, 1);
      wPart(wTool, i, 0.27, 1.5, 0, P.ar, 0, 0, -0.72, 0.1, P.tool ? 1 : 0, P.tool ? 1 : 0, P.tool ? 1 : 0);
    }
    const PW = { ll: 0, lr: 0, al: 0, ar: 0, lean: 0, tool: 0 };

    function updateWorkers(s, t, W, yT) {
      const wo = clamp(V(s.workers), 0, 1);
      // 0-11: cavan la fosa (bancos a y=-4 y suelo a y=-8)
      const pitOn = V(s.excavation) > 0.05 && V(s.podium) < 0.05 && t < 84;
      for (let i = 0; i < 12; i++) {
        const h1 = hash(i + 500), h2 = hash(i + 600), h3 = hash(i + 700);
        const fy = i % 3 === 0 ? -4 : -8;
        wSc = pitOn ? 1 : 0.0001;
        wRoot(-16 + h1 * 26, fy, -8 + h2 * 16, h3 * TAU);
        PW.ar = -1.0 + 0.9 * Math.cos(W * 3 + i); PW.al = -0.3; PW.ll = 0.08; PW.lr = -0.08; PW.lean = 0.35; PW.tool = 1;
        drawWorker(i, PW);
      }
      // 12-27: terraza, caminan en carriles y algunos llevan cargas
      const terOn = wo > 0.02;
      for (let j = 0; j < 16; j++) {
        const i = 12 + j, h1 = hash(i + 500);
        const L = 76, d = W * (0.5 + 0.3 * h1) + h1 * 200;
        const p = frac(d / (2 * L)), u = p < 0.5 ? 2 * p : 2 - 2 * p, dir = p < 0.5 ? 1 : -1;
        wSc = terOn ? 1 : 0.0001;
        wRoot(-38 + L * u, 0, 40 + (j % 8) * 8 + h1 * 2, faceHd(dir, 0));
        const sw = Math.sin(W * 5 + h1 * TAU), carry = j % 2 === 0;
        PW.ll = 0.4 * sw; PW.lr = -0.4 * sw;
        PW.al = carry ? -1.0 : -0.2 * sw; PW.ar = carry ? -1.0 : 0.2 * sw;
        PW.lean = carry ? 0.12 : 0.04; PW.tool = 0;
        drawWorker(i, PW);
      }
      // 28-51: obra en la cima, de pie en el borde de la planta a la altura actual
      const ob = yT > 0.3 && V(s.cranes) > 0.02 && wo > 0.02 && V(s.ruin) < 0.01;
      const inset = yT > 31 ? 1.2 : 3.0;
      const ol = outline(Math.max(0, yT - 0.05));
      const hx = Math.max(1, ol.hx - inset), hz = Math.max(1, ol.hz - inset);
      for (let j = 0; j < 24; j++) {
        const i = 28 + j, h1 = hash(i + 500);
        const q = ringPt((j + 0.5 + h1 * 0.3) / 24, hx, hz);
        wSc = ob ? 1 : 0.0001;
        wRoot(q[0], yT, q[1], faceHd(-q[0], -q[1]));
        PW.ar = -1.2 + 0.9 * Math.cos(W * 3 + i); PW.al = -0.3; PW.ll = 0.08; PW.lr = -0.08; PW.lean = 0.35; PW.tool = 1;
        drawWorker(i, PW);
      }
      // 52-61: en lo alto del muro del castillo, a la altura que se ha alzado
      const cc = V(s.castle);
      const cOn = cc > 0.02 && cc < 0.93;
      const hTop = Math.min(WALL_H, cc * 33);
      for (let j = 0; j < 10; j++) {
        const i = 52 + j, h1 = hash(i + 500);
        const q = ringPt((j + 0.5) / 10 + h1 * 0.02, CS - 2.6, CS - 2.6);
        wSc = cOn ? 1 : 0.0001;
        wRoot(CX + q[0], hTop, CZ + q[1], faceHd(-q[0], -q[1]));
        PW.ar = -1.0 + 0.8 * Math.cos(W * 3 + i); PW.al = -0.2; PW.ll = 0; PW.lr = 0; PW.lean = 0.25; PW.tool = 1;
        drawWorker(i, PW);
      }
      // 62-63: estibadores en el pantalán mientras se descarga
      const qOn = t > 70 && t < 192 && wo > 0.02;
      for (let j = 0; j < 2; j++) {
        const i = 62 + j, h1 = hash(i + 500);
        const f = pingPong(W * 0.2 + j, 1);
        const x = 57 + 4 * f, z = 232 + j * 4;
        wSc = qOn ? 1 : 0.0001;
        wRoot(x, 0, z, faceHd(1, 0) + (f > 0.5 ? Math.PI : 0));
        const sw = Math.sin(W * 5 + h1 * TAU);
        PW.ll = 0.4 * sw; PW.lr = -0.4 * sw; PW.al = -1.0; PW.ar = -1.0; PW.lean = 0.12; PW.tool = 0;
        drawWorker(i, PW);
      }
      wSc = 1;
      WIMS.forEach(function (im) { im.instanceMatrix.needsUpdate = true; });
    }
    // =====================================================================
    // 5. GRÚAS DE MADERA con rueda de pisar (hombres dentro) y polipasto.
    //    Dos sobre la cima (a la altura de la obra) y una en el pantalán.
    //    Andamios RECTANGULARES siguiendo la planta a la altura de la obra.
    // =====================================================================
    const craneFrameGeo = (function () {
      const mb = MB(), cW = new THREE.Color(0x6e4a2a), cDk = new THREE.Color(0x3a2a1a);
      mbBox(mb, 0, 0.3, 0, 3.6, 0.6, 2.4, cW);              // plataforma
      mbBox(mb, 0, 7.0, 0, 0.45, 13.0, 0.45, cW);           // mástil
      mbBox(mb, 0, 4.6, 0.8, 0.12, 0.12, 0.12, cW);
      mbBox(mb, 0, 9.6, 0.8, 0.12, 0.12, 0.12, cW);
      mbBox(mb, 9.0, 12.6, 0, 18.0, 0.3, 0.3, cW);          // pluma (18 m)
      mbBox(mb, -3.5, 12.3, 0, 6.0, 0.25, 0.25, cW);        // contrapluma
      mbBox(mb, -6.2, 11.8, 0, 1.6, 1.2, 1.2, cDk);         // contrapeso
      mbBox(mb, 0, 13.8, 0, 1.0, 0.6, 0.9, cW);             // cabeza del mástil
      mbBox(mb, -2.0, 1.8, 1.4, 0.3, 3.6, 0.3, cW);         // soporte del eje de la rueda
      return mbGeo(mb);
    })();
    const wheelGeo = (function () {
      const mb = MB(), cW = new THREE.Color(0x6e4a2a);
      mbAdd(mb, new THREE.TorusGeometry(2.4, 0.2, 6, 20), new THREE.Matrix4(), cW);
      // radios: giro en el plano XY (eje Z)
      for (let k = 0; k < 6; k++) {
        const m = new THREE.Matrix4().makeRotationZ(k * Math.PI / 3);
        mbAdd(mb, new THREE.BoxGeometry(4.8, 0.12, 0.12), m, cW);
      }
      return mbGeo(mb);
    })();
    const frameIM = mkIM(craneFrameGeo, MAT.woodVC, 3, true);
    const wheelIM = mkIM(wheelGeo, MAT.woodVC, 3, true);
    const ropeIM = mkIM(new THREE.BoxGeometry(0.06, 1, 0.06), MAT.woodDk, 3, false);
    const hookIM = mkIM(new THREE.BoxGeometry(2.4, 1.2, 1.2), MAT.marble, 3, true);
    const menTorsoIM = mkIM(new THREE.BoxGeometry(0.34, 0.6, 0.24), MAT.cloth, 8, false);
    const menHeadIM = mkIM(new THREE.SphereGeometry(0.13, 6, 4), MAT.skin, 8, false);
    root.add(frameIM, wheelIM, ropeIM, hookIM, menTorsoIM, menHeadIM);
    for (let i = 0; i < 8; i++) menTorsoIM.setColorAt(i, _c.setHex(i % 2 ? 0x3d6f9e : 0xd9c9a3));
    menTorsoIM.instanceColor.needsUpdate = true;

    function updateCranes(s, t, W, yT) {
      const cr = V(s.cranes);
      const ruinOk = V(s.ruin) < 0.01;
      // dos grúas de la cima: en el lado oeste de la planta (fuera de la vista de la cámara)
      const topOn = yT > 0.5 && cr > 0.002 && ruinOk;
      const ol = outline(Math.max(0, yT - 0.05));
      for (let k = 0; k < 2; k++) {
        const sc = topOn ? Math.max(0.001, cr) : 0.0001;
        const bx = -0.42 * ol.hx, bz = (k === 0 ? 0.45 : -0.45) * ol.hz;
        const rot = 0.04 * Math.sin(W * 0.3 + k * 2);
        const M = TRS(_m, bx, topOn ? yT : -60, bz, 0, rot, 0, sc, sc, sc).clone();
        frameIM.setMatrixAt(k, M);
        const wsign = k === 0 ? 1 : -1, wa = W * 0.9 * wsign;
        const Wh = _m2.copy(M).multiply(Tr(-2.0, 3.6, 1.4)).multiply(Rz(wa)).clone();
        wheelIM.setMatrixAt(k, Wh);
        const ropeLen = 3 + 2.0 * (0.5 + 0.5 * Math.sin(W * 0.5 + k));
        ropeIM.setMatrixAt(k, _m3.copy(M).multiply(TRS(_m4, 17, 12.6 - ropeLen / 2, 0, 0, 0, 0, 1, ropeLen, 1)));
        hookIM.setMatrixAt(k, _m3.copy(M).multiply(Tr(17, 12.6 - ropeLen - 0.6, 0)));
        // cuatro hombres dentro de la rueda, girando con ella
        for (let m = 0; m < 4; m++) {
          const th = m * Math.PI / 2, rr = 2.1;
          const base = _m3.copy(Wh);
          const lm = base.clone().multiply(TRS(_m4, Math.cos(th) * rr, Math.sin(th) * rr, 0, 0, 0, th + Math.PI / 2, 1, 1, 1));
          menTorsoIM.setMatrixAt(k * 4 + m, lm);
          menHeadIM.setMatrixAt(k * 4 + m, lm.clone().multiply(Tr(0, 0.45, 0)));
        }
      }
      // grúa del pantalán: gira hacia el bloque que se descarga (o hacia el barco)
      const qOn = t > 70 && t < 192;
      let th = -Math.PI / 2, r = 12, by = 2.0;
      if (qAct && qOn) {
        const dx = qAct.x - QUAY.x, dz = qAct.z - QUAY.z;
        th = Math.atan2(-dz, dx); r = clamp(Math.hypot(dx, dz), 2, 17); by = qAct.y - 1.4;
      }
      const qsc = qOn ? 1 : 0.0001;
      const QM = TRS(_m, QUAY.x, 1.4, QUAY.z, 0, th, 0, qsc, qsc, qsc).clone();
      frameIM.setMatrixAt(2, QM);
      wheelIM.setMatrixAt(2, _m2.copy(QM).multiply(Tr(-2.0, 3.6, 1.4)).clone());
      const qLen = Math.max(0.1, 12.6 - (by + 0.6));
      ropeIM.setMatrixAt(2, _m3.copy(QM).multiply(TRS(_m4, r, 12.6 - qLen / 2, 0, 0, 0, 0, 1, qLen, 1)));
      hookIM.setMatrixAt(2, ZERO);   // el bloque es el propio mármol del pantalán
      frameIM.instanceMatrix.needsUpdate = true;
      wheelIM.instanceMatrix.needsUpdate = true;
      ropeIM.instanceMatrix.needsUpdate = true;
      hookIM.instanceMatrix.needsUpdate = true;
      menTorsoIM.instanceMatrix.needsUpdate = true;
      menHeadIM.instanceMatrix.needsUpdate = true;
    }

    // andamios: rectángulo que sigue la planta (38x32 en el podio) en la banda de obra (8 m bajo la cima)
    const NPOST = 64, NBRD = 140;
    const postIM = mkIM(new THREE.BoxGeometry(0.22, 8, 0.22), MAT.wood, NPOST, true);
    const boardIM = mkIM(new THREE.BoxGeometry(1, 0.14, 0.5), MAT.wood, NBRD, true);
    root.add(postIM, boardIM);
    function updateScaffold(s, yT) {
      const on = V(s.cranes) > 0.5 && yT > 2 && V(s.ruin) < 0.01 && yT < 46.5;
      if (!on) {
        for (let k = 0; k < NPOST; k++) postIM.setMatrixAt(k, ZERO);
        for (let k = 0; k < NBRD; k++) boardIM.setMatrixAt(k, ZERO);
      } else {
        const y0 = Math.max(0, yT - 8), y1 = yT, bh = y1 - y0;
        let hx = 0, hz = 0;
        [y0, (y0 + y1) / 2, y1].forEach(function (yy) { const o = outline(yy); hx = Math.max(hx, o.hx); hz = Math.max(hz, o.hz); });
        hx += 1.4; hz += 1.4;
        const C = [[-hx, -hz], [hx, -hz], [hx, hz], [-hx, hz]];
        const pts = [];
        for (let e = 0; e < 4; e++) {
          const A = C[e], B = C[(e + 1) % 4];
          const len = Math.hypot(B[0] - A[0], B[1] - A[1]), n = Math.max(1, Math.round(len / 3));
          for (let k = 0; k < n; k++) { const f = k / n; pts.push([A[0] + (B[0] - A[0]) * f, A[1] + (B[1] - A[1]) * f]); }
        }
        const np = Math.min(NPOST, pts.length);
        for (let k = 0; k < np; k++) {
          _P.set(pts[k][0], y0 + bh / 2, pts[k][1]); _Q.identity(); _S.set(1, bh / 8, 1);
          postIM.setMatrixAt(k, _m.compose(_P, _Q, _S));
        }
        for (let k = np; k < NPOST; k++) postIM.setMatrixAt(k, ZERO);
        let nb = 0;
        for (let k = 0; k < np; k++) {
          const A = pts[k], B = pts[(k + 1) % np];
          const dx = B[0] - A[0], dz = B[1] - A[1], L = Math.hypot(dx, dz);
          if (L < 0.01) continue;
          const mx = (A[0] + B[0]) / 2, mz = (A[1] + B[1]) / 2, hd = headingOf(dx, dz);
          for (let lv = 0; lv < 2 && nb < NBRD; lv++) {
            _P.set(mx, y0 + bh * (lv ? 0.8 : 0.3), mz); _Q.setFromAxisAngle(_yAxis, hd); _S.set(L, 1, 1);
            boardIM.setMatrixAt(nb++, _m.compose(_P, _Q, _S));
          }
        }
        for (let k = nb; k < NBRD; k++) boardIM.setMatrixAt(k, ZERO);
      }
      postIM.instanceMatrix.needsUpdate = true;
      boardIM.instanceMatrix.needsUpdate = true;
    }
    // =====================================================================
    // 6. PIRA FUNERARIA de Mausolo (t 38-50): troncos cruzados, lecho con el cuerpo envuelto,
    //    llamas aditivas, humo, chispas y luz naranja.
    // =====================================================================
    const pyreG = new THREE.Group();
    pyreG.position.set(PY.x, 0, PY.z);
    root.add(pyreG);
    const logsIM = mkIM(new THREE.CylinderGeometry(0.2, 0.24, 1, 7), MAT.logs, 24, true);
    pyreG.add(logsIM);
    (function buildLogs() {
      const LOGS = [];
      for (let i = 0; i < 9; i++) LOGS.push([0, 0.22, -1.2 + i * 0.3, 5.6, 0]);     // capa 1: a lo largo de X
      for (let i = 0; i < 9; i++) LOGS.push([-1.2 + i * 0.3, 0.62, 0, 5.6, 1]);     // capa 2: a lo largo de Z
      for (let i = 0; i < 6; i++) LOGS.push([0, 1.02, -0.75 + i * 0.3, 4.2, 0]);    // capa 3: a lo largo de X
      // cada entrada: [x, y, z, longitud, eje] con eje 0 = a lo largo de X, 1 = a lo largo de Z
      LOGS.forEach(function (L, i) {
        const along = L[4];
        const rz = along === 0 ? Math.PI / 2 : 0, rx = along === 1 ? Math.PI / 2 : 0;
        logsIM.setMatrixAt(i, TRS(new THREE.Matrix4(), L[0], L[1], L[2], rx, 0, rz, 1, L[3], 1));
      });
      logsIM.instanceMatrix.needsUpdate = true;
    })();
    // cuerpo envuelto en lino crema con bandas rojas, sobre el lecho
    const bodyMB = MB();
    (function () {
      const cloth = new THREE.Color(0xe6dcc0), band = new THREE.Color(0x8c3b2a);
      mbBox(bodyMB, 0, 1.45, 0, 2.0, 0.42, 0.62, cloth);
      mbBox(bodyMB, -1.2, 1.5, 0, 0.5, 0.46, 0.5, cloth);      // cabeza envuelta
      mbBox(bodyMB, 1.05, 1.42, 0, 0.3, 0.36, 0.5, cloth);     // pies
      [-0.7, -0.2, 0.3, 0.8].forEach(function (x) { mbBox(bodyMB, x, 1.45, 0, 0.12, 0.44, 0.66, band); });
    })();
    const bodyMesh = new THREE.Mesh(mbGeo(bodyMB), MAT.clothVC);
    bodyMesh.castShadow = true;
    pyreG.add(bodyMesh);
    // llamas: planos con textura de llama, color por instancia (brillo que parpadea)
    const NFL = 22;
    const flameIM = mkIM(new THREE.PlaneGeometry(1.6, 3.4).translate(0, 1.7, 0), MAT.flame, NFL, false);
    pyreG.add(flameIM);
    const glowMesh = new THREE.Mesh(new THREE.CircleGeometry(7, 24).rotateX(-Math.PI / 2), MAT.glow);
    glowMesh.position.y = 0.08; glowMesh.frustumCulled = false;
    pyreG.add(glowMesh);
    const NSM = 60, smokePos = new Float32Array(NSM * 3), smokeGeo = new THREE.BufferGeometry();
    smokeGeo.setAttribute('position', new THREE.BufferAttribute(smokePos, 3));
    const smokePts = new THREE.Points(smokeGeo, MAT.smoke); smokePts.frustumCulled = false;
    const NSP = 50, sparkPos = new Float32Array(NSP * 3), sparkGeo = new THREE.BufferGeometry();
    sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
    const sparkPts = new THREE.Points(sparkGeo, MAT.spark); sparkPts.frustumCulled = false;
    pyreG.add(smokePts, sparkPts);
    // luz: fuera del grupo para que siempre exista (intensidad 0 cuando no arde)
    const pyreLight = new THREE.PointLight(0xff8a3a, 0, 60, 2);
    pyreLight.position.set(PY.x, 3.5, PY.z);
    root.add(pyreLight);

    function updatePyre(t, W, p) {
      pyreG.visible = p > 0.002;
      pyreLight.intensity = p * 60 * (0.9 + 0.1 * Math.sin(W * 13) + 0.05 * Math.sin(W * 5.3));
      if (!pyreG.visible) return;
      MAT.logs.emissiveIntensity = 0.5 * p;
      MAT.glow.opacity = 0.5 * p * (0.85 + 0.15 * Math.sin(W * 7));
      for (let k = 0; k < NFL; k++) {
        const h1 = hash(k + 900), h2 = hash(k + 950);
        const ph = W * (7 + 3 * h1) + k;
        const r = 0.5 + h2 * 1.9, a = h1 * TAU;
        const hh = (0.8 + 0.5 * Math.sin(ph)) * p;
        _P.set(Math.cos(a) * r, 1.25, Math.sin(a) * r);
        _Q.setFromAxisAngle(_yAxis, h1 * TAU + W * 0.5);
        _S.set(0.7 + 0.5 * h2, Math.max(0.001, hh * 1.1), 1);
        flameIM.setMatrixAt(k, _m.compose(_P, _Q, _S));
        const br = 0.65 + 0.35 * Math.sin(ph * 1.7 + 0.5);
        flameIM.setColorAt(k, _c.setRGB(br, br * 0.85, br * 0.5));
      }
      flameIM.instanceMatrix.needsUpdate = true;
      flameIM.instanceColor.needsUpdate = true;
      smokeGeo.setDrawRange(0, Math.round(NSM * p));
      for (let i = 0; i < NSM; i++) {
        const age = frac(W * 0.09 + hash(i + 1000));
        smokePos[i * 3] = (hash(i + 1100) - 0.5) * 2 + age * 4.5;
        smokePos[i * 3 + 1] = 4 + age * 20;
        smokePos[i * 3 + 2] = (hash(i + 1200) - 0.5) * 2 + age * 1.5;
      }
      smokeGeo.attributes.position.needsUpdate = true;
      MAT.smoke.opacity = 0.35 * p;
      sparkGeo.setDrawRange(0, Math.round(NSP * p));
      for (let i = 0; i < NSP; i++) {
        const age = frac(W * 1.1 + hash(i + 30));
        sparkPos[i * 3] = (hash(i + 40) - 0.5) * 3 * age;
        sparkPos[i * 3 + 1] = 2 + age * 6;
        sparkPos[i * 3 + 2] = (hash(i + 50) - 0.5) * 3 * age;
      }
      sparkGeo.attributes.position.needsUpdate = true;
      MAT.spark.opacity = 0.9 * p;
    }

    // =====================================================================
    // 7. CASTILLO DE SAN PEDRO (Caballeros de San Juan) en SITE.castle.
    //    Crece de abajo arriba con castle 0..1 (plano de recorte). Torres:
    //    inglesa (NO), italiana (NE), francesa (SE), alemana (SO), española (S), homenaje (centro).
    // =====================================================================
    const castleG = new THREE.Group();
    castleG.position.set(CX, 0, CZ);
    root.add(castleG);
    const MERLONS = [];   // [x, y, z, heading]
    (function buildCastle() {
      const mb = MB();
      const cols = [0xefe9dd, 0x6f7a5e, 0xd9cdb2, 0x7d8a6a, 0xe6dfcf];
      let pk = 0;
      function pick() { return new THREE.Color(cols[Math.floor(hash(pk++ * 3.7 + 11) * cols.length)]); }
      // muros: paneles de 6 m con colores mezclados (piedra del mausoleo); puerta en el oeste
      for (let i = 0; i < 18; i++) {
        const u = -CS + 3 + i * 6;
        mbBox(mb, u, WALL_H / 2, -CS, 6, WALL_H, WT, pick());
        mbBox(mb, u, WALL_H / 2, CS, 6, WALL_H, WT, pick());
        mbBox(mb, CS, WALL_H / 2, u, WT, WALL_H, 6, pick());
        if (Math.abs(u) > 7.5) mbBox(mb, -CS, WALL_H / 2, u, WT, WALL_H, 6, pick());
      }
      // troneras en el muro exterior
      for (let i = 0; i < 18; i += 2) {
        const u = -CS + 3 + i * 6, dk = new THREE.Color(0x3a3026);
        mbBox(mb, u, 8, -CS - WT / 2 - 0.05, 0.35, 2.2, 0.3, dk);
        mbBox(mb, u, 8, CS + WT / 2 + 0.05, 0.35, 2.2, 0.3, dk);
        mbBox(mb, CS + WT / 2 + 0.05, 8, u, 0.3, 2.2, 0.35, dk);
      }
      // dintel de la puerta
      mbBox(mb, -CS, 11.5, 0, WT + 0.4, 5, 12, new THREE.Color(0xcfc5ae));
      // torres: inglesa (redonda), italiana, francesa, alemana (redonda), española (redonda), homenaje
      const TOWERS = [
        { r: 7.0, x: -CS, z: -CS, h: 24, round: true },
        { s: 12, x: CS, z: -CS, h: 26 },
        { s: 11, x: CS, z: CS, h: 25 },
        { r: 6.2, x: -CS, z: CS, h: 23, round: true },
        { r: 7.5, x: 0, z: CS, h: 26, round: true },
        { s: 15, x: 0, z: 0, h: 31 },
        { s: 6.6, x: -CS, z: -9, h: 18 },
        { s: 6.6, x: -CS, z: 9, h: 18 }
      ];
      TOWERS.forEach(function (T) {
        if (T.round) mbCyl(mb, T.x, T.h / 2, T.z, T.r, T.h, 20, pick());
        else mbBox(mb, T.x, T.h / 2, T.z, T.s, T.h, T.s, pick());
        // almenas en el borde superior
        if (T.round) {
          const n = Math.floor(TAU * T.r / 3.2);
          for (let k = 0; k < n; k++) {
            const a = k * TAU / n, R = T.r - 0.4;
            MERLONS.push([T.x + Math.cos(a) * R, T.h + 0.8, T.z + Math.sin(a) * R, headingOf(-Math.sin(a), Math.cos(a))]);
          }
        } else {
          const h = T.s / 2, C = [[-h, -h], [h, -h], [h, h], [-h, h]];
          const n = Math.floor(T.s / 3.2);
          for (let e = 0; e < 4; e++) {
            const A = C[e], B = C[(e + 1) % 4];
            for (let k = 0; k < n; k++) {
              const f = (k + 0.5) / n;
              MERLONS.push([T.x + A[0] + (B[0] - A[0]) * f, T.h + 0.8, T.z + A[1] + (B[1] - A[1]) * f, headingOf(B[0] - A[0], B[1] - A[1])]);
            }
          }
        }
      });
      // almenas de los muros (dejando la puerta libre)
      for (let u = -CS + 1.6; u <= CS - 1.6; u += 3.2) {
        MERLONS.push([u, WALL_H + 0.8, -CS, 0]);
        MERLONS.push([u, WALL_H + 0.8, CS, 0]);
        MERLONS.push([CS, WALL_H + 0.8, u, -Math.PI / 2]);
        if (Math.abs(u) > 7.5) MERLONS.push([-CS, WALL_H + 0.8, u, -Math.PI / 2]);
      }
      const castMesh = new THREE.Mesh(mbGeo(mb), MAT.castle);
      castMesh.castShadow = true; castMesh.receiveShadow = true; castMesh.frustumCulled = false;
      castleG.add(castMesh);
      // almenas como instancias
      const merlonIM = mkIM(new THREE.BoxGeometry(1.6, 1.6, 1.2), MAT.merlon, MERLONS.length, true);
      MERLONS.forEach(function (M, i) {
        merlonIM.setMatrixAt(i, TRS(new THREE.Matrix4(), M[0], M[1], M[2], 0, M[3], 0, 1, 1, 1));
      });
      merlonIM.instanceMatrix.needsUpdate = true;
      castleG.add(merlonIM);
      // estandartes con la cruz de los Caballeros sobre cada torre
      const TOPS = [[-CS, -CS, 24], [CS, -CS, 26], [CS, CS, 25], [-CS, CS, 23], [0, CS, 26], [0, 0, 31]];
      const poleIM = mkIM(new THREE.BoxGeometry(0.16, 4.5, 0.16), MAT.wood, 6, false);
      const flagIM = mkIM(new THREE.PlaneGeometry(4.2, 2.6).translate(2.1, 0, 0), MAT.banner, 6, false);
      castleG.add(poleIM, flagIM);
      TOPS.forEach(function (T, k) {
        poleIM.setMatrixAt(k, TRS(new THREE.Matrix4(), T[0], T[2] + 2.25, T[1], 0, 0, 0, 1, 1, 1));
      });
      poleIM.instanceMatrix.needsUpdate = true;
      castleG.userData = { TOPS: TOPS, flagIM: flagIM };
    })();
    const CASTLE_TOPS = castleG.userData.TOPS, castleFlagIM = castleG.userData.flagIM;
    // Nota: las almenas de los muros que miran al este/oeste se orientan con su eje a lo largo del muro.

    function updateCastle(t, W, c) {
      castleG.visible = c > 0.002;
      castleClip.constant = c * 33;
      if (!castleG.visible) return;
      const bs = c > 0.9 ? 1 : 0.0001;
      for (let k = 0; k < CASTLE_TOPS.length; k++) {
        const T = CASTLE_TOPS[k];
        const ang = (k % 2 ? 0.5 : -0.5) + 0.15 * Math.sin(W * 2 + k);
        castleFlagIM.setMatrixAt(k, TRS(new THREE.Matrix4(), T[0], T[2] + 3.7, T[1], 0, ang, 0, bs, bs, bs));
      }
      castleFlagIM.instanceMatrix.needsUpdate = true;
    }

    // =====================================================================
    // update: cada parte depende solo de s (sin acumular)
    // =====================================================================
    function update(s) {
      const W = V(s.wall), t = V(s.t);
      const yT = topHeight(s);
      updateShips(s, t, W);
      updateCarts(s, t, W);
      updateBarges(s, t, W);
      updateWorkers(s, t, W, yT);
      updateCranes(s, t, W, yT);
      updateScaffold(s, yT);
      updatePyre(t, W, clamp(V(s.pyre), 0, 1));
      updateCastle(t, W, clamp(V(s.castle), 0, 1));
    }

    return { update: update, group: root };
  };
})();
