// Guion de la narración (voz en off + subtítulos) y fichas de datos del HUD.
// Tiempos alineados con G.CHAPTERS y las pistas TRACKS/CAM de main.js.
(function () {
  'use strict';
  const G = window.GIZA;

  G.SCRIPT = {
    lines: [
      { start: 0.8, end: 5.6, chapter: 'intro', text: 'Una montaña verde en pleno desierto, con árboles colgando.', emphasis: false },
      { start: 5.9, end: 10.5, chapter: 'intro', text: 'La maravilla más famosa, y la única que nadie ha encontrado.', emphasis: true },
      { start: 10.9, end: 14.6, chapter: 'intro', text: 'Esta es la historia de los Jardines de Babilonia.', emphasis: false },
      { start: 15.0, end: 17.8, chapter: 'intro', text: 'Y de lo que no te contaron.', emphasis: false },

      { start: 18.5, end: 23.5, chapter: 'eufrates', text: 'Babilonia, hacia 600 a.C. La ciudad más grande del mundo.', emphasis: false },
      { start: 23.8, end: 28.8, chapter: 'eufrates', text: 'Junto al Éufrates, murallas gigantes y la puerta azul de Ishtar.', emphasis: false },
      { start: 29.1, end: 33.8, chapter: 'eufrates', text: 'Una torre escalonada de noventa metros.', emphasis: false },
      { start: 34.1, end: 37.9, chapter: 'eufrates', text: 'Alrededor, solo llanura y polvo. Ni una piedra.', emphasis: true },

      { start: 38.5, end: 43.5, chapter: 'ladrillo', text: 'Sin piedra, se construye con barro: ladrillos cocidos en hornos.', emphasis: false },
      { start: 43.8, end: 48.0, chapter: 'ladrillo', text: 'Cada uno con el sello del rey.', emphasis: false },
      { start: 48.3, end: 53.5, chapter: 'ladrillo', text: 'Para pegarlos, betún: brea negra que brota del suelo.', emphasis: false },
      { start: 53.8, end: 58.8, chapter: 'ladrillo', text: 'El mismo petróleo que hoy mueve el mundo.', emphasis: true },

      { start: 60.5, end: 65.5, chapter: 'boveda', text: 'Primero, la base: hileras de bóvedas de ladrillo, como túneles.', emphasis: false },
      { start: 65.8, end: 70.8, chapter: 'boveda', text: 'Y encima, el gran problema: el agua.', emphasis: true },
      { start: 71.1, end: 75.8, chapter: 'boveda', text: 'Un jardín sobre una casa de barro. ¿No se deshace?', emphasis: false },
      { start: 76.1, end: 81.5, chapter: 'boveda', text: 'La solución: cañas con betún, ladrillo, láminas de plomo y tierra.', emphasis: false },

      { start: 82.5, end: 87.5, chapter: 'terrazas', text: 'Terraza sobre terraza, la montaña crece.', emphasis: false },
      { start: 87.8, end: 93.0, chapter: 'terrazas', text: 'Cinco niveles: veinticinco metros de alto, ciento veinte de lado.', emphasis: false },
      { start: 93.3, end: 98.5, chapter: 'terrazas', text: 'Cada piso, sostenido por arcos y bóvedas de ladrillo.', emphasis: false },
      { start: 98.8, end: 103.8, chapter: 'terrazas', text: 'Una pirámide de ladrillo con escaleras para subir a un jardín.', emphasis: false },

      { start: 104.5, end: 109.5, chapter: 'agua', text: 'Pero un jardín necesita agua, y mucha. ¿Cómo la subes?', emphasis: false },
      { start: 109.8, end: 114.8, chapter: 'agua', text: 'Sin motores: una cadena de cubos movida por bueyes, sin parar.', emphasis: false },
      { start: 115.1, end: 120.5, chapter: 'agua', text: 'Y, según una teoría, tornillos gigantes de bronce que giraban.', emphasis: false },
      { start: 120.8, end: 126.5, chapter: 'agua', text: 'Siglos antes de Arquímedes, y sin un solo motor.', emphasis: true },

      { start: 128.5, end: 133.5, chapter: 'jardin', text: 'Llega la tierra. Y con ella, la vida.', emphasis: false },
      { start: 133.8, end: 138.8, chapter: 'jardin', text: 'Palmeras, cipreses, granados y enredaderas colgando.', emphasis: false },
      { start: 139.1, end: 143.0, chapter: 'jardin', text: 'El agua corre por canales y cae en cascadas.', emphasis: false },
      { start: 143.4, end: 147.6, chapter: 'jardin', text: 'Un bosque entero, flotando sobre el desierto.', emphasis: false },

      { start: 148.5, end: 154.0, chapter: 'esplendor', text: 'Cuenta la leyenda que Nabucodonosor los hizo para su esposa, Amitis.', emphasis: false },
      { start: 154.3, end: 158.0, chapter: 'esplendor', text: 'Ella venía de las montañas verdes de Media.', emphasis: false },
      { start: 158.3, end: 163.8, chapter: 'esplendor', text: 'La llanura la entristecía. Así que el rey le regaló una montaña.', emphasis: true },

      { start: 166.5, end: 171.5, chapter: 'ninive', text: 'Pero aquí empieza lo extraño. Heródoto describió Babilonia.', emphasis: false },
      { start: 171.8, end: 177.0, chapter: 'ninive', text: 'De los jardines, ni una palabra. Ningún texto babilonio los cita.', emphasis: true },
      { start: 177.3, end: 183.0, chapter: 'ninive', text: 'Una teoría dice que estaban en Nínive, a 450 km al norte.', emphasis: false },
      { start: 183.3, end: 188.5, chapter: 'ninive', text: 'Y que los levantó otro rey: Senaquerib.', emphasis: false },

      { start: 190.5, end: 194.5, chapter: 'numeros', text: 'Hagamos cuentas. Ciento veinte metros de lado.', emphasis: false },
      { start: 194.8, end: 199.5, chapter: 'numeros', text: 'Veinticinco de alto. Miles de litros de agua por hora.', emphasis: false },
      { start: 199.8, end: 205.0, chapter: 'numeros', text: 'Cuesta arriba, sin un solo motor. Y ni un ladrillo con su nombre.', emphasis: false },
      { start: 205.3, end: 209.8, chapter: 'numeros', text: '¿Cómo desaparece una montaña?', emphasis: true },

      { start: 210.5, end: 215.0, chapter: 'final', text: 'Con los siglos, el agua dejó de subir.', emphasis: false },
      { start: 215.3, end: 220.5, chapter: 'final', text: 'Las plantas murieron. El barro se deshizo. El río cambió de cauce.', emphasis: false },
      { start: 220.8, end: 226.0, chapter: 'final', text: 'En 1899, Robert Koldewey excavó Babilonia y encontró unas bóvedas.', emphasis: false },
      { start: 226.3, end: 229.0, chapter: 'final', text: 'Quizá solo eran almacenes.', emphasis: false },
      { start: 229.3, end: 234.3, chapter: 'final', text: 'La arqueología no ha encontrado los jardines.', emphasis: false },
      { start: 234.6, end: 239.5, chapter: 'final', text: '¿Existieron alguna vez? ¿O siguen en Nínive?', emphasis: true }
    ],

    facts: {
      intro: ['Babilonia, hacia 600 a.C.', 'Nabucodonosor II', 'Nadie los ha encontrado'],
      eufrates: ['Puerta azul de Ishtar', 'Zigurat: unos 91 m', 'Sin piedra en la llanura'],
      ladrillo: ['Ladrillos con el sello real', 'Betún: brea del suelo', 'Hornos de barro cocido'],
      boveda: ['Bóvedas de ladrillo', 'Cañas con betún', 'Láminas de plomo'],
      terrazas: ['5 terrazas', '~25 m de altura', '~120 m de lado'],
      agua: ['Noria de cangilones', 'Bueyes, sin parar', 'Tornillos de bronce: teoría'],
      jardin: ['Palmeras y cipreses', 'Granados y enredaderas', 'Cascadas entre terrazas'],
      esplendor: ['Reina Amitis', 'Montañas verdes de Media', 'Un jardín de regalo'],
      ninive: ['Heródoto: ni una palabra', 'Ningún texto babilonio', 'Nínive, 450 km al norte'],
      numeros: ['120 m de lado', '25 m de alto', '~8.000 litros por hora'],
      final: ['Robert Koldewey, 1899', 'Bóvedas: ¿almacenes?', 'Ni un jardín encontrado']
    }
  };
})();
