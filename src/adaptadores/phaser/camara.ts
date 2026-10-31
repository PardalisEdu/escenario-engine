/**
 * CameraRig (§6.2). Tres modos:
 *
 *   follow  (por defecto) sigue al jugador. Dentro de la «zona muerta» horizontal el jugador
 *           camina sin que la cámara se mueva. En vertical la cámara casi no se mueve.
 *   rails   se acomoda suavemente en el punto enfoqueCamara más cercano al jugador.
 *   pan     escenas sin jugador: se arrastra con el dedo y sigue un poco por inercia.
 *
 * En todos los modos la cámara nunca sale de los bordes del mundo.
 */
import type * as Phaser from 'phaser';
import type { Contenido, Punto } from '../../core/esquema';
import type { EnfoqueDeCamara, Mundo } from '../../core/mundo';
import type { Actor } from './actor';

type ConfigDeCamara = Contenido['mundo']['camara'];

/** Qué tan rápido se acomoda la cámara en modo rails (mayor = más rápido). */
const RAPIDEZ_DE_RIELES = 4;

export class Camara {
  private readonly camara: Phaser.Cameras.Scene2D.Camera;
  /** Píxeles por cuadro que sigue avanzando la cámara después de soltar un arrastre. */
  private inercia = 0;
  private arrastrando = false;
  /** Dónde estaba la cámara cuando empezó el arrastre. */
  private scrollAlEmpezar = { x: 0, y: 0 };

  constructor(
    escena: Phaser.Scene,
    private readonly config: ConfigDeCamara,
    private readonly mundo: Mundo,
    private readonly jugador: Actor | undefined,
  ) {
    this.camara = escena.cameras.main;
    this.camara.setBounds(0, 0, mundo.ancho, mundo.alto);

    if (config.modo === 'follow' && jugador) {
      this.camara.startFollow(jugador.sprite, true, config.suavizado, config.seguirY);
      this.camara.setDeadzone(config.zonaMuerta, escena.scale.height);
    }
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

  // ── Cada cuadro ──

  actualizar(segundos: number): void {
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
