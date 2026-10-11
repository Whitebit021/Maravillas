// Guion de la narración (voz en off + subtítulos) y fichas de datos del HUD.
// Tiempos alineados con G.CHAPTERS y las pistas TRACKS/CAM de main.js.
(function () {
  'use strict';
  const G = window.GIZA;

  G.SCRIPT = {
    lines: [
      { start: 0.8, end: 5.8, chapter: 'intro', text: 'Durante más de mil años, una llama ardió sobre el mar.', emphasis: false },
      { start: 6.2, end: 11.2, chapter: 'intro', text: 'Fue el rascacielos del mundo antiguo. Hoy no queda nada en pie.', emphasis: false },
      { start: 11.6, end: 17.8, chapter: 'intro', text: 'Esta es la historia del Faro de Alejandría… y lo que no te contaron.', emphasis: true },

      { start: 18.6, end: 24.0, chapter: 'isla', text: 'Alejandría tenía un problema: costa plana y llena de escollos.', emphasis: false },
      { start: 24.4, end: 28.6, chapter: 'isla', text: 'Los barcos se hundían a las puertas del puerto.', emphasis: true },
      { start: 29.0, end: 34.2, chapter: 'isla', text: 'La solución: una isla, Faros, unida a la ciudad por una calzada.', emphasis: false },
      { start: 34.6, end: 37.8, chapter: 'isla', text: 'Calzada de 1.250 metros: el Heptastadion.', emphasis: false },

      { start: 38.6, end: 43.0, chapter: 'piedra', text: 'Para levantarlo hacía falta piedra, mucha piedra.', emphasis: false },
      { start: 43.4, end: 48.6, chapter: 'piedra', text: 'Caliza blanca de canteras cercanas y granito rojo de Asuán.', emphasis: false },
      { start: 49.0, end: 54.5, chapter: 'piedra', text: 'Ese granito bajaba por el Nilo, a más de mil kilómetros, en barcazas.', emphasis: true },
      { start: 54.9, end: 59.2, chapter: 'piedra', text: 'Bloques de varias toneladas, uno tras otro, en el muelle.', emphasis: false },

      { start: 60.6, end: 65.0, chapter: 'cimientos', text: 'Pero había un enemigo: el mar, día y noche.', emphasis: false },
      { start: 65.4, end: 70.6, chapter: 'cimientos', text: 'Encajaron bloques enormes y los soldaron con plomo fundido.', emphasis: false },
      { start: 71.0, end: 75.2, chapter: 'cimientos', text: 'El plomo se vertía en las juntas entre los bloques.', emphasis: false },
      { start: 75.6, end: 79.6, chapter: 'cimientos', text: 'Una base que no se moviera. Nunca.', emphasis: true },

      { start: 80.6, end: 85.2, chapter: 'torre', text: 'Empieza a subir el primer cuerpo: cuadrado, de 60 metros.', emphasis: false },
      { start: 85.6, end: 90.0, chapter: 'torre', text: 'Grúas de madera movidas por hombres dentro de ruedas.', emphasis: false },
      { start: 90.4, end: 94.8, chapter: 'torre', text: 'Bajo los Ptolomeos, la obra duró unos quince años.', emphasis: false },
      { start: 95.2, end: 99.5, chapter: 'torre', text: 'Cientos de ventanas en su fachada de piedra.', emphasis: false },
      { start: 99.9, end: 103.6, chapter: 'torre', text: 'Y por dentro… guarda un secreto.', emphasis: true },

      { start: 104.6, end: 109.0, chapter: 'rampa', text: 'Dentro no había escaleras. Solo una rampa en espiral.', emphasis: false },
      { start: 109.4, end: 114.0, chapter: 'rampa', text: 'Tan ancha que subían burros cargados de leña.', emphasis: false },
      { start: 114.4, end: 119.6, chapter: 'rampa', text: 'Cientos de viajes al día, solo para alimentar el fuego.', emphasis: false },
      { start: 120.0, end: 125.4, chapter: 'rampa', text: 'En el centro, un pozo vertical. Dicen que era un montacargas.', emphasis: false },

      { start: 126.6, end: 131.0, chapter: 'octogono', text: 'Sobre la torre, un cuerpo de ocho caras de 30 metros.', emphasis: false },
      { start: 131.4, end: 135.6, chapter: 'octogono', text: 'Y encima, un cilindro. Tres formas, una sobre otra.', emphasis: false },
      { start: 136.0, end: 140.9, chapter: 'octogono', text: '¿Por qué cambiar de forma? Dicen que cada cuerpo miraba a algo.', emphasis: true },
      { start: 141.3, end: 145.6, chapter: 'octogono', text: 'La tierra, los vientos y el cielo, según la teoría.', emphasis: false },

      { start: 146.6, end: 150.8, chapter: 'fuego', text: 'En la cima, la linterna: una hoguera enorme.', emphasis: false },
      { start: 151.2, end: 156.0, chapter: 'fuego', text: 'Detrás, un espejo de bronce pulido, mar adentro.', emphasis: false },
      { start: 156.4, end: 160.8, chapter: 'fuego', text: 'Dicen que se veía a cincuenta kilómetros.', emphasis: true },
      { start: 161.2, end: 165.6, chapter: 'fuego', text: 'Y en lo alto, una estatua de Zeus vigilando el horizonte.', emphasis: false },

      { start: 166.6, end: 171.4, chapter: 'espejo', text: 'Y aquí empieza la leyenda: dicen que el espejo quemaba barcos.', emphasis: false },
      { start: 171.8, end: 176.8, chapter: 'espejo', text: 'Concentraba el sol y quemaba barcos enemigos antes de llegar.', emphasis: false },
      { start: 177.2, end: 182.6, chapter: 'espejo', text: 'Pero haz la cuenta: a 700 metros, ningún espejo de bronce llega.', emphasis: false },
      { start: 183.0, end: 187.8, chapter: 'espejo', text: '¿Un mito o un secreto que alguien borró?', emphasis: true },

      { start: 188.6, end: 192.4, chapter: 'firma', text: 'Ahora, la firma: el rey mandó grabar Ptolomeo.', emphasis: false },
      { start: 192.8, end: 196.8, chapter: 'firma', text: 'Pero Sóstrato de Cnido, el arquitecto, hizo trampa.', emphasis: false },
      { start: 197.2, end: 201.4, chapter: 'firma', text: 'Grabó su nombre en la piedra y lo tapó con yeso.', emphasis: false },
      { start: 201.8, end: 205.4, chapter: 'firma', text: 'Con los años, el yeso cayó: apareció Sóstrato.', emphasis: true },
      { start: 205.8, end: 209.6, chapter: 'firma', text: '124 metros. Y un hombre que engañó a un rey.', emphasis: false },

      { start: 210.6, end: 215.0, chapter: 'final', text: 'En 1303, un terremoto derribó la parte alta.', emphasis: false },
      { start: 215.4, end: 219.4, chapter: 'final', text: 'En 1323, otro acabó con lo que quedaba.', emphasis: false },
      { start: 219.8, end: 225.0, chapter: 'final', text: 'En 1477, el sultán Qaitbey levantó una fortaleza con sus piedras.', emphasis: false },
      { start: 225.4, end: 229.5, chapter: 'final', text: 'En 1994, buzos hallaron sus bloques bajo el agua.', emphasis: false },
      { start: 229.9, end: 235.0, chapter: 'final', text: 'Lo honesto: la arqueología lo atribuye a Sóstrato, bajo Ptolomeo.', emphasis: false },
      { start: 235.4, end: 239.6, chapter: 'final', text: 'Pero dime… ¿qué más escondieron bajo el yeso?', emphasis: true }
    ],

    facts: {
      intro: ['Más de 100 m de altura', '~297-280 a.C.', 'Hoy no queda nada en pie'],
      isla: ['Isla de Faros', 'Heptastadion: ~1.250 m', 'Escollos y naufragios'],
      piedra: ['Caliza blanca local', 'Granito de Asuán', 'Río Nilo: más de 1.000 km'],
      cimientos: ['Bloques unidos con plomo', 'Plomo fundido en las juntas', 'Base que no se mueve'],
      torre: ['Cuerpo cuadrado: ~60 m', 'Ventanas en ocho pisos', 'Unos 15 años de obra'],
      rampa: ['Rampa en espiral interior', 'Burros cargados de leña', 'Pozo central: montacargas'],
      octogono: ['Ocho caras, unos 30 m', 'Cilindro encima', 'Tierra, vientos y cielo'],
      fuego: ['Hoguera de leña', 'Espejo de bronce', 'Visible a unos 50 km'],
      espejo: ['Distancia: 700 m', 'Ningún espejo lo logra', 'Leyenda: barcos en llamas'],
      firma: ['Nombre: Sóstrato de Cnido', 'Yeso con el nombre del rey', '124 metros de altura'],
      final: ['Terremotos de 1303 y 1323', 'Fortaleza de Qaitbey, 1477', 'Bloques hallados en 1994']
    }
  };
})();
