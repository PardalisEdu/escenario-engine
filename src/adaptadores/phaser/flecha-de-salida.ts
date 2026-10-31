/**
 * Flecha de salida (§8.7): señala por dónde se sale del nivel. Se entiende por ícono y animación;
 * el texto (flecha.texto) es opcional. Aparece cuando se cumple "flecha.visibleCuando".
 */
import type * as Phaser from 'phaser';
import { cajaDeForma } from '../../core/geometria';
import type { Salida } from '../../core/mundo';
import { PROFUNDIDAD, prefiereMenosMovimiento } from './interfaz';

export class FlechaDeSalida {
  private readonly texto: Phaser.GameObjects.Text;

  constructor(escena: Phaser.Scene, salida: Salida, anchoDelMundo: number, escala: number, leyenda?: string) {
    const caja = cajaDeForma(salida.hotspot);
    const centroX = caja.x + caja.ancho / 2;
    // Si la salida está en la mitad izquierda del mundo, la flecha apunta a la izquierda.
    const apuntaAIzquierda = centroX < anchoDelMundo / 2;
    const simbolo = apuntaAIzquierda ? '⬅️' : '➡️';

    this.texto = escena.add
      .text(centroX, caja.y, leyenda ? `${simbolo}\n${leyenda}` : simbolo, {
        fontSize: 64,
        fontFamily: 'sans-serif',
        color: '#1d1d1b',
        align: 'center',
      })
      .setOrigin(0.5, 1)
      .setDepth(PROFUNDIDAD.flechaDeSalida)
      .setScale(escala);

    if (!prefiereMenosMovimiento()) {
      const desplazamiento = apuntaAIzquierda ? -14 : 14;
      escena.tweens.add({ targets: this.texto, x: centroX + desplazamiento, duration: 500, yoyo: true, repeat: -1 });
    }
  }

  mostrar(visible: boolean): void {
    this.texto.setVisible(visible);
  }

  cambiarEscala(escala: number): void {
    this.texto.setScale(escala);
  }
}
