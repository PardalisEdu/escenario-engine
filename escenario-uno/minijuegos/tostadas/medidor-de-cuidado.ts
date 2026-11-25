// El medidor de «cuidado» de la canasta: mide qué tan rápido sube el dedo y lo enseña con una barra
// que se llena y cambia de verde a amarillo y a rojo. Así el niño ve venir el límite antes de que la tostada truene.

import type { Marco } from '../comun/marco.ts';
import { crear, crearImagen } from '../comun/piezas.ts';

/**
 * Cuánto pesa cada movimiento nuevo en la rapidez medida (de 0 a 1). Con un valor bajo, un solo brinco
 * del dedo (los dedos chiquitos tiemblan) no basta para tronar la tostada: tiene que ir rápido un ratito.
 */
const PESO_DEL_MOVIMIENTO_NUEVO = 0.35;
/** Dos movimientos casi juntos se miden como si los separara este tiempo, para no dividir entre casi cero. */
const TIEMPO_MINIMO_ENTRE_MOVIMIENTOS_EN_MILISEGUNDOS = 16;
/** Si el dedo lleva este tiempo sin moverse, la barra empieza a bajar sola. */
const QUIETUD_PARA_BAJAR_EN_MILISEGUNDOS = 60;
/** Cuánto queda de la rapidez medida en cada cuadro mientras el dedo está quieto. */
const LO_QUE_QUEDA_EN_CADA_CUADRO = 0.85;
/** Desde esta parte del límite la barra se pone amarilla, y desde la otra, roja. */
const PARTE_DEL_LIMITE_EN_AMARILLO = 0.5;
const PARTE_DEL_LIMITE_EN_ROJO = 0.8;
const MILISEGUNDOS_POR_SEGUNDO = 1000;

export interface MedidorDeCuidado {
  /**
   * Anota cuánto ha subido la tostada (en pixeles) y devuelve qué parte del límite de rapidez se alcanzó:
   * 0 = quieta, 1 o más = demasiado rápido. `limiteEnPixelesPorSegundo` es la rapidez con la que truena.
   */
  medir(subidaEnPixeles: number, limiteEnPixelesPorSegundo: number): number;
  /** Olvida lo medido: se usa al soltar la tostada o al empezar con otra. */
  reposar(): void;
  /** Deja de medir y de dibujar. Hay que llamarlo al terminar la parte de la canasta. */
  quitar(): void;
}

/** Dibuja el medidor dentro de `padre` y lo mantiene al día cuadro por cuadro. */
export function crearMedidorDeCuidado(marco: Marco, padre: HTMLElement): MedidorDeCuidado {
  const medidor = crear('div', 'tostadas-medidor', padre);
  // Arriba, una tostada rota: «si la barra llega hasta aquí, truena».
  crearImagen(marco.contexto, 'item_tostada_rota2', 'tostadas-medidor-dibujo', medidor);
  const tubo = crear('div', 'tostadas-medidor-tubo', medidor);
  const relleno = crear('div', 'tostadas-medidor-relleno', tubo);

  let parteDelLimite = 0;
  let ultimaSubidaEnPixeles: number | undefined;
  let momentoDelUltimoMovimiento = 0;
  let cuadroPedido = requestAnimationFrame(dibujarCuadro);

  function dibujarCuadro(): void {
    const tiempoQuieto = performance.now() - momentoDelUltimoMovimiento;
    if (tiempoQuieto > QUIETUD_PARA_BAJAR_EN_MILISEGUNDOS) {
      parteDelLimite = parteDelLimite * LO_QUE_QUEDA_EN_CADA_CUADRO;
    }
    const parteVisible = Math.min(1, parteDelLimite);
    relleno.style.height = `${parteVisible * 100}%`;
    medidor.classList.toggle('tostadas-medidor-amarillo', parteDelLimite >= PARTE_DEL_LIMITE_EN_AMARILLO);
    medidor.classList.toggle('tostadas-medidor-rojo', parteDelLimite >= PARTE_DEL_LIMITE_EN_ROJO);
    cuadroPedido = requestAnimationFrame(dibujarCuadro);
  }

  function quitar(): void {
    cancelAnimationFrame(cuadroPedido);
    marco.senal.removeEventListener('abort', quitar);
  }
  marco.senal.addEventListener('abort', quitar, { once: true });

  return {
    medir(subidaEnPixeles, limiteEnPixelesPorSegundo) {
      const ahora = performance.now();
      if (ultimaSubidaEnPixeles !== undefined) {
        // Solo cuenta lo que sube: bajar la tostada de regreso nunca la rompe.
        const avanceEnPixeles = Math.max(0, subidaEnPixeles - ultimaSubidaEnPixeles);
        const tiempo = Math.max(TIEMPO_MINIMO_ENTRE_MOVIMIENTOS_EN_MILISEGUNDOS, ahora - momentoDelUltimoMovimiento);
        const rapidezEnPixelesPorSegundo = (avanceEnPixeles / tiempo) * MILISEGUNDOS_POR_SEGUNDO;
        const parteDeEsteMovimiento = rapidezEnPixelesPorSegundo / limiteEnPixelesPorSegundo;
        parteDelLimite += (parteDeEsteMovimiento - parteDelLimite) * PESO_DEL_MOVIMIENTO_NUEVO;
      }
      ultimaSubidaEnPixeles = subidaEnPixeles;
      momentoDelUltimoMovimiento = ahora;
      return parteDelLimite;
    },
    reposar() {
      parteDelLimite = 0;
      ultimaSubidaEnPixeles = undefined;
    },
    quitar,
  };
}
