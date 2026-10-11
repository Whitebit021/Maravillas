# Contrato de módulos — "La Estatua de Zeus en Olimpia: Lo que no te contaron"

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
| `js/chapters.js` | coordinador | `GIZA.DURATION`, `GIZA.CHAPTERS`, `GIZA.SITE`, `GIZA.TEMPLE`, `GIZA.ZEUS` |
| `js/main.js` | coordinador | renderer, cámara, línea de tiempo, `GIZA.state`, pistas `TRACKS`, planos `CAM` |
| `js/script.js` | agente guion | `GIZA.SCRIPT` |
| `js/environment.js` | agente entorno | `GIZA.createEnvironment(ctx)` |
| `js/statue.js` | agente estatua | `GIZA.createStatue(ctx)` |
| `js/interior.js` | agente interior | `GIZA.createInterior(ctx)` |
| `js/construction.js` | agente obra | `GIZA.createConstruction(ctx)` |
| `js/misterio.js` | agente misterio | `GIZA.createMystery(ctx)` |
| `js/hud.js` | agente HUD/audio | `GIZA.createHUD(ctx)` |

**Lee `js/chapters.js` y `js/main.js` antes de empezar** (son la fuente de verdad: tiempos, pistas, cámara,
coordenadas, dimensiones del templo y de la estatua). La plantilla de referencia de calidad está en `../giza/js/`
(mismo nombre de archivo o equivalente: `pyramid.js` ↔ `statue.js`, `cosmic.js` ↔ `misterio.js`).
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
| `timeOfDay` | puede pasar de 1; usar `fract`: 0 medianoche, .25 amanecer, .5 mediodía, .75 atardecer | environment |
| `temple` | EXTERIOR del Templo de Zeus (`GIZA.TEMPLE`): crepidoma, 6 x 13 columnas dóricas, entablamento con triglifos y metopas, frontones con esculturas, tejado de tejas de mármol, acróteras doradas. Se construye por fases (0..1: plataforma → columnas → entablamento → tejado) | environment |
| `cutaway` | tejado y muro sur del templo translúcidos (opacidad ~0.15, sin escribir profundidad) para ver la estatua desde fuera | environment |
| `games` | atletas corriendo en el estadio y público en los taludes | construction |
| `workers` | obreros y artesanos (InstancedMesh, animados con `s.wall`) | construction |
| `workshop` | taller de Fidias (`SITE.workshop`): edificio con el muro norte abierto, mesas, colmillos de marfil en remojo, láminas de oro, moldes de arcilla, hornos pequeños, artesanos | construction |
| `cup` | holograma ampliado de la taza de Fidias en `SITE.cupSpot` (la taza real pequeña sobre la mesa + copia grande flotante) con la inscripción "ΦΕΙΔΙΟ ΕΙΜΙ · Pertenezco a Fidias" | misterio |
| `core` | núcleo de madera de la estatua y del trono subiendo (0..1): vigas, travesaños, armadura de la figura sentada según `ZEUS.joints` | interior |
| `scaffold` | andamios de madera dentro de la cella alrededor de la estatua | construction |
| `xray` | piel de la estatua translúcida para ver el núcleo | statue (baja opacidad) + interior (núcleo resaltado en cian) |
| `ivory` | placas de marfil (rostro, torso, brazos, pies) cubriendo el núcleo de abajo arriba (0..1) | statue |
| `gold` | láminas de oro: manto con pliegues (decorado con lirios y animales), sandalias, pelo y barba, corona de olivo | statue |
| `throne` | trono decorado: ébano, oro, marfil, gemas, esfinges en los brazos, Victorias en las patas | statue |
| `attributes` | Nike (Victoria alada de 1,6 m) sobre la mano derecha y cetro con águila en la izquierda | statue |
| `shine` | brillo del oro y del marfil a la luz de las lámparas | statue |
| `standup` | FANTASMA cian de Zeus de pie (≈17 m) atravesando el techo del templo (Estrabón: "si se levantara, rompería el techo") | misterio |
| `pilgrims` | peregrinos y lámparas de aceite encendidas en la cella y frente al templo | construction |
| `oil` | estanque de aceite delante de la estatua (`ZEUS.pool`): piso de piedra negra, borde de mármol, aceite dorado que refleja la estatua | interior |
| `caligula` | leyenda: andamio fantasma de los romanos de Calígula que se derrumba + ondas de "risa" (anillos dorados) desde la estatua y etiqueta "LA ESTATUA SE RIÓ (Suetonio)" | misterio |
| `measure` | cotas: 12 m de altura, 6,5 m de basa, techo a 13 m, "40 veces tamaño humano" | misterio |
| `fire` | incendio de 475 d.C.: llamas y humo envolviendo la estatua; etiqueta "CONSTANTINOPLA · 475 d.C." | statue (llamas en la estatua) + misterio (etiqueta y línea hacia `SITE.constantinople`) |
| `burn` | la estatua se consume: el oro se funde y gotea, el marfil se ennegrece, todo desaparece al llegar a 1 | statue |
| `quake` | terremoto (siglo VI): polvo y sacudida | environment |
| `ruin` | el templo se derrumba: columnas caídas en hilera de tambores (como hoy), muros caídos | environment |
| `silt` | el limo del río cubre las ruinas (terreno que sube unos metros) | environment |
| `today` | hoy: ruinas excavadas, una columna re-erigida, árboles, pasarelas | environment |

