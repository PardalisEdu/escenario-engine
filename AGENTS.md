# AGENTS.md — contexto para agentes y mantenedores

Este archivo te da el contexto necesario para trabajar en el repositorio **sin leer todo el código**.
Léelo completo antes de cambiar algo. Antes de escribir código, lee también [`docs/ESTILO.md`](docs/ESTILO.md).

> Las referencias como **§8.3** apuntan a secciones de la especificación interna
> *escenario-engine · Especificación técnica 2.0* (PDF del equipo Pardalis, no está en el repo).
> Lo esencial de la spec para escribir niveles está resumido en [`docs/NIVELES.md`](docs/NIVELES.md).

---

## 1. Qué es, en 30 segundos

`escenario-engine` es un motor de juegos narrativos (caminar, tocar personajes, dialogar, jugar minijuegos)
para el **modo Aventura de Pardalis**: juegos educativos libres para niñas y niños de 1.º a 3.º de primaria
que **todavía no leen con soltura**.

Un nivel son **dos archivos de datos** unidos por `id`, y no lleva código de Phaser propio:

- **Mapa de Tiled (`.tmj`)**: el **DÓNDE** (fondos, decorado, NPCs, piso caminable, salida, zonas).
- **Contenido JSON**: el **QUÉ PASA** (personajes, diálogos, estado, minijuegos, salida).

El host (el sitio en Astro) crea un `EscenarioEngine`, registra fábricas de minijuegos y escucha eventos.
El motor dibuja con **Phaser 4**, corre sobre **Bun** y valida con **Zod 4**. Licencia: **MPL-2.0**
(la spec menciona GPL-3.0, pero el proyecto usa MPL-2.0; manda `LICENSE`).

## 2. Comandos y verificación

```bash
bun install
bun check                     # tipos (debe decir "No type errors")
bun test                      # pruebas del núcleo (src/core/core.test.ts)
bun run validar ejemplo/niveles/tortilleria.tmj ejemplo/niveles/tortilleria.json --minijuegos Tortilleria
bun run demo                  # http://localhost:3000 ; con ?debug se ven hotspots, piso y huellas
```

**Antes de dar un cambio por terminado:** `bun check` y `bun test` en verde, y el CLI valida el ejemplo.
Si tocaste `src/adaptadores/phaser/`, abre la demo y recorre el nivel: tocar a Doña Tortu, minijuego
(tocar las 3 tortillas), volver, salir por la flecha. Las pruebas no cubren Phaser.

Usa Bun para todo (`bun`, `bun test`, `bunx`), no Node, npm ni vitest. Ver `CLAUDE.md`.

## 3. Mapa del código

```
               host (Astro / ejemplo/demo.ts)
                        │  new EscenarioEngine({ mapa, config, minigames, save, ... })
                        ▼
  src/engine.ts ── EscenarioEngine: mount · on · serialize · pause · resume · destroy
        │
        │ 1. descarga el .tmj (+ tilesets .tsj)
        │ 2. validar() ───────────────► src/core/  (sin Phaser; también corre en CI vía src/cli.ts)
        │                                parse → schema → enlaces → cruce  ⇒  Nivel { contenido, mundo }
        │ 3. new Phaser.Game(EscenaMundo)
        ▼
  src/adaptadores/phaser/escena.ts ── EscenaMundo
        preload(): carga assets por clave (fase 5 "build" de la validación)
        create():  construir-mundo → cámara → conversación → avisos → comentarios → DialogueRuntime
        update():  teclado, actores, avisos de cercanía, comentarios por zona, cámara
        │
        │ implementa AccionesDelMundo (lo que el intérprete le pide al mundo)
        ▼
  src/core/dialogo.ts ── DialogueRuntime: ejecuta pasos uno por uno; lee y escribe GameState
```

### `src/core/` — lógica pura, **nunca importa Phaser**

