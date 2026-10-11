# Contrato de módulos — "Los Jardines Colgantes de Babilonia: Lo que no te contaron"

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
| `js/chapters.js` | coordinador | `GIZA.DURATION`, `GIZA.CHAPTERS`, `GIZA.SITE`, `GIZA.GARDENS` |
| `js/main.js` | coordinador | renderer, cámara, línea de tiempo, `GIZA.state`, pistas `TRACKS`, planos `CAM` |
| `js/script.js` | agente guion | `GIZA.SCRIPT` |
| `js/environment.js` | agente entorno | `GIZA.createEnvironment(ctx)` |
| `js/gardens.js` | agente jardines | `GIZA.createGardens(ctx)` |
| `js/interior.js` | agente interior | `GIZA.createInterior(ctx)` |
| `js/construction.js` | agente obra | `GIZA.createConstruction(ctx)` |
| `js/misterio.js` | agente misterio | `GIZA.createMystery(ctx)` |
| `js/hud.js` | agente HUD/audio | `GIZA.createHUD(ctx)` |

**Lee `js/chapters.js` y `js/main.js` antes de empezar** (son la fuente de verdad: tiempos, pistas, cámara,
coordenadas, dimensiones de las terrazas). La plantilla de referencia de calidad está en `../giza/js/`
(mismo nombre de archivo o equivalente: `pyramid.js` ↔ `gardens.js`, `cosmic.js` ↔ `misterio.js`).
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
| `timeOfDay` | puede pasar de 1; usar `fract`: 0 medianoche, .25 amanecer, .5 mediodía, .75 atardecer | environment (sol, luna, cielo, río, niebla, luces de la ciudad de noche) |
| `ghost` | jardines completos "fantasma" (terrazas y árboles translúcidos verde-dorado con aristas brillantes) | gardens |
| `boats` | barcas de juncos y guffas redondas en el Éufrates cargadas de ladrillos y betún | construction |
| `workers` | obreros (InstancedMesh, animados con `s.wall`) | construction |
| `kilns` | ladrillar en `SITE.brickyard`: hornos abovedados con fuego, moldes, filas de ladrillos secándose, ladrillos con el sello del rey | construction |
| `bitumen` | calderos de betún negro humeante en `SITE.bitumen` | construction |
| `vaults` | bóvedas de cañón de ladrillo de la terraza inferior apareciendo (0..1), arcadas en la fachada | gardens |
| `waterproof` | capas impermeables sobre las bóvedas (`GARDENS.waterproof`) en sección con etiquetas | interior |
| `xray` | terrazas translúcidas para ver bóvedas, capas, pozo y noria | gardens (baja opacidad) + interior (resalta en cian) |
| `terraces` | altura construida = `terraces * 25` m: cinco terrazas escalonadas (`GARDENS.tiers`) con arcadas de bóvedas en cada fachada, parapetos, escaleras monumentales en la cara sur | gardens |
| `cranes` | rampas de adobe, andamios y escaleras de mano junto a la parte en construcción | construction |
| `pump` | noria de cangilones (cadena sin fin con cubos) en el pozo `GARDENS.pumpShaft`, movida por bueyes en una rueda a pie del pozo; canal desde el río (`SITE.canal`) | interior |
| `water` | el agua sube: cangilones llenos que suben, cisterna superior (`GARDENS.cistern`) llenándose, canales de riego en cada terraza | interior |
| `screw` | tornillos de Arquímedes de bronce inclinados en la cara norte (`GARDENS.screws`), girando (teoría de Senaquerib) | interior |
| `soil` | tierra fértil cubriendo las terrazas | gardens |
| `plants` | vegetación creciendo (0..1): palmeras datileras, cipreses, granados, sauces, enredaderas colgando por las fachadas, flores (InstancedMesh) | gardens |
| `cascades` | cascadas de agua cayendo de terraza en terraza en `GARDENS.cascades` (shader animado con `s.wall`, espuma) | gardens |
| `amytis` | figura fantasma de la reina Amitis (~10 m) en la terraza superior mirando al norte, hacia montañas lejanas (silueta de Media) | misterio |
| `herodotus` | holograma de un pergamino abierto en `SITE.herodotus` con texto griego y un hueco brillante: "Heródoto: ni una palabra" | misterio |
| `map` | gran mapa holográfico en el suelo (`SITE.map`): Éufrates y Tigris, puntos BABILONIA y NÍNIVE, línea discontinua "450 km" y jardines fantasma en miniatura en Nínive, etiqueta "SENAQUERIB" | misterio |
| `measure` | cotas: 120 m de lado, 25 m de alto, "5 TERRAZAS", caudal "≈ 8.000 litros/hora" | misterio |
| `decay` | ruina: plantas secas y caídas, terrazas derrumbadas en montículos de ladrillo, bóvedas rotas | gardens |
| `riverShift` | el Éufrates se desplaza hacia el oeste y deja un cauce seco | environment |
| `dig` | excavación de Koldewey en `SITE.excavation`: zanjas, tiendas, arqueólogos con salacot, carretillas | construction |
| `today` | hoy: montículos de ladrillo, palmeras dispersas, un muro reconstruido | environment |

