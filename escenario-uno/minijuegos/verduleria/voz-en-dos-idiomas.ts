// La voz de la verdulería: dice una frase en español y, un momento después, el primo Bobby repite
// la palabra clave en inglés.
//
// Una voz nueva corta a la anterior. Por eso cada frase toma un «turno»: si el jugador toca otra cosa
// antes de que llegue el inglés, ese inglés ya no se dice (cortaría la frase nueva a la mitad).

import type { Marco } from '../comun/marco.ts';
import { esperar } from '../comun/piezas.ts';

/** Lo que tarda la voz en arrancar, sin importar el largo de la frase. */
const PAUSA_BASE_ANTES_DEL_INGLES_EN_MILISEGUNDOS = 700;
/** Tiempo aproximado que tarda la voz en decir cada letra de la frase en español. */
const MILISEGUNDOS_POR_LETRA = 65;

export interface VozEnDosIdiomas {
  /** Dice una frase en español. Después de que el motor cerró el minijuego ya no dice nada. */
  decir(frase: string): void;
  /** Dice la frase en español y, cuando termina, la palabra en inglés. */
  decirEnDosIdiomas(enEspanol: string, enIngles: string): Promise<void>;
}

export function crearVozEnDosIdiomas(marco: Marco): VozEnDosIdiomas {
  let turno = 0;

  function decir(frase: string): void {
    if (marco.senal.aborted) return;
    turno += 1;
    marco.decir(frase);
  }

  async function decirEnDosIdiomas(enEspanol: string, enIngles: string): Promise<void> {
    decir(enEspanol);
    const miTurno = turno;
    const pausa = PAUSA_BASE_ANTES_DEL_INGLES_EN_MILISEGUNDOS + enEspanol.length * MILISEGUNDOS_POR_LETRA;
    await esperar(pausa, marco.senal);

    const yaHabloAlguienMas = miTurno !== turno;
    if (marco.senal.aborted || yaHabloAlguienMas) return;
    marco.decir(enIngles, 'en');
  }

  return { decir, decirEnDosIdiomas };
}
