# Cómo se escribe un nivel

Referencia para quien dibuja mapas y escribe diálogos. Resume las secciones §5–§8 de la spec interna y agrega las
convenciones propias del motor. El ejemplo completo está en [`ejemplo/niveles/`](../ejemplo/niveles)
(la Tortillería: `tortilleria.tmj` + `tortilleria.json`).

Un nivel son **dos archivos** que se unen por `id`:

| Archivo | Responde | Lo edita |
| --- | --- | --- |
| Mapa de Tiled (`.tmj`) | **DÓNDE**: fondos, decorado, NPCs, piso caminable, salida, zonas, puntos | quien dibuja, en [Tiled](https://www.mapeditor.org) 1.10 o superior |
| Contenido (`.json`) | **QUÉ PASA**: personajes, diálogos, estado, minijuegos, salida | quien escribe la historia |

Mover algo en Tiled nunca rompe un diálogo, y cambiar un diálogo nunca rompe una posición.

> **Principios de Pardalis que todo nivel respeta:** nada requiere leer (todo texto lleva `audio` o se dice con voz
> sintetizada, y las opciones llevan `imagen`); nunca castigar (un minijuego sin éxito lleva a un diálogo amable, `siNo`);
> en pantalla solo aparecen palabras que la niña o el niño ya vio.

---

## 1. El mapa de Tiled

### Capas requeridas (nombres exactos, en minúsculas)

| Capa | Tipo en Tiled | Contenido |
| --- | --- | --- |
| `capas` | Grupo de capas de imagen | Fondos y frentes continuos. Cada capa lleva `asset` (clave) y, opcional, `parallax` (número). El orden dentro del grupo es el orden de dibujo. |
| `decorado` | Capa de objetos | Props como objetos de imagen, cada uno con una clase del catálogo. |
| `npcs` | Capa de objetos | Un objeto de clase `npc` por personaje. |
| `interaccion` | Capa de objetos | `inicioJugador`, `punto`, `salida`, `zonaComentario`, `enfoqueCamara`. |
| `piso` | Capa de objetos | Uno o más polígonos de clase `piso`: por donde se puede caminar. |

Otra capa es válida si lleva la propiedad booleana `ignorar: true` (por ejemplo, notas del equipo); si no, genera una advertencia.

**Parallax:** `1` se mueve con la cámara; menos de `1` va más lento (fondo); más de `1` va más rápido y **se dibuja
delante de los personajes**. Si falta la propiedad `parallax`, se usa el parallax nativo de Tiled y si no, `1`.

**Tamaño del mundo:** propiedades de mapa `ancho` y `alto`, o si faltan, `width × tilewidth` por `height × tileheight`.

### Clases de objeto

| Clase | Capa | Forma | Propiedades (tipo, valor por defecto) |
| --- | --- | --- | --- |
| `npc` | `npcs` | elipse, rectángulo o punto | `id` (string, **obligatoria**), `mira` (`izquierda`/`derecha`, def. `derecha`), `puntoInteraccion` (objeto → un `punto`), `radio` (int, def. 140, solo si es punto) |
| `inicioJugador` | `interaccion` | punto | `mira` (def. `derecha`). **Exactamente uno**, dentro del piso. |
| `punto` | `interaccion` | punto | Su **nombre** es su identificador (p. ej. `frente_tortilleria`); no se repite. |
| `salida` | `interaccion` | rectángulo o elipse | `puntoInteraccion` (objeto → `punto`), `flecha` (bool, def. `true`). Máximo una. |
| `zonaComentario` | `interaccion` | rectángulo, elipse o polígono | `grupo` (string, def. `general`), `cooldown` (int, segundos, def. 20) |
| `enfoqueCamara` | `interaccion` | punto | `orden` (int), `zoom` (float, def. 1) |
| `piso` | `piso` | polígono (3+ vértices) | — |
| Decorado (ver catálogo) | `decorado` | imagen (o rectángulo para `puesto`) | `id` (string: lo vuelve interactivo), `pisable` (bool), `profundidad` (int, ajuste de orden), `huella` (int, alto en px de la franja que bloquea; def. 20 % del alto), `lona` y `letrero` (string, para `puesto`) |

**Catálogo de decorado** (clase desconocida = error):

| Clase | ¿Se puede pisar por defecto? | Notas |
| --- | --- | --- |
| `puesto`, `cajas`, `cubetas`, `perritos`, `comal`, `frutas`, `carritoGlobos`, `carpa`, `pared` | no | Su huella bloquea el paso; el jugador se desliza alrededor. |
| `flecha`, `entrada`, `deco` | sí | `deco` es una imagen genérica sin comportamiento. |
| `papelPicado`, `techo` | sí | Se dibujan **encima** de los personajes. |

Un `puesto` sin imagen se dibuja con figuras: lona del color de `lona` (`verde`, `rojo`, `azul`, `amarillo`, `rosa`,
`naranja`, `morado`, `blanco` o un color `#hex`) y el texto de `letrero`.

### Reglas del formato que conviene saber

- Cada tile del tileset de imágenes lleva la propiedad **`asset`** (clave para el juego). La ruta del PNG en Tiled solo
  sirve al editor: el juego busca la imagen por su clave en `assetsRoot`.
- La clase de un objeto se escribe en el campo **Clase** de Tiled (`type` en 1.10+, `class` en 1.9). Un objeto de imagen
  sin clase se trata como `deco` (con advertencia).
- Voltear un objeto de imagen en horizontal en Tiled lo voltea en el juego.
- Un NPC tocado lleva al jugador a su `puntoInteraccion` (o, si no tiene, al lado más cercano del NPC).
- Los tilesets pueden estar dentro del mapa o en archivos `.tsj` aparte (relativos al mapa).

## 2. El contenido JSON

### Estructura

```jsonc
{
  "meta": { "id": "tortilleria", "titulo": "La Tortillería", "personajes": { ... } },
  "jugador": { ... },                     // opcional: sin jugador, la cámara se arrastra (modo pan)
  "acompanante": { ... },                 // opcional: un personaje que sigue al jugador
  "intro": [ ...pasos ],                  // opcional: escena animada al empezar
  "mundo": { "logico": [1280, 720], "fondo": "#ffe6b8", "camara": { ... }, "sonidos": { ... } },
  "estado": { "objetivos": [...], "variables": [...], "lista": { ... }, "dinero": 100 },
  "secuencias": { "nombre": [ ...pasos ] },
  "npcs": { "tortu": { "dialogo": [...], "alVolver": { ... } } },
  "interactivos": { "comal": { "dialogo": [...] } },
  "comentarios": { "general": [ ...líneas ] },
  "salida": { ... }
}
```

### `meta.personajes`

```json
"personajes": {
  "tommy": { "idioma": "en", "sprite": "spr_tommy" },
  "tortu": { "idioma": "es", "sprite": "spr_tortu", "velocidad": 45,
             "animaciones": { "idle": "tortu_idle", "caminar": "tortu_caminar", "hablar": "tortu_hablar" } }
}
```

- `idioma`: `es` o `en`. Si es distinto del idioma base del sitio, la línea puede traer `trad`: se muestra debajo
  del globo y se dice después del audio original.
- `velocidad`: milisegundos por letra al escribir su texto (def. 30). Un personaje lento escribe despacio.
- Un NPC del mapa con `id: "tortu"` usa el personaje `tortu` como sprite.
- `animaciones`: `idle`, `caminar` y `hablar` las usa el motor solo. **Cualquier otro nombre** (`"bailar": "tortu_bailar"`)
  es un gesto propio que se reproduce una vez con `{ "gesto": "bailar", "quien": "tortu" }`.
- **Aunque no haya atlas, nadie se ve tieso**: el motor anima el sprite solo. En reposo respira; al caminar se inclina
  hacia adelante y, sin atlas de `caminar`, rebota y se balancea con cada paso; se aplasta un poco al arrancar y al
  frenar; se voltea con un giro corto; y, sin atlas de `hablar`, da saltitos mientras habla. Con «reducir movimiento»
  activado en el sistema, todo eso se apaga (los gestos sí se hacen).

### `jugador`

| Campo | Def. | Qué es |
| --- | --- | --- |
| `personaje` | — | id en `meta.personajes` (obligatorio) |
| `animaciones` | — | `{ idle, caminar, hablar }` |
| `velocidadX` / `velocidadY` | 240 / 110 | píxeles por segundo; la vertical es más lenta |
| `radioAviso` | 160 | distancia a la que se resalta algo interactivo |

### `acompanante`

```json
"acompanante": { "personaje": "ajolo", "distancia": 110 }
```

Un personaje que sigue al jugador a todas partes, como con una correa: si el jugador se aleja más de `distancia`
píxeles (def. 110), camina hasta alcanzarlo, del lado donde ya estaba; si está cerca, se queda quieto mirándolo.

- `personaje` debe existir en `meta.personajes`, ser distinto del jugador y **no** ser un NPC del mapa.
- Necesita un `jugador`. Aparece detrás de él al empezar.
- Puede hablar (`"dice": "ajolo"`), caminar (`{ "camina": "fuente", "quien": "ajolo" }`; mientras dura, deja de
  seguir) y hacer gestos. No se puede tocar.
- No rodea obstáculos grandes: si un puesto queda en medio, se desliza por el borde y alcanza al jugador cuando este regresa.

### `mundo.camara`

| Modo | Cuándo | Campos (def.) |
| --- | --- | --- |
| `follow` (def.) | Sigue al jugador. | `zonaMuerta` (280): franja horizontal donde el jugador camina sin mover la cámara · `suavizado` (0.1) · `seguirY` (0.04) |
| `rails` | Momentos cinematográficos: se acomoda en el `enfoqueCamara` más cercano al jugador. | — |
| `pan` | Escenas sin jugador: se arrastra con el dedo. | `inercia` (0.92) |

`mundo.sonidos` (convención del motor): `{ "tap": clave, "cerca": clave, "musica": clave }`. Si falta `tap` o `cerca`, suena un tono sintetizado.

### `estado`

```json
"estado": {
  "objetivos": ["tortillas", "aguacates"],
  "variables": ["globo", "charlas.*"],
  "lista": { "tortillas": "las tortillas", "aguacates": "los aguacates" },
  "dinero": 100
}
```

- **Toda condición y todo `pon` debe usar un nombre declarado aquí**; si no, es error.
- `"charlas.*"` declara los flags `charlas.<id>` que el motor marca solo al hablar con alguien.
- `lista` da el nombre con artículo para `{faltan}` → «Te faltan las tortillas y los aguacates».

### Diálogo de un NPC o interactivo: ramas

```json
"dialogo": [
  { "cuando": "tengo tortillas", "dice": [ ...pasos de revisita... ] },
  { "dice": [ ...pasos de primera visita... ] }
]
```

Gana **la primera rama cuya condición se cumple**. Una rama sin `cuando` siempre se cumple: debe ir al final
(si no, las siguientes son inalcanzables y hay advertencia). Hablar con alguien marca `charlas.<id> = true`.

### Pasos

| Paso | Ejemplo | Qué hace |
| --- | --- | --- |
| Línea | `{ "dice": "tortu", "texto": "¡Hola!", "audio": "vo_hola" }` | Globo sobre quien habla. Termina con un toque o al acabar el audio. Opcional: `trad`, y `en` + `es` para una **tarjeta de vocabulario**. |
| Opción | `{ "elige": "¿Cuál quieres?", "opciones": [ { "imagen": "img_rosa", "audio": "vo_rosa", "secuencia": [...] } ] }` | Espera la elección (toque o teclas 1–9). Cada opción: `texto`, `trad`, `imagen`, `audio`, `cuando`, y `secuencia` (pasos o nombre de secuencia). |
| Efecto | `{ "efecto": "magia" }` | Partículas + sonido. Disponibles: `magia`, `confeti`. |
| Estado | `{ "pon": { "globo": "rosa" } }` | Asigna objetivos o variables. |
| Minijuego | `{ "juego": "Tortilleria", "config": { "palabras": ["hot"] } }` | Pausa el mundo, monta la fábrica del host y, al volver, ejecuta `alVolver`. |
| Caminar | `{ "camina": "frente_tortilleria", "quien": "tortu" }` | Camina hasta un `punto` del mapa, `{ "x": 900, "y": 470 }` o (v1) solo una x. Sin `quien`, camina el jugador. |
| Secuencia | `{ "secuencia": "aun_no_item" }` | Ejecuta una secuencia nombrada (máx. 8 niveles; los ciclos son error). |
| Condicional | `{ "cuando": "globo", "dice": [ ...pasos ] }` | Ejecuta sus pasos solo si se cumple la condición. |
| Enfoque | `{ "enfoca": "tortu", "zoom": 1.3 }` | La cámara se desliza hasta un personaje (su id), un `punto` del mapa o `{ "x", "y" }`. `zoom` def. 1. Se queda ahí hasta que termina el diálogo y luego vuelve sola al jugador. |
| Espera | `{ "espera": 1.5 }` | Pausa en segundos, para dar ritmo. |
| Título | `{ "titulo": "La Tortillería", "audio": "vo_titulo" }` | Tarjeta de título a pantalla completa, con acorde, que se dice en voz alta. |
| Gesto | `{ "gesto": "saltar", "quien": "tortu" }` | `saltar`, `saludar`, `asentir`, `sorpresa` o una animación propia del personaje. Sin `quien`, el jugador. |

Los textos admiten `{faltan}` (objetivos pendientes, en español) y `{dinero}`.

### Condiciones

| Expresión | Se cumple cuando |
| --- | --- |
| `"tengo tortillas"` | `tortillas` tiene un valor verdadero |
| `"no tengo limones"` | negación; `no` va delante de cualquier condición |
| `"objetivosCompletos"` | todos los objetivos están cumplidos |
| `"globo"` | la variable `globo` tiene un valor verdadero |
| `"charlas.tortu"` | ya se habló con `tortu` |
| `["a", "b"]` | se cumplen `a` **y** `b` |
| `{ "alguno": ["a", "b"] }` | se cumple `a` **o** `b` |

### `intro`: la escena de presentación

Pasos que se ven como una pequeña película al **empezar el nivel sin partida guardada** (quien vuelve ya la vio).
Entran dos franjas de cine, la imagen aparece desde negro y abajo a la derecha hay un botón ⏭ para saltarla
(también con Escape). Tocar la pantalla adelanta los globos, como en cualquier diálogo.

```json
"intro": [
  { "titulo": "La Tortillería", "audio": "vo_titulo" },
  { "enfoca": "tortu", "zoom": 1.25 },
  { "gesto": "saludar", "quien": "tortu" },
  { "dice": "tortu", "texto": "¡Buenos días! Las tortillas ya casi están.", "audio": "vo_tortu_intro" },
  { "enfoca": "tommy" },
  { "gesto": "saltar", "quien": "ajolo" },
  { "dice": "ajolo", "texto": "¡Vamos, Tommy!", "audio": "vo_ajolo_intro" }
]
```

También puede ser el nombre de una secuencia (`"intro": "presentacion"`). Como se puede saltar en cualquier momento,
**no admite `pon`, `juego` ni `elige`** (tampoco dentro de las secuencias que use): lo que cambie el estado va en el
primer diálogo. Al terminar, la cámara regresa sola al jugador.

### `alVolver` (después de un minijuego)

```json
"alVolver": { "conItem": "tortillas", "siLogrado": [ ...pasos ], "siNo": "aun_no_item" }
```

Si el estado tiene el ítem (o todos, si `conItem` es un arreglo) → `siLogrado`; si no → `siNo`.
`siNo` debe ser amable («¡Otro día lo intentamos!»), nunca un «perdiste».

### `comentarios`

Frases que el jugador dice al **entrar** a una `zonaComentario` del mapa; se elige una al azar del `grupo` de la zona.
Cada zona espera su `cooldown` antes de repetir, y un comentario nunca interrumpe un diálogo.

```json
"comentarios": { "general": [ { "dice": "tommy", "texto": "Wow!", "trad": "¡Qué colorido!", "audio": "vo_wow" } ] }
```

### `salida`

```json
"salida": {
  "destino": "Selector",
  "requiere": "objetivosCompletos",
  "siBloqueada": "bloquea_salida",
  "flecha": { "visibleCuando": "objetivosCompletos", "texto": "¡A casa!" }
}
```

Al tocar el objeto `salida` del mapa, el jugador camina hasta ella. Si `requiere` no se cumple, se ejecuta
`siBloqueada`; si se cumple, el motor avisa al host con `escenaTerminada("Selector")` y el host decide a dónde ir.
`flecha.texto` es opcional y solo debe usar palabras que la niña o el niño ya vio.

## 3. Assets (imágenes y sonidos)

Todo se pide por **clave relativa** a `assetsRoot` (en Pardalis, una carpeta de `https://assets.pardalis.mx`):

| Tipo | Clave sin extensión | Ejemplo |
| --- | --- | --- |
| Imagen (capas, props, sprites, opciones) | se agrega `.webp` | `spr_tortu` → `spr_tortu.webp` |
| Audio (voces y sonidos) | se agrega `.mp3` | `vo_hola` → `vo_hola.mp3` |
| Animación (atlas) | `.webp` + `.json` (atlas JSON de Phaser) | `tortu_caminar` → `tortu_caminar.webp` y `tortu_caminar.json` |

Si la clave ya trae una extensión conocida (`.png`, `.jpg`, `.ogg`, `.wav`, `.m4a`…), se respeta. Se permiten
subcarpetas (`voces/hola`), pero no `..`, rutas absolutas ni URLs completas.

Si falta una imagen, el nivel no arranca (error con la ruta intentada). Si falta un audio, se usa voz sintetizada.

## 4. Validar

```bash
bun run validar ruta/al/nivel.tmj ruta/al/nivel.json --minijuegos Tortilleria,Fruteria
```

Corrige hasta tener **cero errores**. Las advertencias (formato viejo, ramas inalcanzables) se revisan, pero no bloquean.
Cada mensaje dice dónde está el problema, con la ruta del JSON o el objeto del mapa:

```
✗ camina "frente_tortileria" en npcs.tortu.dialogo[1].dice[0]: no hay punto con ese nombre
✗ mapa: objeto #12 "Doña Tortu" (npc) tiene id "tortu2", que no existe en npcs
```

Después, pruébalo como lo usarán: en una tablet con el dedo, con teclado y en modo proyección. Revisa que nada requiera leer.

## 5. Formato v1 (sin mapa de Tiled)

Si no se entrega mapa, el motor usa las coordenadas del JSON como en la versión 1.0. Se aceptan, con advertencia de deprecación:

| v1 | Equivale en 2.0 |
| --- | --- |
| `"layout": [{ "tipo": "cajas", "x": [380, 1110] }]` | objetos de decorado (sin `asset`, la imagen se llama como el `tipo`) |
| `mundo.piso: [405, 505]`, `mundo.inicio: 260` | polígono de piso rectangular; inicio a media banda |
| `mundo.ancho`, `mundo.alto`, `mundo.capas[]` (con `depth`) | tamaño del mapa; capas (`depth` > 0 = al frente) |
| `npcs` como arreglo con `id` | objeto indexado por id |
| NPC con `x`, `y`, `radio` o `forma: { tipo: "rect", w, h }` | objeto `npc` del mapa |
| `salida.x`, `camara.enfoques`, `camara.margen` | objeto `salida`, puntos `enfoqueCamara`, `zonaMuerta` |
| `{ "quien": "tommy", "texto": "…" }` en una línea | `"dice"` |
| `{ "camina": 300 }` | `{ "camina": { "x": 300, "y": … } }` o un punto con nombre |

Si se entrega mapa, **manda el mapa**: esos campos del JSON se ignoran con una advertencia de «dato duplicado».
