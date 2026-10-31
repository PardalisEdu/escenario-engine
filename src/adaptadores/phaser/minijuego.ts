/**
 * Montaje de minijuegos (§4.2). Pasos:
 *
 *   1. Oscurece la escena del mundo y la pausa.
 *   2. Crea una escena nueva, vacía, solo para el minijuego.
 *   3. Llama a la fábrica registrada por el host y espera su resultado.
 *   4. Libera lo que cargó el minijuego, borra su escena y reanuda el mundo.
 *
 * Si la fábrica falla, se trata como `exito: false`: el motor nunca castiga,
 * simplemente sigue con la rama "siNo" de alVolver.
 */
import * as Phaser from 'phaser';
import type { MiniGameResult } from '../../core/dialogo';
import type { Condicion, Idioma, Valor } from '../../core/esquema';
import type { GameState } from '../../core/estado';
import { GestorDeAssets, type AssetManager } from './assets';
import { Voz } from './voz';

/** Lo que recibe una fábrica de minijuego. */
export interface MiniGameContext {
  /** Escena dedicada que el motor ya creó para el minijuego. */
  scene: Phaser.Scene;
  /** Para cargar assets del minijuego; se liberan solos al terminar. */
  assets: AssetManager;
  /** Lectura del estado del nivel (sin escritura: para cambiarlo, usa `otorgar` en el resultado). */
  state: {
    get(nombre: string): Valor | undefined;
    cumple(condicion: Condicion): boolean;
    readonly valores: Readonly<Record<string, Valor>>;
  };
  audio: {
    tocar(clave: string): void;
    decir(texto: string, idioma: Idioma, claveDeAudio?: string): Promise<void>;
  };
}

export type MiniGameFactory = (contexto: MiniGameContext, config?: unknown) => Promise<MiniGameResult>;

export interface DatosDelMinijuego {
  escenaDelMundo: Phaser.Scene;
  clave: string;
  fabrica: MiniGameFactory;
  config: unknown;
  estado: GameState;
  assetsRoot: string;
  cdn: string[];
  cancelacion: AbortSignal;
}

const DURACION_DEL_FUNDIDO = 300;
let minijuegosCreados = 0;

export async function jugarMinijuego(datos: DatosDelMinijuego): Promise<MiniGameResult> {
  const { escenaDelMundo, clave } = datos;
  const camaraDelMundo = escenaDelMundo.cameras.main;

  await fundirANegro(camaraDelMundo);
  escenaDelMundo.scene.pause();

  minijuegosCreados++;
  const escena = await crearEscenaVacia(escenaDelMundo, `minijuego:${clave}:${minijuegosCreados}`);
  escena.cameras.main.fadeIn(DURACION_DEL_FUNDIDO);

  const assets = new GestorDeAssets(escena, datos.assetsRoot, datos.cdn);
  try {
    return await esperarResultado(datos, crearContexto(escena, assets, datos.estado));
  } finally {
    // Se conserva todo lo que ya usaba el mundo; se borra solo lo exclusivo del minijuego.
    const texturasDelMundo = new Set(escenaDelMundo.textures.getTextureKeys());
    assets.liberar(texturasDelMundo);
    escenaDelMundo.scene.remove(escena.scene.key);
    escenaDelMundo.scene.resume();
    camaraDelMundo.fadeIn(DURACION_DEL_FUNDIDO);
  }
}

function fundirANegro(camara: Phaser.Cameras.Scene2D.Camera): Promise<void> {
  return new Promise((terminar) => {
    camara.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => terminar());
    camara.fadeOut(DURACION_DEL_FUNDIDO);
  });
}

/**
 * Agrega una escena vacía y espera a que esté creada.
 * Ojo: Phaser puede llamar a `create()` en el mismo momento en que se agrega la escena,
 * por eso el aviso sale de la propia escena y no de un evento al que nos suscribimos después.
 */
function crearEscenaVacia(escenaDelMundo: Phaser.Scene, clave: string): Promise<Phaser.Scene> {
  return new Promise((terminar) => {
    class EscenaDeMinijuego extends Phaser.Scene {
      create() {
        terminar(this);
      }
    }
    escenaDelMundo.scene.add(clave, new EscenaDeMinijuego(clave), true);
  });
}

function crearContexto(escena: Phaser.Scene, assets: AssetManager, estado: GameState): MiniGameContext {
  const voz = new Voz(escena);
  return {
    scene: escena,
    assets,
    state: {
      get: (nombre) => estado.valorDe(nombre),
      cumple: (condicion) => estado.cumple(condicion),
      get valores() {
        return { ...estado.valores }; // una copia, para que no se pueda modificar el estado
      },
    },
    audio: {
      tocar: (clave) => escena.sound.play(clave),
      decir: (texto, idioma, claveDeAudio) => voz.decir(texto, idioma, claveDeAudio),
    },
  };
}

function esperarResultado(datos: DatosDelMinijuego, contexto: MiniGameContext): Promise<MiniGameResult> {
  return new Promise((terminar, rechazar) => {
    datos.cancelacion.addEventListener('abort', () => rechazar(datos.cancelacion.reason), { once: true });

    datos.fabrica(contexto, datos.config).then(terminar, (error) => {
      console.error(`[escenario-engine] el minijuego "${datos.clave}" falló`, error);
      terminar({ exito: false });
    });
  });
}
