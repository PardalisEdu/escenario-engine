// Dónde se guarda la partida. El motor nunca guarda por su cuenta: avisa con el evento `guardar`
// y el sitio decide. Aquí se usa el almacenamiento del navegador (`localStorage`).

import type { Partida } from '../motor.ts';

const CLAVE_DE_LA_PARTIDA = 'pardalis:escenario-uno:partida';

export function guardarPartida(partida: Partida): void {
  try {
    localStorage.setItem(CLAVE_DE_LA_PARTIDA, JSON.stringify(partida));
  } catch (error) {
    // En modo privado o con el almacenamiento lleno no se puede guardar: el juego sigue igual.
    console.warn('[escenario-uno] no se pudo guardar la partida:', error);
  }
}

/** La partida guardada tal como está. El motor la revisa: si está corrupta, la ignora y se empieza de cero. */
export function leerPartidaGuardada(): object | null {
  try {
    const guardada: unknown = JSON.parse(localStorage.getItem(CLAVE_DE_LA_PARTIDA) ?? 'null');
    if (typeof guardada !== 'object') return null;
    return guardada;
  } catch (error) {
    console.warn('[escenario-uno] no se pudo leer la partida guardada:', error);
    return null;
  }
}

export function borrarPartida(): void {
  try {
    localStorage.removeItem(CLAVE_DE_LA_PARTIDA);
  } catch (error) {
    console.warn('[escenario-uno] no se pudo borrar la partida guardada:', error);
  }
}
