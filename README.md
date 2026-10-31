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

- `src/core/` — puro, sin Phaser (corre en CI): esquema Zod, lector de Tiled y modo legacy, validador, `GameState`, `DialogueRuntime`, geometría, rutas de assets.
- `src/adaptadores/phaser/` — escena, actores, UI (globos, `elige`, voz/TTS) y AssetManager.
- `src/engine.ts` — `EscenarioEngine` (API del §4). `src/cli.ts` — `escenario-engine validar`.
- `ejemplo/` — la Tortillería del §14.1 con un host de prueba y assets de relleno.

## Convenciones que el spec no fija

- Assets por clave contra `assetsRoot`: sin extensión se agrega `.webp` (imágenes), `.mp3` (audio). Una animación es un atlas `<clave>.webp` + `<clave>.json`.
- Sonidos globales en `mundo.sonidos: { tap, cerca, musica }` (sin ellos suena un tono sintetizado).
- Opción de `elige`: `{ texto?, imagen?, audio?, cuando?, secuencia: pasos | "nombre" }`. Condicional dentro de una secuencia: `{ cuando, dice: [pasos] }`.
- Capas de `capas/` con parallax > 1 se dibujan al frente de personajes.
- Evento extra `palabra` ({ en, es }) para que el host llene el álbum; `debug: true` activa el overlay.
