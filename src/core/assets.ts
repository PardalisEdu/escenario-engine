// Seguridad y resolución de rutas de assets (§9). Las rutas de Tiled nunca viajan al juego: todo se resuelve por clave.

export type TipoAsset = 'imagen' | 'audio' | 'atlas';

/** Extensión por omisión si la clave no trae una. Un atlas es `<clave>.webp` + `<clave>.json`. */
export const EXTENSION: Record<TipoAsset, string> = { imagen: '.webp', audio: '.mp3', atlas: '.webp' };

export function resolverRuta(clave: string, ext: string, assetsRoot: string, cdn: string[], base = globalThis.location?.href): string {
  let decodificada = clave;
  try { decodificada = decodeURIComponent(clave); } catch { /* se valida tal cual */ }
  if (decodificada.split(/[\\/]/).includes('..')) throw new Error(`ruta de asset rechazada (contiene ".."): ${clave}`);
  const raiz = new URL(assetsRoot, base);
  const conExt = /\.[a-z0-9]{2,5}$/i.test(clave) ? clave : clave + ext;
  const url = new URL(conExt, raiz);
  const permitidos = cdn.map((o) => new URL(o).origin);
  const mismoOrigen = base !== undefined && url.origin === new URL(base).origin;
  if (!mismoOrigen && !(url.protocol === 'https:' && permitidos.includes(url.origin))) {
    throw new Error(`ruta de asset rechazada (origen ${url.origin} fuera de la lista blanca cdn): ${clave}`);
  }
  return url.href;
}
