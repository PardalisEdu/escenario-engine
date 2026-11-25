// Segunda parte de «Tostadas»: cada tostada elegida está metida en una canasta angosta y hay que
// arrastrarla hacia arriba DESPACITO hasta sacarla. Si el dedo sube demasiado rápido, la tostada truena.
//
// Nunca castiga: si truena, Don Armando da otra y se intenta de nuevo, sin límite.
// Con teclado: cada toque de flecha arriba o de espacio la sube un poquito, y así nunca se rompe.

import type { Marco } from '../comun/marco.ts';
import { animar, crear, crearImagen, esperar } from '../comun/piezas.ts';
import { crearMedidorDeCuidado } from './medidor-de-cuidado.ts';
import type { MedidorDeCuidado } from './medidor-de-cuidado.ts';
import { crearPlato } from './plato.ts';
import type { Plato } from './plato.ts';

/**
 * Cuánto hay que subir la tostada para sacarla, medido en «tamaños de tostada».
 * Debe coincidir con lo que tapa el frente de la canasta en tostadas.css (`.tostadas-canasta-frente`).
 */
const RECORRIDO_EN_TAMANOS = 0.75;
/**
 * La rapidez con la que truena, en tamaños de tostada por segundo. Es generosa a propósito (niños de 6 años):
 * solo truena con un jalón, es decir, si se intenta sacar la tostada completa en menos de un cuarto de segundo, más o menos.
 */
const LIMITE_EN_TAMANOS_POR_SEGUNDO = 3.5;
/** Desde esta parte del límite la tostada empieza a temblar, como aviso. */
const PARTE_DEL_LIMITE_QUE_AVISA = 0.5;
/** Con el teclado se sale en este número de toques. */
const TOQUES_DE_TECLA_PARA_SACARLA = 8;
const TECLAS_QUE_SUBEN = ['ArrowUp', ' '];

const PAUSA_AL_TRONAR_EN_MILISEGUNDOS = 1100;
const PAUSA_AL_SACAR_EN_MILISEGUNDOS = 700;
const PAUSA_ANTES_DEL_INGLES_EN_MILISEGUNDOS = 1500;
const PAUSA_AL_TERMINAR_EN_MILISEGUNDOS = 1200;

const FRASES_AL_SACAR = ['¡Una!', '¡Dos!', '¡Tres!'];
/** Una flecha hacia arriba junto a la canasta: enseña, sin palabras, hacia dónde se arrastra. */
const DIBUJO_DE_LA_FLECHA =
  '<svg viewBox="0 0 60 100" aria-hidden="true"><path d="M30 8 L52 40 H39 V92 H21 V40 H8 Z" fill="#fff6e0" ' +
  'stroke="#572d09" stroke-width="6" stroke-linejoin="round"/></svg>';

/** La canasta con su tostada, y lo que va cambiando mientras se juega. */
interface Canasta {
  readonly marco: Marco;
  /** Toda la zona de la canasta: se puede agarrar la tostada tocando en cualquier parte de ella. */
  readonly zona: HTMLElement;
  /** La tostada que sube y baja. */
  readonly pieza: HTMLElement;
  readonly dibujoDeLaPieza: HTMLImageElement;
  readonly medidor: MedidorDeCuidado;
  readonly plato: Plato;
  readonly porSacar: number;
  sacadas: number;
  tronadas: number;
  /** Cuánto ha subido la tostada desde el fondo de la canasta. */
  subidaEnPixeles: number;
  /** Dónde estaban el dedo y la tostada al agarrarla; `undefined` si nadie la está arrastrando. */
  agarre: { readonly yDelDedo: number; readonly subidaAlAgarrar: number } | undefined;
  /** Mientras una tostada sale, truena o llega, no se puede mover. */
  estaOcupada: boolean;
  /** Avisa que ya se sacaron todas. */
  alTerminar: () => void;
}

/**
 * Muestra la canasta y termina cuando ya se sacaron `porSacar` tostadas enteras (o si el minijuego se cierra).
 * Devuelve cuántas tostadas tronaron.
 */
