// Fase 3 de la verdulería: pagar y revisar el cambio.
// El jugador entrega su billete y Doña Tepo pone el cambio en la charola, pero a propósito le falta
// una moneda (la más chica del cambio correcto). El jugador cuenta las monedas tocándolas y contesta con
// uno de dos botones con dibujo: «sí está completo» o «falta dinero».
//
// Nunca se regaña: si dice que está completo, la propia Doña Tepo se da cuenta y pone la moneda que faltaba.

import type { Marco } from '../comun/marco.ts';
import { numeroEnEspanol, numeroEnIngles } from '../comun/numeros.ts';
import { crear, crearBotonConDibujo, crearImagen, esperar } from '../comun/piezas.ts';
import { crearAviso } from './aviso.ts';
import type { Charola } from './charola-del-cambio.ts';
import { crearCharola } from './charola-del-cambio.ts';
import { conMayusculaInicial } from './mayuscula-inicial.ts';
import { repartirEnPiezas } from './piezas-del-cambio.ts';
import type { Puesto } from './puesto.ts';
import { volar } from './volar.ts';
import type { VozEnDosIdiomas } from './voz-en-dos-idiomas.ts';

/** Cuánto cuesta todo y con qué billete se paga. Siempre `pagaCon` es mayor que `precio`. */
export interface Cuenta {
  readonly precio: number;
  readonly pagaCon: number;
}

/** Lo que necesita la fase del puesto donde se juega. */
export interface PuestoParaCobrar {
  readonly puesto: Puesto;
  readonly voz: VozEnDosIdiomas;
  readonly cuenta: Cuenta;
}

const PAUSA_ENTRE_PIEZAS_AL_DAR_EL_CAMBIO_EN_MILISEGUNDOS = 600;
const PAUSA_MIENTRAS_HABLA_TEPO_EN_MILISEGUNDOS = 2600;
const PAUSA_TRAS_PONER_LO_QUE_FALTABA_EN_MILISEGUNDOS = 900;
const PAUSA_AL_COMPLETAR_EL_CAMBIO_EN_MILISEGUNDOS = 3800;

/** El dibujo que significa «el cambio» en el ticket y en la franja (no dice cuánto es: eso lo cuenta el jugador). */
const DIBUJO_DE_LAS_MONEDAS = 'item_moneda10';
/** El dibujo del botón de «falta dinero»: una moneda con un signo de más. */
const DIBUJO_DE_FALTA_DINERO = `
  <svg class="mj-boton-dibujo" viewBox="0 0 100 100" aria-hidden="true">
    <circle cx="42" cy="44" r="34" fill="#fed449" stroke="#572d09" stroke-width="5"/>
    <circle cx="42" cy="44" r="22" fill="#f6b21a" stroke="#572d09" stroke-width="4"/>
    <circle cx="74" cy="74" r="22" fill="#e8338b" stroke="#572d09" stroke-width="5"/>
    <path d="M74 62 V86 M62 74 H86" fill="none" stroke="#fff6e0" stroke-width="8" stroke-linecap="round"/>
  </svg>`;

/** Juega la fase completa. Devuelve si el jugador notó que al cambio le faltaba dinero. */
export async function jugarFaseDelCambio(marco: Marco, { puesto, voz, cuenta }: PuestoParaCobrar): Promise<boolean> {
  const cambio = cuenta.pagaCon - cuenta.precio;
  const piezasDelCambio = repartirEnPiezas(cambio);
  const piezaQueFalta = piezasDelCambio[piezasDelCambio.length - 1]!; // el cambio es mayor que cero: hay al menos una
  const piezasDelPrincipio = piezasDelCambio.slice(0, -1);

  const sobreLaMesa = await puesto.cambiarLoDeLaMesa('verduleria-fase-cambio');
  const ticket = armarTicket(marco, cuenta, sobreLaMesa);
  const charola = crearCharola(marco, voz, sobreLaMesa);
  const acciones = crear('div', 'verduleria-acciones', sobreLaMesa);

  await entregarElBillete(marco, { puesto, voz, cuenta }, acciones);
  if (marco.senal.aborted) return false;
  ticket.classList.add('verduleria-ticket-pagado');
  for (const valor of piezasDelPrincipio) {
    await esperar(PAUSA_ENTRE_PIEZAS_AL_DAR_EL_CAMBIO_EN_MILISEGUNDOS, marco.senal);
    charola.ponerPieza(valor);
    marco.sonar('sfx_moneda');
  }

  puesto.indicar(
    `Pagaste con ${numeroEnEspanol(cuenta.pagaCon)} y eran ${numeroEnEspanol(cuenta.precio)}. ` +
      `Te deben dar ${numeroEnEspanol(cambio)} de cambio. Cuenta las monedas: ¿está completo?`,
    [DIBUJO_DE_LAS_MONEDAS, 'item_palomita'],
  );
  const notoQueFaltaba = await preguntarSiEstaCompleto(marco, acciones);
  if (marco.senal.aborted) return false;

  await completarElCambio(marco, { puesto, voz, charola }, { piezaQueFalta, notoQueFaltaba });
  if (marco.senal.aborted) return notoQueFaltaba;
  charola.marcarComoCompleta();
  marco.sonar('sfx_bien');
  const totalDicho = conMayusculaInicial(numeroEnEspanol(cambio));
  void voz.decirEnDosIdiomas(`${totalDicho} pesos de cambio. ¡Completo!`, `${numeroEnIngles(cambio)}!`);
  await esperar(PAUSA_AL_COMPLETAR_EL_CAMBIO_EN_MILISEGUNDOS, marco.senal);
  return notoQueFaltaba;
}

