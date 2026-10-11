// Guion de la narración (voz en off + subtítulos) y fichas de datos del HUD.
// Tiempos alineados con G.CHAPTERS y las pistas TRACKS/CAM de main.js.
(function () {
  'use strict';
  const G = window.GIZA;

  G.SCRIPT = {
    lines: [
      { start: 0.8, end: 5.58, chapter: 'intro', text: 'Un dios de doce metros, sentado en un trono de marfil y oro.', emphasis: false },
      { start: 5.9, end: 9.88, chapter: 'intro', text: 'Quien lo veía, dicen, olvidaba todas sus penas.', emphasis: false },
      { start: 10.2, end: 13.18, chapter: 'intro', text: 'Desapareció sin dejar rastro.', emphasis: false },
      { start: 13.5, end: 17.7, chapter: 'intro', text: 'Esta es la historia de la estatua de Zeus en Olimpia.', emphasis: false },

      { start: 18.5, end: 22.48, chapter: 'olimpia', text: 'Olimpia. Cada cuatro años, Grecia se detenía.', emphasis: false },
      { start: 22.8, end: 26.98, chapter: 'olimpia', text: 'Para los Juegos: atletas, reyes y peregrinos.', emphasis: false },
      { start: 27.3, end: 31.98, chapter: 'olimpia', text: 'Todos venían a ver al padre de los dioses.', emphasis: false },
      { start: 32.3, end: 37.5, chapter: 'olimpia', text: 'Pero el santuario tenía un problema.', emphasis: false },

      { start: 38.5, end: 43.98, chapter: 'templo', text: 'El templo de Zeus: 64 metros de largo y columnas de diez.', emphasis: false },
      { start: 44.3, end: 48.78, chapter: 'templo', text: 'Frontones llenos de esculturas. Y por dentro, nada.', emphasis: false },
      { start: 49.1, end: 52.48, chapter: 'templo', text: 'La sala del dios estaba vacía.', emphasis: true },
      { start: 52.8, end: 55.98, chapter: 'templo', text: 'Le faltaba lo más importante.', emphasis: false },
      { start: 56.3, end: 59.8, chapter: 'templo', text: 'Olimpia llamó al mejor escultor: Fidias.', emphasis: false },

      { start: 60.5, end: 65.48, chapter: 'taller', text: 'Junto al templo, Fidias levanta su taller.', emphasis: false },
      { start: 65.8, end: 70.98, chapter: 'taller', text: 'Con las mismas medidas que la sala del dios.', emphasis: false },
      { start: 71.3, end: 76.98, chapter: 'taller', text: 'Allí trabaja en secreto. Siglos después, lo encontraron los arqueólogos.', emphasis: false },
      { start: 77.3, end: 81.6, chapter: 'taller', text: 'Entre los escombros, una taza: «Pertenezco a Fidias».', emphasis: true },

      { start: 82.5, end: 86.98, chapter: 'nucleo', text: 'Por dentro, la estatua no es de piedra. Es de madera.', emphasis: false },
      { start: 87.3, end: 92.48, chapter: 'nucleo', text: 'Vigas y travesaños que dibujan a un hombre sentado.', emphasis: false },
      { start: 92.8, end: 97.98, chapter: 'nucleo', text: 'Doce metros de altura, levantados dentro del templo.', emphasis: false },
      { start: 98.3, end: 103.5, chapter: 'nucleo', text: 'Pero encima irá una fortuna.', emphasis: false },

      { start: 104.5, end: 108.98, chapter: 'marfil', text: 'Esta técnica se llama criselefantina: marfil y oro.', emphasis: true },
      { start: 109.3, end: 114.48, chapter: 'marfil', text: 'Placas de marfil, ablandadas y curvadas, para la piel.', emphasis: false },
      { start: 114.8, end: 119.98, chapter: 'marfil', text: 'Láminas de oro para el manto, el pelo y la barba.', emphasis: false },
      { start: 120.3, end: 125.5, chapter: 'marfil', text: 'Cada pieza se hacía en el taller y se montaba una a una.', emphasis: false },

      { start: 126.5, end: 130.98, chapter: 'trono', text: 'Llega el trono: ébano, oro, marfil y piedras preciosas.', emphasis: false },
      { start: 131.3, end: 136.48, chapter: 'trono', text: 'Esfinges en los brazos. Una Victoria alada en la mano derecha.', emphasis: false },
      { start: 136.8, end: 141.48, chapter: 'trono', text: 'En la izquierda, un cetro con un águila en la punta.', emphasis: false },
      { start: 141.8, end: 145.5, chapter: 'trono', text: 'El dios ya está completo.', emphasis: true },

      { start: 146.5, end: 150.98, chapter: 'esplendor', text: 'Estrabón: si Zeus se levantara, rompería el techo.', emphasis: false },
      { start: 151.3, end: 155.98, chapter: 'esplendor', text: 'La cabeza casi tocaba las vigas del templo.', emphasis: false },
      { start: 156.3, end: 161.48, chapter: 'esplendor', text: 'Los peregrinos entraban en penumbra.', emphasis: false },
      { start: 161.8, end: 165.6, chapter: 'esplendor', text: 'De pronto, el oro, a la luz de las lámparas.', emphasis: true },

      { start: 166.5, end: 170.48, chapter: 'aceite', text: 'Delante del dios, un estanque poco profundo.', emphasis: false },
      { start: 170.8, end: 173.78, chapter: 'aceite', text: 'No de agua: de aceite de oliva.', emphasis: false },
      { start: 174.1, end: 177.98, chapter: 'aceite', text: 'La humedad evitaba que el marfil se agrietara.', emphasis: false },
      { start: 178.3, end: 181.98, chapter: 'aceite', text: 'Cuentan que Calígula quiso llevársela a Roma.', emphasis: false },
      { start: 182.3, end: 186.5, chapter: 'aceite', text: 'Al subir, la estatua se rió. Cayeron los andamios.', emphasis: true },

      { start: 188.5, end: 192.48, chapter: 'numeros', text: 'Hagamos cuentas. Doce metros sentado.', emphasis: false },
      { start: 192.8, end: 196.98, chapter: 'numeros', text: 'De pie mediría unos 17 metros: casi diez hombres.', emphasis: false },
      { start: 197.3, end: 201.98, chapter: 'numeros', text: 'Toneladas de oro y marfil sobre madera. 800 años en pie.', emphasis: false },
      { start: 202.3, end: 209.0, chapter: 'numeros', text: '¿Cómo sobrevive algo así tanto tiempo para desaparecer de golpe?', emphasis: true },

      { start: 210.5, end: 215.48, chapter: 'final', text: 'Cerraron los templos paganos. La estatua fue a Constantinopla.', emphasis: false },
      { start: 215.8, end: 219.98, chapter: 'final', text: 'En el 475 d.C., un incendio la devoró.', emphasis: true },
      { start: 220.3, end: 225.48, chapter: 'final', text: 'El templo cayó con los terremotos, y el río lo enterró.', emphasis: false },
      { start: 225.8, end: 230.78, chapter: 'final', text: 'Lo honesto: la arqueología la atribuye a Fidias, hacia 435 a.C.', emphasis: false },
      { start: 231.1, end: 234.48, chapter: 'final', text: 'El taller y la taza apuntan a él.', emphasis: false },
      { start: 234.8, end: 239.5, chapter: 'final', text: 'Pero si todo ardió, ¿por qué nadie encontró nunca el oro?', emphasis: true }
    ],

    facts: {
      intro: ['Doce metros, sentado', 'Marfil y oro', 'Hecha hacia 435 a.C.'],
      olimpia: ['Juegos cada cuatro años', 'Santuario de Zeus', 'Atletas, reyes y peregrinos'],
      templo: ['Templo de Zeus: 64 m', 'Columnas de 10 m', 'Por dentro, vacío'],
      taller: ['Taller del mismo tamaño', 'Taza: "Pertenezco a Fidias"', 'Excavado en el siglo XX'],
      nucleo: ['Núcleo de madera', 'Doce metros de altura', 'Vigas y travesaños'],
      marfil: ['Criselefantina', 'Placas de marfil: la piel', 'Láminas de oro: manto y pelo'],
      trono: ['Ébano, oro, marfil, gemas', 'Nike en la mano derecha', 'Cetro con águila'],
      esplendor: ['Estrabón: rompería el techo', 'Cabeza casi bajo las vigas', 'Penumbra y luz de lámparas'],
      aceite: ['Estanque de aceite de oliva', 'Calígula quiso llevársela', 'Fuente: Suetonio ("cuentan")'],
      numeros: ['De pie: unos 17 m', 'Toneladas de oro y marfil', '800 años en pie'],
      final: ['Llevada a Constantinopla', 'Incendio en 475 d.C.', 'Atribuida a Fidias']
    }
  };
})();
