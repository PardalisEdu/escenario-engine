// Hace que un dibujo «vuele» de donde está hasta otro elemento (una verdura a la bolsa, el billete a Doña Tepo).
// El dibujo original se esconde y lo que viaja es una copia, para no desacomodar lo que está en la mesa.

import { crear, esperar } from '../comun/piezas.ts';

const DURACION_DEL_VUELO_EN_MILISEGUNDOS = 520;
/** La copia llega más chica, como si se metiera en la bolsa. */
const ESCALA_AL_LLEGAR = 0.45;

export interface Vuelo {
  /** El dibujo que sale volando. Al terminar queda escondido (`visibility: hidden`). */
  readonly dibujo: HTMLImageElement;
  /** El elemento a cuyo centro llega. */
  readonly destino: HTMLElement;
  /** El elemento (con `position` distinta de `static`) dentro del que se mueve la copia. */
  readonly escena: HTMLElement;
}

/** Termina cuando la copia llegó (o antes, si el motor cierra el minijuego). */
export async function volar(vuelo: Vuelo, senal: AbortSignal): Promise<void> {
  const salida = vuelo.dibujo.getBoundingClientRect();
  const llegada = vuelo.destino.getBoundingClientRect();
  const escena = vuelo.escena.getBoundingClientRect();

  const copia = crear('img', 'verduleria-volador', vuelo.escena);
  copia.src = vuelo.dibujo.src;
  copia.alt = '';
  copia.style.left = `${salida.left - escena.left}px`;
  copia.style.top = `${salida.top - escena.top}px`;
  copia.style.width = `${salida.width}px`;
  copia.style.height = `${salida.height}px`;
  vuelo.dibujo.style.visibility = 'hidden';

  const avanceEnX = llegada.left + llegada.width / 2 - (salida.left + salida.width / 2);
  const avanceEnY = llegada.top + llegada.height / 2 - (salida.top + salida.height / 2);
  // Leer el ancho obliga al navegador a dibujar la copia en la salida; sin esto no habría recorrido que animar.
  void copia.offsetWidth;
  copia.style.transitionDuration = `${DURACION_DEL_VUELO_EN_MILISEGUNDOS}ms`;
  copia.style.transform = `translate(${avanceEnX}px, ${avanceEnY}px) scale(${ESCALA_AL_LLEGAR})`;

  await esperar(DURACION_DEL_VUELO_EN_MILISEGUNDOS, senal);
  copia.remove();
}
