// Guion de la narración (voz en off + subtítulos) y fichas de datos del HUD.
// Tiempos alineados con G.CHAPTERS y las pistas TRACKS/CAM de main.js.
(function () {
  'use strict';
  const G = window.GIZA;

  G.SCRIPT = {
    lines: [
      { start: 0.8, end: 5.4, chapter: 'intro', text: 'Una tumba tan grande que su nombre se volvió palabra.', emphasis: false },
      { start: 5.7, end: 10.6, chapter: 'intro', text: 'Cada vez que dices «mausoleo», hablas de Mausolo.', emphasis: false },
      { start: 10.9, end: 14.6, chapter: 'intro', text: 'Y detrás hay una reina, un tesoro y un castillo.', emphasis: false },
      { start: 14.9, end: 17.4, chapter: 'intro', text: 'Y todo lo que no te contaron.', emphasis: true },

      { start: 18.6, end: 24.0, chapter: 'halicarnaso', text: 'Siglo cuarto antes de Cristo. Halicarnaso, costa de Asia Menor.', emphasis: false },
      { start: 24.4, end: 29.0, chapter: 'halicarnaso', text: 'Mausolo, sátrapa de Caria, la convierte en su capital.', emphasis: false },
      { start: 29.4, end: 33.0, chapter: 'halicarnaso', text: 'Una bahía perfecta y un teatro en la colina.', emphasis: false },
      { start: 33.4, end: 37.6, chapter: 'halicarnaso', text: 'En el centro, una terraza esperando algo enorme.', emphasis: false },

      { start: 38.6, end: 43.4, chapter: 'cenizas', text: 'Año 353 antes de Cristo: Mausolo muere.', emphasis: false },
      { start: 43.7, end: 49.0, chapter: 'cenizas', text: 'Su esposa y hermana, Artemisia, enloquece de dolor.', emphasis: false },
      { start: 49.3, end: 54.0, chapter: 'cenizas', text: 'Dicen que mezclaba sus cenizas con vino… y se las bebía.', emphasis: true },
      { start: 54.3, end: 57.6, chapter: 'cenizas', text: 'Y ordena la tumba más grande jamás vista.', emphasis: false },

      { start: 58.6, end: 63.6, chapter: 'camara', text: 'Primero, bajar. Excavan una cámara en la roca.', emphasis: false },
      { start: 63.9, end: 69.4, chapter: 'camara', text: 'Su escalera queda sellada por un bloque gigantesco.', emphasis: false },
      { start: 69.7, end: 73.9, chapter: 'camara', text: 'Huesos de bueyes y corderos en la escalera.', emphasis: false },
      { start: 74.2, end: 79.4, chapter: 'camara', text: '¿Un banquete para el muerto, o un sacrificio?', emphasis: true },

      { start: 80.6, end: 85.6, chapter: 'podio', text: 'Ahora, subir. Un podio de diecinueve metros.', emphasis: false },
      { start: 85.9, end: 91.4, chapter: 'podio', text: 'Por dentro, piedra volcánica verdosa. Por fuera, mármol blanco.', emphasis: false },
      { start: 91.7, end: 97.0, chapter: 'podio', text: 'Mármol traído en barco desde el mar de Mármara.', emphasis: false },
      { start: 97.3, end: 101.6, chapter: 'podio', text: 'Hilada a hilada, ya es más alta que cualquier casa.', emphasis: false },

      { start: 102.6, end: 107.4, chapter: 'columnas', text: 'Sobre el podio, treinta y seis columnas jónicas.', emphasis: false },
      { start: 107.7, end: 112.6, chapter: 'columnas', text: 'Once por cada lado largo, nueve por cada lado corto.', emphasis: false },
      { start: 112.9, end: 117.8, chapter: 'columnas', text: 'Dentro, una cámara de culto. Encima, el entablamento.', emphasis: false },
      { start: 118.1, end: 123.4, chapter: 'columnas', text: 'Los arquitectos, Sátiro y Piteo, lo calculaban todo al milímetro.', emphasis: true },

      { start: 124.6, end: 128.0, chapter: 'escultores', text: 'Cuatro escultores, uno por cada lado.', emphasis: false },
      { start: 128.3, end: 133.6, chapter: 'escultores', text: 'Escopas, Briaxis, Timoteo y Leócares, cada uno con su lado.', emphasis: false },
      { start: 133.9, end: 139.4, chapter: 'escultores', text: 'Cuando Artemisia murió, nadie les pagaba. Y aun así, siguieron.', emphasis: false },
      { start: 139.7, end: 143.5, chapter: 'escultores', text: '¿Por la gloria? ¿O por algo más?', emphasis: true },

      { start: 144.6, end: 149.4, chapter: 'piramide', text: 'Encima, una pirámide de veinticuatro escalones.', emphasis: false },
      { start: 149.7, end: 154.6, chapter: 'piramide', text: 'Escalones de mármol subiendo hacia el cielo.', emphasis: false },
      { start: 154.9, end: 158.9, chapter: 'piramide', text: 'Una tumba griega con tejado egipcio.', emphasis: false },
      { start: 159.2, end: 161.6, chapter: 'piramide', text: '¿Por qué mezclar dos mundos?', emphasis: true },

      { start: 162.6, end: 167.4, chapter: 'cuadriga', text: 'Y en la cima, el remate: una cuadriga de mármol.', emphasis: false },
      { start: 167.7, end: 172.4, chapter: 'cuadriga', text: 'Cuatro caballos y un carro, a cuarenta y cinco metros.', emphasis: false },
      { start: 172.7, end: 177.0, chapter: 'cuadriga', text: 'Pintada de azul, rojo y oro. Brillaba sobre la bahía.', emphasis: false },
      { start: 177.3, end: 179.6, chapter: 'cuadriga', text: 'Así lo vieron los marineros.', emphasis: true },

      { start: 180.6, end: 185.0, chapter: 'numeros', text: 'Cuarenta y cinco metros. Treinta y seis columnas.', emphasis: false },
      { start: 185.3, end: 189.6, chapter: 'numeros', text: 'Veinticuatro escalones. Y una historia sin aclarar.', emphasis: false },
      { start: 189.9, end: 195.5, chapter: 'numeros', text: 'Cuentan que en 1522 unos caballeros hallaron la cámara intacta.', emphasis: false },
      { start: 195.8, end: 200.4, chapter: 'numeros', text: 'Llena de oro. Volvieron al día siguiente… y estaba vacía.', emphasis: true },
      { start: 200.8, end: 205.6, chapter: 'numeros', text: '¿Quién se llevó el tesoro en una sola noche?', emphasis: false },

      { start: 206.6, end: 211.4, chapter: 'final', text: 'Siglos de terremotos derribaron la cuadriga y la pirámide.', emphasis: false },
      { start: 211.7, end: 220.6, chapter: 'final', text: 'Los Caballeros de San Juan usaron sus piedras para su castillo, y lo sobrante para cal.', emphasis: false },
      { start: 220.9, end: 225.6, chapter: 'final', text: 'En 1857, Charles Newton se llevó sus estatuas a Londres.', emphasis: false },
      { start: 225.9, end: 230.4, chapter: 'final', text: 'Lo honesto: la arqueología confirma una tumba real.', emphasis: false },
      { start: 230.7, end: 235.4, chapter: 'final', text: 'Y que la cámara ya había sido saqueada hace siglos.', emphasis: false },
      { start: 235.7, end: 239.8, chapter: 'final', text: 'Pero la pregunta sigue ahí: ¿dónde está Mausolo?', emphasis: true }
    ],

    facts: {
      intro: ['Mausolo, sátrapa de Caria', 'Una tumba que dio nombre', 'Un tesoro y un castillo'],
      halicarnaso: ['Hoy Bodrum, Turquía', 'Costa de Asia Menor', 'Bahía con teatro en colina'],
      cenizas: ['Muere en 353 a.C.', 'Artemisia II, su hermana', 'Dicen: cenizas en vino'],
      camara: ['Escalera sellada con bloque', 'Huesos de bueyes y corderos', 'Excavada en la roca'],
      podio: ['Podio de 19 metros', 'Núcleo de piedra verdosa', 'Mármol del mar de Mármara'],
      columnas: ['36 columnas jónicas', '11 por lado largo', 'Sátiro y Piteo, arquitectos'],
      escultores: ['Escopas, Briaxis, Timoteo', 'Leócares, uno por lado', 'Siguieron sin cobrar'],
      piramide: ['24 escalones de mármol', 'Tejado egipcio, tumba griega', 'Unos 7 metros de pirámide'],
      cuadriga: ['Unos 45 metros de altura', 'Cuatro caballos de mármol', 'Azul, rojo y oro'],
      numeros: ['Leyenda de 1522', 'Cámara llena, luego vacía', 'Robo en una sola noche'],
      final: ['Terremotos y piedras robadas', 'Castillo de San Pedro, 1494', 'Charles Newton, 1857']
    }
  };
})();