| Archivo | Responsabilidad | Léelo si vas a… |
| --- | --- | --- |
| `esquema.ts` | Esquema Zod del JSON **y** tipos internos. Convierte cada paso a `{ tipo: … }`. | tocar el formato del contenido o agregar un paso |
| `validar.ts` | Orquesta las fases; define `Nivel`, `EscenarioError`. | entender el arranque |
| `validar-enlaces.ts` | Fase 3: todo lo nombrado existe; ciclos entre secuencias; tabla `EFECTOS`. | agregar una regla del contenido |
| `validar-cruce.ts` | Fase 4: mapa ↔ contenido, en ambos sentidos. | agregar una regla mapa↔JSON |
| `recorrer-pasos.ts` | Visita todos los pasos anidados con su ruta JSON. | revisar algo en cada paso |
| `mundo.ts` | Modelo del mundo (`Mundo`, `Entidad`, `Prop`…) y `CATALOGO_DE_DECORADO`. | agregar una clase de decorado |
| `mapa-tiled.ts` | Lee el `.tmj` y produce un `Mundo`. Un método por clase de objeto. | soportar algo nuevo de Tiled |
| `legacy.ts` | Formato v1: normaliza formas viejas y arma el `Mundo` sin mapa. | tocar compatibilidad v1 |
| `dialogo.ts` | `DialogueRuntime` y la interfaz `AccionesDelMundo`. | cambiar cómo se ejecuta un paso |
| `estado.ts` | `GameState`: valores, objetivos, `{faltan}`, `{dinero}`. | tocar el estado del juego |
| `condiciones.ts` | Gramática de condiciones (`tengo x`, `no …`, arreglos, `alguno`). | cambiar condiciones |
| `partida.ts` | `SaveBlob` v2, migración v1 y saneo de partidas corruptas. | cambiar el guardado |
| `geometria.ts` | Formas, piso caminable, ajuste al piso, movimiento con deslizamiento. | tocar movimiento o hotspots |
| `assets.ts` | Resolución **segura** de claves a URLs. | tocar carga de assets |
| `diagnostico.ts` | Acumulador de errores y advertencias. | — |

### `src/adaptadores/phaser/` — lo que se ve y se oye

| Archivo | Responsabilidad |
| --- | --- |
| `escena.ts` | **Empieza aquí.** Conecta las piezas, recibe toques y teclado (PlayerController) e implementa `AccionesDelMundo`. |
| `construir-mundo.ts` | Dibuja capas, props y actores; calcula huellas e `Interactuable`s. |
| `actor.ts` | Personaje que camina (jugador o NPC). |
| `camara.ts` | Modos `follow`, `rails` y `pan`. |
| `conversacion.ts` | Globos, opciones de `elige` y comentarios, con su voz. |
| `globo.ts` / `opciones.ts` / `voz.ts` | Globo de diálogo, menú de opciones, voz grabada o TTS. |
| `avisos.ts` / `comentarios.ts` | Resaltado por cercanía; comentarios al entrar a zonas. |
| `minijuego.ts` | Monta y desmonta la escena de un minijuego; define `MiniGameContext` y `MiniGameFactory`. |
| `efectos.ts` | Implementación de cada efecto de la tabla `EFECTOS`. |
| `assets.ts` | `GestorDeAssets` sobre el loader de Phaser; `listaDeAssetsDelNivel`. |
| `interfaz.ts` | Escalas (normal y modo proyección), `PROFUNDIDAD` y movimiento reducido. |
| `flecha-de-salida.ts`, `barra-de-carga.ts`, `depuracion.ts` | Piezas menores de interfaz. |

Raíz: `src/engine.ts` (API pública), `src/index.ts` (exportaciones), `src/cli.ts` (validador CLI).
Ejemplo jugable en `ejemplo/` (nivel de la Tortillería, host de prueba y servidor con assets de relleno).

## 4. Conceptos clave

- **`Nivel = { contenido, mundo }`**: el resultado de una validación exitosa. Todo lo que corre después
  puede confiar en él (por eso hay `!` comentados del tipo "la validación garantiza que existe").
- **Dos vistas del mismo paso.** El JSON usa claves cortas (`{ "dice": "tortu", "texto": "…" }`); al validar,
  Zod las convierte a una unión discriminada (`{ tipo: 'linea', hablante: 'tortu', … }`). El motor solo usa
  la forma interna; los mensajes de error usan los nombres del JSON. La tabla completa está al inicio de `esquema.ts`.
