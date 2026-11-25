// Las cosas que caen del cielo en el minijuego «Chiles»: cómo se crean, cómo caen girando y cómo se van.
//
// Las posiciones se guardan como fracciones del «cielo» (0 es arriba o la orilla izquierda; 1 es el piso o la
// orilla derecha). Así el juego se comporta igual en una pantalla grande que en un teléfono.

import type { Marco } from '../comun/marco.ts';
import { crear, crearImagen, enteroAlAzar } from '../comun/piezas.ts';

export type TipoDeChile = 'guajillo' | 'ancho';

export const TIPOS_DE_CHILE: readonly TipoDeChile[] = ['guajillo', 'ancho'];

export const DIBUJO_DE_CADA_CHILE: Readonly<Record<TipoDeChile, string>> = {
  guajillo: 'item_chile_guajillo',
  ancho: 'item_chile_ancho',
};

/** Cosas del puesto que también salieron volando pero no hacen falta: si caen en la canasta, rebotan. */
const DIBUJOS_DE_LOS_ESTORBOS = ['item_jitomate', 'item_chile_verde', 'item_flor'];

/** Dónde aparece una cosa: un poco arriba del cielo, para que entre cayendo y no de golpe. */
const ALTURA_AL_APARECER = -0.12;
/** Las cosas no aparecen pegadas a las orillas: ahí la canasta no alcanza a ponerse debajo. */
const ORILLA_LIBRE_EN_CENTESIMAS = 10;
/** Caída lenta, para 6 años: una cosa tarda entre 5 y 6 segundos en llegar al piso. */
const CAIDA_MINIMA_EN_MILESIMAS_POR_SEGUNDO = 180;
const CAIDA_MAXIMA_EN_MILESIMAS_POR_SEGUNDO = 220;
const GIRO_MAXIMO_EN_GRADOS_POR_SEGUNDO = 140;

export interface CosaQueCae {
  readonly elemento: HTMLElement;
  readonly imagen: HTMLImageElement;
  /** El chile que es, o `null` si es un estorbo. */
  readonly chile: TipoDeChile | null;
  /** Dónde está su centro a lo ancho del cielo, de 0 a 1. No cambia: las cosas caen derecho. */
  readonly x: number;
  /** Altura de su centro, de 0 (arriba) a 1 (el piso). */
  y: number;
  /** Fracción del alto del cielo que baja cada segundo. */
  readonly caidaPorSegundo: number;
  giroEnGrados: number;
  readonly giroPorSegundo: number;
  /** `true` cuando ya bajó más que la boca de la canasta: ya no se puede atrapar. */
  yaPasoLaCanasta: boolean;
}

/** Suelta una cosa nueva en lo alto del cielo. Con `chile` en `null` suelta un estorbo al azar. */
export function soltarCosa(marco: Marco, cielo: HTMLElement, chile: TipoDeChile | null): CosaQueCae {
  const elemento = crear('div', 'chiles-cosa', cielo);
  const imagen = crearImagen(marco.contexto, dibujoDe(chile), 'chiles-cosa-dibujo', elemento);
  const cosa: CosaQueCae = {
    elemento,
    imagen,
    chile,
    x: enteroAlAzar(ORILLA_LIBRE_EN_CENTESIMAS, 100 - ORILLA_LIBRE_EN_CENTESIMAS) / 100,
    y: ALTURA_AL_APARECER,
    caidaPorSegundo: enteroAlAzar(CAIDA_MINIMA_EN_MILESIMAS_POR_SEGUNDO, CAIDA_MAXIMA_EN_MILESIMAS_POR_SEGUNDO) / 1000,
    giroEnGrados: enteroAlAzar(0, 359),
    giroPorSegundo: enteroAlAzar(-GIRO_MAXIMO_EN_GRADOS_POR_SEGUNDO, GIRO_MAXIMO_EN_GRADOS_POR_SEGUNDO),
    yaPasoLaCanasta: false,
  };
  // El tipo queda en el elemento para que el CSS (y quien pruebe el juego) sepa qué es cada cosa.
  elemento.dataset.chile = chile ?? 'estorbo';
  elemento.style.left = `${cosa.x * 100}%`;
  dibujarCosa(cosa);
  return cosa;
}

/** Hace caer y girar una cosa durante `segundos`. */
export function moverCosa(cosa: CosaQueCae, segundos: number): void {
  cosa.y += cosa.caidaPorSegundo * segundos;
  cosa.giroEnGrados += cosa.giroPorSegundo * segundos;
  dibujarCosa(cosa);
}

/** Quita una cosa con una animación corta de CSS (`chiles-cosa-atrapada`, `-rebota` o `-se-va`). */
export function despedirCosa(cosa: CosaQueCae, claseDeAnimacion: string): void {
  cosa.elemento.classList.add(claseDeAnimacion);
  cosa.elemento.addEventListener('animationend', () => cosa.elemento.remove(), { once: true });
}

function dibujarCosa(cosa: CosaQueCae): void {
  cosa.elemento.style.top = `${cosa.y * 100}%`;
  cosa.imagen.style.rotate = `${cosa.giroEnGrados}deg`;
}

function dibujoDe(chile: TipoDeChile | null): string {
  if (chile !== null) return DIBUJO_DE_CADA_CHILE[chile];
  const indice = enteroAlAzar(0, DIBUJOS_DE_LOS_ESTORBOS.length - 1);
  return DIBUJOS_DE_LOS_ESTORBOS[indice]!; // `indice` siempre está dentro de la lista
}
