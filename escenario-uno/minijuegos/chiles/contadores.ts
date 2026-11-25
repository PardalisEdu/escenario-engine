// Los dos contadores del minijuego «Chiles»: el dibujo de cada chile y 5 marcas que se van llenando.

import type { Marco } from '../comun/marco.ts';
import { animar, crear, crearImagen } from '../comun/piezas.ts';
import { DIBUJO_DE_CADA_CHILE, TIPOS_DE_CHILE } from './lluvia.ts';
import type { TipoDeChile } from './lluvia.ts';

/** Cuántos chiles de cada tipo hay que atrapar. */
export const CHILES_POR_TIPO = 5;

export interface Contadores {
  /** Llena una marca más de ese chile. */
  sumar(chile: TipoDeChile): void;
  cuantos(chile: TipoDeChile): number;
  /** `true` si a ese chile todavía le faltan marcas por llenar. */
  falta(chile: TipoDeChile): boolean;
}

export function crearContadores(marco: Marco, padre: HTMLElement): Contadores {
  const fila = crear('div', 'chiles-contadores', padre);
  const atrapados: Record<TipoDeChile, number> = { guajillo: 0, ancho: 0 };
  const marcas: Record<TipoDeChile, HTMLElement[]> = { guajillo: [], ancho: [] };
  const cajas: Record<TipoDeChile, HTMLElement> = {
    guajillo: crear('div', 'chiles-contador chiles-contador-guajillo', fila),
    ancho: crear('div', 'chiles-contador chiles-contador-ancho', fila),
  };

  for (const chile of TIPOS_DE_CHILE) {
    crearImagen(marco.contexto, DIBUJO_DE_CADA_CHILE[chile], 'chiles-contador-dibujo', cajas[chile]);
    for (let i = 0; i < CHILES_POR_TIPO; i++) {
      marcas[chile].push(crear('div', 'chiles-marca', cajas[chile]));
    }
  }

  return {
    sumar(chile) {
      const marca = marcas[chile][atrapados[chile]];
      if (marca === undefined) return; // ya estaban llenas las cinco
      atrapados[chile] += 1;
      marca.classList.add('chiles-marca-llena');
      animar(cajas[chile], 'mj-brinco');
      cajas[chile].classList.toggle('chiles-contador-completo', atrapados[chile] === CHILES_POR_TIPO);
    },
    cuantos: (chile) => atrapados[chile],
    falta: (chile) => atrapados[chile] < CHILES_POR_TIPO,
  };
}
