/**
 * AssetManager (§9) sobre el cargador de Phaser.
 *
 * Tres niveles de carga:
 *   1. Global (al montar): sonidos de toque, cercanía y música.
 *   2. Por escena (al cargar el nivel): capas, props, personajes, animaciones, voces.
 *   3. Bajo demanda: lo que pide cada minijuego mientras corre.
 *
 * Los niveles 1 y 2 se cargan juntos con `listaDeAssetsDelNivel`. El nivel 3 lo hace el minijuego
 * con `cargar()`; al terminar, el motor libera lo que ese minijuego cargó (`liberar()`).
 */
import * as Phaser from 'phaser';
import { resolverUrlDeAsset, type TipoDeAsset } from '../../core/assets';
import type { Contenido } from '../../core/esquema';
import type { Mundo } from '../../core/mundo';

export interface PedidoDeAsset {
  clave: string;
  tipo: TipoDeAsset;
}

/** Lo que reciben los minijuegos para cargar sus propios assets. */
export interface AssetManager {
  url(clave: string, tipo: TipoDeAsset): string;
  /** Carga los assets pedidos. Termina con la lista de claves que no se pudieron cargar. */
  cargar(pedidos: PedidoDeAsset[]): Promise<string[]>;
}

interface Falla {
  clave: string;
  tipo: string;
  detalle: string;
}

export class GestorDeAssets implements AssetManager {
  /** Lo que esta instancia cargó, para poder liberarlo después. */
  private readonly cargadosPorMi: PedidoDeAsset[] = [];
  readonly fallas: Falla[] = [];

  constructor(
    private readonly escena: Phaser.Scene,
    private readonly assetsRoot: string,
    private readonly cdn: string[],
  ) {
    escena.load.on('loaderror', (archivo: Phaser.Loader.File) => {
      this.fallas.push({ clave: archivo.key, tipo: archivo.type, detalle: `ruta intentada: ${archivo.url}` });
    });
  }

  url(clave: string, tipo: TipoDeAsset): string {
    return resolverUrlDeAsset(clave, tipo, this.assetsRoot, this.cdn);
  }

  /** Pone los pedidos en la fila del cargador. Dentro de `preload()` Phaser los carga solo. */
  encolar(pedidos: PedidoDeAsset[]): void {
    for (const pedido of pedidos) {
      if (this.yaEstaCargado(pedido)) continue;

      let url: string;
      try {
        url = this.url(pedido.clave, pedido.tipo);
      } catch (error) {
        this.fallas.push({ clave: pedido.clave, tipo: pedido.tipo, detalle: (error as Error).message });
        continue;
      }

      this.cargadosPorMi.push(pedido);
      switch (pedido.tipo) {
        case 'imagen':
          this.escena.load.image(pedido.clave, url);
          break;
        case 'audio':
          this.escena.load.audio(pedido.clave, url);
          break;
        case 'atlas': {
          const urlDelJson = url.replace(/\.[a-z0-9]+$/i, '.json');
          this.escena.load.atlas(pedido.clave, url, urlDelJson);
          break;
        }
      }
    }
  }

  /** Carga fuera de `preload()` (minijuegos). */
  cargar(pedidos: PedidoDeAsset[]): Promise<string[]> {
    const fallasAntes = this.fallas.length;
    this.encolar(pedidos);
    const clavesQueFallaron = () => this.fallas.slice(fallasAntes).map((falla) => falla.clave);

    if (this.escena.load.list.size === 0) return Promise.resolve(clavesQueFallaron());
    return new Promise((terminar) => {
      this.escena.load.once('complete', () => terminar(clavesQueFallaron()));
      this.escena.load.start();
    });
  }

  /**
   * Fallas que impiden arrancar: imágenes y atlas que no se cargaron.
   * Las voces que falten no detienen nada: se usa voz sintetizada.
   */
  erroresQueImpidenArrancar(): string[] {
    return this.fallas
      .filter((falla) => falla.tipo !== 'audio')
      .map((falla) => `textura ${falla.clave} referenciada pero no cargada (${falla.detalle})`);
  }

  audiosQueFaltan(): Falla[] {
    return this.fallas.filter((falla) => falla.tipo === 'audio');
  }

  /** Borra de la memoria lo que cargó esta instancia, excepto las claves de `conservar`. */
  liberar(conservar: Set<string> = new Set()): void {
    for (const { clave, tipo } of this.cargadosPorMi) {
      if (conservar.has(clave)) continue;
      if (tipo === 'audio') this.escena.cache.audio.remove(clave);
      else if (this.escena.textures.exists(clave)) this.escena.textures.remove(clave);
    }
    this.cargadosPorMi.length = 0;
  }

  private yaEstaCargado(pedido: PedidoDeAsset): boolean {
    if (pedido.tipo === 'audio') return this.escena.cache.audio.exists(pedido.clave);
    return this.escena.textures.exists(pedido.clave);
  }
}

/** Todo lo que un nivel necesita cargar antes de empezar (niveles 1 y 2). */
export function listaDeAssetsDelNivel(contenido: Contenido, mundo: Mundo): PedidoDeAsset[] {
  const pedidos = new Map<string, TipoDeAsset>(); // por clave, para no pedir dos veces lo mismo
  const pedir = (clave: string | undefined, tipo: TipoDeAsset) => {
    if (clave) pedidos.set(clave, tipo);
  };

  // Nivel 1: sonidos globales
  for (const clave of Object.values(contenido.mundo.sonidos ?? {})) pedir(clave, 'audio');

  // Nivel 2: imágenes del mapa
  for (const capa of mundo.capas) pedir(capa.asset, 'imagen');
  for (const prop of mundo.props) pedir(prop.asset, 'imagen');

  // Personajes que aparecen en pantalla: el jugador y los NPCs del mapa
  const idsEnPantalla = Object.keys(mundo.npcs);
  if (contenido.jugador) idsEnPantalla.push(contenido.jugador.personaje);
  if (contenido.acompanante) idsEnPantalla.push(contenido.acompanante.personaje);
  for (const id of idsEnPantalla) {
    const personaje = contenido.meta.personajes[id];
    if (!personaje) continue;
    pedir(personaje.sprite, 'imagen');
    for (const animacion of Object.values(personaje.animaciones ?? {})) pedir(animacion, 'atlas');
  }
  for (const animacion of Object.values(contenido.jugador?.animaciones ?? {})) pedir(animacion, 'atlas');

  // Voces e imágenes de opciones, en cualquier parte del diálogo
  buscarClavesEnDialogos([contenido.secuencias, contenido.npcs, contenido.interactivos, contenido.comentarios, contenido.salida, contenido.intro], pedir);

  return [...pedidos].map(([clave, tipo]) => ({ clave, tipo }));
}

/** Recorre cualquier estructura buscando campos "audio" e "imagen". */
function buscarClavesEnDialogos(valor: unknown, pedir: (clave: string, tipo: TipoDeAsset) => void): void {
  if (Array.isArray(valor)) {
    for (const elemento of valor) buscarClavesEnDialogos(elemento, pedir);
    return;
  }
  if (typeof valor !== 'object' || valor === null) return;

  const objeto = valor as Record<string, unknown>;
  if (typeof objeto.audio === 'string') pedir(objeto.audio, 'audio');
  if (typeof objeto.imagen === 'string') pedir(objeto.imagen, 'imagen');
  for (const hijo of Object.values(objeto)) buscarClavesEnDialogos(hijo, pedir);
}
