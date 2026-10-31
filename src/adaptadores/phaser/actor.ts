/**
 * Un personaje que camina dentro del piso: el jugador o un NPC (§7).
 *
 * La posición del actor es su «punto de pie» (abajo al centro del sprite).
 * El orden de dibujo es esa y, así quien está más abajo en la pantalla queda delante.
 */
import * as Phaser from 'phaser';
import type { Mira, Punto } from '../../core/esquema';
import { avanzarHacia, haLlegado } from '../../core/geometria';

export type Animacion = 'idle' | 'caminar' | 'hablar';

export interface OpcionesDelActor {
  /** Claves de las animaciones (atlas). Las que falten se reemplazan: sin "hablar" usa "idle". */
  animaciones?: Partial<Record<Animacion, string>>;
  /** Píxeles por segundo en cada eje. */
  velocidad?: { x: number; y: number };
  /** Si no tiene animación de caminar, rebota 2 px al moverse. Se apaga con movimiento reducido. */
  rebotarAlCaminar?: boolean;
}

export class Actor {
  readonly sprite: Phaser.GameObjects.Sprite;
  posicion: Punto;
  mira: Mira = 'derecha';

  private readonly animaciones: Partial<Record<Animacion, string>>;
  private readonly velocidad: { x: number; y: number };
  private readonly rebotarAlCaminar: boolean;
  private animacionActual?: Animacion;
  private destino?: Punto;
  private avisarLlegada?: () => void;
  private segundosCaminando = 0;

  constructor(
    private readonly escena: Phaser.Scene,
    puntoDePie: Punto,
    textura: string,
    opciones: OpcionesDelActor = {},
  ) {
    this.animaciones = opciones.animaciones ?? {};
    this.velocidad = opciones.velocidad ?? { x: 240, y: 110 };
    this.rebotarAlCaminar = opciones.rebotarAlCaminar ?? true;
    this.posicion = { ...puntoDePie };
    this.sprite = escena.add.sprite(puntoDePie.x, puntoDePie.y, textura).setOrigin(0.5, 1);
    this.animar('idle');
    this.actualizarSprite();
  }

  get caminando(): boolean {
    return this.destino !== undefined;
  }

  /** El arte mira a la derecha; para mirar a la izquierda se voltea el sprite. */
  mirarHacia(mira: Mira): void {
    this.mira = mira;
    this.sprite.setFlipX(mira === 'izquierda');
  }

  animar(animacion: Animacion): void {
    if (this.animacionActual === animacion) return;
    this.animacionActual = animacion;

    let clave = this.animaciones[animacion];
    if (clave === undefined && animacion === 'hablar') clave = this.animaciones.idle;

    if (clave && this.escena.anims.exists(clave)) this.sprite.play(clave);
    else this.sprite.stop();
  }

  /**
   * Empieza a caminar hacia `destino`. La promesa termina al llegar, al quedar atorado
   * o cuando se llama a `detener()` (por ejemplo, porque llegó otro toque).
   */
  caminarA(destino: Punto): Promise<void> {
    this.detener(); // termina la caminata anterior, si había
    this.destino = destino;
    return new Promise((resolver) => {
      this.avisarLlegada = resolver;
    });
  }

  /** Se queda donde está y termina la caminata en curso. */
  detener(): void {
    const avisar = this.avisarLlegada;
    this.destino = undefined;
    this.avisarLlegada = undefined;
    this.animar('idle');
    avisar?.();
  }

  /** Movimiento con teclado. `direccion` va de -1 a 1 en cada eje; (0, 0) = sin teclas. */
  moverConTeclado(direccion: Punto, segundos: number, esCaminable: (punto: Punto) => boolean): void {
    const hayTeclas = direccion.x !== 0 || direccion.y !== 0;
    if (!hayTeclas) {
      if (!this.caminando) this.animar('idle');
      return;
    }
    // Un destino muy lejano en esa dirección: así se usa la misma lógica de deslizamiento que al tocar.
    const lejos = 10_000;
    this.darUnPaso({ x: this.posicion.x + direccion.x * lejos, y: this.posicion.y + direccion.y * lejos }, segundos, esCaminable);
  }

  /** Se llama en cada cuadro del juego. */
  actualizar(segundos: number, esCaminable: (punto: Punto) => boolean): void {
    if (this.destino) {
      const seMovio = this.darUnPaso(this.destino, segundos, esCaminable);
      if (!seMovio || haLlegado(this.posicion, this.destino)) this.detener();
    }
    this.actualizarSprite();
  }

  colocarEn(punto: Punto): void {
    this.posicion = { ...punto };
    this.actualizarSprite();
  }

  /** Devuelve false si no pudo moverse (llegó o está atorado). */
  private darUnPaso(destino: Punto, segundos: number, esCaminable: (punto: Punto) => boolean): boolean {
    const siguiente = avanzarHacia(this.posicion, destino, this.velocidad, segundos, esCaminable);
    const seMovio = siguiente.x !== this.posicion.x || siguiente.y !== this.posicion.y;
    if (!seMovio) return false;

    if (siguiente.x < this.posicion.x) this.mirarHacia('izquierda');
    if (siguiente.x > this.posicion.x) this.mirarHacia('derecha');
    this.posicion = siguiente;
    this.segundosCaminando += segundos;
    this.animar('caminar');
    return true;
  }

  private actualizarSprite(): void {
    let rebote = 0;
    const deslizaSinAnimacion = this.caminando && this.animaciones.caminar === undefined;
    if (this.rebotarAlCaminar && deslizaSinAnimacion) {
      rebote = -2 * Math.abs(Math.sin(this.segundosCaminando * 12));
    }
    this.sprite.setPosition(this.posicion.x, this.posicion.y + rebote);
    this.sprite.setDepth(this.posicion.y);
  }
}
