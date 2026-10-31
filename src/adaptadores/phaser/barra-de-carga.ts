/**
 * Pantalla de carga sin texto (§9): una barra que se llena mientras se cargan los assets.
 * Se llama dentro de `preload()`; desaparece sola al terminar.
 */
import type * as Phaser from 'phaser';

export function mostrarBarraDeCarga(escena: Phaser.Scene): void {
  const { width: ancho, height: alto } = escena.scale;
  const barra = escena.add.graphics();

  const x = ancho * 0.2;
  const y = alto / 2 - 18;
  const anchoTotal = ancho * 0.6;

  escena.load.on('progress', (avance: number) => {
    barra.clear();
    barra.fillStyle(0xffffff, 0.6);
    barra.fillRoundedRect(x, y, anchoTotal, 36, 18);
    barra.fillStyle(0xe2572b, 1);
    barra.fillRoundedRect(x + 4, y + 4, Math.max(28, (anchoTotal - 8) * avance), 28, 14);
  });
  escena.load.once('complete', () => barra.destroy());
}
