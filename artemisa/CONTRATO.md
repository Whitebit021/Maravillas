# Contrato de módulos — "El Templo de Artemisa en Éfeso: Lo que no te contaron"

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
| `js/chapters.js` | coordinador | `GIZA.DURATION`, `GIZA.CHAPTERS`, `GIZA.SITE`, `GIZA.TEMPLE` (con `TEMPLE.columns`: las 127 columnas) |
| `js/main.js` | coordinador | renderer, cámara, línea de tiempo, `GIZA.state`, pistas `TRACKS`, planos `CAM` |
| `js/script.js` | agente guion | `GIZA.SCRIPT` |
| `js/environment.js` | agente entorno | `GIZA.createEnvironment(ctx)` |
| `js/temple.js` | agente templo | `GIZA.createTemple(ctx)` |
| `js/interior.js` | agente interior | `GIZA.createInterior(ctx)` |
| `js/construction.js` | agente obra | `GIZA.createConstruction(ctx)` |
| `js/misterio.js` | agente misterio | `GIZA.createMystery(ctx)` |
| `js/hud.js` | agente HUD/audio | `GIZA.createHUD(ctx)` |

**Lee `js/chapters.js` y `js/main.js` antes de empezar** (son la fuente de verdad: tiempos, pistas, cámara,
coordenadas, dimensiones del templo). La plantilla de referencia de calidad está en `../giza/js/`
(mismo nombre de archivo o equivalente: `pyramid.js` ↔ `temple.js`, `cosmic.js` ↔ `misterio.js`).
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
| `timeOfDay` | puede pasar de 1; usar `fract`: 0 medianoche, .25 amanecer, .5 mediodía, .75 atardecer | environment (sol, luna, cielo, marisma, niebla, luces de la ciudad de noche) |
| `ghost` | templo completo "fantasma" translúcido dorado con llamas fantasma en el tejado (prólogo) | temple |
| `quakeDemo` | temblor de demostración: ondas concéntricas en el agua de la marisma, juncos agitándose | environment |
| `pit` | excavación del cimiento: fosa rectangular (x ±62, z ±32, 6 m de profundidad) con paredes de barro, agua filtrándose y bombeo con cubos | interior |
| `layers` | capas del cimiento (`TEMPLE.layers`) rellenándose de abajo arriba (0..1); con `xray` se ve en sección la cara norte, con etiquetas por capa | interior |
| `xray` | corte en sección del cimiento (cara norte abierta, capas con brillo de borde cian y etiquetas) | interior |
| `platform` | gradas (10) y estilóbato de mármol subiendo (0..1) | temple |
| `quarry` | cantera de mármol en `SITE.quarry`: cortes escalonados en la ladera, bloques y tambores | construction |
| `oxen` | "ruedas de Quersifrón": tambores de columna con ejes de hierro en un bastidor de madera, rodando como rodillos tirados por yuntas de bueyes por `SITE.route` (6 equipos repartidos a lo largo de la ruta, posición = función de `s.t`) | construction |
| `workers` | obreros (InstancedMesh, animados con `s.wall`) | construction |
| `cranes` | grúas de madera y andamios en el templo | construction |
| `columns` | 127 columnas jónicas (`TEMPLE.columns`): basa, fuste estriado, capitel de volutas; suben tambor a tambor (de oeste a este) | temple |
| `caelatae` | 36 columnas con el tambor inferior esculpido con figuras en relieve (las de `caelata: true`) | temple |
| `sandramp` | rampa de sacos de arena junto a la esquina NO (en torno a x −55, z −25): un arquitrabe sobre los sacos; los sacos de abajo se vacían y el bloque desciende suavemente sobre los capiteles | construction |
| `architrave` | arquitrabes colocados sobre las columnas (fracción, de oeste a este) | temple |
| `dream` | Artemisa fantasma (cazadora con arco, ciervo) apareciendo junto al arquitrabe "torcido" (leyenda) | misterio |
| `roof` | entablamento completo, frontones, vigas de cedro y tejado de tejas de mármol (la cella queda abierta) | temple |
| `statue` | naiskos y estatua de culto de Artemisa efesia dentro de la cella (`TEMPLE.naiskos`, `cultStatue`) | interior |
| `paint` | policromía en frisos, capiteles y frontones (azul, rojo, oro) | temple |
| `pilgrims` | procesión de peregrinos con antorchas/ofrendas hacia el altar `SITE.altar` | construction |
| `herostratus` | figura fantasma de Eróstrato con antorcha junto a la fachada oeste | misterio |
| `fire` | el templo arde: llamas en el tejado (partículas, aditivo), humo, luz naranja (máx. 3 PointLight) | temple |
| `burned` | daño: tejado hundido, vigas carbonizadas, columnas ennegrecidas (vuelve a 0 = reconstruido) | temple |
| `alexander` | línea luminosa desde el templo hacia el horizonte NO (`SITE.pella`) con etiqueta "PELLA · nace Alejandro · misma noche" | misterio |
| `nameBan` | gran letrero 3D "ERÓSTRATO" que se tacha en rojo + "NOMBRE PROHIBIDO" | misterio |
| `measure` | cotas: 115 m, 55 m, 18 m, "127 COLUMNAS" | misterio |
| `compare` | Partenón fantasma (69 x 31 m, cian) en `SITE.parthenonGhost` para comparar | misterio |
| `goths` | ruina (saqueo godo, 262 d.C.): tejado caído, columnas derribadas en tambores por el suelo | temple |
| `dismantle` | las piedras desaparecen; al final solo los cimientos encharcados | temple |
| `today` | hoy: una única columna reconstruida a trozos en `SITE.todayColumn` con un nido de cigüeña (y la cigüeña) y charcas | environment |

