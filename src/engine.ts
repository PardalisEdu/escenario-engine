/**
 * API pública del motor (§4).
 *
 * Uso típico desde el host:
 *
 *   const juego = new EscenarioEngine({ mapa, config, assetsRoot, minigames, save });
 *   juego.on('escenaTerminada', (destino) => { ... });
 *   juego.mount('#contenedor');
 *
 * El motor dibuja y avisa con eventos. Nunca navega entre páginas ni escribe en localStorage:
 * eso lo decide el host.
 */
import * as Phaser from 'phaser';
import type { Idioma } from './core/esquema';
import { GameState } from './core/estado';
import { cargarTilesetsExternos, type TiledMap } from './core/mapa-tiled';
import { leerPartida, type SaveBlob } from './core/partida';
import { EscenarioError, validar, type Nivel } from './core/validar';
import { EscenaMundo } from './adaptadores/phaser/escena';
import { escalaParaProyeccion, type ProyeccionConfig } from './adaptadores/phaser/interfaz';
import type { MiniGameFactory } from './adaptadores/phaser/minijuego';

export interface EscenarioOptions {
  /** URL del .tmj o el mapa ya cargado. Si se omite, se usa el formato v1 sin mapa (§15). */
  mapa?: string | TiledMap;
  /** Contenido JSON del nivel, como objeto o como texto. */
  config: object | string;
  /** Carpeta base donde se buscan todos los assets por clave. */
  assetsRoot: string;
  /** Orígenes externos permitidos para assets (solo HTTPS). En Pardalis: ["https://assets.pardalis.mx"]. */
  cdn?: string[];
  /** Fábricas de minijuegos, por la clave que usa el paso "juego". */
  minigames?: Record<string, MiniGameFactory>;
  /** Partida guardada a restaurar. */
  save?: string | SaveBlob | null;
  i18n?: { base: Idioma };
  /** Modo salón de clases: interfaz y globos más grandes (§6.5). */
  proyeccion?: boolean | ProyeccionConfig;
  /** Hace reproducibles los comentarios al azar (pruebas E2E). */
  seed?: number;
  /** Dibuja hotspots, piso y huellas encima del juego. */
  debug?: boolean;
}

export interface EventosEscenario {
  objetivoCompleto: (objetivo: string) => void;
  /** El nivel terminó; el host decide a dónde ir. */
  escenaTerminada: (destino: string) => void;
  /** Se mostró una tarjeta de vocabulario (para el álbum del host). */
  palabra: (palabra: { en: string; es: string }) => void;
  listo: () => void;
  error: (error: Error) => void;
}

type NombreDeEvento = keyof EventosEscenario;

export class EscenarioEngine {
  private readonly oyentes = new Map<NombreDeEvento, Set<Function>>();
  private juego?: Phaser.Game;
  private escena?: EscenaMundo;
  private estado?: GameState;
  private nivel?: Nivel;
  private partida?: SaveBlob;
  private escenasPausadas: Phaser.Scene[] = [];
  private destruido = false;

  constructor(private readonly opciones: EscenarioOptions) {}

  // ─── Eventos ───────────────────────────────────────────────────────────────

  on<E extends NombreDeEvento>(evento: E, oyente: EventosEscenario[E]): this {
    if (!this.oyentes.has(evento)) this.oyentes.set(evento, new Set());
    this.oyentes.get(evento)!.add(oyente);
    return this;
  }

  off<E extends NombreDeEvento>(evento: E, oyente: EventosEscenario[E]): this {
    this.oyentes.get(evento)?.delete(oyente);
    return this;
  }

  private emitir<E extends NombreDeEvento>(evento: E, ...argumentos: Parameters<EventosEscenario[E]>): void {
    for (const oyente of this.oyentes.get(evento) ?? []) oyente(...argumentos);
  }

  private fallar(error: unknown): void {
    const comoError = error instanceof Error ? error : new Error(String(error));
    console.error(comoError);
    this.emitir('error', comoError);
  }

  // ─── Ciclo de vida ─────────────────────────────────────────────────────────

  /**
   * Valida el mapa y el contenido, y arranca Phaser dentro del contenedor.
   * Si algo falla, no lanza: emite el evento "error" con el diagnóstico.
   */
  async mount(contenedor: string | HTMLElement): Promise<void> {
    try {
      const elemento = typeof contenedor === 'string' ? document.querySelector<HTMLElement>(contenedor) : contenedor;
      if (!elemento) throw new Error(`escenario-engine: no existe el contenedor ${String(contenedor)}`);

      const mapa = await this.cargarMapa();
      const resultado = validar({
        config: this.opciones.config,
        mapa,
        minijuegos: Object.keys(this.opciones.minigames ?? {}),
      });
      for (const advertencia of resultado.advertencias) console.warn(`[escenario-engine] ${advertencia}`);
      if (!resultado.nivel) throw new EscenarioError(resultado.errores, resultado.advertencias);

      // Si el host destruyó el motor mientras se cargaba el mapa, no se arranca nada.
      if (this.destruido) return;

      this.arrancar(elemento, resultado.nivel);
    } catch (error) {
      this.fallar(error);
    }
  }

