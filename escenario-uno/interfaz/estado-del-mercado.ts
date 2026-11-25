// Lee, de la partida que entrega el motor, lo que la interfaz necesita saber del mercado:
// qué cosas del mandado ya se consiguieron, cuánto dinero queda y cuántas estrellas se llevan.
//
// El motor no avisa de cada cambio del estado (solo de los objetivos), así que la interfaz
// vuelve a leer la partida cada cierto tiempo. Ver interfaz.ts.

import type { Juego } from '../motor.ts';

export const NIVEL_DEL_MERCADO = 'mercado';

export interface EstadoDelMercado {
  /** Los objetivos ya cumplidos, por nombre: `verduras`, `tostadas`, `maiz`, `chiles`. */
  readonly conseguido: ReadonlySet<string>;
  readonly dinero: number;
  readonly estrellas: number;
}

const OBJETIVOS = ['verduras', 'tostadas', 'maiz', 'chiles'];
const DINERO_AL_EMPEZAR = 100;

export function leerEstadoDelMercado(juego: Juego): EstadoDelMercado {
  const niveles = juego.guardar().niveles;
  const conseguido = new Set<string>();
  if (!Object.hasOwn(niveles, NIVEL_DEL_MERCADO)) {
    return { conseguido, dinero: DINERO_AL_EMPEZAR, estrellas: 0 };
  }
  const variables = niveles[NIVEL_DEL_MERCADO]!.estado; // `hasOwn` acaba de comprobar que existe

  for (const objetivo of OBJETIVOS) {
    if (Object.hasOwn(variables, objetivo) && Boolean(variables[objetivo])) {
      conseguido.add(objetivo);
    }
  }
  return {
    conseguido,
    dinero: leerNumero(variables, 'dinero', DINERO_AL_EMPEZAR),
    estrellas: leerNumero(variables, 'estrellas', 0),
  };
}

function leerNumero(variables: Readonly<Record<string, unknown>>, nombre: string, porDefecto: number): number {
  if (!Object.hasOwn(variables, nombre)) return porDefecto;
  const valor = variables[nombre];
  if (typeof valor !== 'number') return porDefecto;
  return valor;
}
