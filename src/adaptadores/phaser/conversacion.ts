/**
 * Todo lo que se ve y se oye al hablar: globos de diálogo, menú de opciones y comentarios.
 *
 * Cómo termina una línea:
 *   - Un toque mientras el texto se escribe → muestra el texto completo.
 *   - Un toque con el texto completo → cierra el globo.
 *   - Si nadie toca, el globo se cierra solo poco después de que termina la voz.
 */
import type * as Phaser from 'phaser';
import type { Contenido, Idioma, Linea, Opcion } from '../../core/esquema';
import type { Actor } from './actor';
import { Globo } from './globo';
import type { EscalaDeInterfaz } from './interfaz';
import { MenuDeOpciones } from './opciones';
import { Voz } from './voz';

/** Pausa entre que termina la voz y se cierra el globo solo. */
const ESPERA_AL_TERMINAR_LA_VOZ = 700;
const ESPERA_AL_TERMINAR_UN_COMENTARIO = 800;

export interface DatosDeConversacion {
  escena: Phaser.Scene;
  contenido: Contenido;
  idiomaBase: Idioma;
  escala: EscalaDeInterfaz;
  /** El actor que dice una línea (para poner el globo sobre su cabeza). */
  buscarActor: (hablante: string) => Actor | undefined;
  /** Se llama cuando una línea muestra una tarjeta de vocabulario. */
  alVerPalabra: (palabra: { en: string; es: string }) => void;
}

export class Conversacion {
  readonly voz: Voz;
  private escala: EscalaDeInterfaz;
  /** Qué hacer con el próximo toque o Enter mientras hay una línea en pantalla. */
  private alAvanzar?: () => void;
  /** Qué hacer con una tecla 1–9 mientras hay opciones en pantalla. */
  private alElegirConTeclado?: (indice: number) => void;
  private terminarComentarioActual?: () => void;

  constructor(private readonly datos: DatosDeConversacion) {
    this.voz = new Voz(datos.escena);
    this.escala = datos.escala;
  }

  get hayUnComentario(): boolean {
    return this.terminarComentarioActual !== undefined;
  }

  get hayOpcionesEnPantalla(): boolean {
    return this.alElegirConTeclado !== undefined;
  }

  cambiarEscala(escala: EscalaDeInterfaz): void {
    this.escala = escala;
  }

  /** Toque o Enter durante una línea. Devuelve false si no había ninguna línea esperando. */
  avanzar(): boolean {
    if (!this.alAvanzar) return false;
    this.alAvanzar();
    return true;
  }

  elegirConTeclado(indice: number): void {
    this.alElegirConTeclado?.(indice);
  }

  // ── Líneas ──

  mostrarLinea(linea: Linea, texto: string, cancelacion: AbortSignal): Promise<void> {
    this.cancelarComentario();
    const actor = this.datos.buscarActor(linea.hablante);
    actor?.animar('hablar');
    const globo = this.crearGlobo(linea, texto);

    return new Promise((terminar) => {
      let terminada = false;
      let temporizadorDeCierre: Phaser.Time.TimerEvent | undefined;
      const hablaDeEstaLinea = new AbortController();

      const cerrar = () => {
        if (terminada) return;
        terminada = true;
        this.alAvanzar = undefined;
        temporizadorDeCierre?.remove();
        cancelacion.removeEventListener('abort', cerrar);
        hablaDeEstaLinea.abort();
        globo.destruir();
        this.voz.callar();
        actor?.animar('idle');
        terminar();
      };

      this.alAvanzar = () => {
        if (globo.escribiendo) globo.completar();
        else cerrar();
      };
      cancelacion.addEventListener('abort', cerrar, { once: true });

      this.decirLinea(linea, texto, hablaDeEstaLinea.signal).then(() => {
        if (terminada) return;
        globo.completar();
        temporizadorDeCierre = this.datos.escena.time.delayedCall(ESPERA_AL_TERMINAR_LA_VOZ, cerrar);
      });
    });
  }

  // ── Opciones ──

