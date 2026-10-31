/**
 * Geometría simple para el piso caminable, las huellas de los props y los hotspots (§7.3).
 * No hay motor de física: solo puntos, rectángulos, elipses y polígonos.
 */
import type { Punto } from './esquema';

/** Un rectángulo o una elipse se describen por la caja que los contiene. */
export interface Caja {
  x: number;
  y: number;
  ancho: number;
  alto: number;
}

export type Forma =
  | ({ tipo: 'rect' } & Caja)
  | ({ tipo: 'elipse' } & Caja)
  | { tipo: 'poligono'; puntos: Punto[] };

/** Distancia (en píxeles lógicos) a la que se considera que alguien ya llegó a su destino. */
export const TOLERANCIA_DE_LLEGADA = 6;

export function distancia(a: Punto, b: Punto): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * ¿El punto está dentro del polígono?
 * Algoritmo clásico de "lanzar un rayo": se cuenta cuántas veces una línea horizontal
 * que sale del punto cruza los bordes. Si cruza un número impar de veces, está dentro.
 */
export function puntoDentroDePoligono(punto: Punto, poligono: Punto[]): boolean {
  let dentro = false;
  for (let i = 0; i < poligono.length; i++) {
    const a = poligono[i]!;
    const b = poligono[(i + 1) % poligono.length]!;
    const elBordeCruzaLaAlturaDelPunto = a.y > punto.y !== b.y > punto.y;
    if (!elBordeCruzaLaAlturaDelPunto) continue;
    const xDelCruce = a.x + ((punto.y - a.y) * (b.x - a.x)) / (b.y - a.y);
    if (punto.x < xDelCruce) dentro = !dentro;
  }
  return dentro;
}

export function puntoDentroDeForma(punto: Punto, forma: Forma): boolean {
  if (forma.tipo === 'poligono') {
    return puntoDentroDePoligono(punto, forma.puntos);
  }
  if (forma.tipo === 'rect') {
    const dentroEnX = punto.x >= forma.x && punto.x <= forma.x + forma.ancho;
    const dentroEnY = punto.y >= forma.y && punto.y <= forma.y + forma.alto;
    return dentroEnX && dentroEnY;
  }
  // Elipse: (dx / radioX)² + (dy / radioY)² <= 1
  const radioX = forma.ancho / 2;
  const radioY = forma.alto / 2;
  const dx = (punto.x - (forma.x + radioX)) / radioX;
  const dy = (punto.y - (forma.y + radioY)) / radioY;
  return dx * dx + dy * dy <= 1;
}

export function cajaDeForma(forma: Forma): Caja {
  if (forma.tipo !== 'poligono') {
    return { x: forma.x, y: forma.y, ancho: forma.ancho, alto: forma.alto };
  }
  const xs = forma.puntos.map((p) => p.x);
  const ys = forma.puntos.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, ancho: Math.max(...xs) - x, alto: Math.max(...ys) - y };
}

/** El punto «de pie» de una forma: el centro de su borde inferior. */
export function puntoDePie(forma: Forma): Punto {
  const caja = cajaDeForma(forma);
  return { x: caja.x + caja.ancho / 2, y: caja.y + caja.alto };
}

/** El punto del segmento a–b más cercano a `punto`. */
function puntoMasCercanoEnSegmento(punto: Punto, a: Punto, b: Punto): Punto {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const largoAlCuadrado = dx * dx + dy * dy;
  if (largoAlCuadrado === 0) return a;

  // t = qué tan lejos sobre el segmento cae la proyección del punto (0 = en a, 1 = en b).
  let t = ((punto.x - a.x) * dx + (punto.y - a.y) * dy) / largoAlCuadrado;
  t = Math.max(0, Math.min(1, t));
  return { x: a.x + t * dx, y: a.y + t * dy };
}

/**
 * Ajusta un punto al piso caminable: si ya está dentro de algún polígono lo devuelve igual;
 * si no, devuelve el punto más cercano dentro del piso.
 */
