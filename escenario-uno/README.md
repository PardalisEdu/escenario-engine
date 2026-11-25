# Escenario Uno · El mandado para el pozole

El primer escenario **real** del modo Aventura de Pardalis, hecho con el motor
[`@pardalis/escenario-engine` 3.0](https://github.com/tuysh/engine-game-pardalis) (personajes de papel en un
escenario 3D). Es para niñas y niños de 1.º a 3.º de primaria que empiezan a familiarizarse con el inglés.

> Pardi está viendo sus caricaturas cuando mamá le presenta a Bobby, su primo de Estados Unidos, que no habla
> español. Los dos van al mercado por el mandado para el pozole… y Pardi descubre que entenderse no es tan difícil.

| Nivel | Qué pasa |
| --- | --- |
| `casa` | Cinemática: las caricaturas, la llegada del primo, las cuatro dudas de Pardi y la lista interminable. |
| `mercado` | Se juega: nueve puestos, seis minijuegos, la lista del mandado y 100 pesos para gastar. |
| `comedor` | Cinemática final: horas después, toda la familia (la de aquí y la de USA) come pozole. |

El guion completo, los personajes y las palabras en inglés están en [`docs/GUION.md`](docs/GUION.md);
la guía de estilo de los dibujos, en [`docs/ARTE.md`](docs/ARTE.md).

## Jugarlo

Hace falta [Bun](https://bun.sh).

```bash
cd escenario-uno
bun install
bun run jugar        # y abrir http://localhost:3000
```

Se juega con el dedo, con el ratón o con el teclado (`W` `A` `S` `D` o las flechas para caminar; `E`, `Enter` o
espacio para hablar). Las voces todavía no están grabadas: se oye la voz del navegador, en español y en inglés.

Direcciones útiles mientras se desarrolla:

| Dirección | Para qué |
| --- | --- |
| `/?nivel=mercado` | Entrar directo a un nivel (`casa`, `mercado` o `comedor`), sin la partida guardada. |
| `/?nivel=mercado&depurar` | Ver las guías del mapa y usar la cámara libre (tecla `C`) para crear planos de cámara. |
| `/?minijuego=Balero` | Abrir un minijuego solo, en la mesa de pruebas. Acepta `&config={"aciertos":3}`. |
| `/?nueva` | Olvidar la partida guardada y empezar de cero. |

## Revisar antes de dar un cambio por terminado

```bash
bun run check        # tipos: debe decir "No type errors"
bun test             # los tres niveles pasan el validador del motor
bun run validar      # el informe completo del validador, con advertencias
bun run assets       # regenera los assets.json (después de agregar, quitar o renombrar un dibujo o sonido)
```

Y jugarlo: lo que se ve y se oye no lo cubre ninguna prueba.

## Cómo está organizado

```
escenario-uno/
  index.html, juego.ts     la página y el anfitrión: crea el juego, guarda la partida, muestra el final
  motor.ts                 de dónde se importa el motor (ver «El motor» abajo)
  servidor.ts              servidor para jugarlo en la computadora
  niveles/
    comun/                 lo que comparten los niveles: Pardi, Bobby, mamá, las cosas del mercado, sonidos
    casa/  mercado/  comedor/
      nivel.json           de qué archivos se compone el nivel
      mapa.tmj             el DÓNDE: se edita con Tiled (https://www.mapeditor.org)
      contenido.json       el QUÉ PASA: personajes, diálogos, cinemáticas, minijuegos
      img/  sonido/        los dibujos (SVG) y los sonidos (WAV) del nivel
      assets.json          el manifiesto: lo genera `bun run assets`, nadie lo escribe a mano
  minijuegos/
    todos.ts               la lista de minijuegos, con el nombre que usan los niveles
    verduleria.ts …        un minijuego por puesto (cada uno con su .css)
    comun/                 lo que comparten: el marco, la tarjeta de resultado, pagar con monedas
  interfaz/                lo que el sitio dibuja encima del juego: lista del mandado, monedero, final
  herramientas/            validar los niveles y regenerar los manifiestos
```

Cómo se escribe un nivel (capas del mapa, pasos de los diálogos, cinemáticas) está en la documentación del motor:
`node_modules/@pardalis/escenario-engine/docs/NIVELES.md`.

### Los minijuegos

| Nombre | Puesto | Qué se hace | Qué se practica |
| --- | --- | --- | --- |
| `Verduleria` | Doña Tepo | Señalar lo de la lista, escoger una buena lechuga, pagar y **revisar el cambio**. | Vocabulario de verduras, contar dinero. |
| `Tostadas` | Don Armando | Buscar las tostadas enteras y sacarlas despacito sin romperlas. | Observar, control fino. |
| `Balero` | Don Guajo | Ensartar el balero cinco veces: si lo logras, el maíz es regalo. | Contar en inglés del uno al cinco. |
| `Chiles` | Doña Igu | Todo iba tranquilo… hasta el estornudo: atrapar los chiles que vuelan. | Distinguir chile guajillo y chile ancho. |
| `Rascadita` | Don Tlacua | (Opcional) Rascar el boleto: siempre sale un premio de la tabla. | — |
| `Cartas` | Madame Lula | (Opcional) Escoger una carta: siempre dice algo bueno. | — |
| `Cobro` | Axo y otros | Pagar juntando monedas hasta el precio justo. | Sumar monedas. |

Cada minijuego termina con una tarjeta de «cuánto sacamos» (de una a tres estrellas). Todos respetan los
principios de Pardalis: **nunca castigar** (no se puede perder; salir con la ✕ solo lleva a un diálogo amable)
y **nada requiere leer** (todo se dice con voz y se muestra con dibujos).

Para escribir uno nuevo, copia [`minijuegos/cobro.ts`](minijuegos/cobro.ts), que es el más corto, agrégalo a
[`minijuegos/todos.ts`](minijuegos/todos.ts) y a `herramientas/niveles.ts`, y pruébalo solo con `/?minijuego=Nombre`.

### El dinero

Mamá da 100 pesos. El mandado cuesta 70 (verduras 35, tostadas 15, chiles 20; el maíz se gana al balero) y los
tres antojos opcionales cuestan 20 (botana 10, rascadita 5, cartas 5), así que **nunca falta dinero** para
terminar. Quien no gasta en antojos regresa con 30 pesos.

## El motor

El motor es [`tuysh/engine-game-pardalis`](https://github.com/tuysh/engine-game-pardalis), fijado a un commit en
`package.json`. Todavía no se publica ya construido, así que [`motor.ts`](motor.ts) importa su código fuente desde
`node_modules`. Cuando el paquete se publique, ese archivo queda en una línea y lo demás no cambia.

Lo que el motor todavía no hace y aquí se resolvió por otro camino (cada punto tiene su issue en el repositorio
del motor) está listado en [`docs/PENDIENTES-DEL-MOTOR.md`](docs/PENDIENTES-DEL-MOTOR.md).

## Licencia

[MPL-2.0](../LICENSE), igual que el motor. El logo de Pardalis (`interfaz/favicon.svg`) es del proyecto Pardalis.
