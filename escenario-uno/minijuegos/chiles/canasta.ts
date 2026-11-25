// La canasta del minijuego «Chiles»: sigue al dedo o al ratón (arrastrando o solo moviendo) y también
// se mueve con las flechas izquierda y derecha.

import type { Marco } from '../comun/marco.ts';
import { animar, crearImagen } from '../comun/piezas.ts';

/** Con las flechas, la canasta cruza todo el cielo en un segundo y medio, más o menos. */
const AVANCE_CON_TECLADO_POR_SEGUNDO = 0.7;
/** Qué parte del alto de la canasta, medida desde arriba, cuenta como su boca. */
const PARTE_DE_LA_BOCA = 0.25;

/** Por dónde entran las cosas a la canasta, en fracciones del cielo (igual que las cosas que caen). */
export interface BocaDeLaCanasta {
  readonly izquierda: number;
  readonly derecha: number;
  readonly altura: number;
}

export interface Canasta {
  /** Aplica el movimiento del teclado de los últimos `segundos`. */
  mover(segundos: number): void;
  boca(): BocaDeLaCanasta;
  /** Un brinco de gusto (al atrapar) o un rebote (cuando cae un estorbo). */
  brincar(): void;
}

/** Pone la canasta en el cielo. Deja de escuchar al jugador cuando se dispara `senalDeLaFase`. */
export function crearCanasta(marco: Marco, cielo: HTMLElement, senalDeLaFase: AbortSignal): Canasta {
  const elemento = crearImagen(marco.contexto, 'chiles_canasta', 'chiles-canasta', cielo);
  /** Dónde está el centro de la canasta a lo ancho del cielo, de 0 a 1. */
  let centro = 0.5;
  /** -1 mientras se aprieta la flecha izquierda, 1 con la derecha, 0 si ninguna. */
  let direccionDelTeclado = 0;

  const ponerEn = (nuevoCentro: number): void => {
    // La canasta nunca se sale del cielo: su centro se queda a media canasta de cada orilla.
    const mediaCanasta = elemento.offsetWidth / 2 / cielo.clientWidth;
    centro = Math.min(1 - mediaCanasta, Math.max(mediaCanasta, nuevoCentro));
    elemento.style.left = `${centro * 100}%`;
  };

  const seguirAlDedo = (evento: PointerEvent): void => {
    const orillas = cielo.getBoundingClientRect();
    ponerEn((evento.clientX - orillas.left) / orillas.width);
  };
  // Se escucha en toda el área (no solo en el cielo) para que el dedo pueda pasar por encima de Doña Igu.
  marco.area.addEventListener('pointermove', seguirAlDedo, { signal: senalDeLaFase });
  marco.area.addEventListener('pointerdown', seguirAlDedo, { signal: senalDeLaFase });

  const alCambiarUnaTecla = (evento: KeyboardEvent, apretada: boolean): void => {
    if (evento.key !== 'ArrowLeft' && evento.key !== 'ArrowRight') return;
    evento.preventDefault(); // para que la página no se deslice con las flechas
    const direccionDeLaTecla = evento.key === 'ArrowLeft' ? -1 : 1;
    if (apretada) {
      direccionDelTeclado = direccionDeLaTecla;
    } else if (direccionDelTeclado === direccionDeLaTecla) {
      direccionDelTeclado = 0;
    }
  };
  document.addEventListener('keydown', (evento) => alCambiarUnaTecla(evento, true), { signal: senalDeLaFase });
  document.addEventListener('keyup', (evento) => alCambiarUnaTecla(evento, false), { signal: senalDeLaFase });

  return {
    mover(segundos) {
      if (direccionDelTeclado === 0) return;
      ponerEn(centro + direccionDelTeclado * AVANCE_CON_TECLADO_POR_SEGUNDO * segundos);
    },
    boca() {
      const mediaCanasta = elemento.offsetWidth / 2 / cielo.clientWidth;
      const altura = (elemento.offsetTop + elemento.offsetHeight * PARTE_DE_LA_BOCA) / cielo.clientHeight;
      return { izquierda: centro - mediaCanasta, derecha: centro + mediaCanasta, altura };
    },
    brincar() {
      animar(elemento, 'chiles-canasta-brinca');
    },
  };
}