  private arrancar(elemento: HTMLElement, nivel: Nivel): void {
    const contenido = nivel.contenido;
    this.nivel = nivel;
    this.partida = leerPartida(this.opciones.save, contenido.meta.id);
    this.estado = new GameState(contenido.estado, this.partida?.estado);
    this.estado.alCompletarObjetivo = (objetivo) => this.emitir('objetivoCompleto', objetivo);

    this.escena = new EscenaMundo({
      nivel,
      estado: this.estado,
      partida: this.partida,
      assetsRoot: this.opciones.assetsRoot,
      cdn: this.opciones.cdn ?? [],
      minijuegos: this.opciones.minigames ?? {},
      idiomaBase: this.opciones.i18n?.base ?? 'es',
      escala: escalaParaProyeccion(this.opciones.proyeccion),
      azar: this.opciones.seed !== undefined ? crearAzarConSemilla(this.opciones.seed) : Math.random,
      mostrarDepuracion: this.opciones.debug ?? false,
      alEstarLista: () => this.emitir('listo'),
      alFallar: (error) => this.fallar(error),
      alVerPalabra: (palabra) => this.emitir('palabra', palabra),
      alSalir: (destino) => {
        // Antes de avisar, se guarda el estado para que el host pueda continuar la partida.
        this.partida = this.serialize();
        this.emitir('escenaTerminada', destino);
      },
    });

    const [ancho, alto] = contenido.mundo.logico;
    this.juego = new Phaser.Game({
      type: Phaser.AUTO,
      parent: elemento,
      width: ancho,
      height: alto,
      backgroundColor: contenido.mundo.fondo ?? '#ffe6b8',
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      input: { activePointers: 2 },
      banner: false,
      scene: [this.escena],
    });
  }

  /** Descarga el mapa (si es una URL) y sus tilesets externos, relativos a la URL del mapa. */
  private async cargarMapa(): Promise<TiledMap | undefined> {
    const { mapa } = this.opciones;
    if (!mapa) return undefined;

    const urlBase = typeof mapa === 'string' ? new URL(mapa, location.href) : new URL(location.href);
    const descargarJson = async (ruta: string): Promise<unknown> => {
      const respuesta = await fetch(new URL(ruta, urlBase));
      if (!respuesta.ok) throw new Error(`escenario-engine: no se pudo cargar ${ruta} (${respuesta.status})`);
      return respuesta.json();
    };

    const mapaCargado = typeof mapa === 'string' ? ((await descargarJson(urlBase.href)) as TiledMap) : mapa;
    return cargarTilesetsExternos(mapaCargado, descargarJson);
  }

  // ─── API del host ──────────────────────────────────────────────────────────

  /** El estado actual como JSON plano versionado (§11). El host decide dónde guardarlo. */
  serialize(): SaveBlob {
    const nivel = this.nivel?.contenido.meta.id ?? this.partida?.nivel ?? '';
    if (!this.estado) return this.partida ?? { v: 2, nivel, estado: {} };

    const momento = this.escena?.lista ? this.escena.momentoActual() : this.partida?.momento;
    return { v: 2, nivel, estado: { ...this.estado.valores }, momento };
  }

  /** Activa o desactiva el modo salón de clases sin reiniciar. */
  setProyeccion(proyeccion: boolean | ProyeccionConfig): void {
    this.escena?.cambiarEscala(escalaParaProyeccion(proyeccion));
  }

  /** Congela el juego y el audio. El diálogo en curso se conserva para resume(). */
  pause(): void {
    if (!this.juego || this.escenasPausadas.length > 0) return;
    this.escenasPausadas = this.juego.scene.getScenes(true);
    for (const escena of this.escenasPausadas) escena.scene.pause();
    this.juego.sound.pauseAll();
    globalThis.speechSynthesis?.pause();
  }

  resume(): void {
    for (const escena of this.escenasPausadas) escena.scene.resume();
    this.escenasPausadas = [];
    this.juego?.sound.resumeAll();
    globalThis.speechSynthesis?.resume();
  }

  /** Termina el diálogo en curso (por ejemplo, al abrir un menú del host). */
  abort(): void {
    this.escena?.runtime?.abort();
  }

  /** Libera Phaser por completo: texturas, timers, audio y listeners. */
  destroy(): void {
    this.destruido = true;
    this.abort();
    globalThis.speechSynthesis?.cancel();
    this.juego?.destroy(true);
    this.juego = undefined;
    this.escena = undefined;
    this.oyentes.clear();
  }
}

/**
 * Generador de números al azar entre 0 y 1 que siempre da la misma serie para la misma semilla.
 * Es el algoritmo conocido "mulberry32"; no hace falta entender sus operaciones para usarlo.
 */
function crearAzarConSemilla(semilla: number): () => number {
  let estado = semilla;
  return () => {
    estado = (estado + 0x6d2b79f5) | 0;
    let t = Math.imul(estado ^ (estado >>> 15), 1 | estado);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
