/**
 * Overlay de desarrollo (§12): dibuja encima del juego las formas invisibles.
 *   verde     piso caminable
 *   rojo      huellas que bloquean el paso
 *   amarillo  hotspots (lo que responde al toque)
 *   azul      zonas de comentario
 */
import * as Phaser from 'phaser';
import type { Forma } from '../../core/geometria';
import type { Mundo } from '../../core/mundo';
import type { ElementosDelMundo } from './construir-mundo';
import { PROFUNDIDAD } from './interfaz';

const VERDE = 0x22cc55;
const ROJO = 0xff3333;
const AMARILLO = 0xffcc00;
const AZUL = 0x3399ff;

export function dibujarOverlayDeDepuracion(escena: Phaser.Scene, mundo: Mundo, elementos: ElementosDelMundo): void {
  const dibujo = escena.add.graphics().setDepth(PROFUNDIDAD.depuracion);

  const trazar = (forma: Forma, color: number) => {
    dibujo.lineStyle(2, color, 0.9);
    switch (forma.tipo) {
      case 'poligono':
        dibujo.strokePoints(forma.puntos.map((p) => new Phaser.Math.Vector2(p.x, p.y)), true);
        break;
      case 'rect':
        dibujo.strokeRect(forma.x, forma.y, forma.ancho, forma.alto);
        break;
      case 'elipse':
        dibujo.strokeEllipse(forma.x + forma.ancho / 2, forma.y + forma.alto / 2, forma.ancho, forma.alto);
        break;
    }
  };

  for (const piso of mundo.pisos) trazar({ tipo: 'poligono', puntos: piso }, VERDE);
  for (const huella of elementos.huellas) trazar(huella, ROJO);
  for (const interactuable of elementos.interactuables) trazar(interactuable.entidad.hotspot, AMARILLO);
  for (const zona of mundo.zonasDeComentario) trazar(zona.forma, AZUL);
}
