/**
 * El marco de cine de la intro: dos franjas oscuras que entran desde arriba y abajo,
 * un fundido desde negro al empezar y un botón ⏭ para saltar la escena (también con Escape).
 *
 * El botón no lleva texto: el ícono de «adelantar» se entiende sin leer.
 *
 * Todo se coloca en coordenadas de mundo según lo que ve la cámara (`worldView`) en cada cuadro,
 * así sigue en su lugar aunque la cámara panee o haga zoom durante la intro.
 */
import * as Phaser from 'phaser';
import { PROFUNDIDAD, prefiereMenosMovimiento, type EscalaDeInterfaz } from './interfaz';

/** Alto de cada franja, como fracción del alto de la pantalla. */
const ALTO_DE_FRANJA = 0.11;
const COLOR_DE_FRANJA = 0x10131a;
const DURACION_DE_FRANJAS = 700;
const DURACION_DEL_FUNDIDO = 900;

const RADIO_DEL_BOTON = 34;
const MARGEN_DEL_BOTON = 24;

export class Cinematica {
  private readonly franjaSuperior: Phaser.GameObjects.Rectangle;
  private readonly franjaInferior: Phaser.GameObjects.Rectangle;
  private readonly boton: Phaser.GameObjects.Arc;
  private readonly iconoDelBoton: Phaser.GameObjects.Graphics;
  /** De 0 (franjas fuera de la pantalla) a 1 (franjas puestas). Lo anima un tween. */
  private readonly entrada = { progreso: 0 };
  private tween?: Phaser.Tweens.Tween;
  private destruida = false;

  constructor(
    private readonly escena: Phaser.Scene,
    private escala: EscalaDeInterfaz,
    alSaltar: () => void,
  ) {
    this.franjaSuperior = escena.add.rectangle(0, 0, 1, 1, COLOR_DE_FRANJA).setOrigin(0).setDepth(PROFUNDIDAD.franjasDeCine);
    this.franjaInferior = escena.add.rectangle(0, 0, 1, 1, COLOR_DE_FRANJA).setOrigin(0).setDepth(PROFUNDIDAD.franjasDeCine);

    this.boton = escena.add
      .circle(0, 0, RADIO_DEL_BOTON, 0xffffff, 0.92)
      .setStrokeStyle(3, 0x1d1d1b)
      .setDepth(PROFUNDIDAD.botones)
      .setInteractive({ useHandCursor: true });
    this.boton.on('pointerdown', alSaltar);
    this.iconoDelBoton = dibujarIconoDeAdelantar(escena).setDepth(PROFUNDIDAD.botones + 1);

    this.actualizar();
  }

  /** Fundido desde negro y entrada de las franjas. */
  empezar(): void {
    const menosMovimiento = prefiereMenosMovimiento();
    this.escena.cameras.main.fadeIn(menosMovimiento ? 0 : DURACION_DEL_FUNDIDO, 0, 0, 0);
    this.animarFranjas(1, menosMovimiento ? 0 : DURACION_DE_FRANJAS);
  }

  /** Las franjas salen y todo se destruye. Termina cuando ya no queda nada en pantalla. */
  terminar(): Promise<void> {
    this.boton.disableInteractive();
    this.boton.setVisible(false);
    this.iconoDelBoton.setVisible(false);
    const duracion = prefiereMenosMovimiento() ? 0 : DURACION_DE_FRANJAS;
    return new Promise((listo) => {
      this.animarFranjas(0, duracion, () => {
        this.destruir();
        listo();
      });
    });
  }

  /** Quita todo de inmediato (por ejemplo, si la escena se cierra a media intro). */
  destruir(): void {
    if (this.destruida) return;
    this.destruida = true;
    this.tween?.remove();
    this.franjaSuperior.destroy();
    this.franjaInferior.destroy();
    this.boton.destroy();
    this.iconoDelBoton.destroy();
  }

  cambiarEscala(escala: EscalaDeInterfaz): void {
    this.escala = escala;
  }

  /** Se llama en cada cuadro: acomoda franjas y botón a lo que ve la cámara ahora. */
  actualizar(): void {
    if (this.destruida) return;
    const vista = this.escena.cameras.main.worldView;
    const zoom = this.escena.cameras.main.zoom;

    const altoDeFranja = vista.height * ALTO_DE_FRANJA;
    const escondida = altoDeFranja * (1 - this.entrada.progreso);
    // worldView se calcula al dibujar, así que aquí va un cuadro atrasado mientras la cámara se mueve.
    // Las franjas sobran a los lados para que ese atraso nunca deje ver un hueco.
    const sobrante = vista.width * 0.2;
    const izquierda = vista.x - sobrante;
    const ancho = vista.width + sobrante * 2;
    this.franjaSuperior.setPosition(izquierda, vista.y - escondida).setSize(ancho, altoDeFranja);
    this.franjaInferior.setPosition(izquierda, vista.bottom - altoDeFranja + escondida).setSize(ancho, altoDeFranja);

    // Los objetos del mundo crecen con el zoom; el botón se encoge en proporción para verse siempre igual.
    const escalaDelBoton = this.escala.botones / zoom;
    const separacionDelBorde = (RADIO_DEL_BOTON + MARGEN_DEL_BOTON) * escalaDelBoton;
    const x = vista.right - separacionDelBorde;
    const y = vista.bottom - separacionDelBorde;
    this.boton.setPosition(x, y).setScale(escalaDelBoton).setAlpha(this.entrada.progreso);
    this.iconoDelBoton.setPosition(x, y).setScale(escalaDelBoton).setAlpha(this.entrada.progreso);
  }

  private animarFranjas(progreso: number, duracion: number, alTerminar?: () => void): void {
    this.tween?.remove();
    this.tween = this.escena.tweens.add({
      targets: this.entrada,
      progreso,
      duration: duracion,
      ease: 'Cubic.easeInOut',
      onComplete: alTerminar,
    });
  }
}

/** ⏭ dibujado: dos triángulos y una barra, centrados en (0, 0). */
function dibujarIconoDeAdelantar(escena: Phaser.Scene): Phaser.GameObjects.Graphics {
  const icono = escena.add.graphics();
  icono.fillStyle(0x1d1d1b);
  icono.fillTriangle(-16, -11, -16, 11, -3, 0);
  icono.fillTriangle(-3, -11, -3, 11, 10, 0);
  icono.fillRect(11, -11, 4, 22);
  return icono;
}

/** Espera `milisegundos` con el reloj de la escena (se detiene si la escena se pausa). Termina antes si se cancela. */
export function esperarEnLaEscena(escena: Phaser.Scene, milisegundos: number, cancelacion: AbortSignal): Promise<void> {
  return new Promise((terminar) => {
    if (cancelacion.aborted) {
      terminar();
      return;
    }
    const alCancelar = () => {
      temporizador.remove();
      terminar();
    };
    const temporizador = escena.time.delayedCall(milisegundos, () => {
      cancelacion.removeEventListener('abort', alCancelar);
      terminar();
    });
    cancelacion.addEventListener('abort', alCancelar, { once: true });
  });
}
