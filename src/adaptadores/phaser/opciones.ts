/**
 * Menú de opciones de un paso "elige": la pregunta arriba y una tarjeta grande por opción abajo.
 * Las tarjetas están fijas a la pantalla (no se mueven con la cámara).
 * Cada tarjeta muestra su imagen, su texto y su número (teclas 1–9).
 */
import * as Phaser from 'phaser';
import type { Opcion } from '../../core/esquema';
import { PROFUNDIDAD, type EscalaDeInterfaz } from './interfaz';

const SEPARACION_ENTRE_TARJETAS = 16;

/** Cualquier objeto de Phaser que se pueda fijar a la pantalla y ordenar por profundidad. */
type ObjetoFijable = Phaser.GameObjects.GameObject &
  Phaser.GameObjects.Components.ScrollFactor &
  Phaser.GameObjects.Components.Depth;

export class MenuDeOpciones {
  private readonly objetos: Phaser.GameObjects.GameObject[] = [];
  /** Una función por tarjeta que la redibuja resaltada o normal. */
  private readonly dibujarTarjeta: ((resaltada: boolean) => void)[] = [];

  constructor(
    private readonly escena: Phaser.Scene,
    pregunta: string,
    opciones: Opcion[],
    private readonly escala: EscalaDeInterfaz,
    alElegir: (indice: number) => void,
  ) {
    const tamanoDeLetra = Math.max(24 * escala.botones, escala.textoMinimo);
    this.crearPregunta(pregunta, tamanoDeLetra);

    const { width: anchoPantalla, height: altoPantalla } = escena.scale;
    const anchoTarjeta = Math.min(260 * escala.botones, (anchoPantalla - 40) / opciones.length - SEPARACION_ENTRE_TARJETAS);
    const altoTarjeta = 150 * escala.botones;
    const y = altoPantalla - altoTarjeta - 30 * escala.botones;
    const anchoTotal = opciones.length * anchoTarjeta + (opciones.length - 1) * SEPARACION_ENTRE_TARJETAS;
    const xInicial = (anchoPantalla - anchoTotal) / 2;

    opciones.forEach((opcion, indice) => {
      const x = xInicial + indice * (anchoTarjeta + SEPARACION_ENTRE_TARJETAS);
      this.crearTarjeta(opcion, indice, x, y, anchoTarjeta, altoTarjeta, tamanoDeLetra, alElegir);
    });
  }

  /** Resalta una tarjeta (por ejemplo, mientras se lee en voz alta). -1 = ninguna. */
  resaltar(indice: number): void {
    this.dibujarTarjeta.forEach((dibujar, i) => dibujar(i === indice));
  }

  destruir(): void {
    for (const objeto of this.objetos) objeto.destroy();
  }

  /** Agrega un objeto fijo a la pantalla, por encima del mundo. */
  private fijar<T extends ObjetoFijable>(objeto: T): T {
    objeto.setScrollFactor(0).setDepth(PROFUNDIDAD.botones);
    this.objetos.push(objeto);
    return objeto;
  }

  private crearPregunta(pregunta: string, tamanoDeLetra: number): void {
    const { width: anchoPantalla } = this.escena.scale;
    this.fijar(
      this.escena.add
        .text(anchoPantalla / 2, 30 * this.escala.botones, pregunta, {
          fontFamily: 'sans-serif',
          fontSize: tamanoDeLetra,
          color: '#1d1d1b',
          backgroundColor: '#ffffffee',
          padding: { x: 16, y: 10 },
          align: 'center',
          wordWrap: { width: anchoPantalla * 0.8 },
        })
        .setOrigin(0.5, 0),
    );
  }

  private crearTarjeta(
    opcion: Opcion,
    indice: number,
    x: number,
    y: number,
    ancho: number,
    alto: number,
    tamanoDeLetra: number,
    alElegir: (indice: number) => void,
  ): void {
    const fondo = this.fijar(this.escena.add.graphics());
    const dibujar = (resaltada: boolean) => {
      fondo.clear();
      fondo.fillStyle(resaltada ? 0xfff1c9 : 0xffffff, 0.96);
      fondo.fillRoundedRect(x, y, ancho, alto, 20);
      fondo.lineStyle(this.escala.borde * (resaltada ? 2 : 1), 0x1d1d1b, 1);
      fondo.strokeRoundedRect(x, y, ancho, alto, 20);
    };
    dibujar(false);
    this.dibujarTarjeta.push(dibujar);

    // Zona invisible que recibe el toque de toda la tarjeta.
    const zona = this.fijar(this.escena.add.zone(x, y, ancho, alto).setOrigin(0).setInteractive({ useHandCursor: true }));
    zona.on('pointerdown', () => alElegir(indice));
    zona.on('pointerover', () => dibujar(true));
    zona.on('pointerout', () => dibujar(false));

    if (opcion.imagen && this.escena.textures.exists(opcion.imagen)) {
      const imagen = this.fijar(this.escena.add.image(x + ancho / 2, y + alto * 0.42, opcion.imagen));
      const escalaQueCabe = Math.min((ancho * 0.8) / imagen.width, (alto * 0.6) / imagen.height);
      imagen.setScale(escalaQueCabe);
    }

    if (opcion.texto) {
      this.fijar(
        this.escena.add
          .text(x + ancho / 2, y + alto - 10, opcion.texto, {
            fontFamily: 'sans-serif',
            fontSize: tamanoDeLetra * 0.85,
            color: '#1d1d1b',
            align: 'center',
            wordWrap: { width: ancho - 16 },
          })
          .setOrigin(0.5, 1),
      );
    }

    const numero = String(indice + 1);
    this.fijar(this.escena.add.text(x + 10, y + 8, numero, { fontFamily: 'sans-serif', fontSize: tamanoDeLetra * 0.6, color: '#8a7a6a' }));
  }
}
