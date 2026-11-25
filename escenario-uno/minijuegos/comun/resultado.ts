// La tarjeta del final de cada minijuego: enseña «cuánto sacamos» con estrellas y con los dibujos
// de lo que nos llevamos. Siempre es una felicitación: una estrella también se celebra.

import type { ValorDeEstado } from '../../motor.ts';
import type { Marco } from './marco.ts';
import { crear, crearImagen, esperar } from './piezas.ts';

/** Cuántas estrellas hay como máximo en una tarjeta. */
export const ESTRELLAS_MAXIMAS = 3;

const PAUSA_ENTRE_ESTRELLAS_EN_MILISEGUNDOS = 380;

export interface LoQueSacamos {
  /** De 1 a 3. Nunca 0: quien termina siempre se lleva al menos una. */
  readonly estrellas: number;
  /** Claves de los dibujos de lo que nos llevamos (por ejemplo `item_lechuga`). */
  readonly cosas: readonly string[];
  /** Lo que se dice al mostrar la tarjeta. */
  readonly frase: string;
}

/** Muestra la tarjeta y termina cuando el jugador toca la palomita para seguir. */
export async function mostrarResultado(marco: Marco, sacamos: LoQueSacamos): Promise<void> {
  const velo = crear('div', 'mj-velo', marco.contexto.elemento);
  const tarjeta = crear('div', 'mj-tarjeta', velo);

  const filaDeEstrellas = crear('div', 'mj-estrellas', tarjeta);
  const estrellas: HTMLImageElement[] = [];
  for (let i = 0; i < ESTRELLAS_MAXIMAS; i++) {
    estrellas.push(crearImagen(marco.contexto, 'item_estrella_vacia', 'mj-estrella', filaDeEstrellas));
  }

  const filaDeCosas = crear('div', 'mj-cosas', tarjeta);
  for (const clave of sacamos.cosas) {
    crearImagen(marco.contexto, clave, 'mj-cosa', filaDeCosas);
  }

  const seguir = crear('button', 'mj-boton mj-boton-grande', tarjeta);
  seguir.type = 'button';
  seguir.setAttribute('aria-label', 'Seguir');
  crearImagen(marco.contexto, 'item_palomita', 'mj-boton-dibujo', seguir);

  marco.decir(sacamos.frase);
  const ganadas = Math.min(ESTRELLAS_MAXIMAS, Math.max(1, Math.round(sacamos.estrellas)));
  for (let i = 0; i < ganadas; i++) {
    await esperar(PAUSA_ENTRE_ESTRELLAS_EN_MILISEGUNDOS, marco.senal);
    const estrella = estrellas[i]!; // `i` es menor que ESTRELLAS_MAXIMAS, y hay una imagen por cada una
    estrella.src = marco.contexto.assets.url('item_estrella');
    estrella.classList.add('mj-estrella-ganada');
    marco.sonar('sfx_estrella');
  }

  await new Promise<void>((seguirAdelante) => {
    seguir.addEventListener('click', () => seguirAdelante(), { once: true, signal: marco.senal });
    marco.senal.addEventListener('abort', () => seguirAdelante(), { once: true });
  });
}

/**
 * Lo que un minijuego le concede al estado del nivel al terminar bien: lo propio (por ejemplo `tostadas: true`),
 * el dinero que queda después de pagar y las estrellas que se suman a las que ya se tenían.
 */
export function armarPremio(
  marco: Marco,
  premio: { loPropio: Readonly<Record<string, ValorDeEstado>>; precio: number; estrellas: number },
): Record<string, ValorDeEstado> {
  const otorgar: Record<string, ValorDeEstado> = { ...premio.loPropio };
  otorgar.estrellas = leerNumeroDelEstado(marco, 'estrellas') + premio.estrellas;
  if (premio.precio > 0) {
    otorgar.dinero = Math.max(0, leerNumeroDelEstado(marco, 'dinero') - premio.precio);
  }
  return otorgar;
}

/** El valor de una variable numérica del nivel, o 0 si todavía no tiene. */
export function leerNumeroDelEstado(marco: Marco, nombre: string): number {
  const valor = marco.contexto.estado.obtener(nombre);
  if (typeof valor !== 'number') return 0;
  return valor;
}
