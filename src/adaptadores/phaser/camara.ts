/**
 * CameraRig (§6.2). Tres modos:
 *
 *   follow  (por defecto) sigue al jugador. Dentro de la «zona muerta» horizontal el jugador
 *           camina sin que la cámara se mueva. En vertical la cámara casi no se mueve.
 *   rails   se acomoda suavemente en el punto enfoqueCamara más cercano al jugador.
 *   pan     escenas sin jugador: se arrastra con el dedo y sigue un poco por inercia.
 *
 * En todos los modos la cámara nunca sale de los bordes del mundo.
 *
 * Encima de cualquier modo, un paso "enfoca" lleva la cámara a un personaje o lugar con un paneo suave
 * (y zoom, si se pide). La cámara se queda ahí hasta `soltarEnfoque()`, que la regresa al jugador.
 */
import type * as Phaser from 'phaser';
import type { Contenido, Punto } from '../../core/esquema';
import type { EnfoqueDeCamara, Mundo } from '../../core/mundo';
import type { Actor } from './actor';
import { prefiereMenosMovimiento } from './interfaz';

type ConfigDeCamara = Contenido['mundo']['camara'];

/** Qué tan rápido se acomoda la cámara en modo rails (mayor = más rápido). */
const RAPIDEZ_DE_RIELES = 4;

const DURACION_DEL_ENFOQUE = 1100;
const DURACION_DEL_REGRESO = 900;
/** Curva que arranca y frena despacio: se siente como una cámara de cine. */
const CURVA_DEL_ENFOQUE = 'Sine.easeInOut';

export class Camara {
  private readonly camara: Phaser.Cameras.Scene2D.Camera;
  /** Píxeles por cuadro que sigue avanzando la cámara después de soltar un arrastre. */
  private inercia = 0;
  private arrastrando = false;
  /** Dónde estaba la cámara cuando empezó el arrastre. */
  private scrollAlEmpezar = { x: 0, y: 0 };
  /** true desde un "enfoca" hasta `soltarEnfoque()`: ningún modo mueve la cámara mientras tanto. */
  private enfocada = false;

  constructor(
    escena: Phaser.Scene,
    private readonly config: ConfigDeCamara,
    private readonly mundo: Mundo,
    private readonly jugador: Actor | undefined,
  ) {
    this.camara = escena.cameras.main;
    this.camara.setBounds(0, 0, mundo.ancho, mundo.alto);

    this.seguirAlJugador();
  }

  get estaEnfocada(): boolean {
    return this.enfocada;
  }

  /** En modo pan, o si no hay jugador, la cámara se mueve arrastrando. */
  get seArrastra(): boolean {
    return this.config.modo === 'pan' || this.jugador === undefined;
  }

  get scrollX(): number {
    return this.camara.scrollX;
  }

  /** Coloca la cámara al empezar: donde quedó en la partida guardada o centrada en el jugador. */
  colocarAlInicio(scrollGuardado: number | undefined): void {
    if (scrollGuardado !== undefined) {
      this.camara.setScroll(scrollGuardado, this.camara.scrollY);
    } else if (this.jugador) {
      this.camara.centerOn(this.jugador.posicion.x, this.camara.height / 2);
    }
  }

  // ── Arrastre (modo pan) ──

  empezarArrastre(): void {
    this.arrastrando = true;
    this.inercia = 0;
    this.scrollAlEmpezar = { x: this.camara.scrollX, y: this.camara.scrollY };
  }

  /** `desplazamiento` = cuánto se movió el dedo desde que empezó el arrastre, en píxeles de pantalla. */
  arrastrar(desplazamiento: Punto): void {
    const scrollAnterior = this.camara.scrollX;
    this.camara.setScroll(
      this.scrollAlEmpezar.x - desplazamiento.x / this.camara.zoom,
      this.scrollAlEmpezar.y - desplazamiento.y / this.camara.zoom,
    );
    this.inercia = scrollAnterior - this.camara.scrollX;
  }

  soltarArrastre(): void {
    this.arrastrando = false;
  }

  // ── Enfoque (paso "enfoca") ──

