// Fase 1 del minijuego «Chiles»: la lluvia de chiles y la canasta que los atrapa.
// Arma la escena (Doña Igu, el cielo, los contadores, la canasta) y lleva el paso del juego cuadro por cuadro.
//
// Nunca castiga y siempre se puede terminar: los chiles que hacen falta siguen cayendo sin límite.

import type { Marco } from '../comun/marco.ts';
import { animar, crear, crearImagen, enteroAlAzar } from '../comun/piezas.ts';
import { crearCanasta } from './canasta.ts';
import type { Canasta } from './canasta.ts';
import { CHILES_POR_TIPO, crearContadores } from './contadores.ts';
import type { Contadores } from './contadores.ts';
import { despedirCosa, moverCosa, soltarCosa, TIPOS_DE_CHILE } from './lluvia.ts';
import type { CosaQueCae, TipoDeChile } from './lluvia.ts';

const SEGUNDOS_ENTRE_COSAS = 1.1;
/** Una de cada tantas cosas que caen es un estorbo (jitomate, chile verde o flor). */
const CADA_CUANTAS_COSAS_CAE_UN_ESTORBO = 4;
/** Si el navegador se atora (o la pestaña se oculta), el juego no da un salto: avanza a lo más esto por cuadro. */
const SEGUNDOS_MAXIMOS_POR_CUADRO = 0.05;
/** Cuánto más abajo de la boca de la canasta todavía se puede atrapar algo (fracción del alto del cielo). */
const TOLERANCIA_BAJO_LA_BOCA = 0.08;
/** A esta altura las cosas tocan el piso y desaparecen. */
const ALTURA_DEL_PISO = 0.94;
/** Bobby dice su palabra en inglés cuando se han atrapado estos chiles en total. */
const ATRAPADOS_PARA_QUE_HABLE_BOBBY: Readonly<Record<number, string>> = { 3: 'chili!', 7: 'hot!' };

const NOMBRE_DE_CADA_CHILE: Readonly<Record<TipoDeChile, string>> = {
  guajillo: '¡Chile guajillo!',
  ancho: '¡Chile ancho!',
};

/** Todo lo que cambia mientras se juega la fase. */
interface Partida {
  readonly marco: Marco;
  readonly cielo: HTMLElement;
  readonly igu: HTMLElement;
  readonly canasta: Canasta;
  readonly contadores: Contadores;
  cosas: CosaQueCae[];
  segundosParaLaSiguienteCosa: number;
  cosasSoltadas: number;
  /** Chiles que hacían falta y se fueron al piso. Solo sirve para las estrellas del final. */
  chilesCaidos: number;
}

/**
 * Juega la fase hasta llenar los dos contadores. Devuelve cuántos chiles buenos se fueron al piso,
 * o `null` si el minijuego se cerró antes.
 */
export function atraparLosChiles(marco: Marco): Promise<number | null> {
  // Esta señal apaga lo que solo sirve durante la fase (dedo y teclado) cuando la fase termina o el juego se cierra.
  const fase = new AbortController();
  const partida = armarLaEscena(marco, fase.signal);
  marco.sonar('sfx_achu');
  // Sin dibujos en la franja: su lugar lo ocupan los contadores, que ya enseñan qué chiles hay que atrapar.
  marco.indicar('¡Los chiles salieron volando! Atrápalos con la canasta.');

  return new Promise((terminar) => {
    let cuadroPedido = 0;
    let momentoAnterior = performance.now();

    const alCerrarElJuego = (): void => {
      cancelAnimationFrame(cuadroPedido);
      fase.abort();
      terminar(null);
    };
    marco.senal.addEventListener('abort', alCerrarElJuego, { once: true });

    const avanzarUnCuadro = (momento: number): void => {
      const segundos = Math.min(SEGUNDOS_MAXIMOS_POR_CUADRO, (momento - momentoAnterior) / 1000);
      momentoAnterior = momento;
      avanzar(partida, segundos);

      if (yaEstanTodos(partida.contadores)) {
        marco.senal.removeEventListener('abort', alCerrarElJuego);
        fase.abort();
        despedirLoQueSigueCayendo(partida);
        terminar(partida.chilesCaidos);
        return;
      }
      cuadroPedido = requestAnimationFrame(avanzarUnCuadro);
    };
    cuadroPedido = requestAnimationFrame(avanzarUnCuadro);
  });
}

function armarLaEscena(marco: Marco, senalDeLaFase: AbortSignal): Partida {
  marco.area.replaceChildren();
  const escena = crear('div', 'chiles-escena', marco.area);
  crear('div', 'chiles-piso', escena);
  const igu = crearImagen(marco.contexto, 'spr_igu', 'chiles-igu', escena);
  const cielo = crear('div', 'chiles-cielo', escena);
  return {
    marco,
    cielo,
    igu,
    contadores: crearContadores(marco, escena),
    canasta: crearCanasta(marco, cielo, senalDeLaFase),
    cosas: [],
    segundosParaLaSiguienteCosa: 0,
    cosasSoltadas: 0,
    chilesCaidos: 0,
  };
}

