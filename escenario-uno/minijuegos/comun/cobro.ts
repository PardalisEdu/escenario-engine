// Pagar con monedas: el jugador toca monedas de su monedero hasta juntar justo lo que cuesta.
// Cada moneda que pone se cuenta en voz alta («cinco… diez… quince»). Lo usan varios puestos.
//
// Nunca castiga: si se pasa, la moneda regresa sola al monedero y una voz amable lo explica.

import type { Marco } from './marco.ts';
import { numeroEnEspanol, numeroEnIngles } from './numeros.ts';
import { animar, crear, crearImagen, esperar } from './piezas.ts';

/** Las monedas que se ofrecen para pagar. Alcanzan para cualquier precio de hasta 30 pesos. */
const MONEDAS_DEL_MONEDERO = [10, 10, 5, 5, 2, 2, 1];
const PAUSA_AL_PAGAR_EN_MILISEGUNDOS = 1400;

export interface PorCobrar {
  /** Cuántos pesos hay que juntar. */
  readonly precio: number;
  /** Clave del dibujo de lo que se compra, para que se vea qué se está pagando. */
  readonly compra: string;
}

/**
 * Muestra la pantalla de pago dentro del área del marco. La promesa termina con `true` cuando ya se pagó,
 * o con `false` si el minijuego se cerró antes.
 */
export async function cobrar(marco: Marco, porCobrar: PorCobrar): Promise<boolean> {
  const { contexto, area } = marco;
  area.replaceChildren();
  const pantalla = crear('div', 'mj-cobro', area);

  // Arriba: lo que se compra y su precio.
  const etiqueta = crear('div', 'mj-cobro-etiqueta', pantalla);
  crearImagen(contexto, porCobrar.compra, 'mj-cobro-compra', etiqueta);
  const precio = crear('div', 'mj-precio', etiqueta);
  precio.textContent = `$${porCobrar.precio}`;

  // En medio: la charola donde caen las monedas y la cuenta que se lleva.
  const charola = crear('div', 'mj-charola', pantalla);
  const monedasEnLaCharola = crear('div', 'mj-charola-monedas', charola);
  const cuenta = crear('div', 'mj-cuenta', charola);
  cuenta.textContent = '$0';

  // Abajo: el monedero.
  const monedero = crear('div', 'mj-monedero', pantalla);

  let total = 0;
  marco.indicar(`Son ${numeroEnEspanol(porCobrar.precio)} pesos. Toca tus monedas para pagar.`, [porCobrar.compra, 'item_moneda10']);

  return new Promise<boolean>((terminar) => {
    marco.senal.addEventListener('abort', () => terminar(false), { once: true });

    for (const valor of MONEDAS_DEL_MONEDERO) {
      const moneda = crear('button', 'mj-moneda', monedero);
      moneda.type = 'button';
      moneda.setAttribute('aria-label', `Moneda de ${numeroEnEspanol(valor)}`);
      crearImagen(contexto, `item_moneda${valor}`, 'mj-moneda-dibujo', moneda);

      moneda.addEventListener(
        'click',
        () => {
          const estaEnLaCharola = moneda.parentElement === monedasEnLaCharola;
          if (estaEnLaCharola) {
            // Tocar una moneda de la charola la regresa al monedero.
            total -= valor;
            monedero.append(moneda);
          } else if (total + valor > porCobrar.precio) {
            animar(moneda, 'mj-no-cabe');
            marco.decir('Con esa moneda te pasas. Prueba con otra más chica.');
            return;
          } else {
            total += valor;
            monedasEnLaCharola.append(moneda);
            marco.sonar('sfx_moneda');
          }
          cuenta.textContent = `$${total}`;
          animar(cuenta, 'mj-brinco');
          if (total === porCobrar.precio) {
            void celebrarElPago();
          } else if (total > 0) {
            marco.decir(numeroEnEspanol(total));
          }
        },
        { signal: marco.senal },
      );
    }

    async function celebrarElPago(): Promise<void> {
      pantalla.classList.add('mj-cobro-pagado');
      marco.sonar('sfx_bien');
      // El primo repite el total en inglés: así se oye el número en los dos idiomas.
      marco.decir(`${numeroEnEspanol(total)} pesos. ¡Justo!`);
      await esperar(PAUSA_AL_PAGAR_EN_MILISEGUNDOS, marco.senal);
      marco.decir(`${numeroEnIngles(total)}!`, 'en');
      await esperar(PAUSA_AL_PAGAR_EN_MILISEGUNDOS, marco.senal);
      terminar(!marco.senal.aborted);
    }
  });
}
