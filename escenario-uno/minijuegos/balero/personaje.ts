// Un personaje que mira el juego desde un lado y reacciona: cambia un momento a su dibujo de «gesto»
// (Don Guajo levanta el ala al hablar, Bobby se pone feliz al contar) y luego vuelve al de reposo.

import type { Marco } from '../comun/marco.ts';
import { crearImagen, esperar } from '../comun/piezas.ts';

const DURACION_DEL_GESTO_EN_MILISEGUNDOS = 1500;

export interface Personaje {
  /** Enseña el dibujo de gesto un momento y luego regresa solo al de reposo. */
  gesticular(): Promise<void>;
}

export interface DibujosDelPersonaje {
  /** Clave del dibujo normal. */
  readonly reposo: string;
  /** Clave del dibujo cuando reacciona. */
  readonly gesto: string;
  /** Clase de CSS de la imagen. */
  readonly clase: string;
}

export function crearPersonaje(marco: Marco, padre: HTMLElement, dibujos: DibujosDelPersonaje): Personaje {
  const imagen = crearImagen(marco.contexto, dibujos.reposo, dibujos.clase, padre);
  let gestosHechos = 0;

  return {
    async gesticular() {
      gestosHechos += 1;
      const esteGesto = gestosHechos;
      imagen.src = marco.contexto.assets.url(dibujos.gesto);
      await esperar(DURACION_DEL_GESTO_EN_MILISEGUNDOS, marco.senal);
      // Si mientras tanto empezó otro gesto, ese se encarga de regresar al reposo cuando le toque.
      if (esteGesto !== gestosHechos) return;
      imagen.src = marco.contexto.assets.url(dibujos.reposo);
    },
  };
}
