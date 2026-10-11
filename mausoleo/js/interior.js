// Interior bajo la planta del podio: tapa del hueco del suelo, fosa excavada en la roca, cámara funeraria
// con escalera y bloque de sellado, ofrendas, tesoro que se desvanece y resaltado de rayos X en cian.
(function () {
  'use strict';
  const G = window.GIZA;

  G.createInterior = function (ctx) {
    const THREE = ctx.THREE, scene = ctx.scene, renderer = ctx.renderer;
    const MAUS = G.MAUS, CH = MAUS.chamber, PD = MAUS.podium;
    const root = new THREE.Group(); scene.add(root);

    // ---------- utilidades ----------
    const clamp01 = function (x) { x = Number(x) || 0; return x < 0 ? 0 : (x > 1 ? 1 : x); };
    const smooth = function (x) { return x * x * (3 - 2 * x); };
    function mulberry32(a) {
      return function () {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), a | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }

    // Triangle soup con normales y UV propios (para roca, tierra, bloques y tapas)
    function Soup() { this.p = []; this.n = []; this.uv = []; }
    Soup.prototype.tri = function (a, b, c, ua, ub, uc, nrm, ref) {
      let nx, ny, nz;
      if (nrm) { nx = nrm[0]; ny = nrm[1]; nz = nrm[2]; }
      else {
        const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
        const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
        nx = uy * vz - uz * vy; ny = uz * vx - ux * vz; nz = ux * vy - uy * vx;
        const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
        if (ref) {
          const cx = (a[0] + b[0] + c[0]) / 3, cy = (a[1] + b[1] + c[1]) / 3, cz = (a[2] + b[2] + c[2]) / 3;
          if ((ref[0] - cx) * nx + (ref[1] - cy) * ny + (ref[2] - cz) * nz < 0) { nx = -nx; ny = -ny; nz = -nz; }
        }
      }
      this.p.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
      this.n.push(nx, ny, nz, nx, ny, nz, nx, ny, nz);
      this.uv.push(ua[0], ua[1], ub[0], ub[1], uc[0], uc[1]);
      return this;
    };
    Soup.prototype.quad = function (a, b, c, d, uvf, nrm, ref) {
      this.tri(a, b, c, uvf(a), uvf(b), uvf(c), nrm, ref);
      this.tri(a, c, d, uvf(a), uvf(c), uvf(d), nrm, ref);
      return this;
    };
    // caja alineada con UV en coordenadas de mundo (tile = metros por repetición)
    Soup.prototype.box = function (x0, x1, y0, y1, z0, z1, tile) {
      const T = tile || 1;
      const xz = function (p) { return [p[0] / T, p[2] / T]; };
      const zy = function (p) { return [p[2] / T, p[1] / T]; };
      const xy = function (p) { return [p[0] / T, p[1] / T]; };
      this.quad([x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1], xz, [0, 1, 0]);
      this.quad([x0, y0, z1], [x1, y0, z1], [x1, y0, z0], [x0, y0, z0], xz, [0, -1, 0]);
      this.quad([x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1], zy, [1, 0, 0]);
      this.quad([x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [x0, y0, z0], zy, [-1, 0, 0]);
      this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], xy, [0, 0, 1]);
      this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], xy, [0, 0, -1]);
      return this;
    };
    Soup.prototype.geo = function () {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
      return g;
    };

    // Primitiva colocada (horneada) en el espacio del módulo
    function place(geo, x, y, z, rx, ry, rz, sx, sy, sz) {
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rx || 0, ry || 0, rz || 0));
      const m = new THREE.Matrix4().compose(new THREE.Vector3(x || 0, y || 0, z || 0), q,
        new THREE.Vector3(sx || 1, sy || 1, sz || 1));
      const g = geo.index ? geo.toNonIndexed() : geo;
      if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      g.applyMatrix4(m);
      return g;
    }
    function tint(g, hex) {
      const c = new THREE.Color(hex), n = g.attributes.position.count, C = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { C[i * 3] = c.r; C[i * 3 + 1] = c.g; C[i * 3 + 2] = c.b; }
      g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
      return g;
    }
    function mergeGeos(list, withColor) {
      let n = 0;
      for (let i = 0; i < list.length; i++) n += list[i].attributes.position.count;
      const P = new Float32Array(n * 3), N = new Float32Array(n * 3), U = new Float32Array(n * 2);
      const C = withColor ? new Float32Array(n * 3) : null;
      let o = 0;
      for (let i = 0; i < list.length; i++) {
        const g = list[i], c = g.attributes.position.count;
        P.set(g.attributes.position.array, o * 3);
        N.set(g.attributes.normal.array, o * 3);
        U.set(g.attributes.uv.array, o * 2);
        if (C && g.attributes.color) C.set(g.attributes.color.array, o * 3);
        o += c;
      }
      const out = new THREE.BufferGeometry();
      out.setAttribute('position', new THREE.BufferAttribute(P, 3));
      out.setAttribute('normal', new THREE.BufferAttribute(N, 3));
      out.setAttribute('uv', new THREE.BufferAttribute(U, 2));
      if (C) out.setAttribute('color', new THREE.BufferAttribute(C, 3));
      return out;
    }
    function mergePos(list) {
      let n = 0;
      for (let i = 0; i < list.length; i++) n += list[i].attributes.position.count;
      const P = new Float32Array(n * 3);
      let o = 0;
      for (let i = 0; i < list.length; i++) { P.set(list[i].attributes.position.array, o * 3); o += list[i].attributes.position.count; }
      const out = new THREE.BufferGeometry();
      out.setAttribute('position', new THREE.BufferAttribute(P, 3));
      return out;
    }

    // ---------- entorno: mapa de cielo para metales (PMREM) ----------
    const envScene = new THREE.Scene();
    const skyGeo = new THREE.SphereGeometry(100, 32, 16);
    (function () {
      const pos = skyGeo.attributes.position, cols = new Float32Array(pos.count * 3);
      const bottom = new THREE.Color(0x2b2c33), horizon = new THREE.Color(0xc9b58f), top = new THREE.Color(0xfff1d6), c = new THREE.Color();
      for (let i = 0; i < pos.count; i++) {
        const u = clamp01((pos.getY(i) + 100) / 200);
        if (u < 0.5) c.copy(bottom).lerp(horizon, u * 2); else c.copy(horizon).lerp(top, (u - 0.5) * 2);
        cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
      }
      skyGeo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    })();
    envScene.add(new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(envScene, 0.04).texture;

    // ---------- texturas dibujadas por código ----------
    function makeTex(w, h, draw) {
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      draw(c.getContext('2d'), w, h, mulberry32(w * 31 + h));
      const t = new THREE.CanvasTexture(c);
      t.encoding = THREE.sRGBEncoding;
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = 4;
      t.needsUpdate = true;
      return t;
    }
    const texRock = makeTex(256, 256, function (g, w, h, R) {
      g.fillStyle = '#cbb787'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 2600; i++) {
        g.fillStyle = R() < 0.5 ? 'rgba(255,248,226,' + (0.08 + R() * 0.12).toFixed(3) + ')' : 'rgba(92,70,40,' + (0.08 + R() * 0.14).toFixed(3) + ')';
        g.fillRect(R() * w, R() * h, 1 + R() * 2, 1 + R() * 2);
      }
      g.lineWidth = 1.5;
      for (let y = 0; y < h; y += 22 + R() * 10) {
        g.strokeStyle = 'rgba(110,88,55,0.28)';
        g.beginPath(); g.moveTo(0, y + R() * 4); g.quadraticCurveTo(w * 0.5, y + R() * 6 - 3, w, y + R() * 4); g.stroke();
      }
      for (let i = 0; i < 110; i++) {   // marcas de pico
        const x = R() * w, y = R() * h, a = -0.7 + (R() - 0.5) * 0.4, L = 6 + R() * 9;
        const dx = Math.cos(a) * L, dy = Math.sin(a) * L;
        g.strokeStyle = 'rgba(255,245,220,0.35)'; g.lineWidth = 1.4;
        g.beginPath(); g.moveTo(x + 1, y + 1); g.lineTo(x + dx + 1, y + dy + 1); g.stroke();
        g.strokeStyle = 'rgba(78,58,34,0.55)'; g.lineWidth = 1.2;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + dx, y + dy); g.stroke();
      }
    });
    const texTerrace = makeTex(256, 256, function (g, w, h, R) {
      g.fillStyle = '#d6cdb2'; g.fillRect(0, 0, w, h);
      let y = 0;
      while (y < h) {
        const hh = 40 + R() * 16; let x = -R() * 40;
        while (x < w) {
          const ww = 60 + R() * 40;
          g.fillStyle = R() < 0.5 ? 'rgba(255,252,240,0.12)' : 'rgba(120,104,78,0.10)';
          g.fillRect(x, y, ww, hh);
          g.strokeStyle = 'rgba(80,70,52,0.65)'; g.lineWidth = 2; g.strokeRect(x, y, ww, hh);
          x += ww;
        }
        y += hh;
      }
      for (let i = 0; i < 1800; i++) { g.fillStyle = 'rgba(90,80,60,' + (0.05 + R() * 0.1).toFixed(3) + ')'; g.fillRect(R() * w, R() * h, 1.5, 1.5); }
    });
    const texEarth = makeTex(256, 256, function (g, w, h, R) {
      g.fillStyle = '#7b5b3b'; g.fillRect(0, 0, w, h);
      const cols = ['#5e4329', '#8f6d48', '#a58157', '#4a3520', '#6d5033'];
      for (let i = 0; i < 3200; i++) {
        g.fillStyle = cols[Math.floor(R() * cols.length)];
        g.globalAlpha = 0.35 + R() * 0.4;
        const s = 1 + R() * 3; g.fillRect(R() * w, R() * h, s, s * 0.7);
      }
      g.globalAlpha = 1;
    });
    const texWicker = makeTex(128, 128, function (g, w, h) {
      g.fillStyle = '#9c7a48'; g.fillRect(0, 0, w, h);
      for (let i = -h; i < w + h; i += 9) {
        g.lineWidth = 3.5;
        g.strokeStyle = 'rgba(60,40,20,0.55)'; g.beginPath(); g.moveTo(i, 0); g.lineTo(i + h, h); g.stroke();
        g.strokeStyle = 'rgba(60,40,20,0.45)'; g.beginPath(); g.moveTo(i, h); g.lineTo(i + h, 0); g.stroke();
        g.lineWidth = 1.5; g.strokeStyle = 'rgba(232,204,146,0.35)'; g.beginPath(); g.moveTo(i + 2, 0); g.lineTo(i + h + 2, h); g.stroke();
      }
    });
    const texBlock = makeTex(256, 256, function (g, w, h, R) {  // sillería: hiladas con juntas
      g.fillStyle = '#e4dac2'; g.fillRect(0, 0, w, h);
      const rows = 3, rh = h / rows;
      for (let r = 0; r < rows; r++) {
        let x = -R() * 120; const y = r * rh;
        while (x < w) {
          const bw = 110 + R() * 70;
          g.fillStyle = R() < 0.5 ? 'rgba(255,255,250,0.10)' : 'rgba(120,100,70,0.08)';
          g.fillRect(x, y, bw, rh);
          g.strokeStyle = '#8f8169'; g.lineWidth = 3; g.strokeRect(x, y, bw, rh);
          x += bw;
        }
      }
      for (let i = 0; i < 1400; i++) { g.fillStyle = 'rgba(110,92,64,' + (0.04 + R() * 0.08).toFixed(3) + ')'; g.fillRect(R() * w, R() * h, 2, 2); }
    });
    const texGlow = (function () {
      const c = document.createElement('canvas'); c.width = 128; c.height = 128;
      const g = c.getContext('2d');
      const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      gr.addColorStop(0, 'rgba(255,220,140,1)'); gr.addColorStop(0.35, 'rgba(224,178,87,0.45)'); gr.addColorStop(1, 'rgba(224,178,87,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
      const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding;
      return t;
    })();
    function labelTex(text) {
      const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 160;
      const g = cv.getContext('2d');
      g.font = 'bold 80px "Courier New", monospace';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.shadowColor = '#3fdcff'; g.shadowBlur = 18;
      g.fillStyle = '#c4f7ff';
      g.fillText(text, 512, 84);
      g.shadowBlur = 0;
      const t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding;
      return t;
    }

    // ---------- materiales (opacidad se fija en update) ----------
    const M = {
      rock: new THREE.MeshStandardMaterial({ map: texRock, emissive: 0xffffff, emissiveMap: texRock, emissiveIntensity: 0.1, roughness: 0.93, side: THREE.DoubleSide }),
      terrace: new THREE.MeshStandardMaterial({ map: texTerrace, emissive: 0xffffff, emissiveMap: texTerrace, emissiveIntensity: 0.1, roughness: 0.9, side: THREE.DoubleSide }),
      earth: new THREE.MeshStandardMaterial({ map: texEarth, emissive: 0xffffff, emissiveMap: texEarth, emissiveIntensity: 0.1, roughness: 1, side: THREE.DoubleSide }),
      block: new THREE.MeshStandardMaterial({ map: texBlock, emissive: 0xffffff, emissiveMap: texBlock, emissiveIntensity: 0.1, roughness: 0.85, side: THREE.DoubleSide, transparent: true, opacity: 1, depthWrite: false }),
      wicker: new THREE.MeshStandardMaterial({ map: texWicker, emissive: 0xffffff, emissiveMap: texWicker, emissiveIntensity: 0.1, roughness: 0.9, side: THREE.DoubleSide }),
      bone: new THREE.MeshStandardMaterial({ color: 0xe8dcc0, roughness: 0.7, transparent: true, opacity: 0, depthWrite: false }),
      vessel: new THREE.MeshStandardMaterial({ color: 0xb5653a, roughness: 0.6, transparent: true, opacity: 0, depthWrite: false }),
      egg: new THREE.MeshStandardMaterial({ color: 0xf1e6cc, roughness: 0.5, transparent: true, opacity: 0, depthWrite: false }),
      gold: new THREE.MeshStandardMaterial({ color: 0xe0b257, metalness: 1, roughness: 0.26, envMap: envTex, envMapIntensity: 1.2,
        emissive: 0xe0b257, emissiveIntensity: 0, transparent: true, opacity: 0, depthWrite: false }),
      jewel: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.2, metalness: 0.2, emissive: 0x3a2a08, transparent: true, opacity: 0, depthWrite: false }),
      line: new THREE.LineBasicMaterial({ color: 0x7fe3f0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false }),
      dust: new THREE.PointsMaterial({ color: 0xffd47a, size: 0.16, sizeAttenuation: true, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }),
      glow: new THREE.SpriteMaterial({ map: texGlow, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })
    };

    // ---------- 1) tapa del hueco (suelo del entorno: x -30..20, z -18..18) ----------
    const HX0 = -30, HX1 = 20, HZ0 = -18, HZ1 = 18, PIT_Y = -8, LID_Y = 0.03;
    const pX = PD.halfX, pZ = PD.halfZ;               // planta del podio (19 x 16)
    const flat = function (x0, x1, z0, z1) {
      return new Soup().quad([x0, LID_Y, z0], [x1, LID_Y, z0], [x1, LID_Y, z1], [x0, LID_Y, z1],
        function (p) { return [p[0] / 3, p[2] / 3]; }, [0, 1, 0]).geo();
    };
    const lidFull = new THREE.Mesh(flat(HX0 - 0.05, HX1 + 0.05, HZ0 - 0.05, HZ1 + 0.05), M.terrace);
    lidFull.receiveShadow = true;
    const ringSoup = new Soup();
    const ringQuads = [[HX0, HX1, HZ0, -pZ], [HX0, HX1, pZ, HZ1], [HX0, -pX, -pZ, pZ], [pX, HX1, -pZ, pZ]];
    ringQuads.forEach(function (r) {
      ringSoup.quad([r[0], LID_Y, r[2]], [r[1], LID_Y, r[2]], [r[1], LID_Y, r[3]], [r[0], LID_Y, r[3]],
        function (p) { return [p[0] / 3, p[2] / 3]; }, [0, 1, 0]);
    });
    const lidRing = new THREE.Mesh(ringSoup.geo(), M.terrace);
    lidRing.receiveShadow = true;
    root.add(lidFull, lidRing);

    // ---------- 2) fosa excavada ----------
    const pit = new THREE.Group(); root.add(pit);
    const wallSoup = new Soup(), WT = 4, ctr = [-5, -4, 0];
    wallSoup.quad([HX0, PIT_Y, HZ0], [HX0, PIT_Y, HZ1], [HX0, 0, HZ1], [HX0, 0, HZ0], function (p) { return [p[2] / WT, p[1] / WT]; }, null, ctr);
    wallSoup.quad([HX1, PIT_Y, HZ1], [HX1, PIT_Y, HZ0], [HX1, 0, HZ0], [HX1, 0, HZ1], function (p) { return [p[2] / WT, p[1] / WT]; }, null, ctr);
    wallSoup.quad([HX0, PIT_Y, HZ0], [HX1, PIT_Y, HZ0], [HX1, 0, HZ0], [HX0, 0, HZ0], function (p) { return [p[0] / WT, p[1] / WT]; }, null, ctr);
    wallSoup.quad([HX1, PIT_Y, HZ1], [HX0, PIT_Y, HZ1], [HX0, 0, HZ1], [HX1, 0, HZ1], function (p) { return [p[0] / WT, p[1] / WT]; }, null, ctr);
    const pitRock = new THREE.Mesh(wallSoup.geo(), M.rock); pitRock.receiveShadow = true;
    pit.add(pitRock);

    const earthSoup = new Soup(), ET = 4;
    const eUV = function (p) { return [p[0] / ET, p[2] / ET]; };
    earthSoup.quad([HX0, PIT_Y, HZ0], [HX1, PIT_Y, HZ0], [HX1, PIT_Y, HZ1], [HX0, PIT_Y, HZ1], eUV, [0, 1, 0]);
    // rampa de tierra subiendo desde el fondo hasta el borde este
    const rUV = function (p) { return [p[0] / 3, p[2] / 3]; };
    earthSoup.quad([10, PIT_Y, -6], [20, 0, -6], [20, 0, 6], [10, PIT_Y, 6], rUV, null, [0, 100, 0]);
    earthSoup.tri([10, PIT_Y, -6], [20, PIT_Y, -6], [20, 0, -6], rUV([10, PIT_Y, -6]), rUV([20, PIT_Y, -6]), rUV([20, 0, -6]), [0, 0, -1]);
    earthSoup.tri([10, PIT_Y, 6], [20, 0, 6], [20, PIT_Y, 6], rUV([10, PIT_Y, 6]), rUV([20, 0, 6]), rUV([20, PIT_Y, 6]), [0, 0, 1]);
    const pitEarth = new THREE.Mesh(earthSoup.geo(), M.earth); pitEarth.receiveShadow = true;
    pit.add(pitEarth);

    // montones de escombro, trozos de roca y cestas (grupo con base en el fondo, y=0 local = y -8)
    const spoil = new THREE.Group(); spoil.position.set(0, PIT_Y, 0); root.add(spoil);
    const R1 = mulberry32(11);
    const pileG = [], chunkG = [], basketG = [];
    [[-24, -12, 3.2], [-22, 11, 2.6], [14, -12, 2.8], [-12, -14, 2.2], [4, 13, 2.4], [-2, -13, 2.0]].forEach(function (p) {
      const r = p[2];
      pileG.push(place(new THREE.ConeGeometry(r, r * 0.55, 12), p[0], r * 0.275, p[1]));
      pileG.push(place(new THREE.IcosahedronGeometry(r * 0.45, 0), p[0] + r * 0.9, r * 0.2, p[1] + r * 0.4, 0, R1() * 3, 0, 1, 0.6, 1));
    });
    for (let i = 0; i < 46; i++) {
      const x = -28 + R1() * 46, z = -16 + R1() * 32;
      if (Math.abs(x) < 6 && Math.abs(z) < 4.5) continue;          // deja libre la cámara
      if (x < -4 && Math.abs(z) < 2.6) continue;                    // y la escalera
      const r = 0.15 + R1() * 0.35;
      chunkG.push(place(new THREE.DodecahedronGeometry(r, 0), x, r * 0.5, z, R1() * 3, R1() * 3, R1() * 3, 1, 0.7, 1));
    }
    [[-22, -5], [-17, -13], [-6, 13], [12, 7], [-27, 6]].forEach(function (p) {
      basketG.push(place(new THREE.CylinderGeometry(0.38, 0.3, 0.55, 14, 1, true), p[0], 0.275, p[1]));
      basketG.push(place(new THREE.TorusGeometry(0.38, 0.03, 6, 16), p[0], 0.55, p[1], Math.PI / 2, 0, 0));
    });
    const spoilEarth = new THREE.Mesh(mergeGeos(pileG, false), M.earth); spoilEarth.receiveShadow = true;
    const spoilRock = new THREE.Mesh(mergeGeos(chunkG, false), M.rock); spoilRock.receiveShadow = true;
    const baskets = new THREE.Mesh(mergeGeos(basketG, false), M.wicker);
    spoil.add(spoilEarth, spoilRock, baskets);

    // ---------- 3) cámara funeraria, escalera y bloque de sellado ----------
    const cg = new THREE.Group(); root.add(cg);
    const W = CH.halfX, D = CH.halfZ, TH = 0.9, BT = 1.2;
    const K = 5, Hc = CH.y1 - CH.y0, hK = Hc / K;
    const courses = [];
    for (let k = 0; k < K; k++) {
      const bk = CH.y0 + k * hK, s = new Soup();
      const b = function (x0, x1, ya, yb, z0, z1) { s.box(x0, x1, ya - bk, yb - bk, z0, z1, BT); };
      if (k === 0) b(-W, W, CH.y0, CH.y0 + 0.6, -D, D);                 // solera
      b(-W, W, bk, bk + hK, -D, -D + TH);                                // muro norte
      b(-W, W, bk, bk + hK, D - TH, D);                                  // muro sur
      b(W - TH, W, bk, bk + hK, -D + TH, D - TH);                        // muro este
      if (bk >= -3.8) b(-W, -W + TH, bk, bk + hK, -D + TH, D - TH);      // muro oeste (dintel encima)
      else {                                                              // muro oeste con la entrada
        b(-W, -W + TH, bk, bk + hK, -D + TH, -1.5);
        b(-W, -W + TH, bk, bk + hK, 1.5, D - TH);
      }
      const mesh = new THREE.Mesh(s.geo(), M.block);
      mesh.position.set(0, bk, 0); mesh.receiveShadow = true;
      cg.add(mesh); courses.push(mesh);
    }
    // techo de losas (cuatro, de 2 m) que se cierran al final de la obra
    const roofS = new Soup();
    for (let i = 0; i < 4; i++) {
      const x0 = -W + i * 2 + 0.04;
      roofS.box(x0, x0 + 1.92, 0, 0.6, -D, D, BT);
    }
    const roof = new THREE.Mesh(roofS.geo(), M.block);
    roof.position.set(0, CH.y1, 0); roof.receiveShadow = true;
    cg.add(roof);
    // escalera que baja desde el oeste (un escalón por metro, 3 m de ancho)
    const X0 = CH.stairFromX, X1 = -W, RUN = X1 - X0, RISE = -CH.y0 / RUN;
    const topY = function (k) { return -(k + 1) * RISE; };
    const stairS = new Soup();
    for (let k = 0; k < RUN; k++) stairS.box(X0 + k, X0 + k + 1, PIT_Y, topY(k), -1.5, 1.5, BT);
    const stairGeo = stairS.geo();
    const stair = new THREE.Mesh(stairGeo, M.block); stair.receiveShadow = true;
    // bloque de sellado (3 x 3 x 3) apoyado en los escalones
    const SEAL_BOTTOM = -6.4, SEAL_Y = SEAL_BOTTOM + CH.sealSize[1] / 2;
    const sealS = new Soup().box(CH.sealX - 1.5, CH.sealX + 1.5, SEAL_BOTTOM, SEAL_BOTTOM + 3, -1.5, 1.5, BT);
    const seal = new THREE.Mesh(sealS.geo(), M.block); seal.receiveShadow = true;
    cg.add(stair, seal);
    const stairTopAt = function (x) { return topY(Math.max(0, Math.min(RUN - 1, Math.floor(x - X0)))); };

    // contorno cian de rayos X: cámara, escalera y bloque
    const edgeList = [
      place(new THREE.EdgesGeometry(new THREE.BoxGeometry(2 * W, Hc, 2 * D)), 0, (CH.y0 + CH.y1) / 2, 0),
      place(new THREE.EdgesGeometry(new THREE.BoxGeometry(3, 3, 3)), CH.sealX, SEAL_Y, 0),
      new THREE.EdgesGeometry(stairGeo, 25)
    ];
    const edges = new THREE.LineSegments(mergePos(edgeList), M.line);
    edges.frustumCulled = false; edges.renderOrder = 8;
    root.add(edges);

    // ---------- 4) ofrendas en la escalera ----------
    const sacG = new THREE.Group(); root.add(sacG);
    const R2 = mulberry32(19);
    const boneL = [], vesselL = [], eggL = [];
    for (let i = 0; i < 9; i++) {                                       // huesos de bueyes y corderos
      const k = 2 + Math.floor(R2() * 19), x = X0 + k + 0.5, y = topY(k) + 0.045;
      const z = (R2() - 0.5) * 1.9, ry = R2() * Math.PI;
      boneL.push(place(new THREE.CylinderGeometry(0.045, 0.045, 0.7, 6), x, y, z, 0, ry, Math.PI / 2));
      const dx = Math.cos(ry) * 0.35, dz = -Math.sin(ry) * 0.35;
      boneL.push(place(new THREE.SphereGeometry(0.065, 8, 6), x + dx, y, z + dz));
      boneL.push(place(new THREE.SphereGeometry(0.065, 8, 6), x - dx, y, z - dz));
    }
    [5, 10, 14, 18].forEach(function (k) {                              // cráneos de buey con cuernos
      const x = X0 + k + 0.5, y = topY(k) + 0.26, z = (R2() - 0.5) * 0.8;
      boneL.push(place(new THREE.SphereGeometry(0.32, 12, 9), x, y, z, 0, 0, 0, 1.15, 0.85, 0.95));
      boneL.push(place(new THREE.TorusGeometry(0.2, 0.04, 6, 14, Math.PI * 0.9), x - 0.05, y + 0.2, z + 0.3));
      boneL.push(place(new THREE.TorusGeometry(0.2, 0.04, 6, 14, Math.PI * 0.9), x - 0.05, y + 0.2, z - 0.3));
    });
    [3, 8, 12, 16].forEach(function (k) {                               // cráneos de cordero
      const x = X0 + k + 0.5 + R2() * 0.4, z = (R2() - 0.5) * 1.2, y = topY(k) + 0.1;
      boneL.push(place(new THREE.SphereGeometry(0.13, 10, 8), x, y, z, 0, 0, 0, 1.25, 0.85, 1));
    });
    const amph = [[3, 0.6], [9, -0.6], [15, 0.5], [20, -0.5]];           // ánforas de pie
    amph.forEach(function (p) {
      const x = X0 + p[0] + 0.5, y = topY(p[0]), z = p[1];
      const prof = [[0.02, 0], [0.2, 0.05], [0.3, 0.25], [0.36, 0.55], [0.28, 0.85], [0.16, 1.02], [0.13, 1.15], [0.18, 1.2]]
        .map(function (q) { return new THREE.Vector2(q[0], q[1]); });
      vesselL.push(place(new THREE.LatheGeometry(prof, 14), x, y, z));
      vesselL.push(place(new THREE.TorusGeometry(0.24, 0.04, 6, 12, Math.PI), x, y + 0.65, z));
    });
    {                                                                   // ánfora rota tumbada
      const x = X0 + 12.5, z = -0.3, y = topY(12) + 0.34;
      const prof = [[0.02, 0], [0.2, 0.05], [0.3, 0.25], [0.36, 0.55], [0.28, 0.85], [0.16, 1.02]]
        .map(function (q) { return new THREE.Vector2(q[0], q[1]); });
      vesselL.push(place(new THREE.LatheGeometry(prof, 14), x, y, z, 0, 0.4, Math.PI / 2));
    }
    const bowlProf = [[0, 0], [0.3, 0.02], [0.36, 0.12], [0.33, 0.17], [0.28, 0.13], [0, 0.1]].map(function (q) { return new THREE.Vector2(q[0], q[1]); });
    [[6, 0.9], [11, -0.9], [17, 0.8], [21, -0.2]].forEach(function (p) {  // cuencos con pan de ofrenda
      const x = X0 + p[0] + 0.5, y = topY(p[0]), z = p[1];
      vesselL.push(place(new THREE.LatheGeometry(bowlProf, 12), x, y, z));
      vesselL.push(place(new THREE.CylinderGeometry(0.2, 0.2, 0.07, 12), x, y + 0.12, z));
    });
    for (let i = 0; i < 14; i++) {                                       // huevos
      const k = Math.floor(R2() * RUN), x = X0 + k + R2(), z = (R2() - 0.5) * 2.6;
      eggL.push(place(new THREE.SphereGeometry(0.085, 8, 6), x, topY(k) + 0.11, z, 0, 0, 0, 1, 1.3, 1));
    }
    const sacBone = new THREE.Mesh(mergeGeos(boneL, false), M.bone);
    const sacVessel = new THREE.Mesh(mergeGeos(vesselL, false), M.vessel);
    const sacEgg = new THREE.Mesh(mergeGeos(eggL, false), M.egg);
    sacG.add(sacBone, sacVessel, sacEgg);

    // ---------- 5) tesoro: sarcófago dorado, joyas, coronas, armas ----------
    const tg = new THREE.Group(); root.add(tg);
    const FL = -6.4;                                                     // suelo de la cámara
    const goldL = [];
    goldL.push(place(new THREE.BoxGeometry(2.4, 0.9, 1.2), 0.6, FL + 0.45, 0));           // caja
    const lidShape = new THREE.Shape();
    lidShape.moveTo(-0.6, 0); lidShape.lineTo(0.6, 0); lidShape.lineTo(0.6, 0.12);
    lidShape.lineTo(0, 0.42); lidShape.lineTo(-0.6, 0.12); lidShape.closePath();
    const lidG = new THREE.ExtrudeGeometry(lidShape, { depth: 2.4, bevelEnabled: false, steps: 1 });
    lidG.translate(0, 0, -1.2);
    goldL.push(place(lidG, 0.6, FL + 0.9, 0, 0, Math.PI / 2, 0));                          // tapa a dos aguas
    [[-0.55, -0.55], [1.75, -0.55], [-0.55, 0.55], [1.75, 0.55]].forEach(function (p) {
      goldL.push(place(new THREE.BoxGeometry(0.12, 0.92, 0.12), p[0], FL + 0.46, p[1]));
    });
    [[-1.4, 0.9], [-1.1, -1.0]].forEach(function (p) {                  // coronas de oro
      goldL.push(place(new THREE.TorusGeometry(0.2, 0.025, 6, 24), p[0], FL + 0.03, p[1], Math.PI / 2, 0, 0));
      for (let j = 0; j < 6; j++) {
        const a = j / 6 * Math.PI * 2;
        goldL.push(place(new THREE.ConeGeometry(0.04, 0.14, 6), p[0] + Math.cos(a) * 0.2, FL + 0.07, p[1] + Math.sin(a) * 0.2));
      }
    });
    [[-2.2, -0.3, 0.9], [-1.9, 0.7, -0.4], [-2.6, 1.0, 0.2]].forEach(function (p) {  // espadas
      goldL.push(place(new THREE.BoxGeometry(0.9, 0.012, 0.06), p[0], FL + 0.008, p[1], 0, p[2], 0));
      const hx = p[0] + Math.cos(p[2]) * 0.5, hz = p[1] - Math.sin(p[2]) * 0.5;
      goldL.push(place(new THREE.BoxGeometry(0.2, 0.03, 0.1), hx, FL + 0.015, hz, 0, p[2], 0));
    });
    goldL.push(place(new THREE.CylinderGeometry(0.02, 0.02, 1.6, 6), 2.3, FL + 0.02, 0, Math.PI / 2, 0, 0));  // lanzas
    goldL.push(place(new THREE.CylinderGeometry(0.02, 0.02, 1.6, 6), 2.6, FL + 0.02, 0.3, Math.PI / 2, 0, 0));
    const goldMesh = new THREE.Mesh(mergeGeos(goldL, false), M.gold);
    tg.add(goldMesh);

    const R3 = mulberry32(53), palette = ['#a8322a', '#2a4d8f', '#3a9a5a', '#e0b257', '#7fe3f0'];
    const jewelL = [];
    for (let i = 0; i < 40; i++) {
      const r = 0.05 + R3() * 0.06, x = -2.7 + R3() * 5.4, z = -1.8 + R3() * 3.6;
      const onLid = Math.abs(x - 0.6) < 1.2 && Math.abs(z) < 0.5;
      const y = onLid ? -5.5 + r * 0.6 : FL + r * 0.6;
      jewelL.push(tint(place(new THREE.OctahedronGeometry(r, 0), x, y, z, R3() * 3, R3() * 3, 0, 1, 0.6, 1), palette[i % palette.length]));
    }
    const jewelMesh = new THREE.Mesh(mergeGeos(jewelL, true), M.jewel);
    tg.add(jewelMesh);

    // polvo dorado que se desprende cuando el tesoro se desvanece
    const NP = 420, R4 = mulberry32(77);
    const dustBase = new Float32Array(NP * 3), dustSpd = new Float32Array(NP), dustPh = new Float32Array(NP);
    for (let i = 0; i < NP; i++) {
      dustBase[i * 3] = -3 + R4() * 6; dustBase[i * 3 + 1] = -6.3 + R4() * 4.6; dustBase[i * 3 + 2] = -2 + R4() * 4;
      dustSpd[i] = 0.4 + R4() * 1.2; dustPh[i] = R4() * 6.283;
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(dustBase), 3));
    const dust = new THREE.Points(dustGeo, M.dust);
    dust.frustumCulled = false; dust.visible = false;
    root.add(dust);

    const glow = new THREE.Sprite(M.glow);
    glow.position.set(0, -4.6, 0); glow.scale.set(7, 7, 1); glow.renderOrder = 9; glow.visible = false;
    root.add(glow);

    // ---------- etiquetas 3D (fuera de las zonas del HUD) ----------
    function label(text, pos, w) {
      const mat = new THREE.SpriteMaterial({ map: labelTex(text), transparent: true, opacity: 0, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending });
      const sp = new THREE.Sprite(mat);
      sp.position.set(pos[0], pos[1], pos[2]);
      sp.scale.set(w, w / 6.4, 1); sp.renderOrder = 10; sp.visible = false;
      root.add(sp);
      return sp;
    }
    const lblCam = label('CÁMARA FUNERARIA', [-2, -7.5, 0], 6.5);
    const lblSeal = label('BLOQUE DE SELLADO', [-9, -8, 1], 5.5);
    const lblOff = label('OFRENDAS', [-15, -1.2, 9], 5);

    // luz cálida tenue dentro de la cámara (siempre en escena: evita recompilar shaders)
    const light = new THREE.PointLight(0xffd7a0, 0, 30, 2);
    light.position.set(0, -4, 0);
    root.add(light);

    // ---------- update ----------
    const dustColor = M.dust;
    return {
      update: function (s) {
        s = s || {};
        const T = Number(s.t) || 0, wall = Number(s.wall) || 0;
        const ex = clamp01(s.excavation), ch = clamp01(s.chamber), sa = clamp01(s.sacrifice);
        const xr = clamp01(s.xray), tr = clamp01(s.treasure), pod = Number(s.podium) || 0;
        const pitOpen = ex > 0.001 || xr > 0.001;

        // tapa del hueco: entera sin fosa y sin podio; solo el borde exterior cuando el podio existe
        pit.visible = pitOpen;
        lidFull.visible = !pitOpen && pod < 0.999;
        lidRing.visible = !pitOpen && pod >= 0.999;

        // escombro y cestas: crecen con la excavación y se quedan mientras hay rayos X
        spoil.visible = pitOpen;
        spoil.scale.y = Math.max(0.001, xr > 0.001 ? 1 : ex);

        // cámara: hilada a hilada, luego techo de losas
        cg.visible = ch > 0.001;
        for (let k = 0; k < K; k++) {
          const p = clamp01(ch * K - k);
          courses[k].visible = p > 0.001;
          courses[k].scale.y = Math.max(0.001, p);
        }
        const pr = clamp01((ch - 0.8) / 0.2);
        roof.visible = pr > 0.001;
        roof.scale.y = Math.max(0.001, pr);
        M.block.opacity = 1 - 0.7 * xr;

        edges.visible = xr > 0.001;
        M.line.opacity = 0.95 * xr;

        // ofrendas
        sacG.visible = sa > 0.001;
        M.bone.opacity = sa; M.vessel.opacity = sa; M.egg.opacity = sa;

        // tesoro: brilla al subir; al bajar se desvanece con partículas (desaparece en 3 s)
        tg.visible = tr > 0.001;
        M.gold.opacity = tr; M.jewel.opacity = tr;
        M.gold.emissiveIntensity = tr * (0.25 + 0.1 * Math.sin(wall * 2.1));
        glow.visible = tr > 0.001;
        M.glow.opacity = tr * 0.75 * (0.85 + 0.15 * Math.sin(wall * 1.7));
        const dis = smooth(clamp01((T - 201) / 3));
        dust.visible = dis > 0.001 && dis < 0.999;
        if (dust.visible) {
          const arr = dustGeo.attributes.position.array;
          for (let i = 0; i < NP; i++) {
            const ph = dustPh[i];
            arr[i * 3] = dustBase[i * 3] + Math.sin(wall * 0.6 + ph) * 0.25 * dis;
            arr[i * 3 + 1] = dustBase[i * 3 + 1] + dis * (1.5 + dustSpd[i] * 3.5);
            arr[i * 3 + 2] = dustBase[i * 3 + 2] + Math.cos(wall * 0.5 + ph) * 0.25 * dis;
          }
          dustGeo.attributes.position.needsUpdate = true;
          dustColor.opacity = Math.sin(Math.PI * dis) * 0.9;
        }

        // rayos X: etiquetas de la cámara, del bloque y de las ofrendas
        lblCam.visible = xr > 0.01; lblCam.material.opacity = xr;
        lblSeal.visible = xr > 0.01; lblSeal.material.opacity = xr;
        lblOff.visible = xr * sa > 0.01; lblOff.material.opacity = xr * sa;

        light.intensity = 30 * Math.max(xr * 0.6, tr * 0.9);
      }
    };
  };
})();
