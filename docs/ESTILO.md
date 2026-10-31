# Guía de estilo de código

**Regla principal: el código se escribe para que una persona lo entienda sin ayuda de IA.**
Si hay que elegir entre legible y eficiente, gana legible. Si hay que elegir entre corto y claro, gana claro.

Este proyecto lo mantienen voluntarias y voluntarios que llegan sin contexto. Cada regla de abajo existe para
que puedan abrir un archivo cualquiera y entender qué hace sin leer el resto.

---

## 1. Idioma y nombres

**Español** para identificadores, comentarios, mensajes de error y nombres de pruebas.

Se queda en **inglés** solo lo que viene de afuera:
- Los nombres de la spec: `GameState`, `DialogueRuntime`, `AssetManager`, `MiniGameFactory`, `MiniGameContext`, `SaveBlob`.
- La API pública del host: `mount`, `on`, `off`, `serialize`, `setProyeccion`, `pause`, `resume`, `abort`, `destroy`.
- Los campos de formatos externos: `TiledObjeto.width`, `gid`, `properties`…
- Las APIs de Phaser y del navegador.

**Solo ASCII en identificadores**: `tamanoDeLetra`, no `tamañoDeLetra`; `desplazamiento`, no `vaivén`.
Los acentos sí van en comentarios y textos.

**Nombres completos**, que digan qué guardan. Nada de una o dos letras, salvo `i` en un `for` corto o `x`/`y` de coordenadas.

```ts
// ✗
const c = this.d.nivel.contenido;
const it = this.interactuables.find((i) => dentro(p, i.e.h));

// ✓
const contenido = this.datos.nivel.contenido;
const tocado = this.interactuables.find((interactuable) => puntoDentroDeForma(punto, interactuable.entidad.hotspot));
```

| Qué | Cómo | Ejemplos |
| --- | --- | --- |
| Booleanos | Pregunta o afirmación | `esCaminable`, `hayTeclas`, `yaEstabaCumplido`, `otraOrdenLaReemplazo` |
| Funciones | Verbo + objeto | `ajustarAlPiso`, `leerPartida`, `revisarCruce`, `crearTexturaDeChispa` |
| Callbacks | `al` + evento | `alCompletarObjetivo`, `alElegir`, `alSalir`, `alCancelar` |
| Constantes | `MAYUSCULAS_CON_GUION_BAJO` | `UMBRAL_DE_ARRASTRE`, `TOLERANCIA_DE_LLEGADA` |
| Unidades | En el nombre | `esperaEnSegundos`, `milisegundosPorLetra`, `DURACION_DEL_FUNDIDO` |
| Archivos | `minusculas-con-guiones.ts` | `mapa-tiled.ts`, `flecha-de-salida.ts` |

## 2. Archivos

- **Una responsabilidad por archivo.** Si para describirlo necesitas un «y además», probablemente son dos archivos.
- **Cada archivo empieza con un comentario** que dice qué hace, cómo se usa si no es obvio, y la sección
  de la spec que implementa (`§8.3`). Ese encabezado es lo primero que lee quien llega.
- `src/core/` **nunca** importa Phaser. Lo que se ve y se oye va en `src/adaptadores/phaser/`.
- Si un tipo solo se usa como tipo, impórtalo con `import type`.
- Phaser se importa como `import * as Phaser from 'phaser'`.

## 3. Funciones y control de flujo

- **Funciones cortas con nombre** antes que una función larga con comentarios de sección. Una función de
  más de ~40 líneas suele esconder dos o tres ideas con nombre propio.
- **Retornos tempranos** para descartar casos, en vez de `if` anidados.
- **Un `if` claro antes que un ternario anidado.** Un ternario simple está bien; dos anidados, no.
- **`switch (paso.tipo)`** sobre uniones discriminadas, con un caso por variante.
- **Pasos con nombre en cálculos.** Guarda los resultados intermedios en variables que expliquen el cálculo:

```ts
// ✗
if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) dentro = !dentro;

// ✓
const elBordeCruzaLaAlturaDelPunto = a.y > punto.y !== b.y > punto.y;
if (!elBordeCruzaLaAlturaDelPunto) continue;
const xDelCruce = a.x + ((punto.y - a.y) * (b.x - a.x)) / (b.y - a.y);
if (punto.x < xDelCruce) dentro = !dentro;
```

### Trucos prohibidos

| No | Sí |
| --- | --- |
| `[a, b] = [x, y]` para asignar varias cosas | Una asignación por línea |
| `+(tecla.isDown)` para sumar booleanos | `if (tecla.isDown) x += 1;` |
| `reduce` para armar un texto o un objeto | Un `for` con una variable acumuladora |
| `void promesa` para ignorar una promesa | Llamar sin `await` y, si importa, explicar por qué |
| `a ??= b` encadenados, `&&` como `if` | Un `if` |
| Números mágicos (`9e5`, `0.92`, `140`) | Constantes con nombre (`PROFUNDIDAD.capasAlFrente`, `RADIO_POR_DEFECTO_DE_NPC_PUNTO`) |
| Operaciones de bits sin explicar | Una constante con nombre y un comentario (`BIT_VOLTEO_HORIZONTAL`) |

