// Las fortunas de Madame Lula. Todas son buenas noticias: es la regla del puesto.
// De estas se eligen tres al azar, una por carta.

export interface Fortuna {
  /** Clave del dibujo del símbolo que aparece al voltear la carta. */
  readonly dibujo: string;
  /** Lo que dice Madame Lula. */
  readonly frase: string;
  /** El símbolo en inglés, para Bobby. */
  readonly enIngles: string;
}

export const FORTUNAS: readonly Fortuna[] = [
  { dibujo: 'carta_sol', frase: 'Hoy vas a tener un día brillante.', enIngles: 'sun!' },
  { dibujo: 'item_estrella', frase: 'Vas a aprender algo nuevo.', enIngles: 'star!' },
  { dibujo: 'carta_corazon', frase: 'Tu familia te quiere muchísimo.', enIngles: 'heart!' },
  { dibujo: 'carta_trebol', frase: 'Vas a tener muy buena suerte.', enIngles: 'clover!' },
  { dibujo: 'carta_arcoiris', frase: 'Algo muy bonito te espera.', enIngles: 'rainbow!' },
  { dibujo: 'item_pozole', frase: 'Hoy vas a comer algo delicioso.', enIngles: 'yummy!' },
];
