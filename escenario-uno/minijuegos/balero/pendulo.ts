// El vaivén del barrilito: se mece como péndulo bajo el palito hasta que el jugador toca la pantalla
// (o aprieta espacio o Enter). En ese momento se detiene y avisa en qué ángulo iba.

import { AMPLITUD_EN_GRADOS, TOLERANCIA_EN_GRADOS } from './juguete.ts';
import type { Juguete } from './juguete.ts';

const TECLAS_QUE_LANZAN = [' ', 'Enter'];
const VUELTA_COMPLETA_EN_RADIANES = 2 * Math.PI;

export interface Vaiven {
  /** De qué lado empieza a mecerse: 1 = desde la derecha, -1 = desde la izquierda. */
  readonly lado: number;
  /** Cuánto tarda en ir y volver. Mientras más corto, más rápido se mece. */
  readonly periodoEnMilisegundos: number;
  /** Donde se escucha el toque del jugador. */
  readonly zonaDeToque: HTMLElement;
  /** Se dispara si el minijuego se cierra. */
  readonly senal: AbortSignal;
}

/**
 * Mece el barrilito hasta que el jugador toca. Devuelve el ángulo (en grados desde el centro) en el que iba.
 * Si el minijuego se cierra antes, termina con el último ángulo dibujado.
 */
export function mecerHastaElToque(juguete: Juguete, vaiven: Vaiven): Promise<number> {
  return new Promise((terminar) => {
    const inicio = performance.now();
    let anguloEnGrados = vaiven.lado * AMPLITUD_EN_GRADOS;
    // Los oyentes solo viven mientras el barrilito se mece: después, los toques no hacen nada.
    const finDelVaiven = new AbortController();
    const senal = AbortSignal.any([vaiven.senal, finDelVaiven.signal]);
    let cuadroPedido = requestAnimationFrame(dibujarCuadro);

    function dibujarCuadro(): void {
      const vueltas = (performance.now() - inicio) / vaiven.periodoEnMilisegundos;
      // Empieza en un extremo (coseno de 0 = 1), como un columpio que se suelta desde arriba.
      anguloEnGrados = vaiven.lado * AMPLITUD_EN_GRADOS * Math.cos(vueltas * VUELTA_COMPLETA_EN_RADIANES);
      juguete.colgar(anguloEnGrados);
      juguete.encenderZona(Math.abs(anguloEnGrados) <= TOLERANCIA_EN_GRADOS);
      cuadroPedido = requestAnimationFrame(dibujarCuadro);
    }

    function detener(): void {
      cancelAnimationFrame(cuadroPedido);
      finDelVaiven.abort();
      juguete.encenderZona(false);
      terminar(anguloEnGrados);
    }

    vaiven.zonaDeToque.addEventListener('pointerdown', detener, { signal: senal });
    document.addEventListener(
      'keydown',
      (evento) => {
        // `repeat` es verdadero cuando la tecla se deja apretada: eso no cuenta como otro intento.
        if (!TECLAS_QUE_LANZAN.includes(evento.key) || evento.repeat) return;
        evento.preventDefault();
        detener();
      },
      { signal: senal },
    );
    vaiven.senal.addEventListener('abort', detener, { once: true, signal: finDelVaiven.signal });
  });
}
