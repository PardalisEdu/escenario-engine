/**
 * Tarjeta de título (paso "titulo"): la pantalla se oscurece con suavidad, el título aparece
 * subiendo entre dos adornos dorados que se abren desde el centro, suena un acorde breve
 * y una voz lo dice en voz alta. Después todo se desvanece.
 *
 * Nada requiere leer: el título siempre se dice (voz grabada o sintetizada).
 */
import type * as Phaser from 'phaser';
import type { Idioma } from '../../core/esquema';
import { esperarEnLaEscena } from './cinematica';
import { PROFUNDIDAD, prefiereMenosMovimiento, type EscalaDeInterfaz } from './interfaz';
import { tocarTono, type Voz } from './voz';

const COLOR_DEL_VELO = 0x10131a;
const OPACIDAD_DEL_VELO = 0.62;
const COLOR_DEL_TITULO = '#fff8e7';
const COLOR_DEL_ADORNO = 0xf2c230;
const TIPOGRAFIA = 'Georgia, "Palatino Linotype", "Book Antiqua", serif';

const DURACION_DE_ENTRADA = 900;
const DURACION_DE_SALIDA = 600;
/** El título se queda al menos esto en pantalla, aunque la voz sea más corta. */
const TIEMPO_MINIMO_EN_PANTALLA = 2200;
/** Notas del acorde de entrada (Hz), una tras otra. */
const NOTAS_DEL_ACORDE = [523, 659, 784];

export interface DatosDelTitulo {
  escena: Phaser.Scene;
  voz: Voz;
  texto: string;
  audio?: string;
  idioma: Idioma;
  escala: EscalaDeInterfaz;
}

export async function mostrarTarjetaDeTitulo(datos: DatosDelTitulo, cancelacion: AbortSignal): Promise<void> {
  if (cancelacion.aborted) return;
  const { escena } = datos;
  const tarjeta = crearTarjeta(datos);
  const animaciones: Phaser.Tweens.Tween[] = [];
  const temporizadores: Phaser.Time.TimerEvent[] = [];
  const conMovimiento = !prefiereMenosMovimiento();

  try {
    // Entrada: velo, título que sube y adornos que se abren.
    animaciones.push(escena.tweens.add({ targets: tarjeta.velo, alpha: OPACIDAD_DEL_VELO, duration: DURACION_DE_ENTRADA }));
    animaciones.push(
      escena.tweens.add({
        targets: tarjeta.titulo,
        alpha: 1,
        y: 0,
        scale: 1,
        duration: DURACION_DE_ENTRADA,
        ease: 'Cubic.easeOut',
        delay: 150,
      }),
    );
    animaciones.push(
      escena.tweens.add({
        targets: tarjeta.adornos,
        alpha: 1,
        scaleX: 1,
        duration: DURACION_DE_ENTRADA * 1.2,
        ease: 'Cubic.easeOut',
        delay: 300,
      }),
    );
    NOTAS_DEL_ACORDE.forEach((frecuencia, i) => {
      temporizadores.push(escena.time.delayedCall(250 + i * 140, () => tocarTono(escena, frecuencia, 0.5)));
    });

    if (!conMovimiento) {
      tarjeta.titulo.setY(0).setScale(1);
      tarjeta.adornos.forEach((adorno) => adorno.setScale(1));
    }

    // Se escucha el título mientras está en pantalla.
    await Promise.all([
      datos.voz.decir(datos.texto, datos.idioma, datos.audio, cancelacion),
      esperarEnLaEscena(escena, TIEMPO_MINIMO_EN_PANTALLA, cancelacion),
    ]);
    if (cancelacion.aborted) return;

    // Salida: todo se desvanece.
    animaciones.push(escena.tweens.add({ targets: tarjeta.contenedor, alpha: 0, duration: DURACION_DE_SALIDA }));
    await esperarEnLaEscena(escena, DURACION_DE_SALIDA, cancelacion);
  } finally {
    for (const animacion of animaciones) animacion.remove();
    for (const temporizador of temporizadores) temporizador.remove();
    tarjeta.contenedor.destroy();
  }
}

interface Tarjeta {
  contenedor: Phaser.GameObjects.Container;
  velo: Phaser.GameObjects.Rectangle;
  titulo: Phaser.GameObjects.Text;
  adornos: Phaser.GameObjects.Graphics[];
}

/**
 * Arma la tarjeta centrada en lo que ve la cámara. Todo empieza invisible; mostrarTarjetaDeTitulo lo anima.
 * El contenedor se encoge según el zoom de la cámara para que el título se vea del mismo tamaño siempre.
 */
function crearTarjeta(datos: DatosDelTitulo): Tarjeta {
  const { escena, escala } = datos;
  const camara = escena.cameras.main;
  const vista = camara.worldView;
  const anchoDePantalla = camara.width;
  const altoDePantalla = camara.height;

  const velo = escena.add
    .rectangle(0, 0, anchoDePantalla, altoDePantalla, COLOR_DEL_VELO)
    .setAlpha(0);

  const tamanoDeLetra = Math.max(76 * escala.globos, escala.textoMinimo);
  const titulo = escena.add
    .text(0, 18, datos.texto, {
      fontFamily: TIPOGRAFIA,
      fontSize: tamanoDeLetra,
      color: COLOR_DEL_TITULO,
      align: 'center',
      wordWrap: { width: anchoDePantalla * 0.8 },
    })
    .setOrigin(0.5)
    .setShadow(0, 4, '#000000', 14, false, true)
    .setAlpha(0)
    .setScale(0.94);

  const separacion = titulo.height / 2 + 28 * escala.globos;
  const largoDelAdorno = Math.min(anchoDePantalla * 0.3, titulo.width / 2 + 60);
  const adornos = [
    dibujarAdorno(escena, -separacion, largoDelAdorno),
    dibujarAdorno(escena, separacion, largoDelAdorno),
  ];
  for (const adorno of adornos) adorno.setAlpha(0).setScale(0, 1);

  const contenedor = escena.add
    .container(vista.centerX, vista.centerY, [velo, ...adornos, titulo])
    .setDepth(PROFUNDIDAD.titulo)
    .setScale(1 / camara.zoom);
  return { contenedor, velo, titulo, adornos };
}

/** Una línea dorada fina con un rombo al centro, a la altura `y`. Se dibuja centrada para abrirse desde el medio. */
function dibujarAdorno(escena: Phaser.Scene, y: number, largoDeCadaLado: number): Phaser.GameObjects.Graphics {
  const tamanoDelRombo = 7;
  const espacioJuntoAlRombo = 16;
  const adorno = escena.add.graphics({ x: 0, y });
  adorno.lineStyle(2, COLOR_DEL_ADORNO, 0.9);
  adorno.lineBetween(-largoDeCadaLado, 0, -espacioJuntoAlRombo, 0);
  adorno.lineBetween(espacioJuntoAlRombo, 0, largoDeCadaLado, 0);
  adorno.fillStyle(COLOR_DEL_ADORNO, 1);
  // El rombo son dos triángulos: la mitad de arriba y la de abajo.
  adorno.fillTriangle(-tamanoDelRombo, 0, tamanoDelRombo, 0, 0, -tamanoDelRombo);
  adorno.fillTriangle(-tamanoDelRombo, 0, tamanoDelRombo, 0, 0, tamanoDelRombo);
  return adorno;
}
