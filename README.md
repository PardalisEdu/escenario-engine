# escenario-engine

Motor de juegos narrativos para el **modo Aventura de [Pardalis](https://gitlab.com/PardalisEdu)**: juegos educativos
libres para niñas y niños de 1.º a 3.º de primaria que todavía no leen con soltura.

> **Escenario Uno.** El primer escenario real (el mandado para el pozole) está en la carpeta
> [`escenario-uno/`](escenario-uno/). Usa el motor 3.0 ([`tuysh/engine-game-pardalis`](https://github.com/tuysh/engine-game-pardalis)),
> no el motor 2.0 de este repositorio. Para jugarlo: `cd escenario-uno && bun install && bun run jugar`.

Un nivel es un barrio que se recorre caminando: tocas a un personaje, conversan, juegas un minijuego, ganas un objeto
y sigues. Cada nivel se describe con **datos**, no con código:

- un **mapa de [Tiled](https://www.mapeditor.org)** (`.tmj`) dice **dónde** está cada cosa;
- un **JSON de contenido** dice **qué pasa**: personajes, diálogos, objetivos y minijuegos.

Corre sobre **Phaser 4** en el navegador. Está escrito en TypeScript para **Bun**.

## Documentación

| Si quieres… | Lee |
| --- | --- |
| Usar el motor en una página | este README, sección [Uso desde un host](#uso-desde-un-host) |
| Dibujar un mapa o escribir un nivel | [`docs/NIVELES.md`](docs/NIVELES.md) |
| Entender cómo está hecho por dentro, o modificarlo | [`AGENTS.md`](AGENTS.md) (para personas y agentes de IA) |
| Escribir código para el proyecto | [`docs/ESTILO.md`](docs/ESTILO.md) |

## Empezar

```bash
bun install
bun run demo        # nivel de ejemplo en http://localhost:3000 (con ?debug se ven hotspots, piso y huellas)
bun test            # pruebas
bun check           # tipos
```

La demo usa el nivel de la Tortillería de [`ejemplo/niveles/`](ejemplo/niveles) con imágenes de relleno.
Sin audio grabado, las voces salen con la síntesis de voz del navegador.

## Uso desde un host

```ts
import { EscenarioEngine } from '@pardalis/escenario-engine';
import { Tortilleria } from './minijuegos';

const juego = new EscenarioEngine({
  mapa: '/niveles/tortilleria.tmj',
  config: await fetch('/niveles/tortilleria.json').then((r) => r.json()),
  assetsRoot: 'https://assets.pardalis.mx/aventura/',
  cdn: ['https://assets.pardalis.mx'],
  minigames: { Tortilleria },
  save: localStorage.getItem('pardalis:aventura:tortilleria:save'),
  i18n: { base: 'es' },
});

const guardar = () =>
  localStorage.setItem('pardalis:aventura:tortilleria:save', JSON.stringify(juego.serialize()));

juego.on('objetivoCompleto', guardar);
juego.on('escenaTerminada', (destino) => { guardar(); /* el host decide a dónde ir */ });
juego.on('error', (error) => console.error(error));
juego.mount('#contenedor');

// Al salir de la página:
juego.destroy();
```

**El motor nunca navega ni guarda nada por su cuenta**: dibuja y avisa con eventos, y el host decide qué guardar y a dónde ir.
Phaser necesita `window`, así que el motor se monta solo en el cliente (en Astro, dentro de un `<script>` o con `client:only`).
Un host de ejemplo completo está en [`ejemplo/demo.ts`](ejemplo/demo.ts).

### Opciones

| Opción | Tipo | Qué es |
| --- | --- | --- |
| `mapa` | `string \| TiledMap` | URL del `.tmj` o el mapa ya cargado. Sin mapa, se usa el formato v1. |
| `config` | `object \| string` | Contenido JSON del nivel. |
| `assetsRoot` | `string` | Carpeta base de imágenes y sonidos. |
| `cdn` | `string[]` | Orígenes HTTPS permitidos para assets externos. |
| `minigames` | `Record<string, MiniGameFactory>` | Fábricas de minijuegos, por la clave del paso `juego`. |
| `save` | `string \| SaveBlob` | Partida guardada a restaurar (corrupta o de otro nivel → se ignora). |
| `i18n` | `{ base: 'es' \| 'en' }` | Idioma de la interfaz. |
| `proyeccion` | `boolean \| { escalaUI, escalaGlobos, textoMinimo }` | Modo salón de clases: todo más grande. |
| `seed` | `number` | Hace reproducibles los comentarios al azar (pruebas E2E). |
| `debug` | `boolean` | Dibuja hotspots, piso y huellas. |

### Eventos y métodos

| Evento | Cuándo |
| --- | --- |
| `listo` | El nivel terminó de cargar. |
| `objetivoCompleto (objetivo)` | Se cumplió un objetivo: buen momento para guardar. |
| `palabra ({ en, es })` | Se mostró una tarjeta de vocabulario (para el álbum). |
| `escenaTerminada (destino)` | La niña o el niño salió del nivel. |
| `error (error)` | El nivel no pudo arrancar; el mensaje lista cada problema. |

| Método | Qué hace |
| --- | --- |
| `mount(selectorOElemento)` | Valida y arranca el juego. |
| `serialize()` | Devuelve la partida (`SaveBlob`) para guardarla. |
| `setProyeccion(valor)` | Activa o quita el modo salón sin reiniciar. |
| `pause()` / `resume()` | Congela y reanuda el juego y el audio. |
| `abort()` | Termina el diálogo en curso (p. ej. al abrir un menú). |
| `destroy()` | Libera todo (texturas, audio, listeners). |

### Minijuegos

Un minijuego es una función que recibe una escena de Phaser vacía y devuelve una promesa con el resultado:

```ts
import type { MiniGameFactory } from '@pardalis/escenario-engine';

export const Tortilleria: MiniGameFactory = async ({ scene, assets, state, audio }, config) => {
  // ...dibujar en `scene`, cargar con `assets.cargar([...])`, hablar con `audio.decir(...)`
  return { exito: true, otorgar: { tortillas: true } };
};
```

Sin vidas ni mensajes de error: `exito: false` simplemente lleva al diálogo amable `siNo` del NPC.

## Validar niveles en CI

```bash
bun run validar ruta/nivel.tmj ruta/nivel.json --minijuegos Tortilleria,Fruteria
```

Sale con código 1 si hay errores, con un mensaje por problema que apunta a la ruta del JSON o al objeto del mapa.
Para validar desde código sin navegador: `import { validar } from '@pardalis/escenario-engine/validar'`.

## Cómo funciona, en una imagen

```
mapa .tmj + contenido .json
        │
        ▼
validar ── parse → schema → enlaces → cruce mapa↔contenido     (src/core, sin Phaser)
        │
        ▼
EscenaMundo (Phaser 4) ── carga assets, dibuja, mueve al jugador, escucha toques
        │
        ▼
DialogueRuntime ── ejecuta los pasos del diálogo uno por uno
```

Los detalles, las reglas que no se deben romper y cómo hacer los cambios más comunes están en [`AGENTS.md`](AGENTS.md).

## Licencia

[Mozilla Public License 2.0](LICENSE) (MPL-2.0).
