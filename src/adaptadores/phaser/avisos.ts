/**
 * Avisos sin lectura (§7.4). Cuando el jugador se acerca a algo interactivo:
 *   - el objeto late suavemente,
 *   - aparece un ícono encima (👂 para hablar, 👆 para tocar), nunca texto,
 *   - suena una señal corta, una sola vez por cada vez que se acerca.
 *
 * Ese objeto es también el que se activa con Enter o Espacio.
 */
import type * as Phaser from 'phaser';
import type { Punto } from '../../core/esquema';
import { cajaDeForma, distancia } from '../../core/geometria';
import type { Interactuable } from './construir-mundo';
import { PROFUNDIDAD, prefiereMenosMovimiento, type EscalaDeInterfaz } from './interfaz';

/** Lo que late: el sprite o imagen del objeto o, si es un personaje, su ajuste de escala. */
interface ConEscala {
  scaleX: number;
  scaleY: number;
}

interface Resaltado {
  interactuable: Interactuable;
  icono: Phaser.GameObjects.Text;
  latidoIcono?: Phaser.Tweens.Tween;
  latido?: Phaser.Tweens.Tween;
  loQueLate?: ConEscala;
  escalaOriginal: { x: number; y: number };
}

export class AvisosDeCercania {
  private resaltado?: Resaltado;

  constructor(
    private readonly escena: Phaser.Scene,
    private readonly interactuables: Interactuable[],
    private escala: EscalaDeInterfaz,
    private readonly alAparecer: () => void,
  ) {}

  /** El objeto resaltado ahora mismo, si hay uno. */
  get cercano(): Interactuable | undefined {
    return this.resaltado?.interactuable;
  }

  /** Se llama en cada cuadro con la posición del jugador. */
  actualizar(posicionDelJugador: Punto, radioDeAviso: number): void {
    const masCercano = this.buscarMasCercano(posicionDelJugador, radioDeAviso);
    if (masCercano === this.resaltado?.interactuable) return;

    this.quitar();
    if (masCercano) {
      this.resaltar(masCercano);
      this.alAparecer();
    }
  }

  quitar(): void {
    const resaltado = this.resaltado;
    if (!resaltado) return;
    resaltado.latidoIcono?.remove();
    resaltado.icono.destroy();
    resaltado.latido?.remove();
    if (resaltado.loQueLate) {
      resaltado.loQueLate.scaleX = resaltado.escalaOriginal.x;
      resaltado.loQueLate.scaleY = resaltado.escalaOriginal.y;
    }
    this.resaltado = undefined;
  }

  cambiarEscala(escala: EscalaDeInterfaz): void {
    this.escala = escala;
    this.resaltado?.icono.setScale(escala.botones);
  }

  private buscarMasCercano(posicion: Punto, radio: number): Interactuable | undefined {
    let masCercano: Interactuable | undefined;
    let menorDistancia = radio;
    for (const interactuable of this.interactuables) {
      const distanciaAlObjeto = distancia(interactuable.entidad.puntoDePie, posicion);
      if (distanciaAlObjeto <= menorDistancia) {
        masCercano = interactuable;
        menorDistancia = distanciaAlObjeto;
      }
    }
    return masCercano;
  }

  private resaltar(interactuable: Interactuable): void {
    const { visual, entidad } = interactuable;

    // El ícono va arriba de lo más alto: el sprite o el hotspot.
    let arriba = cajaDeForma(entidad.hotspot).y;
    if (visual) arriba = Math.min(arriba, visual.y - visual.displayHeight);

    const simbolo = interactuable.tipo === 'npcs' ? '👂' : '👆';
    const icono = this.escena.add
      .text(entidad.puntoDePie.x, arriba - 6, simbolo, { fontSize: 48 })
      .setOrigin(0.5, 1)
      .setDepth(PROFUNDIDAD.globos)
      .setScale(this.escala.botones);

    // Un personaje se reescala solo en cada cuadro (actor.ts): se anima su ajuste, no el sprite.
    const loQueLate: ConEscala | undefined = interactuable.actor?.ajusteDeEscala ?? visual;
    const escalaOriginal = { x: loQueLate?.scaleX ?? 1, y: loQueLate?.scaleY ?? 1 };
    let latidoIcono: Phaser.Tweens.Tween | undefined;
    let latido: Phaser.Tweens.Tween | undefined;

    if (!prefiereMenosMovimiento()) {
      latidoIcono = this.escena.tweens.add({ targets: icono, y: icono.y - 8, duration: 350, yoyo: true, repeat: -1 });
      if (loQueLate) {
        latido = this.escena.tweens.add({
          targets: loQueLate,
          scaleX: escalaOriginal.x * 1.04,
          scaleY: escalaOriginal.y * 1.04,
          duration: 400,
          yoyo: true,
          repeat: -1,
        });
      }
    }

    this.resaltado = { interactuable, icono, latidoIcono, latido, loQueLate, escalaOriginal };
  }
}
