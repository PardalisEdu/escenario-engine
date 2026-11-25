// El confeti de la «Rascadita»: papelitos de colores que caen una vez. Todo el movimiento es de CSS
// (`rascadita-confeti` en rascadita.css); aquí solo se reparten los papelitos con su color y su retraso.

import { crear, enteroAlAzar } from '../comun/piezas.ts';

const PAPELITOS = 36;
const COLORES_DEL_CONFETI = ['#e8338b', '#17b5b0', '#f58220', '#7b3fa0', '#3aa655', '#fff6e0'];
const RETRASO_MAXIMO_EN_MILISEGUNDOS = 500;
const GIRO_MAXIMO_EN_GRADOS = 360;

/** Suelta el confeti sobre `padre`. Los papelitos se quedan (invisibles) hasta que se borra la pantalla. */
export function lanzarConfeti(padre: HTMLElement): void {
  const lluvia = crear('div', 'rascadita-confeti', padre);
  for (let i = 0; i < PAPELITOS; i++) {
    const papelito = crear('div', 'rascadita-papelito', lluvia);
    const color = COLORES_DEL_CONFETI[i % COLORES_DEL_CONFETI.length]!; // el residuo siempre está dentro de la lista
    papelito.style.background = color;
    papelito.style.left = `${enteroAlAzar(0, 100)}%`;
    papelito.style.animationDelay = `${enteroAlAzar(0, RETRASO_MAXIMO_EN_MILISEGUNDOS)}ms`;
    papelito.style.rotate = `${enteroAlAzar(0, GIRO_MAXIMO_EN_GRADOS)}deg`;
  }
}
