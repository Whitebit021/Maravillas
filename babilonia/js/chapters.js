// Datos compartidos por todos los módulos. NO depende de nada salvo window.GIZA.
(function () {
  'use strict';
  const G = window.GIZA;

  G.DURATION = 240; // segundos totales del "video"

  G.CHAPTERS = [
    { id: 'intro',     start: 0,   end: 18,  num: 'PRÓLOGO', title: 'Lo que no te contaron' },
    { id: 'eufrates',  start: 18,  end: 38,  num: 'I',    title: 'Una ciudad junto al Éufrates' },
    { id: 'ladrillo',  start: 38,  end: 60,  num: 'II',   title: 'Ladrillo y betún' },
    { id: 'boveda',    start: 60,  end: 82,  num: 'III',  title: 'Bóvedas contra el agua' },
    { id: 'terrazas',  start: 82,  end: 104, num: 'IV',   title: 'Una montaña escalonada' },
    { id: 'agua',      start: 104, end: 128, num: 'V',    title: 'Agua cuesta arriba' },
    { id: 'jardin',    start: 128, end: 148, num: 'VI',   title: 'Un bosque en el aire' },
    { id: 'esplendor', start: 148, end: 166, num: 'VII',  title: 'La reina que añoraba sus montañas' },
    { id: 'ninive',    start: 166, end: 190, num: 'VIII', title: '¿Estaban en Nínive?' },
    { id: 'numeros',   start: 190, end: 210, num: 'IX',   title: 'Los números del agua' },
    { id: 'final',     start: 210, end: 240, num: 'EPÍLOGO', title: 'El jardín que nadie encuentra' }
  ];

  // Jardines Colgantes de Babilonia (reconstrucción según Diodoro, Estrabón y Beroso).
  // 1 unidad = 1 metro. Norte = -Z, Sur = +Z, Este = +X. Centro de la planta en el origen, suelo en y=0.
  G.SITE = {
    name: 'Babilonia',
    lat: 32.536, lon: 44.421,
    river: { x: -190, width: 150, waterY: -1.0 },   // Éufrates al oeste, corre en Z
    canal: { z: 0, x0: -115, x1: -62 },             // canal desde el río hasta el pozo de la noria
    palace: { x: 130, z: 20, halfX: 60, halfZ: 70, h: 18 },  // palacio sur de Nabucodonosor (al este)
    ishtar: { x: 200, z: -300 },                    // puerta de Ishtar (azul, toros y dragones)
    processional: { x: 200, zFrom: -700, zTo: -300 },
    ziggurat: { x: 320, z: 520, half: 45, h: 91 },  // Etemenanki (la "torre de Babel")
    walls: { radius: 900 },                          // murallas dobles de la ciudad
    brickyard: { x: 0, z: -140 },                    // hornos de ladrillo y moldeado
    bitumen: { x: -60, z: -130 },                    // calderos de betún
    // mapa holográfico del capítulo Nínive (en el suelo, al norte): escala 1 m = ~1 km
    map: { cx: 0, cz: -330, y: 1.5, babylon: [0, -100], nineveh: [-40, -560], scaleKmPerM: 1 },
    excavation: { x: 20, z: -60 },                   // donde excavó Koldewey (1899)
    herodotus: { x: 0, y: 40, z: -48 }               // holograma del pergamino de Heródoto
  };

  // Estructura: cinco terrazas escalonadas sobre bóvedas, ~120 m de lado, ~25 m de altura
  G.GARDENS = {
    tiers: [ // [yBase, yTop, semilado]
      [0, 5, 60],
      [5, 10, 50],
      [10, 15, 40],
      [15, 20, 30],
      [20, 25, 20]
    ],
    height: 25,
    vault: { span: 4, depth: 10 },          // bóvedas de cañón en la fachada de cada terraza (arcadas)
    // capas impermeables bajo la tierra de cada terraza (de abajo arriba), grosor en m
    waterproof: [
      { name: 'Cañas con betún', t: 0.25, color: '#7a6a3a' },
      { name: 'Doble hilada de ladrillo con yeso', t: 0.35, color: '#a4643c' },
      { name: 'Láminas de plomo', t: 0.08, color: '#8d939a' },
      { name: 'Tierra fértil', t: 1.2, color: '#4b3621' }
    ],
    // sistema de agua (cara oeste): pozo con noria de cangilones, cisterna en la cima, tornillos en la cara norte
    pumpShaft: { x: -56, z: 0, half: 3.5 },   // pozo vertical dentro de la estructura, de y=0 a 25
    cistern: { x: -12, z: 0, y: 25, half: 6 },
    screws: { z: -52, xFrom: -50, xTo: 40, count: 5 }, // tornillos inclinados escalón a escalón (teoría de Senaquerib)
    cascades: [[60, 20], [60, -20], [20, 60], [-20, 60]], // puntos de las cascadas en las caras E y S (x,z del borde)
    pavilion: { x: 0, z: 0, half: 7, h: 6 },  // pabellón en la terraza superior
    king: 'Nabucodonosor II', queen: 'Amitis', altKing: 'Senaquerib',
    year: -600
  };
  // semilado de la estructura a la altura y
  G.GARDENS.halfAt = function (y) {
    const T = G.GARDENS.tiers;
    for (let i = 0; i < T.length; i++) if (y < T[i][1]) return T[i][2];
    return 0;
  };
})();
