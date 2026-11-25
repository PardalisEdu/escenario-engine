# Lo que el motor todavía no hace (y cómo se resolvió aquí)

Al construir este escenario salieron cosas que el motor no hace o hace con una trampa. Cada una tiene su issue en
el repositorio del motor ([`tuysh/engine-game-pardalis`](https://github.com/tuysh/engine-game-pardalis/issues)).
Cuando un issue se resuelva, el arreglo provisional de aquí se puede quitar: esta tabla dice dónde está.

| Issue | Qué falta en el motor | Arreglo provisional en este escenario |
| --- | --- | --- |
| [#1](https://github.com/tuysh/engine-game-pardalis/issues/1) | El paquete no trae `dist/` al instalarse desde GitHub. | `motor.ts` importa el código fuente del motor; `herramientas/niveles.ts` llama a su `cli.ts` directamente; el `tsconfig.json` copia el del motor. |
| [#2](https://github.com/tuysh/engine-game-pardalis/issues/2) | Los archivos que terminan en `_número` se agrupan como animación sin avisar. | Nombres sin `_número` al final: `item_moneda5`, `telon_fachadas_a`… (ver `docs/ARTE.md`). |
| [#3](https://github.com/tuysh/engine-game-pardalis/issues/3) | No hay acompañante que siga al jugador. | Cada diálogo de puesto empieza con `{ "camina": "primo_…", "quien": "bobby" }`; entre puestos, Bobby se queda atrás. |
| [#4](https://github.com/tuysh/engine-game-pardalis/issues/4) | El contenido no puede restar dinero ni preguntar si alcanza. | Toda compra pasa por un minijuego (`minijuegos/comun/cobro.ts`, `armarPremio`), y los precios se eligieron para que nunca falte dinero. |
| [#5](https://github.com/tuysh/engine-game-pardalis/issues/5) | No hay evento cuando cambia el estado ni cuando empieza o termina un minijuego. | `interfaz/interfaz.ts` relee la partida cada medio segundo; `interfaz/avisar-de-minijuegos.ts` envuelve cada minijuego. |
| [#6](https://github.com/tuysh/engine-game-pardalis/issues/6) | Un nivel no puede leer variables de otro. | Sin resolver: el final no cambia según lo que pasó en el mercado (la flor para mamá, el premio). |
| [#7](https://github.com/tuysh/engine-game-pardalis/issues/7) | El color de fondo es fijo (azul cielo). | Los telones llevan el cielo pintado de `#bfe6f5`; el piso del mercado se alargó hacia la cámara. |
| [#8](https://github.com/tuysh/engine-game-pardalis/issues/8) | Una pose no puede durar solo una línea; el parpadeo necesita archivos repetidos; no hay globo de pensamiento. | Tres pasos por cada línea con pose (`anima` → `dice` → `anima`); `spr_pardi_1…5` son el mismo dibujo. |
| [#9](https://github.com/tuysh/engine-game-pardalis/issues/9) | `camina` de un diálogo atraviesa el decorado; tocar un lugar no rodea obstáculos. | Todos los puntos de los diálogos están sobre el pasillo, que no tiene nada en medio. |
| [#10](https://github.com/tuysh/engine-game-pardalis/issues/10) | En un minijuego, `audio.decir` no avisa cuándo termina de hablar, y no hay un azar que se pueda fijar. | Pausas fijas entre la frase en español y la palabra en inglés (`esperar`); `Math.random` en los minijuegos. |
