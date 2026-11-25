// Minijuego «Cobro»: pagar algo sencillo (una botana) contando monedas.
// Es el minijuego más corto y sirve de ejemplo de cómo se arma uno con las piezas de `comun/`.
//
// Configuración que le pasa el nivel:
//   { "precio": 10, "compra": "item_helado", "otorgar": { "botana": "helado" } }

import type { Minijuego, ValorDeEstado } from '../motor.ts';
import { cobrar } from './comun/cobro.ts';
import { abrirMarco } from './comun/marco.ts';
import { leerNumero } from './comun/piezas.ts';
import { armarPremio, mostrarResultado } from './comun/resultado.ts';

const PRECIO_POR_DEFECTO = 10;
const COMPRA_POR_DEFECTO = 'item_bolsa';

export const Cobro: Minijuego = (contexto) => {
  const { marco, resultado } = abrirMarco(contexto, 'turquesa');
  const precio = leerNumero(contexto.config, 'precio', PRECIO_POR_DEFECTO);
  const compra = leerCompra(contexto.config);

  void jugar();
  return resultado;

  async function jugar(): Promise<void> {
    const pago = await cobrar(marco, { precio, compra });
    if (!pago) return;
    await mostrarResultado(marco, { estrellas: 3, cosas: [compra], frase: '¡Pagaste justo! ¡Qué bien cuentas!' });
    marco.terminar({ exito: true, otorgar: armarPremio(marco, { loPropio: leerLoQueOtorga(contexto.config), precio, estrellas: 0 }) });
  }
};

/** La clave del dibujo de lo que se compra, tal como la mandó el nivel. */
function leerCompra(config: unknown): string {
  if (typeof config !== 'object' || config === null || !('compra' in config)) return COMPRA_POR_DEFECTO;
  if (typeof config.compra !== 'string') return COMPRA_POR_DEFECTO;
  return config.compra;
}

/** Las variables que el nivel pide conceder al pagar. `config` viene del nivel: se revisa antes de usarla. */
function leerLoQueOtorga(config: unknown): Record<string, ValorDeEstado> {
  const otorgar: Record<string, ValorDeEstado> = {};
  if (typeof config !== 'object' || config === null || !('otorgar' in config)) return otorgar;
  const pedido = config.otorgar;
  if (typeof pedido !== 'object' || pedido === null) return otorgar;

  for (const [nombre, valor] of Object.entries(pedido)) {
    if (typeof valor === 'boolean' || typeof valor === 'number' || typeof valor === 'string') {
      otorgar[nombre] = valor;
    }
  }
  return otorgar;
}
