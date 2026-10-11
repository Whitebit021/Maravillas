// Datos compartidos por todos los módulos. NO depende de nada salvo window.GIZA.
(function () {
  'use strict';
  const G = window.GIZA;

  G.DURATION = 240; // segundos totales del "video"

  G.CHAPTERS = [
    { id: 'intro',      start: 0,   end: 18,  num: 'PRÓLOGO', title: 'Lo que no te contaron' },
    { id: 'marisma',    start: 18,  end: 38,  num: 'I',    title: 'Un templo sobre un pantano' },
    { id: 'cimientos',  start: 38,  end: 60,  num: 'II',   title: 'Carbón y lana' },
    { id: 'marmol',     start: 60,  end: 82,  num: 'III',  title: 'Las ruedas de Quersifrón' },
    { id: 'columnas',   start: 82,  end: 106, num: 'IV',   title: 'Ciento veintisiete columnas' },
    { id: 'arquitrabe', start: 106, end: 128, num: 'V',    title: 'La rampa de arena' },
    { id: 'templo',     start: 128, end: 148, num: 'VI',   title: 'Cuatro veces el Partenón' },
    { id: 'esplendor',  start: 148, end: 166, num: 'VII',  title: 'La casa de Artemisa' },
    { id: 'erostrato',  start: 166, end: 190, num: 'VIII', title: 'El hombre que quería ser famoso' },
    { id: 'numeros',    start: 190, end: 210, num: 'IX',   title: 'La noche de Alejandro' },
    { id: 'final',      start: 210, end: 240, num: 'EPÍLOGO', title: 'Una columna en el pantano' }
  ];

  // Templo de Artemisa en Éfeso (versión helenística). 1 unidad = 1 metro.
  // Norte = -Z, Sur = +Z, Este = +X. El templo mira al OESTE (-X): la entrada está en x negativa.
  // Centro de la planta en el origen; el suelo de la marisma está en y=0, el estilóbato arriba de las gradas.
  G.SITE = {
    name: 'Éfeso',
    lat: 37.9497, lon: 27.3639,
    waterLevel: -0.3,                          // charcas de la marisma (agua somera entre juncos)
    marsh: { radius: 450 },                    // llanura pantanosa alrededor del templo
    river: { z: 520, width: 60 },              // río Caístro al sur, corre en X
    city: { x: 1300, z: -200, radius: 600 },   // Éfeso, al este, en las colinas
    hills: [[1500, -600], [900, 700], [-1600, -900], [-1200, 800]], // colinas (centros)
    quarry: { x: -700, z: -500 },              // cantera de mármol (al NO, a pie de colina)
    route: [[-700, -500], [-300, -200], [-80, -40]], // ruta de los tambores rodados por bueyes
    pella: { dirX: -0.6, dirZ: -0.8 },         // dirección hacia Pella (Macedonia), al NO
    altar: { x: -95, z: 0 },                   // gran altar delante de la fachada oeste
    parthenonGhost: { x: 60, z: -110 },        // silueta de comparación (Partenón 69 x 31 m)
    todayColumn: { x: -20, z: -20 }            // hoy: una sola columna reconstruida con nido de cigüeña
  };

  // Dimensiones (aprox. 115 x 55 m; 127 columnas de ~18 m)
  G.TEMPLE = {
    halfX: 57.5, halfZ: 27.5,
    steps: 10, stepH: 0.3,          // gradas: el estilóbato queda en y = 3
    stylobateY: 3,
    columnH: 18, columnR: 0.9,      // fuste + basa + capitel jónico
    entabY0: 21, entabY1: 24.5,     // arquitrabe, friso, cornisa
    ridgeY: 31,                     // cumbrera del tejado a dos aguas (frontones en los extremos X)
    cella: { halfX: 40, halfZ: 12, wallH: 16, open: true }, // cella hipetra (sin techo) con el naiskos dentro
    naiskos: { x: 25, z: 0, half: 4, h: 8 },                // capillita con la estatua de culto
    cultStatue: { x: 25, z: 0, h: 6 },                      // Artemisa efesia (con su característico torso)
    caelataeCount: 36,              // columnas con el tambor inferior esculpido
    // capas del cimiento bajo la plataforma (de abajo arriba), en y negativo
    layers: [
      { name: 'Arcilla de la marisma', y0: -6.0, y1: -4.5, color: '#4a3b2a' },
      { name: 'Carbón vegetal apisonado', y0: -4.5, y1: -3.2, color: '#1a1a1a' },
      { name: 'Vellones de lana', y0: -3.2, y1: -2.2, color: '#d9d0bd' },
      { name: 'Carbón vegetal', y0: -2.2, y1: -1.2, color: '#222222' },
      { name: 'Losas de piedra', y0: -1.2, y1: 0.0, color: '#9c968a' }
    ],
    fireYear: -356, rebuildYear: -323, gothsYear: 262,
    architects: 'Quersifrón y Metágenes'
  };

  // Posiciones de las 127 columnas: { x, z, ring: 'outer'|'inner'|'pronaos'|'opisto'|'naiskos', caelata }
  G.TEMPLE.columns = (function () {
    const out = [];
    function ring(nx, nz, hx, hz, name) {
      for (let i = 0; i < nx; i++) {
        const x = -hx + 2 * hx * i / (nx - 1);
        out.push({ x: x, z: -hz, ring: name }); out.push({ x: x, z: hz, ring: name });
      }
      for (let j = 1; j < nz - 1; j++) {
        const z = -hz + 2 * hz * j / (nz - 1);
        out.push({ x: -hx, z: z, ring: name }); out.push({ x: hx, z: z, ring: name });
      }
    }
    ring(21, 8, 55, 25, 'outer');   // 54
    ring(19, 6, 49.5, 19, 'inner'); // 46
    [-47, -44.5, -42].forEach(function (x) { [-9, -3, 3, 9].forEach(function (z) { out.push({ x: x, z: z, ring: 'pronaos' }); }); }); // 12
    [47, 44.5, 42].forEach(function (x) { [-9, -3, 3, 9].forEach(function (z) { out.push({ x: x, z: z, ring: 'opisto' }); }); });   // 12
    [[31, -5], [31, 5], [33, 0]].forEach(function (p) { out.push({ x: p[0], z: p[1], ring: 'naiskos' }); }); // 3 → 127
    // las 36 caelatae: las de la fachada oeste (x más negativa) de los anillos exterior e interior y del pronaos
    const order = out.map(function (c, i) { return i; }).sort(function (a, b) { return out[a].x - out[b].x; });
    for (let k = 0; k < 36; k++) out[order[k]].caelata = true;
    return out;
  })();
})();
