// El contador de aciertos del balero: una fila de marcas, una por cada vez que hay que ensartarlo.
// Cada acierto llena una, para que se vea sin leer cuántos van y cuántos faltan.

import type { Marco } from '../comun/marco.ts';
import { animar, crear, crearImagen } from '../comun/piezas.ts';

export interface Contador {
  /** Llena la siguiente marca vacía. Si ya están todas llenas, no hace nada. */
  llenarSiguiente(): void;
}

export function crearContador(marco: Marco, padre: HTMLElement, marcas: number): Contador {
  const fila = crear('div', 'balero-contador', padre);
  const marcasVacias: HTMLElement[] = [];
  for (let i = 0; i < marcas; i++) {
    const marca = crear('div', 'balero-marca', fila);
    crearImagen(marco.contexto, 'item_balero', 'balero-marca-dibujo', marca);
    marcasVacias.push(marca);
  }

  return {
    llenarSiguiente() {
      const marca = marcasVacias.shift();
      if (marca === undefined) return;
      marca.classList.add('balero-marca-llena');
      animar(marca, 'mj-brinco');
    },
  };
}
