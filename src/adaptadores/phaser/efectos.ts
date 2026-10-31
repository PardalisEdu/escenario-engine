/**
 * Tabla global de efectos (paso "efecto", §8.3). Cada efecto tiene imagen (partículas) y sonido.
 * Para agregar un efecto: súmalo a EFECTOS en core/validar-enlaces.ts y aquí a EFECTOS_DISPONIBLES.
 */
import * as Phaser from 'phaser';
import type { Punto } from '../../core/esquema';
import type { NombreDeEfecto } from '../../core/validar-enlaces';
import { PROFUNDIDAD } from './interfaz';
import { tocarTono } from './voz';

/** Textura de una chispa blanca; se tiñe de colores en cada efecto. */
const TEXTURA_DE_CHISPA = 'escenario:chispa';
const DURACION_EN_MILISEGUNDOS = 1000;

type Efecto = (escena: Phaser.Scene, posicion: Punto) => Phaser.GameObjects.Particles.ParticleEmitter;

const EFECTOS_DISPONIBLES: Record<NombreDeEfecto, Efecto> = {
  /** Una explosión de chispas de colores y tres notas que suben. */
  magia(escena, posicion) {
    const chispas = escena.add.particles(posicion.x, posicion.y, TEXTURA_DE_CHISPA, {
      speed: { min: 80, max: 260 },
      lifespan: 900,
      scale: { start: 1.4, end: 0 },
      tint: [0xffe066, 0xff8ad8, 0x8ae2ff],
      emitting: false,
    });
    chispas.setDepth(PROFUNDIDAD.efectos);
    chispas.explode(40);

    const notas = [660, 880, 1320];
    notas.forEach((frecuencia, i) => escena.time.delayedCall(i * 110, () => tocarTono(escena, frecuencia)));
    return chispas;
  },

  /** Confeti que cae desde arriba de toda la pantalla. */
  confeti(escena) {
    const vista = escena.cameras.main.worldView;
    const confeti = escena.add.particles(0, vista.y - 10, TEXTURA_DE_CHISPA, {
      x: { min: vista.x, max: vista.right },
      speedX: { min: -60, max: 60 },
      speedY: { min: 120, max: 300 },
      lifespan: 1600,
      scale: { start: 1.2, end: 0.6 },
      tint: [0xe2572b, 0x3fa34d, 0x2f6fd0, 0xf2c230, 0xef7fb0],
      emitting: false,
    });
    confeti.setDepth(PROFUNDIDAD.efectos);
    confeti.explode(90);
    tocarTono(escena, 990, 0.3);
    return confeti;
  },
};

/** Crea la textura de la chispa. Se llama una vez al crear la escena. */
export function crearTexturaDeChispa(escena: Phaser.Scene): void {
  const dibujo = escena.make.graphics({}, false);
  dibujo.fillStyle(0xffffff);
  dibujo.fillCircle(5, 5, 5);
  dibujo.generateTexture(TEXTURA_DE_CHISPA, 10, 10);
  dibujo.destroy();
}

/** Reproduce un efecto en `posicion` y termina cuando se acaba la animación. */
export async function reproducirEfecto(escena: Phaser.Scene, nombre: string, posicion: Punto): Promise<void> {
  const efecto = EFECTOS_DISPONIBLES[nombre as NombreDeEfecto];
  if (!efecto) return; // no pasa: la validación ya revisó que exista

  const particulas = efecto(escena, posicion);
  await new Promise((terminar) => escena.time.delayedCall(DURACION_EN_MILISEGUNDOS, terminar));
  particulas.destroy();
}
