// La zona plateada de la «Rascadita»: un `<canvas>` que tapa el premio y se borra por donde pasa el dedo.
//
// Para saber cuánto se ha destapado no se cuentan pixeles: la plata se reparte en una cuadrícula y se
// anota por cuáles cuadros ya pasó el dedo. Es menos exacto, pero se entiende y es de sobra para el juego.

import type { Marco } from '../comun/marco.ts';
import { revolver } from '../comun/piezas.ts';

/** El tamaño del dibujo de la plata, en sus propios pixeles (el CSS lo estira al tamaño de la ventana). */
const ANCHO_DE_LA_PLATA = 600;
const ALTO_DE_LA_PLATA = 360;
const COLUMNAS = 8;
const RENGLONES = 5;
const ANCHO_DEL_CUADRO = ANCHO_DE_LA_PLATA / COLUMNAS;
const ALTO_DEL_CUADRO = ALTO_DE_LA_PLATA / RENGLONES;
/** Qué tan gruesa es la raya que borra el dedo. Un poco más que un cuadro, para que no queden hilitos. */
const GROSOR_DEL_RASCADO = 86;
/** Con esta parte destapada, el boleto se termina de destapar solo. */
const PARTE_PARA_DESTAPAR = 0.5;
/** Cuántos cuadros rasca cada espacio o Enter. */
const CUADROS_POR_TECLA = 3;
/** El sonido de rascar se toca «de vez en cuando», no en cada movimiento. */
const PAUSA_ENTRE_SONIDOS_EN_MILISEGUNDOS = 320;
const SEPARACION_DE_LAS_RAYAS = 44;

interface Punto {
  readonly x: number;
  readonly y: number;
}

/**
 * Deja rascar la plata hasta destapar la mitad. Termina con `true` cuando ya se destapó,
 * o con `false` si el minijuego se cerró antes.
 */
export function rascarLaPlata(marco: Marco, plata: HTMLCanvasElement): Promise<boolean> {
  plata.width = ANCHO_DE_LA_PLATA;
  plata.height = ALTO_DE_LA_PLATA;
  const pincel = plata.getContext('2d');
  if (pincel === null) {
    // Un navegador sin `<canvas>` no puede rascar: se entrega el premio de una vez, sin atorar a nadie.
    return Promise.resolve(true);
  }
  pintarLaPlata(pincel);

  // Esta señal apaga el dedo y el teclado cuando el boleto se destapa o el juego se cierra.
  const fase = new AbortController();
  const cuadrosRascados = new Set<number>();
  const cuadrosParaElTeclado = revolver(Array.from({ length: COLUMNAS * RENGLONES }, (_, indice) => indice));
  let puntoAnterior: Punto | null = null;
  let momentoDelUltimoSonido = 0;

  return new Promise((terminar) => {
    const alCerrarElJuego = (): void => {
      fase.abort();
      terminar(false);
    };
    marco.senal.addEventListener('abort', alCerrarElJuego, { once: true });

    const rascarHasta = (punto: Punto): void => {
      borrarRaya(pincel, puntoAnterior ?? punto, punto);
      puntoAnterior = punto;
      cuadrosRascados.add(cuadroDe(punto));
      sonarDeVezEnCuando();
      revisarSiYaSeDestapo();
    };

    const sonarDeVezEnCuando = (): void => {
      const ahora = performance.now();
      if (ahora - momentoDelUltimoSonido < PAUSA_ENTRE_SONIDOS_EN_MILISEGUNDOS) return;
      momentoDelUltimoSonido = ahora;
      marco.sonar('sfx_rasca');
    };

    const revisarSiYaSeDestapo = (): void => {
      if (cuadrosRascados.size < COLUMNAS * RENGLONES * PARTE_PARA_DESTAPAR) return;
      marco.senal.removeEventListener('abort', alCerrarElJuego);
      fase.abort();
      terminar(true);
    };

    plata.addEventListener(
      'pointerdown',
      (evento) => {
        plata.setPointerCapture(evento.pointerId); // para seguir rascando aunque el dedo se salga tantito
        puntoAnterior = null;
        rascarHasta(puntoDelEvento(plata, evento));
      },
      { signal: fase.signal },
    );
    plata.addEventListener(
      'pointermove',
      (evento) => {
        // Solo rasca mientras el dedo (o el botón del ratón) está apretado.
        if (evento.buttons === 0) return;
        rascarHasta(puntoDelEvento(plata, evento));
      },
      { signal: fase.signal },
    );

    document.addEventListener(
      'keydown',
      (evento) => {
        if (evento.key !== ' ' && evento.key !== 'Enter') return;
        // Si el foco está en un botón (la X de salir), la tecla es para ese botón.
        if (evento.target instanceof HTMLButtonElement) return;
        evento.preventDefault();
        for (let i = 0; i < CUADROS_POR_TECLA; i++) {
          const cuadro = siguienteCuadroSinRascar(cuadrosParaElTeclado, cuadrosRascados);
          if (cuadro === undefined) return;
          puntoAnterior = null;
          rascarHasta(centroDelCuadro(cuadro));
        }
      },
      { signal: fase.signal },
    );
  });
}