- **`Mundo`** sale de Tiled (`mapa-tiled.ts`) o del JSON v1 (`legacy.ts`). El resto del motor no sabe de dónde vino.
- **`DialogueRuntime`** no conoce Phaser: llama a `AccionesDelMundo` (`mostrarLinea`, `elegirOpcion`,
  `reproducirEfecto`, `caminar`, `jugarMinijuego`). Cada acción devuelve una promesa que termina al terminar
  la acción, y recibe una `AbortSignal`.
- **Un diálogo a la vez.** `runtime.ocupado` bloquea otros diálogos y los toques al piso; no hay cola.
- **`GameState`** guarda objetivos, variables y flags (`charlas.<id>`, que el motor marca solo al hablar).
- **Coordenadas de mundo**: origen arriba a la izquierda. Personajes y props se ordenan por su «y de pie».
  Las demás capas de dibujo usan `PROFUNDIDAD` (`interfaz.ts`).

## 5. Invariantes: no los rompas

1. **`src/core/` no importa Phaser** (ni siquiera de forma indirecta). El CLI de validación corre en Bun sin navegador.
2. **El motor nunca navega ni escribe en `localStorage`.** Avisa con eventos (`escenaTerminada`, `objetivoCompleto`)
   y el host decide. Tampoco hace peticiones fuera de `assetsRoot` y la lista `cdn`, ni rastrea.
3. **Nunca castigar.** No hay vidas, derrotas ni mensajes de «incorrecto». Un minijuego que falla o lanza un
   error se trata como `{ exito: false }` y sigue la rama `siNo`.
4. **Nada requiere leer.** Todo aviso tiene audio **e** imagen. El texto en pantalla acompaña, nunca es la única pista.
   Si una voz no existe, se usa TTS; si no hay TTS, se espera un tiempo proporcional al texto.
5. **Lo que valida la validación no falla en runtime.** Si agregas una referencia nueva (un nombre que apunta a
   algo), agrega su revisión en `validar-enlaces.ts` o `validar-cruce.ts`. Un nivel roto se detecta en CI, no jugando.
6. **El JSON de los autores es un contrato.** Puedes cambiar la forma interna (`esquema.ts`), pero no la forma
   del JSON sin compatibilidad: acepta la forma vieja en `legacy.ts` con una advertencia de deprecación.
7. **Diccionarios del contenido con `Object.hasOwn`**, nunca `dic[clave]` ni `clave in dic` para decidir si existe.
   Los ids vienen de archivos externos y `"constructor"` o `"__proto__"` no deben confundirse con datos.
   `GameState.valores` no tiene prototipo y rechaza `__proto__`.
8. **Todo se limpia.** Cada `addEventListener` sobre una `AbortSignal` tiene su `removeEventListener`; cada
   temporizador, tween o sonido se cancela al terminar o al abortar. `abort()` y `destroy()` no deben dejar
   promesas colgadas, timers, audio ni listeners vivos.
9. **Assets solo por clave relativa** a `assetsRoot` (`resolverUrlDeAsset`): sin `..`, sin rutas absolutas ni URLs completas,
   y solo hacia el mismo origen o un origen HTTPS de `cdn`.
10. **El teclado no se captura.** El motor ignora teclas cuando el foco está en un `input`/`textarea` del host
    o hay modificadores (Ctrl/Alt/Meta).
11. **Legibilidad antes que eficiencia** (ver `docs/ESTILO.md`). Este código lo mantienen voluntarios sin IA.

## 6. Recetas

### Agregar un tipo de paso nuevo
1. `core/esquema.ts`: interfaz `PasoX` con `tipo: 'x'`, súmala a `Paso`; esquema Zod con `.transform`;
   agrégala a `ESQUEMAS_DE_PASO` **respetando el orden** (si su clave puede coincidir con otra, va antes).
   Actualiza la tabla del comentario inicial.
2. `core/recorrer-pasos.ts`: si contiene pasos anidados o referencias a secuencias, recórrelos.
3. `core/validar-enlaces.ts` (y `validar-cruce.ts` si toca el mapa): revisa lo que nombra. Si referencia secuencias,
   súmalo también a `revisarCiclosDeSecuencias`.
4. `core/dialogo.ts`: caso en `ejecutarPaso`. Si necesita al mundo, agrega un método a `AccionesDelMundo`.
5. `adaptadores/phaser/escena.ts`: implementa ese método (delegando en un módulo propio si es más de unas líneas).
6. Prueba en `core.test.ts`: conversión a `tipo` y ejecución con el mundo de prueba. Documenta el paso en `docs/NIVELES.md`.

