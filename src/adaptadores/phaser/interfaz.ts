/**
 * Valores compartidos por la interfaz: tamaños (normal y modo proyección),
 * el orden de dibujo y la preferencia de movimiento reducido.
 */

/** Tamaños de la interfaz. En modo proyección (salón de clases) todo es más grande (§6.5). */
export interface EscalaDeInterfaz {
  /** Multiplica botones de elige, íconos de aviso y flecha de salida. */
  botones: number;
  /** Multiplica el tamaño de los globos de diálogo. */
  globos: number;
  /** Ningún texto se dibuja más chico que esto (en píxeles). */
  textoMinimo: number;
  /** Grosor de los contornos. */
  borde: number;
}

export const ESCALA_NORMAL: EscalaDeInterfaz = { botones: 1, globos: 1, textoMinimo: 22, borde: 3 };

export interface ProyeccionConfig {
  escalaUI?: number;
  escalaGlobos?: number;
  textoMinimo?: number;
}

/** `true` usa los valores por defecto del modo proyección; un objeto permite ajustarlos. */
export function escalaParaProyeccion(proyeccion: boolean | ProyeccionConfig | undefined): EscalaDeInterfaz {
  if (!proyeccion) return ESCALA_NORMAL;

  const ajustes = proyeccion === true ? {} : proyeccion;
  const botones = ajustes.escalaUI ?? 1.5;
  return {
    botones,
    globos: ajustes.escalaGlobos ?? 1.75,
    textoMinimo: ajustes.textoMinimo ?? 36,
    // Contornos más gruesos para que se vean desde el fondo del salón.
    borde: ESCALA_NORMAL.borde * botones * 1.5,
  };
}

/**
 * Orden de dibujo (depth de Phaser). Un número mayor se dibuja encima.
 * Personajes y props usan su «y de pie» (de 0 al alto del mundo), así quien está
 * más abajo en la pantalla queda delante. Todo lo demás se ubica alrededor de ese rango.
 */
export const PROFUNDIDAD = {
  capasDeFondo: -10_000,
  decoradoEncima: 500_000,
  flechaDeSalida: 800_000,
  capasAlFrente: 900_000,
  franjasDeCine: 950_000,
  globos: 1_000_000,
  titulo: 1_200_000,
  efectos: 1_500_000,
  botones: 2_000_000,
  depuracion: 3_000_000,
};

/** El sistema pide menos animación (accesibilidad): menos rebotes y menos parallax. */
export function prefiereMenosMovimiento(): boolean {
  return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}
