# Contrato de módulos — "El Mausoleo de Halicarnaso: Lo que no te contaron"

Video 3D procedural en Three.js **r149** (global `window.THREE`, script clásico, SIN ES modules, SIN addons
como OrbitControls/GLTFLoader). **Solo código**: prohibido cargar imágenes, texturas, modelos, audio, fuentes
o video externos. Todo se genera con geometría, shaders, `CanvasTexture` dibujadas por código y WebAudio.
Toda `CanvasTexture` lleva `tex.encoding = THREE.sRGBEncoding`.

Debe funcionar abriendo `index.html` con doble clic (file://), por eso todo son scripts clásicos.
El espacio de nombres global se llama `window.GIZA` (heredado de la plantilla `giza/`, NO cambiarlo).

Tono: documental CONSPIRANOICO de entretenimiento ("lo que no te contaron"), en español. Las teorías
alternativas se presentan como "dicen", "según la teoría"; nunca como hechos.

## Archivos
| Archivo | Autor | Exporta |
|---|---|---|
| `js/chapters.js` | coordinador | `GIZA.DURATION`, `GIZA.CHAPTERS`, `GIZA.SITE`, `GIZA.MAUS`, `GIZA.CASTLE` |
| `js/main.js` | coordinador | renderer, cámara, línea de tiempo, `GIZA.state`, pistas `TRACKS`, planos `CAM` |
| `js/script.js` | agente guion | `GIZA.SCRIPT` |
| `js/environment.js` | agente entorno | `GIZA.createEnvironment(ctx)` |
| `js/mausoleum.js` | agente mausoleo | `GIZA.createMausoleum(ctx)` |
| `js/interior.js` | agente interior | `GIZA.createInterior(ctx)` |
| `js/construction.js` | agente obra | `GIZA.createConstruction(ctx)` |
| `js/misterio.js` | agente misterio | `GIZA.createMystery(ctx)` |
| `js/hud.js` | agente HUD/audio | `GIZA.createHUD(ctx)` |

**Lee `js/chapters.js` y `js/main.js` antes de empezar** (son la fuente de verdad: tiempos, pistas, cámara,
coordenadas, dimensiones del mausoleo). La plantilla de referencia de calidad está en `../giza/js/`
(mismo nombre de archivo o equivalente: `pyramid.js` ↔ `mausoleum.js`, `cosmic.js` ↔ `misterio.js`).
Lee el módulo equivalente de giza para copiar su nivel de detalle y sus técnicas.

## Plantilla obligatoria de cada módulo
```js
(function () {
  'use strict';
  const G = window.GIZA;
  G.createXxx = function (ctx) {
    const THREE = ctx.THREE, scene = ctx.scene;
    const root = new THREE.Group(); scene.add(root);
    // ... construir todo aquí, una sola vez (nada de crear geometrías ni materiales por frame) ...
    return {
      update: function (s) { /* s = estado del frame, ver abajo */ }
    };
  };
})();
```
`ctx = { THREE, scene, camera, renderer, timeline, state }`.
`timeline = { t, duration, play(), pause(), toggle(), seek(t), isPlaying(), on(fn(ev,t)) }` (eventos: play, pause, seek, end).
main.js aísla los errores por módulo: si tu `update` lanza una excepción, tu módulo deja de actualizarse. No lo provoques.

## Estado por frame `s` (lo calcula main.js; valores 0..1 salvo indicación)
Genéricos: `t` tiempo del video (s), `dt`, `wall` reloj (s, siempre avanza; en exportación = t), `realDt`,
`chapter` (id), `chapterIndex`, `chapterProgress`, `duration`, `playing`.

| Pista | Significado | Dueño (quien la dibuja) |
|---|---|---|
| `timeOfDay` | puede pasar de 1; usar `fract`: 0 medianoche, .25 amanecer, .5 mediodía, .75 atardecer | environment (sol, luna, cielo, mar, niebla, luces de la ciudad de noche) |
| `ghost` | mausoleo completo "fantasma": silueta translúcida dorada/cian con aristas brillantes (prólogo) | mausoleum |
| `survey` | nivelación de la terraza: estacas, cuerdas tensas, rejilla luminosa y cotas | misterio |
| `pyre` | pira funeraria de Mausolo ardiendo en la terraza (troncos, llamas, humo, chispas) | construction |
| `ashes` | figura fantasma dorada de la reina Artemisia II (~12 m, túnica, diadema) sosteniendo una copa de la que salen partículas de ceniza brillante en espiral; etiqueta "ARTEMISIA II" | misterio |
| `excavation` | fosa abierta en la roca bajo la planta del podio (paredes de roca, rampa de tierra); se oculta cuando el podio la cubre | interior |
| `chamber` | cámara funeraria, escalera desde el oeste y gran bloque de sellado (`MAUS.chamber`) | interior |
| `sacrifice` | ofrendas en la escalera: huesos de bueyes y corderos, vasijas, huevos (lo que halló Newton) | interior |
| `xray` | transparencia del suelo/podio para ver la cámara bajo tierra | mausoleum (baja opacidad del podio) + interior (resalta en cian) |
| `treasure` | tesoro (sarcófago dorado, joyas, armas) en la cámara: con la pista subiendo brilla, al bajar se desvanece "en una noche" | interior |
| `boats` | barcos con mármol por `SITE.marbleRoute` y descarga en `SITE.quay`; barcos en el puerto | construction |
| `workers` | obreros (InstancedMesh, animados con `s.wall`) en la terraza, el podio, la obra | construction |
| `cranes` | grúas de madera con polipasto y andamios alrededor de la parte en construcción | construction |
| `podium` | podio subiendo hilada a hilada (0..1 de 19 m): núcleo de piedra volcánica verdosa y chapado de mármol blanco | mausoleum |
| `columns` | las 36 columnas jónicas (11 por lado largo, 9 por lado corto) y el muro de la cella subiendo | mausoleum |
| `entablature` | arquitrabe, friso y cornisa con dentículos | mausoleum |
| `friezes` | frisos en relieve (amazonomaquia en el podio, carreras de carros arriba) y estatuas entre columnas y leones en la cornisa, apareciendo lado a lado | mausoleum |
| `paint` | policromía: fondos azules, ropajes rojos, detalles dorados en frisos y estatuas | mausoleum |
| `sculptors` | etiquetas 3D con el escultor de cada lado (`MAUS.sides`) | misterio |
| `pyramid` | 24 escalones de la pirámide apareciendo uno a uno (0..1) | mausoleum |
| `quadriga` | pedestal + cuadriga de mármol (4 caballos, carro, Mausolo y Artemisia) en la cima | mausoleum |
| `measure` | cotas y números: regla de 45 m, "24 ESCALONES", "36 COLUMNAS", proporciones (líneas aditivas) | misterio |
| `quake` | terremoto (siglos XII-XV): polvo, sacudida | environment (polvo) + mausoleum (vibración) |
| `ruin` | 0 intacto → 1 en ruinas: cuadriga y pirámide caídas, columnas derribadas, bloques por el suelo | mausoleum |
| `dismantle` | 0..1: las piedras desaparecen de las ruinas (se las llevan); al final solo quedan cimientos y un hueco | mausoleum |
| `castle` | castillo de San Pedro (Caballeros de San Juan) creciendo en `SITE.castle` + carros y barcas llevando bloques verdes y blancos | construction |
| `today` | hoy: recinto arqueológico (vallas, pasarela de madera, columnas sueltas tumbadas, letrero) | environment |

**Todo debe ser función del estado, no acumulativo**: si `s.t` retrocede o salta, la escena debe verse bien.
Usa `s.wall` solo para animaciones ambientales (llamas, olas, humo, caminar). En exportación `wall = t`.

## Mundo
- 1 unidad = 1 metro. Norte = -Z (colinas, teatro), Sur = +Z (puerto), Este = +X.
- Mausoleo centrado en el origen, base del podio en y=0 sobre una terraza nivelada dentro del recinto
  (`SITE.peribolos`). Mar en y = `SITE.seaLevel` (−1.5) para z > 230 (bahía). Ciudad en anfiteatro alrededor
  de la bahía, sobre colinas que suben hacia el norte. Dimensiones en `GIZA.MAUS` (usa `MAUS.stepAt(k)`).
- Cámara: near 0.5, far 40000. Hay planos a ~12 m de la cuadriga, a ~25 m de los frisos y mirando a la cámara
  subterránea (y≈−4) desde fuera: nada debe tapar la cámara (ver `CAM` en main.js).
- renderer: sRGB, ACES, sombras PCFSoft activadas. Solo **environment** crea las luces principales
  (sol/luna direccional con sombras + hemisférica) y el cielo/niebla. Los demás pueden añadir PointLight
  pequeñas (máx. 3 por módulo).
- El terreno de environment debe tener un HUECO o ser transparente en la zona de la fosa
  (|x| < 30, |z| < 18) mientras `excavation` > 0 o `xray` > 0, para que se vea la cámara subterránea:
  environment deja una abertura rectangular fija en el suelo (x −30..20, z −18..18) que interior tapa con su
  propia fosa/tapa; el podio la cubre cuando está construido.
- Presupuesto: `InstancedMesh`/`BufferGeometry` fusionada (mergeo manual; no hay BufferGeometryUtils).
  Todo < ~600k triángulos y < ~250 draw calls por fotograma (≈ 40 por módulo). `visible=false` si su pista es 0.

## Estilo
Documental conspiranoico tipo "History Channel de madrugada". Paleta: mármol blanco (#efe9dd), piedra
volcánica verdosa (#6f7a5e), policromía (azul #2a4d8f, rojo #a8322a, oro #e0b257), mar Egeo (#1f5f8b), cian
místico (#7fe3f0), púrpura funerario (#7a3e8e) para lo de la reina. Líneas brillantes con AdditiveBlending,
etiquetas 3D con `CanvasTexture` + `Sprite` en español (`bold 48px Georgia, serif` o monoespaciada).
Evita la sobreexposición: emisivos/aditivos no deben quemar a blanco la imagen con ACES.

## Calidad exigida
- El mausoleo es el protagonista: podio alto, peristilo de 36 columnas jónicas con capiteles de volutas,
  entablamento con dentículos, pirámide de 24 escalones y cuadriga reconocible (caballos con patas y cabeza).
- Cada capítulo debe mostrar visualmente el paso que narra (ver pistas). Revisa en qué tiempos la cámara
  mira tu parte (`CAM`) y asegúrate de que en esos planos se vea bien y con detalle.
