// Envuelve cada minijuego para saber cuándo empieza y cuándo termina.
// El motor no avisa de eso con un evento, y la interfaz del sitio necesita esconderse mientras se juega uno.

import type { Minijuego } from '../motor.ts';

export function conAvisos(
  minijuegos: Readonly<Record<string, Minijuego>>,
  alCambiar: (hayMinijuego: boolean) => void,
): Record<string, Minijuego> {
  const envueltos: Record<string, Minijuego> = {};
  for (const nombre of Object.keys(minijuegos)) {
    const minijuego = minijuegos[nombre]!; // `nombre` viene de `Object.keys(minijuegos)`
    envueltos[nombre] = async (contexto) => {
      alCambiar(true);
      try {
        return await minijuego(contexto);
      } finally {
        alCambiar(false);
      }
    };
  }
  return envueltos;
}
