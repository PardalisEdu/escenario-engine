/**
 * Un personaje que camina dentro del piso: el jugador, el acompañante o un NPC (§7).
 *
 * La posición del actor es su «punto de pie» (abajo al centro del sprite).
 * El orden de dibujo es esa y, así quien está más abajo en la pantalla queda delante.
 *
 * Para que no se vea tieso, además de las animaciones del atlas (si las hay) el sprite se mueve solo
 * (ver pose.ts): respira en reposo, rebota y se balancea al caminar, se aplasta un poco al arrancar
 * y al frenar, se voltea con un giro corto y da saltitos al hablar. También sabe hacer gestos.
 */
import * as Phaser from 'phaser';
import type { Mira, Punto } from '../../core/esquema';
import { avanzarHacia, haLlegado } from '../../core/geometria';
import { GESTOS, type NombreDeGesto } from '../../core/validar-enlaces';
import {
  DURACION_DE_GESTO,
  POSE_NEUTRA,
  combinarPoses,
  poseDeCaminata,
  poseDeGesto,
  poseDeHabla,
  poseDeImpulso,
  poseDeRespiracion,
  type Pose,
} from './pose';

/** "idle", "caminar" y "hablar" las usa el motor; cualquier otro nombre es un gesto con atlas propio. */
export type Animacion = string;

export interface OpcionesDelActor {
  /** Claves de las animaciones (atlas). Las que falten se reemplazan: sin "hablar" usa "idle". */
  animaciones?: Partial<Record<Animacion, string>>;
  /** Píxeles por segundo en cada eje. */
  velocidad?: { x: number; y: number };
  /** Accesibilidad: sin respiración, rebotes ni giros; los gestos sí se hacen. */
  movimientoReducido?: boolean;
}

/** Cuánto tarda en voltearse de un lado al otro. */
const SEGUNDOS_PARA_VOLTEARSE = 0.14;
/** Cuánto dura el aplastamiento al arrancar o frenar. */
const SEGUNDOS_DE_IMPULSO = 0.22;
/** Al voltearse el sprite se angosta, pero nunca hasta desaparecer. */
const ANCHO_MINIMO_AL_VOLTEARSE = 0.2;

/** Un gesto del motor en curso. */
interface GestoEnCurso {
  nombre: NombreDeGesto;
  segundosAlEmpezar: number;
  terminar: () => void;
}

export class Actor {
  readonly sprite: Phaser.GameObjects.Sprite;
  posicion: Punto;
  mira: Mira = 'derecha';
  /**
   * Escala extra que se multiplica con la pose. El sprite se reescala en cada cuadro,
   * así que quien quiera hacerlo latir (avisos.ts) anima esto y no el sprite.
   */
  readonly ajusteDeEscala = { scaleX: 1, scaleY: 1 };

  private readonly animaciones: Partial<Record<Animacion, string>>;
  private readonly velocidad: { x: number; y: number };
  private readonly movimientoReducido: boolean;
  private animacionActual?: Animacion;
  private destino?: Punto;
  private avisarLlegada?: () => void;

  /** Segundos desde que se creó; mueve la respiración y los gestos. */
  private reloj: number;
  private segundosCaminando = 0;
  /** De -1 (mira a la izquierda) a 1 (a la derecha). Pasa por 0 al voltearse. */
  private orientacion = 1;
  /** De 1 a 0: qué tanto queda del aplastamiento al arrancar o frenar. */
  private impulso = 0;
  private gesto?: GestoEnCurso;
  /** true mientras el atlas reproduce un gesto propio: no se cambia de animación. */
  private haciendoGestoConAtlas = false;

  constructor(
    private readonly escena: Phaser.Scene,
    puntoDePie: Punto,
    textura: string,
    opciones: OpcionesDelActor = {},
  ) {
    this.animaciones = opciones.animaciones ?? {};
    this.velocidad = opciones.velocidad ?? { x: 240, y: 110 };
    this.movimientoReducido = opciones.movimientoReducido ?? false;
    this.posicion = { ...puntoDePie };
    // Cada personaje empieza en otro momento de su respiración, para que no respiren todos a la vez.
    this.reloj = puntoDePie.x / 100;
    this.sprite = escena.add.sprite(puntoDePie.x, puntoDePie.y, textura).setOrigin(0.5, 1);
    this.animar('idle');
    this.actualizarSprite(0);
  }

  get caminando(): boolean {
    return this.destino !== undefined;
  }

  /** El arte mira a la derecha; para mirar a la izquierda se voltea el sprite (con un giro corto). */
  mirarHacia(mira: Mira): void {
    this.mira = mira;
    if (this.movimientoReducido) this.orientacion = mira === 'derecha' ? 1 : -1;
  }

