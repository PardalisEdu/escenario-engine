// Todos los minijuegos del Escenario Uno, con el nombre que usan los pasos `juego` de los niveles.
// Para agregar uno: escríbelo en su archivo, impórtalo aquí y agrégalo a la lista.

import type { Minijuego } from '../motor.ts';
import { Balero } from './balero.ts';
import { Cartas } from './cartas.ts';
import { Chiles } from './chiles.ts';
import { Cobro } from './cobro.ts';
import { Rascadita } from './rascadita.ts';
import { Tostadas } from './tostadas.ts';
import { Verduleria } from './verduleria.ts';

export const MINIJUEGOS: Readonly<Record<string, Minijuego>> = {
  Balero,
  Cartas,
  Chiles,
  Cobro,
  Rascadita,
  Tostadas,
  Verduleria,
};
