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

/** Extensiones de archivo reconocidas cuando una clave ya trae la suya. */
const EXTENSIONES_CONOCIDAS = new Set([
  '.webp', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.avif',
  '.mp3', '.ogg', '.wav', '.m4a', '.aac', '.webm',
  '.json',
]);

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
  if (clave.trim() === '' || contieneSubirDeCarpeta(clave) || empiezaEnRaizOEsUrl(clave)) {
    throw new Error(`ruta de asset rechazada: ${clave}`);
  }

  const ultimoPunto = clave.lastIndexOf('.');
  const ultimaBarra = Math.max(clave.lastIndexOf('/'), clave.lastIndexOf('\\'));
  const sufijo = ultimoPunto > ultimaBarra ? clave.slice(ultimoPunto).toLowerCase() : '';
  const archivo = EXTENSIONES_CONOCIDAS.has(sufijo) ? clave : clave + EXTENSION_POR_DEFECTO[tipo];

  const raizConBarra = assetsRoot.endsWith('/') ? assetsRoot : `${assetsRoot}/`;
  const raiz = new URL(raizConBarra, paginaActual);
  const url = new URL(archivo, raiz);

  if (!url.pathname.startsWith(raiz.pathname)) {
    throw new Error(`ruta de asset rechazada (escapa de assetsRoot): ${clave}`);
  }

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
  const decodificada = decodificarRuta(ruta);
  return decodificada.split(/[\\/]/).includes('..');
}

/** Rechaza rutas absolutas ("/algo", "\\algo") o URLs completas ("https://..."). */
function empiezaEnRaizOEsUrl(ruta: string): boolean {
  const decodificada = decodificarRuta(ruta).trimStart();
  return /^[\\/]/.test(decodificada) || /^[a-z][a-z0-9+.-]*:/i.test(decodificada);
}

function decodificarRuta(ruta: string): string {
  try {
    return decodeURIComponent(ruta);
  } catch {
    return ruta;
  }
}
