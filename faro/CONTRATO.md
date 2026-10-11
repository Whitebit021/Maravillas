# Contrato de módulos — "El Faro de Alejandría: Lo que no te contaron"

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
| `js/chapters.js` | coordinador | `GIZA.DURATION`, `GIZA.CHAPTERS`, `GIZA.SITE`, `GIZA.TOWER`, `GIZA.CITADEL` |
| `js/main.js` | coordinador | renderer, cámara, línea de tiempo, `GIZA.state`, pistas `TRACKS`, planos `CAM` |
| `js/script.js` | agente guion | `GIZA.SCRIPT` |
| `js/environment.js` | agente entorno | `GIZA.createEnvironment(ctx)` |
| `js/pharos.js` | agente faro | `GIZA.createPharos(ctx)` |
| `js/interior.js` | agente interior | `GIZA.createInterior(ctx)` |
| `js/construction.js` | agente obra | `GIZA.createConstruction(ctx)` |
| `js/misterio.js` | agente misterio | `GIZA.createMystery(ctx)` |
| `js/hud.js` | agente HUD/audio | `GIZA.createHUD(ctx)` |

**Lee `js/chapters.js` y `js/main.js` antes de empezar** (son la fuente de verdad: tiempos, pistas, cámara,
coordenadas, dimensiones de la torre). La plantilla de referencia de calidad está en `../giza/js/`
(mismo nombre de archivo o equivalente: `pyramid.js` ↔ `pharos.js`, `cosmic.js` ↔ `misterio.js`).
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
| `ghost` | faro completo "fantasma": silueta translúcida cian con aristas brillantes (prólogo y plano final sobre la fortaleza) | pharos |
| `reefs` | escollos peligrosos resaltados (anillos rojos pulsantes en `SITE.reefs`, etiqueta "ESCOLLOS") | misterio |
| `boats` | barcos mercantes y de guerra navegando por el Puerto Grande y frente a la isla; pecio en `SITE.wreck` | construction |
| `barges` | barcazas de fondo plano bajando por la ruta `SITE.bargeRoute` con bloques de granito rojo de Asuán y caliza; descarga en `SITE.quay` | construction |
| `workers` | obreros (InstancedMesh, animados con `s.wall`): patio de labra `SITE.stoneYard`, muelle, podio y cima de la obra | construction |
| `cranes` | grúas de madera con rueda de pisar (polyspastos) en la cima de la obra (a la altura de `build`) y en el muelle; andamios de madera alrededor de la parte en construcción | construction |
| `foundation` | podio escalonado de bloques ensamblados (0..1 de 6 m, hilada a hilada) | pharos |
| `lead` | plomo fundido vertido entre los bloques del podio (brillo plateado-naranja, crisoles) | construction |
| `build` | altura construida = `build * TOWER.H` (111 m): cuerpo cuadrado → octógono → cilindro, de abajo arriba | pharos |
| `xray` | transparencia de la torre para ver el interior | pharos (baja opacidad) + interior (resalta en cian) |
| `ramp` | rampa interior en espiral cuadrada con burros cargados de leña subiendo + pozo central con montacargas | interior |
| `lantern` | linterna de columnas + estatua de bronce en la cima colocadas | pharos |
| `fire` | gran hoguera en la linterna (llamas animadas, chispas, humo, luz naranja) | interior |
| `mirror` | espejo de bronce pulido (cóncavo) en la linterna | interior |
| `beam` | haz de luz reflejado que barre el mar en círculo de noche | misterio |
| `burn` | MITO: rayo de sol concentrado por el espejo hacia un barco romano en `SITE.burnTarget` que se incendia (llamas, humo); flota fantasma de 5 galeras | misterio |
| `mythCross` | "¿MITO?" + aspa roja y etiqueta "Distancia: 700 m · ningún espejo de bronce lo consigue" | misterio |
| `plaster` | la dedicatoria de la cara norte (`TOWER.inscription`): con 0 se lee en el yeso "PTOLOMEO", al subir el yeso se agrieta y cae a trozos y aparece grabado en la piedra "SÓSTRATO, HIJO DE DEXÍFANES, DE CNIDO, A LOS DIOSES SALVADORES, POR LOS NAVEGANTES" | pharos |
| `measure` | regla vertical de 0 a 124 m con cotas por cuerpo + círculo en el mar "VISIBLE A 50 km" (anillo enorme o abanico) | misterio |
| `quake1`, `quake2` | sacudidas de 1303 y 1323 (polvo, olas, vibración) | environment (olas, polvo) + pharos (vibración) |
| `collapse` | 0 intacto; 0.6 linterna, cilindro y octógono caídos al mar hacia `SITE.fallDir`; 1 solo queda un muñón del cuerpo cuadrado | pharos |
| `sunken` | bloques, columnas y estatuas caídas bajo el agua junto al faro (visibles a través del agua clara) | pharos |
| `citadel` | fortaleza de Qaitbey (1477) en el mismo lugar, levantada con las piedras del faro (`GIZA.CITADEL`); el muñón desaparece cuando `citadel` > 0.5 | pharos |

