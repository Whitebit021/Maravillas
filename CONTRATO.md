# Contrato de módulos — "La Gran Pirámide: Lo que no te contaron"

Video 3D procedural en Three.js **r149** (global `window.THREE`, script clásico, SIN ES modules, SIN addons
como OrbitControls/GLTFLoader). **Solo código**: prohibido cargar imágenes, texturas, modelos, audio o
video externos. Todo se genera con geometría, shaders, `CanvasTexture` dibujadas por código y WebAudio.

Debe funcionar abriendo `index.html` con doble clic (file://), por eso todo son scripts clásicos.

## Archivos
| Archivo | Autor | Exporta |
|---|---|---|
| `js/chapters.js` | coordinador | `GIZA.DURATION`, `GIZA.CHAPTERS`, `GIZA.PYR`, `GIZA.SITE`, `GIZA.INTERIOR` |
| `js/main.js` | coordinador | renderer, cámara, línea de tiempo, `GIZA.state`, llama a las fábricas |
| `js/script.js` | agente guion | `GIZA.SCRIPT` |
| `js/environment.js` | agente entorno | `GIZA.createEnvironment(ctx)` |
| `js/pyramid.js` | agente pirámide | `GIZA.createPyramid(ctx)` |
| `js/interior.js` | agente interior | `GIZA.createInterior(ctx)` |
| `js/construction.js` | agente obra | `GIZA.createConstruction(ctx)` |
| `js/cosmic.js` | agente cósmico | `GIZA.createCosmic(ctx)` |
| `js/hud.js` | agente HUD/audio | `GIZA.createHUD(ctx)` |

**Lee `js/chapters.js` y `js/main.js` antes de empezar** (son la fuente de verdad: tiempos, pistas, cámara, coordenadas).

## Plantilla obligatoria de cada módulo
```js
(function () {
  'use strict';
  const G = window.GIZA;
  G.createXxx = function (ctx) {
    const THREE = ctx.THREE, scene = ctx.scene;
    const root = new THREE.Group(); scene.add(root);
    // ... construir todo aquí, una sola vez (nada de crear geometrías por frame) ...
    return {
      update: function (s) { /* s = estado del frame, ver abajo */ }
    };
  };
})();
```
`ctx = { THREE, scene, camera, renderer, timeline, state }`.
`timeline = { t, duration, play(), pause(), toggle(), seek(t), isPlaying(), on(fn(ev,t)) }` (eventos: play, pause, seek, end).

## Estado por frame `s` (lo calcula main.js; todos los valores 0..1 salvo indicación)
- `t` tiempo del video (s), `dt` delta del video (0 si pausado), `wall` reloj real (s, siempre avanza), `realDt`
- `chapter` (id), `chapterIndex`, `chapterProgress`, `duration`, `playing`
- `timeOfDay` (puede pasar de 1; usar `fract`: 0 medianoche, .25 amanecer, .5 mediodía, .75 atardecer)
- `build` fracción de **altura** construida del núcleo (0 = nada, 1 = cima a 146.6 m)
- `capstone` piramidión dorado colocándose, `beam` destello/rayo de luz desde la cúspide
- `casing` revestimiento de caliza blanca pulida, `erosion` pérdida del revestimiento (estado actual)
- `xray` transparencia de la pirámide para ver el interior
- `ramp`, `workers`, `quarry`, `boats` visibilidad/actividad de la obra
- `siteGrid`, `compass` rejilla de nivelación y alineación a los puntos cardinales
- `orion` estrellas del cinturón de Orión + líneas, `ghostPyramids` Kefrén y Micerino
- `shafts` conductos de ventilación apuntando a estrellas
- `piDiagram`, `golden`, `energy` superposiciones "conspiranoicas"

Los módulos deben usar `s.wall` para animaciones ambientales (brillos, partículas) y `s.t` / pistas para
todo lo que dependa de la historia (para que adelantar/retroceder funcione: **todo debe ser función del
estado, no acumulativo**; si `s` retrocede, la escena debe verse bien).

## Mundo
- 1 unidad = 1 metro. Pirámide centrada en el origen, base en y=0. Norte = -Z, Sur = +Z, Este = +X.
- Pirámide: semibase 115.15, altura 146.6, pendiente 51.84°. `GIZA.PYR.halfAt(y)`.
- Kefrén (-330, 350), Micerino (-560, 920). Cantera al sur centrada en (0, 400). Nilo al este x≈950 (ancho 260) corriendo en Z. Puerto/canal x≈600, z≈150.
- Suelo en y=0 (meseta plana en radio ~1200; dunas más allá). Cámara: near 0.5, far 40000.
- renderer: sRGB, ACES, sombras PCFSoft activadas. Solo **environment** crea luces principales (sol + hemisférica) y el cielo/niebla.
- Presupuesto: usar `InstancedMesh`/`BufferGeometry` fusionada; mantener todo el proyecto < ~600k triángulos y < ~300 draw calls. Objetivo 60 fps.

## Estilo
Documental conspiranoico tipo "History Channel de madrugada": dorados, ámbar, cian místico para
lo "oculto", líneas brillantes (AdditiveBlending), etiquetas 3D con `CanvasTexture` + `Sprite` en español.
Tipografía de etiquetas: `bold 48px Georgia, serif` o monoespaciada para datos.