**Todo debe ser función del estado, no acumulativo**: si `s.t` retrocede o salta, la escena debe verse bien.
Usa `s.wall` solo para animaciones ambientales (agua, hojas, humo, caminar). En exportación `wall = t`.

## Mundo
- 1 unidad = 1 metro. Norte = -Z, Sur = +Z, Este = +X. Llanura plana mesopotámica en y=0.
- Jardines centrados en el origen: 5 terrazas (`GARDENS.tiers`), semilado 60 m en la base, 25 m de altura;
  `GARDENS.halfAt(y)`. Éufrates al oeste (x≈−190, ancho 150, agua en y=−1). Palacio al este, puerta de Ishtar al
  NE, zigurat Etemenanki al SE, murallas dobles en radio 900, ciudad de casas de adobe entre medias.
- Cámara: near 0.5, far 40000. Hay planos a ~10 m de las bóvedas, junto al pozo de la noria (cara oeste),
  entre los árboles de la cima y muy altos sobre el mapa: nada debe tapar la cámara (ver `CAM` en main.js).
- renderer: sRGB, ACES, sombras PCFSoft activadas. Solo **environment** crea las luces principales
  (sol/luna direccional con sombras + hemisférica) y el cielo/niebla. Los demás pueden añadir PointLight
  pequeñas (máx. 3 por módulo).
- Presupuesto: `InstancedMesh`/`BufferGeometry` fusionada (mergeo manual; no hay BufferGeometryUtils).
  Todo < ~600k triángulos y < ~250 draw calls por fotograma (≈ 40 por módulo). `visible=false` si su pista es 0.
  La vegetación DEBE ser InstancedMesh (troncos, copas, hojas de palmera) con pocos tipos.

## Estilo
Documental conspiranoico tipo "History Channel de madrugada". Paleta: ladrillo cocido (#b8794a), adobe
(#c9a477), betún (#1d1814), verde jardín (#3f7a32, #6aa84f), agua (#4fa3b8), azul de Ishtar (#1f4fa0), oro
(#e0b257), cian místico (#7fe3f0), rojo para dudas (#ff3b30). Líneas brillantes con AdditiveBlending, etiquetas
3D con `CanvasTexture` + `Sprite` en español (`bold 48px Georgia, serif` o monoespaciada).
Evita la sobreexposición: emisivos/aditivos no deben quemar a blanco la imagen con ACES.

## Calidad exigida
- Los jardines son los protagonistas: una montaña verde escalonada de ladrillo con arcadas, desbordante de
  palmeras y enredaderas colgando, cascadas, sobre una llanura desértica. Debe verse exuberante.
- Cada capítulo debe mostrar visualmente el paso que narra (ver pistas). Revisa en qué tiempos la cámara
  mira tu parte (`CAM`) y asegúrate de que en esos planos se vea bien y con detalle.