Si un algoritmo es inevitablemente críptico (por ejemplo, el generador al azar `mulberry32`), aíslalo en una
función con nombre y di en un comentario qué es y que no hace falta entenderlo para usarlo.

## 4. Tipos

- **Nada de `any`, `as any` ni `as never`** en el código del motor. En las pruebas se tolera `any` para
  modificar copias del JSON de ejemplo.
- **Uniones discriminadas con un campo `tipo`** en vez de detectar la forma de un objeto por sus claves.
- **`!` (no nulo) solo cuando una validación previa lo garantiza**, con un comentario:
  `this.mundo.puntos[destino]! // la validación garantiza que existe`.
- **Interfaces con JSDoc** en sus campos no obvios: unidades, valores por defecto, qué significa `undefined`.
- Los tipos internos van en `core/esquema.ts` (contenido) y `core/mundo.ts` (mundo).

## 5. Datos externos

Todo lo que viene de archivos (mapa, contenido, partida guardada) se trata como **no confiable**:

- **Diccionarios con `Object.hasOwn`**, nunca `dic[clave]` ni `clave in dic` para saber si algo existe.
  Un id como `"constructor"` existe en todo objeto de JavaScript.
- Ignora la clave `__proto__` al copiar datos externos a un objeto.
- Valida tipos antes de usar (`typeof valor === 'number'`, `Number.isFinite`).
- Una partida guardada corrupta se ignora con una advertencia; **nunca impide jugar**.

## 6. Errores y mensajes

- **Errores de validación en español, accionables y con ubicación**: la ruta del JSON
  (`npcs.tortu.dialogo[1].dice[2]`) o el objeto del mapa (`objeto #12 "Doña Tortu"`). Di qué está mal y, si se
  puede, qué hacer.

  ```
  ✗ error en el diálogo
  ✓ secuencia "aun_no_item" usada en npcs.tortu.alVolver.siNo pero no existe en "secuencias"
  ```

- Usa los **nombres del JSON** en los mensajes (`"dice"`, `"cuando"`), no los internos (`hablante`, `condicion`).
- **Error** = el nivel no puede arrancar. **Advertencia** = funciona, pero hay algo que revisar (formato viejo,
  rama inalcanzable). Ambos van a un `Diagnostico`.
- En runtime, los avisos a consola llevan el prefijo `[escenario-engine]`.
- Lo que la validación ya garantiza no se vuelve a revisar en runtime; lo que no garantiza, no se asume.

## 7. Asincronía y limpieza

- Cada acción larga (línea, caminata, minijuego, efecto) es una **promesa que termina cuando la acción terminó**
  y recibe una **`AbortSignal`** para cancelarse.
- **Toda suscripción se deshace**: cada `addEventListener('abort', …)` tiene su `removeEventListener`, cada
  `delayedCall` o tween se cancela, cada sonido se destruye. Usa `try/finally` cuando haya varios caminos de salida.
- Ninguna promesa debe poder quedar colgada para siempre: si la acción se cancela, la promesa termina.
- `esperarOCancelar` (`core/dialogo.ts`) es el patrón para esperar algo que se puede abortar.

## 8. Comentarios

- Explican **por qué**, no **qué**. El qué lo dicen los nombres.

  ```ts
  // ✗ suma 1 al contador
  minijuegosCreados++;

  // ✓ Phaser puede llamar a create() en el mismo momento en que se agrega la escena,
  //   por eso el aviso sale de la propia escena y no de un evento al que nos suscribimos después.
  ```

- **JSDoc en todo lo exportado** y en los campos de interfaces que no sean evidentes.
- **Limitaciones conocidas en prosa**, con su salida: `Limitación conocida: no rodea obstáculos grandes. Si hace falta,
  reemplazar por A* sobre el piso (§18, pregunta 1).`
- No dejes código comentado ni `TODO` sin explicación; si algo falta, dilo como limitación conocida.

## 9. Formato

No hay formateador configurado. Sigue el estilo existente:

- 2 espacios de sangría, comillas simples, punto y coma, coma final en listas y objetos de varias líneas.
- Líneas de hasta ~120 columnas; parte las más largas, sobre todo las llamadas con muchos argumentos.
- Separa las secciones de una clase o un archivo largo con `// ─── Sección ───` o `// ── Subsección ──`.
- Números grandes con separador: `10_000`, `1_000_000`.

## 10. Pruebas

- `bun test`. Las pruebas del núcleo están en `src/core/core.test.ts`, agrupadas con `describe` por módulo.
- **El nombre de cada prueba es una frase en español que describe el comportamiento**:
  `'una partida v1 se convierte a v2 y se ignoran partidas corruptas o de otro nivel'`.
- Usa el ejemplo de la Tortillería (`ejemplo/niveles/`) y modifica una **copia** (`copiaDelContenido()`).
- Para errores de validación, comprueba el **texto exacto** del mensaje: el mensaje es parte del contrato con quien escribe niveles.
- El `DialogueRuntime` se prueba con un mundo falso que anota lo que le piden (`mundoDePrueba`).
- Lo que dibuja Phaser no tiene pruebas automáticas: verifícalo en la demo (`bun run demo`).

## 11. Commits

- Mensajes en español con prefijo de tipo: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`.
- Un commit = un cambio con sentido propio. Si cambias el formato del nivel, actualiza `docs/NIVELES.md` en el mismo commit.
