// El dibujo del balero: un palito con mango, un barrilito con su hoyo y el cordón que los une.
// Aquí solo se dibuja y se coloca; cómo se mueve está en pendulo.ts y en saltos.ts.
//
// Todas las medidas están en «unidades del dibujo»: el SVG mide 400 × 470 y se estira al tamaño de la pantalla.

import { crear } from '../comun/piezas.ts';

export interface Punto {
  readonly x: number;
  readonly y: number;
}

/** Qué tan lejos del centro (en grados, hacia cada lado) el barrilito todavía se ensarta. Generoso a propósito. */
export const TOLERANCIA_EN_GRADOS = 18;
/** Hasta dónde se mece el barrilito hacia cada lado. */
export const AMPLITUD_EN_GRADOS = 40;
/** Donde queda el centro del barrilito cuando está ensartado en el palito. */
export const POSICION_ENSARTADO: Punto = { x: 200, y: 146 };

/** El nudo del cordón en el palito: de aquí cuelga el barrilito. */
const NUDO_DEL_PALITO: Punto = { x: 200, y: 214 };
/** Del nudo del palito al centro del barrilito cuando cuelga. */
const DISTANCIA_AL_COLGAR = 198;
/** Del centro del barrilito a su nudo, que está en la parte de arriba. */
const ALTURA_DEL_NUDO_DEL_BARRILITO = 46;
/** La franja de luz que marca la zona buena: desde qué distancia del nudo empieza y hasta cuál llega. */
const RADIO_INTERIOR_DE_LA_ZONA = 128;
const RADIO_EXTERIOR_DE_LA_ZONA = 262;
/** Qué tanto se cuelga el cordón hacia un lado cuando está flojo (parte de lo que le sobra). */
const PARTE_DEL_SOBRANTE_QUE_SE_COMBA = 0.7;
const GRADOS_POR_RADIAN = 180 / Math.PI;

const DIBUJO_DEL_BALERO = `
<svg class="balero-dibujo" viewBox="0 0 400 470" aria-hidden="true"
  stroke="#572d09" stroke-width="6" stroke-linejoin="round" stroke-linecap="round">
  <path class="balero-zona" />
  <g class="balero-palito">
    <rect x="192" y="112" width="16" height="112" rx="8" fill="#e9b45a" />
    <path d="M175 214 H225 L218 240 H182 Z" fill="#fed449" />
    <rect x="182" y="236" width="36" height="96" rx="16" fill="#17b5b0" />
    <path d="M183 264 H217 M183 304 H217" stroke-width="5" />
  </g>
  <path class="balero-cordon" />
  <g class="balero-barrilito">
    <g class="balero-barrilito-cuerpo">
      <ellipse cx="0" cy="38" rx="37" ry="10" fill="#8a1a12" />
      <path d="M-37 38 Q-42 -46 0 -46 Q42 -46 37 38 Q0 54 -37 38 Z" fill="#e2452f" />
      <path d="M-39 -4 Q0 12 39 -4" fill="none" stroke="#fed449" stroke-width="7" />
      <path d="M-38 16 Q0 32 38 16" fill="none" stroke="#17b5b0" stroke-width="7" />
      <path d="M-22 -28 Q-12 -38 2 -38" fill="none" stroke="#fff6e0" stroke-width="5" opacity="0.7" />
      <ellipse cx="0" cy="44" rx="15" ry="4.5" fill="#572d09" stroke="none" />
      <circle cx="0" cy="-46" r="6" fill="#fed449" />
    </g>
  </g>
</svg>`;

export interface Juguete {
  /** Pone el barrilito colgando del cordón, a tantos grados del centro (positivo = a la derecha). */
  colgar(anguloEnGrados: number): void;
  /** Pone el centro del barrilito en un punto del dibujo, girado tantos grados. El cordón lo sigue. */
  colocar(posicion: Punto, giroEnGrados: number): void;
  /** Prende o apaga la luz de la zona buena. */
  encenderZona(encendida: boolean): void;
  /** Repite una animación de CSS sobre todo el dibujo (por ejemplo, el brinquito al ensartar). */
  animar(claseDeAnimacion: string): void;
}

/** Dónde queda el centro del barrilito cuando cuelga a tantos grados del centro. */
export function posicionAlColgar(anguloEnGrados: number): Punto {
  return puntoDesdeElNudo(anguloEnGrados, DISTANCIA_AL_COLGAR);
}

/** El punto que está a cierta distancia del nudo del palito, hacia abajo, desviado tantos grados. */
function puntoDesdeElNudo(anguloEnGrados: number, distancia: number): Punto {
  const anguloEnRadianes = anguloEnGrados / GRADOS_POR_RADIAN;
  return {
    x: NUDO_DEL_PALITO.x + distancia * Math.sin(anguloEnRadianes),
    y: NUDO_DEL_PALITO.y + distancia * Math.cos(anguloEnRadianes),
  };
}