/** Pinta la plata: gris con rayas inclinadas más claras, como el boleto del dibujo. */
function pintarLaPlata(pincel: CanvasRenderingContext2D): void {
  pincel.fillStyle = '#c9c9d1';
  pincel.fillRect(0, 0, ANCHO_DE_LA_PLATA, ALTO_DE_LA_PLATA);
  pincel.strokeStyle = '#dedee6';
  pincel.lineWidth = 14;
  for (let x = -ALTO_DE_LA_PLATA; x < ANCHO_DE_LA_PLATA; x += SEPARACION_DE_LAS_RAYAS) {
    pincel.beginPath();
    pincel.moveTo(x, ALTO_DE_LA_PLATA);
    pincel.lineTo(x + ALTO_DE_LA_PLATA, 0);
    pincel.stroke();
  }
}

/** Borra la plata a lo largo de una raya gruesa y redonda que termina en un círculo. */
function borrarRaya(pincel: CanvasRenderingContext2D, desde: Punto, hasta: Punto): void {
  pincel.globalCompositeOperation = 'destination-out'; // lo que se pinte borra en vez de pintar
  pincel.lineCap = 'round';
  pincel.lineWidth = GROSOR_DEL_RASCADO;
  pincel.beginPath();
  pincel.moveTo(desde.x, desde.y);
  pincel.lineTo(hasta.x, hasta.y);
  pincel.stroke();
  // Una raya sin largo (un solo toque, o un pedazo rascado con el teclado) no se dibuja: por eso el círculo.
  pincel.beginPath();
  pincel.arc(hasta.x, hasta.y, GROSOR_DEL_RASCADO / 2, 0, Math.PI * 2);
  pincel.fill();
}

/** Convierte la posición del dedo en la pantalla a pixeles de la plata. */
function puntoDelEvento(plata: HTMLCanvasElement, evento: PointerEvent): Punto {
  const orillas = plata.getBoundingClientRect();
  return {
    x: ((evento.clientX - orillas.left) / orillas.width) * ANCHO_DE_LA_PLATA,
    y: ((evento.clientY - orillas.top) / orillas.height) * ALTO_DE_LA_PLATA,
  };
}

/** El número del cuadro de la cuadrícula donde cae un punto (contando por renglones). */
function cuadroDe(punto: Punto): number {
  const columna = Math.min(COLUMNAS - 1, Math.max(0, Math.floor(punto.x / ANCHO_DEL_CUADRO)));
  const renglon = Math.min(RENGLONES - 1, Math.max(0, Math.floor(punto.y / ALTO_DEL_CUADRO)));
  return renglon * COLUMNAS + columna;
}

function centroDelCuadro(cuadro: number): Punto {
  const columna = cuadro % COLUMNAS;
  const renglon = Math.floor(cuadro / COLUMNAS);
  return { x: (columna + 0.5) * ANCHO_DEL_CUADRO, y: (renglon + 0.5) * ALTO_DEL_CUADRO };
}

function siguienteCuadroSinRascar(cuadros: readonly number[], rascados: ReadonlySet<number>): number | undefined {
  for (const cuadro of cuadros) {
    if (!rascados.has(cuadro)) return cuadro;
  }
  return undefined;
}
