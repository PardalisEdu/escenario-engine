# Guion del Escenario Uno

La idea original está en el documento *Escenario Uno – Idea* del equipo. Aquí está cómo quedó convertida en juego.
Los diálogos completos viven en el `contenido.json` de cada nivel; este documento es el mapa para encontrarlos.

## Personajes

Todos son animales, la mayoría de México, dibujados con el estilo del logo de Pardalis (que es un ocelote).

| Id | Quién es | Animal | Dónde aparece |
| --- | --- | --- | --- |
| `pardi` | **Pardi**, el protagonista. No sabe inglés… todavía. | Ocelote (como el logo) | Todo el juego |
| `bobby` | **Bobby**, el primo de USA. Solo habla inglés. | Lince rojo (*bobcat*: el primo norteño del ocelote) | Todo el juego |
| `mama` | **Mamá** | Ocelote | Casa y comedor |
| `tepo` | **Doña Tepo**, la de la verdulería | Teporingo (conejito de los volcanes) | Mercado |
| `axo` | **Axo**, el de las aguas frescas | Ajolote | Mercado |
| `armando` | **Don Armando**, el de las tostadas | Armadillo | Mercado |
| `tlacua` | **Don Tlacua**, el de las rascaditas | Tlacuache | Mercado |
| `guajo` | **Don Guajo**, el del maíz y el balero | Guajolote | Mercado |
| `xolo` | **Don Xolo**, el músico | Xoloitzcuintle | Mercado |
| `lula` | **Madame Lula**, la vidente | Tecolote | Mercado |
| `igu` | **Doña Igu**, la de los chiles | Iguana | Mercado |
| `coli` | **Coli**, la de las flores | Colibrí | Mercado |
| — | La abuela, papá, la hermanita, la tía y el tío de USA | Ocelotes y linces | Comedor (en la mesa) |

## 1. La casa (`niveles/casa`) — cinemática

1. Pardi ve sus caricaturas sentado en su cojín.
2. Entra mamá y, detrás de ella, Bobby: «Es tu primo Bobby. Viene de Estados Unidos a conocer México.»
   Bobby saluda: *Hello! I'm Bobby!*
3. Las cuatro dudas de Pardi (con cara de sorpresa y de duda):
   - «¿Ahorita? ¡Si están pasando las caricaturas buenas!»
   - «¿Tengo un primo de Estados Unidos? ¡Nadie me había dicho!»
   - «¿Me habrá traído algo?»
   - «¿Y cómo le voy a hablar? ¡¿Yo sé inglés?!»
4. Mamá los manda al mercado por el mandado para el pozole y lee la lista: maíz, cebolla, chiles, lechuga,
   rábanos, orégano, limón y tostadas. «¡Esa lista es interminable!» — *Let's go!*

## 2. El mercado (`niveles/mercado`) — se juega

Una calle larga con puestos al fondo. La lista del mandado y el monedero (100 pesos) se ven en pantalla.
Para volver a casa hay que conseguir los cuatro objetivos; la salida está a la izquierda, junto al letrero de la casa.

| Puesto | ¿Es del mandado? | Qué pasa | Objetivo o variable |
| --- | --- | --- | --- |
| Verdulería (Doña Tepo) | Sí | Minijuego `Verduleria`: lechuga, rábanos, cebolla, orégano y limón. $35. | `verduras` |
| Tostadas (Don Armando) | Sí | Minijuego `Tostadas`. $15. | `tostadas` |
| Maíz (Don Guajo) | Sí | Reto del balero (`Balero`): si lo ensartas cinco veces, el maíz es regalo. | `maiz` |
| Chiles (Doña Igu) | Sí | Todo muy tranquilo… ¡hasta que estornuda! Minijuego `Chiles`. $20. | `chiles` |
| Aguas frescas (Axo) | Opcional | Elegir agua, helado o fruta y pagar ($10, minijuego `Cobro`). | `botana` |
| Rascaditas (Don Tlacua) | Opcional | Minijuego `Rascadita` ($5): globo desinflado, dulce, canica, trompo o el premio mayor, el mini pizarrón. | `premio` |
| Vidente (Madame Lula) | Opcional | Minijuego `Cartas` ($5): siempre dice algo bueno. | `fortuna` |
| Flores (Coli) | Opcional | Regala una flor para mamá. | `flor` |
| Músico (Don Xolo) | Opcional | Toca una canción (cambia la música). | `cancion` |
| Piñatas | Opcional | Se tocan: confeti y la palabra *star*. | — |

Al terminar cada compra, Pardi revisa la lista (secuencia `revisa_la_lista`): dice qué falta o, si ya está todo,
la cámara enseña la salida.

## 3. El comedor (`niveles/comedor`) — cinemática final

Horas después (ya es de noche en la ventana y el reloj avanzó), la familia grande está a la mesa: la abuela, papá,
la hermanita y los tíos de USA. Mamá llega con la olla, Pardi y Bobby presumen que ellos trajeron todo, y la
familia entera dice «¡Provecho!». Termina con la pantalla del final: las estrellas ganadas y las palabras aprendidas.

## El inglés

Ni Pardi ni quien juega saben inglés, así que el inglés **nunca es requisito para avanzar**. Entra por Bobby,
que señala y nombra lo que ve con una o dos palabras; Pardi lo repite a su manera («¿Létus? ¡Ah, lechuga!») y así
se entiende sin traducir como en un salón. Cada palabra nueva sale en una tarjeta de vocabulario (inglés y español)
y se guarda en el cuaderno «Abc» de la pantalla, donde se puede volver a oír.

| Dónde | Palabras |
| --- | --- |
| Casa | hello · let's go |
| Llegada al mercado | market |
| Verdulería | lettuce · thank you (y en el minijuego: radishes, onion, oregano, lime) |
| Tostadas | crunchy |
| Maíz | corn · five (y en el minijuego se cuenta: one, two, three, four, five) |
| Chiles | hot |
| Aguas frescas | water · ice cream · fruit · yummy |
| Rascaditas | prize (y el premio: balloon, candy, marble, spinning top, blackboard) |
| Vidente | luck (y el símbolo de la carta: sun, star, heart, clover, rainbow) |
| Flores, músico, piñatas | flower · music · star |
| Al completar la lista | home |
| Comedor | yummy · family |

Además, al pagar, el total se dice en español y Bobby lo repite en inglés (*fifteen!*).

## Voces

Cada línea lleva su clave de `audio` (por ejemplo `vo_pardi_caricaturas`). Mientras el archivo no exista, el motor
usa la voz del navegador y el validador lo avisa como advertencia. Para grabar una voz basta poner el archivo
(`.mp3`, `.ogg`, `.wav` o `.m4a`) con ese nombre en la carpeta `voz/` del nivel y correr `bun run assets`.