  /** Muestra las opciones y las lee en voz alta una por una. Termina con el índice elegido. */
  elegirOpcion(pregunta: string, opciones: Opcion[], cancelacion: AbortSignal): Promise<number> {
    return new Promise((terminar) => {
      const lectura = new AbortController(); // para dejar de leer en cuanto se elija

      const cerrarMenu = () => {
        cancelacion.removeEventListener('abort', cerrarMenu);
        lectura.abort();
        this.voz.callar();
        menu.destruir();
        this.alElegirConTeclado = undefined;
      };
      const elegir = (indice: number) => {
        if (indice < 0 || indice >= opciones.length) return;
        cerrarMenu();
        terminar(indice);
      };

      const menu = new MenuDeOpciones(this.datos.escena, pregunta, opciones, this.escala, elegir);
      this.alElegirConTeclado = elegir;
      cancelacion.addEventListener('abort', cerrarMenu, { once: true });

      this.leerOpciones(pregunta, opciones, menu, lectura.signal);
    });
  }

  /** Nada requiere leer: se escucha la pregunta y luego cada opción mientras se resalta. */
  private async leerOpciones(pregunta: string, opciones: Opcion[], menu: MenuDeOpciones, cancelacion: AbortSignal): Promise<void> {
    const idioma = this.datos.idiomaBase;
    await this.voz.decir(pregunta, idioma, undefined, cancelacion);

    for (const [indice, opcion] of opciones.entries()) {
      if (cancelacion.aborted) return;
      menu.resaltar(indice);
      if (opcion.audio || opcion.texto) {
        await this.voz.decir(opcion.texto ?? '', idioma, opcion.audio, cancelacion);
      }
    }
    if (!cancelacion.aborted) menu.resaltar(-1);
  }

  // ── Comentarios ──

  /** Un comentario es como una línea, pero no espera toques y se cierra solo. */
  decirComentario(linea: Linea, texto: string): void {
    const cancelacion = new AbortController();
    const globo = this.crearGlobo(linea, texto);

    const terminar = () => {
      cancelacion.abort();
      globo.destruir();
      this.terminarComentarioActual = undefined;
    };
    this.terminarComentarioActual = terminar;

    this.decirLinea(linea, texto, cancelacion.signal).then(() => {
      if (cancelacion.signal.aborted) return;
      this.datos.escena.time.delayedCall(ESPERA_AL_TERMINAR_UN_COMENTARIO, () => {
        if (this.terminarComentarioActual === terminar) terminar();
      });
    });
  }

  cancelarComentario(): void {
    this.terminarComentarioActual?.();
  }

  callar(): void {
    this.voz.callar();
  }

  // ── Ayudantes ──

  private crearGlobo(linea: Linea, texto: string): Globo {
    const personaje = this.datos.contenido.meta.personajes[linea.hablante];
    const actor = this.datos.buscarActor(linea.hablante);
    const vista = this.datos.escena.cameras.main.worldView;

    // Sobre la cabeza de quien habla; si no está en pantalla, arriba al centro.
    const x = actor ? actor.posicion.x : vista.centerX;
    const y = actor ? actor.sprite.y - actor.sprite.displayHeight - 12 : vista.y + vista.height * 0.4;

    let palabra: string | undefined;
    if (linea.en && linea.es) {
      palabra = `${linea.en} · ${linea.es}`;
      this.datos.alVerPalabra({ en: linea.en, es: linea.es });
    }

    // La traducción solo se muestra si el personaje habla otro idioma que el de la interfaz.
    const hablaOtroIdioma = personaje !== undefined && personaje.idioma !== this.datos.idiomaBase;

    return new Globo(this.datos.escena, x, y, texto, this.escala, {
      traduccion: hablaOtroIdioma ? linea.trad : undefined,
      palabra,
      milisegundosPorLetra: personaje?.velocidad,
    });
  }

  /** Primero la voz en el idioma del personaje; si habla otro idioma, después la traducción. */
  private async decirLinea(linea: Linea, texto: string, cancelacion: AbortSignal): Promise<void> {
    const idiomaDelPersonaje = this.datos.contenido.meta.personajes[linea.hablante]?.idioma ?? this.datos.idiomaBase;
    await this.voz.decir(texto, idiomaDelPersonaje, linea.audio, cancelacion);

    const hablaOtroIdioma = idiomaDelPersonaje !== this.datos.idiomaBase;
    if (linea.trad !== undefined && hablaOtroIdioma && !cancelacion.aborted) {
      await this.voz.decir(linea.trad, this.datos.idiomaBase, undefined, cancelacion);
    }
  }
}