/** Dibuja el balero dentro de `padre`, con el barrilito colgando quieto en el centro. */
export function crearJuguete(padre: HTMLElement): Juguete {
  const lienzo = crear('div', 'balero-juguete', padre);
  lienzo.innerHTML = DIBUJO_DEL_BALERO; // es un texto fijo de este archivo, no viene de afuera
  const zona = buscarPieza(lienzo, '.balero-zona');
  const cordon = buscarPieza(lienzo, '.balero-cordon');
  const barrilito = buscarPieza(lienzo, '.balero-barrilito');
  zona.setAttribute('d', trazoDeLaZonaBuena());

  const juguete: Juguete = {
    colgar(anguloEnGrados) {
      // Al colgar, la parte de arriba del barrilito apunta al nudo: por eso gira al revés que el ángulo.
      juguete.colocar(posicionAlColgar(anguloEnGrados), -anguloEnGrados);
    },
    colocar(posicion, giroEnGrados) {
      barrilito.setAttribute('transform', `translate(${posicion.x} ${posicion.y}) rotate(${giroEnGrados})`);
      cordon.setAttribute('d', trazoDelCordon(nudoDelBarrilito(posicion, giroEnGrados)));
    },
    encenderZona(encendida) {
      zona.classList.toggle('balero-zona-encendida', encendida);
    },
    animar(claseDeAnimacion) {
      lienzo.classList.remove(claseDeAnimacion);
      // Leer el ancho obliga al navegador a notar que la clase se quitó; sin esto la animación no vuelve a empezar.
      void lienzo.offsetWidth;
      lienzo.classList.add(claseDeAnimacion);
    },
  };
  juguete.colgar(0);
  return juguete;
}

function buscarPieza(lienzo: HTMLElement, selector: string): Element {
  const pieza = lienzo.querySelector(selector);
  if (pieza === null) throw new Error(`[balero] al dibujo del balero le falta la pieza "${selector}"`);
  return pieza;
}

/** Dónde queda el nudo del barrilito (su parte de arriba) cuando su centro está en `posicion` y está girado. */
function nudoDelBarrilito(posicion: Punto, giroEnGrados: number): Punto {
  const giroEnRadianes = giroEnGrados / GRADOS_POR_RADIAN;
  return {
    x: posicion.x + ALTURA_DEL_NUDO_DEL_BARRILITO * Math.sin(giroEnRadianes),
    y: posicion.y - ALTURA_DEL_NUDO_DEL_BARRILITO * Math.cos(giroEnRadianes),
  };
}

/**
 * El cordón, del nudo del palito al nudo del barrilito. Cuando el barrilito está cerca del palito,
 * al cordón le sobra largo: se dibuja como una curva que se comba hacia un lado y hacia abajo.
 */
function trazoDelCordon(extremo: Punto): string {
  const largoDelCordon = DISTANCIA_AL_COLGAR - ALTURA_DEL_NUDO_DEL_BARRILITO;
  const separacion = Math.hypot(extremo.x - NUDO_DEL_PALITO.x, extremo.y - NUDO_DEL_PALITO.y);
  const comba = Math.max(0, largoDelCordon - separacion) * PARTE_DEL_SOBRANTE_QUE_SE_COMBA;
  const xDelMedio = (NUDO_DEL_PALITO.x + extremo.x) / 2;
  const yDelMedio = (NUDO_DEL_PALITO.y + extremo.y) / 2;
  const inicio = `${NUDO_DEL_PALITO.x} ${NUDO_DEL_PALITO.y}`;
  return `M${inicio} Q${xDelMedio + comba} ${yDelMedio + comba} ${extremo.x} ${extremo.y}`;
}

/** La franja de luz bajo el palito: un pedazo de anillo que abarca la tolerancia hacia cada lado. */
function trazoDeLaZonaBuena(): string {
  const adentroIzquierda = puntoDesdeElNudo(-TOLERANCIA_EN_GRADOS, RADIO_INTERIOR_DE_LA_ZONA);
  const adentroDerecha = puntoDesdeElNudo(TOLERANCIA_EN_GRADOS, RADIO_INTERIOR_DE_LA_ZONA);
  const afueraDerecha = puntoDesdeElNudo(TOLERANCIA_EN_GRADOS, RADIO_EXTERIOR_DE_LA_ZONA);
  const afueraIzquierda = puntoDesdeElNudo(-TOLERANCIA_EN_GRADOS, RADIO_EXTERIOR_DE_LA_ZONA);
  const radioDeAdentro = `${RADIO_INTERIOR_DE_LA_ZONA} ${RADIO_INTERIOR_DE_LA_ZONA}`;
  const radioDeAfuera = `${RADIO_EXTERIOR_DE_LA_ZONA} ${RADIO_EXTERIOR_DE_LA_ZONA}`;
  // En un trazo de SVG, «A» dibuja un arco de círculo hasta el punto que se le da.
  const arcoDeAdentro = `A${radioDeAdentro} 0 0 0 ${adentroDerecha.x} ${adentroDerecha.y}`;
  const arcoDeAfuera = `A${radioDeAfuera} 0 0 1 ${afueraIzquierda.x} ${afueraIzquierda.y}`;
  const inicio = `M${adentroIzquierda.x} ${adentroIzquierda.y}`;
  return `${inicio} ${arcoDeAdentro} L${afueraDerecha.x} ${afueraDerecha.y} ${arcoDeAfuera} Z`;
}
