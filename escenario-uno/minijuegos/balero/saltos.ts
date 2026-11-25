// Los brincos del barrilito: ensartarse en el palito, rebotar cuando no le atina y volver a colgar.
// Cada brinco es un vuelo por una curva; la promesa termina cuando el barrilito llegó.

import { animarDurante } from './animar-durante.ts';
import { AMPLITUD_EN_GRADOS, POSICION_ENSARTADO, posicionAlColgar } from './juguete.ts';
import type { Juguete, Punto } from './juguete.ts';

const DURACION_DE_LA_SUBIDA_EN_MILISEGUNDOS = 380;
const DURACION_DE_LA_CAIDA_AL_PALITO_EN_MILISEGUNDOS = 170;
const DURACION_DEL_REBOTE_EN_MILISEGUNDOS = 620;
const DURACION_AL_SOLTARSE_EN_MILISEGUNDOS = 560;

/** El centro del dibujo, de izquierda a derecha: ahí está el palito. */
const X_DEL_PALITO = 200;
/** Justo arriba de la punta del palito: de aquí cae el barrilito para ensartarse. */
const ARRIBA_DEL_PALITO: Punto = { x: X_DEL_PALITO, y: 56 };
/** Qué tan a un lado de la punta llega el barrilito cuando no le atina, y a qué altura. */
const DESVIO_AL_FALLAR = 64;
const ALTURA_AL_FALLAR = 98;
/** Las curvas se abren hacia un lado para que el barrilito rodee el palito en vez de atravesarlo. */
const APERTURA_DE_LA_CURVA = 175;
const ALTURA_DE_LA_CURVA_AL_SUBIR = 210;
const ALTURA_DE_LA_CURVA_AL_BAJAR = 130;
/** Al fallar, el barrilito da una maroma chistosa: gira esto mientras sube. */
const MAROMA_EN_GRADOS = 170;

/** Un vuelo del barrilito por una curva, de un punto a otro, mientras gira. */
interface Vuelo {
  readonly desde: Punto;
  /** La curva se jala hacia este punto (no pasa por él). */
  readonly jalandoHacia: Punto;
  readonly hasta: Punto;
  readonly giroInicialEnGrados: number;
  readonly giroFinalEnGrados: number;
  readonly duracionEnMilisegundos: number;
}

/** De qué lado del palito está un ángulo: 1 = derecha, -1 = izquierda. */
export function ladoDelAngulo(anguloEnGrados: number): number {
  if (anguloEnGrados < 0) return -1;
  return 1;
}

/** El barrilito sube desde donde colgaba y cae justo en la punta del palito. */
export async function ensartar(juguete: Juguete, anguloEnGrados: number, senal: AbortSignal): Promise<void> {
  const lado = ladoDelAngulo(anguloEnGrados);
  await volar(juguete, senal, {
    desde: posicionAlColgar(anguloEnGrados),
    jalandoHacia: { x: X_DEL_PALITO + lado * APERTURA_DE_LA_CURVA, y: ALTURA_DE_LA_CURVA_AL_SUBIR },
    hasta: ARRIBA_DEL_PALITO,
    giroInicialEnGrados: -anguloEnGrados,
    giroFinalEnGrados: 0,
    duracionEnMilisegundos: DURACION_DE_LA_SUBIDA_EN_MILISEGUNDOS,
  });
  await volar(juguete, senal, {
    desde: ARRIBA_DEL_PALITO,
    jalandoHacia: ARRIBA_DEL_PALITO,
    hasta: POSICION_ENSARTADO,
    giroInicialEnGrados: 0,
    giroFinalEnGrados: 0,
    duracionEnMilisegundos: DURACION_DE_LA_CAIDA_AL_PALITO_EN_MILISEGUNDOS,
  });
}

