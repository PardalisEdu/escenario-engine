// La pantalla del final: aparece cuando la familia ya está comiendo el pozole.
// Enseña las estrellas que se juntaron, las palabras en inglés que se aprendieron y un botón para jugar otra vez.

import { crearFichaDePalabra } from './cuaderno-de-palabras.ts';
import type { Palabra } from './cuaderno-de-palabras.ts';
import { crear, crearDibujoDeCosa, crearDibujoDePersonaje } from './elementos.ts';

export interface DatosDelFinal {
  readonly estrellas: number;
  readonly palabras: readonly Palabra[];
  /** Qué hacer cuando el jugador toca «jugar otra vez». */
  readonly alJugarOtraVez: () => void;
}

export function mostrarPantallaDelFinal(padre: HTMLElement, datos: DatosDelFinal): HTMLElement {
  const pantalla = crear('div', 'final', padre);
  const tarjeta = crear('div', 'final-tarjeta', pantalla);

  const primos = crear('div', 'final-primos', tarjeta);
  crearDibujoDePersonaje('pardi_feliz', 'final-personaje', primos);
  crearDibujoDeCosa('item_pozole', 'final-pozole', primos);
  crearDibujoDePersonaje('bobby_feliz', 'final-personaje final-personaje-volteado', primos);

  const estrellas = crear('div', 'final-estrellas', tarjeta);
  crearDibujoDeCosa('item_estrella', 'final-estrella', estrellas);
  crear('span', 'final-numero', estrellas).textContent = String(datos.estrellas);

  if (datos.palabras.length > 0) {
    const palabras = crear('div', 'final-palabras', tarjeta);
    for (const palabra of datos.palabras) {
      palabras.append(crearFichaDePalabra(palabra));
    }
  }

  const otraVez = crear('button', 'final-otra-vez', tarjeta);
  otraVez.type = 'button';
  otraVez.setAttribute('aria-label', 'Jugar otra vez');
  otraVez.textContent = '↻';
  otraVez.addEventListener('click', () => datos.alJugarOtraVez(), { once: true });

  return pantalla;
}
