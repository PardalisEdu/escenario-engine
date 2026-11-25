// Minijuego «Verduleria»: el puesto de verduras de Doña Tepo. Tiene tres fases, una tras otra:
//   1. Señalar en la mesa las cinco verduras que pide la lista del mandado.
//   2. Escoger una lechuga de buen tamaño (ni chiquita ni marchita).
//   3. Pagar con un billete y revisar el cambio: a Doña Tepo le falta una moneda la primera vez.
//
// Configuración que le pasa el nivel (cuánto cuesta todo y con qué billete se paga: 20, 50 o 100):
//   { "precio": 35, "pagaCon": 50 }
//
// Cada fase vive en su archivo de la carpeta `verduleria/`; aquí solo se juegan en orden y se dan las estrellas.

import type { Minijuego } from '../motor.ts';
import { abrirMarco } from './comun/marco.ts';
import { leerNumero } from './comun/piezas.ts';
import { armarPremio, ESTRELLAS_MAXIMAS, mostrarResultado } from './comun/resultado.ts';
import type { Cuenta } from './verduleria/fase-del-cambio.ts';
import { jugarFaseDelCambio } from './verduleria/fase-del-cambio.ts';
import { jugarFaseDeLaLechuga } from './verduleria/fase-de-la-lechuga.ts';
import { CLAVES_DE_LA_LISTA, jugarFaseDeLaLista } from './verduleria/fase-de-la-lista.ts';
import { armarPuesto } from './verduleria/puesto.ts';
import { crearVozEnDosIdiomas } from './verduleria/voz-en-dos-idiomas.ts';

const CUENTA_POR_DEFECTO: Cuenta = { precio: 35, pagaCon: 50 };
/** Los billetes que tienen dibujo (`item_billete20`, `item_billete50`, `item_billete100`). */
const BILLETES_PARA_PAGAR = [20, 50, 100];
/** Hasta estos toques equivocados (entre la lista y la lechuga) no se pierde ninguna estrella. */
const TOQUES_EQUIVOCADOS_PERDONADOS = 2;

export const Verduleria: Minijuego = (contexto) => {
  const { marco, resultado } = abrirMarco(contexto, 'verde');
  const cuenta = leerCuenta(contexto.config);

  void jugar();
  return resultado;

  async function jugar(): Promise<void> {
    const puesto = armarPuesto(marco);
    const voz = crearVozEnDosIdiomas(marco);

    const toquesEquivocadosEnLaLista = await jugarFaseDeLaLista(marco, puesto, voz);
    if (marco.senal.aborted) return;
    const toquesEquivocadosEnLaLechuga = await jugarFaseDeLaLechuga(marco, puesto, voz);
    if (marco.senal.aborted) return;
    const notoQueFaltabaCambio = await jugarFaseDelCambio(marco, { puesto, voz, cuenta });
    if (marco.senal.aborted) return;

    const toquesEquivocados = toquesEquivocadosEnLaLista + toquesEquivocadosEnLaLechuga;
    const estrellas = contarEstrellas(toquesEquivocados, notoQueFaltabaCambio);
    await mostrarResultado(marco, { estrellas, cosas: CLAVES_DE_LA_LISTA, frase: '¡Ya tenemos las verduras para el pozole!' });
    const otorgar = armarPremio(marco, { loPropio: { verduras: true }, precio: cuenta.precio, estrellas });
    marco.terminar({ exito: true, otorgar });
  }
};

/**
 * La cuenta que manda el nivel. `config` no es confiable: si el billete no existe o no alcanza
 * para dejar cambio, se usa la cuenta por defecto (así la fase del cambio siempre tiene algo que contar).
 */
function leerCuenta(config: unknown): Cuenta {
  const precio = leerNumero(config, 'precio', CUENTA_POR_DEFECTO.precio);
  const pagaCon = leerNumero(config, 'pagaCon', CUENTA_POR_DEFECTO.pagaCon);
  const elBilleteExiste = BILLETES_PARA_PAGAR.includes(pagaCon);
  const quedaCambio = Number.isInteger(precio) && precio > 0 && precio < pagaCon;
  if (!elBilleteExiste || !quedaCambio) return CUENTA_POR_DEFECTO;
  return { precio, pagaCon };
}

/** De 1 a 3 estrellas: se resta una por muchos toques equivocados y otra por no notar que faltaba cambio. */
function contarEstrellas(toquesEquivocados: number, notoQueFaltabaCambio: boolean): number {
  let estrellas = ESTRELLAS_MAXIMAS;
  if (toquesEquivocados > TOQUES_EQUIVOCADOS_PERDONADOS) {
    estrellas -= 1;
  }
  if (!notoQueFaltabaCambio) {
    estrellas -= 1;
  }
  return Math.max(1, estrellas);
}