export async function sacarDespacito(marco: Marco, porSacar: number): Promise<number> {
  const canasta = dibujarCanasta(marco, porSacar);
  // Los oyentes de esta parte se quitan al terminarla (o si el minijuego se cierra antes).
  const finDeEstaParte = new AbortController();
  const senal = AbortSignal.any([marco.senal, finDeEstaParte.signal]);
  const yaSeSacaronTodas = new Promise<void>((terminar) => {
    canasta.alTerminar = terminar;
    marco.senal.addEventListener('abort', () => terminar(), { once: true, signal: finDeEstaParte.signal });
  });

  canasta.zona.addEventListener('pointerdown', (evento) => agarrar(canasta, evento), { signal: senal });
  canasta.zona.addEventListener('pointermove', (evento) => arrastrar(canasta, evento), { signal: senal });
  canasta.zona.addEventListener('pointerup', () => soltar(canasta), { signal: senal });
  canasta.zona.addEventListener('pointercancel', () => soltar(canasta), { signal: senal });
  document.addEventListener('keydown', (evento) => subirConTecla(canasta, evento), { signal: senal });
  marco.indicar('Saca la tostada despacito, hacia arriba, para que no se rompa.', ['item_tostada']);

  await yaSeSacaronTodas;
  finDeEstaParte.abort();
  canasta.medidor.quitar();
  if (marco.senal.aborted) return canasta.tronadas;
  marco.sonar('sfx_bien');
  await esperar(PAUSA_AL_TERMINAR_EN_MILISEGUNDOS, marco.senal);
  return canasta.tronadas;
}

function dibujarCanasta(marco: Marco, porSacar: number): Canasta {
  const { contexto, area } = marco;
  area.replaceChildren();
  const pantalla = crear('div', 'tostadas-pantalla', area);
  crearImagen(contexto, 'spr_armando', 'tostadas-armando', pantalla);

  const centro = crear('div', 'tostadas-centro', pantalla);
  const flecha = crear('div', 'tostadas-flecha', centro);
  flecha.innerHTML = DIBUJO_DE_LA_FLECHA; // es un texto fijo de este archivo, no viene de afuera
  const zona = crear('div', 'tostadas-canasta', centro);
  crear('div', 'tostadas-canasta-fondo', zona);
  const pieza = crear('div', 'tostadas-pieza', zona);
  const dibujoDeLaPieza = crearImagen(contexto, 'item_tostada', 'tostadas-pieza-dibujo', pieza);
  crear('div', 'tostadas-canasta-frente', zona);
  const medidor = crearMedidorDeCuidado(marco, centro);
  const plato = crearPlato(marco, pantalla, porSacar);

  return {
    marco, zona, pieza, dibujoDeLaPieza, medidor, plato, porSacar,
    sacadas: 0,
    tronadas: 0,
    subidaEnPixeles: 0,
    agarre: undefined,
    estaOcupada: false,
    alTerminar: () => {},
  };
}

/** Cuántos pixeles hay que subir la tostada para sacarla. Se mide cada vez porque la pantalla puede cambiar de tamaño. */
function recorridoEnPixeles(canasta: Canasta): number {
  return canasta.pieza.offsetHeight * RECORRIDO_EN_TAMANOS;
}

function agarrar(canasta: Canasta, evento: PointerEvent): void {
  if (canasta.estaOcupada) return;
  // Con la captura, la canasta sigue recibiendo el movimiento aunque el dedo se salga de ella.
  canasta.zona.setPointerCapture(evento.pointerId);
  canasta.agarre = { yDelDedo: evento.clientY, subidaAlAgarrar: canasta.subidaEnPixeles };
  canasta.medidor.reposar();
  canasta.medidor.medir(canasta.subidaEnPixeles, limiteEnPixelesPorSegundo(canasta));
}

function limiteEnPixelesPorSegundo(canasta: Canasta): number {
  return canasta.pieza.offsetHeight * LIMITE_EN_TAMANOS_POR_SEGUNDO;
}

