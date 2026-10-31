/**
 * Globo de diálogo: una placa blanca con el texto, la traducción opcional debajo
 * y, si la línea trae vocabulario, una tarjeta con la palabra encima.
 *
 * El texto aparece letra por letra. `completar()` lo muestra entero de golpe.
 */
import * as Phaser from 'phaser';
import { PROFUNDIDAD, type EscalaDeInterfaz } from './interfaz';

export interface OpcionesDelGlobo {
  /** Traducción que se muestra debajo, en cursiva. */
  traduccion?: string;
  /** Palabra de vocabulario que se resalta encima del globo. */
  palabra?: string;
  /** Milisegundos por letra (0 = mostrar todo de una vez). */
  milisegundosPorLetra?: number;
}

const COLOR_DEL_TEXTO = '#1d1d1b';
const COLOR_DE_LA_TRADUCCION = '#5a4a3a';
const COLOR_DE_LA_TARJETA = '#e2572b';
const ANCHO_MAXIMO = 520;
const MILISEGUNDOS_POR_LETRA_POR_DEFECTO = 30;

export class Globo {
  private readonly contenedor: Phaser.GameObjects.Container;
  private readonly texto: Phaser.GameObjects.Text;
  private readonly textoCompleto: string;
  private escritura?: Phaser.Time.TimerEvent;

  /**
   * @param x, y  punto del mundo donde apunta el piquito del globo (sobre la cabeza de quien habla)
   */
  constructor(escena: Phaser.Scene, x: number, y: number, texto: string, escala: EscalaDeInterfaz, opciones: OpcionesDelGlobo = {}) {
    this.textoCompleto = texto;

    const tamanoDeLetra = Math.max(26 * escala.globos, escala.textoMinimo);
    const anchoMaximo = ANCHO_MAXIMO * escala.globos;
    const margen = 18 * escala.globos;
    const anchoDelTexto = anchoMaximo - margen * 2;

    // 1. Textos (se crean primero para medir cuánto ocupan).
    this.texto = escena.add.text(0, 0, texto, {
      fontFamily: 'sans-serif',
      fontSize: tamanoDeLetra,
      color: COLOR_DEL_TEXTO,
      wordWrap: { width: anchoDelTexto },
    });
    const traduccion = opciones.traduccion
      ? escena.add.text(0, 0, opciones.traduccion, {
          fontFamily: 'sans-serif',
          fontSize: tamanoDeLetra * 0.75,
          fontStyle: 'italic',
          color: COLOR_DE_LA_TRADUCCION,
          wordWrap: { width: anchoDelTexto },
        })
      : undefined;

    // 2. Tamaño de la placa según los textos.
    const separacion = 8;
    const altoDeTextos = this.texto.height + (traduccion ? separacion + traduccion.height : 0);
    const anchoDeTextos = Math.max(this.texto.width, traduccion?.width ?? 0);
    const ancho = Math.min(anchoMaximo, anchoDeTextos + margen * 2);
    const alto = altoDeTextos + margen * 2;

    // 3. Todo se dibuja relativo al piquito (0, 0); la placa queda arriba de él.
    const izquierda = -ancho / 2;
    const arriba = -alto;
    const placa = dibujarPlaca(escena, izquierda, arriba, ancho, alto, escala.borde);
    this.texto.setPosition(izquierda + margen, arriba + margen);
    traduccion?.setPosition(izquierda + margen, arriba + margen + this.texto.height + separacion);

    const hijos: Phaser.GameObjects.GameObject[] = [placa, this.texto];
    if (traduccion) hijos.push(traduccion);
    if (opciones.palabra) hijos.push(crearTarjetaDeVocabulario(escena, opciones.palabra, arriba - 14, tamanoDeLetra));

    // 4. Que no se salga de la pantalla: se acomoda dentro de lo que ve la cámara.
    const vista = escena.cameras.main.worldView;
    const xVisible = Phaser.Math.Clamp(x, vista.x + ancho / 2 + 8, vista.right - ancho / 2 - 8);
    const yVisible = Math.max(y, alto + 70 * escala.globos);
    this.contenedor = escena.add.container(xVisible, yVisible, hijos).setDepth(PROFUNDIDAD.globos);

    this.empezarAEscribir(escena, opciones.milisegundosPorLetra ?? MILISEGUNDOS_POR_LETRA_POR_DEFECTO);
  }

  /** true mientras el texto todavía se está escribiendo letra por letra. */
  get escribiendo(): boolean {
    return this.texto.text.length < this.textoCompleto.length;
  }

  completar(): void {
    this.escritura?.remove();
    this.texto.setText(this.textoCompleto);
  }

  destruir(): void {
    this.escritura?.remove();
    this.contenedor.destroy();
  }

  private empezarAEscribir(escena: Phaser.Scene, milisegundosPorLetra: number): void {
    if (milisegundosPorLetra <= 0 || this.textoCompleto.length <= 1) return;

    let letrasVisibles = 0;
    this.texto.setText('');
    this.escritura = escena.time.addEvent({
      delay: milisegundosPorLetra,
      repeat: this.textoCompleto.length - 1,
      callback: () => {
        letrasVisibles++;
        this.texto.setText(this.textoCompleto.slice(0, letrasVisibles));
      },
    });
  }
}

/** Placa semitransparente con borde y piquito: garantiza contraste sobre cualquier fondo. */
function dibujarPlaca(escena: Phaser.Scene, x: number, y: number, ancho: number, alto: number, borde: number): Phaser.GameObjects.Graphics {
  const radio = 18;
  const placa = escena.add.graphics();
  placa.fillStyle(0xffffff, 0.94);
  placa.fillRoundedRect(x, y, ancho, alto, radio);
  placa.lineStyle(borde, 0x1d1d1b, 1);
  placa.strokeRoundedRect(x, y, ancho, alto, radio);
  // Piquito que apunta hacia quien habla.
  placa.fillStyle(0xffffff, 0.94);
  placa.fillTriangle(-12, -1, 12, -1, 0, 16);
  return placa;
}

function crearTarjetaDeVocabulario(escena: Phaser.Scene, palabra: string, y: number, tamanoDeLetra: number): Phaser.GameObjects.Text {
  return escena.add
    .text(0, y, palabra, {
      fontFamily: 'sans-serif',
      fontSize: tamanoDeLetra * 1.2,
      fontStyle: 'bold',
      color: '#ffffff',
      backgroundColor: COLOR_DE_LA_TARJETA,
      padding: { x: 14, y: 6 },
    })
    .setOrigin(0.5, 1);
}
