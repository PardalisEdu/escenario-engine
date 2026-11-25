// Minijuego «Chiles»: Doña Igu estornudó y los chiles de su puesto salieron volando.
//
// Fase 1: caen chiles girando y el jugador los atrapa con una canasta (dedo, ratón o flechas) hasta juntar
//         5 guajillos y 5 anchos. Lo que cae al piso solo desaparece: nunca se pierde.
// Fase 2: se pagan los chiles contando monedas.
// Final:  la tarjeta de estrellas, según cuántos chiles buenos se fueron al piso (siempre al menos una).
//
// Configuración que le pasa el nivel:
//   { "precio": 20 }

import type { Minijuego } from '../motor.ts';
import { atraparLosChiles } from './chiles/atrapar.ts';
import { cobrar } from './comun/cobro.ts';
import { abrirMarco } from './comun/marco.ts';
import { esperar, leerNumero } from './comun/piezas.ts';
import { armarPremio, mostrarResultado } from './comun/resultado.ts';

const PRECIO_POR_DEFECTO = 20;
const PAUSA_PARA_CELEBRAR_EN_MILISEGUNDOS = 1600;

/** Con estos chiles caídos (o menos) todavía se ganan tres estrellas: la medida es generosa a propósito. */
const CAIDOS_PARA_TRES_ESTRELLAS = 4;
const CAIDOS_PARA_DOS_ESTRELLAS = 10;

export const Chiles: Minijuego = (contexto) => {
  const { marco, resultado } = abrirMarco(contexto, 'guinda');
  const precio = leerNumero(contexto.config, 'precio', PRECIO_POR_DEFECTO);

  void jugar();
  return resultado;

  async function jugar(): Promise<void> {
    const chilesCaidos = await atraparLosChiles(marco);
    if (chilesCaidos === null) return;

    marco.sonar('sfx_bien');
    marco.decir('¡Los atrapaste todos!');
    await esperar(PAUSA_PARA_CELEBRAR_EN_MILISEGUNDOS, marco.senal);

    const pago = await cobrar(marco, { precio, compra: 'item_chiles' });
    if (!pago) return;

    const estrellas = estrellasSegunLosCaidos(chilesCaidos);
    await mostrarResultado(marco, {
      estrellas,
      cosas: ['item_chile_guajillo', 'item_chile_ancho'],
      frase: '¡Ya tenemos los chiles para el pozole!',
    });
    marco.terminar({ exito: true, otorgar: armarPremio(marco, { loPropio: { chiles: true }, precio, estrellas }) });
  }
};

/** De 1 a 3 estrellas. Dejar caer chiles no quita el premio: solo cambia cuántas estrellas brillan. */
function estrellasSegunLosCaidos(chilesCaidos: number): number {
  if (chilesCaidos <= CAIDOS_PARA_TRES_ESTRELLAS) return 3;
  if (chilesCaidos <= CAIDOS_PARA_DOS_ESTRELLAS) return 2;
  return 1;
}