### Agregar un efecto
Agrega el nombre a `EFECTOS` (`core/validar-enlaces.ts`) y su implementación a `EFECTOS_DISPONIBLES`
(`adaptadores/phaser/efectos.ts`). TypeScript te obliga a que ambos coincidan. Debe tener imagen **y** sonido.

### Agregar una clase de decorado (Tiled)
Agrégala a `CATALOGO_DE_DECORADO` (`core/mundo.ts`) con `pisablePorDefecto` y `encima`. Si tiene propiedades
nuevas, súmalas a `PROPIEDADES_DE_DECORADO` (`core/mapa-tiled.ts`) y a `Prop`. Actualiza `docs/NIVELES.md`.

### Agregar una regla de validación
Contenido solo → `validar-enlaces.ts`. Mapa con contenido → `validar-cruce.ts`. Solo el mapa → `mapa-tiled.ts`.
El mensaje debe incluir la ruta del JSON (o `objeto #id "nombre"` del mapa) y decir qué hacer. Agrega una prueba
que compruebe el texto exacto del mensaje.

### Agregar un evento público o una opción del constructor
Tipos en `EventosEscenario` / `EscenarioOptions` (`src/engine.ts`), exporta lo necesario en `src/index.ts`,
y documéntalo en las tablas del `README.md`.

### Cambiar el formato de la partida guardada
`core/partida.ts`: sube `v`, migra la versión anterior en `leerPartida` y sanea los campos desconocidos.
Una partida corrupta o de otro nivel se ignora con advertencia; nunca debe impedir jugar.

## 7. Trampas conocidas

- **Phaser 4, no 3.** No existe `Geom.Point` (usa `Phaser.Math.Vector2`; `strokePoints` exige `Vector2[]`). FX y máscaras
  ahora son *filters*. `roundPixels` es `false` por defecto. La guía de migración está en `node_modules/phaser/skills/v3-to-v4-migration/`.
- **`scene.add(clave, escena, true)` puede llamar a `create()` en ese mismo instante.** No te suscribas al evento
  `create` después: avisa desde el propio `create()` (ver `crearEscenaVacia` en `minijuego.ts`).
- **Zod 4**: los mensajes salen en español (`z.config(z.locales.es())`). Dentro de un `.transform`, re-emite los
  problemas con su `path` para que la ruta del error siga apuntando al JSON.
- **`noUncheckedIndexedAccess` está activo**: `arreglo[i]` es `T | undefined`. Usa `!` solo si una validación previa
  lo garantiza, y deja el porqué en un comentario.
- **El evento `pointerup` de la escena también llega al tocar un botón.** Los botones de `elige` se detectan con
  `objetosDebajo` en `pointerdown` para no avanzar dos cosas con un toque.
- **TTS**: `speechSynthesis.cancel()` corta *cualquier* enunciado, también el de la línea siguiente. `Voz` solo
  cancela si el enunciado abortado sigue siendo el activo.
- **Comentario vs. diálogo**: un comentario por zona nunca interrumpe un diálogo; una línea de diálogo sí cancela un comentario.

## 8. Limitaciones y pendientes conocidos

- **Sin búsqueda de caminos**: se camina en línea recta deslizándose por los bordes; ante una huella ancha el
  personaje se detiene (`avanzarHacia`, pregunta abierta 1 de §18).
- **La cámara `pan` no rebota** en los bordes (`config.rebote` aún no se usa).
- **Formato v1 de diálogo `si`/`sino`/`pasos` no implementado**: la spec no define su forma.
- **No hay migraciones por versión del contenido** (solo de la partida v1 → v2).
- **Convenciones propias** (la spec no las fija): extensiones por defecto de assets, `mundo.sonidos`, forma de las
  opciones de `elige`, capas con parallax > 1 al frente, evento `palabra`, opción `debug`. Ver `docs/NIVELES.md`.
- Preguntas abiertas de la spec (§18): Tiled siempre vs. mapa embebido, caché offline de R2, `rails` a mitad de diálogo,
  dónde vive el vocabulario, varias salidas por nivel, escala por profundidad, activación del modo proyección.
