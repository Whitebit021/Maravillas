// Datos compartidos por todos los módulos. NO depende de nada salvo window.GIZA.
(function () {
  'use strict';
  const G = window.GIZA;

  G.DURATION = 245; // segundos totales del "video"

  G.CHAPTERS = [
    { id: 'intro',         start: 0,   end: 20,  num: 'PRÓLOGO', title: 'Lo que no te contaron' },
    { id: 'sitio',         start: 20,  end: 40,  num: 'I',    title: 'El punto exacto' },
    { id: 'cantera',       start: 40,  end: 62,  num: 'II',   title: 'La cantera imposible' },
    { id: 'cimientos',     start: 62,  end: 84,  num: 'III',  title: 'Los primeros bloques' },
    { id: 'camaras',       start: 84,  end: 110, num: 'IV',   title: 'Las cámaras secretas' },
    { id: 'ascenso',       start: 110, end: 134, num: 'V',    title: 'Subir 146 metros' },
    { id: 'estrellas',     start: 134, end: 156, num: 'VI',   title: 'El mapa de Orión' },
    { id: 'cumbre',        start: 156, end: 176, num: 'VII',  title: 'La piedra dorada' },
    { id: 'revestimiento', start: 176, end: 196, num: 'VIII', title: 'El espejo del desierto' },
    { id: 'numeros',       start: 196, end: 220, num: 'IX',   title: 'El código oculto' },
    { id: 'final',         start: 220, end: 245, num: 'EPÍLOGO', title: '¿Quién la construyó realmente?' }
  ];

  // Gran Pirámide (Keops). 1 unidad = 1 metro. Centro de la base en el origen, base en y=0.
  // Norte = -Z, Sur = +Z, Este = +X, Oeste = -X.
  const half = 115.15, height = 146.6;
  G.PYR = {
    half: half,
    base: half * 2,
    height: height,
    slopeDeg: 51.84,
    courses: 105,          // hiladas visuales (las reales son ~210)
    blocksTotal: 2300000,
    // semiancho de la pirámide a la altura y
    halfAt: function (y) { return half * (1 - y / height); }
  };

  G.SITE = {
    khafre:   { x: -330, z: 350, half: 107.5, height: 136.4 },
    menkaure: { x: -560, z: 920, half: 51.7,  height: 65.5 },
    quarry:   { x: 0, z: 400, w: 160, d: 90, depth: 12 }, // cantera al sur
    nileX: 950,       // eje del Nilo (corre a lo largo de Z) al este
    nileWidth: 260,
    harborX: 600      // canal / puerto que conecta con el Nilo, z ~ 150
  };

  // Interior (coordenadas aproximadas, centro de cada volumen)
  G.INTERIOR = {
    entrance:     { x: 7, y: 17, z: -101.6 },
    subterranean: { x: 7, y: -30, z: 0, w: 8.3, h: 4, d: 14 },
    queens:       { x: 0, y: 24, z: 0, w: 5.75, h: 6.2, d: 5.23 },
    gallery:      { x: 0, yStart: 21.5, zStart: -38, yEnd: 43, zEnd: 4, width: 2.1, height: 8.6 },
    kings:        { x: 0, y: 45.9, z: 11, w: 10.47, h: 5.8, d: 5.23 },
    relieving:    { yFrom: 52, yTo: 66 },
    shaftsKings:  { northDeg: 32.5, southDeg: 45 },
    shaftsQueens: { northDeg: 39.5, southDeg: 38.5 }
  };
})();
