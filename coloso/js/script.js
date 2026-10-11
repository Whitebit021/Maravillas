// Guion de la narración (voz en off + subtítulos) y fichas de datos del HUD.
// Tiempos alineados con G.CHAPTERS y las pistas TRACKS/CAM de main.js.
(function () {
  'use strict';
  const G = window.GIZA;

  G.SCRIPT = {
    lines: [
      { start: 0.8, end: 6.8, chapter: 'intro', text: 'Un gigante de bronce con las piernas abiertas sobre el puerto. ¿Lo recuerdas?', emphasis: false },
      { start: 7.2, end: 13.0, chapter: 'intro', text: 'Dicen que era tan alto que los barcos pasaban entre sus piernas. ¿Cierto?', emphasis: false },
      { start: 13.4, end: 17.8, chapter: 'intro', text: 'Hoy vemos lo que no te contaron. Y la versión oficial cojea.', emphasis: true },

      { start: 18.6, end: 25.0, chapter: 'asedio', text: 'En el 305 a.C., Demetrio Poliorcetes llegó a Rodas con un ejército enorme.', emphasis: false },
      { start: 25.4, end: 31.5, chapter: 'asedio', text: 'Su gran arma: la Helépolis, una torre de 40 metros chapada en hierro.', emphasis: false },
      { start: 31.9, end: 36.0, chapter: 'asedio', text: 'Un año de asedio... y Rodas no cayó. ¿Cómo?', emphasis: false },
      { start: 36.4, end: 39.7, chapter: 'asedio', text: 'Huyó. Y dejó sus máquinas en la playa.', emphasis: true },

      { start: 40.6, end: 46.5, chapter: 'bronce', text: 'Los rodios se quedaron con todo ese hierro y bronce abandonado.', emphasis: false },
      { start: 46.9, end: 53.0, chapter: 'bronce', text: 'Lo fundieron. Con ese bronce quisieron pagar una estatua a Helios, el Sol.', emphasis: false },
      { start: 53.4, end: 57.5, chapter: 'bronce', text: 'Dicen que vendieron las máquinas por unos 300 talentos.', emphasis: true },
      { start: 57.9, end: 61.6, chapter: 'bronce', text: 'Su escultor: Cares de Lindos, discípulo de Lisipo.', emphasis: false },

      { start: 62.5, end: 68.0, chapter: 'cimientos', text: 'Antes de la estatua, un pedestal de mármol blanco junto al puerto.', emphasis: false },
      { start: 68.4, end: 74.0, chapter: 'cimientos', text: 'Unos 15 metros de piedra, hilada a hilada. ¿Quién lo cargó?', emphasis: false },
      { start: 74.4, end: 80.5, chapter: 'cimientos', text: 'Tres pisos de mármol, sin grúas. ¿Cómo se subía cada hilada?', emphasis: false },

      { start: 82.5, end: 88.0, chapter: 'armazon', text: 'Según Filón de Bizancio, dentro había columnas de piedra.', emphasis: false },
      { start: 88.4, end: 94.5, chapter: 'armazon', text: 'Y un armazón de hierro, de unas 7,8 toneladas, que sostenía el bronce.', emphasis: false },
      { start: 94.9, end: 100.5, chapter: 'armazon', text: 'Piedra y hierro por dentro. Y el bronce por fuera, placa a placa.', emphasis: false },
      { start: 100.9, end: 105.8, chapter: 'armazon', text: '¿Cómo se sujetaba una placa de bronce a 30 metros del suelo?', emphasis: true },

      { start: 106.5, end: 111.0, chapter: 'terraplen', text: 'No había andamios. Entonces, ¿cómo se levantó?', emphasis: false },
      { start: 111.4, end: 117.0, chapter: 'terraplen', text: 'Levantaron una montaña de tierra alrededor de la estatua.', emphasis: false },
      { start: 117.4, end: 124.5, chapter: 'terraplen', text: 'Fundían las placas de bronce allí mismo, de abajo arriba, mientras crecía.', emphasis: false },
      { start: 124.9, end: 129.6, chapter: 'terraplen', text: 'Unas 13 toneladas de bronce, fundidas en el sitio.', emphasis: true },

      { start: 130.5, end: 136.0, chapter: 'cabeza', text: 'Después, la cabeza. Y la corona de rayos de Helios, a 33 metros.', emphasis: false },
      { start: 136.4, end: 142.0, chapter: 'cabeza', text: 'Solo entonces retiraron la tierra. La estatua quedó al descubierto.', emphasis: false },
      { start: 142.4, end: 146.5, chapter: 'cabeza', text: '¿Quién vio la cara del dios por primera vez?', emphasis: false },
      { start: 146.9, end: 149.8, chapter: 'cabeza', text: 'Doce rayos de bronce, como los del Sol.', emphasis: false },

      { start: 150.5, end: 156.0, chapter: 'esplendor', text: 'Setenta codos de altura: la estatua más alta del mundo antiguo.', emphasis: false },
      { start: 156.4, end: 161.0, chapter: 'esplendor', text: 'Pulida, brillaba al sol, y se veía desde muy lejos.', emphasis: false },
      { start: 161.4, end: 166.0, chapter: 'esplendor', text: 'Dicen que los marineros la veían como señal de llegada.', emphasis: false },
      { start: 166.4, end: 169.8, chapter: 'esplendor', text: '¿Y cómo cayó un gigante así?', emphasis: true },

      { start: 170.5, end: 176.5, chapter: 'mito', text: 'Esta es la imagen que probablemente conoces: piernas abiertas sobre el puerto.', emphasis: false },
      { start: 176.9, end: 181.5, chapter: 'mito', text: 'Pero esa imagen es de grabados del siglo XVI.', emphasis: false },
      { start: 181.9, end: 187.5, chapter: 'mito', text: 'Con las piernas abiertas sobre 160 metros de bocana, se habría partido.', emphasis: false },
      { start: 187.9, end: 191.2, chapter: 'mito', text: 'Probablemente estaba de pie, en tierra firme.', emphasis: true },

      { start: 192.5, end: 197.5, chapter: 'numeros', text: 'Y los números. 33 metros. 12 años de obra.', emphasis: false },
      { start: 197.9, end: 203.0, chapter: 'numeros', text: '54 años en pie, hasta el terremoto del 226 a.C.', emphasis: false },
      { start: 203.4, end: 208.0, chapter: 'numeros', text: 'La Estatua de la Libertad se inspiró en él. ¿Casualidad?', emphasis: false },
      { start: 208.4, end: 211.8, chapter: 'numeros', text: 'Dicen que su corona se alinea con el sol.', emphasis: true },

      { start: 212.5, end: 217.2, chapter: 'final', text: 'Un terremoto en el 226 a.C. lo quebró por las rodillas.', emphasis: false },
      { start: 217.6, end: 222.0, chapter: 'final', text: 'Plinio: pocos podían abrazar su pulgar.', emphasis: false },
      { start: 222.4, end: 227.3, chapter: 'final', text: 'Durante 800 años nadie lo levantó. Un oráculo lo prohibió.', emphasis: false },
      { start: 227.7, end: 233.0, chapter: 'final', text: 'En 654 d.C., un mercader se llevó sus restos en 900 camellos.', emphasis: false },
      { start: 233.4, end: 236.8, chapter: 'final', text: 'Hoy no queda ni un trozo.', emphasis: false },
      { start: 237.2, end: 239.8, chapter: 'final', text: '¿Y si alguien sabe dónde está?', emphasis: true }
    ],

    facts: {
      intro: ['Piernas abiertas: mito', 'Estatua real: 33 m', 'Grabados del siglo XVI'],
      asedio: ['Helépolis: torre de 40 m', 'Demetrio Poliorcetes', '305-304 a.C.: un año'],
      bronce: ['Dios del Sol: Helios', 'Escultor: Cares de Lindos', '~300 talentos de venta'],
      cimientos: ['Mármol blanco, unos 15 m', 'Hilada a hilada', 'Junto al puerto'],
      armazon: ['Columnas de piedra dentro', '~7,8 t de hierro', 'Según Filón de Bizancio'],
      terraplen: ['Sin andamios: tierra', '~13 t de bronce', '292-280 a.C.: 12 años'],
      cabeza: ['Cabeza a 33 m', 'Corona de 12 rayos', 'Luego, se retiró la tierra'],
      esplendor: ['70 codos de altura', 'La más alta de la Antigüedad', 'Bronce pulido al sol'],
      mito: ['Bocana de unos 160 m', 'Grabados del siglo XVI', 'Probablemente de pie'],
      numeros: ['33 m, 12 años, 54 en pie', 'Estatua de la Libertad', 'Corona alineada: teoría'],
      final: ['Terremoto: 226 a.C.', '800 años en el suelo', '900 camellos, 654 d.C.']
    }
  };
})();
