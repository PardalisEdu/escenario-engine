// Fase 1 de la verdulería: señalar lo que pide la lista del mandado.
// En la mesa hay nueve verduras revueltas: cinco están en la hojita de la lista y cuatro no.
// Al tocar una de la lista, vuela a la bolsa y se palomea en la hojita; la voz dice su nombre y el primo
// lo repite en inglés. Al tocar una que no va, solo tiembla tantito y la voz explica por qué no.

import type { Marco } from '../comun/marco.ts';
import { animar, crear, crearImagen, esperar, revolver } from '../comun/piezas.ts';
import { crearAviso } from './aviso.ts';
import { conMayusculaInicial } from './mayuscula-inicial.ts';
import type { Puesto } from './puesto.ts';
import { volar } from './volar.ts';
import type { VozEnDosIdiomas } from './voz-en-dos-idiomas.ts';

interface Verdura {
  /** Clave de su dibujo. */
  readonly clave: string;
  /** Cómo la dice la voz en español. */
  readonly nombre: string;
  /** Cómo la dice el primo en inglés. Las que no van en la lista no se dicen en inglés. */
  readonly enIngles?: string;
}

const VERDURAS_DE_LA_LISTA: readonly Verdura[] = [
  { clave: 'item_lechuga', nombre: 'lechuga', enIngles: 'lettuce' },
  { clave: 'item_rabanos', nombre: 'rábanos', enIngles: 'radishes' },
  { clave: 'item_cebolla', nombre: 'cebolla', enIngles: 'onion' },
  { clave: 'item_oregano', nombre: 'orégano', enIngles: 'oregano' },
  { clave: 'item_limon', nombre: 'limón', enIngles: 'lime' },
];
const VERDURAS_QUE_NO_VAN: readonly Verdura[] = [
  { clave: 'item_jitomate', nombre: 'jitomate' },
  { clave: 'item_zanahoria', nombre: 'zanahoria' },
  { clave: 'item_aguacate', nombre: 'aguacate' },
  { clave: 'item_chile_verde', nombre: 'chile verde' },
];

/** Una verdura puesta en su cajita de la mesa. */
interface CajaDeVerdura {
  readonly verdura: Verdura;
  readonly boton: HTMLButtonElement;
  readonly dibujo: HTMLImageElement;
}

/** Los dibujos de las cinco cosas de la lista, para la tarjeta del final. */
export const CLAVES_DE_LA_LISTA: readonly string[] = VERDURAS_DE_LA_LISTA.map((verdura) => verdura.clave);

/** Tiempo para que se alcance a oír la última verdura en español y en inglés antes de felicitar. */
const PAUSA_TRAS_LA_ULTIMA_VERDURA_EN_MILISEGUNDOS = 2300;
const PAUSA_AL_COMPLETAR_LA_LISTA_EN_MILISEGUNDOS = 2200;

/** Juega la fase completa. Devuelve cuántas veces se tocó una verdura que no iba. */
export async function jugarFaseDeLaLista(marco: Marco, puesto: Puesto, voz: VozEnDosIdiomas): Promise<number> {
  const sobreLaMesa = await puesto.cambiarLoDeLaMesa('verduleria-fase-lista');
  const casillasDeLaHojita = armarHojita(marco, sobreLaMesa);
  const cajas = crear('div', 'verduleria-cajas', sobreLaMesa);
  const bolsa = crearImagen(marco.contexto, 'item_bolsa', 'verduleria-bolsa', sobreLaMesa);
  puesto.indicar('Toca las verduras que están en la lista del mandado.', ['item_bolsa']);

  let faltanPorGuardar = VERDURAS_DE_LA_LISTA.length;
  let toquesEquivocados = 0;
  const listaCompleta = crearAviso<void>(marco.senal, undefined);

  for (const verdura of revolver([...VERDURAS_DE_LA_LISTA, ...VERDURAS_QUE_NO_VAN])) {
    const boton = crear('button', 'verduleria-caja', cajas);
    boton.type = 'button';
    boton.setAttribute('aria-label', verdura.nombre);
    const dibujo = crearImagen(marco.contexto, verdura.clave, 'verduleria-caja-dibujo', boton);
    boton.addEventListener('click', () => alTocar({ verdura, boton, dibujo }), { signal: marco.senal });
  }

  function alTocar(caja: CajaDeVerdura): void {
    const enIngles = caja.verdura.enIngles;
    if (enIngles === undefined) {
      toquesEquivocados += 1;
      animar(caja.boton, 'mj-temblor');
      marco.sonar('sfx_no');
      voz.decir(`Eso es ${caja.verdura.nombre}. No está en la lista.`);
      return;
    }
    void guardarEnLaBolsa(caja, enIngles);
  }

  async function guardarEnLaBolsa(caja: CajaDeVerdura, enIngles: string): Promise<void> {
    caja.boton.disabled = true;
    caja.boton.classList.add('verduleria-caja-vacia');
    faltanPorGuardar -= 1;
    marco.sonar('sfx_pop');
    void voz.decirEnDosIdiomas(`¡${conMayusculaInicial(caja.verdura.nombre)}!`, `${enIngles}!`);

    await volar({ dibujo: caja.dibujo, destino: bolsa, escena: puesto.escena }, marco.senal);
    animar(bolsa, 'mj-brinco');
    palomear(marco, casillasDeLaHojita.get(caja.verdura.clave));
    if (faltanPorGuardar > 0) return;

    await esperar(PAUSA_TRAS_LA_ULTIMA_VERDURA_EN_MILISEGUNDOS, marco.senal);
    listaCompleta.avisar();
  }

  await listaCompleta.promesa;
  if (marco.senal.aborted) return toquesEquivocados;
  marco.sonar('sfx_bien');
  animar(bolsa, 'mj-brinco');
  puesto.brincarConTepo();
  voz.decir('¡Muy bien! Ya está todo lo de la lista.');
  await esperar(PAUSA_AL_COMPLETAR_LA_LISTA_EN_MILISEGUNDOS, marco.senal);
  return toquesEquivocados;
}

/**
 * Dibuja la hojita de «la lista del mandado»: un renglón por verdura, con una casilla para palomear.
 * Devuelve la casilla de cada verdura, por la clave de su dibujo.
 */
function armarHojita(marco: Marco, padre: HTMLElement): Map<string, HTMLElement> {
  const hojita = crear('div', 'verduleria-papel verduleria-hojita', padre);
  const casillas = new Map<string, HTMLElement>();
  for (const verdura of VERDURAS_DE_LA_LISTA) {
    const renglon = crear('div', 'verduleria-renglon', hojita);
    casillas.set(verdura.clave, crear('div', 'verduleria-casilla', renglon));
    crearImagen(marco.contexto, verdura.clave, 'verduleria-renglon-dibujo', renglon);
  }
  return casillas;
}

/** Pone la palomita en una casilla de la hojita. */
function palomear(marco: Marco, casilla: HTMLElement | undefined): void {
  if (casilla === undefined || marco.senal.aborted) return;
  crearImagen(marco.contexto, 'item_palomita', 'verduleria-palomita', casilla);
  casilla.parentElement?.classList.add('verduleria-renglon-listo');
}
