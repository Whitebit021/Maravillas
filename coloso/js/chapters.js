// Datos compartidos por todos los módulos. NO depende de nada salvo window.GIZA.
(function () {
  'use strict';
  const G = window.GIZA;

  G.DURATION = 240; // segundos totales del "video"

  G.CHAPTERS = [
    { id: 'intro',      start: 0,   end: 18,  num: 'PRÓLOGO', title: 'Lo que no te contaron' },
    { id: 'asedio',     start: 18,  end: 40,  num: 'I',    title: 'El asedio que lo empezó todo' },
    { id: 'bronce',     start: 40,  end: 62,  num: 'II',   title: 'El bronce del enemigo' },
    { id: 'cimientos',  start: 62,  end: 82,  num: 'III',  title: 'El pedestal de mármol' },
    { id: 'armazon',    start: 82,  end: 106, num: 'IV',   title: 'El esqueleto de hierro' },
    { id: 'terraplen',  start: 106, end: 130, num: 'V',    title: 'La montaña de tierra' },
    { id: 'cabeza',     start: 130, end: 150, num: 'VI',   title: 'La corona del Sol' },
    { id: 'esplendor',  start: 150, end: 170, num: 'VII',  title: 'El gigante del puerto' },
    { id: 'mito',       start: 170, end: 192, num: 'VIII', title: 'La gran mentira de las piernas' },
    { id: 'numeros',    start: 192, end: 212, num: 'IX',   title: 'Los números imposibles' },
    { id: 'final',      start: 212, end: 240, num: 'EPÍLOGO', title: '54 años y 900 camellos' }
  ];

  // Coloso de Rodas (Helios). 1 unidad = 1 metro. Norte = -Z (mar y puerto), Sur = +Z (ciudad), Este = +X.
  // El pedestal está centrado en el origen con su base en y=0. La estatua mira al norte (-Z), hacia el puerto.
  G.SITE = {
    name: 'Rodas',
    lat: 36.451, lon: 28.226,           // puerto de Mandraki (ubicación propuesta)
    seaLevel: -1.5,                      // superficie del mar
    coastZ: -60,                         // la tierra firme ocupa z > coastZ (costa irregular ±15 m)
    eastCoastX: 520,                     // al este de x=520 también es mar (costa irregular)
    // espigones del puerto de Mandraki: polilíneas en el plano XZ (ancho 18 m, altura 3 m sobre el mar)
    moleWest: [[-170, -55], [-130, -160], [-80, -260]],
    moleEast: [[170, -55], [130, -160], [80, -260]],
    harborMouth: { x: 0, z: -260, width: 160 },   // bocana: entre x=-80 y x=80
    city: { xMin: -650, xMax: 250, zMin: 60, zMax: 750 }, // casas, templos, acrópolis al SO
    acropolis: { x: -420, z: 520, height: 110 },
    walls: { x: 330 },                    // muralla este (corre en Z, de z=-40 a z=700)
    helepolis: { x: 430, z: 140, height: 40, base: 22 }, // torre de asedio de Demetrio (abandonada)
    siegeFleet: { x: 650, z: -350, radius: 300 },        // flota de Demetrio, al NE en el mar
    weapons: { x: 95, z: 75, radius: 22 },               // montón de armas y máquinas abandonadas
    furnaces: [[-42, 34], [44, 36], [-48, -28], [46, -30]], // hornos de fundición alrededor del pedestal
    fallDir: { x: 1, z: 0 },             // la estatua cae hacia el este (+X)
    caravan: [[30, 12], [150, 30], [300, 45], [480, 80]],   // ruta de los 900 camellos (654 d.C.), por la franja costera
    deerColumns: [[-80, -262], [80, -262]] // hoy: columnas con ciervo de bronce en la bocana
  };

  // Pedestal de mármol blanco: 3 cuerpos escalonados. Altura total 15 m.
  G.PEDESTAL = {
    height: 15,
    tiers: [ // [yBase, yTop, semilado]
      [0, 4, 11],
      [4, 11, 9],
      [11, 15, 7.5]
    ]
  };

  // Estatua: 33 m (70 codos según Plinio) desde la planta de los pies hasta la coronilla; rayos hasta 34.5 m.
  // Coordenadas LOCALES: origen en el centro del pedestal, a la altura de su cara superior (y mundo = 15 + y).
  // Mira hacia -Z. Postura de pie, piernas casi juntas (NO abiertas), mano derecha haciendo visera,
  // brazo izquierdo caído sosteniendo un manto que cae hasta el pedestal (tercer apoyo).
  G.COL = {
    baseY: 15,
    height: 33,
    crownTop: 34.5,
    // articulaciones (x, y, z) en coordenadas locales
    joints: {
      lFoot: [-1.9, 0.5, -1.0], lAnkle: [-1.9, 1.6, 0], lKnee: [-2.0, 9.0, -0.2], lHip: [-2.2, 16.0, 0],
      rFoot: [1.9, 0.5, -1.0],  rAnkle: [1.9, 1.6, 0],  rKnee: [2.0, 9.0, -0.2],  rHip: [2.2, 16.0, 0],
      pelvis: [0, 16.5, 0], waist: [0, 19.0, 0], chest: [0, 24.0, 0], neck: [0, 28.6, 0], head: [0, 30.7, -0.2],
      lShoulder: [-4.6, 27.0, 0], lElbow: [-6.0, 21.5, 0.4], lHand: [-6.4, 16.6, -0.4],
      rShoulder: [4.6, 27.0, 0],  rElbow: [7.0, 29.6, -1.4], rHand: [2.5, 31.3, -2.4]
    },
    // radios de los miembros (m)
    radii: { thigh: 2.0, knee: 1.5, ankle: 1.0, upperArm: 1.4, forearm: 1.1, hand: 0.9, neck: 1.3, head: 2.1 },
    // secciones del torso [y, semiancho X, semifondo Z]
    torso: [[16.0, 3.8, 2.6], [19.0, 3.4, 2.3], [24.0, 4.2, 2.6], [27.0, 4.7, 2.4], [28.6, 1.4, 1.3]],
    // manto: cae del antebrazo izquierdo hasta el pedestal, por detrás-izquierda
    drape: { top: [-6.2, 19.0, 0.6], bottom: [-5.2, 0, 1.6], width: 2.6 },
    // 12 rayos de la corona solar: salen de la cabeza en abanico (radio 2.3, longitud 2.2)
    crownRays: 12,
    // columnas internas de piedra (según Filón de Bizancio): [x, z, yDesde, yHasta, radio]
    columns: [
      [-2.0, 0.0, 0, 16.0, 0.8],   // pierna izquierda
      [2.0, 0.0, 0, 16.0, 0.8],    // pierna derecha
      [-5.2, 1.4, 0, 18.0, 0.9],   // tras el manto
      [0.0, 0.2, 16.0, 28.6, 1.1]  // columna central del torso hasta el cuello
    ],
    // datos de las fuentes (para HUD y misterio)
    bronzeTons: 13,       // ~500 talentos (Filón)
    ironTons: 7.8,        // ~300 talentos
    years: 12,            // 292-280 a.C.
    startYear: -292, endYear: -280,
    quakeYear: -226,      // terremoto: se quiebra por las rodillas
    camelsYear: 654,      // un mercader se lleva los restos
    camels: 900,
    sculptor: 'Cares de Lindos'
  };

  // Utilidad: semiancho aproximado del cuerpo a la altura local y (para que el armazón quepa dentro).
  G.COL.halfWidthAt = function (y) {
    const T = G.COL.torso;
    if (y < 16) return 2.2 + 1.9; // piernas: x ±2 + radio
    for (let i = 1; i < T.length; i++) {
      if (y <= T[i][0]) { const a = T[i - 1], b = T[i], u = (y - a[0]) / (b[0] - a[0]); return a[1] + (b[1] - a[1]) * u; }
    }
    return 2.1;
  };
})();
