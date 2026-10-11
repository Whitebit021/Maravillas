// Guion de la narración (voz en off + subtítulos) y fichas de datos del HUD.
// Tiempos alineados con G.CHAPTERS y las pistas TRACKS/CAM de main.js.
(function () {
  'use strict';
  const G = window.GIZA;

  G.SCRIPT = {
    lines: [
      { start: 0.8, end: 6.4, chapter: 'intro', text: 'Un hombre quemó la maravilla más bella del mundo para que lo recordaran.', emphasis: false },
      { start: 6.7, end: 10.9, chapter: 'intro', text: 'Lo castigaron prohibiendo pronunciar su nombre.', emphasis: false },
      { start: 11.2, end: 14.9, chapter: 'intro', text: 'Hoy vamos a decirlo: el Templo de Artemisa.', emphasis: false },
      { start: 15.2, end: 17.6, chapter: 'intro', text: 'Y todo lo que no te contaron.', emphasis: true },

      { start: 18.8, end: 23.8, chapter: 'marisma', text: 'Éfeso, costa de Asia Menor. Aquí la tierra tiembla a menudo.', emphasis: false },
      { start: 24.1, end: 29.6, chapter: 'marisma', text: 'Y los griegos levantan su templo más grande en medio de un pantano.', emphasis: false },
      { start: 29.9, end: 34.3, chapter: 'marisma', text: '¿Por qué? Porque el barro blando absorbe los terremotos.', emphasis: true },
      { start: 34.6, end: 37.8, chapter: 'marisma', text: 'Y el secreto estaba bajo tierra.', emphasis: false },

      { start: 38.6, end: 43.4, chapter: 'cimientos', text: 'Un pantano se traga cualquier cosa. Así que excavan.', emphasis: false },
      { start: 43.7, end: 49.7, chapter: 'cimientos', text: 'Rellenan el fondo con capas: carbón vegetal apisonado… y vellones de lana.', emphasis: false },
      { start: 50.0, end: 55.0, chapter: 'cimientos', text: 'Otra capa de carbón, y encima, piedra. Un cimiento casi vivo.', emphasis: false },
      { start: 55.3, end: 59.5, chapter: 'cimientos', text: 'Tecnología antisísmica de hace 2.500 años.', emphasis: true },

      { start: 60.8, end: 65.2, chapter: 'marmol', text: 'El mármol estaba a doce kilómetros. ¿Cómo moverlo?', emphasis: false },
      { start: 65.5, end: 70.7, chapter: 'marmol', text: 'Tambores de muchas toneladas, por un camino de barro.', emphasis: false },
      { start: 71.0, end: 76.8, chapter: 'marmol', text: 'Quersifrón y su hijo Metágenes: ejes de hierro para hacerlos rodar.', emphasis: true },
      { start: 77.1, end: 81.9, chapter: 'marmol', text: 'Como ruedas, tirados por bueyes. La columna era su carro.', emphasis: false },

      { start: 82.8, end: 86.6, chapter: 'columnas', text: 'Y empiezan a subir. Tambor sobre tambor.', emphasis: false },
      { start: 86.9, end: 92.9, chapter: 'columnas', text: 'Ciento veintisiete columnas de unos dieciocho metros, en doble fila.', emphasis: false },
      { start: 93.2, end: 99.2, chapter: 'columnas', text: 'Treinta y seis de ellas, esculpidas con figuras en la base.', emphasis: false },
      { start: 99.5, end: 105.5, chapter: 'columnas', text: 'Un bosque de mármol en medio del pantano.', emphasis: false },

      { start: 106.8, end: 111.5, chapter: 'arquitrabe', text: 'Ahora, lo imposible: subir arquitrabes a veinte metros.', emphasis: false },
      { start: 111.8, end: 115.6, chapter: 'arquitrabe', text: 'La respuesta: una rampa de sacos de arena.', emphasis: false },
      { start: 115.9, end: 120.2, chapter: 'arquitrabe', text: 'Vaciaban los sacos de abajo y la piedra bajaba sola.', emphasis: true },
      { start: 120.5, end: 126.5, chapter: 'arquitrabe', text: 'Y cuenta la leyenda que uno se torció… y Artemisa lo colocó en sueños.', emphasis: false },

      { start: 128.8, end: 133.6, chapter: 'templo', text: 'Llegan el tejado, los frontones y las tejas de mármol.', emphasis: false },
      { start: 133.9, end: 137.4, chapter: 'templo', text: 'Dentro, la estatua de la diosa.', emphasis: false },
      { start: 137.7, end: 142.2, chapter: 'templo', text: 'Ciento quince metros de largo. Cuatro veces el Partenón.', emphasis: true },
      { start: 142.5, end: 147.2, chapter: 'templo', text: 'El edificio más grande que había visto el mundo griego.', emphasis: false },

      { start: 148.8, end: 153.2, chapter: 'esplendor', text: 'Pintado de azul, rojo y oro, brillaba sobre la llanura.', emphasis: false },
      { start: 153.5, end: 159.0, chapter: 'esplendor', text: 'Llegaban peregrinos, reyes y comerciantes de todo el Mediterráneo.', emphasis: false },
      { start: 159.3, end: 165.5, chapter: 'esplendor', text: 'Antípatro, que vio las siete maravillas, dijo que esta las superaba a todas.', emphasis: true },

      { start: 166.8, end: 170.8, chapter: 'erostrato', text: 'Año 356 antes de Cristo. Una noche de julio.', emphasis: false },
      { start: 171.1, end: 175.6, chapter: 'erostrato', text: 'Un hombre entra con una antorcha. Se llama Eróstrato.', emphasis: false },
      { start: 175.9, end: 179.4, chapter: 'erostrato', text: 'No quiere oro. Quiere fama.', emphasis: true },
      { start: 179.7, end: 182.2, chapter: 'erostrato', text: 'Le prende fuego al templo.', emphasis: false },
      { start: 182.5, end: 186.5, chapter: 'erostrato', text: 'Esa misma noche, en Pella, nace Alejandro Magno.', emphasis: false },
      { start: 186.8, end: 189.8, chapter: 'erostrato', text: 'Y Éfeso prohíbe pronunciar su nombre.', emphasis: false },

      { start: 190.8, end: 194.0, chapter: 'numeros', text: 'Dicen que Artemisa estaba lejos.', emphasis: false },
      { start: 194.3, end: 198.3, chapter: 'numeros', text: 'Asistiendo al parto de Alejandro. ¿Casualidad?', emphasis: true },
      { start: 198.6, end: 203.6, chapter: 'numeros', text: 'Lo reconstruyeron aún más grande: 115 metros, 127 columnas.', emphasis: false },
      { start: 203.9, end: 209.0, chapter: 'numeros', text: 'Cuando Alejandro quiso pagarlo, los efesios le dijeron que no.', emphasis: false },

      { start: 210.8, end: 214.0, chapter: 'final', text: 'En el 262, los godos lo saquearon.', emphasis: false },
      { start: 214.3, end: 218.3, chapter: 'final', text: 'Sus piedras sirvieron para otros edificios.', emphasis: false },
      { start: 218.6, end: 224.1, chapter: 'final', text: 'Hoy queda una columna rehecha con trozos, y una cigüeña.', emphasis: false },
      { start: 224.4, end: 229.4, chapter: 'final', text: 'La arqueología confirma el incendio y los cimientos de carbón.', emphasis: false },
      { start: 229.7, end: 234.2, chapter: 'final', text: 'Pero piénsalo: quiso ser recordado para siempre.', emphasis: false },
      { start: 234.5, end: 239.8, chapter: 'final', text: 'Y aquí estamos, diciendo su nombre. ¿Quién ganó?', emphasis: true }
    ],

    facts: {
      intro: ['Maravilla del mundo antiguo', 'Templo de Artemisa, Éfeso', 'Incendiado en 356 a.C.'],
      marisma: ['Cimiento sobre un pantano', 'Barro que absorbe sismos', 'Terremotos frecuentes'],
      cimientos: ['Carbón vegetal apisonado', 'Vellones de lana', 'Cimiento antisísmico'],
      marmol: ['Mármol a unos 12 km', 'Quersifrón y Metágenes', 'Tambores con ejes de hierro'],
      columnas: ['127 columnas jónicas', 'Unos 18 m de altura', '36 con relieves'],
      arquitrabe: ['Rampa de sacos de arena', 'Los sacos se vacían', 'Leyenda: arquitrabe torcido'],
      templo: ['115 x 55 m', 'Cuatro veces el Partenón', 'Tejas de mármol'],
      esplendor: ['Pintado de azul, rojo y oro', 'Peregrinos del Mediterráneo', 'Antípatro: superaba a todas'],
      erostrato: ['21 de julio de 356 a.C.', 'Lo quemó por fama', 'Nace Alejandro Magno'],
      numeros: ['Pena de muerte por nombrarlo', 'Artemisa, ausente (dicen)', 'Alejandro quiso pagar'],
      final: ['Godos en el 262 d.C.', 'Hoy: una columna rehecha', 'Cigüeñas en el pantano']
    }
  };
})();