**Todo debe ser función del estado, no acumulativo**: si `s.t` retrocede o salta, la escena debe verse bien.
Usa `s.wall` solo para animaciones ambientales (llamas, lámparas, caminar). En exportación `wall = t`.

## Mundo
- 1 unidad = 1 metro. Norte = -Z (colina de Cronos), Sur = +Z (río Alfeo), Este = +X (estadio).
- Templo de Zeus centrado en el origen, mira al este (+X); suelo en y=0, estilóbato en y=1.5. Dentro de la cella,
  la estatua sentada (origen local en mundo (-14, 2.5, 0), mira a +X): usa `GIZA.ZEUS.toWorld()`.
- MUCHOS PLANOS SON DENTRO DE LA CELLA (cámara entre x=-10 y x=10, y=3..14): el interior debe estar bien
  iluminado y nada (andamios, columnas, etiquetas) debe tapar la cámara. El tejado del templo NO proyecta
  sombras (`castShadow = false`) para que el interior no quede negro; interior añade la luz cálida de lámparas.
- renderer: sRGB, ACES, sombras PCFSoft activadas. Solo **environment** crea las luces principales
  (sol direccional con sombras + hemisférica) y el cielo/niebla. Los demás pueden añadir PointLight
  pequeñas (máx. 3 por módulo).
- Presupuesto: `InstancedMesh`/`BufferGeometry` fusionada (mergeo manual; no hay BufferGeometryUtils).
  Todo < ~600k triángulos y < ~250 draw calls por fotograma (≈ 40 por módulo). `visible=false` si su pista es 0.

## Estilo
Documental conspiranoico tipo "History Channel de madrugada". Paleta: marfil (#f2e6cf), oro (#d4a63c,
#ffcf6a), ébano (#2a1d14), piedra caliza estucada (#e7dcc4), piedra negra de Eleusis (#1b1b1e), verde olivo
(#6b7a3a), cian místico (#7fe3f0), rojo para mitos (#ff3b30). Líneas brillantes con AdditiveBlending,
etiquetas 3D con `CanvasTexture` + `Sprite` en español (`bold 48px Georgia, serif` o monoespaciada).
Evita la sobreexposición: el oro brillante no debe quemar a blanco la imagen con ACES.

## Calidad exigida
- La estatua es la protagonista: un dios barbudo sentado en un trono enorme, majestuoso, con rostro de marfil,
  barba y pelo dorados, manto dorado con pliegues, Nike en la mano y cetro con águila. Nada de cápsulas sin forma.
- Cada capítulo debe mostrar visualmente el paso que narra (ver pistas). Revisa en qué tiempos la cámara
  mira tu parte (`CAM`) y asegúrate de que en esos planos se vea bien y con detalle.
