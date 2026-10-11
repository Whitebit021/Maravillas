# Contrato de módulos — "El Coloso de Rodas: Lo que no te contaron"

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
| `js/chapters.js` | coordinador | `GIZA.DURATION`, `GIZA.CHAPTERS`, `GIZA.SITE`, `GIZA.PEDESTAL`, `GIZA.COL` |
| `js/main.js` | coordinador | renderer, cámara, línea de tiempo, `GIZA.state`, pistas `TRACKS`, planos `CAM` |
| `js/script.js` | agente guion | `GIZA.SCRIPT` |
| `js/environment.js` | agente entorno | `GIZA.createEnvironment(ctx)` |
| `js/colossus.js` | agente coloso | `GIZA.createColossus(ctx)` |
| `js/interior.js` | agente interior | `GIZA.createInterior(ctx)` |
| `js/construction.js` | agente obra | `GIZA.createConstruction(ctx)` |
| `js/misterio.js` | agente misterio | `GIZA.createMystery(ctx)` |
| `js/hud.js` | agente HUD/audio | `GIZA.createHUD(ctx)` |

**Lee `js/chapters.js` y `js/main.js` antes de empezar** (son la fuente de verdad: tiempos, pistas, cámara,
coordenadas, proporciones de la estatua). La plantilla de referencia de calidad está en `../giza/js/`
(mismo nombre de archivo o equivalente: `pyramid.js` ↔ `colossus.js`, `cosmic.js` ↔ `misterio.js`).
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
| `timeOfDay` | puede pasar de 1; usar `fract`: 0 medianoche, .25 amanecer, .5 mediodía, .75 atardecer | environment (sol, cielo, mar, luces, niebla, luces de la ciudad de noche) |
| `siege` | torre de asedio Helépolis (40 m, ruedas, chapada de hierro) abandonada junto a la muralla este + flota de Demetrio en el mar | construction |
| `weapons` | montón de armas y máquinas abandonadas (catapultas rotas, lanzas, escudos, placas) en `SITE.weapons`; al bajar la pista se van "fundiendo" (se hunden y se tiñen de naranja) | construction |
| `foundry` | hornos de fundición en `SITE.furnaces` (brillo naranja, humo, crisoles, lingotes) | construction |
| `boats` | barcos mercantes/de carga en el puerto (mármol, lingotes) | construction |
| `workers` | obreros (InstancedMesh, animados con `s.wall`) en el suelo, pedestal y terraplén | construction |
| `pedestal` | pedestal de mármol blanco subiendo hilada a hilada (0..1 de 15 m), según `PEDESTAL.tiers` | colossus |
| `columns` | columnas de piedra internas (`COL.columns`), altura = `columns * 33` m | interior |
| `frame` | armazón de hierro (barras verticales + aros horizontales + tirantes que siguen la silueta), altura = `frame * 33` m | interior |
| `build` | piel de placas de bronce de la estatua, hasta la altura local `build * 33` m (corte por plano con `clippingPlanes` o por placas instanciadas) | colossus |
| `mound` | terraplén de tierra cónico con rampa en espiral que rodea el pedestal y la estatua; su cima queda en y = 15 + mound*33 − 1; radio en la base ~ 25 + 55*mound | construction |
| `pour` | vertido de bronce fundido in situ en lo alto del terraplén (crisoles, chorro brillante, chispas) a la altura de `build` | construction |
| `xray` | transparencia de la piel de bronce para ver el interior | colossus (baja opacidad de la piel) + interior (resalta en cian el armazón) |
| `crown` | 12 rayos dorados de la corona solar apareciendo uno a uno | colossus |
| `shine` | bronce recién pulido: reflejos dorados intensos, destello especular al sol | colossus |
| `myth` | estatua fantasma GIGANTE con las piernas abiertas sobre la bocana (un pie en cada espigón, `SITE.harborMouth`), barcos pasando por debajo; dorada translúcida con borde brillante | misterio |
| `mythCross` | gran aspa roja + etiqueta "MITO" sobre el fantasma | misterio |
| `realSpot` | marcador cian pulsante + línea que une la bocana con el pedestal real (0,0,0) + etiqueta "AQUÍ ESTABA (probablemente)" | misterio |
| `measure` | regla vertical de 0 a 48 m con cotas (pedestal 15 m, estatua 33 m, 70 codos) | misterio |
| `compare` | silueta de comparación de 46 m (estatua moderna genérica con antorcha, 'el Nuevo Coloso') a su lado, en cian | misterio |
| `sunLines` | líneas solares "de Helios": rayos desde la corona hacia el horizonte y círculo de alineación (teoría) | misterio |
| `quake` | temblor del terremoto (226 a.C.): sacudida de objetos, polvo, olas | environment (olas/polvo), colossus (vibración) |
| `fall` | 0 en pie → 1 caída: la estatua se quiebra por las rodillas y cae hacia `SITE.fallDir` (+X) | colossus |
| `ruins` | restos en el suelo junto al pedestal (las piezas caídas; con `ruins`→0 desaparecen) | colossus |
| `camels` | caravana de camellos cargados de bronce por `SITE.caravan` (654 d.C.) | construction |
| `today` | el puerto hoy: dos columnas con ciervos de bronce en la bocana (`SITE.deerColumns`) | environment |

