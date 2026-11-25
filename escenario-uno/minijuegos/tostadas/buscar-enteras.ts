// Primera parte de «Tostadas»: en la mesa hay tostadas revueltas, unas enteras y otras rotas.
// Hay que tocar las enteras; cada una se va al plato de las elegidas.
//
// Tocar una rota no castiga: truena, tiembla tantito y Don Armando explica con cariño.

import type { Marco } from '../comun/marco.ts';
import { animar, crear, crearImagen, enteroAlAzar, esperar, revolver } from '../comun/piezas.ts';
import { crearPlato } from './plato.ts';
import type { Plato } from './plato.ts';

const DIBUJO_DE_ENTERA = 'item_tostada';
const DIBUJO_CON_GRIETA = 'item_tostada_rota1';
const DIBUJO_SIN_PEDAZO = 'item_tostada_rota2';
const TOSTADAS_CON_GRIETA = 3;
const TOSTADAS_SIN_PEDAZO = 3;

/** Cada tostada se dibuja un poco girada, para que la mesa se vea revuelta. */
const GIRO_MAXIMO_EN_GRADOS = 40;
/** El primo dice «crunchy!» en el primer toque a una rota y luego cada tantos, para no cansar. */
const TOQUES_ENTRE_CADA_CRUNCHY = 3;
const PAUSA_ANTES_DEL_INGLES_EN_MILISEGUNDOS = 1500;
const PAUSA_AL_TERMINAR_EN_MILISEGUNDOS = 1300;

const FRASES_AL_ELEGIR = ['¡Una!', '¡Dos!', '¡Tres!'];

/** Lo que va cambiando mientras se busca. */
interface Busqueda {
  readonly marco: Marco;
  readonly plato: Plato;
  readonly porEncontrar: number;
  encontradas: number;
  toquesEquivocados: number;
  /** Avisa que ya se encontraron todas. */
  alTerminar: () => void;
}

/**
 * Muestra la mesa y termina cuando ya se eligieron `porEncontrar` tostadas enteras (o si el minijuego se cierra).
 * Devuelve cuántas veces se tocó una tostada rota.
 */
export async function buscarEnteras(marco: Marco, porEncontrar: number): Promise<number> {
  const { contexto, area } = marco;
  area.replaceChildren();
  const pantalla = crear('div', 'tostadas-pantalla', area);
  crearImagen(contexto, 'spr_armando', 'tostadas-armando', pantalla);
  const mesa = crear('div', 'tostadas-mesa', pantalla);
  const plato = crearPlato(marco, pantalla, porEncontrar);

  const busqueda: Busqueda = { marco, plato, porEncontrar, encontradas: 0, toquesEquivocados: 0, alTerminar: () => {} };
  const yaSeEncontraronTodas = new Promise<void>((terminar) => {
    busqueda.alTerminar = terminar;
    marco.senal.addEventListener('abort', () => terminar(), { once: true });
  });

  for (const dibujo of revolver(listaDeDibujos(porEncontrar))) {
    ponerTostadaEnLaMesa(busqueda, mesa, dibujo);
  }
  marco.indicar('Busca tres tostadas enteritas. ¡Fíjate bien!', [DIBUJO_DE_ENTERA]);

  await yaSeEncontraronTodas;
  if (marco.senal.aborted) return busqueda.toquesEquivocados;
  marco.sonar('sfx_bien');
  await esperar(PAUSA_AL_TERMINAR_EN_MILISEGUNDOS, marco.senal);
  return busqueda.toquesEquivocados;
}

/** Los dibujos de todas las tostadas de la mesa, todavía en orden. */
function listaDeDibujos(enteras: number): string[] {
  const dibujos: string[] = [];
  for (let i = 0; i < enteras; i++) dibujos.push(DIBUJO_DE_ENTERA);
  for (let i = 0; i < TOSTADAS_CON_GRIETA; i++) dibujos.push(DIBUJO_CON_GRIETA);
  for (let i = 0; i < TOSTADAS_SIN_PEDAZO; i++) dibujos.push(DIBUJO_SIN_PEDAZO);
  return dibujos;
}

function ponerTostadaEnLaMesa(busqueda: Busqueda, mesa: HTMLElement, dibujo: string): void {
  const { marco } = busqueda;
  const tostada = crear('button', 'tostadas-tostada', mesa);
  tostada.type = 'button';
  tostada.setAttribute('aria-label', dibujo === DIBUJO_DE_ENTERA ? 'Tostada entera' : 'Tostada rota');
  const imagen = crearImagen(marco.contexto, dibujo, 'tostadas-tostada-dibujo', tostada);
  imagen.style.rotate = `${enteroAlAzar(-GIRO_MAXIMO_EN_GRADOS, GIRO_MAXIMO_EN_GRADOS)}deg`;

  tostada.addEventListener(
    'click',
    () => {
      if (dibujo === DIBUJO_DE_ENTERA) {
        elegirEntera(busqueda, tostada);
      } else {
        void avisarQueEstaRota(busqueda, tostada);
      }
    },
    { signal: marco.senal },
  );
}

function elegirEntera(busqueda: Busqueda, tostada: HTMLButtonElement): void {
  const { marco } = busqueda;
  // La tostada deja su hueco en la mesa (no se quita del todo) para que las demás no se muevan de lugar.
  tostada.disabled = true;
  tostada.classList.add('tostadas-tostada-elegida');
  busqueda.plato.agregarTostada();
  marco.sonar('sfx_pop');

  const frase = FRASES_AL_ELEGIR[busqueda.encontradas];
  busqueda.encontradas += 1;
  if (frase !== undefined) marco.decir(frase);
  if (busqueda.encontradas >= busqueda.porEncontrar) busqueda.alTerminar();
}

async function avisarQueEstaRota(busqueda: Busqueda, tostada: HTMLButtonElement): Promise<void> {
  const { marco } = busqueda;
  busqueda.toquesEquivocados += 1;
  marco.sonar('sfx_crujido');
  animar(tostada, 'mj-temblor');
  marco.decir('Esa está rota. Busca una enterita.');

  const tocaDecirCrunchy = busqueda.toquesEquivocados % TOQUES_ENTRE_CADA_CRUNCHY === 1;
  if (!tocaDecirCrunchy) return;
  const toquesAlEmpezar = busqueda.toquesEquivocados;
  const encontradasAlEmpezar = busqueda.encontradas;
  await esperar(PAUSA_ANTES_DEL_INGLES_EN_MILISEGUNDOS, marco.senal);
  // Si mientras tanto se tocó otra tostada, ya hay otra voz hablando: el primo mejor se calla.
  const nadaCambio = busqueda.toquesEquivocados === toquesAlEmpezar && busqueda.encontradas === encontradasAlEmpezar;
  if (marco.senal.aborted || !nadaCambio) return;
  marco.decir('crunchy!', 'en');
}