function arrastrar(canasta: Canasta, evento: PointerEvent): void {
  if (canasta.agarre === undefined || canasta.estaOcupada) return;
  const loQueSubioElDedo = canasta.agarre.yDelDedo - evento.clientY;
  moverPieza(canasta, canasta.agarre.subidaAlAgarrar + loQueSubioElDedo);

  const parteDelLimite = canasta.medidor.medir(canasta.subidaEnPixeles, limiteEnPixelesPorSegundo(canasta));
  canasta.zona.classList.toggle('tostadas-canasta-con-cuidado', parteDelLimite >= PARTE_DEL_LIMITE_QUE_AVISA);
  if (parteDelLimite >= 1) {
    void tronarTostada(canasta);
    return;
  }
  if (canasta.subidaEnPixeles >= recorridoEnPixeles(canasta)) void sacarTostada(canasta);
}

function soltar(canasta: Canasta): void {
  // La tostada se queda donde la dejaron: así se puede sacar en varios jaloncitos.
  canasta.agarre = undefined;
  canasta.medidor.reposar();
  canasta.zona.classList.remove('tostadas-canasta-con-cuidado');
}

function subirConTecla(canasta: Canasta, evento: KeyboardEvent): void {
  if (!TECLAS_QUE_SUBEN.includes(evento.key) || canasta.estaOcupada) return;
  // Sin esto, el espacio y la flecha también moverían la página.
  evento.preventDefault();
  const pasoEnPixeles = recorridoEnPixeles(canasta) / TOQUES_DE_TECLA_PARA_SACARLA;
  moverPieza(canasta, canasta.subidaEnPixeles + pasoEnPixeles);
  // Se compara con medio paso de margen: sumar ocho pasos con decimales puede quedar un pelito abajo del recorrido.
  if (canasta.subidaEnPixeles >= recorridoEnPixeles(canasta) - pasoEnPixeles / 2) void sacarTostada(canasta);
}

/** Pone la tostada a cierta altura, sin dejarla hundirse más allá del fondo ni subir más allá de la salida. */
function moverPieza(canasta: Canasta, subidaEnPixeles: number): void {
  canasta.subidaEnPixeles = Math.min(recorridoEnPixeles(canasta), Math.max(0, subidaEnPixeles));
  canasta.pieza.style.translate = `0 ${-canasta.subidaEnPixeles}px`;
}

async function sacarTostada(canasta: Canasta): Promise<void> {
  const { marco } = canasta;
  canasta.estaOcupada = true;
  soltar(canasta);
  marco.sonar('sfx_pop');
  canasta.pieza.classList.add('tostadas-pieza-sale');
  const frase = FRASES_AL_SACAR[canasta.sacadas];
  canasta.sacadas += 1;
  if (frase !== undefined) marco.decir(frase);
  await esperar(PAUSA_AL_SACAR_EN_MILISEGUNDOS, marco.senal);
  canasta.plato.agregarTostada();

  if (canasta.sacadas >= canasta.porSacar) {
    canasta.zona.classList.add('tostadas-canasta-vacia');
    canasta.alTerminar();
    return;
  }
  ponerOtraTostada(canasta);
}

async function tronarTostada(canasta: Canasta): Promise<void> {
  const { marco } = canasta;
  canasta.estaOcupada = true;
  soltar(canasta);
  canasta.tronadas += 1;
  marco.sonar('sfx_crujido');
  canasta.dibujoDeLaPieza.src = marco.contexto.assets.url('item_tostada_rota2');
  animar(canasta.pieza, 'tostadas-pieza-truena');
  marco.decir('¡Despacito! Toma otra.');
  await esperar(PAUSA_AL_TRONAR_EN_MILISEGUNDOS, marco.senal);
  if (marco.senal.aborted) return;
  ponerOtraTostada(canasta);

  // La primera vez, el primo repite la palabra clave en inglés.
  if (canasta.tronadas !== 1) return;
  await esperar(PAUSA_ANTES_DEL_INGLES_EN_MILISEGUNDOS, marco.senal);
  if (marco.senal.aborted || canasta.estaOcupada) return;
  marco.decir('slowly!', 'en');
}

/** Mete una tostada entera nueva hasta el fondo de la canasta. */
function ponerOtraTostada(canasta: Canasta): void {
  canasta.pieza.classList.remove('tostadas-pieza-sale', 'tostadas-pieza-truena');
  canasta.dibujoDeLaPieza.src = canasta.marco.contexto.assets.url('item_tostada');
  moverPieza(canasta, 0);
  animar(canasta.pieza, 'tostadas-pieza-llega');
  canasta.estaOcupada = false;
}
