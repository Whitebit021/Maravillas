// Datos compartidos por todos los módulos. NO depende de nada salvo window.GIZA.
(function () {
  'use strict';
  const G = window.GIZA;

  G.DURATION = 240; // segundos totales del "video"

  G.CHAPTERS = [
    { id: 'intro',      start: 0,   end: 18,  num: 'PRÓLOGO', title: 'Lo que no te contaron' },
    { id: 'olimpia',    start: 18,  end: 38,  num: 'I',    title: 'El santuario de los Juegos' },
    { id: 'templo',     start: 38,  end: 60,  num: 'II',   title: 'Un templo demasiado pequeño' },
    { id: 'taller',     start: 60,  end: 82,  num: 'III',  title: 'El taller secreto de Fidias' },
    { id: 'nucleo',     start: 82,  end: 104, num: 'IV',   title: 'El esqueleto de madera' },
    { id: 'marfil',     start: 104, end: 126, num: 'V',    title: 'Marfil y oro' },
    { id: 'trono',      start: 126, end: 146, num: 'VI',   title: 'El trono de los dioses' },
    { id: 'esplendor',  start: 146, end: 166, num: 'VII',  title: 'Si se levantara, rompería el techo' },
    { id: 'aceite',     start: 166, end: 188, num: 'VIII', title: 'El estanque de aceite' },
    { id: 'numeros',    start: 188, end: 210, num: 'IX',   title: 'Los números del dios' },
    { id: 'final',      start: 210, end: 240, num: 'EPÍLOGO', title: 'Fuego en Constantinopla' }
  ];

  // Estatua de Zeus en Olimpia, dentro del Templo de Zeus. 1 unidad = 1 metro.
  // Norte = -Z, Sur = +Z, Este = +X. El templo mira al ESTE (+X); la estatua está al fondo oeste de la cella
  // y mira hacia la puerta (+X). Centro del templo en el origen, suelo general en y=0.
  G.SITE = {
    name: 'Olimpia',
    lat: 37.638, lon: 21.630,
    kronos: { x: -120, z: -360, radius: 220, height: 120 },   // colina de Cronos al norte
    alpheus: { z: 420, width: 90 },                            // río Alfeo al sur (corre en X)
    kladeos: { x: -260, width: 30 },                           // río Cládeo al oeste (corre en Z)
    altis: { halfX: 110, halfZ: 100 },                         // recinto sagrado (muro bajo)
    heraion: { x: -70, z: -90, halfX: 25, halfZ: 9 },          // templo de Hera
    stadium: { x: 200, z: -120, length: 192, width: 30 },      // estadio (corre en X, al este)
    palaestra: { x: -170, z: 40 },
    workshop: { x: -95, z: 6, halfX: 16, halfZ: 7.3, height: 14 }, // taller de Fidias (mismas medidas que la cella)
    cupSpot: { x: -96, y: 1.0, z: 4 },                         // la taza "Pertenezco a Fidias" sobre una mesa
    constantinople: { dirX: 0.8, dirZ: -0.6 }                   // dirección hacia Constantinopla (NE)
  };

  // Templo de Zeus (dórico, 6 x 13 columnas)
  G.TEMPLE = {
    halfX: 32, halfZ: 13.8,
    stylobateY: 1.5, steps: 3,
    cols: { front: 6, side: 13, h: 10.4, r: 1.1 },
    entabY0: 11.9, entabY1: 15.2, ridgeY: 20.3,
    cella: { x0: -23, x1: 19, halfZ: 8.2, wallH: 13.6 },     // muros de la cella (pronaos al este)
    naos: { x0: -20, x1: 10, halfZ: 7.4, door: 10 },          // sala interior; puerta en x=10
    innerCols: { z: 4.6, xFrom: -17, xTo: 8, count: 7, lowerH: 6.2, upperH: 4.6 }, // doble piso
    ceilingY: 15.4
  };

  // Estatua criselefantina (12-13 m sentada). Coordenadas LOCALES: origen en el centro de la cara superior de
  // la basa (mundo: x=-14, y=2.5, z=0), mirando a +X. Derecha de Zeus = +Z, izquierda = -Z.
  G.ZEUS = {
    origin: [-14, 2.5, 0],
    base: { x0: -19, x1: -9, halfZ: 3.25, y0: 1.5, y1: 2.5 },  // basa de piedra negra (mundo)
    height: 12,                                                 // de la basa a la coronilla
    joints: {
      pelvis: [-0.8, 5.6, 0], chest: [-1.0, 8.6, 0], neck: [-1.0, 10.2, 0], head: [-0.9, 11.0, 0],
      lHip: [-0.5, 5.2, -1.4], lKnee: [2.6, 5.4, -1.5], lFoot: [2.9, 0.4, -1.4],
      rHip: [-0.5, 5.2, 1.4],  rKnee: [2.6, 5.4, 1.5],  rFoot: [2.9, 0.4, 1.4],
      lShoulder: [-1.0, 9.6, -2.0], lElbow: [-0.6, 9.0, -2.8], lHand: [0.4, 10.0, -2.6],  // sostiene el cetro
      rShoulder: [-1.0, 9.6, 2.0],  rElbow: [0.4, 7.6, 2.4],   rHand: [2.4, 7.4, 2.2]     // sostiene a Nike
    },
    radii: { thigh: 1.0, shin: 0.7, upperArm: 0.65, forearm: 0.5, neck: 0.55, head: 0.9, torsoX: 1.5, torsoZ: 2.1 },
    throne: { seat: [-2.2, 1.8, 3.4, 4.6], halfZ: 2.6, backX: [-2.6, -2.0], backTop: 11.5, armY: 6.4 }, // [x0,x1,y0,y1]
    footstool: { x0: 2.2, x1: 3.9, y1: 0.5, halfZ: 2.2 },
    nike: { h: 1.6 },                                          // de pie sobre la mano derecha
    scepter: { x: 0.5, z: -2.6, y0: 0.5, y1: 12.6 },           // con un águila en lo alto
    pool: { x0: -6, x1: 1, halfZ: 3.3, y: 1.52 },              // estanque de aceite (mundo), piso de piedra negra
    sculptor: 'Fidias',
    year: -435, removedYear: 420, fireYear: 475
  };
  // Pasa de coordenadas locales de la estatua a mundo.
  G.ZEUS.toWorld = function (p) { const o = G.ZEUS.origin; return [o[0] + p[0], o[1] + p[1], o[2] + p[2]]; };
})();
