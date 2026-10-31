/**
 * Resolución segura de rutas de assets (§9).
 *
 * Las imágenes y sonidos se piden por clave ("spr_tortu") y se buscan dentro de `assetsRoot`.
 * Las rutas que guarda Tiled para el editor nunca viajan al juego.
 *
 * Reglas de seguridad:
 * - Se rechaza cualquier ruta que contenga "..".
 * - Solo se aceptan URLs del mismo sitio o de un origen HTTPS de la lista blanca `cdn`.
 */

export type TipoDeAsset = 'imagen' | 'audio' | 'atlas';

/**
 * Extensión que se agrega si la clave no trae una.
 * Un atlas (animación) son dos archivos: `<clave>.webp` y `<clave>.json`.
 */
export const EXTENSION_POR_DEFECTO: Record<TipoDeAsset, string> = {
  imagen: '.webp',
  audio: '.mp3',
  atlas: '.webp',
};

/**
 * Devuelve la URL completa de un asset o lanza un error si la ruta no es segura.
 * `paginaActual` es la URL de la página (en el navegador, location.href).
 */
export function resolverUrlDeAsset(
  clave: string,
  tipo: TipoDeAsset,
  assetsRoot: string,
  cdn: string[],
  paginaActual: string | undefined = globalThis.location?.href,
): string {
  if (contieneSubirDeCarpeta(clave)) {
    throw new Error(`ruta de asset rechazada (contiene ".."): ${clave}`);
  }

  const tieneExtension = /\.[a-z0-9]{2,5}$/i.test(clave);
  const archivo = tieneExtension ? clave : clave + EXTENSION_POR_DEFECTO[tipo];
  const raiz = new URL(assetsRoot, paginaActual);
  const url = new URL(archivo, raiz);

  const esDelMismoSitio = paginaActual !== undefined && url.origin === new URL(paginaActual).origin;
  const origenesPermitidos = cdn.map((origen) => new URL(origen).origin);
  const esDeUnCdnPermitido = url.protocol === 'https:' && origenesPermitidos.includes(url.origin);

  if (!esDelMismoSitio && !esDeUnCdnPermitido) {
    throw new Error(`ruta de asset rechazada (origen ${url.origin} fuera de la lista blanca cdn): ${clave}`);
  }
  return url.href;
}

/** ¿La ruta tiene un segmento ".."? También revisa la versión codificada ("%2e%2e"). */
function contieneSubirDeCarpeta(ruta: string): boolean {
  let decodificada = ruta;
  try {
    decodificada = decodeURIComponent(ruta);
  } catch {
    // Si no se puede decodificar, se revisa tal cual.
  }
  return decodificada.split(/[\\/]/).includes('..');
}