/** El barrilito sube chueco, da una maroma junto a la punta del palito y se queda en el aire, listo para caer. */
export async function subirSinAtinar(juguete: Juguete, anguloEnGrados: number, senal: AbortSignal): Promise<void> {
  const lado = ladoDelAngulo(anguloEnGrados);
  await volar(juguete, senal, {
    desde: posicionAlColgar(anguloEnGrados),
    jalandoHacia: { x: X_DEL_PALITO + lado * APERTURA_DE_LA_CURVA, y: ALTURA_DE_LA_CURVA_AL_SUBIR },
    hasta: puntoAlFallar(lado),
    giroInicialEnGrados: -anguloEnGrados,
    giroFinalEnGrados: lado * MAROMA_EN_GRADOS,
    duracionEnMilisegundos: DURACION_DE_LA_SUBIDA_EN_MILISEGUNDOS,
  });
}

/** Después de no atinar, el barrilito cae de regreso y queda colgando en el extremo de ese lado. */
export async function caerDelRebote(juguete: Juguete, lado: number, senal: AbortSignal): Promise<void> {
  await volar(juguete, senal, {
    desde: puntoAlFallar(lado),
    jalandoHacia: { x: X_DEL_PALITO + lado * APERTURA_DE_LA_CURVA, y: ALTURA_DE_LA_CURVA_AL_BAJAR },
    hasta: posicionAlColgar(lado * AMPLITUD_EN_GRADOS),
    giroInicialEnGrados: lado * MAROMA_EN_GRADOS,
    giroFinalEnGrados: -lado * AMPLITUD_EN_GRADOS,
    duracionEnMilisegundos: DURACION_DEL_REBOTE_EN_MILISEGUNDOS,
  });
}

/** El barrilito se suelta del palito y queda colgando en el extremo del lado que se pida, listo para mecerse. */
export async function soltarDelPalito(juguete: Juguete, lado: number, senal: AbortSignal): Promise<void> {
  await volar(juguete, senal, {
    desde: POSICION_ENSARTADO,
    jalandoHacia: { x: X_DEL_PALITO + lado * APERTURA_DE_LA_CURVA, y: 0 },
    hasta: posicionAlColgar(lado * AMPLITUD_EN_GRADOS),
    giroInicialEnGrados: 0,
    giroFinalEnGrados: -lado * AMPLITUD_EN_GRADOS,
    duracionEnMilisegundos: DURACION_AL_SOLTARSE_EN_MILISEGUNDOS,
  });
}

function puntoAlFallar(lado: number): Punto {
  return { x: X_DEL_PALITO + lado * DESVIO_AL_FALLAR, y: ALTURA_AL_FALLAR };
}

async function volar(juguete: Juguete, senal: AbortSignal, vuelo: Vuelo): Promise<void> {
  await animarDurante(vuelo.duracionEnMilisegundos, senal, (avance) => {
    const giro = mezclar(vuelo.giroInicialEnGrados, vuelo.giroFinalEnGrados, avance);
    juguete.colocar(puntoDeLaCurva(vuelo, avance), giro);
  });
}

/** El valor que está entre `inicio` y `fin`, tan avanzado como diga `avance` (de 0 a 1). */
function mezclar(inicio: number, fin: number, avance: number): number {
  return inicio + (fin - inicio) * avance;
}

/**
 * El punto de la curva del vuelo cuando va en `avance` (de 0 a 1). Es una curva de Bézier de tres puntos:
 * se mezclan los dos tramos (desde → jalón, jalón → hasta) y luego se mezclan entre sí.
 * No hace falta entender la fórmula para usarla: empieza en `desde`, termina en `hasta` y se comba hacia el jalón.
 */
function puntoDeLaCurva(vuelo: Vuelo, avance: number): Punto {
  const xDelPrimerTramo = mezclar(vuelo.desde.x, vuelo.jalandoHacia.x, avance);
  const yDelPrimerTramo = mezclar(vuelo.desde.y, vuelo.jalandoHacia.y, avance);
  const xDelSegundoTramo = mezclar(vuelo.jalandoHacia.x, vuelo.hasta.x, avance);
  const yDelSegundoTramo = mezclar(vuelo.jalandoHacia.y, vuelo.hasta.y, avance);
  return {
    x: mezclar(xDelPrimerTramo, xDelSegundoTramo, avance),
    y: mezclar(yDelPrimerTramo, yDelSegundoTramo, avance),
  };
}
