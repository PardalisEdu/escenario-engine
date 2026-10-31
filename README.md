# escenario-engine

Motor narrativo declarativo sobre **Phaser 4** para el modo Aventura de Pardalis (spec 2.0): mapas en Tiled, contenido en JSON.

```bash
bun install
bun test                     # núcleo: validador, condiciones, geometría, diálogo
bun check                    # tipos
bun run demo                 # http://localhost:3000 (?debug para hotspots, piso y huellas)
bun run validar ejemplo/niveles/tortilleria.tmj ejemplo/niveles/tortilleria.json --minijuegos Tortilleria
```

## Estructura

Cada archivo empieza con un comentario que explica qué hace y a qué sección de la spec corresponde.

**`src/core/`** — sin Phaser; corre en el navegador y en CI.

| Archivo | Qué hace |
| --- | --- |
| `esquema.ts` | Esquema Zod del JSON y tipos internos. Convierte cada paso a `{ tipo: ... }`. |
| `validar.ts` | Orquesta las fases de validación (§12). |
| `validar-enlaces.ts` / `validar-cruce.ts` | Fase 3 (lo que se nombra existe) y fase 4 (mapa ↔ contenido). |
| `recorrer-pasos.ts` | Recorre todos los pasos anidados; lo usan las fases 3 y 4. |
| `mundo.ts` | Modelo del mundo (el DÓNDE) y catálogo de decorado. |
| `mapa-tiled.ts` | Lee un `.tmj` de Tiled y arma el mundo. |
| `legacy.ts` | Formato v1: normaliza formas viejas y arma el mundo sin mapa. |
| `dialogo.ts` | `DialogueRuntime`: ejecuta los pasos uno por uno. |
| `estado.ts` / `condiciones.ts` / `partida.ts` | Estado del juego, condiciones y partida guardada. |
| `geometria.ts` / `assets.ts` | Piso y movimiento; rutas seguras de assets. |

**`src/adaptadores/phaser/`** — lo que se ve y se oye.

| Archivo | Qué hace |
| --- | --- |
| `escena.ts` | Conecta todas las piezas; recibe toques y teclado. Empieza a leer aquí. |
| `construir-mundo.ts` | Dibuja capas, props y actores. |
| `actor.ts` | Un personaje que camina. |
| `camara.ts`, `avisos.ts`, `comentarios.ts` | Cámara, resaltado por cercanía, comentarios por zona. |
| `conversacion.ts`, `globo.ts`, `opciones.ts`, `voz.ts` | Diálogo en pantalla y voz (grabada o TTS). |
| `minijuego.ts`, `efectos.ts` | Montaje de minijuegos; partículas y sonidos. |
| `assets.ts`, `barra-de-carga.ts`, `flecha-de-salida.ts`, `depuracion.ts`, `interfaz.ts` | Carga, UI menor y constantes compartidas. |

`src/engine.ts` es la API pública (`EscenarioEngine`) y `src/cli.ts` el validador de línea de comandos.

## Convenciones que el spec no fija

- Assets por clave contra `assetsRoot`: sin extensión se agrega `.webp` (imágenes), `.mp3` (audio). Una animación es un atlas `<clave>.webp` + `<clave>.json`.
- Sonidos globales en `mundo.sonidos: { tap, cerca, musica }` (sin ellos suena un tono sintetizado).
- Opción de `elige`: `{ texto?, imagen?, audio?, cuando?, secuencia: pasos | "nombre" }`. Condicional dentro de una secuencia: `{ cuando, dice: [pasos] }`.
- Capas de `capas/` con parallax > 1 se dibujan al frente de personajes.
- Evento extra `palabra` ({ en, es }) para que el host llene el álbum; `debug: true` activa el overlay.