  /** Panea (y hace zoom) hasta `punto`. Termina al llegar o al cancelar; al cancelar se queda donde iba. */
  enfocar(punto: Punto, zoom: number, cancelacion: AbortSignal): Promise<void> {
    this.enfocada = true;
    this.camara.stopFollow();
    const duracion = prefiereMenosMovimiento() ? 0 : DURACION_DEL_ENFOQUE;

    return new Promise((terminar) => {
      const alTerminar = () => {
        cancelacion.removeEventListener('abort', alCancelar);
        terminar();
      };
      const alCancelar = () => {
        this.camara.panEffect.reset();
        this.camara.zoomEffect.reset();
        terminar();
      };
      cancelacion.addEventListener('abort', alCancelar, { once: true });

      this.camara.zoomTo(zoom, duracion, CURVA_DEL_ENFOQUE, true);
      this.camara.pan(punto.x, punto.y, duracion, CURVA_DEL_ENFOQUE, true, (_camara, progreso) => {
        if (progreso === 1) alTerminar();
      });
    });
  }

  /** Regresa al jugador (o solo quita el zoom, si no hay jugador) y vuelve al modo normal. */
  soltarEnfoque(): void {
    if (!this.enfocada) return;
    this.enfocada = false;
    const duracion = prefiereMenosMovimiento() ? 0 : DURACION_DEL_REGRESO;

    if (this.config.modo !== 'rails') this.camara.zoomTo(1, duracion, CURVA_DEL_ENFOQUE, true);
    if (!this.jugador || this.config.modo !== 'follow') return;

    const centro = this.jugador.posicion;
    this.camara.pan(centro.x, centro.y, duracion, CURVA_DEL_ENFOQUE, true, (_camara, progreso) => {
      // Si mientras regresaba empezó otro enfoque, no se vuelve a seguir al jugador.
      if (progreso === 1 && !this.enfocada) this.seguirAlJugador();
    });
  }

  private seguirAlJugador(): void {
    if (this.config.modo !== 'follow' || !this.jugador) return;
    this.camara.startFollow(this.jugador.sprite, true, this.config.suavizado, this.config.seguirY);
    this.camara.setDeadzone(this.config.zonaMuerta, this.camara.height);
  }

  // ── Cada cuadro ──

  actualizar(segundos: number): void {
    if (this.enfocada) return;
    if (this.config.modo === 'rails' && this.mundo.enfoquesDeCamara.length > 0) {
      this.acomodarEnRieles(segundos);
    } else if (this.seArrastra && !this.arrastrando) {
      this.aplicarInercia();
    }
    // En modo follow, Phaser mueve la cámara solo.
  }

  private acomodarEnRieles(segundos: number): void {
    const enfoque = this.enfoqueMasCercano();
    const avance = Math.min(1, segundos * RAPIDEZ_DE_RIELES); // fracción del camino que se recorre este cuadro

    const scrollObjetivoX = enfoque.x - this.camara.width / 2;
    const scrollObjetivoY = enfoque.y - this.camara.height / 2;
    this.camara.setZoom(this.camara.zoom + (enfoque.zoom - this.camara.zoom) * avance);
    this.camara.setScroll(
      this.camara.scrollX + (scrollObjetivoX - this.camara.scrollX) * avance,
      this.camara.scrollY + (scrollObjetivoY - this.camara.scrollY) * avance,
    );
  }

  private enfoqueMasCercano(): EnfoqueDeCamara {
    const enfoques = this.mundo.enfoquesDeCamara;
    const referenciaX = this.jugador?.posicion.x ?? enfoques[0]!.x;
    let masCercano = enfoques[0]!;
    for (const enfoque of enfoques) {
      if (Math.abs(enfoque.x - referenciaX) < Math.abs(masCercano.x - referenciaX)) masCercano = enfoque;
    }
    return masCercano;
  }

  /**
   * Después de soltar, la cámara sigue un poco y frena poco a poco.
   * Limitación conocida: no hay rebote elástico en los bordes (config.rebote no se usa todavía).
   */
  private aplicarInercia(): void {
    this.camara.setScroll(this.camara.scrollX - this.inercia, this.camara.scrollY);
    this.inercia *= this.config.inercia;
  }
}