**Todo debe ser función del estado, no acumulativo**: si `s.t` retrocede o salta, la escena debe verse bien.
Usa `s.wall` solo para animaciones ambientales (llamas, olas, humo, caminar). En exportación `wall = t`.

## Mundo
- 1 unidad = 1 metro. Norte = -Z (mar abierto), Sur = +Z (Alejandría), Este = +X.
- Faro centrado en el origen, base del podio en y=0, sobre un islote rocoso en el extremo este de la isla de
  Faros (`SITE.island`, tierra a y≈0..3). Mar en y = `SITE.seaLevel` (−1.5). Calzada Heptastadion hacia el sur
  hasta la ciudad (costa en z=1260). Puerto Grande al este de la calzada. Dimensiones en `GIZA.TOWER`.
- Cámara: near 0.5, far 40000. Hay planos a ~12 m de la linterna, a ~30 m de la inscripción y dentro de la
  torre (rayos X): nada debe tapar la cámara (ver `CAM` en main.js); nada invisible por la niebla a < 1500 m
  (la ciudad a 1300-2500 m debe intuirse).
- renderer: sRGB, ACES, sombras PCFSoft activadas. Solo **environment** crea las luces principales
  (sol/luna direccional con sombras + hemisférica) y el cielo/niebla. Los demás pueden añadir PointLight
  pequeñas (máx. 3 por módulo) para fuego u hornos.
- Presupuesto: `InstancedMesh`/`BufferGeometry` fusionada (mergeo manual; no hay BufferGeometryUtils).
  Todo < ~600k triángulos y < ~250 draw calls por fotograma (≈ 40 por módulo). `visible=false` si su pista es 0.

## Estilo
Documental conspiranoico tipo "History Channel de madrugada". Paleta: caliza clara (#e9dfc8), granito rojo
de Asuán (#9a4a3c), mármol blanco, fuego (#ff8a2a, #ffcf6a), azul mediterráneo (#1b5e86), cian místico para
lo "oculto" (#7fe3f0), rojo para desmentir mitos (#ff3b30). Líneas brillantes con AdditiveBlending, etiquetas
3D con `CanvasTexture` + `Sprite` en español (`bold 48px Georgia, serif` o monoespaciada para datos).
Evita la sobreexposición: emisivos/aditivos no deben quemar a blanco la imagen con ACES.

## Calidad exigida
- El faro es el protagonista: tres cuerpos claramente distintos (cuadrado con ventanas y cornisas, octógono,
  cilindro), terrazas con almenas y tritones en las esquinas, linterna con columnas y estatua en la cima.
- Cada capítulo debe mostrar visualmente el paso que narra (ver pistas). Revisa en qué tiempos la cámara
  mira tu parte (`CAM`) y asegúrate de que en esos planos se vea bien y con detalle.
