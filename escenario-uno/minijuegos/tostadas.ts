// Minijuego «Tostadas»: el puesto de Don Armando, el armadillo.
//
// Tiene tres partes:
//   1. Buscar en la mesa las tres tostadas que están enteras (tostadas/buscar-enteras.ts).
//   2. Sacarlas de la canasta despacito, para que no truenen (tostadas/sacar-despacito.ts).
//   3. Pagar contando monedas (comun/cobro.ts).
//
// Nunca castiga: tocar una tostada rota o tronar una solo resta estrellas, y siempre se puede terminar.
//
// Configuración que le pasa el nivel:
//   { "precio": 15 }

import type { Minijuego } from '../motor.ts';
import { cobrar } from './comun/cobro.ts';
import { abrirMarco } from './comun/marco.ts';
import { leerNumero } from './comun/piezas.ts';
import { armarPremio, mostrarResultado } from './comun/resultado.ts';
import { buscarEnteras } from './tostadas/buscar-enteras.ts';
import { sacarDespacito } from './tostadas/sacar-despacito.ts';

const PRECIO_POR_DEFECTO = 15;
/** Cuántas tostadas se compran. El dibujo `item_tostadas` y las frases hablan de tres. */
const TOSTADAS_POR_COMPRAR = 3;
/** Con tan pocos tropiezos (toques a una rota más tostadas tronadas) se ganan las tres estrellas. */
const TROPIEZOS_PARA_TRES_ESTRELLAS = 1;
const TROPIEZOS_PARA_DOS_ESTRELLAS = 4;

export const Tostadas: Minijuego = (contexto) => {
  const { marco, resultado } = abrirMarco(contexto, 'naranja');
  const precio = leerNumero(contexto.config, 'precio', PRECIO_POR_DEFECTO);

  void jugar();
  return resultado;

  async function jugar(): Promise<void> {
    const toquesEquivocados = await buscarEnteras(marco, TOSTADAS_POR_COMPRAR);
    if (marco.senal.aborted) return;
    const tostadasTronadas = await sacarDespacito(marco, TOSTADAS_POR_COMPRAR);
    if (marco.senal.aborted) return;
    const pago = await cobrar(marco, { precio, compra: 'item_tostadas' });
    if (!pago) return;

    const estrellas = contarEstrellas(toquesEquivocados + tostadasTronadas);
    await mostrarResultado(marco, { estrellas, cosas: ['item_tostadas'], frase: '¡Tres tostadas enteritas!' });
    marco.terminar({ exito: true, otorgar: armarPremio(marco, { loPropio: { tostadas: true }, precio, estrellas }) });
  }
};

/** De 1 a 3 estrellas según cuántos tropiezos hubo. Una estrella también es una felicitación. */
function contarEstrellas(tropiezos: number): number {
  if (tropiezos <= TROPIEZOS_PARA_TRES_ESTRELLAS) return 3;
  if (tropiezos <= TROPIEZOS_PARA_DOS_ESTRELLAS) return 2;
  return 1;
}