export function ajustarAlPiso(punto: Punto, pisos: Punto[][]): Punto {
  for (const poligono of pisos) {
    if (puntoDentroDePoligono(punto, poligono)) return punto;
  }

  let mejorPunto = punto;
  let mejorDistancia = Infinity;
  let mejorPoligono: Punto[] = [];
  let bordeA = punto;
  let bordeB = punto;

  for (const poligono of pisos) {
    for (let i = 0; i < poligono.length; i++) {
      const a = poligono[i]!;
      const b = poligono[(i + 1) % poligono.length]!;
      const candidato = puntoMasCercanoEnSegmento(punto, a, b);
      const distanciaCandidato = distancia(punto, candidato);
      if (distanciaCandidato < mejorDistancia) {
        mejorPunto = candidato;
        mejorDistancia = distanciaCandidato;
        mejorPoligono = poligono;
        bordeA = a;
        bordeB = b;
      }
    }
  }

  return empujarHaciaAdentro(mejorPunto, bordeA, bordeB, mejorPoligono);
}

/**
 * Un punto exactamente sobre el borde es ambiguo (puede contar como dentro o fuera),
 * así que se mueve 1 px en dirección perpendicular al borde, hacia el interior.
 */
function empujarHaciaAdentro(punto: Punto, bordeA: Punto, bordeB: Punto, poligono: Punto[]): Punto {
  const largo = distancia(bordeA, bordeB) || 1;
  const perpendicular = { x: -(bordeB.y - bordeA.y) / largo, y: (bordeB.x - bordeA.x) / largo };

  const haciaUnLado = { x: punto.x + perpendicular.x, y: punto.y + perpendicular.y };
  if (puntoDentroDePoligono(haciaUnLado, poligono)) return haciaUnLado;
  return { x: punto.x - perpendicular.x, y: punto.y - perpendicular.y };
}

/**
 * Calcula la siguiente posición de alguien que camina hacia `destino` durante `segundos`.
 *
 * La velocidad es distinta en cada eje (en diagonal se avanza más lento en vertical).
 * Si el paso directo choca con un borde o una huella, se prueban alternativas para
 * "deslizarse" a lo largo del obstáculo. Si ninguna sirve, se queda donde está.
 *
 * Limitación conocida: no rodea obstáculos grandes (no hay búsqueda de caminos).
 * Ver la pregunta abierta 1 de la spec (§18); si hace falta, reemplazar por A* sobre el piso.
 */
export function avanzarHacia(
  posicion: Punto,
  destino: Punto,
  velocidad: { x: number; y: number },
  segundos: number,
  esCaminable: (punto: Punto) => boolean,
): Punto {
  const maximoX = velocidad.x * segundos;
  const maximoY = velocidad.y * segundos;
  const pasoX = limitar(destino.x - posicion.x, maximoX);
  const pasoY = limitar(destino.y - posicion.y, maximoY);
  const sentidoVertical = pasoY < 0 ? -1 : 1;

  const intentos = [
    { x: pasoX, y: pasoY }, //                        directo al destino
    { x: pasoX, y: 0 }, //                            solo horizontal (deslizarse por un borde de arriba o abajo)
    { x: 0, y: pasoY }, //                            solo vertical (deslizarse por un borde lateral)
    { x: pasoX, y: sentidoVertical * maximoY }, //    horizontal subiendo o bajando (bordes inclinados)
    { x: pasoX, y: -sentidoVertical * maximoY },
  ];

  for (const intento of intentos) {
    if (intento.x === 0 && intento.y === 0) continue;
    const siguiente = { x: posicion.x + intento.x, y: posicion.y + intento.y };
    if (esCaminable(siguiente)) return siguiente;
  }
  return posicion;
}

/** Recorta `valor` para que quede entre -maximo y +maximo. */
function limitar(valor: number, maximo: number): number {
  return Math.max(-maximo, Math.min(maximo, valor));
}

export function haLlegado(posicion: Punto, destino: Punto): boolean {
  return distancia(posicion, destino) <= TOLERANCIA_DE_LLEGADA;
}