/**
 * La cuenta escrita con dibujos y números: con cuánto se paga, cuánto cuesta y cuánto deben dar de cambio.
 * Al principio solo se ve el precio; lo demás aparece al pagar (clase `verduleria-ticket-pagado`).
 */
function armarTicket(marco: Marco, cuenta: Cuenta, padre: HTMLElement): HTMLElement {
  const ticket = crear('div', 'verduleria-papel verduleria-ticket', padre);
  const cambio = cuenta.pagaCon - cuenta.precio;
  const renglones = [
    { clase: 'verduleria-ticket-pago', dibujo: `item_billete${cuenta.pagaCon}`, signo: '', pesos: cuenta.pagaCon },
    { clase: 'verduleria-ticket-precio', dibujo: 'item_bolsa', signo: '−', pesos: cuenta.precio },
    { clase: 'verduleria-ticket-cambio', dibujo: DIBUJO_DE_LAS_MONEDAS, signo: '', pesos: cambio },
  ];
  for (const renglon of renglones) {
    const elemento = crear('div', `verduleria-ticket-renglon ${renglon.clase}`, ticket);
    crearImagen(marco.contexto, renglon.dibujo, 'verduleria-ticket-dibujo', elemento);
    const numero = crear('span', 'verduleria-ticket-numero', elemento);
    // El signo de menos va aparte porque solo tiene sentido (y solo se ve) cuando ya se pagó y hay una resta.
    crear('span', 'verduleria-ticket-signo', numero).textContent = renglon.signo;
    numero.append(`$${renglon.pesos}`);
  }
  return ticket;
}

/** Enseña el billete del jugador y espera a que lo toque; entonces el billete vuela hasta Doña Tepo. */
async function entregarElBillete(marco: Marco, { puesto, cuenta }: PuestoParaCobrar, acciones: HTMLElement): Promise<void> {
  const claveDelBillete = `item_billete${cuenta.pagaCon}`;
  const billete = crear('button', 'verduleria-billete', acciones);
  billete.type = 'button';
  billete.setAttribute('aria-label', `Pagar con el billete de ${numeroEnEspanol(cuenta.pagaCon)}`);
  const dibujo = crearImagen(marco.contexto, claveDelBillete, 'verduleria-billete-dibujo', billete);
  const frase = `Son ${numeroEnEspanol(cuenta.precio)} pesos. Toca tu billete para pagar.`;
  puesto.indicar(frase, ['item_bolsa', claveDelBillete]);

  const billeteTocado = crearAviso<void>(marco.senal, undefined);
  billete.addEventListener('click', () => billeteTocado.avisar(), { once: true, signal: marco.senal });
  await billeteTocado.promesa;
  if (marco.senal.aborted) return;

  billete.disabled = true;
  marco.sonar('sfx_pop');
  await volar({ dibujo, destino: puesto.tepo, escena: puesto.escena }, marco.senal);
  puesto.brincarConTepo();
  billete.remove();
}

/** Pone los dos botones de respuesta y espera a que se toque uno. Devuelve `true` si fue el de «falta dinero». */
async function preguntarSiEstaCompleto(marco: Marco, acciones: HTMLElement): Promise<boolean> {
  const respuesta = crearAviso<boolean>(marco.senal, false);

  const estaCompleto = crearBotonConDibujo(marco.contexto, 'item_palomita', 'Sí está completo', acciones);
  estaCompleto.classList.add('mj-boton-grande', 'verduleria-boton-completo', 'verduleria-llega');
  estaCompleto.addEventListener('click', () => respuesta.avisar(false), { signal: marco.senal });

  const faltaDinero = crear('button', 'mj-boton mj-boton-grande verduleria-boton-falta verduleria-llega', acciones);
  faltaDinero.type = 'button';
  faltaDinero.setAttribute('aria-label', 'Falta dinero');
  faltaDinero.innerHTML = DIBUJO_DE_FALTA_DINERO; // es un texto fijo de este archivo, no viene del nivel
  faltaDinero.addEventListener('click', () => respuesta.avisar(true), { signal: marco.senal });

  const notoQueFaltaba = await respuesta.promesa;
  acciones.classList.add('verduleria-se-va');
  estaCompleto.disabled = true;
  faltaDinero.disabled = true;
  return notoQueFaltaba;
}

/** Doña Tepo contesta, pone la pieza que faltaba y se cuenta todo el cambio en voz alta. */
async function completarElCambio(
  marco: Marco,
  { puesto, voz, charola }: { puesto: Puesto; voz: VozEnDosIdiomas; charola: Charola },
  { piezaQueFalta, notoQueFaltaba }: { piezaQueFalta: number; notoQueFaltaba: boolean },
): Promise<void> {
  puesto.brincarConTepo();
  if (notoQueFaltaba) {
    marco.sonar('sfx_bien');
    voz.decir(`¡Qué buen ojo! Me faltaban ${decirPesos(piezaQueFalta)}.`);
  } else {
    voz.decir('¡Ay, espera! Me faltó una moneda.');
  }
  await esperar(PAUSA_MIENTRAS_HABLA_TEPO_EN_MILISEGUNDOS, marco.senal);
  if (marco.senal.aborted) return;

  charola.ponerPieza(piezaQueFalta);
  marco.sonar('sfx_moneda');
  await esperar(PAUSA_TRAS_PONER_LO_QUE_FALTABA_EN_MILISEGUNDOS, marco.senal);
  await charola.contarTodoEnVozAlta();
}

/** «cinco pesos», pero «un peso». */
function decirPesos(cantidad: number): string {
  if (cantidad === 1) return 'un peso';
  return `${numeroEnEspanol(cantidad)} pesos`;
}
