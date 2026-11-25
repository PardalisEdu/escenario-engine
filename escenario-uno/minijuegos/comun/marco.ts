// El marco que comparten todos los minijuegos: el fondo, el botón de salir, la franja de arriba donde
// se muestra qué hay que hacer (con dibujos) y la voz que lo dice.
//
// Reglas de Pardalis que el marco cuida por todos:
// - Nada requiere leer: cada indicación se dice en voz alta y se acompaña con dibujos.
// - Nunca castigar: salir con la X no es perder; el nivel responde con un diálogo amable.

import type { ContextoDeMinijuego, ResultadoDeMinijuego } from '../../motor.ts';
import { crear, crearImagen } from './piezas.ts';

/** Los colores de fondo disponibles; cada puesto usa el suyo. */
export type Tema = 'verde' | 'naranja' | 'rojo' | 'guinda' | 'amarillo' | 'morado' | 'turquesa';

export interface Marco {
  readonly contexto: ContextoDeMinijuego;
  /** Donde el minijuego dibuja lo suyo. Ocupa toda la pantalla menos la franja de arriba. */
  readonly area: HTMLElement;
  /** Se dispara cuando el minijuego debe detenerse: lo cerró el motor o ya terminó. */
  readonly senal: AbortSignal;
  /** Dice una frase en voz alta (en español, salvo que se pida inglés). */
  decir(texto: string, idioma?: 'es' | 'en'): void;
  /**
   * Muestra en la franja de arriba qué hay que hacer: unos dibujos (claves de assets) y lo dice en voz alta.
   * El texto no se escribe en pantalla: solo se oye.
   */
  indicar(frase: string, dibujos?: readonly string[]): void;
  /** Toca un sonido corto de los assets del nivel. */
  sonar(clave: string): void;
  /** Termina el minijuego con un resultado. Solo cuenta la primera vez que se llama. */
  terminar(resultado: ResultadoDeMinijuego): void;
}

/**
 * Prepara el marco dentro del elemento que entrega el motor y devuelve, junto con él,
 * la promesa que el minijuego debe devolverle al motor.
 */
export function abrirMarco(contexto: ContextoDeMinijuego, tema: Tema): { marco: Marco; resultado: Promise<ResultadoDeMinijuego> } {
  const { elemento } = contexto;
  elemento.classList.add('mj', `mj-tema-${tema}`);

  const franja = crear('div', 'mj-franja', elemento);
  const dibujosDeLaFranja = crear('div', 'mj-franja-dibujos', franja);
  const area = crear('div', 'mj-area', elemento);

  let avisarAlMotor: (resultado: ResultadoDeMinijuego) => void = () => {};
  const resultado = new Promise<ResultadoDeMinijuego>((resolver) => {
    avisarAlMotor = resolver;
  });
  let yaTermino = false;
  const terminar = (resultadoFinal: ResultadoDeMinijuego): void => {
    if (yaTermino) return;
    yaTermino = true;
    avisarAlMotor(resultadoFinal);
  };

  // Salir sin terminar: una X, que no necesita texto.
  const salir = crear('button', 'mj-salir', elemento);
  salir.type = 'button';
  salir.textContent = '✕';
  salir.setAttribute('aria-label', 'Salir');
  salir.addEventListener('click', () => terminar({ exito: false }), { signal: contexto.senal });

  // Si el motor cierra el minijuego (por ejemplo, al destruir el juego), se termina sin premio.
  contexto.senal.addEventListener('abort', () => terminar({ exito: false }), { once: true });

  const marco: Marco = {
    contexto,
    area,
    senal: contexto.senal,
    decir(texto, idioma = 'es') {
      contexto.audio.decir(texto, idioma);
    },
    indicar(frase, dibujos = []) {
      dibujosDeLaFranja.replaceChildren();
      for (const clave of dibujos) {
        crearImagen(contexto, clave, 'mj-franja-dibujo', dibujosDeLaFranja);
      }
      franja.classList.toggle('mj-franja-vacia', dibujos.length === 0);
      contexto.audio.decir(frase, 'es');
    },
    sonar(clave) {
      contexto.audio.tocar(clave);
    },
    terminar,
  };
  return { marco, resultado };
}