**Todo debe ser función del estado, no acumulativo**: si `s.t` retrocede o salta, la escena debe verse bien.
Usa `s.wall` solo para animaciones ambientales (llamas, agua, humo, caminar). En exportación `wall = t`.

## Mundo
- 1 unidad = 1 metro. Norte = -Z, Sur = +Z, Este = +X. El templo mira al OESTE (fachada principal en x = −57.5).
- Templo centrado en el origen. Suelo de la marisma en y=0 (charcas en `SITE.waterLevel`, juncos, barro).
  Gradas: el estilóbato queda en y=3. Columnas de y=3 a 21, entablamento 21–24.5, cumbrera en 31.
- **Hueco del cimiento**: environment deja en su terreno un hueco rectangular fijo en x ∈ [−62, 62],
  z ∈ [−32, 32]. interior lo rellena: mientras `pit` y `layers` sean 0 (t < 38) dibuja una tapa de suelo de
  marisma a y=0; luego la fosa y las capas; temple tapa todo con la plataforma desde `platform` > 0.
- Cámara: near 0.5, far 40000. Hay planos a ~10 m de los tambores esculpidos, dentro de la cella y mirando
  la sección del cimiento desde fuera (y≈5): nada debe tapar la cámara (ver `CAM` en main.js).
- renderer: sRGB, ACES, sombras PCFSoft activadas. Solo **environment** crea las luces principales
  (sol/luna direccional con sombras + hemisférica) y el cielo/niebla. Los demás pueden añadir PointLight
  pequeñas (máx. 3 por módulo).
- Presupuesto: `InstancedMesh`/`BufferGeometry` fusionada (mergeo manual; no hay BufferGeometryUtils).
  Todo < ~600k triángulos y < ~250 draw calls por fotograma (≈ 40 por módulo). `visible=false` si su pista es 0.
  Las 127 columnas DEBEN ser InstancedMesh (una por pieza: basa, fuste, capitel).

## Estilo
Documental conspiranoico tipo "History Channel de madrugada". Paleta: mármol blanco (#f0ebe0), oro
(#e0b257), policromía (azul #2a4d8f, rojo #a8322a), verde de marisma (#5d6b3a), fuego (#ff7a1a), cian
místico (#7fe3f0), rojo para tachar (#ff3b30). Líneas brillantes con AdditiveBlending, etiquetas 3D con
`CanvasTexture` + `Sprite` en español (`bold 48px Georgia, serif` o monoespaciada).
Evita la sobreexposición: emisivos/aditivos no deben quemar a blanco la imagen con ACES.

## Calidad exigida
- El templo es el protagonista: bosque de 127 columnas jónicas estriadas con capiteles de volutas, doble
  columnata, frontón con relieves, tejado de tejas. Debe verse colosal (gente diminuta al pie).
- Cada capítulo debe mostrar visualmente el paso que narra (ver pistas). Revisa en qué tiempos la cámara
  mira tu parte (`CAM`) y asegúrate de que en esos planos se vea bien y con detalle.
