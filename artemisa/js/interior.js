// Interior del cimiento del Templo de Artemisa: tapa de marisma, fosa excavada con paredes de barro,
// agua y obreros con cubos, capas del relleno (de abajo arriba) con corte en sección en rayos X,
// etiquetas por capa y el naiskos con la estatua de culto dentro de la cella.
(function () {
  'use strict';
  const G = window.GIZA;

  G.createInterior = function (ctx) {
    const THREE = ctx.THREE, scene = ctx.scene, camera = ctx.camera, renderer = ctx.renderer;
    const DEG = Math.PI / 180;
    const TM = G.TEMPLE || {};
    const DEF_LAYERS = [
      { name: 'Arcilla de la marisma', y0: -6.0, y1: -4.5 },
      { name: 'Carbón vegetal apisonado', y0: -4.5, y1: -3.2 },
      { name: 'Vellones de lana', y0: -3.2, y1: -2.2 },
      { name: 'Carbón vegetal', y0: -2.2, y1: -1.2 },
      { name: 'Losas de piedra', y0: -1.2, y1: 0.0 }
    ];
    const LAYERS = (TM.layers && TM.layers.length === 5) ? TM.layers : DEF_LAYERS;
    const NL = LAYERS.length;
    const KINDS = ['clay', 'chunks', 'wool', 'charcoal', 'stone'];
    const WOOL = 2;
    const NS = TM.naiskos || { x: 25, z: 0 };
    const CS = TM.cultStatue || { x: 25, z: 0 };

    const HX = 62, HZ = 32;               // hueco del cimiento: x en [-62, 62], z en [-32, 32]
    const FLOOR = LAYERS[0].y0;           // fondo de la fosa (-6)
    const DEPTH = -FLOOR;
    const UP = new THREE.Vector3(0, 1, 0);
    const ZAX = new THREE.Vector3(0, 0, 1);
    const V = function (x, y, z) { return new THREE.Vector3(x, y, z); };

    const clamp = function (x, a, b) { return Math.max(a, Math.min(b, x)); };
    const clamp01 = function (x) { x = Number(x); if (!(x > 0)) return 0; return x > 1 ? 1 : x; };
    const smooth = function (x) { return x * x * (3 - 2 * x); };
    function mulberry32(a) {
      return function () {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), a | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }

    const root = new THREE.Group(); scene.add(root);

    // ---------- utilidades de geometría (todo horneado en coordenadas de módulo) ----------
    // Triangle soup con normales y UV propios
    function Soup() { this.p = []; this.n = []; this.uv = []; }
    Soup.prototype.tri = function (a, b, c, ua, ub, uc, nrm, ref) {
      let nx, ny, nz;
      if (nrm) {
        nx = nrm[0]; ny = nrm[1]; nz = nrm[2];
        // el bobinado debe coincidir con la normal dada (si no, el sombreado DoubleSide la invierte)
        const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
        const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
        if ((uy * vz - uz * vy) * nx + (uz * vx - ux * vz) * ny + (ux * vy - uy * vx) * nz < 0) {
          const tb = b, tub = ub; b = c; c = tb; ub = uc; uc = tub;
        }
      } else {
        const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
        const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
        nx = uy * vz - uz * vy; ny = uz * vx - ux * vz; nz = ux * vy - uy * vx;
        const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
        if (ref) {   // la normal apunta lejos de ref
          const cx = (a[0] + b[0] + c[0]) / 3, cy = (a[1] + b[1] + c[1]) / 3, cz = (a[2] + b[2] + c[2]) / 3;
          if ((cx - ref[0]) * nx + (cy - ref[1]) * ny + (cz - ref[2]) * nz < 0) { nx = -nx; ny = -ny; nz = -nz; }
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
    // caja alineada, UV en metros (tile = metros por repetición)
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

    const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
    const _ndc = new THREE.Vector3(), _dir = new THREE.Vector3();
    // Horneado a no indexado con UV garantizada
    function bake(geo, m) {
      const g = geo.index ? geo.toNonIndexed() : geo;
      if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      g.applyMatrix4(m);
      return g;
    }
    // Primitiva colocada: posición, rotación euler, escala
    function at(geo, x, y, z, rx, ry, rz, sx, sy, sz) {
      _q.setFromEuler(new THREE.Euler(rx || 0, ry || 0, rz || 0));
      _m.compose(_p.set(x || 0, y || 0, z || 0), _q, _s.set(sx == null ? 1 : sx, sy == null ? 1 : sy, sz == null ? 1 : sz));
      return bake(geo, _m);
    }
    // Miembro cilíndrico entre dos puntos
    function limb(A, B, r) {
      const d = B.clone().sub(A), len = d.length();
      _q.setFromUnitVectors(UP, d.normalize());
      _m.compose(A.clone().add(B).multiplyScalar(0.5), _q, _s.set(r, len, r));
      return bake(new THREE.CylinderGeometry(1, 1, 1, 10), _m);
    }
    // Anillo (pulsera) perpendicular a una dirección
    function ring(c, dir, r) {
      _q.setFromUnitVectors(ZAX, dir.clone().normalize());
      _m.compose(c, _q, _s.set(1, 1, 1));
      return bake(new THREE.TorusGeometry(r, 0.03, 8, 20), _m);
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

    // ---------- entorno: mapa de cielo para metales y mármol (PMREM) ----------
    const envScene = new THREE.Scene();
    const skyGeo = new THREE.SphereGeometry(100, 32, 16);
    (function () {
      const pos = skyGeo.attributes.position, cols = new Float32Array(pos.count * 3);
      const bottom = new THREE.Color(0x2b2a26), horizon = new THREE.Color(0xc2ad84), top = new THREE.Color(0xfff1d6), c = new THREE.Color();
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
    function tex(w, h, draw) {
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      draw(c.getContext('2d'), w, h, mulberry32(w * 31 + h * 7));
      const t = new THREE.CanvasTexture(c);
      t.encoding = THREE.sRGBEncoding;
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = 4;
      t.needsUpdate = true;
      return t;
    }
    const texMud = tex(256, 256, function (g, w, h, R) {      // marisma: barro verdoso con charcos
      g.fillStyle = '#4e4a2c'; g.fillRect(0, 0, w, h);
      const cols = ['#3a3820', '#5f5a36', '#6b6a3f', '#433c22'];
      for (let i = 0; i < 2600; i++) {
        g.fillStyle = cols[Math.floor(R() * cols.length)];
        g.globalAlpha = 0.3 + R() * 0.4;
        const s = 1 + R() * 3; g.fillRect(R() * w, R() * h, s, s * 0.7);
      }
      g.globalAlpha = 1;
      for (let i = 0; i < 70; i++) {
        g.fillStyle = 'rgba(120,150,130,0.22)';
        g.beginPath(); g.ellipse(R() * w, R() * h, 3 + R() * 6, 1.5 + R() * 2.5, 0, 0, Math.PI * 2); g.fill();
      }
    });
    const texEarthWall = tex(256, 256, function (g, w, h, R) {  // paredes de barro: estratos horizontales
      g.fillStyle = '#6b5234'; g.fillRect(0, 0, w, h);
      const cols = ['#5e4329', '#7b5b3b', '#8f6d48', '#4f3a24'];
      let y = 0;
      while (y < h) {
        const hh = 14 + R() * 22;
        g.fillStyle = cols[Math.floor(R() * cols.length)];
        g.globalAlpha = 0.5; g.fillRect(0, y, w, hh); g.globalAlpha = 1;
        g.strokeStyle = 'rgba(40,28,16,0.5)'; g.lineWidth = 1.5;
        g.beginPath(); g.moveTo(0, y); g.lineTo(w, y + R() * 4); g.stroke();
        y += hh;
      }
      for (let i = 0; i < 1600; i++) { g.fillStyle = 'rgba(30,20,10,' + (0.1 + R() * 0.2).toFixed(3) + ')'; g.fillRect(R() * w, R() * h, 1 + R() * 2, 1 + R() * 2); }
    });
    const texClay = tex(256, 256, function (g, w, h, R) {       // arcilla húmeda con vetas
      g.fillStyle = '#4a3b2a'; g.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 6 + R() * 8) {
        g.strokeStyle = R() < 0.5 ? 'rgba(90,70,48,0.5)' : 'rgba(30,22,14,0.5)'; g.lineWidth = 2 + R() * 2;
        g.beginPath(); g.moveTo(0, y); g.quadraticCurveTo(w * 0.5, y + R() * 8 - 4, w, y + R() * 6); g.stroke();
      }
      for (let i = 0; i < 90; i++) { g.fillStyle = 'rgba(160,140,110,0.35)'; g.beginPath(); g.arc(R() * w, R() * h, 1 + R() * 2.2, 0, 6.283); g.fill(); }
    });
    const texChunks = tex(256, 256, function (g, w, h, R) {     // carbón apisonado con trozos
      g.fillStyle = '#1c1a18'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 260; i++) {
        const x = R() * w, y = R() * h, r = 2 + R() * 6;
        g.fillStyle = R() < 0.6 ? 'rgba(58,56,52,0.9)' : 'rgba(96,88,78,0.8)';
        g.beginPath();
        for (let k = 0; k < 5; k++) { const a = k / 5 * 6.283 + R() * 0.8; const rr = r * (0.5 + R() * 0.7); g[k ? 'lineTo' : 'moveTo'](x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
        g.closePath(); g.fill();
      }
      for (let y = 0; y < h; y += 40) { g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, y + R() * 6); g.lineTo(w, y + R() * 6); g.stroke(); }
    });
    const texWool = tex(256, 256, function (g, w, h, R) {       // lana sucia y apelmazada
      g.fillStyle = '#d6cdb4'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 2200; i++) { g.fillStyle = R() < 0.5 ? 'rgba(255,252,240,0.5)' : 'rgba(150,132,100,0.35)'; g.fillRect(R() * w, R() * h, 1 + R() * 2, 1 + R() * 2); }
    });
    const texCharcoal = tex(256, 256, function (g, w, h, R) {   // carbón vegetal, brillo en vetas
      g.fillStyle = '#211f1d'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 120; i++) {
        g.strokeStyle = 'rgba(78,74,70,' + (0.2 + R() * 0.3).toFixed(3) + ')'; g.lineWidth = 1 + R() * 2;
        const x = R() * w, y = R() * h;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + 30 + R() * 50, y + R() * 10 - 5); g.stroke();
      }
    });
    const texStone = tex(256, 256, function (g, w, h, R) {      // losas de piedra en sillería
      g.fillStyle = '#8f897c'; g.fillRect(0, 0, w, h);
      const rows = 2, rh = h / rows;
      for (let r = 0; r < rows; r++) {
        let x = -R() * 120;
        while (x < w) {
          const bw = 100 + R() * 60;
          g.fillStyle = R() < 0.5 ? 'rgba(255,255,250,0.09)' : 'rgba(60,54,44,0.08)';
          g.fillRect(x, r * rh, bw, rh);
          g.strokeStyle = '#3d3830'; g.lineWidth = 3; g.strokeRect(x, r * rh, bw, rh);
          x += bw;
        }
      }
      for (let i = 0; i < 1200; i++) { g.fillStyle = 'rgba(70,64,54,' + (0.05 + R() * 0.1).toFixed(3) + ')'; g.fillRect(R() * w, R() * h, 2, 2); }
    });
    const texWood = tex(256, 256, function (g, w, h, R) {       // tablones de madera
      g.fillStyle = '#8a6238'; g.fillRect(0, 0, w, h);
      const ph = 64;
      for (let y = 0; y < h; y += ph) {
        g.fillStyle = 'rgba(' + (120 + Math.floor(R() * 30)) + ',' + (80 + Math.floor(R() * 20)) + ',40,0.35)';
        g.fillRect(0, y, w, ph - 2);
        g.strokeStyle = 'rgba(40,24,10,0.8)'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke();
      }
      for (let i = 0; i < 180; i++) {
        g.strokeStyle = 'rgba(60,36,14,' + (0.15 + R() * 0.2).toFixed(3) + ')'; g.lineWidth = 1;
        const y = R() * h; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(w * 0.3, y + R() * 6 - 3, w * 0.6, y + R() * 6 - 3, w, y); g.stroke();
      }
    });
    const texMarble = tex(256, 256, function (g, w, h, R) {     // mármol cálido en sillares
      g.fillStyle = '#efe6d6'; g.fillRect(0, 0, w, h);
      const rows = 4, rh = h / rows;
      for (let r = 0; r < rows; r++) {
        let x = -R() * 120;
        while (x < w) {
          const bw = 90 + R() * 80;
          g.fillStyle = R() < 0.5 ? 'rgba(255,255,250,0.10)' : 'rgba(120,100,70,0.06)';
          g.fillRect(x, r * rh, bw, rh);
          g.strokeStyle = 'rgba(120,104,80,0.75)'; g.lineWidth = 2.5; g.strokeRect(x, r * rh, bw, rh);
          x += bw;
        }
      }
      for (let i = 0; i < 900; i++) { g.fillStyle = 'rgba(140,120,90,' + (0.03 + R() * 0.06).toFixed(3) + ')'; g.fillRect(R() * w, R() * h, 2, 2); }
    });
    const texGrain = tex(512, 512, function (g, w, h, R) {      // madera oscura de la estatua
      g.fillStyle = '#4a2c18'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 300; i++) {
        g.strokeStyle = R() < 0.5 ? 'rgba(30,17,8,0.5)' : 'rgba(106,66,38,0.4)'; g.lineWidth = 1 + R() * 2.5;
        const y = R() * h; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(w * 0.3, y + R() * 14 - 7, w * 0.6, y + R() * 14 - 7, w, y + R() * 8 - 4); g.stroke();
      }
    });
    // panel de la falda: 8 paneles con animales (león, abeja, ciervo) alrededor del cuerpo
    const texPanels = tex(1024, 512, function (g, w, h, R) {
      g.fillStyle = '#3b2415'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 260; i++) {
        g.strokeStyle = 'rgba(20,10,4,' + (0.15 + R() * 0.2).toFixed(3) + ')'; g.lineWidth = 1 + R() * 2;
        const y = R() * h; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(w * 0.3, y + R() * 8 - 4, w * 0.6, y + R() * 8 - 4, w, y); g.stroke();
      }
      const bandT = h * 0.56, bandB = h * 0.96, midY = (bandT + bandB) / 2;
      g.fillStyle = '#d9a84a'; g.fillRect(0, bandT - 8, w, 8); g.fillRect(0, bandB, w, 8);
      function glyph(kind, cx, cy) {
        g.fillStyle = '#e0b257'; g.strokeStyle = '#2a1408'; g.lineWidth = 2;
        if (kind === 0) {                                       // león
          g.beginPath(); g.ellipse(cx, cy + 6, 30, 13, 0, 0, 6.283); g.fill(); g.stroke();
          g.beginPath(); g.arc(cx - 30, cy - 4, 13, 0, 6.283); g.fill(); g.stroke();
          g.lineWidth = 5; g.beginPath();
          [-18, -6, 14, 24].forEach(function (dx) { g.moveTo(cx + dx, cy + 14); g.lineTo(cx + dx, cy + 30); });
          g.stroke();
          g.lineWidth = 3; g.beginPath(); g.moveTo(cx + 30, cy + 4); g.quadraticCurveTo(cx + 48, cy - 8, cx + 44, cy - 20); g.stroke();
        } else if (kind === 1) {                                // abeja
          g.beginPath(); g.ellipse(cx, cy + 4, 20, 13, 0, 0, 6.283); g.fill(); g.stroke();
          g.fillStyle = '#2a1408';
          [-8, 4, 14].forEach(function (dx) { g.fillRect(cx + dx - 3, cy - 10, 5, 28); });
          g.fillStyle = 'rgba(230,240,245,0.7)'; g.beginPath(); g.ellipse(cx - 4, cy - 14, 9, 5, -0.4, 0, 6.283); g.fill();
        } else {                                                // ciervo
          g.beginPath(); g.ellipse(cx, cy + 6, 28, 11, 0, 0, 6.283); g.fill(); g.stroke();
          g.beginPath(); g.moveTo(cx + 24, cy); g.lineTo(cx + 40, cy - 16); g.lineTo(cx + 46, cy - 14); g.lineTo(cx + 30, cy + 4); g.closePath(); g.fill(); g.stroke();
          g.beginPath(); g.arc(cx + 44, cy - 18, 6, 0, 6.283); g.fill();
          g.lineWidth = 3; g.beginPath();
          g.moveTo(cx + 42, cy - 24); g.lineTo(cx + 36, cy - 42); g.moveTo(cx + 46, cy - 24); g.lineTo(cx + 54, cy - 40); g.stroke();
        }
      }
      for (let k = 0; k < 8; k++) {
        const cx = (768 + k * 128) % 1024;
        [-w, 0, w].forEach(function (dx) {
          const x = cx + dx;
          g.fillStyle = '#5a3520'; g.fillRect(x - 54, bandT + 12, 108, bandB - bandT - 24);
          g.strokeStyle = '#d9a84a'; g.lineWidth = 3; g.strokeRect(x - 54, bandT + 12, 108, bandB - bandT - 24);
          glyph(k % 3, x, midY);
        });
      }
    });

    // ---------- materiales (opacidad se fija en update) ----------
    const ADD = THREE.AdditiveBlending;
    const M = {
      lidMud: new THREE.MeshStandardMaterial({ map: texMud, roughness: 1, side: THREE.DoubleSide }),
      puddle: new THREE.MeshStandardMaterial({ color: 0x2b4a48, roughness: 0.12, envMap: envTex, envMapIntensity: 0.9 }),
      reed: new THREE.MeshStandardMaterial({ color: 0x6e7a3a, roughness: 0.9 }),
      earth: new THREE.MeshStandardMaterial({ map: texEarthWall, roughness: 1, side: THREE.DoubleSide }),
      water: new THREE.MeshStandardMaterial({ color: 0x23494a, roughness: 0.08, envMap: envTex, envMapIntensity: 1, transparent: true, opacity: 0.85 }),
      wood: new THREE.MeshStandardMaterial({ map: texWood, roughness: 0.85, side: THREE.DoubleSide }),
      wool: new THREE.MeshStandardMaterial({ color: 0xefe8d6, roughness: 1 }),
      worker: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }),
      marble: new THREE.MeshStandardMaterial({ map: texMarble, roughness: 0.55, envMap: envTex, envMapIntensity: 0.35, side: THREE.DoubleSide }),
      grain: new THREE.MeshStandardMaterial({ map: texGrain, roughness: 0.65, envMap: envTex, envMapIntensity: 0.25 }),
      skirt: new THREE.MeshStandardMaterial({ map: texPanels, roughness: 0.6, envMap: envTex, envMapIntensity: 0.25 }),
      gold: new THREE.MeshStandardMaterial({ color: 0xe0b257, metalness: 1, roughness: 0.28, envMap: envTex, envMapIntensity: 1.3 }),
      cyan: new THREE.LineBasicMaterial({ color: 0x7ff7ff, transparent: true, opacity: 0, blending: ADD, depthWrite: false }),
      cyanTenue: new THREE.LineBasicMaterial({ color: 0x2fb8d6, transparent: true, opacity: 0, blending: ADD, depthWrite: false }),
      lead: new THREE.LineBasicMaterial({ color: 0x7ff7ff, transparent: true, opacity: 0, blending: ADD, depthWrite: false, depthTest: false })
    };
    const layerTex = { clay: texClay, chunks: texChunks, wool: texWool, charcoal: texCharcoal, stone: texStone };
    const layerMat = KINDS.map(function (k) {
      return new THREE.MeshStandardMaterial({ map: layerTex[k], roughness: 0.95, side: THREE.DoubleSide });
    });

    // ---------- 1) tapa de marisma (antes de la excavación) ----------
    const lidG = new THREE.Group(); root.add(lidG);
    const lidMesh = new THREE.Mesh(
      new Soup().quad([-HX - 0.05, 0.03, -HZ - 0.05], [HX + 0.05, 0.03, -HZ - 0.05], [HX + 0.05, 0.03, HZ + 0.05], [-HX - 0.05, 0.03, HZ + 0.05],
        function (p) { return [p[0] / 5, p[2] / 5]; }, [0, 1, 0]).geo(), M.lidMud);
    lidMesh.receiveShadow = true;
    lidG.add(lidMesh);
    {
      const R = mulberry32(5), pud = [];
      for (let i = 0; i < 16; i++) {
        const r = 1.2 + R() * 3.2;
        pud.push(at(new THREE.CircleGeometry(r, 14), (R() * 2 - 1) * (HX - 6), 0.045, (R() * 2 - 1) * (HZ - 4), -Math.PI / 2, 0, 0));
      }
      const puddles = new THREE.Mesh(mergeGeos(pud, false), M.puddle);
      lidG.add(puddles);
      const RN = 240, R2 = mulberry32(9);
      const reedGeo = new THREE.ConeGeometry(0.035, 1, 4).translate(0, 0.5, 0);
      const reeds = new THREE.InstancedMesh(reedGeo, M.reed, RN);
      for (let i = 0; i < RN; i++) {
        _p.set((R2() * 2 - 1) * (HX - 1), 0.03, (R2() * 2 - 1) * (HZ - 1));
        _q.setFromEuler(new THREE.Euler((R2() - 0.5) * 0.4, R2() * 6.283, (R2() - 0.5) * 0.4));
        _m.compose(_p, _q, _s.set(1, 0.25 + R2() * 0.4, 1));
        reeds.setMatrixAt(i, _m);
      }
      reeds.instanceMatrix.needsUpdate = true;
      lidG.add(reeds);
    }

    // ---------- 2) fosa: paredes de barro, escalera de madera, agua en el fondo ----------
    const pitG = new THREE.Group(); root.add(pitG);     // su escala Y crece desde el borde hacia abajo
    const shell = new Soup(), ET = 4;
    const wv = function (p) { return [p[2] / ET, p[1] / ET]; };
    const wu = function (p) { return [p[0] / ET, p[1] / ET]; };
    shell.quad([HX, FLOOR, -HZ], [HX, 0, -HZ], [HX, 0, HZ], [HX, FLOOR, HZ], wv, [-1, 0, 0]);       // este
    shell.quad([-HX, FLOOR, HZ], [-HX, 0, HZ], [-HX, 0, -HZ], [-HX, FLOOR, -HZ], wv, [1, 0, 0]);    // oeste
    shell.quad([HX, FLOOR, HZ], [HX, 0, HZ], [-HX, 0, HZ], [-HX, FLOOR, HZ], wu, [0, 0, -1]);       // sur
    shell.quad([-HX, FLOOR, -HZ], [HX, FLOOR, -HZ], [HX, FLOOR, HZ], [-HX, FLOOR, HZ],
      function (p) { return [p[0] / ET, p[2] / ET]; }, [0, 1, 0]);                                  // fondo
    const pitShell = new THREE.Mesh(shell.geo(), M.earth); pitShell.receiveShadow = true;
    pitG.add(pitShell);
    const northS = new Soup().quad([-HX, FLOOR, -HZ], [-HX, 0, -HZ], [HX, 0, -HZ], [HX, FLOOR, -HZ], wu, [0, 0, 1]);
    const northMesh = new THREE.Mesh(northS.geo(), M.earth);   // se retira en el corte (rayos X)
    pitG.add(northMesh);
    // escalera de madera: 18 peldaños desde el borde este hasta el fondo
    const stairS = new Soup();
    const NSTEP = 18, RUN = 1.22, RISE = DEPTH / NSTEP;
    for (let k = 0; k < NSTEP; k++) {
      const xa = HX - (k + 1) * RUN, xb = HX - k * RUN, top = -(k + 1) * RISE;
      stairS.box(xa, xb, FLOOR, top, -2, 2, 1.5);
    }
    const stairsMesh = new THREE.Mesh(stairS.geo(), M.wood); stairsMesh.receiveShadow = true;
    pitG.add(stairsMesh);
    // agua filtrándose en el fondo
    const waterGeo = new THREE.PlaneGeometry(2 * HX - 0.4, 2 * HZ - 0.4).rotateX(-Math.PI / 2).translate(0, FLOOR + 0.08, 0);
    const water = new THREE.Mesh(waterGeo, M.water);
    pitG.add(water);
    // contorno cian de la fosa (solo en el corte)
    const pitEdges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(2 * HX, DEPTH, 2 * HZ).translate(0, FLOOR / 2, 0)), M.cyan);
    pitG.add(pitEdges);

    // ---------- 3) capas del relleno, de abajo arriba ----------
    const layerMeshes = [], layerH = [], lpArr = [];
    for (let i = 0; i < NL; i++) {
      const L = LAYERS[i], h = L.y1 - L.y0;
      layerH.push(h); lpArr.push(0);
      const geo = new Soup().box(-HX + 0.1, HX - 0.1, 0, h, -HZ + 0.1, HZ - 0.1, 2).geo();
      const mesh = new THREE.Mesh(geo, layerMat[i]);
      mesh.position.set(0, L.y0, 0);
      mesh.receiveShadow = true;
      const eg = new THREE.EdgesGeometry(new THREE.BoxGeometry(2 * HX - 0.2, h, 2 * HZ - 0.2).translate(0, h / 2, 0));
      mesh.add(new THREE.LineSegments(eg, M.cyan));
      root.add(mesh);
      layerMeshes.push(mesh);
    }

    // vellones de lana: bultos esponjosos en la cara de corte (solo en rayos X)
    const WN = 92, woolGeo = new THREE.IcosahedronGeometry(0.42, 1);
    const woolMesh = new THREE.InstancedMesh(woolGeo, M.wool, WN);
    woolMesh.frustumCulled = false;
    const woolInst = [], R6 = mulberry32(21);
    for (let r = 0; r < 2; r++) {
      for (let k = 0; k < WN / 2; k++) {
        const x = -HX + 3 + k * (2 * HX - 6) / (WN / 2 - 1) + (R6() - 0.5) * 1.2;
        const y = LAYERS[WOOL].y0 + (r === 0 ? 0.28 : 0.7) + (R6() - 0.5) * 0.12;
        woolInst.push({ x: x, y: y, z: -HZ + 0.08 + (R6() - 0.5) * 0.1, s: 0.8 + R6() * 0.35 });
      }
    }
    root.add(woolMesh);

    // ---------- 4) obreros con cubos (InstancedMesh, sobre el relleno) ----------
    const wParts = [];
    const workerParts = [
      [new THREE.CylinderGeometry(0.085, 0.075, 0.85, 8), 0, 0.42, -0.1, '#4e3b2a'],
      [new THREE.CylinderGeometry(0.085, 0.075, 0.85, 8), 0, 0.42, 0.1, '#4e3b2a'],
      [new THREE.CylinderGeometry(0.2, 0.24, 0.78, 10), 0, 1.2, 0, '#b5884e'],
      [new THREE.SphereGeometry(0.12, 10, 8), 0, 1.66, 0, '#7d5034'],
      [new THREE.CylinderGeometry(0.058, 0.05, 0.62, 6), 0.3, 1.36, 0.22, '#b5884e', 0, 0, -Math.PI / 2],
      [new THREE.CylinderGeometry(0.058, 0.05, 0.62, 6), 0.3, 1.36, -0.22, '#b5884e', 0, 0, -Math.PI / 2],
      [new THREE.CylinderGeometry(0.13, 0.1, 0.22, 10, 1, true), 0.62, 1.08, 0.22, '#8c7a5a']
    ];
    workerParts.forEach(function (p) {
      wParts.push(tint(at(p[0], p[1], p[2], p[3], p[5] || 0, p[6] || 0, p[7] || 0), p[4]));
    });
    const workerGeo = mergeGeos(wParts, true);
    const NW = 8;
    const workerMesh = new THREE.InstancedMesh(workerGeo, M.worker, NW);
    workerMesh.frustumCulled = false;
    const workers = [];
    const R7 = mulberry32(44);
    for (let i = 0; i < NW; i++) {
      workers.push({ bx: -34 + i * 9.5 + (R7() - 0.5) * 4, bz: -20 + (i % 4) * 11 + (R7() - 0.5) * 3, ph: R7() * 6.283 });
    }
    root.add(workerMesh);

    // ---------- 5) naiskos y estatua de culto (dentro de la cella) ----------
    // colores base y de hollín (el daño se aplica tiñendo los materiales, sin geometría extra)
    const COL_W = new THREE.Color(1, 1, 1), COL_GOLD = new THREE.Color(0xe0b257);
    const SOOT_MARBLE = new THREE.Color(0x1c1a18), SOOT_WOOD = new THREE.Color(0x0e0c0a), SOOT_GOLD = new THREE.Color(0x2a2218);
    const shrine = new THREE.Group();
    shrine.position.set(NS.x, 3, NS.z);     // sobre el estilóbato (y = 3)
    root.add(shrine);
    {
      const sk = new Soup();
      sk.box(-4.6, 4.6, 0, 0.2, -4.6, 4.6, 1.5);            // peldaños
      sk.box(-4.2, 4.2, 0.2, 0.4, -4.2, 4.2, 1.5);
      sk.box(3.6, 4.0, 0.4, 7.0, -4.0, 4.0, 1.5);           // muro del fondo
      sk.box(-4.0, 4.0, 0.4, 7.0, 3.6, 4.0, 1.5);           // muros laterales
      sk.box(-4.0, 4.0, 0.4, 7.0, -4.0, -3.6, 1.5);
      sk.box(-4.3, 4.3, 7.0, 7.4, -4.3, 4.3, 1.5);          // arquitrabe (techo del naiskos)
      const uvr = function (p) { return [p[0] / 1.5, p[1] / 1.5 + p[2] / 1.5]; };
      const ref = [0, 7.5, 0];
      sk.quad([-4.3, 7.4, 4.3], [4.3, 7.4, 4.3], [4.3, 9.2, 0], [-4.3, 9.2, 0], uvr, null, ref);     // cubierta a dos aguas
      sk.quad([-4.3, 9.2, 0], [4.3, 9.2, 0], [4.3, 7.4, -4.3], [-4.3, 7.4, -4.3], uvr, null, ref);
      sk.tri([-4.3, 7.4, -4.3], [-4.3, 7.4, 4.3], [-4.3, 9.2, 0], [0, 0], [1, 0], [0.5, 1], null, ref);  // frontón
      sk.tri([4.3, 7.4, 4.3], [4.3, 7.4, -4.3], [4.3, 9.2, 0], [0, 0], [1, 0], [0.5, 1], null, ref);    // frontón trasero
      const list = [sk.geo()];
      [2.1, -2.1].forEach(function (z) {                     // dos columnas en antis, delante
        list.push(at(new THREE.CylinderGeometry(0.3, 0.33, 6.4, 16), -3.8, 3.6, z));
        list.push(at(new THREE.CylinderGeometry(0.42, 0.42, 0.14, 16), -3.8, 0.47, z));
        list.push(at(new THREE.BoxGeometry(0.9, 0.22, 0.9), -3.8, 6.9, z));
      });
      const marble = new THREE.Mesh(mergeGeos(list, false), M.marble);
      marble.receiveShadow = true; marble.castShadow = true;
      shrine.add(marble);
    }
    const statue = new THREE.Group();
    statue.position.set(CS.x - NS.x, 0.4, CS.z - NS.z);   // sobre el suelo del naiskos
    shrine.add(statue);
    {
      // cuerpo: falda ceñida con paneles pintados, cintura, pecho y cuello (un solo torneado)
      const prof = [[0.001, 0.25], [0.80, 0.25], [0.84, 0.45], [0.76, 0.9], [0.68, 1.8], [0.60, 2.8], [0.58, 3.5],
        [0.44, 4.0], [0.50, 4.45], [0.46, 4.9], [0.20, 5.12], [0.16, 5.3], [0.001, 5.3]].map(function (q) { return new THREE.Vector2(q[0], q[1]); });
      const body = new THREE.Mesh(new THREE.LatheGeometry(prof, 40), M.skirt);
      statue.add(body);

      const woodL = [];
      woodL.push(at(new THREE.BoxGeometry(1.1, 0.25, 1.1), 0, 0.125, 0));                                    // plinto
      woodL.push(at(new THREE.SphereGeometry(0.24, 16, 12), 0, 5.5, 0));                                     // cabeza
      const polosProf = [[0.2, 5.55], [0.32, 5.7], [0.36, 5.92], [0.3, 6.1], [0.001, 6.12]].map(function (q) { return new THREE.Vector2(q[0], q[1]); });
      woodL.push(at(new THREE.LatheGeometry(polosProf, 20), 0, 0, 0));                                       // polos
      // pecho: muchas formas ovaladas (torneadas, escala uniforme)
      const eggProf = [[0.001, -1.2], [0.55, -1.0], [0.92, -0.45], [1.0, 0.1], [0.8, 0.8], [0.45, 1.1], [0.001, 1.2]]
        .map(function (q) { return new THREE.Vector2(q[0], q[1]); });
      const eggGeo = new THREE.LatheGeometry(eggProf, 10);
      [[4.2, -0.46], [4.5, -0.52], [4.8, -0.49]].forEach(function (row) {
        [-0.36, -0.18, 0, 0.18, 0.36].forEach(function (z) {
          woodL.push(at(eggGeo, row[1], row[0], z, 0, 0, 0, 0.1, 0.1, 0.1));
        });
      });
      // brazos extendidos al frente (hacia el oeste, -x)
      [1, -1].forEach(function (sg) {
        const S = V(-0.02, 4.75, 0.42 * sg), H = V(-1.0, 4.4, 0.56 * sg);
        woodL.push(limb(S, H, 0.1));
        woodL.push(at(new THREE.SphereGeometry(0.12, 12, 9), H.x, H.y, H.z));
      });
      const woodMesh = new THREE.Mesh(mergeGeos(woodL, false), M.grain);
      statue.add(woodMesh);

      const goldL = [];
      goldL.push(at(new THREE.BoxGeometry(1.12, 0.03, 1.12), 0, 0.25, 0));                                  // filete del plinto
      goldL.push(at(new THREE.TorusGeometry(0.33, 0.03, 8, 28), 0, 5.7, 0, Math.PI / 2, 0, 0));           // banda del polos
      goldL.push(at(new THREE.TorusGeometry(0.47, 0.045, 8, 32), 0, 4.95, 0, Math.PI / 2, 0, 0));         // collar
      goldL.push(at(new THREE.TorusGeometry(0.53, 0.03, 8, 32), 0, 4.72, 0, Math.PI / 2, 0, 0));          // collar inferior
      [1, -1].forEach(function (sg) {                                                                        // pulseras
        const S = V(-0.02, 4.75, 0.42 * sg), H = V(-1.0, 4.4, 0.56 * sg);
        const d = H.clone().sub(S).normalize();
        goldL.push(ring(H.clone().addScaledVector(d, -0.12), d, 0.14));
      });
      const goldMesh = new THREE.Mesh(mergeGeos(goldL, false), M.gold);
      statue.add(goldMesh);
    }

    // ---------- bloque diagrama: corte elevado junto a la fosa (siempre legible, escala vertical x1.3) ----------
    const DS = 1.3, DX0 = -30, DX1 = 10, DZF = -39.5, DZB = -36.5, DY0 = 1;
    const dg = new THREE.Group(); root.add(dg);
    const diagMats = KINDS.map(function (k) {       // sin sombreado: el diagrama se lee a cualquier hora
      return new THREE.MeshBasicMaterial({ map: layerTex[k], color: 0xe4e4e4, side: THREE.DoubleSide });
    });
    const diagY = [];
    let cumD = 0;
    for (let i = 0; i < NL; i++) { diagY.push(DY0 + cumD); cumD += layerH[i] * DS; }
    const diagSlots = [];
    for (let i = 0; i < NL; i++) {
      const hd = layerH[i] * DS;
      const mesh = new THREE.Mesh(new Soup().box(DX0, DX1, 0, hd, DZF, DZB, 2).geo(), diagMats[i]);
      mesh.position.set(0, diagY[i], 0);
      const eg = new THREE.EdgesGeometry(new THREE.BoxGeometry(DX1 - DX0, hd, DZB - DZF).translate((DX0 + DX1) / 2, hd / 2, (DZF + DZB) / 2));
      mesh.add(new THREE.LineSegments(eg, M.cyan));
      dg.add(mesh);
      diagSlots.push(mesh);
      // hueco de la capa (contorno tenue) siempre visible: indica las 5 posiciones aunque aún no estén rellenas
      const slot = new THREE.LineSegments(eg.clone(), M.cyanTenue);
      slot.position.set(0, diagY[i], 0);
      dg.add(slot);
    }
    // vellones del bloque: bultos esponjosos en la banda de lana
    const DWN = 50;
    const dwMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.3, 1), M.wool, DWN);
    dwMesh.frustumCulled = false;
    const dwInst = [], R8 = mulberry32(31);
    for (let r = 0; r < 2; r++) {
      for (let k = 0; k < DWN / 2; k++) {
        const x = DX0 + 1 + k * (DX1 - DX0 - 2) / (DWN / 2 - 1) + (R8() - 0.5) * 0.8;
        const y = diagY[WOOL] + layerH[WOOL] * DS * (r === 0 ? 0.3 : 0.7) + (R8() - 0.5) * 0.15;
        dwInst.push({ x: x, y: y, z: DZF + 0.05, s: 0.8 + R8() * 0.35 });
      }
    }
    dg.add(dwMesh);

    // ---------- etiquetas de capa (sprites) y líneas de unión ----------
    const labelsG = new THREE.Group(); root.add(labelsG);
    const LAB_X = 0.70;                     // centro del tercio derecho de la pantalla
    const labels = [];
    function labelTex(name, sub) {
      const c = document.createElement('canvas'), g = c.getContext('2d');
      g.font = 'bold 38px Georgia, serif';
      const w1 = g.measureText(name).width;
      g.font = '22px "Courier New", monospace';
      const w2 = g.measureText(sub).width;
      c.width = Math.ceil(Math.max(w1, w2) + 60);
      c.height = 104;
      const q = c.getContext('2d');
      q.fillStyle = 'rgba(4,12,16,0.8)'; q.fillRect(0, 0, c.width, c.height);
      q.strokeStyle = '#7ff7ff'; q.lineWidth = 3; q.strokeRect(1.5, 1.5, c.width - 3, c.height - 3);
      q.textAlign = 'center'; q.textBaseline = 'middle';
      q.font = 'bold 38px Georgia, serif'; q.fillStyle = '#c4f7ff'; q.fillText(name, c.width / 2, 38);
      q.font = '22px "Courier New", monospace'; q.fillStyle = 'rgba(230,240,245,0.9)'; q.fillText(sub, c.width / 2, 76);
      const t = new THREE.CanvasTexture(c);
      t.encoding = THREE.sRGBEncoding; t.minFilter = THREE.LinearFilter; t.generateMipmaps = false;
      return { tex: t, aspect: c.width / c.height };
    }
    for (let i = 0; i < NL; i++) {
      const L = LAYERS[i], h = L.y1 - L.y0;
      const lt = labelTex(String(L.name).toUpperCase(), 'ESPESOR ' + h.toFixed(1) + ' m');
      const mat = new THREE.SpriteMaterial({ map: lt.tex, transparent: true, opacity: 0, depthTest: false, depthWrite: false });
      const sp = new THREE.Sprite(mat);
      sp.renderOrder = 10;
      labelsG.add(sp);
      labels.push({
        sprite: sp, mat: mat, aspect: lt.aspect, idx: i,
        yN: -0.32 + i * 0.16,                          // de abajo arriba, en el tercio derecho
        anchor: V(DX1, diagY[i] + layerH[i] * DS / 2, DZF)   // borde derecho de la capa del bloque
      });
    }
    const leadPos = new Float32Array(NL * 6);
    const leadGeo = new THREE.BufferGeometry();
    leadGeo.setAttribute('position', new THREE.BufferAttribute(leadPos, 3));
    const leadLines = new THREE.LineSegments(leadGeo, M.lead);
    leadLines.frustumCulled = false; leadLines.renderOrder = 9;
    labelsG.add(leadLines);

    // ---------- update ----------
    const camP = camera.position;
    return {
      update: function (s) {
        s = s || {};
        const t = Number(s.t) || 0, wall = Number(s.wall) || 0;
        const ex = clamp01(s.pit), lay = clamp01(s.layers), xr = clamp01(s.xray), st = clamp01(s.statue);
        const cutOn = xr > 0.5;
        const pitExc = Math.max(ex, lay > 0.001 ? 1 : 0);   // la fosa ya no se cierra una vez rellenada

        // tapa de marisma: antes de la excavación
        lidG.visible = ex <= 0.001 && lay <= 0.001;

        // fosa: crece hacia abajo desde el borde
        pitG.visible = pitExc > 0.001;
        pitG.scale.y = Math.max(0.001, pitExc);
        northMesh.visible = !cutOn;                 // corte en sección: se abre la cara norte
        water.visible = lay <= 0.001;
        stairsMesh.visible = lay < 0.9;             // el relleno sepulta la escalera
        pitEdges.visible = xr > 0.001;

        // capas: se rellenan de abajo arriba, cada una con su altura
        let fillRel = 0;
        for (let i = 0; i < NL; i++) {
          const lp = clamp01(lay * NL - i);
          lpArr[i] = lp;
          const mesh = layerMeshes[i];
          mesh.visible = lp > 0.0005;
          mesh.scale.y = Math.max(0.001, lp);
          fillRel += layerH[i] * lp;
        }
        M.cyan.opacity = xr;
        M.lead.opacity = 0.8 * xr;

        // vellones: solo en el corte, asentados en la capa de lana
        const wLp = lpArr[WOOL];
        const bandTop = LAYERS[WOOL].y0 + layerH[WOOL] * wLp;
        woolMesh.visible = cutOn && wLp > 0.001;
        if (woolMesh.visible) {
          for (let i = 0; i < woolInst.length; i++) {
            const w = woolInst[i];
            const f = smooth(clamp01((bandTop - w.y) / 0.25));
            const sc = Math.max(0.001, w.s * f);
            _p.set(w.x, w.y, w.z); _q.identity(); _m.compose(_p, _q, _s.set(sc, sc, sc));
            woolMesh.setMatrixAt(i, _m);
          }
          woolMesh.instanceMatrix.needsUpdate = true;
        }

        // bloque diagrama: contornos siempre (con xr), capas rellenándose de abajo arriba con s.layers
        dg.visible = xr > 0.001;
        M.cyanTenue.opacity = 0.6 * xr;
        if (dg.visible) {
          for (let i = 0; i < NL; i++) {
            const lp = lpArr[i];
            diagSlots[i].visible = lp > 0.0005;
            diagSlots[i].scale.y = Math.max(0.001, lp);
          }
          const dTop = diagY[WOOL] + layerH[WOOL] * DS * lpArr[WOOL];
          dwMesh.visible = lpArr[WOOL] > 0.001;
          if (dwMesh.visible) {
            for (let i = 0; i < dwInst.length; i++) {
              const w = dwInst[i];
              const sc = Math.max(0.001, w.s * smooth(clamp01((dTop - w.y) / 0.25)));
              _p.set(w.x, w.y, w.z); _q.identity(); _m.compose(_p, _q, _s.set(sc, sc, sc));
              dwMesh.setMatrixAt(i, _m);
            }
            dwMesh.instanceMatrix.needsUpdate = true;
          }
        }

        // obreros: de pie sobre el relleno (o sobre el fondo de la fosa)
        const wAct = ex > 0.2 && lay < 0.92;
        workerMesh.visible = wAct;
        if (wAct) {
          const baseY = lay > 0.001 ? (FLOOR + fillRel) : FLOOR * ex;
          for (let i = 0; i < NW; i++) {
            const w = workers[i], p = wall * 0.35 + w.ph;
            _p.set(w.bx + 5 * Math.sin(p), baseY + 0.04 * Math.abs(Math.sin(p * 2)), w.bz);
            _q.setFromAxisAngle(UP, Math.cos(p) >= 0 ? 0 : Math.PI);
            _m.compose(_p, _q, _s.set(1, 1, 1));
            workerMesh.setMatrixAt(i, _m);
          }
          workerMesh.instanceMatrix.needsUpdate = true;
        }

        // etiquetas: a la derecha del corte, a media altura; cada una aparece al pasar el corte
        labelsG.visible = xr > 0.001;
        if (labelsG.visible) {
          camera.updateMatrixWorld();
          const tanH = Math.tan(camera.fov * DEG / 2);
          const arr = leadGeo.attributes.position.array;
          for (let i = 0; i < labels.length; i++) {
            const L = labels[i];
            const reveal = smooth(clamp01((t - 42 - i * 0.3) / 0.8));
            const op = xr * reveal;
            L.mat.opacity = op;
            L.sprite.visible = op > 0.001;
            const d = camP.distanceTo(L.anchor);
            _ndc.set(LAB_X, L.yN, 0.5).unproject(camera);
            _dir.copy(_ndc).sub(camP).normalize();
            L.sprite.position.copy(camP).addScaledVector(_dir, d);
            const hgt = 0.12 * d * tanH;               // ~6 % de la altura de pantalla
            L.sprite.scale.set(hgt * L.aspect, hgt, 1);
            // la línea crece desde la cara de corte hasta la etiqueta al aparecer esta
            const k = smooth(clamp01((t - 42 - i * 0.3) / 0.8));
            arr[i * 6] = L.anchor.x + (L.sprite.position.x - L.anchor.x) * k;
            arr[i * 6 + 1] = L.anchor.y + (L.sprite.position.y - L.anchor.y) * k;
            arr[i * 6 + 2] = L.anchor.z + (L.sprite.position.z - L.anchor.z) * k;
            arr[i * 6 + 3] = L.anchor.x; arr[i * 6 + 4] = L.anchor.y; arr[i * 6 + 5] = L.anchor.z;
          }
          leadGeo.attributes.position.needsUpdate = true;
        }

        // naiskos y estatua: crecen desde el suelo de la cella
        // daño: ennegrecido por el incendio (burned); caído/oculto tras el saqueo godo (goths); nada con dismantle
        const bu = clamp01(s.burned), gh = clamp01(s.goths), dm = clamp01(s.dismantle);
        const soot = smooth(bu) * 0.9;
        M.marble.color.copy(COL_W).lerp(SOOT_MARBLE, soot);
        M.grain.color.copy(COL_W).lerp(SOOT_WOOD, soot);
        M.skirt.color.copy(COL_W).lerp(SOOT_WOOD, soot);
        M.gold.color.copy(COL_GOLD).lerp(SOOT_GOLD, soot);
        shrine.visible = st > 0.001 && gh <= 0.3 && dm <= 0.001;
        shrine.scale.setScalar(Math.max(0.02, st));
      }
    };
  };
})();