/** Un paso del juego: mueve la canasta, suelta cosas nuevas y hace caer las que ya vuelan. */
function avanzar(partida: Partida, segundos: number): void {
  partida.canasta.mover(segundos);

  partida.segundosParaLaSiguienteCosa -= segundos;
  if (partida.segundosParaLaSiguienteCosa <= 0) {
    partida.segundosParaLaSiguienteCosa = SEGUNDOS_ENTRE_COSAS;
    soltarLaSiguienteCosa(partida);
  }

  const boca = partida.canasta.boca();
  const siguenCayendo: CosaQueCae[] = [];
  for (const cosa of partida.cosas) {
    moverCosa(cosa, segundos);
    const estaSobreLaBoca = cosa.x >= boca.izquierda && cosa.x <= boca.derecha;
    if (!cosa.yaPasoLaCanasta && cosa.y >= boca.altura && estaSobreLaBoca) {
      recibirEnLaCanasta(partida, cosa);
    } else if (cosa.y >= ALTURA_DEL_PISO) {
      dejarEnElPiso(partida, cosa);
    } else {
      cosa.yaPasoLaCanasta = cosa.y > boca.altura + TOLERANCIA_BAJO_LA_BOCA;
      siguenCayendo.push(cosa);
    }
  }
  partida.cosas = siguenCayendo;
}

function soltarLaSiguienteCosa(partida: Partida): void {
  partida.cosasSoltadas += 1;
  const tocaEstorbo = partida.cosasSoltadas % CADA_CUANTAS_COSAS_CAE_UN_ESTORBO === 0;
  const chile = tocaEstorbo ? null : elegirUnChileQueFalte(partida.contadores);
  partida.cosas.push(soltarCosa(partida.marco, partida.cielo, chile));
}

/** Solo caen chiles de los que todavía hacen falta: así el final nunca se alarga de más. */
function elegirUnChileQueFalte(contadores: Contadores): TipoDeChile | null {
  const queFaltan = TIPOS_DE_CHILE.filter((chile) => contadores.falta(chile));
  if (queFaltan.length === 0) return null;
  return queFaltan[enteroAlAzar(0, queFaltan.length - 1)]!; // el índice siempre está dentro de la lista
}

function recibirEnLaCanasta(partida: Partida, cosa: CosaQueCae): void {
  const { marco, canasta, contadores } = partida;
  canasta.brincar();
  if (cosa.chile === null || !contadores.falta(cosa.chile)) {
    // No hacía falta: rebota chistoso y se va. Sin regaño.
    marco.sonar('sfx_toc');
    despedirCosa(cosa, 'chiles-cosa-rebota');
    return;
  }

  contadores.sumar(cosa.chile);
  marco.sonar('sfx_pop');
  despedirCosa(cosa, 'chiles-cosa-atrapada');
  animar(partida.igu, 'chiles-igu-feliz');
  decirLoQueSeAtrapo(partida, cosa.chile);
}

/** La voz nombra cada chile la primera vez que se atrapa; Bobby dice su palabra en inglés un par de veces. */
function decirLoQueSeAtrapo(partida: Partida, chile: TipoDeChile): void {
  const { marco, contadores } = partida;
  if (contadores.cuantos(chile) === 1) {
    marco.decir(NOMBRE_DE_CADA_CHILE[chile]);
    return;
  }
  const atrapadosEnTotal = contadores.cuantos('guajillo') + contadores.cuantos('ancho');
  if (Object.hasOwn(ATRAPADOS_PARA_QUE_HABLE_BOBBY, atrapadosEnTotal)) {
    marco.decir(ATRAPADOS_PARA_QUE_HABLE_BOBBY[atrapadosEnTotal]!, 'en'); // `hasOwn` acaba de comprobar que existe
  }
}

function dejarEnElPiso(partida: Partida, cosa: CosaQueCae): void {
  despedirCosa(cosa, 'chiles-cosa-se-va');
  if (cosa.chile === null || !partida.contadores.falta(cosa.chile)) return;
  partida.chilesCaidos += 1;
  // Doña Igu se asusta un poquito, pero nadie regaña: ya viene otro chile.
  animar(partida.igu, 'chiles-igu-susto');
}

function yaEstanTodos(contadores: Contadores): boolean {
  return contadores.cuantos('guajillo') === CHILES_POR_TIPO && contadores.cuantos('ancho') === CHILES_POR_TIPO;
}

function despedirLoQueSigueCayendo(partida: Partida): void {
  for (const cosa of partida.cosas) {
    despedirCosa(cosa, 'chiles-cosa-se-va');
  }
  partida.cosas = [];
  animar(partida.igu, 'chiles-igu-feliz');
}
