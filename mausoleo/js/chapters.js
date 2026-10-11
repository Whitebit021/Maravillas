// Datos compartidos por todos los módulos. NO depende de nada salvo window.GIZA.
(function () {
  'use strict';
  const G = window.GIZA;

  G.DURATION = 240; // segundos totales del "video"

  G.CHAPTERS = [
    { id: 'intro',       start: 0,   end: 18,  num: 'PRÓLOGO', title: 'Lo que no te contaron' },
    { id: 'halicarnaso', start: 18,  end: 38,  num: 'I',    title: 'Una ciudad para un rey' },
    { id: 'cenizas',     start: 38,  end: 58,  num: 'II',   title: 'La reina que bebía cenizas' },
    { id: 'camara',      start: 58,  end: 80,  num: 'III',  title: 'La cámara bajo la roca' },
    { id: 'podio',       start: 80,  end: 102, num: 'IV',   title: 'El podio de mármol' },
    { id: 'columnas',    start: 102, end: 124, num: 'V',    title: 'Treinta y seis columnas' },
    { id: 'escultores',  start: 124, end: 144, num: 'VI',   title: 'Cuatro escultores, cuatro lados' },
    { id: 'piramide',    start: 144, end: 162, num: 'VII',  title: 'Veinticuatro escalones al cielo' },
    { id: 'cuadriga',    start: 162, end: 180, num: 'VIII', title: 'La cuadriga de la cima' },
    { id: 'numeros',     start: 180, end: 206, num: 'IX',   title: 'El tesoro que desapareció' },
    { id: 'final',       start: 206, end: 240, num: 'EPÍLOGO', title: 'Piedras para un castillo' }
  ];

  // Mausoleo de Halicarnaso (hoy Bodrum, Turquía). 1 unidad = 1 metro.
  // Norte = -Z (colinas y teatro), Sur = +Z (puerto y mar), Este = +X.
  // Centro de la planta en el origen, base del podio en y=0 (terraza nivelada).
  G.SITE = {
    name: 'Halicarnaso',
    lat: 37.038, lon: 27.424,
    seaLevel: -1.5,
    coastZ: 230,                              // el mar ocupa z > 230 (bahía en arco)
    harbor: { x: 0, z: 420, radius: 380 },    // bahía del puerto, abierta al sur
    peribolos: { halfX: 52, halfZ: 121 },     // muro del recinto sagrado (105 x 242 m)
    theatre: { x: -60, z: -330, radius: 70 }, // teatro excavado en la ladera norte
    city: { xMin: -900, xMax: 900, zMin: -700, zMax: 230 }, // ciudad en anfiteatro alrededor de la bahía
    palace: { x: -520, z: 260 },              // palacio de Mausolo (península de Salmakis, al oeste)
    castle: { x: 420, z: 380, half: 70 },     // península/islote donde se alzará el castillo de San Pedro
    quay: { x: 60, z: 240 },                  // muelle de descarga del mármol
    marbleRoute: [[1600, 1400], [700, 800], [200, 420], [60, 260]], // barcos con mármol de Mármara
    ashes: { x: 0, z: 0 }                     // escena de Artemisia (sobre la terraza aún vacía)
  };

  // Dimensiones reconstruidas (~45 m de altura total)
  G.MAUS = {
    height: 46,
    podium:     { y0: 0,  y1: 19, halfX: 19, halfZ: 16, steps: 3 },      // 38 x 32 m, 3 escalones en la base
    colonnade:  { y0: 19, y1: 31, cols: 36, perLong: 11, perShort: 9, radius: 0.6, halfX: 17.5, halfZ: 14.5 },
    cella:      { halfX: 13.5, halfZ: 10.5 },                            // muro interior (cámara de culto)
    entablature:{ y0: 31, y1: 34 },                                       // arquitrabe, friso, cornisa
    pyramid:    { y0: 34, y1: 41, steps: 24, halfX: 17, halfZ: 14, topHalfX: 5, topHalfZ: 4 },
    quadriga:   { y0: 41, y1: 46, horses: 4 },                            // pedestal + cuatro caballos + carro
    // frisos: amazonomaquia en el podio, centauromaquia y carreras en el entablamento
    friezes: { podiumY: 17.6, entabY: 32.4, height: 1.0 },
    // escultores por lado (Plinio): N, S, E, O
    sides: { E: 'Escopas', N: 'Briaxis', S: 'Timoteo', O: 'Leócares' },
    architects: 'Sátiro y Piteo',
    // cámara funeraria excavada en la roca bajo el podio, escalera desde el oeste sellada con un gran bloque
    chamber: { y0: -7, y1: -1.5, halfX: 4, halfZ: 3, stairFromX: -26, sealX: -8, sealSize: [3, 3, 3] },
    deathYear: -353, endYear: -350,
    knightsYear: 1494, newtonYear: 1857
  };
  // altura del escalón k (0..23) de la pirámide y su semiancho
  G.MAUS.stepAt = function (k) {
    const P = G.MAUS.pyramid, u = k / P.steps, h = (P.y1 - P.y0) / P.steps;
    return { y: P.y0 + k * h, h: h, halfX: P.halfX + (P.topHalfX - P.halfX) * u, halfZ: P.halfZ + (P.topHalfZ - P.halfZ) * u };
  };
  // Castillo de San Pedro de los Caballeros de San Juan (1494-1522), en SITE.castle
  G.CASTLE = { towers: 5, wallH: 14, towerH: 26 };
})();
