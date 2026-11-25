// Los premios de la «Rascadita»: cuáles son, qué tan seguido sale cada uno y la tabla que los enseña.
// Siempre sale alguno: no existe el boleto sin premio.

import type { Marco } from '../comun/marco.ts';
import { crear, crearImagen } from '../comun/piezas.ts';

export interface Premio {
  /** El valor que se le concede al nivel en la variable `premio`. */
  readonly nombre: 'globo' | 'dulce' | 'canica' | 'trompo' | 'pizarron';
  /** Clave del dibujo. */
  readonly dibujo: string;
  /** De cada 100 boletos, cuántos traen este premio. Entre todos suman 100. */
  readonly boletosDeCien: number;
  /** Lo que dice la voz al revelarlo. */
  readonly anuncio: string;
  /** La palabra que repite Bobby en inglés. */
  readonly enIngles: string;
}

/** Del premio mayor al de consuelo: en este orden se dibujan en la tabla. */
const PREMIOS: readonly Premio[] = [
  {
    nombre: 'pizarron',
    dibujo: 'premio_pizarron',
    boletosDeCien: 5,
    anuncio: '¡El premio mayor! ¡Ganaste un pizarrón!',
    enIngles: 'blackboard!',
  },
  { nombre: 'trompo', dibujo: 'premio_trompo', boletosDeCien: 15, anuncio: '¡Ganaste un trompo!', enIngles: 'spinning top!' },
  { nombre: 'canica', dibujo: 'premio_canica', boletosDeCien: 20, anuncio: '¡Ganaste una canica!', enIngles: 'marble!' },
  { nombre: 'dulce', dibujo: 'premio_dulce', boletosDeCien: 25, anuncio: '¡Ganaste un dulce!', enIngles: 'candy!' },
  {
    nombre: 'globo',
    dibujo: 'premio_globo',
    boletosDeCien: 35,
    anuncio: '¡Un globo! Está desinflado, pero es tuyo.',
    enIngles: 'balloon!',
  },
];
const PREMIO_MAYOR = 'pizarron';

/** Elige el premio del boleto al azar, respetando qué tan seguido sale cada uno. */
export function sortearPremio(): Premio {
  let boleto = Math.random() * 100;
  for (const premio of PREMIOS) {
    boleto -= premio.boletosDeCien;
    if (boleto < 0) return premio;
  }
  // Solo se llega aquí si los premios no suman 100: se entrega el último (el globo) y nadie se queda sin premio.
  return PREMIOS[PREMIOS.length - 1]!; // la lista nunca está vacía
}

export interface TablaDePremios {
  /** El renglón de la tabla que enseña ese premio, para resaltarlo cuando sale. */
  filaDe(premio: Premio): HTMLElement;
}

/** Dibuja la tabla: el premio mayor arriba, grande y con estrellas; los demás abajo, en dos columnas. */
export function crearTablaDePremios(marco: Marco, padre: HTMLElement): TablaDePremios {
  const tabla = crear('div', 'rascadita-tabla', padre);
  const filas = new Map<string, HTMLElement>();

  for (const premio of PREMIOS) {
    const fila = crear('div', 'rascadita-fila', tabla);
    filas.set(premio.nombre, fila);
    if (premio.nombre !== PREMIO_MAYOR) {
      crearImagen(marco.contexto, premio.dibujo, 'rascadita-fila-dibujo', fila);
      continue;
    }
    // El premio mayor va entre dos estrellas, para que se note sin tener que leer nada.
    fila.classList.add('rascadita-fila-mayor');
    crearImagen(marco.contexto, 'item_estrella', 'rascadita-fila-estrella', fila);
    crearImagen(marco.contexto, premio.dibujo, 'rascadita-fila-dibujo', fila);
    crearImagen(marco.contexto, 'item_estrella', 'rascadita-fila-estrella', fila);
  }

  return {
    filaDe(premio) {
      return filas.get(premio.nombre) ?? tabla;
    },
  };
}
