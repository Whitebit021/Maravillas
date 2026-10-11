// Datos compartidos por todos los módulos. NO depende de nada salvo window.GIZA.
(function () {
  'use strict';
  const G = window.GIZA;

  G.DURATION = 240; // segundos totales del "video"

  G.CHAPTERS = [
    { id: 'intro',      start: 0,   end: 18,  num: 'PRÓLOGO', title: 'Lo que no te contaron' },
    { id: 'isla',       start: 18,  end: 38,  num: 'I',    title: 'La isla de los naufragios' },
    { id: 'piedra',     start: 38,  end: 60,  num: 'II',   title: 'Piedra del Nilo' },
    { id: 'cimientos',  start: 60,  end: 80,  num: 'III',  title: 'Cimientos de plomo' },
    { id: 'torre',      start: 80,  end: 104, num: 'IV',   title: 'La torre cuadrada' },
    { id: 'rampa',      start: 104, end: 126, num: 'V',    title: 'La rampa secreta' },
    { id: 'octogono',   start: 126, end: 146, num: 'VI',   title: 'Ocho caras y un cilindro' },
    { id: 'fuego',      start: 146, end: 166, num: 'VII',  title: 'El fuego y el espejo' },
    { id: 'espejo',     start: 166, end: 188, num: 'VIII', title: 'El espejo que quemaba barcos' },
    { id: 'firma',      start: 188, end: 210, num: 'IX',   title: 'El nombre bajo el yeso' },
    { id: 'final',      start: 210, end: 240, num: 'EPÍLOGO', title: 'Dos terremotos y una fortaleza' }
  ];

  // Faro de Alejandría. 1 unidad = 1 metro. Norte = -Z (mar abierto), Sur = +Z (Alejandría), Este = +X.
  // El faro está centrado en el origen, sobre el extremo este de la isla de Faros, base del podio en y=0.
  G.SITE = {
    name: 'Alejandría',
    lat: 31.214, lon: 29.885,
    seaLevel: -1.5,
    // isla de Faros: franja alargada de este a oeste (el faro en su punta este, sobre un islote rocoso)
    island: { xMin: -1500, xMax: 70, zMin: -70, zMax: 130 },
    // Heptastadion: calzada de 7 estadios (~1.250 m) que une la isla con la ciudad
    heptastadion: { x: -700, zFrom: 120, zTo: 1260, width: 22 },
    cityCoastZ: 1260,                                  // costa de la ciudad (la ciudad ocupa z > 1260)
    city: { xMin: -2600, xMax: 1600, zMin: 1260, zMax: 2600 },
    greatHarbor: { x: 200, z: 700 },                   // Puerto Grande (al este de la calzada)
    lochias: { x: 900, z: 1100 },                       // cabo Loquias con el palacio real
    reefs: [[90, -120], [140, -40], [-60, -180], [220, -160], [30, -260]], // escollos peligrosos
    wreck: { x: 150, z: -90 },                          // pecio en los escollos
    stoneYard: { x: 30, z: 60 },                        // patio de labra de bloques en la isla
    quay: { x: 70, z: 140 },                            // muelle de descarga al sur del faro
    bargeRoute: [[1600, 1500], [800, 900], [250, 400], [90, 170]], // barcazas desde el Nilo (canal de Canopo)
    burnTarget: { x: 0, z: -700 },                      // barco romano del mito del espejo
    fallDir: { x: 0.35, z: -1 }                         // los cuerpos superiores caen al mar hacia el norte
  };

  // La torre (dimensiones reconstruidas; altura total ~124 m con la estatua)
  G.TOWER = {
    H: 111,                                  // referencia de "build": cima del cuerpo cilíndrico
    height: 124,                             // con linterna y estatua
    podium:  { y0: 0,   y1: 6,   half: 25 },                           // basamento escalonado
    tier1:   { y0: 6,   y1: 66,  halfBottom: 15, halfTop: 13.5 },     // cuerpo cuadrado, ventanas en 8 pisos
    balcony1:{ y: 66, half: 15.5 },                                    // terraza con 4 tritones en las esquinas
    tier2:   { y0: 66,  y1: 96,  radius: 9 },                         // cuerpo octogonal (radio al vértice)
    balcony2:{ y: 96, radius: 9.6 },
    tier3:   { y0: 96,  y1: 111, radius: 4.6 },                       // cuerpo cilíndrico
    lantern: { y0: 111, y1: 117, radius: 4.2, columns: 8 },           // linterna: columnas, fuego y espejo
    statue:  { y0: 117, y1: 124 },                                     // estatua (Zeus Sóter o Poseidón)
    // interior del cuerpo cuadrado: núcleo central hueco con montacargas, rampa en espiral cuadrada alrededor
    shaft:   { half: 3.2 },                                            // pozo central (montacargas de combustible)
    ramp:    { innerHalf: 4.2, outerHalf: 11.8, width: 2.6, rise: 6.0 }, // sube 6 m por vuelta... ~10 vueltas
    stairs:  { radius: 6.0 },                                          // escalera de caracol en el octógono
    mirror:  { radius: 2.6, y: 114 },                                  // espejo de bronce pulido en la linterna
    inscription: { face: 'N', y: 12, w: 14, h: 3.2 },                  // dedicatoria en la cara norte del cuerpo 1
    builder: 'Sóstrato de Cnido',
    king: 'Ptolomeo II',
    startYear: -297, endYear: -280,
    visibleKm: 50,
    quakes: [1303, 1323],
    citadelYear: 1477
  };
  // semiancho del cuerpo cuadrado a la altura y (0 si fuera de rango)
  G.TOWER.tier1HalfAt = function (y) {
    const t = G.TOWER.tier1;
    if (y < t.y0 || y > t.y1) return 0;
    return t.halfBottom + (t.halfTop - t.halfBottom) * (y - t.y0) / (t.y1 - t.y0);
  };
  // Fortaleza de Qaitbey (1477) en el mismo lugar, hecha con piedras del faro
  G.CITADEL = { keepHalf: 15, keepH: 22, wallHalf: 60, wallH: 10, towers: 8 };
})();
