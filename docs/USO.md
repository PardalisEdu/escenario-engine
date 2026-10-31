# Usar escenario-engine desde una página

Esta guía explica cómo montar un nivel de la Aventura de Pardalis desde una página web. A la página que monta el nivel le llamamos **host**.

El motor dibuja el nivel y avisa lo que pasa con eventos. El host decide qué guardar, a dónde ir y qué mostrar si algo falla. El motor nunca navega ni escribe en `localStorage`.

Para el formato del nivel (mapa y JSON) lee [NIVELES.md](NIVELES.md). Para cómo funciona el motor por dentro, lee [AGENTS.md](../AGENTS.md).

## Índice

1. [Instalación y requisitos](#1-instalación-y-requisitos)
2. [Primer nivel en 5 minutos](#2-primer-nivel-en-5-minutos)
3. [Opciones del constructor](#3-opciones-del-constructor)
4. [Eventos](#4-eventos)
5. [Guardar y continuar la partida](#5-guardar-y-continuar-la-partida)
6. [Minijuegos](#6-minijuegos)
7. [Ciclo de vida](#7-ciclo-de-vida)
8. [Integración con Astro](#8-integración-con-astro)
9. [Assets](#9-assets)
10. [Validar sin navegador](#10-validar-sin-navegador)
11. [Intro, acompañante y animaciones](#11-intro-acompañante-y-animaciones)
12. [Errores frecuentes](#12-errores-frecuentes)

## 1. Instalación y requisitos

- **Bun.** Sirve para instalar el paquete, correr las pruebas y validar niveles. El paquete se publica como TypeScript (`src/index.ts`), y Bun lo importa sin configuración extra.
- **Phaser 4.** Viene como dependencia del paquete (`^4.2.1`). No lo instales aparte.
- **Solo en el navegador.** Phaser necesita `window`. Si importas el paquete en el servidor, falla con `ReferenceError: window is not defined`. Monta el nivel desde un `<script>` del cliente. La única parte que corre sin navegador es `@pardalis/escenario-engine/validar` (sección 10).

```bash
bun add @pardalis/escenario-engine
```

En `package.json` el paquete figura como `private`. Si todavía no está en el registro, instálalo desde el repositorio, por ejemplo con una ruta local: `bun add ../escenario-engine`.

## 2. Primer nivel en 5 minutos

Un nivel son dos archivos: el mapa de Tiled (`.tmj`) y el contenido (`.json`). Hay un nivel de ejemplo en [`ejemplo/niveles/`](../ejemplo/niveles). Copia esos dos archivos a una carpeta pública, por ejemplo `/niveles/`.

El nivel usa el minijuego `Tortilleria`, así que el host debe registrarlo. Aquí se importa de `./minijuegos`. La sección 6 explica cómo se escribe.

La página necesita un contenedor con tamaño. El juego se ajusta a él:

```html
<div id="contenedor" style="width: 100vw; height: 100vh"></div>
<script type="module" src="./primer-nivel.ts"></script>
```

Archivo `primer-nivel.ts`:

```ts
import { EscenarioEngine } from '@pardalis/escenario-engine';
import { Tortilleria } from './minijuegos';

// El contenido del nivel es un JSON. Aquí se pide al servidor.
const respuesta = await fetch('/niveles/tortilleria.json');
if (!respuesta.ok) throw new Error(`No se pudo cargar el nivel (${respuesta.status})`);

const juego = new EscenarioEngine({
  mapa: '/niveles/tortilleria.tmj',
  config: await respuesta.json(),
  assetsRoot: '/assets/',
  minigames: { Tortilleria },
});

juego.on('listo', () => console.log('El nivel ya se puede jugar.'));
juego.on('error', (error) => console.error(error.message));

await juego.mount('#contenedor');
```

- `mount` valida el nivel y arranca el juego. No lanza errores: si algo falla, emite `error`. Escucha `error` antes de llamar a `mount`.
- `listo` avisa que el nivel terminó de armarse. Puede llegar después de que `mount` termine.
- Si no tienes un servidor propio, `bun run demo` sirve el nivel de ejemplo (ver el [README](../README.md)).

## 3. Opciones del constructor

Se pasan a `new EscenarioEngine({ ... })`. Solo `config` y `assetsRoot` son obligatorias.

| Opción | Tipo | Obligatoria | Por defecto | Para qué sirve |
| --- | --- | --- | --- | --- |
| `mapa` | `string \| TiledMap` | No | Sin mapa (formato v1, deprecado) | URL del `.tmj`, o el mapa ya cargado. Los tilesets externos (`.tsj`) se piden junto al mapa. |
| `config` | `object \| string` | Sí | — | Contenido JSON del nivel, como objeto o como texto. |
| `assetsRoot` | `string` | Sí | — | Carpeta base donde se busca cada imagen y sonido por su clave. Ver [sección 9](#9-assets). |
| `cdn` | `string[]` | No | `[]` | Orígenes HTTPS extra desde los que se pueden cargar assets. |
| `minigames` | `Record<string, MiniGameFactory>` | No | `{}` | Minijuegos registrados por nombre. El nombre debe coincidir con `"juego"` del JSON. Si falta uno, el nivel no arranca. |
| `save` | `string \| SaveBlob \| null` | No | Partida nueva | Partida a restaurar. Si está corrupta o es de otro nivel, se ignora. Ver [sección 5](#5-guardar-y-continuar-la-partida). |
| `i18n` | `{ base: 'es' \| 'en' }` | No | `{ base: 'es' }` | Idioma de la interfaz. Las líneas de un personaje en otro idioma muestran su traducción (`trad`). |
| `proyeccion` | `boolean \| ProyeccionConfig` | No | `false` | Modo salón de clases: botones, globos y texto más grandes. |
| `seed` | `number` | No | Azar real | Hace que los comentarios al azar salgan siempre igual. Sirve para pruebas automáticas. |
| `debug` | `boolean` | No | `false` | Dibuja encima del juego los hotspots, el piso, las huellas y las zonas de comentario. |

### Modo salón (`ProyeccionConfig`)

`proyeccion` acepta `true`, que usa los valores de la tabla, o un objeto para ajustarlos:

| Campo | Por defecto con `true` | Qué ajusta |
| --- | --- | --- |
| `escalaUI` | `1.5` | Botones de `elige`, íconos de aviso y flecha de salida. |
| `escalaGlobos` | `1.75` | Globos de diálogo. |
| `textoMinimo` | `36` | Tamaño mínimo de cualquier texto, en píxeles. Sin proyección es `22`. |

Archivo `opciones.ts`:

```ts
import { EscenarioEngine, type ProyeccionConfig } from '@pardalis/escenario-engine';
import { Tortilleria } from './minijuegos';

const CLAVE_DE_GUARDADO = 'pardalis:aventura:tortilleria:save';
const opcionesDeProyeccion: ProyeccionConfig = { escalaUI: 1.5, escalaGlobos: 1.75, textoMinimo: 36 };

const juego = new EscenarioEngine({
  mapa: '/niveles/tortilleria.tmj',
  config: await fetch('/niveles/tortilleria.json').then((respuesta) => respuesta.json()),
  assetsRoot: 'https://assets.pardalis.mx/aventura/',
  cdn: ['https://assets.pardalis.mx'],
  minigames: { Tortilleria },
  save: localStorage.getItem(CLAVE_DE_GUARDADO),
  i18n: { base: 'es' },
  // Modo salón con ?salon en la URL. Con ?debug se ven hotspots, piso y huellas.
  proyeccion: new URLSearchParams(location.search).has('salon') ? opcionesDeProyeccion : false,
  debug: new URLSearchParams(location.search).has('debug'),
});
```

## 4. Eventos

Se escuchan con `on` y se dejan de escuchar con `off`. Estos son todos los eventos:

| Evento | Cuándo ocurre | Recibe |
| --- | --- | --- |
| `listo` | El nivel terminó de armarse y se puede jugar. | Nada. |
| `objetivoCompleto` | Un objetivo de `estado.objetivos` pasa a cumplido. Ocurre cada vez que un objetivo pasa de no cumplido a cumplido. El valor ya está en el estado cuando llega el evento. | `objetivo: string` |
| `palabra` | Se muestra una línea con `en` y `es`: una palabra de vocabulario para el álbum del host. | `{ en, es }` |
| `escenaTerminada` | La niña o el niño sale del nivel, y se cumple `salida.requiere`. El motor no navega: el host guarda y decide a dónde ir. | `destino: string` (el `destino` de la salida en el JSON) |
| `error` | El nivel no pudo arrancar: no existe el contenedor, no se descargó el mapa, la validación encontró errores o falta una imagen. | `error: Error` |

Archivo `eventos.ts`:

```ts
import { EscenarioEngine, EscenarioError, type EventosEscenario } from '@pardalis/escenario-engine';
import { Tortilleria } from './minijuegos';

const juego = new EscenarioEngine({
  mapa: '/niveles/tortilleria.tmj',
  config: await fetch('/niveles/tortilleria.json').then((respuesta) => respuesta.json()),
  assetsRoot: '/assets/',
  minigames: { Tortilleria },
});

juego.on('listo', () => {
  console.log('El nivel ya se puede jugar.');
});

juego.on('objetivoCompleto', (objetivo) => {
  console.log(`Objetivo cumplido: ${objetivo}`);
});

juego.on('palabra', ({ en, es }) => {
  console.log(`Vocabulario: ${en} = ${es}`);
});

juego.on('escenaTerminada', (destino) => {
  console.log(`Salida hacia ${destino}`);
});

// Una función con nombre, para poder quitarla con off().
const alError: EventosEscenario['error'] = (error) => {
  if (error instanceof EscenarioError) {
    // Un error de validación trae la lista de problemas, cada uno con su ruta.
    for (const problema of error.errores) console.error(problema);
  } else {
    console.error(error.message);
  }
};
juego.on('error', alError);

await juego.mount('#contenedor');

// Para dejar de escuchar, pasa la misma función:
juego.off('error', alError);
```

- `on` y `off` devuelven el motor, así que se pueden encadenar: `juego.on('listo', a).on('error', b)`.
- `off` solo quita la función que se le pasa, con la misma referencia que en `on`.

## 5. Guardar y continuar la partida

`serialize()` devuelve un `SaveBlob` con esta forma: `{ v: 2, nivel, estado, momento? }`. Convierte el objeto a texto con `JSON.stringify` antes de guardarlo.

- La clave sugerida es `pardalis:aventura:<nivel>:save`, donde `<nivel>` es `meta.id` del JSON (por ejemplo, `tortilleria`).
- `momento` trae la posición del jugador, la cámara y el tiempo jugado. Solo tiene la posición actual mientras el nivel está vivo.

Cuándo guardar:

| Cuándo | Por qué |
| --- | --- |
| En `objetivoCompleto` | El objetivo ya está en el estado cuando llega el evento. |
| En `escenaTerminada` | Antes de cambiar de página. |
| Al salir de la página (`pagehide`, o `astro:before-swap` en Astro) | Guarda también la posición. Hazlo antes de `destroy()`. |

Guardar también marca la intro como vista: con una partida guardada, la intro ya no se repite (ver [sección 11](#11-intro-acompañante-y-animaciones)).

Después de `destroy()`, `serialize()` ya no tiene la posición actual: devuelve la de la última salida o la de la carga.

Archivo `partida.ts`:

```ts
import { EscenarioEngine, type SaveBlob } from '@pardalis/escenario-engine';
import { Tortilleria } from './minijuegos';

const NIVEL = 'tortilleria';
const CLAVE_DE_GUARDADO = `pardalis:aventura:${NIVEL}:save`;

const juego = new EscenarioEngine({
  mapa: `/niveles/${NIVEL}.tmj`,
  config: await fetch(`/niveles/${NIVEL}.json`).then((respuesta) => respuesta.json()),
  assetsRoot: '/assets/',
  minigames: { Tortilleria },
  // El texto guardado, o null si no hay partida.
  save: localStorage.getItem(CLAVE_DE_GUARDADO),
});

function guardarPartida(): void {
  const partida: SaveBlob = juego.serialize();
  localStorage.setItem(CLAVE_DE_GUARDADO, JSON.stringify(partida));
}

juego.on('objetivoCompleto', guardarPartida);
juego.on('escenaTerminada', () => guardarPartida());

// Al salir de la página: guardar primero, destruir después.
addEventListener('pagehide', () => {
  guardarPartida();
  juego.destroy();
});

await juego.mount('#contenedor');
```

`localStorage` puede fallar (modo privado, cuota llena). Si no quieres que eso rompa la página, envuelve `setItem` en `try/catch`.

### Qué hace el motor con una partida guardada

El motor nunca impide jugar. Con una partida mala, avisa en la consola y empieza el nivel de cero:

- **JSON corrupto:** se ignora con una advertencia.
- **Partida de otro nivel** (el `nivel` no coincide con `meta.id`): se ignora con una advertencia.
- **Partida vieja (formato v1):** conserva el estado, pero el jugador aparece al inicio del mapa.
- **Datos sobrantes:** los campos desconocidos y los valores que no son texto, número o booleano se descartan.

## 6. Minijuegos

Un minijuego es una función `MiniGameFactory`. Recibe un contexto y el `config` del paso `juego` del JSON, y devuelve una promesa con el resultado. Mientras corre, el nivel se congela y se oscurece. Al terminar, el motor borra la escena del minijuego, libera los assets que cargaste y reanuda el nivel.

### Qué recibe (`MiniGameContext`)

| Campo | Qué es | Ejemplo |
| --- | --- | --- |
| `scene` | Escena de Phaser vacía, creada solo para este minijuego. Tiene el tamaño lógico del nivel. | `scene.add.image(640, 360, 'tortilla')` |
| `assets` | Carga imágenes y sonidos del minijuego. `cargar(pedidos)` devuelve las claves que no se pudieron cargar; no lanza error. `url(clave, tipo)` devuelve la URL de un asset, y lanza error si la ruta no es segura. Lo que cargas aquí se libera al terminar. | `await assets.cargar([{ clave: 'tortilla', tipo: 'imagen' }])` |
| `state` | Lectura del estado del nivel: `get(nombre)`, `cumple(condicion)` y `valores` (una copia). No se puede escribir: para cambiar el estado, devuelve `otorgar`. | `state.cumple('tengo tortillas')` |
| `audio` | `tocar(clave)` reproduce un sonido ya cargado. `decir(texto, idioma, claveDeAudio?)` dice una frase con la grabación si esa clave está cargada, y con voz sintetizada si no. | `await audio.decir('¡Muy bien!', 'es', 'vo_muy_bien')` |

### Qué devuelve (`MiniGameResult`)

| Campo | Tipo | Qué hace |
| --- | --- | --- |
| `exito` | `boolean` | Cómo terminó el minijuego. Hoy el motor no lo usa para elegir la rama (ver la regla de abajo). Devuélvelo igual. |
| `otorgar` | `Record<string, Valor>` (opcional) | Valores que se escriben en el estado. Así un minijuego marca el ítem que pide `alVolver.conItem`. |

### Reglas

- **Nunca castigar.** Si la niña o el niño sale, devuelve `{ exito: false }`. No hay vidas, derrotas ni mensajes de «incorrecto». Si la fábrica lanza un error, el motor lo trata igual que `{ exito: false }` y lo registra en la consola.
- **`exito` no decide la rama.** Después del minijuego, `alVolver` mira el estado: si ya está el ítem de `conItem`, sigue `siLogrado`; si no, sigue `siNo`. Por eso, un minijuego logrado debe devolver `otorgar` con ese ítem.
- **`otorgar` no se valida.** El motor no comprueba que sus nombres estén en `estado`. Usa solo nombres que declaraste ahí.
- **Nada requiere leer.** Usa imágenes y voces. El texto puede acompañar, pero no debe ser la única pista.

### Ejemplo

Archivo `minijuegos.ts`:

```ts
import type { MiniGameFactory, MiniGameResult } from '@pardalis/escenario-engine';

/** Tocar las tres tortillas. Salir no castiga: devuelve exito false y el nivel sigue por siNo. */
export const Tortilleria: MiniGameFactory = async ({ scene, assets, audio }) => {
  // Las claves se buscan en assetsRoot: 'tortilla' es tortilla.webp.
  // Si alguna no carga, cargar() la devuelve en una lista; no lanza error.
  await assets.cargar([
    { clave: 'tortilla', tipo: 'imagen' },
    { clave: 'vo_muy_bien', tipo: 'audio' },
  ]);

  return new Promise<MiniGameResult>((terminar) => {
    const { width, height } = scene.scale;
    let faltan = 3;

    const terminarConExito = async () => {
      await audio.decir('¡Muy bien!', 'es', 'vo_muy_bien');
      terminar({ exito: true, otorgar: { tortillas: true } });
    };

    for (let indice = 0; indice < 3; indice++) {
      const tortilla = scene.add.image(width / 2 + (indice - 1) * 220, height / 2, 'tortilla').setInteractive();
      tortilla.once('pointerdown', () => {
        tortilla.destroy();
        faltan--;
        if (faltan === 0) terminarConExito();
      });
    }

    // En un minijuego real, usa un ícono en vez de texto: nada requiere leer.
    scene.add
      .text(width - 20, 20, 'Salir', { fontSize: 32 })
      .setOrigin(1, 0)
      .setInteractive()
      .once('pointerdown', () => terminar({ exito: false }));
  });
};
```

### Registrarlo

La clave con la que registras la fábrica debe ser igual, con mayúsculas, al valor de `"juego"` en el JSON. Con este paso en el nivel:

```json
{ "juego": "Tortilleria", "config": { "palabras": ["hot", "corn"] } }
```

el host lo registra así: `minigames: { Tortilleria }`. El `config` llega a la fábrica como segundo argumento, con tipo `unknown`: valídalo antes de usarlo.

## 7. Ciclo de vida

| Método | Cuándo usarlo | Qué hace |
| --- | --- | --- |
| `pause()` | Un menú del host se abre encima del nivel. | Congela el juego y el audio. El diálogo en curso se conserva. |
| `resume()` | Se cierra ese menú. | Reanuda el juego y el audio. |
| `abort()` | Hay que cortar el diálogo en curso, por ejemplo al abrir un menú que lo reemplaza. | Termina el paso actual y libera el diálogo. Un personaje que caminaba se queda donde está. Durante la intro, la salta. |
| `setProyeccion(valor)` | Cambiar el modo salón sin reiniciar. Llámalo después de `listo`. | Cambia el tamaño de botones, globos y texto. |
| `destroy()` | Al salir de la página, o antes de cambiar de página. | Libera texturas, audio, temporizadores y listeners. Después, `mount` ya no arranca el juego: crea otra instancia. |

Archivo `ciclo.ts`:

```ts
import { EscenarioEngine } from '@pardalis/escenario-engine';
import { Tortilleria } from './minijuegos';

const juego = new EscenarioEngine({
  mapa: '/niveles/tortilleria.tmj',
  config: await fetch('/niveles/tortilleria.json').then((respuesta) => respuesta.json()),
  assetsRoot: '/assets/',
  minigames: { Tortilleria },
});

let proyeccion = false;

function alternarProyeccion(): void {
  proyeccion = !proyeccion;
  juego.setProyeccion(proyeccion);
}

juego.on('listo', () => {
  // Después de listo, el botón del modo salón ya puede llamar a setProyeccion.
  document.querySelector('#proyeccion')?.addEventListener('click', alternarProyeccion);
});

// Un menú del host se abre encima del nivel. pause() congela el juego y el audio;
// el diálogo en curso se conserva para cuando se cierre el menú.
function abrirMenu(): void {
  juego.pause();
}

function cerrarMenu(): void {
  juego.resume();
}

// Si el menú debe cortar el diálogo en lugar de retomarlo, usa abort().
function cortarDialogo(): void {
  juego.abort();
}

// Al salir de la página, destroy() libera Phaser, el audio y los listeners.
function salirDelNivel(): void {
  juego.destroy();
}

document.querySelector('#menu')?.addEventListener('click', abrirMenu);
document.querySelector('#cerrar-menu')?.addEventListener('click', cerrarMenu);
addEventListener('pagehide', salirDelNivel);

await juego.mount('#contenedor');
```

Antes de `listo`, `setProyeccion` puede no tener efecto o lanzar un error. Si el nivel debe arrancar en modo salón, pásalo en el constructor con `proyeccion`.

## 8. Integración con Astro

Astro ejecuta el `<script>` en el navegador, no en el servidor. Por eso el motor se importa ahí, y nunca en el frontmatter (`---`).

### Con View Transitions

Usa tres eventos y una función de Astro:

- `astro:page-load` ocurre al cargar la página y después de cada navegación. Ahí se monta el nivel.
- `astro:before-swap` ocurre justo antes de reemplazar la página. Ahí se guarda y se destruye el juego.
- `navigate`, de `astro:transitions/client`, cambia de página cuando el nivel termina.

El nivel se describe en un componente. La página solo lo usa.

Archivo `src/components/Aventura.astro`:

```astro
---
// El componente solo dibuja el contenedor. El motor corre en el <script>, en el navegador.
interface Props {
  nivel: string;
}

const { nivel } = Astro.props;
---

<div id="contenedor" data-nivel={nivel}></div>

<style>
  #contenedor {
    width: 100vw;
    height: 100vh;
  }
</style>

<script>
  import { EscenarioEngine } from '@pardalis/escenario-engine';
  import { navigate } from 'astro:transitions/client';
  import { Tortilleria } from '../minijuegos';

  // El destino de la salida en el JSON → la página a la que se navega.
  const RUTAS_DE_SALIDA = new Map<string, string>([['Selector', '/selector']]);

  let juego: EscenarioEngine | undefined;
  let claveDeGuardado = '';

  function guardarPartida(): void {
    if (!juego) return;
    localStorage.setItem(claveDeGuardado, JSON.stringify(juego.serialize()));
  }

  // Antes de cambiar de página: guardar primero (serialize necesita el juego vivo) y luego destruir.
  function cerrarJuego(): void {
    guardarPartida();
    juego?.destroy();
    juego = undefined;
  }

  async function iniciarJuego(): Promise<void> {
    const contenedor = document.querySelector<HTMLElement>('#contenedor');
    if (!contenedor) return; // Esta página no tiene nivel.

    const nivel = contenedor.dataset.nivel ?? '';
    claveDeGuardado = `pardalis:aventura:${nivel}:save`;

    const respuesta = await fetch(`/niveles/${nivel}.json`);
    if (!respuesta.ok) throw new Error(`No se pudo cargar el nivel ${nivel} (${respuesta.status})`);

    juego = new EscenarioEngine({
      mapa: `/niveles/${nivel}.tmj`,
      config: await respuesta.json(),
      assetsRoot: '/assets/',
      minigames: { Tortilleria },
      save: localStorage.getItem(claveDeGuardado),
      i18n: { base: 'es' },
    });

    juego.on('objetivoCompleto', guardarPartida);
    juego.on('escenaTerminada', (destino) => {
      guardarPartida();
      navigate(RUTAS_DE_SALIDA.get(destino) ?? '/');
    });
    juego.on('error', (error) => console.error(error));

    await juego.mount(contenedor);
  }

  // astro:page-load se dispara al cargar y después de cada navegación.
  document.addEventListener('astro:page-load', iniciarJuego);
  document.addEventListener('astro:before-swap', cerrarJuego);
  // Al cerrar la pestaña no hay cambio de página: solo se guarda.
  addEventListener('pagehide', guardarPartida);
</script>
```

Archivo `src/pages/tortilleria.astro`. La página necesita el router de Astro para que existan los eventos de cambio de página. El componente se llama `<ClientRouter />` en Astro 5 y `<ViewTransitions />` en versiones anteriores:

```astro
---
import { ClientRouter } from 'astro:transitions';
import Aventura from '../components/Aventura.astro';
---

<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>La Tortillería</title>
    <ClientRouter />
  </head>
  <body>
    <Aventura nivel="tortilleria" />
  </body>
</html>
```

El minijuego está en `src/minijuegos.ts`, con el contenido de la sección 6.

### Sin View Transitions

Cada navegación es una carga completa de la página. Arranca con `DOMContentLoaded`, guarda y destruye con `pagehide`, y navega con `location.href`.

Archivo `juego.ts`, cargado desde la página con `<script type="module" src="./juego.ts"></script>` (como en la sección 2):

```ts
import { EscenarioEngine } from '@pardalis/escenario-engine';
import { Tortilleria } from './minijuegos';

const NIVEL = 'tortilleria';
const CLAVE_DE_GUARDADO = `pardalis:aventura:${NIVEL}:save`;
let juego: EscenarioEngine | undefined;

function guardarPartida(): void {
  if (!juego) return;
  localStorage.setItem(CLAVE_DE_GUARDADO, JSON.stringify(juego.serialize()));
}

async function iniciarJuego(): Promise<void> {
  const respuesta = await fetch(`/niveles/${NIVEL}.json`);
  if (!respuesta.ok) throw new Error(`No se pudo cargar el nivel (${respuesta.status})`);

  juego = new EscenarioEngine({
    mapa: `/niveles/${NIVEL}.tmj`,
    config: await respuesta.json(),
    assetsRoot: '/assets/',
    minigames: { Tortilleria },
    save: localStorage.getItem(CLAVE_DE_GUARDADO),
  });

  juego.on('objetivoCompleto', guardarPartida);
  juego.on('escenaTerminada', (destino) => {
    guardarPartida();
    location.href = destino === 'Selector' ? '/selector' : '/';
  });
  juego.on('error', (error) => console.error(error));

  await juego.mount('#contenedor');
}

// El script de módulo se ejecuta antes de DOMContentLoaded, así que este oyente sí se dispara.
addEventListener('DOMContentLoaded', iniciarJuego);

addEventListener('pagehide', () => {
  guardarPartida();
  juego?.destroy();
  juego = undefined;
});
```

## 9. Assets

Las imágenes y los sonidos se piden por **clave**, sin extensión. El motor busca cada clave dentro de `assetsRoot` y agrega la extensión:

| Tipo | Clave | Archivo que busca |
| --- | --- | --- |
| Imagen (capas, props, personajes, opciones) | `spr_tortu` | `spr_tortu.webp` |
| Audio (voces y sonidos) | `vo_hola` | `vo_hola.mp3` |
| Animación (atlas) | `tortu_caminar` | `tortu_caminar.webp` y `tortu_caminar.json` |

- **`assetsRoot`** puede ser una ruta del mismo sitio (`/assets/`) o una URL completa (`https://assets.pardalis.mx/aventura/`).
- **`cdn`** lista los orígenes externos permitidos. Solo cuenta el origen (esquema, host y puerto): la ruta que escribas se ignora. No admite comodines, y tiene que ser HTTPS.
- Un asset de otro origen que no está en `cdn` se rechaza.
- Una clave puede traer extensión (`fondo.png`, `vo_hola.ogg`) y se respeta. Se permiten subcarpetas (`voces/hola`). No se permiten `..`, rutas que empiezan con `/` ni URLs completas.
- Si falta una **imagen**, el nivel no arranca. Si falta un **audio**, se usa voz sintetizada.
- El **acompañante** se carga como cualquier personaje: su `sprite` y sus atlas tienen que estar en `assetsRoot`.

Los detalles de nombres y carpetas están en [NIVELES.md, sección 3](NIVELES.md#3-assets-imágenes-y-sonidos).

Archivo `cdn.ts`:

```ts
import { EscenarioEngine } from '@pardalis/escenario-engine';
import { Tortilleria } from './minijuegos';

// assetsRoot es la carpeta base. Cada clave se suma a esa ruta, y el motor agrega la extensión:
//   'spr_tortu' (imagen) → https://assets.pardalis.mx/aventura/spr_tortu.webp
//   'vo_hola' (audio)    → https://assets.pardalis.mx/aventura/vo_hola.mp3
// El origen de assetsRoot tiene que ser el de la página, o estar en cdn (HTTPS).
const juego = new EscenarioEngine({
  mapa: '/niveles/tortilleria.tmj',
  config: await fetch('/niveles/tortilleria.json').then((respuesta) => respuesta.json()),
  assetsRoot: 'https://assets.pardalis.mx/aventura/',
  cdn: ['https://assets.pardalis.mx'],
  minigames: { Tortilleria },
});

juego.on('error', (error) => console.error(error.message));
await juego.mount('#contenedor');
```

## 10. Validar sin navegador

Un nivel mal escrito se puede detectar antes de publicarlo. La validación no necesita navegador ni Phaser.

### Desde código

Importa `validar` del punto de entrada `/validar`. Recibe el contenido, el mapa (ya cargado) y las claves de los minijuegos. Devuelve `errores`, `advertencias` y, si no hubo errores, `nivel`.

Archivo `validar.ts`:

```ts
import { validar } from '@pardalis/escenario-engine/validar';
import type { TiledMap } from '@pardalis/escenario-engine';

const config = await Bun.file('ejemplo/niveles/tortilleria.json').text();
const mapa: TiledMap = await Bun.file('ejemplo/niveles/tortilleria.tmj').json();

const resultado = validar({ config, mapa, minijuegos: ['Tortilleria'] });

for (const advertencia of resultado.advertencias) console.warn(`advertencia: ${advertencia}`);
for (const error of resultado.errores) console.error(`error: ${error}`);

if (resultado.errores.length > 0) process.exit(1);
console.log('El nivel es válido.');
```

`validar` espera el mapa con sus tilesets ya cargados. Si el mapa usa archivos `.tsj` aparte, usa el CLI: busca esos archivos junto al mapa.

### Desde la terminal y CI

El script `validar` está en el `package.json` del paquete. Córrelo desde ese repositorio:

```bash
bun run validar ejemplo/niveles/tortilleria.tmj ejemplo/niveles/tortilleria.json --minijuegos Tortilleria
```

Si el nivel es válido:

```
✓ ejemplo/niveles/tortilleria.json es válido (0 error(es), 0 advertencia(s))
```

Si el nivel usa un minijuego que no está en `--minijuegos`:

```
✗ "juego": "Tortilleria" usado en npcs.tortu.dialogo[1].dice[2] pero no registrado en el host

1 error(es), 0 advertencia(s)
```

El comando sale con código `0` si el nivel es válido, `1` si tiene errores o no se puede leer, y `2` si los argumentos están mal.

Para CI, un job de GitLab que valida el nivel:

```yaml
# .gitlab-ci.yml
validar-niveles:
  image: oven/bun:1
  stage: test
  script:
    - bun install --frozen-lockfile
    - bun run validar ejemplo/niveles/tortilleria.tmj ejemplo/niveles/tortilleria.json --minijuegos Tortilleria
```

Agrega una línea por nivel. `--minijuegos` debe incluir todos los minijuegos que usa el nivel. Si falta uno, el job falla.

## 11. Intro, acompañante y animaciones

Todo esto se escribe en el JSON del nivel. El host no registra nada nuevo ni cambia el constructor. Esta sección explica lo que sí le toca al host. Para escribirlo en el nivel, lee [NIVELES.md](NIVELES.md) (secciones `acompanante`, `intro` y la tabla de pasos).

| Qué | En el JSON del nivel | Qué le toca al host |
| --- | --- | --- |
| Intro animada | `"intro": [ ...pasos ]` | Decidir si se ve, con la opción `save`. |
| Acompañante que sigue al jugador | `"acompanante": { "personaje": "ajolo" }` | Subir el sprite de ese personaje a `assetsRoot`. |
| Gestos (`saltar`, `saludar`, `asentir`, `sorpresa`) | `{ "gesto": "saltar", "quien": "tortu" }` | Nada. |
| Cámara de cine y título | `{ "enfoca": "tortu" }`, `{ "titulo": "…" }`, `{ "espera": 1 }` | Nada. |
| Personajes que respiran, rebotan y se voltean | Nada: el motor lo hace solo | Nada. |

### La intro

**Cuándo se ve.** Al montar el nivel **sin partida guardada**: `save` es `null`, o la partida se ignoró porque está corrupta o es de otro nivel. Si hay una partida válida, el motor da la intro por vista y el nivel empieza directo.

**Cómo se ve.** La imagen aparece desde negro, entran dos franjas de cine arriba y abajo y, abajo a la derecha, hay un botón ⏭ para saltarla (también con la tecla Escape). Tocar la pantalla adelanta los globos, como en cualquier diálogo. Mientras dura, no se puede caminar.

**Con el ciclo de vida:**

- `listo` llega **antes** de que empiece la intro.
- No hay un evento de «intro terminada». El nivel se puede jugar en cuanto termina o se salta.
- `pause()` congela la intro y `resume()` la retoma donde iba.
- `abort()` la salta, igual que el botón ⏭.

**Volver a mostrarla.** Monta el nivel sin partida. Hay una trampa: si guardas en `pagehide`, la recarga vuelve a guardar la partida que acabas de borrar, y la intro no aparece. Quita ese oyente antes de recargar.

Archivo `empezar-de-nuevo.ts`:

```ts
import { EscenarioEngine } from '@pardalis/escenario-engine';
import { Tortilleria } from './minijuegos';

const CLAVE_DE_GUARDADO = 'pardalis:aventura:tortilleria:save';
// Con ?intro en la URL se monta sin partida y la intro se ve otra vez (sin borrar nada).
const verLaIntro = new URLSearchParams(location.search).has('intro');

const juego = new EscenarioEngine({
  mapa: '/niveles/tortilleria.tmj',
  config: await fetch('/niveles/tortilleria.json').then((respuesta) => respuesta.json()),
  assetsRoot: '/assets/',
  minigames: { Tortilleria },
  save: verLaIntro ? null : localStorage.getItem(CLAVE_DE_GUARDADO),
});

function guardarPartida(): void {
  localStorage.setItem(CLAVE_DE_GUARDADO, JSON.stringify(juego.serialize()));
}

// Una función con nombre, para poder quitarla después.
const alSalirDeLaPagina = () => {
  guardarPartida();
  juego.destroy();
};
addEventListener('pagehide', alSalirDeLaPagina);

// Botón «Empezar de nuevo»: borra la partida y recarga; la intro se vuelve a ver.
function empezarDeNuevo(): void {
  // Sin esto, la recarga dispara pagehide y vuelve a guardar la partida recién borrada.
  removeEventListener('pagehide', alSalirDeLaPagina);
  localStorage.removeItem(CLAVE_DE_GUARDADO);
  location.reload();
}

document.querySelector('#empezar-de-nuevo')?.addEventListener('click', empezarDeNuevo);
juego.on('objetivoCompleto', guardarPartida);
await juego.mount('#contenedor');
```

> Si la niña o el niño recarga la página a media intro y el host guarda en `pagehide`, la intro cuenta como vista. Es a propósito: la intro nunca debe estorbar a quien ya empezó.

### El acompañante

- Aparece detrás del jugador al empezar, y también al continuar una partida: su posición no se guarda en el `SaveBlob`.
- Si falta su imagen, el nivel no arranca, igual que con cualquier personaje (`textura spr_… referenciada pero no cargada`).
- No se puede tocar. Habla, camina y hace gestos solo cuando el diálogo del nivel se lo pide.

### Animaciones y gestos

- **No necesitan assets.** Aunque un personaje sea una sola imagen, el motor lo hace respirar, inclinarse al caminar, voltearse con un giro y dar saltitos al hablar. Si el nivel trae atlas de `caminar` o `hablar`, se usan y la animación procedural se suaviza.
- **Gestos propios con atlas.** Cualquier animación extra del personaje (`"bailar": "tortu_bailar"`) se pide igual que las demás: `tortu_bailar.webp` y `tortu_bailar.json` en `assetsRoot`. Se reproduce una vez.
- **Movimiento reducido.** Si el sistema tiene activada la opción «reducir movimiento» (`prefers-reduced-motion`), el motor apaga la respiración, los rebotes y los giros, y la cámara de la intro salta sin deslizarse. Los gestos sí se hacen, porque son parte de la historia. El host no tiene que configurar nada. Para probarlo, en las DevTools de Chrome: *Rendering → Emulate CSS media feature prefers-reduced-motion*.

### Probarlo

`bun run demo` monta la Tortillería con intro, acompañante (el ajolote rosa) y gestos. El botón «Borrar partida» de la demo vuelve a mostrar la intro.

## 12. Errores frecuentes

Casi todos los fallos llegan por el evento `error`, o como advertencias en la consola con el prefijo `[escenario-engine]`. Si algo no aparece aquí, revisa la consola.

| Síntoma | Causa | Solución |
| --- | --- | --- |
| `error`: `no existe el contenedor #x` | El selector no encuentra ningún elemento. | Revisa el `id`. Si ya tienes el elemento, pásalo a `mount(elemento)`. |
| El juego sale muy chico o no aparece | El contenedor no tiene ancho o alto. | Dale tamaño con CSS, por ejemplo `width: 100vw; height: 100vh`. |
| `error`: `escenario-engine: no se pudo cargar <ruta> (404)` | La URL del mapa, o de un tileset externo, no existe. | Revisa la ruta del mapa. Los tilesets se buscan junto al mapa. |
| `error`: `textura X referenciada pero no cargada (ruta intentada: …)` | Falta el archivo de la imagen, o la clave no coincide con su nombre. | Abre la URL de la ruta intentada. Las claves sin extensión llevan `.webp`. Una imagen que falta impide arrancar el nivel. |
| `error`: `… (ruta de asset rechazada …)` | La clave o el origen no están permitidos: `..`, ruta absoluta, URL completa, o un origen que no está en `cdn`. | Usa claves relativas. Agrega el origen HTTPS a `cdn` (sección 9). |
| Advertencia en consola: `audio X no cargado …; se usará TTS` | Falta el archivo de una voz. | No es un error. El nivel sigue con voz sintetizada. Agrega el archivo si quieres voz grabada. |
| `error`: `"juego": "X" usado en … pero no registrado en el host` | La clave de `minigames` no es igual a la del JSON. Distingue mayúsculas. | Usa el mismo nombre en `minigames` y en `"juego"`. |
| `error`: `escenario-engine: N error(es) de validación` | El mapa o el JSON tienen problemas de formato o de referencias. | Cada línea del mensaje dice dónde está el problema. Revísalos sin navegador con `bun run validar` (sección 10). |
| `ReferenceError: window is not defined` | El paquete se importa en el servidor, por ejemplo en el frontmatter de Astro. | Importa y monta solo en el cliente, dentro de un `<script>` (sección 8). |
| Tocar la salida no cambia de nivel | `salida.requiere` no se cumple. El motor ejecuta `siBloqueada` y no emite error. | Revisa qué falta en `estado`. `escenaTerminada` solo llega cuando se cumple. |
| La partida no se restaura | La clave no coincide, el JSON está corrupto o la partida es de otro nivel. | Compara la clave que guardas con la que lees. Revisa la advertencia en la consola. |
| Al volver, el jugador aparece al inicio del mapa | `serialize()` se llamó después de `destroy()`, o no se guardó al salir. | Llama a `serialize()` antes de `destroy()` (sección 5). |
| Al cambiar de página sigue la música, o hay dos juegos | No se llamó a `destroy()` al salir. | Destruye en `astro:before-swap` o en `pagehide` (sección 8). |
| `setProyeccion` no cambia nada, o lanza un error | Se llamó antes de `listo`. | Llámalo después de `listo`, o pasa `proyeccion` en el constructor. |
| La intro no aparece | Hay una partida guardada válida. Con frecuencia es la que escribe `pagehide` al recargar. | Monta con `save: null`, o quita el oyente de `pagehide` antes de borrar la partida y recargar (sección 11). |
| La intro aparece cada vez | No se guarda la partida, o la clave de `save` no coincide con la que guardas. | Guarda en `objetivoCompleto` y en `pagehide`, con la misma clave que lees (sección 5). |
| `error`: `"pon" no se permite en la intro (se puede saltar); …` | La intro, o una secuencia que usa, cambia el estado, abre un minijuego o pide elegir. | Mueve ese paso al primer diálogo del nivel. También aplica a `"juego"` y `"elige"`. |
| `error` que empieza con `acompanante` | El personaje del acompañante no existe en `meta.personajes`, es el mismo que el jugador o también es un NPC del mapa; o el nivel no tiene `jugador`. | Usa un personaje propio para el acompañante, y declara un `jugador` (ver [NIVELES.md](NIVELES.md)). |
| `error`: `gesto "x" en …: no es un gesto del motor …` | El gesto no es `saltar`, `saludar`, `asentir` ni `sorpresa`, y el personaje no tiene esa animación. | Corrige el nombre, o agrega la animación al personaje en `meta.personajes`. |
| Los personajes no respiran ni rebotan | El sistema tiene activado «reducir movimiento». | Es a propósito, por accesibilidad (sección 11). |

## Más documentación

- [README.md](../README.md): resumen del motor y tablas de opciones, eventos y métodos.
- [NIVELES.md](NIVELES.md): cómo se escribe un nivel (mapa, JSON, pasos y assets).
- [AGENTS.md](../AGENTS.md): cómo funciona el motor por dentro. Para quien lo modifica.
- [ESTILO.md](ESTILO.md): reglas para escribir código del motor.