  animar(animacion: Animacion): void {
    if (this.animacionActual === animacion || this.haciendoGestoConAtlas) return;
    const arrancaOFrena = animacion === 'caminar' || this.animacionActual === 'caminar';
    if (arrancaOFrena && this.animacionActual !== undefined) this.impulso = 1;
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

  /** Cambia hacia dónde va sin terminar la caminata (el acompañante persigue al jugador así). */
  cambiarDestino(destino: Punto): void {
    if (this.destino) this.destino = destino;
  }

  /** Se queda donde está y termina la caminata en curso. */
  detener(): void {
    const avisar = this.avisarLlegada;
    this.destino = undefined;
    this.avisarLlegada = undefined;
    this.animar('idle');
    avisar?.();
  }

  /**
   * Hace un gesto: una animación propia del atlas (se reproduce una vez) o uno de los gestos del motor.
   * Termina cuando acaba el gesto o al cancelar.
   */
  hacerGesto(nombre: string, cancelacion: AbortSignal): Promise<void> {
    const clave = this.animaciones[nombre];
    if (clave && this.escena.anims.exists(clave)) return this.hacerGestoConAtlas(clave, cancelacion);
    if ((GESTOS as readonly string[]).includes(nombre)) return this.hacerGestoDelMotor(nombre as NombreDeGesto, cancelacion);
    return Promise.resolve(); // no pasa: la validación revisa que el gesto exista
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
    this.actualizarSprite(segundos);
  }

  colocarEn(punto: Punto): void {
    this.posicion = { ...punto };
    this.actualizarSprite(0);
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

  // ── Gestos ──

  private hacerGestoConAtlas(clave: string, cancelacion: AbortSignal): Promise<void> {
    return new Promise((terminar) => {
      const alAcabar = () => {
        this.sprite.off(Phaser.Animations.Events.ANIMATION_COMPLETE, alAcabar);
        cancelacion.removeEventListener('abort', alAcabar);
        this.haciendoGestoConAtlas = false;
        this.animacionActual = undefined; // para que la siguiente animación sí se reproduzca
        this.animar(this.caminando ? 'caminar' : 'idle');
        terminar();
      };
      this.sprite.play(clave);
      this.haciendoGestoConAtlas = true;
      this.sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, alAcabar);
      cancelacion.addEventListener('abort', alAcabar, { once: true });
    });
  }

  private hacerGestoDelMotor(nombre: NombreDeGesto, cancelacion: AbortSignal): Promise<void> {
    this.gesto?.terminar(); // un gesto nuevo reemplaza al anterior
    return new Promise((terminar) => {
      const gesto: GestoEnCurso = {
        nombre,
        segundosAlEmpezar: this.reloj,
        terminar: () => {
          cancelacion.removeEventListener('abort', gesto.terminar);
          if (this.gesto === gesto) this.gesto = undefined;
          terminar();
        },
      };
      this.gesto = gesto;
      cancelacion.addEventListener('abort', gesto.terminar, { once: true });
    });
  }

  // ── Dibujo ──

  private actualizarSprite(segundos: number): void {
    this.reloj += segundos;
    this.avanzarVolteo(segundos);
    this.impulso = Math.max(0, this.impulso - segundos / SEGUNDOS_DE_IMPULSO);

    const pose = this.poseActual();
    const anchoPorVolteo = Math.max(ANCHO_MINIMO_AL_VOLTEARSE, Math.abs(this.orientacion));
    this.sprite.setFlipX(this.orientacion < 0);
    this.sprite.setScale(
      pose.escalaX * anchoPorVolteo * this.ajusteDeEscala.scaleX,
      pose.escalaY * this.ajusteDeEscala.scaleY,
    );
    this.sprite.setAngle(pose.angulo);
    this.sprite.setPosition(this.posicion.x, this.posicion.y + pose.desplazamientoY);
    this.sprite.setDepth(this.posicion.y);
  }

  /** La orientación se acerca poco a poco al lado al que mira: así se voltea con un giro y no de golpe. */
  private avanzarVolteo(segundos: number): void {
    const objetivo = this.mira === 'derecha' ? 1 : -1;
    const pasoMaximo = (2 / SEGUNDOS_PARA_VOLTEARSE) * segundos; // de -1 a 1 hay 2 unidades
    const diferencia = objetivo - this.orientacion;
    this.orientacion += Math.sign(diferencia) * Math.min(Math.abs(diferencia), pasoMaximo);
  }

  /** Suma lo que toca en este momento: respiración o caminata, habla, impulso y gesto. */
  private poseActual(): Pose {
    let pose = POSE_NEUTRA;

    if (!this.movimientoReducido) {
      if (this.animacionActual === 'caminar') {
        const tieneAtlas = this.animaciones.caminar !== undefined;
        pose = poseDeCaminata(this.segundosCaminando, this.mira === 'derecha', tieneAtlas);
      } else {
        pose = poseDeRespiracion(this.reloj);
      }
      if (this.animacionActual === 'hablar' && this.animaciones.hablar === undefined) {
        pose = combinarPoses(pose, poseDeHabla(this.reloj));
      }
      pose = combinarPoses(pose, poseDeImpulso(this.impulso));
    }

    if (this.gesto) {
      const duracionEnSegundos = DURACION_DE_GESTO[this.gesto.nombre] / 1000;
      const progreso = (this.reloj - this.gesto.segundosAlEmpezar) / duracionEnSegundos;
      if (progreso >= 1) this.gesto.terminar();
      else pose = combinarPoses(pose, poseDeGesto(this.gesto.nombre, progreso));
    }
    return pose;
  }
}
