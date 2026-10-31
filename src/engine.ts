// API pública (§4). El motor dibuja y emite eventos; nunca navega ni escribe en localStorage.
import * as Phaser from 'phaser';
import { GameState, leerSave, type SaveBlob } from './core/estado';
import { resolverTilesets, type TiledMap } from './core/mapa';
import { EscenarioError, validar, type Nivel } from './core/validar';
import { EscenaMundo, type MiniGameFactory } from './adaptadores/phaser/escena';
import { ESCALA_NORMAL, type Escala, type Idioma } from './adaptadores/phaser/ui';

export interface ProyeccionConfig { escalaUI?: number; escalaGlobos?: number; textoMinimo?: number }

export interface EscenarioOptions {
  /** URL del .tmj o el objeto ya cargado. Sin mapa: modo legacy (§15). */
  mapa?: string | TiledMap;
  config: object | string;
  assetsRoot: string;
  /** Orígenes externos permitidos (solo HTTPS, comparación exacta). */
  cdn?: string[];
  minigames?: Record<string, MiniGameFactory>;
  save?: string | SaveBlob | null;
  i18n?: { base: Idioma };
  proyeccion?: boolean | ProyeccionConfig;
  /** Hace reproducibles los comentarios aleatorios (pruebas E2E). */
  seed?: number;
  /** Overlay con hotspots, piso y huellas. */
  debug?: boolean;
}

export interface EventosEscenario {
  objetivoCompleto: (id: string) => void;
  escenaTerminada: (destino: string) => void;
  /** Tarjeta de vocabulario vista (para el álbum del host). */
  palabra: (p: { en: string; es: string }) => void;
  listo: () => void;
  error: (e: Error) => void;
}

const escalaDe = (p: EscenarioOptions['proyeccion']): Escala => {
  if (!p) return ESCALA_NORMAL;
  const c = p === true ? {} : p;
  const ui = c.escalaUI ?? 1.5;
  return { ui, globos: c.escalaGlobos ?? 1.75, textoMinimo: c.textoMinimo ?? 36, borde: ESCALA_NORMAL.borde * ui * 1.5 };
};

function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class EscenarioEngine {
  private oyentes = new Map<keyof EventosEscenario, Set<(...a: never[]) => void>>();
  private game?: Phaser.Game;
  private escena?: EscenaMundo;
  private estado?: GameState;
  private nivel?: Nivel;
  private save?: SaveBlob;
  private escala: Escala;
  private pausadas: Phaser.Scene[] = [];
  private destruido = false;

  constructor(private opts: EscenarioOptions) {
    this.escala = escalaDe(opts.proyeccion);
  }

  on<E extends keyof EventosEscenario>(evento: E, fn: EventosEscenario[E]): this {
    if (!this.oyentes.has(evento)) this.oyentes.set(evento, new Set());
    this.oyentes.get(evento)!.add(fn);
    return this;
  }

  off<E extends keyof EventosEscenario>(evento: E, fn: EventosEscenario[E]): this {
    this.oyentes.get(evento)?.delete(fn);
    return this;
  }

  private emitir = (evento: string, ...args: unknown[]) => {
    if (evento === 'error') console.error(args[0]);
    for (const fn of this.oyentes.get(evento as keyof EventosEscenario) ?? []) (fn as (...a: unknown[]) => void)(...args);
  };

  /** Valida mapa + contenido y arranca Phaser dentro del contenedor. Los errores se emiten como evento "error". */
  async mount(destino: string | HTMLElement): Promise<void> {
    try {
      const el = typeof destino === 'string' ? document.querySelector<HTMLElement>(destino) : destino;
      if (!el) throw new Error(`escenario-engine: no existe el contenedor ${String(destino)}`);
      const mapa = await this.cargarMapa();
      const r = validar({ config: this.opts.config, mapa, minijuegos: Object.keys(this.opts.minigames ?? {}) });
      for (const w of r.warnings) console.warn(`[escenario-engine] ${w}`);
      if (!r.nivel) throw new EscenarioError(r.errores, r.warnings);
      if (this.destruido) return;
      this.nivel = r.nivel;
      const c = r.nivel.contenido;
      this.save = leerSave(this.opts.save, c.meta.id);
      this.estado = new GameState(c.estado, this.save?.estado);
      this.estado.onObjetivo = (id) => this.emitir('objetivoCompleto', id);

      this.escena = new EscenaMundo({
        nivel: r.nivel,
        estado: this.estado,
        save: this.save,
        assetsRoot: this.opts.assetsRoot,
        cdn: this.opts.cdn ?? [],
        minigames: this.opts.minigames ?? {},
        base: this.opts.i18n?.base ?? 'es',
        escala: this.escala,
        rng: this.opts.seed !== undefined ? mulberry32(this.opts.seed) : Math.random,
        debug: !!this.opts.debug,
        emitir: this.emitir,
        alSalir: (destino) => {
          this.save = this.serialize();
          this.emitir('escenaTerminada', destino);
        },
      });
      const [w, h] = c.mundo.logico;
      this.game = new Phaser.Game({
        type: Phaser.AUTO,
        parent: el,
        width: w,
        height: h,
        backgroundColor: c.mundo.fondo ?? '#ffe6b8',
        scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
        input: { activePointers: 2 },
        banner: false,
        scene: [this.escena],
      });
    } catch (e) {
      this.emitir('error', e);
    }
  }

  private async cargarMapa(): Promise<TiledMap | undefined> {
    const { mapa } = this.opts;
    if (!mapa) return undefined;
    const base = typeof mapa === 'string' ? new URL(mapa, location.href) : new URL(location.href);
    const leer = async (ruta: string) => {
      const res = await fetch(new URL(ruta, base));
      if (!res.ok) throw new Error(`escenario-engine: no se pudo cargar ${ruta} (${res.status})`);
      return res.json();
    };
    return resolverTilesets(typeof mapa === 'string' ? await leer(base.href) : mapa, leer);
  }

  /** Estado actual como JSON plano versionado (§11). El host decide dónde guardarlo. */
  serialize(): SaveBlob {
    const nivel = this.nivel?.contenido.meta.id ?? this.save?.nivel ?? '';
    if (!this.estado) return this.save ?? { v: 2, nivel, estado: {} };
    return { v: 2, nivel, estado: { ...this.estado.valores }, momento: this.escena?.listo ? this.escena.momento() : this.save?.momento };
  }

  setProyeccion(p: boolean | ProyeccionConfig) {
    this.escala = escalaDe(p);
    this.escena?.aplicarEscala(this.escala);
  }

  /** Congela update de escena y audio; la corutina del diálogo se preserva. */
  pause() {
    if (!this.game || this.pausadas.length) return;
    this.pausadas = this.game.scene.getScenes(true);
    this.pausadas.forEach((s) => s.scene.pause());
    this.game.sound.pauseAll();
    globalThis.speechSynthesis?.pause();
  }

  resume() {
    this.pausadas.forEach((s) => s.scene.resume());
    this.pausadas = [];
    this.game?.sound.resumeAll();
    globalThis.speechSynthesis?.resume();
  }

  /** Aborta el diálogo en curso (p. ej. botón de menú del host). */
  abort() {
    this.escena?.runtime?.abort();
  }

  /** Libera texturas, timers, audio y listeners. */
  destroy() {
    this.destruido = true;
    this.abort();
    globalThis.speechSynthesis?.cancel();
    this.game?.destroy(true);
    this.game = undefined;
    this.escena = undefined;
    this.oyentes.clear();
  }
}
