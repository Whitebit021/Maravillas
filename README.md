# Maravillas del Mundo Antiguo — "Lo que no te contaron"

Siete videos 3D procedurales (Three.js r149, solo código: sin imágenes, modelos ni audio externos) con tono
documental conspiranoico de entretenimiento, en español. Cada carpeta es un proyecto independiente que se abre
con `index.html` (doble clic) y se exporta a MP4 1080p 30 fps con el script de render.

| Carpeta | Maravilla | Duración |
|---|---|---|
| `giza/` | La Gran Pirámide de Guiza | 4:05 (245 s) |
| `coloso/` | El Coloso de Rodas | 4:00 (240 s) |
| `faro/` | El Faro de Alejandría | 4:00 (240 s) |
| `mausoleo/` | El Mausoleo de Halicarnaso | 4:00 (240 s) |
| `artemisa/` | El Templo de Artemisa en Éfeso | 4:00 (240 s) |
| `zeus/` | La Estatua de Zeus en Olimpia | 4:00 (240 s) |
| `babilonia/` | Los Jardines Colgantes de Babilonia | 4:00 (240 s) |

Cada carpeta contiene:
- `index.html` y `js/` — el video (abrir en Chrome; espacio = reproducir/pausa, flechas = ±5 s, `?t=120` salta a ese segundo).
- `guion_voz.txt` — el texto de la locución, un párrafo por capítulo, para generar la voz con otra IA.
- `capitulos.md` — tabla de tiempos de inicio de cada capítulo para el montaje.
- `CONTRATO.md` — arquitectura: qué módulo dibuja qué y las pistas de estado de la línea de tiempo.

## Renderizar a MP4 en Windows

Requisitos: Google Chrome (o Edge), Python 3 y `ffmpeg` en el PATH. Desde la raíz del repositorio:

```powershell
# Todas las maravillas que aún no tengan video
powershell -ExecutionPolicy Bypass -File tools\render.ps1

# Una sola
powershell -ExecutionPolicy Bypass -File tools\render.ps1 -Project coloso

# Rehacer aunque ya exista
powershell -ExecutionPolicy Bypass -File tools\render.ps1 -Project coloso -Force
```

El render es reanudable (tramos de 15 s; los terminados se saltan) y deja el resultado en
`<carpeta>\export\<carpeta>_1080p.mp4`. Los videos y la carpeta `export/` no se suben al repositorio.
