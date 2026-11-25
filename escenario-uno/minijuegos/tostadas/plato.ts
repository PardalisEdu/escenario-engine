// El plato de las tostadas «elegidas»: tiene un lugar marcado por cada tostada que falta,
// para que se vea sin leer cuántas van y cuántas faltan. Lo usan las dos partes del minijuego.

import type { Marco } from '../comun/marco.ts';
import { animar, crear, crearImagen } from '../comun/piezas.ts';

export interface Plato {
  /** Pone una tostada entera en el siguiente lugar vacío. Si ya no hay lugar, no hace nada. */
  agregarTostada(): void;
}

/** Dibuja el plato dentro de `padre`, con `lugares` espacios vacíos. */
export function crearPlato(marco: Marco, padre: HTMLElement, lugares: number): Plato {
  const plato = crear('div', 'tostadas-plato', padre);
  const lugaresVacios: HTMLElement[] = [];
  for (let i = 0; i < lugares; i++) {
    lugaresVacios.push(crear('div', 'tostadas-plato-lugar', plato));
  }

  return {
    agregarTostada() {
      const lugar = lugaresVacios.shift();
      if (lugar === undefined) return;
      lugar.classList.add('tostadas-plato-lugar-lleno');
      crearImagen(marco.contexto, 'item_tostada', 'tostadas-plato-tostada', lugar);
      animar(lugar, 'mj-brinco');
    },
  };
}