**Todo debe ser función del estado, no acumulativo**: si `s.t` retrocede o salta, la escena debe verse bien.
Usa `s.wall` solo para animaciones ambientales (brillos, olas, humo, caminar). En exportación `wall = t`.

## Mundo
- 1 unidad = 1 metro. Norte = -Z (mar Egeo y puerto), Sur = +Z (ciudad), Este = +X (otra costa a x≈520).
- Pedestal centrado en el origen, base en y=0, 15 m. La estatua: local y=0 en la cara superior (mundo y=15),
  33 m, mira hacia -Z. Proporciones y articulaciones en `GIZA.COL.joints`/`radii`/`torso`/`drape`.
- Tierra firme en y=0 para z > `SITE.coastZ` (−60) y x < `SITE.eastCoastX` (520), costa irregular.
  Mar en y = `SITE.seaLevel` (−1.5). Espigones del puerto (`moleWest`, `moleEast`) con bocana en z=−260.
- Ciudad de Rodas al sur (casas cúbicas encaladas y de piedra, tejados, templos dóricos, acrópolis al SO),
  muralla este en x=330. Islas/costa de Asia Menor en el horizonte norte (siluetas bajas).
- Cámara: near 0.5, far 40000. Hay planos muy cerca de la estatua (a 10–20 m de la cabeza) y planos dentro
  del armazón: nada debe tapar la cámara (ver `CAM` en main.js) y nada debe quedar invisible por la niebla
  a menos de 1500 m.
- renderer: sRGB, ACES, sombras PCFSoft activadas. Solo **environment** crea las luces principales
  (sol direccional con sombras + hemisférica) y el cielo/niebla. Los demás pueden añadir PointLight pequeñas
  (máx. 3 en total por módulo) para el brillo de hornos o vertidos.
- Presupuesto: usar `InstancedMesh`/`BufferGeometry` fusionada (mergeo manual de atributos; no hay
  BufferGeometryUtils). Todo el proyecto < ~600k triángulos y < ~250 draw calls en cualquier fotograma
  (≈ 40 draw calls por módulo). Oculta (`visible=false`) lo que tenga su pista a 0.

## Estilo
Documental conspiranoico tipo "History Channel de madrugada". Paleta: bronce cálido (#b07a3c, #d9a35a),
oro solar de Helios (#ffcf6a), mármol blanco (#ece6da), azul Egeo (#1f5f8b), cian místico para lo "oculto"
(#7fe3f0), rojo para desmentir mitos (#ff3b30). Líneas brillantes con AdditiveBlending, etiquetas 3D con
`CanvasTexture` + `Sprite` en español (`bold 48px Georgia, serif` o monoespaciada para datos).
Evita la sobreexposición: los materiales emisivos/aditivos no deben quemar a blanco la imagen con ACES.

## Calidad exigida
- La estatua es la protagonista: debe leerse claramente como un hombre de bronce (Helios) de pie, con
  musculatura sugerida, manto, mano en visera y corona de rayos. Nada de "muñeco de cápsulas" sin forma.
- Cada capítulo debe mostrar visualmente el paso que narra (ver pistas). Revisa en qué tiempos la cámara
  mira tu parte (`CAM`) y asegúrate de que en esos planos se vea bien y con detalle.
