// AssetManager (§9) sobre el loader de Phaser: carga por clave, deduplica y libera lo exclusivo de un minijuego.
import * as Phaser from 'phaser';
import { EXTENSION, resolverRuta, type TipoAsset } from '../../core/assets';
import type { Contenido } from '../../core/esquema';
import type { Mundo } from '../../core/mapa';

export interface ItemAsset { clave: string; tipo: TipoAsset }

export interface AssetManager {
  url(clave: string, tipo: TipoAsset): string;
  /** Carga bajo demanda. Resuelve con las claves que no se pudieron cargar. */
  cargar(items: ItemAsset[]): Promise<string[]>;
}

export class GestorAssets implements AssetManager {
  private propias = new Set<string>();
  /** Errores de ruta o de carga, con la ruta intentada. */
  fallidos: { clave: string; tipo: string; detalle: string }[] = [];

  constructor(private scene: Phaser.Scene, private root: string, private cdn: string[]) {
    scene.load.on('loaderror', (f: Phaser.Loader.File) => {
      this.fallidos.push({ clave: f.key, tipo: f.type, detalle: `ruta intentada: ${f.url}` });
    });
  }

  url(clave: string, tipo: TipoAsset) {
    return resolverRuta(clave, EXTENSION[tipo], this.root, this.cdn);
  }

  private existe(clave: string, tipo: TipoAsset) {
    return tipo === 'audio' ? this.scene.cache.audio.exists(clave) : this.scene.textures.exists(clave);
  }

  /** Encola en el loader (para usar dentro de preload). */
  encolar(items: ItemAsset[]) {
    for (const { clave, tipo } of items) {
      if (this.existe(clave, tipo)) continue;
      let url: string;
      try { url = this.url(clave, tipo); } catch (e) { this.fallidos.push({ clave, tipo, detalle: (e as Error).message }); continue; }
      this.propias.add(`${tipo}:${clave}`);
      if (tipo === 'imagen') this.scene.load.image(clave, url);
      else if (tipo === 'audio') this.scene.load.audio(clave, url);
      else this.scene.load.atlas(clave, url, url.replace(/\.[a-z0-9]+$/i, '.json'));
    }
  }

  cargar(items: ItemAsset[]): Promise<string[]> {
    const antes = this.fallidos.length;
    this.encolar(items);
    const fin = () => this.fallidos.slice(antes).map((f) => f.clave);
    if (!this.scene.load.list.size) return Promise.resolve(fin());
    return new Promise((res) => {
      this.scene.load.once('complete', () => res(fin()));
      this.scene.load.start();
    });
  }

  /** Errores que impiden arrancar: imágenes y atlas faltantes (el audio cae a TTS). */
  fatales(): string[] {
    return this.fallidos
      .filter((f) => f.tipo !== 'audio')
      .map((f) => `textura ${f.clave} referenciada pero no cargada (${f.detalle})`);
  }

  /** Libera las texturas y audios que cargó esta instancia (ref-count por dueño). */
  liberar(conservar: Set<string> = new Set()) {
    for (const k of this.propias) {
      const [tipo, clave] = [k.slice(0, k.indexOf(':')), k.slice(k.indexOf(':') + 1)];
      if (conservar.has(clave)) continue;
      if (tipo === 'audio') this.scene.cache.audio.remove(clave);
      else if (this.scene.textures.exists(clave)) this.scene.textures.remove(clave);
    }
    this.propias.clear();
  }
}

/** Nivel 1 (global) + nivel 2 (por escena): capas, props, personajes, animaciones, voces, imágenes de opciones. */
export function listaAssets(c: Contenido, m: Mundo): ItemAsset[] {
  const items = new Map<string, TipoAsset>();
  const add = (clave: string | undefined, tipo: TipoAsset) => { if (clave) items.set(clave, tipo); };
  for (const s of Object.values(c.mundo.sonidos ?? {})) add(s, 'audio');
  m.capas.forEach((k) => add(k.asset, 'imagen'));
  m.props.forEach((p) => add(p.asset, 'imagen'));
  const actores = [...(c.jugador ? [c.jugador.personaje] : []), ...Object.keys(m.npcs)];
  for (const id of actores) {
    const p = c.meta.personajes[id];
    add(p?.sprite, 'imagen');
    Object.values(p?.animaciones ?? {}).forEach((a) => add(a, 'atlas'));
  }
  Object.values(c.jugador?.animaciones ?? {}).forEach((a) => add(a, 'atlas'));
  const walk = (v: unknown): void => {
    if (Array.isArray(v)) return v.forEach(walk);
    if (!v || typeof v !== 'object') return;
    const o = v as Record<string, unknown>;
    if (typeof o.audio === 'string') add(o.audio, 'audio');
    if (typeof o.imagen === 'string') add(o.imagen, 'imagen');
    Object.values(o).forEach(walk);
  };
  walk([c.secuencias, c.npcs, c.interactivos, c.comentarios, c.salida]);
  return [...items].map(([clave, tipo]) => ({ clave, tipo }));
}
