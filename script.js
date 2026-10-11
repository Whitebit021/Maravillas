// Guion de la narración (voz en off + subtítulos) y fichas de datos del HUD.
// Tiempos alineados con G.CHAPTERS y las pistas TRACKS/CAM de main.js.
(function () {
  'use strict';
  const G = window.GIZA;

  G.SCRIPT = {
    lines: [
      { start: 1.0, end: 7.8, chapter: 'intro', text: 'Hace unos 4.500 años alguien levantó la mayor montaña artificial del mundo. ¿Cómo?', emphasis: false },
      { start: 8.1, end: 13.5, chapter: 'intro', text: 'Oficialmente, lo hizo el faraón Keops. Pero hay cosas que no cuadran.', emphasis: false },
      { start: 13.8, end: 19.6, chapter: 'intro', text: 'Hoy veremos lo que casi nadie te explicó. ¿Y si la versión oficial falla?', emphasis: false },

      { start: 20.0, end: 26.0, chapter: 'sitio', text: 'Primero, nivelar: eligieron el punto y allanaron la roca con agua y cuerdas.', emphasis: false },
      { start: 26.3, end: 32.3, chapter: 'sitio', text: 'Luego alinearon la base con los puntos cardinales, con una precisión asombrosa.', emphasis: false },
      { start: 32.6, end: 39.5, chapter: 'sitio', text: 'Su latitud, 29,9792° N, es el mismo número que la velocidad de la luz. ¿Casualidad?', emphasis: true },

      { start: 40.0, end: 46.0, chapter: 'cantera', text: 'Ahora, cortar. ¿Cómo se parte la roca sin hierro? Con cobre y madera.', emphasis: false },
      { start: 46.3, end: 52.8, chapter: 'cantera', text: 'Metían cuñas de madera empapadas. Al hincharse, partían la piedra.', emphasis: false },
      { start: 53.1, end: 60.8, chapter: 'cantera', text: 'Así salían 2,3 millones de bloques de unas 2,5 toneladas. ¿Quién los contó?', emphasis: true },

      { start: 62.0, end: 68.8, chapter: 'cimientos', text: 'Transportar era más difícil que cortar. ¿Cómo se movía una piedra así?', emphasis: false },
      { start: 69.1, end: 75.6, chapter: 'cimientos', text: 'La arena mojada reduce a la mitad la fricción. Lo pinta una tumba de Djehutihotep.', emphasis: false },
      { start: 75.9, end: 83.5, chapter: 'cimientos', text: 'El granito llegaba de Asuán, a 800 km, en barcazas. ¿Y cómo subían cada hilada?', emphasis: false },

      { start: 84.0, end: 88.0, chapter: 'camaras', text: 'Dentro hay cámaras que casi nadie ve. ¿Casualidad?', emphasis: false },
      { start: 88.3, end: 92.3, chapter: 'camaras', text: 'Un pulso de luz recorre el pasaje, bajando y subiendo.', emphasis: false },
      { start: 92.6, end: 96.6, chapter: 'camaras', text: 'Sube y llega a la Gran Galería: 8,6 metros de altura.', emphasis: false },
      { start: 96.9, end: 100.9, chapter: 'camaras', text: 'En el 820, Al-Mamún abrió un túnel a la fuerza.', emphasis: true },
      { start: 101.2, end: 105.3, chapter: 'camaras', text: 'El Big Void: 30 m de vacío, hallado con muones en 2017.', emphasis: true },
      { start: 105.6, end: 109.6, chapter: 'camaras', text: 'Tres rastrillos de granito, y luego la cámara del Rey.', emphasis: false },

      { start: 110.0, end: 115.5, chapter: 'ascenso', text: 'Encima hay cinco cámaras de descarga. Nadie sabe para qué.', emphasis: false },
      { start: 115.8, end: 121.0, chapter: 'ascenso', text: 'Subían por una rampa en zigzag, o en espiral, según la teoría.', emphasis: false },
      { start: 121.3, end: 127.0, chapter: 'ascenso', text: '2,3 millones de bloques en 20 años: uno cada 4 o 5 minutos, sin parar.', emphasis: false },
      { start: 127.3, end: 133.2, chapter: 'ascenso', text: 'Palancas y cuerdas, a 146 metros. ¿Cómo se colocaba la última hilada?', emphasis: false },

      { start: 134.0, end: 139.5, chapter: 'estrellas', text: '¿Y si también mira al cielo? Sus conductos apuntan a Alnitak y Thuban.', emphasis: false },
      { start: 139.8, end: 145.5, chapter: 'estrellas', text: 'Según la teoría, el cinturón de Orión refleja las tres pirámides.', emphasis: true },
      { start: 145.8, end: 150.0, chapter: 'estrellas', text: 'Kefrén y Micerino ocupan su lugar en ese mapa.', emphasis: false },
      { start: 150.3, end: 155.5, chapter: 'estrellas', text: 'No es un dibujo: es un mapa del cielo. ¿Quién lo pensó?', emphasis: false },

      { start: 156.0, end: 162.0, chapter: 'cumbre', text: 'Arriba iba el piramidión, la piedra final. Nunca fue encontrado.', emphasis: false },
      { start: 162.3, end: 168.0, chapter: 'cumbre', text: 'Según la teoría, al colocarla brilló un destello de luz. ¿Casualidad?', emphasis: false },
      { start: 168.3, end: 175.6, chapter: 'cumbre', text: 'Dicen que brillaba tanto que cegaba a quien miraba. ¿Y quién lo vio?', emphasis: false },

      { start: 176.0, end: 182.0, chapter: 'revestimiento', text: 'Antes, la pirámide estaba cubierta de caliza blanca de Tura, muy pulida.', emphasis: false },
      { start: 182.3, end: 188.8, chapter: 'revestimiento', text: 'Reflejaba el sol del desierto. Dicen que se veía desde muy lejos.', emphasis: false },
      { start: 189.1, end: 195.5, chapter: 'revestimiento', text: 'En 1303 un terremoto cambió todo: sus piedras acabaron en El Cairo.', emphasis: true },

      { start: 198.0, end: 205.8, chapter: 'numeros', text: '¿Y si la pirámide sabe matemáticas? Perímetro dividido por altura: sale 2π.', emphasis: true },
      { start: 208.3, end: 214.7, chapter: 'numeros', text: 'Y la proporción áurea, 1,618, aparece en sus lados. ¿Diseño o coincidencia?', emphasis: false },
      { start: 215.0, end: 219.6, chapter: 'numeros', text: 'Para algunos, no era una tumba, sino una central de energía.', emphasis: true },

      { start: 220.0, end: 225.0, chapter: 'final', text: 'Hoy solo vemos el esqueleto. Lo demás son escombros y El Cairo.', emphasis: true },
      { start: 225.3, end: 230.3, chapter: 'final', text: 'La cima está truncada, y un mástil marca la altura original.', emphasis: false },
      { start: 230.6, end: 234.6, chapter: 'final', text: 'Lo honesto: la arqueología lo atribuye a Keops.', emphasis: false },
      { start: 234.9, end: 239.2, chapter: 'final', text: 'Unos 20.000 obreros egipcios, hacia 2560 a.C.', emphasis: false },
      { start: 239.5, end: 244.8, chapter: 'final', text: 'Aún queda una pregunta: ¿quién la construyó realmente?', emphasis: true }
    ],

    facts: {
      intro: ['2.300.000 bloques', '146,6 m de altura', 'Unos 4.500 años'],
      sitio: ['29,9792° N de latitud', '299.792.458 m/s: la luz', 'Base alineada al norte'],
      cantera: ['2,3 millones de bloques', 'Bloques de unas 2,5 t', 'Cuñas de madera mojada'],
      cimientos: ['Trineos sobre tablones', 'Arena mojada, menos roce', 'Granito de Asuán: 800 km'],
      camaras: ['Vigas: hasta unas 80 t', 'Big Void: 30 m (2017)', 'Cinco cámaras de descarga'],
      ascenso: ['146,6 metros de altura', 'Unas 210 hiladas reales', 'Un bloque cada 4-5 min'],
      estrellas: ['Conductos de ventilación', 'Tres estrellas en Orión', 'Tres pirámides principales'],
      cumbre: ['Piramidión perdido', 'Piedra final de la cima', 'Nunca fue encontrado'],
      revestimiento: ['Caliza blanca de Tura', 'Pulida, reflejaba el sol', 'Terremoto de 1303'],
      numeros: ['Perímetro / altura ≈ 2π', 'Proporción áurea ≈ 1,618', 'Central de energía: teoría'],
      final: ['Hoy solo queda el esqueleto', 'Cima sin piramidión', '20.000 obreros, ~2560 a.C.']
    }
  };
})();
