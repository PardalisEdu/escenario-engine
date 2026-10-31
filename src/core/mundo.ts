/**
 * El modelo del mundo: el DÓNDE de un nivel (§5).
 *
 * Sale del mapa de Tiled (ver mapa-tiled.ts) o, en el formato v1 sin mapa,
 * de las coordenadas del JSON (ver legacy.ts). El resto del motor solo conoce este modelo,
 * así que no le importa de dónde vino.
 *
 * Todas las coordenadas son de mundo: origen arriba a la izquierda, la y crece hacia abajo.
 */
import type { Mira, Punto } from './esquema';
import type { Forma } from './geometria';

/** Un NPC o la salida: algo que se toca para interactuar. */
export interface Entidad {
  /** Cómo nombrarlo en un mensaje de error, por ejemplo: objeto #12 "Doña Tortu". */
  descripcion: string;
  /** Centro del borde inferior: donde «pisa». Sirve para ordenar la profundidad. */
  puntoDePie: Punto;
  /** Área que responde al toque. */
  hotspot: Forma;
  mira: Mira;
  /** A dónde camina el jugador antes de interactuar. */
  puntoInteraccion?: Punto;
}

/** Un objeto de decorado (cajas, comal, puesto...). */
export interface Prop {
  descripcion: string;
  /** Clase del catálogo cerrado (ver CATALOGO_DE_DECORADO). */
  clase: string;
  /** Clave de la imagen. Un puesto sin imagen se dibuja con figuras. */
  asset?: string;
  puntoDePie: Punto;
  /** 0 = usar el tamaño de la imagen. */
  ancho: number;
  alto: number;
  volteadoHorizontal: boolean;
  /** Si es false, su huella (la franja de abajo) bloquea el paso. */
  pisable: boolean;
  /** Ajuste manual del orden de dibujo. */
  ajusteDeProfundidad: number;
  /** Alto de la huella en píxeles. Si falta, 20 % del alto del prop. */
  altoDeHuella?: number;
  /** Se dibuja encima de los personajes (techo, papel picado). */
  encima: boolean;
  /** Si tiene id, es interactivo: su diálogo está en "interactivos" del contenido. */
  id?: string;
  /** Solo para la clase "puesto": color de la lona y texto del letrero. */
  lona?: string;
  letrero?: string;
}

/** Una capa de fondo o de frente con parallax (§6.3). */
export interface CapaDeImagen {
  asset: string;
  /** 1 = se mueve con la cámara; menos de 1 = más lento (fondo); más de 1 = más rápido (frente). */
  parallax: number;
  x: number;
  y: number;
  /** Se dibuja delante de los personajes. */
  alFrente: boolean;
}

export interface ZonaDeComentario {
  descripcion: string;
  forma: Forma;
  /** Qué lista de "comentarios" usar. */
  grupo: string;
  /** Segundos antes de poder repetir un comentario en esta zona. */
  esperaEnSegundos: number;
}

export interface EnfoqueDeCamara {
  x: number;
  y: number;
  orden: number;
  zoom: number;
}

export interface InicioDelJugador extends Punto {
  descripcion: string;
  mira: Mira;
}

export interface Salida extends Entidad {
  /** Mostrar la flecha animada que señala la salida. */
  conFlecha: boolean;
}

export interface Mundo {
  ancho: number;
  alto: number;
  capas: CapaDeImagen[];
  props: Prop[];
  /** NPCs por id. */
  npcs: Record<string, Entidad>;
  /** Debe haber exactamente uno; se guarda como lista para poder validar eso. */
  iniciosDelJugador: InicioDelJugador[];
  salida?: Salida;
  zonasDeComentario: ZonaDeComentario[];
  enfoquesDeCamara: EnfoqueDeCamara[];
  /** Puntos con nombre, destinos de "camina". */
  puntos: Record<string, Punto>;
  /** Polígonos del piso caminable. */
  pisos: Punto[][];
}

export function mundoVacio(ancho: number, alto: number): Mundo {
  return {
    ancho,
    alto,
    capas: [],
    props: [],
    npcs: {},
    iniciosDelJugador: [],
    zonasDeComentario: [],
    enfoquesDeCamara: [],
    puntos: {},
    pisos: [],
  };
}

/**
 * Catálogo cerrado de clases de decorado (§5.2, §8.8).
 * Una clase que no esté aquí es un error de validación.
 */
export const CATALOGO_DE_DECORADO: Record<string, { pisablePorDefecto: boolean; encima: boolean }> = {
  puesto: { pisablePorDefecto: false, encima: false },
  cajas: { pisablePorDefecto: false, encima: false },
  cubetas: { pisablePorDefecto: false, encima: false },
  perritos: { pisablePorDefecto: false, encima: false },
  comal: { pisablePorDefecto: false, encima: false },
  frutas: { pisablePorDefecto: false, encima: false },
  carritoGlobos: { pisablePorDefecto: false, encima: false },
  carpa: { pisablePorDefecto: false, encima: false },
  pared: { pisablePorDefecto: false, encima: false },
  flecha: { pisablePorDefecto: true, encima: false },
  entrada: { pisablePorDefecto: true, encima: false },
  papelPicado: { pisablePorDefecto: true, encima: true },
  techo: { pisablePorDefecto: true, encima: true },
  deco: { pisablePorDefecto: true, encima: false },
};
